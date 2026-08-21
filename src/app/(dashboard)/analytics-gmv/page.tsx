"use client";

import { useEffect, useState } from "react";

type GmvData = {
  totalGmv: number;
  totalSessions: number;
  byClient: { namaClient: string; totalGmv: number; sessions: number }[];
  byPlatform: { platform: string; totalGmv: number; sessions: number }[];
  byStreamer: { namaLengkap: string; idKaryawan: string; totalGmv: number; sessions: number }[];
};

function fmtCur(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${names[parseInt(m)]} ${y}`;
}

const PLATFORM_COLORS: Record<string, string> = {
  "Shopee Live": "bg-orange-100 text-orange-700 border-orange-200",
  "TikTok Shop": "bg-slate-900 text-white border-slate-700",
  "Tokopedia Live": "bg-green-100 text-green-700 border-green-200",
  "Lazada Live": "bg-blue-100 text-blue-700 border-blue-200",
};

function ProgressBar({ pct, color = "bg-blue-500" }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

const now = new Date();
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

export default function AnalyticsGmvPage() {
  const [data, setData] = useState<GmvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periode, setPeriode] = useState(months[0]);
  const [activeTab, setActiveTab] = useState<"client" | "platform" | "streamer">("client");

  useEffect(() => { load(); }, [periode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/analytics?view=gmv&periode=${encodeURIComponent(periode)}`).then((x) => x.json());
      if (r.status === "success") setData(r.data);
      else setError(r.message ?? "Gagal memuat data GMV");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  const maxClient = data?.byClient[0]?.totalGmv ?? 1;
  const maxPlatform = data?.byPlatform[0]?.totalGmv ?? 1;
  const maxStreamer = data?.byStreamer[0]?.totalGmv ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-emerald-600" />
            Analytics GMV Bulanan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Akumulasi Gross Merchandise Value per klien, platform, dan streamer.</p>
        </div>
        <select
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        >
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-500" /> {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-chart-line" /> Total GMV
          </div>
          <div className="text-2xl font-black text-emerald-800">
            {loading ? "—" : fmtCur(data?.totalGmv ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{monthLabel(periode)}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-video" /> Sesi Checkout
          </div>
          <div className="text-2xl font-black text-blue-800">{loading ? "—" : data?.totalSessions ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">dengan laporan GMV</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-trophy" /> GMV per Sesi
          </div>
          <div className="text-2xl font-black text-amber-800">
            {loading || !data || data.totalSessions === 0 ? "—" : fmtCur(Math.round(data.totalGmv / data.totalSessions))}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">rata-rata per sesi</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "client", label: "Per Brand Klien", icon: "fa-building" },
          { key: "platform", label: "Per Platform", icon: "fa-store" },
          { key: "streamer", label: "Per Streamer (Top 20)", icon: "fa-users" },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition whitespace-nowrap ${activeTab === t.key ? "text-emerald-600 border-emerald-600 bg-white shadow-sm" : "text-slate-500 border-transparent hover:text-slate-700"}`}>
            <i className={`fa-solid ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <i className="fa-solid fa-spinner animate-spin text-emerald-500" /> Memuat data GMV...
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* By Client */}
          {activeTab === "client" && (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-building text-blue-500" /> GMV per Brand Klien
                </h3>
              </div>
              {!data?.byClient.length ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  <i className="fa-solid fa-chart-bar text-2xl text-slate-200 block mb-2" />
                  Tidak ada data GMV pada {monthLabel(periode)}.
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.byClient.map((c, idx) => (
                    <div key={c.namaClient} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                          <span className="text-sm font-bold text-slate-800 truncate">{c.namaClient}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{c.sessions} sesi</span>
                        </div>
                        <span className="text-sm font-black text-emerald-700 shrink-0">{fmtCur(c.totalGmv)}</span>
                      </div>
                      <ProgressBar pct={(c.totalGmv / maxClient) * 100} color="bg-emerald-500" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* By Platform */}
          {activeTab === "platform" && (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-store text-orange-500" /> GMV per Platform Marketplace
                </h3>
              </div>
              {!data?.byPlatform.length ? (
                <div className="p-10 text-center text-xs text-slate-400">Tidak ada data.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.byPlatform.map((p, idx) => (
                    <div key={p.platform} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${PLATFORM_COLORS[p.platform] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {p.platform}
                          </span>
                          <span className="text-[10px] text-slate-400">{p.sessions} sesi</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{fmtCur(p.totalGmv)}</span>
                      </div>
                      <ProgressBar pct={(p.totalGmv / maxPlatform) * 100} color="bg-orange-400" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* By Streamer */}
          {activeTab === "streamer" && (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-users text-indigo-500" /> Top 20 Streamer by GMV
                </h3>
              </div>
              {!data?.byStreamer.length ? (
                <div className="p-10 text-center text-xs text-slate-400">Tidak ada data.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.byStreamer.map((s, idx) => (
                    <div key={s.idKaryawan} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-200 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-400"}`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{s.namaLengkap}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{s.idKaryawan} • {s.sessions} sesi</div>
                          </div>
                        </div>
                        <span className="text-sm font-black text-emerald-700 shrink-0">{fmtCur(s.totalGmv)}</span>
                      </div>
                      <ProgressBar pct={(s.totalGmv / maxStreamer) * 100} color="bg-indigo-500" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
