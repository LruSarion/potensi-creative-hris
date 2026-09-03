"use client";

// Jadwal tab of the streamer dashboard: the streamer's own live schedule table.
// Extracted verbatim from page.tsx (refactor only — markup and behavior unchanged).

import type { Jadwal } from "./types";
import { generateGoogleCalendarUrl } from "@/lib/google-calendar-utils";
import {
  formatDateSafe,
  formatTimeSafe,
} from "@/lib/utils/date-format";
import { TableLoadingState } from "@/components/ui/loading-states";

export function TabJadwal({
  jadwal,
  loading,
  onSelectForCheckIn,
  onGoCheckout,
}: {
  jadwal: Jadwal[];
  loading: boolean;
  onSelectForCheckIn: (j: Jadwal) => void;
  onGoCheckout: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Jadwal Live Streaming Saya</h3>
          <p className="text-[11px] text-slate-400">Hadir 15 menit sebelum jam mulai untuk persiapan brief & sample produk.</p>
        </div>
        <span className="text-xs text-slate-500 font-semibold">{jadwal.length} Jadwal</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">ID Sesi</th>
              <th className="px-4 py-3">Tanggal & Jam</th>
              <th className="px-4 py-3">Brand & Platform</th>
              <th className="px-4 py-3">Lokasi Studio</th>
              <th className="px-4 py-3">Total GMV</th>
              <th className="px-4 py-3">Status Sesi</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableLoadingState
                colSpan={7}
                text="Memuat jadwal live streaming Anda..."
                subtext="Menyelaraskan data sesi siaran dan status on air..."
              />
            ) : (
              jadwal.map((j) => (
              <tr key={j.id} className="hover:bg-slate-50/80 transition">
                <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{j.idJadwal}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    {formatDateSafe(j.tanggal, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="text-[11px] text-[#941A0B] font-mono">
                    {formatTimeSafe(j.jamMulaiLive)}
                    {" - "}
                    {formatTimeSafe(j.jamSelesaiLive)} WIB
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{j.client?.namaClient ?? "Brand Partner"}</div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{j.platform ?? "Shopee Live"}</span>
                </td>
                <td className="px-4 py-3 text-slate-600 font-medium">
                  <i className="fa-solid fa-location-dot text-slate-400 mr-1.5" />
                  {j.studio || (j.cabangStudio && j.nomorStudio ? `Studio ${j.cabangStudio} ${j.nomorStudio.replace(/^Studio\s*/i, "")}` : (j.nomorStudio || j.cabangStudio || "Studio Timoho 1"))}
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-700">
                  {j.absensi && j.absensi.length > 0 && j.absensi.some(a => a.reportedGmv !== null)
                    ? `Rp ${j.absensi.reduce((sum, a) => sum + Number(a.reportedGmv || 0), 0).toLocaleString("id-ID")}`
                    : <span className="text-[10px] text-slate-400 font-normal italic">Belum ada</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    j.liveState === "LIVE"
                      ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                      : j.status === "SELESAI"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-[#941A0B]/10 text-[#941A0B] border-[#941A0B]/20"
                  }`}>
                    {j.liveState === "LIVE" ? "🔴 ON AIR" : j.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {j.status !== "SELESAI" && j.liveState !== "CLOSED" && (
                      <a
                        href={generateGoogleCalendarUrl({
                          title: `🔴 Live Streaming: ${j.client?.namaClient ?? "Brand Partner"} (${j.platform ?? "Shopee Live"})`,
                          description: `Jadwal Siaran Live Streaming Agency Potensi Creative\nID Sesi: ${j.idJadwal}\nStudio: ${j.studio ?? "Studio 1"}\nPengingat otomatis diset: 30 mnt & 15 mnt sebelum siaran.`,
                          location: `Studio ${j.studio ?? "Studio 1"}, Potensi Creative`,
                          startTime: j.jamMulaiLive,
                          endTime: j.jamSelesaiLive,
                          reminderMinutes: [30, 15],
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Tambah Pengingat Google Calendar (Pop-up 30m & 15m)"
                        className="px-2.5 py-1 bg-[#941A0B]/10 hover:bg-[#941A0B]/15 text-[#941A0B] border border-[#941A0B]/20 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                      >
                        <i className="fa-solid fa-calendar-plus text-[#941A0B]" />
                        <span className="hidden sm:inline">Sync GCal</span>
                      </a>
                    )}

                    {j.liveState === "LIVE" ? (
                      <button
                        onClick={onGoCheckout}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Check-Out
                      </button>
                    ) : j.status === "SELESAI" || j.liveState === "CLOSED" ? (
                      <span className="text-[10px] text-slate-400 font-bold italic">Selesai</span>
                    ) : (
                      <button
                        onClick={() => onSelectForCheckIn(j)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Check-In
                      </button>
                    )}
                  </div>
                </td>

              </tr>
            )))}
          </tbody>
        </table>
        {jadwal.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada jadwal live streaming yang ditugaskan kepada Anda.
          </div>
        )}
      </div>
    </div>
  );
}