"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";
import { toast } from "@/components/ui/toast";

export default function PengajuanLemburPage() {
  const { data: session } = useSession();
  const { showConfirm } = useAlert();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(session?.user?.role || "");

  const [activeTab, setActiveTab] = useState<"ajukan" | "mulai" | "selesai" | "riwayat">("ajukan");

  // Tab 1: Ajukan Lembur
  const [formAjukan, setFormAjukan] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    spv: "Raihan",
    jamMulai: "18:00",
    jamSelesai: "21:00",
    kegiatan: "",
  });
  const [submittingAjukan, setSubmittingAjukan] = useState(false);

  // Tab 2: Mulai Lembur
  const [formMulai, setFormMulai] = useState({
    idLembur: "",
    jamMasuk: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }),
    fotoB64: "",
  });
  const [submittingMulai, setSubmittingMulai] = useState(false);

  // Tab 3: Selesai Lembur
  const [formSelesai, setFormSelesai] = useState({
    idLembur: "",
    jamKeluar: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }),
    fotoB64: "",
    catatan: "",
  });
  const [submittingSelesai, setSubmittingSelesai] = useState(false);

  // Tab 4: Riwayat
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Camera & Image Preview
  const [cameraActiveFor, setCameraActiveFor] = useState<"mulai" | "selesai" | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const data = await fetchJson<any>("/api/lembur");
      if (Array.isArray(data)) {
        setHistory(data);
        const approved = data.find((d: any) => d.status === "APPROVED" || d.status === "PENDING");
        if (approved) {
          setFormMulai((f) => ({ ...f, idLembur: approved.id }));
          setFormSelesai((f) => ({ ...f, idLembur: approved.id }));
        }
      }
    } catch (err) {
      console.error("Gagal memuat data lembur:", err);
    } finally {
      setLoadingHistory(false);
    }
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

  async function openCamera(target: "mulai" | "selesai") {
    setCameraActiveFor(target);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error("Gagal mengakses kamera perangkat.");
      setCameraActiveFor(null);
    }
  }

  function captureCamera() {
    if (!videoRef.current || !cameraActiveFor) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", 0.75);
      if (cameraActiveFor === "mulai") setFormMulai((f) => ({ ...f, fotoB64: b64 }));
      if (cameraActiveFor === "selesai") setFormSelesai((f) => ({ ...f, fotoB64: b64 }));
    }
    closeCamera();
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActiveFor(null);
  }

  async function handleAjukan(e: React.FormEvent) {
    e.preventDefault();
    if (!formAjukan.kegiatan) {
      toast.warning("Kegiatan / alasan lembur wajib diisi.");
      return;
    }

    setSubmittingAjukan(true);
    try {
      const startIso = new Date(`${formAjukan.tanggal}T${formAjukan.jamMulai}:00`).toISOString();
      const endIso = new Date(`${formAjukan.tanggal}T${formAjukan.jamSelesai}:00`).toISOString();

      await sendJson("/api/lembur", "POST", {
        tanggal: new Date(formAjukan.tanggal).toISOString(),
        jamMulai: startIso,
        jamSelesai: endIso,
        alasan: `[SPV: ${formAjukan.spv}] ${formAjukan.kegiatan}`,
      });

      toast.success("Pengajuan lembur berhasil dikirim! Menunggu persetujuan SPV / Admin.");
      setFormAjukan({
        tanggal: new Date().toISOString().split("T")[0],
        spv: "Raihan",
        jamMulai: "18:00",
        jamSelesai: "21:00",
        kegiatan: "",
      });
      loadHistory();
      setActiveTab("riwayat");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengajukan lembur"));
    } finally {
      setSubmittingAjukan(false);
    }
  }

  async function handleMulai(e: React.FormEvent) {
    e.preventDefault();
    if (!formMulai.idLembur || !formMulai.fotoB64) {
      toast.warning("ID Lembur dan Foto Masuk wajib diisi.");
      return;
    }

    setSubmittingMulai(true);
    try {
      await sendJson(`/api/lembur?id=${formMulai.idLembur}`, "PATCH", {
        buktiDriveId: formMulai.fotoB64,
      });

      toast.success("Absen mulai lembur berhasil dicatat!");
      loadHistory();
      setActiveTab("selesai");
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat mencatat mulai lembur."));
    } finally {
      setSubmittingMulai(false);
    }
  }

  async function handleSelesai(e: React.FormEvent) {
    e.preventDefault();
    if (!formSelesai.idLembur || !formSelesai.fotoB64 || !formSelesai.catatan) {
      toast.warning("ID Lembur, Foto Keluar, dan Laporan Pekerjaan Akhir wajib diisi.");
      return;
    }

    setSubmittingSelesai(true);
    try {
      await sendJson(`/api/lembur?id=${formSelesai.idLembur}`, "PATCH", {
        buktiDriveId: formSelesai.fotoB64,
        alasan: formSelesai.catatan,
      });

      toast.success("Absen selesai lembur dan laporan akhir berhasil dikirim!");
      loadHistory();
      setActiveTab("riwayat");
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat menyelesaikan lembur."));
    } finally {
      setSubmittingSelesai(false);
    }
  }

  async function handleApprove(id: string, approve: boolean) {
    const confirmed = await showConfirm(`Yakin ingin ${approve ? "MENYETUJUI" : "MENOLAK"} lembur ini?`);
    if (!confirmed) return;
    try {
      await sendJson(`/api/lembur?id=${id}&approve=${approve}`, "PATCH");
      toast.success(approve ? "Pengajuan lembur berhasil disetujui!" : "Pengajuan lembur berhasil ditolak.");
      loadHistory();
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat memproses lembur."));
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start gap-3.5 border-b border-slate-200/80 pb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 mt-0.5 text-white">
          <i className="fa-solid fa-clock text-lg" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Pengajuan Lembur</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Ajukan jadwal dan laporkan jam aktual lembur operasional Anda.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-2xl bg-slate-100/70 w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("ajukan")}
          className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "ajukan"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-file-pen text-blue-600" />
          <span>Ajukan Lembur</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mulai")}
          className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "mulai"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-play text-emerald-600" />
          <span>Mulai Lembur</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("selesai")}
          className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "selesai"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-stop text-red-600" />
          <span>Selesai Lembur</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("riwayat")}
          className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "riwayat"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left text-purple-600" />
          <span>Riwayat</span>
        </button>
      </div>

      {/* TAB 1: FORM PENGAJUAN */}
      {activeTab === "ajukan" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">Form Pengajuan Lembur</h3>
            <p className="text-xs text-slate-400 mt-0.5">Rencanakan jam lembur dan tentukan penanggung jawab.</p>
          </div>

          <form onSubmit={handleAjukan} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  value={formAjukan.tanggal}
                  onChange={(e) => setFormAjukan({ ...formAjukan, tanggal: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Penanggung Jawab (SPV)</label>
                <input
                  type="text"
                  value={formAjukan.spv}
                  onChange={(e) => setFormAjukan({ ...formAjukan, spv: e.target.value })}
                  placeholder="Nama Supervisor..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Waktu Mulai (Rencana)</label>
                <input
                  type="time"
                  value={formAjukan.jamMulai}
                  onChange={(e) => setFormAjukan({ ...formAjukan, jamMulai: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Waktu Berakhir (Rencana)</label>
                <input
                  type="time"
                  value={formAjukan.jamSelesai}
                  onChange={(e) => setFormAjukan({ ...formAjukan, jamSelesai: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium cursor-pointer"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kegiatan / Alasan Lembur</label>
                <textarea
                  rows={3}
                  value={formAjukan.kegiatan}
                  onChange={(e) => setFormAjukan({ ...formAjukan, kegiatan: e.target.value })}
                  placeholder="Jelaskan secara detail pekerjaan yang akan dilakukan..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingAjukan}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs sm:text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className={`fa-solid ${submittingAjukan ? "fa-circle-notch fa-spin" : "fa-paper-plane"}`} />
                <span>{submittingAjukan ? "Mengirim..." : "Kirim Pengajuan"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MULAI LEMBUR */}
      {activeTab === "mulai" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">Absen Mulai Lembur</h3>
            <p className="text-xs text-slate-400 mt-0.5">Lakukan absen saat Anda akan memulai pekerjaan lembur.</p>
          </div>

          <form onSubmit={handleMulai} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ID Lembur (Disetujui)</label>
                <input
                  type="text"
                  value={formMulai.idLembur}
                  onChange={(e) => setFormMulai({ ...formMulai, idLembur: e.target.value })}
                  placeholder="Contoh: LMB-XXX / ID Pengajuan"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-2xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Waktu Absen Masuk</label>
                <input
                  type="text"
                  value={formMulai.jamMasuk}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 text-slate-600 font-mono shadow-2xs cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">*Otomatis mengikuti jam server saat ini.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">Foto Masuk (Bukti Mulai) *Wajib</label>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>File Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) compressImage(file, (b64) => setFormMulai((f) => ({ ...f, fotoB64: b64 })));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openCamera("mulai")}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs py-2.5 rounded-xl border border-emerald-200 transition shadow-2xs"
                  >
                    <i className="fa-solid fa-camera text-emerald-600" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                {formMulai.fotoB64 && (
                  <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full sm:w-64 shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formMulai.fotoB64}
                      alt="Preview Foto Masuk"
                      className="rounded-lg object-cover max-h-40 w-full cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalImg(formMulai.fotoB64)}
                    />
                    <button
                      type="button"
                      onClick={() => setFormMulai((f) => ({ ...f, fotoB64: "" }))}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingMulai || !formMulai.fotoB64}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs sm:text-sm transition shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className={`fa-solid ${submittingMulai ? "fa-circle-notch fa-spin" : "fa-play"}`} />
                <span>{submittingMulai ? "Mengirim..." : "Submit Mulai Lembur"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SELESAI LEMBUR */}
      {activeTab === "selesai" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">Absen Selesai Lembur</h3>
            <p className="text-xs text-slate-400 mt-0.5">Laporkan penyelesaian lembur dan bukti hasil kerja akhir.</p>
          </div>

          <form onSubmit={handleSelesai} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ID Lembur (Aktif)</label>
                <input
                  type="text"
                  value={formSelesai.idLembur}
                  onChange={(e) => setFormSelesai({ ...formSelesai, idLembur: e.target.value })}
                  placeholder="ID Pengajuan Lembur"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Waktu Absen Keluar</label>
                <input
                  type="text"
                  value={formSelesai.jamKeluar}
                  readOnly
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 text-slate-600 font-mono shadow-2xs cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">*Otomatis mengikuti jam server saat ini.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">Foto Keluar (Bukti Selesai) *Wajib</label>
                <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>File Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) compressImage(file, (b64) => setFormSelesai((f) => ({ ...f, fotoB64: b64 })));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openCamera("selesai")}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2.5 rounded-xl border border-blue-200 transition shadow-2xs"
                  >
                    <i className="fa-solid fa-camera text-blue-600" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                {formSelesai.fotoB64 && (
                  <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full sm:w-64 shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formSelesai.fotoB64}
                      alt="Preview Foto Selesai"
                      className="rounded-lg object-cover max-h-40 w-full cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalImg(formSelesai.fotoB64)}
                    />
                    <button
                      type="button"
                      onClick={() => setFormSelesai((f) => ({ ...f, fotoB64: "" }))}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Laporan Pekerjaan Akhir</label>
                <textarea
                  rows={3}
                  value={formSelesai.catatan}
                  onChange={(e) => setFormSelesai({ ...formSelesai, catatan: e.target.value })}
                  placeholder="Rangkuman hasil pekerjaan lembur yang telah diselesaikan..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingSelesai || !formSelesai.fotoB64}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs sm:text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className={`fa-solid ${submittingSelesai ? "fa-circle-notch fa-spin" : "fa-stop"}`} />
                <span>{submittingSelesai ? "Mengirim..." : "Submit Selesai Lembur"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: RIWAYAT */}
      {activeTab === "riwayat" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">Riwayat Pengajuan Lembur</h3>
              <p className="text-xs text-slate-400 mt-0.5">Daftar rekap dan status persetujuan lembur Anda.</p>
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
                  <th className="px-4 py-3">ID LEMBUR</th>
                  {isAdmin && <th className="px-4 py-3 min-w-[180px]">PEMOHON</th>}
                  <th className="px-4 py-3">TANGGAL & JAM</th>
                  <th className="px-4 py-3">KEGIATAN / DETAIL</th>
                  <th className="px-4 py-3 text-center">BUKTI FOTO</th>
                  <th className="px-4 py-3 text-center">STATUS</th>
                  {isAdmin && <th className="px-4 py-3 text-center">AKSI ADMIN</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loadingHistory ? (
                  <TableLoadingState
                    colSpan={isAdmin ? 7 : 5}
                    text="Memuat riwayat pengajuan lembur..."
                    subtext="Menyelaraskan data sesi dan status persetujuan..."
                  />
                ) : history.length > 0 ? (
                  history.map((h, idx) => {
                    const startStr = h.jamMulai ? new Date(h.jamMulai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
                    const endStr = h.jamSelesai ? new Date(h.jamSelesai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
                    const dateStr = h.tanggal ? new Date(h.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";

                    return (
                      <tr key={h.id || idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{h.id}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center flex-shrink-0 border border-blue-200 overflow-hidden shadow-2xs">
                                {h.karyawan?.fotoUrl ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={h.karyawan.fotoUrl}
                                    alt={h.karyawan.namaLengkap}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{(h.karyawan?.namaLengkap || "?").slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs truncate">
                                  {h.karyawan?.namaLengkap || "–"}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-700">
                                    {h.karyawan?.idKaryawan || h.karyawanId || "–"}
                                  </span>
                                  {h.karyawan?.jabatan && (
                                    <span className="text-slate-500 font-sans truncate">• {h.karyawan.jabatan}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900">{dateStr}</div>
                          <div className="text-[11px] text-emerald-600 font-mono mt-0.5">{startStr} - {endStr} WIB</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{h.alasan || "–"}</td>
                        <td className="px-4 py-3 text-center align-middle">
                          {h.buktiDriveId ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(h.buktiDriveId)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-camera" />
                              <span>Foto</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs uppercase tracking-wide inline-block ${
                            h.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : h.status === "REJECTED"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                            {h.status === "APPROVED" ? "Disetujui" : h.status === "REJECTED" ? "Ditolak" : "Menunggu"}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center align-middle">
                            {h.status === "PENDING" ? (
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleApprove(h.id, true)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(h.id, false)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">Selesai</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 5} className="px-4 py-12 text-center text-slate-400 italic">
                      <i className="fa-regular fa-folder-open text-3xl mb-2 block text-slate-300" />
                      Belum ada riwayat pengajuan lembur tersimpan.
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
                <i className="fa-solid fa-camera text-blue-500" />
                <span>Bukti Foto Lembur</span>
              </h3>
              <button type="button" onClick={() => setPreviewModalImg(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6 text-center bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg.startsWith("http") || previewModalImg.startsWith("data:") ? previewModalImg : `https://drive.google.com/open?id=${previewModalImg}`}
                alt="Bukti Foto"
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

      {/* Modal Kamera */}
      {cameraActiveFor && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-camera text-emerald-500" />
                <span>Ambil Foto {cameraActiveFor === "mulai" ? "Mulai Lembur" : "Selesai Lembur"}</span>
              </h3>
              <button type="button" onClick={closeCamera} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-4 bg-black flex justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full max-h-72 object-cover rounded-xl" />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={closeCamera}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={captureCamera}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-xl text-xs transition flex items-center gap-2 shadow-md"
              >
                <i className="fa-solid fa-camera" />
                <span>Ambil Foto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
