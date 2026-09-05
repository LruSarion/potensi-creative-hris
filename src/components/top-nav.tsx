"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import LogoutConfirmModal from "@/components/logout-confirm-modal";

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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [fallbackKaryawan, setFallbackKaryawan] = useState<{ idKaryawan: string | null; jabatan: string | null } | null>(null);

  // Fallback fetch for idKaryawan | jabatan if session token is stale (before migration)
  useEffect(() => {
    const sessUser = session?.user as { idKaryawan?: string | null; nik?: string | null; jabatan?: string | null } | undefined;
    const hasId = Boolean(sessUser?.idKaryawan);
    const hasJabatan = Boolean(sessUser?.jabatan);
    if (session?.user && (!hasId || !hasJabatan)) {
      let cancelled = false;
      fetch("/api/streamer-profile-card", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.karyawan) {
            setFallbackKaryawan({ idKaryawan: data.karyawan.idKaryawan ?? null, jabatan: data.karyawan.jabatan ?? null });
          }
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    } else if (hasId && hasJabatan) {
      setFallbackKaryawan(null);
    }
  }, [session?.user]);

  const displayName = session?.user?.name ?? "Henry Setyawan";
  const sessAny = session?.user as { idKaryawan?: string | null; nik?: string | null; jabatan?: string | null; role?: string } | undefined;
  const idKaryawanDisplay = sessAny?.idKaryawan ?? fallbackKaryawan?.idKaryawan ?? sessAny?.nik ?? "—";
  const jabatanDisplay =
    sessAny?.jabatan ?? fallbackKaryawan?.jabatan ?? (sessAny?.role ? String(sessAny.role).replace(/_/g, " ") : "—");

  const pathTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/streamer-dashboard": "Streamer Dashboard",
    "/lms": "LMS Akademi & Sertifikasi",
    "/marketplace": "Marketplace",
    "/staff-dashboard": "Staff Dashboard",
    "/pengajuan-lembur": "Pengajuan Lembur",
    "/pengajuan-izin": "Pengajuan Cuti/Izin",
    "/tukar-shift": "Tukar Shift",
    "/suara-karyawan": "Suara Karyawan",
    "/approval": "Approval",
    "/penilaian-sdm": "Penilaian SDM",
    "/qc-violations": "Log Pelanggaran QC Live",
    "/portal/trainer": "Trainer Studio & Kelola Kelas",
    "/portal/trainer/learning-test": "Kelola Materi & Ujian Video",
    "/portal/trainer/hasil-jawaban": "Hasil Ujian & Quiz Streamer",
    "/portal/qc": "Portal Quality Control",
    "/payroll": "Payroll",
    "/input-karyawan": "Input Karyawan",
    "/input-jadwal": "Input Jadwal",
    "/view-data": "View Data",
    "/client": "Client",
    "/master-data": "Master Data",
    "/rules": "Rules & Kebijakan Operasional",
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

      {/* User Info & Logout on Top Right — nama lengkap + idKaryawan | jabatan */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right flex flex-col justify-center min-w-0">
          <div className="text-xs sm:text-sm font-bold text-[#000000] leading-tight truncate max-w-[160px] sm:max-w-[220px]">
            {displayName}
          </div>
          <div className="text-[11px] text-[#4D4D4D] font-medium mt-0.5 flex items-center justify-end gap-1.5 truncate max-w-[160px] sm:max-w-[220px]">
            <span className="font-mono font-semibold text-[#000000]">{idKaryawanDisplay}</span>
            <span className="text-[#919191]">|</span>
            <span className="truncate">{jabatanDisplay}</span>
          </div>
        </div>

        <div className="h-8 w-px bg-[#F1F1F1] hidden sm:block" />

        <button
          onClick={() => setLogoutOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#919191] hover:text-white hover:bg-[#941A0B] border border-transparent hover:border-[#941A0B] transition cursor-pointer shrink-0"
          title="Keluar / Logout"
          aria-label="Keluar"
        >
          <i className="fa-solid fa-arrow-right-from-bracket text-[16px]" />
        </button>
      </div>

      <LogoutConfirmModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </header>
  );
}
