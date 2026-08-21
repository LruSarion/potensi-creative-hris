"use client";

import { useEffect, useState } from "react";

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/marketplace?view=pipeline");
      const d = await r.json();
      if (d.status === "success") setPipeline(d.data);
      else setError(d.message ?? "Gagal memuat pipeline");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Marketplace Pipeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Pantau seluruh alur proyek klien: listing, lamaran streamer, dan status jadwal terkait.
        </p>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Memuat pipeline...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Proyek / Listing</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Jadwal Terkait</th>
                <th className="px-4 py-3">Pelamar (Streamer)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipeline.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{l.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{l.platform ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {l.client?.namaClient ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {l.jadwal ? (
                      <div>
                        <div className="font-mono text-blue-600">{l.jadwal.idJadwal}</div>
                        <span className={`text-[10px] font-bold ${l.jadwal.hasHost ? "text-emerald-600" : "text-amber-600"}`}>
                          {l.jadwal.hasHost ? "✓ Host assigned" : "Belum ada host"} • {l.jadwal.status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Tanpa jadwal</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(l.applications ?? []).length > 0 ? (
                        l.applications.map((a: any) => (
                          <span
                            key={a.id}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              a.status === "PICKED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : a.status === "DECLINED"
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {a.streamer?.namaLengkap ?? "?"} ({a.status})
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">Belum ada pelamar</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        l.status === "OPEN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : l.status === "FILLED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pipeline.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              Belum ada proyek dalam pipeline.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
