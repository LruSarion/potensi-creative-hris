"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/notification-bell";
import ChangePinModal from "@/components/change-pin-modal";

export default function TopNav({
  onToggleMobileMenu,
}: {
  onToggleMobileMenu?: () => void;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState("");
  const [pinModalOpen, setPinModalOpen] = useState(false);

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
    "/dashboard": "Dashboard",
    "/streamer-dashboard": "Streamer Dashboard",
    "/staff-dashboard": "Staff Dashboard",
    "/input-jadwal": "Input Jadwal",
    "/input-karyawan": "Input Karyawan",
    "/client": "Client",
    "/view-data": "View Data",
    "/approval": "Approval",
    "/pengajuan-izin": "Pengajuan Cuti/Izin",
    "/pengajuan-lembur": "Pengajuan Lembur",
    "/tukar-shift": "Tukar Shift",
    "/penilaian-sdm": "Penilaian SDM",
    "/payroll": "Payroll",
    "/suara-karyawan": "Suara Karyawan",
    "/master-data": "Master Data",
    "/history-log": "History Log",
    "/portal/operation": "Portal Operations Board",
    "/portal/finance": "Portal Keuangan",
    "/portal/qc": "Portal Quality Control",
    "/portal/trainer": "Portal Trainer",
    "/portal/client": "Portal Brand Client",
    "/portal/streamer/lms": "LMS & Akademi Host",
    "/admin": "Master Data",
    "/analytics-gmv": "Analytics GMV",

    "/finance-insentif": "Rekap Denda & Insentif",
    "/qc-violations": "Pelanggaran QC Live",
    "/sop-management": "Manajemen SOP",
    "/streamer-directory": "Direktori Streamer",
  };

  const currentTitle = pathTitles[pathname] ?? "HRIS Potensi Creative";

  return (
    <>
      <ChangePinModal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} />
      <header className="z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 flex-shrink-0 w-full shadow-sm sticky top-0">
      <div className="flex items-center gap-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden text-slate-500 hover:text-blue-600 transition"
            title="Buka Menu"
          >
            <i className="fa-solid fa-bars text-xl" />
          </button>
        )}
        <h1 className="font-bold text-lg hidden sm:block text-slate-800 tracking-tight">{currentTitle}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <i className="fa-regular fa-clock text-blue-600" />
          <span>{timeStr || "Loading..."}</span>
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Info */}
        <div className="text-right flex flex-col justify-center">
          <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
            {session?.user?.name ?? session?.user?.email ?? (status === "loading" ? "Memuat..." : "Karyawan")}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 capitalize">
            {session?.user?.role ? session.user.role.replace(/_/g, " ").toLowerCase() : "Staff"}
          </div>
        </div>

        <div className="h-6 sm:h-8 w-px bg-slate-200"></div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Ganti PIN Keamanan (6 Digit)"
          >
            <i className="fa-solid fa-key text-base" />
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Keluar / Logout"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-base" />
          </button>
        </div>
      </div>
    </header>
    </>
  );
}


