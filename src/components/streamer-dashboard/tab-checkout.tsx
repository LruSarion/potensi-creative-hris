"use client";

// Check-Out tab of the streamer dashboard: active session summary, GMV report
// form (studio, nominal GMV, catatan, bukti GMV, selfie + GPS). Extracted
// verbatim from page.tsx (refactor only — markup and behavior unchanged).

import LiveCameraCheckin, { LocationCoordinates } from "./live-camera-checkin";
import BuktiGmvInput from "./bukti-gmv-input";
import type { ActiveSession } from "./types";
import { formatTimeSafe } from "@/lib/utils/date-format";
import { useEffect, useState } from "react";
import { getScheduleEndFromSession, getCheckoutWindowState } from "./checkout-window";

export function TabCheckOut({
  activeSession,
  actionLoading,
  studioList,
  checkoutStudio,
  reportedGmv,
  checkoutCatatan,
  checkoutFotoGmv,
  checkoutFotoUrl,
  checkoutLocation,
  checkoutHasCamera,
  checkoutCameraError,
  formatRupiahInput,
  onStudioChange,
  onGmvChange,
  onCatatanChange,
  onFotoGmvChange,
  onFotoChange,
  onLocationChange,
  onCameraStatusChange,
  onSubmit,
}: {
  activeSession: ActiveSession | null;
  actionLoading: boolean;
  studioList: { name: string; cabang: string; no: string }[];
  checkoutStudio: string;
  reportedGmv: string;
  checkoutCatatan: string;
  checkoutFotoGmv: string;
  checkoutFotoUrl: string;
  checkoutLocation: LocationCoordinates | null;
  checkoutHasCamera: boolean;
  checkoutCameraError: string | null;
  formatRupiahInput: (val: string) => string;
  onStudioChange: (v: string) => void;
  onGmvChange: (v: string) => void;
  onCatatanChange: (v: string) => void;
  onFotoGmvChange: (v: string) => void;
  onFotoChange: (v: string) => void;
  onLocationChange: (loc: LocationCoordinates | null) => void;
  onCameraStatusChange: (ready: boolean, err: string | null) => void;
  onSubmit: () => void;
}) {
  // Checkout window: re-evaluate every 30s so the button unlocks itself
  // when the session end time arrives without a manual refresh.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sessionEnd = getScheduleEndFromSession(activeSession?.jadwal);
  const windowState = getCheckoutWindowState(sessionEnd, nowTick);
  const checkoutLocked =
    activeSession && windowState !== "TANPA_JADWAL" && windowState !== "TERBUKA";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
      <h3 className="font-bold text-lg text-slate-900 mb-1 border-b border-slate-100 pb-2">Form Check-Out Live</h3>

      {activeSession ? (
        <>
          {/* Dark card summary of active session */}
          <div className="mt-4 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full mb-6">
            <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Detail Sesi Aktif Anda</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-3">
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Waktu Check-In</p>
                <p className="text-sm font-bold text-emerald-400">
                  {formatTimeSafe(activeSession.waktu)} WIB
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Durasi Berlangsung</p>
                <p className="text-sm font-bold text-[#FA3737]">
                  {Math.round((nowTick - new Date(activeSession.waktu).getTime()) / 60000)} Menit
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Studio Terjadwal</p>
                <p className="text-sm font-bold text-amber-300">
                  {checkoutStudio || "Studio Timoho 1"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Status</p>
                <p className="text-sm font-bold text-rose-400">🔴 ON AIR</p>
              </div>
            </div>

            {/* Checkout window banner: locked before the scheduled end, open until H+8 */}
            {sessionEnd && windowState !== "TERBUKA" && (
              <div
                className={`mt-4 mb-[-12px] p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  windowState === "SEBELUM"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <i
                  className={`fa-solid ${
                    windowState === "SEBELUM" ? "fa-hourglass-half text-amber-600" : "fa-circle-xmark text-red-600"
                  } mt-0.5`}
                />
                <p className="text-[11px] leading-relaxed">
                  {windowState === "SEBELUM" ? (
                    <>
                      Check-out baru dibuka saat sesi berakhir — <strong>{formatTimeSafe(sessionEnd)} WIB</strong>.
                      Sisa waktu sekitar <strong>{Math.max(1, Math.ceil((sessionEnd.getTime() - nowTick) / 60000))} menit</strong>.
                    </>
                  ) : (
                    <>
                      Jendela check-out (H+8 jam setelah sesi berakhir <strong>{formatTimeSafe(sessionEnd)} WIB</strong>) sudah terlewat.
                      Silakan lapor melalui tab <strong>Terbatas</strong>.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Studio, Nominal GMV, Catatan */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilihan Studio *</label>
              <select
                value={checkoutStudio}
                onChange={(e) => onStudioChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] bg-white mb-4 outline-none font-medium"
                required
              >
                {studioList.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
                {checkoutStudio && !studioList.some((s) => s.name === checkoutStudio) && (
                  <option value={checkoutStudio}>{checkoutStudio}</option>
                )}
              </select>

              <label className="block text-sm font-bold text-slate-700 mb-1">Nominal GMV (Rp) *</label>
              <div className="relative mb-3">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(reportedGmv)}
                  onChange={(e) => onGmvChange(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="0"
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#941A0B] bg-white outline-none"
                  required
                />
              </div>
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-1.5 leading-tight mb-4">
                <i className="fa-solid fa-triangle-exclamation text-red-600 mt-0.5 text-xs" />
                <span className="text-[10px] text-red-700">
                  <strong>PENTING:</strong> Hanya masukkan income GMV yang dihasilkan pada <strong>sesi INI SAJA</strong>.
                </span>
              </div>

              <label className="block text-sm font-bold text-slate-700 mb-1">Catatan Kendala Sesi (Opsional)</label>
              <textarea
                value={checkoutCatatan}
                onChange={(e) => onCatatanChange(e.target.value)}
                placeholder="Tulis catatan kendala sesi jika ada (misal kendala produk, teknis, dll)..."
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] bg-white outline-none"
                rows={3}
              />
            </div>

            {/* Right Column: Bukti GMV (Kamera / File) & Foto Keluar (Selfie Kamera + GPS) */}
            <div className="space-y-4">
              {/* Foto Bukti GMV (Kamera atau File Upload) */}
              <BuktiGmvInput
                value={checkoutFotoGmv}
                onChange={onFotoGmvChange}
                disabled={!activeSession}
                label="Bukti GMV (Screenshot / Foto Dashboard) *"
                required={true}
              />

              {/* Foto Selfie Keluar */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Foto Keluar (Selfie Kamera Langsung & GPS) *</span>
                  <span className="text-[11px] text-[#941A0B] font-semibold">Wajib Kamera & Lokasi</span>
                </label>
                <LiveCameraCheckin
                  value={checkoutFotoUrl}
                  onChange={onFotoChange}
                  onLocationChange={onLocationChange}
                  mode="checkout"
                  disabled={!activeSession}
                  disabledMessage="Tidak ada sesi live aktif untuk check-out."
                  onCameraStatusChange={onCameraStatusChange}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                actionLoading ||
                !!checkoutLocked ||
                !reportedGmv ||
                !checkoutFotoGmv ||
                !checkoutFotoUrl ||
                !checkoutLocation ||
                !checkoutHasCamera ||
                !!checkoutCameraError
              }
              className="bg-amber-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-amber-600 transition shadow-md w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              <i className={`fa-solid ${checkoutLocked && windowState === "SEBELUM" ? "fa-hourglass-half" : "fa-upload"} mr-1`} />
              <span>
                {actionLoading
                  ? "Memproses Check-Out..."
                  : checkoutLocked && windowState === "SEBELUM"
                  ? `Checkout Dibuka Jam ${sessionEnd ? formatTimeSafe(sessionEnd) : "--:--"} WIB`
                  : checkoutLocked && windowState === "LEWAT"
                  ? "Jendela Check-Out Terlewat — Lapor via Tab Terbatas"
                  : !reportedGmv
                  ? "Isi Nominal GMV Terlebih Dahulu"
                  : !checkoutFotoGmv
                  ? "Lampirkan Bukti GMV (Kamera / File)"
                  : !checkoutHasCamera
                  ? "Kamera Wajib Tersedia"
                  : !checkoutFotoUrl
                  ? "Ambil Foto Selfie Keluar"
                  : !checkoutLocation
                  ? "Menunggu Lokasi GPS..."
                  : "Selesaikan Sesi (Check-Out)"}
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 p-6 text-center text-slate-400 text-sm">
          <i className="fa-solid fa-video-slash text-3xl mb-3 block text-slate-300" />
          Anda tidak memiliki sesi live aktif saat ini.
          <br />
          <span className="text-xs">Lakukan Check-In terlebih dahulu di tab <strong>Check In</strong>.</span>
        </div>
      )}
    </div>
  );
}