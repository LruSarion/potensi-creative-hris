"use client";

// Report tab of the streamer dashboard: performance metrics, tiering status,
// and incident list. Extracted verbatim from page.tsx (refactor only).

import type { DashboardData } from "./types";
import { formatDateSafe } from "@/lib/utils/date-format";
import { CardSkeleton } from "@/components/ui/loading-states";

export function TabReport({ dashboardData }: { dashboardData: DashboardData | null }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-chart-pie text-[#941A0B]" />
            <span>Laporan & Evaluasi Performa Streamer</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rangkuman jam siaran live, pencapaian tiering, estimasi komisi, dan total penjualan GMV.
          </p>
        </div>
        {dashboardData?.periode && (
          <span className="px-3 py-1.5 rounded-xl bg-[#941A0B]/10 border border-[#941A0B]/20/70 text-[#941A0B] font-bold text-xs self-start sm:self-auto">
            📅 Periode: {dashboardData.periode}
          </span>
        )}
      </div>

      {/* Stat Cards */}
      {dashboardData ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Estimasi Gaji Bersih</div>
            <div className="text-lg sm:text-xl font-black text-emerald-700">Rp {dashboardData.netPay.toLocaleString("id-ID")}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">Setelah denda & insentif</div>
          </div>
          <div className="bg-gradient-to-br from-[#941A0B]/5 to-[#941A0B]/10 border border-[#941A0B]/20 rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] text-[#941A0B] font-bold uppercase mb-1">Total GMV Penjualan</div>
            <div className="text-lg sm:text-xl font-black text-[#941A0B]">Rp {dashboardData.totalGmv.toLocaleString("id-ID")}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">{dashboardData.totalSesi} Sesi Siaran</div>
          </div>
          <div className="bg-gradient-to-br from-[#941A0B]/5 to-[#941A0B]/10 border border-[#941A0B]/20 rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] text-[#941A0B] font-bold uppercase mb-1">Total Jam Live</div>
            <div className="text-lg sm:text-xl font-black text-[#941A0B]">{dashboardData.totalJam} Jam</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">Tier: <span className="font-bold text-[#941A0B]">{dashboardData.activeTier?.nama ?? "–"}</span></div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] text-red-600 font-bold uppercase mb-1">Total Denda & Penalti</div>
            <div className="text-lg sm:text-xl font-black text-red-700">Rp {dashboardData.totalDenda.toLocaleString("id-ID")}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">{dashboardData.incidents.length} Catatan Evaluasi</div>
          </div>
        </div>
      ) : (
        <CardSkeleton count={4} gridCls="grid grid-cols-2 sm:grid-cols-4 gap-3.5" />
      )}

      {/* Tiering & Rate Detail */}
      {dashboardData?.activeTier && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-award text-amber-500 text-sm" />
              <span className="font-bold text-slate-800 text-xs sm:text-sm">Status Tiering Aktif: {dashboardData.activeTier.nama}</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#941A0B] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Rate: Rp {dashboardData.activeTier.ratePerJam.toLocaleString("id-ID")} / Jam
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Pencapaian jam live Anda bulan ini telah mencapai <strong>{dashboardData.totalJam} Jam</strong>. Tingkatkan durasi siaran untuk mencapai tiering yang lebih tinggi dan insentif bonus omset.
          </div>
        </div>
      )}

      {/* Incident / QC Violations List */}
      {dashboardData?.incidents && dashboardData.incidents.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            Catatan Evaluasi / Pelanggaran Bulan Ini ({dashboardData.incidents.length})
          </h4>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
            {dashboardData.incidents.map((inc) => (
              <div key={inc.id} className="p-3.5 bg-white flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-800">{inc.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{inc.category ?? "Pelanggaran"} • {formatDateSafe(inc.createdAt)}</div>
                </div>
                <span className="font-mono font-bold text-red-600 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100">
                  -Rp {inc.fineApplied.toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-slate-400 text-xs pt-2">
        <p>Untuk rincian slip gaji resmi atau pengajuan izin, silakan akses menu terkait di sistem HRIS.</p>
      </div>
    </div>
  );
}