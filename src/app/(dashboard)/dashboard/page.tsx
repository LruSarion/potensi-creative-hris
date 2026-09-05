"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatLogEntry } from "@/lib/log-formatter";
import { fetchJson } from "@/lib/api-client";
import { StreamerProfileCardOverview } from "@/components/streamer-dashboard/streamer-profile-card-overview";
import { StreamerListView } from "@/components/streamer-dashboard/streamer-list-view";

function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Baru saja";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Baru saja";
  }
}

// Module-level cache to deduplicate /api/history across navigations
let cachedActivities: any[] | null = null;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? "Karyawan";
  const userRole = session?.user?.role ?? "";
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(userRole);

  const [dashboardView, setDashboardView] = useState<"streamer_sop" | "main">("streamer_sop");
  const [selectedStreamerId, setSelectedStreamerId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>(() => cachedActivities ?? []);
  const [loadingActivities, setLoadingActivities] = useState(() => !cachedActivities);

  const [stats, setStats] = useState<{
    totalKaryawan: number;
    jadwalHariIni: number;
    jadwalSelesai: number;
    streamerAktif: number;
    sedangLive: number;
    totalRevenueBulanIni: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    // Only fetch history if main view is active and we haven't cached it
    if (dashboardView !== "main" && isAdmin) return;
    if (cachedActivities && cachedActivities.length > 0) {
      setActivities(cachedActivities);
      setLoadingActivities(false);
      return;
    }

    async function loadRecentActivities() {
      try {
        setLoadingActivities(true);
        const data = await fetchJson<any[]>("/api/history");
        if (Array.isArray(data)) {
          const slice = data.slice(0, 5);
          cachedActivities = slice;
          setActivities(slice);
        }
      } catch {
        // ignore
      } finally {
        setLoadingActivities(false);
      }
    }
    loadRecentActivities();
  }, [dashboardView, isAdmin]);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoadingStats(true);
        const data = await fetchJson<any>("/api/dashboard/stats");
        if (data) {
          setStats(data);
        }
      } catch {
        // ignore
      } finally {
        setLoadingStats(false);
      }
    }
    if (isAdmin) loadStats();
  }, [isAdmin]);

  /** Format revenue in IDR: e.g. 1_500_000 -> "Rp 1,5Jt", 124_000_000 -> "Rp 124Jt" */
  function formatRevenue(amount: number): string {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}Jt`;
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}Rb`;
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }

  if (status === "loading") {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#941A0B]" />
          <p className="text-xs text-slate-500 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col justify-between min-h-full space-y-6">
      <div>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#000000] mb-1">Dashboard</h1>
            <p className="text-[#4D4D4D] text-sm">
              Selamat datang kembali, <span className="font-semibold text-[#000000]">{userName}</span>.
            </p>
          </div>

          {/* View Toggle Tabs — only shown for admin roles */}
          {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setDashboardView("streamer_sop");
                  setSelectedStreamerId(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  dashboardView === "streamer_sop"
                    ? "bg-[#941A0B] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-users-viewfinder text-xs" />
                <span>Daftar &amp; Profil Streamer</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardView("main")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  dashboardView === "main"
                    ? "bg-[#941A0B] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-chart-line text-xs" />
                <span>Statistik Ringkasan</span>
              </button>
            </div>
            <Link
              href="/rules"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#941A0B] bg-[#941A0B]/10 hover:bg-[#941A0B]/20 border border-[#941A0B]/20 transition flex items-center gap-1.5"
              title="Kelola Rules & Kebijakan Operasional"
            >
              <i className="fa-solid fa-gavel text-xs" />
              <span>Rules Operasional</span>
            </Link>
          </div>
          )}
        </div>

        {/* If user is not admin (e.g. Streamer role), always display their own Profil & SOP directly */}
        {!isAdmin ? (
          <div className="pt-2">
            <StreamerProfileCardOverview
              streamerId={(session?.user as any)?.karyawanId || undefined}
            />
          </div>
        ) : (
          <>
            {/* View 1: Streamer List -> Streamer Profile Card Overview (Admin view) */}
            {dashboardView === "streamer_sop" && (
              <div className="pt-2">
                {!selectedStreamerId ? (
                  <StreamerListView
                    onSelectStreamer={(id) => setSelectedStreamerId(id)}
                    currentKaryawanId={(session?.user as any)?.karyawanId}
                  />
                ) : (
                  <StreamerProfileCardOverview
                    streamerId={selectedStreamerId}
                    onBackToList={() => setSelectedStreamerId(null)}
                  />
                )}
              </div>
            )}

            {/* View 2: Main Global Dashboard Overview (Admin Stats) */}
            {dashboardView === "main" && (
              <div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <div className="bg-[#FFFFFF] p-5 rounded-xl border border-[#F1F1F1] shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-[#4D4D4D]">Total Karyawan</span>
              <i className="fa-solid fa-users text-[#941A0B] text-lg" />
            </div>
            <div className="text-3xl font-bold text-[#000000] mb-1">
              {loadingStats ? <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" /> : (stats?.totalKaryawan ?? "-")}
            </div>
            <div className="text-xs text-[#919191]">karyawan aktif</div>
          </div>

          <div className="bg-[#FFFFFF] p-5 rounded-xl border border-[#F1F1F1] shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-[#4D4D4D]">Jadwal Hari Ini</span>
              <i className="fa-regular fa-calendar-days text-[#047857] text-lg" />
            </div>
            <div className="text-3xl font-bold text-[#000000] mb-1">
              {loadingStats ? <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" /> : (stats?.jadwalHariIni ?? "-")}
            </div>
            <div className="text-xs text-[#919191]">
              {loadingStats ? "memuat..." : `${stats?.jadwalSelesai ?? 0} selesai`}
            </div>
          </div>

          {/* Streamer Aktif Card -> Clickable to switch to Streamer List/Detail */}
          <div
            onClick={() => {
              setDashboardView("streamer_sop");
              setSelectedStreamerId(null);
            }}
            className="bg-[#FFFFFF] p-5 rounded-xl border border-[#F1F1F1] hover:border-[#941A0B] shadow-sm flex flex-col cursor-pointer transition group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-[#4D4D4D] group-hover:text-[#941A0B]">Streamer Aktif</span>
              <i className="fa-solid fa-wave-square text-[#FA3737] text-lg" />
            </div>
            <div className="text-3xl font-bold text-[#000000] mb-1 group-hover:text-[#941A0B]">
              {loadingStats ? <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" /> : (stats?.streamerAktif ?? "-")}
            </div>
            <div className="text-xs text-[#919191] flex items-center justify-between">
              <span>{loadingStats ? "memuat..." : `${stats?.sedangLive ?? 0} sedang live`}</span>
              <span className="text-[#941A0B] font-bold text-[11px] group-hover:underline flex items-center gap-0.5">
                Lihat Detail <i className="fa-solid fa-chevron-right text-[9px]" />
              </span>
            </div>
          </div>

          <div className="bg-[#FFFFFF] p-5 rounded-xl border border-[#F1F1F1] shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-[#4D4D4D]">Total Revenue</span>
              <i className="fa-solid fa-arrow-trend-up text-[#941A0B] text-lg" />
            </div>
            <div className="text-3xl font-bold text-[#000000] mb-1">
              {loadingStats ? <span className="inline-block w-24 h-7 bg-slate-100 rounded animate-pulse" /> : formatRevenue(stats?.totalRevenueBulanIni ?? 0)}
            </div>
            <div className="text-xs text-[#919191]">bulan ini</div>
          </div>
        </div>

        {/* Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Aktivitas Terbaru Card */}
          <div className="lg:col-span-2 bg-[#FFFFFF] rounded-xl border border-[#F1F1F1] shadow-sm p-5 lg:p-6 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[#000000] text-base">Aktivitas Terbaru</h3>
              <Link
                href="/history-log"
                className="text-xs font-semibold text-[#941A0B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Lihat Semua</span>
                <i className="fa-solid fa-chevron-right text-[10px]" />
              </Link>
            </div>

            {loadingActivities && activities.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#919191] flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-[#941A0B]" />
                <span>Memuat aktivitas terbaru...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="space-y-6">
                <div className="flex gap-4 items-start min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#941A0B]/10 flex flex-shrink-0 items-center justify-center text-[#941A0B] mt-0.5">
                    <i className="fa-solid fa-bolt text-sm" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline gap-2">
                      <h4 className="font-semibold text-[#000000] text-sm truncate">Jadwal Live Selesai</h4>
                      <span className="text-xs text-[#919191] shrink-0 font-mono">10 mnt lalu</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4D4D4D] mt-0.5 truncate block w-full">
                      Streamer A menyelesaikan sesi di Studio 1
                    </p>
                  </div>
                </div>

                <hr className="border-[#F1F1F1]" />

                <div className="flex gap-4 items-start min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#941A0B]/10 flex flex-shrink-0 items-center justify-center text-[#941A0B] mt-0.5">
                    <i className="fa-solid fa-bolt text-sm" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline gap-2">
                      <h4 className="font-semibold text-[#000000] text-sm truncate">Jadwal Live Selesai</h4>
                      <span className="text-xs text-[#919191] shrink-0 font-mono">10 mnt lalu</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4D4D4D] mt-0.5 truncate block w-full">
                      Streamer B menyelesaikan sesi di Studio 2
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {activities.map((item, idx) => {
                  const formatted = formatLogEntry(item);
                  const timeAgo = formatRelativeTime(item.createdAt);

                  return (
                    <div key={item.id ?? idx}>
                      <div className="flex gap-4 items-start min-w-0 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-[#941A0B]/10 flex flex-shrink-0 items-center justify-center text-[#941A0B] mt-0.5">
                          <i className={`${formatted.icon ?? "fa-solid fa-bolt"} text-sm`} />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex justify-between items-baseline gap-2">
                            <h4
                              className="font-semibold text-[#000000] text-xs sm:text-sm truncate"
                              title={formatted.title}
                            >
                              {formatted.title}
                            </h4>
                            <span className="text-[11px] sm:text-xs text-[#919191] shrink-0 font-mono whitespace-nowrap">
                              {timeAgo}
                            </span>
                          </div>
                          <p
                            className="text-xs sm:text-sm text-[#4D4D4D] mt-0.5 truncate block w-full"
                            title={formatted.description}
                          >
                            {formatted.description}
                          </p>
                        </div>
                      </div>
                      {idx < activities.length - 1 && <hr className="border-[#F1F1F1] mt-5" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="bg-[#FFFFFF] rounded-xl border border-[#F1F1F1] shadow-sm p-5 lg:p-6 min-w-0">
            <h3 className="font-bold text-[#000000] mb-6 text-base">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href="/input-karyawan"
                className="w-full flex flex-col items-start p-4 border border-[#F1F1F1] bg-white rounded-lg hover:border-[#941A0B] hover:bg-[#941A0B]/5 transition text-left group"
              >
                <span className="font-medium text-[#000000] text-sm group-hover:text-[#941A0B]">Tambah Karyawan</span>
                <span className="text-xs text-[#4D4D4D] mt-1">Input data karyawan baru ke sistem</span>
              </Link>
              <Link
                href="/input-jadwal"
                className="w-full flex flex-col items-start p-4 border border-[#F1F1F1] bg-white rounded-lg hover:border-[#941A0B] hover:bg-[#941A0B]/5 transition text-left group"
              >
                <span className="font-medium text-[#000000] text-sm group-hover:text-[#941A0B]">Buat Jadwal</span>
                <span className="text-xs text-[#4D4D4D] mt-1">Atur jadwal live streaming baru</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )}
      </div>

      <div className="mt-8 text-center pb-4">
        <p className="text-xs text-[#919191]">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
      </div>
    </div>
  );
}

