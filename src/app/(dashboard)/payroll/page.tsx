"use client";

import { useEffect, useState } from "react";

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
        fetch(`/api/payroll${q}`).then((r) => r.json()),
        fetch(`/api/payroll?summary=1&periode=${encodeURIComponent(periode)}`).then((r) => r.json()),
      ]);

      if (listRes.status === "success") setList(listRes.data);
      else setError(listRes.message ?? "Gagal memuat daftar payroll");

      if (sumRes.status === "success") setSummary(sumRes.data);
    } catch {
      setError("Terjadi kesalahan koneksi saat memuat payroll");
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculateBatch() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compute-batch",
          periode,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Perhitungan payroll untuk ${periode} selesai! (${d.data.totalStreamers} streamer dihitung).`);
        setCalcModalOpen(false);
        loadPayroll();
      } else {
        setError(d.message ?? "Gagal memproses perhitungan payroll");
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  const rupiah = (val: number | string | undefined) =>
    `Rp ${Number(val ?? 0).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kompensasi & Payroll Streamer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Perhitungan gaji berbasis tiering jam live, validasi absensi aktual, lembur, dan slip gaji.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs text-slate-400 font-medium mr-2">Periode:</span>
            <input
              type="text"
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="text-xs font-semibold text-slate-800 outline-none w-28 bg-transparent"
              placeholder="mis. Agustus 2026"
            />
          </div>
          <button
            onClick={() => setCalcModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>Hitung Payroll Periode</span>
          </button>
        </div>
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
              {list.map((p) => (
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
              ))}
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
