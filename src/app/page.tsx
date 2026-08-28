import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata = {
  title: "Potensi Creative - HRIS & Live Commerce Agency Operations",
  description:
    "Enterprise Human Resource & Talent Management System, Live Stream Operations & Marketplace Platform for Potensi Creative.",
};

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    const role = user.role;
    if (role === "STREAMER") {
      redirect("/streamer-dashboard");
    } else if (role === "STAFF" || role === "OTS") {
      redirect("/staff-dashboard");
    } else if (role === "FINANCE" || role === "FINANCE_MANAGER") {
      redirect("/portal/finance");
    } else if (role === "QC_MANAGER" || role === "QC_REVIEWER") {
      redirect("/portal/qc");
    } else if (role === "TRAINER") {
      redirect("/portal/trainer");
    } else if (role === "CLIENT") {
      redirect("/portal/client");
    } else if (role === "OPERATION") {
      redirect("/portal/operation");
    }
    redirect("/dashboard");
  }

  // Public Homepage for Unauthenticated Users (Required by Google OAuth Review)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25 text-lg">
              P
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-tight">
                POTENSI CREATIVE
              </span>
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest block">
                HRIS & Ops Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition active:scale-95 flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-right-to-bracket" />
              <span>Masuk / Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Enterprise Live Commerce Management System
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl leading-[1.15]">
          Sistem Terpadu Manajemen SDM & Operasional{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400">
            Potensi Creative
          </span>
        </h1>

        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Platform operasional terintegrasi untuk manajemen jadwal siaran live, kehadiran real-time berbasis geolokasi, evaluasi KPI multi-indikator, marketplace host, dan payroll agensi.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-2.5"
          >
            <i className="fa-brands fa-google text-base" />
            <span>Login dengan Akun Google</span>
          </Link>
          <Link
            href="/privacy-policy"
            className="w-full sm:w-auto px-6 py-4 rounded-2xl text-sm font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-shield-halved text-slate-400" />
            <span>Kebijakan Privasi</span>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 backdrop-blur-xs hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl mb-4 border border-blue-500/20">
              <i className="fa-solid fa-video" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Live Stream Operations</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Manajemen jadwal siaran live multi-platform (TikTok, Shopee, Tokopedia), penugasan studio, dan sistem cleaning pasca-live.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 backdrop-blur-xs hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mb-4 border border-emerald-500/20">
              <i className="fa-solid fa-user-check" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Presensi GPS & Swafoto</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Pencatatan absensi digital terverifikasi dengan validasi radius lokasi studio (Timoho, Berbah, Wiyoro) dan kamera langsung.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 backdrop-blur-xs hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mb-4 border border-indigo-500/20">
              <i className="fa-solid fa-chart-line" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Evaluasi KPI & Payroll</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Matriks penilaian 6 pilar performa untuk Streamer dan Operator OTS serta kalkulasi payroll dan komisi otomatis.
            </p>
          </div>
        </div>
      </main>

      {/* Footer (Required by Google Review) */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Potensi Creative. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <Link href="/privacy-policy" className="hover:text-blue-400 transition">
              Kebijakan Privasi (Privacy Policy)
            </Link>
            <Link href="/terms-of-service" className="hover:text-blue-400 transition">
              Ketentuan Layanan (Terms of Service)
            </Link>
            <a href="mailto:paundra.afif@gmail.com" className="hover:text-blue-400 transition">
              Kontak Dukungan: paundra.afif@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
