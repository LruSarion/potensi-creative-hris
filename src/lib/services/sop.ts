import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"];

const taskSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().optional(),
  requiresPhoto: z.coerce.boolean().optional().default(false),
});

const templateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  tasks: z.array(taskSchema).optional().default([]),
});

export type SopTemplateInput = z.infer<typeof templateSchema>;

// ---------- TEMPLATES (manager/ops) ----------

export async function listTemplates() {
  const user = await requireRole();
  return db.sopTemplate.findMany({
    where: { ...tenantWhere(user), active: true },
    include: { tasks: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createTemplate(input: SopTemplateInput) {
  const user = await requireRole(...MANAGER_ROLES);
  const parsed = templateSchema.parse(input);
  return db.$transaction(async (tx) => {
    const tpl = await tx.sopTemplate.create({
      data: { tenantId: user.tenantId || undefined, title: parsed.title, description: parsed.description ?? null },
    });
    parsed.tasks.forEach((task, idx) => {
      void tx.sopTask.create({
        data: {
          templateId: tpl.id,
          title: task.title,
          order: task.order ?? idx + 1,
          requiresPhoto: task.requiresPhoto,
        },
      });
    });
    return tx.sopTemplate.findUnique({ where: { id: tpl.id }, include: { tasks: true } });
  });
}

export async function deactivateTemplate(id: string) {
  const user = await requireRole(...MANAGER_ROLES);
  const tpl = await db.sopTemplate.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!tpl) throw AppError.notFound("Template SOP tidak ditemukan");
  return db.sopTemplate.update({ where: { id }, data: { active: false } });
}

// ---------- CHECKLIST COMPLETION (staff/OTS + managers) ----------

/** Today's checklist for the current user, with completion status + photos. */
export async function getTodayChecklist() {
  const user = await requireRole("STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const templates = await db.sopTemplate.findMany({
    where: { active: true, ...tenantWhere(user) },
    include: {
      tasks: {
        orderBy: { order: "asc" },
        include: {
          completions: {
            where: { karyawanId: user.karyawanId ?? "__none__", tanggal: { gte: startOfDay } },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return templates.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    tasks: t.tasks.map((task) => {
      const done = task.completions[0];
      return {
        id: task.id,
        title: task.title,
        requiresPhoto: task.requiresPhoto,
        completed: done?.completed ?? false,
        photoUrl: done?.photoUrl ?? null,
        note: done?.note ?? null,
        completionId: done?.id ?? null,
      };
    }),
  }));
}

/** Complete/update an SOP task for today, with optional photo evidence. */
export async function completeTask(taskId: string, opts: { completed: boolean; photoUrl?: string; note?: string }) {
  const user = await requireRole("STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  const task = await db.sopTask.findUnique({ where: { id: taskId } });
  if (!task) throw AppError.notFound("Tugas SOP tidak ditemukan");
  if (opts.completed && task.requiresPhoto && !opts.photoUrl) {
    throw AppError.badRequest("Tugas ini wajib disertai bukti foto");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await db.sopTaskCompletion.findFirst({
    where: { taskId, karyawanId: user.karyawanId, tanggal: { gte: startOfDay } },
  });

  if (existing) {
    return db.sopTaskCompletion.update({
      where: { id: existing.id },
      data: { completed: opts.completed, photoUrl: opts.photoUrl ?? existing.photoUrl, note: opts.note ?? existing.note },
    });
  }
  return db.sopTaskCompletion.create({
    data: {
      taskId,
      karyawanId: user.karyawanId,
      completed: opts.completed,
      photoUrl: opts.photoUrl ?? null,
      note: opts.note ?? null,
    },
  });
}

/** Manager view: all staff/OTS completions for a date range. */
export async function listCompletions(params?: { tanggal?: string }) {
  const user = await requireRole(...MANAGER_ROLES);
  const where: Record<string, unknown> = { ...tenantWhere(user, "karyawan") };
  if (params?.tanggal) {
    const d = new Date(params.tanggal);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    where.tanggal = { gte: d, lt: end };
  }
  return db.sopTaskCompletion.findMany({
    where,
    include: {
      task: { include: { template: true } },
      karyawan: { select: { id: true, namaLengkap: true, idKaryawan: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
