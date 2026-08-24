import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requirePermission, requireRole } from "@/lib/auth-helpers";
import { computeDurationMinutes } from "@/lib/schedule-rules";
import { AppError } from "@/lib/errors";

/**
 * GET /api/scheduler-tools?view=streamer-stats&karyawanId=xxx&periode=Agustus+2026
 * GET /api/scheduler-tools?view=blacklist&karyawanId=xxx&clientId=xxx
 * GET /api/scheduler-tools?view=kendali-form
 * GET /api/scheduler-tools?view=info-streamer&periode=xxx
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "STREAMER", "STAFF");

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "streamer-stats";
  const karyawanId = url.searchParams.get("karyawanId") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const periode = url.searchParams.get("periode") ?? "";

  // View: kendali-form
  if (view === "kendali-form") {
    const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
    const cfg = (tenant?.config ?? {}) as Record<string, any>;
    return {
      allowLiburRequest: cfg.allowLiburRequest !== false,
      allowShiftRequest: cfg.allowShiftRequest !== false,
      defaultKuotaLibur: typeof cfg.defaultKuotaLibur === "number" ? cfg.defaultKuotaLibur : 4,
      defaultKuotaShift: typeof cfg.defaultKuotaShift === "number" ? cfg.defaultKuotaShift : 4,
    };
  }

  // View: info-streamer (Rekapitulasi Libur & Request Sesi Live Streamer)
  if (view === "info-streamer") {
    await requirePermission("jadwal:read");
    const tenant = user.tenantId ? await db.tenant.findUnique({ where: { id: user.tenantId } }) : null;
    const cfg = (tenant?.config ?? {}) as Record<string, any>;
    const defaultKuotaLibur = typeof cfg.defaultKuotaLibur === "number" ? cfg.defaultKuotaLibur : 4;
    const defaultKuotaShift = typeof cfg.defaultKuotaShift === "number" ? cfg.defaultKuotaShift : 4;

    const [streamers, leaveRequests, shiftRequests] = await Promise.all([
      db.karyawan.findMany({
        where: { kategori: "STREAMER", statusAktif: "AKTIF" },
        select: { id: true, idKaryawan: true, namaLengkap: true },
        orderBy: { namaLengkap: "asc" },
      }),
      db.izin.findMany({
        where: {
          jenis: { in: ["LIBUR_STREAMER", "CUTI_TAHUNAN", "SAKIT", "KEPERLUAN_PRIBADI"] },
        },
        include: { karyawan: { select: { id: true, idKaryawan: true, namaLengkap: true } } },
        orderBy: { tanggalMulai: "desc" },
      }),
      db.izin.findMany({
        where: {
          jenis: { in: ["REQUEST_SESI_1", "REQUEST_SESI_2", "REQUEST_SESI_3"] },
        },
        include: { karyawan: { select: { id: true, idKaryawan: true, namaLengkap: true } } },
        orderBy: { tanggalMulai: "desc" },
      }),
    ]);

    return {
      defaultKuotaLibur,
      defaultKuotaShift,
      streamers,
      leaveRequests,
      shiftRequests,
    };
  }

  if (view === "blacklist") {
    if (!karyawanId || !clientId) return { isBlacklisted: false };
    const bl = await db.streamerBlacklist.findUnique({
      where: { clientId_karyawanId: { clientId, karyawanId } },
    });
    return { isBlacklisted: !!bl, alasan: bl?.alasan ?? null };
  }

  // streamer-stats: compute accumulated hours and tier for current or given month
  if (!karyawanId) return { totalJam: 0, tier: null, isOverlimit: false };

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

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terhubung ke tenant");

  const body = await req.json();

  if (body.action === "toggle-fitur") {
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
    const currentCfg = (tenant?.config ?? {}) as Record<string, any>;

    const nextCfg = { ...currentCfg };
    if (body.fitur === "LIBUR") {
      nextCfg.allowLiburRequest = body.status === "ON";
    } else if (body.fitur === "SHIFT") {
      nextCfg.allowShiftRequest = body.status === "ON";
    }

    await db.tenant.update({
      where: { id: user.tenantId },
      data: { config: nextCfg },
    });

    return {
      success: true,
      fitur: body.fitur,
      status: body.status,
      config: nextCfg,
    };
  }

  if (body.action === "save-quota") {
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
    const currentCfg = (tenant?.config ?? {}) as Record<string, any>;

    const nextCfg = {
      ...currentCfg,
      defaultKuotaLibur: Number(body.defaultKuotaLibur) || 4,
      defaultKuotaShift: Number(body.defaultKuotaShift) || 4,
    };

    await db.tenant.update({
      where: { id: user.tenantId },
      data: { config: nextCfg },
    });

    return {
      success: true,
      config: nextCfg,
    };
  }

  throw new Error("Action tidak valid");
});
