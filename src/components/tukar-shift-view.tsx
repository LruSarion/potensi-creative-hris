"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

type MainTab = "streamer" | "ots" | "khusus";
type SubTab = "formulir" | "approval";

interface SwapRow {
  id: string;
  id_jadwal: string;
  platform: string;
  streamer_awal: string;
  streamer_pengganti: string;
  ots_awal: string;
  ots_pengganti: string;
  alasan: string;
  lampiran: string;
  status: "MENUNGGU" | "DISETUJUI" | "DITOLAK";
  rawStatus: string;
  tanggal: string;
  createdAt: string;
  tipeRole: "STREAMER" | "OTS";
}

export function TukarShiftView() {
  const { data: session } = useSession();
  const { showAlert, showConfirm } = useAlert();

  const userRole = (session?.user?.role || "").toUpperCase();
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isSupervisor = userRole === "ADMIN_OPERASIONAL" || userRole === "OPERATION" || isSuperAdmin;
  const isStreamer = userRole === "STREAMER";
  const isOTS = userRole === "STAFF" || userRole === "OTS";
  const canApprove = isSupervisor;

  // Tabs state
  const [mainTab, setMainTab] = useState<MainTab>("streamer");
  const [subTab, setSubTab] = useState<SubTab>("formulir");

  // Form references state
  const [referensiJadwal, setReferensiJadwal] = useState<string[]>([]);
  const [helperHost, setHelperHost] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form Streamer State
  const [strJadwal, setStrJadwal] = useState("");
  const [strPengganti, setStrPengganti] = useState("");
  const [strAlasan, setStrAlasan] = useState("");
  const [strLampiranB64, setStrLampiranB64] = useState("");
  const [strCekStatus, setStrCekStatus] = useState<{
    tested: boolean;
    loading: boolean;
    ok: boolean;
    message: string;
  }>({ tested: false, loading: false, ok: false, message: "" });
  const [strSubmitting, setStrSubmitting] = useState(false);

  // Form OTS State
  const [otsJadwal, setOtsJadwal] = useState("");
  const [otsPengganti, setOtsPengganti] = useState("");
  const [otsAlasan, setOtsAlasan] = useState("");
  const [otsLampiranB64, setOtsLampiranB64] = useState("");
  const [otsSubmitting, setOtsSubmitting] = useState(false);

  // Form Khusus (Super Admin) State
  const [khsJadwal, setKhsJadwal] = useState("");
  const [khsPengganti, setKhsPengganti] = useState("");
  const [khsAlasan, setKhsAlasan] = useState("");
  const [khsLampiranB64, setKhsLampiranB64] = useState("");
  const [khsSubmitting, setKhsSubmitting] = useState(false);

  // Swaps list & Approval State
  const [swapList, setSwapList] = useState<SwapRow[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const [pageStreamer, setPageStreamer] = useState(1);
  const [pageOts, setPageOts] = useState(1);
  const perPage = 15;

  // Modals state
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [cameraActiveFor, setCameraActiveFor] = useState<"str" | "ots" | "khs" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Set default tabs based on role
  useEffect(() => {
    if (isOTS && !isStreamer && !canApprove) {
      setMainTab("ots");
    } else {
      setMainTab("streamer");
    }

    if (canApprove && !isStreamer && !isOTS) {
      setSubTab("approval");
    } else {
      setSubTab("formulir");
    }
  }, [userRole, isOTS, isStreamer, canApprove]);

  // Guard: streamers only get the STREAMER tab — snap back if state drifts
  useEffect(() => {
    if (isStreamer && mainTab === "ots") setMainTab("streamer");
  }, [isStreamer, mainTab]);

  // Load initial form data & swaps
  useEffect(() => {
    loadFormData();
    loadSwaps();
  }, []);

  async function loadFormData() {
    try {
      setLoadingInitial(true);
      const json = await fetchJson<{ REFERENSI_JADWAL?: string[]; HELPER_HOST?: string[] }>(
        "/api/tukar-shift?view=form_data"
      );
      if (json.REFERENSI_JADWAL) {
        setReferensiJadwal(json.REFERENSI_JADWAL);
      }
      if (json.HELPER_HOST) {
        setHelperHost(json.HELPER_HOST);
      }
    } catch (err) {
      console.error("Gagal memuat referensi tukar shift:", err);
    } finally {
      setLoadingInitial(false);
    }
  }

  async function loadSwaps() {
    try {
      setLoadingSwaps(true);
      const data = await fetchJson<SwapRow[]>("/api/tukar-shift");
      if (Array.isArray(data)) {
        setSwapList(data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar swap:", err);
    } finally {
      setLoadingSwaps(false);
    }
  }

  // File handling helpers
  function compressImage(file: File, callback: (b64: string) => void) {
    if (file.size > 8 * 1024 * 1024) {
      showAlert("⚠️ Ukuran file melebihi 8 MB. Silakan pilih gambar yang lebih kecil.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const MAX = 1200;
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

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, target: "str" | "ots" | "khs") {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, (b64) => {
      if (target === "str") setStrLampiranB64(b64);
      if (target === "ots") setOtsLampiranB64(b64);
      if (target === "khs") setKhsLampiranB64(b64);
    });
  }

  // Camera handling
  async function openCamera(target: "str" | "ots" | "khs") {
    setCameraActiveFor(target);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      showAlert("⚠️ Tidak dapat mengakses kamera pada perangkat ini.");
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
      const b64 = canvas.toDataURL("image/jpeg", 0.8);
      if (cameraActiveFor === "str") setStrLampiranB64(b64);
      if (cameraActiveFor === "ots") setOtsLampiranB64(b64);
      if (cameraActiveFor === "khs") setKhsLampiranB64(b64);
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

  // Conflict Check (Cek Bentrok)
  async function cekBentrok() {
    if (!strJadwal) {
      showAlert("⚠️ Pilih Jadwal Anda terlebih dahulu.");
      return;
    }
    if (!strPengganti) {
      toast.warning("Pilih Host Pengganti terlebih dahulu.");
      return;
    }

    const parts = strJadwal.split(" | ").map((p) => p.trim());
    const tanggal = parts[1] || "";
    const jamMulai = parts[2] || "";
    const jamSelesai = parts[3] || "";
    const idHost = strPengganti.split(" | ")[0]?.trim() || strPengganti;

    setStrCekStatus({ tested: false, loading: true, ok: false, message: "Mengecek jadwal..." });

    try {
      const data = await sendJson<{ status: string; message?: string }>("/api/tukar-shift?action=cek_bentrok", "POST", {
        action: "cekBentrok",
        Tanggal: tanggal,
        ID_Host: idHost,
        Jam_Mulai: jamMulai,
        Jam_Selesai: jamSelesai,
      });
      if (data.status === "success") {
        setStrCekStatus({ tested: true, loading: false, ok: true, message: data.message ?? "" });
      } else {
        setStrCekStatus({ tested: true, loading: false, ok: false, message: data.message || "Jadwal pengganti BENTROK." });
      }
    } catch {
      setStrCekStatus({ tested: true, loading: false, ok: false, message: "Gagal terhubung ke server untuk cek bentrok." });
    }
  }

  // Submit Streamer Form
  async function handleSubmitStreamer() {
    if (!strJadwal || !strPengganti || !strAlasan || !strLampiranB64 || !strCekStatus.ok) {
      return;
    }

    const parts = strJadwal.split(" | ").map((p) => p.trim());
    const idJadwal = parts[0] || "";
    const tanggal = parts[1] || "";
    const idPengganti = strPengganti.split(" | ")[0]?.trim() || strPengganti;

    setStrSubmitting(true);
    try {
      await sendJson("/api/tukar-shift", "POST", {
        TIPE_ROLE: "STREAMER",
        ID_JADWAL: idJadwal,
        TANGGAL_JADWAL: tanggal,
        ID_PENGGANTI: idPengganti,
        ALASAN: strAlasan,
        FOTO_LAMPIRAN_B64: strLampiranB64,
      });
      toast.success(`Pengajuan Tukar Shift berhasil dikirim!\n\nID Jadwal: ${idJadwal}\nPengganti: ${strPengganti}`);
      setStrJadwal("");
      setStrPengganti("");
      setStrAlasan("");
      setStrLampiranB64("");
      setStrCekStatus({ tested: false, loading: false, ok: false, message: "" });
      loadSwaps();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengirim pengajuan tukar shift"));
    } finally {
      setStrSubmitting(false);
    }
  }

  // Submit OTS Form
  async function handleSubmitOTS() {
    if (!otsJadwal || !otsPengganti || !otsAlasan || !otsLampiranB64) {
      return;
    }

    const parts = otsJadwal.split(" | ").map((p) => p.trim());
    const idJadwal = parts[0] || "";
    const tanggal = parts[1] || "";
    const idPengganti = otsPengganti.split(" | ")[0]?.trim() || otsPengganti;

    setOtsSubmitting(true);
    try {
      await sendJson("/api/tukar-shift", "POST", {
        TIPE_ROLE: "OTS",
        ID_JADWAL: idJadwal,
        TANGGAL_JADWAL: tanggal,
        ID_PENGGANTI: idPengganti,
        ALASAN: otsAlasan,
        FOTO_LAMPIRAN_B64: otsLampiranB64,
      });
      toast.success(`Pengajuan Tukar Shift OTS berhasil dikirim!\n\nID Jadwal: ${idJadwal}\nPengganti: ${otsPengganti}`);
      setOtsJadwal("");
      setOtsPengganti("");
      setOtsAlasan("");
      setOtsLampiranB64("");
      loadSwaps();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengirim pengajuan tukar shift"));
    } finally {
      setOtsSubmitting(false);
    }
  }

  // Submit Khusus (Super Admin Override)
  async function handleSubmitKhusus() {
    if (!khsJadwal || !khsPengganti || !khsAlasan || !khsLampiranB64) {
      toast.warning("Lengkapi semua field dan lampiran.");
      return;
    }

    const confirmed = await showConfirm("⚠️ Tindakan ini LANGSUNG TERSIMPAN dan mengubah jadwal tanpa persetujuan.\nYakin melanjutkan?");
    if (!confirmed) {
      return;
    }

    const parts = khsJadwal.split(" | ").map((p) => p.trim());
    const idJadwal = parts[0] || "";
    const tanggal = parts[1] || "";
    const idPengganti = khsPengganti.split(" | ")[0]?.trim() || khsPengganti;

    setKhsSubmitting(true);
    try {
      await sendJson("/api/tukar-shift", "POST", {
        TIPE_ROLE: "KHUSUS",
        ID_JADWAL: idJadwal,
        TANGGAL_JADWAL: tanggal,
        ID_PENGGANTI: idPengganti,
        ALASAN: khsAlasan,
        FOTO_LAMPIRAN_B64: khsLampiranB64,
      });
      toast.success("Jadwal berhasil diperbarui secara instan oleh Super Admin!");
      setKhsJadwal("");
      setKhsPengganti("");
      setKhsAlasan("");
      setKhsLampiranB64("");
      loadSwaps();
      loadFormData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal memperbarui jadwal"));
    } finally {
      setKhsSubmitting(false);
    }
  }

  // Approval actions (Setuju / Tolak)
  async function handleAksiApproval(id: string, setuju: boolean) {
    const actionText = setuju ? "MENYETUJUI" : "MENOLAK";
    const confirmed = await showConfirm(`Yakin ingin ${actionText} pengajuan tukar shift ini?`);
    if (!confirmed) return;

    try {
      await sendJson(`/api/tukar-shift?id=${id}&approve=${setuju}`, "PATCH");
      toast.success(`Pengajuan tukar shift berhasil di-${setuju ? "setujui" : "tolak"}!`);
      loadSwaps();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal memproses persetujuan tukar shift"));
    }
  }

  // Filtered swap lists for tables
  const streamerSwaps = useMemo(() => swapList.filter((s) => s.tipeRole === "STREAMER"), [swapList]);
  const otsSwaps = useMemo(() => swapList.filter((s) => s.tipeRole === "OTS"), [swapList]);

  // Validation logic
  const isStrValid = Boolean(
    strJadwal && strPengganti && strAlasan && strLampiranB64 && strCekStatus.ok
  );
  const isOtsValid = Boolean(otsJadwal && otsPengganti && otsAlasan && otsLampiranB64);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* ======================================================= */}
      {/* LAYER 1: MAIN TAB BAR                                   */}
      {/* ======================================================= */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1.5 rounded-2xl bg-slate-200/70 w-full sm:w-fit border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setMainTab("streamer");
            if (subTab === "formulir" && !isStreamer && !isSuperAdmin) setSubTab("approval");
          }}
          className={`whitespace-nowrap py-2 px-5 sm:px-8 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center gap-2 ${
            mainTab === "streamer"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-transparent text-slate-600 hover:bg-white/70"
          }`}
        >
          <i className="fa-solid fa-video" />
          <span>STREAMER</span>
        </button>

        {!isStreamer && (
          <button
            type="button"
            onClick={() => {
              setMainTab("ots");
              if (subTab === "formulir" && !isOTS && !isSuperAdmin) setSubTab("approval");
            }}
            className={`whitespace-nowrap py-2 px-5 sm:px-8 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center gap-2 ${
              mainTab === "ots"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-transparent text-slate-600 hover:bg-white/70"
            }`}
          >
            <i className="fa-solid fa-headset" />
            <span>OTS</span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setMainTab("khusus")}
            className={`whitespace-nowrap py-2 px-5 sm:px-8 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center gap-2 ${
              mainTab === "khusus"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-transparent text-slate-600 hover:bg-white/70"
            }`}
          >
            <i className="fa-solid fa-shield-halved" />
            <span>KHUSUS</span>
          </button>
        )}
      </div>

      {/* ======================================================= */}
      {/* LAYER 2: SUB TAB BAR                                    */}
      {/* ======================================================= */}
      {mainTab !== "khusus" && (
        <div className="flex overflow-x-auto no-scrollbar gap-2 w-full">
          <button
            type="button"
            onClick={() => setSubTab("formulir")}
            className={`whitespace-nowrap py-2 px-5 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-150 flex items-center gap-2 ${
              subTab === "formulir"
                ? mainTab === "ots"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <i className="fa-regular fa-file-lines" />
            <span>Formulir</span>
          </button>

          {(canApprove || isStreamer || isOTS) && (
            <button
              type="button"
              onClick={() => setSubTab("approval")}
              className={`whitespace-nowrap py-2 px-5 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-150 flex items-center gap-2 ${
                subTab === "approval"
                  ? mainTab === "ots"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <i className={`fa-regular ${canApprove ? "fa-square-check" : "fa-list"}`} />
              <span>{canApprove ? "Approval" : "List"}</span>
            </button>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* PANEL 1: STREAMER > FORMULIR                            */}
      {/* ======================================================= */}
      {mainTab === "streamer" && subTab === "formulir" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-6">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <i className="fa-solid fa-video text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Formulir Tukar Shift — Streamer</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lengkapi semua field (termasuk lampiran & cek bentrok) untuk mengaktifkan tombol kirim.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6 pt-0 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Pilih Jadwal */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Jadwal <span className="text-red-500">*</span>
                </label>
                <select
                  value={strJadwal}
                  onChange={(e) => {
                    setStrJadwal(e.target.value);
                    setStrCekStatus({ tested: false, loading: false, ok: false, message: "" });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih ID Jadwal Aktif Anda —</option>
                  {referensiJadwal.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-blue-400" />
                  <span>Hanya menampilkan jadwal aktif milik Anda (atau semua jadwal jika Super Admin).</span>
                </p>
              </div>

              {/* Host Pengganti */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Host Pengganti <span className="text-red-500">*</span>
                </label>
                <select
                  value={strPengganti}
                  onChange={(e) => {
                    setStrPengganti(e.target.value);
                    setStrCekStatus({ tested: false, loading: false, ok: false, message: "" });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Rekan Pengganti —</option>
                  {helperHost.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>

                {/* Tombol Cek Bentrok */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={cekBentrok}
                    disabled={strCekStatus.loading}
                    className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs py-2 px-4 rounded-xl border border-amber-300 transition active:scale-95 shadow-2xs disabled:opacity-50"
                  >
                    <i className={`fa-solid ${strCekStatus.loading ? "fa-circle-notch fa-spin" : "fa-magnifying-glass-location"}`} />
                    <span>{strCekStatus.loading ? "Mengecek..." : "Cek Jadwal Pengganti"}</span>
                  </button>
                </div>

                {/* Hasil Cek Bentrok */}
                {strCekStatus.tested && (
                  <div className={`mt-2.5 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    strCekStatus.ok
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}>
                    <i className={`fa-solid ${strCekStatus.ok ? "fa-circle-check text-emerald-600" : "fa-circle-xmark text-red-600"}`} />
                    <span>{strCekStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Alasan */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alasan Pergantian <span className="text-red-500">*</span>
                </label>
                <select
                  value={strAlasan}
                  onChange={(e) => setStrAlasan(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Alasan —</option>
                  <option value="Kondisi medis darurat">Kondisi medis darurat</option>
                  <option value="Urusan keluarga esensial">Urusan keluarga esensial</option>
                  <option value="Urusan akademik / legal">Urusan akademik / legal</option>
                  <option value="Kendala teknis perjalanan">Kendala teknis perjalanan</option>
                </select>
              </div>

              {/* Lampiran Bukti */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  <span>Lampiran Bukti</span>
                  <span className="text-red-500 ml-1">*</span>
                  <span className="ml-2 bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">WAJIB</span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>File Galeri</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileInput(e, "str")}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openCamera("str")}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2.5 rounded-xl border border-blue-200 transition shadow-2xs"
                  >
                    <i className="fa-solid fa-camera text-blue-600" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                {/* Preview Lampiran */}
                {strLampiranB64 && (
                  <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full sm:w-64 shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={strLampiranB64}
                      alt="Preview Lampiran"
                      className="rounded-lg object-cover max-h-40 w-full cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalImg(strLampiranB64)}
                    />
                    <button
                      type="button"
                      onClick={() => setStrLampiranB64("")}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                      title="Hapus Lampiran"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <i className="fa-solid fa-triangle-exclamation text-amber-500" />
                  <span>Lampiran berupa foto percakapan/bukti kesepakatan wajib disertakan.</span>
                </p>
              </div>
            </div>

            {/* Tombol Submit */}
            <div className="border-t border-slate-100 pt-5 flex justify-end">
              <button
                type="button"
                disabled={!isStrValid || strSubmitting}
                onClick={handleSubmitStreamer}
                className={`inline-flex items-center gap-2 font-bold text-xs sm:text-sm py-2.5 px-6 rounded-xl transition-all shadow-md ${
                  isStrValid && !strSubmitting
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95 shadow-blue-500/20"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                }`}
              >
                <i className={`fa-solid ${
                  strSubmitting
                    ? "fa-circle-notch fa-spin"
                    : !strLampiranB64
                    ? "fa-lock"
                    : !strJadwal
                    ? "fa-lock"
                    : !strPengganti
                    ? "fa-lock"
                    : !strCekStatus.ok
                    ? "fa-magnifying-glass-location"
                    : "fa-paper-plane"
                }`} />
                <span>
                  {strSubmitting
                    ? "Mengirim..."
                    : !strLampiranB64
                    ? "Tambahkan Lampiran"
                    : !strJadwal
                    ? "Pilih Jadwal"
                    : !strPengganti
                    ? "Pilih Pengganti"
                    : !strAlasan
                    ? "Pilih Alasan"
                    : !strCekStatus.ok
                    ? "Lakukan Cek Jadwal"
                    : "KIRIM PENGAJUAN"}
                </span>
              </button>
            </div>
          </div>

          {/* ======================================================= */}
          {/* KOTAK PROSEDUR PERTUKARAN                               */}
          {/* ======================================================= */}
          <div className="mx-5 sm:mx-6 mb-6 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-xl text-white">
            <div className="px-5 py-3.5 bg-red-600 flex items-center gap-2.5 font-bold text-xs sm:text-sm tracking-wide uppercase">
              <i className="fa-solid fa-triangle-exclamation text-white" />
              <span>PROSEDUR PERTUKARAN (WAJIB)</span>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                Setiap pertukaran jadwal yang dilakukan <span className="text-red-400 font-bold">tanpa mengikuti alur di bawah ini</span> dianggap <span className="text-red-400 font-bold">TIDAK SAH</span>.
              </p>
              <ol className="space-y-3.5">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mt-0.5">1</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-tight">Mencari Pengganti Mandiri</p>
                    <p className="text-slate-400 text-xs mt-0.5">Host yang berhalangan wajib mencari Host pengganti sendiri dari daftar Host agensi yang sedang <em>off</em> pada jam tersebut.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mt-0.5">2</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-tight">Kesepakatan Dua Belah Pihak</p>
                    <p className="text-slate-400 text-xs mt-0.5">Host yang bersangkutan dan Host pengganti harus mencapai <strong className="text-slate-200">kesepakatan tertulis</strong> (via chat).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center mt-0.5">3</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-tight">Pengajuan ke Management</p>
                    <p className="text-slate-400 text-xs mt-0.5">Host wajib mengajukan format <strong className="text-amber-400">maksimal 6 jam sebelum sesi dimulai</strong> (kecuali kondisi darurat medis/kecelakaan).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center mt-0.5">4</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-tight">Approval SPV (Raihan)</p>
                    <p className="text-slate-400 text-xs mt-0.5">Pertukaran baru dianggap sah jika sudah mendapat persetujuan <strong className="text-emerald-400">&quot;APPROVED&quot;</strong> dari SPV (Raihan).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center mt-0.5">5</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-bold leading-tight">Notifikasi ke OTS</p>
                    <p className="text-slate-400 text-xs mt-0.5">Setelah disetujui, Host yang bersangkutan wajib memastikan OTS yang bertugas pada shift tersebut telah <strong className="text-slate-200">membaca informasi pertukaran</strong>.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* PANEL 2: STREAMER > APPROVAL                            */}
      {/* ======================================================= */}
      {mainTab === "streamer" && subTab === "approval" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                <i className="fa-regular fa-square-check text-xs" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-tight">
                  {canApprove ? "Approval Tukar Shift — Streamer" : "List Pengajuan Tukar Shift Saya"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {canApprove
                    ? "Tinjau dan berikan keputusan atas pengajuan tukar shift streamer."
                    : "Pengajuan tukar shift Anda beserta statusnya."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadSwaps}
              className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition text-xs"
              title="Refresh Data"
            >
              <i className="fa-solid fa-rotate-right" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">ID JADWAL</th>
                  <th className="px-4 py-3">PLATFORM</th>
                  <th className="px-4 py-3">STREAMER AWAL</th>
                  <th className="px-4 py-3">STREAMER PENGGANTI</th>
                  <th className="px-4 py-3">ALASAN</th>
                  <th className="px-4 py-3 text-center">LAMPIRAN</th>
                  <th className="px-4 py-3 text-center">AKSI / KEPUTUSAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loadingSwaps ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-blue-500 mb-2 block" />
                      Memuat pengajuan tukar shift...
                    </td>
                  </tr>
                ) : streamerSwaps.length > 0 ? (
                  streamerSwaps
                    .slice((pageStreamer - 1) * perPage, pageStreamer * perPage)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{s.id_jadwal}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{s.platform}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">{s.streamer_awal}</td>
                        <td className="px-4 py-3 text-blue-700 font-bold">{s.streamer_pengganti}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={s.alasan}>{s.alasan}</td>
                        <td className="px-4 py-3 text-center">
                          {s.lampiran ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(s.lampiran)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-file-image" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.status === "MENUNGGU" && canApprove ? (
                            <div className="flex gap-1.5 justify-center">
                              <button
                                type="button"
                                onClick={() => handleAksiApproval(s.id, true)}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-emerald-200 transition active:scale-95"
                              >
                                <i className="fa-solid fa-check" />
                                <span>Setuju</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAksiApproval(s.id, false)}
                                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-red-200 transition active:scale-95"
                              >
                                <i className="fa-solid fa-xmark" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs inline-block ${
                              s.status === "DISETUJUI"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            }`}>
                              {s.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                      <i className="fa-solid fa-inbox text-3xl mb-2 block text-slate-300" />
                      Belum ada pengajuan tukar shift Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {streamerSwaps.length > perPage && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Menampilkan {(pageStreamer - 1) * perPage + 1}–{Math.min(pageStreamer * perPage, streamerSwaps.length)} dari {streamerSwaps.length} pengajuan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageStreamer === 1}
                  onClick={() => setPageStreamer((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs font-bold text-slate-700">{pageStreamer} / {Math.ceil(streamerSwaps.length / perPage)}</span>
                <button
                  type="button"
                  disabled={pageStreamer >= Math.ceil(streamerSwaps.length / perPage)}
                  onClick={() => setPageStreamer((p) => p + 1)}
                  className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* PANEL 3: OTS > FORMULIR                                 */}
      {/* ======================================================= */}
      {mainTab === "ots" && subTab === "formulir" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-6">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
              <i className="fa-solid fa-headset text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Formulir Tukar Shift — OTS</h3>
              <p className="text-xs text-slate-500 mt-0.5">Lengkapi semua field (termasuk lampiran) untuk mengaktifkan tombol kirim.</p>
            </div>
          </div>

          <div className="p-5 sm:p-6 pt-0 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Jadwal <span className="text-red-500">*</span>
                </label>
                <select
                  value={otsJadwal}
                  onChange={(e) => setOtsJadwal(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih ID Jadwal Aktif Anda —</option>
                  {referensiJadwal.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pengganti OTS <span className="text-red-500">*</span>
                </label>
                <select
                  value={otsPengganti}
                  onChange={(e) => setOtsPengganti(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Rekan Pengganti —</option>
                  {helperHost.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alasan Pergantian <span className="text-red-500">*</span>
                </label>
                <select
                  value={otsAlasan}
                  onChange={(e) => setOtsAlasan(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Alasan —</option>
                  <option value="Kondisi medis darurat">Kondisi medis darurat</option>
                  <option value="Urusan keluarga esensial">Urusan keluarga esensial</option>
                  <option value="Urusan akademik / legal">Urusan akademik / legal</option>
                  <option value="Kendala teknis perjalanan">Kendala teknis perjalanan</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  <span>Lampiran Bukti</span>
                  <span className="text-red-500 ml-1">*</span>
                  <span className="ml-2 bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">WAJIB</span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>File Galeri</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileInput(e, "ots")}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openCamera("ots")}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2.5 rounded-xl border border-indigo-200 transition shadow-2xs"
                  >
                    <i className="fa-solid fa-camera text-indigo-600" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                {otsLampiranB64 && (
                  <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full sm:w-64 shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={otsLampiranB64}
                      alt="Preview Lampiran"
                      className="rounded-lg object-cover max-h-40 w-full cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalImg(otsLampiranB64)}
                    />
                    <button
                      type="button"
                      onClick={() => setOtsLampiranB64("")}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                      title="Hapus Lampiran"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 flex justify-end">
              <button
                type="button"
                disabled={!isOtsValid || otsSubmitting}
                onClick={handleSubmitOTS}
                className={`inline-flex items-center gap-2 font-bold text-xs sm:text-sm py-2.5 px-6 rounded-xl transition-all shadow-md ${
                  isOtsValid && !otsSubmitting
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-indigo-500/20"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                }`}
              >
                <i className={`fa-solid ${otsSubmitting ? "fa-circle-notch fa-spin" : isOtsValid ? "fa-paper-plane" : "fa-lock"}`} />
                <span>{otsSubmitting ? "Mengirim..." : isOtsValid ? "KIRIM PENGAJUAN" : "Lengkapi Formulir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* PANEL 4: OTS > APPROVAL                                 */}
      {/* ======================================================= */}
      {mainTab === "ots" && subTab === "approval" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                <i className="fa-regular fa-square-check text-xs" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-tight">
                  {canApprove ? "Approval Tukar Shift — OTS" : "List Pengajuan Tukar Shift Saya"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {canApprove
                    ? "Tinjau dan berikan keputusan atas pengajuan tukar shift OTS."
                    : "Pengajuan tukar shift Anda beserta statusnya."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadSwaps}
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition text-xs"
              title="Refresh Data"
            >
              <i className="fa-solid fa-rotate-right" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">ID JADWAL</th>
                  <th className="px-4 py-3">PLATFORM</th>
                  <th className="px-4 py-3">OTS AWAL</th>
                  <th className="px-4 py-3">OTS PENGGANTI</th>
                  <th className="px-4 py-3">ALASAN</th>
                  <th className="px-4 py-3 text-center">LAMPIRAN</th>
                  <th className="px-4 py-3 text-center">AKSI / KEPUTUSAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loadingSwaps ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-500 mb-2 block" />
                      Memuat pengajuan tukar shift...
                    </td>
                  </tr>
                ) : otsSwaps.length > 0 ? (
                  otsSwaps
                    .slice((pageOts - 1) * perPage, pageOts * perPage)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{s.id_jadwal}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{s.platform}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">{s.ots_awal}</td>
                        <td className="px-4 py-3 text-indigo-700 font-bold">{s.ots_pengganti}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={s.alasan}>{s.alasan}</td>
                        <td className="px-4 py-3 text-center">
                          {s.lampiran ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(s.lampiran)}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold text-[11px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-file-image" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.status === "MENUNGGU" && canApprove ? (
                            <div className="flex gap-1.5 justify-center">
                              <button
                                type="button"
                                onClick={() => handleAksiApproval(s.id, true)}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-emerald-200 transition active:scale-95"
                              >
                                <i className="fa-solid fa-check" />
                                <span>Setuju</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAksiApproval(s.id, false)}
                                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-red-200 transition active:scale-95"
                              >
                                <i className="fa-solid fa-xmark" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs inline-block ${
                              s.status === "DISETUJUI"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            }`}>
                              {s.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                      <i className="fa-solid fa-inbox text-3xl mb-2 block text-slate-300" />
                      Belum ada pengajuan tukar shift Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {otsSwaps.length > perPage && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Menampilkan {(pageOts - 1) * perPage + 1}–{Math.min(pageOts * perPage, otsSwaps.length)} dari {otsSwaps.length} pengajuan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageOts === 1}
                  onClick={() => setPageOts((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs font-bold text-slate-700">{pageOts} / {Math.ceil(otsSwaps.length / perPage)}</span>
                <button
                  type="button"
                  disabled={pageOts >= Math.ceil(otsSwaps.length / perPage)}
                  onClick={() => setPageOts((p) => p + 1)}
                  className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* PANEL 5: KHUSUS (SUPER ADMIN OVERRIDE)                  */}
      {/* ======================================================= */}
      {mainTab === "khusus" && isSuperAdmin && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden space-y-6">
          <div className="px-5 sm:px-6 py-4 border-b border-amber-100 bg-amber-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
              <i className="fa-solid fa-shield-halved text-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base leading-tight">Override Tukar Shift — Akses Khusus</h3>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Ubah pemilik jadwal secara langsung tanpa alur persetujuan.</p>
            </div>
          </div>

          <div className="p-5 sm:p-6 pt-0 space-y-5">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-base mt-0.5 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-amber-900 font-medium leading-relaxed">
                Perubahan di sini bersifat <strong>instan dan langsung memperbarui database operasional</strong> tanpa konfirmasi persetujuan berjenjang.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Jadwal Target <span className="text-red-500">*</span>
                </label>
                <select
                  value={khsJadwal}
                  onChange={(e) => setKhsJadwal(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih ID Jadwal Target —</option>
                  {referensiJadwal.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tetapkan Pengganti <span className="text-red-500">*</span>
                </label>
                <select
                  value={khsPengganti}
                  onChange={(e) => setKhsPengganti(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Karyawan Pengganti —</option>
                  {helperHost.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alasan Perubahan <span className="text-red-500">*</span>
                </label>
                <select
                  value={khsAlasan}
                  onChange={(e) => setKhsAlasan(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white shadow-2xs"
                >
                  <option value="" disabled>— Pilih Alasan —</option>
                  <option value="Instruksi Manajemen / Urgensi Operasional">Instruksi Manajemen / Urgensi Operasional</option>
                  <option value="Kondisi medis darurat">Kondisi medis darurat</option>
                  <option value="Urusan keluarga esensial">Urusan keluarga esensial</option>
                  <option value="Kendala teknis perjalanan">Kendala teknis perjalanan</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  <span>Lampiran Bukti / Memo</span>
                  <span className="text-red-500 ml-1">*</span>
                  <span className="ml-2 bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">WAJIB</span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>File Galeri</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileInput(e, "khs")}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openCamera("khs")}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs py-2.5 rounded-xl border border-amber-200 transition shadow-2xs"
                  >
                    <i className="fa-solid fa-camera text-amber-600" />
                    <span>Buka Kamera</span>
                  </button>
                </div>

                {khsLampiranB64 && (
                  <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full sm:w-64 shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={khsLampiranB64}
                      alt="Preview Lampiran"
                      className="rounded-lg object-cover max-h-40 w-full cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewModalImg(khsLampiranB64)}
                    />
                    <button
                      type="button"
                      onClick={() => setKhsLampiranB64("")}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                      title="Hapus Lampiran"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 flex justify-end">
              <button
                type="button"
                disabled={khsSubmitting}
                onClick={handleSubmitKhusus}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm py-2.5 px-8 rounded-xl shadow-md transition active:scale-95 shadow-amber-500/20 disabled:opacity-50"
              >
                <i className={`fa-solid ${khsSubmitting ? "fa-circle-notch fa-spin" : "fa-floppy-disk"}`} />
                <span>{khsSubmitting ? "Menyimpan..." : "SIMPAN PERUBAHAN"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: PRATINJAU LAMPIRAN                               */}
      {/* ======================================================= */}
      {previewModalImg && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-image text-blue-500" />
                <span>Pratinjau Lampiran Bukti</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="text-slate-400 hover:text-slate-600 text-base"
              >
                ✕
              </button>
            </div>
            <div className="p-6 text-center bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg}
                alt="Lampiran Full"
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

      {/* ======================================================= */}
      {/* MODAL: KAMERA CAPTURE                                   */}
      {/* ======================================================= */}
      {cameraActiveFor && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-camera text-blue-500" />
                <span>Ambil Foto Lampiran</span>
              </h3>
              <button type="button" onClick={closeCamera} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-4 bg-black flex justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-72 object-cover rounded-xl"
              />
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl text-xs transition flex items-center gap-2 shadow-md"
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
