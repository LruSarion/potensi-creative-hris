"use client";

import { useEffect, useState } from "react";
import { StreamerProfileCardOverview } from "@/components/streamer-dashboard/streamer-profile-card-overview";

export default function StreamerDirectoryPage() {
  const [streamers, setStreamers] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedStreamerId, setSelectedStreamerId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/streamer-directory").then((r) => r.json()),
        fetch("/api/marketplace?view=certifications").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
      ]);
      if (sRes.status === "success") setStreamers(sRes.data);
      else setError(sRes.message ?? "Gagal memuat directory");
      if (cRes.status === "success") setCerts(cRes.data);
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  const filtered = streamers.filter(
    (s) =>
      !filter ||
      s.namaLengkap?.toLowerCase().includes(filter.toLowerCase()) ||
      s.idKaryawan?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Direktori Streamer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Seluruh streamer, status sertifikasi brand, dan statistik performa untuk HR & manajemen.
          </p>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cari nama / ID..."
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Memuat...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Sesi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sertifikasi Brand</th>
                <th className="px-4 py-3 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{s.namaLengkap}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{s.idKaryawan}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-amber-500">★ {Number(s.rating).toFixed(1)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.totalSessions}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        s.statusAktif === "AKTIF"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {s.statusAktif}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.certifiedFor?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {s.certifiedFor.map((c: any, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            {c.clientName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">Belum bersertifikasi</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedStreamerId(s.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#941A0B] border border-red-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto"
                    >
                      <i className="fa-solid fa-id-card text-xs" />
                      <span>Detail</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">Tidak ada streamer ditemukan.</div>
          )}
        </div>
      )}

      {/* Streamer Detail Modal */}
      {selectedStreamerId && (
        <StreamerProfileCardOverview
          streamerId={selectedStreamerId}
          isModal={true}
          onClose={() => setSelectedStreamerId(null)}
        />
      )}

      {/* Certifications overview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">Sertifikasi Brand Terbit ({certs.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {certs.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-800">
                  {c.streamer?.namaLengkap} <span className="text-slate-400 font-normal">({c.streamer?.idKaryawan})</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {c.course?.title} • {c.client?.namaClient}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  c.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {c.active ? "AKTIF" : "KADALUARSA"}
              </span>
            </div>
          ))}
          {certs.length === 0 && <div className="p-6 text-center text-slate-400 text-xs">Belum ada sertifikasi terbit.</div>}
        </div>
      </div>
    </div>
  );
}
