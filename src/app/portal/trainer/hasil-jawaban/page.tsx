"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";

type Submission = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  studentId: string;
  studentName: string;
  submittedAt: string | null;
  watchPercentage: number;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  status: string;
};

type SubmissionDetail = Submission & {
  passingScore: number;
  detailedResults: {
    questionId: string;
    question: string;
    eventTime: number | null;
    options: string[] | null;
    correctAnswer: string | null;
    studentAnswer: string | null;
    score: number | null;
    isCorrect: boolean;
  }[];
};

export default function HasilJawabanPage() {
  const pathname = usePathname();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterLesson, setFilterLesson] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<Submission[]>("/api/lms?view=video-submissions", { cache: "no-store" });
      setSubmissions(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    setError("");
    try {
      const data = await fetchJson<SubmissionDetail>(`/api/lms?view=video-submission-detail&watchId=${id}`, { cache: "no-store" });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koneksi gagal");
    } finally {
      setLoadingDetail(false);
    }
  }

  const lessons = Array.from(new Map(submissions.map((s) => [s.lessonId, s.lessonTitle])).entries());

  const filtered = submissions.filter((s) => {
    if (filterLesson !== "ALL" && s.lessonId !== filterLesson) return false;
    if (filterStatus === "PASSED" && s.scorePercent < 70) return false;
    if (filterStatus === "FAILED" && s.scorePercent < 70) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.studentName.toLowerCase().includes(q) && !s.lessonTitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const passedCount = submissions.filter((s) => s.scorePercent >= 70).length;
  const avgScore = submissions.length > 0 ? Math.round(submissions.reduce((a, s) => a + s.scorePercent, 0) / submissions.length) : 0;
  const passRate = submissions.length > 0 ? Math.round((passedCount / submissions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Trainer Portal Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <Link
          href="/portal/trainer"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pathname === "/portal/trainer"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <i className="fa-solid fa-book-open" />
          <span>1. Kurikulum & Input Kelas</span>
        </Link>
        <Link
          href="/portal/trainer/learning-test"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pathname === "/portal/trainer/learning-test"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <i className="fa-solid fa-video" />
          <span>2. Studio Video Interaktif</span>
        </Link>
        <Link
          href="/portal/trainer/hasil-jawaban"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            pathname === "/portal/trainer/hasil-jawaban"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <i className="fa-solid fa-square-poll-vertical" />
          <span>3. Hasil Jawaban & Rekap Nilai</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-square-poll-vertical text-purple-600" />
          Hasil Jawaban & Rekap Nilai Streamer
        </h1>
        <p className="text-sm text-slate-600 mt-0.5 font-medium">
          Skor pengerjaan kuis video interaktif, modul akademi, persentase tontonan, dan rincian lembar jawaban streamer.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-300 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Pengerjaan</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{submissions.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-300 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lulus</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{passedCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-300 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rata-rata Nilai</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{avgScore}<span className="text-sm font-bold text-slate-600">/100</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-300 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tingkat Kelulusan</p>
          <p className="text-3xl font-black text-purple-600 mt-1">{passRate}%</p>
        </div>
      </div>

      {error && <div className="text-xs font-bold text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block font-bold text-slate-800 text-xs mb-1.5">Materi Video / Modul</label>
          <select
            value={filterLesson}
            onChange={(e) => setFilterLesson(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500 bg-white text-slate-800"
          >
            <option value="ALL">Semua Materi</option>
            {lessons.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-bold text-slate-800 text-xs mb-1.5">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500 bg-white text-slate-800"
          >
            <option value="ALL">Semua Status</option>
            <option value="PASSED">Lulus</option>
            <option value="FAILED">Belum Lulus</option>
          </select>
        </div>
        <div>
          <label className="block font-bold text-slate-800 text-xs mb-1.5">Cari Streamer</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama streamer..."
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500 bg-white text-slate-800"
          />
        </div>
      </div>

      {/* Submissions table */}
      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-300 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
            <tr>
              <th className="px-4 py-3.5">Streamer</th>
              <th className="px-4 py-3.5">Materi / Modul</th>
              <th className="px-4 py-3.5">Progress</th>
              <th className="px-4 py-3.5">Nilai</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Waktu Submit</th>
              <th className="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <TableLoadingState
                colSpan={7}
                text="Memuat lembar hasil jawaban streamer..."
                subtext="Menyelaraskan rekapan kuis dan persentase tontonan materi..."
              />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-600 text-xs font-semibold">
                  <i className="fa-solid fa-file-circle-check text-3xl text-slate-400 block mb-2" />
                  Belum ada data pengerjaan kuis atau modul.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{s.studentName}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-[200px] truncate">{s.lessonTitle}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-eye text-blue-600 text-[10px]" />
                      {s.watchPercentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-black text-slate-900 text-sm">{s.scorePercent}<span className="text-xs font-medium text-slate-600">/100</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      s.status === "PASSED" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"
                    }`}>
                      {s.status === "PASSED" ? "✓ LULUS" : "✗ BELUM LULUS"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 font-medium">
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => openDetail(s.id)}
                      className="text-[11px] font-bold text-purple-700 bg-purple-100 border border-purple-300 px-3 py-1 rounded-lg hover:bg-purple-200 shadow-sm transition"
                    >
                      Lihat Jawaban
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-300 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-100 border-b border-slate-300 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{detail.studentName}</h3>
                <p className="text-xs text-slate-700 font-semibold">{detail.lessonTitle} • Modul {detail.moduleTitle}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-slate-800 text-lg font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                detail.scorePercent >= (detail.passingScore || 70)
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-red-50 text-red-900 border-red-300"
              }`}>
                <span>Nilai: {detail.scorePercent}/100</span>
                <span>Progres: {detail.watchPercentage}%</span>
                <span>{detail.scorePercent >= (detail.passingScore || 70) ? "LULUS" : "BELUM LULUS"}</span>
              </div>
              {detail.detailedResults.map((r, idx) => (
                <div key={r.questionId} className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 text-sm">
                      {idx + 1}. {r.question}
                      {r.eventTime != null && (
                        <span className="ml-2 text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full">
                          @ {formatTime(r.eventTime)}
                        </span>
                      )}
                    </p>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                      r.isCorrect ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-red-100 text-red-800 border border-red-300"
                    }`}>
                      {r.isCorrect ? "BENAR" : "SALAH"}
                    </span>
                  </div>
                  <div className="text-slate-700 space-y-1 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
                    <p>Jawaban streamer: <strong className="text-slate-900 font-bold">{r.studentAnswer || "-"}</strong></p>
                    <p>Kunci jawaban: <strong className="text-emerald-800 font-bold">{r.correctAnswer || "-"}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
