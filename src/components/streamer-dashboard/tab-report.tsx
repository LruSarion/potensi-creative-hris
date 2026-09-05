"use client";

// Report tab — restructured to match ref-deploy streamer-dashboard.html
// tab-report (baris 913-1024): periode bulan filter, kartu THP gradient,
// kartu GMV (Selesai/Batal), kartu Durasi Bersih, dan Rekapitulasi
// Kedisiplinan (Ringan/Sedang/Berat/Denda Aktif/Di-Batalkan).
// Versi lama (4 stat cards + tiering box) dipertahankan sebagai komentar
// TODO(ref-deploy-report) di bawah.

import { useEffect, useState, useMemo, useRef } from "react";
import type { DashboardData } from "./types";
import { formatDateSafe } from "@/lib/utils/date-format";
import { CardSkeleton } from "@/components/ui/loading-states";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Daftar 6 bulan terakhir sebagai opsi periode (ref-deploy filterReportPeriode). */
function periodeOptions(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    out.push({ value: label, label });
  }
  return out;
}

export interface HostOption {
  id: string;
  idKaryawan: string;
  namaLengkap: string;
}

export interface TabReportProps {
  dashboardData: DashboardData | null;
  onPeriodeChange?: (periode: string) => void;
  loading?: boolean;
  isAdmin?: boolean;
  hostList?: HostOption[];
  selectedHostId?: string;
  onHostChange?: (hostId: string) => void;
}

export function TabReport({
  dashboardData,
  onPeriodeChange,
  loading,
  isAdmin = false,
  hostList = [],
  selectedHostId = "",
  onHostChange,
}: TabReportProps) {
  const [periode, setPeriode] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isListOpen, setIsListOpen] = useState<boolean>(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Default ke periode data aktif (bulan berjalan) saat load pertama.
  useEffect(() => {
    if (!periode && dashboardData?.periode) setPeriode(dashboardData.periode);
  }, [dashboardData?.periode, periode]);

  // Sync nama host pada input saat selectedHostId berubah atau hostList terisi
  useEffect(() => {
    if (selectedHostId && hostList.length > 0) {
      const match = hostList.find(
        (h) => h.idKaryawan.toLowerCase() === selectedHostId.toLowerCase() || h.id === selectedHostId
      );
      if (match) {
        setSearchTerm(`${match.idKaryawan} | ${match.namaLengkap}`);
      }
    } else if (!selectedHostId) {
      setSearchTerm("");
    }
  }, [selectedHostId, hostList]);

  // Click outside listener untuk menutup list dropdown host
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter host berdasarkan query input (ID atau Nama)
  const filteredHosts = useMemo(() => {
    if (!searchTerm.trim()) return hostList;
    const q = searchTerm.toLowerCase();
    return hostList.filter((h) => {
      const idMatch = h.idKaryawan.toLowerCase().includes(q);
      const nameMatch = h.namaLengkap.toLowerCase().includes(q);
      const combinedMatch = `${h.idKaryawan} | ${h.namaLengkap}`.toLowerCase().includes(q);
      return idMatch || nameMatch || combinedMatch;
    });
  }, [hostList, searchTerm]);

  function handleSelectHost(host: HostOption) {
    const val = `${host.idKaryawan} | ${host.namaLengkap}`;
    setSearchTerm(val);
    setIsListOpen(false);
    onHostChange?.(host.idKaryawan);
  }

  function handleClearHost() {
    setSearchTerm("");
    setIsListOpen(true);
    onHostChange?.("");
  }

  const hasData = Boolean(dashboardData && dashboardData.totalSesi > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
        <i className="fa-solid fa-chart-pie text-blue-500" />
        <span>Laporan Kinerja Bulanan</span>
      </h3>

      {/* Filter Periode & Pilih Host (ref-deploy filterReportPeriode & report-admin-filter) */}
      <div className="flex flex-col sm:flex-row gap-3 mb-2 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-inner">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 mb-1">Periode Bulan</label>
          <select
            value={periode}
            onChange={(e) => {
              setPeriode(e.target.value);
              onPeriodeChange?.(e.target.value);
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm cursor-pointer"
          >
            <option value="">Pilih periode...</option>
            {periodeOptions().map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div id="report-admin-filter" ref={comboboxRef} className="flex-1 relative">
            <label className="block text-xs font-bold text-slate-500 mb-1">Pilih Host (Akses Admin)</label>
            <div className="relative flex items-center w-full">
              <input
                type="text"
                id="filterReportHost"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsListOpen(true);
                  if (!e.target.value.trim()) {
                    onHostChange?.("");
                  }
                }}
                onFocus={() => setIsListOpen(true)}
                placeholder="Ketik nama atau ID host..."
                autoComplete="off"
                className="w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  id="btnClearHostReport"
                  onClick={handleClearHost}
                  className="absolute right-2.5 text-slate-400 hover:text-red-500 transition-colors"
                  title="Hapus Pencarian"
                >
                  <i className="fa-solid fa-xmark text-base" />
                </button>
              )}
            </div>

            {isListOpen && (
              <ul
                id="customListReportHost"
                className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1"
              >
                {filteredHosts.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500 italic cursor-not-allowed">
                    Tidak ditemukan
                  </li>
                ) : (
                  filteredHosts.map((h) => {
                    const label = `${h.idKaryawan} | ${h.namaLengkap}`;
                    return (
                      <li
                        key={h.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectHost(h);
                        }}
                        className="px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-slate-50 last:border-0 font-medium transition-colors"
                      >
                        {label}
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <CardSkeleton count={2} gridCls="grid grid-cols-1 md:grid-cols-2 gap-5" />
      ) : isAdmin && !selectedHostId ? (
        /* State awal khusus admin saat belum memilih host */
        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <i className="fa-solid fa-user-check text-5xl mb-3 text-slate-300" />
          <p className="font-medium text-sm">Silakan pilih host terlebih dahulu untuk melihat laporan kinerja bulanan.</p>
          <p className="text-xs text-slate-400 mt-1">Gunakan kolom pencarian host di atas untuk memilih akun streamer.</p>
        </div>
      ) : !hasData ? (
        /* Empty state (ref-deploy reportDataEmpty) */
        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <i className="fa-solid fa-folder-open text-5xl mb-3 text-slate-300" />
          <p className="font-medium text-sm">Data laporan tidak ditemukan untuk periode tersebut.</p>
          <p className="text-xs text-slate-400 mt-1">Sistem hanya menampilkan data yang sudah memiliki aktivitas absensi/live.</p>
        </div>
      ) : dashboardData && (
        <>
          {/* Kartu THP (ref-deploy repTHP — Estimasi Take Home Pay) */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-10">
              <i className="fa-solid fa-sack-dollar text-[150px]" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold tracking-wider text-slate-400 mb-1 uppercase">Estimasi Take Home Pay (THP)</p>
              <h4 className="text-4xl font-black mb-4 text-amber-400 tracking-tight drop-shadow-md">
                Rp {(dashboardData.netPay ?? 0).toLocaleString("id-ID")}
              </h4>
            </div>
            <div className="flex gap-4 text-sm bg-black/30 p-3 rounded-lg inline-flex backdrop-blur-sm border border-white/10 w-fit relative z-10">
              <div>Tier: <span className="font-bold text-emerald-400 tracking-wide">{dashboardData.activeTier?.nama ?? "-"}</span></div>
              <div className="w-px bg-white/20" />
              <div>Rate: <span className="font-bold text-emerald-400 tracking-wide">{(dashboardData.activeTier?.ratePerJam ?? 0).toLocaleString("id-ID")}</span> <span className="text-xs text-slate-400">/ Jam</span></div>
            </div>
          </div>

          {/* Kartu GMV & Durasi (ref-deploy repGMV / repDurasiBersih) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-blue-500">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total GMV</p>
                <i className="fa-solid fa-money-bill-trend-up text-blue-200 text-lg" />
              </div>
              <h5 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">
                Rp {(dashboardData.totalGmv ?? 0).toLocaleString("id-ID")}
              </h5>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-emerald-500" /> Selesai:{" "}
                  <span className="text-emerald-700 text-sm ml-1">{dashboardData.sesiSelesai ?? dashboardData.totalSesi}</span>
                </div>
                <div className="w-px h-4 bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-xmark text-red-400" /> Batal:{" "}
                  <span className="text-red-600 text-sm ml-1">{dashboardData.sesiBatal ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-emerald-500">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Akumulasi Durasi Live</p>
                <i className="fa-solid fa-clock-rotate-left text-emerald-200 text-lg" />
              </div>
              <h5 className="text-2xl font-black text-emerald-600 mb-4 tracking-tight">
                {dashboardData.totalJam ?? 0} Jam
              </h5>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-stopwatch text-slate-400" /> Total Sesi:{" "}
                  <span className="text-slate-800 ml-1">{dashboardData.totalSesi}</span>
                </div>
                <div className="w-px h-4 bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-scissors text-red-400" /> Potongan Denda:{" "}
                  <span className="text-red-600 ml-1">Rp {(dashboardData.totalDenda ?? 0).toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rekapitulasi Kedisiplinan (ref-deploy repRingan/repSedang/repBerat/repDendaAktif/repDendaBatal) */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-amber-500" />
              <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Rekapitulasi Kedisiplinan</h4>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1" title="Insiden severity LOW">Ringan</p>
                <p className="text-lg font-black text-amber-600">{dashboardData.severityCounts?.LOW ?? 0}</p>
              </div>
              <div className="text-center p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1" title="Insiden severity MEDIUM">Sedang</p>
                <p className="text-lg font-black text-orange-600">{dashboardData.severityCounts?.MEDIUM ?? 0}</p>
              </div>
              <div className="text-center p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1" title="Insiden severity HIGH/CRITICAL">Berat</p>
                <p className="text-lg font-black text-red-600">
                  {(dashboardData.severityCounts?.HIGH ?? 0) + (dashboardData.severityCounts?.CRITICAL ?? 0)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg border border-slate-100 bg-slate-50/50 border-l-2 border-l-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1" title="Denda yang masih berlaku">Denda Aktif</p>
                <p className="text-lg font-black text-slate-800">Rp {(dashboardData.dendaAktif ?? dashboardData.totalDenda ?? 0).toLocaleString("id-ID")}</p>
              </div>
              <div className="text-center p-3 rounded-lg border border-slate-100 bg-emerald-50 border-l-2 border-l-emerald-200">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1" title="Denda yang di-batalkan (insiden CLOSED)">Di-Batalkan</p>
                <p className="text-lg font-black text-emerald-700">Rp {(dashboardData.dendaDibatalkan ?? 0).toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>

          {/* Incident / QC Violations List (dipertahankan dari versi lama) */}
          {dashboardData.incidents && dashboardData.incidents.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Catatan Evaluasi / Pelanggaran Bulan Ini ({dashboardData.incidents.length})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {dashboardData.incidents.map((inc) => (
                  <div key={inc.id} className="p-3.5 bg-white flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{inc.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{inc.category ?? "Pelanggaran"} • {formatDateSafe(inc.createdAt)}</div>
                    </div>
                    <span className="font-mono font-bold text-red-600 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100">
                      -Rp {inc.fineApplied.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-slate-400 text-xs pt-2">
            <p>Untuk rincian slip gaji resmi atau pengajuan izin, silakan akses menu terkait di sistem HRIS.</p>
          </div>
        </>
      )}

      {/* TODO(ref-deploy-report): markup lama (4 stat cards netPay/totalGmv/totalJam/totalDenda
          + tiering detail box + periode chip di header) diganti struktur ref-deploy di atas.
          Versi lama ada di git history. */}
    </div>
  );
}