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
    label: "Dashboard Utama",
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
    label: "Pusat Pelatihan (LMS)",
    icon: "fa-solid fa-graduation-cap",
    items: [
      { href: "/portal/streamer/lms", label: "Modul & Ujian Streamer", icon: "fa-solid fa-book-open-reader", roles: ["STREAMER", "STAFF", "OTS", "TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/portal/trainer/learning-test", label: "Kelola Materi & Ujian", icon: "fa-solid fa-pen-to-square", roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
      { href: "/portal/trainer/hasil-jawaban", label: "Hasil Ujian & Quiz", icon: "fa-solid fa-square-poll-vertical", roles: ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"] },
    ],
  },
  {
    id: "finance",
    label: "Finance & Keuangan",
    icon: "fa-solid fa-wallet",
    items: [
      { href: "/payroll", label: "Payroll & Gaji Streamer", icon: "fa-solid fa-money-bill-wave", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"] },
      { href: "/finance-insentif", label: "Rekap Insentif & Denda", icon: "fa-solid fa-receipt", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"] },
      { href: "/analytics-gmv", label: "Analytics & Laporan GMV", icon: "fa-solid fa-chart-line", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "CLIENT"] },
    ],
  },
  {
    id: "fitur_lanjutan",
    label: "Fitur Lanjutan & Pengaturan",
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
      const hasActiveChild = group.items.some((item) => {
        if (item.roles.includes(role)) {
          if (item.href.startsWith("/pengajuan")) {
            return pathname === "/pengajuan" || pathname.startsWith("/pengajuan");
          }
          return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        }
        return false;
      });
      if (hasActiveChild) {
        initialOpen[group.id] = true;
      }
    });
    setOpenGroups((prev) => ({ ...initialOpen, ...prev }));
  }, [pathname, role]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll py-4 px-3 space-y-3 custom-scrollbar">
      {NAV_GROUPS.map((group) => {
        // Filter items matching user's role
        const visibleItems = group.items.filter((item) => item.roles.includes(role));
        if (visibleItems.length === 0) return null;

        const isOpen = openGroups[group.id] ?? true; // Default to open for clean UX

        // Check if group contains current active path
        const isGroupActive = visibleItems.some((item) => {
          if (item.href.startsWith("/pengajuan")) {
            return pathname === "/pengajuan" || pathname.startsWith("/pengajuan");
          }
          return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        });

        return (
          <div key={group.id} className="space-y-1">
            {/* Group Header Button */}
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition select-none ${
                isGroupActive
                  ? "bg-blue-50/80 text-blue-900 border border-blue-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <i className={`${group.icon} text-sm ${isGroupActive ? "text-blue-600" : "text-slate-400"}`} />
                <span className="uppercase tracking-wider text-[11px] font-black">{group.label}</span>
              </div>
              <i
                className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-blue-600" : "text-slate-400"
                }`}
              />
            </button>

            {/* Group Sub-Items */}
            {isOpen && (
              <div className="space-y-1 pl-2 border-l-2 border-slate-100 ml-3 pt-0.5">
                {visibleItems.map((item) => {
                  let isActive = false;

                  if (item.href.startsWith("/pengajuan")) {
                    if (pathname === "/pengajuan") {
                      if (item.tabKey) {
                        isActive = activeTabQuery === item.tabKey;
                      } else {
                        isActive = !activeTabQuery;
                      }
                    }
                  } else {
                    isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                      }`}
                    >
                      <i
                        className={`${item.icon} w-4 text-center ${
                          isActive ? "text-white" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
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
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Component */}
      <aside
        id="sidebar"
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-300 h-full ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0 justify-between">
          <div className="flex items-center">
            <div className="bg-blue-600 text-white font-bold p-1.5 rounded-lg w-8 h-8 flex items-center justify-center mr-3 text-sm">
              P
            </div>
            <span className="font-bold text-lg text-slate-900">Potensi Creative</span>
          </div>
          {onCloseMobile && (
            <button
              className="lg:hidden text-slate-400 hover:text-red-500 transition"
              onClick={onCloseMobile}
              aria-label="Tutup Sidebar"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <Suspense fallback={<div className="p-4 text-xs text-slate-400">Loading sidebar...</div>}>
          <SidebarNavContent onCloseMobile={onCloseMobile} />
        </Suspense>
      </aside>
    </>
  );
}
