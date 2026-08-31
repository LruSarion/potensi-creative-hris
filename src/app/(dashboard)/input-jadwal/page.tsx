"use client";

/**
 * Input Jadwal Page — Orchestrator
 *
 * This is the slim entry-point that composes all tab components.
 * Each tab lives in `@/components/input-jadwal/tab-*.tsx`.
 *
 * Previous monolithic version: 7 085 lines → now ~120 lines.
 */

import React, { useState, useEffect } from "react";
import { useAlert } from "@/components/ui/custom-alert";
import { useJadwalData } from "@/hooks/use-jadwal-data";
import { CrashResultModal } from "@/components/ui/modal";
import type { MainTabId, CrashModalState } from "@/types/jadwal";

// Tab components (lazy-loaded would be better but keeping sync for simplicity)
import { TabStreamer } from "@/components/input-jadwal/tab-streamer";
import { TabOts } from "@/components/input-jadwal/tab-ots";
import { TabRubah } from "@/components/input-jadwal/tab-rubah";
import { TabKlien } from "@/components/input-jadwal/tab-klien";
import { TabMarketplace } from "@/components/input-jadwal/tab-marketplace";
import { TabHybrid } from "@/components/input-jadwal/tab-hybrid";
import { TabKendali } from "@/components/input-jadwal/tab-kendali";

const MAIN_TABS: { id: MainTabId; label: string; icon: string }[] = [
  { id: "streamer", label: "Jadwal Streamer", icon: "fa-video" },
  { id: "ots", label: "Jadwal OTS", icon: "fa-headphones" },
  { id: "rubah", label: "Rubah Jadwal", icon: "fa-pen-to-square" },
  { id: "klien", label: "Jadwal Klien", icon: "fa-user-tie" },
  { id: "marketplace", label: "Marketplace", icon: "fa-store" },
  { id: "hybrid", label: "Hybrid Live", icon: "fa-file-import" },
  { id: "kendali", label: "Kendali Form", icon: "fa-toggle-on" },
];

export default function InputJadwalPage() {
  const data = useJadwalData();
  const { showAlert, showConfirm } = useAlert();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation
  const [mainTab, setMainTab] = useState<MainTabId>("streamer");

  // Shared crash modal (used by multiple tabs)
  const [modalCrashData, setModalCrashData] = useState<CrashModalState>({
    isOpen: false,
    isSafe: false,
    title: "",
    conflicts: [],
  });

  // Shared props passed to every tab
  const sharedProps = {
    ...data,
    showAlert,
    showConfirm,
    modalCrashData,
    setModalCrashData,
  };

  if (!mounted) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-20 p-4 sm:p-6 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#941A0B]" />
          <p className="text-sm font-semibold text-slate-500">Memuat Jadwal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 p-4 sm:p-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-black">Kelola Jadwal Siaran</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          Buat jadwal baru untuk Streamer, jadwal OTS, atau lakukan pengajuan Marketplace.
        </p>
      </div>

      {/* 7 Main Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 border ${
              mainTab === tab.id
                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {data.success && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>{data.success}</span>
          <button onClick={() => data.setSuccess("")} className="ml-auto text-emerald-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}
      {data.error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{data.error}</span>
          <button onClick={() => data.setError("")} className="ml-auto text-red-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Tab Content */}
      {mainTab === "streamer" && <TabStreamer {...sharedProps} />}
      {mainTab === "ots" && <TabOts {...sharedProps} />}
      {mainTab === "rubah" && <TabRubah {...sharedProps} />}
      {mainTab === "klien" && <TabKlien {...sharedProps} />}
      {mainTab === "marketplace" && <TabMarketplace {...sharedProps} />}
      {mainTab === "hybrid" && <TabHybrid {...sharedProps} />}
      {mainTab === "kendali" && <TabKendali {...sharedProps} />}

      {/* Shared Crash Result Modal */}
      <CrashResultModal
        isOpen={modalCrashData.isOpen}
        onClose={() => setModalCrashData({ ...modalCrashData, isOpen: false })}
        isSafe={modalCrashData.isSafe}
        title={modalCrashData.title}
        conflicts={modalCrashData.conflicts}
      />
    </div>
  );
}
