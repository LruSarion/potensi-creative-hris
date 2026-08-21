"use client";

import { useEffect, useState } from "react";
import VideoLessonPlayer from "@/components/lms/video-lesson-player";

type Question = {
  id: string;
  moduleId: string;
  lessonId: string | null;
  type: string;
  question: string;
  options: string[] | null;
  correctAnswer: string | null;
  eventTime: number | null;
  isNote: boolean;
};

type Lesson = {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  order: number;
  videoId: string | null;
  videoDuration: number | null;
};

type Module = {
  id: string;
  title: string;
  order: number;
  passingScore: number;
  lessons: Lesson[];
  questions: Question[];
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  modules: Module[];
};

type Enrollment = {
  id: string;
  status: string;
  progressPct: number;
  dueDate: string | null;
  course: Course;
  certificates: { id: string; code: string; revokedAt: string | null }[];
};

export default function StreamerLmsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Interactive Learning Viewer Modal
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"lesson" | "quiz">("lesson");
  const [selectedLessonIdx, setSelectedLessonIdx] = useState(0);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [eRes, cRes] = await Promise.all([
        fetch("/api/lms?view=enrollments").then((r) => r.json()),
        fetch("/api/lms?view=courses").then((r) => r.json()),
      ]);

      if (eRes.status === "success") {
        setEnrollments(eRes.data);
      }
      if (cRes.status === "success") {
        setCourses(cRes.data);
      }
    } catch {
      setError("Gagal memuat data akademi & kurikulum");
    } finally {
      setLoading(false);
    }
  }

  function openCourse(e: Enrollment) {
    setSelectedEnrollment(e);
    setActiveModuleIdx(0);
    setSelectedLessonIdx(0);
    setActiveTab("lesson");
    setAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  }

  async function handleAnswerSubmit() {
    if (!selectedEnrollment) return;
    const currentModule = selectedEnrollment.course.modules[activeModuleIdx];
    if (!currentModule || currentModule.questions.length === 0) return;

    setSubmittingQuiz(true);
    setError("");

    try {
      let totalCorrect = 0;
      for (const q of currentModule.questions) {
        const userAns = answers[q.id] ?? "";
        if (q.correctAnswer && userAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
          totalCorrect += 1;
        }

        // Submit each answer to backend
        await fetch("/api/lms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "answer",
            enrollmentId: selectedEnrollment.id,
            questionId: q.id,
            answerText: userAns,
          }),
        });
      }

      const score = Math.round((totalCorrect / currentModule.questions.length) * 100);
      setQuizScore(score);
      setQuizSubmitted(true);

      // Recompute progress in backend
      const progRes = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          enrollmentId: selectedEnrollment.id,
        }),
      });
      const progData = await progRes.json();

      if (score >= (currentModule.passingScore || 70)) {
        setSuccess(`Selamat! Anda lulus modul ini dengan nilai ${score}/100!`);
        // If course is completed, try issuing certificate
        if (progData.data?.completed) {
          await fetch("/api/lms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "certificate",
              enrollmentId: selectedEnrollment.id,
            }),
          }).catch(() => undefined);
        }
      } else {
        setError(`Nilai Anda: ${score}/100. Diperlukan minimal ${currentModule.passingScore || 70} untuk lulus. Silakan ulangi materi.`);
      }

      loadData();
    } catch {
      setError("Terjadi kesalahan koneksi saat mengirim jawaban kuis");
    } finally {
      setSubmittingQuiz(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Akademi & Pelatihan Streamer (LMS)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Modul kurikulum standar agency: Teknik opening hook, hard-selling flash sale, engagement viewer, dan sertifikasi keahlian.
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

      {/* Enrollments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {enrollments.map((e) => (
          <div
            key={e.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                  Kurikulum Agency
                </span>
                <span
                  className={`text-xs px-3 py-0.5 rounded-full font-bold border ${
                    e.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {e.status === "COMPLETED" ? "✅ Lulus & Tersertifikasi" : "⏳ Sedang Dipelajari"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-lg">{e.course.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                  {e.course.description || "Standar selling pitching, engagement viewer, dan demo produk live streaming agency."}
                </p>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                {e.course.modules?.length ?? 0} Modul Pelatihan • {e.course.modules?.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0) ?? 0} Bab Materi
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Progres Kelulusan</span>
                <span className="font-bold font-mono text-blue-600">{e.progressPct}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${e.progressPct}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => openCourse(e)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-2"
              >
                <i className="fa-solid fa-book-open text-xs" />
                <span>Buka Materi & Kuis</span>
              </button>

              {e.certificates.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <i className="fa-solid fa-award text-sm" />
                  <span>{e.certificates[0].code}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {enrollments.length === 0 && !loading && (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-3">
          <i className="fa-solid fa-graduation-cap text-4xl text-slate-300 block" />
          <p className="text-sm font-semibold text-slate-600">Belum ada kurikulum pelatihan terdaftar.</p>
          <p>Trainer akan menerbitkan modul akademi untuk Anda.</p>
        </div>
      )}

      {/* Interactive Course & Quiz Modal */}
      {selectedEnrollment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  Modul Akademi Live
                </span>
                <h3 className="font-bold text-slate-900 text-base">{selectedEnrollment.course.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEnrollment(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center shadow-sm"
              >
                ✕
              </button>
            </div>

            {/* Module Selector Pills */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto flex-shrink-0">
              {selectedEnrollment.course.modules?.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveModuleIdx(idx);
                    setSelectedLessonIdx(0);
                    setQuizSubmitted(false);
                    setQuizScore(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    activeModuleIdx === idx
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Modul {idx + 1}: {m.title}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tab Selector: Materi vs Kuis */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  onClick={() => setActiveTab("lesson")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === "lesson"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <i className="fa-solid fa-file-lines" />
                  <span>Bab Materi ({selectedEnrollment.course.modules[activeModuleIdx]?.lessons?.length ?? 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === "quiz"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <i className="fa-solid fa-circle-question" />
                  <span>Kuis Uji Pemahaman ({selectedEnrollment.course.modules[activeModuleIdx]?.questions?.length ?? 0} Soal)</span>
                </button>
              </div>

              {/* Lesson Reader Tab */}
              {activeTab === "lesson" && (
                <div className="space-y-4">
                  {selectedEnrollment.course.modules[activeModuleIdx]?.lessons?.map((les, lIdx) => (
                    <div
                      key={les.id}
                      className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2 text-xs leading-relaxed text-slate-700"
                    >
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {lIdx + 1}
                        </span>
                        <span>{les.title}</span>
                        {les.videoId && (
                          <span className="ml-auto text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-circle-play text-[10px]" /> Video Interaktif
                          </span>
                        )}
                      </h4>
                      {les.videoId ? (
                        <VideoLessonPlayer
                          lesson={les}
                          enrollmentId={selectedEnrollment.id}
                          questions={
                            selectedEnrollment.course.modules[activeModuleIdx]?.questions?.filter(
                              (q) => q.eventTime != null && q.lessonId === les.id
                            ) ?? []
                          }
                          onSubmitted={() => loadData()}
                        />
                      ) : (
                        <p className="whitespace-pre-line pl-7 text-slate-600">
                          {les.content || "Pelajari panduan materi SOP live streaming ini sebelum melanjutkan ke sesi kuis kompetensi."}
                        </p>
                      )}
                    </div>
                  ))}

                  {(!selectedEnrollment.course.modules[activeModuleIdx]?.lessons ||
                    selectedEnrollment.course.modules[activeModuleIdx].lessons.length === 0) && (
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs leading-relaxed text-slate-700">
                      <h4 className="font-bold text-sm text-slate-900">Materi 1: 30 Detik Pertama Siaran Live (The Hook)</h4>
                      <p>
                        1. <strong>Greeting & Callout</strong>: Jangan biarkan live hening! Sapa penonton yang baru join dan sebut nama akun mereka.<br />
                        2. <strong>Spill Promo Utama</strong>: Langsung umumkan promo terbesar hari ini (mis. <em>"Khusus live kali ini ada voucher diskon 50% di etalase 1!"</em>).<br />
                        3. <strong>Call to Action (CTA)</strong>: Arahkan penonton klik tombol keranjang kuning/oranye dan klaim gratis ongkir sekarang juga.
                      </p>

                      <h4 className="font-bold text-sm text-slate-900 pt-3">Materi 2: Demo Produk & Handling Chat Viewer</h4>
                      <p>
                        - Tunjukkan tekstur, swatch, atau fitur fisik produk tepat di depan kamera.<br />
                        - Jawab chat penonton secara responsif, dan hubungkan pertanyaan mereka dengan produk di keranjang.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Player Tab */}
              {activeTab === "quiz" && (
                <div className="space-y-4">
                  {selectedEnrollment.course.modules[activeModuleIdx]?.questions?.map((q, qIdx) => (
                    <div key={q.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
                      <p className="font-bold text-slate-900">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="space-y-2 pl-2">
                        {["A", "B", "C", "D"].map((opt) => (
                          <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-slate-700">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                              className="accent-blue-600"
                            />
                            <span>Pilihan {opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {(!selectedEnrollment.course.modules[activeModuleIdx]?.questions ||
                    selectedEnrollment.course.modules[activeModuleIdx].questions.length === 0) && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                        <p className="font-bold text-slate-900">1. Apa hal terpenting yang harus dilakukan host di 30 detik pertama saat siaran live dimulai?</p>
                        <div className="space-y-2 pl-2">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mock_q1"
                              checked={answers["mock_q1"] === "A"}
                              onChange={() => setAnswers({ ...answers, mock_q1: "A" })}
                              className="accent-blue-600"
                            />
                            <span>A. Menunggu 10 menit sampai jumlah penonton mencapai 100 orang</span>
                          </label>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mock_q1"
                              checked={answers["mock_q1"] === "B"}
                              onChange={() => setAnswers({ ...answers, mock_q1: "B" })}
                              className="accent-blue-600"
                            />
                            <span>B. Menyapa penonton dan langsung mengumumkan voucher promo utama di keranjang</span>
                          </label>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                        <p className="font-bold text-slate-900">2. Berapa menit jeda istirahat minimum antar sesi siaran live (Token Jeda SOP)?</p>
                        <div className="space-y-2 pl-2">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mock_q2"
                              checked={answers["mock_q2"] === "A"}
                              onChange={() => setAnswers({ ...answers, mock_q2: "A" })}
                              className="accent-blue-600"
                            />
                            <span>A. 10 Menit</span>
                          </label>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="mock_q2"
                              checked={answers["mock_q2"] === "B"}
                              onChange={() => setAnswers({ ...answers, mock_q2: "B" })}
                              className="accent-blue-600"
                            />
                            <span>B. 30 Menit</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {quizSubmitted && quizScore != null && (
                    <div
                      className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                        quizScore >= 70
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-800 border-red-200"
                      }`}
                    >
                      <span>Skor Hasil Ujian: {quizScore}/100</span>
                      <span>{quizScore >= 70 ? "🎉 Lulus Standar Kompetensi" : "⚠️ Di Bawah Passing Grade"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedEnrollment(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Tutup
              </button>

              {activeTab === "quiz" ? (
                <button
                  type="button"
                  onClick={handleAnswerSubmit}
                  disabled={submittingQuiz}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane text-xs" />
                  <span>{submittingQuiz ? "Mengirim Jawaban..." : "Kirim Jawaban Kuis"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("quiz")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                >
                  <span>Lanjut ke Kuis</span>
                  <i className="fa-solid fa-arrow-right text-xs" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}