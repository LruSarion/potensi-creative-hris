"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";
import { toast } from "@/components/ui/toast";

export default function PayrollPage() {
  const [list, setList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [periode, setPeriode] = useState("Agustus 2026");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  useEffect(() => {
    loadPayroll();
  }, [periode]);

  async function loadPayroll() {
    setError("");
    setLoading(true);
    try {
      const q = periode ? `?periode=${encodeURIComponent(periode)}` : "";
      const [listRes, sumRes] = await Promise.all([
        fetchJson<any[]>(`/api/payroll${q}`),
        fetchJson<any>(`/api/payroll?summary=1&periode=${encodeURIComponent(periode)}`).catch(() => null),
      ]);

      setList(listRes);
      if (sumRes) setSummary(sumRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar payroll");
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculateBatch() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await sendJson<any>("/api/payroll", "POST", {
        action: "compute-batch",
        periode,
      });
      const msg = `Perhitungan payroll untuk ${periode} selesai! (${data.totalStreamers} streamer dihitung).`;
      toast.success(msg);
      setSuccess(msg);
      setCalcModalOpen(false);
      loadPayroll();
    } catch (err) {
      const msg = errorMessage(err, "Gagal memproses perhitungan payroll");
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const rupiah = (val: number | string | undefined) =>
    `Rp ${Number(val ?? 0).toLocaleString("id-ID")}`;

  const [activeTab, setActiveTab] = useState<"payroll" | "atur-gaji" | "history">("payroll");

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/payroll.html */}
      <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Management</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola perhitungan gaji, parameter master, dan riwayat arsip.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <label className="text-sm font-medium text-slate-600 pl-2">Periode Aktif:</label>
          <input
            type="text"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32"
            placeholder="Agustus 2026"
          />
          <button
            onClick={() => setCalcModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <i className="fa-solid fa-bolt" />
            <span>Hitung Gaji</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation persis ref-website-lama/payroll.html */}
      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 mb-6">
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "payroll"
              ? "bg-white border border-slate-300 font-bold text-slate-900 shadow-sm"
              : "text-slate-600 hover:bg-white font-medium"
          }`}
        >
          <i className="fa-solid fa-money-bill-wave" />
          <span>Payroll Bulan Ini</span>
        </button>
        <button
          onClick={() => setActiveTab("atur-gaji")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "atur-gaji"
              ? "bg-white border border-slate-300 font-bold text-slate-900 shadow-sm"
              : "text-slate-600 hover:bg-white font-medium"
          }`}
        >
          <i className="fa-solid fa-sliders" />
          <span>Atur Master Gaji</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "history"
              ? "bg-white border border-slate-300 font-bold text-slate-900 shadow-sm"
              : "text-slate-600 hover:bg-white font-medium"
          }`}
        >
          <i className="fa-solid fa-box-archive" />
          <span>History / Arsip</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Pengeluaran Gaji</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {rupiah(summary?.totalGross ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Periode {periode}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Jam Live Dihitung</div>
          <div className="text-xl font-bold text-blue-600 mt-1">
            {summary?.totalJam ?? 0} <span className="text-sm font-normal text-slate-500">Jam</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Sesi Terjadwal & Hadir</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Jumlah Streamer</div>
          <div className="text-xl font-bold text-purple-600 mt-1">
            {summary?.count ?? 0} <span className="text-sm font-normal text-slate-500">Host</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Menerima Honor Live</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Rata-Rata Rate / Jam</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {rupiah(summary?.avgRate ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Berdasarkan Tiering</div>
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Daftar Payroll Karyawan & Streamer</h3>
          <span className="text-xs text-slate-500">{list.length} data tercatat</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nama Karyawan</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Total Jam Live</th>
                <th className="px-4 py-3">Tier Pencapaian</th>
                <th className="px-4 py-3">Rate / Jam</th>
                <th className="px-4 py-3">Total Gross Pay</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableLoadingState
                  colSpan={7}
                  text="Memuat data rekap payroll..."
                  subtext="Menyelaraskan jam live, insentif tier, dan perhitungan gaji dari server..."
                />
              ) : (
                list.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-800">
                      {p.karyawan?.namaLengkap ?? p.karyawanId}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {p.karyawan?.idKaryawan ?? "-"} • {p.karyawan?.jabatan ?? "Streamer"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.periode}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {Number(p.totalJam).toFixed(1)} Jam
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        p.tier === "High Performer"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : p.tier === "Advance"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : p.tier === "Optimal"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.tier === "Standard"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {p.tier ?? "Standard"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rupiah(p.ratePerJam)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{rupiah(p.grossPay)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedSlip(p)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      Rincian Slip
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
          {list.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400 text-sm">
              Belum ada data payroll untuk periode {periode}. Klik tombol{" "}
              <strong>"Hitung Payroll Periode"</strong> di atas untuk menjalankan kalkulasi otomatis.
            </div>
          )}
        </div>
      </div>

      {/* Calculate Batch Modal */}
      {calcModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Hitung Payroll Otomatis</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sistem akan menghitung total jam live streaming semua host untuk periode{" "}
              <strong>{periode}</strong>, mencocokkan tiering rate, mengintegrasikan lembur yang disetujui, dan menyimpan rekapitulasi gaji.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periode Perhitungan</label>
              <input
                type="text"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCalcModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCalculateBatch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Jalankan Kalkulasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Rincian Slip Honor Streamer</h3>
                <p className="text-xs text-slate-400">Periode: {selectedSlip.periode}</p>
              </div>
              <button
                onClick={() => setSelectedSlip(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Nama Streamer:</span>
                <span className="font-bold text-slate-800">{selectedSlip.karyawan?.namaLengkap}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">ID Karyawan:</span>
                <span className="font-mono text-slate-700">{selectedSlip.karyawan?.idKaryawan}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Tier Pencapaian:</span>
                <span className="font-semibold text-blue-600">{selectedSlip.tier ?? "Standard"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Total Jam Terhitung:</span>
                <span className="font-semibold text-slate-800">{Number(selectedSlip.totalJam).toFixed(1)} Jam</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Tarif / Jam:</span>
                <span className="text-slate-800">{rupiah(selectedSlip.ratePerJam)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-blue-50/70 px-3 rounded-xl">
                <span className="font-bold text-blue-900">Total Take-Home Pay:</span>
                <span className="font-extrabold text-blue-700 text-sm">{rupiah(selectedSlip.grossPay)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSlip(null)}
                className="w-full bg-slate-900 hover:bg-black text-white font-semibold py-2 rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
