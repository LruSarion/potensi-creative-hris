"use client";

import { useEffect, useState } from "react";

export default function AdminConsolePage() {
  const [matrix, setMatrix] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [studios] = useState([
    { name: "Timoho Studio", rooms: ["Studio 1 (Shopee Live)", "Studio 2 (TikTok Shop)", "Studio 3 (Beauty/Skincare)"], status: "ONLINE" },
    { name: "Berbah Studio", rooms: ["Studio 1 (Fashion)", "Studio 2 (Electronics)"], status: "ONLINE" },
    { name: "Wiyoro Studio", rooms: ["Studio 1 (Food & Beverage)", "Studio 2 (Multi-Brand)"], status: "ONLINE" },
  ]);

  const [tiers, setTiers] = useState<any[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);

  useEffect(() => {
    load();
    loadTiering();
  }, []);

  async function load() {
    try {
      const [m, h, a] = await Promise.all([
        fetch("/api/integration?view=permissions").then((x) => x.json()),
        fetch("/api/integration?view=health").then((x) => x.json()),
        fetch("/api/integration?view=audit").then((x) => x.json()),
      ]);
      if (m.status === "success") setMatrix(m.data);
      if (h.status === "success") setHealth(h.data);
      if (a.status === "success") setAudit(a.data);
      else if (a.status === "error") setError(a.message ?? "Akses ditolak");
    } catch {
      setError("Gagal memuat data admin");
    }
  }

  // Real tiering rates from the payroll engine (not hardcoded).
  async function loadTiering() {
    setLoadingTiers(true);
    try {
      const r = await fetch("/api/payroll?tiering=1").then((x) => x.json());
      if (r.status === "success") setTiers(r.data);
      else setError(r.message ?? "Gagal memuat konfigurasi tier");
    } catch {
      setError("Gagal memuat konfigurasi tier");
    } finally {
      setLoadingTiers(false);
    }
  }

  const rupiah = (v: number) => `Rp ${v.toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin & Multi-Tenant Control Center</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Konfigurasi rate tier honor streamer, manajemen cabang studio fisik, dan diagnostik kesehatan sistem database.
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

      {/* Health Metrics */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <HealthCard label="Total Pengguna" v={health.users} icon="fa-users" color="text-blue-600" />
          <HealthCard label="Tenants Agency" v={health.tenants} icon="fa-building" color="text-purple-600" />
          <HealthCard label="Karyawan & Host" v={health.karyawan} icon="fa-id-badge" color="text-emerald-600" />
          <HealthCard label="Jadwal Live" v={health.jadwal} icon="fa-calendar-check" color="text-amber-600" />
          <HealthCard label="Absensi Terverifikasi" v={health.absensi} icon="fa-fingerprint" color="text-teal-600" />
          <HealthCard label="Payroll Slip" v={health.payroll} icon="fa-receipt" color="text-indigo-600" />
        </div>
      )}

      {/* Studio Branches & Tier Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Rates Config */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Konfigurasi Rate Tier Streamer Agency</h3>
            <span className="text-xs text-blue-600 font-semibold">Formula Rate/Jam</span>
          </div>

          <div className="p-4 space-y-3">
            {loadingTiers && (
              <p className="text-xs text-slate-400 py-2">Memuat konfigurasi tier…</p>
            )}
            {!loadingTiers && tiers.length === 0 && (
              <p className="text-xs text-amber-600 py-2">
                Belum ada konfigurasi tiering. Buat band tiering melalui Payroll &gt; Konfigurasi Tier.
              </p>
            )}
            {tiers.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <div className="font-bold text-slate-800">{t.tier}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Syarat: {t.jamMinimal} – {t.jamMaksimal === 999 ? "∞" : t.jamMaksimal} Jam Siaran / Bulan
                  </div>
                </div>
                <div className="text-right font-bold text-emerald-600 text-sm font-mono">
                  {rupiah(Number(t.ratePerJam))} <span className="text-[10px] text-slate-400 font-normal">/jam</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Physical Studio Locations */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Cabang & Bilik Studio Fisik ({studios.length})</h3>
            <span className="text-xs text-emerald-600 font-semibold">All Online</span>
          </div>

          <div className="p-4 space-y-3">
            {studios.map((st, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-location-dot text-rose-500" />
                    <span>{st.name}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {st.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pl-4 space-y-0.5">
                  {st.rooms.map((r, rIdx) => (
                    <div key={rIdx}>• {r}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permissions Matrix & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Matriks Izin Role Keamanan (RBAC)</h3>
            <span className="text-xs text-slate-500 font-medium">System Policies</span>
          </div>
          {matrix && (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {Object.entries(matrix.permissions).map(([role, perms]) => (
                <div key={role} className="p-3 text-xs hover:bg-slate-50/80 transition">
                  <div className="font-bold text-slate-800">{role}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {(perms as string[]).slice(0, 8).join(", ")}{(perms as string[]).length > 8 ? "…" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Audit Trail & Aktivitas Sistem</h3>
            <span className="text-xs text-slate-500 font-medium">Log Keamanan</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {audit.map((a) => (
              <div key={a.id} className="p-3 text-xs hover:bg-slate-50/80 transition flex items-center justify-between">
                <div>
                  <span className="font-bold font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                    {a.aksi}
                  </span>
                  <span className="ml-2 font-medium text-slate-700">{a.user?.email ?? "System"}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(a.createdAt).toLocaleTimeString("id-ID")}
                </span>
              </div>
            ))}
            {audit.length === 0 && <p className="p-8 text-center text-slate-400 text-xs">Belum ada catatan audit log.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ label, v, icon, color }: { label: string; v: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <i className={`fa-solid ${icon} ${color} text-sm`} />
      </div>
      <div className="text-2xl font-black text-slate-900 font-mono">{v}</div>
    </div>
  );
}