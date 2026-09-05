"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import CameraCapture from "@/components/camera-capture";
import { formatDateSafe, formatTimeSafe, calcWajibHadir } from "@/lib/utils/date-format";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

type SopTask = {
  id: string;
  title: string;
  requiresPhoto: boolean;
  completed: boolean;
  photoUrl: string | null;
  note: string | null;
  completionId: string | null;
};
type SopTemplate = {
  id: string;
  title: string;
  description: string | null;
  tasks: SopTask[];
};

const TABS = [
  { id: "checkin", label: "Check In", icon: "fa-solid fa-arrow-right-to-bracket" },
  { id: "checkout", label: "Check Out", icon: "fa-solid fa-arrow-right-from-bracket" },
  { id: "jadwal", label: "Jadwal", icon: "fa-regular fa-calendar" },
  { id: "riwayat", label: "Riwayat", icon: "fa-solid fa-clock-rotate-left" },
];

export default function StaffDashboardPage() {
  const { data: session } = useSession();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(session?.user?.role ?? "");
  const [activeTab, setActiveTab] = useState("checkin");

  const [sesi, setSesi] = useState<{ id: string; waktu: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState("");

  const [sop, setSop] = useState<SopTemplate[]>([]);
  const [sopLoading, setSopLoading] = useState(false);
  const [photoInputs, setPhotoInputs] = useState<Record<string, string>>({});

  // Monitored staff state (Admin supervision mode)
  const [monitoredStaff, setMonitoredStaff] = useState<any | null>(null);
  const [searchStaffInput, setSearchStaffInput] = useState("");
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ jamKerja: number; hariAktif: number; sisaCuti: number }>({
    jamKerja: 0,
    hariAktif: 0,
    sisaCuti: 12,
  });

  // Admin: search other staff attendance
  const [adminSearch, setAdminSearch] = useState("");
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Jadwal
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [jadwalLoading, setJadwalLoading] = useState(false);
  const [filterWaktuJadwal, setFilterWaktuJadwal] = useState<string>("all");
  const [filterKategoriJadwal, setFilterKategoriJadwal] = useState<string>("all");
  const [filterCariJadwal, setFilterCariJadwal] = useState<string>("");
  const [modalCatatan, setModalCatatan] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<string | null>(null);

  // Riwayat
  const [history, setHistory] = useState<any[]>([]);
  const [filterWaktuRiwayat, setFilterWaktuRiwayat] = useState<string>("all");
  const [filterKategoriRiwayat, setFilterKategoriRiwayat] = useState<string>("all");
  const [filterCariRiwayat, setFilterCariRiwayat] = useState<string>("");

  useEffect(() => {
    loadSession();
    loadSop();
    loadStats();
    loadHistory();
    loadJadwal();
  }, []);

  async function loadStats(target?: string) {
    try {
      const q = target ? `&search=${encodeURIComponent(target)}` : "";
      const data = await fetchJson<any>(`/api/staff?view=stats${q}`);
      setStats(data);
      if (target && data.karyawan) {
        setMonitoredStaff(data.karyawan);
      }
    } catch { /* ignore */ }
  }

  async function loadHistory(targetKaryawanId?: string) {
    try {
      const q = targetKaryawanId ? `&karyawanId=${encodeURIComponent(targetKaryawanId)}` : "";
      const data = await fetchJson<any[]>(`/api/absensi?view=history&kategori=STAFF${q}`);
      setHistory(data ?? []);
    } catch { /* ignore */ }
  }

  async function loadJadwal(targetKaryawanId?: string) {
    setJadwalLoading(true);
    try {
      const q = targetKaryawanId ? `?karyawanId=${encodeURIComponent(targetKaryawanId)}` : "";
      const data = await fetchJson<any[]>(`/api/jadwal${q}`);
      setJadwalList(data ?? []);
    } catch { /* ignore */ }
    finally { setJadwalLoading(false); }
  }

  async function loadSop() {
    setSopLoading(true);
    try {
      const data = await fetchJson<SopTemplate[]>("/api/sop?view=checklist");
      setSop(data ?? []);
    } catch { /* ignore */ }
    finally { setSopLoading(false); }
  }

  async function toggleSopTask(task: SopTask, checked: boolean) {
    setSopLoading(true);
    setError("");
    try {
      const photoUrl = task.requiresPhoto ? (photoInputs[task.id] ?? "") : undefined;
      await sendJson("/api/sop", "POST", { action: "complete-task", taskId: task.id, completed: checked, photoUrl });
      setSuccess(checked ? "Tugas SOP ditandai selesai ✓" : "Tugas SOP dibatalkan.");
      loadSop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tugas SOP");
    } finally { setSopLoading(false); }
  }

  async function loadSession(target?: string) {
    setLoading(true);
    try {
      const q = target ? `&search=${encodeURIComponent(target)}` : "";
      const data = await fetchJson<any>(`/api/staff?view=sesi${q}`);
      setSesi(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSearchStaff() {
    if (!searchStaffInput.trim()) return;
    setAdminSearchLoading(true);
    setError("");
    setSuccess("");
    try {
      const q = encodeURIComponent(searchStaffInput.trim());
      // Sesi fetch is best-effort: absence of an active session is normal,
      // so a failure falls back to null rather than aborting the search.
      const [stats, sesi] = await Promise.all([
        fetchJson<any>(`/api/staff?view=stats&search=${q}`),
        fetchJson<any>(`/api/staff?view=sesi&search=${q}`).catch(() => null),
      ]);

      if (stats) {
        setStats(stats);
        if (stats.karyawan) {
          setMonitoredStaff(stats.karyawan);
          loadHistory(stats.karyawan.id);
          loadJadwal(stats.karyawan.id);
          setSuccess(`Mode Pengawasan aktif untuk: ${stats.karyawan.namaLengkap} (${stats.karyawan.idKaryawan})`);
        } else {
          setError("Staff tidak ditemukan");
        }
      } else {
        setError("Staff tidak ditemukan");
      }

      setSesi(sesi);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data pengawasan staff");
    } finally {
      setAdminSearchLoading(false);
    }
  }

  function handleResetAdminSearch() {
    setSearchStaffInput("");
    setMonitoredStaff(null);
    setError("");
    setSuccess("");
    loadSession();
    loadStats();
    loadHistory();
    loadJadwal();
  }

  async function doAbsen(tipe: "CHECK_IN" | "CHECK_OUT") {
    setError("");
    setSuccess("");
    setActionLoading(true);
    try {
      const targetKaryawanId = monitoredStaff ? monitoredStaff.id : undefined;
      await sendJson("/api/absensi", "POST", {
        tipe,
        kategori: "STAFF",
        karyawanId: targetKaryawanId,
        fotoBuktiUrl: fotoBuktiUrl || undefined,
      });
      const msg = tipe === "CHECK_IN" ? "Presensi Masuk (Check-In) berhasil dicatat!" : "Presensi Pulang (Check-Out) berhasil dicatat!";
      toast.success(msg);
      setSuccess("✅ " + msg);
      setFotoBuktiUrl("");
      loadSession(monitoredStaff?.id);
      loadStats(monitoredStaff?.id);
      loadHistory(monitoredStaff?.id);
      setActiveTab(tipe === "CHECK_IN" ? "checkout" : "riwayat");
    } catch (err) {
      const msg = errorMessage(err, "Gagal memproses absensi");
      toast.error(msg);
      setError(msg);
    } finally { setActionLoading(false); }
  }

  async function doAdminSearch() {
    if (!adminSearch.trim()) return;
    setAdminLoading(true);
    try {
      const data = await fetchJson<any[]>(`/api/absensi?view=history&kategori=STAFF&search=${encodeURIComponent(adminSearch)}`);
      setAdminResults(data ?? []);
    } catch { /* ignore */ }
    finally { setAdminLoading(false); }
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const filteredJadwal = jadwalList.filter((j) => {
    // 1. Time filter
    if (filterWaktuJadwal !== "all" && j.tanggal) {
      const itemDate = new Date(j.tanggal);
      itemDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((itemDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (filterWaktuJadwal === "today" && diffDays !== 0) return false;
      if (filterWaktuJadwal === "last7" && (diffDays < -7 || diffDays > 0)) return false;
      if (filterWaktuJadwal === "next7" && (diffDays < 0 || diffDays > 7)) return false;
      if (filterWaktuJadwal === "last35" && (diffDays < -35 || diffDays > 0)) return false;
      if (filterWaktuJadwal === "next35" && (diffDays < 0 || diffDays > 35)) return false;
    }

    // 2. Text filter
    if (filterCariJadwal.trim()) {
      const q = filterCariJadwal.toLowerCase().trim();
      const otsName = j.otsKaryawan?.namaLengkap || "";
      const otsId = j.otsKaryawan?.idKaryawan || "";
      const streamerName = j.streamerKaryawan?.namaLengkap || "";
      const hostName = j.hostKaryawan?.namaLengkap || "";
      const studio = `${j.cabangStudio || ""} ${j.nomorStudio || ""}`;
      const status = j.status || "";
      const idJadwal = j.idJadwal || "";

      if (filterKategoriJadwal === "id_jadwal") return idJadwal.toLowerCase().includes(q);
      if (filterKategoriJadwal === "status") return status.toLowerCase().includes(q);
      if (filterKategoriJadwal === "nama") {
        return (
          otsName.toLowerCase().includes(q) ||
          otsId.toLowerCase().includes(q) ||
          streamerName.toLowerCase().includes(q) ||
          hostName.toLowerCase().includes(q)
        );
      }
      if (filterKategoriJadwal === "cabang") return studio.toLowerCase().includes(q);

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

  const filteredHistory = history.filter((h) => {
    // 1. Time filter
    if (filterWaktuRiwayat !== "all" && h.waktu) {
      const itemDate = new Date(h.waktu);
      itemDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((itemDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (filterWaktuRiwayat === "today" && diffDays !== 0) return false;
      if (filterWaktuRiwayat === "last7" && (diffDays < -7 || diffDays > 0)) return false;
      if (filterWaktuRiwayat === "last35" && (diffDays < -35 || diffDays > 0)) return false;
    }

    // 2. Text filter
    if (filterCariRiwayat.trim()) {
      const q = filterCariRiwayat.toLowerCase().trim();
      const idAbsen = h.id || "";
      const idJadwal = h.jadwal?.idJadwal || "";
      const tipe = h.tipe === "CHECK_IN" ? "masuk check-in checkin" : "keluar check-out checkout";
      const staffName = h.karyawan?.namaLengkap || h.user?.name || "";
      const staffId = h.karyawan?.idKaryawan || "";
      const lokasi = h.jadwal?.cabangStudio || "";

      if (filterKategoriRiwayat === "id_absen") return idAbsen.toLowerCase().includes(q);
      if (filterKategoriRiwayat === "id_jadwal") return idJadwal.toLowerCase().includes(q);
      if (filterKategoriRiwayat === "tipe") return tipe.includes(q);
      if (filterKategoriRiwayat === "nama") return staffName.toLowerCase().includes(q) || staffId.toLowerCase().includes(q);

      return (
        idAbsen.toLowerCase().includes(q) ||
        idJadwal.toLowerCase().includes(q) ||
        tipe.includes(q) ||
        staffName.toLowerCase().includes(q) ||
        staffId.toLowerCase().includes(q) ||
        lokasi.toLowerCase().includes(q) ||
        (h.catatan || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff & OTS Operations Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Portal presensi kerja harian, monitoring shift operasional kantor & studio agency.
          </p>
        </div>
        <span className={`self-start sm:self-auto px-4 py-1.5 rounded-full text-xs font-bold border ${
          sesi ? "bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse" : "bg-slate-100 text-slate-600 border-slate-200"
        }`}>
          {sesi ? "● SEDANG BERTUGAS" : "OFF-DUTY"}
        </span>
      </div>

      {/* PANEL PENGAWASAN (ADMIN) — Matches Ref-Deploy */}
      {isAdmin && (
        <div id="adminPanel" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-magnifying-glass text-blue-500" />
              <span>Panel Pengawasan (Admin)</span>
            </h3>
            {monitoredStaff && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-bold self-start sm:self-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span>Sedang Memantau: <strong>{monitoredStaff.namaLengkap}</strong> ({monitoredStaff.idKaryawan})</span>
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Cari ID Karyawan / Nama Staff
              </label>
              <input
                type="text"
                value={searchStaffInput}
                onChange={(e) => setSearchStaffInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchStaff()}
                placeholder="Masukkan ID atau Nama Staff..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSearchStaff}
                disabled={adminSearchLoading || !searchStaffInput.trim()}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                {adminSearchLoading ? (
                  <i className="fa-solid fa-circle-notch fa-spin" />
                ) : (
                  <i className="fa-solid fa-magnifying-glass" />
                )}
                <span>Pantau Staff</span>
              </button>
              <button
                type="button"
                onClick={handleResetAdminSearch}
                className="flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition text-center whitespace-nowrap active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Greeting card */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Halo, <span className="text-blue-600">{monitoredStaff?.namaLengkap ?? session?.user?.name ?? "Staff"}</span>! 👋
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {monitoredStaff
              ? `Memantau dashboard operasional ${monitoredStaff.namaLengkap} (${monitoredStaff.idKaryawan} - ${monitoredStaff.jabatan ?? "Staff"})`
              : "Kelola absensi harian dan pantau produktivitas kerja."}
          </p>
        </div>
      </div>

      {/* 3 Stat Cards — matching ref-website-lama */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg flex-shrink-0">
            <i className="fa-regular fa-clock" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Jam Kerja Bulan Ini</div>
            <div className="text-xl font-black text-slate-900">{(stats?.jamKerja ?? 0).toFixed(1)} <span className="text-sm font-normal text-slate-400">Jam</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg flex-shrink-0">
            <i className="fa-solid fa-calendar-check" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Hari Aktif Bulan Ini</div>
            <div className="text-xl font-black text-slate-900">{stats?.hariAktif ?? 0} <span className="text-sm font-normal text-slate-400">Hari</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg flex-shrink-0">
            <i className="fa-solid fa-umbrella-beach" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Sisa Kuota Cuti</div>
            <div className="text-xl font-black text-slate-900">{stats?.sisaCuti ?? 12} <span className="text-sm font-normal text-slate-400">Hari</span></div>
          </div>
        </div>
      </div>


      {/* Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        className="flex overflow-x-auto gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 select-none"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(""); setSuccess(""); }}
            className={`whitespace-nowrap py-2 px-4 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-blue-600 font-bold text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-800"
            }`}
          >
            <i className={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ======== TAB: CHECK IN ======== */}
      {activeTab === "checkin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                  <i className="fa-solid fa-id-badge" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{session?.user?.name ?? "Staff Operasional"}</h3>
                  <div className="text-xs text-slate-400 font-mono">{session?.user?.email} • {session?.user?.role ?? "STAFF"}</div>
                </div>
              </div>
            </div>

            {/* Sesi Status */}
            <div className={`p-4 rounded-xl border ${sesi ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="text-xs font-semibold text-slate-600 mb-1">Status Kehadiran Hari Ini:</div>
              {loading ? (
                <div className="text-xs text-slate-400">Memeriksa status sesi...</div>
              ) : sesi ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <i className="fa-solid fa-clock text-emerald-600" />
                    <span>Aktif Check-In sejak: {new Date(sesi.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Tanggal: {new Date(sesi.waktu).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Anda belum melakukan Check-In untuk hari ini. Silakan klik tombol di bawah.</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Foto / Dokumentasi Studio</label>
              <CameraCapture value={fotoBuktiUrl} onChange={setFotoBuktiUrl} label="📷 Ambil Foto Absensi" />
              <p className="text-[11px] text-slate-400 mt-1">Opsional: Lampirkan foto dokumentasi saat check-in.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {sesi ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("checkout")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-arrow-right" />
                  <span>Sesi Aktif — Beralih ke Presensi Pulang (Check-Out)</span>
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => doAbsen("CHECK_IN")}
                  disabled={actionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className={actionLoading ? "fa-solid fa-spinner animate-spin" : "fa-solid fa-door-open"} />
                  <span>{actionLoading ? "Memproses Presensi..." : "Presensi Masuk (Check-In)"}</span>
                </button>
              </div>
            )}
          </div>

          {/* SOP Checklist */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">SOP & Tugas Operasional Staff</h3>
                <button onClick={loadSop} className="text-[11px] text-blue-600 hover:underline font-semibold">
                  <i className="fa-solid fa-arrows-rotate mr-1" />Refresh
                </button>
              </div>
              {sopLoading && <p className="text-xs text-slate-500">Memuat checklist...</p>}
              {!sopLoading && sop.length === 0 && (
                <p className="text-xs text-slate-400">Belum ada checklist SOP aktif. Admin/Operasional dapat membuat template tugas.</p>
              )}
              {sop.map((tpl) => (
                <div key={tpl.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="font-bold text-slate-800 text-xs">
                    {tpl.title}
                    <span className="text-slate-400 font-normal ml-1">({tpl.tasks.filter((t) => t.completed).length}/{tpl.tasks.length} selesai)</span>
                  </div>
                  {tpl.description && <p className="text-[11px] text-slate-500">{tpl.description}</p>}
                  <div className="space-y-1.5">
                    {tpl.tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) => toggleSopTask(task, e.target.checked)}
                          disabled={sopLoading}
                          className="mt-0.5 accent-emerald-600"
                        />
                        <div className="flex-1">
                          <div className={`text-[11px] ${task.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                            {task.title}
                            {task.requiresPhoto && <span className="ml-1 text-[9px] font-bold text-amber-600">📷 wajib foto</span>}
                          </div>
                          {task.requiresPhoto && !task.completed && (
                            <CameraCapture compact value={photoInputs[task.id] ?? ""} onChange={(dataUrl) => setPhotoInputs({ ...photoInputs, [task.id]: dataUrl })} label="Ambil Foto" />
                          )}
                          {task.photoUrl && (
                            <div className="mt-1"><span className="text-[9px] text-emerald-600 font-semibold">✓ Bukti foto terlampir</span></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======== TAB: CHECK OUT ======== */}
      {activeTab === "checkout" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xl">
              <i className="fa-solid fa-door-closed" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Presensi Pulang (Check-Out)</h3>
              <p className="text-xs text-slate-500">Lakukan saat selesai bertugas / pulang kantor</p>
            </div>
          </div>

          {sesi ? (
            <>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Sesi Aktif Saat Ini:</div>
                <div className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-emerald-600" />
                  Check-In sejak: {new Date(sesi.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">
                  Durasi: {Math.round((Date.now() - new Date(sesi.waktu).getTime()) / 60000)} Menit berlalu
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Foto Bukti Keluar (Opsional)</label>
                <CameraCapture value={fotoBuktiUrl} onChange={setFotoBuktiUrl} label="📷 Foto Keluar Studio" />
              </div>

              <button
                onClick={() => doAbsen("CHECK_OUT")}
                disabled={actionLoading}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-arrow-right-from-bracket" />
                <span>{actionLoading ? "Memproses..." : "Presensi Pulang (Check-Out)"}</span>
              </button>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-door-open text-3xl mb-3 block text-slate-300" />
              Anda belum check-in hari ini.
              <br />
              <button onClick={() => setActiveTab("checkin")} className="text-blue-600 hover:underline text-xs font-semibold mt-1 inline-block">
                → Kembali ke Check-In
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======== TAB: JADWAL (OTS & STAFF) ======== */}
      {activeTab === "jadwal" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
          {/* Header */}
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-calendar-week text-blue-600" />
              <span>Jadwal Kerja Operator & Technical Support</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sistem monitoring jadwal operasional, penugasan studio, dan jam wajib hadir OTS.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Periode Filter */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Periode Waktu</label>
              <div className="relative">
                <i className="fa-regular fa-calendar absolute left-3.5 top-3 text-blue-500 text-xs pointer-events-none" />
                <select
                  value={filterWaktuJadwal}
                  onChange={(e) => setFilterWaktuJadwal(e.target.value)}
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
                  value={filterKategoriJadwal}
                  onChange={(e) => setFilterKategoriJadwal(e.target.value)}
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
                  value={filterCariJadwal}
                  onChange={(e) => setFilterCariJadwal(e.target.value)}
                  placeholder="Ketik kata kunci pencarian..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs font-medium"
                />
                {filterCariJadwal && (
                  <button
                    type="button"
                    onClick={() => setFilterCariJadwal("")}
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
                  setFilterWaktuJadwal("all");
                  setFilterKategoriJadwal("all");
                  setFilterCariJadwal("");
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center shadow-2xs"
                title="Reset Filter"
              >
                <i className="fa-solid fa-filter-circle-xmark" />
              </button>
              <button
                type="button"
                onClick={() => loadJadwal(monitoredStaff?.id)}
                disabled={jadwalLoading}
                className="flex-1 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center border border-blue-200 shadow-2xs disabled:opacity-50"
                title="Muat Ulang Data"
              >
                <i className={`fa-solid fa-rotate-right ${jadwalLoading ? "fa-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table Jadwal */}
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
                {jadwalLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#941A0B] mb-2 block" />
                      Menyinkronkan jadwal kerja...
                    </td>
                  </tr>
                ) : filteredJadwal.length > 0 ? (
                  filteredJadwal.map((j, idx) => {
                    const st = (j.status || "TERJADWAL").toUpperCase();
                    let badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
                    if (st === "SELESAI") badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
                    else if (st === "DIBATALKAN" || st === "REJECTED") badgeClass = "bg-red-100 text-red-700 border-red-200";
                    else if (st === "ON_GOING" || st === "BERJALAN" || j.liveState === "LIVE") badgeClass = "bg-rose-100 text-rose-700 border-rose-200 animate-pulse font-bold";
                    else if (st === "PENDING") badgeClass = "bg-amber-100 text-amber-700 border-amber-200";

                    const durMins = j.durasiMenit ?? (
                      j.jamMulaiLive && j.jamSelesaiLive
                        ? Math.round((new Date(j.jamSelesaiLive).getTime() - new Date(j.jamMulaiLive).getTime()) / 60000)
                        : null
                    );

                    return (
                      <tr key={j.id || idx} className="hover:bg-slate-50 transition group">
                        <td className="px-3.5 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
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
                            {durMins && <span className="text-slate-400 font-sans">({durMins} menit)</span>}
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
                              onClick={() => setModalCatatan(j.catatanOts || j.catatanHost)}
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
                              onClick={() => setModalFile(j.filePendukungOtsDriveId || j.filePendukungHostDriveId)}
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
                            {j.otsKaryawan?.namaLengkap || j.streamerKaryawan?.namaLengkap || "Belum Ditugaskan"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {j.otsKaryawan?.idKaryawan || j.streamerKaryawan?.idKaryawan || "–"}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">
                      <i className="fa-solid fa-calendar-xmark text-3xl text-slate-300 mb-2 block" />
                      Tidak ada jadwal kerja pada periode yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======== TAB: RIWAYAT ======== */}
      {activeTab === "riwayat" && (
        <div className="space-y-6">
          {/* Admin Panel: Search other staff attendance */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-user-shield text-blue-500" />
                <span>Panel Admin: Cari Absensi Staff Lain</span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doAdminSearch()}
                  placeholder="Ketik nama atau ID staff..."
                  className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-slate-50"
                />
                <button
                  type="button"
                  onClick={doAdminSearch}
                  disabled={adminLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-50 shadow-2xs"
                >
                  {adminLoading ? "Mencari..." : "Cari"}
                </button>
              </div>
              {adminResults.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-h-[300px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 font-bold text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5">Staff</th>
                        <th className="px-4 py-2.5 text-center">Tipe</th>
                        <th className="px-4 py-2.5">Waktu Presensi</th>
                        <th className="px-4 py-2.5">Catatan / Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {adminResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 align-top font-bold text-slate-800">
                            <div>{r.karyawan?.namaLengkap || r.user?.name || r.userId}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">{r.karyawan?.idKaryawan || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-center align-top">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.tipe === "CHECK_IN" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                              {r.tipe === "CHECK_IN" ? "Check-In" : "Check-Out"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 align-top">
                            <div className="font-semibold">{formatDateSafe(r.waktu)}</div>
                            <div className="text-[11px] text-slate-500">{formatTimeSafe(r.waktu)} WIB</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 align-top">
                            {r.catatan ? (
                              <span className="italic line-clamp-2">{r.catatan}</span>
                            ) : (
                              <span className="text-slate-400">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Attendance History Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-blue-600" />
                  <span>Riwayat Presensi {monitoredStaff ? monitoredStaff.namaLengkap : "Saya"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Rekam jejak kehadiran dan laporan kepatuhan jam kerja.</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                {filteredHistory.length} Entri
              </span>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* Periode */}
              <div className="lg:col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Periode Waktu</label>
                <div className="relative">
                  <i className="fa-regular fa-calendar absolute left-3.5 top-3 text-blue-500 text-xs pointer-events-none" />
                  <select
                    value={filterWaktuRiwayat}
                    onChange={(e) => setFilterWaktuRiwayat(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                  >
                    <option value="all">Semua Periode</option>
                    <option value="today">Hari Ini</option>
                    <option value="last7">7 Hari Ke Belakang</option>
                    <option value="last35">35 Hari Ke Belakang</option>
                  </select>
                </div>
              </div>

              {/* Kategori */}
              <div className="lg:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Kategori Cari</label>
                <div className="relative">
                  <i className="fa-solid fa-layer-group absolute left-3.5 top-3 text-blue-500 text-xs pointer-events-none" />
                  <select
                    value={filterKategoriRiwayat}
                    onChange={(e) => setFilterKategoriRiwayat(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                  >
                    <option value="all">Semua Data</option>
                    <option value="id_absen">ID Absen</option>
                    <option value="id_jadwal">ID Jadwal</option>
                    <option value="tipe">Tipe (Check-In/Out)</option>
                    <option value="nama">Nama Staff</option>
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
                    value={filterCariRiwayat}
                    onChange={(e) => setFilterCariRiwayat(e.target.value)}
                    placeholder="Ketik kata kunci pencarian..."
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs font-medium"
                  />
                  {filterCariRiwayat && (
                    <button
                      type="button"
                      onClick={() => setFilterCariRiwayat("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Reset & Refresh */}
              <div className="lg:col-span-1 flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFilterWaktuRiwayat("all");
                    setFilterKategoriRiwayat("all");
                    setFilterCariRiwayat("");
                  }}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center shadow-2xs"
                  title="Reset Filter"
                >
                  <i className="fa-solid fa-filter-circle-xmark" />
                </button>
                <button
                  type="button"
                  onClick={() => loadHistory(monitoredStaff?.id)}
                  className="flex-1 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center border border-blue-200 shadow-2xs"
                  title="Muat Ulang Data"
                >
                  <i className="fa-solid fa-rotate-right" />
                </button>
              </div>
            </div>

            {/* Table Riwayat */}
            <div className="overflow-auto rounded-2xl border border-slate-200 shadow-2xs max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3.5 py-3 text-center w-12">NO</th>
                    <th className="px-4 py-3">ID ABSEN / INFO</th>
                    <th className="px-4 py-3 text-center w-28 whitespace-nowrap">TIPE & STATUS</th>
                    <th className="px-4 py-3">WAKTU & LOKASI</th>
                    <th className="px-4 py-3 text-center w-28">AKSI / BUKTI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((h, idx) => {
                      const isCheckIn = h.tipe === "CHECK_IN";
                      const dateStr = formatDateSafe(h.waktu);
                      const timeStr = formatTimeSafe(h.waktu);
                      const waText = `Halo admin, saya mau banding atas presensi tanggal ${dateStr} dengan ID Absen: ${h.id}.\n\nKeterangan kendala: ...`;
                      const waLink = `https://wa.me/6288211446222?text=${encodeURIComponent(waText)}`;

                      return (
                        <tr key={h.id || idx} className="hover:bg-slate-50 transition group">
                          <td className="px-3.5 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="font-mono font-bold text-slate-800 text-xs break-all">{h.id}</div>
                            {h.jadwal?.idJadwal ? (
                              <div className="text-[11px] text-blue-600 font-medium mt-0.5">
                                Jadwal: <span className="font-bold">{h.jadwal.idJadwal}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-0.5">Presensi Kantor Regular</div>
                            )}
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {h.karyawan?.namaLengkap || session?.user?.name || "Staff"} ({h.karyawan?.idKaryawan || "-"})
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs uppercase tracking-wide inline-block ${
                              isCheckIn
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            }`}>
                              {isCheckIn ? "Check-In" : "Check-Out"}
                            </span>
                            <div className="text-[10px] text-slate-400 font-medium mt-1">
                              {h.kategori || "STAFF"}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-slate-900 text-xs">
                              {dateStr}
                              {h.jadwal?.cabangStudio && (
                                <span className="ml-2 text-rose-600 font-semibold">
                                  <i className="fa-solid fa-location-dot mr-1" />
                                  {h.jadwal.cabangStudio}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                              <i className="fa-regular fa-clock" />
                              <span>{timeStr} WIB</span>
                            </div>
                            {h.catatan && (
                              <div className="text-[11px] text-slate-600 mt-1 italic line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                                &quot;{h.catatan}&quot;
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center align-middle space-y-1.5">
                            {h.buktiDriveId && (
                              <a
                                href={h.buktiDriveId.startsWith("http") || h.buktiDriveId.startsWith("data:") ? h.buktiDriveId : `https://drive.google.com/open?id=${h.buktiDriveId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs mx-auto w-fit"
                              >
                                <i className="fa-solid fa-camera text-blue-600" />
                                <span>Foto</span>
                              </a>
                            )}
                            {h.catatan && (
                              <button
                                type="button"
                                onClick={() => setModalCatatan(h.catatan)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs mx-auto w-fit"
                              >
                                <i className="fa-solid fa-note-sticky text-amber-500" />
                                <span>Catatan</span>
                              </button>
                            )}
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-amber-700 hover:text-amber-800 font-medium flex items-center justify-center gap-1 transition"
                              title="Banding Keterlambatan via WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp text-emerald-600" />
                              <span>Banding</span>
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-xs">
                        <i className="fa-solid fa-clipboard-check text-3xl text-slate-300 mb-2 block" />
                        Belum ada riwayat presensi yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catatan */}
      {modalCatatan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-note-sticky text-amber-500" />
                <span>Catatan Operasional</span>
              </h4>
              <button onClick={() => setModalCatatan(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {modalCatatan}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalCatatan(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal File */}
      {modalFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-folder-open text-blue-500" />
                <span>File Lampiran Brief / Jadwal</span>
              </h4>
              <button onClick={() => setModalFile(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-2">
              <p className="font-semibold">Lampiran Dokumen / Folder Drive:</p>
              <p className="font-mono text-[11px] break-all bg-white p-2.5 rounded-lg border border-blue-200">{modalFile}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <a
                href={modalFile.startsWith("http") ? modalFile : `https://drive.google.com/open?id=${modalFile}`}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                <span>Buka Link Drive</span>
              </a>
              <button
                type="button"
                onClick={() => setModalFile(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition"
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
