import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"];

const tukarShiftSchema = z.object({
  tipeRole: z.enum(["STREAMER", "OTS", "KHUSUS"]).optional().default("STREAMER"),
  requesterId: z.string().optional(),
  targetId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  tanggal: z.string().optional(),
  alasan: z.string().optional().nullable(),
  lampiranDriveId: z.string().optional().nullable(),
});

export type TukarShiftInput = z.infer<typeof tukarShiftSchema>;

/**
 * Get available schedules and employee list for the swap form
 */
export async function getTukarShiftFormData(roleFilter?: string) {
  const user = await requireRole();
  const isAdmin = APPROVER_ROLES.includes(user.role);

  // 1. Fetch active schedules
  const jadwalWhere: Record<string, unknown> = {
    ...tenantWhere(user),
    status: { notIn: ["DIBATALKAN", "REJECTED", "SELESAI"] },
  };

  if (!isAdmin && user.karyawanId) {
    if (roleFilter === "OTS") {
      jadwalWhere.otsKaryawanId = user.karyawanId;
    } else {
      jadwalWhere.OR = [
        { streamerKaryawanId: user.karyawanId },
        { hostKaryawanId: user.karyawanId },
      ];
    }
  }

  const rawJadwal = await db.jadwal.findMany({
    where: jadwalWhere,
    orderBy: { jamMulaiLive: "asc" },
    include: {
      streamerKaryawan: true,
      hostKaryawan: true,
      otsKaryawan: true,
      client: true,
    },
    take: 100,
  });

  const referensiJadwal = rawJadwal.map((j) => {
    const tglStr = j.tanggal ? new Date(j.tanggal).toISOString().split("T")[0] : "";
    const startStr = j.jamMulaiLive
      ? new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
    const endStr = j.jamSelesaiLive
      ? new Date(j.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
    const platform = j.platform || "Live";
    const studio = j.cabangStudio ? ` (${j.cabangStudio}${j.nomorStudio ? ` #${j.nomorStudio}` : ""})` : "";
    return `${j.idJadwal} | ${tglStr} | ${startStr} | ${endStr} | ${platform}${studio}`;
  });

  // 2. Fetch employee list (candidates for replacement)
  const rawKaryawan = await db.karyawan.findMany({
    where: {
      ...tenantWhere(user),
      statusAktif: "AKTIF",
    },
    orderBy: { namaLengkap: "asc" },
  });

  const helperHost = rawKaryawan.map((k) => {
    return `${k.idKaryawan || k.id} | ${k.namaLengkap} (${k.jabatan || "Karyawan"})`;
  });

  return {
    REFERENSI_JADWAL: referensiJadwal,
    HELPER_HOST: helperHost,
    rawJadwal: rawJadwal.map((j) => ({
      id: j.id,
      idJadwal: j.idJadwal,
      tanggal: j.tanggal,
      jamMulaiLive: j.jamMulaiLive,
      jamSelesaiLive: j.jamSelesaiLive,
      platform: j.platform,
      cabangStudio: j.cabangStudio,
      nomorStudio: j.nomorStudio,
      streamerKaryawan: j.streamerKaryawan,
      otsKaryawan: j.otsKaryawan,
    })),
    rawKaryawan: rawKaryawan.map((k) => ({
      id: k.id,
      idKaryawan: k.idKaryawan,
      namaLengkap: k.namaLengkap,
      jabatan: k.jabatan,
    })),
  };
}

/**
 * Check if target replacement host has a schedule clash
 */
export async function cekBentrokJadwal(params: {
  tanggal: string;
  idHost: string;
  jamMulai?: string;
  jamSelesai?: string;
}) {
  await requireRole();
  const { tanggal, idHost, jamMulai, jamSelesai } = params;

  if (!tanggal || !idHost) {
    return { status: "error", message: "Parameter tanggal dan Host Pengganti wajib diisi." };
  }

  // Resolve target employee
  const targetKaryawan = await db.karyawan.findFirst({
    where: {
      OR: [{ id: idHost }, { idKaryawan: idHost }],
    },
  });

  if (!targetKaryawan) {
    return { status: "error", message: "Data Host Pengganti tidak ditemukan di database." };
  }

  // Parse check date
  const targetDate = new Date(tanggal);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingSchedules = await db.jadwal.findMany({
    where: {
      tanggal: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
      OR: [
        { streamerKaryawanId: targetKaryawan.id },
        { hostKaryawanId: targetKaryawan.id },
        { otsKaryawanId: targetKaryawan.id },
      ],
    },
  });

  if (existingSchedules.length === 0) {
    return { status: "success", message: `Jadwal ${targetKaryawan.namaLengkap} aman, tidak ada bentrok.` };
  }

  // If time range is provided, check overlap
  if (jamMulai && jamSelesai) {
    const parseTime = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const reqStart = parseTime(jamMulai);
    const reqEnd = parseTime(jamSelesai);

    for (const s of existingSchedules) {
      if (s.jamMulaiLive && s.jamSelesaiLive) {
        const sStart = new Date(s.jamMulaiLive).getHours() * 60 + new Date(s.jamMulaiLive).getMinutes();
        const sEnd = new Date(s.jamSelesaiLive).getHours() * 60 + new Date(s.jamSelesaiLive).getMinutes();

        // Check if overlaps
        if (Math.max(reqStart, sStart) < Math.min(reqEnd, sEnd)) {
          return {
            status: "error",
            message: `Jadwal pengganti BENTROK dengan jadwal ${s.idJadwal} (${new Date(s.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} - ${new Date(s.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB).`,
          };
        }
      }
    }
  }

  return { status: "success", message: `Jadwal ${targetKaryawan.namaLengkap} aman, tidak ada bentrok.` };
}

/**
 * Submit Shift Swap request
 */
export async function requestTukarShift(input: any) {
  const user = await requireRole();
  const isAdmin = APPROVER_ROLES.includes(user.role);

  const tipeRole = input.TIPE_ROLE || input.tipeRole || "STREAMER";
  const idJadwalInput = input.ID_JADWAL || input.idJadwal || input.jadwalId;
  const idPenggantiInput = input.ID_PENGGANTI || input.idPengganti || input.targetId;
  const idPemohonInput = input.ID_PEMOHON || input.idPemohon || input.requesterId || user.karyawanId;
  const alasan = input.ALASAN || input.alasan || "";
  const fotoB64 = input.FOTO_LAMPIRAN_B64 || input.fotoLampiranB64 || input.lampiranDriveId || "";
  const tanggalJadwal = input.TANGGAL_JADWAL || input.tanggalJadwal || input.tanggal || new Date().toISOString();

  if (!idJadwalInput) throw AppError.badRequest("Pilih jadwal yang ingin ditukar.");
  if (!idPenggantiInput) throw AppError.badRequest("Pilih rekan pengganti.");
  if (!alasan) throw AppError.badRequest("Alasan pergantian wajib diisi.");

  // Resolve target employee
  const targetKaryawan = await db.karyawan.findFirst({
    where: {
      OR: [{ id: idPenggantiInput }, { idKaryawan: idPenggantiInput }],
    },
  });
  if (!targetKaryawan) throw AppError.notFound("Data rekan pengganti tidak ditemukan.");

  // Resolve schedule
  const targetJadwal = await db.jadwal.findFirst({
    where: {
      OR: [{ id: idJadwalInput }, { idJadwal: idJadwalInput }],
    },
  });
  if (!targetJadwal) throw AppError.notFound("Data jadwal tidak ditemukan.");

  // Resolve requester
  let requesterKaryawan = null;
  if (idPemohonInput) {
    requesterKaryawan = await db.karyawan.findFirst({
      where: {
        OR: [{ id: idPemohonInput }, { idKaryawan: idPemohonInput }],
      },
    });
  }
  if (!requesterKaryawan) {
    // Default to the current schedule assignee
    const currentAssigneeId = tipeRole === "OTS" ? targetJadwal.otsKaryawanId : (targetJadwal.streamerKaryawanId || targetJadwal.hostKaryawanId);
    if (currentAssigneeId) {
      requesterKaryawan = await db.karyawan.findUnique({ where: { id: currentAssigneeId } });
    }
  }
  if (!requesterKaryawan && user.karyawanId) {
    requesterKaryawan = await db.karyawan.findUnique({ where: { id: user.karyawanId } });
  }

  const requesterId = requesterKaryawan ? requesterKaryawan.id : targetKaryawan.id;

  if (requesterId === targetKaryawan.id && tipeRole !== "KHUSUS") {
    throw AppError.badRequest("Tidak dapat mengajukan tukar shift dengan diri sendiri.");
  }

  // SUPER ADMIN OVERRIDE (PANEL KHUSUS)
  if (tipeRole === "KHUSUS" || (isAdmin && input.isOverride)) {
    return db.$transaction(async (tx) => {
      // Reassign schedule directly
      const updateData: Record<string, unknown> = {};
      if (targetJadwal.otsKaryawanId === requesterId || targetKaryawan.jabatan?.toUpperCase().includes("OTS")) {
        updateData.otsKaryawanId = targetKaryawan.id;
      } else {
        updateData.streamerKaryawanId = targetKaryawan.id;
        updateData.hostKaryawanId = targetKaryawan.id;
      }

      await tx.jadwal.update({
        where: { id: targetJadwal.id },
        data: updateData,
      });

      // Record swap as APPROVED
      return tx.tukarShift.create({
        data: {
          requesterId: requesterId,
          targetId: targetKaryawan.id,
          jadwalId: targetJadwal.id,
          tanggal: new Date(tanggalJadwal),
          alasan: `[OVERRIDE ADMIN] ${alasan}`,
          lampiranDriveId: fotoB64 || null,
          status: "APPROVED",
        },
      });
    });
  }

  // STANDARD REQUEST (PENDING APPROVAL)
  return db.tukarShift.create({
    data: {
      requesterId: requesterId,
      targetId: targetKaryawan.id,
      jadwalId: targetJadwal.id,
      tanggal: new Date(tanggalJadwal),
      alasan: alasan,
      lampiranDriveId: fotoB64 || null,
      status: "PENDING",
    },
  });
}

/**
 * Confirm Swap (by target colleague)
 */
export async function confirmTukarShift(id: string) {
  const user = await requireRole();
  const row = await db.tukarShift.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Pengajuan tukar shift tidak ditemukan");
  if (row.status !== "PENDING") throw AppError.conflict("Pengajuan ini sudah tidak dapat dikonfirmasi");
  if (user.karyawanId !== row.targetId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Hanya rekan pengganti yang dapat mengkonfirmasi.");
  }
  return db.tukarShift.update({ where: { id }, data: { status: "TARGET_CONFIRMED" } });
}

/**
 * Approve or Reject Tukar Shift
 */
export async function processTukarShift(id: string, approve: boolean) {
  await requireRole(...APPROVER_ROLES);
  const row = await db.tukarShift.findUnique({
    where: { id },
    include: { requester: true, target: true },
  });
  if (!row) throw AppError.notFound("Pengajuan tukar shift tidak ditemukan");

  return db.$transaction(async (tx) => {
    const updatedSwap = await tx.tukarShift.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED" },
    });

    if (approve && row.jadwalId) {
      const schedule = await tx.jadwal.findUnique({
        where: { id: row.jadwalId },
        include: { streamerKaryawan: true, hostKaryawan: true, otsKaryawan: true },
      });
      if (schedule) {
        const targetKaryawan = await tx.karyawan.findUnique({ where: { id: row.targetId } });
        const originalStreamer = schedule.streamerKaryawan ?? schedule.hostKaryawan;
        const streamerAsli = originalStreamer
          ? `${originalStreamer.idKaryawan || originalStreamer.id} | ${originalStreamer.namaLengkap}`
          : `${schedule.idHost || "-"} | Streamer Asli`;

        // If requester is OTS on this schedule, update OTS
        if (schedule.otsKaryawanId === row.requesterId) {
          await tx.jadwal.update({
            where: { id: row.jadwalId },
            data: {
              otsKaryawanId: row.targetId,
              idOts: targetKaryawan?.idKaryawan || targetKaryawan?.id,
              catatanOts: `[OTS_ASLI: ${schedule.otsKaryawan?.idKaryawan || schedule.idOts || "-"} | ${schedule.otsKaryawan?.namaLengkap || "-"}] ${schedule.catatanOts ?? ""}`.trim(),
            },
          });
        } else {
          // Otherwise update streamer/host and record STREAMER_ASLI
          await tx.jadwal.update({
            where: { id: row.jadwalId },
            data: {
              streamerKaryawanId: row.targetId,
              hostKaryawanId: row.targetId,
              idHost: targetKaryawan?.idKaryawan || targetKaryawan?.id,
              catatanHost: `[STREAMER_ASLI: ${streamerAsli}] ${schedule.catatanHost ?? ""}`.trim(),
            },
          });
        }
      }
    }

    return updatedSwap;
  });
}

/**
 * List Shift Swaps with joined schedules and employees
 */
export async function listTukarShift(params?: { karyawanId?: string; roleType?: string }) {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);

  const where: Record<string, unknown> = {};
  if (params?.karyawanId) {
    where.OR = [{ requesterId: params.karyawanId }, { targetId: params.karyawanId }];
  } else if (!isApprover && user.karyawanId) {
    where.OR = [{ requesterId: user.karyawanId }, { targetId: user.karyawanId }];
  }

  const rawSwaps = await db.tukarShift.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: true,
      target: true,
    },
    take: 200,
  });

  // Collect schedule IDs to batch load schedule details
  const jadwalIds = rawSwaps.map((s) => s.jadwalId).filter(Boolean) as string[];
  const scheduleMap = new Map<string, any>();

  if (jadwalIds.length > 0) {
    const schedules = await db.jadwal.findMany({
      where: {
        OR: [
          { id: { in: jadwalIds } },
          { idJadwal: { in: jadwalIds } },
        ],
      },
    });
    for (const s of schedules) {
      scheduleMap.set(s.id, s);
      if (s.idJadwal) scheduleMap.set(s.idJadwal, s);
    }
  }

  return rawSwaps.map((s) => {
    const j = s.jadwalId ? scheduleMap.get(s.jadwalId) : null;
    const isOtsSwap = s.requester?.jabatan?.toUpperCase().includes("OTS") || j?.otsKaryawanId === s.requesterId;
    return {
      id: s.id,
      id_jadwal: j?.idJadwal || s.jadwalId || "—",
      platform: j?.platform || "Live",
      streamer_awal: s.requester?.namaLengkap || s.requesterId,
      streamer_pengganti: s.target?.namaLengkap || s.targetId,
      ots_awal: s.requester?.namaLengkap || s.requesterId,
      ots_pengganti: s.target?.namaLengkap || s.targetId,
      alasan: s.alasan || "—",
      lampiran: s.lampiranDriveId || "",
      status: s.status === "APPROVED" ? "DISETUJUI" : s.status === "REJECTED" ? "DITOLAK" : "MENUNGGU",
      rawStatus: s.status,
      tanggal: s.tanggal,
      createdAt: s.createdAt,
      tipeRole: isOtsSwap ? "OTS" : "STREAMER",
      requester: s.requester,
      target: s.target,
      jadwal: j,
    };
  });
}
