"use client";

import { useRef, useState } from "react";

/**
 * Camera capture input for photo OR video evidence. Uses the device camera
 * directly (mobile: capture="environment" opens the rear camera) and reads the
 * media as a data URL — NO file upload to a server. The resulting data URL is
 * written back to the caller via `onChange`, stored in the same photoUrl/videoUrl
 * field.
 *
 * Mobile-first: on phones it launches the camera; on desktop it opens a file
 * picker.
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
  const [error, setError] = useState("");

  function handleFile(file: File | null | undefined) {
    setError("");
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (mode === "photo" && !isImage) {
      setError("Pilih file gambar dari kamera / galeri.");
      return;
    }
    if (mode === "video" && !isVideo) {
      setError("Pilih file video dari kamera / galeri.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
    };
    reader.onerror = () => setError(mode === "video" ? "Gagal membaca video." : "Gagal membaca gambar.");
    reader.readAsDataURL(file);
  }

  const isVideo = mode === "video";
  const accept = isVideo ? "video/*" : "image/*";

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} ${isVideo ? "bg-violet-500 hover:bg-violet-600" : "bg-amber-500 hover:bg-amber-600"} text-white font-bold rounded-lg transition flex items-center gap-1`}
        >
          <i className={`fa-solid ${isVideo ? "fa-video" : "fa-camera"}`} />
          {label ?? (isVideo ? "🎥 Ambil Video" : "📷 Ambil Foto")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture="environment"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
          aria-label={label ?? (isVideo ? "Ambil video via kamera" : "Ambil foto via kamera")}
        />
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
        <div className={compact ? "h-16 w-16" : "h-24 w-24"}>
          {isVideo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <video src={value} controls className="w-full h-full object-cover rounded-lg border border-slate-200" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Bukti foto" className="w-full h-full object-cover rounded-lg border border-slate-200" />
          )}
        </div>
      ) : (
        !compact && (
          <p className="text-[10px] text-slate-400">
            Tombol ini membuka kamera ponsel untuk mengambil {isVideo ? "video" : "foto"} secara langsung — tanpa upload file.
          </p>
        )
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
