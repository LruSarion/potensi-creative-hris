"use client";

import TabLms from "@/components/streamer-dashboard/tab-lms";

export default function LmsDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-graduation-cap text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  LMS Akademi & Sertifikasi
                </h1>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  TRAINING & SOP
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1">
                Pusat pelatihan terpadu, modul video interaktif, SOP live selling, dan ujian sertifikasi brand.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main LMS Tab Component */}
      <TabLms />
    </div>
  );
}
