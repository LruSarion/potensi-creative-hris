"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionLoader } from "@/components/ui/loading-states";

type TabKey = "karyawan" | "jadwal-streamer" | "jadwal-ots" | "absensi";

const TAB_CONFIG: Record<TabKey, { label: string; countKey: keyof Counts; dataKey: string; icon: string }> = {
  karyawan: { label: "DB Karyawan", countKey: "karyawan", dataKey: "karyawan", icon: "fa-database" },
  "jadwal-streamer": { label: "Jadwal Streamers", countKey: "jadwalStreamer", dataKey: "jadwalStreamer", icon: "fa-video" },
  "jadwal-ots": { label: "Jadwal OTS", countKey: "jadwalOts", dataKey: "jadwalOts", icon: "fa-desktop" },
  absensi: { label: "Data Absensi", countKey: "absensi", dataKey: "absensi", icon: "fa-id-badge" },
};

type Counts = {
  karyawan: number;
  jadwalStreamer: number;
  jadwalOts: number;
  absensi: number;
};

export default function ViewDataPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("karyawan");
  const [search, setSearch] = useState("");
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    fetch("/api/view-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") setData(d.data);
        else setError(d.message ?? "Akses ditolak");
      })
      .catch(() => setError("Koneksi error"));
  }, []);

  function handleTabChange(key: TabKey) {
    setActiveTab(key);
    const dataKey = TAB_CONFIG[key].dataKey;
    if (data && !data[dataKey]) {
      setTabLoading(true);
      fetch(`/api/view-data?tab=${key}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success" && d.data) {
            setData((prev: any) => ({ ...prev, ...d.data }));
          }
        })
        .catch(() => {})
        .finally(() => setTabLoading(false));
    }
  }

  // Reset search when tab changes
  useEffect(() => setSearch(""), [activeTab]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">View Data</h1>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-48"></div>
            <div className="h-4 bg-slate-100 rounded w-72"></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12">
          <SectionLoader
            text="Menarik Master Data Operasional..."
            subtext="Menyelaraskan data karyawan, jadwal, absensi dari server..."
          />
        </div>
      </div>
    );
  }

  const counts: Counts = data.counts ?? {
    karyawan: data.karyawan?.length ?? 0,
    jadwalStreamer: data.jadwalStreamer?.length ?? 0,
    jadwalOts: data.jadwalOts?.length ?? 0,
    absensi: data.absensi?.length ?? 0,
  };

  const allRows: any[] = data[TAB_CONFIG[activeTab].dataKey] ?? [];

  // Search text per row — flatten relasi nested (nama host/OTS/client)
  function rowSearchText(row: any): string {
    const parts: string[] = [];
    for (const v of Object.values(row)) {
      if (v == null) continue;
      if (typeof v === "object") {
        if ("namaLengkap" in (v as any)) parts.push(String((v as any).namaLengkap ?? ""));
        else if ("namaClient" in (v as any)) parts.push(String((v as any).namaClient ?? ""));
        continue;
      }
      parts.push(String(v));
    }
    return parts.join(" ").toLowerCase();
  }

  // Apply search filter across all visible fields incl. nested relations
  const currentRows = search ? allRows.filter((row) => rowSearchText(row).includes(search.toLowerCase())) : allRows;

  // Format WA link
  function formatWaLink(phoneRaw: string | null | undefined) {
    if (!phoneRaw || phoneRaw === "-") return "-";
    let clean = phoneRaw.toString().replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.substring(1);
    return (
      <a href={`https://wa.me/${clean}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1.5 transition">
        <i className="fa-brands fa-whatsapp text-lg" />
        {phoneRaw}
      </a>
    );
  }

  // Status badge for karyawan
  function statusBadgeKaryawan(status: string) {
    const isActive = status === "AKTIF";
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
  }

  // Status badge for jadwal
  function statusBadgeJadwal(status: string) {
    const isBatal = status === "BATAL" || status === "DIBATALKAN";
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${isBatal ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
        {status}
      </span>
    );
  }

  // Status badge for absensi
  function statusBadgeAbsensi(status: string) {
    let cls = "bg-slate-100 text-slate-600";
    if (status === "HADIR") cls = "bg-emerald-50 text-emerald-700";
    else if (status === "TELAT" || status === "BELUM KELUAR") cls = "bg-red-50 text-red-700";
    else if (status === "IZIN" || status === "SAKIT" || status === "TANPA MASUK") cls = "bg-amber-50 text-amber-700";
    return <span className={`px-2 py-1 rounded text-xs font-bold ${cls}`}>{status}</span>;
  }

  // Render table header per tab
  function renderHeader() {
    switch (activeTab) {
      case "karyawan":
        return (
          <tr>
            <th className="px-4 py-3 font-medium">ID KARYAWAN</th>
            <th className="px-4 py-3 font-medium">NAMA LENGKAP</th>
            <th className="px-4 py-3 font-medium">JABATAN</th>
            <th className="px-4 py-3 font-medium">KATEGORI</th>
            <th className="px-4 py-3 font-medium">STATUS</th>
            <th className="px-4 py-3 font-medium">KONTAK (WA)</th>
          </tr>
        );
      case "jadwal-streamer":
        return (
          <tr>
            <th className="px-4 py-3 font-medium">TANGGAL</th>
            <th className="px-4 py-3 font-medium">ID JADWAL</th>
            <th className="px-4 py-3 font-medium">NAMA HOST</th>
            <th className="px-4 py-3 font-medium">PLATFORM</th>
            <th className="px-4 py-3 font-medium">JAM LIVE</th>
            <th className="px-4 py-3 font-medium text-center">STATUS</th>
          </tr>
        );
      case "jadwal-ots":
        return (
          <tr>
            <th className="px-4 py-3 font-medium">TANGGAL</th>
            <th className="px-4 py-3 font-medium">ID JADWAL</th>
            <th className="px-4 py-3 font-medium">NAMA OTS</th>
            <th className="px-4 py-3 font-medium">STUDIO</th>
            <th className="px-4 py-3 font-medium">JAM KERJA</th>
            <th className="px-4 py-3 font-medium text-center">STATUS</th>
          </tr>
        );
      case "absensi":
        return (
          <tr>
            <th className="px-4 py-3 font-medium">TANGGAL</th>
            <th className="px-4 py-3 font-medium">ID KARYAWAN</th>
            <th className="px-4 py-3 font-medium">NAMA LENGKAP</th>
            <th className="px-4 py-3 font-medium">JAM MASUK</th>
            <th className="px-4 py-3 font-medium">JAM KELUAR</th>
            <th className="px-4 py-3 font-medium">STATUS</th>
          </tr>
        );
    }
  }

  // Render table row per tab
  function renderRow(row: any, idx: number) {
    switch (activeTab) {
      case "karyawan":
        return (
          <tr key={row.idKaryawan ?? idx} className="border-b border-slate-100 table-row-hover data-row hover:bg-slate-50/80 transition">
            <td className="px-4 py-4 font-medium text-slate-700">
              <Link href={`/karyawan/${row.idKaryawan}`} className="text-blue-600 hover:underline font-semibold">
                {row.idKaryawan}
              </Link>
            </td>
            <td className="px-4 py-4 font-medium text-slate-900">{row.namaLengkap}</td>
            <td className="px-4 py-4 text-slate-600">{row.jabatan ?? "-"}</td>
            <td className="px-4 py-4 text-slate-600 text-xs">{row.kategori ?? "-"}</td>
            <td className="px-4 py-4">{statusBadgeKaryawan(row.statusAktif)}</td>
            <td className="px-4 py-4">{formatWaLink(row.nomorTelepon)}</td>
          </tr>
        );
      case "jadwal-streamer":
        return (
          <tr key={row.id ?? idx} className="border-b border-slate-100 table-row-hover data-row hover:bg-slate-50/80 transition">
            <td className="px-4 py-4 text-slate-600">
              {row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
            </td>
            <td className="px-4 py-4 font-medium text-slate-700">{row.idJadwal ?? "-"}</td>
            <td className="px-4 py-4 font-medium text-slate-900">
              {row.hostKaryawan?.namaLengkap ?? row.streamerKaryawan?.namaLengkap ?? "-"}
            </td>
            <td className="px-4 py-4 text-slate-600 text-xs">{row.client?.namaClient ?? row.platform ?? "-"}</td>
            <td className="px-4 py-4 text-slate-600 font-medium">
              {row.jamMulaiLive ? new Date(row.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
              {" - "}
              {row.jamSelesaiLive ? new Date(row.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
            </td>
            <td className="px-4 py-4 text-center">{statusBadgeJadwal(row.status)}</td>
          </tr>
        );
      case "jadwal-ots":
        return (
          <tr key={row.id ?? idx} className="border-b border-slate-100 table-row-hover data-row hover:bg-slate-50/80 transition">
            <td className="px-4 py-4 text-slate-600">
              {row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
            </td>
            <td className="px-4 py-4 font-medium text-slate-700">{row.idJadwal ?? "-"}</td>
            <td className="px-4 py-4 font-medium text-slate-900">{row.otsKaryawan?.namaLengkap ?? "-"}</td>
            <td className="px-4 py-4 text-slate-600">
              {(row.cabangStudio ?? "-") + " " + (row.nomorStudio ?? "")}
            </td>
            <td className="px-4 py-4 text-slate-600 font-medium">
              {row.jamMulaiLive ? new Date(row.jamMulaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
              {" - "}
              {row.jamSelesaiLive ? new Date(row.jamSelesaiLive).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
            </td>
            <td className="px-4 py-4 text-center">{statusBadgeJadwal(row.status)}</td>
          </tr>
        );
      case "absensi":
        return (
          <tr key={idx} className="border-b border-slate-100 table-row-hover data-row hover:bg-slate-50/80 transition">
            <td className="px-4 py-4 text-slate-600">{row.TANGGAL}</td>
            <td className="px-4 py-4 font-medium text-slate-700">{row.ID_KARYAWAN}</td>
            <td className="px-4 py-4 font-medium text-slate-900">{row.NAMA_LENGKAP}</td>
            <td className="px-4 py-4 text-emerald-600 font-bold">{row.WAKTU_ABSEN_MASUK ?? "-"}</td>
            <td className="px-4 py-4 text-red-500 font-bold">{row.WAKTU_ABSEN_KELUAR ?? "-"}</td>
            <td className="px-4 py-4">{statusBadgeAbsensi(row.STATUS_KEHADIRAN)}</td>
          </tr>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">View Data</h1>
        <p className="text-slate-500 text-sm mt-1">Lihat dan cari data operasional dari database pusat.</p>
      </div>

      {/* Tabs - Grid style like ref-deploy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-6">
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => {
          const cfg = TAB_CONFIG[key];
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`tab-btn ${active ? "tab-active" : "tab-inactive"}`}
            >
              <i className={`fa-solid ${cfg.icon} mr-1.5`} />
              <span>{cfg.label}</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                {counts[cfg.countKey]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col h-full min-h-[500px]">
        <div className="mb-6">
          <h3 id="panel-title" className="font-bold text-lg text-slate-900">{TAB_CONFIG[activeTab].label}</h3>
          <p id="panel-desc" className="text-sm text-slate-500 mt-1 mb-4">
            {activeTab === "karyawan" && "Data overview untuk seluruh karyawan teregistrasi."}
            {activeTab === "jadwal-streamer" && "Daftar jadwal live streaming Host."}
            {activeTab === "jadwal-ots" && "Daftar penugasan Operator studio."}
            {activeTab === "absensi" && "Rekapitulasi jam masuk dan keluar harian."}
          </p>

          <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 w-full md:w-1/2 focus-within:ring-2 focus-within:ring-blue-500 transition">
            <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-sm" />
            <input
              type="text"
              id="searchInput"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search data..."
              className="border-none bg-transparent focus:ring-0 outline-none text-sm w-full text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1 border rounded-lg border-slate-200 relative">
          {tabLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <i className="fa-solid fa-spinner animate-spin text-blue-600" />
              <span>Memuat data {TAB_CONFIG[activeTab].label}...</span>
            </div>
          ) : currentRows.length > 0 ? (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead id="table-head" className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                {renderHeader()}
              </thead>
              <tbody id="table-body">
                {currentRows.map((row, idx) => renderRow(row, idx))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500 italic">
              {search ? "Tidak ada data yang cocok dengan pencarian Anda." : "Database kosong atau tidak ada data valid."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
