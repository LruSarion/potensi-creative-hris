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
 * Compute live duration in minutes. `jamMulaiLive`/`jamSelesaiLive` are absolute
 * ISO datetimes, so a plain difference is correct even for overnight/multi-day
 * sessions. The legacy `+24h if negative` rollover is intentionally NOT applied.
 */
export function computeDurationMinutes(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
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
 * schedule whose end falls within `restGapMinutes` before this start.
 * `restGapMinutes` is configurable (defaults to TOKEN_JEDA_MINUTES).
 * start/end are absolute ISO datetimes, so a plain epoch-ms comparison is
 * correct for overnight/multi-day 24/7 operations (no +24h rollover).
 */
export function validateTokenJeda(
  start: Date,
  otherSchedules: { start: Date; end: Date }[],
  restGapMinutes: number = TOKEN_JEDA_MINUTES
): "BISA_TOKEN" | "TIDAK" {
  const startMs = start.getTime();
  const windowStart = startMs - restGapMinutes * 60 * 1000;

  for (const s of otherSchedules) {
    const endMs = s.end.getTime();
    if (endMs >= windowStart && endMs <= startMs) {
      return "TIDAK";
    }
  }
  return "BISA_TOKEN";
}

/**
 * JAM_SELESAI_TERAKHIR (last real session end). start/end are absolute ISO
 * datetimes, so the latest end is simply the max of `end` across sessions —
 * no +24h rollover needed (overnight/multi-day ends already carry their date).
 */
export function computeLastSessionEnd(
  sessions: { start: Date; end: Date }[]
): Date | null {
  if (!sessions.length) return null;
  let maxMs = 0;
  for (const s of sessions) {
    const endMs = s.end.getTime();
    if (endMs > maxMs) maxMs = endMs;
  }
  return new Date(maxMs);
}

/**
 * Validates whether two time intervals overlap.
 * `jamMulaiLive`/`jamSelesaiLive` are full absolute ISO datetimes, so a plain
 * epoch-ms interval overlap is correct — including overnight (23:00->02:00) and
 * multi-day sessions in a 24/7 operation. The legacy +24h rollover is NOT applied
 * because the inputs already carry their absolute calendar date.
 */
export function isTimeOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  const aStart = startA.getTime();
  const aEnd = endA.getTime();
  const bStart = startB.getTime();
  const bEnd = endB.getTime();

  // Adjacent sessions (end == start) do not overlap; true overlap requires both
  // endpoints to strictly interleave.
  return aStart < bEnd && aEnd > bStart;
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
