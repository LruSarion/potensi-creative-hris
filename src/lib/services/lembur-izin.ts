import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const lemburSchema = z.object({
  karyawanId: z.string().min(1),
  tanggal: z.string().min(1),
  jamMulai: z.string().min(1),
  jamSelesai: z.string().min(1),
  alasan: z.string().optional().nullable(),
  buktiDriveId: z.string().optional().nullable(),
});

const izinSchema = z.object({
  karyawanId: z.string().min(1),
  tanggalMulai: z.string().min(1),
  tanggalSelesai: z.string().min(1),
  jenis: z.string().optional().nullable(),
  alasan: z.string().optional().nullable(),
  lampiranDriveId: z.string().optional().nullable(),
});

export type LemburInput = z.infer<typeof lemburSchema>;
export type IzinInput = z.infer<typeof izinSchema>;

// ---------- LEMBUR ----------
export async function submitLembur(input: LemburInput) {
  const user = await requireRole();
  if (user.karyawanId && user.karyawanId !== input.karyawanId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat mengajukan lembur untuk orang lain");
  }
  const parsed = lemburSchema.parse(input);
  return db.lembur.create({
    data: {
      karyawanId: parsed.karyawanId,
      tanggal: new Date(parsed.tanggal),
      jamMulai: new Date(parsed.jamMulai),
      jamSelesai: new Date(parsed.jamSelesai),
      alasan: parsed.alasan ?? null,
      buktiDriveId: parsed.buktiDriveId ?? null,
    },
  });
}

export async function approveLembur(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.lembur.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Lembur tidak ditemukan");
  if (row.karyawanId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }
  return db.lembur.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", approvedById: user.id },
  });
}

export async function listLembur(params?: { karyawanId?: string }) {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);
  // Non-approvers see only their own requests (data isolation).
  const where = params?.karyawanId
    ? { karyawanId: params.karyawanId }
    : !isApprover && user.karyawanId
      ? { karyawanId: user.karyawanId }
      : undefined;
  return db.lembur.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { karyawan: true },
  });
}

// ---------- IZIN ----------
export async function submitIzin(input: IzinInput) {
  const user = await requireRole();
  if (user.karyawanId && user.karyawanId !== input.karyawanId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat mengajukan izin untuk orang lain");
  }
  const parsed = izinSchema.parse(input);
  return db.izin.create({
    data: {
      karyawanId: parsed.karyawanId,
      tanggalMulai: new Date(parsed.tanggalMulai),
      tanggalSelesai: new Date(parsed.tanggalSelesai),
      jenis: parsed.jenis ?? null,
      alasan: parsed.alasan ?? null,
      lampiranDriveId: parsed.lampiranDriveId ?? null,
    },
  });
}

export async function approveIzin(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.izin.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Izin tidak ditemukan");
  if (row.karyawanId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }
  return db.izin.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", approvedById: user.id },
  });
}

export async function listIzin(params?: { karyawanId?: string }) {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);
  // Non-approvers see only their own requests (data isolation).
  const where = params?.karyawanId
    ? { karyawanId: params.karyawanId }
    : !isApprover && user.karyawanId
      ? { karyawanId: user.karyawanId }
      : undefined;
  return db.izin.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { karyawan: true },
  });
}
