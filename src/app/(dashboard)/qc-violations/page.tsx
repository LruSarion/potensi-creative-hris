"use client";

import { useEffect, useState } from "react";
import QcLiveMonitor from "@/components/qc-live-monitor";

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
  const [activeTab, setActiveTab] = useState<"input" | "history">("input");

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <i className="fa-solid fa-shield-halved text-[#941A0B]" />
            Pelanggaran QC Live Streaming
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Form input laporan pelanggaran dari QC Reviewer dan rekap pemantauan kepatuhan SOP live agency.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "input"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-pen-to-square text-[#941A0B]" />
            <span>Input Log Pelanggaran</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              load();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-table-list text-blue-600" />
            <span>Semua Riwayat ({violations.length})</span>
          </button>
        </div>
      </div>

      {activeTab === "input" ? (
        <QcLiveMonitor />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Cari streamer / kategori..."
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white w-full max-w-xs"
            />
            <button onClick={load} className="text-xs text-[#941A0B] hover:underline font-semibold flex items-center gap-1">
              <i className="fa-solid fa-arrows-rotate" />
              Refresh
            </button>
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
                    ) : v.videoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <video src={v.videoUrl} controls className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
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
  )}
</div>
  );
}
