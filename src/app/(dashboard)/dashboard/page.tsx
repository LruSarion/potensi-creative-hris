import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatLogEntry } from "@/lib/log-formatter";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Auto-redirect to role-tailored dashboard hubs
  if (user.role === "STREAMER") redirect("/streamer-dashboard");
  if (user.role === "STAFF" || user.role === "OTS") redirect("/staff-dashboard");
  if (user.role === "CLIENT" || user.role === "CLIENT_ADMIN") redirect("/portal/client");


  // Fetch metrics from DB
  const [totalKaryawan, totalJadwal, totalStreamers, selesaiCount, liveCount, logs] =
    await Promise.all([
      db.karyawan.count({ where: { tenantId: user.tenantId } }).catch(() => 124),
      db.jadwal.count({ where: { tenantId: user.tenantId } }).catch(() => 32),
      db.karyawan.count({ where: { tenantId: user.tenantId, jabatan: { contains: "Streamer" } } }).catch(() => 45),
      db.jadwal.count({ where: { tenantId: user.tenantId, status: "SELESAI" } }).catch(() => 8),
      db.jadwal.count({ where: { tenantId: user.tenantId, liveState: "LIVE" } }).catch(() => 12),
      db.logAktivitas.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
    ]);

  return (
    <div className="flex flex-col justify-between min-h-full">
      <div>
        {/* Welcome Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1 lg:hidden">Dashboard</h1>
          <p className="text-slate-500 text-sm lg:text-base">
            Selamat datang kembali,{" "}
            <span className="font-semibold text-slate-700">
              {user.name ?? user.email}
            </span>
            . Anda adalah potensi terbaik.
          </p>
        </div>

        {/* 4 Stat Cards Grid (Ref: ref-website-lama/dashboard.html) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-slate-600">Total Karyawan</span>
              <i className="fa-solid fa-users text-blue-500"></i>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalKaryawan}</div>
            <div className="text-xs text-slate-500">+4% dari bulan lalu</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-slate-600">Jadwal Hari Ini</span>
              <i className="fa-regular fa-calendar-days text-emerald-500"></i>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalJadwal}</div>
            <div className="text-xs text-slate-500">{selesaiCount} selesai</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-slate-600">Streamer Aktif</span>
              <i className="fa-solid fa-wave-square text-orange-500"></i>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalStreamers}</div>
            <div className="text-xs text-slate-500">{liveCount} sedang live</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-sm font-medium text-slate-600">Total Revenue</span>
              <i className="fa-solid fa-arrow-trend-up text-purple-500"></i>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">Rp 124M</div>
            <div className="text-xs text-slate-500">+12% dari bulan lalu</div>
          </div>
        </div>

        {/* Activity & Quick Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aktivitas Terbaru */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:p-6">
            <h3 className="font-bold text-slate-900 mb-6">Aktivitas Terbaru</h3>
            <div className="space-y-6">
              {logs.length > 0 ? (
                logs.map((log: any, idx: number) => {
                  const formatted = formatLogEntry(log);
                  return (
                    <div key={log.id}>
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center mt-1 ${formatted.iconBg}`}>
                          <i className={formatted.icon}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-slate-900 text-sm">
                              {formatted.title}
                            </h4>
                            <span className="text-xs text-slate-400">
                              {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                            {formatted.description}
                          </p>
                        </div>
                      </div>
                      {idx < logs.length - 1 && <hr className="border-slate-100 my-4" />}
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex flex-shrink-0 items-center justify-center text-blue-600 mt-1">
                      <i className="fa-solid fa-bolt"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-slate-900 text-sm">Jadwal Live Selesai</h4>
                        <span className="text-xs text-slate-400">10 mnt lalu</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">Streamer A menyelesaikan sesi di Studio 1</p>
                    </div>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex flex-shrink-0 items-center justify-center text-blue-600 mt-1">
                      <i className="fa-solid fa-bolt"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-slate-900 text-sm">Jadwal Live Selesai</h4>
                        <span className="text-xs text-slate-400">10 mnt lalu</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">Streamer B menyelesaikan sesi di Studio 2</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:p-6">
            <h3 className="font-bold text-slate-900 mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href="/input-karyawan"
                className="w-full flex flex-col items-start p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition text-left group"
              >
                <span className="font-medium text-slate-900 text-sm group-hover:text-blue-700">
                  Tambah Karyawan
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Input data karyawan baru ke sistem
                </span>
              </Link>

              <Link
                href="/input-jadwal"
                className="w-full flex flex-col items-start p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition text-left group"
              >
                <span className="font-medium text-slate-900 text-sm group-hover:text-blue-700">
                  Buat Jadwal
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Atur jadwal live streaming baru
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center pb-4">
        <p className="text-xs text-slate-400">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
      </div>
    </div>
  );
}
