/**
 * Shared CSS class constants used across input-jadwal tab components.
 * Avoids duplicating Tailwind class strings in every component.
 */
export const inputCls =
  "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition";

export const dateInputCls =
  "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition cursor-pointer";

export const selectCls =
  "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition";

export const labelCls =
  "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

/** Badge CSS helper for schedule status values. */
export function getStatusBadgeClass(status: string): string {
  const st = (status || "TERJADWAL").toUpperCase();
  if (st === "SELESAI") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (st === "DIBATALKAN" || st === "REJECTED" || st === "BATAL")
    return "bg-red-100 text-red-700 border-red-200";
  if (st === "ON_GOING" || st === "BERJALAN")
    return "bg-rose-100 text-rose-700 border-rose-200 animate-pulse font-bold";
  if (st === "PENDING" || st === "PLOTING")
    return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}
