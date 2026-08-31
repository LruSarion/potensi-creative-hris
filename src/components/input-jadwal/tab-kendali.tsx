"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";

export function TabKendali({
  kendaliConfig,
  kendaliLoading,
  loadKendaliConfig,
  showAlert,
}: TabSharedProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleToggleFitur(fitur: "LIBUR" | "SHIFT", status: "ON" | "OFF") {
    setLoadingAction(fitur);
    try {
      const res = await fetch("/api/scheduler-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-fitur", fitur, status }),
      });
      const d = await res.json();
      if (d.status === "success") {
        showAlert(
          `✅ Pengaturan ${
            fitur === "LIBUR" ? "Pengajuan Libur" : "Pengajuan Sesi Live"
          } berhasil diubah ke status ${status}!`
        );
        await loadKendaliConfig();
      } else {
        showAlert(`❌ Gagal mengubah status fitur: ${d.message || "Terjadi kesalahan"}`);
      }
    } catch {
      showAlert("⚠️ Terjadi kesalahan koneksi saat mengubah status fitur.");
    } finally {
      setLoadingAction(null);
    }
  }

  const liburStatus = kendaliConfig?.fiturLibur === "ON" ? "ON" : "OFF";
  const shiftStatus = kendaliConfig?.fiturShift === "ON" ? "ON" : "OFF";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
            <i className="fa-solid fa-toggle-on" />
          </div>
          <div>
            <h2 className="font-extrabold text-black text-base">Kendali Akses Formulir Streamer</h2>
            <p className="text-xs text-slate-500">
              Atur hak akses pengajuan libur dan request sesi live di portal streamer secara langsung
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Pengajuan Libur */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Formulir Pengajuan Libur</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kontrol visibilitas form permohonan libur bagi streamer dedicated & on-call
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  liburStatus === "ON"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {liburStatus === "ON" ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "LIBUR"}
                onClick={() => handleToggleFitur("LIBUR", "ON")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                  liburStatus === "ON"
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50"
                }`}
              >
                <i className="fa-solid fa-power-off text-[10px]" />
                Aktifkan (ON)
              </button>
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "LIBUR"}
                onClick={() => handleToggleFitur("LIBUR", "OFF")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                  liburStatus === "OFF"
                    ? "bg-red-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-red-50"
                }`}
              >
                <i className="fa-solid fa-ban text-[10px]" />
                Nonaktifkan (OFF)
              </button>
            </div>
          </div>

          {/* Card 2: Pengajuan Sesi Live */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Formulir Request Sesi Live</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kontrol akses streamer untuk memilih preferensi shift/jam siaran live
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  shiftStatus === "ON"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {shiftStatus === "ON" ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "SHIFT"}
                onClick={() => handleToggleFitur("SHIFT", "ON")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                  shiftStatus === "ON"
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50"
                }`}
              >
                <i className="fa-solid fa-power-off text-[10px]" />
                Aktifkan (ON)
              </button>
              <button
                type="button"
                disabled={kendaliLoading || loadingAction === "SHIFT"}
                onClick={() => handleToggleFitur("SHIFT", "OFF")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                  shiftStatus === "OFF"
                    ? "bg-red-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-red-50"
                }`}
              >
                <i className="fa-solid fa-ban text-[10px]" />
                Nonaktifkan (OFF)
              </button>
            </div>
          </div>
        </div>

        {/* Informasi Kuota & Database Referensi */}
        <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-950 space-y-1">
            <p className="font-bold">Informasi Kuota & Jadwal Libur:</p>
            <p className="text-blue-900 leading-relaxed">
              Terkait kuota request libur dan host tersimpan otomatis di database pada tabel Libur Streamer dan Kuota Host.
              Batas kuota maksimal per hari adalah 20 streamer sesuai kebijakan operasional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
