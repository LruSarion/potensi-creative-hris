"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { TableLoadingState, SectionLoader, CardSkeleton } from "@/components/ui/loading-states";
import { toast } from "@/components/ui/toast";

export default function TrainerPortalPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [streamers, setStreamers] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState<"courses" | "enrollments" | "grading">("courses");

  // Create course modal
  const [modalOpen, setModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    status: "ACTIVE",
    isCertification: false,
    clientId: "",
  });

  // Selected course for adding module/lesson/quiz
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", order: 1, passingScore: 70 });

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [lessonForm, setLessonForm] = useState({
    title: "",
    content: "",
    videoId: "",
    videoDuration: 0,
  });

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    moduleId: "",
    type: "MCQ",
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "",
  });

  // Cohort Enroll modal
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cohortCourseId, setCohortCourseId] = useState("");
  const [selectedKaryawanIds, setSelectedKaryawanIds] = useState<string[]>([]);

  // Essay grading state
  const [gradingAttemptId, setGradingAttemptId] = useState("");
  const [gradeScore, setGradeScore] = useState<number>(80);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Expanded module inspection
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "grading") {
      loadSubmissions();
    }
  }, [activeTab]);

  async function loadSubmissions() {
    setLoadingSubmissions(true);
    try {
      const data = await fetchJson<any[]>("/api/lms?view=video-submissions", { cache: "no-store" });
      setSubmissions(data ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function handleDeleteCourse(id: string, title: string) {
    if (!confirm(`Hapus kursus "${title}" beserta seluruh modul dan materinya?`)) return;
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "course-delete", id });
      const msg = `Kursus "${title}" berhasil dihapus.`;
      toast.success(msg);
      setSuccess(msg);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleDeleteModule(id: string, title: string) {
    if (!confirm(`Hapus modul "${title}" beserta seluruh materi dan kuisnya?`)) return;
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "module-delete", id });
      const msg = `Modul "${title}" berhasil dihapus.`;
      toast.success(msg);
      setSuccess(msg);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleDeleteLesson(id: string, title: string) {
    if (!confirm(`Hapus materi lesson "${title}"?`)) return;
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "lesson-delete", id });
      const msg = `Materi "${title}" berhasil dihapus.`;
      toast.success(msg);
      setSuccess(msg);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm("Hapus pertanyaan kuis ini?")) return;
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "question-delete", id });
      const msg = "Pertanyaan kuis berhasil dihapus.";
      toast.success(msg);
      setSuccess(msg);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [courseData, clientData, enrollData, streamerData] = await Promise.all([
        fetchJson<any[]>("/api/lms?view=courses"),
        fetchJson<any[]>("/api/clients").catch(() => []),
        fetchJson<any[]>("/api/lms?view=enrollments&compact=true").catch(() => []),
        fetchJson<any[]>("/api/employees?kategori=STREAMER").catch(() => []),
      ]);

      setCourses(courseData ?? []);
      setClients(clientData ?? []);
      setEnrollments(enrollData ?? []);
      setStreamers(streamerData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!courseForm.title.trim()) {
      toast.warning("Judul kursus wajib diisi.");
      return;
    }
    setError("");
    setSuccess("");

    try {
      await sendJson("/api/lms", "POST", { action: "course", ...courseForm, clientId: courseForm.clientId || null });
      const msg = `Kursus baru "${courseForm.title}" berhasil dibuat!`;
      toast.success(msg);
      setSuccess(msg);
      setCourseForm({ title: "", description: "", status: "ACTIVE", isCertification: false, clientId: "" });
      setModalOpen(false);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Terjadi kesalahan koneksi");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourse) return;
    if (!moduleForm.title.trim()) {
      toast.warning("Judul modul wajib diisi.");
      return;
    }
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "module", courseId: selectedCourse.id, ...moduleForm });
      const msg = "Modul baru berhasil ditambahkan!";
      toast.success(msg);
      setSuccess(msg);
      setModuleModalOpen(false);
      setModuleForm({ title: "", order: 1, passingScore: 70 });
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModuleId) return;
    if (!lessonForm.title.trim()) {
      toast.warning("Judul materi lesson wajib diisi.");
      return;
    }
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "lesson", moduleId: selectedModuleId, ...lessonForm });
      const msg = "Materi lesson berhasil ditambahkan!";
      toast.success(msg);
      setSuccess(msg);
      setLessonModalOpen(false);
      setLessonForm({ title: "", content: "", videoId: "", videoDuration: 0 });
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionForm.moduleId) return;
    if (!questionForm.question.trim()) {
      toast.warning("Pertanyaan kuis wajib diisi.");
      return;
    }
    setError(""); setSuccess("");
    try {
      const payload = {
        action: "question",
        moduleId: questionForm.moduleId,
        type: questionForm.type,
        question: questionForm.question,
        options: questionForm.type === "MCQ" ? questionForm.options.filter((o) => o.trim() !== "") : null,
        correctAnswer: questionForm.correctAnswer,
      };
      await sendJson("/api/lms", "POST", payload);
      const msg = "Pertanyaan kuis berhasil ditambahkan!";
      toast.success(msg);
      setSuccess(msg);
      setQuestionModalOpen(false);
      setQuestionForm({ moduleId: "", type: "MCQ", question: "", options: ["", "", "", ""], correctAnswer: "" });
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleEnrollCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!cohortCourseId || selectedKaryawanIds.length === 0) {
      toast.warning("Pilih kursus dan minimal satu streamer.");
      setError("Pilih kursus dan minimal satu streamer.");
      return;
    }
    setError(""); setSuccess("");
    try {
      const res = await sendJson<any>("/api/lms", "POST", { action: "enroll-cohort", courseId: cohortCourseId, karyawanIds: selectedKaryawanIds });
      const createdCount = Array.isArray(res) ? res.length : (res?.created?.length ?? 0);
      const alreadyCount = Array.isArray(res) ? 0 : (res?.alreadyEnrolled?.length ?? 0);
      let msg = "";
      if (createdCount > 0 && alreadyCount > 0) {
        msg = `Berhasil mendaftarkan ${createdCount} streamer (${alreadyCount} streamer sudah terdaftar sebelumnya).`;
      } else if (createdCount > 0) {
        msg = `Berhasil mendaftarkan ${createdCount} streamer ke kursus.`;
      } else if (alreadyCount > 0) {
        msg = `${alreadyCount} streamer yang dipilih sudah terdaftar pada kursus ini sebelumnya.`;
      } else {
        msg = "Tidak ada streamer baru yang didaftarkan.";
      }
      toast.success(msg);
      setSuccess(msg);
      setCohortModalOpen(false);
      setSelectedKaryawanIds([]);
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleGradeEssay(attemptId: string, score: number) {
    setError(""); setSuccess("");
    try {
      await sendJson("/api/lms", "POST", { action: "grade", attemptId, score });
      const msg = `Nilai essay ${score} berhasil diberikan!`;
      toast.success(msg);
      setSuccess(msg);
      setGradingAttemptId("");
      loadData();
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal");
      toast.error(msg);
      setError(msg);
    }
  }

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-chalkboard-user text-purple-600" />
            Trainer & Academy Studio
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manajemen kurikulum pelatihan live streaming, input kelas & modul baru, materi video interaktif, dan evaluasi hasil ujian streamer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCohortModalOpen(true)}
            className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-users-rectangle text-indigo-600" />
            <span>Enroll Cohort</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-2"
          >
            <i className="fa-solid fa-plus" />
            <span>Buat Kursus Baru</span>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "courses", label: `Daftar Kursus & Modul (${courses.length})`, icon: "fa-book-open" },
          { key: "enrollments", label: `Progres Streamer (${enrollments.length})`, icon: "fa-user-graduate" },
          { key: "grading", label: `Evaluasi & Nilai Jawaban (${submissions.length})`, icon: "fa-marker" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition ${
              activeTab === t.key ? "text-purple-600 border-purple-600 bg-white shadow-sm" : "text-slate-500 border-transparent hover:text-slate-700"
            }`}
          >
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Courses List */}
      {activeTab === "courses" && (
        loading ? (
          <CardSkeleton count={3} />
        ) : courses.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-2">
            <i className="fa-solid fa-graduation-cap text-3xl text-slate-300 block" />
            <p>Belum ada materi kursus akademi yang dibuat.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {c.status ?? "ACTIVE"}
                      </span>
                      {c.isCertification && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          SERTIFIKASI BRAND
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {c.modules?.length ?? 0} Modul
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c.id, c.title)}
                        className="text-slate-300 hover:text-red-600 p-1 rounded transition text-xs"
                        title="Hapus Kursus"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description || "Panduan kurikulum standar live streaming agency."}
                  </p>
                </div>

                {/* Modules summary & detail inspection */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700 flex justify-between items-center">
                    <span>Modul & Materi:</span>
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setModuleForm({ title: "", order: (c.modules?.length ?? 0) + 1, passingScore: 70 });
                        setModuleModalOpen(true);
                      }}
                      className="text-blue-600 hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus" /> Tambah Modul
                    </button>
                  </div>
                  {c.modules?.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {c.modules.map((m: any, idx: number) => {
                        const isExpanded = expandedModuleId === m.id;
                        return (
                          <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setExpandedModuleId(isExpanded ? null : m.id)}
                                className="font-bold text-slate-800 text-xs flex items-center gap-1.5 hover:text-purple-600 text-left"
                              >
                                <i className={`fa-solid ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[10px] text-slate-400`} />
                                <span>{idx + 1}. {m.title}</span>
                              </button>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => {
                                    setSelectedModuleId(m.id);
                                    setLessonModalOpen(true);
                                  }}
                                  className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                                >
                                  + Materi
                                </button>
                                <button
                                  onClick={() => {
                                    setQuestionForm({ moduleId: m.id, type: "MCQ", question: "", options: ["", "", "", ""], correctAnswer: "" });
                                    setQuestionModalOpen(true);
                                  }}
                                  className="text-[10px] text-emerald-600 font-bold hover:underline bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                >
                                  + Kuis
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteModule(m.id, m.title)}
                                  className="text-slate-300 hover:text-red-600 p-0.5 text-xs"
                                  title="Hapus Modul"
                                >
                                  <i className="fa-solid fa-trash-can" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center justify-between">
                              <span>Passing Score: <b>{m.passingScore}%</b></span>
                              <span>{m.lessons?.length ?? 0} materi • {m.questions?.length ?? 0} kuis</span>
                            </div>

                            {/* Expanded Detail for Lessons and Questions */}
                            {isExpanded && (
                              <div className="pt-2 border-t border-slate-200 space-y-2 animate-fadeIn">
                                {/* Lessons list */}
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block">
                                    Materi Pembelajaran ({m.lessons?.length ?? 0})
                                  </span>
                                  {m.lessons?.length > 0 ? (
                                    m.lessons.map((l: any) => (
                                      <div key={l.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <i className={l.videoId ? "fa-brands fa-youtube text-red-600 text-xs" : "fa-regular fa-file-lines text-slate-400 text-xs"} />
                                          <span className="font-semibold text-slate-800 truncate text-[11px]">{l.title}</span>
                                          {l.videoDuration ? <span className="text-[9px] text-slate-400 font-mono">({Math.round(l.videoDuration / 60)}m)</span> : null}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteLesson(l.id, l.title)}
                                          className="text-slate-300 hover:text-red-600 p-0.5 text-[11px]"
                                          title="Hapus Materi"
                                        >
                                          <i className="fa-solid fa-trash-can" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[10px] text-slate-400 italic">Belum ada materi. Klik + Materi di atas.</div>
                                  )}
                                </div>

                                {/* Questions list */}
                                <div className="space-y-1 pt-1">
                                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block">
                                    Soal Ujian / Kuis ({m.questions?.length ?? 0})
                                  </span>
                                  {m.questions?.length > 0 ? (
                                    m.questions.map((q: any, qIdx: number) => (
                                      <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${q.type === "MCQ" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                              {q.type}
                                            </span>
                                            <span className="font-medium text-slate-800 line-clamp-1 text-[11px]">{qIdx + 1}. {q.question}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            className="text-slate-300 hover:text-red-600 p-0.5 text-[11px] shrink-0"
                                            title="Hapus Soal"
                                          >
                                            <i className="fa-solid fa-trash-can" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[10px] text-slate-400 italic">Belum ada soal kuis. Klik + Kuis di atas.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Belum ada modul. Klik + Tambah Modul di atas.</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Akademi Host</span>
                  <span className="font-bold text-emerald-600">✓ Aktif di Portal Streamer</span>
                </div>
              </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Tab: Enrollments / Streamer Progress */}
      {activeTab === "enrollments" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Daftar Penugasan & Progres Pembelajaran Host ({enrollments.length})</span>
            <button
              onClick={() => setCohortModalOpen(true)}
              className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 transition"
            >
              + Enroll Streamer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3 uppercase text-[10px]">Streamer / Host</th>
                  <th className="px-4 py-3 uppercase text-[10px]">Kursus</th>
                  <th className="px-4 py-3 uppercase text-[10px]">Progress</th>
                  <th className="px-4 py-3 uppercase text-[10px]">Status</th>
                  <th className="px-4 py-3 uppercase text-[10px]">Sertifikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableLoadingState
                    colSpan={5}
                    text="Memuat data penugasan kursus..."
                    subtext="Menyelaraskan progress belajar dan sertifikat streamer..."
                  />
                ) : enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-400">Belum ada data penugasan kursus.</td>
                  </tr>
                ) : (
                  enrollments.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {e.karyawan?.namaLengkap ?? "—"}
                        <div className="text-[10px] text-slate-400 font-normal">{e.karyawan?.idKaryawan}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{e.course?.title}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${e.progressPct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">{e.progressPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            e.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : e.status === "IN_PROGRESS"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.certificates && e.certificates.length > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <i className="fa-solid fa-certificate" /> {e.certificates[0].code}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Grading / Evaluasi Essay & Nilai Siswa */}
      {activeTab === "grading" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Evaluasi Hasil Ujian & Penilaian Manual Trainer</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Beri nilai essay streamer atau periksa rekapan lembar jawaban kuis video interaktif.
              </p>
            </div>
            <Link
              href="/portal/trainer/hasil-jawaban"
              className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <i className="fa-solid fa-square-poll-vertical text-purple-600" />
              <span>Buka Rekap Lengkap & Rincian Lembar Jawaban</span>
            </Link>
          </div>

          {loadingSubmissions ? (
            <SectionLoader
              text="Memuat data pengerjaan ujian streamer..."
              subtext="Menyelaraskan rekapan kuis dan submission modul dari server..."
            />
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Belum ada data pengerjaan ujian atau quiz dari streamer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3 uppercase text-[10px]">Streamer / Host</th>
                    <th className="px-4 py-3 uppercase text-[10px]">Modul & Materi</th>
                    <th className="px-4 py-3 uppercase text-[10px]">Tontonan</th>
                    <th className="px-4 py-3 uppercase text-[10px]">Skor Kuis</th>
                    <th className="px-4 py-3 uppercase text-[10px]">Status</th>
                    <th className="px-4 py-3 uppercase text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {sub.studentName}
                        <div className="text-[10px] text-slate-400 font-normal">{sub.studentId}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {sub.lessonTitle}
                        <div className="text-[10px] text-slate-400 font-normal">{sub.moduleTitle}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-600">
                        {sub.watchPercentage}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold text-xs ${sub.scorePercent >= 70 ? "text-emerald-600" : "text-red-600"}`}>
                          {sub.scorePercent}/100
                        </span>
                        <span className="text-[10px] text-slate-400 block">({sub.correctCount}/{sub.totalQuestions} benar)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          sub.status === "PASSED" || sub.scorePercent >= 70
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {sub.status === "PASSED" || sub.scorePercent >= 70 ? "LULUS" : "REMIDI"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/portal/trainer/hasil-jawaban`}
                          className="text-purple-600 hover:underline font-bold text-xs"
                        >
                          Lihat Lembar Jawaban →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Buat Kursus */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Buat Materi Kursus Akademi Baru</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Kursus / Modul</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  placeholder="mis. Mastering Hard-Selling & Flash Sale Pitching"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi / Sasaran Pembelajaran</label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="mis. Teknik meningkatkan closing rate di Shopee Live dan retensi viewer hingga 15 menit."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={courseForm.isCertification}
                  onChange={(e) => setCourseForm({ ...courseForm, isCertification: e.target.checked })}
                  className="accent-emerald-600"
                />
                Kursus Sertifikasi Brand (lulus ujian → sertifikat klien)
              </label>

              {courseForm.isCertification && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand Klien yang Disertifikasi</label>
                  <select
                    value={courseForm.clientId}
                    onChange={(e) => setCourseForm({ ...courseForm, clientId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Pilih Brand Klien --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.namaClient}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20"
                >
                  Publikasikan Kursus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Modul */}
      {moduleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Modul Bab: {selectedCourse?.title}</h3>
              <button onClick={() => setModuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddModule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Bab Modul</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  placeholder="mis. Bab 1: Fondasi Personal Branding Host"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Urutan Modul</label>
                  <input
                    type="number"
                    value={moduleForm.order}
                    onChange={(e) => setModuleForm({ ...moduleForm, order: parseInt(e.target.value) || 1 })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    value={moduleForm.passingScore}
                    onChange={(e) => setModuleForm({ ...moduleForm, passingScore: parseInt(e.target.value) || 70 })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Simpan Modul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Lesson */}
      {lessonModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Materi Teks / Video Lesson</h3>
              <button onClick={() => setLessonModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddLesson} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Lesson</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="mis. Pengenalan Pitching 3 Detik Pertama"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">YouTube Video ID (Opsional)</label>
                <input
                  type="text"
                  value={lessonForm.videoId}
                  onChange={(e) => setLessonForm({ ...lessonForm, videoId: e.target.value })}
                  placeholder="mis. dQw4w9WgXcQ"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Materi Teks & Panduan</label>
                <textarea
                  rows={4}
                  value={lessonForm.content}
                  onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                  placeholder="Tulis ringkasan atau poin-poin utama materi di sini..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLessonModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Simpan Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Pertanyaan Kuis */}
      {questionModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Pertanyaan Kuis</h3>
              <button onClick={() => setQuestionModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Pertanyaan</label>
                <select
                  value={questionForm.type}
                  onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MCQ">Pilihan Ganda (MCQ - Auto Grade)</option>
                  <option value="ESSAY">Essay / Uraian (Penilaian Manual Trainer)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pertanyaan / Soal</label>
                <textarea
                  rows={3}
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  placeholder="Tuliskan soal ujian di sini..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {questionForm.type === "MCQ" && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700">Pilihan Jawaban</label>
                  {questionForm.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="font-bold text-slate-500 w-4">{String.fromCharCode(65 + idx)}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...questionForm.options];
                          newOpts[idx] = e.target.value;
                          setQuestionForm({ ...questionForm, options: newOpts });
                        }}
                        placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={questionForm.correctAnswer === String(idx)}
                        onChange={() => setQuestionForm({ ...questionForm, correctAnswer: String(idx) })}
                        title="Tandai sebagai jawaban benar"
                        className="accent-emerald-600"
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 italic">Pilih radio button di kanan untuk menandai kunci jawaban yang benar.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enroll Cohort */}
      {cohortModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Enroll Cohort Streamer</h3>
              <button onClick={() => setCohortModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleEnrollCohort} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Kursus Target</label>
                <select
                  value={cohortCourseId}
                  onChange={(e) => setCohortCourseId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Pilih Kursus --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Streamer / Host ({selectedKaryawanIds.length} dipilih)</label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50">
                  {streamers.map((s) => {
                    const checked = selectedKaryawanIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedKaryawanIds((prev) => [...prev, s.id]);
                            else setSelectedKaryawanIds((prev) => prev.filter((id) => id !== s.id));
                          }}
                          className="accent-blue-600"
                        />
                        <span className="font-semibold text-slate-800">{s.namaLengkap}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({s.idKaryawan})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCohortModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Assign Ke Streamer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
