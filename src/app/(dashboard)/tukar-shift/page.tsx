"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function TukarShiftPage() {
  const { data: session, status } = useSession();
  const [streamers, setStreamers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({
    requesterId: "",
    targetId: "",
    tanggal: "",
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
        fetch("/api/employees?kategori=STREAMER").then((r) => r.json()),
        fetch("/api/tukar-shift").then((r) => r.json()),
      ]);

      if (empRes.status === "success") {
        setStreamers(empRes.data);
        if (session?.user?.karyawanId) {
          const match = empRes.data.find((e: any) => e.id === session.user.karyawanId);
          if (match) setForm((f) => ({ ...f, requesterId: match.id }));
        }
      }
      if (histRes.status === "success") setHistory(histRes.data);
    } catch {
      // ignore
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.requesterId === form.targetId) {
      setError("Streamer pengganti harus berbeda dari pemohon.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/tukar-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Permintaan tukar shift berhasil diajukan dan menunggu approval!");
        setForm((f) => ({ ...f, targetId: "", tanggal: "", alasan: "" }));
        loadData();
      } else {
        setError(d.message ?? "Gagal mengajukan tukar shift");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, approve: boolean) {
    try {
      const res = await fetch(`/api/tukar-shift?id=${id}&approve=${approve}`, {
        method: "PATCH",
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Tukar shift berhasil ${approve ? "disetujui (jadwal otomatis diperbarui)" : "ditolak"}`);
        loadData();
      } else {
        setError(d.message ?? "Gagal memproses approval");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tukar Shift Siaran Live Streaming</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Penggantian jadwal antar sesama host live streaming. Saat disetujui, jadwal dan payroll otomatis disinkronkan.
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
            <i className="fa-solid fa-arrows-rotate text-blue-600" />
            <span>Form Tukar Shift</span>
          </h3>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Streamer Pemohon (Berhalangan)
              </label>
              <select
                value={form.requesterId}
                onChange={(e) => setForm({ ...form, requesterId: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                required
              >
                <option value="">-- Pilih Streamer Pemohon --</option>
                {streamers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaLengkap} ({s.idKaryawan})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Streamer Pengganti (Target)
              </label>
              <select
                value={form.targetId}
                onChange={(e) => setForm({ ...form, targetId: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                required
              >
                <option value="">-- Pilih Streamer Pengganti --</option>
                {streamers
                  .filter((s) => s.id !== form.requesterId)
                  .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaLengkap} ({s.idKaryawan})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Sesi Live
              </label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Penukaran
              </label>
              <textarea
                rows={3}
                value={form.alasan}
                onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                placeholder="mis. Ada ujian praktikum di kampus, sudah konfirmasi dan disepakati dengan streamer pengganti."
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
                {loading ? "Mengajukan..." : "Ajukan Tukar Shift"}
              </button>
            </div>
          </form>
        </div>

        {/* History Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Daftar Pengajuan Tukar Shift ({history.length})</h3>
            <span className="text-xs text-slate-500">Atomic Schedule Sync</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Pemohon ➔ Pengganti</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800">
                        {t.requester?.namaLengkap ?? t.requesterId}
                      </div>
                      <div className="text-[11px] text-blue-600 font-semibold">
                        ➔ {t.target?.namaLengkap ?? t.targetId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(t.tanggal).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : t.status === "REJECTED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN_OPERASIONAL") ? (
                        t.status === "PENDING" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleAction(t.id, true)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleAction(t.id, false)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Selesai</span>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {t.status === "PENDING" ? "Menunggu Approval" : "Selesai"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada data pengajuan tukar shift.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
