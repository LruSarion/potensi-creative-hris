"use client";

import { useEffect, useState } from "react";

export default function PenilaianSDMPage() {
  const [streamers, setStreamers] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [form, setForm] = useState({
    karyawanId: "",
    productKnowledge: 85,
    interaksiPenampilan: 85,
    metrikObjektif: 80,
    keterampilanImprovisasi: 80,
    kemampuanKomunikasi: 85,
    professionalism: 90,
    gmvGenerated: 0,
    periode: "Agustus 2026",
    komentar: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [empRes, boardRes] = await Promise.all([
        fetch("/api/employees?kategori=STREAMER").then((r) => r.json()),
        fetch("/api/penilaian-sdm?leaderboard=1").then((r) => r.json()),
      ]);

      if (empRes.status === "success") setStreamers(empRes.data);
      if (boardRes.status === "success") setLeaderboard(boardRes.data);
    } catch {
      // ignore
    }
  }

  // Ref-deploy weighted formula: 20%, 20%, 20%, 15%, 15%, 10%
  const compositeScore = Math.round(
    form.productKnowledge * 0.2 +
      form.interaksiPenampilan * 0.2 +
      form.metrikObjektif * 0.2 +
      form.keterampilanImprovisasi * 0.15 +
      form.kemampuanKomunikasi * 0.15 +
      form.professionalism * 0.1
  );

  function getTier(score: number) {
    if (score >= 90) return { name: "High Performer", color: "bg-purple-100 text-purple-700 border-purple-200" };
    if (score >= 80) return { name: "Advance", color: "bg-blue-100 text-blue-700 border-blue-200" };
    if (score >= 70) return { name: "Optimal", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    if (score >= 60) return { name: "Standard", color: "bg-amber-100 text-amber-700 border-amber-200" };
    return { name: "Basic", color: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.karyawanId) {
      setError("Silakan pilih streamer yang akan dinilai.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/penilaian-sdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karyawanId: form.karyawanId,
          productKnowledge: form.productKnowledge,
          interaksiPenampilan: form.interaksiPenampilan,
          metrikObjektif: form.metrikObjektif,
          keterampilanImprovisasi: form.keterampilanImprovisasi,
          kemampuanKomunikasi: form.kemampuanKomunikasi,
          professionalism: form.professionalism,
          gmvGenerated: Number(form.gmvGenerated),
          periode: form.periode,
          komentar: form.komentar,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Penilaian KPI Streamer berhasil disimpan!");
        setForm((f) => ({ ...f, komentar: "", gmvGenerated: 0 }));
        loadData();
      } else {
        setError(d.message ?? "Gagal menyimpan penilaian");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  const tier = getTier(compositeScore);

  const [activeTab, setActiveTab] = useState<"streamer" | "ots">("streamer");

  return (
    <div className="space-y-6">
      {/* Header persis ref-deploy/penilaian-sdm.html */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Penilaian SDM (KPI System)</h1>
        <p className="text-slate-500 text-sm mt-1">
          Evaluasi performa streamer berbasis 6 indikator pembobotan total skor.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 flex gap-6 mb-6">
        <button
          onClick={() => setActiveTab("streamer")}
          className={`pb-3 border-b-2 font-bold px-2 transition-all focus:outline-none flex items-center gap-2 ${
            activeTab === "streamer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
          }`}
        >
          <i className="fa-solid fa-video" />
          <span>KPI Streamer (6 Bobot Indikator)</span>
        </button>
        <button
          onClick={() => setActiveTab("ots")}
          className={`pb-3 border-b-2 font-bold px-2 transition-all focus:outline-none flex items-center gap-2 ${
            activeTab === "ots"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
          }`}
        >
          <i className="fa-solid fa-headset" />
          <span>KPI OTS</span>
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rating Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="font-bold text-slate-800 text-base">Formulir Penilaian Host Live (Ref-Deploy Standards)</h2>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Streamer / Host
                </label>
                <select
                  value={form.karyawanId}
                  onChange={(e) => setForm({ ...form, karyawanId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  required
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Periode Bulanan
                </label>
                <input
                  type="text"
                  value={form.periode}
                  onChange={(e) => setForm({ ...form, periode: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="mis. Agustus 2026"
                />
              </div>
            </div>

            {/* 6 Weighted Sliders (Ref-Deploy Model) */}
            <div className="space-y-4 pt-2">
              {/* Product Knowledge (20%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">1. Product Knowledge (Bobot 20%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.productKnowledge}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.productKnowledge}
                  onChange={(e) => setForm({ ...form, productKnowledge: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Penguasaan detail produk, demo USP, dan jawaban atas pertanyaan viewer.</p>
              </div>

              {/* Interaksi & Penampilan (20%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">2. Interaksi & Penampilan (Bobot 20%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.interaksiPenampilan}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.interaksiPenampilan}
                  onChange={(e) => setForm({ ...form, interaksiPenampilan: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Visual grooming, keaktifan menyapa penonton, dan kenyamanan layar studio.</p>
              </div>

              {/* Metrik Objektif (20%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">3. Metrik Objektif / Sales (Bobot 20%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.metrikObjektif}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.metrikObjektif}
                  onChange={(e) => setForm({ ...form, metrikObjektif: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Pencapaian target GMV, rasio konversi keranjang, dan order per jam.</p>
              </div>

              {/* Keterampilan Improvisasi (15%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">4. Keterampilan Improvisasi (Bobot 15%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.keterampilanImprovisasi}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.keterampilanImprovisasi}
                  onChange={(e) => setForm({ ...form, keterampilanImprovisasi: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Handling objection, kejenuhan viewer, improvisasi saat terjadi masalah teknis.</p>
              </div>

              {/* Kemampuan Komunikasi (15%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">5. Kemampuan Komunikasi (Bobot 15%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.kemampuanKomunikasi}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.kemampuanKomunikasi}
                  onChange={(e) => setForm({ ...form, kemampuanKomunikasi: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Intonasi, artikulasi suara, kejelasan pesan promo, dan diksi yang persuasif.</p>
              </div>

              {/* Professionalism (10%) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-800">6. Professionalism & Organization (Bobot 10%)</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">{form.professionalism}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.professionalism}
                  onChange={(e) => setForm({ ...form, professionalism: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ketepatan waktu kehadiran studio, kepatuhan SOP, dan sikap kerja.</p>
              </div>
            </div>

            {/* Total Skor Terhitung & Tiering Preview */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-900">Total Skor Pembobotan KPI</div>
                <div className="text-xs text-blue-600 mt-0.5">(20% + 20% + 20% + 15% + 15% + 10%)</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-black text-blue-700">{compositeScore}</div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tier.color}`}>
                  {tier.name}
                </span>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Evaluasi & Area Pengembangan
              </label>
              <textarea
                rows={3}
                value={form.komentar}
                onChange={(e) => setForm({ ...form, komentar: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="mis. Pertahankan energi di jam ke-2 live. Tingkatkan penekanan promo voucher diskon 50% di 15 menit awal."
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50 text-sm"
              >
                {loading ? "Menyimpan..." : "Simpan Penilaian KPI"}
              </button>
            </div>
          </form>
        </div>

        {/* Leaderboard / Ranking (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800 text-base">Peringkat & KPI Streamer</h2>
              <span className="text-xs text-slate-500">{leaderboard.length} Host</span>
            </div>

            <div className="space-y-3">
              {leaderboard.map((item, idx) => (
                <div
                  key={item.karyawanId}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800"
                          : idx === 1
                          ? "bg-slate-200 text-slate-800"
                          : idx === 2
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-xs">{item.namaLengkap}</div>
                      <div className="text-[11px] text-slate-400">{item.reviewCount} Evaluasi</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">{item.averageScore}</div>
                    <div className="text-[10px] text-purple-600 font-semibold">{item.tierRecommendation}</div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-8">
                  Belum ada data evaluasi tersimpan.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
