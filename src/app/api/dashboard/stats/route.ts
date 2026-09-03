import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";

/**
 * GET /api/dashboard/stats
 *
 * Returns real-time summary stats for the super-admin dashboard:
 * - totalKaryawan: active employees (statusAktif = AKTIF)
 * - jadwalHariIni: today's schedules (excluding DIBATALKAN), plus count of SELESAI ones
 * - streamerAktif: employees with kategori containing STREAMER or HOST, statusAktif = AKTIF
 * - sedangLive: employees currently checked-in (CHECK_IN without a matching CHECK_OUT)
 * - totalRevenueBulanIni: sum of grossAmount from RevenueEntry for current month
 */
export const GET = apiHandler(async () => {
  const user = await requireRole(
    "SUPER_ADMIN",
    "ADMIN_OPERASIONAL",
    "OPERATION"
  );

  const tenantFilter = tenantWhere(user);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalKaryawan,
    jadwalHariIniAll,
    jadwalHariIniSelesai,
    totalStreamerAktif,
    sedangLiveCount,
    revenueRows,
  ] = await Promise.all([
    // 1. Karyawan aktif
    db.karyawan.count({
      where: {
        ...tenantFilter,
        statusAktif: "AKTIF",
      },
    }),

    // 2. Jadwal hari ini (semua selain DIBATALKAN)
    db.jadwal.count({
      where: {
        ...tenantFilter,
        tanggal: { gte: startOfToday, lte: endOfToday },
        status: { not: "DIBATALKAN" },
      },
    }),

    // 2b. Jadwal hari ini yang sudah SELESAI
    db.jadwal.count({
      where: {
        ...tenantFilter,
        tanggal: { gte: startOfToday, lte: endOfToday },
        status: "SELESAI",
      },
    }),

    // 3. Streamer aktif (kategori mengandung STREAMER atau HOST, statusAktif AKTIF)
    db.karyawan.count({
      where: {
        ...tenantFilter,
        statusAktif: "AKTIF",
        OR: [
          { kategori: { contains: "STREAMER", mode: "insensitive" } },
          { kategori: { contains: "HOST", mode: "insensitive" } },
        ],
      },
    }),

    // 4. Sedang live: karyawan yang punya CHECK_IN hari ini tanpa CHECK_OUT setelahnya
    db.absensi.count({
      where: {
        ...tenantFilter,
        tipe: "CHECK_IN",
        waktu: { gte: startOfToday, lte: endOfToday },
        jadwal: {
          absensi: {
            none: {
              tipe: "CHECK_OUT",
            },
          },
        },
      },
    }),

    // 5. Revenue bulan ini (aggregate grossAmount)
    db.revenueEntry.findMany({
      where: {
        ...tenantFilter,
        eventAt: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { grossAmount: true },
    }),
  ]);

  const totalRevenueBulanIni = revenueRows.reduce(
    (sum, r) => sum + Number(r.grossAmount),
    0
  );

  return {
    totalKaryawan,
    jadwalHariIni: jadwalHariIniAll,
    jadwalSelesai: jadwalHariIniSelesai,
    streamerAktif: totalStreamerAktif,
    sedangLive: sedangLiveCount,
    totalRevenueBulanIni,
  };
});
