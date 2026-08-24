"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import CameraCapture from "@/components/camera-capture";

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

  // Riwayat
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadSession();
    loadSop();
    loadStats();
    loadHistory();
  }, []);

  async function loadStats() {
    try {
      const r = await fetch("/api/staff?view=stats");
      const d = await r.json();
      if (d.status === "success") setStats(d.data);
    } catch { /* ignore */ }
  }

  async function loadHistory() {
    try {
      const r = await fetch("/api/absensi?view=history&kategori=STAFF");
      const d = await r.json();
      if (d.status === "success") setHistory(d.data ?? []);
    } catch { /* ignore */ }
  }

  async function loadSop() {
    setSopLoading(true);
    try {
      const r = await fetch("/api/sop?view=checklist");
      const d = await r.json();
      if (d.status === "success") setSop(d.data ?? []);
    } catch { /* ignore */ }
    finally { setSopLoading(false); }
  }

  async function toggleSopTask(task: SopTask, checked: boolean) {
    setSopLoading(true);
    setError("");
    try {
      const photoUrl = task.requiresPhoto ? (photoInputs[task.id] ?? "") : undefined;
      const r = await fetch("/api/sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-task", taskId: task.id, completed: checked, photoUrl }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(checked ? "Tugas SOP ditandai selesai ✓" : "Tugas SOP dibatalkan.");
        loadSop();
      } else {
        setError(d.message ?? "Gagal menyimpan tugas SOP");
      }
    } catch { setError("Gagal menyimpan tugas SOP"); }
    finally { setSopLoading(false); }
  }

  async function loadSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff?view=sesi");
      const d = await res.json();
      if (d.status === "success") setSesi(d.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function doAbsen(tipe: "CHECK_IN" | "CHECK_OUT") {
    setError("");
    setSuccess("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipe, kategori: "STAFF", fotoBuktiUrl: fotoBuktiUrl || undefined }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(tipe === "CHECK_IN" ? "✅ Presensi Masuk (Check-In) berhasil dicatat!" : "✅ Presensi Pulang (Check-Out) berhasil dicatat!");
        loadSession();
        loadStats();
        loadHistory();
        setActiveTab(tipe === "CHECK_IN" ? "checkout" : "riwayat");
      } else {
        setError(d.message ?? "Gagal memproses absensi");
      }
    } catch { setError("Terjadi kesalahan koneksi"); }
    finally { setActionLoading(false); }
  }

  async function doAdminSearch() {
    if (!adminSearch.trim()) return;
    setAdminLoading(true);
    try {
      const r = await fetch(`/api/absensi?view=history&kategori=STAFF&search=${encodeURIComponent(adminSearch)}`);
      const d = await r.json();
      if (d.status === "success") setAdminResults(d.data ?? []);
    } catch { /* ignore */ }
    finally { setAdminLoading(false); }
  }

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
            </div>

            <div className="pt-2">
              <button
                onClick={() => doAbsen("CHECK_IN")}
                disabled={actionLoading || Boolean(sesi)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-door-open" />
                <span>Presensi Masuk (Check-In)</span>
              </button>
            </div>
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

      {/* ======== TAB: RIWAYAT ======== */}
      {activeTab === "riwayat" && (
        <div className="space-y-6">
          {/* Admin Panel: Search other staff attendance */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <i className="fa-solid fa-user-shield text-blue-500" />
                Panel Admin: Cari Absensi Staff Lain
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doAdminSearch()}
                  placeholder="Ketik nama atau email staff..."
                  className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={doAdminSearch}
                  disabled={adminLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {adminLoading ? "Mencari..." : "Cari"}
                </button>
              </div>
              {adminResults.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Staff</th>
                        <th className="px-4 py-2.5">Tipe</th>
                        <th className="px-4 py-2.5">Waktu Masuk</th>
                        <th className="px-4 py-2.5">Waktu Keluar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-800">{r.user?.name ?? r.userId}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.tipe === "CHECK_IN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {r.tipe === "CHECK_IN" ? "Check-In" : "Check-Out"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">{new Date(r.waktuMasuk).toLocaleString("id-ID")}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{r.waktuKeluar ? new Date(r.waktuKeluar).toLocaleString("id-ID") : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* My Attendance History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Presensi Saya</h3>
              <span className="text-xs text-slate-500">{history.length} Entri</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Waktu Masuk</th>
                    <th className="px-4 py-3">Waktu Keluar</th>
                    <th className="px-4 py-3">Durasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => {
                    const durMins = h.waktuKeluar
                      ? Math.round((new Date(h.waktuKeluar).getTime() - new Date(h.waktuMasuk).getTime()) / 60000)
                      : null;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.tipe === "CHECK_IN" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                            {h.tipe === "CHECK_IN" ? "Check-In" : "Check-Out"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {new Date(h.waktuMasuk).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {h.waktuKeluar ? new Date(h.waktuKeluar).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : <span className="text-slate-400 italic">Belum checkout</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {durMins !== null ? `${Math.floor(durMins / 60)}j ${durMins % 60}m` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {history.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Belum ada riwayat presensi tersimpan.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
