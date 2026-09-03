"use client";

// History/Riwayat tab of the streamer dashboard: filter bar, attendance table
// (8 columns persis ref-deploy), and pagination. Extracted verbatim from
// page.tsx (refactor only — markup and behavior unchanged).

import type { AbsensiHistory } from "./types";
import {
  formatDateSafe,
  formatTimeSafe,
} from "@/lib/utils/date-format";

export function TabRiwayat({
  filteredHistory,
  paginatedHistory,
  totalPagesHistory,
  pageHistory,
  rowsPerPageHistory,
  filterPeriodeHistory,
  filterRangeStartHistory,
  filterRangeEndHistory,
  filterTextHistory,
  filterStatusHistory,
  filterColHistory,
  sessionUserName,
  onFilterPeriodeChange,
  onFilterRangeStartChange,
  onFilterRangeEndChange,
  onFilterTextChange,
  onFilterStatusChange,
  onFilterColChange,
  onPageChange,
  onReportGmv,
  onShowBukti,
}: {
  filteredHistory: AbsensiHistory[];
  paginatedHistory: AbsensiHistory[];
  totalPagesHistory: number;
  pageHistory: number;
  rowsPerPageHistory: number;
  filterPeriodeHistory: string;
  filterRangeStartHistory: string;
  filterRangeEndHistory: string;
  filterTextHistory: string;
  filterStatusHistory: string;
  filterColHistory: string;
  sessionUserName?: string | null;
  onFilterPeriodeChange: (v: string) => void;
  onFilterRangeStartChange: (v: string) => void;
  onFilterRangeEndChange: (v: string) => void;
  onFilterTextChange: (v: string) => void;
  onFilterStatusChange: (v: string) => void;
  onFilterColChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onReportGmv: () => void;
  onShowBukti: (h: AbsensiHistory) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-[#941A0B]" />
            <span>History Absensi Saya</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh riwayat jadwal, jam tayang live, waktu presensi, status, dan GMV streaming Anda.
          </p>
        </div>
        <span className="text-xs font-bold text-[#941A0B] bg-[#941A0B]/10 px-3 py-1 rounded-xl self-start sm:self-auto border border-[#941A0B]/20">
          {filteredHistory.length} Total Sesi
        </span>
      </div>

      {/* Filter Bar (matching ref-deploy) */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Left: Filter Periode */}
        <div className="w-full lg:w-1/3 flex flex-col sm:flex-row gap-2">
          <select
            value={filterPeriodeHistory}
            onChange={(e) => onFilterPeriodeChange(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50 outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors cursor-pointer"
          >
            <option value="ALL">-- Semua Periode --</option>
            <option value="TODAY">Hari Ini</option>
            <option value="PREV_7">7 Hari Ke Belakang</option>
            <option value="NEXT_7">7 Hari Ke Depan</option>
            <option value="PREV_35">35 Hari Ke Belakang</option>
            <option value="NEXT_35">35 Hari Ke Depan</option>
            <option value="CUSTOM">Kustom Periode...</option>
          </select>

          {filterPeriodeHistory === "CUSTOM" && (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="date"
                value={filterRangeStartHistory}
                onChange={(e) => onFilterRangeStartChange(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B]"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={filterRangeEndHistory}
                onChange={(e) => onFilterRangeEndChange(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B]"
              />
            </div>
          )}
        </div>

        {/* Right: Search Box & Column Filter */}
        <div className="w-full lg:w-2/3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-2.5 text-slate-400 text-xs" />
            <input
              type="text"
              value={filterTextHistory}
              onChange={(e) => onFilterTextChange(e.target.value)}
              placeholder="Ketik untuk mencari..."
              className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors"
            />
          </div>

          {filterColHistory === "status" && (
            <select
              value={filterStatusHistory}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-[#941A0B] sm:w-44 transition-colors cursor-pointer"
            >
              <option value="">-- Semua Status --</option>
              <option value="SELESAI">SELESAI</option>
              <option value="ON AIR">ON AIR</option>
              <option value="PERLU LAPOR">PERLU LAPOR</option>
              <option value="TERJADWAL">TERJADWAL</option>
              <option value="BATAL">BATAL</option>
            </select>
          )}

          <select
            value={filterColHistory}
            onChange={(e) => onFilterColChange(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50 outline-none focus:ring-2 focus:ring-[#941A0B] sm:w-48 transition-colors cursor-pointer"
          >
            <option value="ALL">-- Semua Kolom --</option>
            <option value="idAbsen">ID Absen</option>
            <option value="idJadwal">ID Jadwal</option>
            <option value="status">Status</option>
            <option value="platform">Platform</option>
            <option value="streamer">Nama Streamer</option>
            <option value="idHost">ID Host</option>
            <option value="cabang">Cabang Studio</option>
          </select>
        </div>
      </div>

      {/* Table (8 Kolom persis ref-deploy) */}
      <div className="overflow-x-auto min-h-[480px] rounded-2xl border border-slate-200 relative bg-white shadow-xs">
        <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-30 shadow-xs text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 sticky left-0 top-0 bg-slate-50 z-40 shadow-[1px_0_0_#cbd5e1] text-center w-12">NO</th>
              <th className="px-4 py-3 sticky top-0 bg-slate-50 z-30 min-w-[150px]">ID ABSEN</th>
              <th className="px-4 py-3 text-center sticky top-0 bg-slate-50 z-30 min-w-[110px]">STATUS</th>
              <th className="px-4 py-3 sticky top-0 bg-slate-50 z-30 min-w-[160px]">PLATFORM</th>
              <th className="px-4 py-3 sticky top-0 bg-slate-50 z-30 min-w-[130px]">LOKASI</th>
              <th className="px-4 py-3 sticky top-0 bg-slate-50 z-30 min-w-[160px]">WAKTU LIVE</th>
              <th className="px-4 py-3 sticky top-0 bg-slate-50 z-30 min-w-[160px]">WAKTU ABSEN</th>
              <th className="px-4 py-3 text-center sticky top-0 bg-slate-50 z-30 min-w-[110px]">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedHistory.map((h, idx) => {
              const globalIdx = (pageHistory - 1) * rowsPerPageHistory + idx + 1;
              const bgRow = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

              let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
              if (h.status === "SELESAI" || h.status === "JADWAL FIX") {
                badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
              } else if (h.status === "BATAL" || h.status === "REJECTED") {
                badgeColor = "bg-red-50 text-red-700 border-red-200";
              } else if (h.status === "ON AIR") {
                badgeColor = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
              } else if (h.status === "PERLU LAPOR") {
                badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
              } else if (h.status === "TERJADWAL") {
                badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
              }

              const gmvFormatted = h.nominalGmv !== null && h.nominalGmv !== undefined
                ? `Rp ${Number(h.nominalGmv).toLocaleString("id-ID")}`
                : h.reportedGmv !== null && h.reportedGmv !== undefined
                ? `Rp ${Number(h.reportedGmv).toLocaleString("id-ID")}`
                : "-";

              const liveTimeStr = h.jamMulai && h.jamMulai !== "-" && h.jamSelesai && h.jamSelesai !== "-"
                ? `${h.jamMulai} - ${h.jamSelesai} WIB`
                : h.jadwal?.jamMulaiLive && h.jadwal?.jamSelesaiLive
                ? `${formatTimeSafe(h.jadwal.jamMulaiLive)} - ${formatTimeSafe(h.jadwal.jamSelesaiLive)} WIB`
                : "-";

              return (
                <tr key={h.id || idx} className={`${bgRow} hover:bg-slate-100/80 transition-colors`}>
                  <td className="px-4 py-3 text-center sticky left-0 z-10 shadow-[1px_0_0_#cbd5e1] font-bold text-slate-500 bg-inherit">
                    {globalIdx}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 font-mono text-xs">{h.idAbsen || `ABS-${(h.id || "").slice(-6).toUpperCase()}`}</p>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">{h.streamer || sessionUserName || "Streamer"}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      ID HOST: <span className="font-bold text-slate-600">{h.idHost || "-"}</span>
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs uppercase tracking-wide inline-block ${badgeColor}`}>
                      {h.status === "ON AIR" ? "🔴 ON AIR" : h.status || "SELESAI"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 text-xs">
                      {h.platform || h.jadwal?.platform || "TikTok"}
                      {h.clientName && h.clientName !== "-" ? ` • ${h.clientName}` : h.jadwal?.client?.namaClient ? ` • ${h.jadwal.client.namaClient}` : ""}
                    </p>
                    <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                      GMV: {gmvFormatted !== "-" ? gmvFormatted : <span className="text-slate-400 font-normal italic">Belum dilaporkan</span>}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      ID JADWAL: <span className="font-bold text-[#941A0B]">{h.idJadwal || h.jadwal?.idJadwal || "-"}</span>
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 text-xs">{h.cabang || h.jadwal?.cabangStudio || "Timoho"}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{h.studio || h.jadwal?.nomorStudio || "Studio 1"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 text-xs">{h.tanggal || (h.jadwal?.tanggal ? formatDateSafe(h.jadwal.tanggal) : "-")}</p>
                    <p className="text-[11px] font-bold text-blue-600 font-mono mt-0.5">
                      {liveTimeStr}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Durasi: {h.durasi || "2 Jam"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 text-xs font-mono">
                      {h.jamMasuk && h.jamMasuk !== "-" ? `${h.jamMasuk} WIB` : h.waktuMasuk ? `${formatTimeSafe(h.waktuMasuk)} WIB` : "-"}
                      {" - "}
                      {h.jamKeluar && h.jamKeluar !== "-" ? `${h.jamKeluar} WIB` : h.waktuKeluar ? `${formatTimeSafe(h.waktuKeluar)} WIB` : <span className="text-slate-400 italic text-[10px]">Belum checkout</span>}
                    </p>
                    <p className={`text-[11px] font-bold mt-0.5 ${h.isTelat ? "text-red-600 font-black" : "text-emerald-600"}`}>
                      Terlambat: {h.telatRaw || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {h.isTelat && (
                        <a
                          href="https://docs.google.com/forms/d/e/1FAIpQLSein5z3gooKWNMCIHa0Csl14ZznulEh9l1cLcu2I61YgJ_saA/viewform"
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition whitespace-nowrap flex items-center gap-1 mx-auto"
                          title="Formulir Banding Keterlambatan"
                        >
                          <i className="fa-solid fa-scale-balanced" />
                          <span>Banding</span>
                        </a>
                      )}
                      {(gmvFormatted === "-" || h.status === "PERLU LAPOR") && (
                        <button
                          type="button"
                          onClick={onReportGmv}
                          className="bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition whitespace-nowrap flex items-center gap-1 mx-auto"
                        >
                          <i className="fa-solid fa-file-invoice-dollar" />
                          <span>Lapor GMV</span>
                        </button>
                      )}
                      {h.buktiDriveId && (
                        <button
                          type="button"
                          onClick={() => onShowBukti(h)}
                          className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition whitespace-nowrap flex items-center gap-1 mx-auto active:scale-95 cursor-pointer"
                          title="Lihat Foto Bukti & Deteksi Lokasi GPS"
                        >
                          <i className="fa-solid fa-camera" />
                          <span>Bukti</span>
                        </button>
                      )}
                      {!h.isTelat && !(gmvFormatted === "-" || h.status === "PERLU LAPOR") && !h.buktiDriveId && (
                        <span className="text-slate-300 font-bold">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredHistory.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center min-h-[350px]">
            <i className="fa-solid fa-box-open text-3xl text-slate-300 mb-2" />
            <p>Tidak ada riwayat presensi yang sesuai dengan filter.</p>
          </div>
        )}
      </div>

      {/* Pagination Container matching ref-deploy */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 rounded-2xl gap-3 text-xs">
        <div className="text-slate-600 font-medium">
          Menampilkan halaman <span className="font-black text-[#941A0B]">{pageHistory}</span> dari{" "}
          <span className="font-black text-slate-800">{totalPagesHistory}</span> (
          <span className="font-bold">{filteredHistory.length}</span> Data)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, pageHistory - 1))}
            disabled={pageHistory <= 1}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-chevron-left text-[10px]" />
            <span>Sebelumnya</span>
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-slate-200/70 font-bold text-slate-800">
            Hal {pageHistory}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPagesHistory, pageHistory + 1))}
            disabled={pageHistory >= totalPagesHistory}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Selanjutnya</span>
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </button>
        </div>
      </div>
    </div>
  );
}