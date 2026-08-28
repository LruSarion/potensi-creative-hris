"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function MasterDataAdminPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"master" | "console">("master");

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

  // LLM (OpenRouter) config state
  const [llmKey, setLlmKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmSource, setLlmSource] = useState("none");
  const [llmLoadingModels, setLlmLoadingModels] = useState(false);

  useEffect(() => {
    load();
    loadTiering();
    loadLlm();
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

  async function loadLlm() {
    try {
      const r = await fetch("/api/llm-config");
      const d = await r.json();
      if (d.status === "success") {
        setLlmConfigured(d.data.configured ?? false);
        setLlmModel(d.data.model ?? "openai/gpt-4o-mini");
        setLlmSource(d.data.source ?? "none");
        if (d.data.configured) loadLlmModels();
      }
    } catch {
      // ignore
    }
  }

  async function loadLlmModels() {
    setLlmLoadingModels(true);
    try {
      const r = await fetch("/api/llm-config?models=1");
      const d = await r.json();
      if (d.status === "success" && d.data.models?.length) setLlmModels(d.data.models);
    } catch {
      // ignore
    } finally {
      setLlmLoadingModels(false);
    }

  }

  async function saveLlm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: llmKey, model: llmModel }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess("Konfigurasi LLM (OpenRouter) berhasil disimpan!");
        setLlmConfigured(true);
        setLlmKey("");
        setLlmSource("tenant");
        loadLlmModels();
      } else {
        setError(d.message ?? "Gagal menyimpan konfigurasi LLM");
      }
    } catch {
      setError("Gagal menyimpan konfigurasi LLM");
    }
  }

  const rupiah = (v: number) => `Rp ${v.toLocaleString("id-ID")}`;

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

  function hubungiTeknisi() {
    const noWa = "6289665332870";
    const pesan = encodeURIComponent(
      `Halo Teknisi HRIS Potensi Creative, saya ${session?.user?.name ?? "User"} (${session?.user?.email}) membutuhkan bantuan teknis.`
    );
    window.open(`https://wa.me/${noWa}?text=${pesan}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/master-data.html */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Data & Control Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Akses langsung ke jantung database sistem dan kontrol administrasi multi-tenant.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 w-fit">
          <button
            onClick={() => setActiveTab("master")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === "master"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-server text-blue-600" />
            <span>Pusat Master Data</span>
          </button>
          <button
            onClick={() => setActiveTab("console")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === "console"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="fa-solid fa-[#2563eb] fa-sliders text-blue-600" />
            <span>Admin Console & Integrasi</span>
          </button>
        </div>
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

      {/* TAB 1: PUSAT MASTER DATA (ref-website-lama/master-data.html) */}
      {activeTab === "master" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] py-8">
          <div className="text-center mb-10 max-w-lg">
            <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <i className="fa-solid fa-server text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Pusat Master Data</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Akses langsung ke jantung database sistem. Area ini diawasi dan dilindungi oleh protokol keamanan Google Workspace. Modifikasi struktur pada area ini dapat memengaruhi seluruh aplikasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <a
              href="https://docs.google.com/spreadsheets/d/1lojSwH6_Tyv_gs9K80LcP_ebS22RRS9KgR860l92BFI/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-center flex flex-col items-center cursor-pointer"
            >
              <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-file-excel text-xl" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Buka Database Master</h3>
              <p className="text-xs text-slate-500">Menuju lembar kerja Google Sheets untuk manajemen data absolut.</p>
            </a>

            <button
              onClick={hubungiTeknisi}
              className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-center flex flex-col items-center cursor-pointer"
            >
              <div className="bg-amber-50 text-amber-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-headset text-xl" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Hubungi Teknisi</h3>
              <p className="text-xs text-slate-500">Laporkan bug, error, atau request pengembangan fitur ke Developer.</p>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ADMIN CONSOLE & INTEGRATION */}
      {activeTab === "console" && (
        <div className="space-y-6">
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Konfigurasi Rate Tier Streamer Agency</h3>
                <span className="text-xs text-blue-600 font-semibold">Formula Rate/Jam</span>
              </div>

              <div className="p-4 space-y-3">
                {loadingTiers && <p className="text-xs text-slate-400 py-2">Memuat konfigurasi tier…</p>}
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
                  <div key={a.id} className="p-3 text-xs hover:bg-slate-50/80 transition flex items-center justify-between gap-3 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="font-bold font-mono text-[#941A0B] bg-[#941A0B]/10 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                        {a.aksi}
                      </span>
                      <span className="font-medium text-slate-700 truncate" title={a.user?.email ?? "System"}>
                        {a.user?.email ?? "System"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(a.createdAt).toLocaleTimeString("id-ID")}
                    </span>
                  </div>
                ))}
                {audit.length === 0 && <p className="p-8 text-center text-slate-400 text-xs">Belum ada catatan audit log.</p>}
              </div>
            </div>
          </div>

          {/* LLM (OpenRouter) Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Konfigurasi AI Converter (OpenRouter)</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                llmConfigured ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {llmConfigured ? "AKTIF" : "NON-AKTIF"}
              </span>
            </div>
            <div className="p-5 space-y-4">
              {llmConfigured && (
                <p className="text-[11px] text-slate-500">
                  AI aktif dari sumber: <strong>{llmSource === "tenant" ? "Pengaturan ini" : "Environment"}</strong>. Model:{" "}
                  <strong className="text-slate-700">{llmModel}</strong>
                </p>
              )}
              <form onSubmit={saveLlm} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">API Key OpenRouter</label>
                  <input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder={llmConfigured ? "•••••••• (key tersimpan — kosongkan bila tidak diubah)" : "sk-or-..."}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Dapatkan di openrouter.ai. Key disimpan aman di pengaturan tenant.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block font-semibold text-slate-700 mb-1">Model AI</label>
                    <button
                      type="button"
                      onClick={loadLlmModels}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      {llmLoadingModels ? "Memuat..." : "Muat daftar model"}
                    </button>
                  </div>
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Pilih model --</option>
                    {llmModels.length > 0 ? (
                      llmModels.map((m) => <option key={m} value={m}>{m}</option>)
                    ) : (
                      <>
                        <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                        <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                        <option value="google/gemini-2.0-flash">google/gemini-2.0-flash</option>
                        <option value="mistralai/mistral-small">mistralai/mistral-small</option>
                        <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/20"
                  >
                    Simpan Konfigurasi AI
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
