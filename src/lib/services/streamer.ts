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

/** My monthly performance report (hours + tier + gross). */
export async function getMyReport(periode?: string) {
  const karyawanId = await requireStreamer();
  const jadwal = await db.jadwal.findMany({
    where: {
      streamerKaryawanId: karyawanId,
      ...(periode ? { periodeBulan: periode } : {}),
    },
  });
  const totalMinutes = jadwal.reduce(
    (s, j) => s + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive),
    0
  );
  const totalJam = totalMinutes / 60;

  const payroll = await db.payroll.findFirst({
    where: { karyawanId, ...(periode ? { periode } : {}) },
  });

  return {
    karyawanId,
    totalJadwal: jadwal.length,
    totalJam: Math.round(totalJam * 100) / 100,
    payroll: payroll
      ? { periode: payroll.periode, tier: payroll.tier, grossPay: Number(payroll.grossPay) }
      : null,
  };
}
