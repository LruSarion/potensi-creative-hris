"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson } from "@/lib/api-client";

// ---------- Types ----------

type BoardItem = {
  id: string;
  idJadwal: string;
  tanggal: string;
  platform: string | null;
  cabangStudio: string | null;
  nomorStudio: string | null;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  status: string;
  liveState: "SCHEDULED" | "LIVE" | "REVIEW" | "CLOSED";
  displayState: string;
  durationMin: number;
  streamerKaryawan: { namaLengkap: string; idKaryawan: string } | null;
  hostKaryawan: { namaLengkap: string } | null;
  client: { namaClient: string } | null;
};

type RosterShift = {
  id: string;
  karyawanId: string;
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  role: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  note: string | null;
  karyawan: { id: string; idKaryawan: string; namaLengkap: string };
};

type Incident = {
  id: string;
  title: string;
  description: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";
  slaLate: boolean;
  createdAt: string;
  jadwal: { idJadwal: string } | null;
  streamer: { namaLengkap: string } | null;
  assignee: { namaLengkap: string } | null;
};

type Employee = { id: string; idKaryawan: string; namaLengkap: string };

const ALLOWED: Record<string, string[]> = {
  SCHEDULED: ["LIVE", "REVIEW", "CLOSED"],
  LIVE: ["REVIEW", "CLOSED"],
  REVIEW: ["CLOSED", "LIVE"],
  CLOSED: [],
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600 border-slate-200",
  ASSIGNED: "bg-blue-100 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700 border-indigo-200",
  ESCALATED: "bg-red-100 text-red-700 border-red-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CLOSED: "bg-gray-100 text-gray-500 border-gray-200",
};

const DISPLAY_STYLE: Record<string, string> = {
  LIVE: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  CLOSED: "bg-gray-100 text-gray-500 border-gray-200",
};

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function startOfWeek(base?: Date): Date {
  const d = base ? new Date(base) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function OperationPortalPage() {
  const [tab, setTab] = useState<"live" | "roster" | "incident">("live");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations Command Board</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Monitoring siaran studio real-time, roster shift mingguan, dan respon cepat insiden operasional.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          ["live", "Live Studio Board", "fa-video"],
          ["roster", "Roster Shift Mingguan", "fa-calendar-days"],
          ["incident", "Emergency Incident Queue", "fa-triangle-exclamation"],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px flex items-center gap-2 transition ${
              tab === key
                ? "text-blue-600 border-blue-600 bg-white shadow-sm"
                : "text-slate-500 border-transparent hover:text-slate-700"
            }`}
          >
            <i className={`fa-solid ${icon}`} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "live" && <LiveBoard />}
      {tab === "roster" && <RosterBoard />}
      {tab === "incident" && <IncidentQueue />}
    </div>
  );
}

// ---------- Live Board Component ----------

function LiveBoard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const data = await fetchJson<BoardItem[]>(`/api/operations${q}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function transition(jadwalId: string, toState: string) {
    try {
      await sendJson("/api/operations", "PATCH", { jadwalId, toState });
      setError("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transisi gagal");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Filter Status:</span>
        {["", "LIVE", "SCHEDULED", "REVIEW", "CLOSED"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s ? (s === "LIVE" ? "🔴 ON AIR" : s) : "Semua Status"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {items.map((it) => (
          <div key={it.id} className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-800 font-mono">{it.idJadwal}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${DISPLAY_STYLE[it.displayState] ?? "bg-slate-100 text-slate-600"}`}>
                  {it.displayState === "LIVE" ? "🔴 ON AIR" : it.displayState}
                </span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {it.platform ?? "Shopee Live"}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Studio: {it.cabangStudio ?? "Timoho"} {it.nomorStudio ?? "Studio 1"}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {fmtDate(it.tanggal)} • <span className="font-mono text-slate-700 font-semibold">{fmtTime(it.jamMulaiLive)}–{fmtTime(it.jamSelesaiLive)}</span> ({it.durationMin} Menit)
              </div>
              <div className="text-xs text-slate-600">
                Host: <strong className="text-slate-800">{it.streamerKaryawan?.namaLengkap ?? "Belum diplot"}</strong>
                {it.client ? ` • Brand: ${it.client.namaClient}` : ""}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(ALLOWED[it.liveState] ?? []).map((target) => (
                <button
                  key={target}
                  onClick={() => transition(it.id, target)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition shadow-sm"
                >
                  Ubah ➔ {target}
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada jadwal sesi live yang sesuai.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Roster Board Component ----------

function RosterBoard() {
  const [shifts, setShifts] = useState<RosterShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek());
  const [busy, setBusy] = useState(true);

  // create form state
  const [showForm, setShowForm] = useState(false);
  const [karyawanId, setKaryawanId] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [jamMulai, setJamMulai] = useState("");
  const [jamSelesai, setJamSelesai] = useState("");
  const [role, setRole] = useState("STREAMER");

  async function load() {
    setBusy(true);
    try {
      const data = await fetchJson<RosterShift[]>("/api/roster");
      setShifts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat roster");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    fetchJson<Employee[]>("/api/employees")
      .then((data) => setEmployees(data))
      .catch(() => undefined);
  }, []);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!karyawanId || !tanggal || !jamMulai || !jamSelesai) {
      setError("Lengkapi semua field");
      return;
    }
    try {
      await sendJson("/api/roster", "POST", { karyawanId, tanggal, jamMulai, jamSelesai, role });
      setError("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat shift");
    }
  }

  async function cancelShift(id: string) {
    await sendJson(`/api/roster?id=${id}`, "DELETE").catch(() => null);
  }

  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3.5">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            ◀ Pekan Lalu
          </button>
          <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl">
            {fmtDate(days[0].toISOString())} – {fmtDate(days[6].toISOString())}
          </span>
          <button
            onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Pekan Depan ▶
          </button>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20"
        >
          + Tambah Shift Roster
        </button>
      </div>

      {showForm && (
        <form onSubmit={createShift} className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-xs shadow-sm">
          <select
            value={karyawanId}
            onChange={(e) => setKaryawanId(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 bg-white"
            required
          >
            <option value="">Pilih Karyawan...</option>
            {employees.map((em) => (
              <option key={em.id} value={em.id}>
                {em.namaLengkap} ({em.idKaryawan})
              </option>
            ))}
          </select>
          <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2" required />
          <input type="time" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2" required />
          <input type="time" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2" required />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 bg-white">
            <option value="STREAMER">STREAMER</option>
            <option value="OTS">OTS STUDIO</option>
            <option value="LEAD_OPS">LEAD OPS</option>
          </select>
          <button type="submit" className="px-3 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
            Simpan Shift
          </button>
        </form>
      )}

      {/* 7-Days Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-200">
          {days.map((d) => (
            <div key={d.toISOString()} className="px-2 py-3 bg-slate-50/70 text-center">
              <div className="text-[11px] font-bold text-slate-700">{DAYS[d.getDay()]}</div>
              <div className="text-[10px] text-slate-400 font-mono">{d.getDate()} {BULAN_SHORT[d.getMonth()]}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[240px]">
          {days.map((d) => {
            const dayShifts = shifts.filter((s) => sameDay(new Date(s.tanggal), d));
            return (
              <div key={d.toISOString()} className="p-2 space-y-1.5 align-top">
                {dayShifts.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-2 text-xs space-y-1 ${
                      s.status === "CANCELLED"
                        ? "bg-gray-50 border-gray-200 text-gray-400 line-through"
                        : "bg-blue-50/70 border-blue-200 text-blue-900"
                    }`}
                  >
                    <div className="font-bold text-[11px] font-mono">
                      {fmtTime(s.jamMulai)}–{fmtTime(s.jamSelesai)}
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{s.karyawan.namaLengkap}</div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-blue-600 font-semibold">{s.role ?? "Host"}</span>
                      {s.status === "ACTIVE" && (
                        <button onClick={() => cancelShift(s.id)} className="text-red-500 hover:text-red-700 font-bold">
                          Batal
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const BULAN_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

// ---------- Incident Queue Component ----------

type ViolationCategory = { id: string; name: string; defaultFine: number | null };

function IncidentQueue() {
  const [items, setItems] = useState<Incident[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  // create form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("MEDIUM");
  const [categoryId, setCategoryId] = useState("");
  const [proofDriveId, setProofDriveId] = useState("");
  const [fineApplied, setFineApplied] = useState("");
  const [streamerKaryawanId, setStreamerKaryawanId] = useState("");

  // approve modal
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveFine, setApproveFine] = useState("");

  async function load() {
    setBusy(true);
    try {
      const [incData, catData] = await Promise.all([
        fetchJson<Incident[]>("/api/incidents"),
        fetchJson<ViolationCategory[]>("/api/incidents?view=categories").catch(() => null),
      ]);
      setItems(incData);
      if (catData) setCategories(catData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat insiden");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    fetchJson<Employee[]>("/api/employees")
      .then((data) => setEmployees(data))
      .catch(() => undefined);
  }, []);

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    if (!proofDriveId) { setError("Link bukti (Screenshot/Screen Record) wajib diisi."); return; }
    setError("");
    try {
      await sendJson("/api/incidents", "POST", {
        title,
        description: description || undefined,
        severity,
        categoryId: categoryId || undefined,
        proofDriveId,
        fineApplied: fineApplied ? parseFloat(fineApplied) : undefined,
        streamerKaryawanId: streamerKaryawanId || undefined,
      });
      setShowForm(false);
      setTitle(""); setDescription(""); setCategoryId(""); setProofDriveId(""); setFineApplied(""); setStreamerKaryawanId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat laporan");
    }
  }

  async function act(id: string, action: string, body?: object) {
    await sendJson(`/api/incidents?id=${id}&action=${action}`, "PATCH", body).catch(() => null);
  }

  async function assign(id: string, assigneeId: string) {
    await act(id, "assign", { status: "ASSIGNED", assigneeId });
  }

  async function approveWithFine() {
    if (!approvingId) return;
    await act(approvingId, "approve", { fineApplied: approveFine ? parseFloat(approveFine) : 0 });
    setApprovingId(null);
    setApproveFine("");
  }

  // Auto-fill fine when category changes
  function handleCategoryChange(id: string) {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat?.defaultFine) setFineApplied(String(cat.defaultFine));
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3.5">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 flex items-center gap-1.5"
        >
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Laporkan Pelanggaran / Kendala</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={createIncident} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-file-shield text-rose-500" />
            Form Laporan Pelanggaran / Kendala SOP
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Judul */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Judul Pelanggaran / Kendala <span className="text-red-500">*</span></label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Streamer tertidur saat live, mic mati 15 menit"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            {/* Streamer */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Streamer yang Bersangkutan</label>
              <select
                value={streamerKaryawanId} onChange={(e) => setStreamerKaryawanId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none"
              >
                <option value="">-- Pilih Streamer (opsional) --</option>
                {employees.map((em) => (
                  <option key={em.id} value={em.id}>{em.namaLengkap} ({em.idKaryawan})</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Tingkat Keparahan <span className="text-red-500">*</span></label>
              <select
                value={severity} onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none"
              >
                <option value="LOW">LOW — Ringan</option>
                <option value="MEDIUM">MEDIUM — Sedang</option>
                <option value="HIGH">HIGH — Berat</option>
                <option value="CRITICAL">CRITICAL — Darurat</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Kategori Pelanggaran (SOP)</label>
              <select
                value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none"
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.defaultFine ? ` (Denda: Rp ${Number(c.defaultFine).toLocaleString("id-ID")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Fine */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Nominal Denda (Rp)</label>
              <input
                type="number" value={fineApplied} onChange={(e) => setFineApplied(e.target.value)}
                placeholder="Otomatis terisi dari kategori, atau isi manual"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Proof link — WAJIB */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">
                Link Bukti Screenshot / Screen Record <span className="text-red-500">* Wajib</span>
              </label>
              <input
                value={proofDriveId} onChange={(e) => setProofDriveId(e.target.value)}
                placeholder="https://drive.google.com/... atau URL bukti"
                className="w-full border border-red-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Laporan tanpa bukti tidak bisa diajukan. Pastikan SS/Screen Record sudah diunggah ke Google Drive.</p>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1.5">Deskripsi Detail (Opsional)</label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Uraikan kronologi kejadian secara singkat..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm">
              Kirim Laporan Pelanggaran
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {items.map((it) => (
          <div key={it.id} className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-800">{it.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SEVERITY_STYLE[it.severity]}`}>
                  {it.severity}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[it.status]}`}>
                  {it.status}
                </span>
                {it.slaLate && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                    SLA Terlewat
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {it.description || "Pelanggaran SOP operasional live."}
              </div>
              <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                <span>Streamer: <strong className="text-slate-700">{it.streamer?.namaLengkap ?? "—"}</strong></span>
                <span>Ditugaskan ke: <strong className="text-slate-700">{it.assignee?.namaLengkap ?? "Belum ada PIC"}</strong></span>
                <span>{new Date(it.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {it.status !== "RESOLVED" && it.status !== "CLOSED" && (
                <>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) assign(it.id, e.target.value); e.target.value = ""; }}
                    className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white"
                  >
                    <option value="">Tugaskan ke...</option>
                    {employees.map((em) => (
                      <option key={em.id} value={em.id}>{em.namaLengkap}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setApprovingId(it.id); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  >
                    ✅ Approve & Tetapkan Denda
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && !busy && (
          <div className="p-8 text-center text-slate-400 text-xs">
            Tidak ada insiden atau kendala operasional aktif.
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approvingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-gavel text-emerald-600" /> Approve Pelanggaran & Tetapkan Denda
              </h3>
              <button onClick={() => { setApprovingId(null); setApproveFine(""); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nominal Denda Final (Rp)</label>
              <input
                type="number" value={approveFine} onChange={(e) => setApproveFine(e.target.value)}
                placeholder="0 = tidak ada denda"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Denda ini akan dipotong dari gaji Streamer bulan ini dan direkap untuk Finance.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setApprovingId(null); setApproveFine(""); }} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100">Batal</button>
              <button type="button" onClick={approveWithFine} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md">
                Konfirmasi Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


