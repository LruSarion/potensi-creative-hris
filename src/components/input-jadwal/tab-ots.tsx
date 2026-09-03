"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import {
  generateNewScheduleId,
  applyShiftOts,
} from "@/lib/utils/schedule-helpers";
import {
  formatDateSafe,
  formatTimeSafe,
  calcWajibHadir,
} from "@/lib/utils/date-format";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { toast } from "@/components/ui/toast";
import { sendJson } from "@/lib/api-client";
import { FlatpickrTimeInput } from "./flatpickr-time-input";
import { calculateEndTime } from "@/lib/utils/schedule-helpers";
import { labelCls, getStatusBadgeClass } from "./shared-styles";

export function TabOts({
  otsStaff,
  allJadwal,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [otsForms, setOtsForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("OTS"),
      tanggal: "",
      platform: "Shopee Live",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      otsKaryawanId: "",
      otsId: "",
      otsNama: "",
      shiftOts: "",
      jamMulaiLive: "",
      jamSelesaiLive: "",
      catatanOts: "",
      filesOts: [""],
    },
  ]);
  const [isOtsCrashVerified, setIsOtsCrashVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Monitoring OTS Table states (Matching Staff Dashboard -> Tab Jadwal)
  const [otsFilterWaktu, setOtsFilterWaktu] = useState("all");
  const [otsFilterKategori, setOtsFilterKategori] = useState("all");
  const [otsSearchQuery, setOtsSearchQuery] = useState("");
  const [otsTablePage, setOtsTablePage] = useState(1);
  const [otsTablePageSize, setOtsTablePageSize] = useState(10);
  const [modalCatatanOts, setModalCatatanOts] = useState<string | null>(null);
  const [modalFileOts, setModalFileOts] = useState<string | null>(null);

  function handleAddOtsForm() {
    if (otsForms.length >= 50) {
      showAlert("⚠️ Maksimal 50 form sekaligus.");
      return;
    }
    const last = otsForms[otsForms.length - 1];
    setOtsForms((prev) => [
      ...prev,
      {
        id: Date.now(),
        idJadwal: generateNewScheduleId("OTS", last?.tanggal),
        tanggal: last?.tanggal || "",
        platform: "Shopee Live",
        cabangStudio: last?.cabangStudio || "Timoho",
        nomorStudio: last?.nomorStudio || "01",
        otsKaryawanId: "",
        otsId: "",
        otsNama: "",
        shiftOts: last?.shiftOts || "",
        jamMulaiLive: last?.jamMulaiLive || "",
        jamSelesaiLive: last?.jamSelesaiLive || "",
        catatanOts: "",
        filesOts: [""],
      },
    ]);
    setIsOtsCrashVerified(false);
  }

  function handleRemoveOtsForm(id: number) {
    if (otsForms.length <= 1) return;
    setOtsForms((prev) => prev.filter((f) => f.id !== id));
    setIsOtsCrashVerified(false);
  }

  function handleDuplicateOtsForm(item: ScheduleFormItem) {
    setOtsForms((prev) => [
      ...prev,
      {
        ...item,
        id: Date.now(),
        idJadwal: generateNewScheduleId("OTS", item.tanggal),
      },
    ]);
    setIsOtsCrashVerified(false);
  }

  function updateOtsField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setOtsForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setIsOtsCrashVerified(false);
  }

  function runOtsCrashValidation(): { isValid: boolean; conflicts: any[] } {
    const conflicts: any[] = [];
    for (let i = 0; i < otsForms.length; i++) {
      const d1 = otsForms[i];
      if (!d1.tanggal || !d1.jamMulaiLive || !d1.jamSelesaiLive) {
        showAlert(`⚠️ Pastikan Tanggal, Jam Masuk, dan Jam Keluar terisi di Jadwal #${i + 1}.`);
        return { isValid: false, conflicts: [] };
      }
      // TODO(batas-cekout): pemeriksaan bentrok OTS dinonaktifkan sementara —
      // akan diaktifkan kembali sebagai validasi "cekout terbatas".
      // for (let j = i + 1; j < otsForms.length; j++) {
      //   const d2 = otsForms[j];
      //   if (d1.tanggal !== d2.tanggal) continue;

      //   const s1 = d1.jamMulaiLive;
      //   const e1 = d1.jamSelesaiLive;
      //   const s2 = d2.jamMulaiLive;
      //   const e2 = d2.jamSelesaiLive;
      //   const isOverlap = s1 < e2 && s2 < e1;

      //   if (isOverlap) {
      //     if (d1.otsKaryawanId && d2.otsKaryawanId && d1.otsKaryawanId === d2.otsKaryawanId) {
      //       conflicts.push({
      //         type: `Personel OTS (${d1.otsNama || "Staff"})`,
      //         form1: i + 1,
      //         form2: j + 1,
      //         info1: `Tgl ${d1.tanggal} [${s1} - ${e1}] - Cabang: ${d1.cabangStudio}`,
      //         info2: `Tgl ${d2.tanggal} [${s2} - ${e2}] - Cabang: ${d2.cabangStudio}`,
      //       });
      //     }
      //   }
      // }
      void d1;
    }
    return { isValid: true, conflicts };
  }

  function checkBebasCrashOts() {
    const { isValid, conflicts } = runOtsCrashValidation();
    if (!isValid) return;

    if (conflicts.length > 0) {
      setIsOtsCrashVerified(false);
      setModalCrashData({
        isOpen: true,
        isSafe: false,
        title: "Jadwal OTS Bentrok!",
        conflicts,
      });
    } else {
      setIsOtsCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Formulir OTS Aman & Bebas Bentrok!",
        conflicts: [],
      });
    }
  }

  async function submitOtsSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isOtsCrashVerified) {
      const { isValid, conflicts } = runOtsCrashValidation();
      if (!isValid) return;

      if (conflicts.length > 0) {
        setIsOtsCrashVerified(false);
        setModalCrashData({
          isOpen: true,
          isSafe: false,
          title: "Jadwal OTS Bentrok!",
          conflicts,
        });
        return;
      }
      setIsOtsCrashVerified(true);
    }

    setLoading(true);

    try {
      for (const item of otsForms) {
        // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
        const cleanStart = item.jamMulaiLive.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive.length === 5 ? item.jamMulaiLive + ":00" : item.jamMulaiLive}+07:00`;

        const cleanEnd = item.jamSelesaiLive.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive.length === 5 ? item.jamSelesaiLive + ":00" : item.jamSelesaiLive}+07:00`;

        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("OTS", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          otsKaryawanId: item.otsKaryawanId || null,
          idOts: item.otsId || null,
          cabangStudio: item.cabangStudio,
          nomorStudio: item.nomorStudio,
          jamMulaiLive: cleanStart,
          jamSelesaiLive: cleanEnd,
          catatanOts: item.catatanOts || null,
          filePendukungOtsDriveId: (item.filesOts || []).filter(Boolean).join(", ") || null,
          status: "TERJADWAL",
        };

        await sendJson("/api/jadwal", "POST", payload);
      }
      setSuccess(`✅ Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      toast.success(`Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      setIsOtsCrashVerified(false);
      setOtsForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("OTS"),
          tanggal: "",
          platform: "Shopee Live",
          cabangStudio: "Timoho",
          nomorStudio: "01",
          otsKaryawanId: "",
          otsId: "",
          otsNama: "",
          shiftOts: "",
          jamMulaiLive: "",
          jamSelesaiLive: "",
          catatanOts: "",
          filesOts: [""],
        },
      ]);
      fetchData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan koneksi saat menyimpan Jadwal OTS.";
      setError(errMsg);
      toast.error(errMsg, "Gagal Menyimpan Jadwal");
    } finally {
      setLoading(false);
    }
  }

  // Filtered OTS schedules for monitoring table (Matching Staff Dashboard -> Tab Jadwal)
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
      {/* Header & Add Button */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="font-extrabold text-black text-base flex items-center gap-2">
            <i className="fa-solid fa-headphones text-[#941A0B]" />
            <span>Formulir Penugasan Jadwal Kerja OTS</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jadwalkan shift operator teknis support studio
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddOtsForm}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-[#941A0B] rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-red-200"
        >
          <i className="fa-solid fa-plus" /> Tambah Form OTS
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

      {/* FORM CARDS */}
      <form onSubmit={submitOtsSchedules} className="space-y-4">
        {otsForms.map((item, idx) => {
          const isCollapsed = item.isCollapsed;
          const otsName = item.otsNama || "Pilih Staff";
          const tanggalLabel = item.tanggal ? formatDateSafe(item.tanggal) : "--/--/----";
          const jamLabel = item.jamMulaiLive ? `${item.jamMulaiLive || "--:--"} - ${item.jamSelesaiLive || "--:--"}` : "--:-- - --:--";

          return (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4"
          >
            {/* Accordion Header (ref: cardOts header) */}
            <div
              onClick={() => updateOtsField(idx, "isCollapsed", !isCollapsed)}
              className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                  #{idx + 1}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    Penugasan OTS {otsName !== "Pilih Staff" ? `- ${otsName}` : "Baru"}
                  </h3>
                  <span className="text-[11px] font-normal text-slate-500 mt-0.5 inline-block">
                    {tanggalLabel} | {jamLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleDuplicateOtsForm(item)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                  title="Duplikat Form"
                >
                  <i className="fa-solid fa-clone" /> Duplikat
                </button>
                {otsForms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOtsForm(item.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                    title="Hapus Form"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateOtsField(idx, "isCollapsed", !isCollapsed)}
                  className="text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <i className={`fa-solid ${isCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`} />
                </button>
              </div>
            </div>

            {/* Accordion Body (ref: bodyOts sections) */}
            {!isCollapsed && (
            <div className="p-5 sm:p-6 space-y-6 block">
              {/* Row 1: Tanggal + Cabang Studio (ref grid md:2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Penugasan *</label>
                  <FlatpickrPicker
                    value={item.tanggal}
                    placeholder="Pilih Tanggal..."
                    options={{ mode: "single", dateFormat: "Y-m-d" }}
                    onChange={(dateStr) => updateOtsField(idx, "tanggal", dateStr)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cabang Studio *</label>
                  <select
                    value={item.cabangStudio || ""}
                    onChange={(e) => updateOtsField(idx, "cabangStudio", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                    required
                  >
                    <option value="" disabled>Pilih Cabang</option>
                    <option value="Timoho">Timoho</option>
                    <option value="Berbah">Berbah</option>
                    <option value="Wiyoro">Wiyoro</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Cari Staff OTS + auto ID/Nama (ref bordered-top grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cari Staff OTS *</label>
                  <select
                    value={item.otsKaryawanId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const o = otsStaff.find((x) => x.id === id);
                      updateOtsField(idx, "otsKaryawanId", id);
                      updateOtsField(idx, "otsId", o?.idKaryawan || "");
                      updateOtsField(idx, "otsNama", o?.namaLengkap || "");
                    }}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                    required
                  >
                    <option value="">-- Cari Staff OTS --</option>
                    {otsStaff.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.namaLengkap} ({o.idKaryawan})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">ID OTS (Auto)</label>
                    <input
                      type="text"
                      value={item.otsId || ""}
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama OTS</label>
                    <input
                      type="text"
                      value={item.otsNama || ""}
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Shift + Jam Masuk/Keluar + Catatan (ref grid md:2, inner grid-cols-3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Shift</label>
                    <select
                      value={item.shiftOts || ""}
                      onChange={(e) => {
                        const shift = e.target.value;
                        const times = applyShiftOts(shift);
                        updateOtsField(idx, "shiftOts", shift);
                        if (times.masuk) updateOtsField(idx, "jamMulaiLive", times.masuk);
                        if (times.keluar) updateOtsField(idx, "jamSelesaiLive", times.keluar);
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                    >
                      <option value="">Kustom</option>
                      <option value="07:00-15:00">07:00-15:00</option>
                      <option value="15:00-23:00">15:00-23:00</option>
                      <option value="23:00-07:00">23:00-07:00</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Masuk *</label>
                    <FlatpickrTimeInput
                      id={`O_JAM_MASUK_${idx + 1}`}
                      className="px-2 py-2.5"
                      value={item.jamMulaiLive}
                      onChange={(val) => {
                        updateOtsField(idx, "jamMulaiLive", val);
                        // Auto-fill end time +8 hours (mirrors ref-deploy calculateEndTimeOts)
                        const auto = calculateEndTime(val, 8);
                        if (auto) updateOtsField(idx, "jamSelesaiLive", auto);
                        // Custom manual time clears the preset shift
                        if (item.shiftOts) updateOtsField(idx, "shiftOts", "");
                      }}
                      placeholder="Jam Masuk"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keluar *</label>
                    <FlatpickrTimeInput
                      id={`O_JAM_KELUAR_${idx + 1}`}
                      className="px-2 py-2.5"
                      value={item.jamSelesaiLive}
                      onChange={(val) => updateOtsField(idx, "jamSelesaiLive", val)}
                      placeholder="Jam Keluar"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Pekerjaan</label>
                  <textarea
                    rows={3}
                    value={item.catatanOts || ""}
                    onChange={(e) => updateOtsField(idx, "catatanOts", e.target.value)}
                    placeholder="Catatan penugasan khusus, kendala teknis, dll..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 4: File Pendukung (ref mt-5 pt-5 border-t) */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Pendukung</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={item.filesOts?.[0] || ""}
                    onChange={(e) => updateOtsField(idx, "filesOts", [e.target.value])}
                    placeholder="https://drive.google.com/..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Paste link Google Drive atau dokumen pendukung penugasan.
                </p>
              </div>
            </div>
            )}
          </div>
          );
        })}

        {/* Action Buttons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleAddOtsForm}
            className="w-full sm:w-auto px-6 py-3 bg-red-50 text-[#941A0B] rounded-xl hover:bg-red-100 font-bold transition flex items-center justify-center gap-2 text-xs border border-red-200"
          >
            <i className="fa-solid fa-plus" /> Tambah Form OTS
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={checkBebasCrashOts}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-xs"
            >
              <i className="fa-solid fa-shield-halved" /> Bebas Crash
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs text-white ${
                loading
                  ? "bg-slate-400 cursor-wait"
                  : "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
              }`}
            >
              <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} />
              <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal OTS"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* MONITORING OTS TABLE (Persis Staff Dashboard -> Tab Jadwal) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-8">
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-black text-sm flex items-center gap-2">
              <i className="fa-solid fa-list-check text-[#941A0B]" />
              <span>Tabel Monitoring Jadwal Kerja OTS</span>
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

        {/* Table */}
        <div className="overflow-auto rounded-2xl border border-slate-200 shadow-2xs max-h-[520px]">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {paginatedOts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
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
                className="px-5 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
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
                    className="block p-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:underline break-all"
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
                className="px-5 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
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
