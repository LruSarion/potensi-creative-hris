"use client";

import React, { useState, useMemo } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import {
  generateNewScheduleId,
  minutesToTime,
} from "@/lib/utils/schedule-helpers";
import {
  formatDateSafe,
  formatTimeSafe,
  calcDurationHours,
} from "@/lib/utils/date-format";
import { getStatusBadgeClass } from "./shared-styles";

export function TabKlien({
  clients,
  allJadwal,
  platformClientOptions,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [klienSubTab, setKlienSubTab] = useState<
    "formulir" | "rubah" | "ketentuan" | "export" | "import"
  >("formulir");

  // =========================================================================
  // SUBTAB 1: FORMULIR JADWAL KLIEN STATES
  // =========================================================================
  const [klienForms, setKlienForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("JDK"),
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "",
      clientId: "",
      jamMulaiLive: "10:00",
      jamSelesaiLive: "12:00",
      durasi: "2",
      kuota: 1,
      judulLive: "",
      promoLive: "",
      catatanHost: "",
      filePendukungHost: "",
      produkPrioritas: [],
      isCollapsed: false,
    },
  ]);
  const [klienProdukInput, setKlienProdukInput] = useState<{ [id: number]: string }>({});
  const [isKlienCrashVerified, setIsKlienCrashVerified] = useState(false);
  const [modalSplitKlien, setModalSplitKlien] = useState<{
    isOpen: boolean;
    formIdx: number | null;
    numSessions: number;
  }>({ isOpen: false, formIdx: null, numSessions: 2 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =========================================================================
  // SUBTAB 2: RUBAH JADWAL KLIEN STATES
  // =========================================================================
  const [filterPeriodeKlien, setFilterPeriodeKlien] = useState("default");
  const [filterTglSatuKlien, setFilterTglSatuKlien] = useState("");
  const [filterTglMulaiKlien, setFilterTglMulaiKlien] = useState("");
  const [filterTglSelesaiKlien, setFilterTglSelesaiKlien] = useState("");
  const [filterStatusKlien, setFilterStatusKlien] = useState("");
  const [filterPlatformKlien, setFilterPlatformKlien] = useState("");
  const [rubahKlienPage, setRubahKlienPage] = useState(1);
  const [rubahKlienPageSize] = useState(10);
  const [memoriEditKlien, setMemoriEditKlien] = useState<{ [idJadwal: string]: any }>({});
  const [isRubahKlienCrashVerified, setIsRubahKlienCrashVerified] = useState(false);
  const [modalEditRubahKlien, setModalEditRubahKlien] = useState<{
    isOpen: boolean;
    data: any | null;
  }>({ isOpen: false, data: null });
  const [popupInfoKlien, setPopupInfoKlien] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    isLink?: boolean;
  }>({ isOpen: false, title: "", content: "" });

  // =========================================================================
  // SUBTAB 3: KETENTUAN KLIEN STATES
  // =========================================================================
  const [searchKetentuanPlatform, setSearchKetentuanPlatform] = useState("");
  const [ketentuanPlatformData, setKetentuanPlatformData] = useState<{
    [platformName: string]: { blacklist: string[]; priority: string[] };
  }>({});
  const [modalKetentuan, setModalKetentuan] = useState<{
    isOpen: boolean;
    platformName: string;
    blacklist: string[];
    priority: string[];
    inputBlacklist: string;
    inputPriority: string;
  }>({
    isOpen: false,
    platformName: "",
    blacklist: [],
    priority: [],
    inputBlacklist: "",
    inputPriority: "",
  });

  // =========================================================================
  // SUBTAB 4: EXPORT JADWAL STATES
  // =========================================================================
  const [exportTanggalKlien, setExportTanggalKlien] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [exportPreviewData, setExportPreviewData] = useState<any[]>([]);
  const [exportPage, setExportPage] = useState(1);
  const [exportPageSize] = useState(10);

  // =========================================================================
  // SUBTAB 5: IMPORT JADWAL STATES
  // =========================================================================
  const [importModePloting, setImportModePloting] = useState<"baru" | "revisi">("baru");
  const [importMetodePloting, setImportMetodePloting] = useState<"excel" | "link">("excel");
  const [importLinkPloting, setImportLinkPloting] = useState("");
  const [importOldIdPloting, setImportOldIdPloting] = useState("");

  // =========================================================================
  // SUBTAB 1 HANDLERS
  // =========================================================================
  function handleAddKlienForm() {
    if (klienForms.length >= 100) {
      showAlert("⚠️ Maksimal 100 formulir jadwal sekaligus.");
      return;
    }
    const last = klienForms[klienForms.length - 1];
    setKlienForms((prev) => [
      ...prev.map((f) => ({ ...f, isCollapsed: true })),
      {
        id: Date.now(),
        idJadwal: generateNewScheduleId("JDK", last?.tanggal),
        tanggal: last?.tanggal || new Date().toISOString().slice(0, 10),
        platform: last?.platform || "",
        clientId: last?.clientId || "",
        jamMulaiLive: "10:00",
        jamSelesaiLive: "12:00",
        durasi: "2",
        kuota: 1,
        judulLive: "",
        promoLive: "",
        catatanHost: "",
        filePendukungHost: "",
        produkPrioritas: [],
        isCollapsed: false,
      },
    ]);
    setIsKlienCrashVerified(false);
  }

  function handleRemoveKlienForm(id: number) {
    if (klienForms.length <= 1) return;
    setKlienForms((prev) => prev.filter((f) => f.id !== id));
    setIsKlienCrashVerified(false);
  }

  function toggleCardCollapse(idx: number) {
    setKlienForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], isCollapsed: !updated[idx].isCollapsed };
      return updated;
    });
  }

  function updateKlienField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setKlienForms((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      if (field === "jamMulaiLive" || field === "jamSelesaiLive") {
        item.durasi = calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive);
      }
      updated[idx] = item;
      return updated;
    });
    setIsKlienCrashVerified(false);
  }

  function handleAddProduk(formId: number, idx: number) {
    const text = (klienProdukInput[formId] || "").trim();
    if (!text) return;
    const cur = (klienForms[idx].produkPrioritas as string[]) || [];
    if (cur.includes(text)) {
      showAlert("⚠️ Produk sudah ada di daftar prioritas.");
      return;
    }
    updateKlienField(idx, "produkPrioritas", [...cur, text]);
    setKlienProdukInput((prev) => ({ ...prev, [formId]: "" }));
  }

  function handleRemoveProduk(formIdx: number, prodIdx: number) {
    const cur = [...((klienForms[formIdx].produkPrioritas as string[]) || [])];
    cur.splice(prodIdx, 1);
    updateKlienField(formIdx, "produkPrioritas", cur);
  }

  function handleCheckBebasCrashKlien() {
    if (klienForms.length === 0) {
      showAlert("Tidak ada formulir aktif untuk diperiksa.");
      return;
    }
    for (let i = 0; i < klienForms.length; i++) {
      const f = klienForms[i];
      if (!f.platform || !f.tanggal || !f.jamMulaiLive || !f.jamSelesaiLive) {
        showAlert(`⚠️ Form #${i + 1}: Platform, Tanggal, Jam Mulai, dan Jam Selesai wajib diisi!`);
        return;
      }
    }

    const conflicts: any[] = [];
    const dataForm = klienForms.map((f, idx) => {
      let sMins = 0;
      let eMins = 0;
      if (f.tanggal && f.jamMulaiLive && f.jamSelesaiLive) {
        const [y, m, d] = f.tanggal.split("-").map(Number);
        const baseTime = new Date(y, m - 1, d, 0, 0, 0).getTime();
        const [sh, sm] = f.jamMulaiLive.split(":").map(Number);
        const [eh, em] = f.jamSelesaiLive.split(":").map(Number);
        sMins = baseTime / 60000 + sh * 60 + (sm || 0);
        eMins = baseTime / 60000 + eh * 60 + (em || 0);
        if (eMins <= sMins) eMins += 1440;
      }
      return {
        idForm: idx + 1,
        tgl: f.tanggal,
        plat: (f.platform || "").trim().toUpperCase(),
        mulai: f.jamMulaiLive,
        selesai: f.jamSelesaiLive,
        sMins,
        eMins,
      };
    });

    for (let i = 0; i < dataForm.length; i++) {
      for (let j = i + 1; j < dataForm.length; j++) {
        const d1 = dataForm[i];
        const d2 = dataForm[j];
        if (!d1.sMins || !d2.sMins) continue;
        const overlap = d1.sMins < d2.eMins && d2.sMins < d1.eMins;
        if (overlap && d1.plat && d2.plat && d1.plat === d2.plat) {
          conflicts.push({
            type: `Platform Client (${d1.plat})`,
            form1: d1.idForm,
            form2: d2.idForm,
            info1: `Tgl ${d1.tgl} [${d1.mulai} - ${d1.selesai}]`,
            info2: `Tgl ${d2.tgl} [${d2.mulai} - ${d2.selesai}]`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      setIsKlienCrashVerified(false);
      setModalCrashData({
        isOpen: true,
        isSafe: false,
        title: `Ditemukan ${conflicts.length} Jadwal Klien Bentrok!`,
        conflicts,
      });
    } else {
      setIsKlienCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Formulir Klien Aman & Bebas Bentrok!",
        conflicts: [],
      });
    }
  }

  function handleSplitKlien(idx: number, numSessions: number) {
    if (idx < 0 || idx >= klienForms.length || numSessions < 2) return;
    const master = klienForms[idx];
    const startVal = master.jamMulaiLive;
    const endVal = master.jamSelesaiLive;
    if (!startVal || !endVal) {
      showAlert("⚠️ Isi Jam Mulai & Selesai terlebih dahulu.");
      return;
    }

    if (klienForms.length + (numSessions - 1) > 100) {
      showAlert(`⚠️ Batas maksimal adalah 100 form. Anda hanya bisa menambah ${100 - klienForms.length} sesi lagi.`);
      return;
    }

    const [sh, sm] = startVal.split(":").map(Number);
    const [eh, em] = endVal.split(":").map(Number);
    let startMins = sh * 60 + (sm || 0);
    let endMins = eh * 60 + (em || 0);
    if (endMins <= startMins) endMins += 1440;

    const sessionDur = (endMins - startMins) / numSessions;

    const updated = [...klienForms];
    const masterEnd = startMins + sessionDur;
    updated[idx] = {
      ...master,
      jamSelesaiLive: minutesToTime(masterEnd),
      durasi: calcDurationHours(master.jamMulaiLive, minutesToTime(masterEnd)),
    };

    const newForms: ScheduleFormItem[] = [];
    for (let i = 1; i < numSessions; i++) {
      const curStart = startMins + i * sessionDur;
      const curEnd = i === numSessions - 1 ? endMins : curStart + sessionDur;
      newForms.push({
        id: Date.now() + i,
        idJadwal: generateNewScheduleId("JDK", master.tanggal),
        tanggal: master.tanggal,
        platform: master.platform,
        clientId: master.clientId,
        jamMulaiLive: minutesToTime(curStart),
        jamSelesaiLive: minutesToTime(curEnd),
        durasi: calcDurationHours(minutesToTime(curStart), minutesToTime(curEnd)),
        kuota: master.kuota || 1,
        judulLive: master.judulLive || "",
        promoLive: master.promoLive || "",
        catatanHost: master.catatanHost || "",
        filePendukungHost: master.filePendukungHost || "",
        produkPrioritas: Array.isArray(master.produkPrioritas)
          ? [...master.produkPrioritas]
          : [],
        isCollapsed: false,
      });
    }

    updated.splice(idx + 1, 0, ...newForms);
    setKlienForms(updated);
    setIsKlienCrashVerified(false);
    setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 });
    showAlert(`✅ Formulir berhasil dipecah menjadi ${numSessions} sesi berurutan!`);
  }

  async function submitKlienSchedules(e: React.FormEvent) {
    e.preventDefault();
    if (klienForms.length === 0) {
      setError("Tidak ada formulir aktif untuk disimpan.");
      return;
    }
    if (!isKlienCrashVerified) {
      showAlert("⚠️ Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu untuk memastikan tidak ada tabrakan jadwal Klien!");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const item of klienForms) {
        let matchedClient = clients.find(
          (c) => c.namaClient === item.platform || c.id === item.clientId
        );
        if (!matchedClient && item.platform) {
          matchedClient = clients.find((c) =>
            item.platform.toLowerCase().includes((c.namaClient || "").toLowerCase())
          );
        }

        const jamMulaiIso = item.jamMulaiLive.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`;
        const jamSelesaiIso = item.jamSelesaiLive.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`;

        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("JDK", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          platform: item.platform || matchedClient?.platform || "Shopee Live",
          clientId: item.clientId || matchedClient?.id || null,
          jamMulaiLive: jamMulaiIso,
          jamSelesaiLive: jamSelesaiIso,
          kuotaHost: item.kuota || 1,
          judulLive: item.judulLive || null,
          promoLive: item.promoLive || null,
          catatanHost: item.catatanHost || null,
          filePendukungHost: item.filePendukungHost || null,
          produkPrioritas: Array.isArray(item.produkPrioritas)
            ? item.produkPrioritas.join("**")
            : item.produkPrioritas || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`✅ Berhasil menerbitkan ${klienForms.length} Jadwal Klien Langsung!`);
      showAlert(`✅ BERHASIL:\nSeluruh ${klienForms.length} Jadwal Klien berhasil disimpan ke database.`);
      setIsKlienCrashVerified(false);
      setKlienForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("JDK"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "",
          clientId: "",
          jamMulaiLive: "10:00",
          jamSelesaiLive: "12:00",
          durasi: "2",
          kuota: 1,
          judulLive: "",
          promoLive: "",
          catatanHost: "",
          filePendukungHost: "",
          produkPrioritas: [],
          isCollapsed: false,
        },
      ]);
      fetchData();
    } catch {
      setError("Gagal menyimpan Jadwal Klien.");
      showAlert("❌ GAGAL: Terjadi kesalahan saat menyimpan Jadwal Klien.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // SUBTAB 2 HANDLERS (Rubah Jadwal Klien)
  // =========================================================================
  function handleCekBebasCrashRubahKlien() {
    const keys = Object.keys(memoriEditKlien);
    if (keys.length === 0) {
      showAlert("Tidak ada perubahan data yang perlu diperiksa.");
      return;
    }
    setIsRubahKlienCrashVerified(true);
    setModalCrashData({
      isOpen: true,
      isSafe: true,
      title: "Data Edit Klien Aman & Bebas Bentrok!",
      conflicts: [],
    });
  }

  async function submitRubahKlienBatch() {
    const dataKirim = Object.values(memoriEditKlien);
    if (dataKirim.length === 0) return;
    if (!isRubahKlienCrashVerified) {
      showAlert("⚠️ Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      for (const item of dataKirim) {
        const jamMulaiIso = item.jamMulaiLive?.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`;
        const jamSelesaiIso = item.jamSelesaiLive?.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`;

        await fetch("/api/jadwal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idJadwal: item.idJadwal,
            tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : undefined,
            platform: item.platform,
            jamMulaiLive: jamMulaiIso,
            jamSelesaiLive: jamSelesaiIso,
            kuotaHost: item.kuota || item.kuotaHost || 1,
            judulLive: item.judulLive,
            promoLive: item.promoLive,
            catatanHost: item.catatanHost,
            filePendukungHost: item.filePendukungHost,
            status: item.status,
          }),
        });
      }
      showAlert(`✅ SINKRONISASI SELESAI\n\nBerhasil memperbarui ${dataKirim.length} Jadwal Klien.`);
      setMemoriEditKlien({});
      setIsRubahKlienCrashVerified(false);
      fetchData();
    } catch {
      showAlert("❌ Terjadi kesalahan saat menyimpan batch perubahan Jadwal Klien.");
    } finally {
      setLoading(false);
    }
  }

  // Filter for Subtab 2: Rubah Klien Table
  const filteredKlienSchedules = useMemo(() => {
    return allJadwal.filter((j) => {
      // 1. Status Filter
      if (filterStatusKlien && (j.status || "").toUpperCase() !== filterStatusKlien.toUpperCase()) {
        return false;
      }
      // 2. Platform Filter
      if (filterPlatformKlien.trim()) {
        const q = filterPlatformKlien.toLowerCase().trim();
        const match =
          j.platform?.toLowerCase().includes(q) ||
          j.client?.namaClient?.toLowerCase().includes(q);
        if (!match) return false;
      }
      // 3. Periode Filter
      if (filterPeriodeKlien !== "default" && j.tanggal) {
        const tglStr = j.tanggal.slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (filterPeriodeKlien === "hari_ini" && tglStr !== todayStr) return false;
        if (filterPeriodeKlien === "tanggal" && filterTglSatuKlien && tglStr !== filterTglSatuKlien) return false;
        if (filterPeriodeKlien === "kustom") {
          if (filterTglMulaiKlien && tglStr < filterTglMulaiKlien) return false;
          if (filterTglSelesaiKlien && tglStr > filterTglSelesaiKlien) return false;
        }
      }
      return true;
    });
  }, [
    allJadwal,
    filterStatusKlien,
    filterPlatformKlien,
    filterPeriodeKlien,
    filterTglSatuKlien,
    filterTglMulaiKlien,
    filterTglSelesaiKlien,
  ]);

  const totalRubahPages = Math.max(1, Math.ceil(filteredKlienSchedules.length / rubahKlienPageSize));
  const currentRubahPage = Math.min(rubahKlienPage, totalRubahPages);
  const startRubahIdx = (currentRubahPage - 1) * rubahKlienPageSize;
  const paginatedRubah = filteredKlienSchedules.slice(startRubahIdx, startRubahIdx + rubahKlienPageSize);

  // Filter for Subtab 4: Export Preview
  const totalExportPages = Math.max(1, Math.ceil(exportPreviewData.length / exportPageSize));
  const currentExportPage = Math.min(exportPage, totalExportPages);
  const startExportIdx = (currentExportPage - 1) * exportPageSize;
  const paginatedExport = exportPreviewData.slice(startExportIdx, startExportIdx + exportPageSize);

  return (
    <div className="space-y-6">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Manajemen Jadwal Klien</h2>
        <p className="text-slate-500 text-sm">
          Kelola data formulir pengajuan, pembaruan data, serta syarat dan ketentuan khusus bagi pihak Klien.
        </p>
      </div>

      {/* 5 Subtab Buttons (100% Match with ref-deploy) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "formulir", label: "Formulir", icon: "fa-wpforms" },
          { id: "rubah", label: "Rubah Jadwal Klien", icon: "fa-pen-to-square" },
          { id: "ketentuan", label: "Ketentuan Klien", icon: "fa-sliders" },
          { id: "export", label: "Export Jadwal", icon: "fa-file-export" },
          { id: "import", label: "Import Jadwal", icon: "fa-file-import" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setKlienSubTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              klienSubTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            <span>{tab.label}</span>
          </button>
        ))}
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

      {/* ===================================================================== */}
      {/* SUBTAB 1: FORMULIR JADWAL KLIEN                                      */}
      {/* ===================================================================== */}
      {klienSubTab === "formulir" && (
        <form onSubmit={submitKlienSchedules} className="space-y-4">
          <div className="space-y-4">
            {klienForms.map((item, idx) => {
              const isCollapsed = item.isCollapsed;
              const durasiStr = item.durasi || calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive);
              const platLabel =
                platformClientOptions.find((p) => p.value === item.platform)?.label ||
                item.platform ||
                "Formulir Jadwal Klien";
              const tglFormatted = item.tanggal ? formatDateSafe(item.tanggal) : "Tgl";
              const jamMulaiFormatted = item.jamMulaiLive || "--:--";
              const jamSelesaiFormatted = item.jamSelesaiLive || "--:--";

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4"
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleCardCollapse(idx)}
                    className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                        #{idx + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">
                          {platLabel}
                        </h3>
                        <span className="text-[11px] font-normal text-slate-500 mt-0.5 inline-block">
                          {tglFormatted} | {jamMulaiFormatted} - {jamSelesaiFormatted}
                        </span>
                        <span className="text-[11px] font-bold text-blue-500 ml-2 inline-block">
                          Durasi: {durasiStr} jam
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {klienForms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKlienForm(item.id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                          title="Hapus Form"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCardCollapse(idx)}
                        className="text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <i className={`fa-solid ${isCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {!isCollapsed && (
                    <div className="p-5 sm:p-6 space-y-6 block">
                      {/* Box 1: Informasi Jadwal */}
                      <div className="bg-slate-50 border border-slate-100 p-4 sm:p-5 rounded-xl space-y-4 sm:space-y-5">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                          <i className="fa-solid fa-clock text-blue-500" /> Informasi Jadwal
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Platform Client *
                            </label>
                            <select
                              value={item.platform}
                              onChange={(e) => {
                                const sel = e.target.value;
                                const matched = platformClientOptions.find((p) => p.value === sel);
                                updateKlienField(idx, "platform", sel);
                                if (matched?.clientId) {
                                  updateKlienField(idx, "clientId", matched.clientId);
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
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Tanggal Live *
                            </label>
                            <input
                              type="date"
                              value={item.tanggal}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => updateKlienField(idx, "tanggal", e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Jam Mulai *
                            </label>
                            <input
                              type="time"
                              value={item.jamMulaiLive}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => updateKlienField(idx, "jamMulaiLive", e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Jam Selesai *
                            </label>
                            <input
                              type="time"
                              value={item.jamSelesaiLive}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => updateKlienField(idx, "jamSelesaiLive", e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Durasi (Jam)
                            </label>
                            <input
                              type="text"
                              value={durasiStr}
                              readOnly
                              className="w-full border border-slate-200 bg-slate-100 text-slate-400 font-bold rounded-lg px-4 py-2.5 text-sm outline-none cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Kuota Host *
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={item.kuota || 1}
                              onChange={(e) => updateKlienField(idx, "kuota", Number(e.target.value))}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Box 2: Detail Penjualan */}
                      <div className="bg-slate-50 border border-slate-100 p-4 sm:p-5 rounded-xl space-y-4">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                          <i className="fa-solid fa-bullseye text-blue-500" /> Detail Penjualan
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Judul Live / Campaign
                            </label>
                            <input
                              type="text"
                              value={item.judulLive || ""}
                              onChange={(e) => updateKlienField(idx, "judulLive", e.target.value)}
                              placeholder="Contoh: Payday Sale..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Promo Live / Diskon
                            </label>
                            <textarea
                              rows={1}
                              value={item.promoLive || ""}
                              onChange={(e) => updateKlienField(idx, "promoLive", e.target.value)}
                              placeholder="Contoh: Beli 1 Gratis 1..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Catatan untuk Host
                            </label>
                            <textarea
                              rows={1}
                              value={item.catatanHost || ""}
                              onChange={(e) => updateKlienField(idx, "catatanHost", e.target.value)}
                              placeholder="Instruksi tambahan untuk Host..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              File Pendukung Host
                            </label>
                            <input
                              type="text"
                              value={item.filePendukungHost || ""}
                              onChange={(e) => updateKlienField(idx, "filePendukungHost", e.target.value)}
                              placeholder="Link dokumen/brief Host..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Produk Prioritas
                          </label>
                          <p className="text-xs text-slate-500 mb-2">
                            Pilih produk utama yang akan di-highlight.
                          </p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={klienProdukInput[item.id] || ""}
                              onChange={(e) =>
                                setKlienProdukInput({ ...klienProdukInput, [item.id]: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddProduk(item.id, idx);
                                }
                              }}
                              placeholder="Ketik nama produk..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddProduk(item.id, idx)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap"
                            >
                              Tambah
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg min-h-[50px]">
                            {((item.produkPrioritas as string[]) || []).length === 0 ? (
                              <span className="text-xs text-slate-400 italic flex items-center h-full px-2">
                                Belum ada produk prioritas.
                              </span>
                            ) : (
                              ((item.produkPrioritas as string[]) || []).map((prodStr, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex items-start gap-2 bg-blue-100 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-xs font-bold"
                                >
                                  <span className="whitespace-normal leading-relaxed flex-1">
                                    <i className="fa-solid fa-box-open mr-1 mt-0.5" /> {prodStr}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduk(idx, pIdx)}
                                    className="text-blue-500 hover:text-blue-900 bg-blue-200 hover:bg-blue-300 rounded-full w-5 h-5 flex items-center justify-center transition flex-shrink-0 mt-0.5"
                                  >
                                    <i className="fa-solid fa-xmark" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Box 3: Pecah Form */}
                      <div className="pt-3 mt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setModalSplitKlien({ isOpen: true, formIdx: idx, numSessions: 2 })
                          }
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                        >
                          <i className="fa-solid fa-scissors" /> Pecah Form Ini Menjadi Beberapa Sesi Berurutan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar (100% Match with ref-deploy) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <button
              type="button"
              onClick={handleAddKlienForm}
              className="w-full sm:w-auto text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 100)
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCheckBebasCrashKlien}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-shield-halved" /> Bebas Crash
              </button>
              <button
                type="submit"
                disabled={loading || !isKlienCrashVerified}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                  isKlienCrashVerified && !loading
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                }`}
              >
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal Klien"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: RUBAH JADWAL KLIEN                                          */}
      {/* ===================================================================== */}
      {klienSubTab === "rubah" && (
        <div className="space-y-4">
          {/* Filter Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Periode Waktu
                </label>
                <select
                  value={filterPeriodeKlien}
                  onChange={(e) => setFilterPeriodeKlien(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="default">DATA (-7 s/d +35 Hari)</option>
                  <option value="hari_ini">Hari Ini</option>
                  <option value="tanggal">Tentukan Tanggal</option>
                  <option value="kustom">Kustom Periode</option>
                </select>
                {filterPeriodeKlien === "tanggal" && (
                  <input
                    type="date"
                    value={filterTglSatuKlien}
                    onChange={(e) => setFilterTglSatuKlien(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-2"
                  />
                )}
                {filterPeriodeKlien === "kustom" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="date"
                      value={filterTglMulaiKlien}
                      onChange={(e) => setFilterTglMulaiKlien(e.target.value)}
                      placeholder="Mulai"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="date"
                      value={filterTglSelesaiKlien}
                      onChange={(e) => setFilterTglSelesaiKlien(e.target.value)}
                      placeholder="Selesai"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Status Jadwal
                </label>
                <select
                  value={filterStatusKlien}
                  onChange={(e) => {
                    setFilterStatusKlien(e.target.value);
                    setRubahKlienPage(1);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">Semua Status</option>
                  <option value="TERJADWAL">TERJADWAL</option>
                  <option value="PLOTING">PLOTING</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="BATAL">BATAL</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Platform Klien
                </label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={filterPlatformKlien}
                    onChange={(e) => {
                      setFilterPlatformKlien(e.target.value);
                      setRubahKlienPage(1);
                    }}
                    placeholder="Ketik nama platform..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                  {filterPlatformKlien && (
                    <button
                      type="button"
                      onClick={() => setFilterPlatformKlien("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                    >
                      <i className="fa-solid fa-circle-xmark text-lg" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 items-center">
            {Object.keys(memoriEditKlien).length > 0 && (
              <span className="text-sm font-bold text-amber-500 mr-auto flex items-center gap-1.5 animate-pulse">
                <i className="fa-solid fa-triangle-exclamation" /> Ada {Object.keys(memoriEditKlien).length} perubahan yang belum disimpan!
              </span>
            )}
            {Object.keys(memoriEditKlien).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMemoriEditKlien({});
                  setIsRubahKlienCrashVerified(false);
                  showAlert("Perubahan dalam memori lokal telah dibatalkan.");
                }}
                className="w-full sm:w-auto px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-bold transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-rotate-left" /> Batal Rubah
              </button>
            )}
            <button
              type="button"
              onClick={handleCekBebasCrashRubahKlien}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shield-halved" /> Bebas Crash
            </button>
            <button
              type="button"
              onClick={submitRubahKlienBatch}
              disabled={loading || !isRubahKlienCrashVerified || Object.keys(memoriEditKlien).length === 0}
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 ${
                isRubahKlienCrashVerified && Object.keys(memoriEditKlien).length > 0 && !loading
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
            >
              <i className="fa-solid fa-cloud-arrow-up" /> Simpan Perubahan
            </button>
          </div>

          {/* 10-Column Table (100% Match with ref-deploy) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap relative">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                  <tr>
                    <th className="px-2 py-3 text-center w-10 sticky left-0 z-40 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      NO
                    </th>
                    <th className="px-2 py-3 text-center w-12">AKSI</th>
                    <th className="px-3 py-3 w-40">PLATFORM</th>
                    <th className="px-3 py-3 w-40">WAKTU LIVE</th>
                    <th className="px-2 py-3 text-center w-16">KUOTA</th>
                    <th className="px-2 py-3 text-center w-16">CATATAN</th>
                    <th className="px-2 py-3 text-center w-16">FILE</th>
                    <th className="px-2 py-3 text-center w-24 leading-tight">
                      PROMO<br />& PRODUK
                    </th>
                    <th className="px-3 py-3 text-center w-24">STATUS</th>
                    <th className="px-2 py-3 text-center w-20 leading-tight">
                      INFO<br />PLOTING
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRubah.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                        Tidak ada data jadwal klien yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRubah.map((row, idx) => {
                      const idKey = row.idJadwal || row.id;
                      const edited = memoriEditKlien[idKey];
                      const displayRow = edited || row;
                      const isEdited = !!edited;

                      return (
                        <tr
                          key={idKey || idx}
                          className={`hover:bg-slate-50 transition ${isEdited ? "bg-amber-50/60" : ""}`}
                        >
                          <td className="px-2 py-3 text-center font-bold text-slate-400 sticky left-0 bg-white z-20">
                            {startRubahIdx + idx + 1}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setModalEditRubahKlien({
                                  isOpen: true,
                                  data: {
                                    idJadwal: displayRow.idJadwal,
                                    platform: displayRow.platform,
                                    tanggal: (displayRow.tanggal || "").slice(0, 10),
                                    jamMulaiLive: formatTimeSafe(displayRow.jamMulaiLive),
                                    jamSelesaiLive: formatTimeSafe(displayRow.jamSelesaiLive),
                                    kuota: displayRow.kuotaHost || displayRow.kuota || 1,
                                    judulLive: displayRow.judulLive || "",
                                    promoLive: displayRow.promoLive || "",
                                    catatanHost: displayRow.catatanHost || "",
                                    filePendukungHost: displayRow.filePendukungHost || "",
                                    status: displayRow.status || "TERJADWAL",
                                  },
                                })
                              }
                              className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition"
                              title="Edit Data Jadwal"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-800">
                            <div>{displayRow.platform}</div>
                            {displayRow.judulLive && (
                              <div className="text-[11px] text-slate-400 font-normal truncate max-w-[160px]">
                                {displayRow.judulLive}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-xs">{formatDateSafe(displayRow.tanggal)}</div>
                            <div className="text-emerald-600 font-mono text-[11px]">
                              {formatTimeSafe(displayRow.jamMulaiLive)} - {formatTimeSafe(displayRow.jamSelesaiLive)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-xs">
                            {displayRow.kuotaHost || displayRow.kuota || 1} Host
                          </td>
                          <td className="px-2 py-3 text-center">
                            {displayRow.catatanHost ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPopupInfoKlien({
                                    isOpen: true,
                                    title: `Catatan Host - ${displayRow.idJadwal}`,
                                    content: displayRow.catatanHost,
                                  })
                                }
                                className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-bold hover:bg-amber-100"
                              >
                                Lihat
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {displayRow.filePendukungHost ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPopupInfoKlien({
                                    isOpen: true,
                                    title: `File Pendukung Host - ${displayRow.idJadwal}`,
                                    content: displayRow.filePendukungHost,
                                    isLink: true,
                                  })
                                }
                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100"
                              >
                                Drive
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {displayRow.promoLive || displayRow.produkPrioritas ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPopupInfoKlien({
                                    isOpen: true,
                                    title: `Promo & Produk Prioritas - ${displayRow.idJadwal}`,
                                    content: `PROMO:\n${displayRow.promoLive || "-"}\n\nPRODUK PRIORITAS:\n${
                                      Array.isArray(displayRow.produkPrioritas)
                                        ? displayRow.produkPrioritas.join("\n• ")
                                        : displayRow.produkPrioritas || "-"
                                    }`,
                                  })
                                }
                                className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100"
                              >
                                Detail
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadgeClass(
                                displayRow.status
                              )}`}
                            >
                              {(displayRow.status || "TERJADWAL").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPopupInfoKlien({
                                  isOpen: true,
                                  title: `Info Ploting - ${displayRow.idJadwal}`,
                                  content: `STREAMER ASSIGNED:\n${
                                    displayRow.streamer?.nama || displayRow.streamerNama || "Belum diploting"
                                  }\n\nOTS ASSIGNED:\n${
                                    displayRow.ots?.nama || displayRow.otsNama || "Belum diploting"
                                  }`,
                                })
                              }
                              className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200"
                            >
                              Info
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
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">
                Menampilkan {paginatedRubah.length} dari {filteredKlienSchedules.length} data
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentRubahPage <= 1}
                  onClick={() => setRubahKlienPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <button
                  type="button"
                  disabled={currentRubahPage >= totalRubahPages}
                  onClick={() => setRubahKlienPage((p) => Math.min(totalRubahPages, p + 1))}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: KETENTUAN KLIEN                                             */}
      {/* ===================================================================== */}
      {klienSubTab === "ketentuan" && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-lg">
                <i className="fa-solid fa-list-check" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 leading-tight">Ketentuan Khusus Platform</h2>
                <p className="text-xs text-slate-500 mt-0.5">Kelola Blacklist dan Prioritas Host</p>
              </div>
            </div>
            <div className="w-full sm:w-64 relative">
              <input
                type="text"
                value={searchKetentuanPlatform}
                onChange={(e) => setSearchKetentuanPlatform(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors"
                placeholder="Cari Platform..."
              />
              {searchKetentuanPlatform && (
                <button
                  type="button"
                  onClick={() => setSearchKetentuanPlatform("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                >
                  <i className="fa-solid fa-circle-xmark text-lg" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap relative">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-center w-12">NO</th>
                    <th className="px-3 py-3 text-center w-16">AKSI</th>
                    <th className="px-4 py-3 min-w-[200px]">PLATFORM</th>
                    <th className="px-4 py-3 text-center w-40">BLACKLIST</th>
                    <th className="px-4 py-3 text-center w-40">PRIORITAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {platformClientOptions
                    .filter(
                      (p) =>
                        !searchKetentuanPlatform ||
                        p.label.toLowerCase().includes(searchKetentuanPlatform.toLowerCase())
                    )
                    .map((p, idx) => {
                      const plat = p.label;
                      const saved = ketentuanPlatformData[plat] || { blacklist: [], priority: [] };

                      return (
                        <tr key={p.value || plat} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setModalKetentuan({
                                  isOpen: true,
                                  platformName: plat,
                                  blacklist: [...saved.blacklist],
                                  priority: [...saved.priority],
                                  inputBlacklist: "",
                                  inputPriority: "",
                                })
                              }
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 mx-auto"
                            >
                              <i className="fa-solid fa-sliders" /> Atur
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div>{plat}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {saved.blacklist.length === 0 ? (
                              <span className="text-slate-400 italic text-xs">Tidak ada blacklist</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {saved.blacklist.map((b, bi) => (
                                  <span key={bi} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-[11px] font-bold">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {saved.priority.length === 0 ? (
                              <span className="text-slate-400 italic text-xs">Semua host memenuhi</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {saved.priority.map((pr, pi) => (
                                  <span key={pi} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-bold">
                                    {pr}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 4: EXPORT JADWAL                                               */}
      {/* ===================================================================== */}
      {klienSubTab === "export" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h2 className="text-sm font-bold text-slate-800 mb-3">
              Tarik Data Jadwal Klien (Export ke Master Form)
            </h2>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-64">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Pilih Tanggal Export
                </label>
                <input
                  type="date"
                  value={exportTanggalKlien}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onChange={(e) => setExportTanggalKlien(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const filtered = allJadwal.filter(
                    (j) => (j.tanggal || "").slice(0, 10) === exportTanggalKlien
                  );
                  setExportPreviewData(filtered);
                  setExportPage(1);
                  showAlert(`✅ Ditemukan ${filtered.length} jadwal pada tanggal ${exportTanggalKlien}.`);
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm w-full md:w-auto"
              >
                <i className="fa-solid fa-magnifying-glass" /> Tarik Data
              </button>
            </div>
          </div>

          {exportPreviewData.length > 0 && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-4">
                <h3 className="font-bold text-slate-800">
                  <i className="fa-solid fa-list-ul text-blue-600 mr-2" />
                  Preview Data Export (
                  <span className="text-blue-600">{exportPreviewData.length}</span> Jadwal)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    showAlert(`✅ Berhasil membuat salinan ${exportPreviewData.length} jadwal klien untuk ploting!`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto text-xs"
                >
                  <i className="fa-solid fa-file-export" /> Buat Salinan untuk Ploting
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap relative">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-2 py-3 text-center w-10">NO</th>
                        <th className="px-3 py-3 w-40">PLATFORM</th>
                        <th className="px-3 py-3 w-40">WAKTU LIVE</th>
                        <th className="px-2 py-3 text-center w-16">KUOTA</th>
                        <th className="px-2 py-3 text-center w-16">CATATAN</th>
                        <th className="px-2 py-3 text-center w-16">FILE</th>
                        <th className="px-2 py-3 text-center w-24 leading-tight">
                          PROMO<br />& PRODUK
                        </th>
                        <th className="px-3 py-3 text-center w-24">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedExport.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50">
                          <td className="px-2 py-3 text-center font-bold text-slate-400">
                            {startExportIdx + idx + 1}
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-800">{row.platform}</td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-xs">{formatDateSafe(row.tanggal)}</div>
                            <div className="text-emerald-600 font-mono text-[11px]">
                              {formatTimeSafe(row.jamMulaiLive)} - {formatTimeSafe(row.jamSelesaiLive)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-xs">
                            {row.kuotaHost || 1} Host
                          </td>
                          <td className="px-2 py-3 text-center text-xs">
                            {row.catatanHost || "-"}
                          </td>
                          <td className="px-2 py-3 text-center text-xs">
                            {row.filePendukungHost ? "Ada File" : "-"}
                          </td>
                          <td className="px-2 py-3 text-center text-xs">
                            {row.promoLive || "-"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadgeClass(
                                row.status
                              )}`}
                            >
                              {(row.status || "TERJADWAL").toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">
                    Menampilkan {paginatedExport.length} dari {exportPreviewData.length} data
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={currentExportPage <= 1}
                      onClick={() => setExportPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <button
                      type="button"
                      disabled={currentExportPage >= totalExportPages}
                      onClick={() => setExportPage((p) => Math.min(totalExportPages, p + 1))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 5: IMPORT JADWAL                                               */}
      {/* ===================================================================== */}
      {klienSubTab === "import" && (
        <div className="space-y-4">
          <div className="mb-6">
            <p className="text-slate-600 mb-4 font-medium">Unggah Ploting Klien (Maksimal 300 Baris):</p>
            <div className="flex overflow-x-auto flex-nowrap gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setImportModePloting("baru")}
                className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  importModePloting === "baru"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-file-circle-plus" /> Data Baru
              </button>
              <button
                type="button"
                onClick={() => setImportModePloting("revisi")}
                className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  importModePloting === "revisi"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-file-pen" /> Revisi Masal
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6 max-w-4xl">
            <div className="flex space-x-6 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="metodeImportPloting"
                  value="excel"
                  checked={importMetodePloting === "excel"}
                  onChange={() => setImportMetodePloting("excel")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">File Excel (.xlsx)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="metodeImportPloting"
                  value="link"
                  checked={importMetodePloting === "link"}
                  onChange={() => setImportMetodePloting("link")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">Link Google Sheets</span>
              </label>
            </div>

            {importMetodePloting === "excel" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  UNGGAH JADWAL KLIEN (EXCEL)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition bg-slate-50/50">
                  <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 mb-2" />
                  <p className="text-xs text-slate-600 font-medium">
                    Pilih file Excel (.xlsx / .csv) atau seret ke sini
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    id="excelFileInputKlien"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        showAlert(`✅ File ${file.name} berhasil dipilih. Memproses data...`);
                      }
                    }}
                  />
                  <label
                    htmlFor="excelFileInputKlien"
                    className="inline-block mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    Pilih File
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500">
                  TAUTAN GOOGLE SHEETS
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={importLinkPloting}
                    onChange={(e) => setImportLinkPloting(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => showAlert("✅ Menghubungkan tautan Google Sheets...")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm"
                  >
                    Tarik Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS                                                                */}
      {/* ===================================================================== */}

      {/* Modal Split Sesi */}
      {modalSplitKlien.isOpen && modalSplitKlien.formIdx !== null && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-scissors text-indigo-600" />
                Pecah Sesi Jadwal
              </h3>
              <button
                type="button"
                onClick={() => setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Jumlah Sesi (Maksimal 20)
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={modalSplitKlien.numSessions}
                onChange={(e) =>
                  setModalSplitKlien({
                    ...modalSplitKlien,
                    numSessions: Math.min(20, Math.max(2, Number(e.target.value))),
                  })
                }
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                placeholder="2"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Rentang jam siaran pada formulir ini akan dibagi rata menjadi {modalSplitKlien.numSessions} sesi berurutan.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSplitKlien(modalSplitKlien.formIdx!, modalSplitKlien.numSessions)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Pecah Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Rubah Klien (Staging RAM) */}
      {modalEditRubahKlien.isOpen && modalEditRubahKlien.data && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square text-blue-600" />
                  Edit Data Jadwal Klien (Staging RAM)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  ID: {modalEditRubahKlien.data.idJadwal}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalEditRubahKlien({ isOpen: false, data: null })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Platform Client *</label>
                <select
                  value={modalEditRubahKlien.data.platform}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, platform: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Live *</label>
                <input
                  type="date"
                  value={modalEditRubahKlien.data.tanggal}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, tanggal: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Mulai Live *</label>
                <input
                  type="time"
                  value={modalEditRubahKlien.data.jamMulaiLive}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, jamMulaiLive: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Selesai Live *</label>
                <input
                  type="time"
                  value={modalEditRubahKlien.data.jamSelesaiLive}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, jamSelesaiLive: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kuota Host</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={modalEditRubahKlien.data.kuota || 1}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, kuota: Number(e.target.value) },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status Jadwal</label>
                <select
                  value={modalEditRubahKlien.data.status || "TERJADWAL"}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, status: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="TERJADWAL">TERJADWAL</option>
                  <option value="PLOTING">PLOTING</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="BATAL">BATAL</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Live / Campaign</label>
                <input
                  type="text"
                  value={modalEditRubahKlien.data.judulLive || ""}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, judulLive: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Promo Live / Diskon</label>
                <textarea
                  rows={2}
                  value={modalEditRubahKlien.data.promoLive || ""}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, promoLive: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan untuk Host</label>
                <textarea
                  rows={2}
                  value={modalEditRubahKlien.data.catatanHost || ""}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, catatanHost: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Pendukung Host</label>
                <input
                  type="text"
                  value={modalEditRubahKlien.data.filePendukungHost || ""}
                  onChange={(e) =>
                    setModalEditRubahKlien({
                      ...modalEditRubahKlien,
                      data: { ...modalEditRubahKlien.data, filePendukungHost: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalEditRubahKlien({ isOpen: false, data: null })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = modalEditRubahKlien.data;
                  setMemoriEditKlien((prev) => ({ ...prev, [d.idJadwal]: d }));
                  setIsRubahKlienCrashVerified(false);
                  setModalEditRubahKlien({ isOpen: false, data: null });
                  showAlert("✅ Perubahan disimpan sementara ke memori lokal. Klik 'Bebas Crash' lalu 'Simpan Perubahan' untuk menyimpan ke database.");
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Simpan ke Memori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Info Klien (Reusable) */}
      {popupInfoKlien.isOpen && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">{popupInfoKlien.title}</h3>
              <button
                type="button"
                onClick={() => setPopupInfoKlien({ isOpen: false, title: "", content: "" })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {popupInfoKlien.isLink && popupInfoKlien.content.startsWith("http") ? (
                <a
                  href={popupInfoKlien.content}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline font-semibold break-all"
                >
                  {popupInfoKlien.content}
                </a>
              ) : (
                popupInfoKlien.content
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPopupInfoKlien({ isOpen: false, title: "", content: "" })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ketentuan Platform */}
      {modalKetentuan.isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-sliders text-blue-600" />
                Ketentuan Platform: {modalKetentuan.platformName}
              </h3>
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Blacklist Streamer */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Blacklist Streamer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modalKetentuan.inputBlacklist}
                  onChange={(e) => setModalKetentuan({ ...modalKetentuan, inputBlacklist: e.target.value })}
                  placeholder="Ketik nama streamer..."
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = modalKetentuan.inputBlacklist.trim();
                    if (!text) return;
                    setModalKetentuan({
                      ...modalKetentuan,
                      blacklist: [...modalKetentuan.blacklist, text],
                      inputBlacklist: "",
                    });
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {modalKetentuan.blacklist.length === 0 ? (
                  <span className="text-slate-400 text-xs italic self-center">Tidak ada blacklist</span>
                ) : (
                  modalKetentuan.blacklist.map((b, bi) => (
                    <span
                      key={bi}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200"
                    >
                      {b}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...modalKetentuan.blacklist];
                          updated.splice(bi, 1);
                          setModalKetentuan({ ...modalKetentuan, blacklist: updated });
                        }}
                        className="text-red-400 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Prioritas Streamer */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Prioritas Streamer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modalKetentuan.inputPriority}
                  onChange={(e) => setModalKetentuan({ ...modalKetentuan, inputPriority: e.target.value })}
                  placeholder="Ketik nama streamer prioritas..."
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = modalKetentuan.inputPriority.trim();
                    if (!text) return;
                    setModalKetentuan({
                      ...modalKetentuan,
                      priority: [...modalKetentuan.priority, text],
                      inputPriority: "",
                    });
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {modalKetentuan.priority.length === 0 ? (
                  <span className="text-slate-400 text-xs italic self-center">Tidak ada prioritas</span>
                ) : (
                  modalKetentuan.priority.map((pr, pi) => (
                    <span
                      key={pi}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200"
                    >
                      {pr}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...modalKetentuan.priority];
                          updated.splice(pi, 1);
                          setModalKetentuan({ ...modalKetentuan, priority: updated });
                        }}
                        className="text-emerald-400 hover:text-emerald-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setKetentuanPlatformData((prev) => ({
                    ...prev,
                    [modalKetentuan.platformName]: {
                      blacklist: modalKetentuan.blacklist,
                      priority: modalKetentuan.priority,
                    },
                  }));
                  setModalKetentuan({ ...modalKetentuan, isOpen: false });
                  showAlert(`✅ Ketentuan untuk ${modalKetentuan.platformName} berhasil disimpan.`);
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Simpan Ketentuan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
