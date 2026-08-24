"use client";

import { useEffect, useState } from "react";

type ApprovalItem = {
  id: string;
  type: string;
  ref: string;
  tanggal: string;
  namaLengkap: string;
  idKaryawan: string;
  detail: string;
  alasan: string;
  status: string;
  // extra fields
  jamMulai?: string;
  jamSelesai?: string;
  jenis?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  requesterName?: string;
  targetName?: string;
};

const MAIN_TABS = [
  { id: "jadwal", label: "Marketplace", icon: "fa-solid fa-store" },
  { id: "lembur", label: "Lembur", icon: "fa-solid fa-clock" },
  { id: "izin", label: "Cuti / Izin", icon: "fa-solid fa-calendar-xmark" },
  { id: "shift", label: "Tukar Shift", icon: "fa-solid fa-right-left" },
];

const SUB_TABS = [
  { id: "PENDING", label: "Pending", color: "text-amber-600" },
  { id: "APPROVED", label: "Disetujui", color: "text-emerald-600" },
  { id: "REJECTED", label: "Ditolak", color: "text-red-600" },
];

function statusBadge(status: string) {
  if (status === "APPROVED" || status === "DISETUJUI")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "REJECTED" || status === "DITOLAK")
    return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function typeBadge(type: string) {
  if (type === "izin") return "bg-sky-50 text-sky-700 border-sky-200";
  if (type === "lembur") return "bg-violet-50 text-violet-700 border-violet-200";
  if (type === "shift") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function typeLabel(type: string) {
  if (type === "izin") return "Izin/Cuti";
  if (type === "lembur") return "Lembur";
  if (type === "shift") return "Tukar Shift";
  return "Marketplace";
}

export default function ApprovalPage() {
  const [allList, setAllList] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("jadwal");
  const [activeSubTab, setActiveSubTab] = useState("PENDING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/approval");
      const d = await r.json();
      if (d.status === "success") setAllList(d.data);
      else setError(d.message ?? "Gagal memuat daftar approval");
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: "approve" | "reject", type: string) {
    setError("");
    setSuccess("");
    try {
      const r = await fetch(`/api/approval?id=${id}&action=${action}&type=${type}`, { method: "PATCH" });
      const d = await r.json();
      if (d.status === "success") {
        setSuccess(`Pengajuan berhasil di-${action === "approve" ? "setujui" : "tolak"}!`);
        setExpandedId(null);
        load();
      } else {
        setError(d.message ?? "Gagal memproses approval");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    }
  }

  // Filter by main tab type + sub tab status + search
  const tabTypeMap: Record<string, string> = {
    jadwal: "jadwal",
    lembur: "lembur",
    izin: "izin",
    shift: "shift",
  };

  const filtered = allList.filter((item) => {
    const matchType = item.type === tabTypeMap[activeMainTab];
    const matchStatus = item.status?.toUpperCase() === activeSubTab;
    const q = search.toLowerCase();
    const matchSearch = !q || item.namaLengkap?.toLowerCase().includes(q) || item.ref?.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  });

  // Count per sub-tab for active main tab
  function countForSubTab(subStatus: string) {
    return allList.filter(
      (item) => item.type === tabTypeMap[activeMainTab] && item.status?.toUpperCase() === subStatus
    ).length;
  }

  return (
    <div className="space-y-6">
      {/* Header persis ref-website-lama/approval.html */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 lg:hidden">Approval</h1>
        <p className="text-slate-500 text-sm mt-1">Persetujuan pengajuan lembur, cuti, tukar shift, dan Jadwal Klien (Marketplace).</p>
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

      {/* MAIN TABS — Underline style matching ref-website-lama */}
      <div className="flex flex-nowrap overflow-x-auto border-b border-slate-200 gap-6" style={{ scrollbarWidth: "none" }}>
        {MAIN_TABS.map((tab) => {
          const pendingCount = allList.filter(
            (item) => item.type === tabTypeMap[tab.id] && item.status?.toUpperCase() === "PENDING"
          ).length;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveMainTab(tab.id);
                setActiveSubTab("PENDING");
                setExpandedId(null);
                setSearch("");
              }}
              className={`py-2.5 px-2 text-sm transition whitespace-nowrap border-b-2 flex items-center gap-1.5 ${
                activeMainTab === tab.id
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 font-medium hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <i className={tab.icon} />
              <span>{tab.label}</span>
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB TABS — Pill style */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          {SUB_TABS.map((sub) => {
            const cnt = countForSubTab(sub.id);
            return (
              <button
                key={sub.id}
                onClick={() => { setActiveSubTab(sub.id); setExpandedId(null); }}
                className={`py-1.5 px-4 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeSubTab === sub.id
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span>{sub.label}</span>
                <span className={`text-[10px] font-bold ${activeSubTab === sub.id ? "opacity-70" : ""}`}>
                  ({cnt})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / referensi..."
              className="w-52 pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <button
            onClick={load}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrows-rotate" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden min-h-[300px]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:px-6 border-b border-slate-100 gap-2">
          <h3 className="font-bold text-slate-800 uppercase flex items-center gap-2 tracking-wide text-sm">
            <i className="fa-solid fa-list-check text-blue-500" />
            {MAIN_TABS.find((t) => t.id === activeMainTab)?.label} — {SUB_TABS.find((s) => s.id === activeSubTab)?.label}
          </h3>
          <span className="text-xs text-slate-500 font-medium">{filtered.length} pengajuan</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <i className="fa-solid fa-circle-notch fa-spin mr-2" />
            Mengambil data dari server...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Referensi</th>
                  <th className="px-4 py-3">Pemohon</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <>
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-700 text-xs">{item.ref}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 text-sm">{item.namaLengkap ?? "–"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.idKaryawan ?? "–"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-xs">
                        {new Date(item.tanggal).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-xs">{item.detail}</div>
                        {item.alasan && <span className="text-[10px] text-slate-500">{item.alasan}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-slate-400 hover:text-blue-600 transition text-xs">
                          <i className={`fa-solid ${expandedId === item.id ? "fa-chevron-up" : "fa-chevron-down"}`} />
                        </button>
                      </td>
                    </tr>

                    {/* Expand Panel — fadeIn animation via CSS */}
                    {expandedId === item.id && (
                      <tr key={`${item.id}-expand`} className="bg-blue-50/30">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <i className="fa-solid fa-file-lines text-blue-500" />
                                Detail Pengajuan
                              </h4>
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${typeBadge(item.type)}`}>
                                {typeLabel(item.type)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-slate-500 block mb-0.5">Pemohon</span>
                                <span className="font-bold text-slate-800">{item.namaLengkap ?? "–"}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block mb-0.5">ID Karyawan</span>
                                <span className="font-mono font-bold text-slate-700">{item.idKaryawan ?? "–"}</span>
                              </div>
                              {item.jenis && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Kategori</span>
                                  <span className="font-semibold text-slate-800">{item.jenis}</span>
                                </div>
                              )}
                              {item.tanggalMulai && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Tanggal Mulai</span>
                                  <span className="font-semibold text-slate-800">{new Date(item.tanggalMulai).toLocaleDateString("id-ID")}</span>
                                </div>
                              )}
                              {item.tanggalSelesai && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Tanggal Selesai</span>
                                  <span className="font-semibold text-slate-800">{new Date(item.tanggalSelesai).toLocaleDateString("id-ID")}</span>
                                </div>
                              )}
                              {item.jamMulai && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Jam Mulai</span>
                                  <span className="font-mono font-bold text-slate-800">{item.jamMulai}</span>
                                </div>
                              )}
                              {item.jamSelesai && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Jam Selesai</span>
                                  <span className="font-mono font-bold text-slate-800">{item.jamSelesai}</span>
                                </div>
                              )}
                              {item.requesterName && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Pemohon Tukar</span>
                                  <span className="font-semibold text-slate-800">{item.requesterName}</span>
                                </div>
                              )}
                              {item.targetName && (
                                <div>
                                  <span className="text-slate-500 block mb-0.5">Pengganti</span>
                                  <span className="font-semibold text-blue-700">{item.targetName}</span>
                                </div>
                              )}
                              <div className="col-span-2 sm:col-span-3">
                                <span className="text-slate-500 block mb-0.5">Alasan / Keterangan</span>
                                <span className="font-semibold text-slate-800">{item.alasan || item.detail || "–"}</span>
                              </div>
                            </div>

                            {activeSubTab === "PENDING" && (
                              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                  onClick={(e) => { e.stopPropagation(); act(item.id, "reject", item.type); }}
                                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-sm shadow-red-600/20"
                                >
                                  <i className="fa-solid fa-xmark mr-1.5" />
                                  Tolak
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); act(item.id, "approve", item.type); }}
                                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm shadow-emerald-600/20"
                                >
                                  <i className="fa-solid fa-check mr-1.5" />
                                  Setujui
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && !loading && (
              <div className="p-10 text-center text-slate-400 text-sm">
                <i className="fa-solid fa-circle-check text-3xl text-emerald-400 mb-3 block" />
                {activeSubTab === "PENDING"
                  ? "Tidak ada pengajuan yang menunggu persetujuan."
                  : `Tidak ada pengajuan dengan status ${activeSubTab}.`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
