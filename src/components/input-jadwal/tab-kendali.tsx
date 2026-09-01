"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { TabSharedProps } from "./types";

const MONTH_OPTIONS = [
  "Desember 2025",
  "Januari 2026",
  "Februari 2026",
  "Maret 2026",
  "April 2026",
  "Mei 2026",
  "Juni 2026",
  "Juli 2026",
  "Agustus 2026",
  "September 2026",
  "Oktober 2026",
  "November 2026",
  "Desember 2026",
];

export function TabKendali({
  kendaliConfig,
  kendaliLoading,
  loadKendaliConfig,
  infoStreamerData,
  loadInfoStreamer,
  streamers,
  showAlert,
}: TabSharedProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Compute active status
  const liburIsOn =
    kendaliConfig?.fiturLibur === "ON" ||
    kendaliConfig?.allowLiburRequest === true ||
    (kendaliConfig?.fiturLibur === undefined && kendaliConfig?.allowLiburRequest === undefined);

  const shiftIsOn =
    kendaliConfig?.fiturShift === "ON" ||
    kendaliConfig?.allowShiftRequest === true ||
    (kendaliConfig?.fiturShift === undefined && kendaliConfig?.allowShiftRequest === undefined);

  const [localLiburStatus, setLocalLiburStatus] = useState<"ON" | "OFF">(liburIsOn ? "ON" : "OFF");
  const [localShiftStatus, setLocalShiftStatus] = useState<"ON" | "OFF">(shiftIsOn ? "ON" : "OFF");

  useEffect(() => {
    setLocalLiburStatus(liburIsOn ? "ON" : "OFF");
  }, [liburIsOn]);

  useEffect(() => {
    setLocalShiftStatus(shiftIsOn ? "ON" : "OFF");
  }, [shiftIsOn]);

  // Subtab for Informasi Kuota & Jadwal Libur
  const [subTab, setSubTab] = useState<"kuota_host" | "db_libur">("kuota_host");
  const [selectedPeriode, setSelectedPeriode] = useState<string>("Januari 2026");
  const [periodMode, setPeriodMode] = useState<"CUTOFF" | "FULL">("CUTOFF");
  const [searchDate, setSearchDate] = useState("");

  // Local daily quota edits
  const [dailyQuotaMap, setDailyQuotaMap] = useState<
    Record<string, { q00_08: number; q08_16: number; q16_00: number; qLibur: number }>
  >({});
  const [savingQuota, setSavingQuota] = useState(false);

  // Modal to edit streamer leave / request per date
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalLeaveStreamers, setModalLeaveStreamers] = useState<string[]>([]);
  const [modalReq00, setModalReq00] = useState<string[]>([]);
  const [modalReq08, setModalReq08] = useState<string[]>([]);
  const [modalReq16, setModalReq16] = useState<string[]>([]);
  const [savingModal, setSavingModal] = useState(false);

  // Sync DB dailyShiftQuota into local state
  useEffect(() => {
    const fromCfg = kendaliConfig?.dailyShiftQuota || infoStreamerData?.dailyShiftQuota || {};
    setDailyQuotaMap((prev) => ({ ...fromCfg, ...prev }));
  }, [kendaliConfig?.dailyShiftQuota, infoStreamerData?.dailyShiftQuota]);

  // Load info streamer on mount
  useEffect(() => {
    loadInfoStreamer?.();
  }, [loadInfoStreamer]);

  // Generate date list based on selected Periode
  const dates = useMemo(() => {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const parts = selectedPeriode.split(" ");
    const mName = parts[0];
    const year = parseInt(parts[1] || "2026", 10);
    const mIdx = months.indexOf(mName);
    const targetMonth = mIdx !== -1 ? mIdx : 0; // 0 = Januari

    const list: string[] = [];

    if (periodMode === "CUTOFF") {
      // Cut-off starts on 23rd of previous month, ends on 22nd of target month
      const prevYear = targetMonth === 0 ? year - 1 : year;
      const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
      const lastDayPrev = new Date(prevYear, prevMonth + 1, 0).getDate();

      for (let d = 23; d <= lastDayPrev; d++) {
        const mm = String(prevMonth + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        list.push(`${prevYear}-${mm}-${dd}`);
      }
      for (let d = 1; d <= 22; d++) {
        const mm = String(targetMonth + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        list.push(`${year}-${mm}-${dd}`);
      }
    } else {
      // Full month
      const lastDay = new Date(year, targetMonth + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const mm = String(targetMonth + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        list.push(`${year}-${mm}-${dd}`);
      }
    }

    if (searchDate.trim()) {
      return list.filter((d) => d.includes(searchDate.trim()));
    }
    return list;
  }, [selectedPeriode, periodMode, searchDate]);

  // Aggregate leave & requests by date
  const leaveByDate = useMemo(() => {
    const map: Record<string, string[]> = {};

    (infoStreamerData?.leaveRequests || []).forEach((r: any) => {
      const raw = r.tanggalMulai ? new Date(r.tanggalMulai).toISOString().split("T")[0] : "";
      if (raw) {
        if (!map[raw]) map[raw] = [];
        const name = r.karyawan?.namaLengkap || r.karyawan?.idKaryawan || "Streamer";
        const label = r.karyawan?.idKaryawan ? `${r.karyawan.idKaryawan} | ${name}` : name;
        if (!map[raw].includes(label)) map[raw].push(label);
      }
    });

    (infoStreamerData?.liburStreamerDb || []).forEach((r: any) => {
      const raw = r.tanggal ? new Date(r.tanggal).toISOString().split("T")[0] : "";
      if (raw) {
        if (!map[raw]) map[raw] = [];
        const name = r.karyawan?.namaLengkap || r.karyawan?.idKaryawan || "Streamer";
        const label = r.karyawan?.idKaryawan ? `${r.karyawan.idKaryawan} | ${name}` : name;
        if (!map[raw].includes(label)) map[raw].push(label);
      }
    });

    return map;
  }, [infoStreamerData?.leaveRequests, infoStreamerData?.liburStreamerDb]);

  const requestsByDate = useMemo(() => {
    const map00: Record<string, string[]> = {};
    const map08: Record<string, string[]> = {};
    const map16: Record<string, string[]> = {};

    (infoStreamerData?.shiftRequests || []).forEach((r: any) => {
      const raw = r.tanggalMulai ? new Date(r.tanggalMulai).toISOString().split("T")[0] : "";
      if (!raw) return;
      const name = r.karyawan?.namaLengkap || r.karyawan?.idKaryawan || "Streamer";
      const label = r.karyawan?.idKaryawan ? `${r.karyawan.idKaryawan} | ${name}` : name;

      if (r.jenis === "REQUEST_SESI_1" || r.alasan?.includes("00:00") || r.alasan?.includes("Sesi 1")) {
        if (!map00[raw]) map00[raw] = [];
        if (!map00[raw].includes(label)) map00[raw].push(label);
      } else if (r.jenis === "REQUEST_SESI_2" || r.alasan?.includes("08:00") || r.alasan?.includes("Sesi 2")) {
        if (!map08[raw]) map08[raw] = [];
        if (!map08[raw].includes(label)) map08[raw].push(label);
      } else if (r.jenis === "REQUEST_SESI_3" || r.alasan?.includes("16:00") || r.alasan?.includes("Sesi 3")) {
        if (!map16[raw]) map16[raw] = [];
        if (!map16[raw].includes(label)) map16[raw].push(label);
      }
    });

    return { map00, map08, map16 };
  }, [infoStreamerData?.shiftRequests]);

  // Toggle feature handler
  async function handleToggleFitur(fitur: "LIBUR" | "SHIFT", status: "ON" | "OFF") {
    if (fitur === "LIBUR") setLocalLiburStatus(status);
    if (fitur === "SHIFT") setLocalShiftStatus(status);
    setLoadingAction(fitur);

    try {
      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-fitur", fitur, status }),
      });
      const d = await res.json();
      if (d.status === "success" || d.success) {
        showAlert(
          `✅ Formulir ${
            fitur === "LIBUR" ? "Pengajuan Libur" : "Request Sesi Live"
          } berhasil diubah ke status ${status}!`
        );
        await loadKendaliConfig();
      } else {
        showAlert(`❌ Gagal mengubah status fitur: ${d.message || "Terjadi kesalahan"}`);
        if (fitur === "LIBUR") setLocalLiburStatus(liburIsOn ? "ON" : "OFF");
        if (fitur === "SHIFT") setLocalShiftStatus(shiftIsOn ? "ON" : "OFF");
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat mengubah status fitur.");
    } finally {
      setLoadingAction(null);
    }
  }

  // Update daily quota inline
  function handleQuotaChange(
    date: string,
    field: "q00_08" | "q08_16" | "q16_00" | "qLibur",
    val: number
  ) {
    setDailyQuotaMap((prev) => {
      const cur = prev[date] || { q00_08: 0, q08_16: 0, q16_00: 0, qLibur: 20 };
      return {
        ...prev,
        [date]: {
          ...cur,
          [field]: Math.max(0, val),
        },
      };
    });
  }

  // Save all quota changes to database
  async function handleSaveAllQuotas() {
    setSavingQuota(true);
    try {
      const items = Object.entries(dailyQuotaMap).map(([tanggal, q]) => ({
        tanggal,
        q00_08: q.q00_08,
        q08_16: q.q08_16,
        q16_00: q.q16_00,
        qLibur: q.qLibur,
      }));

      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-daily-quota", items }),
      });
      const d = await res.json();
      if (d.status === "success" || d.success) {
        showAlert("✅ Berhasil menyimpan kuota host dan libur ke database!");
        await loadKendaliConfig();
      } else {
        showAlert(`❌ Gagal menyimpan kuota: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan kuota.");
    } finally {
      setSavingQuota(false);
    }
  }

  // Open manage modal for date
  function openManageModal(date: string) {
    setModalDate(date);
    setModalLeaveStreamers([...(leaveByDate[date] || [])]);
    setModalReq00([...(requestsByDate.map00[date] || [])]);
    setModalReq08([...(requestsByDate.map08[date] || [])]);
    setModalReq16([...(requestsByDate.map16[date] || [])]);
  }

  // Save changes from modal
  async function handleSaveModal() {
    if (!modalDate) return;
    setSavingModal(true);
    try {
      const payload = {
        action: "editInformasiStreamerBatch",
        data_edit: [
          {
            TANGGAL: modalDate,
            LIBUR: modalLeaveStreamers,
            REQ_00_08: modalReq00,
            REQ_08_16: modalReq08,
            REQ_16_00: modalReq16,
          },
        ],
      };

      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success" || d.success) {
        showAlert(`✅ Data libur & request untuk ${modalDate} berhasil diperbarui di database!`);
        await loadInfoStreamer?.();
        setModalDate(null);
      } else {
        showAlert(`❌ Gagal menyimpan data: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan data modal.");
    } finally {
      setSavingModal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* KENDALI SWITCH CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shadow-xs">
            <i className="fa-solid fa-toggle-on" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">Kendali Akses Formulir Streamer</h2>
            <p className="text-xs text-slate-500">
              Atur hak akses pengajuan libur dan request sesi live di portal streamer secara langsung
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Pengajuan Libur */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-calendar-xmark text-red-600" />
                  <span>Formulir Pengajuan Libur</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kontrol visibilitas form permohonan libur bagi streamer dedicated & on-call
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 transition-colors ${
                  localLiburStatus === "ON"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {localLiburStatus === "ON" ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "LIBUR"}
                onClick={() => handleToggleFitur("LIBUR", "ON")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                  localLiburStatus === "ON"
                    ? "bg-emerald-600 text-white shadow-emerald-600/20"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300"
                }`}
              >
                <i className="fa-solid fa-power-off text-[10px]" />
                Aktifkan (ON)
              </button>
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "LIBUR"}
                onClick={() => handleToggleFitur("LIBUR", "OFF")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                  localLiburStatus === "OFF"
                    ? "bg-red-600 text-white shadow-red-600/20"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                <i className="fa-solid fa-ban text-[10px]" />
                Nonaktifkan (OFF)
              </button>
            </div>
          </div>

          {/* Card 2: Pengajuan Sesi Live */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-video text-blue-600" />
                  <span>Formulir Request Sesi Live</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kontrol akses streamer untuk memilih preferensi shift/jam siaran live
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 transition-colors ${
                  localShiftStatus === "ON"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {localShiftStatus === "ON" ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "SHIFT"}
                onClick={() => handleToggleFitur("SHIFT", "ON")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                  localShiftStatus === "ON"
                    ? "bg-emerald-600 text-white shadow-emerald-600/20"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300"
                }`}
              >
                <i className="fa-solid fa-power-off text-[10px]" />
                Aktifkan (ON)
              </button>
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "SHIFT"}
                onClick={() => handleToggleFitur("SHIFT", "OFF")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                  localShiftStatus === "OFF"
                    ? "bg-red-600 text-white shadow-red-600/20"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                <i className="fa-solid fa-ban text-[10px]" />
                Nonaktifkan (OFF)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INFORMASI KUOTA & JADWAL LIBUR (2 TABLES AS PER SPEC) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Section Header & Subtab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <i className="fa-solid fa-calendar-days text-[#941A0B]" />
              <span>Informasi Kuota & Jadwal Libur</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring dan pengaturan kuota host harian serta rekapitulasi libur streamer
            </p>
          </div>

          {/* Subtab Toggle Buttons */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab("kuota_host")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subTab === "kuota_host"
                  ? "bg-white text-[#941A0B] shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-users" />
              <span>Kebutuhan Host Harian</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab("db_libur")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subTab === "db_libur"
                  ? "bg-white text-[#941A0B] shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-calendar-xmark" />
              <span>Daftar Libur Host (20 Kolom)</span>
            </button>
          </div>
        </div>

        {/* Filters & Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Periode Bulan Selector */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Periode:</span>
              <select
                value={selectedPeriode}
                onChange={(e) => setSelectedPeriode(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B]"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Cut-off vs Full Month mode */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setPeriodMode("CUTOFF")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  periodMode === "CUTOFF" ? "bg-[#941A0B] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Periode Cut-off Operasional (Tgl 23 bulan lalu s/d 22 bulan ini)"
              >
                Cut-off (23-22)
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("FULL")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  periodMode === "FULL" ? "bg-[#941A0B] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Bulan Kalender Lengkap (Tgl 1 s/d Akhir Bulan)"
              >
                Kalender Penuh (1-31)
              </button>
            </div>

            {/* Search Date */}
            <div className="relative">
              <input
                type="text"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                placeholder="Cari tanggal (YYYY-MM-DD)..."
                className="bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] w-48"
              />
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadKendaliConfig();
                loadInfoStreamer?.();
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-rotate" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              disabled={savingQuota}
              onClick={handleSaveAllQuotas}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-floppy-disk" />
              <span>{savingQuota ? "Menyimpan..." : "Simpan Kuota ke DB"}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TABEL 1: KEBUTUHAN HOST HARIAN & REQUEST STREAMER (KUOTA HOST)            */}
        {/* ========================================================================= */}
        {subTab === "kuota_host" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Tabel Kebutuhan Host Harian & Request Streamer ({dates.length} Hari)
              </span>
              <span className="text-[11px] text-slate-500">
                Nilai kuota dapat diedit langsung pada tabel dan disimpan ke database
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="min-w-full text-xs text-center border-collapse">
                {/* Multi-Header Row 1 */}
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th
                      colSpan={4}
                      className="p-2.5 border-r border-slate-300 bg-amber-100/60 text-amber-950 font-extrabold uppercase tracking-wider text-[11px]"
                    >
                      KEBUTUHAN HOST HARIAN
                    </th>
                    <th
                      colSpan={3}
                      className="p-2.5 border-r border-slate-300 bg-blue-100/60 text-blue-950 font-extrabold uppercase tracking-wider text-[11px]"
                    >
                      REQUEST STREAMER
                    </th>
                    <th
                      colSpan={3}
                      className="p-2.5 border-r border-slate-300 bg-emerald-100/60 text-emerald-950 font-extrabold uppercase tracking-wider text-[11px]"
                    >
                      SISA KUOTA
                    </th>
                    <th className="p-2.5 bg-slate-200/70 text-slate-700 font-extrabold uppercase text-[11px]">
                      AKSI
                    </th>
                  </tr>

                  {/* Header Row 2 */}
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-t border-slate-200">
                    <th className="p-2 border-r border-slate-200 text-left min-w-[110px]">TANGGAL</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px]">KUOTA_00-08</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px]">KUOTA_08-16</th>
                    <th className="p-2 border-r border-slate-300 min-w-[100px]">KUOTA_16-00</th>
                    <th className="p-2 border-r border-slate-200 min-w-[140px]">STREAMER_00-08</th>
                    <th className="p-2 border-r border-slate-200 min-w-[140px]">STREAMER_08-16</th>
                    <th className="p-2 border-r border-slate-300 min-w-[140px]">STREAMER_16-00</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px]">SISA_KUOTA_00-08</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px]">SISA_KUOTA_08-16</th>
                    <th className="p-2 border-r border-slate-300 min-w-[100px]">SISA_KUOTA_16-00</th>
                    <th className="p-2 min-w-[80px]">KELOLA</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {dates.map((dateStr) => {
                    const qData = dailyQuotaMap[dateStr] || {
                      q00_08: 0,
                      q08_16: 0,
                      q16_00: 0,
                      qLibur: 20,
                    };

                    const req00 = requestsByDate.map00[dateStr] || [];
                    const req08 = requestsByDate.map08[dateStr] || [];
                    const req16 = requestsByDate.map16[dateStr] || [];

                    const sisa00 = Math.max(0, qData.q00_08 - req00.length);
                    const sisa08 = Math.max(0, qData.q08_16 - req08.length);
                    const sisa16 = Math.max(0, qData.q16_00 - req16.length);

                    return (
                      <tr key={dateStr} className="hover:bg-slate-50/80 transition-colors">
                        {/* Tanggal */}
                        <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-800">
                          {dateStr}
                        </td>

                        {/* Kuota 00-08 Input */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={qData.q00_08}
                            onChange={(e) =>
                              handleQuotaChange(dateStr, "q00_08", parseInt(e.target.value, 10) || 0)
                            }
                            className="w-16 text-center border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-[#941A0B] outline-none"
                          />
                        </td>

                        {/* Kuota 08-16 Input */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={qData.q08_16}
                            onChange={(e) =>
                              handleQuotaChange(dateStr, "q08_16", parseInt(e.target.value, 10) || 0)
                            }
                            className="w-16 text-center border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-[#941A0B] outline-none"
                          />
                        </td>

                        {/* Kuota 16-00 Input */}
                        <td className="p-1 border-r border-slate-300">
                          <input
                            type="number"
                            min="0"
                            value={qData.q16_00}
                            onChange={(e) =>
                              handleQuotaChange(dateStr, "q16_00", parseInt(e.target.value, 10) || 0)
                            }
                            className="w-16 text-center border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-[#941A0B] outline-none"
                          />
                        </td>

                        {/* Streamer 00-08 List */}
                        <td className="p-2 border-r border-slate-200 text-left font-sans">
                          {req00.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {req00.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10px] font-semibold"
                                >
                                  {s.split(" | ")[1] || s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Streamer 08-16 List */}
                        <td className="p-2 border-r border-slate-200 text-left font-sans">
                          {req08.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {req08.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10px] font-semibold"
                                >
                                  {s.split(" | ")[1] || s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Streamer 16-00 List */}
                        <td className="p-2 border-r border-slate-300 text-left font-sans">
                          {req16.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {req16.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10px] font-semibold"
                                >
                                  {s.split(" | ")[1] || s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Sisa Kuota 00-08 */}
                        <td className="p-2 border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sisa00 > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sisa00}
                          </span>
                        </td>

                        {/* Sisa Kuota 08-16 */}
                        <td className="p-2 border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sisa08 > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sisa08}
                          </span>
                        </td>

                        {/* Sisa Kuota 16-00 */}
                        <td className="p-2 border-r border-slate-300">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sisa16 > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sisa16}
                          </span>
                        </td>

                        {/* Kelola */}
                        <td className="p-2 font-sans">
                          <button
                            type="button"
                            onClick={() => openManageModal(dateStr)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition cursor-pointer"
                            title="Atur Permohonan Streamer Tanggal Ini"
                          >
                            <i className="fa-solid fa-pen-to-square text-[10px]" /> Atur
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TABEL 2: DAFTAR LIBUR HOST PER TANGGAL (DB LIBUR STREAMER - 20 KOLOM)     */}
        {/* ========================================================================= */}
        {subTab === "db_libur" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Tabel Database Libur Host Per Tanggal (STREAMER_1 s/d STREAMER_20)
              </span>
              <span className="text-[11px] text-slate-500">
                Maksimal kuota per hari 20 streamer sesuai kebijakan operasional
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="min-w-max text-xs text-center border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  {/* Single Table Title Row */}
                  <tr>
                    <th
                      colSpan={25}
                      className="p-3 bg-red-100/70 text-red-950 font-extrabold uppercase tracking-wider text-xs border-b border-red-200 text-left"
                    >
                      DAFTAR LIBUR HOST PER TANGGAL
                    </th>
                  </tr>

                  {/* Header Columns */}
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-t border-slate-200">
                    <th className="p-2.5 border-r border-slate-200 text-left min-w-[110px]">PERIODE_BULAN</th>
                    <th className="p-2.5 border-r border-slate-200 text-left min-w-[110px]">TANGGAL</th>
                    <th className="p-2.5 border-r border-slate-200 min-w-[80px]">KUOTA</th>
                    <th className="p-2.5 border-r border-slate-200 min-w-[100px]">KUOTA_TERISI</th>
                    <th className="p-2.5 border-r border-slate-300 min-w-[90px]">SISA_KUOTA</th>

                    {/* 20 Streamer Columns */}
                    {Array.from({ length: 20 }, (_, i) => (
                      <th
                        key={i}
                        className="p-2.5 border-r border-slate-200 min-w-[120px] font-mono text-[10px] text-slate-500"
                      >
                        STREAMER_{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {dates.map((dateStr) => {
                    const qData = dailyQuotaMap[dateStr] || {
                      q00_08: 0,
                      q08_16: 0,
                      q16_00: 0,
                      qLibur: 20,
                    };

                    const leaves = leaveByDate[dateStr] || [];
                    const kuota = qData.qLibur || 20;
                    const terisi = leaves.length;
                    const sisa = Math.max(0, kuota - terisi);

                    // Formatted date format: 2025/12/23 or 2025-12-23
                    const formattedDateSlash = dateStr.replace(/-/g, "/");

                    return (
                      <tr key={dateStr} className="hover:bg-slate-50/80 transition-colors">
                        {/* PERIODE_BULAN */}
                        <td className="p-2 border-r border-slate-200 text-left font-sans font-semibold text-slate-700 whitespace-nowrap">
                          {selectedPeriode}
                        </td>

                        {/* TANGGAL */}
                        <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-900 whitespace-nowrap">
                          {formattedDateSlash}
                        </td>

                        {/* KUOTA (Editable inline) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={kuota}
                            onChange={(e) =>
                              handleQuotaChange(dateStr, "qLibur", parseInt(e.target.value, 10) || 20)
                            }
                            className="w-14 text-center border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#941A0B] outline-none"
                          />
                        </td>

                        {/* KUOTA_TERISI */}
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-800">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              terisi > 0 ? "bg-red-50 text-red-700 font-bold" : "text-slate-400"
                            }`}
                          >
                            {terisi}
                          </span>
                        </td>

                        {/* SISA_KUOTA */}
                        <td className="p-2 border-r border-slate-300 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              sisa > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {sisa}
                          </span>
                        </td>

                        {/* STREAMER_1 s/d STREAMER_20 (20 individual columns) */}
                        {Array.from({ length: 20 }, (_, colIdx) => {
                          const streamerItem = leaves[colIdx] || "";
                          const shortName = streamerItem ? streamerItem.split(" | ")[1] || streamerItem : "";
                          const empId = streamerItem ? streamerItem.split(" | ")[0] : "";

                          return (
                            <td
                              key={colIdx}
                              className="p-2 border-r border-slate-100 font-sans text-left text-[11px] whitespace-nowrap"
                            >
                              {streamerItem ? (
                                <span
                                  title={streamerItem}
                                  className="inline-block px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded font-semibold text-[10px]"
                                >
                                  {shortName || empId}
                                </span>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: KELOLA PERMOHONAN LIBUR & REQUEST STREAMER PER TANGGAL */}
      {modalDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <i className="fa-solid fa-calendar-check text-[#941A0B]" />
                  <span>Atur Permohonan Streamer</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tanggal: <strong className="font-mono text-blue-600">{modalDate}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalDate(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Section 1: Libur Streamer (Maks 20) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Streamer Libur ({modalLeaveStreamers.length} / 20)
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (!modalLeaveStreamers.includes(val) && modalLeaveStreamers.length < 20) {
                      setModalLeaveStreamers((prev) => [...prev, val]);
                    }
                    e.target.value = "";
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
                >
                  <option value="">+ Tambah Host Libur...</option>
                  {(streamers || []).map((s: any) => {
                    const label = `${s.idKaryawan || s.id} | ${s.namaLengkap}`;
                    return (
                      <option key={s.id} value={label} disabled={modalLeaveStreamers.includes(label)}>
                        {s.namaLengkap} ({s.idKaryawan})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                {modalLeaveStreamers.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada streamer yang libur di tanggal ini.</span>
                ) : (
                  modalLeaveStreamers.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setModalLeaveStreamers((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-red-400 hover:text-red-700 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Section 2: Request Shift 00:00 - 08:00 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Request Sesi 1 (00:00 - 08:00) ({modalReq00.length})
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (!modalReq00.includes(val)) {
                      setModalReq00((prev) => [...prev, val]);
                    }
                    e.target.value = "";
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
                >
                  <option value="">+ Tambah Request 00:00-08:00...</option>
                  {(streamers || []).map((s: any) => {
                    const label = `${s.idKaryawan || s.id} | ${s.namaLengkap}`;
                    return (
                      <option key={s.id} value={label} disabled={modalReq00.includes(label)}>
                        {s.namaLengkap} ({s.idKaryawan})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                {modalReq00.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada permohonan sesi 00:00 - 08:00.</span>
                ) : (
                  modalReq00.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => setModalReq00((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-blue-400 hover:text-blue-700 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Section 3: Request Shift 08:00 - 16:00 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Request Sesi 2 (08:00 - 16:00) ({modalReq08.length})
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (!modalReq08.includes(val)) {
                      setModalReq08((prev) => [...prev, val]);
                    }
                    e.target.value = "";
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
                >
                  <option value="">+ Tambah Request 08:00-16:00...</option>
                  {(streamers || []).map((s: any) => {
                    const label = `${s.idKaryawan || s.id} | ${s.namaLengkap}`;
                    return (
                      <option key={s.id} value={label} disabled={modalReq08.includes(label)}>
                        {s.namaLengkap} ({s.idKaryawan})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                {modalReq08.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada permohonan sesi 08:00 - 16:00.</span>
                ) : (
                  modalReq08.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => setModalReq08((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-blue-400 hover:text-blue-700 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Section 4: Request Shift 16:00 - 00:00 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Request Sesi 3 (16:00 - 00:00) ({modalReq16.length})
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (!modalReq16.includes(val)) {
                      setModalReq16((prev) => [...prev, val]);
                    }
                    e.target.value = "";
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
                >
                  <option value="">+ Tambah Request 16:00-00:00...</option>
                  {(streamers || []).map((s: any) => {
                    const label = `${s.idKaryawan || s.id} | ${s.namaLengkap}`;
                    return (
                      <option key={s.id} value={label} disabled={modalReq16.includes(label)}>
                        {s.namaLengkap} ({s.idKaryawan})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[44px]">
                {modalReq16.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada permohonan sesi 16:00 - 00:00.</span>
                ) : (
                  modalReq16.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => setModalReq16((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-blue-400 hover:text-blue-700 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalDate(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingModal}
                onClick={handleSaveModal}
                className="px-6 py-2.5 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{savingModal ? "Menyimpan ke DB..." : "Simpan Perubahan ke Database"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
