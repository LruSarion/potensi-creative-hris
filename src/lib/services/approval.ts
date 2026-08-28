import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"];

const pengajuanSchema = z.object({
  idJadwal: z.string().min(1),
  tanggal: z.string().min(1),
  platform: z.string().optional().nullable(),
  streamerKaryawanId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  judulLive: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
  jamMulai: z.string().optional().nullable(),
  jamSelesai: z.string().optional().nullable(),
  cabangStudio: z.string().optional().nullable(),
  nomorStudio: z.string().optional().nullable(),
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

  const tgl = new Date(parsed.tanggal);
  return db.jadwal.create({
    data: {
      idJadwal: parsed.idJadwal,
      tanggal: tgl,
      platform: parsed.platform ?? null,
      streamerKaryawanId: parsed.streamerKaryawanId ?? user.karyawanId ?? null,
      clientId: parsed.clientId ?? null,
      judulLive: parsed.judulLive ?? null,
      catatanOts: parsed.catatan ?? null,
      status: "PENDING",
      jamMulaiLive: parsed.jamMulai ? new Date(`${parsed.tanggal}T${parsed.jamMulai}:00`) : tgl,
      jamSelesaiLive: parsed.jamSelesai ? new Date(`${parsed.tanggal}T${parsed.jamSelesai}:00`) : tgl,
      cabangStudio: parsed.cabangStudio ?? null,
      nomorStudio: parsed.nomorStudio ?? null,
    },
  });
}

/**
 * Approval list aggregating all requests across module types:
 *  - jadwal  (Marketplace / Schedule)
 *  - izin    (Leave / Cuti)
 *  - lembur  (Overtime)
 *  - shift   (Tukar Shift)
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
    db.izin.findMany({ where: izinWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.lembur.findMany({ where: lemburWhere, include: { karyawan: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.jadwal.findMany({ where: jadwalWhere, include: { streamerKaryawan: true, hostKaryawan: true, otsKaryawan: true, client: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.tukarShift.findMany({ where: shiftWhere, include: { requester: true, target: true }, orderBy: { createdAt: "desc" }, take: 300 }).catch(() => [] as any[]),
  ]);

  return [
    ...izin.map((r) => ({
      type: "izin" as const,
      id: r.id,
      ref: `IZIN-${r.id.slice(0, 6).toUpperCase()}`,
      tanggal: r.tanggalMulai.toISOString().split("T")[0],
      namaLengkap: r.karyawan?.namaLengkap ?? "Karyawan",
      idKaryawan: r.karyawan?.idKaryawan ?? null,
      detail: r.jenis || "Cuti/Izin",
      alasan: r.alasan,
      status: r.status,
      jenis: r.jenis,
      tanggalMulai: r.tanggalMulai.toISOString().split("T")[0],
      tanggalSelesai: r.tanggalSelesai.toISOString().split("T")[0],
      lampiranDriveId: r.lampiranDriveId ?? null,
      createdAt: r.createdAt,
    })),
    ...lembur.map((r) => ({
      type: "lembur" as const,
      id: r.id,
      ref: `LMB-${r.id.slice(0, 6).toUpperCase()}`,
      tanggal: r.tanggal.toISOString().split("T")[0],
      namaLengkap: r.karyawan?.namaLengkap ?? "Karyawan",
      idKaryawan: r.karyawan?.idKaryawan ?? null,
      detail: `Lembur ${r.jamMulai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}–${r.jamSelesai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      alasan: r.alasan,
      status: r.status,
      jamMulai: r.jamMulai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      jamSelesai: r.jamSelesai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      buktiDriveId: r.buktiDriveId ?? null,
      createdAt: r.createdAt,
    })),
    ...jadwal.map((r) => {
      const jamMulaiStr = r.jamMulaiLive ? r.jamMulaiLive.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "00:00";
      const jamSelesaiStr = r.jamSelesaiLive ? r.jamSelesaiLive.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "00:00";
      const durasiHour = Math.max(1, Math.round((r.jamSelesaiLive.getTime() - r.jamMulaiLive.getTime()) / (1000 * 60 * 60)));

      return {
        type: "jadwal" as const,
        id: r.id,
        ref: r.idJadwal,
        idJadwal: r.idJadwal,
        platform: r.platform || "General",
        judulLive: r.judulLive || "Campaign Live",
        tanggal: r.tanggal.toISOString().split("T")[0],
        jamMulai: jamMulaiStr,
        jamSelesai: jamSelesaiStr,
        durasi: `${durasiHour} Jam`,
        namaLengkap: r.streamerKaryawan?.namaLengkap ?? r.hostKaryawan?.namaLengkap ?? "Belum Ditentukan",
        idKaryawan: r.streamerKaryawan?.idKaryawan ?? r.hostKaryawan?.idKaryawan ?? null,
        detail: r.client?.namaClient ?? "General",
        alasan: r.platform ?? null,
        status: r.status,
        liveState: r.liveState,
        cabangStudio: r.cabangStudio ?? null,
        nomorStudio: r.nomorStudio ?? null,
        filePendukungHost: r.filePendukungHostDriveId ?? null,
        filePendukungOts: r.filePendukungOtsDriveId ?? null,
        produkPrioritas: r.produkPrioritas ?? null,
        promoLive: r.promoLive ?? null,
        catatanHost: r.catatanHost ?? null,
        catatanOts: r.catatanOts ?? null,
        createdAt: r.createdAt,
      };
    }),
    ...shifts.map((r: any) => ({
      type: "shift" as const,
      id: r.id,
      ref: `SHIFT-${r.id.slice(0, 6).toUpperCase()}`,
      tanggal: r.tanggal ? (typeof r.tanggal === "string" ? r.tanggal : r.tanggal.toISOString().split("T")[0]) : "",
      namaLengkap: r.requester?.namaLengkap ?? "Pemohon",
      idKaryawan: r.requester?.idKaryawan ?? null,
      detail: `Tukar: ${r.requester?.namaLengkap ?? "?"} ➔ ${r.target?.namaLengkap ?? "?"}`,
      alasan: r.alasan ?? null,
      status: r.status === "TARGET_CONFIRMED" ? "PENDING" : r.status,
      requesterName: r.requester?.namaLengkap ?? null,
      targetName: r.target?.namaLengkap ?? null,
      lampiranDriveId: r.lampiranDriveId ?? null,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Process a single approval for Jadwal
 */
export async function processApproval(id: string, approve: boolean, extraData?: { cabangStudio?: string; nomorStudio?: string }) {
  await requireRole(...APPROVER_ROLES);
  const row = await db.jadwal.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");

  return db.jadwal.update({
    where: { id },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      ...(extraData?.cabangStudio ? { cabangStudio: extraData.cabangStudio } : {}),
      ...(extraData?.nomorStudio ? { nomorStudio: extraData.nomorStudio } : {}),
    },
  });
}

/**
 * Bulk approve schedules with assignment of Cabang and Studio
 */
export async function bulkApproveJadwal(items: Array<{ id: string; cabangStudio?: string; nomorStudio?: string }>) {
  await requireRole(...APPROVER_ROLES);
  const results = [];
  for (const item of items) {
    const updated = await db.jadwal.update({
      where: { id: item.id },
      data: {
        status: "APPROVED",
        ...(item.cabangStudio ? { cabangStudio: item.cabangStudio } : {}),
        ...(item.nomorStudio ? { nomorStudio: item.nomorStudio } : {}),
      },
    });
    results.push(updated);
  }
  return results;
}

/**
 * Publish approved schedules to marketplace (liveState -> WAR_OPEN)
 */
export async function publishToMarketplace(ids: string[]) {
  await requireRole(...APPROVER_ROLES);
  return db.jadwal.updateMany({
    where: { id: { in: ids } },
    data: {
      liveState: "LIVE",
    },
  });
}

/**
 * Send online schedules to cleaning
 */
export async function sendToCleaning(ids: string[]) {
  await requireRole(...APPROVER_ROLES);
  return db.jadwal.updateMany({
    where: { id: { in: ids } },
    data: {
      liveState: "REVIEW",
    },
  });
}

/**
 * Pull cleaning schedules back to approved
 */
export async function pullToApproved(ids: string[]) {
  await requireRole(...APPROVER_ROLES);
  return db.jadwal.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "APPROVED",
      liveState: "SCHEDULED",
    },
  });
}

/**
 * Update schedule details (edit modal)
 */
export async function updateJadwalDetails(id: string, data: Partial<{
  platform: string;
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  judulLive: string;
  cabangStudio: string;
  nomorStudio: string;
  promoLive: string;
  filePendukungHost: string;
  filePendukungOts: string;
  produkPrioritas: string;
}>) {
  await requireRole(...APPROVER_ROLES);
  const row = await db.jadwal.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");

  const updateData: any = {};
  if (data.platform) updateData.platform = data.platform;
  if (data.judulLive) updateData.judulLive = data.judulLive;
  if (data.cabangStudio !== undefined) updateData.cabangStudio = data.cabangStudio;
  if (data.nomorStudio !== undefined) updateData.nomorStudio = data.nomorStudio;
  if (data.promoLive !== undefined) updateData.promoLive = data.promoLive;
  if (data.filePendukungHost !== undefined) updateData.filePendukungHostDriveId = data.filePendukungHost;
  if (data.filePendukungOts !== undefined) updateData.filePendukungOtsDriveId = data.filePendukungOts;
  if (data.produkPrioritas !== undefined) updateData.produkPrioritas = data.produkPrioritas;

  if (data.tanggal) {
    updateData.tanggal = new Date(data.tanggal);
    if (data.jamMulai) updateData.jamMulaiLive = new Date(`${data.tanggal}T${data.jamMulai}:00`);
    if (data.jamSelesai) updateData.jamSelesaiLive = new Date(`${data.tanggal}T${data.jamSelesai}:00`);
  }

  return db.jadwal.update({
    where: { id },
    data: updateData,
  });
}
