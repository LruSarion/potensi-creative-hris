// Shared client-side checkout-window logic for the streamer dashboard.
// Mirrors the legacy SESI_AKTIF_STREAMER formula: check-out opens at the
// schedule's end time and stays open for CHECKOUT_WINDOW_HOURS (H+8).

import { formatDateOnly } from "@/lib/utils/date-format";
import { CHECKOUT_WINDOW_HOURS, CHECKOUT_WINDOW_MS } from "@/lib/schedule-rules";

export { CHECKOUT_WINDOW_HOURS, CHECKOUT_WINDOW_MS };

/** Jadwal shape subset needed to resolve session start and end times. */
export type ScheduleTimeSource = {
  tanggal?: string | Date | null;
  jamMulaiLive?: string | Date | null;
  jamSelesaiLive?: string | Date | null;
} | null | undefined;

export type ScheduleEndSource = ScheduleTimeSource;

/**
 * Resolve a session's absolute start Date.
 */
export function getScheduleStartFromSession(jadwal: ScheduleTimeSource): Date | null {
  const t = jadwal?.jamMulaiLive;
  if (!t) return null;
  if (typeof t === "string" && !t.includes("T")) {
    if (!jadwal?.tanggal) return null;
    const dateStr = formatDateOnly(jadwal.tanggal) || String(jadwal.tanggal).slice(0, 10);
    const timeStr = t.length === 5 ? t + ":00" : t;
    const d = new Date(`${dateStr}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a session's absolute end Date. Handles Prisma ISO datetimes
 * ("2026-09-03T12:00:00+07:00") and legacy "HH:mm" time-only strings
 * (combined with the schedule date, same pattern as getScheduleStartTime
 * in tab-checkin). Returns null when no usable value exists — callers
 * treat that as "don't lock" (legacy data without jadwal relation).
 */
export function getScheduleEndFromSession(jadwal: ScheduleTimeSource): Date | null {
  const t = jadwal?.jamSelesaiLive;
  if (!t) return null;
  if (typeof t === "string" && !t.includes("T")) {
    if (!jadwal?.tanggal) return null;
    const dateStr = formatDateOnly(jadwal.tanggal) || String(jadwal.tanggal).slice(0, 10);
    const timeStr = t.length === 5 ? t + ":00" : t;
    const d = new Date(`${dateStr}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export type StreamerLiveSessionState = "PREPARE" | "ON AIR" | "PERLU LAPOR";

/**
 * Compute the streamer's live session status based on the legacy SESI_AKTIF_STREAMER formula:
 * - PREPARE: now < schedule start time (checked in early, preparing for live)
 * - ON AIR: now between start time and end time (live is broadcasting)
 * - PERLU LAPOR: now > end time (scheduled live ended, must check out / submit GMV)
 */
export function getStreamerActiveSessionState(
  jadwal: ScheduleTimeSource,
  nowMs: number = Date.now()
): StreamerLiveSessionState {
  const start = getScheduleStartFromSession(jadwal);
  let end = getScheduleEndFromSession(jadwal);
  if (start && end && end.getTime() < start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  if (start && nowMs < start.getTime()) {
    return "PREPARE";
  }
  if (end && nowMs > end.getTime()) {
    return "PERLU LAPOR";
  }
  return "ON AIR";
}

export type CheckoutWindowState = "SEBELUM" | "TERBUKA" | "LEWAT" | "TANPA_JADWAL";

/**
 * Compare `now` (epoch ms) against the session end:
 * - TANPA_JADWAL: no resolvable end time — checkout stays allowed (legacy data)
 * - SEBELUM: before the session ends — checkout locked
 * - TERBUKA: within [end, end + 8h] — checkout allowed
 * - LEWAT: past end + 8h — checkout locked (use the Terbatas tab)
 */
export function getCheckoutWindowState(end: Date | null, now: number): CheckoutWindowState {
  if (!end) return "TANPA_JADWAL";
  const endMs = end.getTime();
  if (now < endMs) return "SEBELUM";
  if (now <= endMs + CHECKOUT_WINDOW_MS) return "TERBUKA";
  return "LEWAT";
}