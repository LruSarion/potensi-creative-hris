"use client";

import { useEffect, useState } from "react";

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
      const res = await fetch(`/api/operations${q}`).then((x) => x.json());
      if (res.status === "success") setItems(res.data);
      else setError(res.message ?? "Gagal memuat data");
    } catch {
      setError("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function transition(jadwalId: string, toState: string) {
    const res = await fetch("/api/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jadwalId, toState }),
    }).then((x) => x.json());
    if (res.status !== "success") setError(res.message ?? "Transisi gagal");
    else {
      setError("");
      load();
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
      const res = await fetch("/api/roster").then((x) => x.json());
      if (res.status === "success") setShifts(res.data);
      else setError(res.message ?? "Gagal memuat roster");
    } catch {
      setError("Terjadi kesalahan saat memuat roster");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/employees")
      .then((x) => x.json())
      .then((r) => {
        if (r.status === "success") setEmployees(r.data);
      })
      .catch(() => undefined);
  }, []);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!karyawanId || !tanggal || !jamMulai || !jamSelesai) {
      setError("Lengkapi semua field");
      return;
    }
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karyawanId, tanggal, jamMulai, jamSelesai, role }),
    }).then((x) => x.json());
    if (res.status !== "success") {
      setError(res.message ?? "Gagal membuat shift");
    } else {
      setError("");
      setShowForm(false);
      load();
    }
  }

  async function cancelShift(id: string) {
    const res = await fetch(`/api/roster?id=${id}`, { method: "DELETE" }).then((x) => x.json());
    if (res.status === "success") load();
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

function IncidentQueue() {
  const [items, setItems] = useState<Incident[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  // create form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("MEDIUM");

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/incidents").then((x) => x.json());
      if (res.status === "success") setItems(res.data);
      else setError(res.message ?? "Gagal memuat insiden");
    } catch {
      setError("Terjadi kesalahan saat memuat insiden");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/employees")
      .then((x) => x.json())
      .then((r) => {
        if (r.status === "success") setEmployees(r.data);
      })
      .catch(() => undefined);
  }, []);

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || undefined, severity }),
    }).then((x) => x.json());
    if (res.status === "success") {
      setShowForm(false);
      setTitle("");
      setDescription("");
      load();
    }
  }

  async function act(id: string, action: string, body?: object) {
    const res = await fetch(`/api/incidents?id=${id}&action=${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then((x) => x.json());
    if (res.status === "success") load();
  }

  async function assign(id: string, assigneeId: string) {
    await act(id, "assign", { status: "ASSIGNED", assigneeId });
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
          <span>Laporkan Kendala Studio / Live</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={createIncident} className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-xs shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul kendala (mis. Mic wireless studio 2 baterai drop)"
            className="border border-slate-200 rounded-xl px-3 py-2 md:col-span-3 outline-none"
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi detail..."
            className="border border-slate-200 rounded-xl px-3 py-2 md:col-span-2 outline-none"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
            className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <button type="submit" className="px-3 py-2 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 md:col-span-1 shadow-sm">
            Kirim Laporan
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {items.map((it) => (
          <div key={it.id} className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
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
                {it.description || "Kendala teknis operasional live."}
              </div>
              <div className="text-[11px] text-slate-400">
                Ditugaskan ke: <strong className="text-slate-700">{it.assignee?.namaLengkap ?? "Belum ada PIC"}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {it.status !== "RESOLVED" && it.status !== "CLOSED" && (
                <>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) assign(it.id, e.target.value);
                      e.target.value = "";
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white"
                  >
                    <option value="">Tugaskan ke OTS...</option>
                    {employees.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.namaLengkap}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => act(it.id, "resolve", { status: "RESOLVED" })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Selesaikan (Resolve)
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
    </div>
  );
}
