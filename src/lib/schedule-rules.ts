/**
 * Pure schedule business rules — ported and expanded for Live Streaming Agency Operations.
 * No DB access; fully unit-testable.
 */

export const TOKEN_JEDA_MINUTES = 30; // default rest gap (client uses token jeda)
export const WAJIB_HADIR_MINUTES = 25;
export const BATAS_TERLAMBAT_MINUTES = 24;

/** Checkout window: how long after a session's scheduled end a STREAMER
 *  check-out stays open (legacy SESI_AKTIF_STREAMER formula: <= 8/24 day). */
export const CHECKOUT_WINDOW_HOURS = 8;
export const CHECKOUT_WINDOW_MS = CHECKOUT_WINDOW_HOURS * 3600 * 1000;

/** Agency-level rest gap override (minutes). Set in Tenant.config or env. */
export const DEFAULT_REST_GAP_MINUTES = TOKEN_JEDA_MINUTES;

// Context-aware transition gaps (minutes) for back-to-back sessions.
// The schedule is customer-driven, so the streamer adapts; the app enforces the
// minimum buffer needed for the transition type.
export const DEFAULT_SAME_STUDIO_GAP_MINUTES = 15; // quick check-out -> check-in
export const DEFAULT_SAME_BRANCH_GAP_MINUTES = 20; // move between studios in one branch
export const DEFAULT_CROSS_BRANCH_GAP_MINUTES = 30; // travel between branches (Timoho/Berbah)

export interface TransitionGapConfig {
  restGapMinutes?: number;          // legacy single-gap fallback
  sameStudioGapMinutes?: number;    // turnaround in the same studio room
  sameBranchGapMinutes?: number;    // move between studios within a branch
  crossBranchGapMinutes?: number;   // travel to a different branch
}

export type StudioRef = { cabang: string | null; nomor: string | null };

/**
 * Resolve the minimum transition gap (minutes) between a prior session and a new
 * one based on their studio/branch relationship:
 *  - same cabang + same nomor  -> sameStudioGap (fastest turnaround)
 *  - same cabang, diff nomor   -> sameBranchGap
 *  - different cabang          -> crossBranchGap (travel time)
 * Falls back to restGapMinutes (legacy) when studio info is unavailable.
 */
export function resolveTransitionGapMinutes(
  prior: StudioRef | null | undefined,
  next: StudioRef | null | undefined,
  config: TransitionGapConfig = {}
): number {
  const fallback = config.restGapMinutes ?? TOKEN_JEDA_MINUTES;

  if (!prior || !next || !next.cabang) return fallback;

  const sameCabang =
    !!prior.cabang && prior.cabang.trim().toLowerCase() === next.cabang.trim().toLowerCase();
  const sameNomor =
    sameCabang &&
    !!prior.nomor &&
    !!next.nomor &&
    prior.nomor.trim().toLowerCase() === next.nomor.trim().toLowerCase();

  if (sameCabang) {
    return sameNomor
      ? (config.sameStudioGapMinutes ?? DEFAULT_SAME_STUDIO_GAP_MINUTES)
      : (config.sameBranchGapMinutes ?? DEFAULT_SAME_BRANCH_GAP_MINUTES);
  }
  return config.crossBranchGapMinutes ?? DEFAULT_CROSS_BRANCH_GAP_MINUTES;
}

/**
 * Compute live duration in minutes. `jamMulaiLive`/`jamSelesaiLive` are absolute
 * ISO datetimes, so a plain difference is correct even for overnight/multi-day
 * sessions. The legacy `+24h if negative` rollover is intentionally NOT applied.
 */
export function computeDurationMinutes(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 60000);
}

/**
 * Overnight-safe duration for time-of-day Lembur records where `end < start`
 * means the shift crosses midnight (e.g. 22:00 -> 02:00 = 4h). Uses the same-day
 * date of both values; only adds a day when end time-of-day is strictly earlier.
 * NOT for Jadwal (which carries absolute dates).
 */
export function computeDurationMinutesOvernightSafe(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms >= 0) return Math.round(ms / 60000);
  // Cross-midnight: add a full day to the (shorter) end time-of-day.
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((ms + dayMs) / 60000);
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
 * schedule whose end falls within the required transition gap before this
 * start. The required gap is context-aware: same studio (fast turnaround),
 * same branch (studio change), or different branch (travel). Falls back to a
 * single `restGapMinutes` when studio refs are absent.
 * start/end are absolute ISO datetimes; no +24h rollover needed.
 */
export function validateTokenJeda(
  start: Date,
  otherSchedules: { start: Date; end: Date; studio?: StudioRef | null }[],
  restGapMinutes: number = TOKEN_JEDA_MINUTES,
  config: TransitionGapConfig = {},
  nextStudio?: StudioRef | null
): "BISA_TOKEN" | "TIDAK" {
  const startMs = start.getTime();

  for (const s of otherSchedules) {
    // Use the context-aware gap only when BOTH the prior session and the next
    // one carry studio/branch info; otherwise use the legacy single gap.
    const gap = s.studio && nextStudio
      ? resolveTransitionGapMinutes(s.studio, nextStudio, config)
      : (config.restGapMinutes ?? restGapMinutes);
    const windowStart = startMs - gap * 60 * 1000;
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
