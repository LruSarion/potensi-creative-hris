"use client";

import { useEffect, useState } from "react";

export default function HistoryLogPage() {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const d = await res.json();
      if (d.status === "success") setList(d.data);
      else setError(d.message ?? "Akses ditolak");
    } catch {
      setError("Koneksi error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail & History Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catatan kronologis aktivitas pengguna, perubahan status sesi live, approval, dan audit keamanan.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <i className="fa-solid fa-arrows-rotate" />
          <span>Refresh Log</span>
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Log Aktivitas Sistem ({list.length})</h3>
          <span className="text-xs text-slate-500">Immutable Audit Trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Waktu (WIB)</th>
                <th className="px-4 py-3">User Pelaksana</th>
                <th className="px-4 py-3">Aksi / Event</th>
                <th className="px-4 py-3">Rincian Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {list.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                    {new Date(l.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 font-sans font-semibold text-slate-800">
                    {l.user?.email ?? "System"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {l.aksi}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-sans text-xs max-w-md truncate">
                    {l.detail ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada riwayat log audit tercatat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
