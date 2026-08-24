"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ViewDataPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("karyawan");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/view-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") setData(d.data);
        else setError(d.message ?? "Akses ditolak");
      })
      .catch(() => setError("Koneksi error"));
  }, []);

  // Reset search when tab changes
  useEffect(() => setSearch(""), [activeTab]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Master Data Explorer</h1>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
      </div>
    );
  }

  if (!data) return <p className="text-xs text-slate-500">Memuat master data...</p>;

  const tabConfig: Record<string, { label: string; count: number; icon: string }> = {
    karyawan: { label: "Karyawan & Host", count: data.karyawan?.length ?? 0, icon: "fa-users" },
    clients: { label: "Brand Partner", count: data.clients?.length ?? 0, icon: "fa-building" },
    jadwal: { label: "Jadwal Siaran", count: data.jadwal?.length ?? 0, icon: "fa-calendar" },
    absensi: { label: "Log Presensi", count: data.absensi?.length ?? 0, icon: "fa-id-badge" },
    lembur: { label: "Pengajuan Lembur", count: data.lembur?.length ?? 0, icon: "fa-clock" },
    izin: { label: "Pengajuan Izin", count: data.izin?.length ?? 0, icon: "fa-file-signature" },
    payroll: { label: "Payroll", count: data.payroll?.length ?? 0, icon: "fa-money-bill-wave" },
    tiering: { label: "Master Tiering", count: data.tiering?.length ?? 0, icon: "fa-layer-group" },
  };

  const allRows: any[] = data[activeTab] ?? [];

  // Apply search filter across all visible (non-object) fields
  const currentRows = search
    ? allRows.filter((row) =>
        Object.keys(row)
          .filter((k) => typeof row[k] !== "object")
          .some((k) => String(row[k] ?? "").toLowerCase().includes(search.toLowerCase()))
      )
    : allRows;

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/view-data.html */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">View Data</h1>
        <p className="text-slate-500 text-sm mt-1">Lihat dan cari data operasional dari database pusat.</p>
      </div>


      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(tabConfig).map(([key, cfg]) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                active
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <i className={`fa-solid ${cfg.icon}`} />
              <span>{cfg.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {cfg.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-sm">
            Tabel {tabConfig[activeTab]?.label ?? activeTab}
            <span className="text-slate-400 font-normal ml-2">({currentRows.length} baris{search ? ` dari ${allRows.length}` : ""})</span>
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari di kolom mana pun..."
                className="w-full sm:w-44 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>

            <button
              onClick={() => {
                if (currentRows.length === 0) return;
                const headers = Object.keys(currentRows[0]).filter((k) => typeof currentRows[0][k] !== "object");
                const csvContent =
                  headers.join(",") +
                  "\n" +
                  currentRows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Export_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap"
            >
              <i className="fa-solid fa-file-csv text-emerald-600" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {currentRows.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  {Object.keys(currentRows[0]).filter((k) => typeof currentRows[0][k] !== "object").map((col) => (
                    <th key={col} className="px-4 py-3 uppercase tracking-wider font-mono text-[10px]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentRows.map((row, idx) => (
                  <tr key={row.id ?? idx} className="hover:bg-slate-50/80 transition">
                    {Object.keys(row)
                      .filter((k) => typeof row[k] !== "object")
                      .map((col, colIdx) => (
                        <td key={col} className="px-4 py-3 font-mono text-slate-700 max-w-xs truncate">
                          {activeTab === "karyawan" && colIdx === 0 ? (
                            <Link href={`/karyawan/${row.id}`} className="text-blue-600 hover:underline font-semibold">
                              {String(row[col] ?? "–")}
                            </Link>
                          ) : (
                            String(row[col] ?? "–")
                          )}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              {search ? "Tidak ada data yang cocok dengan pencarian Anda." : "Tidak ada data pada tabel ini."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
