"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { formatDateIndo } from "@/lib/utils/date-format";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

export interface StreamerProfileCardData {
  karyawan: {
    id: string;
    idKaryawan: string;
    namaLengkap: string;
    namaPanggilan: string | null;
    fotoUrl: string | null;
    jabatan?: string;
    kategori?: string;
    startDate?: string;
    endDate?: string;
    statusAktif: string;
    email?: string | null;
    nomorTelepon?: string | null;
  } | null;
  gmv: {
    currentMonthLabel: string;
    totalGmv: number;
    prevMonthGmv: number;
    completedSessions: number | string;
    cancelledSessions: number | string;
    totalLiveHours?: number;
  };
  thp: {
    estimasiThp: number;
    tierName: string;
    ratePerJam: number;
    totalJamLive?: number;
  };
  jobDesk: string[];
  workflow: Array<{
    step: number;
    title: string;
    icon: string;
  }>;
  doAndDonts: {
    dos: string[];
    donts: string[];
  };
  violations: Array<{
    tanggal: string;
    sesi: string;
    jenisPelanggaran: string;
    sanksi: string;
    status: string;
  }>;
}

interface StreamerProfileCardOverviewProps {
  streamerId?: string;
  initialData?: StreamerProfileCardData | null;
  isModal?: boolean;
  onClose?: () => void;
  onBackToList?: () => void;
  onEditProfile?: () => void;
  onViewContract?: () => void;
}

export function StreamerProfileCardOverview({
  streamerId,
  initialData,
  isModal = false,
  onClose,
  onBackToList,
}: StreamerProfileCardOverviewProps) {
  const { data: session } = useSession();

  const [data, setData] = useState<StreamerProfileCardData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.warning("Harap pilih file gambar (JPG/PNG/WebP).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.warning("Ukuran gambar maksimal 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadingPhoto(true);
      try {
        const targetId = data?.karyawan?.id || streamerId;
        await sendJson("/api/streamer-profile", "PATCH", {
          karyawanId: targetId,
          photoUrl: base64,
        });
        toast.success("Foto profil berhasil diperbarui!");
        setData((prev) =>
          prev && prev.karyawan
            ? {
                ...prev,
                karyawan: { ...prev.karyawan, fotoUrl: base64 },
              }
            : prev
        );
      } catch (err) {
        toast.error(errorMessage(err, "Gagal mengunggah foto profil"));
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchCardData() {
      setLoading(true);
      setError("");
      try {
        const query = streamerId ? `?karyawanId=${encodeURIComponent(streamerId)}` : "";
        const data = await fetchJson<StreamerProfileCardData>(`/api/streamer-profile-card${query}`);
        if (isMounted) {
          if (data?.karyawan) {
            setData(data);
          } else {
            setError("Gagal memuat profil streamer");
          }
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi saat memuat data streamer");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCardData();
    return () => {
      isMounted = false;
    };
  }, [streamerId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#941A0B]" />
        <p className="text-sm font-bold text-slate-700">Memuat Profil & SOP Streamer...</p>
      </div>
    );
  }

  if (error || !data || !data.karyawan) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
        <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500" />
        <p className="text-sm font-bold text-red-700">{error || "Data streamer tidak ditemukan"}</p>
        <div className="flex justify-center gap-2">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Kembali ke Daftar
            </button>
          )}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    );
  }

  const { karyawan, gmv, thp, jobDesk, workflow, doAndDonts, violations } = data;
  const isAktif = (karyawan.statusAktif || "AKTIF").toUpperCase() === "AKTIF";

  const content = (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Header if onBackToList is provided */}
      {onBackToList && !isModal && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToList}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-arrow-left text-xs text-[#941A0B]" />
              <span>Kembali ke Daftar Streamer</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 font-semibold">
              <span>Detail Profil:</span>
              <strong className="text-slate-900">{karyawan.namaLengkap}</strong>
              <span className="font-mono text-slate-400">({karyawan.idKaryawan})</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Header if Modal */}
      {isModal && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#941A0B] flex items-center justify-center font-bold">
              <i className="fa-solid fa-id-card" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Detail Profil & SOP Streamer — {karyawan.namaLengkap}
              </h2>
              <p className="text-xs text-slate-500">
                Ringkasan Profil, GMV, SOP sebelum live, dan log pelanggaran
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" />
              <span>Tutup</span>
            </button>
          )}
        </div>
      )}

      {/* TOP & MIDDLE GRID MATCHING EXACT REFERENCE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ================================================================= */}
        {/* CARD 1 (LEFT COLUMN): PROFIL HOST STREAMER                        */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-full text-left">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-user-circle text-[#941A0B]" />
              <span>Profil Host Streamer</span>
            </h3>
          </div>

          {/* Photo Avatar with Ganti Foto on hover */}
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-100 flex-shrink-0 group">
            {karyawan.fotoUrl ? (
              <Image
                src={karyawan.fotoUrl}
                alt={karyawan.namaLengkap}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-4xl font-black bg-slate-50">
                {karyawan.namaLengkap.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Hover overlay to change photo */}
            <label className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1.5 backdrop-blur-[2px]">
              <i className={uploadingPhoto ? "fa-solid fa-circle-notch fa-spin text-xl" : "fa-solid fa-camera text-xl"} />
              <span>{uploadingPhoto ? "Menyimpan..." : "Ganti Foto"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          {/* Name & Code */}
          <div className="space-y-0.5">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
              {karyawan.namaLengkap}
            </h2>
            <div className="text-xs font-bold text-slate-500 font-mono">
              ID Host: <span className="text-slate-700">{karyawan.idKaryawan}</span>
            </div>
          </div>

          {/* Jabatan & Kategori */}
          <div className="w-full pt-1 space-y-1">
            <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              JABATAN & KATEGORI
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-xs text-slate-800">
                {karyawan.jabatan || "Host Streamer"}
              </span>
              <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                {karyawan.kategori || "STREAMER"}
              </span>
            </div>
          </div>

          {/* Status Keaktifan */}
          <div className="w-full space-y-1">
            <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              STATUS KEAKTIFAN
            </div>
            <div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${
                  isAktif
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {isAktif ? "● AKTIF" : "○ NON-AKTIF"}
              </span>
            </div>
          </div>

          {/* Tanggal Bergabung */}
          <div className="w-full space-y-1 border-t border-slate-100 pt-3">
            <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              TANGGAL BERGABUNG
            </div>
            <div className="text-xs text-slate-700 font-semibold">
              {karyawan.startDate ? formatDateIndo(karyawan.startDate) : "-"}
            </div>
          </div>

          {/* Kontak / Telepon jika ada */}
          {(karyawan.nomorTelepon || karyawan.email) && (
            <div className="w-full space-y-1 text-xs text-slate-500">
              {karyawan.nomorTelepon && (
                <div className="flex items-center justify-center gap-1.5 font-medium">
                  <i className="fa-brands fa-whatsapp text-emerald-600" />
                  <span>{karyawan.nomorTelepon}</span>
                </div>
              )}
              {karyawan.email && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] truncate">
                  <i className="fa-regular fa-envelope text-slate-400" />
                  <span>{karyawan.email}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* RIGHT TWO COLUMNS (CARDS 2, 3, 4, 5)                             */}
        {/* ================================================================= */}
        <div className="lg:col-span-8 space-y-5">
          {/* TOP METRICS ROW: TOTAL GMV & ESTIMASI THP / TIERING (2 EQUAL CARDS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* CARD 2: TOTAL GMV */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase flex items-center gap-1.5">
                    <i className="fa-solid fa-chart-line text-emerald-600" />
                    <span>TOTAL GMV ({gmv.currentMonthLabel})</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Realtime DB</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5 text-emerald-600 font-mono">
                  Rp {gmv.totalGmv.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  GMV bulan lalu: <span className="font-semibold text-slate-700 font-mono">Rp {gmv.prevMonthGmv.toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-xs font-bold text-slate-800 flex items-center justify-center gap-4">
                <span className="text-emerald-700">
                  <i className="fa-solid fa-circle-check mr-1" />
                  Selesai: <strong className="text-slate-900 font-mono">{gmv.completedSessions} Sesi</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  <i className="fa-solid fa-ban mr-1" />
                  Batal: <strong className="text-slate-900 font-mono">{gmv.cancelledSessions}</strong>
                </span>
              </div>
            </div>

            {/* CARD 3: ESTIMASI THP & TIERING */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                    <i className="fa-solid fa-coins text-amber-500" />
                    <span>ESTIMASI THP BULAN INI</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    Tier: {thp.tierName}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5 font-mono">
                  Rp {thp.estimasiThp.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Rate per jam: <span className="font-semibold text-slate-700 font-mono">Rp {thp.ratePerJam.toLocaleString("id-ID")} / Jam</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="text-slate-600">Total Durasi Live:</span>
                <span className="text-[#941A0B] font-black font-mono">
                  {gmv.totalLiveHours ?? thp.totalJamLive ?? 0} Jam Selesai
                </span>
              </div>
            </div>
          </div>

          {/* MIDDLE ROW: JOB DESK & EXPECTATIONS & WORKFLOW PROSEDUR (SEMENTARA DIPERTAHANKAN) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* CARD 4: JOB DESK & EXPECTATIONS */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-list-check text-[#941A0B]" />
                <span>JOB DESK & EXPECTATIONS</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700 font-semibold">
                {jobDesk.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#941A0B] font-bold text-sm leading-none">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CARD 5: WORKFLOW & PROSEDUR SEBELUM LIVE */}
            <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-arrow-progress text-[#941A0B]" />
                <span>WORKFLOW & PROSEDUR SEBELUM LIVE</span>
              </h3>
              
              {/* 5 Connected Step Nodes */}
              <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto pt-1 pb-2">
                {workflow.map((w, wIdx) => (
                  <React.Fragment key={w.step}>
                    <div className="flex flex-col items-center text-center w-20 flex-shrink-0">
                      <div className="w-11 h-11 rounded-xl border border-red-300 bg-white text-[#941A0B] flex items-center justify-center text-base shadow-2xs">
                        <i className={`fa-solid ${w.icon}`} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 mt-1.5 leading-tight">
                        {w.step}. {w.title}
                      </span>
                    </div>
                    {wIdx < workflow.length - 1 && (
                      <div className="text-red-400 font-bold text-xs flex-shrink-0 -mt-5">
                        <i className="fa-solid fa-arrow-right" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM ROW: DO & DON'TS + LOG PELANGGARAN SAAT LIVE (RIWAYAT)       */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 6: DO AND DONTS (KODE ETIK LIVE - DIPERTAHANKAN) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3.5">
          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase text-center sm:text-left flex items-center gap-1.5">
            <i className="fa-solid fa-scale-balanced text-[#941A0B]" />
            <span>DO AND DONTS (KODE ETIK LIVE)</span>
          </h3>

          <div className="grid grid-cols-2 gap-4 pt-1">
            {/* DO'S */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-wider pb-1">
                <i className="fa-solid fa-circle-check text-emerald-500 text-sm" />
                <span>DO&apos;S</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 font-semibold">
                {doAndDonts.dos.map((d, di) => (
                  <li key={di} className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-sm flex-shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DON'TS */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-red-600 uppercase tracking-wider pb-1">
                <i className="fa-solid fa-circle-xmark text-red-500 text-sm" />
                <span>DON&apos;TS</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 font-semibold">
                {doAndDonts.donts.map((dt, dti) => (
                  <li key={dti} className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-xmark text-red-500 text-sm flex-shrink-0" />
                    <span>{dt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CARD 7: LOG PELANGGARAN SAAT LIVE (RIWAYAT DARI QC VIOLATION) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation text-amber-500" />
              <span>LOG PELANGGARAN SAAT LIVE (Riwayat)</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Database QC & Incident</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#941A0B] text-white font-bold">
                <tr>
                  <th className="px-3.5 py-2.5">Tanggal</th>
                  <th className="px-3.5 py-2.5">Sesi (Waktu)</th>
                  <th className="px-3.5 py-2.5">Jenis Pelanggaran</th>
                  <th className="px-3.5 py-2.5">Sanksi</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {violations.length > 0 ? (
                  violations.map((v, vi) => (
                    <tr key={vi} className="hover:bg-slate-50 transition">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {v.tanggal}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-600">
                        {v.sesi}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                        {v.jenisPelanggaran}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                        {v.sanksi}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200">
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                      <i className="fa-solid fa-shield-check text-2xl mb-1.5 block text-emerald-500" />
                      <span>Tidak ada riwayat pelanggaran live. Performa bersih dan patuh SOP.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="bg-slate-50/95 rounded-3xl p-4 sm:p-6 max-w-6xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-300 space-y-4">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
