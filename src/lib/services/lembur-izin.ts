import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { sendIzinNotificationEmail } from "@/lib/services/email";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const lemburSchema = z.object({
  karyawanId: z.string().min(1).optional(),
  tanggal: z.string().min(1),
  jamMulai: z.string().min(1),
  jamSelesai: z.string().min(1),
  alasan: z.string().optional().nullable(),
  buktiDriveId: z.string().optional().nullable(),
});

const izinSchema = z.object({
  karyawanId: z.string().min(1).optional(),
  tanggalMulai: z.string().min(1),
  tanggalSelesai: z.string().min(1),
  jenis: z.string().optional().nullable(),
  tipeIzin: z.string().optional().nullable(),
  alasan: z.string().optional().nullable(),
  lampiranDriveId: z.string().optional().nullable(),
});

export type LemburInput = z.infer<typeof lemburSchema>;
export type IzinInput = z.infer<typeof izinSchema>;

// ---------- LEMBUR ----------
export async function submitLembur(input: LemburInput) {
  const user = await requireRole();
  const parsed = lemburSchema.parse(input);
  const targetKaryawanId = parsed.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.badRequest("karyawanId diperlukan untuk pengajuan lembur");
  }
  if (user.karyawanId && user.karyawanId !== targetKaryawanId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat mengajukan lembur untuk orang lain");
  }
  return db.lembur.create({
    data: {
      karyawanId: targetKaryawanId,
      tanggal: new Date(parsed.tanggal),
      jamMulai: new Date(parsed.jamMulai),
      jamSelesai: new Date(parsed.jamSelesai),
      alasan: parsed.alasan ?? null,
      buktiDriveId: parsed.buktiDriveId ?? null,
    },
    include: { karyawan: true },
  });
}

export async function approveLembur(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.lembur.findUnique({ where: { id }, include: { karyawan: true } });
  if (!row) throw AppError.notFound("Lembur tidak ditemukan");
  if (row.karyawanId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }

  const updated = await db.lembur.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", approvedById: user.id },
    include: { karyawan: true },
  });

  if (updated.karyawan?.email) {
    sendIzinNotificationEmail({
      to: updated.karyawan.email,
      nama: updated.karyawan.namaLengkap,
      tipe: "Pengajuan Lembur",
      tanggal: new Date(updated.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      status: approve ? "APPROVED" : "REJECTED",
    }).catch((e) => console.error("[Lembur Email Error]:", e));
  }

  return updated;
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
  const parsed = izinSchema.parse(input);
  const targetKaryawanId = parsed.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.badRequest("karyawanId diperlukan untuk pengajuan cuti/izin");
  }
  if (user.karyawanId && user.karyawanId !== targetKaryawanId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat mengajukan izin untuk orang lain");
  }
  return db.izin.create({
    data: {
      karyawanId: targetKaryawanId,
      tanggalMulai: new Date(parsed.tanggalMulai),
      tanggalSelesai: new Date(parsed.tanggalSelesai),
      jenis: parsed.jenis || parsed.tipeIzin || null,
      alasan: parsed.alasan ?? null,
      lampiranDriveId: parsed.lampiranDriveId ?? null,
    },
    include: { karyawan: true },
  });
}

export async function approveIzin(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.izin.findUnique({ where: { id }, include: { karyawan: true } });
  if (!row) throw AppError.notFound("Izin tidak ditemukan");
  if (row.karyawanId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }

  const updated = await db.izin.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", approvedById: user.id },
    include: { karyawan: true },
  });

  if (updated.karyawan?.email) {
    sendIzinNotificationEmail({
      to: updated.karyawan.email,
      nama: updated.karyawan.namaLengkap,
      tipe: `Pengajuan Izin / ${updated.jenis || "Cuti"}`,
      tanggal: `${new Date(updated.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(updated.tanggalSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`,
      status: approve ? "APPROVED" : "REJECTED",
    }).catch((e) => console.error("[Izin Email Error]:", e));
  }

  return updated;
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
