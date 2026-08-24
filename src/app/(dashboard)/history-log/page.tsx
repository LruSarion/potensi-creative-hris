"use client";

import { useEffect, useState } from "react";
import { formatLogEntry } from "@/lib/log-formatter";

// Badge color map for action types
function getActionBadge(aksi: string) {
  const a = (aksi || "").toUpperCase();
  if (a.includes("LOGIN") || a.includes("READ") || a.includes("VIEW")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (a.includes("CREATE") || a.includes("TAMBAH") || a.includes("ADD") || a.includes("INSERT")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (a.includes("UPDATE") || a.includes("EDIT") || a.includes("UBAH") || a.includes("APPROVE") || a.includes("REJECT")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (a.includes("DELETE") || a.includes("HAPUS") || a.includes("REMOVE")) return "bg-red-50 text-red-700 border-red-200";
  if (a.includes("CHECKOUT") || a.includes("CHECK") || a.includes("ABSEN")) return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function HistoryLogPage() {
  const [list, setList] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFiltered(list);
      return;
    }
    setFiltered(
      list.filter(
        (l) =>
          (l.user?.email ?? "").toLowerCase().includes(q) ||
          (l.user?.name ?? "").toLowerCase().includes(q) ||
          (l.aksi ?? "").toLowerCase().includes(q) ||
          (l.targetSheet ?? "").toLowerCase().includes(q) ||
          (l.detail ?? "").toLowerCase().includes(q)
      )
    );
  }, [search, list]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const d = await res.json();
      if (d.status === "success") {
        setList(d.data);
        setFiltered(d.data);
      } else {
        setError(d.message ?? "Akses ditolak");
      }
    } catch {
      setError("Koneksi error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/history-log.html */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System History Log</h1>
          <p className="text-slate-500 text-sm mt-1">
            Rekam jejak aktivitas <em>(Audit Trail)</em> seluruh pengguna di dalam sistem.
          </p>
        </div>

        <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 w-full md:w-80 focus-within:ring-2 focus-within:ring-blue-500 transition shadow-sm">
          <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-sm"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, ID, aksi, atau target..."
            className="border-none bg-transparent focus:ring-0 outline-none text-sm w-full text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-[500px] overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="text-sm font-bold text-slate-700 flex items-center">
            <i className="fa-solid fa-shield-halved text-emerald-600 mr-2"></i>
            <span>Data Bersifat Read-Only (Hanya Baca)</span>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`}></i>
            <span>Refresh Data</span>
          </button>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">WAKTU (TIMESTAMP)</th>
                <th className="px-6 py-4 font-medium">USER / PELAKU</th>
                <th className="px-6 py-4 font-medium">TIPE AKSI</th>
                <th className="px-6 py-4 font-medium">TARGET DATA / SHEET</th>
                <th className="px-6 py-4 font-medium w-full">DETAIL PERUBAHAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 italic">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Memuat rekam jejak...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">
                    {search ? "Tidak ada hasil log yang cocok." : "Belum ada riwayat aktivitas yang tercatat."}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const aksiRaw = (item.aksi ?? "LOG").toUpperCase();
                  const target = item.targetSheet ?? item.target ?? "-";
                  const detail = item.detail ?? item.keterangan ?? "-";
                  const userName = item.user?.name || item.user?.email || "System";
                  const userSub = item.user?.role || (item.user?.email !== item.user?.name ? item.user?.email : "");

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition table-row-hover">
                      <td className="px-6 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                      <td className="px-6 py-3 leading-tight">
                        <span className="font-medium text-slate-800 text-xs block">{userName}</span>
                        {userSub && <span className="text-slate-400 text-[11px]">{userSub}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wide border ${getActionBadge(
                            aksiRaw
                          )}`}
                        >
                          {aksiRaw}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                        {target}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs max-w-lg truncate" title={detail}>
                        {detail}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
