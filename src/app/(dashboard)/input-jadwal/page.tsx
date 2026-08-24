"use client";

import { useEffect, useState } from "react";
import ScheduleCalendar from "@/components/schedule-calendar";

const PLATFORMS = ["Shopee Live", "TikTok Shop", "Tokopedia Live", "Lazada Live"];
const STUDIOS = [
  { name: "Studio Timoho 1", cabang: "Timoho", no: "01" },
  { name: "Studio Timoho 2", cabang: "Timoho", no: "02" },
  { name: "Studio Berbah 1", cabang: "Berbah", no: "01" },
  { name: "Studio Berbah 2", cabang: "Berbah", no: "02" },
  { name: "Studio Wiyoro 1", cabang: "Wiyoro", no: "01" },
];

export default function InputJadwalPage() {
  const [streamers, setStreamers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentJadwal, setRecentJadwal] = useState<any[]>([]);
  const [allJadwal, setAllJadwal] = useState<any[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Main Navigation Tabs persis ref-website-lama/input-jadwal.html
  const [mainTab, setMainTab] = useState<"streamer" | "ots" | "rubah" | "klien" | "marketplace" | "hybrid" | "kendali">("streamer");
  const [streamerSubTab, setStreamerSubTab] = useState<"form" | "info">("form");
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "calendar">("single");

  // Kendali Form & Info Streamer states
  const [kendaliConfig, setKendaliConfig] = useState<any>(null);
  const [infoStreamerData, setInfoStreamerData] = useState<any>(null);
  const [kendaliLoading, setKendaliLoading] = useState(false);
  const [searchInfoStreamer, setSearchInfoStreamer] = useState("");
  const [quotaForm, setQuotaForm] = useState({ defaultKuotaLibur: 4, defaultKuotaShift: 4 });

  // Executive Client Schedule Form
  const [clientForm, setClientForm] = useState({
    idJadwal: "",
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
  });

  const [form, setForm] = useState({
    idJadwal: "",
    tanggal: new Date().toISOString().slice(0, 10),
    platform: "Shopee Live",
    clientId: "",
    streamerKaryawanId: "",
    cabangStudio: "Timoho",
    nomorStudio: "01",
    jamMulaiLive: "",
    jamSelesaiLive: "",
    judulLive: "",
    produkPrioritas: "",
    promoLive: "",
  });

  const [batch, setBatch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [streamerStats, setStreamerStats] = useState<any>(null);
  const [blacklistWarning, setBlacklistWarning] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignJadwalId, setAssignJadwalId] = useState("");
  const [assignStreamerId, setAssignStreamerId] = useState("");

  useEffect(() => {
    generateIdJadwal(form.tanggal);
    generateClientJadwalId(clientForm.tanggal);
    fetchData();
    loadKendaliConfig();
    loadInfoStreamer();
  }, []);

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

  function generateClientJadwalId(dateStr: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    setClientForm((f) => ({ ...f, idJadwal: `JDK/${yy}${mm}${dd}/${rand}` }));
  }

  async function handleExecutiveClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientForm.clientId) {
      setError("Pilih Brand Klien terlebih dahulu");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Direct publication by executive without client approval
      const payload = {
        ...clientForm,
        status: "TERJADWAL",
      };
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`✅ Jadwal Klien ${clientForm.idJadwal} berhasil diterbitkan langsung (Status: TERJADWAL tanpa menunggu persetujuan klien)!`);
        generateClientJadwalId(clientForm.tanggal);
        fetchData();
      } else {
        setError(d.message ?? "Gagal membuat jadwal klien");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generateIdJadwal(form.tanggal);
    fetchData();
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
        setRecentJadwal(jadwalRes.data.slice(0, 10));
      }
    } catch {
      // ignore
    }
  }

  async function checkStreamerStats(karyawanId: string) {
    if (!karyawanId) { setStreamerStats(null); return; }
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/scheduler-tools?view=streamer-stats&karyawanId=${karyawanId}`).then((x) => x.json());
      if (r.status === "success") setStreamerStats(r.data);
    } catch { /* ignore */ } finally { setStatsLoading(false); }
  }

  async function checkBlacklist(karyawanId: string, clientId: string) {
    if (!karyawanId || !clientId) { setBlacklistWarning(null); return; }
    try {
      const r = await fetch(`/api/scheduler-tools?view=blacklist&karyawanId=${karyawanId}&clientId=${clientId}`).then((x) => x.json());
      if (r.status === "success" && r.data.isBlacklisted) {
        setBlacklistWarning(`⛔ Streamer ini ada di daftar BLACKLIST untuk klien ini${r.data.alasan ? `: ${r.data.alasan}` : "."}`);
      } else {
        setBlacklistWarning(null);
      }
    } catch { setBlacklistWarning(null); }
  }

  function generateIdJadwal(dateStr: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    setForm((f) => ({ ...f, idJadwal: `JDS/${yy}${mm}${dd}/${rand}` }));
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      tanggal: val,
      jamMulaiLive: val ? `${val}T10:00` : "",
      jamSelesaiLive: val ? `${val}T13:00` : "",
    }));
    generateIdJadwal(val);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Jadwal ${form.idJadwal} berhasil dibuat! (Token jeda istirahat 30 mnt lolos validasi).`);
        generateIdJadwal(form.tanggal);
        fetchData();
      } else {
        setError(d.message ?? "Gagal membuat jadwal");
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat menyimpan jadwal");
    } finally {
      setLoading(false);
    }
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let rows: any[];
      try {
        rows = JSON.parse(batch);
      } catch {
        setError("Batch harus berupa format JSON array yang valid");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Batch berhasil diimpor (${d.data.length} jadwal streaming)!`);
        setBatch("");
        fetchData();
      } else {
        setError(d.message ?? "Gagal mengimpor batch jadwal");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignSubmit() {
    if (!assignStreamerId) {
      setError("Pilih streamer terlebih dahulu");
      return;
    }
    const target = recentJadwal.find(j => j.id === assignJadwalId);
    if (!target) return;

    setLoading(true);
    setError("");
    
    try {
      const payload = {
        idJadwal: target.idJadwal,
        tanggal: new Date(target.tanggal).toISOString(),
        jamMulaiLive: new Date(target.jamMulaiLive).toISOString(),
        jamSelesaiLive: new Date(target.jamSelesaiLive).toISOString(),
        cabangStudio: target.cabangStudio,
        nomorStudio: target.nomorStudio,
        platform: target.platform,
        clientId: target.clientId,
        streamerKaryawanId: assignStreamerId
      };

      const res = await fetch(`/api/jadwal?id=${assignJadwalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Streamer berhasil di-assign ke jadwal!");
        setAssignModalOpen(false);
        fetchData();
      } else {
        setError(d.message ?? "Gagal assign streamer");
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat assign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/input-jadwal.html */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Input Jadwal</h1>
          <p className="text-slate-500 text-sm">Buat jadwal baru untuk Streamer, jadwal OTS, atau kelola kendali pengajuan.</p>
        </div>
      </div>

      {/* Main Tabs Navigation persis ref-website-lama/input-jadwal.html */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "streamer", label: "Jadwal Streamer", icon: "fa-video" },
          { id: "ots", label: "Jadwal OTS", icon: "fa-camera" },
          { id: "rubah", label: "Rubah Jadwal", icon: "fa-clock-rotate-left" },
          { id: "klien", label: "Jadwal Klien", icon: "fa-building" },
          { id: "marketplace", label: "Marketplace", icon: "fa-shop" },
          { id: "hybrid", label: "Hybrid Live", icon: "fa-network-wired" },
          { id: "kendali", label: "Kendali Form", icon: "fa-sliders" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
              mainTab === tab.id
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
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
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ======== TAB 7: KENDALI FORM (Pusat Kendali Pengajuan Streamer) ======== */}
      {mainTab === "kendali" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-blue-600" />
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
                    <i className="fa-solid fa-calendar-xmark text-blue-500" />
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
                    <i className="fa-solid fa-video text-purple-500" />
                    Pengajuan Sesi Live
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Kontrol form Request 3 Sesi Live (00-08 / 08-16 / 16-00).</p>
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
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-purple-50 hover:text-purple-700"
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
                <i className="fa-solid fa-calculator text-blue-600" />
                Pengaturan Kuota Default Streamer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kuota Default Libur (Hari / Bulan)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={quotaForm.defaultKuotaLibur}
                    onChange={(e) => setQuotaForm({ ...quotaForm, defaultKuotaLibur: parseInt(e.target.value, 10) || 0 })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Batas jatah libur streamer yang dapat diajukan per periode bulan.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kuota Default Request Sesi Live (Kali / Bulan)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={quotaForm.defaultKuotaShift}
                    onChange={(e) => setQuotaForm({ ...quotaForm, defaultKuotaShift: parseInt(e.target.value, 10) || 0 })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Batas jumlah request preferensi sesi siaran streamer per bulan.</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={kendaliLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <span>{kendaliLoading ? "Menyimpan..." : "Simpan Pengaturan Kuota"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======== TAB 4: JADWAL KLIEN (Mode Eksekutif Direct Publish) ======== */}
      {mainTab === "klien" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
            <i className="fa-solid fa-crown text-blue-600 text-lg mt-0.5" />
            <div>
              <strong>Mode Eksekutif — Direct Jadwal Klien:</strong> Jadwal yang diinputkan di sini langsung berstatus{" "}
              <span className="font-bold underline">TERJADWAL / APPROVED</span> dan otomatis masuk ke kalender siaran tanpa memerlukan proses persetujuan pihak klien.
            </div>
          </div>

          <form onSubmit={handleExecutiveClientSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">ID Jadwal</label>
                <input
                  type="text"
                  value={clientForm.idJadwal}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Brand Partner / Klien *</label>
                <select
                  value={clientForm.clientId}
                  onChange={(e) => setClientForm({ ...clientForm, clientId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Tanggal Siaran *</label>
                <input
                  type="date"
                  value={clientForm.tanggal}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClientForm((f) => ({
                      ...f,
                      tanggal: v,
                      jamMulaiLive: `${v}T10:00`,
                      jamSelesaiLive: `${v}T13:00`,
                    }));
                    generateClientJadwalId(v);
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Jam Mulai *</label>
                <input
                  type="datetime-local"
                  value={clientForm.jamMulaiLive}
                  onChange={(e) => setClientForm({ ...clientForm, jamMulaiLive: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Jam Selesai *</label>
                <input
                  type="datetime-local"
                  value={clientForm.jamSelesaiLive}
                  onChange={(e) => setClientForm({ ...clientForm, jamSelesaiLive: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Platform Marketplace</label>
                <select
                  value={clientForm.platform}
                  onChange={(e) => setClientForm({ ...clientForm, platform: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Assign Streamer (Opsional)</label>
                <select
                  value={clientForm.streamerKaryawanId}
                  onChange={(e) => setClientForm({ ...clientForm, streamerKaryawanId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">-- Pilih Streamer --</option>
                  {streamers.map((s) => (
                    <option key={s.id} value={s.id}>{s.namaLengkap} ({s.idKaryawan})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Lokasi Studio</label>
                <select
                  value={`${clientForm.cabangStudio}|${clientForm.nomorStudio}`}
                  onChange={(e) => {
                    const [c, n] = e.target.value.split("|");
                    setClientForm({ ...clientForm, cabangStudio: c, nomorStudio: n });
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {STUDIOS.map((s) => (
                    <option key={s.name} value={`${s.cabang}|${s.no}`}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Judul Live</label>
                <input
                  type="text"
                  value={clientForm.judulLive}
                  onChange={(e) => setClientForm({ ...clientForm, judulLive: e.target.value })}
                  placeholder="mis. Mega Sale Live 8.8"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !clientForm.clientId}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className="fa-solid fa-paper-plane" />
                <span>{loading ? "Menerbitkan..." : "Terbitkan Jadwal Klien Langsung (TERJADWAL)"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======== TAB 1: JADWAL STREAMER ======== */}
      {mainTab === "streamer" && (
        <div className="space-y-6">
          {/* Sub-view navigation: Formulir vs Informasi Streamer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setStreamerSubTab("form")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  streamerSubTab === "form" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-file-pen" />
                <span>Formulir Input</span>
              </button>
              <button
                type="button"
                onClick={() => setStreamerSubTab("info")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  streamerSubTab === "info" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-calendar-check" />
                <span>Informasi Libur & Sesi Live</span>
              </button>
            </div>

            {streamerSubTab === "form" && (
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab("single")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "single" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Form Satuan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("batch")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "batch" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Impor Massal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("calendar")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "calendar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Kalender
                </button>
              </div>
            )}
          </div>

          {/* Sub-view 2: INFORMASI STREAMER (Libur & Request Sesi Live) */}
          {streamerSubTab === "info" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <i className="fa-solid fa-calendar-check text-blue-600" />
                    Informasi Libur & Request Sesi Live Streamer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekapitulasi kuota libur, pengajuan cuti, dan request sesi siaran streamer bulan ini.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    value={searchInfoStreamer}
                    onChange={(e) => setSearchInfoStreamer(e.target.value)}
                    placeholder="Cari nama streamer..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">NO</th>
                      <th className="px-4 py-3">STREAMER</th>
                      <th className="px-4 py-3">STATUS LIBUR</th>
                      <th className="px-4 py-3 text-center">KUOTA LIBUR</th>
                      <th className="px-4 py-3">REQUEST SESI LIVE</th>
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
                        const kuotaLibur = infoStreamerData?.defaultKuotaLibur ?? 4;
                        const kuotaShift = infoStreamerData?.defaultKuotaShift ?? 4;

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              <div>{s.namaLengkap}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{s.idKaryawan}</div>
                            </td>
                            <td className="px-4 py-3">
                              {sLeaves.length > 0 ? (
                                <div className="space-y-1">
                                  {sLeaves.slice(0, 2).map((l: any) => (
                                    <div key={l.id} className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        {new Date(l.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                      </span>
                                      <span className={`text-[10px] font-bold ${l.status === "APPROVED" ? "text-emerald-600" : "text-amber-600"}`}>
                                        ({l.status === "APPROVED" ? "Disetujui" : "Pending"})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono font-bold text-slate-700">
                                {approvedLeaves} / {kuotaLibur} Hari
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {sShifts.length > 0 ? (
                                <div className="space-y-1">
                                  {sShifts.slice(0, 2).map((r: any) => (
                                    <div key={r.id} className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                        {r.jenis?.replace("REQUEST_", "")} @ {new Date(r.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                      </span>
                                      <span className={`text-[10px] font-bold ${r.status === "APPROVED" ? "text-emerald-600" : "text-amber-600"}`}>
                                        ({r.status === "APPROVED" ? "Disetujui" : "Pending"})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono font-bold text-slate-700">
                                {approvedShifts} / {kuotaShift} Kali
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 1: FORMULIR INPUT JADWAL STREAMER */}
          {streamerSubTab === "form" && activeTab === "single" && (
            <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* ID Jadwal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="idJadwal" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">ID Jadwal</label>
                <button
                  type="button"
                  onClick={() => generateIdJadwal(form.tanggal)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Acak Ulang
                </button>
              </div>
              <input
                id="idJadwal"
                type="text"
                value={form.idJadwal}
                onChange={(e) => setForm({ ...form, idJadwal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Tanggal Live */}
            <div>
              <label htmlFor="tanggalSesi" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Sesi
              </label>
              <input
                id="tanggalSesi"
                type="date"
                value={form.tanggal}
                onChange={handleDateChange}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Platform Marketplace
              </label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Streamer Filter & Selector */}
            <div className="sm:col-span-2 lg:col-span-3 border-t border-slate-100 pt-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="fa-solid fa-filter text-blue-500" /> Filter Streamer by Tag / Klasifikasi
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Cari tag: Hijab, FMCG, Tech, Energetik..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
                <div className="flex-1">
                  <select
                    id="streamerHost"
                    value={form.streamerKaryawanId}
                    onChange={(e) => {
                      setForm({ ...form, streamerKaryawanId: e.target.value });
                      checkStreamerStats(e.target.value);
                      checkBlacklist(e.target.value, form.clientId);
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  >
                    <option value="">-- Pilih Streamer --</option>
                    {streamers
                      .filter((s) => !tagFilter || (s.tags ?? "").toLowerCase().includes(tagFilter.toLowerCase()) || (s.namaLengkap ?? "").toLowerCase().includes(tagFilter.toLowerCase()))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.namaLengkap} ({s.idKaryawan}){s.tags ? ` [${s.tags}]` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Client Brand */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Klien
              </label>
              <select
                value={form.clientId}
                onChange={(e) => {
                  setForm({ ...form, clientId: e.target.value });
                  checkBlacklist(form.streamerKaryawanId, e.target.value);
                }}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                <option value="">-- Pilih Klien / Brand --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.namaClient} {c.platform ? `(${c.platform})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Studio Room */}
            <div>
              <label htmlFor="lokasiStudio" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Lokasi Studio
              </label>
              <select
                id="lokasiStudio"
                value={`${form.cabangStudio}-${form.nomorStudio}`}
                onChange={(e) => {
                  const [cabang, no] = e.target.value.split("-");
                  setForm({ ...form, cabangStudio: cabang, nomorStudio: no });
                }}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                {STUDIOS.map((s) => (
                  <option key={s.name} value={`${s.cabang}-${s.no}`}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Jam Mulai */}
            <div>
              <label htmlFor="jamMulaiLive" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Waktu Mulai Live
              </label>
              <input
                id="jamMulaiLive"
                type="datetime-local"
                value={form.jamMulaiLive}
                onChange={(e) => setForm({ ...form, jamMulaiLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Jam Selesai */}
            <div>
              <label htmlFor="jamSelesaiLive" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Waktu Selesai Live
              </label>
              <input
                id="jamSelesaiLive"
                type="datetime-local"
                value={form.jamSelesaiLive}
                onChange={(e) => setForm({ ...form, jamSelesaiLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Judul Live Campaign */}
            <div>
              <label htmlFor="judulLive" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Judul Sesi / Campaign
              </label>
              <input
                id="judulLive"
                type="text"
                placeholder="mis. Mega Flash Sale 8.8"
                value={form.judulLive}
                onChange={(e) => setForm({ ...form, judulLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {/* Produk Prioritas */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Produk Prioritas & Brief
              </label>
              <input
                type="text"
                placeholder="SKU Produk Utama, Flash Sale Diskon 50%, Voucher Toko"
                value={form.produkPrioritas}
                onChange={(e) => setForm({ ...form, produkPrioritas: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {/* Promo Live */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Voucher / Promo Code
              </label>
              <input
                type="text"
                placeholder="POTENSI88 / GRATISONGKIR"
                value={form.promoLive}
                onChange={(e) => setForm({ ...form, promoLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>

          {/* Scheduler Simulation Panel */}
          {(blacklistWarning || streamerStats) && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {blacklistWarning && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 flex items-start gap-2 text-xs text-red-700 font-semibold">
                  <i className="fa-solid fa-ban text-red-500 mt-0.5" />
                  {blacklistWarning}
                </div>
              )}
              {streamerStats && (
                <div className={`rounded-xl border-2 p-4 text-xs ${streamerStats.isOverlimit ? "bg-red-50 border-red-400" : streamerStats.isNearTier4 ? "bg-amber-50 border-amber-400" : "bg-emerald-50 border-emerald-300"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                      <i className="fa-solid fa-calculator" /> Simulasi Jam Bulan Ini — {streamerStats.namaLengkap}
                    </span>
                    {statsLoading && <span className="text-slate-400 italic">Memuat...</span>}
                    {streamerStats.isOverlimit && (
                      <span className="bg-red-600 text-white font-black px-2 py-0.5 rounded-full text-[10px] uppercase animate-pulse">⚠ OVERLIMIT GOLONGAN 5</span>
                    )}
                    {!streamerStats.isOverlimit && streamerStats.isNearTier4 && (
                      <span className="bg-amber-500 text-white font-black px-2 py-0.5 rounded-full text-[10px] uppercase">⚠ Mendekati Golongan 4</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-slate-500">Total Jam</div>
                      <div className="text-base font-black text-slate-800">{streamerStats.totalJam} <span className="text-xs font-normal">jam</span></div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tier Saat Ini</div>
                      <div className="font-bold text-slate-800">{streamerStats.activeTier?.nama ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Batas Gol. 5</div>
                      <div className="font-bold text-slate-800">{streamerStats.tier5Threshold ?? "—"} jam</div>
                    </div>
                  </div>
                  {streamerStats.isOverlimit && (
                    <p className="mt-2 text-red-700 font-semibold">Jam streamer ini sudah melebihi batas Golongan 5. Harap distribusikan ke streamer lain agar tidak over-budget!</p>
                  )}
                  {!streamerStats.isOverlimit && streamerStats.isNearTier4 && (
                    <p className="mt-2 text-amber-700 font-semibold">Akumulasi jam mendekati batas kenaikan Golongan 4. Segera laporkan ke HR/Owner.</p>
                  )}
                  {streamerStats.tags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {streamerStats.tags.split(",").map((t: string) => (
                        <span key={t} className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">{t.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Aturan Jeda Istirahat (Token 30 Menit) otomatis diverifikasi saat submit.</span>
            </div>
            <button
              type="submit"
              disabled={loading || !!blacklistWarning || streamerStats?.isOverlimit}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50 text-sm"
            >
              {loading ? "Menyimpan..." : "Simpan & Jadwalkan Sesi"}
            </button>
          </div>
        </form>
      )}

      {/* Batch Import Tab */}
      {activeTab === "batch" && (
        <form onSubmit={submitBatch} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Impor Jadwal Massal (JSON Array)</h2>
            <button
              type="button"
              onClick={() => {
                const sample = [
                  {
                    idJadwal: "JDS/260821/101",
                    tanggal: "2026-08-21",
                    platform: "Shopee Live",
                    jamMulaiLive: "2026-08-21T10:00:00",
                    jamSelesaiLive: "2026-08-21T13:00:00",
                    cabangStudio: "Timoho",
                    nomorStudio: "01",
                    judulLive: "Shopee Live Morning",
                  },
                  {
                    idJadwal: "JDS/260821/102",
                    tanggal: "2026-08-21",
                    platform: "TikTok Shop",
                    jamMulaiLive: "2026-08-21T14:00:00",
                    jamSelesaiLive: "2026-08-21T17:00:00",
                    cabangStudio: "Berbah",
                    nomorStudio: "01",
                    judulLive: "TikTok Afternoon Live",
                  },
                ];
                setBatch(JSON.stringify(sample, null, 2));
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Muat Format Contoh
            </button>
          </div>
          <textarea
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            rows={8}
            placeholder='[{"idJadwal":"JDS/260821/001","tanggal":"2026-08-21","platform":"Shopee Live","jamMulaiLive":"2026-08-21T10:00:00","jamSelesaiLive":"2026-08-21T13:00:00", ...}]'
            className="w-full border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-slate-50"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !batch.trim()}
              className="bg-slate-900 hover:bg-black text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm disabled:opacity-50"
            >
              {loading ? "Mengimpor..." : "Proses Impor Massal (Atomik)"}
            </button>
          </div>
        </form>
      )}

      {/* Calendar Tab */}
      {activeTab === "calendar" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Kalender Jadwal Livestream</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik tanggal untuk mengisi formulir, klik blok sesi untuk melihat detail.
              </p>
            </div>
            {selectedCalendarDate && (
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, tanggal: selectedCalendarDate }));
                  setActiveTab("single");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
              >
                Buat Jadwal pada {selectedCalendarDate}
              </button>
            )}
          </div>

          <ScheduleCalendar
            events={allJadwal}
            onSelectDate={(date) => setSelectedCalendarDate(date)}
            onSelectEvent={(ev) => setSelectedEvent(ev)}
          />

          {selectedEvent && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{selectedEvent.idJadwal}</span>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Tutup detail"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Streamer</div>
                  {selectedEvent.streamerKaryawan?.namaLengkap ?? "Belum di-assign"}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Platform</div>
                  {selectedEvent.platform ?? "-"}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Studio</div>
                  {selectedEvent.cabangStudio ? `${selectedEvent.cabangStudio} #${selectedEvent.nomorStudio ?? "01"}` : "-"}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Waktu</div>
                  {new Date(selectedEvent.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {new Date(selectedEvent.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Live State</div>
                  {selectedEvent.liveState}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Status</div>
                  {selectedEvent.status}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Schedules Table with Search & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Jadwal Sesi Terdaftar</h3>
            <span className="text-xs text-slate-500">{recentJadwal.length} sesi termonitor</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari ID, Host, Studio..."
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                // Client-side search helper if desired
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID Jadwal</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Studio</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Live State</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJadwal.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{j.idJadwal}</td>
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
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        j.liveState === "LIVE"
                          ? "bg-rose-100 text-rose-700 animate-pulse"
                          : j.liveState === "REVIEW"
                          ? "bg-amber-100 text-amber-700"
                          : j.liveState === "CLOSED"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {j.liveState}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!j.streamerKaryawanId && j.status !== "SELESAI" && j.liveState !== "CLOSED" && (
                      <button
                        onClick={() => {
                          setAssignJadwalId(j.id);
                          setAssignStreamerId("");
                          setAssignModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition shadow-sm"
                      >
                        Assign Streamer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Assign Streamer</h3>
              <button onClick={() => { setAssignModalOpen(false); setError(""); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            {error && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2 leading-snug">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Streamer</label>
              <select
                value={assignStreamerId}
                onChange={(e) => setAssignStreamerId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                onClick={() => { setAssignModalOpen(false); setError(""); }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                disabled={loading || !assignStreamerId}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50"
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
