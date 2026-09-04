"use client";

// Terbatas (Aksi Khusus) tab of the streamer dashboard: sub-tabs for short-gap
// instant check-out sessions and overdue GMV reports, plus the special
// attendance form. Extracted verbatim from page.tsx (refactor only — markup
// and behavior unchanged).

import type React from "react";
import { useEffect, useState } from "react";
import LiveCameraCheckin, { LocationCoordinates } from "./live-camera-checkin";
import BuktiGmvInput from "./bukti-gmv-input";
import type { JedaJadwal, PerluLaporItem, SelectedTerbatasJadwal } from "./types";
import {
  formatDateSafe,
  formatTimeSafe,
} from "@/lib/utils/date-format";

export type TerbatasFilterCol = "ALL" | "DATE" | "PLATFORM" | "STREAMER";

/**
 * Jam saat ini untuk badge Segera/Berlangsung. Date.now() dilarang dipanggil
 * langsung saat render (react-compiler) — snapshot via state + effect, diperbarui
 * tiap 60 detik supaya badge berganti saat sesi mulai/selesai.
 */
function useNowMs(): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return nowMs;
}

export function TabTerbatas({
  sessionUserName,
  subTabTerbatas,
  filterColTerbatas,
  filterTextTerbatas,
  filteredJeda,
  rawLaporCount,
  filteredLapor,
  selectedTerbatasJadwal,
  studioList,
  formTerbatasStudio,
  formTerbatasGmv,
  formTerbatasCatatan,
  formTerbatasFotoGmv,
  formTerbatasFotoKeluar,
  formTerbatasLocGmv,
  formTerbatasLocKeluar,
  submittingTerbatas,
  formatRupiahInput,
  onSubTabChange,
  onFilterColChange,
  onFilterTextChange,
  onSiapkanJeda,
  onSiapkanLapor,
  onCloseForm,
  onStudioChange,
  onGmvChange,
  onCatatanChange,
  onFotoGmvChange,
  onFotoKeluarChange,
  onLocGmvChange,
  onLocKeluarChange,
  onSubmitTerbatas,
}: {
  sessionUserName?: string | null;
  subTabTerbatas: "jeda" | "lapor";
  filterColTerbatas: TerbatasFilterCol;
  filterTextTerbatas: string;
  filteredJeda: JedaJadwal[];
  rawLaporCount: number;
  filteredLapor: PerluLaporItem[];
  selectedTerbatasJadwal: SelectedTerbatasJadwal | null;
  studioList: { name: string; cabang: string; no: string }[];
  formTerbatasStudio: string;
  formTerbatasGmv: string;
  formTerbatasCatatan: string;
  formTerbatasFotoGmv: string;
  formTerbatasFotoKeluar: string;
  formTerbatasLocGmv: LocationCoordinates | null;
  formTerbatasLocKeluar: LocationCoordinates | null;
  submittingTerbatas: boolean;
  formatRupiahInput: (val: string) => string;
  onSubTabChange: (t: "jeda" | "lapor") => void;
  onFilterColChange: (v: TerbatasFilterCol) => void;
  onFilterTextChange: (v: string) => void;
  onSiapkanJeda: (j: JedaJadwal) => void;
  onSiapkanLapor: (p: PerluLaporItem) => void;
  onCloseForm: () => void;
  onStudioChange: (v: string) => void;
  onGmvChange: (v: string) => void;
  onCatatanChange: (v: string) => void;
  onFotoGmvChange: (v: string) => void;
  onFotoKeluarChange: (v: string) => void;
  onLocGmvChange: (loc: LocationCoordinates | null) => void;
  onLocKeluarChange: (loc: LocationCoordinates | null) => void;
  onSubmitTerbatas: (e: React.FormEvent) => void;
}) {
  const nowMs = useNowMs();
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header with Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-4">
        <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <i className="fa-solid fa-bolt text-amber-500" />
          <span>Aksi Khusus</span>
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => onSubTabChange("jeda")}
            className={`py-1.5 px-4 text-xs sm:text-sm font-bold transition whitespace-nowrap rounded-lg flex items-center gap-1.5 ${
              subTabTerbatas === "jeda"
                ? "text-[#941A0B] bg-[#941A0B]/10 border border-[#941A0B]/20 shadow-xs"
                : "text-slate-500 hover:text-[#941A0B] hover:bg-slate-50"
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left text-xs" />
            <span>Jeda Terbatas</span>
          </button>
          <button
            type="button"
            onClick={() => onSubTabChange("lapor")}
            className={`py-1.5 px-4 text-xs sm:text-sm font-bold transition whitespace-nowrap rounded-lg flex items-center gap-1.5 ${
              subTabTerbatas === "lapor"
                ? "text-red-600 bg-red-50 border border-red-200 shadow-xs"
                : "text-slate-500 hover:text-red-600 hover:bg-slate-50"
            }`}
          >
            <i className="fa-solid fa-triangle-exclamation text-xs" />
            <span>Perlu Lapor</span>
            {rawLaporCount > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                {rawLaporCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW: JEDA TERBATAS */}
      {subTabTerbatas === "jeda" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-[#941A0B] mt-0.5 text-sm" />
            <span>
              Daftar jadwal sesi jeda singkat hari ini (&lt; 30 menit atau mepet sesi berikutnya) yang harus segera Anda check-in. Pilih jadwal lalu <strong>Absen Instan</strong> untuk menyelesaikan sesi sekaligus (check-in + check-out instan).
            </span>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterColTerbatas}
              onChange={(e) => onFilterColChange(e.target.value as TerbatasFilterCol)}
              className="w-full sm:w-auto border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#941A0B] outline-none font-medium"
            >
              <option value="ALL">-- Tampilkan Semua Data --</option>
              <option value="DATE">Tanggal</option>
              <option value="PLATFORM">Platform</option>
              <option value="STREAMER">Streamer</option>
            </select>
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                value={filterTextTerbatas}
                onChange={(e) => onFilterTextChange(e.target.value)}
                placeholder="Ketik untuk mencari jadwal jeda..."
                className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B]"
              />
              {filterTextTerbatas && (
                <button
                  type="button"
                  onClick={() => onFilterTextChange("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Table Jeda */}
          <div className="overflow-auto rounded-xl border border-slate-200 max-h-[420px] shadow-xs">
            <table className="min-w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">NO</th>
                  <th className="px-4 py-3 text-center">ID JADWAL</th>
                  <th className="px-4 py-3">STREAMER</th>
                  <th className="px-4 py-3">INFO LIVE</th>
                  <th className="px-4 py-3 text-center w-36">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {filteredJeda.length > 0 ? (
                  filteredJeda.map((j, idx) => {
                    const mulaiMs = new Date(j.jamMulaiLive).getTime();
                    const selesaiMs = new Date(j.jamSelesaiLive).getTime();
                    // Ref-deploy: sesi belum mulai = "segera check-in" (badge Segera),
                    // sudah berjalan = badge Berlangsung.
                    const belumMulai = nowMs < mulaiMs;
                    const sedangBerlangsung = nowMs >= mulaiMs && nowMs <= selesaiMs;
                    return (
                    <tr key={j.id} className="hover:bg-amber-50/60 transition group">
                      <td className="px-3.5 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#941A0B] whitespace-nowrap">
                        {j.idJadwal || "JDW-AUTO"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-900">{j.streamerKaryawan?.namaLengkap || sessionUserName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{j.streamerKaryawan?.idKaryawan || "-"}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-900">
                          {j.platform || "Platform"} • {j.client?.namaClient || "Klien"}
                          {belumMulai && (
                            <span className="ml-1.5 bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase align-middle" title="Sesi akan mulai — siapkan absen instan">
                              Segera
                            </span>
                          )}
                          {sedangBerlangsung && (
                            <span className="ml-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase align-middle" title="Sesi sedang berlangsung">
                              Berlangsung
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                          <i className="fa-regular fa-calendar text-[10px]" />
                          <span>{formatDateSafe(j.tanggal)}</span>
                        </div>
                        <div className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1 font-mono">
                          <i className="fa-regular fa-clock text-[10px]" />
                          <span>{formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => onSiapkanJeda(j)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm flex items-center gap-1.5 mx-auto active:scale-95 whitespace-nowrap"
                        >
                          <i className="fa-solid fa-right-from-bracket text-xs" />
                          <span>Absen Instan</span>
                        </button>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-xs">
                      <i className="fa-solid fa-calendar-check text-2xl text-slate-300 block mb-2" />
                      Tidak ada jadwal jeda singkat hari ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: PERLU LAPOR */}
      {subTabTerbatas === "lapor" && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-red-700 bg-red-50 p-3.5 rounded-xl border border-red-200 flex items-center gap-2.5 shadow-xs">
            <i className="fa-solid fa-triangle-exclamation text-red-600 text-base shrink-0" />
            <span>
              Peringatan: Daftar di bawah adalah Sesi Live yang lupa Anda laporkan dan telah melampaui batas waktu 8 jam.
            </span>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterColTerbatas}
              onChange={(e) => onFilterColChange(e.target.value as TerbatasFilterCol)}
              className="w-full sm:w-auto border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
            >
              <option value="ALL">-- Tampilkan Semua Data --</option>
              <option value="DATE">Tanggal</option>
              <option value="PLATFORM">Platform</option>
              <option value="STREAMER">Streamer</option>
            </select>
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                value={filterTextTerbatas}
                onChange={(e) => onFilterTextChange(e.target.value)}
                placeholder="Ketik untuk mencari sesi tertunda..."
                className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-red-500"
              />
              {filterTextTerbatas && (
                <button
                  type="button"
                  onClick={() => onFilterTextChange("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Table Lapor */}
          <div className="overflow-auto rounded-xl border border-slate-200 max-h-[420px] shadow-xs">
            <table className="min-w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">NO</th>
                  <th className="px-4 py-3 text-center">ID JADWAL</th>
                  <th className="px-4 py-3">STREAMER</th>
                  <th className="px-4 py-3">INFO LIVE</th>
                  <th className="px-4 py-3 text-center w-36">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {filteredLapor.length > 0 ? (
                  filteredLapor.map((p, idx) => {
                    const j: JedaJadwal = (p.jadwal || p) as JedaJadwal;
                    const k = p.karyawan || j.streamerKaryawan;
                    return (
                      <tr key={p.id || idx} className="hover:bg-red-50/60 transition group">
                        <td className="px-3.5 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          <div className="font-mono font-bold text-[#941A0B]">{j.idJadwal ?? "–"}</div>
                          {p.id && <div className="text-[9px] text-slate-400 font-mono truncate max-w-[120px] mx-auto">{p.id}</div>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900">{k?.namaLengkap || sessionUserName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{k?.idKaryawan || "-"}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900">{j.platform || "Platform"} • {j.client?.namaClient || "Klien"}</div>
                          <div className="text-[11px] text-[#941A0B] mt-0.5 flex items-center gap-1">
                            <i className="fa-regular fa-calendar text-[10px]" />
                            <span>{formatDateSafe(j.tanggal)}</span>
                          </div>
                          <div className="text-[11px] text-rose-600 mt-0.5 flex items-center gap-1 font-mono">
                            <i className="fa-regular fa-clock text-[10px]" />
                            <span>{formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => onSiapkanLapor(p)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-md transition flex items-center gap-1.5 mx-auto active:scale-95 whitespace-nowrap"
                          >
                            <i className="fa-solid fa-file-pen text-xs" />
                            <span>Perlu Lapor</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-emerald-600 font-bold bg-emerald-50 text-xs">
                      <i className="fa-solid fa-circle-check text-2xl text-emerald-500 block mb-2" />
                      Tidak ada tanggungan telat lapor. Bagus!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======== FORM ABSEN KHUSUS (DETAIL JADWAL DIPROSES) ======== */}
      {selectedTerbatasJadwal && (
        <div id="formTerbatasContainer" className="border-t-2 border-slate-100 pt-6 animate-fade-in space-y-4">
          {/* Summary Dark Card */}
          <div className="bg-[#1e293b] text-white rounded-2xl p-5 shadow-lg w-full border border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-circle-info text-[#FA3737]" />
                <span>Detail Jadwal Diproses</span>
              </h4>
              <button
                type="button"
                onClick={onCloseForm}
                className="text-slate-400 hover:text-white text-xs bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-600 transition"
              >
                ✕ Tutup Form
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">ID Jadwal</p>
                <p className="font-bold text-[#FA3737] font-mono break-all">{selectedTerbatasJadwal.idJadwal}</p>
                {selectedTerbatasJadwal.idAbsen && (
                  <p className="text-[9px] text-slate-400 font-mono">{selectedTerbatasJadwal.idAbsen}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Platform & Klien</p>
                <p className="font-bold text-white">{selectedTerbatasJadwal.platform} • {selectedTerbatasJadwal.clientName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Streamer</p>
                <p className="font-bold text-white">{selectedTerbatasJadwal.streamerName}</p>
                <p className="text-[9px] text-slate-400 font-mono">{selectedTerbatasJadwal.streamerId}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Waktu Live</p>
                <p className="font-bold text-emerald-400">{formatDateSafe(selectedTerbatasJadwal.tanggal)}</p>
                <p className="text-[10px] text-amber-300 font-mono">
                  {formatTimeSafe(selectedTerbatasJadwal.jamMulaiLive)} - {formatTimeSafe(selectedTerbatasJadwal.jamSelesaiLive)} WIB
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={onSubmitTerbatas} className="space-y-5 bg-slate-50/70 p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Studio, GMV, Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nomor Studio *</label>
                <select
                  value={formTerbatasStudio}
                  onChange={(e) => onStudioChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 bg-white mb-4 outline-none font-medium"
                  required
                >
                  {studioList.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {formTerbatasStudio && !studioList.some((s) => s.name === formTerbatasStudio) && (
                    <option value={formTerbatasStudio}>{formTerbatasStudio}</option>
                  )}
                </select>

                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nominal GMV (Rp) *</label>
                <div className="relative mb-4">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(formTerbatasGmv)}
                    onChange={(e) => onGmvChange(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 bg-white outline-none"
                    required
                  />
                </div>

                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Kendala (Opsional)</label>
                <textarea
                  value={formTerbatasCatatan}
                  onChange={(e) => onCatatanChange(e.target.value)}
                  placeholder="Tulis catatan kendala sesi jika ada..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 bg-white outline-none"
                  rows={3}
                />
              </div>

              {/* Right Column: Bukti GMV & Selfie Keluar */}
              <div className="space-y-4">
                <div>
                  <BuktiGmvInput
                    value={formTerbatasFotoGmv}
                    onChange={onFotoGmvChange}
                    onLocationChange={onLocGmvChange}
                    disabled={!selectedTerbatasJadwal}
                    label="Bukti GMV (Screenshot / Foto Dashboard) *"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Selfie Keluar (Kamera Langsung & GPS) *</span>
                    <span className="text-[11px] text-[#941A0B] font-semibold">Wajib Kamera & Lokasi</span>
                  </label>
                  <LiveCameraCheckin
                    value={formTerbatasFotoKeluar}
                    onChange={onFotoKeluarChange}
                    onLocationChange={onLocKeluarChange}
                    mode="checkout"
                    disabled={!selectedTerbatasJadwal}
                    disabledMessage="Pilih jadwal terlebih dahulu untuk membuka kamera."
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCloseForm}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition text-center"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  submittingTerbatas ||
                  !formTerbatasFotoGmv ||
                  !formTerbatasLocGmv ||
                  !formTerbatasFotoKeluar ||
                  !formTerbatasLocKeluar
                }
                className={`w-full sm:w-auto text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 active:scale-95 ${
                  selectedTerbatasJadwal.tipeForm === "PULANG_TELAT"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {submittingTerbatas ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin mr-1.5" />
                    Memproses...
                  </>
                ) : selectedTerbatasJadwal.tipeForm === "PULANG_TELAT" ? (
                  <>
                    <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                    Kirim Laporan Telat
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check-double mr-1.5" />
                    Selesaikan Sesi Jeda
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}