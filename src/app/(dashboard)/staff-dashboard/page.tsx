"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SopTask = {
  id: string;
  title: string;
  requiresPhoto: boolean;
  completed: boolean;
  photoUrl: string | null;
  note: string | null;
  completionId: string | null;
};
type SopTemplate = {
  id: string;
  title: string;
  description: string | null;
  tasks: SopTask[];
};

export default function StaffDashboardPage() {
  const { data: session } = useSession();
  const [sesi, setSesi] = useState<{ id: string; waktu: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState("");

  const [sop, setSop] = useState<SopTemplate[]>([]);
  const [sopLoading, setSopLoading] = useState(false);
  const [photoInputs, setPhotoInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSession();
    loadSop();
  }, []);

  async function loadSop() {
    setSopLoading(true);
    try {
      const r = await fetch("/api/sop?view=checklist");
      const d = await r.json();
      if (d.status === "success") setSop(d.data ?? []);
    } catch {
      // ignore
    } finally {
      setSopLoading(false);
    }
  }

  async function toggleSopTask(task: SopTask, checked: boolean) {
    setSopLoading(true);
    setError("");
    try {
      const photoUrl = task.requiresPhoto ? (photoInputs[task.id] ?? "") : undefined;
      const r = await fetch("/api/sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-task", taskId: task.id, completed: checked, photoUrl }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(checked ? "Tugas SOP ditandai selesai ✓" : "Tugas SOP dibatalkan.");
        loadSop();
      } else {
        setError(d.message ?? "Gagal menyimpan tugas SOP");
      }
    } catch {
      setError("Gagal menyimpan tugas SOP");
    } finally {
      setSopLoading(false);
    }
  }

  async function loadSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff?view=sesi");
      const d = await res.json();
      if (d.status === "success") setSesi(d.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function doAbsen(tipe: "CHECK_IN" | "CHECK_OUT") {
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe,
          kategori: "STAFF",
          fotoBuktiUrl: fotoBuktiUrl || undefined,
        }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setSuccess(
          tipe === "CHECK_IN"
            ? "Presensi Masuk (Check-In) berhasil dicatat!"
            : "Presensi Pulang (Check-Out) berhasil dicatat!"
        );
        loadSession();
      } else {
        setError(d.message ?? "Gagal memproses absensi");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff & OTS Operations Hub</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Portal presensi kerja harian, monitoring shift operasional kantor & studio agency.
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
        {/* Attendance Card (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-id-badge" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{session?.user?.name ?? "Staff Operasional"}</h3>
                <div className="text-xs text-slate-400 font-mono">
                  {session?.user?.email} • {session?.user?.role ?? "STAFF"}
                </div>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                sesi ? "bg-emerald-100 text-emerald-700 animate-pulse" : "bg-slate-100 text-slate-600"
              }`}
            >
              {sesi ? "● SEDANG BERTUGAS" : "OFF-DUTY"}
            </span>
          </div>

          {/* Sesi Status Card */}
          <div className={`p-4 rounded-xl border ${sesi ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="text-xs font-semibold text-slate-600 mb-1">Status Kehadiran Hari Ini:</div>
            {loading ? (
              <div className="text-xs text-slate-400">Memeriksa status sesi...</div>
            ) : sesi ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-emerald-600" />
                  <span>Aktif Check-In sejak: {new Date(sesi.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                </div>
                <div className="text-[11px] text-emerald-700">Tanggal: {new Date(sesi.waktu).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Anda belum melakukan Check-In untuk hari ini. Silakan klik tombol di bawah.</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Link Foto / Dokumentasi Studio (Opsional)
            </label>
            <input
              type="text"
              value={fotoBuktiUrl}
              onChange={(e) => setFotoBuktiUrl(e.target.value)}
              placeholder="https://drive.google.com/... atau URL foto"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => doAbsen("CHECK_IN")}
              disabled={actionLoading || Boolean(sesi)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-door-open" />
              <span>Presensi Masuk (Check-In)</span>
            </button>

            <button
              onClick={() => doAbsen("CHECK_OUT")}
              disabled={actionLoading || !sesi}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md shadow-slate-900/20 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-door-closed" />
              <span>Presensi Pulang (Check-Out)</span>
            </button>
          </div>
        </div>

        {/* Operational Guidelines & SOP Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">SOP & Tugas Operasional Staff</h3>
              <button
                onClick={loadSop}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                <i className="fa-solid fa-arrows-rotate mr-1" />
                Refresh
              </button>
            </div>

            {sopLoading && <p className="text-xs text-slate-500">Memuat checklist...</p>}

            {!sopLoading && sop.length === 0 && (
              <p className="text-xs text-slate-400">
                Belum ada checklist SOP aktif. Admin/Operasional dapat membuat template tugas.
              </p>
            )}

            {sop.map((tpl) => (
              <div key={tpl.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="font-bold text-slate-800 text-xs">
                  {tpl.title}
                  <span className="text-slate-400 font-normal ml-1">({tpl.tasks.filter((t) => t.completed).length}/{tpl.tasks.length} selesai)</span>
                </div>
                {tpl.description && <p className="text-[11px] text-slate-500">{tpl.description}</p>}
                <div className="space-y-1.5">
                  {tpl.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => toggleSopTask(task, e.target.checked)}
                        disabled={sopLoading}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div className="flex-1">
                        <div className={`text-[11px] ${task.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {task.title}
                          {task.requiresPhoto && (
                            <span className="ml-1 text-[9px] font-bold text-amber-600">📷 wajib foto</span>
                          )}
                        </div>
                        {task.requiresPhoto && !task.completed && (
                          <input
                            type="url"
                            value={photoInputs[task.id] ?? ""}
                            onChange={(e) => setPhotoInputs({ ...photoInputs, [task.id]: e.target.value })}
                            placeholder="Tempel URL bukti foto (Drive / gambar)"
                            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        )}
                        {task.photoUrl && (
                          <div className="mt-1">
                            <span className="text-[9px] text-emerald-600 font-semibold">✓ Bukti foto terlampir</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
