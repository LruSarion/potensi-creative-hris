import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import { recordStreamerExperienceOnSessionComplete } from "@/lib/services/streamer-experience";
import { formatTimeSafe } from "@/lib/utils/date-format";
import { getOperationalRules, validateGeoLocation } from "@/lib/services/operational-rules";
import { CHECKOUT_WINDOW_HOURS, CHECKOUT_WINDOW_MS } from "@/lib/schedule-rules";

const absensiSchema = z.object({
  karyawanId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  kategori: z.enum(["STREAMER", "STAFF", "OTS"]),
  buktiDriveId: z.string().optional().nullable(),
  // Frontend sends "fotoBuktiUrl" — treat as the attendance photo proof.
  fotoBuktiUrl: z.string().optional().nullable(),
  // Foto bukti GMV (from gallery upload or camera capture)
  fotoBuktiGmv: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
  alasan: z.string().optional().nullable(),
  nomorStudio: z.string().optional().nullable(),
  lokasi: z.string().optional().nullable(),
  reportedGmv: z.number().optional().nullable(),
  isTerusan: z.boolean().optional().default(false),
});

export type AbsensiInput = z.infer<typeof absensiSchema>;

/**
 * Check-in: creates a CHECK_IN record. Rejects if the karyawan already has an
 * open (un-checked-out) session. Automatically syncs Jadwal.liveState to LIVE.
 */
export async function checkIn(input: AbsensiInput) {
  const user = await requireRole();
  // Users default to checking in for themselves when no target is given.
  const targetKaryawanId = input.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  }
  // Users can only check in for themselves (or admins for others).
  if (
    user.karyawanId &&
    user.karyawanId !== targetKaryawanId &&
    !["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role)
  ) {
    throw AppError.forbidden("Tidak dapat absen untuk karyawan lain");
  }
  const parsed = absensiSchema.parse({ ...input, karyawanId: targetKaryawanId });
  parsed.jadwalId = parsed.jadwalId || null; // Fix empty string foreign key violation

  const operationalRules = await getOperationalRules(user.tenantId);
  const streamerRules = operationalRules.streamer;

  if (parsed.jadwalId && !parsed.isTerusan) {
    const j = await db.jadwal.findUnique({ where: { id: parsed.jadwalId } });
    if (j) {
      if (j.status === "SELESAI" || j.liveState === "CLOSED" || j.liveState === "REVIEW") {
        throw AppError.badRequest("Sesi jadwal ini sudah selesai dan tidak bisa di-check-in ulang.");
      }
      if (j.liveState === "LIVE") {
        throw AppError.badRequest("Jadwal ini sedang berjalan (ON AIR). Silakan lakukan check-out, bukan check-in.");
      }
      const openWindowMin = streamerRules.jendelaBukaMenit || 120;
      const closeWindowMin = streamerRules.jendelaTutupMenit || 60;
      const openTime = new Date(j.jamMulaiLive.getTime() - openWindowMin * 60000);
      const closeTime = new Date(j.jamMulaiLive.getTime() + closeWindowMin * 60000);
      const now = new Date();
      const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
      if (now < openTime) {
        throw AppError.badRequest(`Terlalu dini. Check-In baru dibuka ${openWindowMin} menit sebelum sesi dimulai.`);
      }
      if (!isAdmin && now > closeTime) {
        throw AppError.badRequest(`Batas waktu check-in reguler telah kedaluwarsa (> ${closeWindowMin} menit setelah sesi dimulai). Silakan gunakan tab Pelaporan Terbatas.`);
      }

      // Geo-Location validation against studio branch
      if (streamerRules.geoLocations && streamerRules.geoLocations.length > 0) {
        const geoCheck = validateGeoLocation(parsed.lokasi, j.cabangStudio, streamerRules.geoLocations);
        if (!isAdmin && !geoCheck.valid && geoCheck.mode === "STRICT") {
          throw AppError.badRequest(`Check-In Ditolak: ${geoCheck.message ?? "Anda berada di luar radius lokasi studio yang ditentukan."}`);
        }
        if (!geoCheck.valid && geoCheck.mode === "WARNING") {
          parsed.catatan = parsed.catatan
            ? `${parsed.catatan} [PERINGATAN LOKASI: ${geoCheck.message}]`
            : `[PERINGATAN LOKASI: ${geoCheck.message}]`;
        }
      }
    }
  }

  // Duplicate active session check: an open CHECK_IN with no matching CHECK_OUT.
  const openCheckIn = await db.absensi.findFirst({
    where: {
      karyawanId: targetKaryawanId,
      tipe: "CHECK_IN",
      waktu: {
        gte: await lastCheckOutTime(targetKaryawanId),
      },
    },
    orderBy: { waktu: "desc" },
  });

  if (openCheckIn) {
    if (!parsed.isTerusan) {
      throw AppError.conflict("Sesi absensi masih aktif. Lakukan check-out terlebih dahulu atau pilih Absensi Terusan.");
    }
    // If isTerusan is true, we will automatically check out the open session in the transaction below
  }

  return db.$transaction(async (tx) => {
    // 1. Auto Check-Out for previous session if isTerusan
    if (openCheckIn && parsed.isTerusan) {
      await tx.absensi.create({
        data: {
          tenantId: user.tenantId ?? undefined,
          karyawanId: targetKaryawanId,
          jadwalId: openCheckIn.jadwalId,
          tipe: "CHECK_OUT",
          kategori: openCheckIn.kategori,
          catatan: "Auto Check-Out (Absensi Terusan)",
          reportedGmv: null, // Streamer must fill this later
        },
      });

      if (openCheckIn.jadwalId) {
        const j = await tx.jadwal.findUnique({ where: { id: openCheckIn.jadwalId } });
        if (j && (j.liveState === "LIVE" || j.liveState === "SCHEDULED")) {
          const checkOutTime = new Date();
          const durationSec = Math.floor((checkOutTime.getTime() - openCheckIn.waktu.getTime()) / 1000);
          
          await tx.jadwal.update({
            where: { id: openCheckIn.jadwalId },
            data: { 
              liveState: "REVIEW", 
              status: "SELESAI",
              durationSec: Math.max(0, durationSec)
            },
          });
          await tx.sessionStateLog.create({
            data: {
              tenantId: user.tenantId ?? undefined,
              jadwalId: openCheckIn.jadwalId,
              fromState: j.liveState,
              toState: "REVIEW",
              changedById: user.id,
              note: "Auto-transition on Terusan Check-In",
            },
          });
        }
      }
    }

    // Combine notes, reason, and location into catatan
    const catatanParts: string[] = [];
    if (parsed.catatan) catatanParts.push(parsed.catatan);
    if (parsed.alasan) catatanParts.push(`Alasan: ${parsed.alasan}`);
    if (parsed.lokasi) catatanParts.push(`Lokasi: ${parsed.lokasi}`);
    const resolvedCatatan = catatanParts.length > 0 ? catatanParts.join(" | ") : null;

    // 2. Create the new Check-In record
    const record = await tx.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId: targetKaryawanId,
        jadwalId: parsed.jadwalId ?? null,
        tipe: "CHECK_IN",
        kategori: parsed.kategori,
        buktiDriveId: parsed.buktiDriveId ?? parsed.fotoBuktiUrl ?? null,
        catatan: resolvedCatatan,
        isTerusan: parsed.isTerusan,
      },
    });

    // If linked to a schedule, update liveState to LIVE
    if (parsed.jadwalId) {
      const j = await tx.jadwal.findUnique({ where: { id: parsed.jadwalId } });
      if (j && j.liveState === "SCHEDULED") {
        await tx.jadwal.update({
          where: { id: parsed.jadwalId },
          data: { 
            liveState: "LIVE",
            ...(parsed.nomorStudio ? { nomorStudio: parsed.nomorStudio } : {}),
          },
        });
        await tx.sessionStateLog.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            jadwalId: parsed.jadwalId,
            fromState: "SCHEDULED",
            toState: "LIVE",
            changedById: user.id,
            note: "Auto-transition on Check-In",
          },
        });
      }
    }

    return record;
  });
}

/**
 * Check-out: creates a CHECK_OUT record. Requires an open CHECK_IN.
 * Automatically syncs Jadwal.liveState to REVIEW/CLOSED.
 */
export async function checkOut(input: AbsensiInput) {
  const user = await requireRole();
  // Users default to checking out for themselves when no target is given.
  const targetKaryawanId = input.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  }
  if (
    user.karyawanId &&
    user.karyawanId !== targetKaryawanId &&
    !["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role)
  ) {
    throw AppError.forbidden("Tidak dapat absen untuk karyawan lain");
  }
  const parsed = absensiSchema.parse({ ...input, karyawanId: targetKaryawanId });
  parsed.jadwalId = parsed.jadwalId || null; // Fix empty string foreign key violation

  const lastCheckIn = await db.absensi.findFirst({
    where: { karyawanId: targetKaryawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!lastCheckIn) {
    throw AppError.badRequest("Belum ada check-in untuk karyawan ini.");
  }

  // Checkout window (STREAMER only): check-out opens at the scheduled end
  // time and closes CHECKOUT_WINDOW_HOURS later — mirrors the legacy
  // SESI_AKTIF_STREAMER formula. Other categories (STAFF/OTS, tab Terbatas)
  // are not gated. Schedules without jamSelesaiLive (legacy data) stay open.
  const windowJadwalId = parsed.jadwalId ?? lastCheckIn.jadwalId;
  if (windowJadwalId && parsed.kategori === "STREAMER") {
    const j = await db.jadwal.findUnique({ where: { id: windowJadwalId } });
    if (j?.jamSelesaiLive) {
      const end = new Date(j.jamSelesaiLive);
      const now = Date.now();
      if (now < end.getTime()) {
        throw AppError.conflict(
          `Check-out belum dibuka: sesi berakhir ${formatTimeSafe(end)} WIB.`
        );
      }
      if (now > end.getTime() + CHECKOUT_WINDOW_MS) {
        throw AppError.conflict(
          `Jendela check-out (H+${CHECKOUT_WINDOW_HOURS} jam setelah sesi berakhir) sudah terlewat. Silakan lapor melalui tab Terbatas.`
        );
      }
    }
  }

  return db.$transaction(async (tx) => {
    // Combine notes and location into catatan (mirrors check-in behavior)
    const catatanParts: string[] = [];
    if (parsed.catatan) catatanParts.push(parsed.catatan);
    if (parsed.lokasi) catatanParts.push(`Lokasi: ${parsed.lokasi}`);
    const resolvedCatatan = catatanParts.length > 0 ? catatanParts.join(" | ") : null;

    let resolvedBukti: string | null = null;
    if (parsed.fotoBuktiGmv || parsed.fotoBuktiUrl) {
      resolvedBukti = JSON.stringify({
        gmv: parsed.fotoBuktiGmv || null,
        keluar: parsed.fotoBuktiUrl || null,
        lokasi: parsed.lokasi || null,
      });
    } else {
      resolvedBukti = parsed.buktiDriveId ?? null;
    }

    const record = await tx.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId: targetKaryawanId,
        jadwalId: parsed.jadwalId ?? lastCheckIn.jadwalId ?? null,
        tipe: "CHECK_OUT",
        kategori: parsed.kategori,
        buktiDriveId: resolvedBukti,
        catatan: resolvedCatatan,
        reportedGmv: parsed.reportedGmv ?? null,
      },
    });

    // If linked to a schedule, update liveState to REVIEW/CLOSED
    const targetJadwalId = parsed.jadwalId ?? lastCheckIn.jadwalId;
    if (targetJadwalId) {
      const j = await tx.jadwal.findUnique({ where: { id: targetJadwalId } });
      if (j && (j.liveState === "LIVE" || j.liveState === "SCHEDULED")) {
        const checkOutTime = new Date();
        const durationSec = Math.floor((checkOutTime.getTime() - lastCheckIn.waktu.getTime()) / 1000);
        
        await tx.jadwal.update({
          where: { id: targetJadwalId },
          data: { 
            liveState: "REVIEW", 
            status: "SELESAI",
            durationSec: Math.max(0, durationSec),
            ...(parsed.nomorStudio ? { nomorStudio: parsed.nomorStudio } : {}),
          },
        });
        await tx.sessionStateLog.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            jadwalId: targetJadwalId,
            fromState: j.liveState,
            toState: "REVIEW",
            changedById: user.id,
            note: "Auto-transition on Check-Out (Session Finished)",
          },
        });
      }
    }

    return record;
  }).then(async (record) => {
    // Auto-record the completed session in the streamer's experience portfolio.
    const jadwalId = parsed.jadwalId ?? lastCheckIn.jadwalId;
    if (jadwalId) {
      await recordStreamerExperienceOnSessionComplete(jadwalId).catch(() => {
        // non-fatal
      });
    }
    return record;
  });
}

/** Time of the most recent CHECK_OUT for a karyawan (or epoch if none). */
export async function lastCheckOutTime(karyawanId: string): Promise<Date> {
  const last = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  return last ? last.waktu : new Date(0);
}

export async function listAbsensi(params?: { karyawanId?: string; view?: string; kategori?: string }) {
  const user = await requireRole();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  // Non-admins see only their own attendance (data isolation).
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (params?.karyawanId) where.karyawanId = params.karyawanId;
  else if (!isAdmin && user.karyawanId) where.karyawanId = user.karyawanId;

  if (params?.kategori) {
    where.kategori = params.kategori;
  }

  // Streamer session-based history matching ref-deploy
  if (params?.view === "history" && params?.kategori !== "STAFF") {
    let targetKaryawanId = params?.karyawanId;
    if (!isAdmin && user.karyawanId) targetKaryawanId = user.karyawanId;

    const whereJadwal: Record<string, unknown> = { ...tenantWhere(user) };
    if (targetKaryawanId) {
      whereJadwal.OR = [
        { streamerKaryawanId: targetKaryawanId },
        { hostKaryawanId: targetKaryawanId },
      ];
    }

    const [jadwalList, standaloneAbsensi] = await Promise.all([
      db.jadwal.findMany({
        where: whereJadwal,
        orderBy: { tanggal: "desc" },
        include: {
          client: true,
          streamerKaryawan: true,
          hostKaryawan: true,
          absensi: {
            orderBy: { waktu: "asc" },
          },
        },
      }),
      db.absensi.findMany({
        where: {
          ...where,
          jadwalId: null,
        },
        include: { karyawan: true },
        orderBy: { waktu: "desc" },
      }),
    ]);

    const sessions: any[] = [];

    for (const j of jadwalList) {
      const checkIn = j.absensi.find((a) => a.tipe === "CHECK_IN");
      const checkOut = j.absensi.slice().reverse().find((a) => a.tipe === "CHECK_OUT");

      const k = j.streamerKaryawan || j.hostKaryawan;
      const streamerName = k?.namaLengkap || "Streamer";
      const idHost = k?.idKaryawan || "-";

      const tglStr = new Date(j.tanggal).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // Jadwal times are stored as UTC instants; display/compare in WIB (Asia/Jakarta).
      const jamMulaiFmt = formatTimeSafe(j.jamMulaiLive);
      const jamSelesaiFmt = formatTimeSafe(j.jamSelesaiLive);

      // Scheduled duration
      const diffMin = Math.round((new Date(j.jamSelesaiLive).getTime() - new Date(j.jamMulaiLive).getTime()) / 60000);
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      const durasiStr = hours > 0 ? (mins > 0 ? `${hours} Jam ${mins} Mnt` : `${hours} Jam`) : `${mins} Mnt`;

      // Late check calculation using absolute timestamp difference
      let isTelat = false;
      let telatRaw = "-";
      if (checkIn && j.jamMulaiLive) {
        const checkInMs = new Date(checkIn.waktu).getTime();
        const schedStartMs = new Date(j.jamMulaiLive).getTime();
        if (!isNaN(checkInMs) && !isNaN(schedStartMs)) {
          const lateMin = Math.floor((checkInMs - schedStartMs) / 60000);
          if (lateMin > 0 && lateMin < 720) {
            isTelat = true;
            const lateH = Math.floor(lateMin / 60);
            const lateM = lateMin % 60;
            telatRaw = lateH > 0 ? `${lateH} Jam ${lateM} Mnt` : `${lateM} Menit`;
          }
        }
      }

      let status = j.status as string;
      if (checkOut) {
        if (checkOut.reportedGmv === null || checkOut.reportedGmv === undefined) {
          status = "PERLU LAPOR";
        } else {
          status = "SELESAI";
        }
      } else if (checkIn) {
        const nowMs = Date.now();
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

      const idAbsen = checkOut?.id 
        ? `ABS-${j.idJadwal.replace(/[^0-9]/g, "") || checkOut.id.slice(-4).toUpperCase()}`
        : checkIn?.id
        ? `ABS-${j.idJadwal.replace(/[^0-9]/g, "") || checkIn.id.slice(-4).toUpperCase()}`
        : `SCH-${j.idJadwal}`;

      const jamMasukStr = checkIn ? formatTimeSafe(checkIn.waktu).replace(":", ".") : "-";
      const jamKeluarStr = checkOut ? formatTimeSafe(checkOut.waktu).replace(":", ".") : "-";

      // Extract photos & locations for scheduled session
      const fotoMasuk = checkIn?.buktiDriveId || null;
      let lokasiMasuk: string | null = null;
      if (checkIn?.catatan) {
        const match = checkIn.catatan.match(/Lokasi:\s*([^|]+)/i);
        if (match) lokasiMasuk = match[1].trim();
      }

      let fotoGmv: string | null = null;
      let fotoKeluar: string | null = null;
      let lokasiKeluar: string | null = null;

      if (checkOut?.catatan) {
        const match = checkOut.catatan.match(/Lokasi(?: Keluar)?:\s*([^|]+)/i);
        if (match) lokasiKeluar = match[1].trim();
      }

      if (checkOut?.buktiDriveId) {
        try {
          if (checkOut.buktiDriveId.startsWith("{")) {
            const p = JSON.parse(checkOut.buktiDriveId);
            fotoGmv = p.gmv || null;
            fotoKeluar = p.keluar || null;
            if (p.lokasi && !lokasiKeluar) lokasiKeluar = p.lokasi;
          } else {
            // Single raw photo string: in check-out, the required photo was the selfie keluar
            fotoKeluar = checkOut.buktiDriveId;
            fotoGmv = null;
          }
        } catch {
          fotoKeluar = checkOut.buktiDriveId;
          fotoGmv = null;
        }
      }

      sessions.push({
        id: j.id,
        idAbsen,
        idJadwal: j.idJadwal,
        status,
        platform: j.platform || "TikTok",
        clientName: j.client?.namaClient || "Brand Partner",
        tanggal: tglStr,
        jamMulai: jamMulaiFmt,
        jamSelesai: jamSelesaiFmt,
        durasi: durasiStr,
        cabang: j.cabangStudio || "Timoho",
        studio: j.nomorStudio || "Studio 1",
        streamer: streamerName,
        idHost,
        jamMasuk: jamMasukStr,
        jamKeluar: jamKeluarStr,
        waktuMasuk: checkIn ? checkIn.waktu.toISOString() : null,
        waktuKeluar: checkOut ? checkOut.waktu.toISOString() : null,
        telatRaw,
        isTelat,
        nominalGmv: checkOut?.reportedGmv ? Number(checkOut.reportedGmv) : null,
        buktiDriveId: fotoGmv || fotoKeluar || fotoMasuk || null,
        fotoMasuk,
        lokasiMasuk,
        fotoKeluar,
        fotoGmv,
        lokasiKeluar,
        catatan: checkOut?.catatan || checkIn?.catatan || null,
        rawDate: j.tanggal.toISOString(),
        rawTimestamp: new Date(j.tanggal).getTime(),
      });
    }

    // Process any standalone attendance entries
    for (const a of standaloneAbsensi) {
      const isCheckout = a.tipe === "CHECK_OUT";
      const timeFmt = new Date(a.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
      let fotoGmv: string | null = null;
      let fotoKeluar: string | null = null;
      let lokasiKeluar: string | null = null;
      if (a.catatan) {
        const match = a.catatan.match(/Lokasi(?: Keluar)?:\s*([^|]+)/i);
        if (match) lokasiKeluar = match[1].trim();
      }
      if (a.buktiDriveId) {
        try {
          if (a.buktiDriveId.startsWith("{")) {
            const p = JSON.parse(a.buktiDriveId);
            fotoGmv = p.gmv || null;
            fotoKeluar = p.keluar || null;
            if (p.lokasi && !lokasiKeluar) lokasiKeluar = p.lokasi;
          } else {
            if (isCheckout) {
              fotoKeluar = a.buktiDriveId;
              fotoGmv = null;
            }
            // Check-in photos render directly from buktiDriveId below.
          }
        } catch {
          if (isCheckout) {
            fotoKeluar = a.buktiDriveId;
            fotoGmv = null;
          }
        }
      }

      sessions.push({
        id: a.id,
        idAbsen: `ABS-${a.id.slice(-6).toUpperCase()}`,
        idJadwal: "-",
        status: isCheckout ? "SELESAI" : "ON AIR",
        platform: "Umum",
        clientName: "-",
        tanggal: new Date(a.waktu).toLocaleDateString("id-ID", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        jamMulai: "-",
        jamSelesai: "-",
        durasi: "-",
        cabang: "Timoho",
        studio: "-",
        streamer: a.karyawan?.namaLengkap || "Staff",
        idHost: a.karyawan?.idKaryawan || "-",
        jamMasuk: !isCheckout ? timeFmt : "-",
        jamKeluar: isCheckout ? timeFmt : "-",
        waktuMasuk: !isCheckout ? a.waktu.toISOString() : null,
        waktuKeluar: isCheckout ? a.waktu.toISOString() : null,
        telatRaw: "-",
        isTelat: false,
        nominalGmv: a.reportedGmv ? Number(a.reportedGmv) : null,
        buktiDriveId: a.buktiDriveId || null,
        fotoMasuk: !isCheckout ? a.buktiDriveId : null,
        lokasiMasuk: !isCheckout ? lokasiKeluar : null,
        fotoKeluar: isCheckout ? fotoKeluar : null,
        fotoGmv: isCheckout ? fotoGmv : null,
        lokasiKeluar: isCheckout ? lokasiKeluar : null,
        catatan: a.catatan || null,
        rawDate: a.waktu.toISOString(),
        rawTimestamp: new Date(a.waktu).getTime(),
      });
    }

    return sessions.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }

  const records = await db.absensi.findMany({
    where,
    orderBy: { waktu: "desc" },
    include: {
      karyawan: true,
      jadwal: {
        include: { client: true },
      },
    },
  });

  // Map paired check-in & check-out times by jadwalId and karyawanId
  const checkInsByJadwal = new Map<string, Date>();
  const checkOutsByJadwal = new Map<string, Date>();

  for (const r of records) {
    if (r.jadwalId) {
      const key = `${r.karyawanId}_${r.jadwalId}`;
      if (r.tipe === "CHECK_IN" && !checkInsByJadwal.has(key)) {
        checkInsByJadwal.set(key, r.waktu);
      } else if (r.tipe === "CHECK_OUT" && !checkOutsByJadwal.has(key)) {
        checkOutsByJadwal.set(key, r.waktu);
      }
    }
  }

  return records.map((r) => {
    const key = r.jadwalId ? `${r.karyawanId}_${r.jadwalId}` : null;
    const pairedCheckIn = key ? checkInsByJadwal.get(key) : null;
    const pairedCheckOut = key ? checkOutsByJadwal.get(key) : null;

    const waktuMasuk = r.tipe === "CHECK_IN"
      ? r.waktu
      : (pairedCheckIn ?? r.jadwal?.jamMulaiLive ?? null);

    const waktuKeluar = r.tipe === "CHECK_OUT"
      ? r.waktu
      : (pairedCheckOut ?? null);

    return {
      ...r,
      waktuMasuk,
      waktuKeluar,
    };
  });
}

export async function updateGmv(id: string, payload: number | {
  reportedGmv: number;
  nomorStudio?: string | null;
  catatan?: string | null;
  buktiDriveId?: string | null;
}) {
  const user = await requireRole();
  const absensi = await db.absensi.findUnique({ 
    where: { id },
    include: { jadwal: true }
  });
  if (!absensi) throw AppError.notFound("Data absensi tidak ditemukan");
  
  if (absensi.karyawanId !== user.karyawanId && !["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(user.role)) {
    throw AppError.forbidden("Tidak bisa mengubah data absensi orang lain");
  }

  const reportedGmv = typeof payload === "number" ? payload : payload.reportedGmv;
  const catatan = typeof payload === "object" ? payload.catatan : undefined;
  const buktiDriveId = typeof payload === "object" ? payload.buktiDriveId : undefined;
  const nomorStudio = typeof payload === "object" ? payload.nomorStudio : undefined;

  return db.$transaction(async (tx) => {
    let resolvedBukti = buktiDriveId;
    if (buktiDriveId && absensi.buktiDriveId && buktiDriveId !== absensi.buktiDriveId) {
      try {
        if (absensi.buktiDriveId.startsWith("{")) {
          const p = JSON.parse(absensi.buktiDriveId);
          resolvedBukti = JSON.stringify({ ...p, gmv: buktiDriveId });
        } else {
          // absensi.buktiDriveId is the selfie photo, merge GMV proof into JSON
          resolvedBukti = JSON.stringify({
            gmv: buktiDriveId,
            keluar: absensi.buktiDriveId,
          });
        }
      } catch {
        resolvedBukti = JSON.stringify({
          gmv: buktiDriveId,
          keluar: absensi.buktiDriveId,
        });
      }
    }

    const updated = await tx.absensi.update({
      where: { id },
      data: { 
        reportedGmv,
        ...(catatan !== undefined ? { catatan } : {}),
        ...(resolvedBukti !== undefined ? { buktiDriveId: resolvedBukti } : {}),
      }
    });

    if (absensi.jadwalId) {
      await tx.jadwal.update({
        where: { id: absensi.jadwalId },
        data: {
          status: "SELESAI",
          liveState: "REVIEW",
          ...(nomorStudio ? { nomorStudio } : {})
        }
      });
    }

    return updated;
  });
}

/**
 * Handle limited actions (Aksi Khusus):
 * 1. PULANG_TELAT: Late report for sessions that missed checkout / missing GMV (>8 hrs)
 * 2. MASUK_PULANG_TERBATAS: Instant checkout for short-gap schedules (<30 mins)
 */
export async function submitAbsenTerbatas(input: {
  tipeForm: "PULANG_TELAT" | "MASUK_PULANG_TERBATAS";
  idAbsen?: string | null;
  idJadwal: string;
  nomorStudio?: string | null;
  reportedGmv: number;
  catatan?: string | null;
  fotoBuktiGmv?: string | null;
  fotoBuktiKeluar?: string | null;
  lokasiGmv?: string | null;
  lokasiKeluar?: string | null;
  karyawanId?: string | null;
}) {
  const user = await requireRole();
  const targetKaryawanId = input.karyawanId || user.karyawanId;
  if (!targetKaryawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");

  // Find jadwal by id or idJadwal
  const jadwal = await db.jadwal.findFirst({
    where: {
      OR: [
        { id: input.idJadwal },
        { idJadwal: input.idJadwal }
      ]
    }
  });
  if (!jadwal) throw AppError.notFound("Jadwal tidak ditemukan");

  let buktiFoto: string | null = null;
  if (input.fotoBuktiGmv || input.fotoBuktiKeluar) {
    buktiFoto = JSON.stringify({
      gmv: input.fotoBuktiGmv || null,
      keluar: input.fotoBuktiKeluar || null,
      lokasi: input.lokasiKeluar || input.lokasiGmv || null,
    });
  } else {
    buktiFoto = null;
  }
  // Combine notes and GPS locations into catatan (mirrors check-in/out behavior)
  const catatanParts: string[] = [];
  if (input.catatan) catatanParts.push(input.catatan);
  if (input.lokasiGmv) catatanParts.push(`Lokasi GMV: ${input.lokasiGmv}`);
  if (input.lokasiKeluar) catatanParts.push(`Lokasi Keluar: ${input.lokasiKeluar}`);
  const resolvedCatatan = catatanParts.length > 0 ? catatanParts.join(" | ") : null;

  return db.$transaction(async (tx) => {
    if (input.tipeForm === "PULANG_TELAT") {
      let targetAbsen = input.idAbsen 
        ? await tx.absensi.findUnique({ where: { id: input.idAbsen } })
        : await tx.absensi.findFirst({
            where: { jadwalId: jadwal.id, karyawanId: targetKaryawanId },
            orderBy: { waktu: "desc" }
          });

      if (targetAbsen && targetAbsen.tipe === "CHECK_OUT") {
        let mergedBukti = buktiFoto ?? targetAbsen.buktiDriveId;
        if (input.fotoBuktiGmv && targetAbsen.buktiDriveId && input.fotoBuktiGmv !== targetAbsen.buktiDriveId) {
          try {
            if (targetAbsen.buktiDriveId.startsWith("{")) {
              const p = JSON.parse(targetAbsen.buktiDriveId);
              mergedBukti = JSON.stringify({
                ...p,
                gmv: input.fotoBuktiGmv,
                ...(input.fotoBuktiKeluar ? { keluar: input.fotoBuktiKeluar } : {}),
                ...(input.lokasiKeluar ? { lokasi: input.lokasiKeluar } : {}),
              });
            } else {
              mergedBukti = JSON.stringify({
                gmv: input.fotoBuktiGmv,
                keluar: input.fotoBuktiKeluar || targetAbsen.buktiDriveId,
                lokasi: input.lokasiKeluar || input.lokasiGmv || null,
              });
            }
          } catch {
            mergedBukti = JSON.stringify({
              gmv: input.fotoBuktiGmv,
              keluar: targetAbsen.buktiDriveId,
            });
          }
        }

        await tx.absensi.update({
          where: { id: targetAbsen.id },
          data: {
            reportedGmv: input.reportedGmv,
            catatan: resolvedCatatan ?? targetAbsen.catatan,
            buktiDriveId: mergedBukti,
          }
        });
      } else {
        // If targetAbsen was CHECK_IN or not found, create the CHECK_OUT
        await tx.absensi.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            karyawanId: targetKaryawanId,
            jadwalId: jadwal.id,
            tipe: "CHECK_OUT",
            kategori: "STREAMER",
            reportedGmv: input.reportedGmv,
            catatan: resolvedCatatan ?? "Laporan Sesi Telat",
            buktiDriveId: buktiFoto,
          }
        });
      }
    } else {
      // MASUK_PULANG_TERBATAS (Absen Instan Sesi Jeda)
      const existingCheckIn = await tx.absensi.findFirst({
        where: { jadwalId: jadwal.id, karyawanId: targetKaryawanId, tipe: "CHECK_IN" }
      });
      if (!existingCheckIn) {
        await tx.absensi.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            karyawanId: targetKaryawanId,
            jadwalId: jadwal.id,
            tipe: "CHECK_IN",
            kategori: "STREAMER",
            catatan: "Check-In Instan (Jeda Terbatas)",
            buktiDriveId: buktiFoto,
          }
        });
      }

      await tx.absensi.create({
        data: {
          tenantId: user.tenantId ?? undefined,
          karyawanId: targetKaryawanId,
          jadwalId: jadwal.id,
          tipe: "CHECK_OUT",
          kategori: "STREAMER",
          reportedGmv: input.reportedGmv,
          catatan: resolvedCatatan ?? "Selesai Sesi Jeda Terbatas",
          buktiDriveId: buktiFoto,
        }
      });
    }

    // Update Schedule
    await tx.jadwal.update({
      where: { id: jadwal.id },
      data: {
        status: "SELESAI",
        liveState: "REVIEW",
        ...(input.nomorStudio ? { nomorStudio: input.nomorStudio } : {})
      }
    });

    await tx.sessionStateLog.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        jadwalId: jadwal.id,
        fromState: jadwal.liveState,
        toState: "REVIEW",
        changedById: user.id,
        note: input.tipeForm === "PULANG_TELAT" 
          ? "Sesi Selesai melalui Laporan Telat (Terbatas)"
          : "Sesi Selesai melalui Absen Instan (Jeda Terbatas)",
      }
    });

    return { status: "success", jadwalId: jadwal.id };
  }).then(async (res) => {
    await recordStreamerExperienceOnSessionComplete(jadwal.id).catch(() => {});
    return res;
  });
}

/** Active (open) session for a karyawan, if any. */
export async function getSesiAktif(karyawanId: string) {
  const user = await requireRole();
  // Non-admins may only query their own active session.
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  if (!isAdmin && user.karyawanId && user.karyawanId !== karyawanId) {
    throw AppError.forbidden("Tidak dapat melihat sesi karyawan lain");
  }
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
