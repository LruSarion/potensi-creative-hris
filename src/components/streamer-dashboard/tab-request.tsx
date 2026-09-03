"use client";

// Request tab of the streamer dashboard — restructured to match ref-deploy
// streamer-dashboard.html tab-request (baris 659-827):
// - Kategori: Libur | Sesi Live
// - Libur  -> sub-tab Jadwal Libur (kalender bulan) | Pengajuan (form + Cek Libur Terakhir)
// - Sesi   -> sub-tab History | Pengajuan Sesi
// Versi lama (requestSubTab "libur"|"sesi") dipertahankan sebagai komentar TODO(ref-deploy-request).

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

export type LiburCalendarEntry = {
  id: string;
  tanggal: string;
  alasan?: string | null;
};

export type ReqCategory = "libur" | "sesilive";
export type ReqSub = "jadwal" | "pengajuan" | "history";

const DAY_LABELS = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

/** yyyy-mm-dd lokal (tanpa konversi timezone). */
function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Bulan YYYY" (periode label) -> Date awal bulan. */
function parseBulanLabel(label: string): Date | null {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const m = /^(\w+)\s+(\d{4})$/.exec(label.trim());
  if (!m) return null;
  const idx = months.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (idx === -1) return null;
  return new Date(Number(m[2]), idx, 1);
}

export function TabRequest({
  requestStatus,
  // TODO(ref-deploy-request): struktur lama — requestSubTab diganti reqCategory/reqSub.
  // requestSubTab,
  reqCategory,
  reqSubLibur,
  reqSubSesi,
  onReqCategoryChange,
  onReqSubLiburChange,
  onReqSubSesiChange,
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
  liburCalendar,
  cekLiburMsg,
  onCekLibur,
}: {
  requestStatus: RequestStatus | null;
  // requestSubTab: "libur" | "sesi";
  reqCategory: ReqCategory;
  reqSubLibur: "jadwal" | "pengajuan";
  reqSubSesi: "history" | "pengajuan";
  onReqCategoryChange: (c: ReqCategory) => void;
  onReqSubLiburChange: (s: "jadwal" | "pengajuan") => void;
  onReqSubSesiChange: (s: "history" | "pengajuan") => void;
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
  liburCalendar: LiburCalendarEntry[];
  cekLiburMsg: string | null;
  onCekLibur: () => void;
}) {
  // Kalender bulan yang ditampilkan — mengikuti tanggal pengajuan (leaveDate) atau bulan berjalan.
  const calBase = (leaveDate && parseBulanLabel(leaveDate) === null && !isNaN(new Date(leaveDate).getTime()))
    ? new Date(leaveDate)
    : new Date();
  const calYear = calBase.getFullYear();
  const calMonth = calBase.getMonth();
  const monthLabel = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][calMonth];

  const liburByDate = new Set(liburCalendar.map((l) => toLocalYMD(new Date(l.tanggal))));

  // Sel kalender: mulai Minggu (grid 7 kolom, ref-deploy MIN..SAB).
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Minggu
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));

  return (
    <div className="space-y-6">
      {/* Header & Quota Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-code-pull-request text-blue-500" />
              Pengajuan Streamer
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

        {/* Kategori: Libur | Sesi Live (ref-deploy switchReqCategory) */}
        <div className="flex gap-2 border-b border-slate-100 pt-5 pb-1">
          <button
            type="button"
            onClick={() => onReqCategoryChange("libur")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
              reqCategory === "libur"
                ? "text-white bg-blue-600 shadow"
                : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            Libur
          </button>
          <button
            type="button"
            onClick={() => onReqCategoryChange("sesilive")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
              reqCategory === "sesilive"
                ? "text-white bg-blue-600 shadow"
                : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            Sesi Live
          </button>
        </div>

        {/* ================= KATEGORI: LIBUR ================= */}
        {reqCategory === "libur" && (
          <div className="pt-4">
            {/* Sub-tab Libur: Jadwal Libur | Pengajuan (ref-deploy switchReqSub) */}
            <div className="flex gap-2 mb-5 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => onReqSubLiburChange("jadwal")}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
                  reqSubLibur === "jadwal"
                    ? "text-white bg-blue-600 shadow"
                    : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                Jadwal Libur
              </button>
              <button
                type="button"
                onClick={() => onReqSubLiburChange("pengajuan")}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
                  reqSubLibur === "pengajuan"
                    ? "text-white bg-blue-600 shadow"
                    : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                Pengajuan
              </button>
            </div>

            {/* --- SUB-TAB: JADWAL LIBUR (KALENDER BULAN — ref-deploy calendarGrid) --- */}
            {reqSubLibur === "jadwal" && (
              <div>
                <h4 className="font-bold text-slate-800 text-lg mb-3">
                  {monthLabel} {calYear}
                </h4>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-500">
                  {DAY_LABELS.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                  {cells.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} />;
                    const ymd = toLocalYMD(d);
                    const isLibur = liburByDate.has(ymd);
                    const isToday = ymd === toLocalYMD(new Date());
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => {
                          onLeaveDateChange(ymd);
                          onReqSubLiburChange("pengajuan");
                        }}
                        title={isLibur ? "Tanggal libur Anda" : undefined}
                        className={`relative aspect-square sm:rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center ${
                          isLibur
                            ? "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                            : isToday
                            ? "bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {d.getDate()}
                        {isLibur && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Klik tanggal untuk mengajukan libur pada hari tersebut.
                </p>
              </div>
            )}

            {/* --- SUB-TAB: PENGAJUAN LIBUR (FORM + CEK LIBUR TERAKHIR) --- */}
            {reqSubLibur === "pengajuan" && (
              <div className="space-y-4">
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

                    {/* Tombol Cek Libur Terakhir (ref-deploy cekLiburMingguan) */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={onCekLibur}
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-xl transition shadow-sm text-xs flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-magnifying-glass" />
                        <span>Cek Libur Terakhir</span>
                      </button>
                      <button
                        type="submit"
                        disabled={submittingRequest || !leaveDate}
                        className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-md shadow-[#941A0B]/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {submittingRequest ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                        <span>{submittingRequest ? "Mengirim..." : "Ajukan Libur"}</span>
                      </button>
                    </div>

                    {/* Hasil Cek Libur (ref-deploy msgCekLiburContainer) */}
                    {cekLiburMsg && (
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-center text-xs font-bold text-blue-800">
                        {cekLiburMsg}
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
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= KATEGORI: SESI LIVE ================= */}
        {reqCategory === "sesilive" && (
          <div className="pt-4">
            {/* Sub-tab Sesi: History | Pengajuan Sesi (ref-deploy switchReqSub) */}
            <div className="flex gap-2 mb-5 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => onReqSubSesiChange("history")}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
                  reqSubSesi === "history"
                    ? "text-white bg-blue-600 shadow"
                    : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                History
              </button>
              <button
                type="button"
                onClick={() => onReqSubSesiChange("pengajuan")}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition whitespace-nowrap ${
                  reqSubSesi === "pengajuan"
                    ? "text-white bg-blue-600 shadow"
                    : "text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                Pengajuan Sesi
              </button>
            </div>

            {/* --- SUB-TAB: PENGAJUAN SESI (FORM) --- */}
            {reqSubSesi === "pengajuan" && (
              <div className="space-y-4">
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

            {/* --- SUB-TAB: HISTORY PENGAJUAN SESI --- */}
            {reqSubSesi === "history" && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
                    {requestStatus && requestStatus.shiftRequests.length > 0 ? (
                      requestStatus.shiftRequests.map((s) => (
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                          Belum ada riwayat request sesi live.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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