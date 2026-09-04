"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Audio capture input for voice answers (LMS AUDIO questions). Records from the
 * mic via MediaRecorder, or falls back to an audio file picker on desktops where
 * mic access is unavailable. Reads the audio as a data URL — no server upload;
 * the data URL is written back to the caller via `onChange` (same pattern as
 * CameraCapture).
 */

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB — keep API payloads small
const MAX_RECORD_SECONDS = 60;

export default function AudioCapture({
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsDataURL(blob);
    });
  }

  function handleFile(file: File | null | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Pilih file audio (rekaman suara).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Rekaman terlalu panjang (maksimal ±1 menit / 1.5 MB).");
      return;
    }
    blobToDataUrl(file)
      .then((dataUrl) => onChange(dataUrl))
      .catch(() => setError("Gagal membaca audio."));
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      // Desktop without mic access — fall back to the file picker.
      inputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > MAX_BYTES) {
          setError("Rekaman terlalu panjang (maksimal ±1 menit / 1.5 MB).");
          return;
        }
        try {
          onChange(await blobToDataUrl(blob));
        } catch {
          setError("Gagal menyimpan rekaman.");
        }
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            stopRecording();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      inputRef.current?.click();
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center gap-1.5 animate-pulse`}
          >
            <i className="fa-solid fa-stop" />
            <span>Stop ({recordSeconds}s / {MAX_RECORD_SECONDS}s)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition flex items-center gap-1.5`}
          >
            <i className="fa-solid fa-microphone" />
            {label ?? "🎙️ Rekam Jawaban"}
          </button>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"} bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition flex items-center gap-1.5 border border-slate-200`}
        >
          <i className="fa-solid fa-file-audio" />
          <span>Pilih File</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
          aria-label={label ?? "Pilih rekaman audio"}
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
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={value} controls className="w-full max-w-xs h-8" />
      ) : (
        !compact && (
          <p className="text-[10px] text-slate-400">
            Rekam jawaban dengan suara (maksimal 1 menit) — atau pilih file audio dari galeri.
          </p>
        )
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}