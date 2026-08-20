"use client";

import { useEffect, useState } from "react";

const PLATFORMS = ["Shopee Live", "TikTok Shop", "Tokopedia Live", "Lazada Live"];
const STUDIOS = [
  { name: "Studio Timoho 1", cabang: "Timoho", no: "01" },
  { name: "Studio Timoho 2", cabang: "Timoho", no: "02" },
  { name: "Studio Berbah 1", cabang: "Berbah", no: "01" },
  { name: "Studio Berbah 2", cabang: "Berbah", no: "02" },
  { name: "Studio Wiyoro 1", cabang: "Wiyoro", no: "01" },
];

export default function InputJadwalPage() {
  const [streamers, setStreamers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [recentJadwal, setRecentJadwal] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  const [form, setForm] = useState({
    idJadwal: "",
    tanggal: new Date().toISOString().slice(0, 10),
    platform: "Shopee Live",
    clientId: "",
    streamerKaryawanId: "",
    cabangStudio: "Timoho",
    nomorStudio: "01",
    jamMulaiLive: "",
    jamSelesaiLive: "",
    judulLive: "",
    produkPrioritas: "",
    promoLive: "",
  });

  const [batch, setBatch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateIdJadwal(form.tanggal);
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [empRes, clientRes, jadwalRes] = await Promise.all([
        fetch("/api/employees").then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()).catch(() => ({ status: "success", data: [] })),
        fetch("/api/jadwal").then((r) => r.json()),
      ]);

      if (empRes.status === "success") setStreamers(empRes.data);
      if (clientRes.status === "success") setClients(clientRes.data);
      if (jadwalRes.status === "success") setRecentJadwal(jadwalRes.data.slice(0, 10));
    } catch {
      // ignore
    }
  }

  function generateIdJadwal(dateStr: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    setForm((f) => ({ ...f, idJadwal: `JDS/${yy}${mm}${dd}/${rand}` }));
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      tanggal: val,
      jamMulaiLive: val ? `${val}T10:00` : "",
      jamSelesaiLive: val ? `${val}T13:00` : "",
    }));
    generateIdJadwal(val);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Jadwal ${form.idJadwal} berhasil dibuat! (Token jeda istirahat 30 mnt lolos validasi).`);
        generateIdJadwal(form.tanggal);
        fetchData();
      } else {
        setError(d.message ?? "Gagal membuat jadwal");
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat menyimpan jadwal");
    } finally {
      setLoading(false);
    }
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let rows: any[];
      try {
        rows = JSON.parse(batch);
      } catch {
        setError("Batch harus berupa format JSON array yang valid");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Batch berhasil diimpor (${d.data.length} jadwal streaming)!`);
        setBatch("");
        fetchData();
      } else {
        setError(d.message ?? "Gagal mengimpor batch jadwal");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen & Input Jadwal Streaming</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Plotting shift live streamer, alokasi studio, platform e-commerce, dan validasi jeda token istirahat.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "single" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Formulir Satuan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "batch" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Impor Massal (JSON)
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

      {/* Single Form Tab */}
      {activeTab === "single" && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* ID Jadwal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">ID Jadwal</label>
                <button
                  type="button"
                  onClick={() => generateIdJadwal(form.tanggal)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Acak Ulang
                </button>
              </div>
              <input
                type="text"
                value={form.idJadwal}
                onChange={(e) => setForm({ ...form, idJadwal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Tanggal Live */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Sesi
              </label>
              <input
                type="date"
                value={form.tanggal}
                onChange={handleDateChange}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Platform Marketplace
              </label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Streamer Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Streamer / Host
              </label>
              <select
                value={form.streamerKaryawanId}
                onChange={(e) => setForm({ ...form, streamerKaryawanId: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                <option value="">-- Pilih Streamer --</option>
                {streamers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaLengkap} ({s.idKaryawan}) - {s.jabatan ?? "Streamer"}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Brand */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Klien
              </label>
              <select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                <option value="">-- Pilih Klien / Brand --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.namaClient} {c.platform ? `(${c.platform})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Studio Room */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Lokasi Studio
              </label>
              <select
                value={`${form.cabangStudio}-${form.nomorStudio}`}
                onChange={(e) => {
                  const [cabang, no] = e.target.value.split("-");
                  setForm({ ...form, cabangStudio: cabang, nomorStudio: no });
                }}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
              >
                {STUDIOS.map((s) => (
                  <option key={s.name} value={`${s.cabang}-${s.no}`}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Jam Mulai */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Waktu Mulai Live
              </label>
              <input
                type="datetime-local"
                value={form.jamMulaiLive}
                onChange={(e) => setForm({ ...form, jamMulaiLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Jam Selesai */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Waktu Selesai Live
              </label>
              <input
                type="datetime-local"
                value={form.jamSelesaiLive}
                onChange={(e) => setForm({ ...form, jamSelesaiLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>

            {/* Judul Live Campaign */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Judul Sesi / Campaign
              </label>
              <input
                type="text"
                placeholder="mis. Mega Flash Sale 8.8"
                value={form.judulLive}
                onChange={(e) => setForm({ ...form, judulLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {/* Produk Prioritas */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Produk Prioritas & Brief
              </label>
              <input
                type="text"
                placeholder="SKU Produk Utama, Flash Sale Diskon 50%, Voucher Toko"
                value={form.produkPrioritas}
                onChange={(e) => setForm({ ...form, produkPrioritas: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {/* Promo Live */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Voucher / Promo Code
              </label>
              <input
                type="text"
                placeholder="POTENSI88 / GRATISONGKIR"
                value={form.promoLive}
                onChange={(e) => setForm({ ...form, promoLive: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Aturan Jeda Istirahat (Token 30 Menit) otomatis diverifikasi saat submit.</span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50 text-sm"
            >
              {loading ? "Menyimpan..." : "Simpan & Jadwalkan Sesi"}
            </button>
          </div>
        </form>
      )}

      {/* Batch Import Tab */}
      {activeTab === "batch" && (
        <form onSubmit={submitBatch} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Impor Jadwal Massal (JSON Array)</h2>
            <button
              type="button"
              onClick={() => {
                const sample = [
                  {
                    idJadwal: "JDS/260821/101",
                    tanggal: "2026-08-21",
                    platform: "Shopee Live",
                    jamMulaiLive: "2026-08-21T10:00:00",
                    jamSelesaiLive: "2026-08-21T13:00:00",
                    cabangStudio: "Timoho",
                    nomorStudio: "01",
                    judulLive: "Shopee Live Morning",
                  },
                  {
                    idJadwal: "JDS/260821/102",
                    tanggal: "2026-08-21",
                    platform: "TikTok Shop",
                    jamMulaiLive: "2026-08-21T14:00:00",
                    jamSelesaiLive: "2026-08-21T17:00:00",
                    cabangStudio: "Berbah",
                    nomorStudio: "01",
                    judulLive: "TikTok Afternoon Live",
                  },
                ];
                setBatch(JSON.stringify(sample, null, 2));
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Muat Format Contoh
            </button>
          </div>
          <textarea
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            rows={8}
            placeholder='[{"idJadwal":"JDS/260821/001","tanggal":"2026-08-21","platform":"Shopee Live","jamMulaiLive":"2026-08-21T10:00:00","jamSelesaiLive":"2026-08-21T13:00:00", ...}]'
            className="w-full border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-slate-50"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !batch.trim()}
              className="bg-slate-900 hover:bg-black text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm disabled:opacity-50"
            >
              {loading ? "Mengimpor..." : "Proses Impor Massal (Atomik)"}
            </button>
          </div>
        </form>
      )}

      {/* Recent Schedules Table with Search & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Jadwal Sesi Terdaftar</h3>
            <span className="text-xs text-slate-500">{recentJadwal.length} sesi termonitor</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari ID, Host, Studio..."
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                // Client-side search helper if desired
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID Jadwal</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Studio</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Live State</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJadwal.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{j.idJadwal}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      {j.platform ?? "General"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {j.streamerKaryawan?.namaLengkap ?? "Belum di-assign"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {j.cabangStudio ? `${j.cabangStudio} #${j.nomorStudio ?? "01"}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(j.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(j.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        j.liveState === "LIVE"
                          ? "bg-rose-100 text-rose-700 animate-pulse"
                          : j.liveState === "REVIEW"
                          ? "bg-amber-100 text-amber-700"
                          : j.liveState === "CLOSED"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {j.liveState}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
