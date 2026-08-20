"use client";

import { useEffect, useState } from "react";

export default function TrainerPortalPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    setLoading(true);
    try {
      const res = await fetch("/api/lms?view=courses");
      const d = await res.json();
      if (d.status === "success") setCourses(d.data);
      else setError(d.message ?? "Gagal memuat kursus");
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
        body: JSON.stringify({ action: "course", ...courseForm }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Kursus baru "${courseForm.title}" berhasil dibuat!`);
        setCourseForm({ title: "", description: "", status: "ACTIVE" });
        setModalOpen(false);
        loadCourses();
      } else {
        setError(d.message ?? "Gagal membuat kursus");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trainer & Academy Studio</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manajemen kurikulum pelatihan live streaming, modul onboarding host baru, dan penerbitan sertifikasi kompetensi.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-2 self-start sm:self-auto"
        >
          <i className="fa-solid fa-plus" />
          <span>Buat Kursus Baru</span>
        </button>
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

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {c.status ?? "ACTIVE"}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {c.modules?.length ?? 0} Modul
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {c.description || "Panduan kurikulum standar live streaming agency."}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Akademi Host</span>
              <span className="font-bold text-blue-600">Terbuka untuk Streamer →</span>
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

      {/* Create Course Modal */}
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
                  rows={4}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="mis. Teknik meningkatkan closing rate di Shopee Live dan retensi viewer hingga 15 menit."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
    </div>
  );
}
