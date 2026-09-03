"use client";

// Check-In tab of the streamer dashboard: locked state when a session is
// active, otherwise the check-in form (jadwal picker, live camera + GPS, and
// the dynamic late-reason section). Extracted verbatim from page.tsx
// (refactor only — markup and behavior unchanged).

import LiveCameraCheckin, { LocationCoordinates } from "./live-camera-checkin";
import type { ActiveSession, Jadwal } from "./types";
import {
  formatDateSafe,
  formatTimeSafe,
} from "@/lib/utils/date-format";
import { getLateCheckInStatus } from "./late-check";

export function TabCheckIn({
  activeSession,
  jadwal,
  selectedJadwalId,
  selectedJadwalDetail,
  fotoBuktiUrl,
  alasanTerlambat,
  checkInLocation,
  hasCamera,
  cameraError,
  actionLoading,
  onSelectJadwalChange,
  onFotoBuktiChange,
  onAlasanTerlambatChange,
  onLocationChange,
  onCameraStatusChange,
  onGoCheckout,
  onSubmit,
}: {
  activeSession: ActiveSession | null;
  jadwal: Jadwal[];
  selectedJadwalId: string;
  selectedJadwalDetail: Jadwal | null;
  fotoBuktiUrl: string;
  alasanTerlambat: string;
  checkInLocation: LocationCoordinates | null;
  hasCamera: boolean;
  cameraError: string | null;
  actionLoading: boolean;
  onSelectJadwalChange: (id: string, detail: Jadwal | null) => void;
  onFotoBuktiChange: (v: string) => void;
  onAlasanTerlambatChange: (v: string) => void;
  onLocationChange: (loc: LocationCoordinates | null) => void;
  onCameraStatusChange: (ready: boolean, err: string | null) => void;
  onGoCheckout: () => void;
  onSubmit: () => void;
}) {
  return activeSession ? (
    <div className="bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
      <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-amber-200 shadow-inner">
        <i className="fa-solid fa-lock" />
      </div>
      <div className="max-w-md mx-auto space-y-1.5">
        <span className="inline-block bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide">
          🔴 Sedang On Air
        </span>
        <h3 className="text-base font-black text-slate-900">Tab Check-In Terkunci</h3>
        <p className="text-xs text-slate-600">
          Anda telah melakukan check-in untuk sesi <strong>{activeSession.jadwal?.idJadwal ?? "Live"}</strong> {activeSession.jadwal?.client?.namaClient ? `(${activeSession.jadwal.client.namaClient})` : ""}.
        </p>
        <p className="text-[11px] text-slate-500">
          Tab Check-In dinonaktifkan sementara sampai jam siaran berakhir dan Anda menyelesaikan Check-Out pada tab Check-Out.
        </p>
      </div>
      <div className="pt-2">
        <button
          type="button"
          onClick={onGoCheckout}
          className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-md inline-flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-right-from-bracket" />
          <span>Menuju Form Check-Out</span>
        </button>
      </div>
    </div>
  ) : (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
      <h3 className="font-bold text-lg text-slate-900 mb-1 border-b border-slate-100 pb-2">Form Check-In Live</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Left: Jadwal selection + summary card */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Jadwal Anda *</label>
          <select
            value={selectedJadwalId}
            onChange={(e) => {
              const val = e.target.value;
              const found = jadwal.find((j) => j.id === val) ?? null;
              onSelectJadwalChange(val, found);
            }}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
            required
          >
            <option value="">-- Pilih Jadwal Siaran --</option>
            {jadwal
              .filter((j) => j.status !== "SELESAI" && j.liveState !== "CLOSED" && j.liveState !== "LIVE")
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.idJadwal} – {j.client?.namaClient ?? "Brand"} ({formatDateSafe(j.tanggal)} • {formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB)
                </option>
              ))}
          </select>

          {/* Dark card summary (matching ref-website-lama ciSummary) */}
          {selectedJadwalDetail && (
            <div className="mt-4 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full">
              <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Rangkuman Jadwal Terpilih</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">ID Jadwal</p>
                  <p className="text-sm font-bold text-[#FA3737]">{selectedJadwalDetail.idJadwal}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Tanggal</p>
                  <p className="text-sm font-bold text-white">{formatDateSafe(selectedJadwalDetail.tanggal, { weekday: "short", day: "numeric", month: "short" })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Waktu Live</p>
                  <p className="text-sm font-bold text-emerald-400">
                    {formatTimeSafe(selectedJadwalDetail.jamMulaiLive)}
                    {" – "}
                    {formatTimeSafe(selectedJadwalDetail.jamSelesaiLive)} WIB
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Brand / Client</p>
                  <p className="text-sm font-bold text-white">{selectedJadwalDetail.client?.namaClient ?? "–"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Platform</p>
                  <p className="text-sm font-bold text-white">{selectedJadwalDetail.platform ?? "–"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Lokasi Studio</p>
                  <p className="text-sm font-bold text-white">
                    {selectedJadwalDetail.studio || (selectedJadwalDetail.cabangStudio && selectedJadwalDetail.nomorStudio ? `Studio ${selectedJadwalDetail.cabangStudio} ${selectedJadwalDetail.nomorStudio.replace(/^Studio\s*/i, "")}` : (selectedJadwalDetail.nomorStudio || selectedJadwalDetail.cabangStudio || "–"))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Direct Live Camera + Location + dynamic late reason */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>Foto Masuk (Kamera Langsung & Lokasi GPS) *</span>
            <span className="text-[11px] text-[#941A0B] font-semibold">Wajib Kamera & Lokasi</span>
          </label>
          <LiveCameraCheckin
            value={fotoBuktiUrl}
            onChange={onFotoBuktiChange}
            onLocationChange={onLocationChange}
            disabled={!selectedJadwalId}
            disabledMessage="Pilih jadwal siaran live di samping kiri terlebih dahulu untuk mengaktifkan kamera."
            onCameraStatusChange={onCameraStatusChange}
          />

          {(() => {
            const lateStatus = getLateCheckInStatus(selectedJadwalDetail);
            if (!selectedJadwalDetail) {
              return (
                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Alasan Terlambat (Opsional)</label>
                  <textarea
                    value={alasanTerlambat}
                    onChange={(e) => onAlasanTerlambatChange(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none bg-slate-50"
                    rows={2}
                    placeholder="Pilih jadwal siaran terlebih dahulu..."
                  />
                </div>
              );
            }

            if (lateStatus.isLate) {
              return (
                <div className="mt-4 bg-red-50/80 border border-red-200 p-4 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-red-800 flex items-center gap-1.5">
                      <span>⚠️ Alasan Terlambat (Wajib Diisi)</span>
                      <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Wajib</span>
                    </label>
                    <span className="text-[11px] font-bold text-red-700 font-mono bg-red-100 px-2.5 py-0.5 rounded-md">
                      Terlambat {lateStatus.lateDurationText}
                    </span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-tight">
                    Waktu saat ini sudah melewati jadwal siaran (<strong>{lateStatus.scheduledTimeText} WIB</strong>). Harap isi alasan keterlambatan Anda.
                  </p>
                  <textarea
                    value={alasanTerlambat}
                    onChange={(e) => onAlasanTerlambatChange(e.target.value)}
                    className="w-full border border-red-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 outline-none bg-white font-medium shadow-inner"
                    rows={2}
                    placeholder="Contoh: Kendala macet di jalan / persiapan alat studio..."
                    required
                  />
                </div>
              );
            }

            return (
              <div className="mt-4 bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>✅ Presensi Tepat Waktu</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded-md">
                    Jadwal: {lateStatus.scheduledTimeText} WIB
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-tight">
                  Anda melakukan check-in tepat waktu sebelum jam siaran dimulai. Alasan keterlambatan tidak diperlukan.
                </p>
                <textarea
                  value={alasanTerlambat}
                  onChange={(e) => onAlasanTerlambatChange(e.target.value)}
                  className="w-full border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  rows={2}
                  placeholder="Catatan tambahan (Opsional)..."
                />
              </div>
            );
          })()}
        </div>
      </div>

      {activeSession && (
        <div className="mt-4 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
          <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" /> Absensi Terusan Terdeteksi
          </label>
          <p className="text-[10px] text-amber-700">
            Anda belum melakukan check-out untuk sesi sebelumnya. Sistem akan <strong>otomatis menutup sesi sebelumnya</strong>. Laporan GMV dapat dilengkapi di tab History.
          </p>
        </div>
      )}

      <div className="border-t border-slate-100 pt-5 mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={
            actionLoading ||
            !selectedJadwalId ||
            !fotoBuktiUrl ||
            !checkInLocation ||
            !hasCamera ||
            !!cameraError
          }
          className="bg-[#941A0B] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#781408] transition shadow-md w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-cloud-arrow-up mr-1" />
          <span>
            {actionLoading
              ? "Memproses Presensi..."
              : !hasCamera
              ? "Kamera Wajib Tersedia"
              : !fotoBuktiUrl
              ? "Ambil Foto Terlebih Dahulu"
              : !checkInLocation
              ? "Menunggu Lokasi GPS..."
              : "Submit Check-In"}
          </span>
        </button>
      </div>
    </div>
  );
}