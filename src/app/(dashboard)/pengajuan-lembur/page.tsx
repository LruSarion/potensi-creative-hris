"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function PengajuanLemburPage() {
  const { data: session, status } = useSession();
  const [employees, setEmployees] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({
    karyawanId: "",
    tanggal: "",
    jamMulai: "",
    jamSelesai: "",
    alasan: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function loadData() {
    try {
      const [empRes, histRes] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/lembur").then((r) => r.json()),
      ]);

      if (empRes.status === "success") {
        setEmployees(empRes.data);
        if (session?.user?.karyawanId) {
          const match = empRes.data.find((e: any) => e.id === session.user.karyawanId);
          if (match) setForm((f) => ({ ...f, karyawanId: match.id }));
        }
      }
      if (histRes.status === "success") setHistory(histRes.data);
    } catch {
      // ignore
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/lembur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Pengajuan jam lembur live/operasional berhasil dikirim!");
        setForm((f) => ({ ...f, jamMulai: "", jamSelesai: "", alasan: "" }));
        loadData();
      } else {
        setError(d.message ?? "Gagal mengajukan lembur");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengajuan Lembur (Overtime Live & Support)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Formulir pengajuan jam siaran tambahan di luar jadwal reguler. Lembur dihitung 1.5x tarif per jam.
        </p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <i className="fa-solid fa-clock text-blue-600" />
            <span>Form Lembur Tambahan</span>
          </h3>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Karyawan / Streamer
              </label>
              <select
                value={form.karyawanId}
                onChange={(e) => setForm({ ...form, karyawanId: e.target.value })}
                disabled={session?.user?.role === "STREAMER" || session?.user?.role === "STAFF" || session?.user?.role === "OTS"}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.namaLengkap} ({emp.idKaryawan})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Lembur
              </label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Waktu Mulai
                </label>
                <input
                  type="datetime-local"
                  value={form.jamMulai}
                  onChange={(e) => setForm({ ...form, jamMulai: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Waktu Selesai
                </label>
                <input
                  type="datetime-local"
                  value={form.jamSelesai}
                  onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Lembur / Kebutuhan Brand
              </label>
              <textarea
                rows={3}
                value={form.alasan}
                onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                placeholder="mis. Permintaan khusus Brand Klien untuk perpanjangan Flash Sale Mega Campaign Payday (tambahan 2 jam)."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Kirim Pengajuan Lembur"}
              </button>
            </div>
          </form>
        </div>

        {/* History Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Riwayat Pengajuan Lembur ({history.length})</h3>
            <span className="text-xs text-slate-500">Overtime Log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jam Lembur</th>
                  <th className="px-4 py-3">Alasan</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {h.karyawan?.namaLengkap ?? h.karyawanId}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(h.tanggal).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600">
                      {new Date(h.jamMulai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {new Date(h.jamSelesai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{h.alasan ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          h.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : h.status === "REJECTED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada data pengajuan lembur.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
