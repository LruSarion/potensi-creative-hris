"use client";

import { useEffect, useState } from "react";

type Jadwal = {
  id: string;
  idJadwal: string;
  tanggal: string;
  platform: string | null;
  judulLive: string | null;
  promoLive: string | null;
  status: string;
  liveState?: string;
  streamerKaryawan: { namaLengkap: string } | null;
};

type FeedbackItem = {
  id: string;
  createdAt: string;
  targetType: "STREAMER" | "SERVICE" | "OVERALL";
  targetName?: string;
  category?: string;
  rating: number;
  message: string;
  suggestions?: string;
};

export default function ClientPortalPage() {
  const [kpi, setKpi] = useState<any>(null);
  const [schedules, setSchedules] = useState<Jadwal[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [activeTab, setActiveTab] = useState<"schedules" | "feedback" | "propose" | "streamers" | "projects">("schedules");
  const [streamers, setStreamers] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [streamerFilter, setStreamerFilter] = useState<"all" | "certified" | "shortlist">("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({
    targetType: "STREAMER" as "STREAMER" | "SERVICE" | "OVERALL",
    targetName: "",
    category: "STREAMER_PERFORMANCE",
    rating: 5,
    message: "",
    suggestions: "",
  });

  // Propose Schedule Form
  const [proposeForm, setProposeForm] = useState({
    idJadwal: `PROP/${new Date().toISOString().slice(2, 10).replace(/-/g, "")}/${Math.floor(100 + Math.random() * 900)}`,
    tanggal: new Date().toISOString().slice(0, 10),
    jamMulai: "10:00",
    jamSelesai: "12:00",
    platform: "Shopee Live",
    judulLive: "",
    promoLive: "",
    catatan: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kpiRes, schRes, fbRes, strRes, listRes, shRes] = await Promise.all([
        fetch("/api/client-portal?view=kpi").then((r) => r.json()),
        fetch("/api/client-portal?view=schedules").then((r) => r.json()),
        fetch("/api/client-portal?view=feedback").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/streamer-directory").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/marketplace?view=listings").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/marketplace?view=shortlist").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
      ]);

      if (kpiRes.status === "success") setKpi(kpiRes.data);
      if (schRes.status === "success") setSchedules(schRes.data);
      if (fbRes.status === "success") setFeedbackList(fbRes.data);
      if (strRes.status === "success") setStreamers(strRes.data);
      if (listRes.status === "success") setListings(listRes.data);
      if (shRes.status === "success") {
        setShortlist(new Set((shRes.data ?? []).map((x: any) => x.streamerId)));
      }
      else if (kpiRes.status === "error") setError(kpiRes.message ?? "Akses ditolak");
    } catch {
      setError("Gagal memuat data portal brand partner");
    } finally {
      setLoading(false);
    }
  }

  async function toggleShortlist(streamerId: string) {
    try {
      const r = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-shortlist", streamerKaryawanId: streamerId }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setShortlist((prev) => {
          const next = new Set(prev);
          if (d.data.shortlisted) next.add(streamerId); else next.delete(streamerId);
          return next;
        });
        setSuccess(d.data.shortlisted ? "Streamer ditambahkan ke shortlist!" : "Streamer dihapus dari shortlist.");
      }
    } catch {
      setError("Gagal memperbarui shortlist");
    }
  }

  async function rateExperience(experienceId: string, rating: number) {
    try {
      const r = await fetch("/api/experience-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId, rating }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Penilaian berhasil disimpan!");
        loadData();
      } else {
        setError(d.message ?? "Gagal memberi penilaian");
      }
    } catch {
      setError("Gagal memberi penilaian");
    }
  }

  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackForm.message.trim()) {
      setError("Mohon tuliskan pesan feedback Anda");
      return;
    }
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/client-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          feedback: feedbackForm,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Terima kasih! Feedback & saran Anda berhasil disampaikan kepada tim manajemen agency.");
        setFeedbackForm({
          targetType: "STREAMER",
          targetName: "",
          category: "STREAMER_PERFORMANCE",
          rating: 5,
          message: "",
          suggestions: "",
        });
        loadData();
      } else {
        setError(d.message ?? "Gagal mengirim feedback");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  async function handleProposeSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/client-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          ...proposeForm,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Pengajuan jadwal live "${proposeForm.judulLive}" berhasil dikirim untuk approval Tim Operations.`);
        setProposeForm({
          idJadwal: `PROP/${new Date().toISOString().slice(2, 10).replace(/-/g, "")}/${Math.floor(100 + Math.random() * 900)}`,
          tanggal: new Date().toISOString().slice(0, 10),
          jamMulai: "10:00",
          jamSelesai: "12:00",
          platform: "Shopee Live",
          judulLive: "",
          promoLive: "",
          catatan: "",
        });
        setActiveTab("schedules");
        loadData();
      } else {
        setError(d.message ?? "Gagal mengajukan jadwal");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  async function decideApplication(applicationId: string, decision: "PICKED" | "DECLINED") {
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", applicationId, decision }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(decision === "PICKED" ? "Streamer diterima untuk proyek ini!" : "Lamaran streamer ditolak.");
        loadData();
      } else {
        setError(d.message ?? "Gagal memproses lamaran");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Klien Brand Partner</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitoring siaran live streaming brand Anda, pengajuan jadwal promo, dan saluran feedback evaluasi host & layanan.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("schedules")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "schedules" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-calendar-check" />
            <span>Jadwal & Sesi ({schedules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "feedback" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-star text-amber-400" />
            <span>Feedback & Saran ({feedbackList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("propose")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "propose" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-plus" />
            <span>Ajukan Jadwal Baru</span>
          </button>
          <button
            onClick={() => setActiveTab("streamers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "streamers" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-users" />
            <span>Certified Streamers</span>
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "projects" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-briefcase" />
            <span>Proyek Saya & Rekrutmen ({listings.length})</span>
          </button>
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

      {/* KPI Stats Cards */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
            <div className="text-xs font-semibold text-slate-500">Total Sesi Terjadwal</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{kpi.totalSessions}</div>
            <div className="text-[11px] text-slate-400">Siaran Brand Bulan Ini</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
            <div className="text-xs font-semibold text-slate-500">Sesi Selesai Tayang</div>
            <div className="text-2xl font-black text-emerald-600 font-mono">{kpi.completedSessions}</div>
            <div className="text-[11px] text-slate-400">Fulfillment: {kpi.completionRate}%</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
            <div className="text-xs font-semibold text-slate-500">Katalog Produk Live</div>
            <div className="text-2xl font-black text-blue-600 font-mono">{kpi.products}</div>
            <div className="text-[11px] text-slate-400">{kpi.onlineProducts} SKU Aktif Siaran</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
            <div className="text-xs font-semibold text-slate-500">Platform Siaran</div>
            <div className="text-base font-bold text-purple-700 truncate mt-1">
              {Object.keys(kpi.sessionsByPlatform || {}).join(", ") || "Shopee Live"}
            </div>
            <div className="text-[11px] text-slate-400">Multi-Channel Broadcast</div>
          </div>
        </div>
      )}

      {/* Tab 1: Schedules Table */}
      {activeTab === "schedules" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Daftar Jadwal Siaran Brand Anda ({schedules.length})</h3>
            <span className="text-xs text-slate-500 font-medium">Live Broadcast Tracker</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID Sesi & Tanggal</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Host Streamer</th>
                  <th className="px-4 py-3">Judul & Promo Campaign</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800 font-mono">{s.idJadwal}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(s.tanggal).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {s.platform ?? "Shopee"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {s.streamerKaryawan?.namaLengkap ?? "Host Standby Agency"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      <div className="font-medium text-slate-800">{s.judulLive || "Reguler Live Broadcast"}</div>
                      <div className="text-[11px] text-slate-400">{s.promoLive || "Voucher Toko / Flash Sale"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "APPROVED" || s.status === "SELESAI"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {schedules.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada jadwal sesi siaran live untuk brand ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Feedback & Suggestions Hub */}
      {activeTab === "feedback" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Feedback Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <i className="fa-solid fa-comment-dots text-blue-600" />
                <span>Kirim Feedback & Saran Evaluasi</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bantu kami meningkatkan performa siaran dengan memberikan masukan terkait host, kualitas studio, atau koordinasi promo.
              </p>
            </div>

            <form onSubmit={handleSendFeedback} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Objek Evaluasi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["STREAMER", "Host Streamer"],
                    ["SERVICE", "Layanan Studio"],
                    ["OVERALL", "Keseluruhan"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFeedbackForm({ ...feedbackForm, targetType: key as any })}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        feedbackForm.targetType === key
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {feedbackForm.targetType === "STREAMER" && (
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Host Streamer (Opsional)
                  </label>
                  <input
                    type="text"
                    value={feedbackForm.targetName}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, targetName: e.target.value })}
                    placeholder="mis. Host Jessica / Host Sesi Malam"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori Masukan
                </label>
                <select
                  value={feedbackForm.category}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="STREAMER_PERFORMANCE">Performa Host (Selling Skills / Energi / Punctuality)</option>
                  <option value="STUDIO_QUALITY">Kualitas Teknis Studio (Audio / Lighting / Kamera)</option>
                  <option value="PROMO_COORDINATION">Koordinasi Promo & Flash Sale Voucher</option>
                  <option value="GENERAL_SERVICE">Layanan & Komunikasi Tim Agency</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Rating Kepuasan (1–5 Bintang)
                </label>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                      className="text-lg transition transform hover:scale-125"
                    >
                      <i
                        className={`fa-star ${
                          star <= feedbackForm.rating
                            ? "fa-solid text-amber-400 drop-shadow-sm"
                            : "fa-regular text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">
                    {feedbackForm.rating} / 5 Bintang
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Ulasan & Catatan Detail
                </label>
                <textarea
                  rows={3}
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                  placeholder="Ceritakan pengalaman siaran hari ini, kelebihan host, atau hal yang perlu dipertahankan..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Saran / Harapan untuk Sesi Berikutnya
                </label>
                <textarea
                  rows={2}
                  value={feedbackForm.suggestions}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, suggestions: e.target.value })}
                  placeholder="mis. Mohon host lebih aktif mendemokan produk di etalase 2 pada menit ke-15..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-paper-plane text-xs" />
                  <span>Kirimkan Feedback ke Manajemen</span>
                </button>
              </div>
            </form>
          </div>

          {/* Feedback History List (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Feedback yang Dikirimkan ({feedbackList.length})</h3>
              <span className="text-xs text-slate-500">Evaluasi Brand</span>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {feedbackList.map((fb) => (
                <div
                  key={fb.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs hover:border-blue-200 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {fb.targetType === "STREAMER"
                            ? `Evaluasi Host: ${fb.targetName || "Streamer"}`
                            : fb.targetType === "SERVICE"
                            ? "Evaluasi Layanan Studio"
                            : "Evaluasi Keseluruhan"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {fb.category || "General"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(fb.createdAt).toLocaleString("id-ID")}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: fb.rating || 5 }).map((_, i) => (
                        <i key={i} className="fa-solid fa-star text-xs" />
                      ))}
                    </div>
                  </div>

                  <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                    "{fb.message}"
                  </p>

                  {fb.suggestions && (
                    <div className="text-[11px] text-blue-800 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                      <strong>Saran:</strong> {fb.suggestions}
                    </div>
                  )}
                </div>
              ))}

              {feedbackList.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                  <i className="fa-solid fa-star text-3xl text-slate-300 block" />
                  <p>Belum ada ulasan feedback yang dikirimkan.</p>
                  <p>Gunakan form di samping untuk memberikan evaluasi performa host.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Propose New Schedule Form */}
      {activeTab === "propose" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto space-y-5">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Ajukan Jadwal & Kampanye Promo Live Baru</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Tim Operations agency akan memverifikasi kesiapan studio, memplot host terbaik, dan menyetujui jadwal siaran Anda.
            </p>
          </div>

          <form onSubmit={handleProposeSchedule} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ID Pengajuan</label>
                <input
                  type="text"
                  value={proposeForm.idJadwal}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs bg-slate-50 text-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Siaran</label>
                <input
                  type="date"
                  value={proposeForm.tanggal}
                  onChange={(e) => setProposeForm({ ...proposeForm, tanggal: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Mulai</label>
                <input
                  type="time"
                  value={proposeForm.jamMulai}
                  onChange={(e) => setProposeForm({ ...proposeForm, jamMulai: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Selesai</label>
                <input
                  type="time"
                  value={proposeForm.jamSelesai}
                  onChange={(e) => setProposeForm({ ...proposeForm, jamSelesai: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Marketplace / Platform</label>
              <select
                value={proposeForm.platform}
                onChange={(e) => setProposeForm({ ...proposeForm, platform: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Shopee Live">Shopee Live</option>
                <option value="TikTok Shop">TikTok Shop</option>
                <option value="Tokopedia Live">Tokopedia Live</option>
                <option value="Lazada Live">Lazada Live</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Judul Sesi / Campaign Live</label>
              <input
                type="text"
                value={proposeForm.judulLive}
                onChange={(e) => setProposeForm({ ...proposeForm, judulLive: e.target.value })}
                placeholder="mis. Payday Sale Special Diskon 70%"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Promo & Voucher Live</label>
              <input
                type="text"
                value={proposeForm.promoLive}
                onChange={(e) => setProposeForm({ ...proposeForm, promoLive: e.target.value })}
                placeholder="mis. KODE VOUCHER: GAJIANSERU / FLASH SALE Rp 9.999"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan untuk Host & Studio</label>
              <textarea
                rows={3}
                value={proposeForm.catatan}
                onChange={(e) => setProposeForm({ ...proposeForm, catatan: e.target.value })}
                placeholder="mis. Fokus demo varian terbaru, pin voucher di menit awal live..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab("schedules")}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20"
              >
                Kirimkan Pengajuan Jadwal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Certified Streamers Hub */}
      {activeTab === "streamers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Hub Streamer</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih streamer bersertifikat untuk proyek Anda. Tandai favorit via shortlist.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {(["all", "certified", "shortlist"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStreamerFilter(f)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold capitalize transition ${
                      streamerFilter === f ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
                    }`}
                  >
                    {f === "all" ? "Semua" : f === "certified" ? "Bersertifikat" : "Shortlist"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">{streamers.length} streamer</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {streamers
              .filter((s) => {
                if (streamerFilter === "certified") return (s.certifiedFor?.length ?? 0) > 0;
                if (streamerFilter === "shortlist") return shortlist.has(s.id);
                return true;
              })
              .map((s) => {
              const certCount = s.certifiedFor?.length ?? 0;
              const isShortlisted = shortlist.has(s.id);
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-blue-600/10 border-2 border-blue-200 overflow-hidden flex items-center justify-center">
                        {s.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.photoUrl} alt={s.namaLengkap} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-black text-blue-600">{s.namaLengkap?.charAt(0) ?? "?"}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{s.namaLengkap}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.idKaryawan}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {s.totalSessions ?? 0} sesi • {s.availability ?? "FLEXIBLE"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-amber-500">★ {Number(s.rating).toFixed(1)}</span>
                      <button
                        onClick={() => toggleShortlist(s.id)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition ${
                          isShortlisted
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        {isShortlisted ? "★ Shortlisted" : "☆ Shortlist"}
                      </button>
                    </div>
                  </div>

                  {s.bio && <p className="text-xs text-slate-600 mt-3 leading-relaxed line-clamp-2">{s.bio}</p>}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {certCount > 0 ? (
                      s.certifiedFor.map((c: any, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          ✓ {c.clientName ?? "Brand"}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500">
                        Belum bersertifikasi
                      </span>
                    )}
                  </div>

                  {(s.experiences ?? []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Pengalaman ({s.experiences.length})
                      </div>
                      <div className="space-y-1.5">
                        {(s.experiences as any[]).slice(0, 3).map((x: any) => (
                          <div key={x.id} className="text-[11px] text-slate-600">
                            <div>• {x.title} <span className="text-slate-400">({x.platform ?? "-"})</span></div>
                            {x.clientRating ? (
                              <div className="pl-3 text-amber-500">★ {x.clientRating.toFixed(1)} {x.clientTestimonial ? `— "${x.clientTestimonial}"` : ""}</div>
                            ) : (
                              <div className="pl-3 flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => rateExperience(x.id, star)}
                                    className="text-amber-400 hover:scale-110 transition"
                                    title={`Nilai ${star} bintang`}
                                  >
                                    ★
                                  </button>
                                ))}
                                <span className="text-slate-400 ml-1">nilai proyek</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {(s.experiences as any[]).length > 3 && (
                          <div className="text-[10px] text-slate-400">
                            +{(s.experiences as any[]).length - 3} lainnya
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {streamers.length === 0 && (
              <div className="col-span-2 p-10 text-center text-slate-400 text-xs">
                Belum ada data streamer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: My Projects (Listings) */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Proyek Saya & Rekrutmen Streamer</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Listing proyek live, lamaran streamer bersertifikat, dan persetujuan rekrutmen.
            </p>
          </div>

          <div className="space-y-3">
            {listings.map((l) => {
              const picked = (l.applications ?? []).filter((a: any) => a.status === "PICKED").length;
              return (
                <div key={l.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900">{l.title}</div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        l.status === "OPEN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : l.status === "FILLED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{l.description}</div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100">{l.platform ?? "-"}</span>
                    <span className="font-mono">Rp {Number(l.ratePerSesi).toLocaleString("id-ID")}/sesi</span>
                    <span>Kuota: {picked}/{l.quota}</span>
                    {l.course && (
                      <span className="text-emerald-600 font-semibold">Sertifikasi: {l.course.title}</span>
                    )}
                  </div>

                  {/* Applications */}
                  {(l.applications ?? []).length > 0 && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Lamaran Streamer ({l.applications.length})
                      </div>
                      {(l.applications as any[]).map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div>
                            <div className="text-xs font-bold text-slate-800">
                              {a.streamer?.namaLengkap ?? "-"}
                              <span className="text-slate-400 font-mono ml-1">({a.streamer?.idKaryawan})</span>
                            </div>
                            {a.note && <div className="text-[11px] text-slate-500 mt-0.5">"{a.note}"</div>}
                          </div>
                          {a.status === "APPLIED" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => decideApplication(a.id, "PICKED")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                ✓ Terima (Pick)
                              </button>
                              <button
                                onClick={() => decideApplication(a.id, "DECLINED")}
                                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                a.status === "PICKED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {a.status === "PICKED" ? "DITERIMA" : "DITOLAK"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {listings.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-xs">
                Belum ada proyek. Ajukan jadwal atau hubungi admin untuk membuka listing.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
