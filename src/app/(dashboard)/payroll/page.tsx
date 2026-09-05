"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

type TabId = "payroll" | "atur-gaji" | "history";

function rupiah(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "Rp 0";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showConfirm } = useAlert();

  const role = String((session?.user as any)?.role ?? "").toUpperCase();
  const allowed =
    role.includes("ADMIN") || role.includes("SUPER") || role.includes("MANAGER") || role.includes("FINANCE");

  const [activeTab, setActiveTab] = useState<TabId>("payroll");
  const [periode, setPeriode] = useState(currentMonth());

  const [rows, setRows] = useState<any[]>([]);
  const [masterRows, setMasterRows] = useState<any[]>([]);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchPayroll, setSearchPayroll] = useState("");
  const [searchMaster, setSearchMaster] = useState("");
  const [searchHistory, setSearchHistory] = useState("");

  const [editMaster, setEditMaster] = useState<null | {
    karyawanId: string; namaLengkap: string; gajiPokok: number; tunjTransport: number; tunjMakan: number;
  }>(null);
  const [savingMaster, setSavingMaster] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      toast.error("Akses Ditolak: Halaman Payroll hanya untuk level Manajemen/HR/Finance.");
      router.replace("/dashboard");
    }
  }, [status, allowed, router]);

  const loadPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const q = `?periode=${encodeURIComponent(periode)}`;
      if (activeTab === "atur-gaji") {
        const data = await fetchJson<any[]>("/api/payroll?master=1");
        setMasterRows(Array.isArray(data) ? data : []);
      } else if (activeTab === "history") {
        const data = await fetchJson<any[]>("/api/payroll?history=1");
        setHistoryRows(Array.isArray(data) ? data : []);
      } else {
        const data = await fetchJson<any[]>(`/api/payroll${q}`);
        setRows(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Gagal terhubung ke Database."));
    } finally {
      setLoading(false);
    }
  }, [activeTab, periode]);

  useEffect(() => {
    if (status === "authenticated" && allowed) loadPayrollData();
  }, [status, allowed, loadPayrollData]);

  function switchTab(tab: TabId) {
    setActiveTab(tab);
  }

  async function handleSaveMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!editMaster) return;
    setSavingMaster(true);
    try {
      await sendJson("/api/payroll", "POST", {
        masterGaji: {
          karyawanId: editMaster.karyawanId,
          gajiPokok: Number(editMaster.gajiPokok) || 0,
          tunjTransport: Number(editMaster.tunjTransport) || 0,
          tunjMakan: Number(editMaster.tunjMakan) || 0,
        },
      });
      toast.success("Master Gaji berhasil diupdate!");
      setEditMaster(null);
      loadPayrollData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menyimpan master gaji"));
    } finally {
      setSavingMaster(false);
    }
  }

  async function handleUpdateStatus(id: string, s: "DISETUJUI" | "REVISI") {
    const ok = await showConfirm(`Ubah status slip gaji ini menjadi ${s}?`);
    if (!ok) return;
    try {
      await sendJson(`/api/payroll?id=${id}`, "PATCH", { status: s });
      toast.success(`Status slip gaji diubah menjadi ${s}.`);
      loadPayrollData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal memproses status"));
    }
  }

  if (status === "authenticated" && !allowed) {
    return (
      <div className="p-12 text-center text-slate-500">
        <i className="fa-solid fa-user-lock text-4xl text-red-400 mb-3 block" />
        Akses Ditolak: Halaman Payroll hanya untuk level Manajemen/HR/Finance.
      </div>
    );
  }

  const qPayroll = searchPayroll.toLowerCase();
  const qMaster = searchMaster.toLowerCase();
  const qHistory = searchHistory.toLowerCase();
  const filteredRows = rows.filter((r) =>
    `${r.karyawan?.idKaryawan ?? ""} ${r.karyawan?.namaLengkap ?? ""}`.toLowerCase().includes(qPayroll)
  );
  const filteredMaster = masterRows.filter((r) =>
    `${r.idKaryawan ?? ""} ${r.namaLengkap ?? ""}`.toLowerCase().includes(qMaster)
  );
  const filteredHistory = historyRows.filter((r) =>
    `${r.periode ?? ""} ${r.karyawan?.idKaryawan ?? ""} ${r.karyawan?.namaLengkap ?? ""}`.toLowerCase().includes(qHistory)
  );

  const tabBtn = (active: boolean) =>
    `flex-1 py-2 px-4 rounded-lg text-sm transition ${active ? "tab-active" : "tab-inactive"}`;

  return (
    <div>
      <style>{`.tab-active{background-color:#f1f5f9;border:1px solid #cbd5e1;font-weight:600;color:#1e293b;}.tab-inactive{color:#64748b;font-weight:500;border:1px solid transparent;}.tab-inactive:hover{background-color:#f8fafc;color:#334155;}`}</style>

      <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Management</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola perhitungan gaji, parameter master, dan riwayat arsip.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <label className="text-sm font-medium text-slate-600 pl-2">Periode Aktif:</label>
          <input
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#941A0B]/50 outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 mb-6">
        <button onClick={() => switchTab("payroll")} id="btn-payroll" className={tabBtn(activeTab === "payroll")}>
          <i className="fa-solid fa-money-bill-wave mr-2" />Payroll Bulan Ini
        </button>
        <button onClick={() => switchTab("atur-gaji")} id="btn-atur-gaji" className={tabBtn(activeTab === "atur-gaji")}>
          <i className="fa-solid fa-sliders mr-2" />Atur Master Gaji
        </button>
        <button onClick={() => switchTab("history")} id="btn-history" className={tabBtn(activeTab === "history")}>
          <i className="fa-solid fa-box-archive mr-2" />History / Arsip
        </button>
      </div>

      {activeTab === "payroll" && (
        <div id="tab-payroll" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Daftar Payroll Menunggu Persetujuan</h3>
            <div className="flex items-center bg-white rounded border border-slate-300 px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#941A0B]/50">
              <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-xs" />
              <input
                type="text"
                value={searchPayroll}
                onChange={(e) => setSearchPayroll(e.target.value)}
                placeholder="Cari Nama/ID..."
                className="border-none bg-transparent focus:ring-0 outline-none text-sm w-48"
              />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">ID Karyawan</th>
                  <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                  <th className="px-4 py-3 font-medium">Jabatan</th>
                  <th className="px-4 py-3 font-medium text-right">Gaji Pokok</th>
                  <th className="px-4 py-3 font-medium text-right">Total Tunjangan</th>
                  <th className="px-4 py-3 font-medium text-right">Total Potongan</th>
                  <th className="px-4 py-3 font-medium text-right font-bold text-slate-800">Take Home Pay</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-500 italic">Menarik data periode {periode}...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-500 font-medium">Tidak ada data untuk periode ini.</td></tr>
                ) : (
                  filteredRows.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-700">{p.karyawan?.idKaryawan ?? "-"}</td>
                      <td className="px-4 py-4 font-medium text-slate-900">{p.karyawan?.namaLengkap ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{p.karyawan?.jabatan ?? "-"}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{rupiah(p.gajiPokok)}</td>
                      <td className="px-4 py-4 text-right text-emerald-600">+ {rupiah(p.totalTunjangan)}</td>
                      <td className="px-4 py-4 text-right text-red-500">- {rupiah(p.totalPotongan)}</td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900">{rupiah(p.takeHomePay ?? p.grossPay)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
                          {p.statusPersetujuan ?? "MENUNGGU"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => handleUpdateStatus(p.id, "DISETUJUI")} className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-600 hover:text-white transition mr-1">Approve</button>
                        <button onClick={() => handleUpdateStatus(p.id, "REVISI")} className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-600 hover:text-white transition">Revisi</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "atur-gaji" && (
        <div id="tab-atur-gaji" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Parameter Komponen Gaji Karyawan</h3>
            <div className="flex items-center bg-white rounded border border-slate-300 px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#941A0B]/50">
              <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-xs" />
              <input
                type="text"
                value={searchMaster}
                onChange={(e) => setSearchMaster(e.target.value)}
                placeholder="Cari Nama/ID..."
                className="border-none bg-transparent focus:ring-0 outline-none text-sm w-48"
              />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">ID Karyawan</th>
                  <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium text-right">Gaji Pokok/Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Tunj. Transport</th>
                  <th className="px-4 py-3 font-medium text-right">Tunj. Makan</th>
                  <th className="px-4 py-3 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic">Menarik data master gaji...</td></tr>
                ) : filteredMaster.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500 font-medium">Data master gaji kosong.</td></tr>
                ) : (
                  filteredMaster.map((r) => (
                    <tr key={r.karyawanId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-700">{r.idKaryawan}</td>
                      <td className="px-4 py-4 font-medium text-slate-900">{r.namaLengkap}</td>
                      <td className="px-4 py-4 text-slate-600">{r.kategori}</td>
                      <td className="px-4 py-4 text-right font-medium text-slate-800">{rupiah(r.gajiPokok)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{rupiah(r.tunjTransport)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{rupiah(r.tunjMakan)}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => setEditMaster({
                            karyawanId: r.karyawanId,
                            namaLengkap: r.namaLengkap,
                            gajiPokok: Number(r.gajiPokok) || 0,
                            tunjTransport: Number(r.tunjTransport) || 0,
                            tunjMakan: Number(r.tunjMakan) || 0,
                          })}
                          className="px-3 py-1 text-xs font-medium bg-red-50 text-[#941A0B] border border-red-200 rounded hover:bg-[#941A0B] hover:text-white transition"
                        >
                          Edit Master
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div id="tab-history" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Arsip Penggajian Historis</h3>
            <div className="flex items-center bg-white rounded border border-slate-300 px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#941A0B]/50">
              <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-xs" />
              <input
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder="Cari Nama/ID..."
                className="border-none bg-transparent focus:ring-0 outline-none text-sm w-48"
              />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Periode</th>
                  <th className="px-4 py-3 font-medium">ID Karyawan</th>
                  <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                  <th className="px-4 py-3 font-medium text-right font-bold text-slate-800">Take Home Pay</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">Menarik data arsip...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 font-medium">Tidak ada data arsip.</td></tr>
                ) : (
                  filteredHistory.map((p) => {
                    const st = p.statusPersetujuan ?? "MENUNGGU";
                    const badge =
                      st === "DISETUJUI"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : st === "REVISI"
                          ? "bg-red-50 text-red-700 border-red-300"
                          : "bg-slate-100 text-slate-600 border-slate-300";
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-4 text-slate-600">{p.periode}</td>
                        <td className="px-4 py-4 font-medium text-slate-700">{p.karyawan?.idKaryawan ?? "-"}</td>
                        <td className="px-4 py-4 font-medium text-slate-900">{p.karyawan?.namaLengkap ?? "-"}</td>
                        <td className="px-4 py-4 text-right font-bold text-slate-900">{rupiah(p.takeHomePay ?? p.grossPay)}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold border ${badge}`}>{st}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            className="text-[#941A0B] hover:text-[#781408] text-sm"
                            title="Lihat Slip Gaji"
                            onClick={() => toast.success(`Slip ${p.karyawan?.namaLengkap ?? ""} periode ${p.periode}: ${rupiah(p.takeHomePay ?? p.grossPay)} (${st})`)}
                          >
                            <i className="fa-solid fa-file-invoice-dollar" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editMaster && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900">Edit Parameter Gaji</h3>
              <button onClick={() => setEditMaster(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveMaster} className="space-y-4">
                <div className="flex gap-4 mb-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">ID Karyawan</label>
                    <input type="text" value={editMaster.karyawanId} readOnly className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-sm font-medium text-slate-700 outline-none" />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap</label>
                    <input type="text" value={editMaster.namaLengkap} readOnly className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-sm font-medium text-slate-700 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gaji Pokok / Rate Dasar (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={editMaster.gajiPokok}
                    onChange={(e) => setEditMaster({ ...editMaster, gajiPokok: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#941A0B]/50 outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tunj. Transport (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={editMaster.tunjTransport}
                      onChange={(e) => setEditMaster({ ...editMaster, tunjTransport: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#941A0B]/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tunj. Makan (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={editMaster.tunjMakan}
                      onChange={(e) => setEditMaster({ ...editMaster, tunjMakan: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#941A0B]/50 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditMaster(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">Batal</button>
                  <button type="submit" disabled={savingMaster} className="px-4 py-2 text-sm font-medium bg-[#941A0B] text-white hover:bg-[#781408] rounded-lg transition shadow-sm disabled:opacity-60">
                    {savingMaster ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
