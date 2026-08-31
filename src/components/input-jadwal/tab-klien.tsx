"use client";

import React, { useState } from "react";
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
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { inputCls, selectCls, labelCls, getStatusBadgeClass } from "./shared-styles";

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

  // --- Subtab 1: Formulir States ---
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

  // --- Subtab 2: Rubah Jadwal Klien States ---
  const [filterPeriodeKlien, setFilterPeriodeKlien] = useState("default");
  const [filterTglSatuKlien, setFilterTglSatuKlien] = useState("");
  const [filterTglMulaiKlien, setFilterTglMulaiKlien] = useState("");
  const [filterTglSelesaiKlien, setFilterTglSelesaiKlien] = useState("");
  const [filterStatusKlien, setFilterStatusKlien] = useState("");
  const [filterPlatformKlien, setFilterPlatformKlien] = useState("");
  const [rubahKlienPage, setRubahKlienPage] = useState(1);
  const [rubahKlienPageSize, setRubahKlienPageSize] = useState(10);
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

  // --- Subtab 3: Ketentuan Klien States ---
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

  // --- Subtab 4: Export Jadwal States ---
  const [exportTanggalKlien, setExportTanggalKlien] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [exportPreviewData, setExportPreviewData] = useState<any[]>([]);

  // --- Subtab 5: Import Jadwal States ---
  const [importModePloting, setImportModePloting] = useState<"baru" | "revisi">("baru");
  const [importMetodePloting, setImportMetodePloting] = useState<"excel" | "link">("excel");
  const [importLinkPloting, setImportLinkPloting] = useState("");
  const [importOldIdPloting, setImportOldIdPloting] = useState("");
  const [plotingDataBaru, setPlotingDataBaru] = useState<any[]>([]);

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
      ...prev,
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

  function handleDuplicateKlienForm(item: ScheduleFormItem) {
    setKlienForms((prev) => [
      ...prev,
      {
        ...item,
        id: Date.now(),
        idJadwal: generateNewScheduleId("JDK", item.tanggal),
      },
    ]);
    setIsKlienCrashVerified(false);
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
      showAlert("⚠️ Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu!");
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
  const filteredKlienSchedules = allJadwal.filter((j) => {
    if (filterStatusKlien && (j.status || "").toUpperCase() !== filterStatusKlien.toUpperCase()) {
      return false;
    }
    if (filterPlatformKlien.trim()) {
      const q = filterPlatformKlien.toLowerCase().trim();
      const match =
        j.platform?.toLowerCase().includes(q) ||
        j.client?.namaClient?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalRubahPages = Math.max(1, Math.ceil(filteredKlienSchedules.length / rubahKlienPageSize));
  const currentRubahPage = Math.min(rubahKlienPage, totalRubahPages);
  const startRubahIdx = (currentRubahPage - 1) * rubahKlienPageSize;
  const paginatedRubah = filteredKlienSchedules.slice(startRubahIdx, startRubahIdx + rubahKlienPageSize);

  return (
    <div className="space-y-6">
      {/* 5 Subtab Navigation */}
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
                ? "border-[#941A0B] text-[#941A0B]"
                : "border-transparent text-slate-500 hover:text-slate-800"
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
          {klienForms.map((item, idx) => (
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
                    onClick={() =>
                      setModalSplitKlien({ isOpen: true, formIdx: idx, numSessions: 2 })
                    }
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-purple-200"
                  >
                    <i className="fa-solid fa-scissors" /> Pecah Sesi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateKlienForm(item)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                  >
                    <i className="fa-solid fa-clone" /> Duplikat
                  </button>
                  {klienForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveKlienForm(item.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Platform Client */}
                <div>
                  <label className={labelCls}>Platform Client *</label>
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
                    className={selectCls}
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

                {/* Tanggal */}
                <div>
                  <label className={labelCls}>Tanggal Live *</label>
                  <FlatpickrPicker
                    value={item.tanggal}
                    placeholder="Pilih Tanggal..."
                    options={{ mode: "single", dateFormat: "Y-m-d" }}
                    onChange={(dateStr) => updateKlienField(idx, "tanggal", dateStr)}
                  />
                </div>

                {/* Jam Mulai */}
                <div>
                  <label className={labelCls}>Jam Mulai Live *</label>
                  <input
                    type="time"
                    value={item.jamMulaiLive}
                    onChange={(e) => updateKlienField(idx, "jamMulaiLive", e.target.value)}
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
                    onChange={(e) => updateKlienField(idx, "jamSelesaiLive", e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                {/* Kuota Host */}
                <div>
                  <label className={labelCls}>Kuota Host Diperlukan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={item.kuota || 1}
                    onChange={(e) => updateKlienField(idx, "kuota", Number(e.target.value))}
                    className={inputCls}
                  />
                </div>

                {/* Judul Live */}
                <div>
                  <label className={labelCls}>Judul / Tema Live</label>
                  <input
                    type="text"
                    value={item.judulLive || ""}
                    onChange={(e) => updateKlienField(idx, "judulLive", e.target.value)}
                    placeholder="e.g. Sesi Promo Siang"
                    className={inputCls}
                  />
                </div>

                {/* Link File Drive */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>Link File Pendukung (Google Drive)</label>
                  <input
                    type="text"
                    value={item.filePendukungHost || ""}
                    onChange={(e) => updateKlienField(idx, "filePendukungHost", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Produk Prioritas */}
              <div>
                <label className={labelCls}>Produk Prioritas</label>
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
                    placeholder="Ketik nama produk lalu klik Tambah..."
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddProduk(item.id, idx)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                  >
                    Tambah
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {((item.produkPrioritas as string[]) || []).length === 0 ? (
                    <span className="text-slate-400 text-xs italic">Belum ada produk</span>
                  ) : (
                    ((item.produkPrioritas as string[]) || []).map((prod, pIdx) => (
                      <span
                        key={pIdx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                      >
                        {prod}
                        <button
                          type="button"
                          onClick={() => handleRemoveProduk(idx, pIdx)}
                          className="text-red-400 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={handleAddKlienForm}
              className="w-full sm:w-auto px-6 py-3 bg-red-50 text-[#941A0B] rounded-xl hover:bg-red-100 font-bold transition flex items-center justify-center gap-2 text-xs border border-red-200"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 100)
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCheckBebasCrashKlien}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-xs"
              >
                <i className="fa-solid fa-shield-halved" /> Bebas Crash
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs text-white ${
                  isKlienCrashVerified && !loading
                    ? "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Status Jadwal</label>
              <select
                value={filterStatusKlien}
                onChange={(e) => {
                  setFilterStatusKlien(e.target.value);
                  setRubahKlienPage(1);
                }}
                className={selectCls}
              >
                <option value="">Semua Status</option>
                <option value="TERJADWAL">TERJADWAL</option>
                <option value="PLOTING">PLOTING</option>
                <option value="SELESAI">SELESAI</option>
                <option value="BATAL">BATAL</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Cari Platform / Brand</label>
              <input
                type="text"
                value={filterPlatformKlien}
                onChange={(e) => {
                  setFilterPlatformKlien(e.target.value);
                  setRubahKlienPage(1);
                }}
                placeholder="Ketik nama platform..."
                className={inputCls}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-auto max-h-[500px]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-12">No</th>
                    <th className="p-3">Platform</th>
                    <th className="p-3">Waktu Live</th>
                    <th className="p-3 text-center">Kuota</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedRubah.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-400">
                        {startRubahIdx + idx + 1}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{row.platform}</td>
                      <td className="p-3">
                        <div className="font-bold">{formatDateSafe(row.tanggal)}</div>
                        <div className="text-emerald-600 font-mono text-[11px]">
                          {formatTimeSafe(row.jamMulaiLive)} - {formatTimeSafe(row.jamSelesaiLive)}
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold">{row.kuotaHost || 1} Host</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadgeClass(row.status)}`}>
                          {(row.status || "TERJADWAL").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Menampilkan {filteredKlienSchedules.length} jadwal klien
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={currentRubahPage <= 1}
                  onClick={() => setRubahKlienPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 font-bold"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={currentRubahPage >= totalRubahPages}
                  onClick={() => setRubahKlienPage((p) => Math.min(totalRubahPages, p + 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 font-bold"
                >
                  Selanjutnya
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-black text-sm flex items-center gap-2">
                <i className="fa-solid fa-sliders text-[#941A0B]" />
                <span>Ketentuan Khusus Platform & Host</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola daftar blacklist dan prioritas host per platform
              </p>
            </div>
            <input
              type="text"
              value={searchKetentuanPlatform}
              onChange={(e) => setSearchKetentuanPlatform(e.target.value)}
              placeholder="Cari platform..."
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#941A0B]"
            />
          </div>

          <div className="overflow-auto max-h-[500px]">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-12">No</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3">Blacklist Host</th>
                  <th className="p-3">Prioritas Host</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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
                      <tr key={p.value || plat} className="hover:bg-slate-50">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-semibold text-slate-800">{plat}</td>
                        <td className="p-3">
                          {saved.blacklist.length === 0 ? (
                            <span className="text-slate-400 italic">Tidak ada blacklist</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {saved.blacklist.map((b: string, bi: number) => (
                                <span
                                  key={bi}
                                  className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-[11px] font-bold"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {saved.priority.length === 0 ? (
                            <span className="text-slate-400 italic">Semua host memenuhi</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {saved.priority.map((pr: string, pi: number) => (
                                <span
                                  key={pi}
                                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-bold"
                                >
                                  {pr}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
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
                            className="px-3 py-1 bg-[#941A0B] text-white rounded-lg text-[11px] font-bold hover:bg-[#7a1509]"
                          >
                            Kelola
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

      {/* ===================================================================== */}
      {/* SUBTAB 4: EXPORT JADWAL                                               */}
      {/* ===================================================================== */}
      {klienSubTab === "export" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-extrabold text-black text-sm">Export Data Jadwal Klien</h3>
          <p className="text-xs text-slate-500">
            Tarik data jadwal klien untuk disalin ke master ploting
          </p>
          <div className="flex gap-3 items-end">
            <div>
              <label className={labelCls}>Pilih Tanggal Export</label>
              <input
                type="date"
                value={exportTanggalKlien}
                onChange={(e) => setExportTanggalKlien(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const filtered = allJadwal.filter(
                  (j) => (j.tanggal || "").slice(0, 10) === exportTanggalKlien
                );
                setExportPreviewData(filtered);
                showAlert(`✅ Ditemukan ${filtered.length} jadwal pada tanggal ${exportTanggalKlien}.`);
              }}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black"
            >
              Tarik Data
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 5: IMPORT JADWAL                                               */}
      {/* ===================================================================== */}
      {klienSubTab === "import" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-extrabold text-black text-sm">Import Jadwal Klien</h3>
          <p className="text-xs text-slate-500">
            Unggah data jadwal klien dari file Excel atau tautan spreadsheet
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Mode Import</label>
              <select
                value={importModePloting}
                onChange={(e) => setImportModePloting(e.target.value as any)}
                className={selectCls}
              >
                <option value="baru">Jadwal Baru</option>
                <option value="revisi">Revisi Jadwal</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Metode Import</label>
              <select
                value={importMetodePloting}
                onChange={(e) => setImportMetodePloting(e.target.value as any)}
                className={selectCls}
              >
                <option value="excel">File Excel / CSV</option>
                <option value="link">Tautan Google Sheets</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Modal Split Sesi */}
      {modalSplitKlien.isOpen && modalSplitKlien.formIdx !== null && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">Pecah Sesi Live Berurutan</h3>
            <p className="text-xs text-slate-500">
              Formulir akan otomatis dibagi menjadi beberapa sesi dengan durasi yang sama.
            </p>
            <div>
              <label className={labelCls}>Jumlah Sesi</label>
              <select
                value={modalSplitKlien.numSessions}
                onChange={(e) =>
                  setModalSplitKlien({
                    ...modalSplitKlien,
                    numSessions: Number(e.target.value),
                  })
                }
                className={selectCls}
              >
                <option value={2}>2 Sesi</option>
                <option value={3}>3 Sesi</option>
                <option value={4}>4 Sesi</option>
                <option value={5}>5 Sesi</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 })
                }
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSplitKlien(modalSplitKlien.formIdx!, modalSplitKlien.numSessions)
                }
                className="px-6 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
              >
                Pecah Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ketentuan Platform */}
      {modalKetentuan.isOpen && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Ketentuan Platform: {modalKetentuan.platformName}
              </h3>
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Blacklist */}
            <div className="space-y-2">
              <label className={labelCls}>Blacklist Host</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modalKetentuan.inputBlacklist}
                  onChange={(e) =>
                    setModalKetentuan({ ...modalKetentuan, inputBlacklist: e.target.value })
                  }
                  placeholder="Ketik nama streamer..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = modalKetentuan.inputBlacklist.trim();
                    if (!t) return;
                    setModalKetentuan({
                      ...modalKetentuan,
                      blacklist: [...modalKetentuan.blacklist, t],
                      inputBlacklist: "",
                    });
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
                >
                  Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 min-h-[36px]">
                {modalKetentuan.blacklist.map((b, bi) => (
                  <span
                    key={bi}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200"
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
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className={labelCls}>Prioritas Host</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modalKetentuan.inputPriority}
                  onChange={(e) =>
                    setModalKetentuan({ ...modalKetentuan, inputPriority: e.target.value })
                  }
                  placeholder="Ketik nama streamer..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = modalKetentuan.inputPriority.trim();
                    if (!t) return;
                    setModalKetentuan({
                      ...modalKetentuan,
                      priority: [...modalKetentuan.priority, t],
                      inputPriority: "",
                    });
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Tambah
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 min-h-[36px]">
                {modalKetentuan.priority.map((pr, pi) => (
                  <span
                    key={pi}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200"
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
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
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
                className="px-6 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
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
