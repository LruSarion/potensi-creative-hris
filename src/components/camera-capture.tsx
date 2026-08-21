"use client";

import { useRef, useState } from "react";

/**
 * Camera capture input for photo evidence. Uses the device camera directly
 * (mobile: capture="environment" opens the rear camera) and reads the image as
 * a data URL — NO file upload to a server. The resulting data URL is written
 * back to the caller via `onChange`, stored in the same photoUrl field.
 *
 * Mobile-first: on phones it launches the camera; on desktop it opens a file
 * picker. Optionally accepts an `existing` URL (Drive link etc.) as fallback.
 */
export default function CameraCapture({
  value,
  onChange,
  label,
  compact,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function handleFile(file: File | null | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar dari kamera / galeri.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
    };
    reader.onerror = () => setError("Gagal membaca gambar.");
    reader.readAsDataURL(file);
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition flex items-center gap-1`}
        >
          <i className="fa-solid fa-camera" />
          {label ?? "📷 Ambil Foto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
          aria-label={label ?? "Ambil foto via kamera"}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Bukti foto"
            className="w-full h-full object-cover rounded-lg border border-slate-200"
          />
        </div>
      ) : (
        !compact && (
          <p className="text-[10px] text-slate-400">
            Tombol ini membuka kamera ponsel untuk mengambil foto secara langsung — tanpa upload file.
          </p>
        )
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
