"use client";

// Request tab of the streamer dashboard: leave requests, live-session
// preferences, submission history, and portal links.
// Extracted verbatim from page.tsx (refactor only — markup and behavior unchanged).

import Link from "next/link";
import { formatDateSafe } from "@/lib/utils/date-format";

export type RequestStatus = {
  sisaKuotaLibur?: number;
  defaultKuotaLibur?: number;
  sisaKuotaShift?: number;
  defaultKuotaShift?: number;
  allowLiburRequest?: boolean;
  allowShiftRequest?: boolean;
  leaveRequests: {
    id: string;
    tanggalMulai: string;
    alasan?: string | null;
    status: string;
  }[];
  shiftRequests: {
    id: string;
    tanggalMulai: string;
    jenis?: string | null;
    alasan?: string | null;
    status: string;
  }[];
};

export function TabRequest({
  requestStatus,
  requestSubTab,
  onRequestSubTabChange,
  leaveDate,
  onLeaveDateChange,
  leaveReason,
  onLeaveReasonChange,
  hasScheduleConflict,
  conflictingJadwal,
  onLeaveSubmit,
  shiftDate,
  onShiftDateChange,
  selectedSesi,
  onSelectedSesiChange,
  shiftNote,
  onShiftNoteChange,
  onShiftSubmit,
  submittingRequest,
}: {
  requestStatus: RequestStatus | null;
  requestSubTab: "libur" | "sesi";
  onRequestSubTabChange: (t: "libur" | "sesi") => void;
  leaveDate: string;
  onLeaveDateChange: (v: string) => void;
  leaveReason: string;
  onLeaveReasonChange: (v: string) => void;
  hasScheduleConflict: boolean;
  conflictingJadwal: { idJadwal?: string; platform?: string | null } | null;
  onLeaveSubmit: (e: React.FormEvent) => void;
  shiftDate: string;
  onShiftDateChange: (v: string) => void;
  selectedSesi: "SESI_1" | "SESI_2" | "SESI_3";
  onSelectedSesiChange: (s: "SESI_1" | "SESI_2" | "SESI_3") => void;
  shiftNote: string;
  onShiftNoteChange: (v: string) => void;
  onShiftSubmit: (e: React.FormEvent) => void;
  submittingRequest: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header & Quota Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-file-pen text-[#941A0B]" />
              Pusat Pengajuan Streamer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ajukan permohonan Libur dan preferensi Request Sesi Live siaran.
            </p>
          </div>

          {/* Quota Indicators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#941A0B]/10 border border-[#941A0B]/20 rounded-xl px-3.5 py-2">
              <div className="text-[10px] uppercase font-bold text-[#941A0B]">Sisa Kuota Libur</div>
              <div className="text-sm font-bold text-[#000000]">
                {requestStatus ? `${requestStatus.sisaKuotaLibur} / ${requestStatus.defaultKuotaLibur} Hari` : "Memuat..."}
              </div>
            </div>
            <div className="bg-[#941A0B]/10 border border-[#941A0B]/20 rounded-xl px-3.5 py-2">
              <div className="text-[10px] uppercase font-bold text-[#941A0B]">Sisa Kuota Sesi</div>
              <div className="text-sm font-bold text-[#000000]">
                {requestStatus ? `${requestStatus.sisaKuotaShift} / ${requestStatus.defaultKuotaShift} Kali` : "Memuat..."}
              </div>
            </div>
          </div>
        </div>

        {/* Form Toggle Off Banners */}
        {requestStatus && (!requestStatus.allowLiburRequest || !requestStatus.allowShiftRequest) && (
          <div className="mt-4 space-y-2">
            {!requestStatus.allowLiburRequest && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <i className="fa-solid fa-lock text-amber-600" />
                <span><strong>Form Pengajuan Libur Ditutup:</strong> Tim Manajemen sedang menutup akses pengajuan libur sementara.</span>
              </div>
            )}
            {!requestStatus.allowShiftRequest && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <i className="fa-solid fa-lock text-amber-600" />
                <span><strong>Form Request Sesi Live Ditutup:</strong> Tim Manajemen sedang menutup akses request sesi live sementara.</span>
              </div>
            )}
          </div>
        )}

        {/* Request Type Sub-tabs */}
        <div className="flex gap-2 border-b border-slate-100 pt-5 pb-1">
          <button
            type="button"
            onClick={() => onRequestSubTabChange("libur")}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              requestSubTab === "libur"
                ? "border-[#941A0B] text-[#941A0B]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-calendar-xmark" />
            <span>Pengajuan Libur</span>
          </button>
          <button
            type="button"
            onClick={() => onRequestSubTabChange("sesi")}
            className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              requestSubTab === "sesi"
                ? "border-[#941A0B] text-[#941A0B]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-video" />
            <span>Request Sesi Live (3 Shift)</span>
          </button>
        </div>

        {/* Form 1: Pengajuan Libur */}
        {requestSubTab === "libur" && (
          <div className="pt-5 space-y-4">
            {requestStatus?.allowLiburRequest === false ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                <i className="fa-solid fa-ban text-3xl text-slate-300 block mb-2" />
                Pengajuan Libur saat ini sedang dinonaktifkan oleh Eksekutif.
              </div>
            ) : (
              <form onSubmit={onLeaveSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tanggal Libur yang Diajukan *
                    </label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => onLeaveDateChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Alasan Libur
                    </label>
                    <input
                      type="text"
                      value={leaveReason}
                      onChange={(e) => onLeaveReasonChange(e.target.value)}
                      placeholder="mis. Keperluan keluarga, istirahat..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Conflict Warning if schedule exists */}
                {hasScheduleConflict && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5" />
                    <div>
                      <strong>Peringatan Jadwal Live Terjadwal:</strong> Anda sudah memiliki sesi live aktif pada tanggal ini ({conflictingJadwal?.idJadwal} - {conflictingJadwal?.platform}).
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Pengajuan tetap dapat dikirimkan dan akan masuk status <strong>Menunggu Persetujuan Eksekutif</strong>.
                      </div>
                    </div>
                  </div>
                )}

                {/* Syarat dan Ketentuan Request Libur */}
                <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-slate-800 space-y-2.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
                    <span>Syarat dan Ketentuan Request Libur:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-medium pl-5 list-disc marker:text-amber-500 leading-relaxed">
                    <li>Setiap streamer berhak libur 1 kali setiap periode minggu.</li>
                    <li>Periode minggu terhitung mulai dari hari Senin sampai Minggu.</li>
                    <li><strong className="text-red-600 font-bold">Double date</strong> dan <strong className="text-red-600 font-bold">payday</strong> tidak boleh libur.</li>
                    <li>Pengajuan libur yang sudah terkirim tidak bisa dirubah.</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingRequest || !leaveDate}
                    className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-[#941A0B]/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {submittingRequest ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                    <span>{submittingRequest ? "Mengirim..." : "Kirim Pengajuan Libur"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Form 2: Request Sesi Live (3 Sesi Shift) */}
        {requestSubTab === "sesi" && (
          <div className="pt-5 space-y-4">
            {requestStatus?.allowShiftRequest === false ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                <i className="fa-solid fa-ban text-3xl text-slate-300 block mb-2" />
                Request Sesi Live saat ini sedang dinonaktifkan oleh Eksekutif.
              </div>
            ) : (
              <form onSubmit={onShiftSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tanggal Sesi *
                    </label>
                    <input
                      type="date"
                      value={shiftDate}
                      onChange={(e) => onShiftDateChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pilihan Sesi Live (Shift 24 Jam) *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "SESI_1", label: "Sesi 1", time: "00:00 - 08:00", icon: "fa-moon" },
                        { key: "SESI_2", label: "Sesi 2", time: "08:00 - 16:00", icon: "fa-sun" },
                        { key: "SESI_3", label: "Sesi 3", time: "16:00 - 00:00", icon: "fa-cloud-sun" },
                      ].map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => onSelectedSesiChange(s.key as "SESI_1" | "SESI_2" | "SESI_3")}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            selectedSesi === s.key
                              ? "border-[#941A0B] bg-[#941A0B]/10 text-[#000000] ring-2 ring-[#941A0B]/20"
                              : "border-slate-200 hover:border-[#941A0B]/20 text-slate-700 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <i className={`fa-solid ${s.icon} text-[#941A0B]`} />
                            <span>{s.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.time}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={shiftNote}
                    onChange={(e) => onShiftNoteChange(e.target.value)}
                    placeholder="mis. Request sesi pagi karena kuliah sore..."
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingRequest || !shiftDate}
                    className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-[#941A0B]/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submittingRequest ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                    <span>{submittingRequest ? "Mengirim..." : "Kirim Request Sesi Live"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Riwayat Pengajuan Streamer */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-500" />
            Riwayat Pengajuan Libur & Sesi Live Bulan Ini
          </h4>
          <span className="text-xs text-slate-400 font-mono">
            {((requestStatus?.leaveRequests?.length ?? 0) + (requestStatus?.shiftRequests?.length ?? 0))} Pengajuan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tanggal Pengajuan</th>
                <th className="px-4 py-3">Tipe Permohonan</th>
                <th className="px-4 py-3">Keterangan / Detail</th>
                <th className="px-4 py-3">Status Persetujuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requestStatus && (requestStatus.leaveRequests.length > 0 || requestStatus.shiftRequests.length > 0) ? (
                <>
                  {requestStatus.leaveRequests.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {formatDateSafe(l.tanggalMulai, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#941A0B]/10 text-[#941A0B] border border-[#941A0B]/20">
                          🏖️ Libur Streamer
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{l.alasan || "–"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          l.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : l.status === "REJECTED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {l.status === "APPROVED" ? "Disetujui" : l.status === "REJECTED" ? "Ditolak" : "Menunggu Approval"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {requestStatus.shiftRequests.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {formatDateSafe(s.tanggalMulai, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#941A0B]/10 text-[#941A0B] border border-[#941A0B]/20">
                          📹 {s.jenis?.replace("REQUEST_", "") || "Sesi Live"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.alasan || "–"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.status === "REJECTED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {s.status === "APPROVED" ? "Disetujui" : s.status === "REJECTED" ? "Ditolak" : "Menunggu Approval"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                    Belum ada riwayat pengajuan libur atau request sesi live.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Other Portal Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/tukar-shift"
          className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#941A0B] hover:bg-[#941A0B]/10/40 transition group text-center shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#941A0B]/15 text-[#941A0B] flex items-center justify-center text-lg group-hover:scale-110 transition">
            <i className="fa-solid fa-right-left" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-xs group-hover:text-[#941A0B]">Tukar Shift</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Penggantian jadwal live streaming</div>
          </div>
        </Link>

        <Link
          href="/pengajuan-izin"
          className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50/40 transition group text-center shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg group-hover:scale-110 transition">
            <i className="fa-solid fa-file-signature" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-xs group-hover:text-amber-700">Pengajuan Izin / Cuti</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Sakit, cuti tahunan, atau keperluan</div>
          </div>
        </Link>

        <Link
          href="/pengajuan-lembur"
          className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#941A0B] hover:bg-[#941A0B]/10/40 transition group text-center shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#941A0B]/15 text-[#941A0B] flex items-center justify-center text-lg group-hover:scale-110 transition">
            <i className="fa-regular fa-clock" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-xs group-hover:text-[#941A0B]">Pengajuan Lembur</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Tambahan jam siaran (1.5x rate)</div>
          </div>
        </Link>
      </div>
    </div>
  );
}