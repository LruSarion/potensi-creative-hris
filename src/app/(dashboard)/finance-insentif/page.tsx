"use client";

import { useEffect, useState } from "react";

type IncidentItem = {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  fineApplied: number | null;
  proofDriveId: string | null;
  streamer: { namaLengkap: string; idKaryawan: string } | null;
  reportedBy: { name: string } | null;
  category: { name: string } | null;
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function FinanceInsentifPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodeFilter, setPeriodeFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    loadData();
  }, [periodeFilter]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/incidents?status=RESOLVED`).then((r) => r.json());
      if (res.status === "success") {
        // Filter by month from periodeFilter (YYYY-MM)
        const filtered = res.data.filter((i: any) => {
          const d = new Date(i.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return ym === periodeFilter;
        });
        setIncidents(filtered);
      } else {
        setError(res.message ?? "Gagal memuat data");
      }
    } catch {
      setError("Koneksi gagal saat memuat data rekap");
    } finally {
      setLoading(false);
    }
  }

  const totalDenda = incidents.reduce((s, i) => s + (i.fineApplied ?? 0), 0);
  const totalKasus = incidents.length;
  const kasusPerStreamer = incidents.reduce<Record<string, { nama: string; idKaryawan: string; count: number; total: number }>>((acc, i) => {
    const key = i.streamer?.namaLengkap ?? "Tidak diketahui";
    if (!acc[key]) {
      acc[key] = { nama: key, idKaryawan: i.streamer?.idKaryawan ?? "—", count: 0, total: 0 };
    }
    acc[key].count += 1;
    acc[key].total += i.fineApplied ?? 0;
    return acc;
  }, {});

  const months = [
    "2026-08", "2026-07", "2026-06", "2026-05", "2026-04",
    "2026-03", "2026-02", "2026-01",
  ];

  function monthLabel(ym: string) {
    const [y, m] = ym.split("-");
    const names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${names[parseInt(m)]} ${y}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-receipt text-indigo-600" />
            Rekap Denda & Insentif Pelanggaran
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ringkasan potongan denda yang sudah disetujui SPV untuk keperluan pencairan payroll Finance.
          </p>
        </div>
        <div>
          <select
            value={periodeFilter}
            onChange={(e) => setPeriodeFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-500" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-gavel" /> Total Potongan Denda
          </div>
          <div className="text-2xl font-black text-rose-700">
            Rp {totalDenda.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{monthLabel(periodeFilter)}</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-triangle-exclamation" /> Total Kasus Pelanggaran
          </div>
          <div className="text-2xl font-black text-amber-700">{totalKasus}</div>
          <div className="text-[10px] text-slate-500 mt-1">Status: RESOLVED (Disetujui SPV)</div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <i className="fa-solid fa-users" /> Streamer Terdampak
          </div>
          <div className="text-2xl font-black text-indigo-700">{Object.keys(kasusPerStreamer).length}</div>
          <div className="text-[10px] text-slate-500 mt-1">Orang memiliki catatan pelanggaran</div>
        </div>
      </div>

      {/* Per-Streamer Summary */}
      {Object.keys(kasusPerStreamer).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-chart-bar text-indigo-500" />
              Rekap Per Streamer
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Digunakan sebagai dasar perhitungan potongan payroll</p>
          </div>
          <div className="divide-y divide-slate-50">
            {Object.values(kasusPerStreamer)
              .sort((a, b) => b.total - a.total)
              .map((s) => (
                <div key={s.nama} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{s.nama}</div>
                    <div className="text-[10px] text-slate-400">ID: {s.idKaryawan} • {s.count} Pelanggaran</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-red-600">− Rp {s.total.toLocaleString("id-ID")}</div>
                    <div className="text-[10px] text-slate-400">Total denda bulan ini</div>
                  </div>
                </div>
              ))}
          </div>
          <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex justify-between items-center">
            <span className="text-xs text-red-700 font-bold">Total Semua Potongan</span>
            <span className="text-sm font-black text-red-700">− Rp {totalDenda.toLocaleString("id-ID")}</span>
          </div>
        </div>
      )}

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-list-check text-slate-500" />
            Detail Semua Kasus Pelanggaran
          </h3>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
            {incidents.length} Kasus
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Streamer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Kasus / Judul</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Tingkat</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider">Denda</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500 uppercase tracking-wider">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Memuat data...</td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada pelanggaran yang sudah disetujui pada {monthLabel(periodeFilter)}.
                  </td>
                </tr>
              ) : (
                incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{i.streamer?.namaLengkap ?? "—"}</div>
                      <div className="text-[10px] text-slate-400">{i.streamer?.idKaryawan ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{i.title}</td>
                    <td className="px-4 py-3">
                      {i.category ? (
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                          {i.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SEVERITY_STYLE[i.severity]}`}>
                        {i.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(i.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.fineApplied ? (
                        <span className="font-bold text-red-600">− Rp {i.fineApplied.toLocaleString("id-ID")}</span>
                      ) : (
                        <span className="text-slate-400 italic">Tanpa denda</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {i.proofDriveId ? (
                        <a
                          href={i.proofDriveId}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-[10px] font-medium"
                        >
                          Lihat Bukti
                        </a>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
