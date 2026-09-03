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
  const handleCloseCamera = () => {
    stopStream();
    setIsCameraActive(false);
  };

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
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

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
    ctx.fillRect(0, canvas.height - 38, canvas.width, 38);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`POTENSI HRIS • ${nowStr} WIB`, 12, canvas.height - 20);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px monospace";
    ctx.fillText(locStr, 12, canvas.height - 7);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onChange(dataUrl);
    stopStream();
    setIsCameraActive(false);
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
      {/* 1. Location Status Banner (Shown when active or when photo captured) */}
      {(isCameraActive || value) && (
        <div className="rounded-2xl p-2.5 text-xs border transition animate-fadeIn">
          {locLoading ? (
            <div className="flex items-center gap-2 text-slate-600">
              <i className="fa-solid fa-circle-notch animate-spin text-blue-600" />
              <span className="font-semibold">Mendeteksi koordinat lokasi GPS Anda...</span>
            </div>
          ) : locError ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-location-dot text-red-500 mt-0.5 text-sm shrink-0" />
                <span>{locError}</span>
              </div>
              <button
                type="button"
                onClick={requestLocation}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg text-[11px] shrink-0 self-start sm:self-auto"
              >
                Coba Ulang GPS
              </button>
            </div>
          ) : currentLoc ? (
            <div className="flex items-center justify-between gap-2 text-emerald-800 bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl">
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
          ) : null}
        </div>
      )}

      {/* 2. Main Box: Inactive State / Active Live Camera / Captured Photo */}
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
            <span>Foto Selfie Presensi Berhasil Diambil</span>
          </div>
          <div className="absolute bottom-3 right-3">
            <button
              type="button"
              onClick={retakePhoto}
              className="bg-slate-900/85 hover:bg-slate-900 text-white border border-white/20 font-bold px-3.5 py-1.5 rounded-xl text-xs backdrop-blur-xs flex items-center gap-1.5 shadow-lg transition"
            >
              <i className="fa-solid fa-camera-rotate text-amber-400" />
              <span>Foto Ulang</span>
            </button>
          </div>
        </div>
      ) : isCameraActive ? (
        /* State B: Live Camera Viewfinder */
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-inner min-h-[320px] flex items-center justify-center p-2">
          {cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl border border-red-500/30">
                <i className="fa-solid fa-video-slash" />
              </div>
              <h4 className="text-white font-bold text-sm">Kamera Tidak Tersedia</h4>
              <p className="text-slate-300 text-xs leading-relaxed">{cameraError}</p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition"
                >
                  Tutup
                </button>
                {hasCamera && (
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="bg-[#941A0B] hover:bg-[#781408] text-white font-bold px-4 py-1.5 rounded-xl text-xs transition inline-flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-arrows-rotate" />
                    <span>Coba Lagi</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[360px] object-cover rounded-xl ${
                  facingMode === "user" ? "-scale-x-100" : ""
                }`}
              />

              {/* Face outline guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-44 h-56 border-2 border-dashed border-white/50 rounded-full flex items-end justify-center pb-2">
                  <span className="text-[10px] text-white/80 font-bold bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                    Posisikan Wajah
                  </span>
                </div>
              </div>

              {/* Top Bar: Live indicator + Switch + Close */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-md animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  LIVE KAMERA
                </span>

                <div className="flex items-center gap-2">
                  {deviceCount > 1 && (
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full border border-white/20 backdrop-blur-xs text-xs transition"
                      title="Ganti Kamera Depan / Belakang"
                    >
                      <i className="fa-solid fa-camera-rotate" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="bg-black/60 hover:bg-black/80 text-white w-7 h-7 rounded-full border border-white/20 backdrop-blur-xs text-xs flex items-center justify-center transition"
                    title="Tutup Kamera"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Bottom Shutter Button */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={cameraLoading || !!cameraError}
                  className="bg-white hover:bg-slate-100 text-[#941A0B] font-bold px-6 py-2.5 rounded-full text-xs shadow-2xl transition flex items-center gap-2 disabled:opacity-50 active:scale-95 border-2 border-[#941A0B]"
                >
                  <i className="fa-solid fa-camera text-base" />
                  <span>{t.shutter}</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        /* State C: Inactive / Prompt to Open Camera (Step 2) */
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
              {disabled
                ? disabledMessage
                : t.inactiveDesc}
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

      <p className="text-[11px] text-slate-500 leading-tight">{t.note}</p>
    </div>
  );
}
