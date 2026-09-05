import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { computeDurationMinutes, TOKEN_JEDA_MINUTES } from "@/lib/schedule-rules";
import { STUDIOS } from "@/types/jadwal";

/**
 * Streamer dashboard: all queries scoped to the authenticated streamer's own data.
 */

/** Verify the current user is a streamer and return their karyawan id. */
async function requireStreamer(): Promise<string> {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  return user.karyawanId;
}

/**
 * Scope resolver for dashboard list views (ref-deploy: superadmin/op-admin see
 * ALL streamers' schedules, terbatas & pending-GMV lists — not just their own).
 * Personal views (report, request forms) still use requireStreamer().
 */
async function requireStreamerScope(): Promise<{ karyawanId: string | null; seeAll: boolean }> {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  if (["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(user.role)) {
    return { karyawanId: user.karyawanId ?? null, seeAll: true };
  }
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  return { karyawanId: user.karyawanId, seeAll: false };
}

/** Get list of studios according to database and system configuration */
export async function getStudioList() {
  const inDb = await db.jadwal.findMany({
    select: { cabangStudio: true, nomorStudio: true },
    distinct: ["cabangStudio", "nomorStudio"],
    where: {
      OR: [
        { cabangStudio: { not: null } },
        { nomorStudio: { not: null } },
      ],
    },
  });

  const studioSet = new Set<string>();
  const list: { name: string; cabang: string; no: string }[] = [];

  // 1. Standard studios
  for (const s of STUDIOS) {
    studioSet.add(s.name.toLowerCase());
    list.push(s);
  }

  // 2. Distinct from DB
  for (const row of inDb) {
    const c = (row.cabangStudio || "").trim();
    const n = (row.nomorStudio || "").trim();
    if (!c && !n) continue;
    let name = "";
    if (c && n) {
      name = n.toLowerCase().includes(c.toLowerCase())
        ? n
        : `Studio ${c} ${n.replace(/^Studio\s*/i, "")}`;
    } else {
      name = c || n;
    }
    if (!studioSet.has(name.toLowerCase())) {
      studioSet.add(name.toLowerCase());
      list.push({ name, cabang: c || "Timoho", no: n || "01" });
    }
  }

  return list;
}

/** My schedules (admins see all streamers' schedules — ref-deploy). */
export async function getMyJadwal() {
  const { karyawanId, seeAll } = await requireStreamerScope();
  const list = await db.jadwal.findMany({
    where: seeAll
      ? {}
      : {
          OR: [
            { streamerKaryawanId: karyawanId! },
            { hostKaryawanId: karyawanId! },
          ],
        },
    orderBy: { tanggal: "desc" },
    include: {
      client: true,
      streamerKaryawan: true,
      absensi: true
    },
  });

  const nowMs = Date.now();

  return list.map((j) => {
    const checkIn = j.absensi.find((a) => a.tipe === "CHECK_IN" && (!seeAll || a.karyawanId === karyawanId || a.karyawanId === j.streamerKaryawanId));
    const checkOut = j.absensi.find((a) => a.tipe === "CHECK_OUT" && (!seeAll || a.karyawanId === karyawanId || a.karyawanId === j.streamerKaryawanId));

    let status = j.status as string;
    if (checkOut) {
      status = (checkOut.reportedGmv === null || checkOut.reportedGmv === undefined) ? "PERLU LAPOR" : "SELESAI";
    } else if (checkIn) {
      const schedStartMs = j.jamMulaiLive ? new Date(j.jamMulaiLive).getTime() : NaN;
      let schedEndMs = j.jamSelesaiLive ? new Date(j.jamSelesaiLive).getTime() : NaN;
      if (!isNaN(schedStartMs) && !isNaN(schedEndMs) && schedEndMs < schedStartMs) {
        schedEndMs += 24 * 60 * 60 * 1000;
      }

      if (!isNaN(schedStartMs) && nowMs < schedStartMs) {
        status = "PREPARE";
      } else if (!isNaN(schedEndMs) && nowMs > schedEndMs) {
        status = "PERLU LAPOR";
      } else {
        status = "ON AIR";
      }
    } else {
      const raw = String(j.status);
      if (raw === "BATAL" || raw === "CANCEL") status = "BATAL";
      else if (raw === "LIBUR") status = "LIBUR";
      else status = "TERJADWAL";
    }

    const c = (j.cabangStudio || "").trim();
    const n = (j.nomorStudio || "").trim();
    let studioName = "Studio Timoho 1";
    if (c && n) {
      studioName = n.toLowerCase().includes(c.toLowerCase())
        ? n
        : `Studio ${c} ${n.replace(/^Studio\s*/i, "")}`;
    } else if (c) {
      studioName = `Studio ${c}`;
    } else if (n) {
      studioName = n;
    }
    return {
      ...j,
      status,
      studio: studioName,
    };
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
    include: {
      jadwal: {
        include: { client: true }
      }
    }
  });
  if (!lastCheckIn) return null;
  const lastCheckOut = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  if (lastCheckOut && lastCheckOut.waktu > lastCheckIn.waktu) return null;

  // Enforce the SESI_AKTIF_STREAMER formula:
  // Session must be in PREPARE, ON AIR, or PERLU LAPOR, and within H+8 hours of scheduled end time.
  if (lastCheckIn.jadwal?.jamSelesaiLive) {
    const schedStartMs = lastCheckIn.jadwal.jamMulaiLive ? new Date(lastCheckIn.jadwal.jamMulaiLive).getTime() : NaN;
    let schedEndMs = new Date(lastCheckIn.jadwal.jamSelesaiLive).getTime();
    if (!isNaN(schedStartMs) && !isNaN(schedEndMs) && schedEndMs < schedStartMs) {
      schedEndMs += 24 * 60 * 60 * 1000;
    }
    const nowMs = Date.now();
    // Beyond H+8, it is no longer active in SESI_AKTIF_STREAMER (escalates to tab Terbatas)
    if (!isNaN(schedEndMs) && nowMs - schedEndMs > 8 * 60 * 60 * 1000) {
      return null;
    }
  }

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
/** Get list of active streamers for admin host selection (ref-deploy report-admin-filter). */
export async function getStreamerHostList() {
  await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const streamers = await db.karyawan.findMany({
    where: {
      statusAktif: "AKTIF",
      OR: [
        { kategori: "STREAMER" },
        { jabatan: { contains: "Streamer", mode: "insensitive" } },
        { jabatan: { contains: "Host", mode: "insensitive" } },
        { idKaryawan: { startsWith: "HST" } },
        { idKaryawan: { startsWith: "PCS" } },
      ],
    },
    select: {
      id: true,
      idKaryawan: true,
      namaLengkap: true,
    },
    orderBy: { namaLengkap: "asc" },
  });

  return streamers.map((s) => ({
    id: s.id,
    idKaryawan: s.idKaryawan,
    namaLengkap: s.namaLengkap,
  }));
}

/** Full realtime dashboard data for the streamer (ref-deploy tab-report). */
export async function getMyDashboard(periode?: string, targetHostId?: string) {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(user.role);

  let karyawanId: string;
  if (isAdmin) {
    if (!targetHostId || !targetHostId.trim()) {
      return null;
    }
    const cleanRaw = targetHostId.includes("|") ? targetHostId.split("|")[0].trim() : targetHostId.trim();
    const found = await db.karyawan.findFirst({
      where: {
        OR: [
          { id: cleanRaw },
          { idKaryawan: cleanRaw },
        ],
      },
      select: { id: true },
    });
    if (!found) return null;
    karyawanId = found.id;
  } else {
    if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
    karyawanId = user.karyawanId;
  }

  const now = new Date();
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  // Periode filter (ref-deploy filterReportPeriode): "Bulan YYYY", default bulan berjalan.
  let startOfMonth: Date;
  let endOfMonth: Date;
  let currentPeriode: string;
  if (periode) {
    const [startMs, endMs] = periodeRange(periode);
    startOfMonth = new Date(startMs);
    endOfMonth = new Date(endMs);
    currentPeriode = periode;
  } else {
    startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    currentPeriode = `${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  const [karyawan, jadwalBulanIni, abensiBulanIni, incidents, tieringList, sesiBulan] = await Promise.all([
    db.karyawan.findUnique({
      where: { id: karyawanId },
      include: { streamerProfile: true },
    }),
    db.jadwal.findMany({
      where: {
        AND: [
          {
            OR: [
              { streamerKaryawanId: karyawanId },
              { hostKaryawanId: karyawanId },
            ],
          },
          { tanggal: { gte: startOfMonth, lt: endOfMonth } },
          {
            OR: [
              { status: "SELESAI" },
              { liveState: "CLOSED" },
              { absensi: { some: { tipe: "CHECK_OUT" } } },
            ],
          },
        ],
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
    // All sessions in the period (any status) — for Selesai vs Batal counters (ref-deploy repSelesai/repBatal).
    db.jadwal.findMany({
      where: {
        OR: [
          { streamerKaryawanId: karyawanId },
          { hostKaryawanId: karyawanId },
        ],
        tanggal: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { status: true, liveState: true },
    }),
  ]);

  // Calculate total live hours from jadwal
  const totalMinutes = jadwalBulanIni.reduce((s, j) => {
    if (j.durationSec > 0) return s + j.durationSec / 60;
    const dur = computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
    return s + (dur > 0 ? dur : 120);
  }, 0);
  const totalJam = totalMinutes / 60;

  // Find applicable tier (default to Basic/first tier if hours are low)
  const activeTier = tieringList.slice().reverse().find(
    (t) => totalJam >= t.jamMinimal
  ) ?? tieringList[0] ?? { tier: "Basic", ratePerJam: 25000, jamMinimal: 0, jamMaksimal: 80 };

  const ratePerJam = activeTier ? Number(activeTier.ratePerJam) : 25000;
  const grossPay = totalJam * ratePerJam;

  // Total GMV from check-out records with reportedGmv
  const totalGmv = abensiBulanIni
    .filter((a) => a.tipe === "CHECK_OUT" && a.reportedGmv)
    .reduce((s, a) => s + Number(a.reportedGmv), 0);

  // Selesai vs Batal session counters (ref-deploy repSelesai/repBatal)
  const sesiSelesai = sesiBulan.filter(
    (j) => j.status === "SELESAI" || j.liveState === "CLOSED"
  ).length;
  const sesiBatal = sesiBulan.filter(
    (j) => j.status === "DIBATALKAN" || j.status === "REJECTED"
  ).length;

  // Total denda (fines) from resolved incidents
  const totalDenda = incidents.reduce((s, i) => s + Number(i.fineApplied ?? 0), 0);
  const netPay = grossPay - totalDenda;

  // Rekapitulasi Kedisiplinan (ref-deploy repRingan/repSedang/repBerat/repDendaAktif/repDendaBatal)
  const severityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let dendaAktif = 0;
  let dendaDibatalkan = 0;
  incidents.forEach((i) => {
    if (i.severity in severityCounts) severityCounts[i.severity as keyof typeof severityCounts]++;
    const fine = Number(i.fineApplied ?? 0);
    // CLOSED = banding diterima / denda di-batalkan (ref-deploy repDendaBatal);
    // RESOLVED = denda masih berlaku (repDendaAktif).
    if (i.status === "CLOSED") dendaDibatalkan += fine;
    else dendaAktif += fine;
  });

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
      fotoUrl: karyawan.streamerProfile?.photoUrl ?? null,
    } : null,
    periode: currentPeriode,
    totalJam: Math.round(totalJam * 100) / 100,
    totalSesi: jadwalBulanIni.length,
    sesiSelesai,
    sesiBatal,
    severityCounts,
    dendaAktif: Math.round(dendaAktif),
    dendaDibatalkan: Math.round(dendaDibatalkan),
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
  const { karyawanId, seeAll } = await requireStreamerScope();
  return db.absensi.findMany({
    where: {
      ...(seeAll ? {} : { karyawanId: karyawanId! }),
      kategori: "STREAMER",
      tipe: "CHECK_OUT",
      reportedGmv: null,
      jadwalId: { not: null }
    },
    orderBy: { waktu: "desc" },
    include: {
      jadwal: {
        include: { client: true, streamerKaryawan: true, hostKaryawan: true }
      },
      karyawan: true
    }
  });
}

/** Get full Terbatas data: Jeda Terbatas (< 30 mins / instant) and Perlu Lapor (>8 hrs / missing GMV) */
export async function getTerbatasData() {
  const { karyawanId, seeAll } = await requireStreamerScope();
  const now = new Date();
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const startOfYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  // Batas atas sesi "segera check-in": akhir hari ini (ref-deploy JADWAL_TOKEN
  // adalah daftar referensi harian — sesi besok tampil saat harinya tiba).
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // 1. Perlu Lapor:
  // - CHECK_OUT with null reportedGmv
  // - Open CHECK_IN older than 8 hours with no checkout
  const [missingGmvCheckouts, expiredCheckIns] = await Promise.all([
    db.absensi.findMany({
      where: {
        ...(seeAll ? {} : { karyawanId: karyawanId! }),
        kategori: "STREAMER",
        tipe: "CHECK_OUT",
        reportedGmv: null,
        jadwalId: { not: null }
      },
      orderBy: { waktu: "desc" },
      include: {
        jadwal: {
          include: { client: true, streamerKaryawan: true, hostKaryawan: true }
        },
        karyawan: true
      }
    }),
    db.absensi.findMany({
      where: {
        ...(seeAll ? {} : { karyawanId: karyawanId! }),
        kategori: "STREAMER",
        tipe: "CHECK_IN",
        waktu: { lte: eightHoursAgo },
        jadwal: {
          absensi: {
            none: {
              tipe: "CHECK_OUT",
              ...(seeAll ? {} : { karyawanId: karyawanId! })
            }
          }
        }
      },
      orderBy: { waktu: "desc" },
      include: {
        jadwal: {
          include: { client: true, streamerKaryawan: true, hostKaryawan: true }
        },
        karyawan: true
      }
    })
  ]);

  // Combine unique perluLapor by jadwalId
  const perluLaporMap = new Map<string, any>();
  missingGmvCheckouts.forEach((item) => {
    if (item.jadwal) perluLaporMap.set(item.jadwal.id, item);
  });
  expiredCheckIns.forEach((item) => {
    if (item.jadwal && !perluLaporMap.has(item.jadwal.id)) {
      perluLaporMap.set(item.jadwal.id, item);
    }
  });

  const perluLapor = Array.from(perluLaporMap.values());

  // 2. Jeda Terbatas:
  // Jadwal yang harus SEGERA di-check-in (ref-deploy JADWAL_TOKEN — sesi jeda
  // hari ini yang belum selesai, streamer memprosesnya via "Absen Instan"
  // MASUK_PULANG_TERBATAS: check-in + check-out sekali jalan):
  // a) Short scheduled duration (< 30 minutes), OR
  // b) Back-to-back gap to the streamer's NEXT session < 30 minutes (TOKEN_JEDA),
  //    including chains of 3+ tight sessions per day.
  // Jendela: sudah lewat s.d. akhir hari ini (belum mulai pun tampil — sesi
  // mendatang perlu disiapkan sebelum jeda tiba), maks. 8 jam setelah selesai.
  const jedaCandidates = await db.jadwal.findMany({
    where: {
      ...(seeAll ? {} : { streamerKaryawanId: karyawanId! }),
      tanggal: { gte: startOfYesterday, lte: endOfToday },
      status: { not: "SELESAI" },
      liveState: { not: "CLOSED" },
      jamMulaiLive: { lte: endOfToday },
    },
    orderBy: { jamMulaiLive: "asc" },
    include: {
      client: true,
      streamerKaryawan: true,
      hostKaryawan: true,
      absensi: seeAll
        ? { where: { kategori: "STREAMER" } }
        : { where: { karyawanId: karyawanId! } }
    }
  });

  // All sessions in the window per streamer (any status) — needed to find
  // each candidate's next session and compute the transition gap.
  const allSessions = await db.jadwal.findMany({
    where: {
      ...(seeAll ? {} : { streamerKaryawanId: karyawanId! }),
      tanggal: { gte: startOfYesterday, lte: endOfToday },
    },
    orderBy: { jamMulaiLive: "asc" },
    select: { id: true, streamerKaryawanId: true, jamMulaiLive: true, jamSelesaiLive: true }
  });

  const thirtyMinMs = 30 * 60 * 1000;
  const tokenJedaMs = TOKEN_JEDA_MINUTES * 60 * 1000;
  const jedaTerbatas = jedaCandidates.filter((j) => {
    // (a) Only short-gap sessions (< 30 minutes scheduled duration) — legacy rule
    const durationMs = j.jamSelesaiLive.getTime() - j.jamMulaiLive.getTime();
    const isShortDuration = durationMs > 0 && durationMs <= thirtyMinMs;

    // (b) Mepet: gap to the next session of the same streamer < TOKEN_JEDA minutes.
    // Covers normal-duration sessions squeezed before the next one, and every
    // session in a chain of 3+ tight sessions per day.
    let isMepetNext = false;
    const thisEndMs = j.jamSelesaiLive.getTime();
    const streamerKey = j.streamerKaryawanId;
    const next = allSessions.find(
      (s) =>
        s.id !== j.id &&
        s.streamerKaryawanId === streamerKey &&
        s.jamMulaiLive.getTime() > thisEndMs
    );
    if (next) {
      const gapMs = next.jamMulaiLive.getTime() - thisEndMs;
      isMepetNext = gapMs > 0 && gapMs < tokenJedaMs;
    }

    if (!isShortDuration && !isMepetNext) return false;
    // Lebih dari 8 jam setelah selesai → eskalasi ke Perlu Lapor, bukan Jeda.
    return now.getTime() <= j.jamSelesaiLive.getTime() + 8 * 60 * 60 * 1000;
  });

  return {
    perluLapor,
    jedaTerbatas,
  };
}

/**
 * Kalender libur streamer (ref-deploy tab-request "Jadwal Libur"):
 * tanggal libur yang sudah terjadwal/tercatat untuk streamer.
 */
export async function getMyLiburCalendar() {
  const karyawanId = await requireStreamer();

  const libur = await db.liburStreamer.findMany({
    where: { karyawanId },
    orderBy: { tanggal: "asc" },
  });

  return libur.map((l) => ({
    id: l.id,
    tanggal: l.tanggal,
    alasan: l.alasan,
  }));
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

/** Get form controls & leave/shift request status for current streamer */
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

  // Check quota libur harian (kebijakan operasional: maksimal kuota per hari adalah 20 streamer)
  const maxQuota = typeof cfg.defaultKuotaLibur === "number" && cfg.defaultKuotaLibur > 0 ? cfg.defaultKuotaLibur : 20;
  const existingLeavesCount = await db.izin.count({
    where: {
      jenis: "LIBUR_STREAMER",
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (existingLeavesCount >= maxQuota) {
    throw AppError.conflict(`Kuota libur host untuk tanggal ${input.tanggal} sudah penuh (Maksimal ${maxQuota} streamer).`);
  }

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

  const izin = await db.izin.create({
    data: {
      karyawanId,
      tanggalMulai: startOfDay,
      tanggalSelesai: endOfDay,
      jenis: "LIBUR_STREAMER",
      alasan: `${input.alasan ?? "Pengajuan Libur Streamer"}${conflictNote}`,
      status: "PENDING",
    },
  });

  // Sync to liburStreamer database table
  try {
    await db.liburStreamer.upsert({
      where: {
        karyawanId_tanggal: {
          karyawanId,
          tanggal: startOfDay,
        },
      },
      create: {
        tenantId: user.tenantId || undefined,
        karyawanId,
        tanggal: startOfDay,
        alasan: input.alasan ?? "Pengajuan Libur Streamer",
      },
      update: {
        alasan: input.alasan ?? "Pengajuan Libur Streamer",
      },
    });
  } catch {
    // ignore duplicate constraint
  }

  return izin;
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
  const startOfDay = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate(), 0, 0, 0);
  const endOfDay = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate(), 23, 59, 59);

  // Check quota sesi live (kebutuhan host harian)
  const defaultQuota = typeof cfg.defaultKuotaShift === "number" && cfg.defaultKuotaShift > 0 ? cfg.defaultKuotaShift : 4;
  const dailyShiftQuota = (cfg.dailyShiftQuota ?? {}) as Record<string, any>;
  const dateKey = input.tanggal.split("T")[0];
  const customQuotaForDay = dailyShiftQuota[dateKey];
  let maxShiftQuota = defaultQuota;
  if (customQuotaForDay) {
    if (input.sesi === "SESI_1" && typeof customQuotaForDay.q00_08 === "number" && customQuotaForDay.q00_08 > 0) {
      maxShiftQuota = customQuotaForDay.q00_08;
    } else if (input.sesi === "SESI_2" && typeof customQuotaForDay.q08_16 === "number" && customQuotaForDay.q08_16 > 0) {
      maxShiftQuota = customQuotaForDay.q08_16;
    } else if (input.sesi === "SESI_3" && typeof customQuotaForDay.q16_00 === "number" && customQuotaForDay.q16_00 > 0) {
      maxShiftQuota = customQuotaForDay.q16_00;
    }
  }

  const existingShiftCount = await db.izin.count({
    where: {
      jenis: `REQUEST_${input.sesi}`,
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (existingShiftCount >= maxShiftQuota) {
    throw AppError.conflict(`Kuota request untuk sesi ini pada tanggal ${dateKey} sudah penuh.`);
  }

  const sesiLabel = {
    SESI_1: "Sesi 1 (00:00 - 08:00)",
    SESI_2: "Sesi 2 (08:00 - 16:00)",
    SESI_3: "Sesi 3 (16:00 - 00:00)",
  }[input.sesi] || "Sesi Live";

  return db.izin.create({
    data: {
      karyawanId,
      tanggalMulai: startOfDay,
      tanggalSelesai: endOfDay,
      jenis: `REQUEST_${input.sesi}`,
      alasan: `${sesiLabel} - ${input.catatan ?? "Permintaan Sesi Live"}`,
      status: "PENDING",
    },
  });
}
