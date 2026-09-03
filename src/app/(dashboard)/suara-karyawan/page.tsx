"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson } from "@/lib/api-client";

export default function SuaraKaryawanPage() {
  const { data: session } = useSession();
  const { showAlert } = useAlert();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(session?.user?.role || "");

  const [activeTab, setActiveTab] = useState<"buat" | "riwayat">("buat");

  // Form state
  const [formSuara, setFormSuara] = useState({
    kategori: "KELUHAN",
    deskripsi: "",
    harapan: "",
    buktiB64: "",
    anonim: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal zoom
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const data = await fetchJson<any>("/api/suara");
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAlert("⚠️ Ukuran berkas maksimal 5MB.");
      return;
    }
    compressImage(file, (b64) => {
      setFormSuara((prev) => ({ ...prev, buktiB64: b64 }));
    });
  }

  function compressImage(file: File, callback: (b64: string) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const MAX = 1000;
        let w = img.width;
        let h = img.height;
        if (w >= h && w > MAX) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else if (h > w && h > MAX) {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          callback(canvas.toDataURL("image/jpeg", 0.75));
        }
      };
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formSuara.deskripsi) {
      showAlert("⚠️ Deskripsi laporan wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const combinedMessage = `[${formSuara.kategori}] ${formSuara.deskripsi}${formSuara.harapan ? `\n\nHarapan/Solusi: ${formSuara.harapan}` : ""}${formSuara.anonim ? " (Pengirim Anonim)" : ""}`;

      await sendJson("/api/suara", "POST", {
        kategori: formSuara.kategori,
        pesan: combinedMessage,
        lampiranDriveId: formSuara.buktiB64 || undefined,
      });

      showAlert("✅ Laporan suara karyawan berhasil dikirim ke manajemen!");
      setFormSuara({
        kategori: "KELUHAN",
        deskripsi: "",
        harapan: "",
        buktiB64: "",
        anonim: false,
      });
      loadHistory();
      setActiveTab("riwayat");
    } catch (err) {
      showAlert("❌ Gagal: " + (err instanceof Error ? err.message : "Gagal mengirim laporan"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start gap-3.5 border-b border-slate-200/80 pb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 mt-0.5 text-white">
          <i className="fa-regular fa-comment-dots text-lg" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Suara Karyawan</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Sampaikan keluhan, aspirasi, saran perbaikan, atau laporan pelanggaran secara aman dan rahasia.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-2xl bg-slate-100/70 w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("buat")}
          className={`py-2 px-6 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "buat"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-pen-to-square text-blue-600" />
          <span>Buat Laporan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("riwayat")}
          className={`py-2 px-6 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "riwayat"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left text-purple-600" />
          <span>Riwayat Laporan</span>
        </button>
      </div>

      {/* TAB 1: FORM BUAT LAPORAN */}
      {activeTab === "buat" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">Form Laporan Aspirasi</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sampaikan masukan Anda untuk peningkatan lingkungan kerja.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kategori Laporan <span className="text-red-500">*</span></label>
                <select
                  value={formSuara.kategori}
                  onChange={(e) => setFormSuara({ ...formSuara, kategori: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                >
                  <option value="KELUHAN">Keluhan Operasional</option>
                  <option value="SARAN">Saran Perbaikan Sistem</option>
                  <option value="PELANGGARAN">Laporan Pelanggaran (Whistleblowing)</option>
                  <option value="FASILITAS">Kendala Fasilitas Kantor</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Bukti Lampiran (Opsional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>Unggah File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) compressImage(file, (b64) => setFormSuara((f) => ({ ...f, buktiB64: b64 })));
                      }}
                    />
                  </label>
                  {formSuara.buktiB64 && (
                    <div className="relative border border-slate-200 rounded-xl p-1 bg-slate-50 w-16 h-10 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formSuara.buktiB64}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg cursor-pointer"
                        onClick={() => setPreviewModalImg(formSuara.buktiB64)}
                      />
                      <button
                        type="button"
                        onClick={() => setFormSuara((f) => ({ ...f, buktiB64: "" }))}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Deskripsi Detail <span className="text-red-500">*</span></label>
                <textarea
                  rows={4}
                  value={formSuara.deskripsi}
                  onChange={(e) => setFormSuara({ ...formSuara, deskripsi: e.target.value })}
                  placeholder="Ceritakan detail kejadian, kendala, atau ide saran Anda secara terperinci..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Harapan / Solusi yang Diinginkan</label>
                <textarea
                  rows={2}
                  value={formSuara.harapan}
                  onChange={(e) => setFormSuara({ ...formSuara, harapan: e.target.value })}
                  placeholder="Apa yang Anda harapkan dari manajemen terkait hal ini?"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkAnonim"
                  checked={formSuara.anonim}
                  onChange={(e) => setFormSuara({ ...formSuara, anonim: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chkAnonim" className="text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
                  Kirim sebagai Anonim (Identitas disembunyikan sepenuhnya dari laporan)
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs sm:text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className={`fa-solid ${submitting ? "fa-circle-notch fa-spin" : "fa-paper-plane"}`} />
                <span>{submitting ? "Mengirim..." : "Kirim Laporan"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: RIWAYAT LAPORAN */}
      {activeTab === "riwayat" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">Riwayat Laporan Suara Karyawan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Daftar masukan dan aspirasi yang telah diajukan.</p>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition text-xs"
              title="Refresh Data"
            >
              <i className="fa-solid fa-rotate-right" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">TANGGAL</th>
                  <th className="px-4 py-3">KATEGORI</th>
                  <th className="px-4 py-3">PESAN / ASPIRASI</th>
                  <th className="px-4 py-3 text-center">LAMPIRAN</th>
                  <th className="px-4 py-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-blue-500 mb-2 block" />
                      Memuat data laporan...
                    </td>
                  </tr>
                ) : history.length > 0 ? (
                  history.map((h, idx) => {
                    const dateStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

                    return (
                      <tr key={h.id || idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">{dateStr}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{h.kategori || "UMUM"}</td>
                        <td className="px-4 py-3 text-slate-700 whitespace-pre-line max-w-md">{h.pesan || "–"}</td>
                        <td className="px-4 py-3 text-center align-middle">
                          {h.lampiranDriveId ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(h.lampiranDriveId)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-file-image" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold rounded-lg shadow-2xs">
                            TERKIRIM
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">
                      <i className="fa-regular fa-comments text-3xl mb-2 block text-slate-300" />
                      Belum ada laporan aspirasi tersimpan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Zoom Foto */}
      {previewModalImg && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-image text-blue-500" />
                <span>Lampiran Bukti</span>
              </h3>
              <button type="button" onClick={() => setPreviewModalImg(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6 text-center bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg.startsWith("http") || previewModalImg.startsWith("data:") ? previewModalImg : `https://drive.google.com/open?id=${previewModalImg}`}
                alt="Lampiran"
                className="max-h-80 mx-auto rounded-xl object-contain border border-slate-200 shadow-md bg-white"
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
