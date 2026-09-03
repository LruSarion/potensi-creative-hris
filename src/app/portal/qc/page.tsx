"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import QcLiveMonitor from "@/components/qc-live-monitor";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";
import { toast } from "@/components/ui/toast";

type Review = {
  id: string;
  status: string;
  totalScore: number | null;
  remarks: string | null;
  recordingDriveId: string | null;
  jadwal: { idJadwal: string; platform: string | null; streamerKaryawan: { namaLengkap: string } | null; client: { namaClient: string } | null };
  rubric: { name: string; dimensions: { id: string; name: string; weight: number; scaleMax: number }[] };
  scores: { dimensionId: string; score: number }[];
};

export default function QcPortalPage() {
  const { data: session } = useSession();
  // Trend/report analytics is manager-only (qc:reports permission).
  const isManager = session?.user?.role === "QC_MANAGER" || session?.user?.role === "SUPER_ADMIN";
  const [reviews, setReviews] = useState<Review[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  // Scoring modal
  const [scoringReview, setScoringReview] = useState<Review | null>(null);
  const [dimScores, setDimScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [reviewData, trendData] = await Promise.all([
        fetchJson<Review[]>("/api/qc?view=reviews"),
        isManager ? fetchJson<any>("/api/qc?view=trends").catch((err) => {
          setError(err instanceof Error ? err.message : "Akses ditolak");
          return null;
        }) : Promise.resolve(null),
      ]);
      setReviews(reviewData);
      if (trendData) setTrends(trendData);
    } catch {
      setError("Gagal memuat data QC");
    } finally {
      setLoading(false);
    }
  }

  function openScoringModal(review: Review) {
    setScoringReview(review);
    const initialScores: Record<string, number> = {};
    review.rubric.dimensions.forEach((d) => {
      initialScores[d.id] = Math.round(d.scaleMax * 0.8);
    });
    setDimScores(initialScores);
    setRemarks(review.remarks ?? "");
  }

  async function submitScore() {
    if (!scoringReview) return;
    try {
      const scoresPayload = Object.entries(dimScores).map(([dimensionId, score]) => ({
        dimensionId,
        score: Number(score),
      }));

      await sendJson("/api/qc", "POST", {
        action: "score",
        reviewId: scoringReview.id,
        scores: scoresPayload,
        remarks,
      });
      const msg = "Penilaian QC live stream berhasil disimpan!";
      toast.success(msg);
      setSuccess(msg);
      setScoringReview(null);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Terjadi kesalahan koneksi");
      toast.error(msg);
      setError(msg);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quality Control & Live Audit Portal</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Audit kualitas rekaman siaran live, evaluasi standar host & studio, dan checklist kepatuhan SOP agency.
        </p>
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

      {/* Trends KPI Stats */}
      {trends && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Total Sesi Diaudit</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{trends.total}</div>
            <div className="text-[11px] text-slate-400 mt-1">Review Selesai & Pending</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Lolos Standar (Pass)</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{trends.passed}</div>
            <div className="text-[11px] text-slate-400 mt-1">Memenuhi Syarat SOP</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Perlu Perbaikan (Fail)</div>
            <div className="text-2xl font-black text-red-600 mt-1">{trends.failed}</div>
            <div className="text-[11px] text-slate-400 mt-1">Di Bawah Passing Grade</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Tingkat Kelulusan (Pass Rate)</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{trends.passRate}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Target Agency: ≥ 85%</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Catatan Action Items</div>
            <div className="text-2xl font-black text-purple-600 mt-1">{trends.withActionItems}</div>
            <div className="text-[11px] text-slate-400 mt-1">Perlu Coaching Trainer</div>
          </div>
        </div>
      )}

      {/* Live Monitoring & Violations */}
      <QcLiveMonitor />

      {/* Review Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Antrean Audit & Evaluasi Rekaman Sesi ({reviews.length})</h3>
          <span className="text-xs text-slate-500 font-medium">Rubrik Standar Agency</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID Jadwal & Brand</th>
                <th className="px-4 py-3">Host Streamer</th>
                <th className="px-4 py-3">Rubrik Evaluasi</th>
                <th className="px-4 py-3">Skor Audit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableLoadingState
                  colSpan={6}
                  text="Memuat daftar rekaman live untuk diaudit..."
                  subtext="Menyelaraskan sesi live, rubrik penilaian, dan skor audit..."
                />
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                    Belum ada antrean review rekaman sesi live.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800">{r.jadwal?.idJadwal ?? "Sesi"}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.jadwal?.client?.namaClient ?? "Brand Partner"} • {r.jadwal?.platform ?? "Shopee"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {r.jadwal?.streamerKaryawan?.namaLengkap ?? "Host Agency"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {r.rubric.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {r.totalScore != null ? `${r.totalScore} Poin` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.status === "PASS"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : r.status === "FAIL"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openScoringModal(r)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm"
                      >
                        {r.status === "PENDING" ? "Audit Sesi" : "Nilai Ulang"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multidimensional Scoring Modal */}
      {scoringReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Audit Sesi Live: {scoringReview.jadwal?.idJadwal}</h3>
                <p className="text-xs text-slate-400">
                  Host: {scoringReview.jadwal?.streamerKaryawan?.namaLengkap} • Rubrik: {scoringReview.rubric.name}
                </p>
              </div>
              <button onClick={() => setScoringReview(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              {scoringReview.rubric.dimensions.map((dim) => (
                <div key={dim.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{dim.name} (Bobot: {dim.weight}x)</span>
                    <span className="font-mono font-bold text-blue-600">
                      {dimScores[dim.id] ?? 0} / {dim.scaleMax}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={dim.scaleMax}
                    value={dimScores[dim.id] ?? 0}
                    onChange={(e) =>
                      setDimScores({ ...dimScores, [dim.id]: Number(e.target.value) })
                    }
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catatan Reviewer & Action Items Coaching
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="mis. Host perlu lebih sering menyebutkan kode voucher di 10 menit awal. Pencahayaan studio sudah sangat baik."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScoringReview(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitScore}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20"
              >
                Simpan Hasil Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
