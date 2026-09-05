"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import VideoLessonPlayer from "@/components/lms/video-lesson-player";
import AudioCapture from "@/components/audio-capture";
import { fetchJson } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

type Question = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  correctAnswer?: string | null;
  eventTime?: number | null;
  lessonId?: string | null;
  isNote?: boolean;
  pauseVideo?: boolean | null;
};

type Lesson = {
  id: string;
  title: string;
  order: number;
  content?: string | null;
  videoId?: string | null;
  videoDuration?: number | null;
};

type Module = {
  id: string;
  title: string;
  order: number;
  passingScore: number;
  lessons: Lesson[];
  questions: Question[];
};

type Certificate = {
  id: string;
  code: string;
  issuedAt: string;
};

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

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  ASSIGNED: { label: "Ditugaskan", badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "fa-regular fa-clock" },
  IN_PROGRESS: { label: "Sedang Berjalan", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: "fa-solid fa-play" },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-solid fa-circle-check" },
};

export default function TabLms() {
  const { status } = useSession();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeEnrollId, setActiveEnrollId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number; scorePct: number; passed: boolean; pendingManual?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "IN_PROGRESS" | "COMPLETED" | "CERTIFIED">("ALL");

  useEffect(() => {
    loadCourses();
  }, [status]);

  async function loadCourses() {
    setLoading(true);
    setError("");
    try {
      let list: Enrollment[] = [];
      try {
        const enrollments = await fetchJson<Enrollment[]>("/api/lms?view=enrollments");
        if (Array.isArray(enrollments) && enrollments.length > 0) {
          list = enrollments;
        } else {
          throw new Error("empty");
        }
      } catch {
        // Fallback to fetch all active courses if enrollments are empty
        try {
          const courses = await fetchJson<Array<{ id: string; title: string; description?: string | null; isCertification?: boolean | null; modules?: Module[] }>>("/api/lms?view=courses");
          if (Array.isArray(courses)) {
            list = courses.map((c) => ({
              id: c.id,
              status: "ASSIGNED",
              progressPct: 0,
              dueDate: null,
              course: {
                id: c.id,
                title: c.title,
                description: c.description,
                isCertification: Boolean(c.isCertification),
                modules: c.modules || [],
              },
              certificates: [],
            }));
          }
        } catch {
          // keep empty list
        }
      }
      setEnrollments(list);
    } catch {
      setError("Koneksi gagal saat memuat materi akademi.");
    } finally {
      setLoading(false);
    }
  }

  const activeEnroll = enrollments.find((e) => e.id === activeEnrollId) ?? null;
  const activeModule = activeEnroll?.course.modules.find((m) => m.id === activeModuleId) ?? null;

  function evaluateAnswer(userAns: string, correctAns?: string | null, options?: string[] | null): boolean {
    if (!userAns || !correctAns) return false;
    const cleanUser = userAns.trim().toLowerCase();
    const cleanCorrect = correctAns.trim().toLowerCase();
    if (cleanUser === cleanCorrect) return true;

    // Check letter vs index (A=0, B=1, etc.)
    const toIdx = (val: string): number | null => {
      const v = val.trim().toUpperCase();
      if (/^[0-9]+$/.test(v)) return parseInt(v, 10);
      if (/^[A-Z]$/.test(v)) return v.charCodeAt(0) - 65;
      const m = v.match(/^([A-Z])[\.\)\-\:\s]/);
      if (m) return m[1].charCodeAt(0) - 65;
      return null;
    };

    const uIdx = toIdx(cleanUser);
    const cIdx = toIdx(cleanCorrect);
    if (uIdx !== null && cIdx !== null && uIdx === cIdx) return true;

    if (options && options.length > 0) {
      let resolvedU = uIdx;
      if (resolvedU === null) {
        const found = options.findIndex(
          (o) => o.trim().toLowerCase() === cleanUser || o.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "").trim().toLowerCase() === cleanUser
        );
        if (found !== -1) resolvedU = found;
      }
      let resolvedC = cIdx;
      if (resolvedC === null) {
        const found = options.findIndex(
          (o) => o.trim().toLowerCase() === cleanCorrect || o.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "").trim().toLowerCase() === cleanCorrect
        );
        if (found !== -1) resolvedC = found;
      }
      if (resolvedU !== null && resolvedC !== null && resolvedU === resolvedC) return true;
    }

    const strip = (s: string) => s.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "").trim().toLowerCase();
    return strip(userAns) === strip(correctAns);
  }

  async function submitQuiz() {
    if (!activeEnroll || !activeModule) return;
    setSubmitting(true);
    setError("");
    try {
      const quizQuestions = activeModule.questions.filter((q) => !q.isNote);
      // Only auto-gradable MCQs count toward the score; ESSAY/AUDIO wait for trainer grading.
      const gradableQuestions = quizQuestions.filter((q) => q.type === "MCQ" && q.correctAnswer);
      const manualQuestions = quizQuestions.filter((q) => q.type === "ESSAY" || q.type === "AUDIO");

      let correct = 0;
      const total = gradableQuestions.length;

      for (const q of quizQuestions) {
        const ans = answers[q.id] ?? "";
        const isGradable = q.type === "MCQ" && q.correctAnswer;
        let isRight = isGradable ? evaluateAnswer(ans, q.correctAnswer, q.options) : false;

        // Sync attempt with backend (records ESSAY/AUDIO answers for trainer grading too)
        try {
          const res = await fetch("/api/lms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "answer",
              enrollmentId: activeEnroll.id,
              questionId: q.id,
              answerText: ans,
            }),
          }).then((x) => x.json());

          if (res?.status === "error") {
            toast.error(res.message || "Gagal menyimpan jawaban kuis ke server.");
          } else if (isGradable && res.data?.score === 100) {
            isRight = true;
          }
        } catch {
          // Keep evaluateAnswer result
        }

        if (isRight) correct++;
      }

      const scorePct = total > 0 ? Math.round((correct / total) * 100) : manualQuestions.length > 0 ? 100 : 0;
      const passingScore = activeModule.passingScore || 70;
      const passed = scorePct >= passingScore;

      setQuizResult({ correct, total, scorePct, passed, pendingManual: manualQuestions.filter((q) => answers[q.id]).length });

      // Hitung ulang progress kursus secara otomatis
      fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "progress", enrollmentId: activeEnroll.id }),
      }).catch(() => undefined);

      loadCourses();
    } catch {
      setError("Gagal mengirim jawaban kuis.");
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered enrollments for the catalog
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (filterStatus === "IN_PROGRESS" && e.status === "COMPLETED") return false;
      if (filterStatus === "COMPLETED" && e.status !== "COMPLETED") return false;
      if (filterStatus === "CERTIFIED" && (!e.course.isCertification || e.certificates?.length === 0)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = e.course.title.toLowerCase().includes(q);
        const matchDesc = (e.course.description || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [enrollments, filterStatus, searchQuery]);

  // Statistics
  const totalCourses = enrollments.length;
  const inProgressCourses = enrollments.filter((e) => e.status !== "COMPLETED").length;
  const completedCourses = enrollments.filter((e) => e.status === "COMPLETED").length;
  const totalCertificates = enrollments.reduce((acc, curr) => acc + (curr.certificates?.length || 0), 0);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#941A0B] flex items-center justify-center text-2xl mx-auto animate-pulse">
          <i className="fa-solid fa-graduation-cap" />
        </div>
        <h3 className="font-bold text-slate-800 text-base">Memuat Materi Akademi LMS...</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Menyiapkan modul pembelajaran, video interaktif, dan kuis uji pemahaman.
        </p>
      </div>
    );
  }

  // 1. Module / Quiz & Video Lesson View
  if (activeEnroll && activeModule) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActiveModuleId(null);
              setAnswers({});
              setQuizResult(null);
              setError("");
            }}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-2xs hover:bg-slate-50 transition"
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Kembali ke Detail Kursus</span>
          </button>
          <span className="text-xs font-semibold text-slate-400">
            {activeEnroll.course.title}
          </span>
        </div>

        {/* Module Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-[#941A0B] border border-red-200 mb-2">
                <i className="fa-solid fa-book-open" />
                <span>Modul Pembelajaran</span>
              </div>
              <h1 className="text-xl font-black text-slate-900">{activeModule.title}</h1>
              <p className="text-xs text-slate-500 mt-1">
                {activeModule.lessons.length} Materi Pembelajaran • {activeModule.questions.filter((q) => !q.isNote).length} Soal Ujian
                {activeModule.passingScore > 0 && ` • Nilai Kelulusan: ${activeModule.passingScore}%`}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Lessons Section (Video & Reading) */}
        {activeModule.lessons.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="px-6 py-3.5 bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100">
              <i className="fa-solid fa-play text-red-600" />
              <span>Materi & Video Interaktif</span>
            </div>
            {activeModule.lessons.map((lesson, lIdx) => {
              const lessonQuestions = activeModule.questions
                .filter((q) => q.lessonId === lesson.id || (!q.lessonId && activeModule.lessons.filter((x) => x.videoId).length === 1 && q.eventTime != null))
                .map((q) => ({
                  id: q.id,
                  type: q.type,
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.correctAnswer ?? null,
                  eventTime: q.eventTime ?? null,
                  isNote: q.isNote ?? false,
                  pauseVideo: q.pauseVideo ?? true,
                }));
              const hasTimedQuestions = lessonQuestions.some((q) => q.eventTime != null);

              return (
                <div key={lesson.id} className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-red-50 text-[#941A0B] border border-red-100 flex items-center justify-center font-bold text-xs">
                        {lIdx + 1}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{lesson.title}</h3>
                    </div>
                    {lesson.videoDuration ? (
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 border border-slate-200">
                        <i className="fa-solid fa-circle-play text-red-600 text-[11px]" />
                        <span>Video • {Math.round(lesson.videoDuration / 60)} mnt</span>
                      </span>
                    ) : null}
                  </div>

                  {lesson.videoId ? (
                    <VideoLessonPlayer
                      lesson={{
                        id: lesson.id,
                        title: lesson.title,
                        videoId: lesson.videoId,
                        videoDuration: lesson.videoDuration ?? null,
                        content: lesson.content ?? null,
                      }}
                      enrollmentId={activeEnroll.id}
                      questions={hasTimedQuestions ? lessonQuestions : []}
                      onSubmitted={loadCourses}
                      onAnswerRecorded={(qId, ans) => {
                        setAnswers((prev) => ({ ...prev, [qId]: ans }));
                      }}
                    />
                  ) : null}

                  {lesson.content && (
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-2xl p-5 border border-slate-200 font-sans">
                      {lesson.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Post-Lesson Quiz */}
        {activeModule.questions.filter((q) => !q.isNote).length > 0 && !quizResult && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-question text-amber-500 text-sm" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Kuis Uji Pemahaman ({activeModule.questions.filter((q) => !q.isNote).length} Soal)
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Passing Grade: {activeModule.passingScore || 70}%
              </span>
            </div>

            <div className="divide-y divide-slate-100 p-6 space-y-6">
              {activeModule.questions
                .filter((q) => !q.isNote)
                .map((q, idx) => {
                  const isAnsweredInVideo = Boolean(answers[q.id]);

                  return (
                    <div key={q.id} className="space-y-3 pt-4 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-slate-900 leading-snug">
                          {idx + 1}. {q.question}
                        </p>
                        {isAnsweredInVideo && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <i className="fa-solid fa-circle-check text-purple-600" /> Terjawab di Video
                          </span>
                        )}
                      </div>

                      {q.type === "MCQ" && q.options ? (
                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, oi) => {
                            const letter = String.fromCharCode(65 + oi);
                            const isSelected =
                              answers[q.id] === letter ||
                              answers[q.id] === String(oi) ||
                              answers[q.id] === opt ||
                              answers[q.id]?.trim().toLowerCase() === opt.trim().toLowerCase();

                            return (
                              <label
                                key={oi}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer text-xs font-medium transition ${
                                  isSelected
                                    ? "border-[#941A0B] bg-red-50/60 text-[#941A0B] font-bold shadow-2xs"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={letter}
                                  checked={isSelected}
                                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: letter }))}
                                  className="accent-[#941A0B] w-4 h-4"
                                />
                                <span className="font-bold text-slate-400 w-4">{letter}.</span>
                                <span className="flex-1">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : q.type === "AUDIO" ? (
                        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                          <p className="text-[10px] font-bold text-sky-700 mb-1.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-microphone" />
                            Jawab dengan rekaman suara Anda — dinilai manual oleh trainer.
                          </p>
                          <AudioCapture
                            value={answers[q.id] ?? ""}
                            onChange={(dataUrl) => setAnswers((a) => ({ ...a, [q.id]: dataUrl }))}
                          />
                        </div>
                      ) : (
                        <textarea
                          rows={3}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                          placeholder="Tulis uraian jawaban Anda..."
                          className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-red-500 font-medium"
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={submitQuiz}
                disabled={submitting}
                className="bg-[#941A0B] hover:bg-[#6D1207] disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-red-900/20 flex items-center gap-2 active:scale-95"
              >
                {submitting ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                <span>{submitting ? "Memeriksa Jawaban..." : "Kirim & Selesaikan Kuis"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quiz Result Banner */}
        {quizResult && (
          <div
            className={`rounded-3xl p-8 text-center space-y-4 border shadow-md ${
              quizResult.passed
                ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                : "bg-amber-50/80 border-amber-300 text-amber-900"
            }`}
          >
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-sm ${
                quizResult.passed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
              }`}
            >
              <i className={`fa-solid ${quizResult.passed ? "fa-circle-check" : "fa-triangle-exclamation"}`} />
            </div>

            <div>
              <h2 className="font-black text-xl">
                {quizResult.passed ? "Selamat! Anda Dinyatakan Lulus 🎉" : "Kuis Belum Mencapai Nilai Kelulusan"}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Skor Anda: <strong>{quizResult.scorePct}%</strong> ({quizResult.correct} dari {quizResult.total} soal benar).
                {quizResult.passed ? " Progress materi Anda telah diperbarui." : ` Nilai minimum kelulusan modul ini adalah ${activeModule.passingScore || 70}%.`}
              </p>
              {quizResult.pendingManual ? (
                <p className="text-[11px] text-amber-700 mt-1.5 font-semibold">
                  <i className="fa-regular fa-hourglass-half mr-1" />
                  {quizResult.pendingManual} soal esai/audio Anda menunggu penilaian trainer.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {!quizResult.passed && (
                <button
                  type="button"
                  onClick={() => {
                    setQuizResult(null);
                    setAnswers({});
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <i className="fa-solid fa-rotate-right mr-1.5" />
                  Coba Ulang Kuis
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveModuleId(null);
                  setAnswers({});
                  setQuizResult(null);
                }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs"
              >
                ← Kembali ke Daftar Modul
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Course Detail View (List of Modules)
  if (activeEnroll) {
    const course = activeEnroll.course;
    const cert = activeEnroll.certificates?.[0];
    const statusCfg = STATUS_CONFIG[activeEnroll.status] || STATUS_CONFIG.ASSIGNED;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => setActiveEnrollId(null)}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-2xs hover:bg-slate-50 transition"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>Kembali ke Katalog Kursus</span>
        </button>

        {/* Course Header Banner */}
        <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-white/10 border border-white/20 text-white">
                <i className="fa-solid fa-graduation-cap" />
                <span>Akademi Streamer</span>
                {course.isCertification && <span className="text-amber-300">• Sertifikasi Brand</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{course.title}</h1>
              {course.description && (
                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
                  {course.description}
                </p>
              )}
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 border ${statusCfg.badge}`}>
              <i className={`${statusCfg.icon} mr-1.5`} />
              {statusCfg.label}
            </span>
          </div>

          {/* Progress bar inside banner */}
          <div className="bg-black/30 backdrop-blur-xs rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">Progress Pembelajaran</span>
              <span className="text-amber-300 font-mono text-sm">{activeEnroll.progressPct}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${activeEnroll.progressPct}%` }}
              />
            </div>
            {activeEnroll.dueDate && (
              <p className="text-[10px] text-slate-300">
                <i className="fa-regular fa-calendar-clock mr-1" />
                Batas Waktu: {new Date(activeEnroll.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        {/* Certificate Card if Issued */}
        {cert && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-certificate" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                Sertifikat Kompetensi Diterbitkan
              </div>
              <div className="text-sm font-black text-slate-900 font-mono mt-0.5">{cert.code}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Diterbitkan pada: {new Date(cert.issuedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              <a
                href={`/portal/streamer/sertifikat/${cert.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-sm"
              >
                <i className="fa-solid fa-file-arrow-down" />
                Lihat & Unduh Sertifikat
              </a>
            </div>
          </div>
        )}

        {/* Modules List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <i className="fa-solid fa-layer-group text-red-600" />
              <span>Daftar Modul ({course.modules.length})</span>
            </h3>
            <span className="text-xs text-slate-400">Pilih modul untuk mulai belajar</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {course.modules.map((module, idx) => (
              <button
                key={module.id}
                type="button"
                onClick={() => {
                  setActiveModuleId(module.id);
                  setAnswers({});
                  setQuizResult(null);
                  setError("");
                }}
                className="w-full bg-white border border-slate-200 rounded-2xl p-5 hover:border-red-400 hover:shadow-md transition text-left flex items-center gap-4 shadow-2xs group"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-[#941A0B] flex items-center justify-center font-black text-base shrink-0 group-hover:scale-105 transition">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#941A0B] transition">
                    {module.title}
                  </h4>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      <i className="fa-solid fa-play text-red-500 mr-1" />
                      {module.lessons.length} Materi
                    </span>
                    <span>•</span>
                    <span>
                      <i className="fa-solid fa-circle-question text-amber-500 mr-1" />
                      {module.questions.filter((q) => !q.isNote).length} Soal Ujian
                    </span>
                    {module.passingScore > 0 && (
                      <>
                        <span>•</span>
                        <span>Min. Lulus: {module.passingScore}%</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#941A0B] bg-red-50 px-3 py-1.5 rounded-xl opacity-80 group-hover:opacity-100 shrink-0">
                  <span>Buka Modul</span>
                  <i className="fa-solid fa-chevron-right text-[10px]" />
                </div>
              </button>
            ))}

            {course.modules.length === 0 && (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                <i className="fa-solid fa-box-open text-2xl text-slate-300 block mb-2" />
                Belum ada modul yang terdaftar pada kursus ini.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Course Catalog View (Main Grid)
  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#941A0B] border border-red-100 flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-graduation-cap" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">LMS Akademi Streamer</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Pusat pelatihan interaktif, SOP siaran live streaming, teknik selling, dan sertifikasi brand.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadCourses}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs self-start sm:self-auto"
          >
            <i className="fa-solid fa-rotate-right text-slate-500" />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-slate-400 block mb-0.5 text-[11px] font-bold">Total Kursus</span>
            <div className="text-lg font-black text-slate-900">{totalCourses} Kursus</div>
          </div>
          <div className="bg-blue-50/60 rounded-2xl p-3.5 border border-blue-100">
            <span className="text-blue-600 block mb-0.5 text-[11px] font-bold">Sedang Berjalan</span>
            <div className="text-lg font-black text-blue-800">{inProgressCourses} Kursus</div>
          </div>
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100">
            <span className="text-emerald-600 block mb-0.5 text-[11px] font-bold">Selesai</span>
            <div className="text-lg font-black text-emerald-800">{completedCourses} Kursus</div>
          </div>
          <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-100">
            <span className="text-amber-600 block mb-0.5 text-[11px] font-bold">Sertifikat Diperoleh</span>
            <div className="text-lg font-black text-amber-800">{totalCertificates} Sertifikat</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterStatus("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterStatus === "ALL"
                ? "bg-[#941A0B] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({enrollments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("IN_PROGRESS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterStatus === "IN_PROGRESS"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sedang Berjalan ({inProgressCourses})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterStatus === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Selesai ({completedCourses})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("CERTIFIED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterStatus === "CERTIFIED"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sertifikasi ({totalCertificates})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari materi kursus..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:bg-white outline-none font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Courses Grid */}
      {filteredEnrollments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Belum Ada Kursus Ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || filterStatus !== "ALL"
              ? "Tidak ada kursus yang sesuai dengan kata kunci atau filter yang Anda pilih."
              : "Belum ada kursus akademi yang ditugaskan kepada akun Anda. Hubungi Supervisor atau Trainer."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEnrollments.map((enroll) => {
            const c = enroll.course;
            const hasCert = enroll.certificates?.length > 0;
            const statusCfg = STATUS_CONFIG[enroll.status] || STATUS_CONFIG.ASSIGNED;

            return (
              <div
                key={enroll.id}
                onClick={() => setActiveEnrollId(enroll.id)}
                className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-red-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-5 cursor-pointer group shadow-2xs"
              >
                {/* Top Badge & Icon */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#941A0B] to-[#6D1207] text-white flex items-center justify-center text-xl shadow-md group-hover:scale-105 transition">
                      <i className="fa-solid fa-graduation-cap" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wide border ${statusCfg.badge}`}>
                      <i className={`${statusCfg.icon} mr-1`} />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-black text-slate-900 text-base leading-snug group-hover:text-[#941A0B] transition">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Details & Progress */}
                <div className="space-y-3.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <i className="fa-solid fa-layer-group text-slate-400" />
                      {c.modules.length} Modul
                    </span>
                    <span className="font-extrabold text-[#941A0B] font-mono">
                      {enroll.progressPct}% Selesai
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-[#941A0B] rounded-full transition-all duration-300"
                      style={{ width: `${enroll.progressPct}%` }}
                    />
                  </div>

                  {/* Certification Tag */}
                  {c.isCertification && (
                    <div
                      className={`flex items-center gap-2 text-[10px] font-bold rounded-xl px-3 py-1.5 border ${
                        hasCert
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                      }`}
                    >
                      <i className={`fa-solid ${hasCert ? "fa-certificate text-emerald-600" : "fa-shield-halved text-amber-600"}`} />
                      <span>{hasCert ? "Sertifikat Diterbitkan ✓" : "Program Sertifikasi Brand"}</span>
                    </div>
                  )}

                  {/* Action CTA */}
                  <div className="w-full py-2 px-3 rounded-xl bg-slate-50 group-hover:bg-red-50 text-slate-700 group-hover:text-[#941A0B] text-xs font-bold text-center transition flex items-center justify-center gap-1.5">
                    <span>{enroll.progressPct === 100 ? "Lihat Materi Kursus" : "Lanjutkan Belajar"}</span>
                    <i className="fa-solid fa-arrow-right text-[10px]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
