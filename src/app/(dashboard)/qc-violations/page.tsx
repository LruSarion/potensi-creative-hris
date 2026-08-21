"use client";

import { useEffect, useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  GROOMING: "bg-pink-100 text-pink-700",
  ATTITUDE: "bg-orange-100 text-orange-700",
  LANGUAGE: "bg-red-100 text-red-700",
  DRESS_CODE: "bg-purple-100 text-purple-700",
  PRODUCT_HANDLING: "bg-amber-100 text-amber-700",
  PLATFORM_RULE: "bg-blue-100 text-blue-700",
  TECHNICAL: "bg-slate-100 text-slate-600",
  OTHER: "bg-gray-100 text-gray-600",
};

export default function QcViolationsPage() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/qc-violation");
      const d = await r.json();
      if (d.status === "success") setViolations(d.data ?? []);
      else setError(d.message ?? "Gagal memuat pelanggaran");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  const filtered = violations.filter(
    (v) =>
      !filter ||
      v.streamer?.namaLengkap?.toLowerCase().includes(filter.toLowerCase()) ||
      v.category?.toLowerCase().includes(filter.toLowerCase()) ||
      v.severity?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pelanggaran QC Live Streaming</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Laporan pelanggaran dari QC Reviewer — dipantau oleh Super Admin & Trainer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari streamer / kategori..."
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button onClick={load} className="text-xs text-blue-600 hover:underline font-semibold">
            <i className="fa-solid fa-arrows-rotate mr-1" />Refresh
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>}

      {loading ? (
        <p className="text-xs text-slate-500">Memuat pelanggaran...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Bukti</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 font-bold text-slate-800">{v.streamer?.namaLengkap ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${CATEGORY_COLORS[v.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {v.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      v.severity === "CRITICAL" || v.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {v.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.photoUrl} alt="Bukti" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{v.description || "-"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(v.createdAt).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-shield-halved text-3xl text-slate-300 block mb-2" />
              Belum ada pelanggaran tercatat.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
