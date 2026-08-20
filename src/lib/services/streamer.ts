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
    include: { client: true },
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
