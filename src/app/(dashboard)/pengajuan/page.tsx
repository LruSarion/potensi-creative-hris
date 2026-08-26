"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

// --- Date Helper Utilities (Guarantees NO "Invalid Date" errors) ---
function formatDateSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    // Handle string date YYYY-MM-DD directly if valid
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      const [year, month, day] = val.trim().split("-");
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return fallback;
  }
}

function formatTimeSafe(val: any, fallback = "–"): string {
  if (!val) return fallback;
  try {
    if (typeof val === "string" && /^\d{2}:\d{2}/.test(val.trim())) {
      return val.trim().slice(0, 5);
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fallback;
  }
}

const JENIS_IZIN_OPTIONS = [
  { value: "CUTI TAHUNAN", label: "Cuti Tahunan", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "SAKIT", label: "Izin Sakit (Dokter)", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "KEPERLUAN PRIBADI", label: "Izin Keperluan Pribadi", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "CUTI MELAHIRKAN", label: "Cuti Melahirkan", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "LAINNYA", label: "Izin Lainnya", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

function PengajuanContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active Tab: lembur | izin | tukar-shift | suara
  const tabQuery = searchParams.get("tab") || "lembur";
  const [activeTab, setActiveTab] = useState<string>(tabQuery);

  useEffect(() => {
    const q = searchParams.get("tab");
    if (q) setActiveTab(q);
  }, [searchParams]);

  function changeTab(tabId: string) {
    setActiveTab(tabId);
    setError("");
    setSuccess("");
    router.replace(`/pengajuan?tab=${tabId}`, { scroll: false });
  }

  // Common State
  const [employees, setEmployees] = useState<any[]>([]);
  const [streamers, setStreamers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Tab 1: Lembur State
  const [lemburMode, setLemburMode] = useState<"ajukan" | "mulai" | "selesai">("ajukan");
  const [lemburHistory, setLemburHistory] = useState<any[]>([]);
  const [lemburSpv, setLemburSpv] = useState("");
  const [lemburForm, setLemburForm] = useState({
    karyawanId: "",
    tanggal: "",
    jamMulai: "",
    jamSelesai: "",
    alasan: "",
  });
  const [mulaiLemburForm, setMulaiLemburForm] = useState({ idLembur: "", foto: "" });
  const [selesaiLemburForm, setSelesaiLemburForm] = useState({ idLembur: "", foto: "", catatan: "" });

  // Tab 2: Izin State
  const [izinHistory, setIzinHistory] = useState<any[]>([]);
  const [sisaCuti, setSisaCuti] = useState<number | null>(null);
  const [izinForm, setIzinForm] = useState({
    karyawanId: "",
    tanggalMulai: "",
    tanggalSelesai: "",
    jenis: "CUTI TAHUNAN",
    alasan: "",
  });

  // Tab 3: Tukar Shift State
  const [tukarHistory, setTukarHistory] = useState<any[]>([]);
  const [tukarForm, setTukarForm] = useState({
    requesterId: "",
    targetId: "",
    tanggal: "",
    alasan: "",
  });

  // Tab 4: Suara Karyawan State
  const [suaraList, setSuaraList] = useState<any[]>([]);
  const [suaraForm, setSuaraForm] = useState({
    kategori: "KELUHAN",
    deskripsi: "",
    harapan: "",
    isAnonim: true,
  });

  useEffect(() => {
    if (status === "authenticated") loadAllData();
  }, [status]);

  async function loadAllData() {
    try {
      const [empRes, strmRes, lmbRes, iznRes, tkrRes, surRes] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/employees?kategori=STREAMER").then((r) => r.json()),
        fetch("/api/lembur").then((r) => r.json()),
        fetch("/api/izin").then((r) => r.json()),
        fetch("/api/tukar-shift").then((r) => r.json()),
        fetch("/api/suara").then((r) => r.json()),
      ]);

      if (empRes.status === "success") {
        setEmployees(empRes.data);
        if (session?.user?.karyawanId) {
          const match = empRes.data.find((e: any) => e.id === session.user.karyawanId);
          if (match) {
            setLemburForm((f) => ({ ...f, karyawanId: match.id }));
            setIzinForm((f) => ({ ...f, karyawanId: match.id }));
            setSisaCuti(match.sisaCuti ?? 12);
          }
        }
      }

      if (strmRes.status === "success") {
        setStreamers(strmRes.data);
        if (session?.user?.karyawanId) {
          const match = strmRes.data.find((e: any) => e.id === session.user.karyawanId);
          if (match) setTukarForm((f) => ({ ...f, requesterId: match.id }));
        }
      }

      if (lmbRes.status === "success") setLemburHistory(lmbRes.data);
      if (iznRes.status === "success") setIzinHistory(iznRes.data);
      if (tkrRes.status === "success") setTukarHistory(tkrRes.data);
      if (surRes.status === "success") setSuaraList(surRes.data);
    } catch {
      // ignore
    }
  }

  // --- Handlers Tab 1: Lembur ---
  async function submitLembur(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/lembur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lemburForm),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Permohonan lembur berhasil diajukan!");
        setLemburForm((f) => ({ ...f, jamMulai: "", jamSelesai: "", alasan: "" }));
        loadAllData();
      } else { setError(d.message ?? "Gagal mengajukan lembur"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  async function submitMulaiLembur(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/lembur", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MULAI", idLembur: mulaiLemburForm.idLembur, foto: mulaiLemburForm.foto }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Absen mulai lembur berhasil dicatat!");
        setMulaiLemburForm({ idLembur: "", foto: "" });
        loadAllData();
      } else { setError(d.message ?? "Gagal absen mulai lembur"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  async function submitSelesaiLembur(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/lembur", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SELESAI", idLembur: selesaiLemburForm.idLembur, foto: selesaiLemburForm.foto, catatan: selesaiLemburForm.catatan }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Laporan lembur selesai berhasil dikirim!");
        setSelesaiLemburForm({ idLembur: "", foto: "", catatan: "" });
        loadAllData();
      } else { setError(d.message ?? "Gagal absen selesai lembur"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  // --- Handlers Tab 2: Izin ---
  async function submitIzin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/izin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(izinForm),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Permohonan cuti/izin berhasil dikirim!");
        setIzinForm((f) => ({ ...f, tanggalMulai: "", tanggalSelesai: "", alasan: "" }));
        loadAllData();
      } else { setError(d.message ?? "Gagal mengajukan izin"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  // --- Handlers Tab 3: Tukar Shift ---
  async function submitTukarShift(e: React.FormEvent) {
    e.preventDefault();
    if (tukarForm.requesterId === tukarForm.targetId) {
      setError("Streamer pengganti harus berbeda dari pemohon.");
      return;
    }
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/tukar-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tukarForm),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Permintaan tukar shift berhasil diajukan!");
        setTukarForm((f) => ({ ...f, targetId: "", tanggal: "", alasan: "" }));
        loadAllData();
      } else { setError(d.message ?? "Gagal mengajukan tukar shift"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  async function handleTukarAction(id: string, approve: boolean) {
    try {
      const res = await fetch(`/api/tukar-shift?id=${id}&approve=${approve}`, { method: "PATCH" });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Tukar shift berhasil ${approve ? "disetujui" : "ditolak"}`);
        loadAllData();
      } else { setError(d.message ?? "Gagal memproses approval"); }
    } catch { setError("Koneksi gagal"); }
  }

  async function handleTukarConfirm(id: string) {
    try {
      const res = await fetch(`/api/tukar-shift?id=${id}&action=confirm`, { method: "PATCH" });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Konfirmasi bersedia berhasil dikirim. Menunggu approval admin.");
        loadAllData();
      } else { setError(d.message ?? "Gagal mengkonfirmasi"); }
    } catch { setError("Koneksi gagal"); }
  }

  // --- Handlers Tab 4: Suara Karyawan ---
  async function submitSuara(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/suara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori: suaraForm.kategori,
          pesan: `[Deskripsi]: ${suaraForm.deskripsi}\n[Harapan]: ${suaraForm.harapan}`,
          isAnonim: suaraForm.isAnonim,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("✅ Laporan aspirasi Anda berhasil dikirim!");
        setSuaraForm({ kategori: "KELUHAN", deskripsi: "", harapan: "", isAnonim: true });
        loadAllData();
      } else { setError(d.message ?? "Gagal mengirim laporan"); }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setLoading(false); }
  }

  function renderStatusBadge(statusStr: string) {
    const s = (statusStr || "PENDING").toUpperCase();
    if (s === "APPROVED" || s === "DISETUJUI") {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Disetujui</span>;
    }
    if (s === "REJECTED" || s === "DITOLAK") {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">✕ Ditolak</span>;
    }
    if (s === "TARGET_CONFIRMED") {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">✓ Pengganti Setuju</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⏳ Menunggu</span>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl text-blue-300 border border-white/20 shadow-inner">
              <i className="fa-solid fa-paper-plane" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Pusat Pengajuan</h1>
                <span className="bg-blue-500/30 text-blue-200 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-400/30">1-Stop Hub</span>
              </div>
              <p className="text-blue-100/80 text-xs sm:text-sm mt-1 max-w-xl">
                Ajukan lembur, izin cuti, tukar shift, dan suara aspirasi karyawan secara praktis dalam satu layar terpadu.
              </p>
            </div>
          </div>

          {sisaCuti !== null && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 rounded-2xl flex items-center gap-4 self-start md:self-auto">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center text-xl">
                <i className="fa-solid fa-umbrella-beach" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Sisa Cuti Tahunan</div>
                <div className="text-xl font-black text-white">{sisaCuti} <span className="text-xs font-medium text-blue-200">Hari</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Toast Alert */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-check text-emerald-600 text-base" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-semibold px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-exclamation text-red-600 text-base" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* 4 Main Segment Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: "lembur", label: "Lembur", sub: "Pengajuan & Absen Jam", icon: "fa-regular fa-clock", badge: lemburHistory.length, color: "from-blue-600 to-indigo-600" },
          { id: "izin", label: "Cuti & Izin", sub: "Tahunan, Sakit, Pribadi", icon: "fa-regular fa-calendar-xmark", badge: izinHistory.length, color: "from-indigo-600 to-purple-600" },
          { id: "tukar-shift", label: "Tukar Shift", sub: "Ganti Jadwal Live", icon: "fa-solid fa-rotate", badge: tukarHistory.length, color: "from-purple-600 to-pink-600" },
          { id: "suara", label: "Suara Karyawan", sub: "Aspirasi & Keluhan", icon: "fa-regular fa-comment-dots", badge: suaraList.length, color: "from-emerald-600 to-teal-600" },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`text-left p-4 rounded-2xl transition-all duration-200 relative overflow-hidden border ${
                isActive
                  ? "bg-white border-blue-600 shadow-lg ring-2 ring-blue-600/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    isActive ? `bg-gradient-to-r ${t.color} text-white shadow-md` : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <i className={t.icon} />
                </div>
                {t.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {t.badge}
                  </span>
                )}
              </div>
              <div className={`font-bold text-sm ${isActive ? "text-blue-900" : "text-slate-800"}`}>{t.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{t.sub}</div>
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: LEMBUR */}
      {/* ========================================================================= */}
      {activeTab === "lembur" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <i className="fa-regular fa-clock text-blue-600" />
                <span>Form Lembur</span>
              </h2>
              {/* Mode Toggle Pills */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setLemburMode("ajukan")}
                  className={`px-2.5 py-1 rounded-lg transition ${lemburMode === "ajukan" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"}`}
                >
                  Ajukan
                </button>
                <button
                  type="button"
                  onClick={() => setLemburMode("mulai")}
                  className={`px-2.5 py-1 rounded-lg transition ${lemburMode === "mulai" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"}`}
                >
                  Mulai
                </button>
                <button
                  type="button"
                  onClick={() => setLemburMode("selesai")}
                  className={`px-2.5 py-1 rounded-lg transition ${lemburMode === "selesai" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"}`}
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Mode A: Ajukan Lembur */}
            {lemburMode === "ajukan" && (
              <form onSubmit={submitLembur} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tanggal Lembur</label>
                  <input
                    type="date"
                    value={lemburForm.tanggal}
                    onChange={(e) => setLemburForm({ ...lemburForm, tanggal: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Jam Mulai</label>
                    <input
                      type="time"
                      value={lemburForm.jamMulai}
                      onChange={(e) => setLemburForm({ ...lemburForm, jamMulai: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Jam Selesai</label>
                    <input
                      type="time"
                      value={lemburForm.jamSelesai}
                      onChange={(e) => setLemburForm({ ...lemburForm, jamSelesai: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Penanggung Jawab (SPV)</label>
                  <input
                    type="text"
                    value={lemburSpv}
                    onChange={(e) => setLemburSpv(e.target.value)}
                    placeholder="Nama SPV / Supervisor On-Duty"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kegiatan / Alasan Lembur</label>
                  <textarea
                    rows={3}
                    value={lemburForm.alasan}
                    onChange={(e) => setLemburForm({ ...lemburForm, alasan: e.target.value })}
                    placeholder="Jelaskan secara singkat pekerjaan yang dilakukan..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {loading ? "Mengirim..." : "Kirim Pengajuan Lembur"}
                </button>
              </form>
            )}

            {/* Mode B: Mulai Lembur */}
            {lemburMode === "mulai" && (
              <form onSubmit={submitMulaiLembur} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">ID Lembur (Disetujui)</label>
                  <input
                    type="text"
                    value={mulaiLemburForm.idLembur}
                    onChange={(e) => setMulaiLemburForm({ ...mulaiLemburForm, idLembur: e.target.value })}
                    placeholder="Contoh: LMB-001"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Foto Masuk (Bukti Kamera)</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setMulaiLemburForm((m) => ({ ...m, foto: reader.result as string }));
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl text-xs file:mr-2 file:py-1.5 file:px-3 file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Absen Mulai Lembur"}
                </button>
              </form>
            )}

            {/* Mode C: Selesai Lembur */}
            {lemburMode === "selesai" && (
              <form onSubmit={submitSelesaiLembur} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">ID Lembur (Aktif)</label>
                  <input
                    type="text"
                    value={selesaiLemburForm.idLembur}
                    onChange={(e) => setSelesaiLemburForm({ ...selesaiLemburForm, idLembur: e.target.value })}
                    placeholder="Contoh: LMB-001"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Laporan Output Pekerjaan</label>
                  <textarea
                    rows={3}
                    value={selesaiLemburForm.catatan}
                    onChange={(e) => setSelesaiLemburForm({ ...selesaiLemburForm, catatan: e.target.value })}
                    placeholder="Rincian hasil output lembur yang selesai..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Submit Selesai Lembur"}
                </button>
              </form>
            )}
          </div>

          {/* Right History Table (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Pengajuan Lembur</h3>
              <span className="text-xs text-slate-500 font-medium">{lemburHistory.length} Record</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Alasan / Kegiatan</th>
                    <th className="px-4 py-3">Jam Live</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lemburHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
                        {formatDateSafe(h.tanggal)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{h.alasan ?? "–"}</td>
                      <td className="px-4 py-3 font-mono text-blue-600 whitespace-nowrap">
                        {formatTimeSafe(h.jamMulai)} - {formatTimeSafe(h.jamSelesai)}
                      </td>
                      <td className="px-4 py-3 text-right">{renderStatusBadge(h.status)}</td>
                    </tr>
                  ))}
                  {lemburHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Belum ada riwayat lembur.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CUTI & IZIN */}
      {/* ========================================================================= */}
      {activeTab === "izin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-4 flex items-center gap-2">
              <i className="fa-regular fa-calendar-xmark text-indigo-600" />
              <span>Form Cuti / Izin</span>
            </h2>

            <form onSubmit={submitIzin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Jenis Permohonan</label>
                <select
                  value={izinForm.jenis}
                  onChange={(e) => setIzinForm({ ...izinForm, jenis: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                  required
                >
                  {JENIS_IZIN_OPTIONS.map((j) => (
                    <option key={j.value} value={j.value}>{j.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tgl Mulai</label>
                  <input
                    type="date"
                    value={izinForm.tanggalMulai}
                    onChange={(e) => setIzinForm({ ...izinForm, tanggalMulai: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tgl Selesai</label>
                  <input
                    type="date"
                    value={izinForm.tanggalSelesai}
                    onChange={(e) => setIzinForm({ ...izinForm, tanggalSelesai: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Alasan Permohonan</label>
                <textarea
                  rows={3}
                  value={izinForm.alasan}
                  onChange={(e) => setIzinForm({ ...izinForm, alasan: e.target.value })}
                  placeholder="Keterangan detail izin..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Lampiran Bukti (Opsional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border border-slate-200 rounded-xl text-xs file:mr-2 file:py-1.5 file:px-3 file:border-0 file:bg-slate-100 cursor-pointer"
                />
              </div>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                <span>{loading ? "Mengirim..." : "Kirim Pengajuan Cuti/Izin"}</span>
              </button>
            </form>
          </div>

          {/* Right History Table (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Cuti & Izin</h3>
              <span className="text-xs text-slate-500 font-medium">{izinHistory.length} Record</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Rentang Tanggal</th>
                    <th className="px-4 py-3">Alasan</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {izinHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">{h.jenis}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {formatDateSafe(h.tanggalMulai)} – {formatDateSafe(h.tanggalSelesai)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{h.alasan ?? "–"}</td>
                      <td className="px-4 py-3 text-right">{renderStatusBadge(h.status)}</td>
                    </tr>
                  ))}
                  {izinHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Belum ada riwayat cuti.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: TUKAR SHIFT */}
      {/* ========================================================================= */}
      {activeTab === "tukar-shift" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-rotate text-purple-600" />
              <span>Form Tukar Shift Streamer</span>
            </h2>

            <form onSubmit={submitTukarShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Streamer Pemohon (Berhalangan)</label>
                <select
                  value={tukarForm.requesterId}
                  onChange={(e) => setTukarForm({ ...tukarForm, requesterId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                  required
                >
                  <option value="">-- Pilih Streamer Pemohon --</option>
                  {streamers.map((s) => (
                    <option key={s.id} value={s.id}>{s.namaLengkap} ({s.idKaryawan})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Streamer Pengganti (Target)</label>
                <select
                  value={tukarForm.targetId}
                  onChange={(e) => setTukarForm({ ...tukarForm, targetId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                  required
                >
                  <option value="">-- Pilih Streamer Pengganti --</option>
                  {streamers.filter((s) => s.id !== tukarForm.requesterId).map((s) => (
                    <option key={s.id} value={s.id}>{s.namaLengkap} ({s.idKaryawan})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tanggal Sesi Live</label>
                <input
                  type="date"
                  value={tukarForm.tanggal}
                  onChange={(e) => setTukarForm({ ...tukarForm, tanggal: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Alasan Penukaran</label>
                <textarea
                  rows={3}
                  value={tukarForm.alasan}
                  onChange={(e) => setTukarForm({ ...tukarForm, alasan: e.target.value })}
                  placeholder="Keterangan penukaran shift..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Mengajukan..." : "Ajukan Tukar Shift"}
              </button>
            </form>
          </div>

          {/* Right History Table (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Tukar Shift</h3>
              <span className="text-xs text-slate-500 font-medium">{tukarHistory.length} Record</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Pemohon ➔ Pengganti</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tukarHistory.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{t.requester?.namaLengkap ?? t.requesterId}</div>
                        <div className="text-[11px] text-blue-600 font-semibold">➔ {t.target?.namaLengkap ?? t.targetId}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateSafe(t.tanggal)}</td>
                      <td className="px-4 py-3">{renderStatusBadge(t.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {(session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN_OPERASIONAL") ? (
                          (t.status === "PENDING" || t.status === "TARGET_CONFIRMED") ? (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => handleTukarAction(t.id, true)} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-emerald-700">Setujui</button>
                              <button onClick={() => handleTukarAction(t.id, false)} className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-red-700">Tolak</button>
                            </div>
                          ) : <span className="text-[11px] text-slate-400 font-mono">Selesai</span>
                        ) : session?.user?.karyawanId === t.targetId && t.status === "PENDING" ? (
                          <button onClick={() => handleTukarConfirm(t.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-blue-700 flex items-center gap-1">
                            <i className="fa-solid fa-check" /> Konfirmasi
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {t.status === "PENDING" ? "Menunggu" : "Selesai"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tukarHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Belum ada riwayat tukar shift.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: SUARA KARYAWAN */}
      {/* ========================================================================= */}
      {activeTab === "suara" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-4 flex items-center gap-2">
              <i className="fa-regular fa-comment-dots text-emerald-600" />
              <span>Form Aspirasi / Suara Karyawan</span>
            </h2>

            <form onSubmit={submitSuara} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kategori Laporan</label>
                <select
                  value={suaraForm.kategori}
                  onChange={(e) => setSuaraForm({ ...suaraForm, kategori: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                  required
                >
                  <option value="KELUHAN">Keluhan Operasional / Kerja</option>
                  <option value="SARAN">Saran & Masukan Konstruktif</option>
                  <option value="PELANGGARAN">Laporan Pelanggaran SOP</option>
                  <option value="FASILITAS">Fasilitas & Perangkat Studio</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Deskripsi Detail</label>
                <textarea
                  rows={4}
                  value={suaraForm.deskripsi}
                  onChange={(e) => setSuaraForm({ ...suaraForm, deskripsi: e.target.value })}
                  placeholder="Ceritakan fakta atau masukan Anda..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Harapan / Solusi</label>
                <textarea
                  rows={2}
                  value={suaraForm.harapan}
                  onChange={(e) => setSuaraForm({ ...suaraForm, harapan: e.target.value })}
                  placeholder="Solusi atau tindak lanjut yang diharapkan..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkAnonimSafe"
                  checked={suaraForm.isAnonim}
                  onChange={(e) => setSuaraForm({ ...suaraForm, isAnonim: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chkAnonimSafe" className="text-xs text-slate-700 cursor-pointer select-none font-medium">
                  Kirim sebagai Anonim (Identitas disembunyikan)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Kirim Aspirasi"}
              </button>
            </form>
          </div>

          {/* Right Feed List (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Feed Aspirasi Suara Karyawan</h3>
              <span className="text-xs text-slate-500 font-medium">{suaraList.length} Feed</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Pesan / Laporan</th>
                    <th className="px-4 py-3 text-right">Identitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suaraList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDateSafe(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs max-w-xs whitespace-pre-line">
                        {item.pesan}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-medium whitespace-nowrap">
                        {item.karyawan?.namaLengkap ?? "Anonim"}
                      </td>
                    </tr>
                  ))}
                  {suaraList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Belum ada aspirasi tersimpan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PengajuanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat Pusat Pengajuan...</div>}>
      <PengajuanContent />
    </Suspense>
  );
}
