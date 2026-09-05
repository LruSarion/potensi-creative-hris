import Link from "next/link";

const PORTAL_SECTIONS: Record<
  string,
  { title: string; desc: string; tiles: { href: string; label: string; icon: string }[] }[]
> = {
  streamer: [
    {
      title: "Jadwal & Kompensasi",
      desc: "Jadwal live streaming Anda, presensi check-in/out, dan rekap honor.",
      tiles: [
        { href: "/streamer-dashboard", label: "Dashboard Streamer", icon: "fa-video" },
        { href: "/tukar-shift", label: "Tukar Shift", icon: "fa-arrows-rotate" },
        { href: "/portal/streamer", label: "Marketplace Proyek", icon: "fa-store" },
        { href: "/portal/streamer/lms", label: "Akademi & Pelatihan (LMS)", icon: "fa-graduation-cap" },
      ],
    },
  ],
  client: [
    {
      title: "Monitoring Brand & Penagihan",
      desc: "Jadwal siaran brand, persetujuan plotting, dan faktur invoice.",
      tiles: [
        { href: "/portal/client", label: "Dashboard Brand Client", icon: "fa-chart-line" },
        { href: "/input-jadwal", label: "Jadwal Siaran Live", icon: "fa-calendar" },
        { href: "/approval", label: "Pusat Persetujuan", icon: "fa-check-double" },
      ],
    },
  ],
  operation: [
    {
      title: "Manajemen Operasional",
      desc: "Plotting jadwal live, presensi staff, roster, dan incident management.",
      tiles: [
        { href: "/portal/operation", label: "Operation Board", icon: "fa-sliders" },
        { href: "/input-jadwal", label: "Input Jadwal Siaran", icon: "fa-calendar-plus" },
        { href: "/approval", label: "Persetujuan Jadwal", icon: "fa-check-double" },
        { href: "/staff-dashboard", label: "Staff & OTS Hub", icon: "fa-id-badge" },
      ],
    },
  ],
  trainer: [
    {
      title: "Pelatihan & Onboarding",
      desc: "Kelola modul kursus, kurikulum live selling, dan evaluasi peserta.",
      tiles: [
        { href: "/portal/trainer", label: "Kurikulum & Modul Kursus", icon: "fa-graduation-cap" },
      ],
    },
  ],
  qc: [
    {
      title: "Audit Kualitas Siaran (QC)",
      desc: "Audit performa live streaming, rubrik penilaian, dan checklist SOP studio.",
      tiles: [
        { href: "/portal/qc", label: "Pusat Review QC", icon: "fa-clipboard-check" },
        { href: "/penilaian-sdm", label: "Penilaian SDM Host", icon: "fa-star" },
      ],
    },
  ],
  finance: [
    {
      title: "Keuangan & Payroll",
      desc: "Kompensasi streamer, payout runs batch, penagihan klien, dan P&L.",
      tiles: [
        { href: "/portal/finance", label: "Portal Keuangan Agency", icon: "fa-wallet" },
        { href: "/payroll", label: "Kalkulasi Payroll Streamer", icon: "fa-money-bill-wave" },
      ],
    },
  ],
};

export default function PortalLander({ portal }: { portal: string }) {
  const sections = PORTAL_SECTIONS[portal] ?? [
    { title: "Modul", desc: "Pilih modul untuk memulai.", tiles: [{ href: "/dashboard", label: "Kembali ke Dashboard", icon: "fa-arrow-left" }] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Operasional Khusus</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Akses cepat modul dan dashboard yang disesuaikan dengan peran kerja Anda.
        </p>
      </div>

      {sections.map((sec) => (
        <div key={sec.title} className="space-y-3">
          <div>
            <h2 className="font-bold text-slate-800 text-base">{sec.title}</h2>
            <p className="text-xs text-slate-500">{sec.desc}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sec.tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition group flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-base flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                  <i className={`fa-solid ${t.icon}`} />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">{t.label}</div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Buka Modul →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}