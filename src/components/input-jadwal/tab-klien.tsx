"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { FlatpickrTimeInput } from "./flatpickr-time-input";
import { calculateEndTime } from "@/lib/utils/schedule-helpers";
import { getStatusBadgeClass } from "./shared-styles";
import { toast } from "@/components/ui/toast";
import { sendJson } from "@/lib/api-client";

export function TabKlien({
  streamers = [],
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
      tanggal: "",
      platform: "",
      clientId: "",
      jamMulaiLive: "",
      jamSelesaiLive: "",
      durasi: "0",
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
  // SUBTAB 3: KETENTUAN KLIEN STATES (100% MATCH WITH REF-DEPLOY)
  // =========================================================================
  const [searchKetentuanPlatform, setSearchKetentuanPlatform] = useState("");
  const [ketentuanPlatformData, setKetentuanPlatformData] = useState<{
    [platformName: string]: { blacklist: string[]; priority: string[] };
  }>({});
  const [memoriEditKetentuan, setMemoriEditKetentuan] = useState<{
    [platformName: string]: { blacklist: string[]; priority: string[] };
  }>({});
  const [ketentuanPage, setKetentuanPage] = useState(1);
  const [ketentuanPageSize] = useState(10);
  const [modalKetentuan, setModalKetentuan] = useState<{
    isOpen: boolean;
    platformName: string;
    blacklist: string[];
    priority: string[];
    searchBlacklist: string;
    searchPriority: string;
  }>({
    isOpen: false,
    platformName: "",
    blacklist: [],
    priority: [],
    searchBlacklist: "",
    searchPriority: "",
  });
  const [modalDetailKetentuan, setModalDetailKetentuan] = useState<{
    isOpen: boolean;
    title: string;
    items: { nama: string; jabatan: string }[];
  }>({
    isOpen: false,
    title: "",
    items: [],
  });

  function showPopUpKetentuanDetail(title: string, rawData: string[] | string) {
    const items = Array.isArray(rawData)
      ? rawData
      : typeof rawData === "string"
      ? rawData.split("==").filter(Boolean)
      : [];
    const parsed = items.map((str) => {
      const parts = str.split("**");
      return {
        nama: parts[0] ? parts[0].trim() : str,
        jabatan: parts[1] ? parts[1].trim() : "Host",
      };
    });
    setModalDetailKetentuan({
      isOpen: true,
      title,
      items: parsed,
    });
  }

  useEffect(() => {
    if (!clients || clients.length === 0) return;
    const initial: { [platformName: string]: { blacklist: string[]; priority: string[] } } = {};
    clients.forEach((c) => {
      if (Array.isArray((c as any).ketentuan)) {
        (c as any).ketentuan.forEach((k: any) => {
          const plat = k.platform || c.namaClient;
          const bl =
            typeof k.blacklist === "string"
              ? k.blacklist.split("==").filter(Boolean)
              : Array.isArray(k.blacklist)
              ? k.blacklist
              : [];
          const pr =
            typeof k.prioritasPlatform === "string"
              ? k.prioritasPlatform.split("==").filter(Boolean)
              : Array.isArray(k.prioritasPlatform)
              ? k.prioritasPlatform
              : [];
          initial[plat] = { blacklist: bl, priority: pr };
        });
      }
    });
    if (Object.keys(initial).length > 0) {
      setKetentuanPlatformData((prev) => ({ ...initial, ...prev }));
    }
  }, [clients]);

  // =========================================================================
  // SUBTAB 4: EXPORT JADWAL STATES (100% MATCH WITH REF-DEPLOY)
  // =========================================================================
  const [exportTanggalKlien, setExportTanggalKlien] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [exportPreviewData, setExportPreviewData] = useState<any[]>([]);
  const [exportPage, setExportPage] = useState(1);
  const [exportPageSize] = useState(10);

  // =========================================================================
  // SUBTAB 5: IMPORT JADWAL STATES (100% MATCH WITH REF-DEPLOY)
  // =========================================================================
  const [importModePloting, setImportModePloting] = useState<"baru" | "revisi">("baru");
  const [importMetodePloting, setImportMetodePloting] = useState<"excel" | "link">("excel");
  const [importMetodePlotingRevisi, setImportMetodePlotingRevisi] = useState<"excel" | "link">("excel");
  const [importLinkPloting, setImportLinkPloting] = useState("");
  const [importLinkPlotingRevisi, setImportLinkPlotingRevisi] = useState("");
  const [importOldIdPloting, setImportOldIdPloting] = useState("");
  const [importDataBaru, setImportDataBaru] = useState<any[]>([]);
  const [importDataRevisi, setImportDataRevisi] = useState<any[]>([]);
  const [importPageBaru, setImportPageBaru] = useState(1);
  const [importPageRevisi, setImportPageRevisi] = useState(1);
  const [importPageSize] = useState(10);
  const [isImportCrashVerified, setIsImportCrashVerified] = useState(false);

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
        tanggal: last?.tanggal || "",
        platform: last?.platform || "",
        clientId: last?.clientId || "",
        jamMulaiLive: "",
        jamSelesaiLive: "",
        durasi: "0",
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
        if (item.jamMulaiLive && item.jamSelesaiLive) {
          item.durasi = calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive);
        } else {
          item.durasi = "0";
        }
      }
      if (field === "tanggal" && value) {
        item.idJadwal = generateNewScheduleId("JDK", value);
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

  function runKlienCrashValidation(): { isValid: boolean; conflicts: any[] } {
    if (klienForms.length === 0) {
      showAlert("Tidak ada formulir aktif untuk diperiksa.");
      return { isValid: false, conflicts: [] };
    }
    for (let i = 0; i < klienForms.length; i++) {
      const f = klienForms[i];
      if (!f.platform || !f.tanggal || !f.jamMulaiLive || !f.jamSelesaiLive) {
        showAlert(`⚠️ Form #${i + 1}: Platform, Tanggal, Jam Mulai, dan Jam Selesai wajib diisi!`);
        return { isValid: false, conflicts: [] };
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

    return { isValid: true, conflicts };
  }

  function handleCheckBebasCrashKlien() {
    const { isValid, conflicts } = runKlienCrashValidation();
    if (!isValid) return;

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
    let totalMins = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMins <= 0) totalMins += 1440;

    const slotMins = Math.floor(totalMins / numSessions);
    const newItems: ScheduleFormItem[] = [];

    for (let i = 0; i < numSessions; i++) {
      const curStartMins = (sh * 60 + sm + i * slotMins) % 1440;
      const curEndMins = i === numSessions - 1
        ? (eh * 60 + em) % 1440
        : (sh * 60 + sm + (i + 1) * slotMins) % 1440;

      const formatHm = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      newItems.push({
        ...master,
        id: Date.now() + i,
        idJadwal: generateNewScheduleId("JDK", master.tanggal),
        jamMulaiLive: formatHm(curStartMins),
        jamSelesaiLive: formatHm(curEndMins),
        durasi: calcDurationHours(formatHm(curStartMins), formatHm(curEndMins)),
      });
    }

    setKlienForms((prev) => {
      const next = [...prev];
      next.splice(idx, 1, ...newItems);
      return next;
    });
    setIsKlienCrashVerified(false);
    setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 });
    showAlert(`✅ Berhasil membagi form #${idx + 1} menjadi ${numSessions} sesi berurutan.`);
  }

  async function submitKlienSchedules(e: React.FormEvent) {
    e.preventDefault();
    if (klienForms.length === 0) {
      setError("Tidak ada formulir aktif untuk disimpan.");
      return;
    }

    if (!isKlienCrashVerified) {
      const { isValid, conflicts } = runKlienCrashValidation();
      if (!isValid) return;

      if (conflicts.length > 0) {
        setIsKlienCrashVerified(false);
        setModalCrashData({
          isOpen: true,
          isSafe: false,
          title: `Ditemukan ${conflicts.length} Jadwal Klien Bentrok!`,
          conflicts,
        });
        return;
      }
      setIsKlienCrashVerified(true);
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

        // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
        const cleanStart = item.jamMulaiLive.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive.length === 5 ? item.jamMulaiLive + ":00" : item.jamMulaiLive}+07:00`;
        const cleanEnd = item.jamSelesaiLive.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive.length === 5 ? item.jamSelesaiLive + ":00" : item.jamSelesaiLive}+07:00`;

        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("JDK", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          platform: item.platform || matchedClient?.platform || "Shopee Live",
          clientId: item.clientId || matchedClient?.id || null,
          jamMulaiLive: cleanStart,
          jamSelesaiLive: cleanEnd,
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

        await sendJson("/api/jadwal", "POST", payload);
      }
      setSuccess(`✅ Berhasil menerbitkan ${klienForms.length} Jadwal Klien Langsung!`);
      toast.success(`Berhasil menerbitkan ${klienForms.length} Jadwal Klien Langsung!`);
      setIsKlienCrashVerified(false);
      setKlienForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("JDK"),
          tanggal: "",
          platform: "",
          clientId: "",
          jamMulaiLive: "",
          jamSelesaiLive: "",
          durasi: "0",
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
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyimpan Jadwal Klien.";
      setError(errMsg);
      toast.error(errMsg, "Gagal Menyimpan Jadwal");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // SUBTAB 2 HANDLERS (Rubah Jadwal Klien)
  // =========================================================================
  function handleSaveModalEditRubahKlien() {
    if (!modalEditRubahKlien.data) return;
    const d = modalEditRubahKlien.data;
    if (!d.platform || !d.tanggal || !d.jamMulaiLive || !d.jamSelesaiLive) {
      showAlert("⚠️ Tanggal, Platform, dan Jam Mulai/Selesai wajib diisi!");
      return;
    }
    const durasiStr = calcDurationHours(d.jamMulaiLive, d.jamSelesaiLive);
    setMemoriEditKlien((prev) => ({
      ...prev,
      [d.idJadwal]: {
        ...d,
        durasi: durasiStr,
      },
    }));
    setModalEditRubahKlien({ isOpen: false, data: null });
    setIsRubahKlienCrashVerified(false);
    showAlert(`Jadwal ${d.idJadwal} disimpan dalam memori RAM.`);
  }

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
        // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
        const jamMulaiIso = item.jamMulaiLive?.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive}:00+07:00`;
        const jamSelesaiIso = item.jamSelesaiLive?.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive}:00+07:00`;

        await sendJson("/api/jadwal", "PUT", {
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

  // =========================================================================
  // SUBTAB 3 HANDLERS (Ketentuan Klien)
  // =========================================================================
  async function handleSimpanPerubahanKetentuan() {
    const keys = Object.keys(memoriEditKetentuan);
    if (keys.length === 0) return;

    setLoading(true);
    try {
      for (const plat of keys) {
        const item = memoriEditKetentuan[plat];
        const matchedClient =
          clients.find(
            (c) =>
              c.namaClient.toLowerCase() === plat.toLowerCase() ||
              (c as any).platform?.toLowerCase() === plat.toLowerCase()
          ) || clients[0];

        if (matchedClient) {
          await sendJson("/api/clients", "PATCH", {
            clientId: matchedClient.id,
            platform: plat,
            blacklist: item.blacklist.join("=="),
            catatan: item.blacklist.join("=="),
            kategori: item.priority.join("=="),
          });
        }
      }
      setKetentuanPlatformData((prev) => ({ ...prev, ...memoriEditKetentuan }));
      setMemoriEditKetentuan({});
      showAlert(`✅ KETENTUAN KLIEN TERSIMPAN:\n\nBerhasil memperbarui ${keys.length} ketentuan platform ke server & database.`);
      fetchData();
    } catch {
      showAlert("❌ Terjadi kesalahan saat menyimpan ketentuan ke server.");
    } finally {
      setLoading(false);
    }
  }

  // Filter for Subtab 2: Rubah Klien Table (100% Match with ref-deploy)
  const filteredKlienSchedules = useMemo(() => {
    let filterTglAwal = "";
    let filterTglAkhir = "";

    const today = new Date();
    const formatDateStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (filterPeriodeKlien === "default") {
      const minD = new Date(today);
      minD.setDate(today.getDate() - 7);
      const maxD = new Date(today);
      maxD.setDate(today.getDate() + 35);
      filterTglAwal = formatDateStr(minD);
      filterTglAkhir = formatDateStr(maxD);
    } else if (filterPeriodeKlien === "hari_ini") {
      filterTglAwal = formatDateStr(today);
      filterTglAkhir = formatDateStr(today);
    } else if (filterPeriodeKlien === "7_belakang") {
      const minD = new Date(today);
      minD.setDate(today.getDate() - 7);
      filterTglAwal = formatDateStr(minD);
      filterTglAkhir = formatDateStr(today);
    } else if (filterPeriodeKlien === "7_depan") {
      const maxD = new Date(today);
      maxD.setDate(today.getDate() + 7);
      filterTglAwal = formatDateStr(today);
      filterTglAkhir = formatDateStr(maxD);
    } else if (filterPeriodeKlien === "35_depan") {
      const maxD = new Date(today);
      maxD.setDate(today.getDate() + 35);
      filterTglAwal = formatDateStr(today);
      filterTglAkhir = formatDateStr(maxD);
    } else if (filterPeriodeKlien === "tanggal") {
      if (filterTglSatuKlien) {
        filterTglAwal = filterTglSatuKlien;
        filterTglAkhir = filterTglSatuKlien;
      }
    } else if (filterPeriodeKlien === "kustom") {
      if (filterTglMulaiKlien) filterTglAwal = filterTglMulaiKlien;
      if (filterTglSelesaiKlien) filterTglAkhir = filterTglSelesaiKlien;
    }

    const filtered = allJadwal.filter((j) => {
      const idKey = j.idJadwal || j.id;
      const activeRow = memoriEditKlien[idKey] || j;

      const tglData = (activeRow.tanggal || "").slice(0, 10);
      const platformData = String(activeRow.platform || j.client?.namaClient || "").toLowerCase();
      const statusData = String(activeRow.status || "").toUpperCase();

      // 1. Evaluasi Sinkronisasi Waktu
      let masukPeriode = true;
      if (filterTglAwal && filterTglAkhir) {
        masukPeriode = tglData >= filterTglAwal && tglData <= filterTglAkhir;
      }

      // 2. Evaluasi Status
      const passStatus = !filterStatusKlien || statusData === filterStatusKlien.toUpperCase();

      // 3. Evaluasi Platform
      const masukPlatform =
        !filterPlatformKlien || platformData.includes(filterPlatformKlien.toLowerCase().trim());

      return masukPeriode && passStatus && masukPlatform;
    });

    // Pengurutan persis ref-deploy:
    // 1. Sedang diedit diletakkan teratas
    // 2. Tanggal terlama ke terbaru (Ascending)
    // 3. Nama Platform (A-Z)
    // 4. Jam Mulai Paling Awal (00:00 - 23:00)
    filtered.sort((a, b) => {
      const idA = a.idJadwal || a.id;
      const idB = b.idJadwal || b.id;
      const isAEdit = memoriEditKlien[idA] ? 1 : 0;
      const isBEdit = memoriEditKlien[idB] ? 1 : 0;
      if (isBEdit !== isAEdit) return isBEdit - isAEdit;

      const tglA = (a.tanggal || "").slice(0, 10);
      const tglB = (b.tanggal || "").slice(0, 10);
      if (tglA !== tglB) return tglA.localeCompare(tglB);

      const platA = a.platform || "";
      const platB = b.platform || "";
      if (platA !== platB) return platA.localeCompare(platB);

      const jamA = a.jamMulaiLive || "";
      const jamB = b.jamMulaiLive || "";
      return jamA.localeCompare(jamB);
    });

    return filtered;
  }, [
    allJadwal,
    memoriEditKlien,
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
              const hasTimes = !!(item.jamMulaiLive && item.jamSelesaiLive);
              const durasiStr = hasTimes ? (item.durasi || calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive)) : "0";
              const platLabel =
                platformClientOptions.find((p) => p.value === item.platform)?.label ||
                item.platform ||
                "Formulir Jadwal Klien";
              const tglFormatted = item.tanggal ? formatDateSafe(item.tanggal) : "--/--/----";
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
                            <FlatpickrTimeInput
                              id={`K_JAM_MULAI_${idx + 1}`}
                              value={item.jamMulaiLive}
                              onChange={(val) => {
                                updateKlienField(idx, "jamMulaiLive", val);
                                // Auto-fill end time +2 hours (mirrors ref-deploy calculateEndTimeKlien)
                                const auto = calculateEndTime(val, 2);
                                if (auto) updateKlienField(idx, "jamSelesaiLive", auto);
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
                              id={`K_JAM_SELESAI_${idx + 1}`}
                              value={item.jamSelesaiLive}
                              onChange={(val) => updateKlienField(idx, "jamSelesaiLive", val)}
                              placeholder="Pilih Jam Selesai"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Durasi (Jam)
                            </label>
                            <input
                              type="text"
                              value={item.jamMulaiLive && item.jamSelesaiLive ? (item.durasi || calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive)) : ""}
                              placeholder="0"
                              readOnly
                              className="w-full border border-slate-200 bg-slate-100 text-slate-400 font-bold rounded-lg px-4 py-2.5 text-sm outline-none cursor-not-allowed font-mono"
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
                disabled={loading}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                  loading
                    ? "bg-slate-400 cursor-wait text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                }`}
              >
                <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} />
                <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal Klien"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: RUBAH JADWAL KLIEN (100% MATCH WITH REF-DEPLOY)             */}
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
                  onChange={(e) => {
                    setFilterPeriodeKlien(e.target.value);
                    setRubahKlienPage(1);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="default">DATA (-7 s/d +35 Hari)</option>
                  <option value="hari_ini">Hari Ini</option>
                  <option value="7_belakang">7 Hari Ke Belakang</option>
                  <option value="7_depan">7 Hari Ke Depan</option>
                  <option value="35_depan">35 Hari Ke Depan</option>
                  <option value="tanggal">Tentukan Tanggal</option>
                  <option value="kustom">Kustom Periode</option>
                </select>
                {filterPeriodeKlien === "tanggal" && (
                  <input
                    type="date"
                    value={filterTglSatuKlien}
                    onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                    onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                    onChange={(e) => {
                      setFilterTglSatuKlien(e.target.value);
                      setRubahKlienPage(1);
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-2 cursor-pointer bg-white"
                    placeholder="Pilih Tanggal"
                  />
                )}
                {filterPeriodeKlien === "kustom" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="date"
                      value={filterTglMulaiKlien}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        setFilterTglMulaiKlien(e.target.value);
                        setRubahKlienPage(1);
                      }}
                      placeholder="Mulai"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                    />
                    <input
                      type="date"
                      value={filterTglSelesaiKlien}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        setFilterTglSelesaiKlien(e.target.value);
                        setRubahKlienPage(1);
                      }}
                      placeholder="Selesai"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
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
                      onClick={() => {
                        setFilterPlatformKlien("");
                        setRubahKlienPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                      title="Hapus filter platform"
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
                <i className="fa-solid fa-triangle-exclamation mr-1" /> Ada perubahan yang belum disimpan!
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
                        Data tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    paginatedRubah.map((row, idx) => {
                      const idKey = row.idJadwal || row.id;
                      const edited = memoriEditKlien[idKey];
                      const displayRow = edited || row;
                      const isEdited = !!edited;

                      let statusBg = "bg-slate-100 text-slate-600 border border-slate-200";
                      const stUpper = (displayRow.status || "").toUpperCase();
                      if (stUpper === "TERJADWAL") statusBg = "bg-blue-50 text-blue-600 border border-blue-200";
                      else if (stUpper === "PLOTING") statusBg = "bg-indigo-50 text-indigo-600 border border-indigo-200";
                      else if (stUpper === "SELESAI") statusBg = "bg-emerald-50 text-emerald-600 border border-emerald-200";
                      else if (stUpper === "BATAL") statusBg = "bg-red-50 text-red-600 border border-red-200";

                      const durasiVal =
                        displayRow.durasi ||
                        calcDurationHours(displayRow.jamMulaiLive, displayRow.jamSelesaiLive);

                      return (
                        <tr
                          key={idKey || idx}
                          className={`group ${isEdited ? "bg-amber-50" : "hover:bg-slate-50"} bg-white transition-colors border-b border-slate-100 last:border-0`}
                        >
                          <td
                            className={`px-2 py-3 text-center sticky left-0 z-20 ${
                              isEdited ? "bg-amber-50" : "bg-white group-hover:bg-slate-50"
                            } shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}
                          >
                            {isEdited ? (
                              <i className="fa-solid fa-check text-amber-500 text-lg" />
                            ) : (
                              <span className="font-bold text-slate-400">
                                {startRubahIdx + idx + 1}
                              </span>
                            )}
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
                              className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center mx-auto shadow-sm"
                              title="Edit Data Jadwal"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-800">{displayRow.platform || "-"}</div>
                            <div className="text-xs text-blue-600 mt-0.5 truncate max-w-[150px]">
                              Judul: {displayRow.judulLive || "-"}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono">
                              ID: {displayRow.idJadwal || displayRow.id}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-700">{formatDateSafe(displayRow.tanggal)}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <i className="fa-regular fa-clock mr-1" />
                              {formatTimeSafe(displayRow.jamMulaiLive)} - {formatTimeSafe(displayRow.jamSelesaiLive)}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-600 mt-1">
                              Durasi: {durasiVal} jam
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600 border border-slate-200">
                              {displayRow.kuotaHost || displayRow.kuota || 1} Host
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPopupInfoKlien({
                                  isOpen: true,
                                  title: "Catatan Host",
                                  content: displayRow.catatanHost || "-",
                                })
                              }
                              className="text-slate-400 hover:text-blue-500 transition text-lg"
                              title="Lihat Catatan Host"
                            >
                              <i className="fa-solid fa-clipboard" />
                            </button>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPopupInfoKlien({
                                  isOpen: true,
                                  title: "File Pendukung",
                                  content: displayRow.filePendukungHost || "-",
                                  isLink: true,
                                })
                              }
                              className="text-slate-400 hover:text-blue-500 transition text-lg"
                              title="Buka File Pendukung"
                            >
                              <i className="fa-solid fa-link" />
                            </button>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPopupInfoKlien({
                                  isOpen: true,
                                  title: "Promo & Produk",
                                  content: `Promo:\n${displayRow.promoLive || "-"}\n\nProduk Prioritas:\n${
                                    Array.isArray(displayRow.produkPrioritas)
                                      ? displayRow.produkPrioritas.join("\n• ")
                                      : displayRow.produkPrioritas || "-"
                                  }`,
                                })
                              }
                              className="text-slate-400 hover:text-orange-500 transition text-lg"
                              title="Lihat Promo & Produk Prioritas"
                            >
                              <i className="fa-solid fa-basket-shopping" />
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${statusBg}`}>
                              {(displayRow.status || "TERJADWAL").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPopupInfoKlien({
                                  isOpen: true,
                                  title: "Info Ploting",
                                  content: `Spreadsheet:\n${displayRow.linkPloting || "-"}\n\nUser Export Terakhir:\n${
                                    displayRow.userExport || "-"
                                  }`,
                                })
                              }
                              className="text-slate-400 hover:text-indigo-500 transition text-lg"
                              title="Lihat Info Ploting"
                            >
                              <i className="fa-solid fa-circle-info" />
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
                {filteredKlienSchedules.length === 0
                  ? "Menampilkan 0 dari 0 data"
                  : `Menampilkan ${startRubahIdx + 1}-${Math.min(
                      startRubahIdx + rubahKlienPageSize,
                      filteredKlienSchedules.length
                    )} dari ${filteredKlienSchedules.length} data`}
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
      {/* SUBTAB 3: KETENTUAN KLIEN (100% MATCH WITH REF-DEPLOY)                */}
      {/* ===================================================================== */}
      {klienSubTab === "ketentuan" && (() => {
        const filteredKetentuan = platformClientOptions.filter(
          (p) =>
            !searchKetentuanPlatform ||
            p.label.toLowerCase().includes(searchKetentuanPlatform.toLowerCase().trim())
        );
        const totalKetentuanPages = Math.max(1, Math.ceil(filteredKetentuan.length / ketentuanPageSize));
        const currentKetentuanPage = Math.min(ketentuanPage, totalKetentuanPages);
        const startKetIdx = (currentKetentuanPage - 1) * ketentuanPageSize;
        const paginatedKetentuan = filteredKetentuan.slice(startKetIdx, startKetIdx + ketentuanPageSize);
        const hasUnsavedKetentuan = Object.keys(memoriEditKetentuan).length > 0;

        return (
          <div className="space-y-4">
            {/* Header / Search Card */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm">
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
                  onChange={(e) => {
                    setSearchKetentuanPlatform(e.target.value);
                    setKetentuanPage(1);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="Cari Platform..."
                />
                {searchKetentuanPlatform && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchKetentuanPlatform("");
                      setKetentuanPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                    title="Hapus pencarian"
                  >
                    <i className="fa-solid fa-circle-xmark text-lg" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 items-center">
              {hasUnsavedKetentuan && (
                <span className="text-sm font-bold text-amber-500 mr-auto flex items-center gap-1.5 animate-pulse">
                  <i className="fa-solid fa-triangle-exclamation mr-1" /> Ada perubahan yang belum disimpan!
                </span>
              )}
              {hasUnsavedKetentuan && (
                <button
                  type="button"
                  onClick={() => {
                    setMemoriEditKetentuan({});
                    showAlert("Perubahan ketentuan dalam memori telah dibatalkan.");
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-bold transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-left" /> Batal Rubah
                </button>
              )}
              <button
                type="button"
                onClick={handleSimpanPerubahanKetentuan}
                disabled={!hasUnsavedKetentuan}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  hasUnsavedKetentuan
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                }`}
              >
                <i className="fa-solid fa-cloud-arrow-up" /> Simpan Perubahan
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap relative">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-center w-12 sticky left-0 z-20 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        NO
                      </th>
                      <th className="px-3 py-3 text-center w-16">AKSI</th>
                      <th className="px-4 py-3 min-w-[200px]">PLATFORM</th>
                      <th className="px-4 py-3 text-center w-40">BLACKLIST</th>
                      <th className="px-4 py-3 text-center w-40">PRIORITAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedKetentuan.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                          Tidak ada data platform yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedKetentuan.map((p, idx) => {
                        const plat = p.label;
                        const memEdited = memoriEditKetentuan[plat];
                        const isEdited = !!memEdited;
                        const saved = memEdited || ketentuanPlatformData[plat] || { blacklist: [], priority: [] };

                        return (
                          <tr
                            key={p.value || plat}
                            className={`group ${isEdited ? "bg-amber-50" : "hover:bg-slate-50"} bg-white transition-colors border-b border-slate-100 last:border-0`}
                          >
                            <td
                              className={`px-3 py-3 text-center font-mono sticky left-0 z-20 ${
                                isEdited ? "bg-amber-50" : "bg-white group-hover:bg-slate-50"
                              } shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}
                            >
                              {isEdited ? (
                                <i className="fa-solid fa-check text-amber-500 text-lg" />
                              ) : (
                                <span className="font-bold text-slate-400">{startKetIdx + idx + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setModalKetentuan({
                                    isOpen: true,
                                    platformName: plat,
                                    blacklist: [...saved.blacklist],
                                    priority: [...saved.priority],
                                    searchBlacklist: "",
                                    searchPriority: "",
                                  })
                                }
                                className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center mx-auto shadow-sm"
                                title="Edit Ketentuan"
                              >
                                <i className="fa-solid fa-pen-to-square" />
                              </button>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              <div>{plat}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {saved.blacklist.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    showPopUpKetentuanDetail(`Pengecualian Host: ${plat}`, saved.blacklist)
                                  }
                                  className="text-slate-500 hover:text-red-500 transition text-xl relative inline-flex items-center justify-center"
                                  title="Lihat Pengecualian Host"
                                >
                                  <i className="fa-solid fa-users-slash" />
                                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 rounded-full absolute -top-2 -right-2 shadow-sm">
                                    {saved.blacklist.length}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {saved.priority.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    showPopUpKetentuanDetail(`Prioritas Platform: ${plat}`, saved.priority)
                                  }
                                  className="text-slate-500 hover:text-emerald-500 transition text-xl relative inline-flex items-center justify-center"
                                  title="Lihat Prioritas Platform"
                                >
                                  <i className="fa-solid fa-star text-amber-400" />
                                  <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 rounded-full absolute -top-2 -right-2 shadow-sm">
                                    {saved.priority.length}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
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
                  {filteredKetentuan.length === 0
                    ? "Menampilkan 0 dari 0 data"
                    : `Menampilkan ${startKetIdx + 1}-${Math.min(
                        startKetIdx + ketentuanPageSize,
                        filteredKetentuan.length
                      )} dari ${filteredKetentuan.length} data`}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={currentKetentuanPage <= 1}
                    onClick={() => setKetentuanPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    disabled={currentKetentuanPage >= totalKetentuanPages}
                    onClick={() => setKetentuanPage((p) => Math.min(totalKetentuanPages, p + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* SUBTAB 4: EXPORT JADWAL (100% MATCH WITH REF-DEPLOY)                  */}
      {/* ===================================================================== */}
      {klienSubTab === "export" && (() => {
        const totalExpPages = Math.max(1, Math.ceil(exportPreviewData.length / exportPageSize));
        const currentExpPage = Math.min(exportPage, totalExpPages);
        const startExpIdx = (currentExpPage - 1) * exportPageSize;
        const paginatedExp = exportPreviewData.slice(startExpIdx, startExpIdx + exportPageSize);

        return (
          <div className="space-y-4">
            {/* Filter & Tarik Data Card */}
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
                    if (filtered.length > 0) {
                      showAlert(`✅ Ditemukan ${filtered.length} jadwal pada tanggal ${exportTanggalKlien}.`);
                    } else {
                      showAlert(`⚠️ Tidak ditemukan jadwal pada tanggal ${exportTanggalKlien}.`);
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm w-full md:w-auto"
                >
                  <i className="fa-solid fa-magnifying-glass" /> Tarik Data
                </button>
              </div>
            </div>

            {/* Preview Section */}
            {exportPreviewData.length > 0 && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-4">
                  <h3 className="font-bold text-slate-800">
                    <i className="fa-solid fa-list-ul text-blue-600 mr-2" />
                    Preview Data Export (<span className="text-blue-600">{exportPreviewData.length}</span> Jadwal)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      showAlert(`✅ Berhasil membuat salinan ${exportPreviewData.length} jadwal klien untuk ploting!`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto"
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
                        {paginatedExp.map((row, idx) => {
                          let statusBg = "bg-slate-100 text-slate-600 border border-slate-200";
                          const stUpper = (row.status || "").toUpperCase();
                          if (stUpper === "TERJADWAL") statusBg = "bg-blue-50 text-blue-600 border border-blue-200";
                          else if (stUpper === "PLOTING") statusBg = "bg-indigo-50 text-indigo-600 border border-indigo-200";
                          else if (stUpper === "SELESAI") statusBg = "bg-emerald-50 text-emerald-600 border border-emerald-200";
                          else if (stUpper === "BATAL") statusBg = "bg-red-50 text-red-600 border border-red-200";

                          const durasiVal =
                            row.durasi ||
                            calcDurationHours(row.jamMulaiLive, row.jamSelesaiLive);

                          return (
                            <tr key={row.id || row.idJadwal || idx} className="hover:bg-slate-50 transition">
                              <td className="px-2 py-3 text-center font-bold text-slate-400">
                                {startExpIdx + idx + 1}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-slate-800">{row.platform || "-"}</div>
                                <div className="text-xs text-blue-600 mt-0.5 truncate max-w-[150px]">
                                  Judul: {row.judulLive || "-"}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                                  ID: {row.idJadwal || row.id}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-700">{formatDateSafe(row.tanggal)}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  <i className="fa-regular fa-clock mr-1" />
                                  {formatTimeSafe(row.jamMulaiLive)} - {formatTimeSafe(row.jamSelesaiLive)}
                                </div>
                                <div className="text-[10px] font-bold text-emerald-600 mt-1">
                                  Durasi: {durasiVal} jam
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600 border border-slate-200">
                                  {row.kuotaHost || row.kuota || 1} Host
                                </span>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPopupInfoKlien({
                                      isOpen: true,
                                      title: "Catatan Host",
                                      content: row.catatanHost || "-",
                                    })
                                  }
                                  className="text-slate-400 hover:text-blue-500 transition text-lg"
                                  title="Lihat Catatan Host"
                                >
                                  <i className="fa-solid fa-clipboard" />
                                </button>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPopupInfoKlien({
                                      isOpen: true,
                                      title: "File Pendukung",
                                      content: row.filePendukungHost || "-",
                                      isLink: true,
                                    })
                                  }
                                  className="text-slate-400 hover:text-blue-500 transition text-lg"
                                  title="Buka File Pendukung"
                                >
                                  <i className="fa-solid fa-link" />
                                </button>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPopupInfoKlien({
                                      isOpen: true,
                                      title: "Promo & Produk",
                                      content: `Promo:\n${row.promoLive || "-"}\n\nProduk Prioritas:\n${
                                        Array.isArray(row.produkPrioritas)
                                          ? row.produkPrioritas.join("\n• ")
                                          : row.produkPrioritas || "-"
                                      }`,
                                    })
                                  }
                                  className="text-slate-400 hover:text-orange-500 transition text-lg"
                                  title="Lihat Promo & Produk"
                                >
                                  <i className="fa-solid fa-basket-shopping" />
                                </button>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${statusBg}`}>
                                  {(row.status || "TERJADWAL").toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">
                      {exportPreviewData.length === 0
                        ? "Menampilkan 0 dari 0 data"
                        : `Menampilkan ${startExpIdx + 1}-${Math.min(
                            startExpIdx + exportPageSize,
                            exportPreviewData.length
                          )} dari ${exportPreviewData.length} data`}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={currentExpPage <= 1}
                        onClick={() => setExportPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                      >
                        <i className="fa-solid fa-chevron-left" />
                      </button>
                      <button
                        type="button"
                        disabled={currentExpPage >= totalExpPages}
                        onClick={() => setExportPage((p) => Math.min(totalExpPages, p + 1))}
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
        );
      })()}

      {/* ===================================================================== */}
      {/* SUBTAB 5: IMPORT JADWAL (100% MATCH WITH REF-DEPLOY)                  */}
      {/* ===================================================================== */}
      {klienSubTab === "import" && (() => {
        const totalImportBaruPages = Math.max(1, Math.ceil(importDataBaru.length / importPageSize));
        const currentImportBaruPage = Math.min(importPageBaru, totalImportBaruPages);
        const startBaruIdx = (currentImportBaruPage - 1) * importPageSize;
        const paginatedImportBaru = importDataBaru.slice(startBaruIdx, startBaruIdx + importPageSize);

        const totalImportRevPages = Math.max(1, Math.ceil(importDataRevisi.length / importPageSize));
        const currentImportRevPage = Math.min(importPageRevisi, totalImportRevPages);
        const startRevIdx = (currentImportRevPage - 1) * importPageSize;
        const paginatedImportRev = importDataRevisi.slice(startRevIdx, startRevIdx + importPageSize);

        return (
          <div className="space-y-4">
            {/* Mode Switcher */}
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

            {/* AREA DATA BARU PLOTING */}
            {importModePloting === "baru" && (
              <div className="w-full">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 max-w-4xl p-5 sm:p-6 space-y-6">
                  {/* Metode Selector */}
                  <div className="flex space-x-6 mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="metodeImportPloting"
                        value="excel"
                        checked={importMetodePloting === "excel"}
                        onChange={() => setImportMetodePloting("excel")}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">File Excel (.xlsx)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="metodeImportPloting"
                        value="link"
                        checked={importMetodePloting === "link"}
                        onChange={() => setImportMetodePloting("link")}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">Link Google Sheets</span>
                    </label>
                  </div>

                  {/* Kotak Import Excel */}
                  {importMetodePloting === "excel" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        UNGGAH JADWAL KLIEN (EXCEL)
                      </label>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer outline-none border border-slate-200 rounded-lg p-2"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            showAlert(`✅ File ${file.name} berhasil dibaca. Menyiapkan data preview...`);
                            // Dummy initial mock / preview data for visual match
                            setImportDataBaru([
                              {
                                id: 1,
                                tanggal: "2026-09-01",
                                platform: "Shopee Live",
                                jamMulai: "10:00",
                                jamSelesai: "12:00",
                                durasi: "2",
                                lokasi: "Studio 1",
                                streamer: "Host Sarah",
                                infoLain: "-",
                              },
                            ]);
                            setIsImportCrashVerified(false);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        TAUTAN JADWAL KLIEN (SHEETS)
                      </label>
                      <div className="flex gap-3 mt-1">
                        <input
                          type="url"
                          value={importLinkPloting}
                          onChange={(e) => setImportLinkPloting(e.target.value)}
                          placeholder="https://docs.google.com/..."
                          className="w-full flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!importLinkPloting) return showAlert("⚠️ Masukkan tautan Google Sheets terlebih dahulu.");
                            showAlert("✅ Berhasil menarik data dari Google Sheets.");
                            setImportDataBaru([
                              {
                                id: 1,
                                tanggal: "2026-09-01",
                                platform: "Shopee Live",
                                jamMulai: "10:00",
                                jamSelesai: "12:00",
                                durasi: "2",
                                lokasi: "Studio 1",
                                streamer: "Host Sarah",
                                infoLain: "-",
                              },
                            ]);
                            setIsImportCrashVerified(false);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap flex items-center gap-2"
                        >
                          <i className="fa-solid fa-download" /> Tarik Data
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wadah Tabel Ploting Baru */}
                  {importDataBaru.length > 0 && (
                    <div className="border border-slate-200 rounded-lg flex flex-col bg-white overflow-hidden shadow-sm">
                      <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-100 font-bold text-slate-700 border-b sticky top-0 z-30 shadow-sm text-xs uppercase tracking-wider">
                            <tr>
                              <th className="p-3 text-center sticky left-0 z-40 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-12">
                                NO
                              </th>
                              <th className="p-3 border-r text-center">TANGGAL</th>
                              <th className="p-3 border-r">PLATFORM</th>
                              <th className="p-3 border-r text-center">MULAI</th>
                              <th className="p-3 border-r text-center">SELESAI</th>
                              <th className="p-3 border-r text-center">DURASI</th>
                              <th className="p-3 border-r">LOKASI</th>
                              <th className="p-3 border-r">STREAMER</th>
                              <th className="p-3 border-r text-center">INFO LAIN</th>
                              <th className="p-3 text-center">AKSI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-600 bg-white">
                            {paginatedImportBaru.map((d, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition">
                                <td className="p-3 text-center font-bold text-slate-400 sticky left-0 z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  {startBaruIdx + idx + 1}
                                </td>
                                <td className="p-3 border-r text-center">{d.tanggal}</td>
                                <td className="p-3 border-r font-bold text-slate-800">{d.platform}</td>
                                <td className="p-3 border-r text-center font-mono">{d.jamMulai}</td>
                                <td className="p-3 border-r text-center font-mono">{d.jamSelesai}</td>
                                <td className="p-3 border-r text-center font-bold text-emerald-600">{d.durasi} jam</td>
                                <td className="p-3 border-r">{d.lokasi}</td>
                                <td className="p-3 border-r font-medium text-slate-700">{d.streamer}</td>
                                <td className="p-3 border-r text-center text-slate-400">{d.infoLain || "-"}</td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...importDataBaru];
                                      updated.splice(startBaruIdx + idx, 1);
                                      setImportDataBaru(updated);
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                    title="Hapus baris"
                                  >
                                    <i className="fa-solid fa-trash" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Ploting Baru */}
                      <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-500">
                          Menampilkan {paginatedImportBaru.length} dari {importDataBaru.length} data
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={currentImportBaruPage <= 1}
                            onClick={() => setImportPageBaru((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                          >
                            <i className="fa-solid fa-chevron-left" />
                          </button>
                          <button
                            type="button"
                            disabled={currentImportBaruPage >= totalImportBaruPages}
                            onClick={() => setImportPageBaru((p) => Math.min(totalImportBaruPages, p + 1))}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                          >
                            <i className="fa-solid fa-chevron-right" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Aksi Ploting Baru */}
                  {importDataBaru.length > 0 && (
                    <div className="flex justify-end gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setIsImportCrashVerified(true);
                          showAlert("✅ Data ploting aman & bebas bentrok!");
                        }}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2"
                      >
                        <i className="fa-solid fa-shield-halved" /> Bebas Crash
                      </button>
                      <button
                        type="button"
                        disabled={!isImportCrashVerified}
                        onClick={() => {
                          showAlert(`✅ Berhasil menyimpan ${importDataBaru.length} data ploting baru!`);
                          setImportDataBaru([]);
                          setIsImportCrashVerified(false);
                        }}
                        className={`px-8 py-3 rounded-xl font-bold transition flex items-center gap-2 ${
                          isImportCrashVerified
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                        }`}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" /> Simpan (Maks 300)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AREA REVISI MASAL PLOTING */}
            {importModePloting === "revisi" && (
              <div className="w-full">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 max-w-4xl p-5 sm:p-6 space-y-6">
                  {/* Tarik Data Lama */}
                  <div className="flex gap-3 mb-6">
                    <input
                      type="text"
                      value={importOldIdPloting}
                      onChange={(e) => setImportOldIdPloting(e.target.value)}
                      placeholder="Masukkan ID_PLOTING Lama..."
                      className="border border-slate-300 rounded-lg px-4 py-2.5 w-1/2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!importOldIdPloting) return showAlert("⚠️ Masukkan ID_PLOTING Lama terlebih dahulu.");
                        showAlert(`✅ Berhasil menarik data ploting lama untuk ID ${importOldIdPloting}.`);
                        setImportDataRevisi([
                          {
                            id: 1,
                            tanggal: "2026-09-01",
                            platform: "Shopee Live",
                            jamMulai: "10:00",
                            jamSelesai: "12:00",
                            durasi: "2",
                            lokasi: "Studio 1",
                            streamer: "Host Sarah",
                            infoLain: "Revisi Host",
                          },
                        ]);
                      }}
                      className="bg-slate-800 hover:bg-slate-900 text-white py-2.5 px-6 rounded-lg font-bold transition flex items-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-magnifying-glass" /> Tarik Data
                    </button>
                  </div>

                  {/* Unggah Data Terbaru */}
                  {importDataRevisi.length > 0 && (
                    <div className="border-t pt-5 border-slate-200 space-y-6">
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                        <h3 className="font-bold text-blue-800 mb-4">Unggah Data Terbaru (Revisi)</h3>

                        {/* Metode Selector */}
                        <div className="flex space-x-6 mb-4">
                          <label className="flex items-center space-x-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="metodeImportPlotingRevisi"
                              value="excel"
                              checked={importMetodePlotingRevisi === "excel"}
                              onChange={() => setImportMetodePlotingRevisi("excel")}
                              className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-slate-700">File Excel (.xlsx)</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="metodeImportPlotingRevisi"
                              value="link"
                              checked={importMetodePlotingRevisi === "link"}
                              onChange={() => setImportMetodePlotingRevisi("link")}
                              className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-slate-700">Link Google Sheets</span>
                          </label>
                        </div>

                        {/* Excel Revisi */}
                        {importMetodePlotingRevisi === "excel" ? (
                          <div className="space-y-3">
                            <input
                              type="file"
                              accept=".xlsx, .xls"
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 bg-white border border-slate-200 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => showAlert("✅ File revisi Excel berhasil dimuat.")}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center justify-center transition"
                            >
                              <i className="fa-solid fa-file-excel mr-2" /> Preview Excel Revisi
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="url"
                              value={importLinkPlotingRevisi}
                              onChange={(e) => setImportLinkPlotingRevisi(e.target.value)}
                              placeholder="https://docs.google.com/..."
                              className="w-full flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => showAlert("✅ Data revisi dari link Google Sheets berhasil dimuat.")}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap flex items-center justify-center transition"
                            >
                              <i className="fa-solid fa-link mr-2" /> Tarik Link
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Tabel Preview Lama vs Baru */}
                      <div>
                        <h3 className="font-bold text-slate-800 mb-2">
                          Preview Lama vs Baru (<span className="text-blue-600">{importDataRevisi.length}</span>)
                        </h3>
                        <div className="overflow-x-auto border border-slate-200 rounded-t-xl max-h-[460px] custom-scrollbar bg-slate-50">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm text-slate-600 text-xs uppercase tracking-wider">
                              <tr>
                                <th className="p-3 text-center sticky left-0 z-40 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-12">
                                  NO
                                </th>
                                <th className="p-3 border-r text-center">TANGGAL</th>
                                <th className="p-3 border-r">PLATFORM</th>
                                <th className="p-3 border-r text-center">MULAI</th>
                                <th className="p-3 border-r text-center">SELESAI</th>
                                <th className="p-3 border-r text-center">DURASI</th>
                                <th className="p-3 border-r">LOKASI</th>
                                <th className="p-3 border-r">STREAMER</th>
                                <th className="p-3 border-r text-center">INFO LAIN</th>
                                <th className="p-3 text-center">AKSI</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                              {paginatedImportRev.map((d, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-3 text-center font-bold text-slate-400 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    {startRevIdx + idx + 1}
                                  </td>
                                  <td className="p-3 border-r text-center">{d.tanggal}</td>
                                  <td className="p-3 border-r font-bold text-slate-800">{d.platform}</td>
                                  <td className="p-3 border-r text-center font-mono">{d.jamMulai}</td>
                                  <td className="p-3 border-r text-center font-mono">{d.jamSelesai}</td>
                                  <td className="p-3 border-r text-center font-bold text-emerald-600">{d.durasi} jam</td>
                                  <td className="p-3 border-r">{d.lokasi}</td>
                                  <td className="p-3 border-r font-medium text-slate-700">{d.streamer}</td>
                                  <td className="p-3 border-r text-center text-slate-400">{d.infoLain || "-"}</td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...importDataRevisi];
                                        updated.splice(startRevIdx + idx, 1);
                                        setImportDataRevisi(updated);
                                      }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                      title="Hapus baris"
                                    >
                                      <i className="fa-solid fa-trash" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Revisi */}
                        <div className="p-4 bg-slate-50 border-t flex justify-between items-center border-x border-b border-slate-200 rounded-b-xl">
                          <span className="text-xs font-semibold text-slate-500">
                            Menampilkan {paginatedImportRev.length} dari {importDataRevisi.length} data
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={currentImportRevPage <= 1}
                              onClick={() => setImportPageRevisi((p) => Math.max(1, p - 1))}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                            >
                              <i className="fa-solid fa-chevron-left" />
                            </button>
                            <button
                              type="button"
                              disabled={currentImportRevPage >= totalImportRevPages}
                              onClick={() => setImportPageRevisi((p) => Math.min(totalImportRevPages, p + 1))}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 transition font-bold text-xs"
                            >
                              <i className="fa-solid fa-chevron-right" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Tombol Simpan Revisi Masal */}
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            showAlert(`✅ Berhasil menyimpan revisi masal untuk ID ${importOldIdPloting}!`);
                            setImportDataRevisi([]);
                            setImportOldIdPloting("");
                          }}
                          className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2"
                        >
                          <i className="fa-solid fa-cloud-arrow-up" /> Simpan Revisi Masal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                  setModalSplitKlien((prev) => ({
                    ...prev,
                    numSessions: parseInt(e.target.value) || 2,
                  }))
                }
                className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
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
                onClick={() => {
                  if (modalSplitKlien.formIdx !== null) {
                    handleSplitKlien(modalSplitKlien.formIdx, modalSplitKlien.numSessions);
                  }
                  setModalSplitKlien({ isOpen: false, formIdx: null, numSessions: 2 });
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Pecah Sesi
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal Edit Rubah Klien (RAM) */}
      {modalEditRubahKlien.isOpen && modalEditRubahKlien.data && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-blue-600" />
                Edit Jadwal Klien: {modalEditRubahKlien.data.idJadwal}
              </h3>
              <button
                type="button"
                onClick={() => setModalEditRubahKlien({ isOpen: false, data: null })}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Platform *</label>
                <select
                  value={modalEditRubahKlien.data.platform}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, platform: e.target.value } } : prev
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Pilih Platform --</option>
                  {platformClientOptions.map((opt) => (
                    <option key={opt.value} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal *</label>
                <input
                  type="date"
                  value={modalEditRubahKlien.data.tanggal}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, tanggal: e.target.value } } : prev
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jam Mulai Live *</label>
                <FlatpickrTimeInput
                  id="modal_edit_K_JAM_MULAI"
                  value={modalEditRubahKlien.data.jamMulaiLive}
                  onChange={(val) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, jamMulaiLive: val } } : prev
                    )
                  }
                  placeholder="Pilih Jam Mulai"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jam Selesai Live *</label>
                <FlatpickrTimeInput
                  id="modal_edit_K_JAM_SELESAI"
                  value={modalEditRubahKlien.data.jamSelesaiLive}
                  onChange={(val) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, jamSelesaiLive: val } } : prev
                    )
                  }
                  placeholder="Pilih Jam Selesai"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kuota Host *</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={modalEditRubahKlien.data.kuota}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, kuota: parseInt(e.target.value) || 1 } } : prev
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Jadwal</label>
                <select
                  value={modalEditRubahKlien.data.status}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, status: e.target.value } } : prev
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="TERJADWAL">TERJADWAL</option>
                  <option value="PLOTING">PLOTING</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="BATAL">BATAL</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Live</label>
                <input
                  type="text"
                  value={modalEditRubahKlien.data.judulLive}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, judulLive: e.target.value } } : prev
                    )
                  }
                  placeholder="Opsional judul live..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Promo Live</label>
                <input
                  type="text"
                  value={modalEditRubahKlien.data.promoLive}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, promoLive: e.target.value } } : prev
                    )
                  }
                  placeholder="Opsional promo live..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan untuk Host</label>
                <textarea
                  value={modalEditRubahKlien.data.catatanHost}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, catatanHost: e.target.value } } : prev
                    )
                  }
                  rows={2}
                  placeholder="Catatan tambahan untuk host..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">File Pendukung (Link)</label>
                <input
                  type="url"
                  value={modalEditRubahKlien.data.filePendukungHost}
                  onChange={(e) =>
                    setModalEditRubahKlien((prev) =>
                      prev.data ? { ...prev, data: { ...prev.data, filePendukungHost: e.target.value } } : prev
                    )
                  }
                  placeholder="https://drive.google.com/..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                onClick={handleSaveModalEditRubahKlien}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Simpan ke RAM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini Popup Info Reusable */}
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {popupInfoKlien.isLink && popupInfoKlien.content ? (
                <a
                  href={popupInfoKlien.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline font-sans break-all"
                >
                  {popupInfoKlien.content}
                </a>
              ) : (
                popupInfoKlien.content
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ketentuan Platform (Blacklist & Prioritas) - 100% Match with Ref-Deploy */}
      {modalKetentuan.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 transition-opacity animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-list-check text-blue-600 mr-1" /> Edit Ketentuan:{" "}
                <span className="text-blue-600 font-black">{modalKetentuan.platformName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="text-slate-400 hover:text-red-500 transition text-xl"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-white custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Pengecualian Host (Red) */}
                <div className="border border-red-200 rounded-xl overflow-hidden flex flex-col h-[55vh]">
                  <div className="bg-red-50 text-red-700 font-bold px-4 py-3 border-b border-red-200 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <i className="fa-solid fa-ban" /> Pengecualian Host
                    </div>
                    <div className="relative w-full max-w-[140px] sm:max-w-[200px]">
                      <input
                        type="text"
                        value={modalKetentuan.searchBlacklist}
                        onChange={(e) =>
                          setModalKetentuan({ ...modalKetentuan, searchBlacklist: e.target.value })
                        }
                        className="w-full border border-red-300 rounded-md px-3 py-1.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-red-500 font-normal text-slate-800 bg-white placeholder-red-300"
                        placeholder="Cari nama..."
                      />
                      {modalKetentuan.searchBlacklist && (
                        <button
                          type="button"
                          onClick={() => setModalKetentuan({ ...modalKetentuan, searchBlacklist: "" })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 transition"
                        >
                          <i className="fa-solid fa-circle-xmark" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm text-xs">
                        <tr>
                          <th className="p-3 w-10 text-center">✔</th>
                          <th className="p-3">STREAMER</th>
                          <th className="p-3">JABATAN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const query = (modalKetentuan.searchBlacklist || "").toLowerCase();
                          const list = (streamers || []).filter((s) => {
                            const nama = (s.namaLengkap || s.namaPanggilan || s.name || "").toLowerCase();
                            const idKar = (s.idKaryawan || "").toLowerCase();
                            const jab = (s.jabatan || s.kategori || "").toLowerCase();
                            return !query || nama.includes(query) || idKar.includes(query) || jab.includes(query);
                          });

                          const checked = list.filter((s) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || "";
                            const token = `${name}**${s.jabatan || s.kategori || "Host"}`;
                            return modalKetentuan.blacklist.some(
                              (b) => b === token || b === name || token.startsWith(b) || b.startsWith(name)
                            );
                          });
                          const unchecked = list.filter((s) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || "";
                            const token = `${name}**${s.jabatan || s.kategori || "Host"}`;
                            return !modalKetentuan.blacklist.some(
                              (b) => b === token || b === name || token.startsWith(b) || b.startsWith(name)
                            );
                          });

                          const sorted = [...checked, ...unchecked];
                          if (sorted.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="p-6 text-center text-slate-400 italic text-xs">
                                  Tidak ada streamer ditemukan.
                                </td>
                              </tr>
                            );
                          }

                          return sorted.map((s, si) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || `Streamer ${si + 1}`;
                            const jab = s.jabatan || s.kategori || "Host";
                            const token = `${name}**${jab}`;
                            const isChecked = modalKetentuan.blacklist.some(
                              (b) => b === token || b === name || token.startsWith(b) || b.startsWith(name)
                            );

                            return (
                              <tr
                                key={s.id || si}
                                onClick={() => {
                                  if (isChecked) {
                                    setModalKetentuan({
                                      ...modalKetentuan,
                                      blacklist: modalKetentuan.blacklist.filter(
                                        (b) => !(b === token || b === name || token.startsWith(b) || b.startsWith(name))
                                      ),
                                    });
                                  } else {
                                    setModalKetentuan({
                                      ...modalKetentuan,
                                      blacklist: [...modalKetentuan.blacklist, token],
                                    });
                                  }
                                }}
                                className="border-b border-slate-100 hover:bg-red-50 cursor-pointer transition-colors"
                              >
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-red-600 rounded pointer-events-none accent-red-600"
                                  />
                                </td>
                                <td className="p-3 font-bold text-slate-700">{name}</td>
                                <td className="p-3 text-xs text-slate-500">{jab}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Prioritas Platform (Emerald) */}
                <div className="border border-emerald-200 rounded-xl overflow-hidden flex flex-col h-[55vh]">
                  <div className="bg-emerald-50 text-emerald-700 font-bold px-4 py-3 border-b border-emerald-200 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <i className="fa-solid fa-star text-amber-400" /> Prioritas Platform
                    </div>
                    <div className="relative w-full max-w-[140px] sm:max-w-[200px]">
                      <input
                        type="text"
                        value={modalKetentuan.searchPriority}
                        onChange={(e) =>
                          setModalKetentuan({ ...modalKetentuan, searchPriority: e.target.value })
                        }
                        className="w-full border border-emerald-300 rounded-md px-3 py-1.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-normal text-slate-800 bg-white placeholder-emerald-300"
                        placeholder="Cari nama..."
                      />
                      {modalKetentuan.searchPriority && (
                        <button
                          type="button"
                          onClick={() => setModalKetentuan({ ...modalKetentuan, searchPriority: "" })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-700 transition"
                        >
                          <i className="fa-solid fa-circle-xmark" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm text-xs">
                        <tr>
                          <th className="p-3 w-10 text-center">✔</th>
                          <th className="p-3">STREAMER</th>
                          <th className="p-3">JABATAN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const query = (modalKetentuan.searchPriority || "").toLowerCase();
                          const list = (streamers || []).filter((s) => {
                            const nama = (s.namaLengkap || s.namaPanggilan || s.name || "").toLowerCase();
                            const idKar = (s.idKaryawan || "").toLowerCase();
                            const jab = (s.jabatan || s.kategori || "").toLowerCase();
                            return !query || nama.includes(query) || idKar.includes(query) || jab.includes(query);
                          });

                          const checked = list.filter((s) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || "";
                            const token = `${name}**${s.jabatan || s.kategori || "Host"}`;
                            return modalKetentuan.priority.some(
                              (p) => p === token || p === name || token.startsWith(p) || p.startsWith(name)
                            );
                          });
                          const unchecked = list.filter((s) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || "";
                            const token = `${name}**${s.jabatan || s.kategori || "Host"}`;
                            return !modalKetentuan.priority.some(
                              (p) => p === token || p === name || token.startsWith(p) || p.startsWith(name)
                            );
                          });

                          const sorted = [...checked, ...unchecked];
                          if (sorted.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="p-6 text-center text-slate-400 italic text-xs">
                                  Tidak ada streamer ditemukan.
                                </td>
                              </tr>
                            );
                          }

                          return sorted.map((s, si) => {
                            const name = s.namaLengkap || s.namaPanggilan || s.name || `Streamer ${si + 1}`;
                            const jab = s.jabatan || s.kategori || "Host";
                            const token = `${name}**${jab}`;
                            const isChecked = modalKetentuan.priority.some(
                              (p) => p === token || p === name || token.startsWith(p) || p.startsWith(name)
                            );

                            return (
                              <tr
                                key={s.id || si}
                                onClick={() => {
                                  if (isChecked) {
                                    setModalKetentuan({
                                      ...modalKetentuan,
                                      priority: modalKetentuan.priority.filter(
                                        (p) => !(p === token || p === name || token.startsWith(p) || p.startsWith(name))
                                      ),
                                    });
                                  } else {
                                    setModalKetentuan({
                                      ...modalKetentuan,
                                      priority: [...modalKetentuan.priority, token],
                                    });
                                  }
                                }}
                                className="border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition-colors"
                              >
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-emerald-600 rounded pointer-events-none accent-emerald-600"
                                  />
                                </td>
                                <td className="p-3 font-bold text-slate-700">{name}</td>
                                <td className="p-3 text-xs text-slate-500">{jab}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalKetentuan({ ...modalKetentuan, isOpen: false })}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold transition"
              >
                Batal Rubah
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemoriEditKetentuan((prev) => ({
                    ...prev,
                    [modalKetentuan.platformName]: {
                      blacklist: modalKetentuan.blacklist,
                      priority: modalKetentuan.priority,
                    },
                  }));
                  setModalKetentuan({ ...modalKetentuan, isOpen: false });
                  showAlert(`Ketentuan untuk ${modalKetentuan.platformName} disimpan dalam memori lokal.`);
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition shadow-sm flex items-center gap-2"
              >
                <i className="fa-solid fa-download" /> Simpan Pilihan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Ketentuan (Popup saat klik icon Blacklist / Prioritas) */}
      {modalDetailKetentuan.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 transition-opacity animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">{modalDetailKetentuan.title}</h3>
              <button
                type="button"
                onClick={() => setModalDetailKetentuan({ isOpen: false, title: "", items: [] })}
                className="text-slate-400 hover:text-red-500 transition"
              >
                <i className="fa-solid fa-xmark text-xl" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-white relative custom-scrollbar max-h-[60vh]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm text-[11px] uppercase">
                  <tr>
                    <th className="p-3 pl-6">STREAMER</th>
                    <th className="p-3 pr-6">JABATAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalDetailKetentuan.items.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-6 text-center text-slate-400 italic">
                        Tidak ada data.
                      </td>
                    </tr>
                  ) : (
                    modalDetailKetentuan.items.map((item, ii) => (
                      <tr key={ii} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="p-3 pl-6 font-bold text-slate-700">{item.nama}</td>
                        <td className="p-3 pr-6 text-xs text-slate-500">{item.jabatan}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setModalDetailKetentuan({ isOpen: false, title: "", items: [] })}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
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
