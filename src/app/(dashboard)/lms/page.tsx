"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TabLms from "@/components/streamer-dashboard/tab-lms";
import CreateCourseModal from "@/components/lms/create-course-modal";

export default function LmsDashboardPage() {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const role = session?.user?.role;
  const isTrainer = ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(role ?? "");

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
              <i className="fa-solid fa-graduation-cap text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  LMS Akademi & Sertifikasi
                </h1>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  TRAINING & SOP
                </span>
                {isTrainer && (
                  <span className="bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <i className="fa-solid fa-chalkboard-user text-xs" /> MODE TRAINER
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-1">
                Pusat pelatihan terpadu, modul video interaktif, SOP live selling, dan ujian sertifikasi brand.
              </p>
            </div>
          </div>

          {isTrainer && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/portal/trainer"
                className="bg-white/15 hover:bg-white/25 text-white border border-white/25 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <i className="fa-solid fa-chalkboard-user" />
                <span>Trainer Studio</span>
              </Link>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="bg-white hover:bg-slate-100 text-[#941A0B] font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-[#941A0B]" />
                <span>Buat Kelas Baru</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main LMS Tab Component */}
      <TabLms key={refreshKey} />

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(newCourse) => {
          setSuccessMsg(`Kelas "${newCourse.title}" berhasil dibuat! Silakan kelola modul atau materi melalui Trainer Studio.`);
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}
