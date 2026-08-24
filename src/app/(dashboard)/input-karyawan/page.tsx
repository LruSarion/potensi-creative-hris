"use client";

import { useEffect, useState } from "react";

export default function InputKaryawanPage() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const [form, setForm] = useState({
    idKaryawan: `PCS${Math.floor(100 + Math.random() * 900)}`,
    namaLengkap: "",
    namaPanggilan: "",
    gender: "PEREMPUAN",
    jabatan: "Streamer Host",
    kategori: "STREAMER",
    tipeJadwal: "LIVE",
    nomorTelepon: "",
    email: "",
    namaBank: "BCA",
    nomorRekening: "",
    namaPemilikRek: "",
    emergencyContact: "",
    statusAktif: "AKTIF",
    streamerCutPct: 70,
    agencyCutPct: 30,
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const res = await fetch("/api/employees");
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
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Karyawan/Host "${form.namaLengkap}" berhasil didaftarkan!`);
        setForm({
          idKaryawan: `PCS${Math.floor(100 + Math.random() * 900)}`,
          namaLengkap: "",
          namaPanggilan: "",
          gender: "PEREMPUAN",
          jabatan: "Streamer Host",
          kategori: "STREAMER",
          tipeJadwal: "LIVE",
          nomorTelepon: "",
          email: "",
          namaBank: "BCA",
          nomorRekening: "",
          namaPemilikRek: "",
          emergencyContact: "",
          statusAktif: "AKTIF",
          streamerCutPct: 70,
          agencyCutPct: 30,
        });
        loadEmployees();
      } else {
        setError(d.message ?? "Gagal menyimpan data karyawan");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  const filtered = list.filter((k) => {
    const matchQ =
      k.namaLengkap?.toLowerCase().includes(search.toLowerCase()) ||
      k.idKaryawan?.toLowerCase().includes(search.toLowerCase()) ||
      k.email?.toLowerCase().includes(search.toLowerCase());
    const matchR = filterRole ? k.jabatan?.includes(filterRole) || k.kategori === filterRole : true;
    return matchQ && matchR;
  });

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/input-karyawan.html */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Input Karyawan</h1>
        <p className="text-slate-500 text-sm lg:text-base">Tambahkan data karyawan baru secara kolektif atau perbarui data existing.</p>
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
        {/* Onboarding Form (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <i className="fa-solid fa-user-plus text-blue-600" />
            <span>Form Pendaftaran Karyawan / Host</span>
          </h3>

          <form onSubmit={submit} className="space-y-4">
            {/* Section 1: Profil & Identitas */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                1. Data Pribadi & Akun
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="idKaryawan" className="block text-xs font-semibold text-slate-700 mb-1">ID Karyawan</label>
                  <input
                    id="idKaryawan"
                    type="text"
                    value={form.idKaryawan}
                    onChange={(e) => setForm({ ...form, idKaryawan: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="PEREMPUAN">Perempuan</option>
                    <option value="LAKI_LAKI">Laki-Laki</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="namaLengkap" className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  id="namaLengkap"
                  type="text"
                  value={form.namaLengkap}
                  onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
                  placeholder="mis. Sarah Amalia"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    value={form.nomorTelepon}
                    onChange={(e) => setForm({ ...form, nomorTelepon: e.target.value })}
                    placeholder="081234567890"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="talent@potensicreative.id"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Posisi & Penugasan */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                2. Posisi & Pola Kerja
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan</label>
                  <select
                    value={form.jabatan}
                    onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Streamer Host">Streamer Host</option>
                    <option value="Senior Streamer">Senior Streamer</option>
                    <option value="OTS Studio Support">OTS Studio Support</option>
                    <option value="Operations Lead">Operations Lead</option>
                    <option value="QC Reviewer">QC Reviewer</option>
                    <option value="Trainer & Coach">Trainer & Coach</option>
                    <option value="Finance & Admin">Finance & Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Jadwal</label>
                  <select
                    value={form.tipeJadwal}
                    onChange={(e) => setForm({ ...form, tipeJadwal: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="LIVE">LIVE (Shift Siaran)</option>
                    <option value="SHIFT">SHIFT (Studio/OTS)</option>
                    <option value="OFFICE_HOURS">OFFICE_HOURS (Kantor)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Rekening Payroll */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                3. Rekening Transfer Honor
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank</label>
                  <select
                    value={form.namaBank}
                    onChange={(e) => setForm({ ...form, namaBank: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="BCA">BCA</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="BRI">BRI</option>
                    <option value="BNI">BNI</option>
                    <option value="Bank Jago">Bank Jago</option>
                    <option value="SeBank">SeBank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Rekening</label>
                  <input
                    type="text"
                    value={form.nomorRekening}
                    onChange={(e) => setForm({ ...form, nomorRekening: e.target.value })}
                    placeholder="mis. 8820123456"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Commission Split */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                4. Komisi Pembagian (Revenue Split)
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="streamerCutPct" className="block text-xs font-semibold text-slate-700 mb-1">Streamer Cut (%)</label>
                  <input
                    id="streamerCutPct"
                    type="number"
                    min={0}
                    max={100}
                    value={form.streamerCutPct}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        streamerCutPct: v,
                        agencyCutPct: Math.max(0, 100 - v),
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Persentase pendapatan untuk streamer (default 70%).
                  </p>
                </div>
                <div>
                  <label htmlFor="agencyCutPct" className="block text-xs font-semibold text-slate-700 mb-1">Agency Cut (%)</label>
                  <input
                    id="agencyCutPct"
                    type="number"
                    min={0}
                    max={100}
                    readOnly
                    value={form.agencyCutPct}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-slate-50 text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Margin agency = 100% − streamer cut (auto).
                  </p>
                </div>
              </div>
              {Math.abs((form.streamerCutPct ?? 0) + (form.agencyCutPct ?? 0) - 100) > 0.001 && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Pembagian komisi harus berjumlah tepat 100%.
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Mendaftarkan..." : "Daftarkan Karyawan Baru"}
              </button>
            </div>
          </form>
        </div>

        {/* Directory Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Direktori Karyawan & Host ({filtered.length})</h3>
              <p className="text-[11px] text-slate-400">Total {list.length} karyawan terdaftar di sistem</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / ID..."
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white w-36"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none bg-white"
              >
                <option value="">Semua Posisi</option>
                <option value="Streamer">Streamer</option>
                <option value="OTS">OTS</option>
                <option value="Lead">Lead Ops</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nama & ID</th>
                  <th className="px-4 py-3">Posisi</th>
                  <th className="px-4 py-3">Kontak / Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{k.namaLengkap}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{k.idKaryawan}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {k.jabatan ?? "Streamer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{k.email ?? "-"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{k.nomorTelepon ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          k.statusAktif === "NON_AKTIF"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {k.statusAktif ?? "AKTIF"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedEmp(k)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada karyawan yang sesuai filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedEmp.namaLengkap}</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedEmp.idKaryawan}</p>
              </div>
              <button onClick={() => setSelectedEmp(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Jabatan:</span>
                <span className="font-bold text-slate-800">{selectedEmp.jabatan ?? "Streamer"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Tipe Pola Kerja:</span>
                <span className="font-semibold text-blue-600">{selectedEmp.tipeJadwal ?? "LIVE"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Email Resmi:</span>
                <span className="text-slate-800">{selectedEmp.email ?? "-"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">No. WhatsApp:</span>
                <span className="font-mono text-slate-800">{selectedEmp.nomorTelepon ?? "-"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Bank Payroll:</span>
                <span className="text-slate-800">{selectedEmp.namaBank ?? "BCA"} ({selectedEmp.nomorRekening ?? "-"})</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEmp(null)}
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
