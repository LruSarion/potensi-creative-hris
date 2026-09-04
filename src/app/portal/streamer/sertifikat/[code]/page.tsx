"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

type CertificateData = {
  id: string;
  code: string;
  issuedAt: string;
  validTo: string | null;
  course: { id: string; title: string; description: string | null; isCertification: boolean };
  streamer: { id: string; namaLengkap: string; idKaryawan: string };
  client: { id: string; namaClient: string } | null;
};

export default function SertifikatPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetchJson<CertificateData>(`/api/lms?view=certificate&code=${encodeURIComponent(code)}`)
      .then((data) => setCert(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Sertifikat tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-emerald-500" />
          Memuat sertifikat...
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4 text-center">
        <i className="fa-solid fa-file-circle-exclamation text-4xl text-slate-300" />
        <h1 className="text-lg font-bold text-slate-800">Sertifikat Tidak Ditemukan</h1>
        <p className="text-xs text-slate-500 max-w-sm">{error || "Kode sertifikat tidak valid atau telah dicabut."}</p>
      </div>
    );
  }

  const issued = new Date(cert.issuedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const validTo = cert.validTo ? new Date(cert.validTo).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      {/* Toolbar (hidden when printing) */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-5 print:hidden">
        <a
          href="/portal/streamer/lms"
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>Kembali ke LMS</span>
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md flex items-center gap-2"
        >
          <i className="fa-solid fa-file-arrow-down" />
          <span>Unduh PDF (Print)</span>
        </button>
      </div>

      {/* Certificate sheet */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
        <div className="p-8 sm:p-14 border-[12px] border-double border-emerald-700/80 relative min-h-[540px] flex flex-col items-center justify-center text-center space-y-8">
          {/* Watermark */}
          <i className="fa-solid fa-award absolute text-[#941A0B]/5 text-[220px] pointer-events-none select-none" />

          {/* Header */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-2xl mx-auto shadow-md">
              <i className="fa-solid fa-certificate" />
            </div>
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-800">
              Potensi Creative • Akademi Streamer
            </p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 uppercase">
              Sertifikat Kompetensi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">Diberikan kepada</p>
          </div>

          {/* Recipient */}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-4xl font-black text-[#941A0B] tracking-tight">
              {cert.streamer.namaLengkap}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
              ID Karyawan: {cert.streamer.idKaryawan}
            </p>
          </div>

          {/* Body */}
          <div className="max-w-xl space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              atas keberhasilan menyelesaikan seluruh modul pembelajaran dan ujian pada program
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900">{cert.course.title}</h3>
            {cert.client && (
              <p className="text-[11px] sm:text-xs text-slate-500">
                Sertifikasi resmi untuk brand <strong className="text-slate-700">{cert.client.namaClient}</strong>
              </p>
            )}
          </div>

          {/* Footer: date + code + signature */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-200">
            <div className="text-center sm:text-left">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Diterbitkan</p>
              <p className="text-sm font-bold text-slate-800">{issued}</p>
              {validTo && (
                <p className="text-[10px] text-slate-400">Berlaku hingga: {validTo}</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kode Verifikasi</p>
              <p className="text-sm font-black text-emerald-800 font-mono tracking-wider">{cert.code}</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="font-[cursive] text-xl text-slate-800 italic leading-none">Trainer</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-t border-slate-300 pt-1 mt-1">
                Trainer Akademi
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="max-w-4xl mx-auto mt-4 text-center text-[10px] text-slate-400 print:hidden">
        Verifikasi keaslian sertifikat melalui kode <strong className="font-mono">{cert.code}</strong> pada halaman ini.
      </p>
    </div>
  );
}