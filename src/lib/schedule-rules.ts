/**
 * Pure schedule business rules — ported and expanded for Live Streaming Agency Operations.
 * No DB access; fully unit-testable.
 */

export const TOKEN_JEDA_MINUTES = 30;
export const WAJIB_HADIR_MINUTES = 25;
export const BATAS_TERLAMBAT_MINUTES = 24;

/**
 * Compute live duration handling overnight (MOD(K-J;1) equivalent).
 * start/end are Date objects; returns duration in minutes.
 */
export function computeDurationMinutes(start: Date, end: Date): number {
  let ms = end.getTime() - start.getTime();
  if (ms < 0) ms += 24 * 60 * 60 * 1000; // overnight
  return Math.round(ms / 60000);
}

/** WAJIB_HADIR = start - 25 min. */
export function computeWajibHadir(start: Date): Date {
  return new Date(start.getTime() - WAJIB_HADIR_MINUTES * 60 * 1000);
}

/** BATAS_TERLAMBAT = start - 24 min. */
export function computeBatasTerlambat(start: Date): Date {
  return new Date(start.getTime() - BATAS_TERLAMBAT_MINUTES * 60 * 1000);
}

/**
 * VALIDASI_TOKEN_JEDA: returns "BISA_TOKEN" if the karyawan has NO other
 * schedule whose [end + day-rollover] falls within 30 min before this start.
 * Ports the legacy SUMPRODUCT/LAMBDA logic.
 */
export function validateTokenJeda(
  start: Date,
  otherSchedules: { start: Date; end: Date }[]
): "BISA_TOKEN" | "TIDAK" {
  const startMs = start.getTime();
  const windowStart = startMs - TOKEN_JEDA_MINUTES * 60 * 1000;

  for (const s of otherSchedules) {
    let endMs = s.end.getTime();
    if (endMs < s.start.getTime()) endMs += 24 * 60 * 60 * 1000;
    if (endMs >= windowStart && endMs <= startMs) {
      return "TIDAK";
    }
  }
  return "BISA_TOKEN";
}

/**
 * Validates whether two time intervals overlap (including overnight sessions).
 */
export function isTimeOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  let aEnd = endA.getTime();
  if (aEnd < startA.getTime()) aEnd += 24 * 60 * 60 * 1000;

  let bEnd = endB.getTime();
  if (bEnd < startB.getTime()) bEnd += 24 * 60 * 60 * 1000;

  return startA.getTime() < bEnd && aEnd > startB.getTime();
}

/**
 * Validates studio room availability to prevent 2 broadcasts in the same studio.
 */
export function validateStudioRoomConflict(
  studio: string,
  start: Date,
  end: Date,
  existingRoomSchedules: { studio: string | null; start: Date; end: Date; idJadwal?: string }[]
): { hasConflict: boolean; conflictingJadwal?: string } {
  for (const s of existingRoomSchedules) {
    if (s.studio && s.studio.trim().toLowerCase() === studio.trim().toLowerCase()) {
      if (isTimeOverlapping(start, end, s.start, s.end)) {
        return { hasConflict: true, conflictingJadwal: s.idJadwal };
      }
    }
  }
  return { hasConflict: false };
}

const BULAN_INDONESIA = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * PERIODE_BULAN_DURASI_KOTOR: if DAY > 22, roll to next month.
 * Returns "Bulan YYYY" (e.g. "Mei 2026").
 */
export function computePeriodeBulan(tanggal: Date): string {
  const day = tanggal.getDate();
  const target = new Date(tanggal);
  if (day > 22) {
    target.setMonth(target.getMonth() + 1);
  }
  return `${BULAN_INDONESIA[target.getMonth()]} ${target.getFullYear()}`;
}
