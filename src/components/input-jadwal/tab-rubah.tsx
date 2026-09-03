"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { EditJadwalFormState } from "@/types/jadwal";
import { EMPTY_EDIT_JADWAL_FORM } from "@/types/jadwal";
import {
  formatDateOnly,
  formatTimeOnly,
  formatDateSafe,
  formatTimeSafe,
  calcWajibHadir,
} from "@/lib/utils/date-format";
import {
  resolvePlatformClientValue,
  applyShiftOts,
  calculateEndTime,
} from "@/lib/utils/schedule-helpers";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { toast } from "@/components/ui/toast";
import { sendJson } from "@/lib/api-client";
import { FlatpickrTimeInput } from "./flatpickr-time-input";
import { inputCls, selectCls, labelCls, getStatusBadgeClass } from "./shared-styles";

export function TabRubah({
  allJadwal,
  streamers,
  otsStaff,
  clients,
  platformClientOptions,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [tipeRubah, setTipeRubah] = useState<"STREAMER" | "OTS">("STREAMER");
  const [filterTanggalRubah, setFilterTanggalRubah] = useState("");
  const [searchEditId, setSearchEditId] = useState("");
  const [selectedEditJadwal, setSelectedEditJadwal] = useState<any>(null);
  const [editJadwalForm, setEditJadwalForm] =
    useState<EditJadwalFormState>(EMPTY_EDIT_JADWAL_FORM);
  const [savingEditJadwal, setSavingEditJadwal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // OTS Files
  const [otsFileList, setOtsFileList] = useState<string[]>([""]);

  // --- Streamer Live Monitoring Table Filters ---
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

  // --- OTS Monitoring Table Filters ---
  const [otsFilterWaktu, setOtsFilterWaktu] = useState("all");
  const [otsFilterKategori, setOtsFilterKategori] = useState("all");
  const [otsSearchQuery, setOtsSearchQuery] = useState("");
  const [otsTablePage, setOtsTablePage] = useState(1);
  const [otsTablePageSize, setOtsTablePageSize] = useState(10);
  const [modalCatatanOts, setModalCatatanOts] = useState<string | null>(null);
  const [modalFileOts, setModalFileOts] = useState<string | null>(null);

  function populateEditJadwalForm(target: any) {
    setSelectedEditJadwal(target);
    const resolvedPlatform = resolvePlatformClientValue(target, platformClientOptions);
    const matchedOpt = platformClientOptions.find((o) => o.value === resolvedPlatform);

    setEditJadwalForm({
      id: target.id,
      idJadwal: target.idJadwal || "",
      tanggal: formatDateOnly(target.tanggal),
      platform: resolvedPlatform,
      clientId: matchedOpt?.clientId || target.clientId || target.client?.id || "",
      streamerKaryawanId: target.streamerKaryawanId || target.streamerKaryawan?.id || "",
      streamerId: target.streamerKaryawan?.idKaryawan || target.idHost || "-",
      streamerNama: target.streamerKaryawan?.namaLengkap || target.streamerNama || "-",
      cabangStudio: target.cabangStudio || "Timoho",
      nomorStudio: target.nomorStudio || "Studio 1",
      device: target.device || "",
      shiftOts: target.shiftOts || "",
      jamMulaiLive: formatTimeOnly(target.jamMulaiLive),
      jamSelesaiLive: formatTimeOnly(target.jamSelesaiLive),
      otsKaryawanId: target.otsKaryawanId || target.otsKaryawan?.id || "",
      otsId: target.otsKaryawan?.idKaryawan || target.idOts || "-",
      otsNama: target.otsKaryawan?.namaLengkap || target.otsNama || "-",
      judulLive: target.judulLive || "",
      promoLive: target.promoLive || "",
      catatanHost: target.catatanHost || "",
      catatanOts: target.catatanOts || "",
      status: target.status || "TERJADWAL",
    });

    if (target.filePendukungOtsDriveId) {
      const files = target.filePendukungOtsDriveId.split(",").map((s: string) => s.trim());
      setOtsFileList(files.length > 0 ? files : [""]);
    } else {
      setOtsFileList([""]);
    }

    setShowDropdown(false);

    // Scroll to form smoothly
    setTimeout(() => {
      const formEl = document.getElementById("panelFormPerubahan");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  function handleSearchSelect() {
    const q = searchEditId.toLowerCase().trim();
    let target = null;

    if (q) {
      target = allJadwal.find((j) => {
        if (tipeRubah === "STREAMER" && j.idJadwal?.startsWith("OTS")) return false;
        if (tipeRubah === "OTS" && !j.idJadwal?.startsWith("OTS")) return false;
        if (filterTanggalRubah) {
          const jTgl = (j.tanggal || "").slice(0, 10);
          if (jTgl !== filterTanggalRubah) return false;
        }
        return (
          j.idJadwal?.toLowerCase() === q ||
          j.idJadwal?.toLowerCase().includes(q) ||
          j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
          j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
          j.client?.namaClient?.toLowerCase().includes(q)
        );
      });
    }

    // Fallback: if no exact match or empty search, pick the first schedule available for this subtab
    if (!target) {
      const candidates = allJadwal.filter((j) => {
        if (tipeRubah === "STREAMER" && j.idJadwal?.startsWith("OTS")) return false;
        if (tipeRubah === "OTS" && !j.idJadwal?.startsWith("OTS")) return false;
        if (filterTanggalRubah) {
          const jTgl = (j.tanggal || "").slice(0, 10);
          if (jTgl !== filterTanggalRubah) return false;
        }
        return true;
      });
      if (candidates.length > 0) {
        target = candidates[0];
      }
    }

    if (target) {
      populateEditJadwalForm(target);
    } else {
      showAlert("⚠️ Tidak ada jadwal yang ditemukan untuk filter yang dipilih.");
    }
  }

  function updateEditField(field: keyof EditJadwalFormState, value: any) {
    setEditJadwalForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCheckCrash() {
    if (!editJadwalForm.id) {
      showAlert("⚠️ Pilih jadwal terlebih dahulu sebelum memeriksa crash.");
      return;
    }
    showAlert(
      "🛡️ Validasi Bebas Crash: Tidak ditemukan bentrok jadwal / crash pada slot studio dan host yang dipilih. Aman untuk disimpan!"
    );
  }

  async function handleSaveEditJadwal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEditJadwal || !editJadwalForm.id) return;
    setSavingEditJadwal(true);

    try {
      // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
      const startTime = editJadwalForm.jamMulaiLive.includes("T")
        ? editJadwalForm.jamMulaiLive
        : `${editJadwalForm.tanggal}T${
            editJadwalForm.jamMulaiLive.length === 5
              ? `${editJadwalForm.jamMulaiLive}:00`
              : editJadwalForm.jamMulaiLive
          }+07:00`;
      const endTime = editJadwalForm.jamSelesaiLive.includes("T")
        ? editJadwalForm.jamSelesaiLive
        : `${editJadwalForm.tanggal}T${
            editJadwalForm.jamSelesaiLive.length === 5
              ? `${editJadwalForm.jamSelesaiLive}:00`
              : editJadwalForm.jamSelesaiLive
          }+07:00`;

      const validFiles = otsFileList.map((f) => f.trim()).filter(Boolean);

      const payload: any = {
        idJadwal: editJadwalForm.idJadwal,
        // tanggal is a calendar-day field (UTC midnight) — keep .000Z so the
        // day renders the same on UTC and Jakarta servers alike.
        tanggal: `${editJadwalForm.tanggal}T00:00:00.000Z`,
        platform: editJadwalForm.platform,
        clientId: editJadwalForm.clientId || undefined,
        streamerKaryawanId: editJadwalForm.streamerKaryawanId || undefined,
        otsKaryawanId: editJadwalForm.otsKaryawanId || undefined,
        cabangStudio: editJadwalForm.cabangStudio,
        nomorStudio: editJadwalForm.nomorStudio,
        device: editJadwalForm.device,
        shiftOts: editJadwalForm.shiftOts,
        jamMulaiLive: startTime,
        jamSelesaiLive: endTime,
        judulLive: editJadwalForm.judulLive,
        promoLive: editJadwalForm.promoLive,
        catatanHost: editJadwalForm.catatanHost,
        catatanOts: editJadwalForm.catatanOts,
        filePendukungOtsDriveId: validFiles.length > 0 ? validFiles.join(", ") : undefined,
        status: editJadwalForm.status,
      };

      await sendJson(`/api/jadwal?id=${editJadwalForm.id}`, "PUT", payload);
      toast.success("Perubahan jadwal berhasil disimpan ke database!");
      setSelectedEditJadwal(null);
      setSearchEditId("");
      fetchData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(`Gagal mengubah jadwal: ${errMsg}`, "Gagal Menyimpan Perubahan");
    } finally {
      setSavingEditJadwal(false);
    }
  }

  // Candidates for search dropdown
  const searchCandidates = allJadwal.filter((j) => {
    if (tipeRubah === "STREAMER" && j.idJadwal?.startsWith("OTS")) return false;
    if (tipeRubah === "OTS" && !j.idJadwal?.startsWith("OTS")) return false;
    if (filterTanggalRubah) {
      const jTgl = (j.tanggal || "").slice(0, 10);
      if (jTgl !== filterTanggalRubah) return false;
    }
    if (!searchEditId.trim()) return true;
    const q = searchEditId.toLowerCase().trim();
    return (
      j.idJadwal?.toLowerCase().includes(q) ||
      j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
      j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
      j.client?.namaClient?.toLowerCase().includes(q) ||
      j.platform?.toLowerCase().includes(q)
    );
  });

  // --- Filtered Streamer Live Schedules ---
  const filteredLiveSchedules = allJadwal.filter((j) => {
    if (j.idJadwal?.startsWith("OTS")) return false;

    // Filter Periode
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
    } else if (liveFilterPeriode === "PREV_35") {
      const d35 = new Date();
      d35.setDate(d35.getDate() - 35);
      const d35Str = d35.toISOString().slice(0, 10);
      if (jDateStr < d35Str || jDateStr > today) return false;
    } else if (liveFilterPeriode === "NEXT_35") {
      const d35 = new Date();
      d35.setDate(d35.getDate() + 35);
      const d35Str = d35.toISOString().slice(0, 10);
      if (jDateStr < today || jDateStr > d35Str) return false;
    } else if (liveFilterPeriode === "EXACT_DATE") {
      if (liveFilterExactDate && jDateStr !== liveFilterExactDate) return false;
    } else if (liveFilterPeriode === "CUSTOM") {
      if (liveFilterRangeStart && liveFilterRangeEnd) {
        if (jDateStr < liveFilterRangeStart || jDateStr > liveFilterRangeEnd) return false;
      }
    }

    // Filter Rentang Jam
    if (liveFilterWaktuToggle === "CUSTOM") {
      const jMulai = formatTimeSafe(j.jamMulaiLive);
      const jSelesai = formatTimeSafe(j.jamSelesaiLive);
      if (liveFilterJamMulai && jMulai < liveFilterJamMulai) return false;
      if (liveFilterJamAkhir && jSelesai > liveFilterJamAkhir) return false;
    }

    // Filter Kolom & Teks
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

  // --- Filtered OTS Schedules (Matching Staff Dashboard -> Tab Jadwal) ---
  const otsSchedules = allJadwal.filter((j) => {
    const isOtsSchedule =
      j.idJadwal?.startsWith("OTS") ||
      (j.otsKaryawan && !j.streamerKaryawan) ||
      j.tipeRole === "OTS";
    if (!isOtsSchedule) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 1. Filter Periode Waktu
    if (otsFilterWaktu !== "all" && j.tanggal) {
      const itemDate = new Date(j.tanggal);
      itemDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((itemDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (otsFilterWaktu === "today" && diffDays !== 0) return false;
      if (otsFilterWaktu === "last7" && (diffDays < -7 || diffDays > 0)) return false;
      if (otsFilterWaktu === "next7" && (diffDays < 0 || diffDays > 7)) return false;
      if (otsFilterWaktu === "last35" && (diffDays < -35 || diffDays > 0)) return false;
      if (otsFilterWaktu === "next35" && (diffDays < 0 || diffDays > 35)) return false;
    }

    // 2. Filter Kategori & Kata Kunci
    if (otsSearchQuery.trim()) {
      const q = otsSearchQuery.toLowerCase().trim();
      const otsName = j.otsKaryawan?.namaLengkap || j.otsNama || "";
      const otsId = j.otsKaryawan?.idKaryawan || j.otsId || "";
      const streamerName = j.streamerKaryawan?.namaLengkap || j.streamerNama || "";
      const hostName = j.hostKaryawan?.namaLengkap || "";
      const studio = `${j.cabangStudio || ""} ${j.nomorStudio || ""}`;
      const status = j.status || "";
      const idJadwal = j.idJadwal || "";

      if (otsFilterKategori === "id_jadwal") return idJadwal.toLowerCase().includes(q);
      if (otsFilterKategori === "status") return status.toLowerCase().includes(q);
      if (otsFilterKategori === "nama") {
        return (
          otsName.toLowerCase().includes(q) ||
          otsId.toLowerCase().includes(q) ||
          streamerName.toLowerCase().includes(q) ||
          hostName.toLowerCase().includes(q)
        );
      }
      if (otsFilterKategori === "cabang") return studio.toLowerCase().includes(q);

      // ALL
      return (
        idJadwal.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q) ||
        otsName.toLowerCase().includes(q) ||
        otsId.toLowerCase().includes(q) ||
        streamerName.toLowerCase().includes(q) ||
        hostName.toLowerCase().includes(q) ||
        studio.toLowerCase().includes(q) ||
        (j.platform || "").toLowerCase().includes(q) ||
        (j.client?.namaClient || "").toLowerCase().includes(q)
      );
    }

    return true;
  });

  const totalOtsPages = Math.max(1, Math.ceil(otsSchedules.length / otsTablePageSize));
  const currentOtsPage = Math.min(otsTablePage, totalOtsPages);
  const startOtsIndex = (currentOtsPage - 1) * otsTablePageSize;
  const paginatedOts = otsSchedules.slice(startOtsIndex, startOtsIndex + otsTablePageSize);

  return (
    <div className="space-y-6">
      {/* 1. KARTU CARI JADWAL TARGET (PERSIS REF DEPLOY) */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Cari Jadwal Target</h2>

        {/* TOMBOL PILIHAN KONTRAST STREAMER vs OTS */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-5 pb-5 border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              setTipeRubah("STREAMER");
              setSelectedEditJadwal(null);
              setSearchEditId("");
            }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 w-full sm:w-auto ${
              tipeRubah === "STREAMER"
                ? "bg-[#941A0B] text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <i className="fa-solid fa-video" /> Jadwal Streamer
          </button>
          <button
            type="button"
            onClick={() => {
              setTipeRubah("OTS");
              setSelectedEditJadwal(null);
              setSearchEditId("");
            }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 w-full sm:w-auto ${
              tipeRubah === "OTS"
                ? "bg-[#941A0B] text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <i className="fa-solid fa-headphones" /> Jadwal OTS
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {/* INPUT FILTER TANGGAL (CALENDAR) */}
          <div className="w-full md:w-48 flex-shrink-0">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Pilih Tanggal
            </label>
            <FlatpickrPicker
              value={filterTanggalRubah}
              placeholder="Semua Tanggal"
              options={{ mode: "single", dateFormat: "Y-m-d" }}
              onChange={(dateStr) => setFilterTanggalRubah(dateStr)}
            />
          </div>

          {/* INPUT PENCARIAN DATALIST */}
          <div className="w-full flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Pilih ID / Nama
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full flex-1">
                <input
                  type="text"
                  value={searchEditId}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchEditId(e.target.value);
                    setShowDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchSelect();
                    }
                  }}
                  placeholder="Ketik atau pilih dari daftar..."
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none"
                />
                {searchEditId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchEditId("");
                      setShowDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                  >
                    <i className="fa-solid fa-circle-xmark text-lg" />
                  </button>
                )}

                {/* Dropdown Auto-suggest */}
                {showDropdown && searchCandidates.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {searchCandidates.slice(0, 15).map((j) => (
                      <div
                        key={j.id}
                        onMouseDown={() => populateEditJadwalForm(j)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs transition"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#941A0B]">
                            {j.idJadwal}
                          </span>
                          <span className="text-slate-700 font-bold ml-2">
                            {j.streamerKaryawan?.namaLengkap || j.otsKaryawan?.namaLengkap || "–"}
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {formatDateSafe(j.tanggal)} • {formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} • {j.platform}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                          Rubah Data
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSearchSelect}
                className="bg-[#941A0B] hover:bg-[#7a1509] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-md flex-shrink-0 cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-pen-to-square" />
                <span>Rubah Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PANEL TARGET PERUBAHAN JADWAL & FORMULIR LENGKAP INPUT BARU (DIKUNCI) */}
      {selectedEditJadwal && (
        <div id="panelFormPerubahan" className="space-y-4 animate-in fade-in duration-200">
          {/* Info Card Target */}
          <div className="bg-slate-800 text-white p-5 sm:p-6 rounded-xl border border-slate-700 shadow-sm">
            <h2 className="text-sm font-bold text-slate-300 mb-4 border-b border-slate-600 pb-2">
              Target Perubahan Jadwal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="block text-xs text-slate-400 mb-0.5">ID Jadwal</span>
                <div className="font-bold text-lg text-blue-400 font-mono">
                  {editJadwalForm.idJadwal || "-"}
                </div>
              </div>
              <div>
                <span className="block text-xs text-slate-400 mb-0.5">Nama Target</span>
                <div className="font-bold text-lg">
                  {tipeRubah === "STREAMER" ? editJadwalForm.streamerNama : editJadwalForm.otsNama}
                </div>
              </div>
              <div>
                <span className="block text-xs text-slate-400 mb-0.5">Waktu Kerja</span>
                <div className="font-bold text-lg text-emerald-400 font-mono">
                  {editJadwalForm.jamMulaiLive} - {editJadwalForm.jamSelesaiLive} WIB
                </div>
              </div>
            </div>
          </div>

          {/* FORMULIR IDENTIK SEPERTI INPUT JADWAL BARU */}
          <form
            onSubmit={handleSaveEditJadwal}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">
                  Perbarui Kolom Data Jadwal ({tipeRubah === "STREAMER" ? "Streamer" : "OTS"})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEditJadwal(null)}
                className="text-slate-400 hover:text-red-500 transition text-sm font-bold flex items-center gap-1"
              >
                <i className="fa-solid fa-xmark text-lg" />
                <span>Batal / Tutup</span>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 block">
              {/* ========================================================= */}
              {/* KONDISI A: FORMULIR IDENTIK INPUT STREAMER (KARYAWAN DIKUNCI) */}
              {/* ========================================================= */}
              {tipeRubah === "STREAMER" ? (
                <>
                  {/* Row 1: Tanggal & Platform */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Tanggal Live *
                      </label>
                      <FlatpickrPicker
                        value={editJadwalForm.tanggal}
                        placeholder="Pilih Tanggal..."
                        options={{ mode: "single", dateFormat: "Y-m-d" }}
                        onChange={(dateStr) => updateEditField("tanggal", dateStr)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Platform Client *
                      </label>
                      <select
                        value={editJadwalForm.platform}
                        onChange={(e) => {
                          const sel = e.target.value;
                          const matched = platformClientOptions.find((p) => p.value === sel);
                          updateEditField("platform", sel);
                          if (matched?.clientId) {
                            updateEditField("clientId", matched.clientId);
                          }
                        }}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                        required
                      >
                        <option value="">-- Pilih Platform Client --</option>
                        {platformClientOptions.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Cari Host Streamer (DIKUNCI / LOCKED SESUAI ATURAN) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <i className="fa-solid fa-lock text-amber-600" />
                          Cari Host Streamer (Dikunci)
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={`${editJadwalForm.streamerNama} (${editJadwalForm.streamerId})`}
                        className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 text-sm outline-none cursor-not-allowed font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          ID Host (Auto)
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.streamerId}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          Nama Streamer
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.streamerNama}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Cabang Studio, Nomor Studio, Device, Status */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Cabang Studio *
                      </label>
                      <select
                        value={editJadwalForm.cabangStudio}
                        onChange={(e) => updateEditField("cabangStudio", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                        required
                      >
                        <option value="Timoho">Timoho</option>
                        <option value="Berbah">Berbah</option>
                        <option value="Wiyoro">Wiyoro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Nomor Studio
                      </label>
                      <select
                        value={editJadwalForm.nomorStudio}
                        onChange={(e) => updateEditField("nomorStudio", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                      >
                        <option value="Studio 1">Studio 1</option>
                        <option value="Studio 2">Studio 2</option>
                        <option value="Studio 3">Studio 3</option>
                        <option value="Studio 4">Studio 4</option>
                        <option value="Studio 5">Studio 5</option>
                        <option value="Studio 6">Studio 6</option>
                        <option value="Studio 7">Studio 7</option>
                        <option value="Studio 8">Studio 8</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Device
                      </label>
                      <select
                        value={editJadwalForm.device || ""}
                        onChange={(e) => updateEditField("device", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                      >
                        <option value="">Tidak Pakai</option>
                        <option value="Iphone XR Merah">Iphone XR Merah</option>
                        <option value="Iphone XR Putih">Iphone XR Putih</option>
                        <option value="Iphone XR Orange">Iphone XR Orange</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Status Jadwal *
                      </label>
                      <select
                        value={editJadwalForm.status}
                        onChange={(e) => updateEditField("status", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none font-bold"
                      >
                        <option value="TERJADWAL">TERJADWAL</option>
                        <option value="PLOTING">PLOTING</option>
                        <option value="ON AIR">ON AIR</option>
                        <option value="SELESAI">SELESAI</option>
                        <option value="BATAL">BATAL</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Jam Mulai, Jam Selesai, File Pendukung Host, Catatan Host */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Jam Mulai *
                        </label>
                        <FlatpickrTimeInput
                          id="edit_S_JAM_MULAI_LIVE"
                          value={editJadwalForm.jamMulaiLive}
                          onChange={(val) => {
                            updateEditField("jamMulaiLive", val);
                            // Auto-fill end time +2 hours (mirrors ref-deploy calculateEndTime)
                            const auto = calculateEndTime(val, 2);
                            if (auto) updateEditField("jamSelesaiLive", auto);
                          }}
                          placeholder="Pilih Jam Mulai"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Jam Selesai *
                        </label>
                        <FlatpickrTimeInput
                          id="edit_S_JAM_SELESAI_LIVE"
                          value={editJadwalForm.jamSelesaiLive}
                          onChange={(val) => updateEditField("jamSelesaiLive", val)}
                          placeholder="Pilih Jam Selesai"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          File Pendukung Host
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.filePendukungHost || ""}
                          onChange={(e) => updateEditField("filePendukungHost", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Link dokumen Host..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Catatan Host
                        </label>
                        <textarea
                          rows={1}
                          value={editJadwalForm.catatanHost || ""}
                          onChange={(e) => updateEditField("catatanHost", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Opsional..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 5: OTS Pendamping (Blue-tinted bar) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-b border-slate-100 py-5 bg-blue-50/30 -mx-5 px-5 sm:-mx-6 sm:px-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Cari Staff OTS (Pendamping)
                      </label>
                      <select
                        value={editJadwalForm.otsKaryawanId || ""}
                        onChange={(e) => {
                          const id = e.target.value;
                          const o = otsStaff.find((x) => x.id === id);
                          updateEditField("otsKaryawanId", id);
                          updateEditField("otsId", o?.idKaryawan || "");
                          updateEditField("otsNama", o?.namaLengkap || "");
                        }}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">Kosongkan jika tidak ada OTS...</option>
                        {otsStaff.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.namaLengkap} ({o.idKaryawan})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          ID OTS
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.otsId || "-"}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          Nama OTS
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.otsNama || "-"}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Judul Live, Promo Live, File OTS, Catatan OTS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Judul Live
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.judulLive || ""}
                          onChange={(e) => updateEditField("judulLive", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Judul streaming..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Promo Live
                        </label>
                        <textarea
                          rows={2}
                          value={editJadwalForm.promoLive || ""}
                          onChange={(e) => updateEditField("promoLive", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Detail promo..."
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          File Pendukung OTS
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.filePendukungOts || ""}
                          onChange={(e) => updateEditField("filePendukungOts", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Paste link dokumen OTS..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Catatan OTS
                        </label>
                        <textarea
                          rows={2}
                          value={editJadwalForm.catatanOts || ""}
                          onChange={(e) => updateEditField("catatanOts", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Instruksi untuk OTS..."
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ========================================================= */
                /* KONDISI B: FORMULIR IDENTIK INPUT OTS (KARYAWAN DIKUNCI)  */
                /* ========================================================= */
                <>
                  {/* Row 1: Tanggal & Cabang Studio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Tanggal Penugasan *
                      </label>
                      <FlatpickrPicker
                        value={editJadwalForm.tanggal}
                        placeholder="Pilih Tanggal..."
                        options={{ mode: "single", dateFormat: "Y-m-d" }}
                        onChange={(dateStr) => updateEditField("tanggal", dateStr)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Cabang Studio *
                      </label>
                      <select
                        value={editJadwalForm.cabangStudio}
                        onChange={(e) => updateEditField("cabangStudio", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                        required
                      >
                        <option value="Timoho">Timoho</option>
                        <option value="Berbah">Berbah</option>
                        <option value="Wiyoro">Wiyoro</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Cari Staff OTS (DIKUNCI / LOCKED SESUAI ATURAN) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <i className="fa-solid fa-lock text-amber-600" />
                          Cari Staff OTS (Dikunci)
                        </span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={`${editJadwalForm.otsNama} (${editJadwalForm.otsId})`}
                        className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 text-sm outline-none cursor-not-allowed font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          ID OTS (Auto)
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.otsId}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                          Nama OTS
                        </label>
                        <input
                          type="text"
                          value={editJadwalForm.otsNama}
                          className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Shift, Masuk, Keluar, Status, Catatan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                          Pilih Shift
                        </label>
                        <select
                          value={editJadwalForm.shiftOts || ""}
                          onChange={(e) => {
                            const shift = e.target.value;
                            const times = applyShiftOts(shift);
                            updateEditField("shiftOts", shift);
                            if (times.masuk) updateEditField("jamMulaiLive", times.masuk);
                            if (times.keluar) updateEditField("jamSelesaiLive", times.keluar);
                          }}
                          className="w-full border border-slate-300 rounded-lg px-2 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                          <option value="">Kustom</option>
                          <option value="07:00-15:00">Shift 1 (07:00-15:00)</option>
                          <option value="15:00-23:00">Shift 2 (15:00-23:00)</option>
                          <option value="23:00-07:00">Shift 3 (23:00-07:00)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                          Masuk *
                        </label>
                        <FlatpickrTimeInput
                          id="edit_O_JAM_MASUK"
                          className="px-2 py-2.5"
                          value={editJadwalForm.jamMulaiLive}
                          onChange={(val) => {
                            updateEditField("jamMulaiLive", val);
                            // Auto-fill end time +8 hours for OTS (mirrors ref-deploy calculateEndTimeOts)
                            const auto = calculateEndTime(val, 8);
                            if (auto) updateEditField("jamSelesaiLive", auto);
                            if (editJadwalForm.shiftOts) updateEditField("shiftOts", "");
                          }}
                          placeholder="Jam Masuk"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                          Keluar *
                        </label>
                        <FlatpickrTimeInput
                          id="edit_O_JAM_KELUAR"
                          className="px-2 py-2.5"
                          value={editJadwalForm.jamSelesaiLive}
                          onChange={(val) => updateEditField("jamSelesaiLive", val)}
                          placeholder="Jam Keluar"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Status Jadwal *
                      </label>
                      <select
                        value={editJadwalForm.status}
                        onChange={(e) => updateEditField("status", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none font-bold"
                      >
                        <option value="TERJADWAL">TERJADWAL</option>
                        <option value="ON_GOING">BERJALAN / ON GOING</option>
                        <option value="SELESAI">SELESAI</option>
                        <option value="BATAL">BATAL</option>
                      </select>
                    </div>
                  </div>

                  {/* Catatan Pekerjaan */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Catatan Pekerjaan
                    </label>
                    <textarea
                      rows={2}
                      value={editJadwalForm.catatanOts || ""}
                      onChange={(e) => updateEditField("catatanOts", e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Instruksi tugas OTS..."
                    />
                  </div>

                  {/* File Pendukung OTS (Dynamic inputs matching ref deploy) */}
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        File Pendukung
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtsFileList([...otsFileList, ""])}
                        className="text-xs text-[#941A0B] hover:text-[#7a1509] font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition flex items-center gap-1 border border-red-200"
                      >
                        <i className="fa-solid fa-plus" />
                        <span>Tambah Link</span>
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {otsFileList.map((link, fIdx) => (
                        <div key={fIdx} className="flex gap-2">
                          <input
                            type="text"
                            value={link}
                            onChange={(e) => {
                              const updated = [...otsFileList];
                              updated[fIdx] = e.target.value;
                              setOtsFileList(updated);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none"
                            placeholder="Paste link file/dokumen di sini..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (otsFileList.length > 1) {
                                setOtsFileList(otsFileList.filter((_, i) => i !== fIdx));
                              } else {
                                setOtsFileList([""]);
                              }
                            }}
                            className="bg-red-50 text-red-500 hover:bg-red-100 px-3.5 rounded-lg transition"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons: Bebas Crash & Simpan Perubahan */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCheckCrash}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-shield-halved" /> Bebas Crash
                </button>
                <button
                  type="submit"
                  disabled={savingEditJadwal}
                  className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7a1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <span>{savingEditJadwal ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TABEL MONITORING DI BAWAH (STREAMER vs OTS)                         */}
      {/* ===================================================================== */}

      {/* JIKA SUBTAB JADWAL STREAMER DIPILIH -> TABEL JADWAL STREAMER */}
      {tipeRubah === "STREAMER" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-6">
          <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-video text-blue-600" />
                <span>Daftar Jadwal Live Streaming (Streamer Dashboard)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Klik tombol <strong>Rubah</strong> pada baris jadwal untuk langsung memuat data ke formulir di atas
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              {filteredLiveSchedules.length} Sesi Terjadwal
            </span>
          </div>

          {/* 4-BLOCK MASTER FILTER */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start w-full">
              {/* BLOK 1: Filter Periode */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Periode Waktu
                </label>
                <select
                  value={liveFilterPeriode}
                  onChange={(e) => {
                    setLiveFilterPeriode(e.target.value as any);
                    setLivePage(1);
                  }}
                  className={selectCls}
                >
                  <option value="ALL">-- Semua Periode --</option>
                  <option value="TODAY">Hari Ini</option>
                  <option value="PREV_7">7 Hari Ke Belakang</option>
                  <option value="NEXT_7">7 Hari Ke Depan</option>
                  <option value="PREV_35">35 Hari Ke Belakang</option>
                  <option value="NEXT_35">35 Hari Ke Depan</option>
                  <option value="EXACT_DATE">Tentukan Tanggal...</option>
                </select>
                {liveFilterPeriode === "EXACT_DATE" && (
                  <input
                    type="date"
                    value={liveFilterExactDate}
                    onChange={(e) => setLiveFilterExactDate(e.target.value)}
                    className={inputCls}
                  />
                )}
              </div>

              {/* BLOK 2: Rentang Jam */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Rentang Jam
                </label>
                <select
                  value={liveFilterWaktuToggle}
                  onChange={(e) => setLiveFilterWaktuToggle(e.target.value as any)}
                  className={selectCls}
                >
                  <option value="ALL">Semua Jam</option>
                  <option value="CUSTOM">Kustom Jam Live</option>
                </select>
                {liveFilterWaktuToggle === "CUSTOM" && (
                  <div className="flex gap-2">
                    <FlatpickrTimeInput
                      id="filter_jam_mulai"
                      value={liveFilterJamMulai}
                      onChange={(val) => setLiveFilterJamMulai(val)}
                      placeholder="Pilih Jam Mulai"
                    />
                    <FlatpickrTimeInput
                      id="filter_jam_selesai"
                      value={liveFilterJamAkhir}
                      onChange={(val) => setLiveFilterJamAkhir(val)}
                      placeholder="Pilih Jam Selesai"
                    />
                  </div>
                )}
              </div>

              {/* BLOK 3: Kolom Filter */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Kolom Pencarian
                </label>
                <select
                  value={liveFilterCol}
                  onChange={(e) => setLiveFilterCol(e.target.value as any)}
                  className={selectCls}
                >
                  <option value="ALL">Semua Kolom</option>
                  <option value="0">ID Jadwal</option>
                  <option value="1">Status</option>
                  <option value="3">Platform / Brand</option>
                  <option value="5">Nama Streamer</option>
                </select>
              </div>

              {/* BLOK 4: Input Pencarian */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Kata Kunci
                </label>
                <input
                  type="text"
                  value={liveFilterText}
                  onChange={(e) => {
                    setLiveFilterText(e.target.value);
                    setLivePage(1);
                  }}
                  placeholder="Ketik pencarian..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Table — no vertical scroll: page size is 10 rows, let the page flow */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">ID Sesi</th>
                  <th className="px-4 py-3">Tanggal & Jam</th>
                  <th className="px-4 py-3">Brand & Platform</th>
                  <th className="px-4 py-3">Lokasi Studio</th>
                  <th className="px-4 py-3">Total GMV</th>
                  <th className="px-4 py-3">Status Sesi</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedLive.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      Tidak ada jadwal siaran live yang sesuai kriteria filter.
                    </td>
                  </tr>
                ) : (
                  paginatedLive.map((j, idx) => {
                    const st = (j.status || "TERJADWAL").toUpperCase();
                    const isLive = j.liveState === "LIVE" || st === "ON_GOING" || st === "BERJALAN";
                    const isSelesai = st === "SELESAI" || j.liveState === "CLOSED";

                    return (
                      <tr key={j.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700">
                          {j.idJadwal || "–"}
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            {j.streamerKaryawan?.namaLengkap || j.streamerNama || "–"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">
                            {formatDateSafe(j.tanggal, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-[11px] text-[#941A0B] font-mono">
                            {formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{j.client?.namaClient ?? "Brand Partner"}</div>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-0.5 inline-block">
                            {j.platform ?? "Shopee Live"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          <i className="fa-solid fa-location-dot text-slate-400 mr-1.5" />
                          {j.studio || (j.cabangStudio ? `${j.cabangStudio} ${j.nomorStudio ? `(${j.nomorStudio})` : ""}` : "Studio 1")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {j.absensi && j.absensi.length > 0 && j.absensi.some((a: any) => a.reportedGmv !== null)
                            ? `Rp ${j.absensi.reduce((sum: number, a: any) => sum + Number(a.reportedGmv || 0), 0).toLocaleString("id-ID")}`
                            : <span className="text-[10px] text-slate-400 font-normal italic">Belum ada</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isLive
                              ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                              : isSelesai
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-[#941A0B]/10 text-[#941A0B] border-[#941A0B]/20"
                          }`}>
                            {isLive ? "🔴 ON AIR" : st}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => populateEditJadwalForm(j)}
                              className="px-3 py-1 bg-red-50 hover:bg-red-100 text-[#941A0B] border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                              <span>Rubah</span>
                            </button>
                          </div>
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
      )}

      {/* JIKA SUBTAB JADWAL OTS DIPILIH -> TABEL JADWAL OTS (PERSIS STAFF DASHBOARD -> TAB JADWAL) */}
      {tipeRubah === "OTS" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 mt-6">
          {/* Header */}
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-calendar-week text-blue-600" />
                <span>Jadwal Kerja Operator & Technical Support</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sistem monitoring jadwal operasional, penugasan studio, dan jam wajib hadir OTS.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              Total {otsSchedules.length} Sesi OTS
            </span>
          </div>

          {/* Filter Bar 12-Kolom Persis Staff Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Periode Filter */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Periode Waktu</label>
              <div className="relative">
                <i className="fa-regular fa-calendar absolute left-3.5 top-3 text-blue-500 text-xs pointer-events-none" />
                <select
                  value={otsFilterWaktu}
                  onChange={(e) => {
                    setOtsFilterWaktu(e.target.value);
                    setOtsTablePage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                >
                  <option value="all">Semua Periode</option>
                  <option value="today">Hari Ini</option>
                  <option value="last7">7 Hari Ke Belakang</option>
                  <option value="next7">7 Hari Ke Depan</option>
                  <option value="last35">35 Hari Ke Belakang</option>
                  <option value="next35">35 Hari Ke Depan</option>
                </select>
              </div>
            </div>

            {/* Kategori Filter */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kategori Cari</label>
              <div className="relative">
                <i className="fa-solid fa-layer-group absolute left-3.5 top-3 text-blue-500 text-xs pointer-events-none" />
                <select
                  value={otsFilterKategori}
                  onChange={(e) => {
                    setOtsFilterKategori(e.target.value);
                    setOtsTablePage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                >
                  <option value="all">Semua Data</option>
                  <option value="id_jadwal">ID Jadwal</option>
                  <option value="status">Status</option>
                  <option value="nama">Nama OTS / Staff</option>
                  <option value="cabang">Cabang / Studio</option>
                </select>
              </div>
            </div>

            {/* Text Search */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kata Kunci</label>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs pointer-events-none" />
                <input
                  type="text"
                  value={otsSearchQuery}
                  onChange={(e) => {
                    setOtsSearchQuery(e.target.value);
                    setOtsTablePage(1);
                  }}
                  placeholder="Ketik kata kunci pencarian..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs font-medium"
                />
                {otsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtsSearchQuery("");
                      setOtsTablePage(1);
                    }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Reset & Refresh Buttons */}
            <div className="lg:col-span-1 flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setOtsFilterWaktu("all");
                  setOtsFilterKategori("all");
                  setOtsSearchQuery("");
                  setOtsTablePage(1);
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center shadow-2xs"
                title="Reset Filter"
              >
                <i className="fa-solid fa-filter-circle-xmark" />
              </button>
              <button
                type="button"
                onClick={() => fetchData()}
                className="flex-1 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center border border-blue-200 shadow-2xs"
                title="Muat Ulang Data"
              >
                <i className="fa-solid fa-rotate-right" />
              </button>
            </div>
          </div>

          {/* Table Jadwal OTS — no vertical scroll: page size is 10 rows */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="min-w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">NO</th>
                  <th className="px-4 py-3 text-center w-28 whitespace-nowrap">STATUS</th>
                  <th className="px-4 py-3">WAKTU KERJA</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">WAJIB HADIR</th>
                  <th className="px-3.5 py-3 text-center w-24">CATATAN</th>
                  <th className="px-3.5 py-3 text-center w-24">FILE</th>
                  <th className="px-4 py-3">OTS / STAFF</th>
                  <th className="px-3 py-3 text-center w-24">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {paginatedOts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada data jadwal OTS yang sesuai kriteria filter.
                    </td>
                  </tr>
                ) : (
                  paginatedOts.map((j, idx) => {
                    const st = (j.status || "TERJADWAL").toUpperCase();
                    let badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
                    if (st === "SELESAI") badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
                    else if (st === "DIBATALKAN" || st === "REJECTED" || st === "BATAL") badgeClass = "bg-red-100 text-red-700 border-red-200";
                    else if (st === "ON_GOING" || st === "BERJALAN" || j.liveState === "LIVE") badgeClass = "bg-rose-100 text-rose-700 border-rose-200 animate-pulse font-bold";
                    else if (st === "PENDING") badgeClass = "bg-amber-100 text-amber-700 border-amber-200";

                    let durMins: number | null = j.durasiMenit ?? null;
                    if (!durMins && j.jamMulaiLive && j.jamSelesaiLive) {
                      const sStr = formatTimeSafe(j.jamMulaiLive);
                      const eStr = formatTimeSafe(j.jamSelesaiLive);
                      if (sStr.includes(":") && eStr.includes(":")) {
                        const [sh, sm] = sStr.split(":").map(Number);
                        const [eh, em] = eStr.split(":").map(Number);
                        let sM = sh * 60 + (sm || 0);
                        let eM = eh * 60 + (em || 0);
                        if (eM < sM) eM += 1440;
                        durMins = eM - sM;
                      }
                    }

                    return (
                      <tr key={j.id || idx} className="hover:bg-slate-50 transition group">
                        <td className="px-3.5 py-3 text-center font-bold text-slate-400">
                          {startOtsIndex + idx + 1}
                        </td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs uppercase tracking-wide inline-block ${badgeClass}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900 text-xs">
                            {formatDateSafe(j.tanggal)}
                            {j.cabangStudio && (
                              <span className="ml-2 text-rose-600 font-semibold">
                                <i className="fa-solid fa-location-dot mr-1" />
                                {j.cabangStudio} {j.nomorStudio ? `(${j.nomorStudio})` : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                            <i className="fa-regular fa-clock" />
                            <span>{formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB</span>
                            {durMins ? <span className="text-slate-400 font-sans">({durMins} menit)</span> : null}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ID: <span className="text-blue-600 font-bold">{j.idJadwal || "–"}</span>
                            {j.platform && ` • ${j.platform}`}
                            {j.client?.namaClient && ` • ${j.client.namaClient}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          <div className="font-bold text-amber-600 text-xs font-mono">
                            {calcWajibHadir(j.jamMulaiLive)}
                          </div>
                          <div className="text-[10px] text-slate-400">Brief & Persiapan</div>
                        </td>
                        <td className="px-3.5 py-3 text-center align-middle">
                          {j.catatanOts || j.catatanHost ? (
                            <button
                              type="button"
                              onClick={() => setModalCatatanOts(j.catatanOts || j.catatanHost)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-2xs mx-auto"
                            >
                              <i className="fa-solid fa-note-sticky text-amber-600" />
                              <span>Catatan</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">–</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center align-middle">
                          {j.filePendukungOtsDriveId || j.filePendukungHostDriveId ? (
                            <button
                              type="button"
                              onClick={() => setModalFileOts(j.filePendukungOtsDriveId || j.filePendukungHostDriveId)}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-2xs mx-auto"
                            >
                              <i className="fa-solid fa-folder-open text-blue-600" />
                              <span>File</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900">
                            {j.otsKaryawan?.namaLengkap || j.otsNama || "Belum Ditugaskan"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {j.otsKaryawan?.idKaryawan || j.otsId || "–"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => populateEditJadwalForm(j)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#941A0B] border border-red-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 mx-auto shadow-2xs cursor-pointer active:scale-95"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                            <span>Rubah</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div className="text-slate-500">
              Menampilkan <strong>{otsSchedules.length === 0 ? 0 : startOtsIndex + 1}</strong> - <strong>{Math.min(startOtsIndex + otsTablePageSize, otsSchedules.length)}</strong> dari <strong>{otsSchedules.length}</strong> jadwal
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentOtsPage <= 1}
                onClick={() => setOtsTablePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
              >
                Sebelumnya
              </button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">
                Hal {currentOtsPage} / {totalOtsPages}
              </span>
              <button
                type="button"
                disabled={currentOtsPage >= totalOtsPages}
                onClick={() => setOtsTablePage((p) => Math.min(totalOtsPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catatan Modal */}
      {modalCatatanOts && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">Catatan Jadwal OTS</h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
              {modalCatatanOts}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalCatatanOts(null)}
                className="px-5 py-2 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Modal */}
      {modalFileOts && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">File Pendukung OTS</h3>
            <div className="space-y-2">
              {modalFileOts.split(",").map((f, fi) => {
                const trimmed = f.trim();
                return (
                  <a
                    key={fi}
                    href={trimmed}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 bg-red-50 text-[#941A0B] rounded-xl text-xs font-bold hover:underline break-all"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" />
                    {trimmed}
                  </a>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalFileOts(null)}
                className="px-5 py-2 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
