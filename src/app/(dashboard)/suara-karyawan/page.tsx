"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Roles that can view the aggregated anonymous feedback board.
const BOARD_ROLES = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

export default function SuaraKaryawanPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canViewBoard = role ? BOARD_ROLES.includes(role) : false;

  const [form, setForm] = useState({
    kategori: "Fasilitas & Perangkat Studio",
    pesan: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    if (canViewBoard) loadSuara();
  }, [canViewBoard]);

  async function loadSuara() {
    try {
      const res = await fetch("/api/suara");
      const d = await res.json();
      if (d.status === "success") setList(d.data);
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
      const res = await fetch("/api/suara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess("Aspirasi Anda berhasil dikirim secara anonim dan akan ditinjau oleh Manajemen.");
        setForm({ kategori: "Fasilitas & Perangkat Studio", pesan: "" });
        loadSuara();
      } else {
        setError(d.message ?? "Gagal mengirim aspirasi");
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suara Karyawan & Kotak Saran Anonim</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sampaikan masukan, kendala fasilitas studio, atau saran perbaikan proses secara 100% anonim dan aman.
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
          <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
            <i className="fa-solid fa-user-secret text-blue-600 text-lg" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Privasi Terjamin:</strong> Identitas pengirim tidak dicatat pada database.
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori Masukan
              </label>
              <select
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="Fasilitas & Perangkat Studio">Fasilitas & Perangkat Studio (Lighting/Mic/PC)</option>
                <option value="Jadwal & Beban Kerja">Jadwal & Beban Kerja Siaran</option>
                <option value="Kompensasi & Payroll">Kompensasi & Payroll</option>
                <option value="Hubungan Kerja & Lingkungan">Hubungan Kerja & Lingkungan Studio</option>
                <option value="Saran Inovasi & Konten">Saran Inovasi & Konten Streaming</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Isi Masukan / Aspirasi
              </label>
              <textarea
                rows={5}
                value={form.pesan}
                onChange={(e) => setForm({ ...form, pesan: e.target.value })}
                placeholder="Tuliskan saran, kritik membangun, atau kendala yang Anda alami secara detail..."
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
                {loading ? "Mengirim..." : "Kirim Aspirasi Anonim"}
              </button>
            </div>
          </form>
        </div>

        {/* List of Feedback (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Aspirasi & Masukan Terkini ({list.length})</h3>
            <span className="text-xs text-slate-500">{canViewBoard ? "Public Feedback Board" : "Submit only"}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {!canViewBoard && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Feedback board hanya dapat dilihat oleh Manajemen. Kirimkan aspirasi Anda melalui form di samping.
              </div>
            )}
            {canViewBoard && list.map((item, idx) => (
              <div key={item.id ?? idx} className="p-4 hover:bg-slate-50/80 transition space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {item.kategori ?? "Umum"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{item.pesan}</p>
              </div>
            ))}
            {canViewBoard && list.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada masukan tersimpan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
