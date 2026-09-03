"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson } from "@/lib/api-client";

interface ClientOption {
  id: string;
  namaClient: string;
}

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdCourse: any) => void;
}

export default function CreateCourseModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCourseModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCertification, setIsCertification] = useState(false);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      fetchJson<ClientOption[]>("/api/clients")
        .then((data) => {
          if (Array.isArray(data)) {
            setClients(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul kelas/kursus wajib diisi");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await sendJson<any>("/api/lms", "POST", {
        action: "course",
        title: title.trim(),
        description: description.trim() || null,
        isCertification,
        clientId: isCertification && clientId ? clientId : null,
        status,
      });

      setTitle("");
      setDescription("");
      setIsCertification(false);
      setClientId("");
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kelas baru");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#941A0B]/10 text-[#941A0B] flex items-center justify-center font-bold text-base">
              <i className="fa-solid fa-graduation-cap" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Buat Kelas / Kursus Baru</h3>
              <p className="text-[11px] text-slate-500">Materi pelatihan LMS & sertifikasi host streamer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Judul Kelas / Kursus <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Mastering Hard-Selling & Flash Sale Pitching"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi / Sasaran Pembelajaran</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Teknik meningkatkan closing rate live TikTok/Shopee, teknik retensi viewer, dan SOP interaksi etis."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Publikasi</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white"
              >
                <option value="ACTIVE">ACTIVE (Tersedia bagi Host)</option>
                <option value="DRAFT">DRAFT (Dalam Penyusunan)</option>
                <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={isCertification}
                  onChange={(e) => setIsCertification(e.target.checked)}
                  className="accent-[#941A0B] w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-slate-700">Sertifikasi Brand Klien</span>
              </label>
            </div>
          </div>

          {isCertification && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1.5 animate-fadeIn">
              <label className="block font-semibold text-amber-900 text-[11px]">
                Pilih Brand Partner yang Disertifikasi
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white"
              >
                <option value="">-- Sertifikasi Internal Agency --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.namaClient}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-amber-700">
                Host yang lulus kuis akhir kelas ini akan otomatis memperoleh sertifikat resmi brand ini.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#941A0B] hover:bg-[#781509] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md shadow-[#941A0B]/20 flex items-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-plus" />
              <span>{submitting ? "Menyimpan..." : "Simpan Kelas Baru"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
