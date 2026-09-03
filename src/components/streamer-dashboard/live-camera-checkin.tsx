"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  formattedText: string;
}

interface LiveCameraCheckinProps {
  value: string;
  onChange: (photoDataUrl: string) => void;
  onLocationChange: (location: LocationCoordinates | null) => void;
  onCameraStatusChange?: (hasCamera: boolean, errorMsg: string | null) => void;
  disabled?: boolean;
  disabledMessage?: string;
  mode?: "checkin" | "checkout" | "gmv";
}

const MODE_TEXT = {
  checkin: {
    photoAlt: "Foto Selfie Check-In",
    inactiveTitle: "Siap Mengambil Foto Masuk",
    inactiveDesc: "Klik tombol di bawah untuk mendeteksi lokasi GPS dan mengaktifkan kamera selfie perangkat Anda.",
    shutter: "Ambil Foto Presensi",
    note: "Presensi check-in wajib mengambil foto selfie secara live melalui kamera perangkat dan menyertakan koordinat lokasi GPS.",
  },
  checkout: {
    photoAlt: "Foto Selfie Check-Out",
    inactiveTitle: "Siap Mengambil Foto Keluar",
    inactiveDesc: "Klik tombol di bawah untuk mendeteksi lokasi GPS dan mengaktifkan kamera perangkat Anda sebagai bukti check-out.",
    shutter: "Ambil Foto Check-Out",
    note: "Presensi check-out wajib mengambil foto secara live melalui kamera perangkat dan menyertakan koordinat lokasi GPS.",
  },
  gmv: {
    photoAlt: "Foto Bukti GMV",
    inactiveTitle: "Siap Mengambil Bukti GMV",
    inactiveDesc: "Klik tombol di bawah untuk mendeteksi lokasi GPS dan mengaktifkan kamera perangkat Anda untuk bukti GMV.",
    shutter: "Ambil Bukti GMV",
    note: "Bukti GMV wajib diambil secara live melalui kamera perangkat dan menyertakan koordinat lokasi GPS.",
  },
} as const;

export default function LiveCameraCheckin({
  value,
  onChange,
  onLocationChange,
  onCameraStatusChange,
  disabled = false,
  disabledMessage = "Pilih jadwal siaran live terlebih dahulu untuk membuka kamera.",
  mode = "checkin",
}: LiveCameraCheckinProps) {
  const t = MODE_TEXT[mode];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera activation states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [deviceCount, setDeviceCount] = useState(1);
  const [isFlashing, setIsFlashing] = useState(false);

  // Geolocation states
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [currentLoc, setCurrentLoc] = useState<LocationCoordinates | null>(null);

  // Stop media stream tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Request GPS Geolocation
  const requestLocation = useCallback(() => {
    setLocLoading(true);
    setLocError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const err = "Perangkat Anda tidak mendukung fitur lokasi (GPS).";
      setLocError(err);
      setLocLoading(false);
      onLocationChange(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const formatted = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`;
        const data: LocationCoordinates = {
          latitude,
          longitude,
          accuracy,
          formattedText: formatted,
        };
        setCurrentLoc(data);
        setLocError(null);
        setLocLoading(false);
        onLocationChange(data);
      },
      (err) => {
        let msg = "Gagal mendeteksi lokasi GPS.";
        if (err.code === 1) {
          msg = "Akses lokasi (GPS) ditolak. Mohon aktifkan izin lokasi di browser Anda untuk melanjutkan check-in.";
        } else if (err.code === 2) {
          msg = "Lokasi tidak dapat ditentukan. Pastikan GPS/Location service aktif pada perangkat Anda.";
        } else if (err.code === 3) {
          msg = "Waktu permintaan lokasi habis (timeout). Silakan coba lagi.";
        }
        setLocError(msg);
        setLocLoading(false);
        onLocationChange(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, [onLocationChange]);

  // Start device camera
  const startCamera = useCallback(async (mode: "user" | "environment") => {
    setCameraLoading(true);
    setCameraError(null);
    stopStream();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const err = "Browser atau perangkat ini tidak mendukung akses kamera secara langsung.";
      setHasCamera(false);
      setCameraError(err);
      setCameraLoading(false);
      onCameraStatusChange?.(false, err);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setDeviceCount(videoDevices.length);

      if (videoDevices.length === 0) {
        const err = "Tidak ada kamera yang terdeteksi pada perangkat ini. Presensi check-in wajib menggunakan kamera aktif.";
        setHasCamera(false);
        setCameraError(err);
        setCameraLoading(false);
        onCameraStatusChange?.(false, err);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setHasCamera(true);
      setCameraError(null);
      setCameraLoading(false);
      onCameraStatusChange?.(true, null);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const errMsg = err instanceof Error ? err.message : "";
      let msg = "Gagal mengakses kamera.";
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "Kamera tidak terdeteksi pada perangkat ini. Presensi check-in hanya dapat dilakukan dari perangkat yang memiliki kamera.";
        setHasCamera(false);
      } else if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Izin akses kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda untuk melanjutkan check-in.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        msg = "Kamera sedang digunakan oleh aplikasi lain (seperti OBS Studio atau Zoom). Tutup aplikasi tersebut lalu coba lagi.";
      } else {
        msg = `Kamera error: ${errMsg || "Tidak dapat memulai video"}`;
      }

      setCameraError(msg);
      setCameraLoading(false);
      onCameraStatusChange?.(false, msg);
    }
  }, [stopStream, onCameraStatusChange]);

  // Click handler to open camera and request location
  const handleOpenCamera = () => {
    if (disabled) return;
    setIsCameraActive(true);
    requestLocation();
    startCamera(facingMode);
  };

  // Close camera without capturing
  const handleCloseCamera = useCallback(() => {
    stopStream();
    setIsCameraActive(false);
  }, [stopStream]);

  // Lock body scroll and listen for Escape key when fullscreen camera is active
  useEffect(() => {
    if (!isCameraActive) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseCamera();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCameraActive, handleCloseCamera]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // When disabled changes to true (e.g. user unselects schedule), reset camera
  useEffect(() => {
    if (disabled) {
      stopStream();
      setIsCameraActive(false);
    }
  }, [disabled, stopStream]);

  // Capture photo from video feed
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Haptic vibration feedback for native smartphone feel
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }

    setIsFlashing(true);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw watermark
    const nowStr = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
    const locStr = currentLoc ? currentLoc.formattedText : "GPS: Mengambil...";

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`POTENSI HRIS • ${nowStr} WIB`, 14, canvas.height - 21);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px monospace";
    ctx.fillText(locStr, 14, canvas.height - 7);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    setTimeout(() => {
      setIsFlashing(false);
      onChange(dataUrl);
      stopStream();
      setIsCameraActive(false);
    }, 120);
  };

  // Retake photo
  const retakePhoto = () => {
    onChange("");
    setIsCameraActive(true);
    requestLocation();
    startCamera(facingMode);
  };

  // Toggle front/back camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  return (
    <div className="space-y-3">
      {/* 1. Fullscreen Native Camera Modal (Active When isCameraActive is True) */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col justify-between overflow-hidden touch-none select-none animate-fadeIn">
          {/* Shutter flash effect */}
          {isFlashing && (
            <div className="absolute inset-0 z-50 bg-white opacity-90 transition-opacity duration-150" />
          )}

          {/* Background Live Video Feed (Screen Filled) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              facingMode === "user" ? "-scale-x-100" : ""
            }`}
          />

          {/* Top Vignette Gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none" />

          {/* Bottom Vignette Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

          {/* Top Bar: GPS Status + Close Button */}
          <div className="relative z-10 p-4 pt-6 sm:p-6 flex items-center justify-between pointer-events-auto">
            {/* GPS Pill Indicator */}
            <div className="max-w-[75%]">
              {locLoading ? (
                <div className="bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-xs shadow-lg">
                  <i className="fa-solid fa-circle-notch animate-spin text-blue-400 text-xs" />
                  <span className="text-[11px] font-medium truncate">Mengunci GPS...</span>
                </div>
              ) : locError ? (
                <div
                  onClick={requestLocation}
                  className="bg-red-950/80 backdrop-blur-md border border-red-500/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-red-200 shadow-lg cursor-pointer active:scale-95"
                  title="Klik untuk mencoba ulang GPS"
                >
                  <i className="fa-solid fa-triangle-exclamation text-red-400 text-xs" />
                  <span className="text-[10px] font-bold truncate">GPS Gagal (Ketuk Ulang)</span>
                </div>
              ) : currentLoc ? (
                <div className="bg-emerald-950/70 backdrop-blur-md border border-emerald-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-white shadow-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <div className="truncate leading-tight">
                    <span className="font-bold text-emerald-300 text-[10px] block">GPS Terkunci</span>
                    <span className="font-mono text-emerald-100 text-[9px] block truncate">
                      {currentLoc.latitude.toFixed(5)}, {currentLoc.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Close / X Button */}
            <button
              type="button"
              onClick={handleCloseCamera}
              className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 border border-white/20 backdrop-blur-md flex items-center justify-center text-white text-lg transition shadow-xl cursor-pointer"
              title="Tutup Kamera"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Center Viewfinder: Face Guide & Corner Reticles */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center space-y-3 max-w-xs bg-black/80 backdrop-blur-md border border-red-500/40 rounded-3xl pointer-events-auto shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl border border-red-500/30">
                  <i className="fa-solid fa-video-slash" />
                </div>
                <h4 className="text-white font-bold text-sm">Kamera Bermasalah</h4>
                <p className="text-slate-300 text-xs leading-relaxed">{cameraError}</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-4 py-1.5 rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-arrows-rotate" />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-64 h-80 sm:w-72 sm:h-96 border-2 border-dashed border-white/40 rounded-[52px] flex items-end justify-center pb-4 shadow-[0_0_80px_rgba(0,0,0,0.6)]">
                {/* Corner guide reticles */}
                <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />
                <span className="text-[11px] text-white font-bold bg-black/60 px-3.5 py-1 rounded-full backdrop-blur-md border border-white/15 shadow-lg">
                  Posisikan Wajah Anda
                </span>
              </div>
            )}
          </div>

          {/* Bottom Controls Dock: Flip Camera + Native Shutter Button + Cancel */}
          <div className="relative z-10 pb-10 sm:pb-12 px-8 flex items-center justify-between pointer-events-auto">
            {/* Flip / Switch Camera Button */}
            <div className="w-16 flex justify-start">
              {deviceCount > 1 ? (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 border border-white/20 backdrop-blur-md flex items-center justify-center text-white text-lg transition shadow-xl cursor-pointer"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <i className="fa-solid fa-camera-rotate" />
                </button>
              ) : (
                <div className="w-12 h-12" />
              )}
            </div>

            {/* Native Shutter Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraLoading || !!cameraError}
                className="w-20 h-20 rounded-full border-[5px] border-white p-1.5 flex items-center justify-center transition active:scale-90 disabled:opacity-40 shadow-2xl cursor-pointer"
                title={t.shutter}
              >
                <div className="w-full h-full bg-white rounded-full active:scale-95 transition-transform" />
              </button>
              <span className="text-[10px] text-white/90 font-bold uppercase tracking-wider drop-shadow-md">
                Ambil Foto
              </span>
            </div>

            {/* Cancel Button */}
            <div className="w-16 flex justify-end">
              <button
                type="button"
                onClick={handleCloseCamera}
                className="text-xs text-white/90 hover:text-white font-bold bg-black/60 hover:bg-black/80 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/20 transition active:scale-90 shadow-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Form Preview State: Showing Captured Photo or Button to Open Camera */}
      {value ? (
        /* State A: Photo is Captured */
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t.photoAlt}
            className="w-full max-h-[360px] object-contain rounded-2xl bg-black"
          />
          <div className="absolute top-3 left-3 bg-emerald-600/95 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
            <i className="fa-solid fa-circle-check" />
            <span>Foto Presensi Berhasil Diambil</span>
          </div>
          <div className="absolute bottom-3 right-3">
            <button
              type="button"
              onClick={retakePhoto}
              className="bg-slate-900/85 hover:bg-slate-900 text-white border border-white/20 font-bold px-3.5 py-1.5 rounded-xl text-xs backdrop-blur-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
            >
              <i className="fa-solid fa-camera-rotate text-amber-400" />
              <span>Foto Ulang</span>
            </button>
          </div>
        </div>
      ) : (
        /* State B: Prompt to Open Fullscreen Camera */
        <div
          className={`border-2 rounded-2xl p-6 sm:p-8 text-center transition flex flex-col items-center justify-center space-y-3.5 ${
            disabled
              ? "bg-slate-50 border-slate-200 text-slate-400"
              : "bg-gradient-to-b from-white to-red-50/20 border-dashed border-[#941A0B]/30 hover:border-[#941A0B]/50"
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition ${
              disabled
                ? "bg-slate-200 text-slate-400"
                : "bg-[#941A0B]/10 text-[#941A0B] shadow-inner"
            }`}
          >
            <i className="fa-solid fa-camera" />
          </div>

          <div>
            <h4
              className={`font-bold text-sm ${
                disabled ? "text-slate-500" : "text-slate-900"
              }`}
            >
              {disabled ? "Pilih Jadwal Siaran Terlebih Dahulu" : t.inactiveTitle}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              {disabled ? disabledMessage : t.inactiveDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCamera}
            disabled={disabled}
            className={`font-bold px-6 py-3 rounded-xl text-xs transition flex items-center gap-2 shadow-md ${
              disabled
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-[#941A0B] hover:bg-[#781408] text-white shadow-[#941A0B]/20 active:scale-95 cursor-pointer"
            }`}
          >
            <i className="fa-solid fa-camera" />
            <span>Buka Kamera & Ambil Gambar</span>
          </button>
        </div>
      )}

      {/* 3. Verified Location Banner in Form (When photo taken or loc detected) */}
      {currentLoc && value && (
        <div className="flex items-center justify-between gap-2 text-emerald-800 bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs shrink-0">
              <i className="fa-solid fa-location-dot" />
            </div>
            <div>
              <span className="font-bold block text-[11px] text-emerald-900">Lokasi GPS Terverifikasi</span>
              <span className="font-mono text-[10px] text-emerald-700 block">
                {currentLoc.formattedText}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={requestLocation}
            title="Refresh Lokasi GPS"
            className="text-emerald-600 hover:text-emerald-800 p-1 text-xs"
          >
            <i className="fa-solid fa-arrows-rotate" />
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-tight">{t.note}</p>
    </div>
  );
}
