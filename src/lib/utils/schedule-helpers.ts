/**
 * Schedule-specific helper functions.
 *
 * Contains business logic helpers for schedule management that were
 * previously defined inline in the input-jadwal page component.
 */

/** Generate a new schedule ID with format `PREFIX/YYMMDD/NNN`. */
export function generateNewScheduleId(
  prefix: "STR" | "OTS" | "JDK" | "MKT",
  dateStr?: string,
): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}/${yy}${mm}${dd}/${rand}`;
}

/** Map a shift value to its start/end times. */
export function applyShiftOts(shiftVal: string): {
  masuk: string;
  keluar: string;
} {
  if (shiftVal === "07:00-15:00") return { masuk: "07:00", keluar: "15:00" };
  if (shiftVal === "15:00-23:00") return { masuk: "15:00", keluar: "23:00" };
  if (shiftVal === "23:00-07:00") return { masuk: "23:00", keluar: "07:00" };
  return { masuk: "", keluar: "" };
}

/** Format a row item (employee record) for display. */
export function formatRowItem(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  return `${item.id || item.idKaryawan || "-"} | ${item.nama || item.namaLengkap || "Streamer"}`;
}

export interface PlatformClientOption {
  label: string;
  value: string;
  clientId: string;
}

/**
 * Resolve the correct platform client option value for a target schedule.
 * Attempts multiple matching strategies (exact, by clientId, by brand name).
 */
export function resolvePlatformClientValue(
  target: any,
  options: PlatformClientOption[],
): string {
  if (!target) return "";
  const targetClientId = target.clientId || target.client?.id;
  const targetPlatform = (target.platform || "").trim();
  const targetClientName = (
    target.client?.namaMerk ||
    target.client?.namaClient ||
    ""
  ).trim();

  // 1. Exact match by value or label in options
  if (targetPlatform) {
    const exactMatch = options.find(
      (o) =>
        o.value.toLowerCase() === targetPlatform.toLowerCase() ||
        o.label.toLowerCase() === targetPlatform.toLowerCase(),
    );
    if (exactMatch) return exactMatch.value;
  }

  // 2. Match by clientId and platform substring
  if (targetClientId && targetPlatform) {
    const clientPlatformMatch = options.find(
      (o) =>
        o.clientId === targetClientId &&
        o.value.toLowerCase().includes(targetPlatform.toLowerCase()),
    );
    if (clientPlatformMatch) return clientPlatformMatch.value;
  }

  // 3. Match by clientId alone
  if (targetClientId) {
    const clientMatch = options.find((o) => o.clientId === targetClientId);
    if (clientMatch) return clientMatch.value;
  }

  // 4. Match by brand name + platform substring
  if (targetClientName && targetPlatform) {
    const brandMatch = options.find(
      (o) =>
        o.value.toLowerCase().includes(targetClientName.toLowerCase()) &&
        o.value.toLowerCase().includes(targetPlatform.toLowerCase()),
    );
    if (brandMatch) return brandMatch.value;
  }

  // 5. Match by brand name alone
  if (targetClientName) {
    const brandMatch = options.find((o) =>
      o.value.toLowerCase().includes(targetClientName.toLowerCase()),
    );
    if (brandMatch) return brandMatch.value;
  }

  // 6. Return existing target.platform if present
  if (targetPlatform) return targetPlatform;

  return options[0]?.value || "Shopee Live";
}

/**
 * Convert minutes to "HH:mm" time string.
 */
export function minutesToTime(m: number): string {
  const mins = Math.round(m);
  const h = Math.floor(mins / 60) % 24;
  const rem = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * Check if two time ranges overlap (using "HH:mm" strings).
 */
export function isTimeOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string,
): boolean {
  return s1 < e2 && s2 < e1;
}
