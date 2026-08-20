"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/notification-bell";

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pathTitles: Record<string, string> = {
    "/dashboard": "Command Center Overview",
    "/streamer-dashboard": "Streamer & Host Hub",
    "/staff-dashboard": "Staff & OTS Hub",
    "/input-jadwal": "Jadwal Live Streaming",
    "/input-karyawan": "Master Karyawan & Host",
    "/client": "Brand Partner & Klien",
    "/view-data": "Master Data Explorer",
    "/approval": "Pusat Persetujuan",
    "/pengajuan-izin": "Pengajuan Izin & Cuti",
    "/pengajuan-lembur": "Pengajuan Lembur Extra",
    "/tukar-shift": "Tukar Shift Siaran",
    "/penilaian-sdm": "Evaluasi KPI Host",
    "/payroll": "Kompensasi & Payroll",
    "/suara-karyawan": "Suara Karyawan & Aspirasi",
    "/portal/operation": "Portal Operations Board",
    "/portal/finance": "Portal Keuangan Agency",
    "/portal/qc": "Portal Quality Control",
    "/portal/trainer": "Portal Trainer & Akademi",
    "/portal/client": "Portal Brand Client",
    "/portal/streamer/lms": "LMS & Akademi Host",
    "/admin": "Admin Control Center",
    "/history-log": "Audit & History Log",
  };

  const currentTitle = pathTitles[pathname] ?? "HRIS Potensi Creative";

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 relative z-30">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">{currentTitle}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
          <i className="fa-solid fa-clock text-blue-600" />
          <span>{timeStr || "Loading..."}</span>
        </div>

        {/* Notification Bell — real inbox (LogAktivitas NOTIFICATION rows) */}
        <NotificationBell />

        {/* User Role Badge */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-block text-xs font-semibold text-slate-700">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
            {session?.user?.role ?? "STAFF"}
          </span>
        </div>
      </div>
    </header>
  );
}
