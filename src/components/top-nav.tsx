"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function TopNav({
  onToggleMobileMenu,
  isCollapsed,
  onToggleCollapse,
}: {
  onToggleMobileMenu?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const pathTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/streamer-dashboard": "Streamer Dashboard",
    "/staff-dashboard": "Staff Dashboard",
    "/pengajuan-lembur": "Pengajuan Lembur",
    "/pengajuan-izin": "Pengajuan Cuti/Izin",
    "/tukar-shift": "Tukar Shift",
    "/suara-karyawan": "Suara Karyawan",
    "/approval": "Approval",
    "/penilaian-sdm": "Penilaian SDM",
    "/payroll": "Payroll",
    "/input-karyawan": "Input Karyawan",
    "/input-jadwal": "Input Jadwal",
    "/view-data": "View Data",
    "/client": "Client",
    "/master-data": "Master Data",
    "/history-log": "History Log",
  };

  const currentTitle = pathTitles[pathname] ?? "Dashboard";

  return (
    <header className="z-30 h-16 bg-white border-b border-[#F1F1F1] flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 w-full sticky top-0">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Button */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[#4D4D4D] hover:text-[#941A0B] hover:bg-[#F1F1F1] transition"
            title="Buka Menu Sidebar"
          >
            <i className="fa-solid fa-bars text-lg" />
          </button>
        )}

        {/* Desktop Collapse/Expand Toggle Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex w-9 h-9 rounded-xl items-center justify-center text-[#4D4D4D] hover:text-[#941A0B] hover:bg-[#F1F1F1] transition"
            title={isCollapsed ? "Buka Penuh Sidebar" : "Perkecil Sidebar"}
          >
            <i className={`fa-solid ${isCollapsed ? "fa-bars" : "fa-bars-staggered"} text-base`} />
          </button>
        )}

        <h1 className="font-bold text-base sm:text-lg text-[#000000] tracking-tight">{currentTitle}</h1>
      </div>

      {/* User Info & Logout on Top Right */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right flex flex-col justify-center">
          <div className="text-xs sm:text-sm font-bold text-[#000000] leading-tight">
            {session?.user?.name ?? "Henry Setyawan"}
          </div>
          <div className="text-[11px] text-[#4D4D4D] font-medium mt-0.5">
            {session?.user?.role ? `${session.user.role.replace(/_/g, " ")}` : "DEV000 | Desain Grafis"}
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#919191] hover:text-[#FA3737] hover:bg-[#941A0B]/10 transition cursor-pointer"
          title="Keluar / Logout"
        >
          <i className="fa-solid fa-arrow-right-from-bracket text-lg" />
        </button>
      </div>
    </header>
  );
}
