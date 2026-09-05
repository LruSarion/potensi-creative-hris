"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
import Image from "next/image";
import { fetchJson } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";

export interface StreamerListItem {
  id: string;
  idKaryawan: string;
  namaLengkap: string;
  namaPanggilan?: string | null;
  email?: string | null;
  nomorTelepon?: string | null;
  fotoUrl?: string | null;
  photoUrl?: string | null;
  jabatan?: string | null;
  kategori?: string | null;
  statusAktif: string;
  totalSessions?: number;
  totalSessionsMonth?: number;
  totalHoursMonth?: number;
}

interface StreamerListViewProps {
  onSelectStreamer: (streamerId: string) => void;
  currentKaryawanId?: string | null;
}

const StreamerRowItem = memo(function StreamerRowItem({
  streamer,
  index,
  isSelf,
  onSelect,
}: {
  streamer: StreamerListItem;
  index: number;
  isSelf: boolean;
  onSelect: (id: string) => void;
}) {
  const photoSrc = streamer.fotoUrl || streamer.photoUrl;
  const completedCount = streamer.totalSessionsMonth ?? streamer.totalSessions ?? 0;
  const isAktif = (streamer.statusAktif || "AKTIF").toUpperCase() === "AKTIF";

  return (
    <tr
      className="hover:bg-red-50/20 transition group cursor-pointer"
      onClick={() => onSelect(streamer.id)}
    >
      <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">
        {index + 1}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 shadow-2xs">
            {photoSrc ? (
              <Image
                src={photoSrc}
                alt={streamer.namaLengkap}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#941A0B]/10 text-[#941A0B] font-bold text-sm">
                {streamer.namaLengkap.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <span>{streamer.namaLengkap}</span>
              {isSelf && (
                <span className="bg-[#941A0B] text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                  Anda
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono font-medium mt-0.5">
              {streamer.idKaryawan}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="font-bold text-slate-700 text-xs">{streamer.jabatan || "Live Streamer"}</div>
        <div className="text-[11px] text-slate-400 font-medium">{streamer.kategori || "Host"}</div>
      </td>

      <td className="px-4 py-3.5 text-center">
        <span className="font-extrabold text-sm text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
          {completedCount} Sesi
        </span>
      </td>

      <td className="px-4 py-3.5 text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${
            isAktif
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isAktif ? "bg-emerald-500" : "bg-slate-400"}`} />
          <span>{streamer.statusAktif || "AKTIF"}</span>
        </span>
      </td>

      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onSelect(streamer.id)}
          className="px-3.5 py-1.5 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs mx-auto active:scale-95 cursor-pointer"
        >
          <i className="fa-solid fa-id-card text-xs" />
          <span>Lihat Profil</span>
        </button>
      </td>
    </tr>
  );
});

export const StreamerListView = memo(function StreamerListView({
  onSelectStreamer,
  currentKaryawanId,
}: StreamerListViewProps) {
  const [streamers, setStreamers] = useState<StreamerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    async function loadStreamers() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchJson<StreamerListItem[]>("/api/streamer-directory");
        if (Array.isArray(data)) {
          setStreamers(data);
        }
      } catch (err) {
        // Fallback if needed
        try {
          const empRes = await fetchJson<Partial<StreamerListItem>[]>(
            "/api/employees?kategori=STREAMER"
          ).catch(() => null);
          if (Array.isArray(empRes)) {
            setStreamers(
              empRes.map((e) => ({
                id: e.id!,
                idKaryawan: e.idKaryawan!,
                namaLengkap: e.namaLengkap!,
                namaPanggilan: e.namaPanggilan,
                email: e.email,
                nomorTelepon: e.nomorTelepon,
                fotoUrl: e.fotoUrl || null,
                jabatan: e.jabatan || "Host Streamer",
                kategori: e.kategori || "STREAMER",
                statusAktif: e.statusAktif || "AKTIF",
                totalSessions: 0,
                totalSessionsMonth: 0,
                totalHoursMonth: 0,
              }))
            );
          } else {
            setError(err instanceof Error ? err.message : "Gagal memuat daftar host streamer");
          }
        } catch {
          setError("Koneksi gagal saat memuat daftar host streamer");
        }
      } finally {
        setLoading(false);
      }
    }

    loadStreamers();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return streamers.filter((s) => {
      const matchSearch =
        !query ||
        s.namaLengkap.toLowerCase().includes(query) ||
        s.idKaryawan.toLowerCase().includes(query) ||
        (s.namaPanggilan && s.namaPanggilan.toLowerCase().includes(query)) ||
        (s.jabatan && s.jabatan.toLowerCase().includes(query));

      const statusNorm = (s.statusAktif || "AKTIF").toUpperCase();
      const matchStatus =
        filterStatus === "ALL" ||
        (filterStatus === "AKTIF" && (statusNorm === "AKTIF" || !statusNorm.includes("NON"))) ||
        (filterStatus === "NON_AKTIF" && (statusNorm === "NON_AKTIF" || statusNorm.includes("NON")));

      return matchSearch && matchStatus;
    });
  }, [streamers, search, filterStatus]);

  const totalStreamers = streamers.length;
  const activeCount = useMemo(() => {
    return streamers.filter(
      (s) => (s.statusAktif || "AKTIF").toUpperCase() === "AKTIF"
    ).length;
  }, [streamers]);
  const totalCompletedSessions = useMemo(() => {
    return streamers.reduce(
      (sum, s) => sum + (s.totalSessionsMonth || s.totalSessions || 0),
      0
    );
  }, [streamers]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Cards based on 100% Real Database Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Streamer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#941A0B] flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-users-viewfinder" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Total Streamer
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalStreamers} Host
            </div>
          </div>
        </div>

        {/* Card 2: Streamer Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-user-check" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Streamer Aktif
            </div>
            <div className="text-2xl font-black text-emerald-700">
              {activeCount} Host
            </div>
          </div>
        </div>

        {/* Card 3: Total Sesi Live Selesai Bulan Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-calendar-check" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Total Sesi Bulan Ini
            </div>
            <div className="text-2xl font-black text-blue-700">
              {totalCompletedSessions} Sesi
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-id-badge text-[#941A0B]" />
              <span>Daftar Host & Streamer</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih salah satu streamer di bawah untuk melihat rincian <strong>Profil, Jam Live, GMV, dan Estimasi THP</strong>.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau kode host..."
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-slate-50/50 w-56 sm:w-64 font-medium"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#941A0B] bg-slate-50/50 font-semibold cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="AKTIF">Status: Aktif</option>
              <option value="NON_AKTIF">Status: Non-Aktif</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto min-h-[360px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">No</th>
                <th className="px-4 py-3.5">Host Streamer</th>
                <th className="px-4 py-3.5">Jabatan / Kategori</th>
                <th className="px-4 py-3.5 text-center">Sesi Selesai Bulan Ini</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableLoadingState
                  colSpan={6}
                  text="Memuat data host streamer dari database..."
                  subtext="Menyelaraskan profil dan rekap performa sesi..."
                />
              ) : (
                filtered.map((s, idx) => (
                  <StreamerRowItem
                    key={s.id}
                    streamer={s}
                    index={idx}
                    isSelf={Boolean(currentKaryawanId && currentKaryawanId === s.id)}
                    onSelect={onSelectStreamer}
                  />
                ))
              )}
            </tbody>
          </table>

          {filtered.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-user-slash text-3xl mb-2 block text-slate-300" />
              <span>Tidak ada host streamer yang cocok dengan kriteria pencarian.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

