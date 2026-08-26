"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CameraCapture from "@/components/camera-capture";
import { generateGoogleCalendarUrl } from "@/lib/google-calendar-utils";

// --- Safe Date & Time Formatting Helpers (Prevents "Invalid Date" Errors) ---
function formatDateSafe(val: any, options?: Intl.DateTimeFormatOptions, fallback = "–"): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString("id-ID", options ?? { day: "2-digit", month: "short", year: "numeric" });
        }
      }
    }
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleDateString("id-ID", options ?? { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return fallback;
  }
}

function formatTimeSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d{1,2}:\d{2}/.test(trimmed)) {
        const parts = trimmed.split(":");
        const hh = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        return `${hh}:${mm}`;
      }
    }
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return fallback;
  }
}

function formatDateTimeSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fallback;
  }
}

// Format duration in human-readable Days, Hours, and Minutes (e.g. "1 Hari 2 Jam 15 Menit")
function formatLateDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 Menit";

  const days = Math.floor(totalMinutes / 1440);
  const remainingMinutesAfterDays = totalMinutes % 1440;
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} Menit`);

  return parts.join(" ");
}

// Dynamic check-in late validator based on current time vs scheduled start time
function getLateCheckInStatus(jadwal: Jadwal | null): {
  isLate: boolean;
  minutesLate: number;
  lateDurationText: string;
  scheduledTimeText: string;
} {
  if (!jadwal || !jadwal.jamMulaiLive) {
    return { isLate: false, minutesLate: 0, lateDurationText: "", scheduledTimeText: "" };
  }

  const now = new Date();
  let scheduledStart: Date | null = null;

  if (jadwal.jamMulaiLive.includes("T")) {
    scheduledStart = new Date(jadwal.jamMulaiLive);
  } else {
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (jadwal.tanggal) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(jadwal.tanggal.trim())) {
        const [y, m, d] = jadwal.tanggal.trim().split("-").map(Number);
        year = y;
        month = m - 1;
        day = d;
      } else {
        const dt = new Date(jadwal.tanggal);
        if (!isNaN(dt.getTime())) {
          year = dt.getFullYear();
          month = dt.getMonth();
          day = dt.getDate();
        }
      }
    }

    const [hh, mm] = jadwal.jamMulaiLive.split(":").map(Number);
    scheduledStart = new Date(year, month, day, hh || 0, mm || 0);
  }

  if (!scheduledStart || isNaN(scheduledStart.getTime())) {
    return { isLate: false, minutesLate: 0, lateDurationText: "", scheduledTimeText: "" };
  }

  const diffMs = now.getTime() - scheduledStart.getTime();
  const minutesLate = Math.floor(diffMs / 60000);
  const scheduledTimeText = formatTimeSafe(jadwal.jamMulaiLive);
  const lateDurationText = formatLateDuration(minutesLate > 0 ? minutesLate : 0);

  return {
    isLate: minutesLate > 0,
    minutesLate: minutesLate > 0 ? minutesLate : 0,
    lateDurationText,
    scheduledTimeText,
  };
}


type Jadwal = {
  id: string;
  idJadwal: string;
  tanggal: string;
  platform: string | null;
  studio: string | null;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  status: string;
  liveState: string;
  client?: { namaClient: string } | null;
  produk?: { namaProduk: string; sku: string }[];
  absensi?: { reportedGmv: number | null; waktuMasuk: string; waktuKeluar: string | null }[];
};

type DashboardData = {
  karyawan: {
    namaLengkap: string;
    namaPanggilan: string | null;
    kontrakType: string | null;
    endDate: string | null;
    tags: string | null;
  } | null;
  periode: string;
  totalJam: number;
  totalSesi: number;
  activeTier: { nama: string; ratePerJam: number } | null;
  grossPay: number;
  totalGmv: number;
  totalDenda: number;
  netPay: number;
  kontrakDaysLeft: number | null;
  incidents: {
    id: string;
    title: string;
    category: string | null;
    fineApplied: number;
    createdAt: string;
  }[];
};

type AbsensiHistory = {
  id: string;
  tipe: string;
  kategori: string;
  waktuMasuk: string;
  waktuKeluar: string | null;
  reportedGmv: number | null;
  isTerusan: boolean;
  jadwal?: {
    idJadwal: string;
    platform: string | null;
    client?: { namaClient: string } | null;
  } | null;
};

const TABS = [
  { id: "checkin", label: "Check In", icon: "fa-solid fa-arrow-right-to-bracket" },
  { id: "checkout", label: "Check Out", icon: "fa-solid fa-arrow-right-from-bracket" },
  { id: "terbatas", label: "Terbatas", icon: "fa-solid fa-bolt" },
  { id: "jadwal", label: "Jadwal", icon: "fa-regular fa-calendar" },
  { id: "request", label: "Request", icon: "fa-solid fa-file-pen" },
  { id: "riwayat", label: "History", icon: "fa-solid fa-clock-rotate-left" },
  { id: "report", label: "Report", icon: "fa-solid fa-chart-pie", adminOnly: true },
];

export default function StreamerDashboardPage() {
  const { data: session } = useSession();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(session?.user?.role ?? "");

  const [activeTab, setActiveTab] = useState("checkin");
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; waktu: string } | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [pendingGmvList, setPendingGmvList] = useState<any[]>([]);
  const [tiering, setTiering] = useState<{ tier: string; jamMinimal: number; jamMaksimal: number; ratePerJam: number }[]>([]);
  const [absensiHistory, setAbsensiHistory] = useState<AbsensiHistory[]>([]);

  // Check-in form state
  const [selectedJadwalId, setSelectedJadwalId] = useState("");
  const [selectedJadwalDetail, setSelectedJadwalDetail] = useState<Jadwal | null>(null);
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState("");
  const [alasanTerlambat, setAlasanTerlambat] = useState("");

  // Check-out form state
  const [reportedGmv, setReportedGmv] = useState("");

  // Pending GMV
  const [pendingGmvId, setPendingGmvId] = useState("");
  const [pendingGmvModalOpen, setPendingGmvModalOpen] = useState(false);

  // Request Tab state
  const [requestStatus, setRequestStatus] = useState<any>(null);
  const [requestSubTab, setRequestSubTab] = useState<"libur" | "sesi">("libur");
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [selectedSesi, setSelectedSesi] = useState<"SESI_1" | "SESI_2" | "SESI_3">("SESI_2");
  const [shiftNote, setShiftNote] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    loadData();
    loadRequestStatus();
  }, []);

  async function loadRequestStatus() {
    try {
      const res = await fetch("/api/streamer?view=request-status").then((r) => r.json());
      if (res.status === "success") {
        setRequestStatus(res.data);
      }
    } catch {
      // ignore
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [jRes, sRes, dRes, pRes, tRes, hRes] = await Promise.all([
        fetch("/api/streamer?view=jadwal").then((r) => r.json()),
        fetch("/api/streamer?view=sesi").then((r) => r.json()).catch(() => ({ status: "error" })),
        fetch("/api/streamer?view=dashboard").then((r) => r.json()).catch(() => ({ status: "error" })),
        fetch("/api/streamer?view=pending-gmv").then((r) => r.json()).catch(() => ({ status: "error", data: [] })),
        fetch("/api/payroll?tiering=1").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/absensi?view=history").then((r) => r.json()).catch(() => ({ status: "error", data: [] })),
      ]);

      if (jRes.status === "success") setJadwal(jRes.data);
      else setError(jRes.message ?? "Gagal memuat jadwal streamer");

      if (sRes.status === "success") setActiveSession(sRes.data);
      if (dRes.status === "success") setDashboardData(dRes.data);
      if (pRes.status === "success") setPendingGmvList(pRes.data || []);
      if (hRes.status === "success") setAbsensiHistory(hRes.data || []);
      if (tRes.status === "success") {
        setTiering((tRes.data ?? []).map((b: any) => ({
          tier: b.tier,
          jamMinimal: b.jamMinimal,
          jamMaksimal: b.jamMaksimal,
          ratePerJam: Number(b.ratePerJam),
        })));
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat memuat jadwal");
    } finally {
      setLoading(false);
    }
  }

  // Conflict calculation for leaveDate
  const conflictingJadwal = leaveDate && requestStatus?.activeJadwal
    ? requestStatus.activeJadwal.find((j: any) => {
        const jDate = new Date(j.tanggal).toISOString().slice(0, 10);
        return jDate === leaveDate;
      })
    : null;
  const hasScheduleConflict = Boolean(conflictingJadwal);

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveDate) return;
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/streamer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave-request", tanggal: leaveDate, alasan: leaveReason }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Pengajuan Libur berhasil dikirim! Menunggu persetujuan Eksekutif.");
        setLeaveDate("");
        setLeaveReason("");
        loadRequestStatus();
      } else {
        setError(d.message ?? "Gagal mengirim pengajuan libur");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftDate) return;
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/streamer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shift-request", tanggal: shiftDate, sesi: selectedSesi, catatan: shiftNote }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Request Sesi Live berhasil dikirim! Menunggu konfirmasi Eksekutif.");
        setShiftDate("");
        setShiftNote("");
        loadRequestStatus();
      } else {
        setError(d.message ?? "Gagal mengirim request sesi live");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleCheckIn() {
    if (!selectedJadwalId) {
      setError("Pilih jadwal live yang akan di-checkin");
      return;
    }

    // Dynamic late check
    const lateStatus = getLateCheckInStatus(selectedJadwalDetail);
    if (lateStatus.isLate && !alasanTerlambat.trim()) {
      setError(`Sesi ini terlambat ${lateStatus.lateDurationText} dari jadwal (${lateStatus.scheduledTimeText} WIB). Harap isi Alasan Keterlambatan.`);
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: "CHECK_IN",
          kategori: "STREAMER",
          jadwalId: selectedJadwalId,
          fotoBuktiUrl: fotoBuktiUrl || undefined,
          alasan: alasanTerlambat || undefined,
          isTerusan: !!activeSession,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Presensi Check-In berhasil! Status sesi live sekarang ON-AIR.");
        setSelectedJadwalId("");
        setSelectedJadwalDetail(null);
        setFotoBuktiUrl("");
        setAlasanTerlambat("");
        loadData();
        setActiveTab("jadwal");
      } else {
        setError(d.message ?? "Gagal melakukan check-in");
      }
    } catch (e: any) {
      setError(e.message || "Koneksi gagal saat presensi");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOutSubmit() {
    if (!reportedGmv) {
      setError("Harap isi total GMV income untuk sesi ini.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: "CHECK_OUT",
          kategori: "STREAMER",
          jadwalId: activeSession ? undefined : undefined,
          reportedGmv: parseFloat(reportedGmv),
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Presensi Check-Out berhasil! Sesi streaming tersimpan ke rekap payroll.");
        setReportedGmv("");
        loadData();
        setActiveTab("riwayat");
      } else {
        setError(d.message ?? "Gagal melakukan check-out");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePendingGmvSubmit() {
    if (!reportedGmv) {
      setError("Harap isi total GMV income untuk sesi ini.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/absensi?id=${pendingGmvId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedGmv: parseFloat(reportedGmv) }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ GMV berhasil disimpan!");
        setPendingGmvModalOpen(false);
        setReportedGmv("");
        loadData();
      } else {
        setError(d.message ?? "Gagal menyimpan GMV");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setActionLoading(false);
    }
  }

  const totalLiveHours = dashboardData?.totalJam ?? 0;
  const matchedTier = tiering.find((b) => totalLiveHours >= b.jamMinimal && totalLiveHours <= b.jamMaksimal);
  const currentTier = matchedTier?.tier ?? (tiering.length ? "Tidak ada tier" : "Basic");
  const currentRate = matchedTier?.ratePerJam ?? 25000;
  const currentLiveJadwal = jadwal.find((j) => j.liveState === "LIVE" || j.status === "ON_GOING");

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-headset text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {session?.user?.name ?? "Host Streamer"}
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  STREAMER
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{session?.user?.email}</p>
            </div>
          </div>

          {currentLiveJadwal && (
            <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-400/30 px-4 py-2 rounded-xl animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              <span className="text-xs font-bold text-rose-200">SEDANG ON AIR</span>
            </div>
          )}
        </div>

        {/* Tier & Hours Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Tier Pencapaian</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white">{currentTier}</span>
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-400/20 px-2 py-0.5 rounded-full">
                Rp {currentRate.toLocaleString("id-ID")}/jam
              </span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Total Jam Live Bulan Ini</span>
            <div className="text-base font-extrabold text-blue-300">
              {totalLiveHours.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ {matchedTier?.jamMaksimal ?? 80} Jam Target</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Total Sesi Selesai</span>
            <div className="text-base font-extrabold text-purple-300">
              {dashboardData?.totalSesi ?? 0} <span className="text-xs text-slate-400 font-normal">Sesi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
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

      {/* Pending GMV Alerts */}
      {pendingGmvList.map((p) => (
        <div key={p.id} className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl mt-1" />
            <div>
              <h3 className="font-black text-red-700 uppercase tracking-wider text-xs">PENTING: LAPORAN GMV TERTUNDA</h3>
              <p className="text-xs text-red-800 mt-0.5">
                Sesi: <strong>{p.jadwal?.client?.namaClient ?? "Klien"} ({p.jadwal?.platform})</strong> pada {formatDateSafe(p.jadwal?.tanggal)}.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setPendingGmvId(p.id); setPendingGmvModalOpen(true); }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md whitespace-nowrap"
          >
            Lengkapi GMV Sesi Ini
          </button>
        </div>
      ))}

      {/* Contract Alert */}
      {dashboardData?.kontrakDaysLeft !== null && dashboardData?.kontrakDaysLeft !== undefined && dashboardData.kontrakDaysLeft <= 30 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
          <i className="fa-solid fa-triangle-exclamation text-amber-500 text-lg mt-0.5" />
          <div>
            <div className="text-xs font-black text-amber-800">Perhatian: Kontrak Hampir Berakhir!</div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Kontrak Anda ({dashboardData.karyawan?.kontrakType ?? "Kontrak"}) akan berakhir dalam <strong>{dashboardData.kontrakDaysLeft} hari</strong> lagi.
            </div>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION — Streamlined & High Aesthetic */}
      <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError("");
                  setSuccess("");
                }}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                }`}
              >
                <i className={`${tab.icon} ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{tab.label}</span>
                {tab.id === "checkout" && pendingGmvList.length > 0 && (
                  <span className="bg-amber-400 text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {pendingGmvList.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======== TAB: CHECK IN ======== */}
      {activeTab === "checkin" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 mb-1 border-b border-slate-100 pb-2">Form Check-In Live</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Left: Jadwal selection + summary card */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Jadwal Anda *</label>
              <select
                value={selectedJadwalId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedJadwalId(val);
                  const found = jadwal.find((j) => j.id === val) ?? null;
                  setSelectedJadwalDetail(found);
                }}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                required
              >
                <option value="">-- Pilih Jadwal Siaran --</option>
                {jadwal
                  .filter((j) => j.status !== "SELESAI" && j.liveState !== "CLOSED" && j.liveState !== "LIVE")
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.idJadwal} – {j.client?.namaClient ?? "Brand"} ({formatDateSafe(j.tanggal)})
                    </option>
                  ))}
              </select>

              {/* Dark card summary (matching ref-website-lama ciSummary) */}
              {selectedJadwalDetail && (
                <div className="mt-4 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full">
                  <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Rangkuman Jadwal Terpilih</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">ID Jadwal</p>
                      <p className="text-sm font-bold text-blue-400">{selectedJadwalDetail.idJadwal}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Tanggal</p>
                      <p className="text-sm font-bold text-white">{formatDateSafe(selectedJadwalDetail.tanggal, { weekday: "short", day: "numeric", month: "short" })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Waktu Live</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {formatTimeSafe(selectedJadwalDetail.jamMulaiLive)}
                        {" – "}
                        {formatTimeSafe(selectedJadwalDetail.jamSelesaiLive)} WIB
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Brand / Client</p>
                      <p className="text-sm font-bold text-white">{selectedJadwalDetail.client?.namaClient ?? "–"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Platform</p>
                      <p className="text-sm font-bold text-white">{selectedJadwalDetail.platform ?? "–"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Lokasi Studio</p>
                      <p className="text-sm font-bold text-white">{selectedJadwalDetail.studio ?? "–"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Photo + dynamic late reason */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Foto Masuk (Selfie Kamera) *</label>
              <CameraCapture
                value={fotoBuktiUrl}
                onChange={setFotoBuktiUrl}
                label="📷 Buka Kamera PC/HP"
              />

              {(() => {
                const lateStatus = getLateCheckInStatus(selectedJadwalDetail);
                if (!selectedJadwalDetail) {
                  return (
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1">Alasan Terlambat (Opsional)</label>
                      <textarea
                        value={alasanTerlambat}
                        onChange={(e) => setAlasanTerlambat(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                        rows={2}
                        placeholder="Pilih jadwal siaran terlebih dahulu..."
                      />
                    </div>
                  );
                }

                if (lateStatus.isLate) {
                  return (
                    <div className="mt-4 bg-red-50/80 border border-red-200 p-4 rounded-2xl space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-red-800 flex items-center gap-1.5">
                          <span>⚠️ Alasan Terlambat (Wajib Diisi)</span>
                          <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Wajib</span>
                        </label>
                        <span className="text-[11px] font-bold text-red-700 font-mono bg-red-100 px-2.5 py-0.5 rounded-md">
                          Terlambat {lateStatus.lateDurationText}
                        </span>
                      </div>
                      <p className="text-[11px] text-red-700 leading-tight">
                        Waktu saat ini sudah melewati jadwal siaran (<strong>{lateStatus.scheduledTimeText} WIB</strong>). Harap isi alasan keterlambatan Anda.
                      </p>
                      <textarea
                        value={alasanTerlambat}
                        onChange={(e) => setAlasanTerlambat(e.target.value)}
                        className="w-full border border-red-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 outline-none bg-white font-medium shadow-inner"
                        rows={2}
                        placeholder="Contoh: Kendala macet di jalan / persiapan alat studio..."
                        required
                      />
                    </div>
                  );
                }

                return (
                  <div className="mt-4 bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <span>✅ Presensi Tepat Waktu</span>
                      </label>
                      <span className="text-[11px] font-bold text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded-md">
                        Jadwal: {lateStatus.scheduledTimeText} WIB
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-tight">
                      Anda melakukan check-in tepat waktu sebelum jam siaran dimulai. Alasan keterlambatan tidak diperlukan.
                    </p>
                    <textarea
                      value={alasanTerlambat}
                      onChange={(e) => setAlasanTerlambat(e.target.value)}
                      className="w-full border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      rows={2}
                      placeholder="Catatan tambahan (Opsional)..."
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {activeSession && (
            <div className="mt-4 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" /> Absensi Terusan Terdeteksi
              </label>
              <p className="text-[10px] text-amber-700">
                Anda belum melakukan check-out untuk sesi sebelumnya. Sistem akan <strong>otomatis menutup sesi sebelumnya</strong>. Laporan GMV dapat dilengkapi di tab History.
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-5 mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={actionLoading || !selectedJadwalId}
              className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition shadow-md w-full md:w-auto disabled:opacity-50"
            >
              <i className="fa-solid fa-cloud-arrow-up mr-2" />
              {actionLoading ? "Memproses..." : "Submit Check-In"}
            </button>
          </div>
        </div>
      )}

      {/* ======== TAB: CHECK OUT ======== */}
      {activeTab === "checkout" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 mb-1 border-b border-slate-100 pb-2">Form Check-Out Live</h3>

          {activeSession ? (
            <>
              {/* Dark card summary of active session */}
              <div className="mt-4 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full mb-6">
                <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Detail Sesi Aktif Anda</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Waktu Check-In</p>
                    <p className="text-sm font-bold text-emerald-400">
                      {formatTimeSafe(activeSession.waktu)} WIB
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Durasi Berlangsung</p>
                    <p className="text-sm font-bold text-blue-400">
                      {Math.round((Date.now() - new Date(activeSession.waktu).getTime()) / 60000)} Menit
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Status</p>
                    <p className="text-sm font-bold text-rose-400">🔴 ON AIR</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nominal GMV (Rp) *</label>
                  <input
                    type="number"
                    value={reportedGmv}
                    onChange={(e) => setReportedGmv(e.target.value)}
                    placeholder="Contoh: 1500000"
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-slate-50 mb-4"
                    required
                  />
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-1.5 leading-tight">
                    <i className="fa-solid fa-triangle-exclamation text-red-600 mt-0.5 text-xs" />
                    <span className="text-[10px] text-red-700">
                      <strong>PENTING:</strong> Hanya masukkan income GMV yang dihasilkan pada <strong>sesi INI SAJA</strong>.
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Foto Bukti GMV *</label>
                  <CameraCapture
                    value={fotoBuktiUrl}
                    onChange={setFotoBuktiUrl}
                    label="📷 Ambil Bukti / Selfie Keluar"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCheckOutSubmit}
                  disabled={actionLoading || !reportedGmv}
                  className="bg-amber-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-amber-600 transition shadow-md w-full md:w-auto disabled:opacity-50"
                >
                  <i className="fa-solid fa-upload mr-2" />
                  {actionLoading ? "Memproses..." : "Selesaikan Sesi (Check-Out)"}
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 p-6 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-video-slash text-3xl mb-3 block text-slate-300" />
              Anda tidak memiliki sesi live aktif saat ini.
              <br />
              <span className="text-xs">Lakukan Check-In terlebih dahulu di tab <strong>Check In</strong>.</span>
            </div>
          )}
        </div>
      )}

      {/* ======== TAB: TERBATAS ======== */}
      {activeTab === "terbatas" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 border-b border-slate-200 pb-3 gap-4">
            <h3 className="font-bold text-lg text-slate-900">
              <i className="fa-solid fa-bolt text-amber-500 mr-2" />
              Aksi Khusus
            </h3>
          </div>

          {/* Pending GMV list */}
          <div>
            <h4 className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
              <i className="fa-solid fa-triangle-exclamation mr-2" />
              Peringatan: Laporan GMV yang Belum Dilengkapi
            </h4>

            {pendingGmvList.length > 0 ? (
              <div className="overflow-auto rounded-lg border border-slate-200 mb-4 max-h-[400px]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">NO</th>
                      <th className="px-4 py-3">ID JADWAL</th>
                      <th className="px-4 py-3">INFO LIVE</th>
                      <th className="px-4 py-3 text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {pendingGmvList.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{p.jadwal?.idJadwal ?? "–"}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{p.jadwal?.client?.namaClient ?? "Klien"}</div>
                          <div className="text-xs text-slate-500">{p.jadwal?.platform} • {formatDateSafe(p.jadwal?.tanggal)}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { setPendingGmvId(p.id); setPendingGmvModalOpen(true); }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
                          >
                            Lengkapi GMV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                <i className="fa-solid fa-circle-check text-2xl text-emerald-400 block mb-2" />
                Tidak ada tanggungan GMV. Bagus!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== TAB: JADWAL ======== */}
      {activeTab === "jadwal" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Jadwal Live Streaming Saya</h3>
              <p className="text-[11px] text-slate-400">Hadir 15 menit sebelum jam mulai untuk persiapan brief & sample produk.</p>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{jadwal.length} Jadwal</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
                {jadwal.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{j.idJadwal}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {formatDateSafe(j.tanggal, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <div className="text-[11px] text-blue-600 font-mono">
                        {formatTimeSafe(j.jamMulaiLive)}
                        {" - "}
                        {formatTimeSafe(j.jamSelesaiLive)} WIB
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{j.client?.namaClient ?? "Brand Partner"}</div>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{j.platform ?? "Shopee Live"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      <i className="fa-solid fa-location-dot text-slate-400 mr-1.5" />
                      {j.studio ?? "Studio 1"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {j.absensi && j.absensi.length > 0 && j.absensi.some(a => a.reportedGmv !== null)
                        ? `Rp ${j.absensi.reduce((sum, a) => sum + Number(a.reportedGmv || 0), 0).toLocaleString("id-ID")}`
                        : <span className="text-[10px] text-slate-400 font-normal italic">Belum ada</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        j.liveState === "LIVE"
                          ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                          : j.status === "SELESAI"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {j.liveState === "LIVE" ? "🔴 ON AIR" : j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={generateGoogleCalendarUrl({
                            title: `🔴 Live Streaming: ${j.client?.namaClient ?? "Brand Partner"} (${j.platform ?? "Shopee Live"})`,
                            description: `Jadwal Siaran Live Streaming Agency Potensi Creative\nID Sesi: ${j.idJadwal}\nStudio: ${j.studio ?? "Studio 1"}\nPengingat otomatis diset: 30 mnt & 15 mnt sebelum siaran.`,
                            location: `Studio ${j.studio ?? "Studio 1"}, Potensi Creative`,
                            startTime: j.jamMulaiLive,
                            endTime: j.jamSelesaiLive,
                            reminderMinutes: [30, 15],
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Tambah Pengingat Google Calendar (Pop-up 30m & 15m)"
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                        >
                          <i className="fa-solid fa-calendar-plus text-blue-600" />
                          <span className="hidden sm:inline">Sync GCal</span>
                        </a>

                        {j.liveState === "LIVE" ? (
                          <button
                            onClick={() => setActiveTab("checkout")}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Check-Out
                          </button>
                        ) : j.status === "SELESAI" || j.liveState === "CLOSED" ? (
                          <span className="text-[10px] text-slate-400 font-bold italic">Selesai</span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedJadwalId(j.id);
                              setSelectedJadwalDetail(j);
                              setActiveTab("checkin");
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Check-In
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
            {jadwal.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada jadwal live streaming yang ditugaskan kepada Anda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== TAB: REQUEST ======== */}
      {activeTab === "request" && (
        <div className="space-y-6">
          {/* Header & Quota Overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-file-pen text-blue-600" />
                  Pusat Pengajuan Streamer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajukan permohonan Libur dan preferensi Request Sesi Live siaran.
                </p>
              </div>

              {/* Quota Indicators */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2">
                  <div className="text-[10px] uppercase font-bold text-blue-700">Sisa Kuota Libur</div>
                  <div className="text-sm font-bold text-blue-900">
                    {requestStatus ? `${requestStatus.sisaKuotaLibur} / ${requestStatus.defaultKuotaLibur} Hari` : "Memuat..."}
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-3.5 py-2">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Sisa Kuota Sesi</div>
                  <div className="text-sm font-bold text-purple-900">
                    {requestStatus ? `${requestStatus.sisaKuotaShift} / ${requestStatus.defaultKuotaShift} Kali` : "Memuat..."}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Toggle Off Banners */}
            {requestStatus && (!requestStatus.allowLiburRequest || !requestStatus.allowShiftRequest) && (
              <div className="mt-4 space-y-2">
                {!requestStatus.allowLiburRequest && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <i className="fa-solid fa-lock text-amber-600" />
                    <span><strong>Form Pengajuan Libur Ditutup:</strong> Tim Manajemen sedang menutup akses pengajuan libur sementara.</span>
                  </div>
                )}
                {!requestStatus.allowShiftRequest && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <i className="fa-solid fa-lock text-amber-600" />
                    <span><strong>Form Request Sesi Live Ditutup:</strong> Tim Manajemen sedang menutup akses request sesi live sementara.</span>
                  </div>
                )}
              </div>
            )}

            {/* Request Type Sub-tabs */}
            <div className="flex gap-2 border-b border-slate-100 pt-5 pb-1">
              <button
                type="button"
                onClick={() => setRequestSubTab("libur")}
                className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  requestSubTab === "libur"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <i className="fa-solid fa-calendar-xmark" />
                <span>Pengajuan Libur</span>
              </button>
              <button
                type="button"
                onClick={() => setRequestSubTab("sesi")}
                className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  requestSubTab === "sesi"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <i className="fa-solid fa-video" />
                <span>Request Sesi Live (3 Shift)</span>
              </button>
            </div>

            {/* Form 1: Pengajuan Libur */}
            {requestSubTab === "libur" && (
              <div className="pt-5 space-y-4">
                {requestStatus?.allowLiburRequest === false ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    <i className="fa-solid fa-ban text-3xl text-slate-300 block mb-2" />
                    Pengajuan Libur saat ini sedang dinonaktifkan oleh Eksekutif.
                  </div>
                ) : (
                  <form onSubmit={handleLeaveSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Tanggal Libur yang Diajukan *
                        </label>
                        <input
                          type="date"
                          value={leaveDate}
                          onChange={(e) => setLeaveDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Alasan Libur
                        </label>
                        <input
                          type="text"
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder="mis. Keperluan keluarga, istirahat..."
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                    </div>

                    {/* Conflict Warning if schedule exists */}
                    {hasScheduleConflict && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5" />
                        <div>
                          <strong>Peringatan Jadwal Live Terjadwal:</strong> Anda sudah memiliki sesi live aktif pada tanggal ini ({conflictingJadwal?.idJadwal} - {conflictingJadwal?.platform}).
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            Pengajuan tetap dapat dikirimkan dan akan masuk status <strong>Menunggu Persetujuan Eksekutif</strong>.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Syarat dan Ketentuan Request Libur */}
                    <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-slate-800 space-y-2.5 shadow-2xs">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
                        <span>Syarat dan Ketentuan Request Libur:</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700 font-medium pl-5 list-disc marker:text-amber-500 leading-relaxed">
                        <li>Setiap streamer berhak libur 1 kali setiap periode minggu.</li>
                        <li>Periode minggu terhitung mulai dari hari Senin sampai Minggu.</li>
                        <li><strong className="text-red-600 font-bold">Double date</strong> dan <strong className="text-red-600 font-bold">payday</strong> tidak boleh libur.</li>
                        <li>Pengajuan libur yang sudah terkirim tidak bisa dirubah.</li>
                      </ul>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingRequest || !leaveDate}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                      >
                        {submittingRequest ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                        <span>{submittingRequest ? "Mengirim..." : "Kirim Pengajuan Libur"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Form 2: Request Sesi Live (3 Sesi Shift) */}
            {requestSubTab === "sesi" && (
              <div className="pt-5 space-y-4">
                {requestStatus?.allowShiftRequest === false ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    <i className="fa-solid fa-ban text-3xl text-slate-300 block mb-2" />
                    Request Sesi Live saat ini sedang dinonaktifkan oleh Eksekutif.
                  </div>
                ) : (
                  <form onSubmit={handleShiftSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Tanggal Sesi *
                        </label>
                        <input
                          type="date"
                          value={shiftDate}
                          onChange={(e) => setShiftDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Pilihan Sesi Live (Shift 24 Jam) *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: "SESI_1", label: "Sesi 1", time: "00:00 - 08:00", icon: "fa-moon" },
                            { key: "SESI_2", label: "Sesi 2", time: "08:00 - 16:00", icon: "fa-sun" },
                            { key: "SESI_3", label: "Sesi 3", time: "16:00 - 00:00", icon: "fa-cloud-sun" },
                          ].map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setSelectedSesi(s.key as any)}
                              className={`p-2.5 rounded-xl border text-left transition ${
                                selectedSesi === s.key
                                  ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-2 ring-purple-500/20"
                                  : "border-slate-200 hover:border-purple-200 text-slate-700 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <i className={`fa-solid ${s.icon} text-purple-600`} />
                                <span>{s.label}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.time}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Catatan Tambahan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={shiftNote}
                        onChange={(e) => setShiftNote(e.target.value)}
                        placeholder="mis. Request sesi pagi karena kuliah sore..."
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingRequest || !shiftDate}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-purple-600/20 disabled:opacity-50 flex items-center gap-2"
                      >
                        {submittingRequest ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                        <span>{submittingRequest ? "Mengirim..." : "Kirim Request Sesi Live"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Riwayat Pengajuan Streamer */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-slate-500" />
                Riwayat Pengajuan Libur & Sesi Live Bulan Ini
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {((requestStatus?.leaveRequests?.length ?? 0) + (requestStatus?.shiftRequests?.length ?? 0))} Pengajuan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tanggal Pengajuan</th>
                    <th className="px-4 py-3">Tipe Permohonan</th>
                    <th className="px-4 py-3">Keterangan / Detail</th>
                    <th className="px-4 py-3">Status Persetujuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestStatus && (requestStatus.leaveRequests.length > 0 || requestStatus.shiftRequests.length > 0) ? (
                    <>
                      {requestStatus.leaveRequests.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {formatDateSafe(l.tanggalMulai, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              🏖️ Libur Streamer
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{l.alasan || "–"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              l.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : l.status === "REJECTED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {l.status === "APPROVED" ? "Disetujui" : l.status === "REJECTED" ? "Ditolak" : "Menunggu Approval"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {requestStatus.shiftRequests.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {formatDateSafe(s.tanggalMulai, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              📹 {s.jenis?.replace("REQUEST_", "") || "Sesi Live"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.alasan || "–"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : s.status === "REJECTED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {s.status === "APPROVED" ? "Disetujui" : s.status === "REJECTED" ? "Ditolak" : "Menunggu Approval"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                        Belum ada riwayat pengajuan libur atau request sesi live.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Other Portal Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/pengajuan?tab=tukar-shift"
              className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/40 transition group text-center shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg group-hover:scale-110 transition">
                <i className="fa-solid fa-right-left" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs group-hover:text-blue-700">Tukar Shift</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Penggantian jadwal live streaming</div>
              </div>
            </Link>

            <Link
              href="/pengajuan?tab=izin"
              className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50/40 transition group text-center shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg group-hover:scale-110 transition">
                <i className="fa-solid fa-file-signature" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs group-hover:text-amber-700">Pengajuan Izin / Cuti</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sakit, cuti tahunan, atau keperluan</div>
              </div>
            </Link>

            <Link
              href="/pengajuan?tab=lembur"
              className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 hover:bg-purple-50/40 transition group text-center shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg group-hover:scale-110 transition">
                <i className="fa-regular fa-clock" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs group-hover:text-purple-700">Pengajuan Lembur</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tambahan jam siaran (1.5x rate)</div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ======== TAB: HISTORY / RIWAYAT ======== */}
      {activeTab === "riwayat" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Presensi & Sesi Live</h3>
              <p className="text-[11px] text-slate-400">Log absensi check-in / check-out bulan ini</p>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{absensiHistory.length} Entri</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Jadwal / Sesi</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Waktu Masuk</th>
                  <th className="px-4 py-3">Waktu Keluar</th>
                  <th className="px-4 py-3">GMV Dilaporkan</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {absensiHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-blue-600 text-[10px]">{h.jadwal?.idJadwal ?? "–"}</div>
                      <div className="text-[10px] text-slate-400">{h.jadwal?.client?.namaClient ?? "–"} {h.jadwal?.platform ? `• ${h.jadwal.platform}` : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        h.tipe === "CHECK_IN" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {h.tipe === "CHECK_IN" ? "Check-In" : "Check-Out"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatDateTimeSafe(h.waktuMasuk)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {h.waktuKeluar
                        ? formatDateTimeSafe(h.waktuKeluar)
                        : <span className="text-slate-400 italic text-[10px]">Belum checkout</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {h.reportedGmv !== null && h.reportedGmv !== undefined
                        ? `Rp ${Number(h.reportedGmv).toLocaleString("id-ID")}`
                        : <span className="text-slate-400 italic text-[10px]">Belum dilaporkan</span>}
                    </td>
                    <td className="px-4 py-3">
                      {h.isTerusan && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">Terusan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {absensiHistory.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada riwayat presensi tersimpan.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== TAB: REPORT (Admin Only) ======== */}
      {activeTab === "report" && isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-slate-100 pb-2">Laporan Performa Streamer</h3>

          {/* Stat Cards */}
          {dashboardData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Estimasi Gaji Bersih</div>
                <div className="text-lg font-black text-emerald-700">Rp {dashboardData.netPay.toLocaleString("id-ID")}</div>
                <div className="text-[10px] text-slate-500 mt-1">Setelah denda • {dashboardData.periode}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">Total GMV Dilaporkan</div>
                <div className="text-lg font-black text-blue-700">Rp {dashboardData.totalGmv.toLocaleString("id-ID")}</div>
                <div className="text-[10px] text-slate-500 mt-1">Dari semua sesi</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[10px] text-purple-600 font-bold uppercase mb-1">Total Jam Live</div>
                <div className="text-lg font-black text-purple-700">{dashboardData.totalJam} Jam</div>
                <div className="text-[10px] text-slate-500 mt-1">Tier: <span className="font-bold text-purple-600">{dashboardData.activeTier?.nama ?? "–"}</span></div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[10px] text-red-600 font-bold uppercase mb-1">Total Denda</div>
                <div className="text-lg font-black text-red-700">Rp {dashboardData.totalDenda.toLocaleString("id-ID")}</div>
                <div className="text-[10px] text-slate-500 mt-1">{dashboardData.incidents.length} Pelanggaran</div>
              </div>
            </div>
          )}

          <div className="text-center text-slate-400 text-sm">
            <i className="fa-solid fa-chart-pie text-3xl mb-2 block text-slate-300" />
            Laporan lengkap tersedia di halaman Analytics GMV.
            <br />
            <Link href="/analytics-gmv" className="text-blue-600 hover:underline font-semibold text-xs mt-1 inline-block">
              → Buka Analytics GMV
            </Link>
          </div>
        </div>
      )}

      {/* Pending GMV Modal */}
      {pendingGmvModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-red-600" />
                <span>Lengkapi Laporan GMV</span>
              </h3>
              <button onClick={() => setPendingGmvModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Total Income / GMV Sesi (Wajib)</label>
              <input
                type="number"
                value={reportedGmv}
                onChange={(e) => setReportedGmv(e.target.value)}
                placeholder="Contoh: 1500000"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingGmvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePendingGmvSubmit}
                disabled={actionLoading || !reportedGmv}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-50"
              >
                {actionLoading ? "Menyimpan..." : "Simpan GMV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
