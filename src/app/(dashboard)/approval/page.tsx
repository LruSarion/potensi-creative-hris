"use client";

import { useEffect, useState } from "react";

export default function ApprovalPage() {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/approval");
      const d = await r.json();
      if (d.status === "success") setList(d.data);
      else setError(d.message ?? "Gagal memuat daftar approval");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: "approve" | "reject") {
    setError("");
    setSuccess("");
    try {
      const r = await fetch(`/api/approval?id=${id}&action=${action}`, { method: "PATCH" });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(`Pengajuan berhasil di-${action === "approve" ? "setujui" : "tolak"}!`);
        load();
      } else {
        setError(d.message ?? "Gagal memproses approval");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Persetujuan (Approval Center)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Persetujuan plotting jadwal, perubahan shift mendadak, dan permintaan operasional.
          </p>
        </div>
        <button
          onClick={load}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <i className="fa-solid fa-arrows-rotate" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Approval Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Daftar Pengajuan Menunggu Persetujuan ({list.length})</h3>
          <span className="text-xs text-slate-500 font-medium">Status: PENDING</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID Jadwal</th>
                <th className="px-4 py-3">Tanggal Siaran</th>
                <th className="px-4 py-3">Streamer / Host</th>
                <th className="px-4 py-3">Brand & Platform</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{j.idJadwal}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {new Date(j.tanggal).toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">
                      {j.streamerKaryawan?.namaLengkap ?? "Belum Ditentukan"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {j.streamerKaryawan?.idKaryawan ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{j.client?.namaClient ?? "General"}</div>
                    <span className="text-[10px] text-slate-500">{j.platform ?? "Shopee"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      PENDING
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => act(j.id, "approve")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                    >
                      Setujui (Approve)
                    </button>
                    <button
                      onClick={() => act(j.id, "reject")}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                    >
                      Tolak
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-circle-check text-2xl text-emerald-400 mb-2 block" />
              Semua pengajuan telah diproses. Tidak ada antrean pending.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
