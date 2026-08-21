import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import TelegramConnect from "@/components/telegram-connect";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch real agency metrics
  const [totalJadwal, totalStreamers, totalClients, pendingApprovals, onAirStreams] =
    await Promise.all([
      db.jadwal.count({ where: { tenantId: user.tenantId } }).catch(() => 0),
      db.karyawan.count({ where: { tenantId: user.tenantId, jabatan: { contains: "Streamer" } } }).catch(() => 0),
      db.client.count({ where: { tenantId: user.tenantId } }).catch(() => 0),
      db.izin.count({ where: { status: "PENDING" } }).catch(() => 0),
      db.jadwal.count({ where: { tenantId: user.tenantId, liveState: "LIVE" } }).catch(() => 0),
    ]);

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN_OPERASIONAL: "Admin Operasional",
    OPERATION: "Operations Lead",
    STREAMER: "Streamer / Host",
    TRAINER: "Trainer & Lead Coach",
    QC_MANAGER: "QC Manager",
    QC_REVIEWER: "QC Reviewer",
    FINANCE: "Finance & Payroll",
    FINANCE_MANAGER: "Finance Manager",
    CLIENT: "Brand Partner (Client)",
    STAFF: "Staff Operasional",
    OTS: "On-The-Spot Support",
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {roleLabel[user.role] ?? user.role}
              </span>
              <span className="text-xs text-slate-300">Potensi Creative Agency</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Halo, {user.name ?? user.email} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Selamat datang di Command Center Live Streaming Agency. Semua metrik operasional dan performa live streaming diperbarui secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/input-jadwal"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <i className="fa-solid fa-calendar-plus" />
              <span>Plot Jadwal Live</span>
            </Link>
            <Link
              href="/payroll"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-700 flex items-center gap-2"
            >
              <i className="fa-solid fa-money-bill-wave text-emerald-400" />
              <span>Kompensasi & Payroll</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Live On-Air Sekarang</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{onAirStreams}</div>
          <div className="text-[11px] text-slate-400 mt-1">Sesi Aktif di Studio</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Jadwal Siaran</div>
          <div className="text-2xl font-black text-blue-600 mt-2">{totalJadwal}</div>
          <div className="text-[11px] text-slate-400 mt-1">Sesi Terdaftar</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Host / Streamer Aktif</div>
          <div className="text-2xl font-black text-purple-600 mt-2">{totalStreamers}</div>
          <div className="text-[11px] text-slate-400 mt-1">Talent Agency</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Brand Klien Partner</div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{totalClients}</div>
          <div className="text-[11px] text-slate-400 mt-1">Akun Terhubung</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Pending Approval</div>
          <div className="text-2xl font-black text-amber-600 mt-2">{pendingApprovals}</div>
          <div className="text-[11px] text-slate-400 mt-1">Izin / Lembur Menunggu</div>
        </div>
      </div>

      {/* Telegram connect — all roles can bind their personal chat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <TelegramConnect />
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Modul & Navigasi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            title="Jadwal Live Streaming"
            desc="Plotting sesi live streamer, validasi jeda token & studio room"
            href="/input-jadwal"
            icon="fa-calendar-plus"
            color="text-blue-600 bg-blue-50"
          />
          <Card
            title="Kompensasi & Payroll"
            desc="Perhitungan honor berbasis tiering jam aktual & lembur otomatis"
            href="/payroll"
            icon="fa-money-bill-wave"
            color="text-emerald-600 bg-emerald-50"
          />
          <Card
            title="Evaluasi KPI Streamer"
            desc="Penilaian 4 pilar kompetensi agency & rekomendasi tiering"
            href="/penilaian-sdm"
            icon="fa-star"
            color="text-amber-600 bg-amber-50"
          />
          <Card
            title="Portal Keuangan (Finance)"
            desc="Payout runs streamer, factur penagihan klien & kalkulasi P&L"
            href="/portal/finance"
            icon="fa-wallet"
            color="text-teal-600 bg-teal-50"
          />
          <Card
            title="Quality Control (QC)"
            desc="Audit rekaman live streaming, penilaian rubrik & checklist SOP"
            href="/portal/qc"
            icon="fa-clipboard-check"
            color="text-purple-600 bg-purple-50"
          />
          <Card
            title="Akademi LMS & Onboarding"
            desc="Modul pembelajaran interaktif, quiz & panduan produk"
            href="/portal/streamer/lms"
            icon="fa-graduation-cap"
            color="text-indigo-600 bg-indigo-50"
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  desc,
  href,
  icon,
  color,
}: {
  title: string;
  desc: string;
  href: string;
  icon: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition group flex items-start gap-4"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${color}`}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
