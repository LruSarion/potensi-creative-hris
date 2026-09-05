"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIDEO_MAX_SEC = 30;
const PHOTO_MAX_DIM = 1080;

type Facing = "user" | "environment";

/**
 * Camera capture input for photo OR video evidence.
 *
 * Opens a live camera modal (getUserMedia) with:
 * - front/back toggle + "choose from file/gallery" option,
 * - photo snapshot via canvas (max 1080px, JPEG 0.6),
 * - video recording via MediaRecorder (auto-stop 30s).
 * Falls back to a plain file input when the camera is unavailable/denied.
 *
 * The resulting data URL is written back via `onChange` — same props API
 * as before, so existing callers need no changes.
 */
export default function CameraCapture({
  value,
  onChange,
  label,
  compact,
  mode = "photo",
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  compact?: boolean;
  mode?: "photo" | "video";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [noCamera, setNoCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);

  const isVideo = mode === "video";
  const accept = isVideo ? "video/*" : "image/*";

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    setRecording(false);
    setRecSec(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopStream();
    setCameraOpen(false);
  }, [stopStream]);

  async function startStream(nextFacing: Facing) {
    stopStream();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: isVideo ? true : false,
      });
      streamRef.current = stream;
      // Tunggu <video> terpasang sebelum set srcObject
      requestAnimationFrame(() => {
        if (videoRef.current) {
          (videoRef.current as HTMLVideoElement).srcObject = stream;
        }
      });
      setFacing(nextFacing);
      setNoCamera(false);
    } catch {
      setNoCamera(true);
      setError(
        "Tidak dapat mengakses kamera (izin ditolak / tidak ada kamera / bukan HTTPS). Silakan pilih dari file."
      );
    }
  }

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setNoCamera(true);
      setError("Perangkat/browser tidak mendukung kamera langsung. Silakan pilih dari file.");
      setCameraOpen(true);
      return;
    }
    setCameraOpen(true);
    await startStream(facing);
  }

  async function toggleFacing() {
    await startStream(facing === "user" ? "environment" : "user");
  }

  // Bersihkan stream saat unmount
  useEffect(() => () => stopStream(), [stopStream]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > height && width > PHOTO_MAX_DIM) {
      height = Math.round((height * PHOTO_MAX_DIM) / width);
      width = PHOTO_MAX_DIM;
    } else if (height > width && height > PHOTO_MAX_DIM) {
      width = Math.round((width * PHOTO_MAX_DIM) / height);
      height = PHOTO_MAX_DIM;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Bukti lapangan: orientasi asli (tanpa mirror)
    ctx.drawImage(video, 0, 0, width, height);
    onChange(canvas.toDataURL("image/jpeg", 0.6));
    closeCamera();
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("Perekaman video tidak didukung di perangkat ini. Silakan pilih dari file.");
      return;
    }
    // Pilih MIME yang didukung browser — prioritaskan mp4 agar hasil
    // rekaman bisa diputar di semua browser/HP (Safari tidak dukung webm).
    const candidates = [
      "video/mp4",
      "video/mp4;codecs=avc1",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mime = candidates.find((c) => {
      try { return MediaRecorder.isTypeSupported(c); } catch { return false; }
    });
    try {
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      // Catat tipe aktual agar Blob + data URL punya MIME yang benar.
      // (Tipe salah = video tidak bisa diputar.)
      const actualType = rec.mimeType || mime || "";
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        if (chunksRef.current.length === 0) {
          setError("Rekaman kosong, tidak ada data tersimpan.");
          return;
        }
        const blob = actualType
          ? new Blob(chunksRef.current, { type: actualType })
          : new Blob(chunksRef.current);
        const reader = new FileReader();
        reader.onload = () => {
          onChange(String(reader.result));
          closeCamera();
        };
        reader.onerror = () => setError("Gagal membaca hasil rekaman.");
        reader.readAsDataURL(blob);
      };
      rec.start(250);
      recorderRef.current = rec;
      setRecording(true);
      setRecSec(0);
      timerRef.current = setInterval(() => {
        setRecSec((s) => {
          if (s + 1 >= VIDEO_MAX_SEC) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Perekaman video tidak didukung di perangkat ini. Silakan pilih dari file.");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
  }

  function handleFile(file: File | null | undefined) {
    setError("");
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideoFile = file.type.startsWith("video/");
    if (mode === "photo" && !isImage) {
      setError("Pilih file gambar dari kamera / galeri.");
      return;
    }
    if (mode === "video" && !isVideoFile) {
      setError("Pilih file video dari kamera / galeri.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
    };
    reader.onerror = () => setError(isVideo ? "Gagal membaca video." : "Gagal membaca gambar.");
    reader.readAsDataURL(file);
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCamera}
          className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} ${isVideo ? "bg-violet-500 hover:bg-violet-600" : "bg-amber-500 hover:bg-amber-600"} text-white font-bold rounded-lg transition flex items-center gap-1`}
        >
          <i className={`fa-solid ${isVideo ? "fa-video" : "fa-camera"}`} />
          {label ?? (isVideo ? "🎥 Ambil Video" : "📷 Ambil Foto")}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
          >
            Hapus
          </button>
        )}
      </div>

      {value ? (
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className={`relative block ${compact ? "h-16 w-16" : "h-24 w-24"} cursor-zoom-in group`}
          title="Klik untuk pratinjau layar penuh"
        >
          {isVideo ? (
            <video src={value} preload="metadata" playsInline className="w-full h-full object-cover rounded-lg border border-slate-200 pointer-events-none" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Bukti foto" className="w-full h-full object-cover rounded-lg border border-slate-200" />
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/30 transition">
            <i className="fa-solid fa-expand text-white text-sm opacity-0 group-hover:opacity-100 transition drop-shadow" />
          </span>
          {isVideo && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                <i className="fa-solid fa-play text-white text-xs ml-0.5" />
              </span>
            </span>
          )}
        </button>
      ) : (
        !compact && (
          <p className="text-[10px] text-slate-400">
            Tombol ini membuka kamera secara langsung — bisa kamera depan/belakang, atau pilih dari file — tanpa upload ke server.
          </p>
        )
      )}

      {error && !cameraOpen && <p className="text-[10px] text-red-600">{error}</p>}

      {/* Lightbox pratinjau layar penuh (ala checkin streamer dashboard) */}
      {lightbox && value && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white pb-2 px-1">
              <span className="text-sm font-bold">
                {isVideo ? "Pratinjau Video Bukti" : "Pratinjau Foto Bukti"}
              </span>
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="text-white hover:text-red-400 p-1 rounded-lg transition text-xl cursor-pointer"
                aria-label="Tutup pratinjau"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="relative w-full max-h-[80vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              {isVideo ? (
                <video
                  src={value}
                  controls
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value}
                  alt="Pratinjau bukti foto"
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                />
              )}
            </div>
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal kamera langsung */}
      {cameraOpen && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col">
          <div className="flex justify-between items-center p-5 bg-black border-b border-slate-800">
            <h3 className="text-white font-bold text-lg">
              <i className={`fa-solid ${isVideo ? "fa-video" : "fa-camera"} text-amber-500 mr-2`} />
              {isVideo ? "Rekam Video Bukti" : "Ambil Foto Bukti"}
            </h3>
            <button type="button" onClick={closeCamera} className="text-slate-300 hover:text-red-500 transition" aria-label="Tutup kamera">
              <i className="fa-solid fa-xmark text-2xl" />
            </button>
          </div>

          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden px-4 py-4">
            {!noCamera ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-lg h-auto rounded-xl shadow-2xl object-cover border-2 border-slate-800" />
                {recording && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    REC {String(Math.floor(recSec / 60)).padStart(2, "0")}:{String(recSec % 60).padStart(2, "0")} / 00:{VIDEO_MAX_SEC}
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-300 text-sm text-center px-6">
                Kamera tidak tersedia — silakan pilih dari file di bawah.
              </p>
            )}
          </div>

          {error && (
            <p className="bg-black text-red-400 text-xs text-center px-6 pb-2">{error}</p>
          )}

          <div className="p-5 bg-black flex items-center justify-center gap-3 pb-10 flex-wrap">
            {!noCamera && (
              <button
                type="button"
                onClick={toggleFacing}
                className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition flex items-center justify-center"
                title={facing === "user" ? "Ganti ke kamera belakang" : "Ganti ke kamera depan"}
              >
                <i className="fa-solid fa-rotate" />
              </button>
            )}

            {!noCamera && !isVideo && (
              <button
                type="button"
                onClick={takePhoto}
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-400 active:scale-95 transition shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center"
                aria-label="Ambil foto"
              >
                <div className="w-16 h-16 rounded-full border-2 border-slate-200" />
              </button>
            )}

            {!noCamera && isVideo && !recording && (
              <button
                type="button"
                onClick={startRecording}
                className="w-20 h-20 bg-red-600 rounded-full border-4 border-red-300 active:scale-95 transition shadow-[0_0_15px_rgba(255,0,0,0.5)] flex items-center justify-center"
                aria-label="Mulai rekam"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
            )}

            {!noCamera && isVideo && recording && (
              <button
                type="button"
                onClick={stopRecording}
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-400 active:scale-95 transition flex items-center justify-center"
                aria-label="Berhenti rekam"
              >
                <div className="w-8 h-8 rounded-md bg-red-600" />
              </button>
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-12 px-4 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition flex items-center gap-2"
            >
              <i className="fa-solid fa-folder-open" />
              Pilih dari File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                if (e.target.files?.[0]) closeCamera();
              }}
              className="hidden"
              aria-label={label ?? (isVideo ? "Pilih video dari file" : "Pilih foto dari file")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
