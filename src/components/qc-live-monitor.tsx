"use client";

import { useEffect, useState } from "react";
import CameraCapture from "@/components/camera-capture";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

/**
 * QC Live Monitor — for QC reviewers to record live-streaming violations
 * (grooming, attitude, language, etc.) with photo evidence, in a simple
 * non-tech-friendly flow: pick streamer -> pick violation -> add photo -> submit.
 */

const VIOLATION_CATEGORIES = [
  { key: "GROOMING", label: "Grooming / Penampilan", icon: "fa-scissors" },
  { key: "ATTITUDE", label: "Attitude / Sikap", icon: "fa-face-frown" },
  { key: "LANGUAGE", label: "Language / Ucapan", icon: "fa-comment-slash" },
  { key: "DRESS_CODE", label: "Dress Code / Pakaian", icon: "fa-shirt" },
  { key: "PRODUCT_HANDLING", label: "Penanganan Produk", icon: "fa-box" },
  { key: "PLATFORM_RULE", label: "Aturan Platform", icon: "fa-list-check" },
  { key: "TECHNICAL", label: "Teknis", icon: "fa-gear" },
  { key: "OTHER", label: "Lainnya", icon: "fa-ellipsis" },
];

const SEVERITY = [
  { key: "LOW", label: "Ringan", color: "bg-slate-100 text-slate-600" },
  { key: "MEDIUM", label: "Sedang", color: "bg-amber-100 text-amber-700" },
  { key: "HIGH", label: "Berat", color: "bg-orange-100 text-orange-700" },
  { key: "CRITICAL", label: "Kritis", color: "bg-red-100 text-red-700" },
];

const VIOLATION_COLOR: Record<string, string> = {
  GROOMING: "bg-pink-100 text-pink-700",
  ATTITUDE: "bg-orange-100 text-orange-700",
  LANGUAGE: "bg-red-100 text-red-700",
  DRESS_CODE: "bg-purple-100 text-purple-700",
  PRODUCT_HANDLING: "bg-amber-100 text-amber-700",
  PLATFORM_RULE: "bg-blue-100 text-blue-700",
  TECHNICAL: "bg-slate-100 text-slate-600",
  OTHER: "bg-gray-100 text-gray-600",
};

type LiveStreamer = {
  id: string;
  idJadwal: string;
  streamerKaryawan: { id: string; namaLengkap: string } | null;
  client: { namaClient: string } | null;
};

type Violation = {
  id: string;
  category: string;
  severity: string;
  description: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  streamer: { namaLengkap: string } | null;
};

export default function QcLiveMonitor() {
  const [liveStreamers, setLiveStreamers] = useState<LiveStreamer[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedStreamer, setSelectedStreamer] = useState("");
  const [selectedJadwal, setSelectedJadwal] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [photoUrl, setPhotoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [liveData, listData] = await Promise.all([
        fetchJson<{ liveStreamers?: LiveStreamer[] }>("/api/qc-violation?view=live").catch(() => null),
        fetchJson<Violation[]>("/api/qc-violation").catch(() => null),
      ]);
      if (liveData) {
        const ls = liveData.liveStreamers ?? [];
        setLiveStreamers(ls);
        // Auto-select the first live streamer.
        if (ls.length && !selectedStreamer) {
          setSelectedStreamer(ls[0].streamerKaryawan?.id ?? "");
          setSelectedJadwal(ls[0].id);
        }
      }
      if (listData) setViolations(listData ?? []);
    } catch {
      setError("Gagal memuat data live monitoring");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickStreamer(id: string) {
    setSelectedStreamer(id);
    const j = liveStreamers.find((s) => s.streamerKaryawan?.id === id);
    setSelectedJadwal(j?.id ?? "");
  }

  async function submitViolation(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedStreamer) {
      toast.warning("Pilih streamer yang sedang live terlebih dahulu");
      setError("Pilih streamer yang sedang live terlebih dahulu");
      return;
    }
    if (!category) {
      toast.warning("Pilih jenis pelanggaran");
      setError("Pilih jenis pelanggaran");
      return;
    }
    setSubmitting(true);
    try {
      await sendJson("/api/qc-violation", "POST", {
        streamerKaryawanId: selectedStreamer,
        jadwalId: selectedJadwal || null,
        category,
        severity,
        description: description || null,
        photoUrl: photoUrl || null,
        videoUrl: videoUrl || null,
      });
      toast.success("Pelanggaran tercatat! Bukti (foto/video) terlampir.");
      setSuccess("Pelanggaran tercatat! Bukti (foto/video) terlampir.");
      setCategory("");
      setPhotoUrl("");
      setVideoUrl("");
      setDescription("");
      load();
    } catch (err) {
      const msg = errorMessage(err, "Gagal mencatat pelanggaran");
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Form (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <i className="fa-solid fa-tower-broadcast text-red-500" />
          <span>Catat Pelanggaran Live</span>
          {liveStreamers.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {liveStreamers.length} LIVE
            </span>
          )}
        </h3>

        {success && <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">✓ {success}</div>}
        {error && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">⚠ {error}</div>}

        <form onSubmit={submitViolation} className="space-y-4 text-xs">
          {/* Step 1: pick live streamer */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">1. Pilih Streamer yang Sedang LIVE</label>
            <select
              value={selectedStreamer}
              onChange={(e) => pickStreamer(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-red-400 bg-white"
            >
              <option value="">-- Pilih streamer --</option>
              {liveStreamers.map((s) => (
                <option key={s.id} value={s.streamerKaryawan?.id}>
                  {s.streamerKaryawan?.namaLengkap ?? "?"} {s.client?.namaClient ? `• ${s.client.namaClient}` : ""}
                </option>
              ))}
            </select>
            {liveStreamers.length === 0 && !loading && (
              <p className="text-[11px] text-slate-400 mt-1">Tidak ada sesi live saat ini.</p>
            )}
          </div>

          {/* Step 2: violation type */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">2. Jenis Pelanggaran</label>
            <div className="grid grid-cols-2 gap-1.5">
              {VIOLATION_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition ${
                    category === c.key
                      ? "border-red-400 bg-red-50 text-red-700 font-semibold"
                      : "border-slate-200 hover:border-red-300"
                  }`}
                >
                  <i className={`fa-solid ${c.icon} text-[11px]`} />
                  <span className="text-[11px]">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: severity */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">3. Tingkat Keparahan</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SEVERITY.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSeverity(s.key)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold text-center border transition ${
                    severity === s.key ? "border-red-400 ring-1 ring-red-300 " + s.color : "border-slate-200 " + s.color
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: photo/video evidence */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">4. Bukti Foto / Video (Capture)</label>
            <div className="space-y-2">
              <CameraCapture value={photoUrl} onChange={setPhotoUrl} label="📷 Ambil Foto Bukti" />
              <CameraCapture value={videoUrl} onChange={setVideoUrl} label="🎥 Rekam Video Bukti" mode="video" />
            </div>
          </div>

          {/* Step 5: note */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Catatan (opsional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: host mengucapkan kata kasar saat sesi 10:30"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs transition disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Catat Pelanggaran"}
          </button>
        </form>
      </div>

      {/* Violations list (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Daftar Pelanggaran Terkini ({violations.length})</h3>
          <button onClick={load} className="text-xs text-blue-600 hover:underline font-semibold">
            <i className="fa-solid fa-arrows-rotate mr-1" />
            Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {violations.map((v) => (
            <div key={v.id} className="p-4 flex items-start gap-3">
              {v.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.photoUrl} alt="Bukti foto" className="w-16 h-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
              ) : v.videoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <video src={v.videoUrl} controls className="w-16 h-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <i className="fa-solid fa-image" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${VIOLATION_COLOR[v.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {VIOLATION_CATEGORIES.find((c) => c.key === v.category)?.label ?? v.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SEVERITY.find((s) => s.key === v.severity)?.color}`}>
                    {v.severity}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1">{v.streamer?.namaLengkap ?? "-"}</div>
                {v.description && <div className="text-[11px] text-slate-600 mt-0.5">{v.description}</div>}
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(v.createdAt).toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          ))}
          {violations.length === 0 && !loading && (
            <div className="p-10 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-shield-halved text-3xl text-slate-300 block mb-2" />
              Belum ada pelanggaran tercatat. Monitor sesi live dan catat bila ada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
