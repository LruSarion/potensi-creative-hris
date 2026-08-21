"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CameraCapture from "@/components/camera-capture";

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
};

export default function StreamerDashboardPage() {
  const { data: session } = useSession();
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; waktu: string } | null>(null);
  const [tiering, setTiering] = useState<{ tier: string; jamMinimal: number; jamMaksimal: number; ratePerJam: number }[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [violationSummary, setViolationSummary] = useState<{ count: number; byCategory: Record<string, number>; critical: number } | null>(null);

  // Checkin modal/inputs
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [selectedJadwalId, setSelectedJadwalId] = useState("");
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState("");

  useEffect(() => {
    loadData();
    loadViolations();
  }, []);

  async function loadViolations() {
    try {
      const [listRes, sumRes] = await Promise.all([
        fetch("/api/qc-violation").then((r) => r.json()),
        fetch("/api/qc-violation?view=summary").then((r) => r.json()),
      ]);
      if (listRes.status === "success") setViolations(listRes.data ?? []);
      if (sumRes.status === "success") setViolationSummary(sumRes.data);
    } catch {
      // ignore
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [jRes, sRes, tRes] = await Promise.all([
        fetch("/api/streamer?view=jadwal").then((r) => r.json()),
        fetch("/api/streamer?view=sesi").then((r) => r.json()).catch(() => ({ status: "error" })),
        fetch("/api/payroll?tiering=1").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
      ]);

      if (jRes.status === "success") setJadwal(jRes.data);
      else setError(jRes.message ?? "Gagal memuat jadwal streamer");

      if (sRes.status === "success") setActiveSession(sRes.data);
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

  async function handleCheckIn() {
    if (!selectedJadwalId) {
      setError("Pilih jadwal live yang akan di-checkin");
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
          fotoBuktiUrl: fotoBuktiUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Presensi Check-In berhasil! Status sesi live sekarang ON-AIR.");
        setCheckinModalOpen(false);
        loadData();
      } else {
        setError(d.message ?? "Gagal melakukan check-in");
      }
    } catch {
      setError("Koneksi gagal saat presensi");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut(jadwalId?: string) {
    if (!confirm("Konfirmasi selesai sesi live streaming dan Check-Out?")) return;
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
          jadwalId,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Presensi Check-Out berhasil! Sesi streaming tersimpan ke rekap payroll.");
        loadData();
      } else {
        setError(d.message ?? "Gagal melakukan check-out");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setActionLoading(false);
    }
  }

  // Calculate live hours
  const totalLiveHours = jadwal
    .filter((j) => j.status === "SELESAI" || j.status === "HADIR")
    .reduce((acc, j) => {
      const diff = (new Date(j.jamSelesaiLive).getTime() - new Date(j.jamMulaiLive).getTime()) / (1000 * 60 * 60);
      return acc + (diff > 0 ? diff : 2);
    }, 0);

  const currentLiveJadwal = jadwal.find((j) => j.liveState === "LIVE" || j.status === "ON_GOING");

  // Resolve the current tier + rate from the REAL tiering config (DB), so the
  // displayed tier is always accurate and matches payroll.
  const matchedTier = tiering.find((b) => totalLiveHours >= b.jamMinimal && totalLiveHours <= b.jamMaksimal);
  const currentTier = matchedTier?.tier ?? (tiering.length ? "Tidak ada tier" : "Basic");
  const currentRate = matchedTier?.ratePerJam ?? 25000;

  return (
    <div className="space-y-6">
      {/* Header & Host Profile */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-2xl font-black text-white shadow-inner">
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
              <p className="text-xs text-slate-300 mt-1">
                {session?.user?.email} • ID: <span className="font-mono text-blue-300">{session?.user?.karyawanId ?? "PCS001"}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setCheckinModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              <i className="fa-solid fa-video" />
              <span>Check-In Live Stream</span>
            </button>
            {activeSession && (
              <button
                onClick={() => handleCheckOut()}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center gap-2"
              >
                <i className="fa-solid fa-stopwatch" />
                <span>Check-Out Live</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier & Hour Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Tier Pencapaian</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white">
                {currentTier}
              </span>
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
            <span className="text-slate-400 block mb-1">Total Sesi Terjadwal</span>
            <div className="text-base font-extrabold text-purple-300">
              {jadwal.length} <span className="text-xs text-slate-400 font-normal">Sesi Siaran</span>
            </div>
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

      {/* Active On-Air Stream Banner (if currently live) */}
      {currentLiveJadwal && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-3xl p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-ping"></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-700 uppercase tracking-wider">SEDANG ON AIR (LIVE STREAMING)</span>
                <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-md">{currentLiveJadwal.platform}</span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Brand: <strong>{currentLiveJadwal.client?.namaClient ?? "Klien"}</strong> • Studio: {currentLiveJadwal.studio ?? "Timoho Studio 1"}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleCheckOut(currentLiveJadwal.id)}
            disabled={actionLoading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md shadow-rose-600/20"
          >
            Selesaikan Sesi & Check-Out
          </button>
        </div>
      )}

      {/* Quick Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/tukar-shift"
          className="bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 transition shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
            <i className="fa-solid fa-arrows-rotate" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Tukar Shift</div>
            <div className="text-[10px] text-slate-400">Penggantian jadwal</div>
          </div>
        </Link>

        <Link
          href="/pengajuan-izin"
          className="bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 transition shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
            <i className="fa-solid fa-file-signature" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Pengajuan Izin</div>
            <div className="text-[10px] text-slate-400">Sakit / Cuti / Keperluan</div>
          </div>
        </Link>

        <Link
          href="/pengajuan-lembur"
          className="bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 transition shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
            <i className="fa-solid fa-clock" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Lembur Extra</div>
            <div className="text-[10px] text-slate-400">1.5x Hourly Rate</div>
          </div>
        </Link>

        <Link
          href="/portal/streamer/lms"
          className="bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 transition shadow-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">LMS Akademi</div>
            <div className="text-[10px] text-slate-400">Modul selling & SOP</div>
          </div>
        </Link>
      </div>

      {/* Main Schedule List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Jadwal Live Streaming Saya</h3>
            <p className="text-[11px] text-slate-400">Pastikan hadir 15 menit sebelum jam mulai untuk persiapan brief & sample produk.</p>
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
                      {new Date(j.tanggal).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-[11px] text-blue-600 font-mono">
                      {new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {new Date(j.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{j.client?.namaClient ?? "Brand Partner"}</div>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {j.platform ?? "Shopee Live"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium">
                    <i className="fa-solid fa-location-dot text-slate-400 mr-1.5" />
                    {j.studio ?? "Timoho Studio 1"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        j.liveState === "LIVE"
                          ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                          : j.status === "SELESAI"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {j.liveState === "LIVE" ? "🔴 ON AIR" : j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {j.liveState === "LIVE" ? (
                      <button
                        onClick={() => handleCheckOut(j.id)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Check-Out
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedJadwalId(j.id);
                          setCheckinModalOpen(true);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Check-In
                      </button>
                    )}
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

      {/* QC Violations */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-amber-500" />
            Catatan Pelanggaran QC
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            (violationSummary?.count ?? 0) > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {(violationSummary?.count ?? 0) > 0 ? `${violationSummary?.count} pelanggaran` : "Bersih ✓"}
          </span>
        </div>
        {violations.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {violations.map((v) => (
              <div key={v.id} className="p-4 flex items-start gap-3">
                {v.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.photoUrl} alt="Bukti" className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                )}
                {v.videoUrl && !v.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video src={v.videoUrl} controls className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      {v.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      v.severity === "CRITICAL" || v.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {v.severity}
                    </span>
                  </div>
                  {v.description && <div className="text-[11px] text-slate-600 mt-1">{v.description}</div>}
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(v.createdAt).toLocaleString("id-ID")}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs">
            <i className="fa-solid fa-circle-check text-2xl text-emerald-400 block mb-1" />
            Tidak ada catatan pelanggaran QC.
          </div>
        )}
      </div>

      {/* Check-In Modal */}
      {checkinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-video text-emerald-600" />
                <span>Presensi Check-In Live Stream</span>
              </h3>
              <button onClick={() => setCheckinModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Sesi Jadwal</label>
              <select
                value={selectedJadwalId}
                onChange={(e) => setSelectedJadwalId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Jadwal Siaran --</option>
                {jadwal.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.idJadwal} - {j.client?.namaClient ?? "Brand"} ({new Date(j.tanggal).toLocaleDateString("id-ID")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Foto Bukti / Studio Selfie</label>
              <CameraCapture
                value={fotoBuktiUrl}
                onChange={setFotoBuktiUrl}
                label="📷 Ambil Foto Check-In"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCheckinModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {actionLoading ? "Memproses..." : "Konfirmasi Check-In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
