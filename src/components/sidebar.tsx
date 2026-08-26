"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useState, useEffect } from "react";
import type { Role } from "@/generated/prisma/enums";

type NavSubItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  tabKey?: string;
};

type NavGroup = {
  id: string;
  label: string;
  icon: string;
  items: NavSubItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboards",
    label: "Dashboard",
    icon: "fa-solid fa-gauge-high",
    items: [
      { href: "/dashboard", label: "Dashboard Ringkasan", icon: "fa-solid fa-border-all", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "QC_MANAGER", "QC_REVIEWER", "TRAINER"] },
      { href: "/streamer-dashboard", label: "Streamer Dashboard", icon: "fa-solid fa-video", roles: ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/staff-dashboard", label: "Staff Dashboard", icon: "fa-solid fa-id-badge", roles: ["STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL"] },
    ],
  },
  {
    id: "pengajuan",
    label: "Pusat Pengajuan",
    icon: "fa-solid fa-paper-plane",
    items: [
      { href: "/pengajuan", label: "Ringkasan Pusat Pengajuan", icon: "fa-solid fa-receipt", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "FINANCE", "QC_REVIEWER"] },
      { href: "/pengajuan?tab=lembur", label: "Pengajuan Lembur", icon: "fa-regular fa-clock", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER"], tabKey: "lembur" },
      { href: "/pengajuan?tab=izin", label: "Pengajuan Cuti / Izin", icon: "fa-solid fa-calendar-xmark", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER"], tabKey: "izin" },
      { href: "/pengajuan?tab=tukar-shift", label: "Tukar Shift Streamer", icon: "fa-solid fa-right-left", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], tabKey: "tukar-shift" },
      { href: "/pengajuan?tab=suara", label: "Suara Karyawan & Aspirasi", icon: "fa-regular fa-comment-dots", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "FINANCE"], tabKey: "suara" },
    ],
  },
  {
    id: "operasional",
    label: "Operasional & SDM",
    icon: "fa-solid fa-people-roof",
    items: [
      { href: "/approval", label: "Pusat Approval", icon: "fa-regular fa-square-check", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"] },
      { href: "/penilaian-sdm", label: "Penilaian SDM (KPI)", icon: "fa-regular fa-star", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "QC_MANAGER", "QC_REVIEWER"] },
      { href: "/input-jadwal", label: "Kelola Jadwal Siaran", icon: "fa-regular fa-calendar-plus", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"] },
      { href: "/input-karyawan", label: "Kelola Data Karyawan", icon: "fa-solid fa-user-plus", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/client", label: "Klien & Partner Brand", icon: "fa-solid fa-handshake", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"] },
      { href: "/view-data", label: "View Master Database", icon: "fa-solid fa-database", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
    ],
  },
  {
    id: "lms_learning",
    label: "Pelatihan LMS",
    icon: "fa-solid fa-graduation-cap",
    items: [
      { href: "/portal/streamer/lms", label: "Modul & Ujian Streamer", icon: "fa-solid fa-book-open-reader", roles: ["STREAMER", "STAFF", "OTS", "TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/portal/trainer/learning-test", label: "Kelola Materi & Ujian", icon: "fa-solid fa-pen-to-square", roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/portal/trainer/hasil-jawaban", label: "Hasil Ujian & Quiz", icon: "fa-solid fa-square-poll-vertical", roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
    ],
  },
  {
    id: "finance",
    label: "Finance & Gaji",
    icon: "fa-solid fa-wallet",
    items: [
      { href: "/payroll", label: "Payroll & Gaji Streamer", icon: "fa-solid fa-money-bill-wave", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"] },
      { href: "/finance-insentif", label: "Rekap Insentif & Denda", icon: "fa-solid fa-receipt", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"] },
      { href: "/analytics-gmv", label: "Analytics & Laporan GMV", icon: "fa-solid fa-chart-line", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "CLIENT"] },
    ],
  },
  {
    id: "fitur_lanjutan",
    label: "Fitur Lanjutan",
    icon: "fa-solid fa-sliders",
    items: [
      { href: "/streamer-directory", label: "Direktori Streamer", icon: "fa-solid fa-address-book", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "CLIENT"] },
      { href: "/qc-violations", label: "Pelanggaran QC & SOP", icon: "fa-solid fa-shield-halved", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "QC_MANAGER", "QC_REVIEWER"] },
      { href: "/sop-management", label: "Manajemen Dokumen SOP", icon: "fa-solid fa-clipboard-list", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/pipeline", label: "Session Pipeline", icon: "fa-solid fa-diagram-project", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"] },
      { href: "/migration", label: "Impor Data Excel", icon: "fa-solid fa-file-import", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE"] },
      { href: "/admin", label: "Pengaturan Sistem (Master)", icon: "fa-solid fa-gear", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"] },
      { href: "/history-log", label: "History Activity Log", icon: "fa-solid fa-clock-rotate-left", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"] },
    ],
  },
];

function checkIsActive(item: NavSubItem, pathname: string, activeTabQuery: string | null) {
  if (item.href.startsWith("/pengajuan")) {
    if (pathname === "/pengajuan" || pathname.startsWith("/pengajuan/")) {
      if (item.tabKey) {
        return activeTabQuery === item.tabKey;
      }
      return !activeTabQuery;
    }
    return false;
  }
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
}

function SidebarNavContent({
  onCloseMobile,
}: {
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "SUPER_ADMIN") as Role;

  const activeTabQuery = searchParams.get("tab");

  // Track accordion open states per group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Auto expand group that contains current active path
    const initialOpen: Record<string, boolean> = {};
    NAV_GROUPS.forEach((group) => {
      const visibleItems = group.items.filter((item) => item.roles.includes(role));
      if (visibleItems.length > 1) {
        const hasActiveChild = visibleItems.some((item) => checkIsActive(item, pathname, activeTabQuery));
        if (hasActiveChild) {
          initialOpen[group.id] = true;
        }
      }
    });
    setOpenGroups((prev) => ({ ...initialOpen, ...prev }));
  }, [pathname, role, activeTabQuery]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll py-3 px-3 space-y-1.5 custom-scrollbar">
      {NAV_GROUPS.map((group) => {
        // Filter items matching user's role
        const visibleItems = group.items.filter((item) => item.roles.includes(role));
        if (visibleItems.length === 0) return null;

        // =========================================================================
        // CASE 1: HANYA 1 ITEM -> JANGAN DI-GROUP (Render sebagai direct top-level link)
        // =========================================================================
        if (visibleItems.length === 1) {
          const item = visibleItems[0];
          const isActive = checkIsActive(item, pathname, activeTabQuery);

          return (
            <div key={group.id} className="py-0.5">
              <Link
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 group cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                    : "text-slate-700 hover:bg-slate-100 hover:text-blue-600"
                }`}
              >
                <i
                  className={`${item.icon || group.icon} w-5 text-center text-sm transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          );
        }

        // =========================================================================
        // CASE 2: LEBIH DARI 1 ITEM -> RENDER ACCORDION GROUP DENGAN ANIMASI SMOOTH
        // =========================================================================
        const isOpen = openGroups[group.id] ?? true;
        const isGroupActive = visibleItems.some((item) => checkIsActive(item, pathname, activeTabQuery));

        return (
          <div key={group.id} className="space-y-1 pt-1">
            {/* Group Header Button */}
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 select-none cursor-pointer group ${
                isGroupActive
                  ? "bg-blue-50 text-blue-900 border border-blue-100/80 shadow-2xs"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <i
                  className={`${group.icon} text-sm transition-colors ${
                    isGroupActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="uppercase tracking-wider text-[10.5px] font-black">{group.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold ${
                    isGroupActive ? "bg-blue-200/60 text-blue-800" : "bg-slate-200/60 text-slate-500"
                  }`}
                >
                  {visibleItems.length}
                </span>
                <i
                  className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </div>
            </button>

            {/* Sub-items Drawer with CSS Grid Smooth Collapse */}
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
              }`}
            >
              <div className="overflow-hidden space-y-1 pl-2 border-l-2 border-slate-100 ml-3.5 pt-0.5">
                {visibleItems.map((item) => {
                  const isActive = checkIsActive(item, pathname, activeTabQuery);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 group cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                      }`}
                    >
                      <i
                        className={`${item.icon} w-4 text-center text-xs transition-colors ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Component */}
      <aside
        id="sidebar"
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out h-full select-none ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100 flex-shrink-0 justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="bg-blue-600 text-white font-bold p-1.5 rounded-xl w-9 h-9 flex items-center justify-center text-base shadow-sm group-hover:bg-blue-700 transition">
              P
            </div>
            <div>
              <span className="font-black text-base text-slate-900 tracking-tight block leading-tight">
                Potensi Creative
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase block">
                HRIS Portal
              </span>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              className="lg:hidden text-slate-400 hover:text-red-500 transition p-2 cursor-pointer"
              onClick={onCloseMobile}
              aria-label="Tutup Sidebar"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <Suspense fallback={<div className="p-4 text-xs text-slate-400">Memuat menu...</div>}>
          <SidebarNavContent onCloseMobile={onCloseMobile} />
        </Suspense>
      </aside>
    </>
  );
}
