"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

export interface StreamerProfileCardData {
  karyawan: {
    id: string;
    idKaryawan: string;
    namaLengkap: string;
    namaPanggilan: string | null;
    fotoUrl: string | null;
    kontrakType: string;
    startDate: string;
    endDate: string;
    statusAktif: string;
  } | null;
  gmv: {
    currentMonthLabel: string;
    totalGmv: number;
    prevMonthGmv: number;
    completedSessions: number | string;
    cancelledSessions: number | string;
  };
  thp: {
    estimasiThp: number;
    tierName: string;
    ratePerJam: number;
  };
  kpi: {
    periode: string;
    salesTargetText: string;
    retentionRate: number;
    conversionRate: number;
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
  onEditProfile,
  onViewContract,
}: StreamerProfileCardOverviewProps) {
  const [data, setData] = useState<StreamerProfileCardData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [showContractModal, setShowContractModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchCardData() {
      setLoading(true);
      setError("");
      try {
        const query = streamerId ? `?karyawanId=${encodeURIComponent(streamerId)}` : "";
        const res = await fetch(`/api/streamer-profile-card${query}`);
        const result = await res.json();
        if (isMounted) {
          if (result.status === "success" && result.data?.karyawan) {
            setData(result.data);
          } else {
            setError(result.message || "Gagal memuat profil streamer");
          }
        }
      } catch {
        if (isMounted) setError("Terjadi kesalahan koneksi saat memuat data streamer");
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
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              Kembali ke Daftar
            </button>
          )}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    );
  }

  const { karyawan, gmv, thp, kpi, jobDesk, workflow, doAndDonts, violations } = data;

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
                Ringkasan KPI, GMV, SOP sebelum live, dan log pelanggaran
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

      {/* 3-COLUMN TOP & MIDDLE GRID MATCHING EXACT REFERENCE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ================================================================= */}
        {/* CARD 1 (LEFT COLUMN): PROFIL STAFF                              */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-full text-left">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
              Profil Staff
            </h3>
          </div>

          {/* Photo Avatar */}
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-100 flex-shrink-0">
            {karyawan.fotoUrl ? (
              <Image
                src={karyawan.fotoUrl}
                alt={karyawan.namaLengkap}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl font-bold bg-slate-50">
                {karyawan.namaLengkap.charAt(0)}
              </div>
            )}
          </div>

          {/* Name & Code */}
          <div className="space-y-0.5">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
              {karyawan.namaLengkap}
            </h2>
            <div className="text-xs font-bold text-slate-500 font-mono">
              Code: {karyawan.idKaryawan}
            </div>
          </div>

          {/* Status Kontrak */}
          <div className="w-full pt-1 space-y-1.5">
            <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
              STATUS KONTRAK
            </div>
            <div>
              <span className="inline-block bg-[#941A0B] text-white font-extrabold text-xs px-5 py-1 rounded-md uppercase tracking-wider shadow-xs">
                {karyawan.kontrakType || "DEDICATED"}
              </span>
            </div>
          </div>

          {/* Periode Kontrak */}
          <div className="w-full space-y-1">
            <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
              PERIODE KONTRAK
            </div>
            <div className="text-xs text-slate-700 font-semibold">
              Awal: {karyawan.startDate} - Berakhir: {karyawan.endDate}
            </div>
          </div>

          {/* Action Buttons: Edit & View Contract */}
          <div className="w-full flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onEditProfile || (() => alert(`Pengaturan profil ${karyawan.namaLengkap} dapat diakses melalui menu Master Data / Data Karyawan.`))}
              className="px-5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onViewContract || (() => setShowContractModal(true))}
              className="px-5 py-1.5 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              View Contract
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT TWO COLUMNS (CARDS 2, 3, 4, 5, 6)                          */}
        {/* ================================================================= */}
        <div className="lg:col-span-8 space-y-5">
          {/* TOP METRICS ROW: TOTAL GMV, ESTIMASI THP, KPI METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* CARD 2: TOTAL GMV */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
                  TOTAL GMV ({gmv.currentMonthLabel})
                </h3>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5">
                  Rp {gmv.totalGmv.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  GMV sebelumnya: <span className="font-semibold text-slate-700">Rp {gmv.prevMonthGmv.toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div className="bg-slate-100/90 border border-slate-200 rounded-xl px-4 py-2 text-center text-xs font-bold text-slate-800 flex items-center justify-center gap-4">
                <span>Selesai: <strong className="text-slate-900">{gmv.completedSessions}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Batal: <strong className="text-slate-900">{gmv.cancelledSessions}</strong></span>
              </div>
            </div>

            {/* CARD 3: ESTIMASI THP */}
            <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-2">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">
                  Estimasi THP
                </h3>
                <div className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1.5">
                  Rp {thp.estimasiThp.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5 border-t border-slate-100 pt-2">
                <div className="font-bold text-slate-800">Tier: {thp.tierName}</div>
                <div className="text-[11px] text-slate-500">Rate: Rp {thp.ratePerJam.toLocaleString("id-ID")} / Jam</div>
              </div>
            </div>

            {/* CARD 4: KPI METRICS */}
            <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-2 relative overflow-hidden">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
                  KPI METRICS ({kpi.periode})
                </h3>
                <div className="space-y-1.5 mt-2.5 text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#941A0B]" />
                    <span>Sales Target: <strong className="text-slate-900">{kpi.salesTargetText}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#941A0B]" />
                    <span>Retention Rate: <strong className="text-slate-900">{kpi.retentionRate}%</strong></span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#941A0B]" />
                      <span>Conversion: <strong className="text-slate-900">{kpi.conversionRate}%</strong></span>
                    </div>
                    {/* Trend Sparkline Icon / Mini SVG Wave */}
                    <div className="w-16 h-6">
                      <svg viewBox="0 0 60 20" className="w-full h-full stroke-[#941A0B] fill-none stroke-2">
                        <path d="M 0 15 Q 15 5, 25 12 T 45 4 T 60 1" />
                        <path d="M 0 15 Q 15 5, 25 12 T 45 4 T 60 1 L 60 20 L 0 20 Z" className="fill-[#941A0B]/10 stroke-none" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE ROW: JOB DESK & EXPECTATIONS & WORKFLOW PROSEDUR */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* CARD 5: JOB DESK & EXPECTATIONS */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                JOB DESK & EXPECTATIONS
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

            {/* CARD 6: WORKFLOW & PROSEDUR SEBELUM LIVE */}
            <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                WORKFLOW & PROSEDUR SEBELUM LIVE
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
        
        {/* CARD 7: DO AND DONTS (KODE ETIK LIVE) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3.5">
          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase text-center sm:text-left">
            DO AND DONTS (KODE ETIK LIVE)
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

        {/* CARD 8: LOG PELANGGARAN SAAT LIVE (RIWAYAT) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200">
            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
              LOG PELANGGARAN SAAT LIVE (Riwayat)
            </h3>
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
                      Tidak ada riwayat pelanggaran live. Performa bersih dan patuh SOP.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Contract Detail Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#941A0B] flex items-center justify-center font-bold">
                  <i className="fa-solid fa-file-contract text-base" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Rincian Kontrak Kerja</h3>
                  <p className="text-xs text-slate-500 font-mono">{karyawan.idKaryawan} • {karyawan.namaLengkap}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Status Kontrak:</span>
                  <span className="bg-[#941A0B] text-white px-2.5 py-0.5 rounded-md font-bold uppercase text-[10px]">
                    {karyawan.kontrakType}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Periode Mulai:</span>
                  <span className="font-bold text-slate-800">{karyawan.startDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Periode Berakhir:</span>
                  <span className="font-bold text-slate-800">{karyawan.endDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Status Operasional:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {karyawan.statusAktif}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Skema Pembayaran:</span>
                  <span className="font-bold text-slate-800">Hourly Rate + Insentif GMV</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic text-center">
                Dokumen kontrak fisik dan adendum tersimpan terpusat di arsip HRIS PT Potensi Creative.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="px-4 py-2 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Tutup Dokumen
              </button>
            </div>
          </div>
        </div>
      )}
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
