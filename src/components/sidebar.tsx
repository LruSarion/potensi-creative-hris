"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense } from "react";
import type { Role } from "@/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
};

export const MENU_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "fa-solid fa-table-cells-large",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "QC_MANAGER", "QC_REVIEWER", "STREAMER", "STAFF", "OTS", "CLIENT"],
  },
  {
    href: "/streamer-dashboard",
    label: "Streamer Dashboard",
    icon: "fa-solid fa-video",
    roles: ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
  {
    href: "/lms",
    label: "LMS Akademi",
    icon: "fa-solid fa-graduation-cap",
    roles: ["STREAMER", "TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "STAFF", "OTS"],
  },
  {
    href: "/portal/trainer",
    label: "Kelola Kelas (Trainer)",
    icon: "fa-solid fa-chalkboard-user",
    roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: "fa-solid fa-store",
    roles: ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"],
  },
  {
    href: "/staff-dashboard",
    label: "Staff Dashboard",
    icon: "fa-solid fa-id-badge",
    roles: ["STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  },
  {
    href: "/pengajuan-lembur",
    label: "Pengajuan Lembur",
    icon: "fa-regular fa-clock",
    roles: ["STAFF", "OTS", "TRAINER", "FINANCE", "FINANCE_MANAGER", "QC_REVIEWER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
  {
    href: "/pengajuan-izin",
    label: "Pengajuan Cuti/Izin",
    icon: "fa-regular fa-calendar-xmark",
    roles: ["STREAMER", "STAFF", "OTS", "TRAINER", "FINANCE", "FINANCE_MANAGER", "QC_REVIEWER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
  {
    href: "/tukar-shift",
    label: "Tukar Shift",
    icon: "fa-solid fa-right-left",
    roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
  {
    href: "/suara-karyawan",
    label: "Suara Karyawan",
    icon: "fa-regular fa-comment-dots",
    roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "FINANCE", "FINANCE_MANAGER", "QC_REVIEWER"],
  },
  {
    href: "/approval",
    label: "Approval",
    icon: "fa-regular fa-square-check",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"],
  },
  {
    href: "/penilaian-sdm",
    label: "Penilaian SDM",
    icon: "fa-regular fa-star",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER"],
  },
  {
    href: "/qc-violations",
    label: "Log Pelanggaran QC",
    icon: "fa-solid fa-shield-halved",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: "fa-solid fa-money-bill-wave",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"],
  },
  {
    href: "/input-karyawan",
    label: "Input Karyawan",
    icon: "fa-solid fa-user-plus",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  },
  {
    href: "/input-jadwal",
    label: "Input Jadwal",
    icon: "fa-regular fa-calendar-plus",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"],
  },
  {
    href: "/view-data",
    label: "View Data",
    icon: "fa-solid fa-database",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
  {
    href: "/client",
    label: "Client",
    icon: "fa-solid fa-handshake",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"],
  },
  {
    href: "/master-data",
    label: "Master Data",
    icon: "fa-solid fa-gear",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  },
  {
    href: "/rules",
    label: "Rules Operasional",
    icon: "fa-solid fa-gavel",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"],
  },
  {
    href: "/history-log",
    label: "History Log",
    icon: "fa-solid fa-clock-rotate-left",
    roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"],
  },
];

function isItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarNavContent({
  onCloseMobile,
  isCollapsed,
}: {
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "SUPER_ADMIN") as Role;

  const visibleItems = MENU_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className={`flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar ${isCollapsed ? "px-2" : "px-3"}`}>
      {visibleItems.map((item) => {
        const active = isItemActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onCloseMobile}
            title={isCollapsed ? item.label : undefined}
            className={`group relative flex items-center rounded-xl transition-all duration-150 ${
              isCollapsed
                ? "justify-center w-10 h-10 mx-auto"
                : "gap-3 px-3.5 py-2.5 text-xs sm:text-sm font-semibold"
            } ${
              active
                ? "bg-[#941A0B] text-white shadow-md shadow-[#941A0B]/20"
                : "text-[#4D4D4D] hover:bg-[#F1F1F1] hover:text-[#000000]"
            }`}
          >
            <i className={`${item.icon} text-base shrink-0 ${active ? "text-white" : "text-[#919191] group-hover:text-[#000000]"}`} />
            
            {!isCollapsed && <span className="truncate">{item.label}</span>}

            {/* Hover Tooltip when collapsed */}
            {isCollapsed && (
              <span className="fixed left-20 z-50 pointer-events-none hidden group-hover:inline-block px-2.5 py-1 text-xs font-bold text-white bg-slate-900 rounded-lg shadow-lg whitespace-nowrap animate-fadeIn">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  isOpen,
  mobileOpen,
  onClose,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: {
  isOpen?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const isMenuOpen = isOpen ?? mobileOpen ?? false;
  const handleClose = onClose ?? onCloseMobile;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
          onClick={handleClose}
        />
      )}

      {/* Main Sidebar Aside */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-200 ease-in-out lg:static lg:z-auto shrink-0 ${
          isCollapsed ? "lg:w-[68px]" : "lg:w-60"
        } ${
          isMenuOpen ? "translate-x-0 w-60" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center border-b border-[#E2E8F0] bg-white transition-all duration-200 ${
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        }`}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#941A0B] flex items-center justify-center font-black text-white shadow-md shadow-[#941A0B]/30 text-sm shrink-0">
              P
            </div>
            {!isCollapsed && (
              <span className="font-bold text-[#000000] text-sm tracking-tight block leading-tight truncate">
                Potensi Creative
              </span>
            )}
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={handleClose}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Navigation Menus (No Logout at bottom) */}
        <Suspense fallback={<div className="p-4 text-xs text-[#94A3B8]">Memuat menu...</div>}>
          <SidebarNavContent onCloseMobile={handleClose} isCollapsed={isCollapsed} />
        </Suspense>
      </aside>
    </>
  );
}
