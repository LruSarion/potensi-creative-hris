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
 * Approval list aggregating all requests across module types with all statuses:
 *  - jadwal  (schedule / marketplace)  -> processApproval
 *  - izin    (leave/cuti)              -> approveIzin
 *  - lembur  (overtime)                -> approveLembur
 *  - shift   (tukar-shift)             -> tukar-shift PATCH
 * Approvers see all; requesters see only their own.
 */
export async function getApprovalList() {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);

  const izinWhere = isApprover ? {} : { karyawanId: user.karyawanId ?? "__none__" };
  const lemburWhere = isApprover ? {} : { karyawanId: user.karyawanId ?? "__none__" };
  const jadwalWhere = isApprover ? {} : { streamerKaryawanId: user.karyawanId ?? undefined };
  const shiftWhere = isApprover ? {} : {
    OR: [
      { requesterId: user.karyawanId ?? "__none__" },
      { targetId: user.karyawanId ?? "__none__" },
    ],
  };

  const [izin, lembur, jadwal, shifts] = await Promise.all([
    db.izin.findMany({ where: izinWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.lembur.findMany({ where: lemburWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.jadwal.findMany({ where: jadwalWhere, include: { streamerKaryawan: true, client: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.tukarShift.findMany({ where: shiftWhere, include: { requester: true, target: true }, orderBy: { createdAt: "desc" }, take: 200 }).catch(() => [] as any[]),
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
      status: r.status,
      jenis: r.jenis,
      tanggalMulai: r.tanggalMulai,
      tanggalSelesai: r.tanggalSelesai,
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
      status: r.status,
      jamMulai: r.jamMulai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      jamSelesai: r.jamSelesai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
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
      status: r.status,
      createdAt: r.createdAt,
    })),
    ...shifts.map((r: any) => ({
      type: "shift" as const,
      id: r.id,
      ref: `SHIFT-${r.id.slice(0, 6).toUpperCase()}`,
      tanggal: r.tanggal,
      namaLengkap: r.requester?.namaLengkap ?? null,
      idKaryawan: r.requester?.idKaryawan ?? null,
      detail: `Tukar: ${r.requester?.namaLengkap ?? "?"} ➔ ${r.target?.namaLengkap ?? "?"}`,
      alasan: r.alasan ?? null,
      status: r.status === "TARGET_CONFIRMED" ? "PENDING" : r.status,
      requesterName: r.requester?.namaLengkap ?? null,
      targetName: r.target?.namaLengkap ?? null,
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
