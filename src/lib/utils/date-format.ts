/**
 * Shared date/time formatting utilities.
 *
 * Consolidates all formatting helpers that were previously duplicated
 * across multiple page files (input-jadwal, streamer-dashboard, etc.).
 */

/**
 * Safely format a value as a localised date string.
 * Handles ISO strings, "YYYY-MM-DD" strings, Date objects, and nullish values.
 */
export function formatDateSafe(
  val: any,
  options?: Intl.DateTimeFormatOptions,
  fallback = "–",
): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Handle plain "YYYY-MM-DD" directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString(
            "id-ID",
            options ?? { day: "2-digit", month: "short", year: "numeric" },
          );
        }
      }
    }
    const dt = val instanceof Date ? val : new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleDateString(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        ...(options ?? { day: "2-digit", month: "short", year: "numeric" }),
      },
    );
  } catch {
    return fallback;
  }
}

/**
 * Format a date in standard Indonesian formal style (e.g. "12 Mei 1998" or "15 Januari 2024").
 * Ideal for employee profiles, detail modals, and official records.
 */
export function formatDateIndo(val: any, fallback = "-"): string {
  return formatDateSafe(
    val,
    { day: "numeric", month: "long", year: "numeric" },
    fallback,
  );
}

/**
 * Safely format a value as a "HH:mm" time string in WIB (Asia/Jakarta).
 * Handles ISO strings, "HH:mm" strings, Date objects, and nullish values.
 */
export function formatTimeSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string") {
      const trimmed = val.trim();
      // If plain HH:mm or HH:mm:ss without date or timezone
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
        const parts = trimmed.split(":");
        return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
      }
    }
    const dt = val instanceof Date ? val : new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return fallback;
  }
}

/**
 * Extract a "HH:mm" time portion from a value in WIB (Asia/Jakarta).
 * Returns empty string on failure (useful for form inputs).
 */
export function formatTimeOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
  }
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

/**
 * Extract a "YYYY-MM-DD" date portion from a value in WIB (Asia/Jakarta).
 * Returns empty string on failure.
 */
export function formatDateOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Calculate duration in hours between two "HH:mm" strings.
 * Handles overnight spans (e.g. "23:00" → "07:00" = 8 hours).
 * Returns the same time = 24 hours.
 */
export function calcDurationHours(startVal: string, endVal: string): string {
  if (!startVal || !endVal) return "0";
  if (startVal === endVal) return "24";
  const [sh, sm] = startVal.split(":").map(Number);
  const [eh, em] = endVal.split(":").map(Number);
  let startMins = sh * 60 + (sm || 0);
  let endMins = eh * 60 + (em || 0);
  if (endMins < startMins) endMins += 1440;
  return String((endMins - startMins) / 60);
}

/**
 * Format live duration as HH:MM (e.g. 10:00→12:30 = 02:30).
 * Overnight-safe (end < start → +24h). Returns "–" when empty/invalid.
 * Normalizes inputs via formatTimeSafe (supports ISO, HH:mm:ss, Date).
 */
export function formatDurationHHMM(startVal: any, endVal: any, fallback = "–"): string {
  if (!startVal || !endVal) return fallback;
  const s = formatTimeSafe(startVal, "");
  const e = formatTimeSafe(endVal, "");
  if (!s || !e || !s.includes(":") || !e.includes(":")) return fallback;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return fallback;
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 1440;
  if (endMins === startMins) return "24:00";
  const diff = endMins - startMins;
  const hh = String(Math.floor(diff / 60)).padStart(2, "0");
  const mm = String(diff % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Given a "jamMulaiLive" time value, calculate "Wajib Hadir" (15 minutes before).
 * Returns a readable "HH.mm WIB" string.
 */
export function calcWajibHadir(jamMulaiVal: any): string {
  if (!jamMulaiVal) return "–";
  const timeStr = formatTimeSafe(jamMulaiVal);
  if (timeStr && timeStr !== "–" && timeStr.includes(":")) {
    return getWajibHadirTime(timeStr);
  }
  const d = new Date(jamMulaiVal);
  if (isNaN(d.getTime())) return "15 Menit Sebelum";
  d.setMinutes(d.getMinutes() - 15);
  return (
    d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " WIB"
  );
}

/**
 * Calculate "Wajib Hadir" time from a plain "HH:mm" string.
 * Returns "HH.mm WIB" format.
 */
export function getWajibHadirTime(jamMulai?: string | null): string {
  if (!jamMulai) return "-";
  const parts = jamMulai.split(":");
  if (parts.length < 2) return "-";
  const hour = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(min)) return "-";
  let totalMin = hour * 60 + min - 15;
  if (totalMin < 0) totalMin += 24 * 60;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")} WIB`;
}

/**
 * Format a date with full weekday information.
 */
export function formatDateFull(val: any): string {
  return formatDateSafe(val, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
