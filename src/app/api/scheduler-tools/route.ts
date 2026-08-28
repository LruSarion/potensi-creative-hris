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
    const tenant = user.tenantId
      ? await db.tenant.findUnique({ where: { id: user.tenantId } })
      : await db.tenant.findFirst();
    const cfg = (tenant?.config ?? {}) as Record<string, any>;
    return {
      allowLiburRequest: cfg.allowLiburRequest !== false,
      allowShiftRequest: cfg.allowShiftRequest !== false,
      defaultKuotaLibur: typeof cfg.defaultKuotaLibur === "number" && cfg.defaultKuotaLibur > 0 ? cfg.defaultKuotaLibur : 4,
      defaultKuotaShift: typeof cfg.defaultKuotaShift === "number" && cfg.defaultKuotaShift > 0 ? cfg.defaultKuotaShift : 4,
    };
  }

  // View: info-streamer (Rekapitulasi Libur & Request Sesi Live Streamer)
  if (view === "info-streamer") {
    const tenant = user.tenantId
      ? await db.tenant.findUnique({ where: { id: user.tenantId } })
      : await db.tenant.findFirst();
    const cfg = (tenant?.config ?? {}) as Record<string, any>;
    const defaultKuotaLibur = typeof cfg.defaultKuotaLibur === "number" && cfg.defaultKuotaLibur > 0 ? cfg.defaultKuotaLibur : 4;
    const defaultKuotaShift = typeof cfg.defaultKuotaShift === "number" && cfg.defaultKuotaShift > 0 ? cfg.defaultKuotaShift : 4;

    const streamerCondition = {
      statusAktif: "AKTIF" as const,
      OR: [
        { kategori: { contains: "STREAMER", mode: "insensitive" as const } },
        { kategori: { contains: "Host", mode: "insensitive" as const } },
        { jabatan: { contains: "Streamer", mode: "insensitive" as const } },
        { jabatan: { contains: "Host", mode: "insensitive" as const } },
        { tipeJadwal: "LIVE" as const },
        { user: { role: "STREAMER" as const } },
      ],
    };

    const [streamers, leaveRequests, shiftRequests] = await Promise.all([
      db.karyawan.findMany({
        where: streamerCondition,
        select: { id: true, idKaryawan: true, namaLengkap: true, kategori: true, jabatan: true },
        orderBy: { namaLengkap: "asc" },
      }),
      db.izin.findMany({
        where: {
          jenis: { in: ["LIBUR_STREAMER", "CUTI_TAHUNAN", "SAKIT", "KEPERLUAN_PRIBADI"] },
          karyawan: streamerCondition,
        },
        include: { karyawan: { select: { id: true, idKaryawan: true, namaLengkap: true } } },
        orderBy: { tanggalMulai: "desc" },
      }),
      db.izin.findMany({
        where: {
          jenis: { in: ["REQUEST_SESI_1", "REQUEST_SESI_2", "REQUEST_SESI_3"] },
          karyawan: streamerCondition,
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
  const tenantId = user.tenantId || (await db.tenant.findFirst())?.id;

  const body = await req.json();

  if (body.action === "toggle-fitur") {
    if (!tenantId) throw AppError.forbidden("Tenant tidak ditemukan");
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const currentCfg = (tenant?.config ?? {}) as Record<string, any>;

    const nextCfg = { ...currentCfg };
    if (body.fitur === "LIBUR") {
      nextCfg.allowLiburRequest = body.status === "ON";
    } else if (body.fitur === "SHIFT") {
      nextCfg.allowShiftRequest = body.status === "ON";
    }

    await db.tenant.update({
      where: { id: tenantId },
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
    if (!tenantId) throw AppError.forbidden("Tenant tidak ditemukan");
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const currentCfg = (tenant?.config ?? {}) as Record<string, any>;

    const nextCfg = {
      ...currentCfg,
      defaultKuotaLibur: Number(body.defaultKuotaLibur) || 4,
      defaultKuotaShift: Number(body.defaultKuotaShift) || 4,
    };

    await db.tenant.update({
      where: { id: tenantId },
      data: { config: nextCfg },
    });

    return {
      success: true,
      config: nextCfg,
    };
  }

  if (body.action === "editInformasiStreamerBatch") {
    const dataEdit: Array<{
      TANGGAL: string;
      LIBUR?: string[];
      REQ_00_08?: string[];
      REQ_08_16?: string[];
      REQ_16_00?: string[];
    }> = body.data_edit || [];

    const allStreamers = await db.karyawan.findMany({
      select: { id: true, idKaryawan: true, namaLengkap: true },
    });
    const streamerMap = new Map<string, string>();
    allStreamers.forEach((s) => {
      if (s.idKaryawan) streamerMap.set(s.idKaryawan.toLowerCase(), s.id);
      if (s.id) streamerMap.set(s.id.toLowerCase(), s.id);
      if (s.namaLengkap) streamerMap.set(s.namaLengkap.toLowerCase(), s.id);
    });

    const getKaryawanDbId = (str: string) => {
      if (!str) return null;
      const clean = str.trim().toLowerCase();
      if (streamerMap.has(clean)) return streamerMap.get(clean)!;

      const parts = str.split(" | ");
      const idKaryawan = parts[0]?.trim().toLowerCase();
      const nama = parts[1]?.trim().toLowerCase();
      if (idKaryawan && streamerMap.has(idKaryawan)) return streamerMap.get(idKaryawan)!;
      if (nama && streamerMap.has(nama)) return streamerMap.get(nama)!;
      return null;
    };

    for (const item of dataEdit) {
      const tglStr = item.TANGGAL;
      if (!tglStr) continue;

      const startOfDay = new Date(`${tglStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${tglStr}T23:59:59.999Z`);

      // 1. Process LIBUR
      const targetLiburKaryawanIds = (item.LIBUR || [])
        .map(getKaryawanDbId)
        .filter((id): id is string => Boolean(id));

      await db.izin.deleteMany({
        where: {
          jenis: "LIBUR_STREAMER",
          tanggalMulai: { gte: startOfDay, lte: endOfDay },
          karyawanId: { notIn: targetLiburKaryawanIds },
        },
      });

      for (const kId of targetLiburKaryawanIds) {
        const existing = await db.izin.findFirst({
          where: {
            karyawanId: kId,
            jenis: "LIBUR_STREAMER",
            tanggalMulai: { gte: startOfDay, lte: endOfDay },
          },
        });
        if (!existing) {
          await db.izin.create({
            data: {
              karyawanId: kId,
              jenis: "LIBUR_STREAMER",
              tanggalMulai: startOfDay,
              tanggalSelesai: endOfDay,
              status: "APPROVED",
              alasan: "Libur Streamer (Diatur oleh Manajemen)",
            },
          });
        } else if (existing.status !== "APPROVED") {
          await db.izin.update({
            where: { id: existing.id },
            data: { status: "APPROVED" },
          });
        }
      }

      // 2. Process Shifts: REQ_00_08 (REQUEST_SESI_1)
      const target0008Ids = (item.REQ_00_08 || [])
        .map(getKaryawanDbId)
        .filter((id): id is string => Boolean(id));

      await db.izin.deleteMany({
        where: {
          jenis: "REQUEST_SESI_1",
          tanggalMulai: { gte: startOfDay, lte: endOfDay },
          karyawanId: { notIn: target0008Ids },
        },
      });

      for (const kId of target0008Ids) {
        const existing = await db.izin.findFirst({
          where: {
            karyawanId: kId,
            jenis: "REQUEST_SESI_1",
            tanggalMulai: { gte: startOfDay, lte: endOfDay },
          },
        });
        if (!existing) {
          await db.izin.create({
            data: {
              karyawanId: kId,
              jenis: "REQUEST_SESI_1",
              tanggalMulai: startOfDay,
              tanggalSelesai: endOfDay,
              status: "APPROVED",
              alasan: "Request Sesi 1 (00:00 - 08:00)",
            },
          });
        } else if (existing.status !== "APPROVED") {
          await db.izin.update({
            where: { id: existing.id },
            data: { status: "APPROVED" },
          });
        }
      }

      // 3. Process Shifts: REQ_08_16 (REQUEST_SESI_2)
      const target0816Ids = (item.REQ_08_16 || [])
        .map(getKaryawanDbId)
        .filter((id): id is string => Boolean(id));

      await db.izin.deleteMany({
        where: {
          jenis: "REQUEST_SESI_2",
          tanggalMulai: { gte: startOfDay, lte: endOfDay },
          karyawanId: { notIn: target0816Ids },
        },
      });

      for (const kId of target0816Ids) {
        const existing = await db.izin.findFirst({
          where: {
            karyawanId: kId,
            jenis: "REQUEST_SESI_2",
            tanggalMulai: { gte: startOfDay, lte: endOfDay },
          },
        });
        if (!existing) {
          await db.izin.create({
            data: {
              karyawanId: kId,
              jenis: "REQUEST_SESI_2",
              tanggalMulai: startOfDay,
              tanggalSelesai: endOfDay,
              status: "APPROVED",
              alasan: "Request Sesi 2 (08:00 - 16:00)",
            },
          });
        } else if (existing.status !== "APPROVED") {
          await db.izin.update({
            where: { id: existing.id },
            data: { status: "APPROVED" },
          });
        }
      }

      // 4. Process Shifts: REQ_16_00 (REQUEST_SESI_3)
      const target1600Ids = (item.REQ_16_00 || [])
        .map(getKaryawanDbId)
        .filter((id): id is string => Boolean(id));

      await db.izin.deleteMany({
        where: {
          jenis: "REQUEST_SESI_3",
          tanggalMulai: { gte: startOfDay, lte: endOfDay },
          karyawanId: { notIn: target1600Ids },
        },
      });

      for (const kId of target1600Ids) {
        const existing = await db.izin.findFirst({
          where: {
            karyawanId: kId,
            jenis: "REQUEST_SESI_3",
            tanggalMulai: { gte: startOfDay, lte: endOfDay },
          },
        });
        if (!existing) {
          await db.izin.create({
            data: {
              karyawanId: kId,
              jenis: "REQUEST_SESI_3",
              tanggalMulai: startOfDay,
              tanggalSelesai: endOfDay,
              status: "APPROVED",
              alasan: "Request Sesi 3 (16:00 - 00:00)",
            },
          });
        } else if (existing.status !== "APPROVED") {
          await db.izin.update({
            where: { id: existing.id },
            data: { status: "APPROVED" },
          });
        }
      }
    }

    return {
      success: true,
      message: `Berhasil memperbarui data libur & request untuk ${dataEdit.length} tanggal.`,
    };
  }

  throw new Error("Action tidak valid");
});
