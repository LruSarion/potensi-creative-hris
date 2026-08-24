"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import VideoLessonPlayer from "@/components/lms/video-lesson-player";

type Question = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  correctAnswer?: string | null;
  eventTime?: number | null;
  lessonId?: string | null;
  isNote?: boolean;
};
type Lesson = { id: string; title: string; order: number; content?: string | null; videoId?: string | null; videoDuration?: number | null };
type Module = { id: string; title: string; order: number; passingScore: number; lessons: Lesson[]; questions: Question[] };
type Certificate = { id: string; code: string; issuedAt: string };
type Enrollment = {
  id: string;
  status: string;
  progressPct: number;
  dueDate?: string | null;
  course: {
    id: string;
    title: string;
    description?: string | null;
    isCertification: boolean;
    modules: Module[];
  };
  certificates: Certificate[];
};

export default function LmsAkademiPage() {
  const { status } = useSession();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeEnrollId, setActiveEnrollId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number } | null>(null);

  useEffect(() => {
    if (status === "authenticated") load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/lms?view=enrollments");
      const d = await r.json();
      if (d.status === "success") setEnrollments(d.data);
      else setError(d.message ?? "Gagal memuat kursus");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  const activeEnroll = enrollments.find((e) => e.id === activeEnrollId) ?? null;
  const activeModule = activeEnroll?.course.modules.find((m) => m.id === activeModuleId) ?? null;

  async function submitQuiz() {
    if (!activeEnroll || !activeModule) return;
    setSubmitting(true);
    try {
      let correct = 0;
      const total = activeModule.questions.filter((q) => !q.isNote).length;
      for (const q of activeModule.questions) {
        if (q.isNote) continue;
        const ans = answers[q.id] ?? "";
        const res = await fetch("/api/lms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "answer", enrollmentId: activeEnroll.id, questionId: q.id, answerText: ans }),
        }).then((x) => x.json());
        if (res.data?.score === 100) correct++;
      }
      setQuizResult({ correct, total });
      await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "progress", enrollmentId: activeEnroll.id }),
      });
      load();
    } catch {
      setError("Gagal mengirim jawaban");
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    ASSIGNED: "bg-slate-100 text-slate-600",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-blue-500" />
          Memuat materi akademi...
        </div>
      </div>
    );
  }

  // Module/Quiz View
  if (activeEnroll && activeModule) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <button onClick={() => { setActiveModuleId(null); setAnswers({}); setQuizResult(null); }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
          <i className="fa-solid fa-arrow-left text-xs" /> Kembali ke kursus
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{activeModule.title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{activeEnroll.course.title}</p>
        </div>
        {activeModule.lessons.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="px-5 py-3 bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <i className="fa-solid fa-book-open mr-1.5 text-blue-500" /> Materi Modul
            </div>
            {activeModule.lessons.map((l) => {
              // Questions tied to this specific lesson (for video-timed questions)
              const lessonQuestions = activeModule.questions
                .filter((q) => q.lessonId === l.id || (!q.lessonId && activeModule.lessons.filter((x) => x.videoId).length === 1 && q.eventTime != null))
                .map((q) => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.correctAnswer ?? null,
                  eventTime: q.eventTime ?? null,
                  isNote: q.isNote ?? false,
                }));
              const hasTimedQuestions = lessonQuestions.some((q) => q.eventTime != null);
              return (
                <div key={l.id} className="p-5 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm">{l.title}</h4>
                  {l.videoId ? (
                    <VideoLessonPlayer
                      lesson={{
                        id: l.id,
                        title: l.title,
                        videoId: l.videoId,
                        videoDuration: l.videoDuration ?? null,
                        content: l.content ?? null,
                      }}
                      enrollmentId={activeEnroll.id}
                      questions={hasTimedQuestions ? lessonQuestions : []}
                      onSubmitted={load}
                    />
                  ) : null}
                  {l.content && (
                    <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">{l.content}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activeModule.questions.filter((q) => !q.isNote && q.eventTime == null).length > 0 && !quizResult && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <i className="fa-solid fa-circle-question mr-1.5 text-amber-500" />
              Kuis Modul ({activeModule.questions.filter((q) => !q.isNote && q.eventTime == null).length} Soal)
            </div>
            <div className="divide-y divide-slate-100">
              {activeModule.questions.filter((q) => !q.isNote && q.eventTime == null).map((q, idx) => (
                <div key={q.id} className="p-5 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">{idx + 1}. {q.question}</p>
                  {q.type === "MCQ" && q.options ? (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer text-xs font-medium transition ${answers[q.id] === String(oi) ? "border-blue-500 bg-blue-50 text-blue-800 font-semibold" : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"}`}>
                          <input type="radio" name={q.id} value={String(oi)} checked={answers[q.id] === String(oi)} onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(oi) }))} className="accent-blue-600" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea rows={3} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Tulis jawaban Anda..." className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
              <button onClick={submitQuiz} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-2">
                {submitting ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                {submitting ? "Mengirim..." : "Kirim Jawaban"}
              </button>
            </div>
          </div>
        )}
        {quizResult && (
          <div className={`rounded-2xl p-6 text-center space-y-2 ${quizResult.correct >= Math.ceil(quizResult.total * 0.7) ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <i className={`fa-solid fa-${quizResult.correct >= Math.ceil(quizResult.total * 0.7) ? "circle-check text-emerald-600" : "triangle-exclamation text-amber-600"} text-3xl`} />
            <h3 className="font-bold text-slate-900 text-base">{quizResult.correct >= Math.ceil(quizResult.total * 0.7) ? "Selamat! Kuis Selesai 🎉" : "Belum Lulus"}</h3>
            <p className="text-sm text-slate-600">Nilai: <strong>{quizResult.correct}/{quizResult.total}</strong> jawaban benar ({Math.round((quizResult.correct / (quizResult.total || 1)) * 100)}%)</p>
            <button onClick={() => { setActiveModuleId(null); setAnswers({}); setQuizResult(null); }} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">← Kembali ke kursus</button>
          </div>
        )}
      </div>
    );
  }

  // Course Detail View
  if (activeEnroll) {
    const course = activeEnroll.course;
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <button onClick={() => setActiveEnrollId(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
          <i className="fa-solid fa-arrow-left text-xs" /> Kembali
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
            {course.description && <p className="text-sm text-slate-500 mt-1">{course.description}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${STATUS_COLOR[activeEnroll.status] ?? "bg-slate-100 text-slate-600"}`}>{activeEnroll.status}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Progress Kursus</span>
            <span className="font-bold text-blue-600">{activeEnroll.progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${activeEnroll.progressPct}%` }} />
          </div>
          {activeEnroll.dueDate && (
            <p className="text-[10px] text-slate-400">Batas waktu: {new Date(activeEnroll.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          )}
        </div>
        {activeEnroll.certificates.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <i className="fa-solid fa-certificate text-emerald-600 text-2xl" />
            <div>
              <div className="text-sm font-bold text-emerald-800">Sertifikat Diterbitkan</div>
              <div className="text-xs text-emerald-600 font-mono">{activeEnroll.certificates[0].code}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">Dikeluarkan: {new Date(activeEnroll.certificates[0].issuedAt).toLocaleDateString("id-ID")}</div>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 text-sm">Daftar Modul ({course.modules.length})</h3>
          {course.modules.map((m, idx) => (
            <button key={m.id} onClick={() => { setActiveModuleId(m.id); setAnswers({}); setQuizResult(null); }} className="w-full bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md hover:border-blue-300 transition text-left flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm">{m.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{m.lessons.length} materi • {m.questions.filter((q) => !q.isNote).length} soal kuis{m.passingScore > 0 ? ` • Min. lulus: ${m.passingScore}%` : ""}</div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-300 text-xs shrink-0" />
            </button>
          ))}
          {course.modules.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-8 bg-white border border-slate-200 rounded-2xl">
              <i className="fa-solid fa-box-open text-2xl text-slate-300 block mb-2" />
              Belum ada modul. Materi sedang disiapkan oleh trainer.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Course Catalog
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LMS Akademi Streamer</h1>
        <p className="text-sm text-slate-500 mt-0.5">Modul pelatihan, SOP live streaming, dan sertifikasi brand yang wajib diselesaikan.</p>
      </div>
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {enrollments.length === 0 && !loading && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <i className="fa-solid fa-graduation-cap text-4xl text-slate-300 block" />
          <p className="text-sm text-slate-500 font-medium">Belum ada kursus yang aktif untukmu.</p>
          <p className="text-xs text-slate-400">Hubungi trainer atau supervisor untuk pendaftaran kelas.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {enrollments.map((enroll) => {
          const c = enroll.course;
          const hasCert = enroll.certificates.length > 0;
          return (
            <button key={enroll.id} onClick={() => setActiveEnrollId(enroll.id)} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:shadow-lg hover:border-blue-300 transition shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shrink-0">
                  <i className="fa-solid fa-graduation-cap" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[enroll.status] ?? "bg-slate-100 text-slate-600"}`}>{enroll.status}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{c.title}</h3>
                {c.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{c.modules.length} Modul</span>
                  <span className="font-semibold text-blue-600">{enroll.progressPct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${enroll.progressPct}%` }} />
                </div>
              </div>
              {c.isCertification && (
                <div className={`flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-1.5 ${hasCert ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  <i className={`fa-solid fa-${hasCert ? "certificate" : "shield-halved"}`} />
                  {hasCert ? "Bersertifikat ✓" : "Kursus Sertifikasi Brand"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}