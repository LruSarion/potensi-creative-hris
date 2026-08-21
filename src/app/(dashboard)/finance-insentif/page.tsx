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
  reportedBy: { name: string; email: string } | null;
  category: { name: string } | null;
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const INSENTIF_PER_SEVERITY: Record<string, number> = {
  CRITICAL: 50000,
  HIGH: 30000,
  MEDIUM: 15000,
  LOW: 5000,
};

function fmtCur(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${names[parseInt(m)]} ${y}`;
}

const months = ["2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"];

export default function FinanceInsentifPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodeFilter, setPeriodeFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [activeTab, setActiveTab] = useState<"denda" | "reporter">("denda");

  useEffect(() => { loadData(); }, [periodeFilter]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/incidents?status=RESOLVED`).then((r) => r.json());
      if (res.status === "success") {
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

  // Rekap pelanggaran per streamer
  const kasusPerStreamer = incidents.reduce<Record<string, { nama: string; idKaryawan: string; count: number; total: number }>>((acc, i) => {
    const key = i.streamer?.namaLengkap ?? "Tidak diketahui";
    if (!acc[key]) acc[key] = { nama: key, idKaryawan: i.streamer?.idKaryawan ?? "—", count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += i.fineApplied ?? 0;
    return acc;
  }, {});

  // Rekap insentif per pelapor (reporter)
  const insentifPerReporter = incidents.reduce<Record<string, { nama: string; email: string; kasusCount: number; totalInsentif: number; breakdown: { severity: string; count: number }[] }>>((acc, i) => {
    const key = i.reportedBy?.name ?? i.reportedBy?.email ?? "Sistem";
    const insentif = INSENTIF_PER_SEVERITY[i.severity] ?? 0;
    if (!acc[key]) acc[key] = { nama: key, email: i.reportedBy?.email ?? "", kasusCount: 0, totalInsentif: 0, breakdown: [] };
    acc[key].kasusCount += 1;
    acc[key].totalInsentif += insentif;
    const sev = acc[key].breakdown.find((b) => b.severity === i.severity);
    if (sev) sev.count += 1;
    else acc[key].breakdown.push({ severity: i.severity, count: 1 });
    return acc;
  }, {});

  const totalInsentifReporter = Object.values(insentifPerReporter).reduce((s, r) => s + r.totalInsentif, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-receipt text-indigo-600" />
            Rekap Denda, Insentif & Pelapor
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ringkasan pelanggaran yang disetujui SPV, potongan payroll, dan insentif pelapor QC.
          </p>
        </div>
        <select
          value={periodeFilter}
          onChange={(e) => setPeriodeFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Denda Dipotong", value: fmtCur(totalDenda), icon: "fa-gavel", color: "from-rose-50 to-red-50 border-rose-200 text-rose-700" },
          { label: "Total Kasus", value: totalKasus, icon: "fa-triangle-exclamation", color: "from-amber-50 to-orange-50 border-amber-200 text-amber-700" },
          { label: "Streamer Terdampak", value: Object.keys(kasusPerStreamer).length, icon: "fa-users", color: "from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700" },
          { label: "Total Insentif Pelapor", value: fmtCur(totalInsentifReporter), icon: "fa-star", color: "from-emerald-50 to-green-50 border-emerald-200 text-emerald-700" },
        ].map((m) => (
          <div key={m.label} className={`bg-gradient-to-br ${m.color} border rounded-2xl p-4 shadow-sm`}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2">
              <i className={`fa-solid ${m.icon}`} /> {m.label}
            </div>
            <div className="text-xl font-black">{m.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{monthLabel(periodeFilter)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "denda", label: "Rekap Denda per Streamer", icon: "fa-gavel" },
          { key: "reporter", label: `Insentif Pelapor (${Object.keys(insentifPerReporter).length} Staff)`, icon: "fa-star" },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition ${activeTab === t.key ? "text-indigo-600 border-indigo-600 bg-white shadow-sm" : "text-slate-500 border-transparent hover:text-slate-700"}`}>
            <i className={`fa-solid ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {/* Tab: Denda per Streamer */}
      {activeTab === "denda" && (
        <>
          {Object.keys(kasusPerStreamer).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-chart-bar text-indigo-500" /> Rekap Denda Per Streamer
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Dasar perhitungan potongan payroll Finance</p>
              </div>
              <div className="divide-y divide-slate-50">
                {Object.values(kasusPerStreamer).sort((a, b) => b.total - a.total).map((s) => (
                  <div key={s.nama} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{s.nama}</div>
                      <div className="text-[10px] text-slate-400">ID: {s.idKaryawan} • {s.count} Pelanggaran</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-red-600">− {fmtCur(s.total)}</div>
                      <div className="text-[10px] text-slate-400">Total denda bulan ini</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex justify-between items-center">
                <span className="text-xs text-red-700 font-bold">Total Semua Potongan</span>
                <span className="text-sm font-black text-red-700">− {fmtCur(totalDenda)}</span>
              </div>
            </div>
          )}

          {/* Detail Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-list-check text-slate-500" /> Detail Semua Kasus
              </h3>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">{incidents.length} Kasus</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Streamer", "Kasus / Judul", "Kategori", "Tingkat", "Tanggal", "Denda", "Bukti"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Memuat data...</td></tr>
                  ) : incidents.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Tidak ada pelanggaran pada {monthLabel(periodeFilter)}.</td></tr>
                  ) : incidents.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{i.streamer?.namaLengkap ?? "—"}</div>
                        <div className="text-[10px] text-slate-400">{i.streamer?.idKaryawan ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{i.title}</td>
                      <td className="px-4 py-3">
                        {i.category ? (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">{i.category.name}</span>
                        ) : <span className="text-slate-400 text-[10px]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SEVERITY_STYLE[i.severity]}`}>{i.severity}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(i.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {i.fineApplied ? (
                          <span className="font-bold text-red-600">− {fmtCur(i.fineApplied)}</span>
                        ) : <span className="text-slate-400 italic">Tanpa denda</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {i.proofDriveId ? (
                          <a href={i.proofDriveId} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-[10px] font-medium">Lihat Bukti</a>
                        ) : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab: Insentif Pelapor */}
      {activeTab === "reporter" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
            <i className="fa-solid fa-circle-info mr-2 text-blue-600" />
            <strong>Kebijakan Insentif Pelapor:</strong> CRITICAL = Rp 50.000 | HIGH = Rp 30.000 | MEDIUM = Rp 15.000 | LOW = Rp 5.000 per laporan yang disetujui SPV.
          </div>

          {Object.keys(insentifPerReporter).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400">
              <i className="fa-solid fa-star text-2xl text-slate-300 block mb-2" />
              Tidak ada pelapor yang tercatat pada {monthLabel(periodeFilter)}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(insentifPerReporter).sort((a, b) => b.totalInsentif - a.totalInsentif).map((r, idx) => (
                <div key={r.nama} className={`bg-white border rounded-2xl p-5 shadow-sm space-y-3 ${idx === 0 ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${idx === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {idx === 0 ? "🏆" : idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{r.nama}</div>
                        {r.email && <div className="text-[10px] text-slate-400">{r.email}</div>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-emerald-700">{fmtCur(r.totalInsentif)}</div>
                      <div className="text-[10px] text-slate-400">{r.kasusCount} kasus dilaporkan</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.breakdown.map((b) => (
                      <span key={b.severity} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[b.severity]}`}>
                        {b.severity}: {b.count}x (+{fmtCur(INSENTIF_PER_SEVERITY[b.severity] * b.count)})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total footer */}
          {Object.keys(insentifPerReporter).length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-emerald-800">Total Anggaran Insentif Pelapor</div>
                <div className="text-[10px] text-emerald-600">{monthLabel(periodeFilter)} • {Object.keys(insentifPerReporter).length} pelapor aktif</div>
              </div>
              <div className="text-xl font-black text-emerald-700">{fmtCur(totalInsentifReporter)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
