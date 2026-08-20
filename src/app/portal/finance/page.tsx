"use client";

import { useEffect, useState } from "react";

type PayoutRun = {
  id: string;
  periode: string;
  status: string;
  totalAmount: string;
  lines: { id: string; karyawan: { namaLengkap: string } | null; amount: string }[];
};

type BillingDoc = {
  id: string;
  periode: string;
  status: string;
  totalAmount: string;
  client: { namaClient: string } | null;
};

export default function FinancePortalPage() {
  const [periode, setPeriode] = useState("Agustus 2026");
  const [runs, setRuns] = useState<PayoutRun[]>([]);
  const [billing, setBilling] = useState<BillingDoc[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [pnl, setPnl] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "payouts" | "billing">("overview");

  // New Billing Modal state
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [newBillingClientId, setNewBillingClientId] = useState("");

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const [r, b, p, c] = await Promise.all([
        fetch(`/api/finance?view=payouts&periode=${encodeURIComponent(periode)}`).then((x) => x.json()),
        fetch(`/api/finance?view=billing&periode=${encodeURIComponent(periode)}`).then((x) => x.json()),
        fetch(`/api/finance?view=pnl&periode=${encodeURIComponent(periode)}`).then((x) => x.json()),
        fetch("/api/clients").then((x) => x.json()).catch(() => ({ status: "success", data: [] })),
      ]);

      if (r.status === "success") setRuns(r.data);
      if (b.status === "success") setBilling(b.data);
      if (p.status === "success") setPnl(p.data);
      if (c.status === "success") setClients(c.data);
      else if (p.status === "error") setError(p.message ?? "Akses ditolak");
    } catch {
      setError("Gagal memuat data keuangan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode]);

  async function createRun() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payout-run", periode }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Payout Run untuk ${periode} berhasil dibuat!`);
        loadData();
      } else {
        setError(d.message ?? "Gagal membuat payout run");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePayoutStatus(runId: string, newStatus: string) {
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payout-status",
          id: runId,
          status: newStatus,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Status payout berhasil diperbarui menjadi ${newStatus}`);
        loadData();
      } else {
        setError(d.message ?? "Gagal memperbarui status payout");
      }
    } catch {
      setError("Koneksi gagal");
    }
  }

  async function handleCreateBilling() {
    if (!newBillingClientId) {
      setError("Pilih klien untuk penagihan");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "billing-doc",
          clientId: newBillingClientId,
          periode,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(`Dokumen Billing Klien berhasil dibuat!`);
        setBillingModalOpen(false);
        loadData();
      } else {
        setError(d.message ?? "Gagal membuat billing");
      }
    } catch {
      setError("Koneksi error");
    } finally {
      setLoading(false);
    }
  }

  const rupiah = (v: any) => `Rp ${Number(v ?? 0).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Keuangan & Billing Agency</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manajemen Payout Runs Streamer, Faktur Penagihan Brand Klien, dan Ikhtisar P&L Agency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            onClick={createRun}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-md shadow-teal-600/20 disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Buat Payout Run</span>
          </button>

          <button
            onClick={() => setBillingModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-md shadow-blue-600/20 flex items-center gap-1.5"
          >
            <span>📄</span>
            <span>Tagihan Klien Baru</span>
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

      {/* P&L Stats Cards */}
      {pnl && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Pendapatan Billing (Revenue)</div>
            <div className="text-xl font-bold text-blue-600 mt-1">{rupiah(pnl.revenue)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Invoice Klien {periode}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Honor Streamer Terbayar</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{rupiah(pnl.paidPayouts)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Status PAID</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Proyeksi Payout Berjalan</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{rupiah(pnl.projectedPayouts)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Draft & Submitted</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Estimasi Margin Bersih</div>
            <div
              className={`text-xl font-bold mt-1 ${
                pnl.netProjected >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {rupiah(pnl.netProjected)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Laba Operasional Agency</div>
          </div>
        </div>
      )}

      {/* Grid of Payouts & Billing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payout Runs Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              <h3 className="font-bold text-slate-800 text-sm">Payout Runs Streamer ({runs.length})</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Batch Transfer</span>
          </div>

          <div className="divide-y divide-slate-100">
            {runs.map((r) => (
              <div key={r.id} className="p-4 hover:bg-slate-50/80 transition space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{r.periode}</div>
                    <div className="text-xs text-slate-500">{r.lines.length} Host Penerima Honor</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{rupiah(r.totalAmount)}</div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                        r.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : r.status === "APPROVED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      const csvHeader = "Nama Penerima,Jumlah Transfer (IDR),Periode,Status\n";
                      const csvRows = r.lines
                        .map(
                          (l) =>
                            `"${l.karyawan?.namaLengkap ?? "Host"}",${l.amount},"${r.periode}","${r.status}"`
                        )
                        .join("\n");
                      const blob = new Blob([csvHeader + csvRows], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Batch_Transfer_Payroll_${r.periode.replace(/\s+/g, "_")}.csv`;
                      a.click();
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"
                  >
                    <span>📥</span>
                    <span>Export CSV Bank</span>
                  </button>
                  {r.status === "DRAFT" && (
                    <button
                      onClick={() => handleUpdatePayoutStatus(r.id, "SUBMITTED")}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Ajukan Approval
                    </button>
                  )}
                  {r.status === "SUBMITTED" && (
                    <button
                      onClick={() => handleUpdatePayoutStatus(r.id, "APPROVED")}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Setujui (Approve)
                    </button>
                  )}
                  {r.status === "APPROVED" && (
                    <button
                      onClick={() => handleUpdatePayoutStatus(r.id, "PAID")}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Tandai Sudah Ditransfer
                    </button>
                  )}
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <p className="p-8 text-center text-slate-400 text-xs">
                Belum ada payout run untuk periode ini. Klik <strong>"+ Buat Payout Run"</strong> untuk mengompilasi gaji.
              </p>
            )}
          </div>
        </div>

        {/* Client Billing Invoices Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="font-bold text-slate-800 text-sm">Faktur Penagihan Klien ({billing.length})</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Invoicing</span>
          </div>

          <div className="divide-y divide-slate-100">
            {billing.map((b) => (
              <div key={b.id} className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    {b.client?.namaClient ?? "Klien"}
                  </div>
                  <div className="text-xs text-slate-500">Periode: {b.periode}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{rupiah(b.totalAmount)}</div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                      b.status === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : b.status === "SENT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
            {billing.length === 0 && (
              <p className="p-8 text-center text-slate-400 text-xs">
                Belum ada tagihan klien tercatat untuk periode ini.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* New Billing Modal */}
      {billingModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Buat Tagihan Klien (Billing Invoice)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sistem akan menghitung total jam tayang live streaming untuk brand klien yang dipilih dan membuat faktur penagihan resmi.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Brand Klien</label>
              <select
                value={newBillingClientId}
                onChange={(e) => setNewBillingClientId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Klien --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.namaClient} ({c.platform ?? "General"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Periode Penagihan</label>
              <input
                type="text"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBillingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateBilling}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Buat Tagihan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
