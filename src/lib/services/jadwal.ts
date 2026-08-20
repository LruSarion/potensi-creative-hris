import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, tenantWhere } from "@/lib/auth-helpers";
import {
  computeDurationMinutes,
  computePeriodeBulan,
  validateTokenJeda,
  validateStudioRoomConflict,
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

export async function listJadwal(params?: { streamerKaryawanId?: string; tanggal?: string }) {
  const user = await requirePermission("jadwal:read");
  return db.jadwal.findMany({
    where: {
      ...tenantWhere(user),
      ...(params?.streamerKaryawanId ? { streamerKaryawanId: params.streamerKaryawanId } : {}),
      ...(params?.tanggal ? { tanggal: new Date(params.tanggal) } : {}),
    },
    orderBy: { tanggal: "asc" },
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
 * Throws if the new schedule violates the 30-min rest rule.
 */
async function assertTokenJedaOk(streamerId: string, start: Date, tenantId: string, excludeId?: string) {
  const others = await db.jadwal.findMany({
    where: {
      streamerKaryawanId: streamerId,
      tenantId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { jamMulaiLive: true, jamSelesaiLive: true },
  });
  const result = validateTokenJeda(
    start,
    others.map((o) => ({ start: o.jamMulaiLive, end: o.jamSelesaiLive }))
  );
  if (result === "TIDAK") {
    throw AppError.conflict("Streamer tidak dapat dijadwalkan: bentrok dengan jeda token (30 menit).");
  }
}

async function assertStudioRoomAvailable(studioName: string, start: Date, end: Date, tenantId: string, excludeId?: string) {
  const existing = await db.jadwal.findMany({
    where: {
      tenantId,
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { cabangStudio: { contains: studioName, mode: "insensitive" } },
        { nomorStudio: { contains: studioName, mode: "insensitive" } },
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

export async function createJadwal(input: JadwalInput) {
  const user = await requirePermission("jadwal:write");
  const parsed = jadwalSchema.parse(input);
  const start = new Date(parsed.jamMulaiLive);
  const end = new Date(parsed.jamSelesaiLive);
  const tanggal = new Date(parsed.tanggal);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  if (parsed.streamerKaryawanId) {
    await assertTokenJedaOk(parsed.streamerKaryawanId, start, user.tenantId);
  }

  const studioIdentifier = `${parsed.cabangStudio ?? ""} ${parsed.nomorStudio ?? ""}`.trim();
  if (studioIdentifier) {
    await assertStudioRoomAvailable(studioIdentifier, start, end, user.tenantId);
  }

  const existing = await db.jadwal.findFirst({
    where: { idJadwal: parsed.idJadwal, ...tenantWhere(user) },
  });
  if (existing) throw AppError.conflict("ID Jadwal sudah terdaftar");

  return db.jadwal.create({
    data: {
      ...parsed,
      tenantId: user.tenantId,
      status: parsed.status ?? undefined,
      tanggal,
      jamMulaiLive: start,
      jamSelesaiLive: end,
      periodeBulan: computePeriodeBulan(tanggal),
    },
  });
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

  if (parsed.streamerKaryawanId) {
    await assertTokenJedaOk(parsed.streamerKaryawanId, start, user.tenantId, id);
  }

  return db.jadwal.update({
    where: { id },
    data: {
      ...parsed,
      status: parsed.status ?? undefined,
      tanggal,
      jamMulaiLive: start,
      jamSelesaiLive: end,
      periodeBulan: computePeriodeBulan(tanggal),
    },
  });
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

  return db.$transaction(async (tx) => {
    const created = [];
    for (const parsed of parsedRows) {
      const start = new Date(parsed.jamMulaiLive);
      const end = new Date(parsed.jamSelesaiLive);
      const tanggal = new Date(parsed.tanggal);

      if (parsed.streamerKaryawanId) {
        const others = await tx.jadwal.findMany({
          where: { streamerKaryawanId: parsed.streamerKaryawanId, tenantId: user.tenantId },
          select: { jamMulaiLive: true, jamSelesaiLive: true },
        });
        const result = validateTokenJeda(
          start,
          others.map((o) => ({ start: o.jamMulaiLive, end: o.jamSelesaiLive }))
        );
        if (result === "TIDAK") {
          throw AppError.conflict(`Batch dibatalkan: bentrok jeda token untuk ${parsed.idJadwal}`);
        }
      }

      const row = await tx.jadwal.create({
        data: {
          ...parsed,
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
  });
}

/** Compute duration (minutes) for a jadwal — convenience for display/payroll. */
export function jadwalDurationMinutes(j: { jamMulaiLive: Date; jamSelesaiLive: Date }): number {
  return computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
}
