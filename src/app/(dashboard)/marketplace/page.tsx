"use client";

import { useRouter } from "next/navigation";
import TabMarketplace from "@/components/streamer-dashboard/tab-marketplace";

export default function MarketplaceDashboardPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
              <i className="fa-solid fa-store text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Marketplace Bursa Proyek
                </h1>
                <span className="bg-orange-400/20 text-orange-300 border border-orange-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  BRAND PARTNERSHIP
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1">
                Pusat bursa proyek siaran live streaming brand mitra, penugasan sesi, dan peluang penghasilan tambahan.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Marketplace Component */}
      <TabMarketplace onNavigateToLms={() => router.push("/lms")} />
    </div>
  );
}
