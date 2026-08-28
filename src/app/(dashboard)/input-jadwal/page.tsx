"use client";

import React, { useEffect, useState } from "react";
import ScheduleCalendar from "@/components/schedule-calendar";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { useAlert } from "@/components/ui/custom-alert";

const PLATFORMS = ["Shopee Live", "TikTok Shop", "Tokopedia Live", "Lazada Live", "Instagram Live"];
const STUDIOS = [
  { name: "Studio Timoho 1", cabang: "Timoho", no: "01" },
  { name: "Studio Timoho 2", cabang: "Timoho", no: "02" },
  { name: "Studio Berbah 1", cabang: "Berbah", no: "01" },
  { name: "Studio Berbah 2", cabang: "Berbah", no: "02" },
  { name: "Studio Wiyoro 1", cabang: "Wiyoro", no: "01" },
];

interface ScheduleFormItem {
  id: number;
  idJadwal: string;
  tanggal: string;
  platform: string;
  clientId?: string;
  streamerKaryawanId?: string;
  streamerId?: string;
  streamerNama?: string;
  cabangStudio: string;
  nomorStudio: string;
  device?: string;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  durasi?: string;
  kuota?: number;
  filePendukungHost?: string;
  catatanHost?: string;
  otsKaryawanId?: string;
  otsId?: string;
  otsNama?: string;
  shiftOts?: string;
  filesOts?: string[];
  judulLive?: string;
  promoLive?: string;
  filePendukungOts?: string;
  catatanOts?: string;
  produkPrioritas?: string | string[];
  targetHost?: string | string[];
  blacklistHost?: string | string[];
  catatan?: string;
}

function calculateEndTime(startStr: string): string {
  if (!startStr || !startStr.includes(":")) return "";
  const [h, m] = startStr.split(":").map(Number);
  const endH = ((isNaN(h) ? 0 : h) + 2) % 24;
  return `${String(endH).padStart(2, "0")}:${String(isNaN(m) ? 0 : m).padStart(2, "0")}`;
}

function applyShiftOts(shiftVal: string): { masuk: string; keluar: string } {
  if (shiftVal === "07:00-15:00") return { masuk: "07:00", keluar: "15:00" };
  if (shiftVal === "15:00-23:00") return { masuk: "15:00", keluar: "23:00" };
  if (shiftVal === "23:00-07:00") return { masuk: "23:00", keluar: "07:00" };
  return { masuk: "", keluar: "" };
}

export default function InputJadwalPage() {
  // Global Data States
  const [streamers, setStreamers] = useState<any[]>([]);
  const [otsStaff, setOtsStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentJadwal, setRecentJadwal] = useState<any[]>([]);
  const [allJadwal, setAllJadwal] = useState<any[]>([]);

  const { showAlert } = useAlert();

  // Feedback States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Main 7 Tabs Navigation (100% Match with ref-deploy/input-jadwal.html)
  const [mainTab, setMainTab] = useState<
    "streamer" | "ots" | "rubah" | "klien" | "marketplace" | "hybrid" | "kendali"
  >("streamer");

  // Crash State
  const [isStreamerCrashVerified, setIsStreamerCrashVerified] = useState(false);
  const [isOtsCrashVerified, setIsOtsCrashVerified] = useState(false);
  const [isKlienCrashVerified, setIsKlienCrashVerified] = useState(false);
  const [isMarketplaceCrashVerified, setIsMarketplaceCrashVerified] = useState(false);
  const [modalCrashData, setModalCrashData] = useState<{
    isOpen: boolean;
    isSafe: boolean;
    title: string;
    conflicts: any[];
  }>({
    isOpen: false,
    isSafe: false,
    title: "",
    conflicts: [],
  });

  // --------------------------------------------------------------------------
  // TAB 1: JADWAL STREAMER STATES
  // --------------------------------------------------------------------------
  const [streamerSubTab, setStreamerSubTab] = useState<"form" | "info">("form");
  const [streamerForms, setStreamerForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: `STR/${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}/${Math.floor(100 + Math.random() * 900)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "Shopee Live",
      streamerKaryawanId: "",
      streamerId: "",
      streamerNama: "",
      cabangStudio: "Timoho",
      nomorStudio: "Studio 1",
      device: "Tidak Pakai",
      jamMulaiLive: "10:00",
      jamSelesaiLive: "12:00",
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
  const [tagFilter, setTagFilter] = useState("");
  const [streamerStats, setStreamerStats] = useState<any>(null);
  const [blacklistWarning, setBlacklistWarning] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [batchText, setBatchText] = useState("");

  // Subtab 2: Info Streamer
  const [infoStreamerData, setInfoStreamerData] = useState<any>(null);
  const [searchInfoStreamer, setSearchInfoStreamer] = useState("");
  const [showInfoStreamerDropdown, setShowInfoStreamerDropdown] = useState(false);
  const [filterPeriodeInfo, setFilterPeriodeInfo] = useState<"ALL" | "EXACT" | "RANGE">("ALL");
  const [filterTglSatuInfo, setFilterTglSatuInfo] = useState("");
  const [filterTglRangeInfo, setFilterTglRangeInfo] = useState("");
  const [filterTglRangeStart, setFilterTglRangeStart] = useState("");
  const [filterTglRangeEnd, setFilterTglRangeEnd] = useState("");
  const [infoChanges, setInfoChanges] = useState<Record<string, any>>({});
  const [savingInfoStreamer, setSavingInfoStreamer] = useState(false);
  const [showEditJadwalDropdown, setShowEditJadwalDropdown] = useState(false);

  // Modals for Subtab Informasi Streamer
  const [modalDetailLibur, setModalDetailLibur] = useState<{ tanggal: string; list: { id: string; nama: string }[]; kuota: number; sisa: number } | null>(null);
  const [modalDetailRequest, setModalDetailRequest] = useState<{ tanggal: string; sessions: Record<string, { list: { id: string; nama: string }[]; kuota: number; sisa: number }> } | null>(null);
  const [modalInfoKuota, setModalInfoKuota] = useState<{ title: string; tanggal: string; kuota: string | number; sisa: string | number; breakdown?: any } | null>(null);
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
  const [pageInfoStreamer, setPageInfoStreamer] = useState(1);

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
        LIBUR: rowData.LIBUR.map((s: any) => `${s.id} | ${s.nama}`),
        REQ_00_08: rowData.REQ_00_08.map((s: any) => `${s.id} | ${s.nama}`),
        REQ_08_16: rowData.REQ_08_16.map((s: any) => `${s.id} | ${s.nama}`),
        REQ_16_00: rowData.REQ_16_00.map((s: any) => `${s.id} | ${s.nama}`),
      });
    }
    setCariLiburInfo("");
    setCariReq0008("");
    setCariReq0816("");
    setCariReq1600("");
    setEditInfoDate(tgl);
  }

  function toggleCheckboxInfoState(key: "LIBUR" | "REQ_00_08" | "REQ_08_16" | "REQ_16_00", val: string) {
    setStateEditInfo((prev) => {
      const list = [...prev[key]];
      const idx = list.indexOf(val);
      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        if (key === "LIBUR" && list.length >= 20) {
          showAlert("⚠️ Maksimal Streamer yang dapat Libur dalam 1 hari adalah 20 Orang sesuai batasan sel Kolom Database.");
          return prev;
        }
        list.push(val);
      }
      return { ...prev, [key]: list };
    });
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

  // --------------------------------------------------------------------------
  // TAB 2: JADWAL OTS STATES
  // --------------------------------------------------------------------------
  const [otsForms, setOtsForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: `OTS/${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}/${Math.floor(100 + Math.random() * 900)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "Shopee Live",
      clientId: "",
      streamerKaryawanId: "",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T14:00`,
      jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T17:00`,
      judulLive: "Live OTS",
      produkPrioritas: "",
      promoLive: "",
    },
  ]);

  // --------------------------------------------------------------------------
  // TAB 3: RUBAH JADWAL STATES
  // --------------------------------------------------------------------------
  const [tipeRubah, setTipeRubah] = useState<"STREAMER" | "OTS">("STREAMER");
  const [filterTanggalRubah, setFilterTanggalRubah] = useState("");
  const [searchEditId, setSearchEditId] = useState("");
  const [selectedEditJadwal, setSelectedEditJadwal] = useState<any>(null);
  const [editRows, setEditRows] = useState<Array<{ field: string; value: string }>>([
    { field: "", value: "" },
  ]);
  const [savingEditJadwal, setSavingEditJadwal] = useState(false);

  // --------------------------------------------------------------------------
  // TAB 4: JADWAL KLIEN STATES (5 Subtabs)
  // --------------------------------------------------------------------------
  const [klienSubTab, setKlienSubTab] = useState<"formulir" | "rubah" | "ketentuan" | "export" | "import">("formulir");
  const [klienForms, setKlienForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: `JDK/${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}/${Math.floor(100 + Math.random() * 900)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "Shopee Live",
      clientId: "",
      streamerKaryawanId: "",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T10:00`,
      jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T13:00`,
      judulLive: "",
      produkPrioritas: "",
      promoLive: "",
    },
  ]);
  const [filterPeriodeKlien, setFilterPeriodeKlien] = useState("default");
  const [filterStatusKlien, setFilterStatusKlien] = useState("");
  const [filterPlatformKlien, setFilterPlatformKlien] = useState("");
  const [searchKetentuanPlatform, setSearchKetentuanPlatform] = useState("");
  const [exportTanggalKlien, setExportTanggalKlien] = useState(new Date().toISOString().slice(0, 10));
  const [exportPreviewData, setExportPreviewData] = useState<any[]>([]);
  const [importModePloting, setImportModePloting] = useState<"baru" | "revisi">("baru");
  const [importMetodePloting, setImportMetodePloting] = useState<"excel" | "link">("excel");

  // --------------------------------------------------------------------------
  // TAB 5: MARKETPLACE STATES
  // --------------------------------------------------------------------------
  const [marketplaceForms, setMarketplaceForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: `MKT/${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}/${Math.floor(100 + Math.random() * 900)}`,
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "TikTok Shop",
      clientId: "",
      streamerKaryawanId: "",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T18:00`,
      jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T21:00`,
      judulLive: "Pengajuan Campaign Marketplace",
      produkPrioritas: "",
      promoLive: "",
      catatan: "",
    },
  ]);

  // --------------------------------------------------------------------------
  // TAB 6: HYBRID LIVE STATES
  // --------------------------------------------------------------------------
  const [hybridSubTab, setHybridSubTab] = useState<"export" | "import">("export");
  const [hybridImportMode, setHybridImportMode] = useState<"baru" | "revisi">("baru");
  const [hybridImportMethod, setHybridImportMethod] = useState<"excel" | "link">("excel");
  const [hybridLink, setHybridLink] = useState("");
  const [hybridOldId, setHybridOldId] = useState("");

  // --------------------------------------------------------------------------
  // TAB 7: KENDALI FORM STATES
  // --------------------------------------------------------------------------
  const [kendaliConfig, setKendaliConfig] = useState<any>(null);
  const [kendaliLoading, setKendaliLoading] = useState(false);
  const [quotaForm, setQuotaForm] = useState({ defaultKuotaLibur: 4, defaultKuotaShift: 4 });

  // Monitoring Table States
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(5);

  // Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignJadwalId, setAssignJadwalId] = useState("");
  const [assignStreamerId, setAssignStreamerId] = useState("");

  // ==========================================================================
  // INITIAL DATA FETCH
  // ==========================================================================
  useEffect(() => {
    fetchData();
    loadKendaliConfig();
    loadInfoStreamer();
  }, []);

  useEffect(() => {
    if (mainTab === "streamer" && streamerSubTab === "info") {
      loadInfoStreamer();
    }
  }, [mainTab, streamerSubTab]);

  async function fetchData() {
    try {
      const [empRes, clientRes, jadwalRes] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/jadwal").then((r) => r.json()),
      ]);

      if (empRes.status === "success") {
        const all = empRes.data || [];
        const strList = all.filter((e: any) =>
          e.kategori?.toUpperCase() === "STREAMER" ||
          e.jabatan?.toLowerCase().includes("streamer") ||
          e.jabatan?.toLowerCase().includes("host") ||
          e.user?.role === "STREAMER"
        );
        const otsList = all.filter((e: any) =>
          e.kategori?.toUpperCase() === "OTS" ||
          e.jabatan?.toLowerCase().includes("ots") ||
          e.kategori?.toUpperCase() === "STAFF" ||
          e.kategori?.toUpperCase() === "OFFICE"
        );
        setStreamers(strList.length > 0 ? strList : all);
        setOtsStaff(otsList.length > 0 ? otsList : all);
      }
      if (clientRes.status === "success") setClients(clientRes.data);
      if (jadwalRes.status === "success") {
        setAllJadwal(jadwalRes.data);
        setRecentJadwal(jadwalRes.data);
      }
    } catch {
      // ignore
    }
  }

  async function loadKendaliConfig() {
    try {
      const res = await fetch("/api/scheduler-tools?view=kendali-form").then((r) => r.json());
      if (res.status === "success") {
        setKendaliConfig(res.data);
        setQuotaForm({
          defaultKuotaLibur: res.data.defaultKuotaLibur ?? 4,
          defaultKuotaShift: res.data.defaultKuotaShift ?? 4,
        });
      }
    } catch {
      // ignore
    }
  }

  async function loadInfoStreamer() {
    try {
      const res = await fetch("/api/scheduler-tools?view=info-streamer").then((r) => r.json());
      if (res.status === "success") {
        setInfoStreamerData(res.data);
      }
    } catch {
      // ignore
    }
  }

  // ==========================================================================
  // HELPER GENERATORS
  // ==========================================================================
  function generateNewScheduleId(prefix: "STR" | "OTS" | "JDK" | "MKT", dateStr?: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}/${yy}${mm}${dd}/${rand}`;
  }

  // ==========================================================================
  // BEBAS CRASH VALIDATORS
  // ==========================================================================
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
          if (f1.streamerKaryawanId && f2.streamerKaryawanId && f1.streamerKaryawanId === f2.streamerKaryawanId) {
            conflicts.push({
              type: `Host / Streamer (${f1.streamerNama || "Streamer"})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${f1.tanggal} [${s1} - ${e1}] - ${f1.platform}`,
              info2: `Tgl ${f2.tanggal} [${s2} - ${e2}] - ${f2.platform}`,
            });
          }
          if (f1.cabangStudio === f2.cabangStudio && f1.nomorStudio && f1.nomorStudio === f2.nomorStudio && f1.nomorStudio !== "Pilih Studio") {
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

  function checkBebasCrashOts() {
    const conflicts: any[] = [];
    for (let i = 0; i < otsForms.length; i++) {
      const d1 = otsForms[i];
      if (!d1.tanggal || !d1.jamMulaiLive || !d1.jamSelesaiLive) {
        showAlert("⚠️ Pastikan Tanggal, Jam Masuk, dan Jam Keluar terisi di semua form OTS.");
        return;
      }
      for (let j = i + 1; j < otsForms.length; j++) {
        const d2 = otsForms[j];
        if (d1.tanggal !== d2.tanggal) continue;

        const s1 = d1.jamMulaiLive;
        const e1 = d1.jamSelesaiLive;
        const s2 = d2.jamMulaiLive;
        const e2 = d2.jamSelesaiLive;
        const isOverlap = s1 < e2 && s2 < e1;

        if (isOverlap) {
          if (d1.otsKaryawanId && d2.otsKaryawanId && d1.otsKaryawanId === d2.otsKaryawanId) {
            conflicts.push({
              type: `Personel OTS (${d1.otsNama || "Staff"})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${d1.tanggal} [${s1} - ${e1}] - Cabang: ${d1.cabangStudio}`,
              info2: `Tgl ${d2.tanggal} [${s2} - ${e2}] - Cabang: ${d2.cabangStudio}`,
            });
          }
        }
      }
    }

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

  // ==========================================================================
  // SUBMIT HANDLERS
  // ==========================================================================
  async function handleToggleFitur(fitur: "LIBUR" | "SHIFT", status: "ON" | "OFF") {
    setKendaliLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-fitur", fitur, status }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`✅ Pengaturan ${fitur === "LIBUR" ? "Pengajuan Libur" : "Pengajuan Sesi Live"} berhasil diubah ke status ${status}!`);
        loadKendaliConfig();
      } else {
        setError(d.message ?? "Gagal mengubah status fitur");
      }
    } catch {
      setError("Koneksi gagal saat mengubah status fitur");
    } finally {
      setKendaliLoading(false);
    }
  }

  async function handleSaveQuota(e: React.FormEvent) {
    e.preventDefault();
    setKendaliLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-quota", ...quotaForm }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Kuota default Libur dan Sesi Live berhasil diperbarui!");
        loadKendaliConfig();
        loadInfoStreamer();
      } else {
        setError(d.message ?? "Gagal menyimpan kuota");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setKendaliLoading(false);
    }
  }

  // Submit Streamer Single/Multi
  async function submitStreamerSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
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
      // Reset forms
      setStreamerForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("STR"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "Shopee Live",
          streamerKaryawanId: "",
          streamerId: "",
          streamerNama: "",
          cabangStudio: "Timoho",
          nomorStudio: "Studio 1",
          device: "Tidak Pakai",
          jamMulaiLive: "10:00",
          jamSelesaiLive: "12:00",
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

  // Submit OTS Schedules
  async function submitOtsSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const item of otsForms) {
        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("OTS", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          otsKaryawanId: item.otsKaryawanId || null,
          idOts: item.otsId || null,
          cabangStudio: item.cabangStudio,
          jamMulaiLive: item.jamMulaiLive.includes("T") ? item.jamMulaiLive : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`,
          jamSelesaiLive: item.jamSelesaiLive.includes("T") ? item.jamSelesaiLive : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`,
          catatanOts: item.catatanOts || null,
          filePendukungOtsDriveId: (item.filesOts || []).filter(Boolean).join(", ") || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`✅ Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      setIsOtsCrashVerified(false);
      setOtsForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("OTS"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "Shopee Live",
          cabangStudio: "Timoho",
          nomorStudio: "Studio 1",
          otsKaryawanId: "",
          otsId: "",
          otsNama: "",
          shiftOts: "",
          jamMulaiLive: "07:00",
          jamSelesaiLive: "15:00",
          catatanOts: "",
          filesOts: [""],
        },
      ]);
      fetchData();
    } catch {
      setError("Terjadi kesalahan koneksi saat menyimpan Jadwal OTS.");
    } finally {
      setLoading(false);
    }
  }

  // Submit Klien Direct Schedules
  async function submitKlienSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const item of klienForms) {
        if (!item.clientId) {
          setError("Silakan pilih Brand Klien pada formulir.");
          setLoading(false);
          return;
        }
        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, status: "TERJADWAL" }),
        });
      }
      setSuccess(`✅ Berhasil menerbitkan ${klienForms.length} Jadwal Klien Langsung (TERJADWAL)!`);
      setKlienForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("JDK"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "Shopee Live",
          clientId: "",
          streamerKaryawanId: "",
          cabangStudio: "Timoho",
          nomorStudio: "01",
          jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T10:00`,
          jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T13:00`,
          judulLive: "",
          produkPrioritas: "",
          promoLive: "",
        },
      ]);
      fetchData();
    } catch {
      setError("Gagal menyimpan Jadwal Klien.");
    } finally {
      setLoading(false);
    }
  }

  // Submit Marketplace
  async function submitMarketplaceSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const item of marketplaceForms) {
        if (!item.clientId) {
          setError("Silakan pilih Brand Klien untuk pengajuan marketplace.");
          setLoading(false);
          return;
        }
        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, status: "TERJADWAL" }),
        });
      }
      setSuccess(`✅ Berhasil mengirimkan ${marketplaceForms.length} Pengajuan Jadwal Marketplace!`);
      setMarketplaceForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("MKT"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "TikTok Shop",
          clientId: "",
          streamerKaryawanId: "",
          cabangStudio: "Timoho",
          nomorStudio: "01",
          jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T18:00`,
          jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T21:00`,
          judulLive: "Pengajuan Campaign Marketplace",
          produkPrioritas: "",
          promoLive: "",
        },
      ]);
      fetchData();
    } catch {
      setError("Gagal mengirimkan pengajuan marketplace.");
    } finally {
      setLoading(false);
    }
  }

  // Select target schedule for Edit (Tab 3)
  function handleSelectEditJadwal() {
    if (!searchEditId.trim()) {
      showAlert("⚠️ Silakan ketik atau pilih ID Jadwal / Nama terlebih dahulu.");
      return;
    }
    const q = searchEditId.toLowerCase().trim();
    const target = allJadwal.find((j) => {
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
        j.client?.namaClient?.toLowerCase().includes(q)
      );
    });

    if (target) {
      setSelectedEditJadwal(target);
      setEditRows([
        { field: "PLATFORM", value: target.platform || "Shopee Live" },
        { field: "STREAMER", value: target.streamerKaryawanId || "" },
      ]);
    } else {
      showAlert("⚠️ Jadwal target tidak ditemukan untuk tanggal/filter yang dipilih.");
    }
  }

  // Save Edit Schedule
  async function handleSaveEditJadwal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEditJadwal) return;
    setSavingEditJadwal(true);

    try {
      const payload: any = { ...selectedEditJadwal };
      for (const row of editRows) {
        if (row.field === "PLATFORM") payload.platform = row.value;
        if (row.field === "STREAMER") payload.streamerKaryawanId = row.value;
        if (row.field === "CABANG") payload.cabangStudio = row.value;
        if (row.field === "STUDIO") payload.nomorStudio = row.value;
        if (row.field === "STATUS") payload.status = row.value;
        if (row.field === "JUDUL") payload.judulLive = row.value;
      }

      const res = await fetch(`/api/jadwal?id=${selectedEditJadwal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success" || res.ok) {
        showAlert("✅ Perubahan jadwal berhasil disimpan ke database!");
        setSelectedEditJadwal(null);
        setSearchEditId("");
        fetchData();
      } else {
        showAlert(`❌ Gagal mengubah jadwal: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat menyimpan perubahan.");
    } finally {
      setSavingEditJadwal(false);
    }
  }

  // Assign Streamer Modal Submit
  async function handleAssignSubmit() {
    if (!assignJadwalId || !assignStreamerId) return;
    const target = allJadwal.find((j) => j.id === assignJadwalId);
    if (!target) return;
    setLoading(true);
    try {
      const payload = {
        ...target,
        streamerKaryawanId: assignStreamerId,
      };
      const res = await fetch(`/api/jadwal?id=${assignJadwalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success" || res.ok) {
        setSuccess("✅ Streamer berhasil di-assign ke jadwal!");
        setAssignModalOpen(false);
        fetchData();
      } else {
        setError(d.message ?? "Gagal assign streamer");
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat assign streamer.");
    } finally {
      setLoading(false);
    }
  }

  // Crash Simulation
  function handleCheckBebasCrash() {
    showAlert("🛡️ Validasi Bebas Crash: Tidak ditemukan bentrok jadwal / crash pada slot studio dan host yang dipilih. Aman untuk disimpan!");
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition";
  const dateInputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition cursor-pointer";
  const selectCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 p-4 sm:p-6">
      {/* Header Halaman */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-black">Kelola Jadwal Siaran</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          Buat jadwal baru untuk Streamer, jadwal OTS, atau lakukan pengajuan Marketplace.
        </p>
      </div>

      {/* Navigasi 7 Tab Utama Sesuai ref-deploy/input-jadwal.html */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {[
          { id: "streamer", label: "Jadwal Streamer", icon: "fa-video" },
          { id: "ots", label: "Jadwal OTS", icon: "fa-headphones" },
          { id: "rubah", label: "Rubah Jadwal", icon: "fa-pen-to-square" },
          { id: "klien", label: "Jadwal Klien", icon: "fa-user-tie" },
          { id: "marketplace", label: "Marketplace", icon: "fa-store" },
          { id: "hybrid", label: "Hybrid Live", icon: "fa-file-import" },
          { id: "kendali", label: "Kendali Form", icon: "fa-toggle-on" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 border ${
              mainTab === tab.id
                ? "bg-[#941A0B] text-white border-[#941A0B] shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {success && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-red-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: JADWAL STREAMER                                                    */}
      {/* ========================================================================= */}
      {mainTab === "streamer" && (
        <div className="space-y-6">
          {/* Subtab Navigasi Streamer: Formulir vs Informasi Streamer */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setStreamerSubTab("form")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                streamerSubTab === "form" ? "border-[#941A0B] text-[#941A0B]" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Formulir
            </button>
            <button
              type="button"
              onClick={() => setStreamerSubTab("info")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                streamerSubTab === "info" ? "border-[#941A0B] text-[#941A0B]" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Informasi Streamer
            </button>
          </div>

          {/* SUB-VIEW 1: FORMULIR JADWAL STREAMER */}
          {streamerSubTab === "form" && (
            <form onSubmit={submitStreamerSchedules} className="space-y-6">
              <div className="space-y-4">
                {streamerForms.map((item, idx) => {
                  const headTitle = item.tanggal && item.streamerNama
                    ? `${item.tanggal} | ${item.platform} | ${item.streamerNama}`
                    : `Jadwal Streamer Baru`;

                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                      {/* Header Card */}
                      <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                            #{idx + 1}
                          </div>
                          <h3 className="font-bold text-slate-800 text-sm leading-tight">
                            {headTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {streamerForms.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setStreamerForms(streamerForms.filter((_, i) => i !== idx));
                                setIsStreamerCrashVerified(false);
                              }}
                              className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                              title="Hapus Form"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Body Card */}
                      <div className="p-5 sm:p-6 space-y-6 block">
                        {/* Row 1: Tanggal & Platform */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Live *</label>
                            <input
                              type="date"
                              value={item.tanggal}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => {
                                const v = e.target.value;
                                const updated = [...streamerForms];
                                updated[idx].tanggal = v;
                                updated[idx].idJadwal = generateNewScheduleId("STR", v);
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Platform Client *</label>
                            <select
                              value={item.platform}
                              onChange={(e) => {
                                const updated = [...streamerForms];
                                updated[idx].platform = e.target.value;
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                              required
                            >
                              {PLATFORMS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Cari Host Streamer, ID Host (Auto), Nama Streamer */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cari Host Streamer *</label>
                            <select
                              value={item.streamerKaryawanId || ""}
                              onChange={(e) => {
                                const sId = e.target.value;
                                const sObj = streamers.find((s) => s.id === sId);
                                const updated = [...streamerForms];
                                updated[idx].streamerKaryawanId = sId;
                                updated[idx].streamerId = sObj?.idKaryawan || "";
                                updated[idx].streamerNama = sObj?.namaLengkap || "";
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                              required
                            >
                              <option value="">-- Pilih / Ketik Nama Host --</option>
                              {streamers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.idKaryawan} - {s.namaLengkap}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">ID Host (Auto)</label>
                              <input
                                type="text"
                                value={item.streamerId || ""}
                                readOnly
                                placeholder="ID Auto"
                                className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Streamer</label>
                              <input
                                type="text"
                                value={item.streamerNama || ""}
                                readOnly
                                placeholder="Nama Host"
                                className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Cabang Studio, Nomor Studio, Device */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cabang Studio *</label>
                            <select
                              value={item.cabangStudio}
                              onChange={(e) => {
                                const updated = [...streamerForms];
                                updated[idx].cabangStudio = e.target.value;
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                              required
                            >
                              <option value="Timoho">Timoho</option>
                              <option value="Berbah">Berbah</option>
                              <option value="Wiyoro">Wiyoro</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor Studio</label>
                            <select
                              value={item.nomorStudio}
                              onChange={(e) => {
                                const updated = [...streamerForms];
                                updated[idx].nomorStudio = e.target.value;
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                            >
                              <option value="">Pilih Studio</option>
                              {["Studio 1", "Studio 2", "Studio 3", "Studio 4", "Studio 5", "Studio 6", "Studio 7", "Studio 8"].map((st) => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Device</label>
                            <select
                              value={item.device || "Tidak Pakai"}
                              onChange={(e) => {
                                const updated = [...streamerForms];
                                updated[idx].device = e.target.value;
                                setStreamerForms(updated);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                            >
                              <option value="Tidak Pakai">Tidak Pakai</option>
                              <option value="Iphone XR Merah">Iphone XR Merah</option>
                              <option value="Iphone XR Putih">Iphone XR Putih</option>
                              <option value="Iphone XR Orange">Iphone XR Orange</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 4: Jam Mulai, Jam Selesai, File Pendukung Host, Catatan Host */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Mulai *</label>
                              <input
                                type="text"
                                value={item.jamMulaiLive}
                                placeholder="mis. 10:00"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = [...streamerForms];
                                  updated[idx].jamMulaiLive = val;
                                  if (val.includes(":") && val.length >= 4) {
                                    updated[idx].jamSelesaiLive = calculateEndTime(val);
                                  }
                                  setStreamerForms(updated);
                                  setIsStreamerCrashVerified(false);
                                }}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Selesai *</label>
                              <input
                                type="text"
                                value={item.jamSelesaiLive}
                                placeholder="mis. 12:00"
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].jamSelesaiLive = e.target.value;
                                  setStreamerForms(updated);
                                  setIsStreamerCrashVerified(false);
                                }}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Pendukung Host</label>
                              <input
                                type="text"
                                value={item.filePendukungHost || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].filePendukungHost = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Link dokumen Host..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Host</label>
                              <textarea
                                rows={1}
                                value={item.catatanHost || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].catatanHost = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Opsional..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 5: Cari Staff OTS (Pendamping) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-b border-slate-100 py-5 bg-blue-50/30 -mx-5 px-5 sm:-mx-6 sm:px-6 rounded-xl">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cari Staff OTS (Pendamping)</label>
                            <select
                              value={item.otsKaryawanId || ""}
                              onChange={(e) => {
                                const oId = e.target.value;
                                const oObj = otsStaff.find((o) => o.id === oId);
                                const updated = [...streamerForms];
                                updated[idx].otsKaryawanId = oId;
                                updated[idx].otsId = oObj?.idKaryawan || "";
                                updated[idx].otsNama = oObj?.namaLengkap || "";
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                            >
                              <option value="">Kosongkan jika tidak ada OTS...</option>
                              {otsStaff.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.idKaryawan} - {o.namaLengkap}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">ID OTS</label>
                              <input
                                type="text"
                                value={item.otsId || ""}
                                readOnly
                                placeholder="ID OTS"
                                className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama OTS</label>
                              <input
                                type="text"
                                value={item.otsNama || ""}
                                readOnly
                                placeholder="Nama OTS"
                                className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 6: Judul Live, Promo Live, File OTS, Catatan OTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Live</label>
                              <input
                                type="text"
                                value={item.judulLive || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].judulLive = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Judul streaming..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Promo Live</label>
                              <textarea
                                rows={2}
                                value={item.promoLive || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].promoLive = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Detail promo..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Pendukung OTS</label>
                              <input
                                type="text"
                                value={item.filePendukungOts || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].filePendukungOts = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Paste link dokumen OTS..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan OTS</label>
                              <textarea
                                rows={2}
                                value={item.catatanOts || ""}
                                onChange={(e) => {
                                  const updated = [...streamerForms];
                                  updated[idx].catatanOts = e.target.value;
                                  setStreamerForms(updated);
                                }}
                                placeholder="Instruksi untuk OTS..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (streamerForms.length >= 100) return;
                    setStreamerForms([
                      ...streamerForms,
                      {
                        id: Date.now(),
                        idJadwal: generateNewScheduleId("STR"),
                        tanggal: new Date().toISOString().slice(0, 10),
                        platform: "Shopee Live",
                        streamerKaryawanId: "",
                        streamerId: "",
                        streamerNama: "",
                        cabangStudio: "Timoho",
                        nomorStudio: "Studio 1",
                        device: "Tidak Pakai",
                        jamMulaiLive: "10:00",
                        jamSelesaiLive: "12:00",
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
                  }}
                  className="w-full sm:w-auto text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-plus" /> Tambah Jadwal Streamer (Maks 100)
                </button>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={checkBebasCrashStreamer}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    <i className="fa-solid fa-shield-halved" /> Bebas Crash
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !isStreamerCrashVerified}
                    className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition flex items-center justify-center gap-2 text-sm ${
                      isStreamerCrashVerified && !loading
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                    }`}
                  >
                    <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SUB-VIEW 2: INFORMASI STREAMER (Match ref-deploy/input-jadwal.html) */}
          {streamerSubTab === "info" && (
            <div className="space-y-4">
              {/* Filter Card */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="bg-red-100 text-[#941A0B] w-10 h-10 rounded-full flex items-center justify-center text-lg">
                    <i className="fa-solid fa-calendar-check" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-800 leading-tight text-base">Informasi Libur & Request Sesi Live</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Kelola data libur dan request secara manual</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  {/* Kolom Kiri: Periode Waktu */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Periode Waktu
                    </label>
                    <select
                      id="filterPeriodeInfoStreamer"
                      value={filterPeriodeInfo}
                      onChange={(e) => setFilterPeriodeInfo(e.target.value as any)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none font-medium mb-2 bg-white"
                    >
                      <option value="ALL">Semua Tanggal</option>
                      <option value="EXACT">Tanggal Spesifik</option>
                      <option value="RANGE">Rentang Tanggal</option>
                    </select>

                    {filterPeriodeInfo === "EXACT" && (
                      <FlatpickrPicker
                        id="filterTglSatuInfoStreamer"
                        value={filterTglSatuInfo}
                        placeholder="Pilih Tanggal..."
                        options={{ mode: "single", dateFormat: "Y-m-d" }}
                        onChange={(dateStr) => setFilterTglSatuInfo(dateStr)}
                      />
                    )}

                    {filterPeriodeInfo === "RANGE" && (
                      <FlatpickrPicker
                        id="filterTglRangeInfoStreamer"
                        value={filterTglRangeInfo}
                        placeholder="Pilih Rentang..."
                        options={{ mode: "range", dateFormat: "Y-m-d" }}
                        onChange={(dateStr, dates) => {
                          setFilterTglRangeInfo(dateStr);
                          if (dates.length === 2) {
                            setFilterTglRangeStart(dates[0].toISOString().slice(0, 10));
                            setFilterTglRangeEnd(dates[1].toISOString().slice(0, 10));
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Kolom Kanan: Cari Streamer / ID Karyawan dengan Dropdown Saran */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Cari Streamer / ID Karyawan
                    </label>
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={searchInfoStreamer}
                        onFocus={() => setShowInfoStreamerDropdown(true)}
                        onChange={(e) => {
                          setSearchInfoStreamer(e.target.value);
                          setShowInfoStreamerDropdown(true);
                        }}
                        placeholder="Ketik nama streamer atau ID..."
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#941A0B] bg-slate-50 focus:bg-white transition-colors shadow-sm font-medium text-black"
                      />
                      {searchInfoStreamer && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInfoStreamer("");
                            setShowInfoStreamerDropdown(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                        >
                          <i className="fa-solid fa-circle-xmark text-lg" />
                        </button>
                      )}

                      {showInfoStreamerDropdown && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {(infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers)
                            .filter(
                              (s: any) =>
                                !searchInfoStreamer ||
                                s.namaLengkap?.toLowerCase().includes(searchInfoStreamer.toLowerCase()) ||
                                s.idKaryawan?.toLowerCase().includes(searchInfoStreamer.toLowerCase())
                            )
                            .map((s: any) => (
                              <div
                                key={s.id}
                                onMouseDown={() => {
                                  setSearchInfoStreamer(s.namaLengkap);
                                  setShowInfoStreamerDropdown(false);
                                }}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition"
                              >
                                <div>
                                  <span className="font-bold text-black text-sm">{s.namaLengkap}</span>
                                  <span className="text-xs text-slate-500 font-mono ml-2">({s.idKaryawan})</span>
                                </div>
                                <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                                  Pilih
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar Perubahan */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 items-center">
                {Object.keys(infoChanges).length > 0 && (
                  <span className="text-sm font-bold text-amber-600 mr-auto flex items-center gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation animate-pulse" /> Ada perubahan yang belum disimpan!
                  </span>
                )}
                {Object.keys(infoChanges).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInfoChanges({})}
                    className="w-full sm:w-auto px-6 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-bold transition flex items-center justify-center gap-2 text-xs"
                  >
                    <i className="fa-solid fa-rotate-left" /> Batal Rubah
                  </button>
                )}
                <button
                  type="button"
                  disabled={Object.keys(infoChanges).length === 0 || savingInfoStreamer}
                  onClick={async () => {
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
                        showAlert(`✅ Berhasil menyimpan ${keys.length} perubahan libur & request streamer ke database!`);
                        setInfoChanges({});
                        await loadInfoStreamer();
                      } else {
                        showAlert(`❌ Gagal menyimpan: ${d.message || "Terjadi kesalahan"}`);
                      }
                    } catch (err: any) {
                      showAlert(`⚠️ Terjadi kesalahan koneksi: ${err?.message || err}`);
                    } finally {
                      setSavingInfoStreamer(false);
                    }
                  }}
                  className={`w-full sm:w-auto font-bold py-2.5 px-8 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-md ${
                    Object.keys(infoChanges).length > 0
                      ? "bg-[#941A0B] hover:bg-[#7D1509] text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                  }`}
                >
                  <i className={`fa-solid ${savingInfoStreamer ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                  <span>{savingInfoStreamer ? "Menyimpan ke Database..." : "Simpan Perubahan"}</span>
                </button>
              </div>

              {/* Table Data (Date-Based matching ref-deploy/input-jadwal.html) */}
              {(() => {
                // Generate date list based on filter
                let dateList: string[] = [];
                const today = new Date();

                if (filterPeriodeInfo === "EXACT") {
                  if (filterTglSatuInfo) {
                    dateList = [filterTglSatuInfo];
                  } else {
                    dateList = [today.toISOString().slice(0, 10)];
                  }
                } else if (filterPeriodeInfo === "RANGE") {
                  if (filterTglRangeStart && filterTglRangeEnd) {
                    const start = new Date(filterTglRangeStart);
                    const end = new Date(filterTglRangeEnd);
                    const cur = new Date(start);
                    while (cur <= end) {
                      dateList.push(cur.toISOString().slice(0, 10));
                      cur.setDate(cur.getDate() + 1);
                    }
                  } else {
                    for (let i = -7; i <= 21; i++) {
                      const d = new Date(today);
                      d.setDate(d.getDate() + i);
                      dateList.push(d.toISOString().slice(0, 10));
                    }
                  }
                } else {
                  // ALL: past 7 days to next 28 days
                  for (let i = -7; i <= 28; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() + i);
                    dateList.push(d.toISOString().slice(0, 10));
                  }
                }

                // Map date rows
                const defaultKuotaLibur = (typeof infoStreamerData?.defaultKuotaLibur === "number" && infoStreamerData.defaultKuotaLibur > 0) ? infoStreamerData.defaultKuotaLibur : 4;
                const defaultKuotaShift = (typeof infoStreamerData?.defaultKuotaShift === "number" && infoStreamerData.defaultKuotaShift > 0) ? infoStreamerData.defaultKuotaShift : 4;
                const activeStreamers = (infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers);

                const dateRows = dateList.map((tgl) => {
                  const leaves = (infoStreamerData?.leaveRequests || [])
                    .filter((l: any) => {
                      if (l.status !== "APPROVED") return false;
                      const start = (l.tanggalMulai ? new Date(l.tanggalMulai).toISOString().slice(0, 10) : "");
                      const end = (l.tanggalSelesai ? new Date(l.tanggalSelesai).toISOString().slice(0, 10) : start);
                      return tgl >= start && tgl <= end;
                    })
                    .map((l: any) => {
                      const s = l.karyawan || activeStreamers.find((st: any) => st.id === l.karyawanId);
                      return { id: s?.idKaryawan || "-", nama: s?.namaLengkap || "Streamer" };
                    });

                  const req0008 = (infoStreamerData?.shiftRequests || [])
                    .filter((r: any) => {
                      if (r.status !== "APPROVED") return false;
                      const rDate = (r.tanggalMulai ? new Date(r.tanggalMulai).toISOString().slice(0, 10) : "");
                      const isSesi1 = r.jenis === "REQUEST_SESI_1" || (r.alasan || "").includes("00:00") || (r.alasan || "").includes("Sesi 1");
                      return rDate === tgl && isSesi1;
                    })
                    .map((r: any) => {
                      const s = r.karyawan || activeStreamers.find((st: any) => st.id === r.karyawanId);
                      return { id: s?.idKaryawan || "-", nama: s?.namaLengkap || "Streamer" };
                    });

                  const req0816 = (infoStreamerData?.shiftRequests || [])
                    .filter((r: any) => {
                      if (r.status !== "APPROVED") return false;
                      const rDate = (r.tanggalMulai ? new Date(r.tanggalMulai).toISOString().slice(0, 10) : "");
                      const isSesi2 = r.jenis === "REQUEST_SESI_2" || (r.alasan || "").includes("08:00") || (r.alasan || "").includes("Sesi 2");
                      return rDate === tgl && isSesi2;
                    })
                    .map((r: any) => {
                      const s = r.karyawan || activeStreamers.find((st: any) => st.id === r.karyawanId);
                      return { id: s?.idKaryawan || "-", nama: s?.namaLengkap || "Streamer" };
                    });

                  const req1600 = (infoStreamerData?.shiftRequests || [])
                    .filter((r: any) => {
                      if (r.status !== "APPROVED") return false;
                      const rDate = (r.tanggalMulai ? new Date(r.tanggalMulai).toISOString().slice(0, 10) : "");
                      const isSesi3 = r.jenis === "REQUEST_SESI_3" || (r.alasan || "").includes("16:00") || (r.alasan || "").includes("Sesi 3");
                      return rDate === tgl && isSesi3;
                    })
                    .map((r: any) => {
                      const s = r.karyawan || activeStreamers.find((st: any) => st.id === r.karyawanId);
                      return { id: s?.idKaryawan || "-", nama: s?.namaLengkap || "Streamer" };
                    });

                  return {
                    TANGGAL: tgl,
                    LIBUR: leaves,
                    KUOTA_LIBUR: defaultKuotaLibur,
                    SISA_LIBUR: Math.max(0, defaultKuotaLibur - leaves.length),
                    REQ_00_08: req0008,
                    REQ_08_16: req0816,
                    REQ_16_00: req1600,
                    K_00_08: defaultKuotaShift,
                    SK_00_08: Math.max(0, defaultKuotaShift - req0008.length),
                    K_08_16: defaultKuotaShift,
                    SK_08_16: Math.max(0, defaultKuotaShift - req0816.length),
                    K_16_00: defaultKuotaShift,
                    SK_16_00: Math.max(0, defaultKuotaShift - req1600.length),
                  };
                });

                // Filter by Streamer Search Query
                const filteredRows = dateRows.filter((r) => {
                  if (!searchInfoStreamer.trim()) return true;
                  const q = searchInfoStreamer.toLowerCase().trim();
                  const inLeaves = r.LIBUR.some((s: { id: string; nama: string }) => s.nama.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
                  const in0008 = r.REQ_00_08.some((s: { id: string; nama: string }) => s.nama.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
                  const in0816 = r.REQ_08_16.some((s: { id: string; nama: string }) => s.nama.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
                  const in1600 = r.REQ_16_00.some((s: { id: string; nama: string }) => s.nama.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
                  return inLeaves || in0008 || in0816 || in1600;
                });

                const pageSize = 10;
                const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
                const curPage = Math.min(pageInfoStreamer, totalPages);
                const paginated = filteredRows.slice((curPage - 1) * pageSize, curPage * pageSize);

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative flex flex-col min-h-[200px]">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-3 py-3 text-center w-12">NO</th>
                            <th className="px-3 py-3 text-center w-16">AKSI</th>
                            <th className="px-4 py-3 min-w-[150px]">TANGGAL</th>
                            <th className="px-4 py-3 text-center w-40">LIBUR</th>
                            <th className="px-4 py-3 text-center w-32">KUOTA LIBUR</th>
                            <th className="px-4 py-3 text-center w-40">REQUEST SESI LIVE</th>
                            <th className="px-4 py-3 text-center w-32">KUOTA REQUEST</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginated.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                                Data Informasi tidak ditemukan untuk filter ini.
                              </td>
                            </tr>
                          ) : (
                            paginated.map((baseRow, idx) => {
                              const actualIdx = (curPage - 1) * pageSize + idx + 1;
                              const isEdited = !!infoChanges[baseRow.TANGGAL];
                              const edited = infoChanges[baseRow.TANGGAL];

                              const r = isEdited
                                ? (() => {
                                    const liburList = (edited.LIBUR || []).map((str: string) => {
                                      const [id, nama] = str.split(" | ");
                                      return { id: id || "-", nama: nama || "Streamer" };
                                    });
                                    const r0008 = (edited.REQ_00_08 || []).map((str: string) => {
                                      const [id, nama] = str.split(" | ");
                                      return { id: id || "-", nama: nama || "Streamer" };
                                    });
                                    const r0816 = (edited.REQ_08_16 || []).map((str: string) => {
                                      const [id, nama] = str.split(" | ");
                                      return { id: id || "-", nama: nama || "Streamer" };
                                    });
                                    const r1600 = (edited.REQ_16_00 || []).map((str: string) => {
                                      const [id, nama] = str.split(" | ");
                                      return { id: id || "-", nama: nama || "Streamer" };
                                    });
                                    return {
                                      ...baseRow,
                                      LIBUR: liburList,
                                      SISA_LIBUR: Math.max(0, (baseRow.KUOTA_LIBUR || 4) - liburList.length),
                                      REQ_00_08: r0008,
                                      SK_00_08: Math.max(0, (baseRow.K_00_08 || 4) - r0008.length),
                                      REQ_08_16: r0816,
                                      SK_08_16: Math.max(0, (baseRow.K_08_16 || 4) - r0816.length),
                                      REQ_16_00: r1600,
                                      SK_16_00: Math.max(0, (baseRow.K_16_00 || 4) - r1600.length),
                                    };
                                  })()
                                : baseRow;

                              const totReq = r.REQ_00_08.length + r.REQ_08_16.length + r.REQ_16_00.length;

                              return (
                                <tr key={r.TANGGAL} className={`${isEdited ? "bg-amber-50" : "hover:bg-slate-50"} transition`}>
                                  <td className="px-3 py-3 text-center font-bold text-slate-400">
                                    {isEdited ? (
                                      <i className="fa-solid fa-check text-amber-500 text-base" title="Sudah Diubah" />
                                    ) : (
                                      actualIdx
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => bukaModalEditInfo(r.TANGGAL, baseRow)}
                                      className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center mx-auto shadow-sm"
                                      title="Edit Info Streamer"
                                    >
                                      <i className="fa-solid fa-pen-to-square" />
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-800">
                                    {new Date(r.TANGGAL).toLocaleDateString("id-ID", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                    <span className="text-[10px] text-slate-400 font-mono block">{r.TANGGAL}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {r.LIBUR.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setModalDetailLibur({
                                            tanggal: r.TANGGAL,
                                            list: r.LIBUR,
                                            kuota: r.KUOTA_LIBUR,
                                            sisa: r.SISA_LIBUR,
                                          })
                                        }
                                        className="text-slate-600 hover:text-red-600 transition text-lg relative inline-flex items-center"
                                      >
                                        <i className="fa-solid fa-bed text-xl" />
                                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 rounded-full absolute -top-2 -right-2 shadow-sm">
                                          {r.LIBUR.length}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setModalInfoKuota({
                                          title: "Kuota Libur",
                                          tanggal: r.TANGGAL,
                                          kuota: r.KUOTA_LIBUR,
                                          sisa: r.SISA_LIBUR,
                                        })
                                      }
                                      className="text-slate-400 hover:text-blue-600 transition text-lg"
                                      title="Detail Kuota Libur"
                                    >
                                      <i className="fa-solid fa-circle-info" />
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {totReq > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setModalDetailRequest({
                                            tanggal: r.TANGGAL,
                                            sessions: {
                                              "Sesi 00:00 - 08:00": { list: r.REQ_00_08, kuota: r.K_00_08, sisa: r.SK_00_08 },
                                              "Sesi 08:00 - 16:00": { list: r.REQ_08_16, kuota: r.K_08_16, sisa: r.SK_08_16 },
                                              "Sesi 16:00 - 00:00": { list: r.REQ_16_00, kuota: r.K_16_00, sisa: r.SK_16_00 },
                                            },
                                          })
                                        }
                                        className="text-slate-600 hover:text-indigo-600 transition text-lg relative inline-flex items-center"
                                      >
                                        <i className="fa-solid fa-video text-xl" />
                                        <span className="text-[10px] font-bold bg-indigo-500 text-white px-1.5 rounded-full absolute -top-2 -right-2 shadow-sm">
                                          {totReq}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setModalInfoKuota({
                                          title: "Kuota Request Sesi",
                                          tanggal: r.TANGGAL,
                                          kuota: r.K_08_16,
                                          sisa: r.SK_08_16,
                                          breakdown: {
                                            "00:00 - 08:00": { kuota: r.K_00_08, sisa: r.SK_00_08 },
                                            "08:00 - 16:00": { kuota: r.K_08_16, sisa: r.SK_08_16 },
                                            "16:00 - 00:00": { kuota: r.K_16_00, sisa: r.SK_16_00 },
                                          },
                                        })
                                      }
                                      className="text-slate-400 hover:text-blue-600 transition text-lg"
                                      title="Detail Kuota Request"
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

                    {/* Pagination Bar */}
                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Tampil <span className="font-bold text-slate-700">{filteredRows.length === 0 ? 0 : (curPage - 1) * pageSize + 1}</span> -{" "}
                        <span className="font-bold text-slate-700">{Math.min(curPage * pageSize, filteredRows.length)}</span> dari{" "}
                        <span className="font-bold text-slate-700">{filteredRows.length}</span> hari
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPageInfoStreamer(Math.max(1, curPage - 1))}
                          disabled={curPage <= 1}
                          className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold"
                        >
                          <i className="fa-solid fa-chevron-left" />
                        </button>
                        <span className="text-xs font-bold text-slate-700 px-2">
                          Hal {curPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPageInfoStreamer(Math.min(totalPages, curPage + 1))}
                          disabled={curPage >= totalPages}
                          className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold"
                        >
                          <i className="fa-solid fa-chevron-right" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* POPUP MODAL: DETAIL LIBUR */}
              {modalDetailLibur && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">Daftar Libur: {modalDetailLibur.tanggal}</h3>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                          Kuota: <span className="font-bold text-slate-700">{modalDetailLibur.kuota}</span> | Sisa:{" "}
                          <span className={`font-bold ${modalDetailLibur.sisa <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {modalDetailLibur.sisa}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalDetailLibur(null)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-xmark text-xl" />
                      </button>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 bg-white relative">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-[11px] uppercase">
                          <tr>
                            <th className="p-3 pl-6 w-32">ID KARYAWAN</th>
                            <th className="p-3 pr-6">STREAMER</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalDetailLibur.list.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-6 text-center text-slate-400 italic">
                                Tidak ada streamer libur di tanggal ini.
                              </td>
                            </tr>
                          ) : (
                            modalDetailLibur.list.map((s, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 pl-6 font-mono font-bold text-slate-500">{s.id}</td>
                                <td className="p-3 pr-6 font-bold text-slate-800">{s.nama}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                      <button
                        type="button"
                        onClick={() => setModalDetailLibur(null)}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* POPUP MODAL: DETAIL REQUEST SESI */}
              {modalDetailRequest && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="text-base font-bold text-slate-800">Request Sesi: {modalDetailRequest.tanggal}</h3>
                      <button
                        type="button"
                        onClick={() => setModalDetailRequest(null)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-xmark text-xl" />
                      </button>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 bg-white">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <tbody>
                          {Object.entries(modalDetailRequest.sessions).map(([sesi, sData]) => (
                            <React.Fragment key={sesi}>
                              <tr className="bg-indigo-50 border-y border-indigo-200">
                                <td colSpan={2} className="p-3 pl-6">
                                  <div className="font-bold text-indigo-800 text-xs uppercase">{sesi}</div>
                                  <div className="text-[10px] text-indigo-600 font-medium">
                                    Kuota: <span className="font-bold">{sData.kuota}</span> | Sisa:{" "}
                                    <span className={`font-bold ${sData.sisa <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                                      {sData.sisa}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {sData.list.length === 0 ? (
                                <tr className="border-b border-slate-100">
                                  <td colSpan={2} className="p-3 pl-6 text-slate-400 italic">
                                    Belum ada request pada sesi ini.
                                  </td>
                                </tr>
                              ) : (
                                sData.list.map((s, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 pl-6 font-mono text-slate-500 font-bold">{s.id}</td>
                                    <td className="p-3 pr-6 font-bold text-slate-800">{s.nama}</td>
                                  </tr>
                                ))
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                      <button
                        type="button"
                        onClick={() => setModalDetailRequest(null)}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* POPUP MODAL: INFO KUOTA */}
              {modalInfoKuota && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-sm text-slate-800">{modalInfoKuota.title} ({modalInfoKuota.tanggal})</h3>
                      <button onClick={() => setModalInfoKuota(null)} className="text-slate-400 hover:text-red-500">
                        <i className="fa-solid fa-xmark text-lg" />
                      </button>
                    </div>

                    {modalInfoKuota.breakdown ? (
                      <div className="space-y-2 text-xs">
                        {Object.entries(modalInfoKuota.breakdown).map(([sesi, b]: [string, any]) => (
                          <div key={sesi} className="flex justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-semibold text-slate-700">Sesi {sesi}</span>
                            <span className="font-bold text-slate-900 font-mono">
                              Kuota: {b.kuota} | Sisa: <span className={b.sisa <= 0 ? "text-red-500" : "text-emerald-600"}>{b.sisa}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-slate-600 font-medium">Total Kuota Libur:</span>
                          <span className="font-bold text-slate-900 font-mono">{modalInfoKuota.kuota} Orang / Hari</span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-slate-600 font-medium">Sisa Kuota:</span>
                          <span className={`font-bold font-mono ${Number(modalInfoKuota.sisa) <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {modalInfoKuota.sisa} Orang
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setModalInfoKuota(null)}
                      className="w-full py-2.5 bg-[#941A0B] text-white font-bold rounded-xl text-xs shadow-md"
                    >
                      Mengerti
                    </button>
                  </div>
                </div>
              )}

              {/* POPUP MODAL: EDIT INFORMASI STREAMER (4-BOX GRID 2x2 matching ref-deploy) */}
              {editInfoDate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-calendar-day text-[#941A0B]" />
                        <span>Edit Informasi Tanggal:</span>
                        <span className="text-[#941A0B] font-black">{editInfoDate}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditInfoDate(null)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-xmark text-xl" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 bg-white">
                      {/* 4 KOTAK TERPISAH (GRID 2x2) */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* BOX 1: DAFTAR LIBUR */}
                        <div className="border border-red-200 rounded-xl overflow-hidden flex flex-col h-[45vh]">
                          <div className="bg-red-50 text-red-700 font-bold px-4 py-3 border-b border-red-200 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <i className="fa-solid fa-bed" /> Daftar Libur ({stateEditInfo.LIBUR.length}/20)
                            </div>
                            <div className="relative w-full max-w-[160px]">
                              <input
                                type="text"
                                value={cariLiburInfo}
                                onChange={(e) => setCariLiburInfo(e.target.value)}
                                className="w-full border border-red-300 rounded-md px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-red-500 font-normal text-slate-800 bg-white placeholder-red-300"
                                placeholder="Cari ID / nama..."
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto relative">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-[10px] uppercase">
                                <tr>
                                  <th className="p-2 w-10 text-center">✔</th>
                                  <th className="p-2 w-28">ID KARYAWAN</th>
                                  <th className="p-2">STREAMER</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers)
                                  .filter((s: any) => {
                                    if (!cariLiburInfo.trim()) return true;
                                    const q = cariLiburInfo.toLowerCase().trim();
                                    return s.namaLengkap?.toLowerCase().includes(q) || s.idKaryawan?.toLowerCase().includes(q);
                                  })
                                  .sort((a: any, b: any) => {
                                    const aVal = `${a.idKaryawan} | ${a.namaLengkap}`;
                                    const bVal = `${b.idKaryawan} | ${b.namaLengkap}`;
                                    const aChecked = stateEditInfo.LIBUR.includes(aVal) ? 0 : 1;
                                    const bChecked = stateEditInfo.LIBUR.includes(bVal) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const val = `${s.idKaryawan} | ${s.namaLengkap}`;
                                    const isChecked = stateEditInfo.LIBUR.includes(val);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleCheckboxInfoState("LIBUR", val)}
                                        className="border-b border-slate-100 hover:bg-red-50 cursor-pointer transition-colors"
                                      >
                                        <td className="p-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            readOnly
                                            className="w-4 h-4 text-red-600 rounded pointer-events-none"
                                          />
                                        </td>
                                        <td className="p-2 text-xs font-mono text-slate-500">{s.idKaryawan}</td>
                                        <td className="p-2 font-bold text-slate-700">{s.namaLengkap}</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* BOX 2: REQUEST 00:00 - 08:00 */}
                        <div className="border border-indigo-200 rounded-xl overflow-hidden flex flex-col h-[45vh]">
                          <div className="bg-indigo-50 text-indigo-700 font-bold px-4 py-3 border-b border-indigo-200 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <i className="fa-solid fa-moon" /> Sesi 00:00 - 08:00 ({stateEditInfo.REQ_00_08.length})
                            </div>
                            <div className="relative w-full max-w-[160px]">
                              <input
                                type="text"
                                value={cariReq0008}
                                onChange={(e) => setCariReq0008(e.target.value)}
                                className="w-full border border-indigo-300 rounded-md px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-normal text-slate-800 bg-white placeholder-indigo-300"
                                placeholder="Cari ID / nama..."
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto relative">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-[10px] uppercase">
                                <tr>
                                  <th className="p-2 w-10 text-center">✔</th>
                                  <th className="p-2 w-28">ID KARYAWAN</th>
                                  <th className="p-2">STREAMER</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers)
                                  .filter((s: any) => {
                                    if (!cariReq0008.trim()) return true;
                                    const q = cariReq0008.toLowerCase().trim();
                                    return s.namaLengkap?.toLowerCase().includes(q) || s.idKaryawan?.toLowerCase().includes(q);
                                  })
                                  .sort((a: any, b: any) => {
                                    const aVal = `${a.idKaryawan} | ${a.namaLengkap}`;
                                    const bVal = `${b.idKaryawan} | ${b.namaLengkap}`;
                                    const aChecked = stateEditInfo.REQ_00_08.includes(aVal) ? 0 : 1;
                                    const bChecked = stateEditInfo.REQ_00_08.includes(bVal) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const val = `${s.idKaryawan} | ${s.namaLengkap}`;
                                    const isChecked = stateEditInfo.REQ_00_08.includes(val);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleCheckboxInfoState("REQ_00_08", val)}
                                        className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors"
                                      >
                                        <td className="p-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            readOnly
                                            className="w-4 h-4 text-indigo-600 rounded pointer-events-none"
                                          />
                                        </td>
                                        <td className="p-2 text-xs font-mono text-slate-500">{s.idKaryawan}</td>
                                        <td className="p-2 font-bold text-slate-700">{s.namaLengkap}</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* BOX 3: REQUEST 08:00 - 16:00 */}
                        <div className="border border-sky-200 rounded-xl overflow-hidden flex flex-col h-[45vh]">
                          <div className="bg-sky-50 text-sky-700 font-bold px-4 py-3 border-b border-sky-200 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <i className="fa-solid fa-sun text-amber-500" /> Sesi 08:00 - 16:00 ({stateEditInfo.REQ_08_16.length})
                            </div>
                            <div className="relative w-full max-w-[160px]">
                              <input
                                type="text"
                                value={cariReq0816}
                                onChange={(e) => setCariReq0816(e.target.value)}
                                className="w-full border border-sky-300 rounded-md px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-500 font-normal text-slate-800 bg-white placeholder-sky-300"
                                placeholder="Cari ID / nama..."
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto relative">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-[10px] uppercase">
                                <tr>
                                  <th className="p-2 w-10 text-center">✔</th>
                                  <th className="p-2 w-28">ID KARYAWAN</th>
                                  <th className="p-2">STREAMER</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers)
                                  .filter((s: any) => {
                                    if (!cariReq0816.trim()) return true;
                                    const q = cariReq0816.toLowerCase().trim();
                                    return s.namaLengkap?.toLowerCase().includes(q) || s.idKaryawan?.toLowerCase().includes(q);
                                  })
                                  .sort((a: any, b: any) => {
                                    const aVal = `${a.idKaryawan} | ${a.namaLengkap}`;
                                    const bVal = `${b.idKaryawan} | ${b.namaLengkap}`;
                                    const aChecked = stateEditInfo.REQ_08_16.includes(aVal) ? 0 : 1;
                                    const bChecked = stateEditInfo.REQ_08_16.includes(bVal) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const val = `${s.idKaryawan} | ${s.namaLengkap}`;
                                    const isChecked = stateEditInfo.REQ_08_16.includes(val);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleCheckboxInfoState("REQ_08_16", val)}
                                        className="border-b border-slate-100 hover:bg-sky-50 cursor-pointer transition-colors"
                                      >
                                        <td className="p-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            readOnly
                                            className="w-4 h-4 text-sky-600 rounded pointer-events-none"
                                          />
                                        </td>
                                        <td className="p-2 text-xs font-mono text-slate-500">{s.idKaryawan}</td>
                                        <td className="p-2 font-bold text-slate-700">{s.namaLengkap}</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* BOX 4: REQUEST 16:00 - 00:00 */}
                        <div className="border border-fuchsia-200 rounded-xl overflow-hidden flex flex-col h-[45vh]">
                          <div className="bg-fuchsia-50 text-fuchsia-700 font-bold px-4 py-3 border-b border-fuchsia-200 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <i className="fa-solid fa-cloud-moon text-slate-800" /> Sesi 16:00 - 00:00 ({stateEditInfo.REQ_16_00.length})
                            </div>
                            <div className="relative w-full max-w-[160px]">
                              <input
                                type="text"
                                value={cariReq1600}
                                onChange={(e) => setCariReq1600(e.target.value)}
                                className="w-full border border-fuchsia-300 rounded-md px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-fuchsia-500 font-normal text-slate-800 bg-white placeholder-fuchsia-300"
                                placeholder="Cari ID / nama..."
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto relative">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 text-[10px] uppercase">
                                <tr>
                                  <th className="p-2 w-10 text-center">✔</th>
                                  <th className="p-2 w-28">ID KARYAWAN</th>
                                  <th className="p-2">STREAMER</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(infoStreamerData?.streamers?.length ? infoStreamerData.streamers : streamers)
                                  .filter((s: any) => {
                                    if (!cariReq1600.trim()) return true;
                                    const q = cariReq1600.toLowerCase().trim();
                                    return s.namaLengkap?.toLowerCase().includes(q) || s.idKaryawan?.toLowerCase().includes(q);
                                  })
                                  .sort((a: any, b: any) => {
                                    const aVal = `${a.idKaryawan} | ${a.namaLengkap}`;
                                    const bVal = `${b.idKaryawan} | ${b.namaLengkap}`;
                                    const aChecked = stateEditInfo.REQ_16_00.includes(aVal) ? 0 : 1;
                                    const bChecked = stateEditInfo.REQ_16_00.includes(bVal) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const val = `${s.idKaryawan} | ${s.namaLengkap}`;
                                    const isChecked = stateEditInfo.REQ_16_00.includes(val);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleCheckboxInfoState("REQ_16_00", val)}
                                        className="border-b border-slate-100 hover:bg-fuchsia-50 cursor-pointer transition-colors"
                                      >
                                        <td className="p-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            readOnly
                                            className="w-4 h-4 text-fuchsia-600 rounded pointer-events-none"
                                          />
                                        </td>
                                        <td className="p-2 text-xs font-mono text-slate-500">{s.idKaryawan}</td>
                                        <td className="p-2 font-bold text-slate-700">{s.namaLengkap}</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditInfoDate(null)}
                        className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition text-xs"
                      >
                        Batal Tutup
                      </button>
                      <button
                        type="button"
                        onClick={simpanKeRamInfo}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition shadow-sm flex items-center gap-2 text-xs"
                      >
                        <i className="fa-solid fa-download" /> Simpan Pilihan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: JADWAL OTS                                                         */}
      {/* ========================================================================= */}
      {mainTab === "ots" && (
        <form onSubmit={submitOtsSchedules} className="space-y-6">
          <div className="space-y-4">
            {otsForms.map((item, idx) => {
              const headTitle = item.tanggal && item.otsNama
                ? `${item.tanggal} | ${item.cabangStudio} | ${item.otsNama}`
                : `Jadwal OTS Baru`;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                  {/* Header Card */}
                  <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                        #{idx + 1}
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">
                        {headTitle}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {otsForms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOtsForms(otsForms.filter((_, i) => i !== idx));
                            setIsOtsCrashVerified(false);
                          }}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                          title="Hapus Form"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Card */}
                  <div className="p-5 sm:p-6 space-y-6 block">
                    {/* Row 1: Tanggal Penugasan & Cabang */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Penugasan *</label>
                        <input
                          type="date"
                          value={item.tanggal}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onChange={(e) => {
                            const v = e.target.value;
                            const updated = [...otsForms];
                            updated[idx].tanggal = v;
                            updated[idx].idJadwal = generateNewScheduleId("OTS", v);
                            setOtsForms(updated);
                            setIsOtsCrashVerified(false);
                          }}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cabang Studio *</label>
                        <select
                          value={item.cabangStudio}
                          onChange={(e) => {
                            const updated = [...otsForms];
                            updated[idx].cabangStudio = e.target.value;
                            setOtsForms(updated);
                            setIsOtsCrashVerified(false);
                          }}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                          required
                        >
                          <option value="Timoho">Timoho</option>
                          <option value="Berbah">Berbah</option>
                          <option value="Wiyoro">Wiyoro</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Cari Staff OTS, ID OTS (Auto), Nama OTS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cari Staff OTS *</label>
                        <select
                          value={item.otsKaryawanId || ""}
                          onChange={(e) => {
                            const oId = e.target.value;
                            const oObj = otsStaff.find((o) => o.id === oId);
                            const updated = [...otsForms];
                            updated[idx].otsKaryawanId = oId;
                            updated[idx].otsId = oObj?.idKaryawan || "";
                            updated[idx].otsNama = oObj?.namaLengkap || "";
                            setOtsForms(updated);
                            setIsOtsCrashVerified(false);
                          }}
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                          required
                        >
                          <option value="">-- Pilih / Ketik ID / Nama OTS --</option>
                          {otsStaff.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.idKaryawan} - {o.namaLengkap}
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
                            placeholder="ID Auto"
                            className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama OTS</label>
                          <input
                            type="text"
                            value={item.otsNama || ""}
                            readOnly
                            placeholder="Nama OTS"
                            className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Pilih Shift, Masuk, Keluar, Catatan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Pilih Shift</label>
                          <select
                            value={item.shiftOts || ""}
                            onChange={(e) => {
                              const sVal = e.target.value;
                              const shiftTimes = applyShiftOts(sVal);
                              const updated = [...otsForms];
                              updated[idx].shiftOts = sVal;
                              if (shiftTimes.masuk) {
                                updated[idx].jamMulaiLive = shiftTimes.masuk;
                                updated[idx].jamSelesaiLive = shiftTimes.keluar;
                              }
                              setOtsForms(updated);
                              setIsOtsCrashVerified(false);
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
                          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Masuk *</label>
                          <input
                            type="text"
                            value={item.jamMulaiLive}
                            placeholder="07:00"
                            onChange={(e) => {
                              const updated = [...otsForms];
                              updated[idx].jamMulaiLive = e.target.value;
                              setOtsForms(updated);
                              setIsOtsCrashVerified(false);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-2 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Keluar *</label>
                          <input
                            type="text"
                            value={item.jamSelesaiLive}
                            placeholder="15:00"
                            onChange={(e) => {
                              const updated = [...otsForms];
                              updated[idx].jamSelesaiLive = e.target.value;
                              setOtsForms(updated);
                              setIsOtsCrashVerified(false);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-2 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Pekerjaan</label>
                        <textarea
                          rows={1}
                          value={item.catatanOts || ""}
                          onChange={(e) => {
                            const updated = [...otsForms];
                            updated[idx].catatanOts = e.target.value;
                            setOtsForms(updated);
                          }}
                          placeholder="Instruksi tugas OTS..."
                          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Row 4: File Pendukung (Multi-link) */}
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-semibold text-slate-700">File Pendukung</label>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...otsForms];
                            updated[idx].filesOts = [...(updated[idx].filesOts || [""]), ""];
                            setOtsForms(updated);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus" /> Tambah Link
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(item.filesOts && item.filesOts.length > 0 ? item.filesOts : [""]).map((fUrl, fIdx) => (
                          <div key={fIdx} className="flex gap-2">
                            <input
                              type="text"
                              value={fUrl}
                              onChange={(e) => {
                                const updated = [...otsForms];
                                const files = [...(updated[idx].filesOts || [""])];
                                files[fIdx] = e.target.value;
                                updated[idx].filesOts = files;
                                setOtsForms(updated);
                              }}
                              placeholder="Paste link file/dokumen di sini..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            {fIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...otsForms];
                                  const files = [...(updated[idx].filesOts || [])];
                                  files.splice(fIdx, 1);
                                  updated[idx].filesOts = files;
                                  setOtsForms(updated);
                                }}
                                className="bg-red-50 text-red-500 hover:bg-red-100 px-3.5 rounded-lg transition"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => {
                if (otsForms.length >= 100) return;
                setOtsForms([
                  ...otsForms,
                  {
                    id: Date.now(),
                    idJadwal: generateNewScheduleId("OTS"),
                    tanggal: new Date().toISOString().slice(0, 10),
                    platform: "Shopee Live",
                    cabangStudio: "Timoho",
                    nomorStudio: "Studio 1",
                    otsKaryawanId: "",
                    otsId: "",
                    otsNama: "",
                    shiftOts: "",
                    jamMulaiLive: "07:00",
                    jamSelesaiLive: "15:00",
                    catatanOts: "",
                    filesOts: [""],
                  },
                ]);
                setIsOtsCrashVerified(false);
              }}
              className="w-full sm:w-auto text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal OTS (Maks 100)
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={checkBebasCrashOts}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 text-sm"
              >
                <i className="fa-solid fa-shield-halved" /> Bebas Crash
              </button>
              <button
                type="submit"
                disabled={loading || !isOtsCrashVerified}
                className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition flex items-center justify-center gap-2 text-sm ${
                  isOtsCrashVerified && !loading
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                }`}
              >
                <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal OTS"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RUBAH JADWAL                                                       */}
      {/* ========================================================================= */}
      {mainTab === "rubah" && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-800">Cari Jadwal Target</h2>

            {/* Selector Tipe */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pb-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setTipeRubah("STREAMER")}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                  tipeRubah === "STREAMER"
                    ? "bg-[#941A0B] text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-video" /> Jadwal Streamer
              </button>
              <button
                type="button"
                onClick={() => setTipeRubah("OTS")}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                  tipeRubah === "OTS"
                    ? "bg-[#941A0B] text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-headphones" /> Jadwal OTS
              </button>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-48 flex-shrink-0">
                <label className={labelCls}>Pilih Tanggal</label>
                <FlatpickrPicker
                  id="filterTanggalRubah"
                  value={filterTanggalRubah}
                  placeholder="Pilih Tanggal..."
                  options={{ mode: "single", dateFormat: "Y-m-d" }}
                  onChange={(dateStr) => setFilterTanggalRubah(dateStr)}
                />
              </div>

              <div className="w-full flex-1">
                <label className={labelCls}>Pilih ID Jadwal / Streamer</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative w-full flex-1">
                    <input
                      type="text"
                      value={searchEditId}
                      onFocus={() => setShowEditJadwalDropdown(true)}
                      onChange={(e) => {
                        setSearchEditId(e.target.value);
                        setShowEditJadwalDropdown(true);
                      }}
                      placeholder="Ketik ID Jadwal atau nama streamer..."
                      className={inputCls}
                    />
                    {searchEditId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchEditId("");
                          setShowEditJadwalDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-circle-xmark text-lg" />
                      </button>
                    )}

                    {showEditJadwalDropdown && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {allJadwal
                          .filter((j) => {
                            if (tipeRubah === "STREAMER" && j.idJadwal?.startsWith("OTS")) return false;
                            if (tipeRubah === "OTS" && !j.idJadwal?.startsWith("OTS")) return false;
                            if (filterTanggalRubah && !j.tanggal?.startsWith(filterTanggalRubah)) return false;
                            if (!searchEditId) return true;
                            const q = searchEditId.toLowerCase();
                            return (
                              j.idJadwal?.toLowerCase().includes(q) ||
                              j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
                              j.client?.namaClient?.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 20)
                          .map((j) => (
                            <div
                              key={j.id}
                              onMouseDown={() => {
                                setSearchEditId(j.idJadwal);
                                setSelectedEditJadwal(j);
                                setEditRows([
                                  { field: "PLATFORM", value: j.platform || "Shopee Live" },
                                  { field: "STREAMER", value: j.streamerKaryawanId || "" },
                                ]);
                                setShowEditJadwalDropdown(false);
                              }}
                              className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition"
                            >
                              <div>
                                <span className="font-bold text-[#941A0B] font-mono text-xs">{j.idJadwal}</span>
                                <span className="text-xs font-bold text-black ml-2">{j.client?.namaClient || j.platform}</span>
                                <div className="text-[11px] text-slate-500">
                                  Host: <span className="text-slate-700 font-medium">{j.streamerKaryawan?.namaLengkap || "Belum di-assign"}</span> • Waktu:{" "}
                                  <span className="text-slate-700 font-mono">
                                    {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                                Pilih
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditJadwalDropdown(false);
                      handleSelectEditJadwal();
                    }}
                    className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-md flex-shrink-0"
                  >
                    <i className="fa-solid fa-pen-to-square" /> Rubah Data
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Target Summary Banner */}
          {selectedEditJadwal && (
            <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-md">
              <h2 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider border-b border-slate-800 pb-2">
                Target Perubahan Jadwal Terpilih
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs text-slate-400">ID Jadwal</span>
                  <div className="font-bold text-base text-red-400 font-mono">{selectedEditJadwal.idJadwal}</div>
                </div>
                <div>
                  <span className="block text-xs text-slate-400">Brand / Streamer</span>
                  <div className="font-bold text-base text-white">
                    {selectedEditJadwal.client?.namaClient || "-"} / {selectedEditJadwal.streamerKaryawan?.namaLengkap || "Belum di-assign"}
                  </div>
                </div>
                <div>
                  <span className="block text-xs text-slate-400">Waktu Siaran</span>
                  <div className="font-bold text-base text-slate-200">
                    {new Date(selectedEditJadwal.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(selectedEditJadwal.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Perubahan Kolom Dinamis */}
          {selectedEditJadwal && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Perbarui Kolom Data Jadwal
              </h2>
              <form onSubmit={handleSaveEditJadwal} className="space-y-4">
                <div className="space-y-3">
                  {editRows.map((row, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="w-full sm:w-1/3">
                        <select
                          value={row.field}
                          onChange={(e) => {
                            const updated = [...editRows];
                            updated[idx].field = e.target.value;
                            setEditRows(updated);
                          }}
                          className={selectCls}
                          required
                        >
                          <option value="" disabled>-- Pilih Kolom Data --</option>
                          <option value="PLATFORM">Platform Marketplace</option>
                          <option value="STREAMER">Streamer / Host</option>
                          <option value="CABANG">Cabang Studio</option>
                          <option value="STUDIO">Nomor Studio</option>
                          <option value="STATUS">Status Jadwal</option>
                          <option value="JUDUL">Judul Sesi</option>
                        </select>
                      </div>

                      <div className="w-full sm:flex-1">
                        {row.field === "PLATFORM" ? (
                          <select
                            value={row.value}
                            onChange={(e) => {
                              const updated = [...editRows];
                              updated[idx].value = e.target.value;
                              setEditRows(updated);
                            }}
                            className={selectCls}
                          >
                            {PLATFORMS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ) : row.field === "STREAMER" ? (
                          <select
                            value={row.value}
                            onChange={(e) => {
                              const updated = [...editRows];
                              updated[idx].value = e.target.value;
                              setEditRows(updated);
                            }}
                            className={selectCls}
                          >
                            <option value="">-- Pilih Streamer --</option>
                            {streamers.map((s) => (
                              <option key={s.id} value={s.id}>{s.namaLengkap} ({s.idKaryawan})</option>
                            ))}
                          </select>
                        ) : row.field === "STATUS" ? (
                          <select
                            value={row.value}
                            onChange={(e) => {
                              const updated = [...editRows];
                              updated[idx].value = e.target.value;
                              setEditRows(updated);
                            }}
                            className={selectCls}
                          >
                            <option value="TERJADWAL">TERJADWAL</option>
                            <option value="PLOTING">PLOTING</option>
                            <option value="SELESAI">SELESAI</option>
                            <option value="BATAL">BATAL</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => {
                              const updated = [...editRows];
                              updated[idx].value = e.target.value;
                              setEditRows(updated);
                            }}
                            placeholder="Masukkan nilai baru..."
                            className={inputCls}
                            required
                          />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditRows(editRows.filter((_, i) => i !== idx))}
                        disabled={editRows.length === 1}
                        className="text-red-500 hover:text-red-700 p-2 disabled:opacity-30"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setEditRows([...editRows, { field: "", value: "" }])}
                  className="text-[#941A0B] text-sm font-bold flex items-center gap-2 pt-2"
                >
                  <i className="fa-solid fa-plus" /> Tambah Kolom
                </button>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingEditJadwal}
                    className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <i className={`fa-solid ${savingEditJadwal ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEditJadwal ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: JADWAL KLIEN (5 Subtabs Sesuai ref-deploy/input-jadwal.html)         */}
      {/* ========================================================================= */}
      {mainTab === "klien" && (
        <div className="space-y-6">
          {/* Subtab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {[
              { id: "formulir", label: "Formulir" },
              { id: "rubah", label: "Rubah Jadwal Klien" },
              { id: "ketentuan", label: "Ketentuan Klien" },
              { id: "export", label: "Export Jadwal" },
              { id: "import", label: "Import Jadwal" },
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setKlienSubTab(sub.id as any)}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                  klienSubTab === sub.id ? "border-[#941A0B] text-[#941A0B]" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Subview 1: Formulir Jadwal Klien */}
          {klienSubTab === "formulir" && (
            <form onSubmit={submitKlienSchedules} className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 flex items-start gap-3">
                <i className="fa-solid fa-crown text-[#941A0B] text-lg mt-0.5" />
                <div>
                  <strong>Mode Eksekutif — Direct Jadwal Klien:</strong> Jadwal yang diinputkan di sini langsung berstatus{" "}
                  <span className="font-bold underline">TERJADWAL / APPROVED</span> dan otomatis masuk ke kalender siaran tanpa menunggu persetujuan eksternal.
                </div>
              </div>

              <div className="space-y-4">
                {klienForms.map((item, idx) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>ID Jadwal Klien</label>
                        <input
                          type="text"
                          value={item.idJadwal}
                          readOnly
                          className={`${inputCls} bg-[#F1F1F1] text-slate-700 font-mono font-bold cursor-not-allowed`}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Brand Partner / Klien *</label>
                        <select
                          value={item.clientId}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].clientId = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={selectCls}
                          required
                        >
                          <option value="">-- Pilih Klien / Brand --</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.namaClient} {c.platform ? `(${c.platform})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelCls}>Tanggal Siaran *</label>
                        <input
                          type="date"
                          value={item.tanggal}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onChange={(e) => {
                            const v = e.target.value;
                            const updated = [...klienForms];
                            updated[idx].tanggal = v;
                            updated[idx].jamMulaiLive = `${v}T10:00`;
                            updated[idx].jamSelesaiLive = `${v}T13:00`;
                            updated[idx].idJadwal = generateNewScheduleId("JDK", v);
                            setKlienForms(updated);
                          }}
                          className={dateInputCls}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Waktu Mulai *</label>
                        <input
                          type="datetime-local"
                          value={item.jamMulaiLive}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].jamMulaiLive = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={dateInputCls}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Waktu Selesai *</label>
                        <input
                          type="datetime-local"
                          value={item.jamSelesaiLive}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].jamSelesaiLive = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={dateInputCls}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Platform Marketplace</label>
                        <select
                          value={item.platform}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].platform = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={selectCls}
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setKlienForms([
                      ...klienForms,
                      {
                        id: Date.now(),
                        idJadwal: generateNewScheduleId("JDK"),
                        tanggal: new Date().toISOString().slice(0, 10),
                        platform: "Shopee Live",
                        clientId: "",
                        streamerKaryawanId: "",
                        cabangStudio: "Timoho",
                        nomorStudio: "01",
                        jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T10:00`,
                        jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T13:00`,
                        judulLive: "",
                        produkPrioritas: "",
                        promoLive: "",
                      },
                    ]);
                  }}
                  className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 100)
                </button>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCheckBebasCrash}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    <i className="fa-solid fa-shield-halved" /> Bebas Crash
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{loading ? "Menerbitkan..." : "Simpan Semua Jadwal Klien"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Subview 2: Rubah Jadwal Klien */}
          {klienSubTab === "rubah" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Periode Waktu</label>
                  <select
                    value={filterPeriodeKlien}
                    onChange={(e) => setFilterPeriodeKlien(e.target.value)}
                    className={selectCls}
                  >
                    <option value="default">DATA (-7 s/d +35 Hari)</option>
                    <option value="hari_ini">Hari Ini</option>
                    <option value="7_depan">7 Hari Ke Depan</option>
                    <option value="35_depan">35 Hari Ke Depan</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status Jadwal</label>
                  <select
                    value={filterStatusKlien}
                    onChange={(e) => setFilterStatusKlien(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Semua Status</option>
                    <option value="TERJADWAL">TERJADWAL</option>
                    <option value="PLOTING">PLOTING</option>
                    <option value="SELESAI">SELESAI</option>
                    <option value="BATAL">BATAL</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Platform Klien</label>
                  <input
                    type="text"
                    value={filterPlatformKlien}
                    onChange={(e) => setFilterPlatformKlien(e.target.value)}
                    placeholder="Ketik nama platform..."
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">NO</th>
                      <th className="px-3 py-3">PLATFORM</th>
                      <th className="px-3 py-3">WAKTU LIVE</th>
                      <th className="px-3 py-3 text-center">STUDIO</th>
                      <th className="px-3 py-3">STREAMER</th>
                      <th className="px-3 py-3 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allJadwal
                      .filter((j) => !filterStatusKlien || j.status === filterStatusKlien)
                      .filter((j) => !filterPlatformKlien || j.platform?.toLowerCase().includes(filterPlatformKlien.toLowerCase()))
                      .slice(0, 15)
                      .map((j, idx) => (
                        <tr key={j.id} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-3 font-bold text-slate-900">{j.client?.namaClient || j.platform}</td>
                          <td className="px-3 py-3 text-slate-700">
                            {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}{" "}
                            ({new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})
                          </td>
                          <td className="px-3 py-3 text-center font-mono">{j.cabangStudio} #{j.nomorStudio}</td>
                          <td className="px-3 py-3 font-medium text-slate-800">{j.streamerKaryawan?.namaLengkap || "Belum di-assign"}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {j.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subview 3: Ketentuan Klien */}
          {klienSubTab === "ketentuan" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <i className="fa-solid fa-list-check text-[#941A0B]" />
                    Ketentuan Khusus Platform
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kelola Blacklist dan Prioritas Host per Platform</p>
                </div>
                <input
                  type="text"
                  value={searchKetentuanPlatform}
                  onChange={(e) => setSearchKetentuanPlatform(e.target.value)}
                  placeholder="Cari Platform..."
                  className="w-full sm:w-64 border border-slate-300 rounded-xl px-3.5 py-2 text-xs outline-none"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 text-center w-12">NO</th>
                      <th className="px-4 py-3">PLATFORM CLIENT</th>
                      <th className="px-4 py-3 text-center">BLACKLIST STREAMER</th>
                      <th className="px-4 py-3 text-center">PRIORITAS STREAMER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients
                      .filter((c) => !searchKetentuanPlatform || c.namaClient.toLowerCase().includes(searchKetentuanPlatform.toLowerCase()))
                      .map((c, idx) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div>{c.namaClient}</div>
                            <div className="text-[10px] text-slate-400">{c.platform}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400 italic">Tidak ada blacklist</td>
                          <td className="px-4 py-3 text-center text-slate-400 italic">Semua host memenuhi syarat</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subview 4: Export Jadwal */}
          {klienSubTab === "export" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
              <h3 className="font-extrabold text-slate-900 text-sm">Tarik Data Jadwal Klien (Export ke Master Form)</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="w-full sm:w-64">
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
                    const matched = allJadwal.filter((j) => j.tanggal?.startsWith(exportTanggalKlien));
                    setExportPreviewData(matched);
                    showAlert(`✅ Ditemukan ${matched.length} jadwal pada tanggal ${exportTanggalKlien}.`);
                  }}
                  className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <i className="fa-solid fa-magnifying-glass" /> Tarik Data
                </button>
              </div>

              {exportPreviewData.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Preview Data ({exportPreviewData.length} Jadwal)</span>
                    <button
                      type="button"
                      onClick={() => showAlert("✅ Salinan ploting jadwal berhasil dibuat!")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-file-export" /> Buat Salinan untuk Ploting
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-center">NO</th>
                          <th className="px-3 py-2">ID JADWAL</th>
                          <th className="px-3 py-2">BRAND</th>
                          <th className="px-3 py-2">WAKTU</th>
                          <th className="px-3 py-2">STREAMER</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exportPreviewData.map((j, idx) => (
                          <tr key={j.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-center font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-[#941A0B]">{j.idJadwal}</td>
                            <td className="px-3 py-2 font-bold">{j.client?.namaClient || j.platform}</td>
                            <td className="px-3 py-2">
                              {new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-3 py-2">{j.streamerKaryawan?.namaLengkap || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subview 5: Import Jadwal */}
          {klienSubTab === "import" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
              <div className="flex gap-3 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setImportModePloting("baru")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    importModePloting === "baru" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-file-circle-plus" /> Data Baru
                </button>
                <button
                  type="button"
                  onClick={() => setImportModePloting("revisi")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    importModePloting === "revisi" ? "bg-[#941A0B] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-file-pen" /> Revisi Masal
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMetodePloting === "excel"}
                      onChange={() => setImportMetodePloting("excel")}
                      className="text-[#941A0B]"
                    />
                    File Excel (.xlsx)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMetodePloting === "link"}
                      onChange={() => setImportMetodePloting("link")}
                      className="text-[#941A0B]"
                    />
                    Link Google Sheets
                  </label>
                </div>

                {importMetodePloting === "excel" ? (
                  <div>
                    <label className={labelCls}>Unggah File Excel Ploting</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-[#941A0B] hover:file:bg-red-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50"
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Tautan Google Sheets Ploting</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => showAlert("✅ Menghubungkan tautan Google Sheets...")}
                        className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                      >
                        Tarik Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MARKETPLACE                                                        */}
      {/* ========================================================================= */}
      {mainTab === "marketplace" && (
        <form onSubmit={submitMarketplaceSchedules} className="space-y-6">
          <div className="space-y-4">
            {marketplaceForms.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-[#941A0B] text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900">Pengajuan Marketplace #{idx + 1}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>ID Pengajuan</label>
                    <input
                      type="text"
                      value={item.idJadwal}
                      readOnly
                      className={`${inputCls} bg-[#F1F1F1] text-slate-700 font-mono font-bold cursor-not-allowed`}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Brand Klien *</label>
                    <select
                      value={item.clientId}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].clientId = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={selectCls}
                      required
                    >
                      <option value="">-- Pilih Brand Klien --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.namaClient} {c.platform ? `(${c.platform})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Platform Marketplace *</label>
                    <select
                      value={item.platform}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].platform = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={selectCls}
                      required
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Tanggal Live *</label>
                    <input
                      type="date"
                      value={item.tanggal}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        const v = e.target.value;
                        const updated = [...marketplaceForms];
                        updated[idx].tanggal = v;
                        updated[idx].jamMulaiLive = `${v}T18:00`;
                        updated[idx].jamSelesaiLive = `${v}T21:00`;
                        setMarketplaceForms(updated);
                      }}
                      className={dateInputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Waktu Mulai *</label>
                    <input
                      type="datetime-local"
                      value={item.jamMulaiLive}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].jamMulaiLive = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={dateInputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Waktu Selesai *</label>
                    <input
                      type="datetime-local"
                      value={item.jamSelesaiLive}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].jamSelesaiLive = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={dateInputCls}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setMarketplaceForms([
                  ...marketplaceForms,
                  {
                    id: Date.now(),
                    idJadwal: generateNewScheduleId("MKT"),
                    tanggal: new Date().toISOString().slice(0, 10),
                    platform: "TikTok Shop",
                    clientId: "",
                    streamerKaryawanId: "",
                    cabangStudio: "Timoho",
                    nomorStudio: "01",
                    jamMulaiLive: `${new Date().toISOString().slice(0, 10)}T18:00`,
                    jamSelesaiLive: `${new Date().toISOString().slice(0, 10)}T21:00`,
                    judulLive: "Pengajuan Campaign Marketplace",
                    produkPrioritas: "",
                    promoLive: "",
                  },
                ]);
              }}
              className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 20)
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCheckBebasCrash}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 text-sm"
              >
                <i className="fa-solid fa-shield-halved" /> Bebas Crash
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-paper-plane"}`} />
                <span>{loading ? "Mengirim..." : "Kirim Semua Pengajuan"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: HYBRID LIVE (Export Template & Import Jadwal)                       */}
      {/* ========================================================================= */}
      {mainTab === "hybrid" && (
        <div className="space-y-6">
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setHybridSubTab("export")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                hybridSubTab === "export" ? "border-[#941A0B] text-[#941A0B]" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <i className="fa-solid fa-download mr-1.5" /> Export Template
            </button>
            <button
              type="button"
              onClick={() => setHybridSubTab("import")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
                hybridSubTab === "import" ? "border-[#941A0B] text-[#941A0B]" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <i className="fa-solid fa-upload mr-1.5" /> Import Jadwal
            </button>
          </div>

          {hybridSubTab === "export" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 max-w-3xl">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-export text-[#941A0B]" />
                Panduan Pengunduhan Template Master Form
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Silakan klik tombol <strong>Salin Template</strong> di bawah ini untuk membuka template spreadsheet master jadwal.<br />
                2. Pastikan file menggunakan format nama: <strong>Jadwal Potensi YYYY-MM-DD (Nama Pengguna)</strong>.
              </p>
              <button
                type="button"
                onClick={() => showAlert("✅ Template Spreadsheet disalin! Format: Jadwal Potensi YYYY-MM-DD")}
                className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-6 rounded-xl text-xs transition shadow-md inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-download" /> Salin Template
              </button>
            </div>
          )}

          {hybridSubTab === "import" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5 max-w-3xl">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setHybridImportMode("baru")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    hybridImportMode === "baru" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-plus mr-1.5" /> Impor Jadwal Baru
                </button>
                <button
                  type="button"
                  onClick={() => setHybridImportMode("revisi")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    hybridImportMode === "revisi" ? "bg-[#941A0B] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-pen mr-1.5" /> Revisi Masal
                </button>
              </div>

              {hybridImportMode === "revisi" && (
                <div>
                  <label className={labelCls}>ID Hybrid Live Lama</label>
                  <input
                    type="text"
                    value={hybridOldId}
                    onChange={(e) => setHybridOldId(e.target.value)}
                    placeholder="Masukkan ID Hybrid Live..."
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Unggah File Excel (.xlsx / .csv)</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-[#941A0B] hover:file:bg-red-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCheckBebasCrash}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <i className="fa-solid fa-shield-halved mr-1.5" /> Bebas Crash
                </button>
                <button
                  type="button"
                  onClick={() => showAlert("✅ Semua data Hybrid Live berhasil disimpan ke server!")}
                  className="px-6 py-2.5 bg-[#941A0B] hover:bg-[#7D1509] text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <i className="fa-solid fa-cloud-arrow-up mr-1.5" /> Simpan Semua Jadwal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: KENDALI FORM                                                       */}
      {/* ========================================================================= */}
      {mainTab === "kendali" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-[#941A0B]" />
                Pusat Kendali Pengajuan Streamer
              </h2>
              <p className="text-slate-500 text-xs">
                Gunakan tombol di bawah ini untuk membuka (ON) atau menutup (OFF) akses form pengajuan di Streamer Dashboard secara real-time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Pengajuan Libur */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-calendar-xmark text-[#941A0B]" />
                    Pengajuan Libur
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Kontrol akses form pengajuan libur mingguan streamer.</p>
                  <div className="mt-2 text-[11px] font-semibold">
                    Status Saat Ini:{" "}
                    <span className={kendaliConfig?.allowLiburRequest !== false ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                      {kendaliConfig?.allowLiburRequest !== false ? "🟢 TERBUKA (ON)" : "🔴 DITUTUP (OFF)"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={kendaliLoading}
                    onClick={() => handleToggleFitur("LIBUR", "ON")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      kendaliConfig?.allowLiburRequest !== false
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    disabled={kendaliLoading}
                    onClick={() => handleToggleFitur("LIBUR", "OFF")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      kendaliConfig?.allowLiburRequest === false
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-red-50 hover:text-red-700"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Card 2: Pengajuan Sesi Live */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-video text-[#941A0B]" />
                    Pengajuan Sesi Live
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Kontrol form Request Sesi Live (00-08 / 08-16 / 16-00).</p>
                  <div className="mt-2 text-[11px] font-semibold">
                    Status Saat Ini:{" "}
                    <span className={kendaliConfig?.allowShiftRequest !== false ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                      {kendaliConfig?.allowShiftRequest !== false ? "🟢 TERBUKA (ON)" : "🔴 DITUTUP (OFF)"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={kendaliLoading}
                    onClick={() => handleToggleFitur("SHIFT", "ON")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      kendaliConfig?.allowShiftRequest !== false
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    disabled={kendaliLoading}
                    onClick={() => handleToggleFitur("SHIFT", "OFF")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      kendaliConfig?.allowShiftRequest === false
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-red-50 hover:text-red-700"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Form Pengaturan Kuota */}
            <form onSubmit={handleSaveQuota} className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-calculator text-[#941A0B]" />
                Pengaturan Kuota Default Streamer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Kuota Default Libur (Hari / Bulan)</label>
                  <input
                    type="number"
                    min={0}
                    value={quotaForm.defaultKuotaLibur}
                    onChange={(e) => setQuotaForm({ ...quotaForm, defaultKuotaLibur: parseInt(e.target.value, 10) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Kuota Default Request Sesi Live (Kali / Bulan)</label>
                  <input
                    type="number"
                    min={0}
                    value={quotaForm.defaultKuotaShift}
                    onChange={(e) => setQuotaForm({ ...quotaForm, defaultKuotaShift: parseInt(e.target.value, 10) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={kendaliLoading}
                  className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <span>{kendaliLoading ? "Menyimpan..." : "Simpan Pengaturan Kuota"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MONITORING TABEL JADWAL SESI TERDAFTAR (Selalu Aktif di Bawah)             */}
      {/* ========================================================================= */}
      {(() => {
        const filteredJadwal = recentJadwal.filter((j) => {
          if (!tableSearchQuery.trim()) return true;
          const q = tableSearchQuery.toLowerCase().trim();
          return (
            j.idJadwal?.toLowerCase().includes(q) ||
            j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
            j.client?.namaClient?.toLowerCase().includes(q) ||
            j.cabangStudio?.toLowerCase().includes(q) ||
            j.platform?.toLowerCase().includes(q) ||
            j.status?.toLowerCase().includes(q)
          );
        });

        const totalTablePages = Math.max(1, Math.ceil(filteredJadwal.length / tablePageSize));
        const currentTablePage = Math.min(tablePage, totalTablePages);
        const startIndex = (currentTablePage - 1) * tablePageSize;
        const endIndex = Math.min(startIndex + tablePageSize, filteredJadwal.length);
        const paginatedJadwal = filteredJadwal.slice(startIndex, endIndex);

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Jadwal Sesi Terdaftar</h3>
                <span className="text-xs text-slate-500">
                  {filteredJadwal.length} sesi termonitor (Total: {recentJadwal.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tableSearchQuery}
                  placeholder="Cari ID, Host, Studio..."
                  onChange={(e) => {
                    setTableSearchQuery(e.target.value);
                    setTablePage(1);
                  }}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white shadow-sm"
                />

                <select
                  value={tablePageSize}
                  onChange={(e) => {
                    setTablePageSize(Number(e.target.value));
                    setTablePage(1);
                  }}
                  className="px-2 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white outline-none focus:ring-2 focus:ring-[#941A0B] shadow-sm"
                >
                  <option value={5}>5 / hlm</option>
                  <option value={10}>10 / hlm</option>
                  <option value={20}>20 / hlm</option>
                  <option value={50}>50 / hlm</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#941A0B] text-white font-extrabold">
                  <tr>
                    <th className="px-4 py-3">ID Jadwal</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Streamer</th>
                    <th className="px-4 py-3">Studio</th>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedJadwal.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                        Tidak ada jadwal sesi yang cocok.
                      </td>
                    </tr>
                  ) : (
                    paginatedJadwal.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-[#941A0B]">{j.idJadwal}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {j.platform ?? "General"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {j.streamerKaryawan?.namaLengkap ?? "Belum di-assign"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {j.cabangStudio ? `${j.cabangStudio} #${j.nomorStudio ?? "01"}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-[11px]">
                            {new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(j.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {j.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!j.streamerKaryawanId && j.status !== "SELESAI" && (
                            <button
                              onClick={() => {
                                setAssignJadwalId(j.id);
                                setAssignStreamerId("");
                                setAssignModalOpen(true);
                              }}
                              className="px-3 py-1 bg-[#941A0B] hover:bg-[#7D1509] text-white text-[10px] font-bold rounded-lg transition shadow-sm"
                            >
                              Assign Streamer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredJadwal.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 font-medium">
                  Menampilkan <span className="font-semibold text-slate-700">{startIndex + 1}</span> -{" "}
                  <span className="font-semibold text-slate-700">{endIndex}</span> dari{" "}
                  <span className="font-semibold text-slate-700">{filteredJadwal.length}</span> sesi
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentTablePage <= 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40 font-medium transition shadow-sm"
                  >
                    Sebelumnya
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalTablePages }, (_, idx) => idx + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setTablePage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                          pageNum === currentTablePage
                            ? "bg-[#941A0B] text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-200/60"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={currentTablePage >= totalTablePages}
                    onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-40 font-medium transition shadow-sm"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal Bebas Crash */}
      {modalCrashData.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-blue-600" />
                <span>Hasil Pengecekan Bebas Crash</span>
              </h3>
              <button
                onClick={() => setModalCrashData((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-red-500"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            {modalCrashData.isSafe ? (
              <div className="text-emerald-600 font-bold flex flex-col items-center justify-center gap-3 py-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-3xl mb-2">
                  <i className="fa-solid fa-check" />
                </div>
                <span className="text-lg">{modalCrashData.title}</span>
                <span className="text-sm font-normal text-slate-500">
                  Gembok keamanan telah dibuka.<br />Anda sekarang dapat menyimpan jadwal.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-red-500 font-bold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>Ditemukan {modalCrashData.conflicts.length} Jadwal Bentrok!</span>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto border p-3 rounded-xl bg-red-50/50 text-xs">
                  {modalCrashData.conflicts.map((c, i) => (
                    <div key={i} className="pb-2 border-b border-red-100 last:border-0 last:pb-0 space-y-1">
                      <b className="text-red-600">Terindikasi: {c.type}</b>
                      <div className="grid grid-cols-[auto_1fr] gap-2 items-start text-slate-700">
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Form #{c.form1}</span>
                        <div>{c.info1}</div>
                      </div>
                      <div className="text-center text-red-300 text-[10px]"><i className="fa-solid fa-arrow-down" /> menabrak <i className="fa-solid fa-arrow-down" /></div>
                      <div className="grid grid-cols-[auto_1fr] gap-2 items-start text-slate-700">
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Form #{c.form2}</span>
                        <div>{c.info2}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-red-500 font-medium text-xs bg-red-50 p-2 rounded-lg border border-red-100">
                  ⚠️ Silakan koreksi form yang bermasalah, lalu tekan tombol Bebas Crash lagi.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalCrashData((prev) => ({ ...prev, isOpen: false }))}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Assign Streamer</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className={labelCls}>Pilih Streamer</label>
              <select
                value={assignStreamerId}
                onChange={(e) => setAssignStreamerId(e.target.value)}
                className={selectCls}
              >
                <option value="">-- Pilih Streamer --</option>
                {streamers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaLengkap} ({s.idKaryawan})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                disabled={loading || !assignStreamerId}
                className="bg-[#941A0B] hover:bg-[#7D1509] text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Assign Sesi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
