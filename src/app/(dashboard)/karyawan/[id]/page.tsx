"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function fmtCur(n: number | null | undefined) {
  if (n == null) return "Rp —";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function diffDays(end: string | null | undefined) {
  if (!end) return null;
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function KaryawanProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [karyawan, setKaryawan] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "payroll" | "violations" | "lms">("info");

  useEffect(() => {
    if (id) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [empRes, statsRes, payRes, violRes, lmsRes] = await Promise.all([
        fetch(`/api/employees?id=${id}`).then((r) => r.json()),
        fetch(`/api/scheduler-tools?view=streamer-stats&karyawanId=${id}`).then((r) => r.json()),
        fetch(`/api/payroll?karyawanId=${id}`).then((r) => r.json()).catch(() => ({ status: "error" })),
        fetch(`/api/qc-violation?karyawanId=${id}`).then((r) => r.json()).catch(() => ({ status: "error" })),
        fetch(`/api/lms?view=enrollments`).then((r) => r.json()).catch(() => ({ status: "error" })),
      ]);
      if (empRes.status === "success") setKaryawan(empRes.data);
      else setError(empRes.message ?? "Karyawan tidak ditemukan");
      if (statsRes.status === "success") setStats(statsRes.data);
      if (payRes.status === "success") setPayrolls(Array.isArray(payRes.data) ? payRes.data.filter((p: any) => p.karyawanId === id) : []);
      if (violRes.status === "success") setViolations((violRes.data ?? []).filter((v: any) => v.streamerKaryawanId === id));
      if (lmsRes.status === "success") setEnrollments((lmsRes.data ?? []).filter((e: any) => e.karyawanId === id));
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-slate-400 flex items-center gap-2">
        <i className="fa-solid fa-spinner animate-spin text-blue-500" />
        Memuat profil karyawan...
      </div>
    </div>
  );
  if (error || !karyawan) return (
    <div className="space-y-4">
      <Link href="/view-data" className="text-sm text-blue-600 hover:underline flex items-center gap-1.5"><i className="fa-solid fa-arrow-left text-xs" /> Kembali</Link>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error || "Karyawan tidak ditemukan"}</div>
    </div>
  );

  const contractDays = diffDays(karyawan.endDate);
  const contractUrgent = contractDays !== null && contractDays <= 30 && contractDays >= 0;
  const totalGmv = payrolls.reduce((s: number, p: any) => s + Number(p.totalGmv ?? 0), 0);
  const totalGross = payrolls.reduce((s: number, p: any) => s + Number(p.grossPay ?? 0), 0);

  const TABS = [
    { key: "info", label: "Profil & Kontrak", icon: "fa-user" },
    { key: "payroll", label: `Riwayat Payroll (${payrolls.length})`, icon: "fa-money-bill-wave" },
    { key: "violations", label: `Pelanggaran (${violations.length})`, icon: "fa-triangle-exclamation" },
    { key: "lms", label: `LMS & Sertifikasi (${enrollments.length})`, icon: "fa-graduation-cap" },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/view-data" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition w-fit">
        <i className="fa-solid fa-arrow-left text-xs" /> Kembali ke Data Explorer
      </Link>

      {/* Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-2xl font-black text-blue-200 shrink-0">
            {karyawan.namaLengkap?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black tracking-tight">{karyawan.namaLengkap}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${karyawan.status === "ACTIVE" || karyawan.statusAktif === "AKTIF" ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-red-500/20 border-red-400/30 text-red-300"}`}>
                {karyawan.statusAktif ?? karyawan.status ?? "AKTIF"}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">{karyawan.jabatan ?? "—"} • <span className="font-mono text-blue-300">{karyawan.idKaryawan}</span></p>
            {karyawan.tags && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {karyawan.tags.split(",").map((t: string, i: number) => (
                  <span key={i} className="text-[10px] bg-blue-500/20 border border-blue-400/20 text-blue-200 px-2 py-0.5 rounded-full">{t.trim()}</span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-lg font-black">{stats?.totalJam ?? "—"}</div>
              <div className="text-[10px] text-slate-300">Jam Bulan Ini</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="text-lg font-black">{violations.filter((v) => v.status === "CLOSED").length}</div>
              <div className="text-[10px] text-slate-300">Pelanggaran</div>
            </div>
            <div className={`rounded-xl p-3 border ${contractUrgent ? "bg-red-500/20 border-red-400/30" : "bg-white/10 border-white/10"}`}>
              <div className={`text-lg font-black ${contractUrgent ? "text-red-300" : ""}`}>
                {contractDays !== null ? `H-${contractDays}` : "—"}
              </div>
              <div className="text-[10px] text-slate-300">Kontrak</div>
            </div>
          </div>
        </div>

        {/* Contract warning */}
        {contractUrgent && (
          <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-xl p-3 flex items-center gap-2 text-xs text-red-300 font-semibold">
            <i className="fa-solid fa-triangle-exclamation" />
            Kontrak akan berakhir dalam {contractDays} hari! ({fmt(karyawan.endDate)}) — Segera proses perpanjangan.
          </div>
        )}
      </div>

      {/* Akumulasi ringkas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total GMV Semua Waktu", value: fmtCur(totalGmv), icon: "fa-chart-line", color: "text-emerald-600" },
          { label: "Total Gross Pay", value: fmtCur(totalGross), icon: "fa-money-bill-wave", color: "text-blue-600" },
          { label: "Tier Saat Ini", value: stats?.activeTier?.nama ?? "—", icon: "fa-layer-group", color: "text-indigo-600" },
          { label: "Pelanggaran Disetujui", value: violations.filter((v) => v.status === "CLOSED").length, icon: "fa-circle-xmark", color: "text-red-500" },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center space-y-1">
            <i className={`fa-solid ${m.icon} ${m.color} text-xl`} />
            <div className="text-lg font-black text-slate-900">{m.value}</div>
            <div className="text-[10px] text-slate-400 leading-tight">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition whitespace-nowrap ${activeTab === t.key ? "text-blue-600 border-blue-600 bg-white shadow-sm" : "text-slate-500 border-transparent hover:text-slate-700"}`}>
            <i className={`fa-solid ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {/* Tab: Info Profil */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Data Pribadi</h3>
            {[
              ["Nama Lengkap", karyawan.namaLengkap],
              ["ID Karyawan", karyawan.idKaryawan],
              ["Jabatan", karyawan.jabatan],
              ["Gender", karyawan.gender],
              ["Tanggal Lahir", fmt(karyawan.tanggalLahir)],
              ["Nomor HP", karyawan.nomorHp],
              ["Email", karyawan.email],
              ["Alamat", karyawan.alamat],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 text-xs">
                <span className="text-slate-500 shrink-0 font-medium">{label}</span>
                <span className="text-slate-800 font-semibold text-right break-all">{val || "—"}</span>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Kontrak & Kepegawaian</h3>
            {[
              ["Jenis Kontrak", karyawan.tipeJadwal ?? karyawan.jenisKontrak],
              ["Tipe Jadwal", karyawan.tipeJadwal],
              ["Tanggal Mulai", fmt(karyawan.startDate)],
              ["Tanggal Berakhir", karyawan.endDate ? `${fmt(karyawan.endDate)} (${contractDays !== null ? `${contractDays} hari lagi` : "—"})` : "—"],
              ["Status", karyawan.statusAktif ?? karyawan.status],
              ["Tags / Klasifikasi", karyawan.tags || "—"],
              ["Bank", karyawan.namaBank],
              ["No. Rekening", karyawan.noRekening],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 text-xs">
                <span className="text-slate-500 shrink-0 font-medium">{label}</span>
                <span className={`font-semibold text-right ${label === "Tanggal Berakhir" && contractUrgent ? "text-red-600" : "text-slate-800"}`}>{val || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Payroll */}
      {activeTab === "payroll" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Riwayat Payroll — {payrolls.length} periode
          </div>
          {payrolls.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400"><i className="fa-solid fa-file-invoice text-2xl text-slate-300 block mb-2" />Belum ada data payroll.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    {["Periode", "Total Jam", "Total GMV", "Gross Pay", "Denda", "Net Pay", "Tier"].map((h) => (
                      <th key={h} className="px-4 py-3 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrolls.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.periode}</td>
                      <td className="px-4 py-3 text-slate-600">{p.totalJam ?? "—"} jam</td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold">{fmtCur(p.totalGmv)}</td>
                      <td className="px-4 py-3 text-blue-700 font-semibold">{fmtCur(p.grossPay)}</td>
                      <td className="px-4 py-3 text-red-600">{fmtCur(p.totalDenda)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{fmtCur(p.netPay)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">{p.tier ?? "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pelanggaran */}
      {activeTab === "violations" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Riwayat Pelanggaran — {violations.length} tercatat
          </div>
          {violations.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400"><i className="fa-solid fa-shield-check text-2xl text-slate-300 block mb-2" />Tidak ada pelanggaran tercatat.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {violations.map((v: any) => (
                <div key={v.id} className="px-5 py-4 flex items-start gap-4">
                  <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${v.severity === "CRITICAL" ? "bg-red-100 text-red-700 border-red-200" : v.severity === "HIGH" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                    {v.severity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-xs">{v.category}</div>
                    {v.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{v.description}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">{fmt(v.createdAt)}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${v.status === "CLOSED" ? "bg-red-100 text-red-700" : v.status === "REVIEWED" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: LMS */}
      {activeTab === "lms" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Progress LMS & Sertifikasi — {enrollments.length} kursus
          </div>
          {enrollments.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400"><i className="fa-solid fa-graduation-cap text-2xl text-slate-300 block mb-2" />Belum terdaftar di kursus manapun.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {enrollments.map((e: any) => (
                <div key={e.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-xs">{e.course?.title}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${e.progressPct}%` }} />
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold">{e.progressPct}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : e.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {e.status}
                    </span>
                    {e.certificates?.length > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-certificate text-[8px]" /> {e.certificates[0].code}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
