"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  createdAt: string;
  title: string;
  message: string | null;
  link: string | null;
};

/**
 * Client notification bell. Polls /api/integration?view=notifications for the
 * current user's inbox (LogAktivitas NOTIFICATION rows targeted at them).
 */
export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/integration?view=notifications");
      const d = await r.json();
      if (d.status === "success") setItems(d.data ?? []);
      else setError(true);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // light polling
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition"
        aria-label="Notifikasi"
      >
        <i className="fa-solid fa-bell" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg z-20">
          <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 text-sm border-b border-slate-100">
            Notifikasi ({items.length})
          </div>
          {error && <p className="p-4 text-sm text-slate-400">Tidak dapat memuat notifikasi.</p>}
          {!error && items.length === 0 && <p className="p-4 text-sm text-slate-400">Tidak ada notifikasi.</p>}
          {items.map((n) => (
            <a
              key={n.id}
              href={n.link ?? undefined}
              className={`block px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${n.link ? "" : "cursor-default"}`}
            >
              <div className="text-sm font-medium text-slate-800">{n.title}</div>
              {n.message && <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>}
              <div className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString("id-ID")}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}