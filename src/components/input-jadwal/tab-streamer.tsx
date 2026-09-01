"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import { PLATFORMS, STUDIOS } from "@/types/jadwal";
import {
  generateNewScheduleId,
  formatRowItem,
} from "@/lib/utils/schedule-helpers";
import {
  formatDateSafe,
  formatTimeSafe,
  calcWajibHadir,
  getWajibHadirTime,
} from "@/lib/utils/date-format";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { inputCls, selectCls, labelCls, getStatusBadgeClass } from "./shared-styles";

export function TabStreamer({
  streamers,
  otsStaff,
  clients,
  allJadwal,
  infoStreamerData,
  fetchData,
  loadInfoStreamer,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [streamerSubTab, setStreamerSubTab] = useState<"form" | "info">("form");

  // Subtab 1: Form states
  const [streamerForms, setStreamerForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("STR"),
      tanggal: "",
      platform: "Shopee Live",
      streamerKaryawanId: "",
      streamerId: "",
      streamerNama: "",
      cabangStudio: "Timoho",
      nomorStudio: "Studio 1",
      device: "Tidak Pakai",
      jamMulaiLive: "",
      jamSelesaiLive: "",
      filePendukungHost: "",
      catatanHost: "",
      otsKaryawanId: "",
      otsId: "",
      otsNama: "",
      judulLive: "",
      promoLive: "",
      filePendukungOts: "",
      catatanOts: "",
    },
  ]);
  const [isStreamerCrashVerified, setIsStreamerCrashVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Subtab 2: Info Streamer states
  const [searchInfoStreamer, setSearchInfoStreamer] = useState("");
  const [showInfoStreamerDropdown, setShowInfoStreamerDropdown] = useState(false);
  const [filterPeriodeInfo, setFilterPeriodeInfo] = useState<"ALL" | "EXACT" | "RANGE">("ALL");
  const [filterTglSatuInfo, setFilterTglSatuInfo] = useState("");
  const [filterTglRangeInfo, setFilterTglRangeInfo] = useState("");
  const [filterTglRangeStart, setFilterTglRangeStart] = useState("");
  const [filterTglRangeEnd, setFilterTglRangeEnd] = useState("");
  const [infoChanges, setInfoChanges] = useState<Record<string, any>>({});
  const [savingInfoStreamer, setSavingInfoStreamer] = useState(false);
  const [pageInfoStreamer, setPageInfoStreamer] = useState(1);

  // Modals for Subtab Info Streamer
  const [modalDetailLibur, setModalDetailLibur] = useState<{
    tanggal: string;
    list: { id: string; nama: string }[];
    kuota: number;
    sisa: number;
  } | null>(null);
  const [modalDetailRequest, setModalDetailRequest] = useState<{
    tanggal: string;
    sessions: Record<
      string,
      { list: { id: string; nama: string }[]; kuota: number; sisa: number }
    >;
  } | null>(null);
  const [modalInfoKuota, setModalInfoKuota] = useState<{
    title: string;
    tanggal: string;
    kuota: string | number;
    sisa: string | number;
    breakdown?: any;
  } | null>(null);
  const [editInfoDate, setEditInfoDate] = useState<string | null>(null);
  const [stateEditInfo, setStateEditInfo] = useState<{
    LIBUR: string[];
    REQ_00_08: string[];
    REQ_08_16: string[];
    REQ_16_00: string[];
  }>({ LIBUR: [], REQ_00_08: [], REQ_08_16: [], REQ_16_00: [] });
  const [cariLiburInfo, setCariLiburInfo] = useState("");
  const [cariReq0008, setCariReq0008] = useState("");
  const [cariReq0816, setCariReq0816] = useState("");
  const [cariReq1600, setCariReq1600] = useState("");

  // Live Streamer Monitoring Table states (4-block filter matching ref-deploy)
  const [liveFilterPeriode, setLiveFilterPeriode] = useState<
    "ALL" | "TODAY" | "PREV_7" | "NEXT_7" | "PREV_35" | "NEXT_35" | "EXACT_DATE" | "CUSTOM"
  >("ALL");
  const [liveFilterExactDate, setLiveFilterExactDate] = useState("");
  const [liveFilterRangeStart, setLiveFilterRangeStart] = useState("");
  const [liveFilterRangeEnd, setLiveFilterRangeEnd] = useState("");
  const [liveFilterWaktuToggle, setLiveFilterWaktuToggle] = useState<"ALL" | "CUSTOM">("ALL");
  const [liveFilterJamMulai, setLiveFilterJamMulai] = useState("");
  const [liveFilterJamAkhir, setLiveFilterJamAkhir] = useState("");
  const [liveFilterCol, setLiveFilterCol] = useState<"ALL" | "0" | "1" | "3" | "5" | "4" | "6">("ALL");
  const [liveFilterText, setLiveFilterText] = useState("");
  const [liveFilterStatus, setLiveFilterStatus] = useState("");
  const [liveFilterCabang, setLiveFilterCabang] = useState("");
  const [liveFilterStudio, setLiveFilterStudio] = useState("");
  const [livePageSize, setLivePageSize] = useState(10);
  const [livePage, setLivePage] = useState(1);
  const [modalDetailJadwalLive, setModalDetailJadwalLive] = useState<any | null>(null);

  // --- Form Handlers ---
  function handleAddForm() {
    if (streamerForms.length >= 100) {
      showAlert("⚠️ Maksimal 100 formulir jadwal sekaligus.");
      return;
    }
    const last = streamerForms[streamerForms.length - 1];
    setStreamerForms((prev) => [
      ...prev,
      {
        id: Date.now(),
        idJadwal: generateNewScheduleId("STR", last?.tanggal),
        tanggal: last?.tanggal || "",
        platform: last?.platform || "Shopee Live",
        streamerKaryawanId: "",
        streamerId: "",
        streamerNama: "",
        cabangStudio: last?.cabangStudio || "Timoho",
        nomorStudio: last?.nomorStudio || "Studio 1",
        device: "Tidak Pakai",
        jamMulaiLive: "",
        jamSelesaiLive: "",
        filePendukungHost: "",
        catatanHost: "",
        otsKaryawanId: "",
        otsId: "",
        otsNama: "",
        judulLive: "",
        promoLive: "",
        filePendukungOts: "",
        catatanOts: "",
      },
    ]);
    setIsStreamerCrashVerified(false);
  }

  function handleRemoveForm(id: number) {
    if (streamerForms.length <= 1) return;
    setStreamerForms((prev) => prev.filter((f) => f.id !== id));
    setIsStreamerCrashVerified(false);
  }

  function handleDuplicateForm(item: ScheduleFormItem) {
    setStreamerForms((prev) => [
      ...prev,
      {
        ...item,
        id: Date.now(),
        idJadwal: generateNewScheduleId("STR", item.tanggal),
      },
    ]);
    setIsStreamerCrashVerified(false);
  }

  function updateFormField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setStreamerForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setIsStreamerCrashVerified(false);
  }

  function checkBebasCrashStreamer() {
    const conflicts: any[] = [];
    for (let i = 0; i < streamerForms.length; i++) {
      const f1 = streamerForms[i];
      if (!f1.tanggal || !f1.jamMulaiLive || !f1.jamSelesaiLive) {
        showAlert("⚠️ Pastikan Tanggal, Jam Mulai, dan Jam Selesai terisi di semua form.");
        return;
      }
      for (let j = i + 1; j < streamerForms.length; j++) {
        const f2 = streamerForms[j];
        if (f1.tanggal !== f2.tanggal) continue;

        const s1 = f1.jamMulaiLive;
        const e1 = f1.jamSelesaiLive;
        const s2 = f2.jamMulaiLive;
        const e2 = f2.jamSelesaiLive;
        const isOverlap = s1 < e2 && s2 < e1;

        if (isOverlap) {
          if (
            f1.streamerKaryawanId &&
            f2.streamerKaryawanId &&
            f1.streamerKaryawanId === f2.streamerKaryawanId
          ) {
            conflicts.push({
              type: `Host / Streamer (${f1.streamerNama || "Streamer"})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${f1.tanggal} [${s1} - ${e1}] - ${f1.platform}`,
              info2: `Tgl ${f2.tanggal} [${s2} - ${e2}] - ${f2.platform}`,
            });
          }
          if (
            f1.cabangStudio === f2.cabangStudio &&
            f1.nomorStudio &&
            f1.nomorStudio === f2.nomorStudio &&
            f1.nomorStudio !== "Pilih Studio"
          ) {
            conflicts.push({
              type: `Studio (${f1.cabangStudio} - ${f1.nomorStudio})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${f1.tanggal} [${s1} - ${e1}]`,
              info2: `Tgl ${f2.tanggal} [${s2} - ${e2}]`,
            });
          }
          if (f1.otsKaryawanId && f2.otsKaryawanId && f1.otsKaryawanId === f2.otsKaryawanId) {
            conflicts.push({
              type: `Personel OTS (${f1.otsNama || "Staff"})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${f1.tanggal} [${s1} - ${e1}]`,
              info2: `Tgl ${f2.tanggal} [${s2} - ${e2}]`,
            });
          }
        }
      }
    }

    if (conflicts.length > 0) {
      setIsStreamerCrashVerified(false);
      setModalCrashData({
        isOpen: true,
        isSafe: false,
        title: "Jadwal Streamer Bentrok!",
        conflicts,
      });
    } else {
      setIsStreamerCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Formulir Streamer Aman & Bebas Bentrok!",
        conflicts: [],
      });
    }
  }

  async function submitStreamerSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isStreamerCrashVerified) {
      showAlert("⚠️ Silakan klik tombol 'Bebas Crash' terlebih dahulu sebelum menyimpan!");
      return;
    }

    setLoading(true);

    try {
      for (const item of streamerForms) {
        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("STR", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          platform: item.platform,
          streamerKaryawanId: item.streamerKaryawanId || null,
          hostKaryawanId: item.streamerKaryawanId || null,
          idHost: item.streamerId || null,
          otsKaryawanId: item.otsKaryawanId || null,
          idOts: item.otsId || null,
          cabangStudio: item.cabangStudio,
          nomorStudio: item.nomorStudio,
          jamMulaiLive: item.jamMulaiLive.includes("T") ? item.jamMulaiLive : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`,
          jamSelesaiLive: item.jamSelesaiLive.includes("T") ? item.jamSelesaiLive : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`,
          judulLive: item.judulLive || null,
          promoLive: item.promoLive || null,
          catatanHost: item.catatanHost || null,
          catatanOts: item.catatanOts || null,
          filePendukungHostDriveId: item.filePendukungHost || null,
          filePendukungOtsDriveId: item.filePendukungOts || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`✅ Berhasil menyimpan ${streamerForms.length} Jadwal Streamer!`);
      setIsStreamerCrashVerified(false);
      setStreamerForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("STR"),
          tanggal: "",
          platform: "Shopee Live",
          streamerKaryawanId: "",
          streamerId: "",
          streamerNama: "",
          cabangStudio: "Timoho",
          nomorStudio: "Studio 1",
          device: "Tidak Pakai",
          jamMulaiLive: "",
          jamSelesaiLive: "",
          filePendukungHost: "",
          catatanHost: "",
          otsKaryawanId: "",
          otsId: "",
          otsNama: "",
          judulLive: "",
          promoLive: "",
          filePendukungOts: "",
          catatanOts: "",
        },
      ]);
      fetchData();
    } catch {
      setError("Terjadi kesalahan saat menyimpan Jadwal Streamer.");
    } finally {
      setLoading(false);
    }
  }

  // --- Subtab Info Streamer Methods ---
  function isStreamerSelected(list: string[], s: any): boolean {
    if (!Array.isArray(list) || !s) return false;
    const sId = (s.idKaryawan || "").trim().toLowerCase();
    const sNama = (s.namaLengkap || "").trim().toLowerCase();
    return list.some((item) => {
      const itemStr = item.toLowerCase().trim();
      if (sId && itemStr.startsWith(`${sId} |`)) return true;
      if (sNama && (itemStr.endsWith(`| ${sNama}`) || itemStr === sNama)) return true;
      return false;
    });
  }

  function toggleStreamerInList(key: "LIBUR" | "REQ_00_08" | "REQ_08_16" | "REQ_16_00", s: any) {
    const val = `${s.idKaryawan || s.id || "-"} | ${s.namaLengkap}`;
    const sId = (s.idKaryawan || "").trim().toLowerCase();
    const sNama = (s.namaLengkap || "").trim().toLowerCase();

    setStateEditInfo((prev) => {
      const list = [...prev[key]];
      const existingIndex = list.findIndex((item) => {
        const itemStr = item.toLowerCase().trim();
        if (sId && itemStr.startsWith(`${sId} |`)) return true;
        if (sNama && (itemStr.endsWith(`| ${sNama}`) || itemStr === sNama)) return true;
        return false;
      });

      if (existingIndex > -1) {
        list.splice(existingIndex, 1);
      } else {
        if (key === "LIBUR" && list.length >= 20) {
          showAlert("⚠️ Maksimal Streamer yang dapat Libur dalam 1 hari adalah 20 Orang.");
          return prev;
        }
        list.push(val);
      }
      return { ...prev, [key]: list };
    });
  }

  function bukaModalEditInfo(tgl: string, rowData: any) {
    const existingEdit = infoChanges[tgl];
    if (existingEdit) {
      setStateEditInfo({
        LIBUR: [...(existingEdit.LIBUR || [])],
        REQ_00_08: [...(existingEdit.REQ_00_08 || [])],
        REQ_08_16: [...(existingEdit.REQ_08_16 || [])],
        REQ_16_00: [...(existingEdit.REQ_16_00 || [])],
      });
    } else {
      setStateEditInfo({
        LIBUR: (rowData?.LIBUR || []).map(formatRowItem),
        REQ_00_08: (rowData?.REQ_00_08 || []).map(formatRowItem),
        REQ_08_16: (rowData?.REQ_08_16 || []).map(formatRowItem),
        REQ_16_00: (rowData?.REQ_16_00 || []).map(formatRowItem),
      });
    }
    setCariLiburInfo("");
    setCariReq0008("");
    setCariReq0816("");
    setCariReq1600("");
    setEditInfoDate(tgl);
  }

  function simpanKeRamInfo() {
    if (!editInfoDate) return;
    setInfoChanges((prev) => ({
      ...prev,
      [editInfoDate]: {
        TANGGAL: editInfoDate,
        LIBUR: stateEditInfo.LIBUR,
        REQ_00_08: stateEditInfo.REQ_00_08,
        REQ_08_16: stateEditInfo.REQ_08_16,
        REQ_16_00: stateEditInfo.REQ_16_00,
      },
    }));
    setEditInfoDate(null);
  }

  async function handleSimpanSemuaInfo() {
    const keys = Object.keys(infoChanges);
    if (keys.length === 0) return;
    setSavingInfoStreamer(true);
    try {
      const dataEdit = keys.map((k) => infoChanges[k]);
      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "editInformasiStreamerBatch",
          data_edit: dataEdit,
        }),
      });
      const d = await res.json();
      if (d.status === "success" || res.ok) {
        showAlert(`✅ Berhasil menyimpan ${keys.length} perubahan libur & request streamer!`);
        setInfoChanges({});
        await loadInfoStreamer();
      } else {
        showAlert(`❌ Gagal menyimpan: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan.");
    } finally {
      setSavingInfoStreamer(false);
    }
  }

  // --- Streamer Live Monitoring Table filter logic ---
  const filteredLiveSchedules = allJadwal.filter((j) => {
    if (j.idJadwal?.startsWith("OTS")) return false;

    // 1. Filter Periode
    const jDateStr = j.tanggal ? new Date(j.tanggal).toISOString().slice(0, 10) : "";
    const today = new Date().toISOString().slice(0, 10);

    if (liveFilterPeriode === "TODAY") {
      if (jDateStr !== today) return false;
    } else if (liveFilterPeriode === "PREV_7") {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      const d7Str = d7.toISOString().slice(0, 10);
      if (jDateStr < d7Str || jDateStr > today) return false;
    } else if (liveFilterPeriode === "NEXT_7") {
      const d7 = new Date();
      d7.setDate(d7.getDate() + 7);
      const d7Str = d7.toISOString().slice(0, 10);
      if (jDateStr < today || jDateStr > d7Str) return false;
    } else if (liveFilterPeriode === "EXACT_DATE") {
      if (liveFilterExactDate && jDateStr !== liveFilterExactDate) return false;
    } else if (liveFilterPeriode === "CUSTOM") {
      if (liveFilterRangeStart && liveFilterRangeEnd) {
        if (jDateStr < liveFilterRangeStart || jDateStr > liveFilterRangeEnd) return false;
      }
    }

    // 2. Filter Rentang Jam
    if (liveFilterWaktuToggle === "CUSTOM") {
      const jMulai = (j.jamMulaiLive || "").slice(0, 5);
      const jSelesai = (j.jamSelesaiLive || "").slice(0, 5);
      if (liveFilterJamMulai && jMulai < liveFilterJamMulai) return false;
      if (liveFilterJamAkhir && jSelesai > liveFilterJamAkhir) return false;
    }

    // 3. Filter Kolom & Teks
    if (liveFilterCol === "1" && liveFilterStatus) {
      if ((j.status || "").toUpperCase() !== liveFilterStatus) return false;
    } else if (liveFilterCol === "6") {
      if (liveFilterCabang) {
        const cStr = `${j.cabangStudio || ""} ${j.studio || ""}`.toLowerCase();
        if (!cStr.includes(liveFilterCabang.toLowerCase())) return false;
      }
      if (liveFilterStudio) {
        const sStr = `${j.nomorStudio || ""} ${j.studio || ""}`.toLowerCase();
        if (!sStr.includes(liveFilterStudio.toLowerCase())) return false;
      }
    } else if (liveFilterText.trim()) {
      const q = liveFilterText.toLowerCase().trim();
      const match =
        j.idJadwal?.toLowerCase().includes(q) ||
        j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
        j.streamerNama?.toLowerCase().includes(q) ||
        j.client?.namaClient?.toLowerCase().includes(q) ||
        j.platform?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const totalLivePages = Math.max(1, Math.ceil(filteredLiveSchedules.length / livePageSize));
  const currentLivePage = Math.min(livePage, totalLivePages);
  const startLiveIndex = (currentLivePage - 1) * livePageSize;
  const paginatedLive = filteredLiveSchedules.slice(startLiveIndex, startLiveIndex + livePageSize);

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setStreamerSubTab("form")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            streamerSubTab === "form"
              ? "border-[#941A0B] text-[#941A0B]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Formulir Jadwal Streamer
        </button>
        <button
          type="button"
          onClick={() => {
            setStreamerSubTab("info");
            loadInfoStreamer();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            streamerSubTab === "info"
              ? "border-[#941A0B] text-[#941A0B]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Informasi Streamer (Libur & Sesi Live)
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* SUBVIEW 1: FORMULIR JADWAL STREAMER */}
      {streamerSubTab === "form" && (
        <form onSubmit={submitStreamerSchedules} className="space-y-4">
          {streamerForms.map((item, idx) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 relative"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 bg-[#941A0B] text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {item.idJadwal}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDuplicateForm(item)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                    title="Duplikat Form"
                  >
                    <i className="fa-solid fa-clone" /> Duplikat
                  </button>
                  {streamerForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveForm(item.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition"
                      title="Hapus Form"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Tanggal */}
                <div>
                  <label className={labelCls}>Tanggal Live *</label>
                  <FlatpickrPicker
                    value={item.tanggal}
                    placeholder="Pilih Tanggal..."
                    options={{ mode: "single", dateFormat: "Y-m-d" }}
                    onChange={(dateStr) => updateFormField(idx, "tanggal", dateStr)}
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className={labelCls}>Platform *</label>
                  <select
                    value={item.platform}
                    onChange={(e) => updateFormField(idx, "platform", e.target.value)}
                    className={selectCls}
                    required
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Host / Streamer */}
                <div>
                  <label className={labelCls}>Host / Streamer *</label>
                  <select
                    value={item.streamerKaryawanId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const s = streamers.find((x) => x.id === id);
                      updateFormField(idx, "streamerKaryawanId", id);
                      updateFormField(idx, "streamerId", s?.idKaryawan || "");
                      updateFormField(idx, "streamerNama", s?.namaLengkap || "");
                    }}
                    className={selectCls}
                    required
                  >
                    <option value="">-- Pilih Streamer --</option>
                    {streamers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaLengkap} ({s.idKaryawan})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Personel OTS */}
                <div>
                  <label className={labelCls}>Personel OTS</label>
                  <select
                    value={item.otsKaryawanId || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const o = otsStaff.find((x) => x.id === id);
                      updateFormField(idx, "otsKaryawanId", id);
                      updateFormField(idx, "otsId", o?.idKaryawan || "");
                      updateFormField(idx, "otsNama", o?.namaLengkap || "");
                    }}
                    className={selectCls}
                  >
                    <option value="">-- Pilih Staff OTS (Opsional) --</option>
                    {otsStaff.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.namaLengkap} ({o.idKaryawan})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cabang & Studio */}
                <div>
                  <label className={labelCls}>Cabang & Studio</label>
                  <select
                    value={`${item.cabangStudio}|${item.nomorStudio}`}
                    onChange={(e) => {
                      const [c, n] = e.target.value.split("|");
                      updateFormField(idx, "cabangStudio", c);
                      updateFormField(idx, "nomorStudio", n);
                    }}
                    className={selectCls}
                  >
                    {STUDIOS.map((s) => (
                      <option key={s.name} value={`${s.cabang}|${s.no}`}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Device */}
                <div>
                  <label className={labelCls}>Device</label>
                  <select
                    value={item.device || "Tidak Pakai"}
                    onChange={(e) => updateFormField(idx, "device", e.target.value)}
                    className={selectCls}
                  >
                    <option value="Tidak Pakai">Tidak Pakai Device</option>
                    <option value="Device 1">Device 1</option>
                    <option value="Device 2">Device 2</option>
                    <option value="Device 3">Device 3</option>
                  </select>
                </div>

                {/* Jam Mulai */}
                <div>
                  <label className={labelCls}>Jam Mulai Live *</label>
                  <input
                    type="time"
                    value={item.jamMulaiLive}
                    onChange={(e) => updateFormField(idx, "jamMulaiLive", e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                {/* Jam Selesai */}
                <div>
                  <label className={labelCls}>Jam Selesai Live *</label>
                  <input
                    type="time"
                    value={item.jamSelesaiLive}
                    onChange={(e) => updateFormField(idx, "jamSelesaiLive", e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                {/* Judul Live */}
                <div>
                  <label className={labelCls}>Judul Live</label>
                  <input
                    type="text"
                    value={item.judulLive || ""}
                    onChange={(e) => updateFormField(idx, "judulLive", e.target.value)}
                    placeholder="e.g. Flash Sale Live"
                    className={inputCls}
                  />
                </div>

                {/* Promo */}
                <div>
                  <label className={labelCls}>Promo Live</label>
                  <input
                    type="text"
                    value={item.promoLive || ""}
                    onChange={(e) => updateFormField(idx, "promoLive", e.target.value)}
                    placeholder="e.g. Voucher 50%"
                    className={inputCls}
                  />
                </div>

                {/* File Pendukung Host */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>Link File Pendukung (Google Drive)</label>
                  <input
                    type="text"
                    value={item.filePendukungHost || ""}
                    onChange={(e) => updateFormField(idx, "filePendukungHost", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Catatan Host */}
              <div>
                <label className={labelCls}>Catatan untuk Host</label>
                <textarea
                  rows={2}
                  value={item.catatanHost || ""}
                  onChange={(e) => updateFormField(idx, "catatanHost", e.target.value)}
                  placeholder="Catatan khusus sesi live..."
                  className={inputCls}
                />
              </div>
            </div>
          ))}

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={handleAddForm}
              className="w-full sm:w-auto px-6 py-3 bg-red-50 text-[#941A0B] rounded-xl hover:bg-red-100 font-bold transition flex items-center justify-center gap-2 text-xs border border-red-200"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 100)
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={checkBebasCrashStreamer}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-xs"
              >
                <i className="fa-solid fa-shield-halved" /> Bebas Crash
              </button>
              <button
                type="submit"
                disabled={loading || !isStreamerCrashVerified}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs text-white ${
                  isStreamerCrashVerified && !loading
                    ? "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-200"
                }`}
              >
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal Streamer"}</span>
              </button>
            </div>
          </div>

          {/* Live Schedule Monitoring Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-8">
            <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-black text-sm flex items-center gap-2">
                  <i className="fa-solid fa-video text-[#941A0B]" />
                  <span>Tabel Monitoring Jadwal Live Streamer</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan {filteredLiveSchedules.length} sesi siaran live aktif
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[500px]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-12">NO</th>
                    <th className="p-3 text-center w-24">STATUS</th>
                    <th className="p-3">WAKTU LIVE</th>
                    <th className="p-3">PLATFORM</th>
                    <th className="p-3">STREAMER / HOST</th>
                    <th className="p-3">STUDIO</th>
                    <th className="p-3 text-center">WAJIB HADIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedLive.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                        Tidak ada sesi live yang terjadwal.
                      </td>
                    </tr>
                  ) : (
                    paginatedLive.map((j, idx) => {
                      const badgeCls = getStatusBadgeClass(j.status || "TERJADWAL");
                      return (
                        <tr key={j.id || idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-center font-bold text-slate-400">
                            {startLiveIndex + idx + 1}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${badgeCls}`}>
                              {(j.status || "TERJADWAL").toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {formatDateSafe(j.tanggal)}
                            </div>
                            <div className="text-[11px] text-emerald-600 font-mono mt-0.5">
                              {formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {j.idJadwal || "–"}
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{j.platform}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {j.streamerKaryawan?.namaLengkap || j.streamerNama || "–"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {j.streamerKaryawan?.idKaryawan || j.streamerId || "–"}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700">
                            {j.cabangStudio} {j.nomorStudio ? `(${j.nomorStudio})` : ""}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-amber-600">
                            {calcWajibHadir(j.jamMulaiLive)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Hal {currentLivePage} dari {totalLivePages} ({filteredLiveSchedules.length} jadwal)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={currentLivePage <= 1}
                  onClick={() => setLivePage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={currentLivePage >= totalLivePages}
                  onClick={() => setLivePage((p) => Math.min(totalLivePages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUBVIEW 2: INFORMASI STREAMER (Libur & Sesi Live) */}
      {streamerSubTab === "info" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                <i className="fa-solid fa-calendar-check" />
              </div>
              <div>
                <h3 className="font-extrabold text-black text-base">
                  Kelola Informasi Libur & Request Sesi Live
                </h3>
                <p className="text-xs text-slate-500">
                  Data pengajuan libur dan request jam siaran dari database
                </p>
              </div>
            </div>

            {/* Action Bar */}
            {Object.keys(infoChanges).length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">
                  ⚠️ Ada {Object.keys(infoChanges).length} tanggal perubahan yang belum disimpan.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInfoChanges({})}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={savingInfoStreamer}
                    onClick={handleSimpanSemuaInfo}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                  >
                    {savingInfoStreamer ? "Menyimpan..." : "Simpan Perubahan ke DB"}
                  </button>
                </div>
              </div>
            )}

            {/* List / Table Info Streamer */}
            <div className="overflow-auto max-h-[500px]">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Libur (Maks 20)</th>
                    <th className="p-3">Request 00:00 - 08:00</th>
                    <th className="p-3">Request 08:00 - 16:00</th>
                    <th className="p-3">Request 16:00 - 00:00</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {infoStreamerData?.rows?.length ? (
                    infoStreamerData.rows.map((row: any, rIdx: number) => {
                      const tgl = row.TANGGAL || row.tanggal;
                      const edited = infoChanges[tgl];
                      const curLibur = edited ? edited.LIBUR : (row.LIBUR || []).map(formatRowItem);
                      const curR00 = edited ? edited.REQ_00_08 : (row.REQ_00_08 || []).map(formatRowItem);
                      const curR08 = edited ? edited.REQ_08_16 : (row.REQ_08_16 || []).map(formatRowItem);
                      const curR16 = edited ? edited.REQ_16_00 : (row.REQ_16_00 || []).map(formatRowItem);

                      return (
                        <tr key={tgl || rIdx} className="hover:bg-slate-50">
                          <td className="p-3 font-bold font-mono text-slate-800">{tgl}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-[11px] font-bold">
                              {curLibur.length} Orang
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-bold">
                              {curR00.length} Orang
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[11px] font-bold">
                              {curR08.length} Orang
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-[11px] font-bold">
                              {curR16.length} Orang
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => bukaModalEditInfo(tgl, row)}
                              className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-black"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        Memuat data informasi streamer...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Info Streamer Modal */}
      {editInfoDate && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Edit Libur & Request Tanggal: <span className="font-mono text-blue-600">{editInfoDate}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditInfoDate(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tab/Section Libur */}
            <div className="space-y-2">
              <label className={labelCls}>Streamer Libur ({stateEditInfo.LIBUR.length} / 20)</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 min-h-[40px]">
                {stateEditInfo.LIBUR.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...stateEditInfo.LIBUR];
                        updated.splice(idx, 1);
                        setStateEditInfo({ ...stateEditInfo, LIBUR: updated });
                      }}
                      className="text-red-400 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditInfoDate(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpanKeRamInfo}
                className="px-6 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
              >
                Simpan Sementara
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
