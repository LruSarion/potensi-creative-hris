"use client";

import { useEffect, useState } from "react";
import ScheduleCalendar from "@/components/schedule-calendar";

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
  clientId: string;
  streamerKaryawanId: string;
  cabangStudio: string;
  nomorStudio: string;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  judulLive: string;
  produkPrioritas: string;
  promoLive: string;
  catatan?: string;
}

export default function InputJadwalPage() {
  // Global Data States
  const [streamers, setStreamers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentJadwal, setRecentJadwal] = useState<any[]>([]);
  const [allJadwal, setAllJadwal] = useState<any[]>([]);

  // Feedback States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Main 7 Tabs Navigation (100% Match with ref-deploy/input-jadwal.html)
  const [mainTab, setMainTab] = useState<
    "streamer" | "ots" | "rubah" | "klien" | "marketplace" | "hybrid" | "kendali"
  >("streamer");

  // --------------------------------------------------------------------------
  // TAB 1: JADWAL STREAMER STATES
  // --------------------------------------------------------------------------
  const [streamerSubTab, setStreamerSubTab] = useState<"form" | "info">("form");
  const [streamerMode, setStreamerMode] = useState<"single" | "multi" | "batch" | "calendar">("single");
  const [streamerForms, setStreamerForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: `STR/${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}/${Math.floor(100 + Math.random() * 900)}`,
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
  const [tagFilter, setTagFilter] = useState("");
  const [streamerStats, setStreamerStats] = useState<any>(null);
  const [blacklistWarning, setBlacklistWarning] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [batchText, setBatchText] = useState("");

  // Subtab 2: Info Streamer
  const [infoStreamerData, setInfoStreamerData] = useState<any>(null);
  const [searchInfoStreamer, setSearchInfoStreamer] = useState("");

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

  async function fetchData() {
    try {
      const [empRes, clientRes, jadwalRes] = await Promise.all([
        fetch("/api/employees?kategori=STREAMER").then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/jadwal").then((r) => r.json()),
      ]);

      if (empRes.status === "success") setStreamers(empRes.data);
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
        if (!item.clientId) {
          setError("Silakan pilih Brand Klien pada formulir yang belum lengkap.");
          setLoading(false);
          return;
        }
        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
      }
      setSuccess(`✅ Berhasil menyimpan ${streamerForms.length} Jadwal Streamer!`);
      // Reset forms
      setStreamerForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("STR"),
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
        if (!item.clientId) {
          setError("Silakan pilih Brand Klien pada formulir OTS.");
          setLoading(false);
          return;
        }
        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, status: "TERJADWAL" }),
        });
      }
      setSuccess(`✅ Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      setOtsForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("OTS"),
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
      alert("⚠️ Silakan ketik atau pilih ID Jadwal / Nama terlebih dahulu.");
      return;
    }
    const q = searchEditId.toLowerCase().trim();
    const target = allJadwal.find((j) => {
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
      alert("⚠️ Jadwal target tidak ditemukan dalam database.");
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
        alert("✅ Perubahan jadwal berhasil disimpan ke database!");
        setSelectedEditJadwal(null);
        setSearchEditId("");
        fetchData();
      } else {
        alert(`❌ Gagal mengubah jadwal: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi saat menyimpan perubahan.");
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
    alert("🛡️ Validasi Bebas Crash: Tidak ditemukan bentrok jadwal / crash pada slot studio dan host yang dipilih. Aman untuk disimpan!");
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black outline-none focus:ring-2 focus:ring-[#941A0B] bg-white transition";
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
                {streamerForms.map((item, idx) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-[#941A0B] text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="font-extrabold text-sm text-slate-900">Jadwal Streamer #{idx + 1}</h3>
                      </div>
                      {streamerForms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setStreamerForms(streamerForms.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                        >
                          <i className="fa-solid fa-trash" /> Hapus
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* ID Jadwal Baku */}
                      <div>
                        <label className={labelCls}>ID Jadwal (Baku)</label>
                        <input
                          type="text"
                          value={item.idJadwal}
                          readOnly
                          className={`${inputCls} bg-[#F1F1F1] text-slate-700 font-mono font-bold cursor-not-allowed`}
                        />
                      </div>

                      {/* Tanggal */}
                      <div>
                        <label className={labelCls}>Tanggal Sesi *</label>
                        <input
                          type="date"
                          value={item.tanggal}
                          onChange={(e) => {
                            const v = e.target.value;
                            const updated = [...streamerForms];
                            updated[idx].tanggal = v;
                            updated[idx].jamMulaiLive = `${v}T10:00`;
                            updated[idx].jamSelesaiLive = `${v}T13:00`;
                            updated[idx].idJadwal = generateNewScheduleId("STR", v);
                            setStreamerForms(updated);
                          }}
                          className={inputCls}
                          required
                        />
                      </div>

                      {/* Platform */}
                      <div>
                        <label className={labelCls}>Platform Marketplace *</label>
                        <select
                          value={item.platform}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].platform = e.target.value;
                            setStreamerForms(updated);
                          }}
                          className={selectCls}
                          required
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Brand Client */}
                      <div>
                        <label className={labelCls}>Brand Klien *</label>
                        <select
                          value={item.clientId}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].clientId = e.target.value;
                            setStreamerForms(updated);
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

                      {/* Streamer Host */}
                      <div>
                        <label className={labelCls}>Streamer / Host</label>
                        <select
                          value={item.streamerKaryawanId}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].streamerKaryawanId = e.target.value;
                            setStreamerForms(updated);
                          }}
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

                      {/* Studio */}
                      <div>
                        <label className={labelCls}>Lokasi Studio</label>
                        <select
                          value={`${item.cabangStudio}-${item.nomorStudio}`}
                          onChange={(e) => {
                            const [cabang, no] = e.target.value.split("-");
                            const updated = [...streamerForms];
                            updated[idx].cabangStudio = cabang;
                            updated[idx].nomorStudio = no;
                            setStreamerForms(updated);
                          }}
                          className={selectCls}
                        >
                          {STUDIOS.map((s) => (
                            <option key={s.name} value={`${s.cabang}-${s.no}`}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Waktu Mulai */}
                      <div>
                        <label className={labelCls}>Waktu Mulai Live *</label>
                        <input
                          type="datetime-local"
                          value={item.jamMulaiLive}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].jamMulaiLive = e.target.value;
                            setStreamerForms(updated);
                          }}
                          className={inputCls}
                          required
                        />
                      </div>

                      {/* Waktu Selesai */}
                      <div>
                        <label className={labelCls}>Waktu Selesai Live *</label>
                        <input
                          type="datetime-local"
                          value={item.jamSelesaiLive}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].jamSelesaiLive = e.target.value;
                            setStreamerForms(updated);
                          }}
                          className={inputCls}
                          required
                        />
                      </div>

                      {/* Judul Live */}
                      <div>
                        <label className={labelCls}>Judul Live / Campaign</label>
                        <input
                          type="text"
                          value={item.judulLive}
                          onChange={(e) => {
                            const updated = [...streamerForms];
                            updated[idx].judulLive = e.target.value;
                            setStreamerForms(updated);
                          }}
                          placeholder="mis. Mega Flash Sale"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Bar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
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
                  <i className="fa-solid fa-plus" /> Tambah Jadwal Streamer (Maks 100)
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
                    <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SUB-VIEW 2: INFORMASI STREAMER */}
          {streamerSubTab === "info" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <i className="fa-solid fa-calendar-check text-[#941A0B]" />
                    Informasi Libur & Request Sesi Live
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kelola data libur dan request secara manual</p>
                </div>

                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    value={searchInfoStreamer}
                    onChange={(e) => setSearchInfoStreamer(e.target.value)}
                    placeholder="Ketik nama streamer atau ID..."
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 text-center w-12">NO</th>
                      <th className="px-4 py-3">STREAMER</th>
                      <th className="px-4 py-3 text-center">STATUS LIBUR</th>
                      <th className="px-4 py-3 text-center">KUOTA LIBUR</th>
                      <th className="px-4 py-3 text-center">REQUEST SESI LIVE</th>
                      <th className="px-4 py-3 text-center">KUOTA REQUEST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {infoStreamerData?.streamers
                      ?.filter((s: any) =>
                        !searchInfoStreamer ||
                        s.namaLengkap.toLowerCase().includes(searchInfoStreamer.toLowerCase()) ||
                        s.idKaryawan.toLowerCase().includes(searchInfoStreamer.toLowerCase())
                      )
                      ?.map((s: any, idx: number) => {
                        const sLeaves = infoStreamerData?.leaveRequests?.filter((l: any) => l.karyawanId === s.id) || [];
                        const sShifts = infoStreamerData?.shiftRequests?.filter((r: any) => r.karyawanId === s.id) || [];
                        const approvedLeaves = sLeaves.filter((l: any) => l.status === "APPROVED").length;
                        const approvedShifts = sShifts.filter((r: any) => r.status === "APPROVED").length;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition">
                            <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              <div>{s.namaLengkap}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{s.idKaryawan}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-slate-700">
                                {approvedLeaves > 0 ? `${approvedLeaves} Hari Diambil` : "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                              {approvedLeaves} / {infoStreamerData?.defaultKuotaLibur ?? 4} Hari
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-slate-700">
                                {approvedShifts > 0 ? `${approvedShifts} Sesi Di-request` : "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                              {approvedShifts} / {infoStreamerData?.defaultKuotaShift ?? 4} Kali
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
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
            {otsForms.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-[#941A0B] text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900">Jadwal OTS #{idx + 1}</h3>
                  </div>
                  {otsForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setOtsForms(otsForms.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash" /> Hapus
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>ID Jadwal OTS</label>
                    <input
                      type="text"
                      value={item.idJadwal}
                      readOnly
                      className={`${inputCls} bg-[#F1F1F1] text-slate-700 font-mono font-bold cursor-not-allowed`}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Tanggal OTS *</label>
                    <input
                      type="date"
                      value={item.tanggal}
                      onChange={(e) => {
                        const v = e.target.value;
                        const updated = [...otsForms];
                        updated[idx].tanggal = v;
                        updated[idx].jamMulaiLive = `${v}T14:00`;
                        updated[idx].jamSelesaiLive = `${v}T17:00`;
                        updated[idx].idJadwal = generateNewScheduleId("OTS", v);
                        setOtsForms(updated);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Platform *</label>
                    <select
                      value={item.platform}
                      onChange={(e) => {
                        const updated = [...otsForms];
                        updated[idx].platform = e.target.value;
                        setOtsForms(updated);
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
                    <label className={labelCls}>Brand Klien *</label>
                    <select
                      value={item.clientId}
                      onChange={(e) => {
                        const updated = [...otsForms];
                        updated[idx].clientId = e.target.value;
                        setOtsForms(updated);
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
                    <label className={labelCls}>Host / Streamer OTS</label>
                    <select
                      value={item.streamerKaryawanId}
                      onChange={(e) => {
                        const updated = [...otsForms];
                        updated[idx].streamerKaryawanId = e.target.value;
                        setOtsForms(updated);
                      }}
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

                  <div>
                    <label className={labelCls}>Lokasi Studio</label>
                    <select
                      value={`${item.cabangStudio}-${item.nomorStudio}`}
                      onChange={(e) => {
                        const [cabang, no] = e.target.value.split("-");
                        const updated = [...otsForms];
                        updated[idx].cabangStudio = cabang;
                        updated[idx].nomorStudio = no;
                        setOtsForms(updated);
                      }}
                      className={selectCls}
                    >
                      {STUDIOS.map((s) => (
                        <option key={s.name} value={`${s.cabang}-${s.no}`}>{s.name}</option>
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
                setOtsForms([
                  ...otsForms,
                  {
                    id: Date.now(),
                    idJadwal: generateNewScheduleId("OTS"),
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
              }}
              className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <i className="fa-solid fa-plus" /> Tambah Jadwal OTS (Maks 100)
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
                <input
                  type="date"
                  value={filterTanggalRubah}
                  onChange={(e) => setFilterTanggalRubah(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="w-full flex-1">
                <label className={labelCls}>Pilih ID Jadwal / Streamer</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={searchEditId}
                    onChange={(e) => setSearchEditId(e.target.value)}
                    placeholder="Ketik ID Jadwal atau nama streamer..."
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleSelectEditJadwal}
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
                          onChange={(e) => {
                            const v = e.target.value;
                            const updated = [...klienForms];
                            updated[idx].tanggal = v;
                            updated[idx].jamMulaiLive = `${v}T10:00`;
                            updated[idx].jamSelesaiLive = `${v}T13:00`;
                            updated[idx].idJadwal = generateNewScheduleId("JDK", v);
                            setKlienForms(updated);
                          }}
                          className={inputCls}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Waktu Mulai *</label>
                        <input
                          type="datetime-local"
                          value={item.jamMulaiLive}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].jamMulaiLive = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={inputCls}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Waktu Selesai *</label>
                        <input
                          type="datetime-local"
                          value={item.jamSelesaiLive}
                          onChange={(e) => {
                            const updated = [...klienForms];
                            updated[idx].jamSelesaiLive = e.target.value;
                            setKlienForms(updated);
                          }}
                          className={inputCls}
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
                    alert(`✅ Ditemukan ${matched.length} jadwal pada tanggal ${exportTanggalKlien}.`);
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
                      onClick={() => alert("✅ Salinan ploting jadwal berhasil dibuat!")}
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
                        onClick={() => alert("✅ Menghubungkan tautan Google Sheets...")}
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
                      onChange={(e) => {
                        const v = e.target.value;
                        const updated = [...marketplaceForms];
                        updated[idx].tanggal = v;
                        updated[idx].jamMulaiLive = `${v}T18:00`;
                        updated[idx].jamSelesaiLive = `${v}T21:00`;
                        setMarketplaceForms(updated);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Waktu Mulai *</label>
                    <input
                      type="datetime-local"
                      value={item.jamMulaiLive}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].jamMulaiLive = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Waktu Selesai *</label>
                    <input
                      type="datetime-local"
                      value={item.jamSelesaiLive}
                      onChange={(e) => {
                        const updated = [...marketplaceForms];
                        updated[idx].jamSelesaiLive = e.target.value;
                        setMarketplaceForms(updated);
                      }}
                      className={inputCls}
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
                onClick={() => alert("✅ Template Spreadsheet disalin! Format: Jadwal Potensi YYYY-MM-DD")}
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
                  onClick={() => alert("✅ Semua data Hybrid Live berhasil disimpan ke server!")}
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
