"use client";

// Request tab of the streamer dashboard — restructured to match ref-deploy
// streamer-dashboard.html tab-request (baris 659-827):
// - Kategori: Libur | Sesi Live
// - Libur  -> sub-tab Jadwal Libur (kalender bulan) | Pengajuan (form + Cek Libur Terakhir)
// - Sesi   -> sub-tab History | Pengajuan Sesi
// Versi lama (requestSubTab "libur"|"sesi") dipertahankan sebagai komentar TODO(ref-deploy-request).

import { useEffect, useState } from "react";
import { formatDateSafe } from "@/lib/utils/date-format";

export type ShiftFormEntry = {
  id: number;
  tanggal: string;
  shift: string;
  expanded: boolean;
};

export type KuotaCheckResult = {
  ok: boolean;
  message: string;
};

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
  onLeaveSubmit,
  shiftForms,
  shiftLoading,
  kuotaCheckResult,
  onToggleShiftForm,
  onShiftFormDateChange,
  onShiftFormShiftChange,
  onAddShiftForm,
  onRemoveShiftForm,
  onCekKuotaMingguan,
  onShiftSubmit,
  submittingRequest,
  liburCalendar,
  cekLiburMsg,
  cekLiburOk,
  onCekLibur,
  shiftAvailByForm,
  kuotaMap,
  liburDetail,
  onLiburCalMonthChange,
  onLiburDateSelect,
  onLiburDetailAjukan,
  isStreamer,
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
  onLeaveSubmit: (e: React.FormEvent) => void;
  shiftForms: ShiftFormEntry[];
  shiftLoading: boolean;
  kuotaCheckResult: KuotaCheckResult | null;
  onToggleShiftForm: (id: number) => void;
  onShiftFormDateChange: (id: number, v: string) => void;
  onShiftFormShiftChange: (id: number, v: string) => void;
  onAddShiftForm: () => void;
  onRemoveShiftForm: (id: number) => void;
  onCekKuotaMingguan: () => void;
  onShiftSubmit: () => void;
  submittingRequest: boolean;
  liburCalendar: LiburCalendarEntry[];
  cekLiburMsg: string | null;
  cekLiburOk: boolean;
  onCekLibur: () => void;
  shiftAvailByForm: Record<number, { sesi: string; label: string; sisa: number }[]>;
  kuotaMap: Record<string, { kuota: number; sisa: number; blackout: boolean }>;
  liburDetail: {
    tanggal: string; kuota: number; terpakai: number; sisa: number;
    blackout: boolean; blackoutKind: string | null; kebutuhanJam: number;
  } | null;
  onLiburCalMonthChange: (yyyyMM: string) => void;
  onLiburDateSelect: (ymd: string) => void;
  onLiburDetailAjukan: () => void;
  isStreamer: boolean;
}) {
  // Kalender ala ref-deploy: offset ±1 bulan dari hari ini (guardrail, tombol hilang di batas)
  const [calOffset, setCalOffset] = useState(0);
  // Shift history calendar — separate offset
  const [shiftCalOffset, setShiftCalOffset] = useState(0);
  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);
  const calBase = new Date(todayBase.getFullYear(), todayBase.getMonth() + calOffset, 1);
  const calYear = calBase.getFullYear();
  const calMonth = calBase.getMonth();
  const monthLabel = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][calMonth];
  const canGoPrev = calOffset > -1;
  const canGoNext = calOffset < 1;

  const liburByDate = new Set(liburCalendar.map((l) => toLocalYMD(new Date(l.tanggal))));

  // Beri tahu parent bulan kalender yang tampil agar peta kuota diambil
  useEffect(() => {
    onLiburCalMonthChange(`${calYear}-${String(calMonth + 1).padStart(2, "0")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calYear, calMonth]);

  // Sel kalender: mulai Minggu (grid 7 kolom, ref-deploy MIN..SAB).
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Minggu
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));

  return (
    <div className="space-y-6">
      {/* Header — tanpa quota overview (sesuai ref-deploy) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-code-pull-request text-blue-500" />
              Pengajuan Streamer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ajukan permohonan Libur dan preferensi Request Sesi Live siaran.
            </p>
          </div>
          {/* Kategori: Libur | Sesi Live (ref-deploy switchReqCategory) */}
          <div className="flex gap-2">
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

            {/* --- SUB-TAB: JADWAL LIBUR (KALENDER BULAN — ref-deploy calendarGrid, cell 60/80px + nav ±1 bulan) --- */}
            {reqSubLibur === "jadwal" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalOffset((c) => c - 1)}
                    className={`bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg transition ${!canGoPrev ? "hidden" : ""}`}
                    aria-label="Bulan sebelumnya"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <h4 className="font-bold text-slate-800 text-lg">{monthLabel} {calYear}</h4>
                  <button
                    type="button"
                    onClick={() => setCalOffset((c) => c + 1)}
                    className={`bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg transition ${!canGoNext ? "hidden" : ""}`}
                    aria-label="Bulan berikutnya"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-500">
                  {DAY_LABELS.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                  {cells.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} className="bg-slate-50/30 rounded-lg border border-transparent p-2 min-h-[60px] sm:min-h-[80px]" />;
                    const ymd = toLocalYMD(d);
                    const isLibur = liburByDate.has(ymd);
                    const isToday = ymd === toLocalYMD(new Date());
                    const q = kuotaMap[ymd];
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => onLiburDateSelect(ymd)}
                        title={isLibur ? "Tanggal libur Anda — klik untuk detail kuota" : "Klik untuk detail kuota"}
                        className={`border rounded-lg p-1 sm:p-2 min-h-[60px] sm:min-h-[80px] transition-colors relative flex flex-col ${
                          isLibur
                            ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                            : isToday
                            ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-right font-black text-xs sm:text-sm w-full">{d.getDate()}</div>
                        {isLibur && (
                          <div className="mt-1 flex justify-center">
                            <span className="bg-[#941A0B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Libur</span>
                          </div>
                        )}
                        {q && (
                          <div className="mt-1 flex justify-center">
                            {q.blackout ? (
                              <span className="bg-slate-200 text-slate-600 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full">Blackout</span>
                            ) : q.sisa > 0 ? (
                              <span className="bg-emerald-100 text-emerald-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full">Sisa {q.sisa}</span>
                            ) : (
                              <span className="bg-red-100 text-red-600 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full">Penuh</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Klik tanggal untuk melihat detail kuota & sisa slot hari tersebut.
                </p>
                {/* Detail kuota tanggal terpilih */}
                {liburDetail && (
                  <div className="mt-4 bg-[#941A0B]/5 border border-[#941A0B]/20 rounded-xl p-4 text-sm">
                    <div className="font-bold text-[#941A0B] mb-2">
                      <i className="fa-solid fa-calendar-day mr-2" />
                      Detail {liburDetail.tanggal}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-white rounded-lg border border-slate-200 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">KUOTA</div>
                        <div className="font-black text-slate-800">{liburDetail.kuota}</div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">TERPAKAI</div>
                        <div className="font-black text-slate-800">{liburDetail.terpakai}</div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-2">
                        <div className="text-[10px] text-slate-500 font-bold">SISA</div>
                        <div className={`font-black ${liburDetail.sisa > 0 ? "text-emerald-600" : "text-red-600"}`}>{liburDetail.sisa}</div>
                      </div>
                    </div>
                    {liburDetail.blackout && (
                      <p className="text-xs font-bold text-red-600 mb-2">
                        <i className="fa-solid fa-ban mr-1" />
                        Blackout{liburDetail.blackoutKind === "DOUBLE_DATE" ? " (double date)" : liburDetail.blackoutKind === "PAYDAY" ? " (payday)" : ""} — tidak boleh libur.
                      </p>
                    )}
                    {!liburDetail.blackout && liburDetail.sisa > 0 && (
                      <button
                        type="button"
                        onClick={onLiburDetailAjukan}
                        className="w-full bg-[#941A0B] hover:bg-[#781408] text-white font-bold py-2 rounded-lg transition text-xs"
                      >
                        <i className="fa-solid fa-paper-plane mr-2" />
                        Ajukan Libur Tanggal Ini
                      </button>
                    )}
                  </div>
                )}
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
                  <>
                    {/* Form container — constrained width, themed bg */}
                    <div className="bg-[#941A0B]/5 border border-[#941A0B]/20 rounded-xl p-5 w-full md:w-2/3 lg:w-1/2">
                      {/* Date input */}
                      <label className="block text-sm font-bold text-[#941A0B] mb-2">
                        Pilih Tanggal Pengajuan Libur
                      </label>
                      <input
                        type="date"
                        value={leaveDate}
                        onChange={(e) => onLeaveDateChange(e.target.value)}
                        disabled={!isStreamer}
                        placeholder={isStreamer ? undefined : "Akses Terkunci (Hanya Streamer)"}
                        className="w-full border border-[#941A0B]/30 rounded-lg px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]/50 mb-4 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        required
                      />

                      {/* Cek Libur Terakhir button */}
                      <button
                        type="button"
                        onClick={onCekLibur}
                        disabled={!isStreamer || !leaveDate}
                        className={`w-full font-bold py-3 rounded-lg transition shadow-md mb-3 disabled:cursor-not-allowed text-sm ${
                          !isStreamer
                            ? "bg-slate-200 text-slate-400"
                            : "bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                        }`}
                      >
                        <i className={`fa-solid ${isStreamer ? "fa-magnifying-glass" : "fa-lock"} mr-2`} />
                        {!isStreamer ? "Hanya Untuk Streamer" : "Cek Libur Terakhir"}
                      </button>

                      {/* Hasil Cek Libur — dynamic color */}
                      {cekLiburMsg && (
                        <div className={`p-3 rounded-lg border mb-4 text-center text-sm font-bold ${
                          cekLiburOk
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-red-50 border-red-300 text-red-700"
                        }`}>
                          <i className={`fa-solid ${cekLiburOk ? "fa-circle-check" : "fa-circle-xmark"} mr-2`} />
                          {cekLiburMsg}
                        </div>
                      )}

                      {/* Submit button — gated behind cek libur */}
                      <button
                        type="button"
                        onClick={(e) => onLeaveSubmit(e as unknown as React.FormEvent)}
                        disabled={!cekLiburOk || submittingRequest}
                        className={`w-full font-bold py-3 rounded-lg transition shadow-md text-sm ${
                          cekLiburOk
                            ? "bg-[#941A0B] hover:bg-[#781408] text-white cursor-pointer"
                            : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        } disabled:opacity-50`}
                      >
                        {submittingRequest ? (
                          <><i className="fa-solid fa-spinner animate-spin mr-2" />Memproses...</>
                        ) : (
                          <><i className="fa-solid fa-paper-plane mr-2" />Ajukan Libur</>
                        )}
                      </button>
                    </div>

                    {/* S&K Box — outside form container, matching width */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 w-full md:w-2/3 lg:w-1/2 shadow-sm">
                      <h4 className="font-bold text-red-800 text-sm mb-3 border-b border-red-200 pb-2">
                        <i className="fa-solid fa-circle-exclamation mr-2" />
                        Syarat dan Ketentuan Request Libur:
                      </h4>
                      <ul className="list-decimal list-inside text-xs font-medium text-red-700 space-y-1.5 leading-relaxed pl-1">
                        <li>Setiap streamer berhak libur 1 kali setiap periode minggu.</li>
                        <li>Periode minggu terhitung mulai dari hari Senin sampai Minggu.</li>
                        <li>Double date dan payday tidak boleh libur.</li>
                        <li>Pengajuan libur yang sudah terkirim tidak bisa dirubah.</li>
                      </ul>
                    </div>
                  </>
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

            {/* --- SUB-TAB: PENGAJUAN SESI (MULTI-FORM ACCORDION) --- */}
            {reqSubSesi === "pengajuan" && (
              <div className="space-y-4">
                {requestStatus?.allowShiftRequest === false ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    <i className="fa-solid fa-ban text-3xl text-slate-300 block mb-2" />
                    Request Sesi Live saat ini sedang dinonaktifkan oleh Eksekutif.
                  </div>
                ) : (
                  <>
                    {/* Multi-form accordion container */}
                    <div className="bg-[#941A0B]/5 border border-[#941A0B]/20 rounded-xl p-5 w-full md:w-2/3 lg:w-1/2">
                      {/* Loading state */}
                      {shiftLoading && (
                        <div className="mb-4 text-[#941A0B] font-bold text-sm flex items-center gap-2">
                          <i className="fa-solid fa-spinner animate-spin" />
                          Sedang menyinkronkan data ketersediaan jadwal...
                        </div>
                      )}

                      {/* Dynamic accordion forms */}
                      {!shiftLoading && shiftForms.map((form, idx) => (
                        <div key={form.id}>
                          {/* Separator between forms */}
                          {idx > 0 && (
                            <hr className="border-[#941A0B]/20 border-dashed my-4" />
                          )}
                          <div className="bg-white border border-[#941A0B]/30 rounded-lg transition-all">
                            {/* Accordion header */}
                            <button
                              type="button"
                              onClick={() => onToggleShiftForm(form.id)}
                              className="cursor-pointer w-full flex justify-between items-center font-bold text-[#941A0B] bg-[#941A0B]/5 p-4 border-b border-[#941A0B]/20 rounded-t-lg text-sm"
                            >
                              <span>
                                Form {idx + 1}: {form.tanggal && form.shift
                                  ? `${form.tanggal} — ${form.shift}`
                                  : "Belum Diisi"}
                              </span>
                              <i className={`fa-solid fa-chevron-${form.expanded ? "up" : "down"} text-xs`} />
                            </button>

                            {/* Form fields */}
                            {form.expanded && (
                              <div className="p-4">
                                {/* Date input */}
                                <label className="block text-sm font-bold text-[#941A0B] mb-2">
                                  Pilih Tanggal
                                </label>
                                <input
                                  type="date"
                                  value={form.tanggal}
                                  onChange={(e) => onShiftFormDateChange(form.id, e.target.value)}
                                  className="w-full border border-[#941A0B]/30 rounded-lg px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]/50"
                                />

                                {/* Shift select — visible after date selected (dinamis dari API kuota) */}
                                {form.tanggal && (() => {
                                  const SHIFT_OPTS = [
                                    { value: "00:00 - 08:00", label: "00:00 - 08:00 WIB", sesi: "SESI_1" },
                                    { value: "08:00 - 16:00", label: "08:00 - 16:00 WIB", sesi: "SESI_2" },
                                    { value: "16:00 - 00:00", label: "16:00 - 00:00 WIB", sesi: "SESI_3" },
                                  ];
                                  const avail = shiftAvailByForm[form.id];
                                  const opts = avail
                                    ? SHIFT_OPTS
                                        .map((o) => ({ ...o, sisa: avail.find((a) => a.sesi === o.sesi)?.sisa ?? 0 }))
                                        .filter((o) => o.sisa > 0)
                                    : SHIFT_OPTS.map((o) => ({ ...o, sisa: -1 }));
                                  return (
                                  <div className="mt-4 transition-all">
                                    <label className="block text-sm font-bold text-[#941A0B] mb-2">
                                      Pilih Periode Jam / Shift
                                    </label>
                                    {avail && opts.length === 0 ? (
                                      <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                        <i className="fa-solid fa-circle-xmark mr-1" />
                                        Kuota request sesi penuh untuk tanggal ini.
                                      </p>
                                    ) : (
                                      <select
                                        value={form.shift}
                                        onChange={(e) => onShiftFormShiftChange(form.id, e.target.value)}
                                        className="w-full border border-[#941A0B]/30 rounded-lg px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]/50 mb-2"
                                      >
                                        <option value="">— Pilih Shift —</option>
                                        {opts.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}{o.sisa >= 0 ? ` (sisa ${o.sisa})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    {/* Hapus Form button */}
                                    {shiftForms.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => onRemoveShiftForm(form.id)}
                                        className="text-xs text-red-600 font-bold mt-2 hover:text-red-800 transition"
                                      >
                                        <i className="fa-solid fa-trash mr-1" />
                                        Hapus Form Ini
                                      </button>
                                    )}
                                  </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Cek Kuota Mingguan button */}
                      {shiftForms.some((f) => f.tanggal && f.shift) && (
                        <button
                          type="button"
                          onClick={onCekKuotaMingguan}
                          disabled={shiftLoading}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition shadow-md mt-4 mb-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <i className="fa-solid fa-magnifying-glass mr-2" />
                          Cek Kuota Mingguan
                        </button>
                      )}

                      {/* Info Kuota result */}
                      {kuotaCheckResult && (
                        <div className={`p-3 rounded-lg border mb-3 text-center text-sm font-bold ${
                          kuotaCheckResult.ok
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}>
                          <i className={`fa-solid ${kuotaCheckResult.ok ? "fa-circle-check" : "fa-circle-xmark"} mr-2`} />
                          {kuotaCheckResult.message}
                        </div>
                      )}

                      {/* Tambah Form button */}
                      <button
                        type="button"
                        onClick={onAddShiftForm}
                        disabled={shiftForms.length >= 3 || !kuotaCheckResult?.ok}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-[#941A0B] font-bold py-2 rounded-lg transition border border-[#941A0B]/30 mb-5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <i className="fa-solid fa-plus mr-2" />
                        Tambah Form Pengajuan (Maks. 3)
                      </button>

                      {/* Submit button */}
                      <button
                        type="button"
                        onClick={onShiftSubmit}
                        disabled={!kuotaCheckResult?.ok || submittingRequest}
                        className="w-full bg-[#941A0B] hover:bg-[#781408] text-white font-bold py-2.5 rounded-lg transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {submittingRequest ? (
                          <><i className="fa-solid fa-spinner animate-spin mr-2" />Mengirim...</>
                        ) : (
                          <><i className="fa-solid fa-paper-plane mr-2" />Ajukan Periode Sesi Live</>
                        )}
                      </button>
                    </div>

                    {/* S&K Box */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 w-full md:w-2/3 lg:w-1/2 shadow-sm">
                      <h4 className="font-bold text-red-800 text-sm mb-3 border-b border-red-200 pb-2">
                        <i className="fa-solid fa-circle-exclamation mr-2" />
                        Syarat dan Ketentuan Request Sesi Live:
                      </h4>
                      <ol className="list-decimal list-inside text-xs font-medium text-red-700 space-y-1.5 leading-relaxed pl-1">
                        <li>Setiap streamer berhak request sesi live <strong>3 kali</strong> setiap periode minggu.</li>
                        <li>Periode minggu terhitung mulai dari hari Senin sampai Minggu.</li>
                        <li><strong>Diluar jam request streamer bersedia dijadwalkan pada jam berapapun.</strong></li>
                        <li>Pengajuan sesi live yang sudah terkirim tidak bisa dirubah.</li>
                      </ol>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- SUB-TAB: HISTORY PENGAJUAN SESI (CALENDAR GRID) --- */}
            {reqSubSesi === "history" && (() => {
              const shiftCalBase = new Date(todayBase.getFullYear(), todayBase.getMonth() + shiftCalOffset, 1);
              const shiftCalYear = shiftCalBase.getFullYear();
              const shiftCalMonth = shiftCalBase.getMonth();
              const shiftMonthLabel = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][shiftCalMonth];
              const canShiftPrev = shiftCalOffset > -1;
              const canShiftNext = shiftCalOffset < 1;
              const shiftFirstDay = new Date(shiftCalYear, shiftCalMonth, 1).getDay();
              const shiftDaysInMonth = new Date(shiftCalYear, shiftCalMonth + 1, 0).getDate();
              const shiftCells: (Date | null)[] = Array.from({ length: shiftFirstDay }, () => null);
              for (let d = 1; d <= shiftDaysInMonth; d++) shiftCells.push(new Date(shiftCalYear, shiftCalMonth, d));

              // Build shift request lookup by date
              const shiftByDate = new Map<string, { shift: string; status: string }[]>();
              if (requestStatus) {
                for (const s of requestStatus.shiftRequests) {
                  const ymd = toLocalYMD(new Date(s.tanggalMulai));
                  const arr = shiftByDate.get(ymd) || [];
                  arr.push({ shift: s.jenis?.replace("REQUEST_", "") || "Sesi Live", status: s.status });
                  shiftByDate.set(ymd, arr);
                }
              }

              return (
                <div>
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => setShiftCalOffset((c) => c - 1)}
                      className={`bg-[#941A0B]/5 hover:bg-[#941A0B]/10 text-[#941A0B] font-bold px-3 py-2 rounded-lg transition border border-[#941A0B]/20 ${!canShiftPrev ? "hidden" : ""}`}
                      aria-label="Bulan sebelumnya"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <h4 className="font-bold text-[#941A0B] text-lg">{shiftMonthLabel} {shiftCalYear}</h4>
                    <button
                      type="button"
                      onClick={() => setShiftCalOffset((c) => c + 1)}
                      className={`bg-[#941A0B]/5 hover:bg-[#941A0B]/10 text-[#941A0B] font-bold px-3 py-2 rounded-lg transition border border-[#941A0B]/20 ${!canShiftNext ? "hidden" : ""}`}
                      aria-label="Bulan berikutnya"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-[#941A0B]/70">
                    {DAY_LABELS.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                    {shiftCells.map((d, i) => {
                      if (!d) return <div key={`empty-${i}`} className="bg-slate-50/30 rounded-lg border border-transparent p-2 min-h-[60px] sm:min-h-[80px]" />;
                      const ymd = toLocalYMD(d);
                      const isToday = ymd === toLocalYMD(new Date());
                      const entries = shiftByDate.get(ymd);
                      const hasRequest = !!entries && entries.length > 0;

                      return (
                        <div
                          key={ymd}
                          className={`border rounded-lg p-1 sm:p-2 min-h-[60px] sm:min-h-[80px] transition-colors relative flex flex-col ${
                            hasRequest
                              ? "bg-[#941A0B]/5 text-[#941A0B] border-[#941A0B]/30"
                              : isToday
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          <span className={`text-right font-black text-xs sm:text-sm ${isToday ? "text-blue-700" : ""}`}>
                            {d.getDate()}
                          </span>
                          {entries?.map((e, ei) => (
                            <span
                              key={ei}
                              className={`mt-auto text-[8px] sm:text-[10px] font-bold px-1 py-0.5 rounded-full text-center leading-tight ${
                                e.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : e.status === "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {e.shift}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty state */}
                  {(!requestStatus || requestStatus.shiftRequests.length === 0) && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Belum ada riwayat request sesi live.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}