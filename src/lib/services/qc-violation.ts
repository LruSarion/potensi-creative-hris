import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const QC_ROLES: Role[] = ["QC_MANAGER", "QC_REVIEWER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];
const STREAMER_ROLES: Role[] = ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const violationSchema = z.object({
  streamerKaryawanId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  category: z.enum(["GROOMING", "ATTITUDE", "LANGUAGE", "DRESS_CODE", "PRODUCT_HANDLING", "PLATFORM_RULE", "TECHNICAL", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  description: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
});

export type QcViolationInput = z.infer<typeof violationSchema>;

/** QC reviewer: record a live-streaming violation with photo evidence. */
export async function createViolation(input: QcViolationInput) {
  const user = await requireRole(...QC_ROLES);
  const parsed = violationSchema.parse(input);
  const streamer = await db.karyawan.findFirst({
    where: { id: parsed.streamerKaryawanId, ...tenantWhere(user) },
  });
  if (!streamer) throw AppError.notFound("Streamer tidak ditemukan");
  const violation = await db.qcViolation.create({
    data: {
      tenantId: user.tenantId || undefined,
      jadwalId: parsed.jadwalId ?? null,
      streamerKaryawanId: parsed.streamerKaryawanId,
      category: parsed.category,
      severity: parsed.severity ?? "MEDIUM",
      description: parsed.description ?? null,
      photoUrl: parsed.photoUrl ?? null,
      videoUrl: parsed.videoUrl ?? null,
      capturedById: user.id,
    },
    include: { streamer: true },
  });

  // Auto-notify: the streamer (via their karyawan link), every SUPER_ADMIN, and every TRAINER.
  const catLabel = VIOLATION_LABELS[parsed.category] ?? parsed.category;
  const title = `Pelanggaran QC: ${catLabel}`;
  const message = `${streamer.namaLengkap} mendapat pelanggaran ${catLabel} (${parsed.severity}). ${parsed.description ?? ""}`;
  const link = "/qc-violations";

  const recipients: { userId?: string; karyawanId?: string }[] = [];
  if (streamer.userId) recipients.push({ userId: streamer.userId });
  const staff = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "TRAINER"] }, tenantId: user.tenantId ?? undefined },
    select: { id: true },
  });
  for (const u of staff) if (u.id !== user.id) recipients.push({ userId: u.id });

  for (const r of recipients) {
    await db.logAktivitas.create({
      data: {
        tenantId: user.tenantId || undefined,
        userId: r.userId,
        aksi: "NOTIFICATION",
        detail: JSON.stringify({
          targetUserId: r.userId ?? null,
          targetKaryawanId: r.karyawanId ?? null,
          title,
          message,
          link,
        }),
      },
    }).catch(() => {});
  }

  return violation;
}

/** List violations (QC sees all; streamer sees own). */
export async function listViolations(params?: { streamerKaryawanId?: string }) {
  const user = await requireRole();
  const isQc = QC_ROLES.includes(user.role);
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (isQc) {
    if (params?.streamerKaryawanId) where.streamerKaryawanId = params.streamerKaryawanId;
  } else {
    // Streamers only see their own violations.
    where.streamerKaryawanId = user.karyawanId ?? "__none__";
  }
  return db.qcViolation.findMany({
    where,
    include: { streamer: { select: { id: true, namaLengkap: true, idKaryawan: true } }, jadwal: { select: { idJadwal: true, platform: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Update violation status (QC/admin). */
export async function updateViolationStatus(id: string, status: "OPEN" | "REVIEWED" | "CLOSED") {
  const user = await requireRole(...QC_ROLES);
  const v = await db.qcViolation.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!v) throw AppError.notFound("Pelanggaran tidak ditemukan");
  return db.qcViolation.update({ where: { id }, data: { status } });
}

/** Streamer's violation summary (count by category) for the dashboard. */
export async function myViolationSummary() {
  const user = await requireRole(...STREAMER_ROLES);
  if (!user.karyawanId) return { count: 0, byCategory: {} };
  const rows = await db.qcViolation.findMany({
    where: { streamerKaryawanId: user.karyawanId },
    select: { category: true, severity: true },
  });
  const byCategory: Record<string, number> = {};
  let critical = 0;
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    if (r.severity === "HIGH" || r.severity === "CRITICAL") critical++;
  }
  return { count: rows.length, byCategory, critical };
}

/** Streamers currently LIVE (for QC reviewer to pick from). */
export async function listLiveStreamers() {
  const user = await requireRole(...QC_ROLES);
  return db.jadwal.findMany({
    where: { ...tenantWhere(user), liveState: "LIVE" },
    include: {
      streamerKaryawan: { select: { id: true, namaLengkap: true, idKaryawan: true } },
      client: { select: { namaClient: true } },
    },
    orderBy: { jamMulaiLive: "desc" },
  });
}

// Human-readable labels for the UI.
export const VIOLATION_LABELS: Record<string, string> = {
  GROOMING: "Grooming / Penampilan",
  ATTITUDE: "Attitude / Sikap",
  LANGUAGE: "Language / Ucapan",
  DRESS_CODE: "Dress Code / Pakaian",
  PRODUCT_HANDLING: "Penanganan Produk",
  PLATFORM_RULE: "Aturan Platform",
  TECHNICAL: "Teknis",
  OTHER: "Lainnya",
};
