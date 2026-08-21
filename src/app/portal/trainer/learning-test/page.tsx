"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  moduleId: string;
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

const DEFAULT_OPTIONS = ["", "", "", ""];

export default function LearningTestPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lessonModal, setLessonModal] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title: "", videoUrl: "", duration: 60 });
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const [questionModal, setQuestionModal] = useState(false);
  const [qEventTime, setQEventTime] = useState("60");
  const [qQuestion, setQQuestion] = useState("");
  const [qOptions, setQOptions] = useState<string[]>([...DEFAULT_OPTIONS]);
  const [qCorrect, setQCorrect] = useState("A");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/lms?view=courses", { cache: "no-store" });
      const d = await r.json();
      if (d.status === "success") {
        setCourses(d.data ?? []);
        if (d.data?.length) {
          const c = d.data[0];
          if (!selectedCourseId) {
            setSelectedCourseId(c.id);
            if (c.modules?.length) setSelectedModuleId(c.modules[0].id);
          }
        }
      } else {
        setError(d.message ?? "Gagal memuat kursus");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function extractYouTubeId(urlOrId: string): string {
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : urlOrId.trim();
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!lessonForm.title.trim() || !lessonForm.videoUrl.trim()) {
      setError("Judul materi dan URL/ID video YouTube wajib diisi.");
      return;
    }
    if (!selectedModuleId) {
      setError("Pilih modul tujuan terlebih dahulu.");
      return;
    }
    const videoId = extractYouTubeId(lessonForm.videoUrl);
    const duration = Math.max(1, Math.round(lessonForm.duration));
    try {
      const r = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lesson",
          moduleId: selectedModuleId,
          id: editingLesson?.id,
          title: lessonForm.title.trim(),
          order: editingLesson?.order ?? 1,
          videoId,
          videoDuration: duration,
        }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(editingLesson ? "Materi video diperbarui." : "Materi video interaktif baru berhasil dibuat!");
        setLessonModal(false);
        setLessonForm({ title: "", videoUrl: "", duration: 60 });
        setEditingLesson(null);
        load();
      } else {
        setError(d.message ?? "Gagal menyimpan materi video.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    }
  }

  async function deleteLesson(id: string) {
    if (!confirm("Hapus materi video beserta semua pertanyaan terkait?")) return;
    setError("");
    try {
      const r = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lesson-delete", id }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Materi video dihapus.");
        load();
      } else {
        setError(d.message ?? "Gagal menghapus materi video.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    }
  }

  function openQuestionModal(q?: Question) {
    setEditingQuestion(q ?? null);
    if (q) {
      setQEventTime(String(q.eventTime ?? 60));
      setQQuestion(q.question);
      setQOptions(q.options && q.options.length > 0 ? [...q.options] : [...DEFAULT_OPTIONS]);
      const optIndex = (q.options ?? []).indexOf(q.correctAnswer ?? "");
      setQCorrect(String.fromCharCode(65 + Math.max(0, optIndex)));
    } else {
      setQEventTime("60");
      setQQuestion("");
      setQOptions([...DEFAULT_OPTIONS]);
      setQCorrect("A");
    }
    setQuestionModal(true);
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedModuleId) {
      setError("Pilih modul tujuan terlebih dahulu.");
      return;
    }
    const options = qOptions.map((o) => o.trim()).filter(Boolean);
    const correctIndex = qCorrect.charCodeAt(0) - 65;
    const correctAnswer = options[correctIndex] ?? options[0] ?? "";
    if (options.length < 2) {
      setError("Minimal 2 pilihan jawaban.");
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        action: "question",
        moduleId: selectedModuleId,
        id: editingQuestion?.id,
        type: "MCQ",
        question: qQuestion.trim(),
        options,
        correctAnswer,
        eventTime: Number(qEventTime) || 0,
        isNote: false,
      };
      const r = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(editingQuestion ? "Pertanyaan diperbarui." : "Pertanyaan waktu berhasil ditambahkan.");
        setQuestionModal(false);
        load();
      } else {
        setError(d.message ?? "Gagal menyimpan pertanyaan.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    }
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const selectedModule = selectedCourse?.modules.find((m) => m.id === selectedModuleId);
  const sortedQuestions = (selectedModule?.questions ?? [])
    .filter((q) => q.eventTime != null)
    .sort((a, b) => (a.eventTime ?? 0) - (b.eventTime ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learning Test — Materi Video Interaktif</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Buat materi video YouTube dengan pertanyaan yang muncul di waktu tertentu. Streamer menjawab sambil menonton.
        </p>
      </div>

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

      {/* Course + Module selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-slate-700 text-xs mb-1.5">Pilih Kursus</label>
          <select
            value={selectedCourseId}
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value);
              setSelectedCourseId(e.target.value);
              setSelectedModuleId(c?.modules?.[0]?.id ?? "");
            }}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 text-xs mb-1.5">Pilih Modul</label>
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            {(selectedCourse?.modules ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.title} (passing {m.passingScore})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lessons (video) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            Materi Video ({selectedModule?.lessons?.filter((l) => l.videoId)?.length ?? 0})
          </h3>
          <button
            onClick={() => {
              setEditingLesson(null);
              setLessonForm({ title: "", videoUrl: "", duration: 60 });
              setLessonModal(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus text-xs" /> Tambah Video
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {(selectedModule?.lessons ?? [])
            .filter((l) => l.videoId)
            .map((l) => (
              <div key={l.id} className="p-4 sm:px-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <i className="fa-solid fa-circle-play text-purple-500 text-lg flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{l.title}</p>
                    <p className="text-[10px] text-slate-400">
                      Video ID: <span className="font-mono">{l.videoId}</span> • {l.videoDuration ?? 0} detik
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingLesson(l);
                      setLessonForm({ title: l.title, videoUrl: l.videoId ?? "", duration: l.videoDuration ?? 60 });
                      setLessonModal(true);
                    }}
                    className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteLesson(l.id)}
                    className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          {selectedModule && (selectedModule.lessons ?? []).filter((l) => l.videoId).length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-video text-3xl text-slate-300 block mb-2" />
              Belum ada materi video. Tambahkan video YouTube dan pasang pertanyaan di waktu tertentu.
            </div>
          )}
        </div>
      </div>

      {/* Timed questions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Pertanyaan Terjadwal ({sortedQuestions.length})</h3>
          <button
            onClick={() => openQuestionModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-clock text-xs" /> Tambah Pertanyaan
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {sortedQuestions.map((q) => (
            <div key={q.id} className="p-4 sm:px-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0">
                  @ {formatTime(q.eventTime ?? 0)}
                </span>
                <p className="text-xs text-slate-700 font-medium truncate">{q.question}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openQuestionModal(q)}
                  className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Hapus pertanyaan ini?")) return;
                    try {
                      const r = await fetch("/api/lms", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "question-delete", id: q.id }),
                      });
                      const d = await r.json();
                      if (d.status === "success") {
                        setSuccess("Pertanyaan dihapus.");
                        load();
                      } else {
                        setError(d.message ?? "Gagal menghapus pertanyaan.");
                      }
                    } catch {
                      setError("Terjadi kesalahan jaringan.");
                    }
                  }}
                  className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {selectedModule && sortedQuestions.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-clock text-3xl text-slate-300 block mb-2" />
              Belum ada pertanyaan terjadwal. Tambahkan soal yang muncul di detik tertentu video.
            </div>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-slate-500 text-center py-4">Memuat materi...</p>}

      {/* Lesson modal */}
      {lessonModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">{editingLesson ? "Edit Materi Video" : "Tambah Materi Video Interaktif"}</h3>
              <button onClick={() => setLessonModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={saveLesson} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Materi</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="mis. Teknik Opening Hook 30 Detik Pertama"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL / ID Video YouTube</label>
                <input
                  type="text"
                  value={lessonForm.videoUrl}
                  onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                  placeholder="https://youtu.be/XXXX atau ID video"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Durasi Video (detik)</label>
                <input
                  type="number"
                  min={1}
                  value={lessonForm.duration}
                  onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) || 0 })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Gunakan untuk menghitung persentase tontonan streamer.</p>
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                {editingLesson ? "Simpan Perubahan" : "Buat Materi Video"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Question modal */}
      {questionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">{editingQuestion ? "Edit Pertanyaan Terjadwal" : "Tambah Pertanyaan Terjadwal"}</h3>
              <button onClick={() => setQuestionModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={saveQuestion} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Muncul di Detik ke-</label>
                <input
                  type="number"
                  min={0}
                  value={qEventTime}
                  onChange={(e) => setQEventTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pertanyaan</label>
                <textarea
                  rows={2}
                  value={qQuestion}
                  onChange={(e) => setQQuestion(e.target.value)}
                  placeholder="mis. Apa teknik yang paling penting di 30 detik pertama live?"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700 mb-1">Pilihan Jawaban</label>
                {qOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-slate-500 font-bold w-8">
                      <input
                        type="radio"
                        name="correct"
                        checked={qCorrect === String.fromCharCode(65 + idx)}
                        onChange={() => setQCorrect(String.fromCharCode(65 + idx))}
                        className="accent-emerald-600"
                      />
                      {String.fromCharCode(65 + idx)}
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...qOptions];
                        next[idx] = e.target.value;
                        setQOptions(next);
                      }}
                      placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
                <p className="text-[10px] text-slate-400">Tandai pilihan yang benar dengan tombol radio hijau.</p>
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                {editingQuestion ? "Simpan Perubahan" : "Simpan Pertanyaan"}
              </button>
            </form>
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
