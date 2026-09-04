"use client";

import React from "react";
import LiveCameraCheckin from "./live-camera-checkin";

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
  label = "Bukti GMV (Foto Kamera Langsung & GPS / Galeri) *",
  required = true,
}: BuktiGmvInputProps) {
  return (
    <div className="space-y-1 font-sans">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-bold text-slate-700">
          {label}
        </label>
        {required && (
          <span className="text-[11px] text-[#941A0B] font-semibold">
            Wajib Kamera / Galeri
          </span>
        )}
      </div>
      <LiveCameraCheckin
        value={value}
        onChange={onChange}
        mode="gmv"
        disabled={disabled}
        allowGallery={true}
      />
    </div>
  );
}
