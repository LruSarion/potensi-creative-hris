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

function formatTimeSafe(val: any): string {
  if (!val) return "–";
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    if (typeof val === "string" && val.includes(":")) return val.slice(0, 5);
    return String(val);
  }
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateSafe(val: any, options?: Intl.DateTimeFormatOptions): string {
  if (!val) return "–";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("id-ID", options || { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function calcWajibHadir(jamMulaiVal: any): string {
  if (!jamMulaiVal) return "–";
  const d = new Date(jamMulaiVal);
  if (isNaN(d.getTime())) return "15 Menit Sebelum";
  d.setMinutes(d.getMinutes() - 15);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB";
}

function formatTimeOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (val.includes("T")) {
      const timePart = val.split("T")[1];
      return timePart ? timePart.slice(0, 5) : "";
    }
    if (val.includes(":")) return val.slice(0, 5);
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function formatDateOnly(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatRowItem(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  return `${item.id || item.idKaryawan || "-"} | ${item.nama || item.namaLengkap || "Streamer"}`;
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

  // Dynamic Platform Client options mapped from Database Clients (Nama Merk / Brand + Marketplace)
  const platformClientOptions = React.useMemo(() => {
    const options: Array<{ label: string; value: string; clientId: string }> = [];
    const seen = new Set<string>();

    if (Array.isArray(clients) && clients.length > 0) {
      for (const c of clients) {
        const brand = (c.namaMerk || c.namaClient || "").trim();
        const k0 = c.ketentuan?.[0];
        const mps = [k0?.marketplace1 || c.platform, k0?.marketplace2, k0?.marketplace3]
          .filter(Boolean)
          .map((m: string) => m.trim());
        const finalMps = mps.length > 0 ? mps : [c.platform || "Shopee Live"];

        for (const mp of finalMps) {
          const label = brand ? `${brand} ${mp}` : mp;
          if (!seen.has(label)) {
            seen.add(label);
            options.push({ label, value: label, clientId: c.id });
          }
        }
      }
    }

    if (options.length === 0) {
      PLATFORMS.forEach((p) => options.push({ label: p, value: p, clientId: "" }));
    }

    return options;
  }, [clients]);

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

  // States for Streamer Live Master Table (Ref Deploy Subtab Jadwal Live format)
  const [liveFilterPeriode, setLiveFilterPeriode] = useState<
    "ALL" | "TODAY" | "PREV_7" | "NEXT_7" | "PREV_35" | "NEXT_35" | "EXACT_DATE" | "CUSTOM"
  >("ALL");
  const [liveFilterExactDate, setLiveFilterExactDate] = useState("");
  const [liveFilterRangeDate, setLiveFilterRangeDate] = useState("");
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

  function getWajibHadirTime(jamMulai?: string | null): string {
    if (!jamMulai) return "-";
    const parts = jamMulai.split(":");
    if (parts.length < 2) return "-";
    const hour = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (isNaN(hour) || isNaN(min)) return "-";
    let totalMin = hour * 60 + min - 15;
    if (totalMin < 0) totalMin += 24 * 60;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")} WIB`;
  }

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
          showAlert("⚠️ Maksimal Streamer yang dapat Libur dalam 1 hari adalah 20 Orang sesuai batasan sel Kolom Database.");
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
      jamMulaiLive: "",
      jamSelesaiLive: "",
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
  const [editJadwalForm, setEditJadwalForm] = useState<{
    id: string;
    idJadwal: string;
    tanggal: string;
    platform: string;
    clientId: string;
    streamerKaryawanId: string;
    streamerId: string;
    streamerNama: string;
    cabangStudio: string;
    nomorStudio: string;
    device: string;
    jamMulaiLive: string;
    jamSelesaiLive: string;
    otsKaryawanId: string;
    otsId: string;
    otsNama: string;
    judulLive: string;
    promoLive: string;
    catatanHost: string;
    catatanOts: string;
    status: string;
  }>({
    id: "",
    idJadwal: "",
    tanggal: "",
    platform: "",
    clientId: "",
    streamerKaryawanId: "",
    streamerId: "",
    streamerNama: "",
    cabangStudio: "Timoho",
    nomorStudio: "Studio 1",
    device: "Tidak Pakai",
    jamMulaiLive: "",
    jamSelesaiLive: "",
    otsKaryawanId: "",
    otsId: "",
    otsNama: "",
    judulLive: "",
    promoLive: "",
    catatanHost: "",
    catatanOts: "",
    status: "TERJADWAL",
  });
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
        const activeOnly = all.filter((e: any) => e.statusAktif === "AKTIF" || !e.statusAktif);

        // Host Streamer: Streamer Dedicated and Streamer On-Call, status Aktif
        const strList = activeOnly.filter((e: any) => {
          const j = (e.jabatan || "").toLowerCase().trim();
          return j.includes("streamer dedicated") || j.includes("streamer on-call") || j === "streamer dedicated" || j === "streamer on-call";
        });

        // OTS Staff: Operator Technical Support, status Aktif
        const otsList = activeOnly.filter((e: any) => {
          const j = (e.jabatan || "").toLowerCase().trim();
          return j.includes("operator technical support") || j === "operator technical support" || j === "ots";
        });

        setStreamers(strList);
        setOtsStaff(otsList);
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
          jamMulaiLive: "",
          jamSelesaiLive: "",
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

  // Populate and Select target schedule for Edit (Tab 3)
  function populateEditJadwalForm(target: any) {
    setSelectedEditJadwal(target);
    setEditJadwalForm({
      id: target.id,
      idJadwal: target.idJadwal || "",
      tanggal: formatDateOnly(target.tanggal),
      platform: target.platform || (platformClientOptions[0]?.value || "Shopee Live"),
      clientId: target.clientId || target.client?.id || "",
      streamerKaryawanId: target.streamerKaryawanId || target.streamerKaryawan?.id || "",
      streamerId: target.streamerKaryawan?.idKaryawan || target.idHost || "-",
      streamerNama: target.streamerKaryawan?.namaLengkap || target.streamerNama || "-",
      cabangStudio: target.cabangStudio || "Timoho",
      nomorStudio: target.nomorStudio || "Studio 1",
      device: target.device || "Tidak Pakai",
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
  }

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
        j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
        j.client?.namaClient?.toLowerCase().includes(q)
      );
    });

    if (target) {
      populateEditJadwalForm(target);
    } else {
      showAlert("⚠️ Jadwal target tidak ditemukan untuk tanggal/filter yang dipilih.");
    }
  }

  // Save Edit Schedule
  async function handleSaveEditJadwal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEditJadwal || !editJadwalForm.id) return;
    setSavingEditJadwal(true);

    try {
      const startTime = editJadwalForm.jamMulaiLive.includes("T")
        ? editJadwalForm.jamMulaiLive
        : `${editJadwalForm.tanggal}T${editJadwalForm.jamMulaiLive.length === 5 ? `${editJadwalForm.jamMulaiLive}:00` : editJadwalForm.jamMulaiLive}`;
      const endTime = editJadwalForm.jamSelesaiLive.includes("T")
        ? editJadwalForm.jamSelesaiLive
        : `${editJadwalForm.tanggal}T${editJadwalForm.jamSelesaiLive.length === 5 ? `${editJadwalForm.jamSelesaiLive}:00` : editJadwalForm.jamSelesaiLive}`;

      const payload: any = {
        idJadwal: editJadwalForm.idJadwal,
        tanggal: `${editJadwalForm.tanggal}T00:00:00.000Z`,
        platform: editJadwalForm.platform,
        clientId: editJadwalForm.clientId || undefined,
        streamerKaryawanId: editJadwalForm.streamerKaryawanId || undefined,
        otsKaryawanId: editJadwalForm.otsKaryawanId || undefined,
        cabangStudio: editJadwalForm.cabangStudio,
        nomorStudio: editJadwalForm.nomorStudio,
        jamMulaiLive: startTime,
        jamSelesaiLive: endTime,
        judulLive: editJadwalForm.judulLive,
        promoLive: editJadwalForm.promoLive,
        catatanHost: editJadwalForm.catatanHost,
        catatanOts: editJadwalForm.catatanOts,
        status: editJadwalForm.status,
      };

      const res = await fetch(`/api/jadwal?id=${editJadwalForm.id}`, {
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

  function renderStreamerLiveTable() {
    const filtered = allJadwal.filter((j) => {
      if (j.idJadwal?.startsWith("OTS")) return false;

      // 1. Filter Periode
      const jDateStr = j.tanggal ? new Date(j.tanggal).toISOString().slice(0, 10) : "";
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      if (liveFilterPeriode === "TODAY") {
        if (jDateStr !== todayStr) return false;
      } else if (liveFilterPeriode === "PREV_7") {
        const d7 = new Date(today);
        d7.setDate(today.getDate() - 7);
        const d7Str = d7.toISOString().slice(0, 10);
        if (jDateStr < d7Str || jDateStr > todayStr) return false;
      } else if (liveFilterPeriode === "NEXT_7") {
        const d7 = new Date(today);
        d7.setDate(today.getDate() + 7);
        const d7Str = d7.toISOString().slice(0, 10);
        if (jDateStr < todayStr || jDateStr > d7Str) return false;
      } else if (liveFilterPeriode === "PREV_35") {
        const d35 = new Date(today);
        d35.setDate(today.getDate() - 35);
        const d35Str = d35.toISOString().slice(0, 10);
        if (jDateStr < d35Str || jDateStr > todayStr) return false;
      } else if (liveFilterPeriode === "NEXT_35") {
        const d35 = new Date(today);
        d35.setDate(today.getDate() + 35);
        const d35Str = d35.toISOString().slice(0, 10);
        if (jDateStr < todayStr || jDateStr > d35Str) return false;
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
      if (liveFilterCol === "1") {
        // Status
        if (liveFilterStatus) {
          const jStatus = (j.status || "").toUpperCase();
          const jLiveState = (j.liveState || "").toUpperCase();
          if (liveFilterStatus === "ON AIR") {
            if (jLiveState !== "LIVE") return false;
          } else {
            if (jStatus !== liveFilterStatus) return false;
          }
        }
      } else if (liveFilterCol === "6") {
        // Cabang & Studio
        if (liveFilterCabang) {
          const cStr = `${j.cabangStudio || ""} ${j.studio || ""}`.toLowerCase();
          if (!cStr.includes(liveFilterCabang.toLowerCase())) return false;
        }
        if (liveFilterStudio) {
          const sStr = `${j.nomorStudio || ""} ${j.studio || ""}`.toLowerCase();
          if (!sStr.includes(liveFilterStudio.toLowerCase())) return false;
        }
      } else {
        if (liveFilterText.trim()) {
          const q = liveFilterText.toLowerCase().trim();
          if (liveFilterCol === "0") {
            // ID Jadwal
            if (!j.idJadwal?.toLowerCase().includes(q)) return false;
          } else if (liveFilterCol === "3") {
            // Platform & Brand
            const matchBrand = j.client?.namaClient?.toLowerCase().includes(q);
            const matchPlat = j.platform?.toLowerCase().includes(q);
            if (!matchBrand && !matchPlat) return false;
          } else if (liveFilterCol === "5") {
            // Nama Streamer
            const matchName = j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) || j.streamerNama?.toLowerCase().includes(q);
            if (!matchName) return false;
          } else if (liveFilterCol === "4") {
            // ID Host
            const matchId = j.streamerKaryawan?.idKaryawan?.toLowerCase().includes(q) || j.streamerId?.toLowerCase().includes(q);
            if (!matchId) return false;
          } else {
            // ALL Kolom
            const matchAll =
              j.idJadwal?.toLowerCase().includes(q) ||
              j.streamerKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
              j.streamerKaryawan?.idKaryawan?.toLowerCase().includes(q) ||
              j.client?.namaClient?.toLowerCase().includes(q) ||
              j.platform?.toLowerCase().includes(q) ||
              j.cabangStudio?.toLowerCase().includes(q) ||
              j.status?.toLowerCase().includes(q);
            if (!matchAll) return false;
          }
        }
      }

      return true;
    });

    const totalTablePages = Math.max(1, Math.ceil(filtered.length / livePageSize));
    const currentTablePage = Math.min(livePage, totalTablePages);
    const startIndex = (currentTablePage - 1) * livePageSize;
    const endIndex = Math.min(startIndex + livePageSize, filtered.length);
    const paginated = filtered.slice(startIndex, endIndex);

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        {/* Header Title Bar */}
        <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <i className="fa-solid fa-video text-[#941A0B]" />
              <span>Jadwal Live Streaming</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Menampilkan {filtered.length} sesi siaran live (Total: {allJadwal.filter((j) => !j.idJadwal?.startsWith("OTS")).length} sesi)
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            {filtered.length} Sesi Terjadwal
          </span>
        </div>

        {/* 4-BLOCK MASTER FILTER (Grid 4 Kolom @ 25% matching ref-deploy) */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start w-full">
            {/* BLOK 1: Filter Periode (25%) */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Periode Waktu</label>
              <select
                value={liveFilterPeriode}
                onChange={(e) => {
                  setLiveFilterPeriode(e.target.value as any);
                  setLivePage(1);
                }}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors font-medium shadow-xs"
              >
                <option value="ALL">-- Semua Periode --</option>
                <option value="TODAY">Hari Ini</option>
                <option value="PREV_7">7 Hari Ke Belakang</option>
                <option value="NEXT_7">7 Hari Ke Depan</option>
                <option value="PREV_35">35 Hari Ke Belakang</option>
                <option value="NEXT_35">35 Hari Ke Depan</option>
                <option value="EXACT_DATE">Tentukan Tanggal...</option>
                <option value="CUSTOM">Kustom Periode...</option>
              </select>

              {liveFilterPeriode === "EXACT_DATE" && (
                <FlatpickrPicker
                  id="filterExactDateLive"
                  value={liveFilterExactDate}
                  placeholder="Pilih Tanggal..."
                  options={{ mode: "single", dateFormat: "Y-m-d" }}
                  onChange={(dateStr) => {
                    setLiveFilterExactDate(dateStr);
                    setLivePage(1);
                  }}
                />
              )}

              {liveFilterPeriode === "CUSTOM" && (
                <FlatpickrPicker
                  id="filterRangeDateLive"
                  value={liveFilterRangeDate}
                  placeholder="Pilih Rentang..."
                  options={{ mode: "range", dateFormat: "Y-m-d" }}
                  onChange={(dateStr, dates) => {
                    setLiveFilterRangeDate(dateStr);
                    if (dates.length === 2) {
                      setLiveFilterRangeStart(dates[0].toISOString().slice(0, 10));
                      setLiveFilterRangeEnd(dates[1].toISOString().slice(0, 10));
                    }
                    setLivePage(1);
                  }}
                />
              )}
            </div>

            {/* BLOK 2: Filter Rentang Jam (25%) */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rentang Waktu / Jam</label>
              <select
                value={liveFilterWaktuToggle}
                onChange={(e) => {
                  setLiveFilterWaktuToggle(e.target.value as any);
                  setLivePage(1);
                }}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors font-medium shadow-xs"
              >
                <option value="ALL">-- Semua Jam --</option>
                <option value="CUSTOM">Pilih Rentang Jam...</option>
              </select>

              {liveFilterWaktuToggle === "CUSTOM" && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={liveFilterJamMulai}
                    onChange={(e) => {
                      setLiveFilterJamMulai(e.target.value);
                      setLivePage(1);
                    }}
                    className="border border-slate-300 rounded-xl px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] w-full font-bold text-slate-800 shadow-xs"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="time"
                    value={liveFilterJamAkhir}
                    onChange={(e) => {
                      setLiveFilterJamAkhir(e.target.value);
                      setLivePage(1);
                    }}
                    className="border border-slate-300 rounded-xl px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] w-full font-bold text-slate-800 shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* BLOK 3: Pilihan Kolom Data (25%) */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Kolom</label>
              <select
                value={liveFilterCol}
                onChange={(e) => {
                  setLiveFilterCol(e.target.value as any);
                  setLivePage(1);
                }}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors font-medium shadow-xs"
              >
                <option value="ALL">-- Semua Data --</option>
                <option value="0">ID Jadwal</option>
                <option value="1">Status</option>
                <option value="3">Platform & Brand</option>
                <option value="5">Nama Streamer</option>
                <option value="4">ID Host</option>
                <option value="6">Cabang & Studio</option>
              </select>
            </div>

            {/* BLOK 4: Pencarian Teks & Dropdown Dinamis (25%) */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cari / Pilih Opsi</label>

              {liveFilterCol === "1" ? (
                <select
                  value={liveFilterStatus}
                  onChange={(e) => {
                    setLiveFilterStatus(e.target.value);
                    setLivePage(1);
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors font-medium shadow-xs"
                >
                  <option value="">-- Semua Status --</option>
                  <option value="TERJADWAL">TERJADWAL</option>
                  <option value="PREPARE">PREPARE</option>
                  <option value="ON AIR">ON AIR</option>
                  <option value="PERLU LAPOR">PERLU LAPOR</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="BATAL">BATAL / DIBATALKAN</option>
                </select>
              ) : liveFilterCol === "6" ? (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={liveFilterCabang}
                    onChange={(e) => {
                      setLiveFilterCabang(e.target.value);
                      setLivePage(1);
                    }}
                    className="border border-slate-300 rounded-xl px-2 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] font-medium shadow-xs"
                  >
                    <option value="">-- Cabang --</option>
                    <option value="Timoho">Timoho</option>
                    <option value="Berbah">Berbah</option>
                    <option value="Wiyoro">Wiyoro</option>
                  </select>
                  <select
                    value={liveFilterStudio}
                    onChange={(e) => {
                      setLiveFilterStudio(e.target.value);
                      setLivePage(1);
                    }}
                    className="border border-slate-300 rounded-xl px-2 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] font-medium shadow-xs"
                  >
                    <option value="">-- Studio --</option>
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
              ) : (
                <div className="relative w-full">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={liveFilterText}
                    placeholder="Ketik untuk mencari..."
                    onChange={(e) => {
                      setLiveFilterText(e.target.value);
                      setLivePage(1);
                    }}
                    className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#941A0B] bg-white shadow-xs font-medium"
                  />
                  {liveFilterText && (
                    <button
                      type="button"
                      onClick={() => {
                        setLiveFilterText("");
                        setLivePage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                    >
                      <i className="fa-solid fa-xmark text-sm" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TABEL DATA JADWAL LIVE (100% Match ref-deploy/streamer-dashboard.html) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative">
          <table className="w-full min-w-max text-left border-collapse whitespace-nowrap text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-100 z-30 shadow-[1px_0_0_#cbd5e1] text-center min-w-[50px]">NO</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider text-center min-w-[110px]">STATUS</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider min-w-[160px]">WAKTU LIVE</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider text-center min-w-[130px]">WAJIB HADIR</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider min-w-[180px]">PLATFORM & BRAND</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider min-w-[180px]">STREAMER & STUDIO</th>
                <th className="px-4 py-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider text-center min-w-[80px]">INFO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                    Belum ada data jadwal live streaming yang sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                paginated.map((j, idx) => {
                  const noBaris = (currentTablePage - 1) * livePageSize + idx + 1;
                  const tglStr = formatDateSafe(j.tanggal, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                  const jamStr = `${formatTimeSafe(j.jamMulaiLive)} - ${formatTimeSafe(j.jamSelesaiLive)} WIB`;
                  const wajibHadirStr = getWajibHadirTime(j.jamMulaiLive);

                  return (
                    <tr key={j.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 text-center font-bold text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#f1f5f9]">
                        {noBaris}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${
                          j.liveState === "LIVE"
                            ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            : j.status === "SELESAI"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : j.status === "DIBATALKAN" || j.status === "BATAL"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-[#941A0B]/10 text-[#941A0B] border-[#941A0B]/20"
                        }`}>
                          {j.liveState === "LIVE" ? "🔴 ON AIR" : j.status || "TERJADWAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-800 text-xs">{tglStr}</div>
                        <div className="font-bold text-emerald-600 text-[11px] mt-0.5">{jamStr}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700 bg-amber-50/50 rounded-lg">
                        <i className="fa-regular fa-clock text-amber-500 mr-1" />
                        {wajibHadirStr}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-xs">{j.client?.namaClient ?? "Brand Partner"}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-[#941A0B] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                            {j.platform ?? "Shopee Live"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">({j.idJadwal})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-800 text-xs">
                          {j.streamerKaryawan?.namaLengkap ?? j.streamerNama ?? "-"}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-mono font-semibold">{j.streamerKaryawan?.idKaryawan ?? j.streamerId ?? "-"}</span>
                          <span className="text-slate-300">•</span>
                          <span><i className="fa-solid fa-location-dot text-slate-400 mr-1" />{j.cabangStudio ?? j.studio ?? "Timoho"} {j.nomorStudio ? `(${j.nomorStudio})` : ""}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setModalDetailJadwalLive(j)}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold px-3 py-1.5 rounded-xl text-xs transition border border-blue-200 shadow-xs flex items-center gap-1 mx-auto"
                          title="Lihat Detail Info Jadwal"
                        >
                          <i className="fa-solid fa-circle-info" />
                          <span>Info</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span>
              Menampilkan <strong className="text-slate-800">{filtered.length === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-800">{endIndex}</strong> dari <strong className="text-slate-800">{filtered.length}</strong> jadwal
            </span>
            <select
              value={livePageSize}
              onChange={(e) => {
                setLivePageSize(Number(e.target.value));
                setLivePage(1);
              }}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white font-bold outline-none"
            >
              <option value={10}>10 / hal</option>
              <option value={20}>20 / hal</option>
              <option value={50}>50 / hal</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentTablePage <= 1}
              onClick={() => setLivePage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition shadow-xs text-xs"
            >
              Sebelumnya
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalTablePages }, (_, idx) => idx + 1).slice(0, 5).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setLivePage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    pageNum === currentTablePage
                      ? "bg-[#941A0B] text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentTablePage >= totalTablePages}
              onClick={() => setLivePage((p) => Math.min(totalTablePages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition shadow-xs text-xs"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderOtsScheduleTable() {
    const filtered = allJadwal.filter((j) => {
      if (!j.idJadwal?.startsWith("OTS") && !j.otsKaryawanId) return false;
      if (!tableSearchQuery.trim()) return true;
      const q = tableSearchQuery.toLowerCase().trim();
      return (
        j.idJadwal?.toLowerCase().includes(q) ||
        j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
        j.cabangStudio?.toLowerCase().includes(q) ||
        j.status?.toLowerCase().includes(q)
      );
    });

    const totalTablePages = Math.max(1, Math.ceil(filtered.length / tablePageSize));
    const currentTablePage = Math.min(tablePage, totalTablePages);
    const startIndex = (currentTablePage - 1) * tablePageSize;
    const endIndex = Math.min(startIndex + tablePageSize, filtered.length);
    const paginated = filtered.slice(startIndex, endIndex);

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 mt-6">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-calendar-week text-blue-600" />
              <span>Jadwal Kerja Operator & Technical Support</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoring jadwal operasional studio dan jam wajib hadir OTS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={tableSearchQuery}
                placeholder="Cari ID, OTS, Studio..."
                onChange={(e) => {
                  setTableSearchQuery(e.target.value);
                  setTablePage(1);
                }}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-medium"
              />
            </div>

            <select
              value={tablePageSize}
              onChange={(e) => {
                setTablePageSize(Number(e.target.value));
                setTablePage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-semibold"
            >
              <option value={5}>5 / hlm</option>
              <option value={10}>10 / hlm</option>
              <option value={20}>20 / hlm</option>
              <option value={50}>50 / hlm</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200 max-h-[520px]">
          <table className="min-w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3.5 py-3 text-center w-12">NO</th>
                <th className="px-4 py-3 text-center w-28 whitespace-nowrap">STATUS</th>
                <th className="px-4 py-3">WAKTU KERJA</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">WAJIB HADIR</th>
                <th className="px-3.5 py-3 text-center w-36">CATATAN</th>
                <th className="px-4 py-3">OTS / STAFF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                    Belum ada jadwal kerja OTS yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                paginated.map((j, idx) => {
                  const st = (j.status || "TERJADWAL").toUpperCase();
                  let badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
                  if (st === "SELESAI") badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
                  else if (st === "DIBATALKAN" || st === "REJECTED") badgeClass = "bg-red-100 text-red-700 border-red-200";
                  else if (st === "ON_GOING" || st === "BERJALAN" || j.liveState === "LIVE") badgeClass = "bg-rose-100 text-rose-700 border-rose-200 animate-pulse font-bold";
                  else if (st === "PENDING") badgeClass = "bg-amber-100 text-amber-700 border-amber-200";

                  return (
                    <tr key={j.id || idx} className="hover:bg-slate-50 transition">
                      <td className="px-3.5 py-3 text-center font-bold text-slate-400">{startIndex + idx + 1}</td>
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
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: <span className="text-blue-600 font-bold">{j.idJadwal || "–"}</span>
                          {j.platform && ` • ${j.platform}`}
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
                          <span className="text-slate-700 text-xs font-medium">{j.catatanOts || j.catatanHost}</span>
                        ) : (
                          <span className="text-slate-300 font-bold text-xs">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-slate-900">
                          {j.otsKaryawan?.namaLengkap || j.streamerKaryawan?.namaLengkap || "Belum Ditugaskan"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {j.otsKaryawan?.idKaryawan || j.streamerKaryawan?.idKaryawan || "–"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Menampilkan <span className="font-semibold text-slate-700">{startIndex + 1}</span> -{" "}
              <span className="font-semibold text-slate-700">{endIndex}</span> dari{" "}
              <span className="font-semibold text-slate-700">{filtered.length}</span> sesi
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
                {Array.from({ length: totalTablePages }, (_, idx) => idx + 1).slice(0, 5).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setTablePage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      pageNum === currentTablePage
                        ? "bg-blue-600 text-white shadow-sm"
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
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible relative mb-4">
                      {/* Header Card */}
                      <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center rounded-t-xl">
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
                                const v = e.target.value;
                                const opt = platformClientOptions.find((o) => o.value === v);
                                const updated = [...streamerForms];
                                updated[idx].platform = v;
                                if (opt?.clientId) updated[idx].clientId = opt.clientId;
                                setStreamerForms(updated);
                                setIsStreamerCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                              required
                            >
                              <option value="">-- Pilih Platform Client --</option>
                              {platformClientOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                      const isSesi1 =
                        r.jenis === "REQUEST_SESI_1" ||
                        r.jenis === "REQUEST_00_08" ||
                        (r.alasan || "").includes("00:00 - 08:00") ||
                        (r.alasan || "").includes("Sesi 1");
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
                      const isSesi2 =
                        r.jenis === "REQUEST_SESI_2" ||
                        r.jenis === "REQUEST_08_16" ||
                        (r.alasan || "").includes("08:00 - 16:00") ||
                        (r.alasan || "").includes("Sesi 2");
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
                      const isSesi3 =
                        r.jenis === "REQUEST_SESI_3" ||
                        r.jenis === "REQUEST_16_00" ||
                        (r.alasan || "").includes("16:00 - 00:00") ||
                        (r.alasan || "").includes("Sesi 3");
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
                                      onClick={() => bukaModalEditInfo(r.TANGGAL, r)}
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
                                    const aChecked = isStreamerSelected(stateEditInfo.LIBUR, a) ? 0 : 1;
                                    const bChecked = isStreamerSelected(stateEditInfo.LIBUR, b) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const isChecked = isStreamerSelected(stateEditInfo.LIBUR, s);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleStreamerInList("LIBUR", s)}
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
                                    const aChecked = isStreamerSelected(stateEditInfo.REQ_00_08, a) ? 0 : 1;
                                    const bChecked = isStreamerSelected(stateEditInfo.REQ_00_08, b) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const isChecked = isStreamerSelected(stateEditInfo.REQ_00_08, s);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleStreamerInList("REQ_00_08", s)}
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
                                    const aChecked = isStreamerSelected(stateEditInfo.REQ_08_16, a) ? 0 : 1;
                                    const bChecked = isStreamerSelected(stateEditInfo.REQ_08_16, b) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const isChecked = isStreamerSelected(stateEditInfo.REQ_08_16, s);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleStreamerInList("REQ_08_16", s)}
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
                                    const aChecked = isStreamerSelected(stateEditInfo.REQ_16_00, a) ? 0 : 1;
                                    const bChecked = isStreamerSelected(stateEditInfo.REQ_16_00, b) ? 0 : 1;
                                    return aChecked - bChecked;
                                  })
                                  .map((s: any) => {
                                    const isChecked = isStreamerSelected(stateEditInfo.REQ_16_00, s);
                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => toggleStreamerInList("REQ_16_00", s)}
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

          {/* Tabel Jadwal Live di Bawah Formulir Streamer (Semua Subtab) */}
          {renderStreamerLiveTable()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: JADWAL OTS                                                         */}
      {/* ========================================================================= */}
      {mainTab === "ots" && (
        <div className="space-y-6">
          <form onSubmit={submitOtsSchedules} className="space-y-6">
            <div className="space-y-4">
              {otsForms.map((item, idx) => {
                const headTitle = item.tanggal && item.otsNama
                  ? `${item.tanggal} | ${item.cabangStudio} | ${item.otsNama}`
                  : `Jadwal OTS Baru`;

                return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible relative mb-4">
                    {/* Header Card */}
                    <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center rounded-t-xl">
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
                            <option value="">-- Pilih / Ketik Nama OTS --</option>
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
                              placeholder="Nama Auto"
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
                              type="time"
                              value={item.jamMulaiLive || ""}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => {
                                const updated = [...otsForms];
                                updated[idx].jamMulaiLive = e.target.value;
                                setOtsForms(updated);
                                setIsOtsCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-slate-800 shadow-xs cursor-pointer"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Keluar *</label>
                            <input
                              type="time"
                              value={item.jamSelesaiLive || ""}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              onChange={(e) => {
                                const updated = [...otsForms];
                                updated[idx].jamSelesaiLive = e.target.value;
                                setOtsForms(updated);
                                setIsOtsCrashVerified(false);
                              }}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-slate-800 shadow-xs cursor-pointer"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan OTS / Pekerjaan</label>
                          <input
                            type="text"
                            value={item.catatanOts || ""}
                            placeholder="Catatan penugasan studio..."
                            onChange={(e) => {
                              const updated = [...otsForms];
                              updated[idx].catatanOts = e.target.value;
                              setOtsForms(updated);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tombol Aksi OTS */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
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
                      nomorStudio: "01",
                      otsKaryawanId: "",
                      otsId: "",
                      otsNama: "",
                      shiftOts: "",
                      jamMulaiLive: "",
                      jamSelesaiLive: "",
                      catatanOts: "",
                    },
                  ]);
                  setIsOtsCrashVerified(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm border border-blue-200"
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

          {/* Tabel Jadwal OTS di Bawah Formulir */}
          {renderOtsScheduleTable()}
        </div>
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
                    ? "bg-blue-600 text-white shadow-md"
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
                      placeholder="Ketik ID Jadwal atau nama karyawan..."
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
                              j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
                              j.client?.namaClient?.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 20)
                          .map((j) => (
                            <div
                              key={j.id}
                              onMouseDown={() => {
                                setSearchEditId(j.idJadwal);
                                populateEditJadwalForm(j);
                                setShowEditJadwalDropdown(false);
                              }}
                              className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition"
                            >
                              <div>
                                <span className={`font-bold font-mono text-xs ${tipeRubah === "STREAMER" ? "text-[#941A0B]" : "text-blue-600"}`}>
                                  {j.idJadwal}
                                </span>
                                <span className="text-xs font-bold text-black ml-2">{j.client?.namaClient || j.platform || j.cabangStudio}</span>
                                <div className="text-[11px] text-slate-500">
                                  {tipeRubah === "STREAMER" ? (
                                    <>Host: <span className="text-slate-700 font-medium">{j.streamerKaryawan?.namaLengkap || "Belum di-assign"}</span></>
                                  ) : (
                                    <>OTS: <span className="text-slate-700 font-medium">{j.otsKaryawan?.namaLengkap || "Belum di-assign"}</span></>
                                  )}{" "}
                                  • Waktu:{" "}
                                  <span className="text-slate-700 font-mono">
                                    {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                tipeRubah === "STREAMER"
                                  ? "text-[#941A0B] bg-red-50 border-red-100"
                                  : "text-blue-700 bg-blue-50 border-blue-100"
                              }`}>
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
                    className={`${
                      tipeRubah === "STREAMER" ? "bg-[#941A0B] hover:bg-[#7D1509]" : "bg-blue-600 hover:bg-blue-700"
                    } text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-md flex-shrink-0`}
                  >
                    <i className="fa-solid fa-pen-to-square" /> Rubah Data
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Rubah Data Jadwal (Streamer) */}
          {selectedEditJadwal && tipeRubah === "STREAMER" && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Perbarui Kolom Data Jadwal Streamer</h2>
                  <p className="text-xs text-slate-400">Kolom Host Streamer dan Pendamping OTS dikunci untuk menjaga integritas penugasan.</p>
                </div>
                <span className="font-mono font-bold text-xs bg-red-50 text-[#941A0B] px-3 py-1 rounded-lg border border-red-200">
                  {editJadwalForm.idJadwal}
                </span>
              </div>

              <form onSubmit={handleSaveEditJadwal} className="space-y-5">
                {/* Row 1: Tanggal & Platform */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Tanggal Live *</label>
                    <input
                      type="date"
                      value={editJadwalForm.tanggal}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, tanggal: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Platform Client *</label>
                    <select
                      value={editJadwalForm.platform}
                      onChange={(e) => {
                        const v = e.target.value;
                        const opt = platformClientOptions.find((o) => o.value === v);
                        setEditJadwalForm({
                          ...editJadwalForm,
                          platform: v,
                          clientId: opt?.clientId || editJadwalForm.clientId,
                        });
                      }}
                      className={selectCls}
                      required
                    >
                      <option value="">-- Pilih Platform Client --</option>
                      {platformClientOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Host Streamer (Locked) & Staff OTS (Locked) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Host Streamer *</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <i className="fa-solid fa-lock mr-1" /> Dikunci
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editJadwalForm.streamerNama && editJadwalForm.streamerNama !== "-" ? `${editJadwalForm.streamerId} - ${editJadwalForm.streamerNama}` : "Belum di-assign"}
                      disabled
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-4 py-2.5 text-sm outline-none font-medium cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Staff OTS (Pendamping)</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <i className="fa-solid fa-lock mr-1" /> Dikunci
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editJadwalForm.otsNama && editJadwalForm.otsNama !== "-" ? `${editJadwalForm.otsId} - ${editJadwalForm.otsNama}` : "Tidak Ada Pendamping"}
                      disabled
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-4 py-2.5 text-sm outline-none font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Row 3: Cabang Studio, Nomor Studio, Device */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className={labelCls}>Cabang Studio *</label>
                    <select
                      value={editJadwalForm.cabangStudio}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, cabangStudio: e.target.value })}
                      className={selectCls}
                      required
                    >
                      <option value="Timoho">Timoho</option>
                      <option value="Berbah">Berbah</option>
                      <option value="Wiyoro">Wiyoro</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nomor Studio</label>
                    <select
                      value={editJadwalForm.nomorStudio}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, nomorStudio: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">Pilih Studio</option>
                      {["Studio 1", "Studio 2", "Studio 3", "Studio 4", "Studio 5", "Studio 6", "Studio 7", "Studio 8"].map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Device</label>
                    <select
                      value={editJadwalForm.device || "Tidak Pakai"}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, device: e.target.value })}
                      className={selectCls}
                    >
                      <option value="Tidak Pakai">Tidak Pakai</option>
                      <option value="Iphone XR Merah">Iphone XR Merah</option>
                      <option value="Iphone XR Putih">Iphone XR Putih</option>
                      <option value="Iphone XR Orange">Iphone XR Orange</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Jam Mulai, Jam Selesai, Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className={labelCls}>Jam Mulai *</label>
                    <input
                      type="time"
                      value={editJadwalForm.jamMulaiLive || ""}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, jamMulaiLive: e.target.value })}
                      className={`${inputCls} font-bold text-slate-800 cursor-pointer`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Jam Selesai *</label>
                    <input
                      type="time"
                      value={editJadwalForm.jamSelesaiLive || ""}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, jamSelesaiLive: e.target.value })}
                      className={`${inputCls} font-bold text-slate-800 cursor-pointer`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status Sesi</label>
                    <select
                      value={editJadwalForm.status}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, status: e.target.value })}
                      className={selectCls}
                    >
                      <option value="TERJADWAL">TERJADWAL</option>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="SELESAI">SELESAI</option>
                      <option value="DIBATALKAN">DIBATALKAN</option>
                    </select>
                  </div>
                </div>

                {/* Row 5: Judul Live, Promo Live, Catatan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Judul Live</label>
                      <input
                        type="text"
                        value={editJadwalForm.judulLive || ""}
                        onChange={(e) => setEditJadwalForm({ ...editJadwalForm, judulLive: e.target.value })}
                        placeholder="Judul streaming..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Promo Live</label>
                      <textarea
                        rows={2}
                        value={editJadwalForm.promoLive || ""}
                        onChange={(e) => setEditJadwalForm({ ...editJadwalForm, promoLive: e.target.value })}
                        placeholder="Catatan promo siaran..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Catatan Host</label>
                      <textarea
                        rows={2}
                        value={editJadwalForm.catatanHost || ""}
                        onChange={(e) => setEditJadwalForm({ ...editJadwalForm, catatanHost: e.target.value })}
                        placeholder="Catatan untuk Host..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Catatan OTS</label>
                      <textarea
                        rows={2}
                        value={editJadwalForm.catatanOts || ""}
                        onChange={(e) => setEditJadwalForm({ ...editJadwalForm, catatanOts: e.target.value })}
                        placeholder="Catatan untuk OTS..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedEditJadwal(null)}
                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditJadwal}
                    className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-2.5 px-8 rounded-xl transition shadow-md flex items-center gap-2 text-xs disabled:opacity-50"
                  >
                    <i className={`fa-solid ${savingEditJadwal ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEditJadwal ? "Menyimpan..." : "Simpan Perubahan Jadwal"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Form Rubah Data Jadwal (OTS) */}
          {selectedEditJadwal && tipeRubah === "OTS" && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Perbarui Kolom Data Jadwal OTS</h2>
                  <p className="text-xs text-slate-400">Kolom Staff OTS dikunci untuk menjaga integritas penugasan.</p>
                </div>
                <span className="font-mono font-bold text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
                  {editJadwalForm.idJadwal}
                </span>
              </div>

              <form onSubmit={handleSaveEditJadwal} className="space-y-5">
                {/* Row 1: Tanggal & Cabang */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Tanggal Penugasan *</label>
                    <input
                      type="date"
                      value={editJadwalForm.tanggal}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, tanggal: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Cabang Studio *</label>
                    <select
                      value={editJadwalForm.cabangStudio}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, cabangStudio: e.target.value })}
                      className={selectCls}
                      required
                    >
                      <option value="Timoho">Timoho</option>
                      <option value="Berbah">Berbah</option>
                      <option value="Wiyoro">Wiyoro</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Staff OTS (Locked) */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Staff OTS *</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <i className="fa-solid fa-lock mr-1" /> Dikunci
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editJadwalForm.otsNama && editJadwalForm.otsNama !== "-" ? `${editJadwalForm.otsId} - ${editJadwalForm.otsNama}` : "Belum Ditugaskan"}
                    disabled
                    readOnly
                    className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-4 py-2.5 text-sm outline-none font-medium cursor-not-allowed"
                  />
                </div>

                {/* Row 3: Pilih Shift, Jam Masuk, Jam Keluar, Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>Pilih Shift</label>
                    <select
                      value={editJadwalForm.shiftOts || ""}
                      onChange={(e) => {
                        const sVal = e.target.value;
                        const shiftTimes = applyShiftOts(sVal);
                        setEditJadwalForm({
                          ...editJadwalForm,
                          shiftOts: sVal,
                          ...(shiftTimes.masuk ? { jamMulaiLive: shiftTimes.masuk, jamSelesaiLive: shiftTimes.keluar } : {}),
                        });
                      }}
                      className={selectCls}
                    >
                      <option value="">Kustom</option>
                      <option value="07:00-15:00">Shift 1 (07:00-15:00)</option>
                      <option value="15:00-23:00">Shift 2 (15:00-23:00)</option>
                      <option value="23:00-07:00">Shift 3 (23:00-07:00)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Masuk *</label>
                    <input
                      type="time"
                      value={editJadwalForm.jamMulaiLive || ""}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, jamMulaiLive: e.target.value })}
                      className={`${inputCls} font-bold text-slate-800 cursor-pointer`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Keluar *</label>
                    <input
                      type="time"
                      value={editJadwalForm.jamSelesaiLive || ""}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, jamSelesaiLive: e.target.value })}
                      className={`${inputCls} font-bold text-slate-800 cursor-pointer`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status Sesi</label>
                    <select
                      value={editJadwalForm.status}
                      onChange={(e) => setEditJadwalForm({ ...editJadwalForm, status: e.target.value })}
                      className={selectCls}
                    >
                      <option value="TERJADWAL">TERJADWAL</option>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="SELESAI">SELESAI</option>
                      <option value="DIBATALKAN">DIBATALKAN</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Catatan OTS */}
                <div>
                  <label className={labelCls}>Catatan OTS / Pekerjaan</label>
                  <textarea
                    rows={2}
                    value={editJadwalForm.catatanOts || ""}
                    onChange={(e) => setEditJadwalForm({ ...editJadwalForm, catatanOts: e.target.value })}
                    placeholder="Catatan penugasan OTS..."
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedEditJadwal(null)}
                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditJadwal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl transition shadow-md flex items-center gap-2 text-xs disabled:opacity-50"
                  >
                    <i className={`fa-solid ${savingEditJadwal ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEditJadwal ? "Menyimpan..." : "Simpan Perubahan Jadwal"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabel Bawah Sesuai Subtab yang Dipilih */}
          {tipeRubah === "STREAMER" ? renderStreamerLiveTable() : renderOtsScheduleTable()}
        </div>
      )}
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

          </div>
        </div>
      )}


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
      {/* POPUP MODAL: INFO JADWAL LIVE DETAIL (ref-deploy format) */}
      {modalDetailJadwalLive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[160]">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Detail Info Sesi Live</span>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="font-mono text-[#941A0B]">{modalDetailJadwalLive.idJadwal}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    modalDetailJadwalLive.liveState === "LIVE"
                      ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                      : modalDetailJadwalLive.status === "SELESAI"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-[#941A0B]/10 text-[#941A0B] border-[#941A0B]/20"
                  }`}>
                    {modalDetailJadwalLive.liveState === "LIVE" ? "🔴 ON AIR" : modalDetailJadwalLive.status || "TERJADWAL"}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalDetailJadwalLive(null)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Waktu & Jadwal</span>
                <div className="font-bold text-slate-800">
                  {formatDateSafe(modalDetailJadwalLive.tanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
                <div className="text-emerald-600 font-bold">
                  {formatTimeSafe(modalDetailJadwalLive.jamMulaiLive)} - {formatTimeSafe(modalDetailJadwalLive.jamSelesaiLive)} WIB
                </div>
                <div className="text-amber-700 font-medium text-[11px]">
                  Wajib Hadir: {getWajibHadirTime(modalDetailJadwalLive.jamMulaiLive)}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Lokasi & Device</span>
                <div className="font-bold text-slate-800">
                  {modalDetailJadwalLive.cabangStudio ?? modalDetailJadwalLive.studio ?? "Timoho"}
                </div>
                <div className="text-slate-600 font-semibold">
                  {modalDetailJadwalLive.nomorStudio ? `Studio: ${modalDetailJadwalLive.nomorStudio}` : "Studio 1"}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Device: {modalDetailJadwalLive.device ?? "Tidak Pakai"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Host Streamer</span>
                <div className="font-bold text-slate-800">
                  {modalDetailJadwalLive.streamerKaryawan?.namaLengkap ?? modalDetailJadwalLive.streamerNama ?? "-"}
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  ID: {modalDetailJadwalLive.streamerKaryawan?.idKaryawan ?? modalDetailJadwalLive.streamerId ?? "-"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Staff OTS</span>
                <div className="font-bold text-slate-800">
                  {modalDetailJadwalLive.otsKaryawan?.namaLengkap ?? modalDetailJadwalLive.otsNama ?? "-"}
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  ID: {modalDetailJadwalLive.otsKaryawan?.idKaryawan ?? modalDetailJadwalLive.otsId ?? "-"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Brand & Platform</span>
                <div className="font-bold text-slate-900 text-sm">
                  {modalDetailJadwalLive.client?.namaClient ?? "Brand Partner"}
                </div>
                <div className="text-slate-600 font-medium">
                  Platform: <span className="font-bold text-[#941A0B]">{modalDetailJadwalLive.platform ?? "Shopee Live"}</span>
                </div>
                {modalDetailJadwalLive.judulLive && (
                  <div className="text-slate-600">
                    Judul Live: <span className="font-semibold text-slate-800">{modalDetailJadwalLive.judulLive}</span>
                  </div>
                )}
                {modalDetailJadwalLive.promoLive && (
                  <div className="text-slate-600">
                    Promo: <span className="font-semibold text-slate-800">{modalDetailJadwalLive.promoLive}</span>
                  </div>
                )}
                {modalDetailJadwalLive.produkPrioritas && (
                  <div className="text-slate-600">
                    Produk Prioritas: <span className="font-semibold text-slate-800">{modalDetailJadwalLive.produkPrioritas}</span>
                  </div>
                )}
              </div>

              {(modalDetailJadwalLive.catatanHost || modalDetailJadwalLive.catatanOts) && (
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-amber-700 font-bold uppercase">Catatan</span>
                  {modalDetailJadwalLive.catatanHost && (
                    <div className="text-slate-700"><strong>Host:</strong> {modalDetailJadwalLive.catatanHost}</div>
                  )}
                  {modalDetailJadwalLive.catatanOts && (
                    <div className="text-slate-700"><strong>OTS:</strong> {modalDetailJadwalLive.catatanOts}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalDetailJadwalLive(null)}
                className="px-6 py-2.5 bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold rounded-xl text-xs transition shadow-sm"
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
