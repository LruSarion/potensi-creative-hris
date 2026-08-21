/**
 * Pure schedule business rules — ported and expanded for Live Streaming Agency Operations.
 * No DB access; fully unit-testable.
 */

export const TOKEN_JEDA_MINUTES = 30; // default rest gap (client uses token jeda)
export const WAJIB_HADIR_MINUTES = 25;
export const BATAS_TERLAMBAT_MINUTES = 24;

/** Agency-level rest gap override (minutes). Set in Tenant.config or env. */
export const DEFAULT_REST_GAP_MINUTES = TOKEN_JEDA_MINUTES;

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
 * schedule whose [end + day-rollover] falls within `restGapMinutes` before
 * this start. `restGapMinutes` is configurable (defaults to TOKEN_JEDA_MINUTES),
 * matching the client's JAM_SELESAI_TERAKHIR rest-tracking rule.
 */
export function validateTokenJeda(
  start: Date,
  otherSchedules: { start: Date; end: Date }[],
  restGapMinutes: number = TOKEN_JEDA_MINUTES
): "BISA_TOKEN" | "TIDAK" {
  const startMs = start.getTime();
  const windowStart = startMs - restGapMinutes * 60 * 1000;

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
 * JAM_SELESAI_TERAKHIR (last real session end, with overnight rollover).
 * Ports the client sheet's LET/MAP/MAX logic:
 *   riil = if end < start then date + 1 + end else date + end
 *   max  = max(riil) across the streamer's sessions
 * Returns the absolute timestamp of the latest moment a streamer finished.
 */
export function computeLastSessionEnd(
  sessions: { start: Date; end: Date }[]
): Date | null {
  if (!sessions.length) return null;

  let maxMs = 0;
  for (const s of sessions) {
    const startMs = s.start.getTime();
    const endMs = s.end.getTime();
    // Midnights of each date (start's day and end's day).
    const startMidnight = new Date(s.start.getFullYear(), s.start.getMonth(), s.start.getDate()).getTime();
    const endMidnight = new Date(s.end.getFullYear(), s.end.getMonth(), s.end.getDate()).getTime();
    const startTimeOfDay = startMs - startMidnight;
    const endTimeOfDay = endMs - endMidnight;
    // Overnight when the end time-of-day is earlier than the start time-of-day.
    const overnight = endTimeOfDay < startTimeOfDay ? 24 * 60 * 60 * 1000 : 0;
    // Absolute end: session's start-day midnight + (overnight rollover) + end time-of-day.
    const sessionEndAbsolute = startMidnight + overnight + endTimeOfDay;
    if (sessionEndAbsolute > maxMs) maxMs = sessionEndAbsolute;
  }
  return new Date(maxMs);
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
