"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlert } from "@/components/ui/custom-alert";

export type Notification = {
  id: string;
  createdAt: string;
  title: string;
  message: string | null;
  link: string | null;
  type?: string;
  isRead?: boolean;
  readAt?: string | null;
};

function formatTimeAgo(dateStr: string) {
  try {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 172800) return "Kemarin";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function getIconAndColor(type?: string, title?: string) {
  const t = (type || "").toUpperCase();
  const text = (title || "").toLowerCase();

  if (t.includes("APPROVAL") || text.includes("izin") || text.includes("cuti") || text.includes("disetujui")) {
    return {
      icon: "fa-solid fa-file-circle-check",
      bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
    };
  }
  if (t.includes("PAYROLL") || text.includes("gaji") || text.includes("insentif") || text.includes("slip")) {
    return {
      icon: "fa-solid fa-money-bill-wave",
      bg: "bg-green-50 text-green-600 border-green-100",
    };
  }
  if (t.includes("QC") || text.includes("pelanggaran") || text.includes("penalti") || text.includes("audit")) {
    return {
      icon: "fa-solid fa-triangle-exclamation",
      bg: "bg-amber-50 text-amber-600 border-amber-100",
    };
  }
  if (t.includes("JADWAL") || text.includes("live") || text.includes("shift") || text.includes("sesi")) {
    return {
      icon: "fa-solid fa-calendar-day",
      bg: "bg-purple-50 text-purple-600 border-purple-100",
    };
  }
  return {
    icon: "fa-solid fa-bell",
    bg: "bg-blue-50 text-blue-600 border-blue-100",
  };
}

export default function NotificationBell() {
  const pathname = usePathname();
  const { showConfirm } = useAlert();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/integration?view=notifications", { cache: "no-store" });
      const d = await r.json();
      if (d.status === "success") {
        setItems(d.data ?? []);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  // Event-driven reactive updates (Page transitions & Window focus) - NO setInterval polling
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const handleFocus = () => load();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") load();
    };
    const handleCustomEvent = () => load();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("app:notification-updated", handleCustomEvent);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("app:notification-updated", handleCustomEvent);
    };
  }, [load]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Actions
  async function markAsRead(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isRead: true, readAt: new Date().toISOString() } : it))
    );
    try {
      await fetch("/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
    } catch {
      load();
    }
  }

  async function markAllAsRead() {
    // Optimistic update
    setItems((prev) =>
      prev.map((it) => ({ ...it, isRead: true, readAt: new Date().toISOString() }))
    );
    try {
      await fetch("/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } catch {
      load();
    }
  }

  async function deleteNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // Optimistic update
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await fetch("/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
    } catch {
      load();
    }
  }

  async function clearAll() {
    const confirmed = await showConfirm("Hapus semua notifikasi dari kotak masuk Anda?");
    if (!confirmed) return;
    setItems([]);
    try {
      await fetch("/api/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearAll" }),
      });
    } catch {
      load();
    }
  }

  async function sendTestNotification() {
    setLoading(true);
    try {
      await fetch("/api/notifications/test?type=bell");
      await load();
    } finally {
      setLoading(false);
    }
  }

  const unreadCount = items.filter((i) => !i.isRead).length;
  const filteredItems = filter === "unread" ? items.filter((i) => !i.isRead) : items;

  return (
    <div className="relative select-none" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
          open
            ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
        aria-label="Notifikasi"
        title="Kotak Masuk Notifikasi"
      >
        <i className="fa-solid fa-bell text-base" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div className="absolute right-0 mt-2.5 w-84 sm:w-96 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition cursor-pointer flex items-center gap-1"
                    title="Tandai Semua Sudah Dibaca"
                  >
                    <i className="fa-solid fa-check-double text-[10px]" />
                    <span>Baca Semua</span>
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] text-slate-400 hover:text-red-600 font-medium p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                    title="Hapus Semua Notifikasi"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === "all"
                    ? "bg-white text-slate-800 shadow-2xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === "unread"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {error && (
              <div className="p-6 text-center text-xs text-red-500">
                <i className="fa-solid fa-circle-exclamation text-xl mb-1 block" />
                Gagal memuat notifikasi.
              </div>
            )}

            {!error && filteredItems.length === 0 && (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  <i className="fa-regular fa-bell-slash" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    {filter === "unread" ? "Tidak ada notifikasi baru" : "Kotak notifikasi kosong"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {filter === "unread"
                      ? "Semua notifikasi Anda sudah ditandai sebagai dibaca."
                      : "Pemberitahuan persetujuan, jadwal, atau gaji akan muncul di sini."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={sendTestNotification}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane text-[10px]" />
                  <span>{loading ? "Mengirim..." : "Kirim Notifikasi Uji Coba"}</span>
                </button>
              </div>
            )}

            {!error &&
              filteredItems.map((n) => {
                const style = getIconAndColor(n.type, n.title);
                const isUnread = !n.isRead;

                const ItemWrapper = n.link ? Link : "div";

                return (
                  <div
                    key={n.id}
                    className={`group relative p-3.5 transition flex items-start gap-3 ${
                      isUnread ? "bg-blue-50/40 hover:bg-blue-50/70" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-sm shadow-2xs ${style.bg}`}
                    >
                      <i className={style.icon} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <ItemWrapper
                        href={n.link || "#"}
                        onClick={() => {
                          if (isUnread) markAsRead(n.id);
                          if (n.link) setOpen(false);
                        }}
                        className={`block ${n.link ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <h4
                            className={`text-xs leading-snug truncate ${
                              isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                            }`}
                          >
                            {n.title}
                          </h4>
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                          )}
                        </div>

                        {n.message && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                          <span>{formatTimeAgo(n.createdAt)}</span>
                          {n.link && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 hover:underline">Lihat Detail →</span>
                            </>
                          )}
                        </div>
                      </ItemWrapper>
                    </div>

                    {/* Quick Item Actions (Hover / Right) */}
                    <div className="absolute right-2.5 top-3 flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition">
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={(e) => markAsRead(n.id, e)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center text-[10px] transition cursor-pointer shadow-2xs"
                          title="Tandai Sudah Dibaca"
                        >
                          <i className="fa-solid fa-check" />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => deleteNotif(n.id, e)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 flex items-center justify-center text-[10px] transition cursor-pointer shadow-2xs"
                        title="Hapus Notifikasi"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-2.5 bg-slate-50/90 border-t border-slate-100 text-center flex items-center justify-between px-4">
              <span className="text-[10px] text-slate-400 font-medium">
                Pembaruan instan & sinkron
              </span>
              <button
                type="button"
                onClick={load}
                className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate text-[10px]" />
                <span>Segarkan</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}