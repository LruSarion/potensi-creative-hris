"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/enums";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  section?: string;
};

const NAV_ITEMS: NavItem[] = [
  // Overview
  { href: "/dashboard", label: "Overview Utama", icon: "fa-chart-pie", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "QC_MANAGER", "QC_REVIEWER", "TRAINER", "CLIENT", "STREAMER", "STAFF", "OTS"], section: "Menu Utama" },
  { href: "/streamer-dashboard", label: "Streamer Hub", icon: "fa-video", roles: ["STREAMER"], section: "Menu Utama" },
  { href: "/staff-dashboard", label: "Staff & OTS Hub", icon: "fa-id-badge", roles: ["STAFF", "OTS"], section: "Menu Utama" },

  // Operasional
  { href: "/input-jadwal", label: "Jadwal Live", icon: "fa-calendar-plus", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"], section: "Operasional & Jadwal" },
  { href: "/input-karyawan", label: "Data Karyawan", icon: "fa-user-plus", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], section: "Operasional & Jadwal" },
  { href: "/client", label: "Brand & Klien", icon: "fa-building", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"], section: "Operasional & Jadwal" },
  { href: "/view-data", label: "Master Data Explorer", icon: "fa-database", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], section: "Operasional & Jadwal" },
  { href: "/analytics-gmv", label: "Analytics GMV Bulanan", icon: "fa-chart-line", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "FINANCE_MANAGER", "CLIENT", "CLIENT_ADMIN"], section: "Operasional & Jadwal" },
  { href: "/approval", label: "Approval Center", icon: "fa-check-double", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT"], section: "Operasional & Jadwal" },

  // Pengajuan & SDM
  { href: "/pengajuan-izin", label: "Pengajuan Izin", icon: "fa-file-signature", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER"], section: "SDM & Kompensasi" },
  { href: "/pengajuan-lembur", label: "Pengajuan Lembur", icon: "fa-clock", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER"], section: "SDM & Kompensasi" },
  { href: "/tukar-shift", label: "Tukar Shift Live", icon: "fa-arrows-rotate", roles: ["STREAMER", "STAFF", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], section: "SDM & Kompensasi" },
  { href: "/penilaian-sdm", label: "Evaluasi KPI Host", icon: "fa-star", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "QC_MANAGER", "QC_REVIEWER"], section: "SDM & Kompensasi" },
  { href: "/payroll", label: "Payroll & Kompensasi", icon: "fa-money-bill-wave", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"], section: "SDM & Kompensasi" },
  { href: "/finance-insentif", label: "Rekap Denda & Insentif Pelapor", icon: "fa-receipt", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"], section: "SDM & Kompensasi" },
  { href: "/suara-karyawan", label: "Suara Karyawan", icon: "fa-comment-dots", roles: ["STREAMER", "STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "FINANCE", "QC_REVIEWER"], section: "SDM & Kompensasi" },

  // Portals
  { href: "/portal/operation", label: "Portal Operations", icon: "fa-sliders", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], section: "Portals Khusus" },
  { href: "/portal/finance", label: "Portal Keuangan", icon: "fa-wallet", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"], section: "Portals Khusus" },
  { href: "/portal/qc", label: "Portal Quality Control", icon: "fa-clipboard-check", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "QC_MANAGER", "QC_REVIEWER"], section: "Portals Khusus" },
  { href: "/portal/trainer", label: "Portal Trainer", icon: "fa-chalkboard-user", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "TRAINER"], section: "Portals Khusus" },
  { href: "/portal/trainer/learning-test", label: "Materi Video Interaktif", icon: "fa-circle-play", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "TRAINER"], section: "Portals Khusus" },
  { href: "/portal/trainer/hasil-jawaban", label: "Hasil Jawaban Streamer", icon: "fa-file-circle-check", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "TRAINER"], section: "Portals Khusus" },
  { href: "/portal/client", label: "Portal Klien & Proyek Saya", icon: "fa-briefcase", roles: ["SUPER_ADMIN", "CLIENT", "CLIENT_ADMIN"], section: "Portals Khusus" },
  { href: "/streamer-directory", label: "Direktori Streamer & Sertifikasi", icon: "fa-address-book", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "TRAINER", "CLIENT", "CLIENT_ADMIN"], section: "Portals Khusus" },
  { href: "/pipeline", label: "Marketplace Pipeline", icon: "fa-diagram-project", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "CLIENT", "CLIENT_ADMIN"], section: "Portals Khusus" },
  { href: "/sop-management", label: "Manajemen SOP & Tugas", icon: "fa-clipboard-list", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"], section: "Portals Khusus" },
  { href: "/migration", label: "Impor Data Lama (Excel/CSV)", icon: "fa-file-import", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"], section: "Portals Khusus" },
  { href: "/qc-violations", label: "Pelanggaran QC Live", icon: "fa-shield-halved", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "QC_MANAGER", "QC_REVIEWER", "TRAINER"], section: "Portals Khusus" },
  { href: "/portal/streamer", label: "Marketplace Proyek", icon: "fa-store", roles: ["STREAMER", "OTS", "SUPER_ADMIN"], section: "Portals Khusus" },
  { href: "/portal/streamer/lms", label: "LMS & Akademi Host", icon: "fa-graduation-cap", roles: ["SUPER_ADMIN", "STREAMER", "OTS"], section: "Portals Khusus" },
  { href: "/admin", label: "Admin Console", icon: "fa-shield-halved", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"], section: "Portals Khusus" },
  { href: "/history-log", label: "Audit & History Log", icon: "fa-clock-rotate-left", roles: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"], section: "Portals Khusus" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "SUPER_ADMIN") as Role;

  const visible = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const sections = Array.from(new Set(visible.map((item) => item.section ?? "General")));

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none text-slate-300 flex-shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 flex-shrink-0 bg-slate-950/60 gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
          <i className="fa-solid fa-bolt text-sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tight text-white leading-tight">POTENSI CREATIVE</span>
          <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase">Live Agency ERP</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {sections.map((sec) => (
          <div key={sec} className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {sec}
            </div>
            {visible
              .filter((item) => (item.section ?? "General") === sec)
              .map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                    }`}
                  >
                    <i
                      className={`fa-solid ${item.icon} w-4 text-center text-xs transition-transform group-hover:scale-110 ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 uppercase">
            {(session?.user?.name ?? session?.user?.email ?? "U")[0]}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-200 truncate">
              {session?.user?.name ?? session?.user?.email ?? "Pengguna"}
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate capitalize">
              {session?.user?.role?.toLowerCase() ?? "staff"}
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Keluar"
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition flex-shrink-0"
        >
          <i className="fa-solid fa-right-from-bracket text-xs" />
        </button>
      </div>
    </aside>
  );
}
