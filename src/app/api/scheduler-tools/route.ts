import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { computeDurationMinutes } from "@/lib/schedule-rules";

/**
 * GET /api/scheduler-tools?view=streamer-stats&karyawanId=xxx&periode=Agustus+2026
 * Returns monthly hour accumulation, tier status, and blacklist info for a streamer.
 *
 * GET /api/scheduler-tools?view=blacklist&karyawanId=xxx&clientId=xxx
 * Checks if a streamer is blacklisted for a specific client.
 */
export const GET = apiHandler(async (req: Request) => {
  await requirePermission("jadwal:write");

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "streamer-stats";
  const karyawanId = url.searchParams.get("karyawanId") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const periode = url.searchParams.get("periode") ?? "";

  if (view === "blacklist") {
    if (!karyawanId || !clientId) return { isBlacklisted: false };
    const bl = await db.streamerBlacklist.findUnique({
      where: { clientId_karyawanId: { clientId, karyawanId } },
    });
    return { isBlacklisted: !!bl, alasan: bl?.alasan ?? null };
  }

  // streamer-stats: compute accumulated hours and tier for current or given month
  if (!karyawanId) return { totalJam: 0, tier: null, isOverlimit: false };

  // Parse periode (e.g. "Agustus 2026") or default to current month
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  let startOfMonth: Date, endOfMonth: Date;
  const m = periode ? /^(\w+) (\d{4})$/.exec(periode.trim()) : null;
  if (m) {
    const idx = months.indexOf(m[1]);
    const year = parseInt(m[2], 10);
    startOfMonth = new Date(year, idx, 1);
    endOfMonth = new Date(year, idx + 1, 1);
  } else {
    const now = new Date();
    startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const [jadwal, tieringList, karyawan] = await Promise.all([
    db.jadwal.findMany({
      where: {
        streamerKaryawanId: karyawanId,
        tanggal: { gte: startOfMonth, lt: endOfMonth },
        status: { notIn: ["DIBATALKAN", "REJECTED"] },
      },
    }),
    db.tiering.findMany({ orderBy: { jamMinimal: "asc" } }),
    db.karyawan.findUnique({ where: { id: karyawanId }, select: { namaLengkap: true, tags: true } }),
  ]);

  const totalMinutes = jadwal.reduce((s, j) => {
    if (j.durationSec > 0) return s + j.durationSec / 60;
    return s + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
  }, 0);
  const totalJam = Math.round((totalMinutes / 60) * 100) / 100;

  const activeTier = tieringList.slice().reverse().find((t) => totalJam >= t.jamMinimal) ?? tieringList[0] ?? null;

  // Tier 4 threshold: find 4th tier from the list
  const tier4 = tieringList.length >= 4 ? tieringList[3] : null;
  const tier5 = tieringList.length >= 5 ? tieringList[4] : null;

  const isNearTier4 = tier4 ? totalJam >= tier4.jamMinimal * 0.9 : false;
  const isOverlimit = tier5 ? totalJam >= tier5.jamMinimal : false;

  return {
    namaLengkap: karyawan?.namaLengkap ?? "",
    tags: karyawan?.tags ?? null,
    totalJam,
    totalSesi: jadwal.length,
    activeTier: activeTier ? { nama: activeTier.tier, ratePerJam: Number(activeTier.ratePerJam), jamMaksimal: activeTier.jamMaksimal } : null,
    tier4Threshold: tier4 ? tier4.jamMinimal : null,
    tier5Threshold: tier5 ? tier5.jamMinimal : null,
    isNearTier4,
    isOverlimit,
  };
});
