"use client";

import { useMemo, useState } from "react";

type ScheduleEvent = {
  id: string;
  idJadwal: string;
  platform: string | null;
  cabangStudio: string | null;
  nomorStudio: string | null;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  liveState: string;
  status: string;
  streamer?: { namaLengkap: string | null; idKaryawan: string | null } | null;
  client?: { namaClient: string | null } | null;
};

const PLATFORM_COLORS: Record<string, string> = {
  "Shopee Live": "bg-orange-500 border-orange-600",
  Shopee: "bg-orange-500 border-orange-600",
  "TikTok Shop": "bg-slate-800 border-slate-900",
  TikTok: "bg-slate-800 border-slate-900",
  "Tokopedia Live": "bg-emerald-500 border-emerald-600",
  Tokopedia: "bg-emerald-500 border-emerald-600",
  "Lazada Live": "bg-sky-500 border-sky-600",
  Lazada: "bg-sky-500 border-sky-600",
};
const FALLBACK_COLOR = "bg-indigo-500 border-indigo-600";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eventDateKey(ev: ScheduleEvent): string {
  const d = new Date(ev.jamMulaiLive);
  return startOfDayKey(d);
}

function platformColor(platform: string | null): string {
  return PLATFORM_COLORS[platform ?? ""] ?? FALLBACK_COLOR;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function ScheduleCalendar({
  events,
  onSelectDate,
  onSelectEvent,
}: {
  events: ScheduleEvent[];
  onSelectDate?: (date: string) => void;
  onSelectEvent?: (ev: ScheduleEvent) => void;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    return cells;
  }, [viewDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const ev of events) {
      const key = eventDateKey(ev);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    map.forEach((arr) => arr.sort((a, b) => new Date(a.jamMulaiLive).getTime() - new Date(b.jamMulaiLive).getTime()));
    return map;
  }, [events]);

  const monthKey = startOfDayKey(viewDate);
  const totalSessions = events.filter((e) => eventDateKey(e).startsWith(monthKey.slice(0, 7))).length;

  const shiftMonth = (delta: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition"
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {totalSessions} sesi bulan ini
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Hari Ini
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="min-h-[72px] rounded-xl bg-slate-50/50 border border-transparent" />;

          const key = startOfDayKey(cell);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = startOfDayKey(cell) === startOfDayKey(today);
          const isCurrent = cell.getMonth() === viewDate.getMonth();

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate?.(key)}
              onKeyDown={(e) => e.key === "Enter" && onSelectDate?.(key)}
              className={`min-h-[72px] rounded-xl border p-1 text-left align-top transition hover:border-blue-400 hover:shadow-sm cursor-pointer ${
                isToday
                  ? "border-blue-400 bg-blue-50/60"
                  : isCurrent
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50/70"
              }`}
            >
              <div className={`text-[11px] font-bold mb-1 ${isToday ? "text-blue-600" : "text-slate-500"}`}>
                {cell.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(ev);
                    }}
                    className={`w-full text-left ${platformColor(ev.platform)} text-white text-[9px] leading-tight rounded px-1 py-0.5 font-semibold cursor-pointer truncate`}
                    title={`${ev.idJadwal} • ${ev.streamer?.namaLengkap ?? "Tanpa host"} • ${fmtTime(ev.jamMulaiLive)}–${fmtTime(ev.jamSelesaiLive)}`}
                  >
                    {fmtTime(ev.jamMulaiLive)} {ev.streamer?.namaLengkap ?? ev.idJadwal}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-slate-500 font-medium px-1">+{dayEvents.length - 3} lagi</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-400">Legend Platform:</span>
        {Object.entries(PLATFORM_COLORS).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded ${color.split(" ")[0]}`} />
            {name.replace(" Live", "").replace(" Shop", "")}
          </span>
        ))}
      </div>
    </div>
  );
}
