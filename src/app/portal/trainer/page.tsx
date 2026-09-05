"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

  const [activeTab, setActiveTab] = useState<"courses" | "enrollments" | "grading" | "certificates">("courses");

  // Certificate template (global single)
  const [certTemplate, setCertTemplate] = useState<any>(null);
  const [certTemplateLoading, setCertTemplateLoading] = useState(false);
  const [certTemplateSaving, setCertTemplateSaving] = useState(false);
  const [certActionsBusy, setCertActionsBusy] = useState<string | null>(null);

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
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "certificates" || tab === "cert-template" || tab === "template") {
      setActiveTab("certificates");
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "grading") {
      loadSubmissions();
    }
    if (activeTab === "certificates" && !certTemplate && !certTemplateLoading) {
      loadCertTemplate();
    }
  }, [activeTab]);

  async function loadCertTemplate() {
    setCertTemplateLoading(true);
    try {
      const data = await fetchJson<any>("/api/lms?view=cert-template", { cache: "no-store" });
      setCertTemplate(data ?? null);
    } catch {
      // ignore
    } finally {
      setCertTemplateLoading(false);
    }
  }

  async function handleSaveCertTemplate() {
    if (!certTemplate) return;
    setCertTemplateSaving(true);
    setError(""); setSuccess("");
    try {
      const saved = await sendJson("/api/lms", "POST", { action: "save-cert-template", template: certTemplate });
      setCertTemplate(saved);
      toast.success("Template sertifikat diperbarui");
      setSuccess("Template sertifikat diperbarui");
    } catch (err) {
      const msg = errorMessage(err, "Gagal menyimpan template");
      toast.error(msg); setError(msg);
    } finally {
      setCertTemplateSaving(false);
    }
  }

  async function handleIssueCert(enrollmentId: string) {
    const validTo = prompt("Tanggal berlaku hingga (YYYY-MM-DD, kosongkan untuk tanpa batas):", "");
    if (validTo !== null && validTo.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(validTo.trim())) {
      toast.error("Format tanggal harus YYYY-MM-DD");
      return;
    }
    setCertActionsBusy(enrollmentId);
    try {
      await sendJson("/api/lms", "POST", { action: "certificate", enrollmentId, validTo: validTo?.trim() || undefined });
      toast.success("Sertifikat diterbitkan");
      loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menerbitkan sertifikat"));
    } finally {
      setCertActionsBusy(null);
    }
  }
  async function handleRevokeCert(certId: string, code: string) {
    if (!confirm(`Cabut sertifikat ${code}? Tindakan ini menandai sertifikat tidak valid.`)) return;
    setCertActionsBusy(certId);
    try {
      await sendJson("/api/lms", "POST", { action: "revoke-cert", id: certId });
      toast.success("Sertifikat dicabut");
      loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mencabut sertifikat"));
    } finally {
      setCertActionsBusy(null);
    }
  }
  async function handleExtendCert(certId: string) {
    const validTo = prompt("Perpanjang berlaku hingga (YYYY-MM-DD):", "");
    if (!validTo || !/^\d{4}-\d{2}-\d{2}$/.test(validTo.trim())) {
      if (validTo !== null) toast.error("Format tanggal harus YYYY-MM-DD");
      return;
    }
    setCertActionsBusy(certId);
    try {
      await sendJson("/api/lms", "POST", { action: "extend-cert", id: certId, validTo: validTo.trim() });
      toast.success("Masa berlaku diperpanjang");
      loadData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal perpanjang"));
    } finally {
      setCertActionsBusy(null);
    }
  }

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
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { key: "courses", label: `Daftar Kursus & Modul (${courses.length})`, icon: "fa-book-open" },
          { key: "enrollments", label: `Progres Streamer (${enrollments.length})`, icon: "fa-user-graduate" },
          { key: "grading", label: `Evaluasi & Nilai Jawaban (${submissions.length})`, icon: "fa-marker" },
          { key: "certificates", label: `Template Sertifikat`, icon: "fa-certificate" },
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
                          <div className="flex flex-col gap-1.5">
                            <a href={`/portal/streamer/sertifikat/${e.certificates[0].code}`} target="_blank" className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline">
                              <i className="fa-solid fa-certificate" /> {e.certificates[0].code}
                            </a>
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => handleRevokeCert(e.certificates[0].id, e.certificates[0].code)} disabled={certActionsBusy === e.certificates[0].id} className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded hover:bg-red-100 disabled:opacity-50">
                                Cabut
                              </button>
                              <button type="button" onClick={() => handleExtendCert(e.certificates[0].id)} disabled={certActionsBusy === e.certificates[0].id} className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 disabled:opacity-50">
                                Perpanjang
                              </button>
                            </div>
                          </div>
                        ) : e.status === "COMPLETED" ? (
                          <button type="button" onClick={() => handleIssueCert(e.id)} disabled={certActionsBusy === e.id} className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1">
                            <i className="fa-solid fa-award" /> Terbitkan
                          </button>
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

      {/* Tab: Template Sertifikat (global, full-custom) */}
      {activeTab === "certificates" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-palette text-purple-600" />
                  Template Sertifikat Global
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Full custom — satu template untuk semua sertifikat (fallback desain lama bila kosong).</p>
              </div>
              <button type="button" onClick={handleSaveCertTemplate} disabled={certTemplateSaving || certTemplateLoading} className="bg-[#941A0B] hover:bg-[#7a160a] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center gap-2">
                {certTemplateSaving ? <><i className="fa-solid fa-circle-notch fa-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> Simpan Template</>}
              </button>
            </div>

            {certTemplateLoading ? (
              <SectionLoader text="Memuat template..." />
            ) : certTemplate ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Primer (border/judul)</label>
                      <div className="flex gap-2">
                        <input type="color" value={certTemplate.primaryColor || "#065f46"} onChange={(e) => setCertTemplate({ ...certTemplate, primaryColor: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 p-1" />
                        <input type="text" value={certTemplate.primaryColor || ""} onChange={(e) => setCertTemplate({ ...certTemplate, primaryColor: e.target.value })} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="#065f46" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Aksen</label>
                      <div className="flex gap-2">
                        <input type="color" value={certTemplate.accentColor || "#0d9488"} onChange={(e) => setCertTemplate({ ...certTemplate, accentColor: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 p-1" />
                        <input type="text" value={certTemplate.accentColor || ""} onChange={(e) => setCertTemplate({ ...certTemplate, accentColor: e.target.value })} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="#0d9488" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Background</label>
                      <div className="flex gap-2">
                        <input type="color" value={certTemplate.backgroundColor || "#ffffff"} onChange={(e) => setCertTemplate({ ...certTemplate, backgroundColor: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 p-1" />
                        <input type="text" value={certTemplate.backgroundColor || ""} onChange={(e) => setCertTemplate({ ...certTemplate, backgroundColor: e.target.value })} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="#ffffff" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Warna Border</label>
                      <div className="flex gap-2">
                        <input type="color" value={certTemplate.borderColor || "#065f46"} onChange={(e) => setCertTemplate({ ...certTemplate, borderColor: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 p-1" />
                        <input type="text" value={certTemplate.borderColor || ""} onChange={(e) => setCertTemplate({ ...certTemplate, borderColor: e.target.value })} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="#065f46" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Gaya Border</label>
                      <select value={certTemplate.borderStyle || "double"} onChange={(e) => setCertTemplate({ ...certTemplate, borderStyle: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">
                        <option value="double">Double</option>
                        <option value="solid">Solid</option>
                        <option value="none">Tanpa Border</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tebal Border (px)</label>
                      <input type="number" min={0} max={32} value={certTemplate.borderWidth ?? 12} onChange={(e) => setCertTemplate({ ...certTemplate, borderWidth: parseInt(e.target.value || "0", 10) })} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Logo (Drive ID / URL)</label>
                      <input type="text" value={certTemplate.logoDriveId || ""} onChange={(e) => setCertTemplate({ ...certTemplate, logoDriveId: e.target.value })} placeholder="https://drive.google.com/... atau ID" className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Background (Drive ID / URL)</label>
                      <input type="text" value={certTemplate.backgroundDriveId || ""} onChange={(e) => setCertTemplate({ ...certTemplate, backgroundDriveId: e.target.value })} placeholder="URL gambar background" className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Header</label>
                    <input type="text" value={certTemplate.headerTitle || ""} onChange={(e) => setCertTemplate({ ...certTemplate, headerTitle: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Subjudul Header</label>
                    <input type="text" value={certTemplate.headerSubtitle || ""} onChange={(e) => setCertTemplate({ ...certTemplate, headerSubtitle: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Teks Body (atas nama)</label>
                    <textarea rows={2} value={certTemplate.bodyText || ""} onChange={(e) => setCertTemplate({ ...certTemplate, bodyText: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Penandatangan</label>
                      <input type="text" value={certTemplate.signatureName || ""} onChange={(e) => setCertTemplate({ ...certTemplate, signatureName: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Jabatan Penandatangan</label>
                      <input type="text" value={certTemplate.signatureTitle || ""} onChange={(e) => setCertTemplate({ ...certTemplate, signatureTitle: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Font</label>
                      <select value={certTemplate.fontFamily || "DM Sans"} onChange={(e) => setCertTemplate({ ...certTemplate, fontFamily: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">
                        <option value="DM Sans">DM Sans</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Mono</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 font-bold text-slate-700 mt-6">
                      <input type="checkbox" checked={!!certTemplate.showWatermark} onChange={(e) => setCertTemplate({ ...certTemplate, showWatermark: e.target.checked })} className="accent-purple-600" />
                      Tampilkan Watermark
                    </label>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan Footer</label>
                    <input type="text" value={certTemplate.footerNote || ""} onChange={(e) => setCertTemplate({ ...certTemplate, footerNote: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preview (contoh)</p>
                  <div
                    className="rounded-3xl shadow-xl overflow-hidden print:shadow-none"
                    style={{ backgroundColor: certTemplate.backgroundColor || "#ffffff" }}
                  >
                    <div
                      className="p-8 sm:p-10 border relative min-h-[420px] flex flex-col items-center justify-center text-center space-y-6"
                      style={{
                        borderWidth: certTemplate.borderStyle === "none" ? 0 : (certTemplate.borderWidth ?? 12),
                        borderStyle: certTemplate.borderStyle === "none" ? "solid" : (certTemplate.borderStyle as any),
                        borderColor: certTemplate.borderColor || certTemplate.primaryColor || "#065f46",
                        fontFamily: certTemplate.fontFamily === "mono" ? "monospace" : certTemplate.fontFamily === "serif" ? "serif" : "DM Sans, sans-serif",
                        backgroundImage: certTemplate.backgroundDriveId ? `url(${certTemplate.backgroundDriveId})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {certTemplate.showWatermark && <i className="fa-solid fa-award absolute text-[160px] pointer-events-none select-none opacity-[0.04]" style={{ color: certTemplate.primaryColor }} />}
                      <div className="space-y-2">
                        {certTemplate.logoDriveId ? (
                          <img src={certTemplate.logoDriveId} alt="logo" className="w-16 h-16 rounded-2xl mx-auto object-contain bg-white shadow-md p-1" />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-md text-white" style={{ background: `linear-gradient(to bottom right, ${certTemplate.primaryColor}, ${certTemplate.accentColor})` }}>
                            <i className="fa-solid fa-certificate" />
                          </div>
                        )}
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.3em]" style={{ color: certTemplate.primaryColor }}>{certTemplate.headerSubtitle}</p>
                        <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: certTemplate.primaryColor }}>{certTemplate.headerTitle}</h2>
                        <p className="text-xs text-slate-500">Diberikan kepada</p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tight" style={{ color: certTemplate.primaryColor }}>Nama Streamer Contoh</h3>
                        <p className="text-[11px] text-slate-500 font-mono">ID Karyawan: PCS999</p>
                      </div>
                      <div className="max-w-md space-y-2">
                        <p className="text-xs text-slate-700 leading-relaxed">{certTemplate.bodyText}</p>
                        <h4 className="text-lg font-extrabold text-slate-900">Judul Kursus Contoh</h4>
                        <p className="text-[11px] text-slate-500">Sertifikasi resmi untuk brand <strong className="text-slate-700">Brand Contoh</strong></p>
                      </div>
                      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: "#e2e8f0" }}>
                        <div className="text-center sm:text-left">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Diterbitkan</p>
                          <p className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kode Verifikasi</p>
                          <p className="text-sm font-black font-mono tracking-wider" style={{ color: certTemplate.primaryColor }}>CERT-CONTOH</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="font-[cursive] text-xl italic leading-none">{certTemplate.signatureName}</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-t pt-1 mt-1" style={{ borderColor: "#cbd5e1" }}>{certTemplate.signatureTitle}</p>
                        </div>
                      </div>
                      {certTemplate.footerNote && <p className="text-[10px] text-slate-400">{certTemplate.footerNote}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">Gagal memuat template</div>
            )}
          </div>
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
