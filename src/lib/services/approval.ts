import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const pengajuanSchema = z.object({
  idJadwal: z.string().min(1),
  tanggal: z.string().min(1),
  platform: z.string().optional().nullable(),
  streamerKaryawanId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  judulLive: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
});

export type PengajuanInput = z.infer<typeof pengajuanSchema>;

/**
 * Submit a marketplace jadwal for approval (creates a PENDING jadwal).
 */
export async function addPengajuanMarketplace(input: PengajuanInput) {
  const user = await requireRole();
  const parsed = pengajuanSchema.parse(input);
  const existing = await db.jadwal.findUnique({ where: { idJadwal: parsed.idJadwal } });
  if (existing) throw AppError.conflict("ID Jadwal sudah terdaftar");
  return db.jadwal.create({
    data: {
      idJadwal: parsed.idJadwal,
      tanggal: new Date(parsed.tanggal),
      platform: parsed.platform ?? null,
      streamerKaryawanId: parsed.streamerKaryawanId ?? user.karyawanId ?? null,
      clientId: parsed.clientId ?? null,
      judulLive: parsed.judulLive ?? null,
      catatanOts: parsed.catatan ?? null,
      status: "PENDING",
      jamMulaiLive: new Date(parsed.tanggal),
      jamSelesaiLive: new Date(parsed.tanggal),
    },
  });
}

/**
 * List jadwal pending approval (approvers) or own submissions (requesters).
 */
/**
 * Approval list aggregating all pending requests across module types:
 *  - jadwal  (schedule plotting)   -> processApproval
 *  - izin    (leave/cuti)          -> approveIzin
 *  - lembur  (overtime)            -> approveLembur
 * Approvers see all pending; requesters see only their own.
 */
export async function getApprovalList() {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);

  // Scope: approvers see everything; others only their own requests.
  const izinWhere = isApprover
    ? { status: "PENDING" as const }
    : { status: "PENDING" as const, karyawanId: user.karyawanId ?? "__none__" };
  const lemburWhere = isApprover
    ? { status: "PENDING" as const }
    : { status: "PENDING" as const, karyawanId: user.karyawanId ?? "__none__" };
  const jadwalWhere = isApprover
    ? { status: "PENDING" as const }
    : { status: "PENDING" as const, streamerKaryawanId: user.karyawanId ?? undefined };

  const [izin, lembur, jadwal] = await Promise.all([
    db.izin.findMany({ where: izinWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" } }),
    db.lembur.findMany({ where: lemburWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" } }),
    db.jadwal.findMany({ where: jadwalWhere, include: { streamerKaryawan: true, client: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return [
    ...izin.map((r) => ({
      type: "izin" as const,
      id: r.id,
      ref: "IZIN",
      tanggal: r.tanggalMulai,
      namaLengkap: r.karyawan?.namaLengkap ?? null,
      idKaryawan: r.karyawan?.idKaryawan ?? null,
      detail: r.jenis ?? "Izin",
      alasan: r.alasan,
      createdAt: r.createdAt,
    })),
    ...lembur.map((r) => ({
      type: "lembur" as const,
      id: r.id,
      ref: "LEMBUR",
      tanggal: r.tanggal,
      namaLengkap: r.karyawan?.namaLengkap ?? null,
      idKaryawan: r.karyawan?.idKaryawan ?? null,
      detail: `Lembur ${r.jamMulai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}–${r.jamSelesai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      alasan: r.alasan,
      createdAt: r.createdAt,
    })),
    ...jadwal.map((r) => ({
      type: "jadwal" as const,
      id: r.id,
      ref: r.idJadwal,
      tanggal: r.tanggal,
      namaLengkap: r.streamerKaryawan?.namaLengkap ?? "Belum Ditentukan",
      idKaryawan: r.streamerKaryawan?.idKaryawan ?? null,
      detail: r.client?.namaClient ?? "General",
      alasan: r.platform ?? null,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Process an approval: APPROVED or REJECTED. Approver cannot approve own submission.
 */
export async function processApproval(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.jadwal.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");
  if (row.streamerKaryawanId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }
  return db.jadwal.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED" },
  });
}

/**
 * Take a marketplace job (streamer claims an approved/available jadwal).
 */
export async function takeMarketplaceJob(id: string) {
  const user = await requireRole();
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  const row = await db.jadwal.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");
  if (row.status !== "APPROVED" && row.status !== "TERJADWAL") {
    throw AppError.conflict("Jadwal tidak tersedia untuk diambil");
  }
  return db.jadwal.update({
    where: { id },
    data: { streamerKaryawanId: user.karyawanId, status: "TERJADWAL" },
  });
}

/**
 * Cancel a marketplace job (streamer releases it).
 */
export async function cancelMarketplaceJob(id: string) {
  const user = await requireRole();
  const row = await db.jadwal.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");
  if (row.streamerKaryawanId !== user.karyawanId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat membatalkan jadwal orang lain");
  }
  return db.jadwal.update({
    where: { id },
    data: { streamerKaryawanId: null, status: "DIBATALKAN" },
  });
}
