"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [cRes, clRes, eRes, sRes] = await Promise.all([
        fetch("/api/lms?view=courses").then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/lms?view=enrollments").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/employees?kategori=STREAMER").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
      ]);

      if (cRes.status === "success") setCourses(cRes.data ?? []);
      else setError(cRes.message ?? "Gagal memuat kursus");

      if (clRes.status === "success") setClients(clRes.data ?? []);
      if (eRes.status === "success") setEnrollments(eRes.data ?? []);
      if (sRes.status === "success") setStreamers(sRes.data ?? []);
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "course", ...courseForm, clientId: courseForm.clientId || null }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Kursus baru "${courseForm.title}" berhasil dibuat!`);
        setCourseForm({ title: "", description: "", status: "ACTIVE", isCertification: false, clientId: "" });
        setModalOpen(false);
        loadData();
      } else {
        setError(d.message ?? "Gagal membuat kursus");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourse) return;
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "module", courseId: selectedCourse.id, ...moduleForm }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Modul baru berhasil ditambahkan!");
        setModuleModalOpen(false);
        setModuleForm({ title: "", order: 1, passingScore: 70 });
        loadData();
      } else {
        setError(d.message ?? "Gagal menambahkan modul");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModuleId) return;
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lesson", moduleId: selectedModuleId, ...lessonForm }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Materi lesson berhasil ditambahkan!");
        setLessonModalOpen(false);
        setLessonForm({ title: "", content: "", videoId: "", videoDuration: 0 });
        loadData();
      } else {
        setError(d.message ?? "Gagal menambahkan lesson");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionForm.moduleId) return;
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
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Pertanyaan kuis berhasil ditambahkan!");
        setQuestionModalOpen(false);
        setQuestionForm({ moduleId: "", type: "MCQ", question: "", options: ["", "", "", ""], correctAnswer: "" });
        loadData();
      } else {
        setError(d.message ?? "Gagal menambahkan pertanyaan");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleEnrollCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!cohortCourseId || selectedKaryawanIds.length === 0) {
      setError("Pilih kursus dan minimal satu streamer.");
      return;
    }
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll-cohort", courseId: cohortCourseId, karyawanIds: selectedKaryawanIds }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Berhasil memdaftarkan ${d.data?.length ?? selectedKaryawanIds.length} streamer ke kursus.`);
        setCohortModalOpen(false);
        setSelectedKaryawanIds([]);
        loadData();
      } else {
        setError(d.message ?? "Gagal mentargetkan enrollment");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleGradeEssay(attemptId: string, score: number) {
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grade", attemptId, score }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Nilai essay ${score} berhasil diberikan!`);
        setGradingAttemptId("");
        loadData();
      } else {
        setError(d.message ?? "Gagal memberikan nilai");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-chalkboard-user text-blue-600" />
            Trainer & Academy Studio
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manajemen kurikulum pelatihan live streaming, modul onboarding host baru, dan penugasan sertifikasi.
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
          { key: "courses", label: `Daftar Kursus (${courses.length})`, icon: "fa-book-open" },
          { key: "enrollments", label: `Progres Streamer (${enrollments.length})`, icon: "fa-user-graduate" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition ${
              activeTab === t.key ? "text-blue-600 border-blue-600 bg-white shadow-sm" : "text-slate-500 border-transparent hover:text-slate-700"
            }`}
          >
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Courses List */}
      {activeTab === "courses" && (
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
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {c.modules?.length ?? 0} Modul
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description || "Panduan kurikulum standar live streaming agency."}
                  </p>
                </div>

                {/* Modules summary */}
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {c.modules.map((m: any, idx: number) => (
                        <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px]">
                              {idx + 1}. {m.title}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedModuleId(m.id);
                                  setLessonModalOpen(true);
                                }}
                                className="text-[10px] text-blue-600 font-semibold hover:underline"
                              >
                                + Materi
                              </button>
                              <button
                                onClick={() => {
                                  setQuestionForm({ moduleId: m.id, type: "MCQ", question: "", options: ["", "", "", ""], correctAnswer: "" });
                                  setQuestionModalOpen(true);
                                }}
                                className="text-[10px] text-emerald-600 font-semibold hover:underline"
                              >
                                + Kuis
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 flex gap-3">
                            <span>{m.lessons?.length ?? 0} materi teks/video</span>
                            <span>{m.questions?.length ?? 0} soal kuis</span>
                          </div>
                        </div>
                      ))}
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

          {courses.length === 0 && !loading && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-2">
              <i className="fa-solid fa-graduation-cap text-3xl text-slate-300 block" />
              <p>Belum ada materi kursus akademi yang dibuat.</p>
            </div>
          )}
        </div>
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
                {enrollments.map((e: any) => (
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
                ))}
              </tbody>
            </table>
            {enrollments.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">Belum ada data penugasan kursus.</div>
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
