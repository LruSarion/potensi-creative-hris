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
      // Handle plain "YYYY-MM-DD" to avoid timezone shifts
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
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleDateString(
      "id-ID",
      options ?? { day: "2-digit", month: "short", year: "numeric" },
    );
  } catch {
    return fallback;
  }
}

/**
 * Safely format a value as a "HH:mm" time string.
 * Handles ISO strings, "HH:mm" strings, Date objects, and nullish values.
 */
export function formatTimeSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d{1,2}:\d{2}/.test(trimmed)) {
        const parts = trimmed.split(":");
        return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
      }
      // Extract from ISO string
      if (trimmed.includes("T")) {
        const timePart = trimmed.split("T")[1];
        if (timePart) return timePart.slice(0, 5);
      }
    }
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return fallback;
  }
}

/**
 * Extract a "HH:mm" time portion from a value.
 * Returns empty string on failure (useful for form inputs).
 */
export function formatTimeOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (val.includes("T")) {
      const timePart = val.split("T")[1];
      return timePart ? timePart.slice(0, 5) : "";
    }
    if (val.includes(":")) return val.slice(0, 5);
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

/**
 * Extract a "YYYY-MM-DD" date portion from a value.
 * Returns empty string on failure.
 */
export function formatDateOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
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
 * Calculate an end time that is 2 hours after the given start "HH:mm" string.
 */
export function calculateEndTime(startStr: string): string {
  if (!startStr || !startStr.includes(":")) return "";
  const [h, m] = startStr.split(":").map(Number);
  const endH = ((isNaN(h) ? 0 : h) + 2) % 24;
  return `${String(endH).padStart(2, "0")}:${String(isNaN(m) ? 0 : m).padStart(2, "0")}`;
}

/**
 * Given a "jamMulaiLive" time value, calculate "Wajib Hadir" (15 minutes before).
 * Returns a readable "HH.mm WIB" string.
 */
export function calcWajibHadir(jamMulaiVal: any): string {
  if (!jamMulaiVal) return "–";
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
