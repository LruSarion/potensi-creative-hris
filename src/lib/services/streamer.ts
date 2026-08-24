import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { computeDurationMinutes } from "@/lib/schedule-rules";

/**
 * Streamer dashboard: all queries scoped to the authenticated streamer's own data.
 */

/** Verify the current user is a streamer and return their karyawan id. */
async function requireStreamer(): Promise<string> {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  return user.karyawanId;
}

/** My schedules (own only). */
export async function getMyJadwal() {
  const karyawanId = await requireStreamer();
  return db.jadwal.findMany({
    where: { streamerKaryawanId: karyawanId },
    orderBy: { tanggal: "desc" },
    include: { 
      client: true,
      absensi: {
        where: { tipe: "CHECK_OUT" }
      }
    },
  });
}

/** My absensi history (own only). */
export async function getMyAbsensi() {
  const karyawanId = await requireStreamer();
  return db.absensi.findMany({
    where: { karyawanId },
    orderBy: { waktu: "desc" },
  });
}

/** Current active (open) attendance session for the streamer, if any. */
export async function getMySesiAktif() {
  const karyawanId = await requireStreamer();
  const lastCheckIn = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!lastCheckIn) return null;
  const lastCheckOut = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  if (lastCheckOut && lastCheckOut.waktu > lastCheckIn.waktu) return null;
  return lastCheckIn;
}

/** My monthly performance report (hours + tier + gross). */
export async function getMyReport(periode?: string) {
  const karyawanId = await requireStreamer();
  const jadwal = await db.jadwal.findMany({
    where: {
      streamerKaryawanId: karyawanId,
      ...(periode ? { periodeBulan: periode } : {}),
    },
  });

  // Prefer recorded webhook uptime (durationSec); fall back to scheduled duration.
  const totalSec = jadwal.reduce((s, j) => s + (j.durationSec || 0), 0);
  const totalMinutes = totalSec > 0
    ? totalSec / 60
    : jadwal.reduce((s, j) => s + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive), 0);
  const totalJam = totalMinutes / 60;

  const payroll = await db.payroll.findFirst({
    where: { karyawanId, ...(periode ? { periode } : {}) },
  });

  // Streamer's own earnings (their cut from the revenue ledger) for the period.
  const startOf = periode ? new Date(periodeRange(periode)[0]) : undefined;
  const endOf = periode ? new Date(periodeRange(periode)[1]) : undefined;
  const revenues = await db.revenueEntry.findMany({
    where: {
      streamerKaryawanId: karyawanId,
      ...(startOf && endOf ? { eventAt: { gte: startOf, lt: endOf } } : {}),
    },
  });
  const streamerEarnings = revenues.reduce((s, r) => s + Number(r.streamerCut), 0);

  return {
    karyawanId,
    totalJadwal: jadwal.length,
    totalJam: Math.round(totalJam * 100) / 100,
    totalUptimeSec: totalSec,
    streamerEarnings,
    payroll: payroll
      ? { periode: payroll.periode, tier: payroll.tier, grossPay: Number(payroll.grossPay) }
      : null,
  };
}

/** Parse "Bulan YYYY" into a [start, end) date range. */
function periodeRange(periode: string): [number, number] {
  const m = /^(\w+) (\d{4})$/.exec(periode.trim());
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const idx = m ? months.indexOf(m[1]) : new Date().getMonth();
  const year = m ? parseInt(m[2], 10) : new Date().getFullYear();
  return [new Date(year, idx, 1).getTime(), new Date(year, idx + 1, 1).getTime()];
}
/** Full realtime dashboard data for the streamer. */
export async function getMyDashboard() {
  const karyawanId = await requireStreamer();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Current month label for tiering lookup
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const currentPeriode = `${months[now.getMonth()]} ${now.getFullYear()}`;

  const [karyawan, jadwalBulanIni, abensiBulanIni, incidents, tieringList] = await Promise.all([
    db.karyawan.findUnique({ where: { id: karyawanId } }),
    db.jadwal.findMany({
      where: {
        streamerKaryawanId: karyawanId,
        tanggal: { gte: startOfMonth, lt: endOfMonth },
        status: "SELESAI",
      },
    }),
    db.absensi.findMany({
      where: {
        karyawanId,
        waktu: { gte: startOfMonth, lt: endOfMonth },
      },
    }),
    db.incident.findMany({
      where: {
        streamerKaryawanId: karyawanId,
        status: { in: ["RESOLVED", "CLOSED"] },
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    db.tiering.findMany({ orderBy: { jamMinimal: "asc" } }),
  ]);

  // Calculate total live hours from jadwal
  const totalMinutes = jadwalBulanIni.reduce((s, j) => {
    if (j.durationSec > 0) return s + j.durationSec / 60;
    return s + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
  }, 0);
  const totalJam = totalMinutes / 60;

  // Find applicable tier
  const activeTier = tieringList.slice().reverse().find(
    (t) => totalJam >= t.jamMinimal
  ) ?? tieringList[0] ?? null;

  const ratePerJam = activeTier ? Number(activeTier.ratePerJam) : 0;
  const grossPay = totalJam * ratePerJam;

  // Total GMV from check-out records with reportedGmv
  const totalGmv = abensiBulanIni
    .filter((a) => a.tipe === "CHECK_OUT" && a.reportedGmv)
    .reduce((s, a) => s + Number(a.reportedGmv), 0);

  // Total denda (fines) from resolved incidents
  const totalDenda = incidents.reduce((s, i) => s + Number(i.fineApplied ?? 0), 0);
  const netPay = grossPay - totalDenda;

  // Contract countdown
  const kontrakEndDate = karyawan?.endDate ?? null;
  const daysLeft = kontrakEndDate
    ? Math.ceil((new Date(kontrakEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    karyawan: karyawan ? {
      namaLengkap: karyawan.namaLengkap,
      namaPanggilan: karyawan.namaPanggilan,
      kontrakType: karyawan.kategori,
      endDate: karyawan.endDate,
      tags: karyawan.tags,
    } : null,
    periode: currentPeriode,
    totalJam: Math.round(totalJam * 100) / 100,
    totalSesi: jadwalBulanIni.length,
    activeTier: activeTier ? { nama: activeTier.tier, ratePerJam } : null,
    grossPay: Math.round(grossPay),
    totalGmv: Math.round(totalGmv),
    totalDenda: Math.round(totalDenda),
    netPay: Math.round(netPay),
    kontrakDaysLeft: daysLeft,
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category?.name ?? null,
      fineApplied: Number(i.fineApplied ?? 0),
      createdAt: i.createdAt,
    })),
  };
}

/** Get Check-Out records that are missing GMV (from auto-checkout/Terusan) */
export async function getPendingGmv() {
  const karyawanId = await requireStreamer();
  return db.absensi.findMany({
    where: {
      karyawanId,
      tipe: "CHECK_OUT",
      reportedGmv: null,
      jadwalId: { not: null }
    },
    orderBy: { waktu: "desc" },
    include: {
      jadwal: {
        include: { client: true }
      }
    }
  });
}

/** Get form controls & leave/shift request status for current streamer */
export async function getStreamerRequestStatus() {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const karyawanId = user.karyawanId;
  if (!karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as Record<string, any>;

  const allowLiburRequest = cfg.allowLiburRequest !== false; // default true
  const allowShiftRequest = cfg.allowShiftRequest !== false; // default true
  const defaultKuotaLibur = typeof cfg.defaultKuotaLibur === "number" ? cfg.defaultKuotaLibur : 4;
  const defaultKuotaShift = typeof cfg.defaultKuotaShift === "number" ? cfg.defaultKuotaShift : 4;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Fetch streamer's leave & shift requests for current month
  const [leaveRequests, shiftRequests, activeJadwal] = await Promise.all([
    db.izin.findMany({
      where: {
        karyawanId,
        jenis: { in: ["LIBUR_STREAMER", "CUTI_TAHUNAN", "SAKIT", "KEPERLUAN_PRIBADI"] },
        tanggalMulai: { gte: startOfMonth, lt: endOfMonth },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.izin.findMany({
      where: {
        karyawanId,
        jenis: { in: ["REQUEST_SESI_1", "REQUEST_SESI_2", "REQUEST_SESI_3"] },
        tanggalMulai: { gte: startOfMonth, lt: endOfMonth },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.jadwal.findMany({
      where: {
        streamerKaryawanId: karyawanId,
        tanggal: { gte: startOfMonth, lt: endOfMonth },
        status: { notIn: ["DIBATALKAN", "REJECTED"] },
      },
      select: { id: true, idJadwal: true, tanggal: true, jamMulaiLive: true, jamSelesaiLive: true, platform: true },
    }),
  ]);

  const approvedLeaves = leaveRequests.filter((l) => l.status === "APPROVED").length;
  const approvedShifts = shiftRequests.filter((s) => s.status === "APPROVED").length;

  return {
    allowLiburRequest,
    allowShiftRequest,
    defaultKuotaLibur,
    defaultKuotaShift,
    sisaKuotaLibur: Math.max(0, defaultKuotaLibur - approvedLeaves),
    sisaKuotaShift: Math.max(0, defaultKuotaShift - approvedShifts),
    leaveRequests,
    shiftRequests,
    activeJadwal,
  };
}

/** Submit leave request by streamer */
export async function submitLeaveRequest(input: { tanggal: string; alasan?: string }) {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const karyawanId = user.karyawanId;
  if (!karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as Record<string, any>;
  if (cfg.allowLiburRequest === false) {
    throw AppError.forbidden("Pengajuan libur saat ini sedang ditutup oleh Manajemen.");
  }

  const tgl = new Date(input.tanggal);
  const startOfDay = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate(), 0, 0, 0);
  const endOfDay = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate(), 23, 59, 59);

  // Check if streamer has an active live schedule on this day
  const existingJadwal = await db.jadwal.findFirst({
    where: {
      streamerKaryawanId: karyawanId,
      tanggal: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
    },
  });

  const conflictNote = existingJadwal
    ? ` [Peringatan: Jadwal Live ${existingJadwal.idJadwal} aktif]`
    : "";

  return db.izin.create({
    data: {
      karyawanId,
      tanggalMulai: startOfDay,
      tanggalSelesai: endOfDay,
      jenis: "LIBUR_STREAMER",
      alasan: `${input.alasan ?? "Pengajuan Libur Streamer"}${conflictNote}`,
      status: "PENDING",
    },
  });
}

/** Submit 3-Session Live request (SESI_1: 00-08, SESI_2: 08-16, SESI_3: 16-00) */
export async function submitShiftRequest(input: { tanggal: string; sesi: "SESI_1" | "SESI_2" | "SESI_3"; catatan?: string }) {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const karyawanId = user.karyawanId;
  if (!karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const cfg = (tenant?.config ?? {}) as Record<string, any>;
  if (cfg.allowShiftRequest === false) {
    throw AppError.forbidden("Pengajuan request sesi live saat ini sedang ditutup oleh Manajemen.");
  }

  const tgl = new Date(input.tanggal);
  const sesiLabel = {
    SESI_1: "Sesi 1 (00:00 - 08:00)",
    SESI_2: "Sesi 2 (08:00 - 16:00)",
    SESI_3: "Sesi 3 (16:00 - 00:00)",
  }[input.sesi] || "Sesi Live";

  return db.izin.create({
    data: {
      karyawanId,
      tanggalMulai: tgl,
      tanggalSelesai: tgl,
      jenis: `REQUEST_${input.sesi}`,
      alasan: `${sesiLabel} - ${input.catatan ?? "Permintaan Sesi Live"}`,
      status: "PENDING",
    },
  });
}
