import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, tenantWhere } from "@/lib/auth-helpers";
import { syncJadwalToGoogleCalendar } from "@/lib/services/google-calendar";
import {
  computeDurationMinutes,
  computePeriodeBulan,
  validateTokenJeda,
  validateStudioRoomConflict,
  isTimeOverlapping,
  TOKEN_JEDA_MINUTES,
  type TransitionGapConfig,
} from "@/lib/schedule-rules";

export const jadwalSchema = z.object({
  idJadwal: z.string().min(1),
  tanggal: z.string().min(1), // ISO date
  platform: z.string().optional().nullable(),
  idHost: z.string().optional().nullable(),
  hostKaryawanId: z.string().optional().nullable(),
  streamerKaryawanId: z.string().optional().nullable(),
  idOts: z.string().optional().nullable(),
  otsKaryawanId: z.string().optional().nullable(),
  cabangStudio: z.string().optional().nullable(),
  nomorStudio: z.string().optional().nullable(),
  jamMulaiLive: z.string().min(1), // ISO datetime
  jamSelesaiLive: z.string().min(1), // ISO datetime
  status: z.enum(["TERJADWAL", "PENDING", "APPROVED", "REJECTED", "SELESAI", "DIBATALKAN"]).optional().nullable(),
  produkPrioritas: z.string().optional().nullable(),
  keperluanOts: z.string().optional().nullable(),
  judulLive: z.string().optional().nullable(),
  promoLive: z.string().optional().nullable(),
  catatanHost: z.string().optional().nullable(),
  catatanOts: z.string().optional().nullable(),
  filePendukungHostDriveId: z.string().optional().nullable(),
  filePendukungOtsDriveId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

export type JadwalInput = z.infer<typeof jadwalSchema>;

export async function listJadwal(params?: {
  streamerKaryawanId?: string;
  otsKaryawanId?: string;
  karyawanId?: string;
  tanggal?: string;
}) {
  const user = await requirePermission("jadwal:read");
  return db.jadwal.findMany({
    where: {
      ...tenantWhere(user),
      ...(params?.streamerKaryawanId ? { streamerKaryawanId: params.streamerKaryawanId } : {}),
      ...(params?.otsKaryawanId ? { otsKaryawanId: params.otsKaryawanId } : {}),
      ...(params?.karyawanId
        ? {
            OR: [
              { otsKaryawanId: params.karyawanId },
              { streamerKaryawanId: params.karyawanId },
              { hostKaryawanId: params.karyawanId },
            ],
          }
        : {}),
      ...(params?.tanggal ? { tanggal: new Date(params.tanggal) } : {}),
    },
    orderBy: { tanggal: "desc" },
    include: { streamerKaryawan: true, hostKaryawan: true, otsKaryawan: true, client: true },
  });
}

export async function getJadwal(id: string) {
  const user = await requirePermission("jadwal:read");
  const row = await db.jadwal.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!row) throw AppError.notFound("Jadwal tidak ditemukan");
  return row;
}

/**
 * Validate token-jeda for a streamer against existing schedules.
 * Throws if the new schedule violates the rest rule (configurable gap).
 */
async function assertTokenJedaOk(
  streamerId: string,
  start: Date,
  end: Date,
  tenantId: string,
  nextStudio: { cabang: string | null; nomor: string | null },
  config: TransitionGapConfig,
  excludeId?: string
) {
  const others = await db.jadwal.findMany({
    where: {
      streamerKaryawanId: streamerId,
      tenantId,
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { idJadwal: true, jamMulaiLive: true, jamSelesaiLive: true, cabangStudio: true, nomorStudio: true },
  });

  // (A) Same-streamer overlap: a streamer cannot be in two sessions at once.
  for (const o of others) {
    if (isTimeOverlapping(start, end, o.jamMulaiLive, o.jamSelesaiLive)) {
      throw AppError.conflict(
        `Streamer sudah dijadwalkan sesi lain (${o.idJadwal}) pada jam yang bentrok.`
      );
    }
  }

  // TODO(batas-cekout): aturan jeda pergantian studio/branch dinonaktifkan
  // sementara — akan diaktifkan kembali sebagai validasi "cekout terbatas".
  // (B) Transition gap: context-aware (same studio / same branch / cross branch).
  // const result = validateTokenJeda(
  //   start,
  //   others.map((o) => ({
  //     start: o.jamMulaiLive,
  //     end: o.jamSelesaiLive,
  //     studio: { cabang: o.cabangStudio, nomor: o.nomorStudio },
  //   })),
  //   config.restGapMinutes ?? TOKEN_JEDA_MINUTES,
  //   config,
  //   nextStudio
  // );
  // if (result === "TIDAK") {
  //   throw AppError.conflict(
  //     `Streamer tidak dapat dijadwalkan: perlu jeda pergantian studio/branch sebelum sesi ini.`
  //   );
  // }
  void nextStudio;
  void config;
}

/**
 * Resolve the agency's configured transition-gap settings. Reads Tenant.config
 * (sameStudioGapMinutes / sameBranchGapMinutes / crossBranchGapMinutes /
 * restGapMinutes), falling back to sensible defaults.
 */
async function resolveTransitionConfig(tenantId: string): Promise<TransitionGapConfig> {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const cfg = (tenant?.config ?? {}) as TransitionGapConfig;
    return {
      restGapMinutes: cfg.restGapMinutes ?? TOKEN_JEDA_MINUTES,
      sameStudioGapMinutes: cfg.sameStudioGapMinutes,
      sameBranchGapMinutes: cfg.sameBranchGapMinutes,
      crossBranchGapMinutes: cfg.crossBranchGapMinutes,
    };
  } catch {
    return { restGapMinutes: TOKEN_JEDA_MINUTES };
  }
}

async function assertStudioRoomAvailable(studioName: string, start: Date, end: Date, tenantId: string, excludeId?: string) {
  // studioName is the concatenated "Cabang Nomor" (e.g. "Timoho 01"). Split into
  // the separate cabangStudio + nomorStudio columns the schema actually stores.
  const parts = studioName.trim().split(/\s+/);
  const cabang = parts[0] ?? "";
  const nomor = parts.slice(1).join(" ") || (parts[0] ?? "");

  const existing = await db.jadwal.findMany({
    where: {
      tenantId,
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { cabangStudio: { contains: cabang, mode: "insensitive" } },
        { nomorStudio: { contains: nomor, mode: "insensitive" } },
      ],
    },
    select: { idJadwal: true, cabangStudio: true, nomorStudio: true, jamMulaiLive: true, jamSelesaiLive: true },
  });

  const roomSchedules = existing.map((e) => ({
    studio: `${e.cabangStudio ?? ""} ${e.nomorStudio ?? ""}`.trim(),
    start: e.jamMulaiLive,
    end: e.jamSelesaiLive,
    idJadwal: e.idJadwal,
  }));

  const check = validateStudioRoomConflict(studioName, start, end, roomSchedules);
  if (check.hasConflict) {
    throw AppError.conflict(
      `Studio "${studioName}" sedang digunakan oleh sesi ${check.conflictingJadwal ?? "lain"} pada jam tersebut.`
    );
  }
}

/** Coerce empty-string optional FKs to null (avoid FK constraint violations). */
function normalizeJadwalData(input: JadwalInput): JadwalInput {
  const data = { ...input };
  for (const key of ["clientId", "streamerKaryawanId", "hostKaryawanId", "otsKaryawanId", "idHost", "idOts"] as const) {
    const v = data[key as keyof JadwalInput];
    if (v === "") (data as Record<string, unknown>)[key] = null;
  }
  return data;
}

export async function createJadwal(input: JadwalInput) {
  const user = await requirePermission("jadwal:write");
  const parsed = jadwalSchema.parse(input);
  const start = new Date(parsed.jamMulaiLive);
  const end = new Date(parsed.jamSelesaiLive);
  const tanggal = new Date(parsed.tanggal);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  const transitionConfig = await resolveTransitionConfig(user.tenantId);
  const nextStudio = { cabang: parsed.cabangStudio ?? null, nomor: parsed.nomorStudio ?? null };

  if (parsed.streamerKaryawanId) {
    await assertTokenJedaOk(parsed.streamerKaryawanId, start, end, user.tenantId, nextStudio, transitionConfig);
  }

  // Blacklist Enforcement: Check if streamer is blacklisted for this client
  if (parsed.clientId && parsed.streamerKaryawanId) {
    const blacklisted = await db.streamerBlacklist.findUnique({
      where: {
        clientId_karyawanId: {
          clientId: parsed.clientId,
          karyawanId: parsed.streamerKaryawanId,
        },
      },
    });
    if (blacklisted) {
      throw AppError.badRequest(
        `Streamer ini masuk dalam daftar BLACKLIST klien tersebut (${blacklisted.alasan ?? "Dilarang menugaskan"}).`
      );
    }
  }

  const studioIdentifier = `${parsed.cabangStudio ?? ""} ${parsed.nomorStudio ?? ""}`.trim();
  if (studioIdentifier) {
    await assertStudioRoomAvailable(studioIdentifier, start, end, user.tenantId);
  }

  const existing = await db.jadwal.findFirst({
    where: { idJadwal: parsed.idJadwal, ...tenantWhere(user) },
  });
  if (existing) throw AppError.conflict("ID Jadwal sudah terdaftar");

  const created = await db.jadwal.create({
    data: {
      ...normalizeJadwalData(parsed),
      tenantId: user.tenantId,
      status: parsed.status ?? undefined,
      tanggal,
      jamMulaiLive: start,
      jamSelesaiLive: end,
      periodeBulan: computePeriodeBulan(tanggal),
    },
  });

  // Auto Sync to Streamer Google Calendar in background
  syncJadwalToGoogleCalendar(created.id).catch(() => {});

  return created;
}

export async function updateJadwal(id: string, input: JadwalInput) {
  const user = await requirePermission("jadwal:write");
  const parsed = jadwalSchema.parse(input);
  const existing = await db.jadwal.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Jadwal tidak ditemukan");
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  const start = new Date(parsed.jamMulaiLive);
  const end = new Date(parsed.jamSelesaiLive);
  const tanggal = new Date(parsed.tanggal);

  const transitionConfig = await resolveTransitionConfig(user.tenantId);
  const nextStudio = { cabang: parsed.cabangStudio ?? null, nomor: parsed.nomorStudio ?? null };

  if (parsed.streamerKaryawanId) {
    await assertTokenJedaOk(parsed.streamerKaryawanId, start, end, user.tenantId, nextStudio, transitionConfig, id);
  }

  const updated = await db.jadwal.update({
    where: { id },
    data: {
      ...normalizeJadwalData(parsed),
      status: parsed.status ?? undefined,
      tanggal,
      jamMulaiLive: start,
      jamSelesaiLive: end,
      periodeBulan: computePeriodeBulan(tanggal),
    },
  });

  // Auto Sync to Streamer Google Calendar in background
  syncJadwalToGoogleCalendar(updated.id).catch(() => {});

  return updated;
}

/**
 * Batch create (streamer/OTS). Atomic — all-or-nothing via transaction.
 * Returns per-row results; throws if any row invalid.
 */
export async function createJadwalBatch(rows: JadwalInput[]) {
  const user = await requirePermission("jadwal:write");
  if (!rows.length) throw AppError.badRequest("Batch kosong");
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  // Validate all rows first (fail fast, atomic)
  const parsedRows = rows.map((r) => jadwalSchema.parse(r));
  const transitionConfig = await resolveTransitionConfig(user.tenantId);

  return db.$transaction(async (tx) => {
    const created = [];
    for (const parsed of parsedRows) {
      const start = new Date(parsed.jamMulaiLive);
      const end = new Date(parsed.jamSelesaiLive);
      const tanggal = new Date(parsed.tanggal);
      const nextStudio = { cabang: parsed.cabangStudio ?? null, nomor: parsed.nomorStudio ?? null };

      if (parsed.streamerKaryawanId) {
        const others = await tx.jadwal.findMany({
          where: {
            streamerKaryawanId: parsed.streamerKaryawanId,
            tenantId: user.tenantId,
            status: { notIn: ["DIBATALKAN", "REJECTED"] },
          },
          select: { idJadwal: true, jamMulaiLive: true, jamSelesaiLive: true, cabangStudio: true, nomorStudio: true },
        });
        // Same-streamer overlap within the batch + existing.
        for (const o of others) {
          if (isTimeOverlapping(start, end, o.jamMulaiLive, o.jamSelesaiLive)) {
            throw AppError.conflict(`Batch dibatalkan: sesi ${parsed.idJadwal} bentrok dengan ${o.idJadwal} untuk streamer yang sama.`);
          }
        }
        // TODO(batas-cekout): aturan jeda pergantian studio/branch dinonaktifkan
        // sementara — akan diaktifkan kembali sebagai validasi "cekout terbatas".
        // const result = validateTokenJeda(
        //   start,
        //   others.map((o) => ({
        //     start: o.jamMulaiLive,
        //     end: o.jamSelesaiLive,
        //     studio: { cabang: o.cabangStudio, nomor: o.nomorStudio },
        //   })),
        //   transitionConfig.restGapMinutes ?? TOKEN_JEDA_MINUTES,
        //   transitionConfig,
        //   nextStudio
        // );
        // if (result === "TIDAK") {
        //   throw AppError.conflict(`Batch dibatalkan: bentrok jeda pergantian studio/branch untuk ${parsed.idJadwal}`);
        // }
        void nextStudio;
      }

      const row = await tx.jadwal.create({
        data: {
          ...normalizeJadwalData(parsed),
          tenantId: user.tenantId,
          status: parsed.status ?? undefined,
          tanggal,
          jamMulaiLive: start,
          jamSelesaiLive: end,
          periodeBulan: computePeriodeBulan(tanggal),
        },
      });
      created.push(row);
    }
    return created;
  }).then((createdRows) => {
    // Background Google Calendar Sync for all created batch rows
    for (const r of createdRows) {
      syncJadwalToGoogleCalendar(r.id).catch(() => {});
    }
    return createdRows;
  });
}

/** Compute duration (minutes) for a jadwal — convenience for display/payroll. */
export function jadwalDurationMinutes(j: { jamMulaiLive: Date; jamSelesaiLive: Date }): number {
  return computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
}

/**
 * Calculate total hours assigned to a streamer in a given month.
 * Used for Golongan 4 Alert (>156 hours / month).
 */
export async function getStreamerMonthlyHoursAccumulator(streamerKaryawanId: string, periodeBulan?: string) {
  const currentPeriode = periodeBulan ?? computePeriodeBulan(new Date());
  const rows = await db.jadwal.findMany({
    where: {
      streamerKaryawanId,
      periodeBulan: currentPeriode,
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
    },
    select: { jamMulaiLive: true, jamSelesaiLive: true },
  });

  const totalMinutes = rows.reduce((acc, r) => acc + computeDurationMinutes(r.jamMulaiLive, r.jamSelesaiLive), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const isGolongan4Warning = totalHours >= 150; // Approaching or over 156h
  const isGolongan4Exceeded = totalHours >= 156;

  return {
    streamerKaryawanId,
    periodeBulan: currentPeriode,
    totalMinutes,
    totalHours,
    isGolongan4Warning,
    isGolongan4Exceeded,
  };
}

export async function deleteJadwal(id: string) {
  const user = await requirePermission("jadwal:write");
  const existing = await db.jadwal.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { absensi: true },
  });
  if (!existing) throw AppError.notFound("Jadwal tidak ditemukan");

  const checkIns = existing.absensi.filter((a) => a.tipe === "CHECK_IN");
  const checkOuts = existing.absensi.filter((a) => a.tipe === "CHECK_OUT");
  const hasActiveCheckIn = checkIns.length > checkOuts.length;

  if (existing.liveState === "LIVE" || hasActiveCheckIn) {
    throw AppError.badRequest(
      "Jadwal ini sedang aktif berjalan (ON AIR / sudah Check-In). Jadwal tidak dapat dihapus saat sesi sedang berlangsung. Silakan lakukan Check-Out terlebih dahulu."
    );
  }

  return db.$transaction(async (tx) => {
    await tx.absensi.updateMany({
      where: { jadwalId: id },
      data: { jadwalId: null },
    });
    await tx.sessionStateLog.deleteMany({
      where: { jadwalId: id },
    });
    await tx.sessionReview.deleteMany({
      where: { jadwalId: id },
    });
    await tx.qcViolation.deleteMany({
      where: { jadwalId: id },
    });
    await tx.incident.updateMany({
      where: { jadwalId: id },
      data: { jadwalId: null },
    });
    await tx.revenueEntry.updateMany({
      where: { jadwalId: id },
      data: { jadwalId: null },
    });
    await tx.marketplaceListing.updateMany({
      where: { jadwalId: id },
      data: { jadwalId: null },
    });
    await tx.streamerExperience.deleteMany({
      where: { jadwalId: id },
    });
    await tx.billingLine.deleteMany({
      where: { jadwalId: id },
    });

    return tx.jadwal.delete({
      where: { id },
    });
  });
}

