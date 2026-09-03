"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface BuktiGmvInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export default function BuktiGmvInput({
  value,
  onChange,
  disabled = false,
  label = "Bukti GMV (Screenshot / Foto Dashboard) *",
  required = true,
}: BuktiGmvInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check available camera devices
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevs.length > 1);
      }).catch(() => {});
    }
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  }, []);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start live camera
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setUploadError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser Anda tidak mendukung akses kamera.");
      }

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraLoading(false);

      // Attach to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      setCameraLoading(false);
      setIsCameraActive(false);
      const name = err instanceof DOMException ? err.name : "";
      let msg = "Gagal mengakses kamera.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda, atau gunakan opsi File Galeri.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "Kamera tidak ditemukan pada perangkat Anda. Silakan gunakan opsi File Galeri.";
      } else if (name === "NotReadableError") {
        msg = "Kamera sedang digunakan oleh aplikasi lain.";
      }
      setCameraError(msg);
    }
  };

  // Toggle between front and back camera
  const toggleFacingMode = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  // Capture snapshot from live camera stream
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    const MAX_DIM = 1280;
    if (width >= height && width > MAX_DIM) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else if (height > width && height > MAX_DIM) {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror if front camera
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Reset transform
    if (facingMode === "user") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Add subtle timestamp watermark
    const now = new Date();
    const timeStr = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(8, height - 28, 260, 22);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`BUKTI GMV • ${timeStr} WIB`, 14, height - 12);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    onChange(dataUrl);
    stopCamera();
  };

  // Compress and handle file upload from gallery / screenshot
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Format file tidak didukung. Harap pilih gambar JPG, PNG, atau WEBP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1280;
        if (width >= height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > width && height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onChange(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        onChange(compressedDataUrl);

        // Reset file input so re-selecting same file triggers onChange
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };
      img.onerror = () => {
        setUploadError("Gagal memproses gambar. Pastikan file tidak rusak.");
      };
    };
    reader.onerror = () => {
      setUploadError("Gagal membaca file dari perangkat.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-700">
          {label}
        </label>
        {required && (
          <span className="text-[11px] text-[#941A0B] font-semibold">
            Wajib Upload / Kamera
          </span>
        )}
      </div>

      {/* Upload & Camera Error Notice */}
      {(cameraError || uploadError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-xl flex items-start gap-2 animate-in fade-in">
          <i className="fa-solid fa-triangle-exclamation text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{cameraError || uploadError}</p>
            {cameraError && (
              <p className="text-[11px] text-red-600 mt-0.5">
                Tip: Gunakan tombol <strong>File Galeri</strong> untuk mengunggah screenshot GMV dari galeri Anda.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setUploadError(null);
            }}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Case 1: Photo is already chosen / captured */}
      {value ? (
        <div className="relative border border-emerald-200 bg-emerald-50/40 rounded-xl p-2.5 shadow-xs transition">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
              <span>Bukti GMV Terlampir</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-700 font-bold hover:bg-red-100/60 px-2.5 py-1 rounded-lg transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <i className="fa-solid fa-trash-can text-[11px]" />
              <span>Hapus / Ganti</span>
            </button>
          </div>

          <div className="relative w-full h-44 bg-slate-900/90 rounded-lg overflow-hidden flex items-center justify-center border border-slate-700/50 shadow-inner group">
            <img
              src={value}
              alt="Bukti GMV Live"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => window.open(value, "_blank")}
                className="bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
              >
                <i className="fa-solid fa-magnifying-glass-plus text-xs" />
                <span>Lihat Penuh</span>
              </button>
            </div>
          </div>
        </div>
      ) : isCameraActive ? (
        /* Case 2: Live Camera Viewfinder */
        <div className="relative border-2 border-blue-500 rounded-2xl overflow-hidden bg-slate-950 shadow-md">
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between px-2">
            <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full inline-block" />
              KAMERA AKTIF
            </span>
            <div className="flex items-center gap-1.5">
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1 rounded-lg transition border border-white/20 flex items-center gap-1"
                  title="Putar Kamera"
                >
                  <i className="fa-solid fa-camera-rotate text-xs" />
                </button>
              )}
              <button
                type="button"
                onClick={stopCamera}
                className="bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1 rounded-lg transition border border-white/20"
                title="Tutup Kamera"
              >
                ✕ Batal
              </button>
            </div>
          </div>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-56 sm:h-64 object-cover bg-black ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />

          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Arahkan ke layar dashboard / nominal GMV Anda.
            </p>
            <button
              type="button"
              onClick={captureSnapshot}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 shrink-0 active:scale-95"
            >
              <i className="fa-solid fa-circle-dot text-sm text-red-400" />
              <span>Jepret Foto</span>
            </button>
          </div>
        </div>
      ) : (
        /* Case 3: Empty State — Two Action Buttons (File Galeri / Kamera) */
        <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-4 bg-slate-50/60 transition text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-base">
            <i className="fa-solid fa-receipt" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              Lampirkan Foto Bukti GMV
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilih dari galeri screenshot HP/PC atau ambil langsung dengan kamera.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-800 py-2.5 px-3 rounded-xl text-xs font-bold border border-slate-300 transition shadow-2xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <i className="fa-solid fa-folder-open text-amber-600 text-sm" />
              <span>File Galeri</span>
            </button>
            <button
              type="button"
              onClick={startCamera}
              disabled={disabled || cameraLoading}
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 px-3 rounded-xl text-xs font-bold border border-blue-200 transition shadow-2xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {cameraLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  <span>Membuka...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-camera text-blue-600 text-sm" />
                  <span>Kamera</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
