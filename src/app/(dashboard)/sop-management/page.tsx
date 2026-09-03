"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson } from "@/lib/api-client";

type SopTask = { id?: string; title: string; requiresPhoto: boolean };
type SopTemplate = { id: string; title: string; description: string | null; tasks: SopTask[] };

export default function SopManagementPage() {
  const [templates, setTemplates] = useState<SopTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [tasks, setTasks] = useState<SopTask[]>([{ title: "", requiresPhoto: false }]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<SopTemplate[]>("/api/sop?view=templates");
      setTemplates(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat template SOP");
    } finally {
      setLoading(false);
    }
  }

  function updateTask(idx: number, field: keyof SopTask, value: string | boolean) {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const validTasks = tasks.filter((t) => t.title.trim());
    if (!formTitle.trim() || validTasks.length === 0) {
      setError("Judul template dan minimal satu tugas wajib diisi");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/sop", "POST", {
        action: "create-template",
        template: {
          title: formTitle,
          description: formDesc || null,
          tasks: validTasks.map((t, i) => ({ title: t.title, requiresPhoto: t.requiresPhoto, order: i + 1 })),
        },
      });
      setSuccess(`Template SOP "${formTitle}" berhasil dibuat!`);
      setShowForm(false);
      setFormTitle("");
      setFormDesc("");
      setTasks([{ title: "", requiresPhoto: false }]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat template");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen SOP & Tugas Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Buat template checklist tugas harian untuk staff/OTS, lengkap dengan bukti foto opsional.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
        >
          <i className="fa-solid fa-plus mr-1" />
          {showForm ? "Tutup Form" : "Buat Template SOP"}
        </button>
      </div>

      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">✓ {success}</div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Template SOP</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="mis. Persiapan Studio Sebelum Live"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
              <input
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Deskripsi singkat tujuan checklist"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Daftar Tugas (Checklist)</label>
              <button
                type="button"
                onClick={() => setTasks([...tasks, { title: "", requiresPhoto: false }])}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                + Tambah Tugas
              </button>
            </div>
            <div className="space-y-2">
              {tasks.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={t.title}
                    onChange={(e) => updateTask(idx, "title", e.target.value)}
                    placeholder={`Tugas ${idx + 1}...`}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={t.requiresPhoto}
                      onChange={(e) => updateTask(idx, "requiresPhoto", e.target.checked)}
                      className="accent-amber-500"
                    />
                    Wajib foto
                  </label>
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 text-xs"
                      aria-label="Hapus tugas"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition">
              Simpan Template
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 text-sm">{tpl.title}</div>
              <span className="text-[11px] text-slate-500">{tpl.tasks.length} tugas</span>
            </div>
            {tpl.description && <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>}
            <ul className="mt-3 space-y-1.5">
              {tpl.tasks.map((task, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md border border-slate-200 flex items-center justify-center text-[9px] text-slate-400">
                    {i + 1}
                  </span>
                  {task.title}
                  {task.requiresPhoto && (
                    <span className="text-[9px] font-bold text-amber-600">📷 wajib foto</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!loading && templates.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-xs">
            Belum ada template SOP. Buat yang pertama di atas.
          </div>
        )}
      </div>
    </div>
  );
}
