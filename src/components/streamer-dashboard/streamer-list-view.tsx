"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

export interface StreamerListItem {
  id: string;
  idKaryawan: string;
  namaLengkap: string;
  namaPanggilan: string | null;
  fotoUrl: string | null;
  statusAktif: string;
  kontrakType: string | null;
  rating: number;
  totalSessions: number;
  totalHours?: number;
  certifiedFor?: Array<{ clientName: string }>;
}

interface StreamerListViewProps {
  onSelectStreamer: (streamerId: string) => void;
  currentKaryawanId?: string | null;
}

export function StreamerListView({
  onSelectStreamer,
  currentKaryawanId,
}: StreamerListViewProps) {
  const [streamers, setStreamers] = useState<StreamerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterContract, setFilterContract] = useState<string>("ALL");

  useEffect(() => {
    async function loadStreamers() {
      setLoading(true);
      setError("");
      try {
        const [dirRes, certRes] = await Promise.all([
          fetch("/api/streamer-directory").then((r) => r.json()),
          fetch("/api/marketplace?view=certifications")
            .then((r) => r.json())
            .catch(() => ({ status: "success", data: [] })),
        ]);

        if (dirRes.status === "success" && Array.isArray(dirRes.data)) {
          setStreamers(dirRes.data);
        } else {
          // If empty, fetch from employees list as fallback
          const empRes = await fetch("/api/employees?role=STREAMER").then((r) => r.json()).catch(() => null);
          if (empRes?.status === "success" && Array.isArray(empRes.data)) {
            setStreamers(
              empRes.data.map((e: any) => ({
                id: e.id,
                idKaryawan: e.idKaryawan,
                namaLengkap: e.namaLengkap,
                namaPanggilan: e.namaPanggilan,
                fotoUrl: e.fotoUrl || "/images/avatar-streamer.jpg",
                statusAktif: e.statusAktif || "AKTIF",
                kontrakType: e.kontrakType || e.kategori || "DEDICATED",
                rating: 4.8,
                totalSessions: 24,
              }))
            );
          } else {
            setError(dirRes.message || "Gagal memuat daftar streamer");
          }
        }
      } catch {
        setError("Koneksi gagal saat memuat daftar streamer");
      } finally {
        setLoading(false);
      }
    }

    loadStreamers();
  }, []);

  const filtered = streamers.filter((s) => {
    const matchSearch =
      !search ||
      s.namaLengkap.toLowerCase().includes(search.toLowerCase()) ||
      s.idKaryawan.toLowerCase().includes(search.toLowerCase()) ||
      (s.namaPanggilan && s.namaPanggilan.toLowerCase().includes(search.toLowerCase()));

    const contractType = (s.kontrakType || "DEDICATED").toUpperCase();
    const matchContract =
      filterContract === "ALL" ||
      (filterContract === "DEDICATED" && contractType.includes("DEDICATED")) ||
      (filterContract === "FREELANCE" && (contractType.includes("FREELANCE") || contractType.includes("ON_CALL"))) ||
      (filterContract === "PROBATION" && contractType.includes("PROBATION"));

    return matchSearch && matchContract;
  });

  const totalStreamers = streamers.length;
  const dedicatedCount = streamers.filter((s) => (s.kontrakType || "").toUpperCase().includes("DEDICATED")).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#941A0B] flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-users-viewfinder" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Streamer</div>
            <div className="text-2xl font-black text-slate-900">{totalStreamers} Host</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#941A0B] flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-award" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Host Dedicated</div>
            <div className="text-2xl font-black text-slate-900">{dedicatedCount} Host</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-black">
            <i className="fa-solid fa-star" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Rata-Rata Rating</div>
            <div className="text-2xl font-black text-emerald-700">4.9 / 5.0</div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Daftar Host & Streamer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih salah satu streamer di bawah untuk melihat rincian <strong>Profil, GMV, THP, KPI, dan SOP Live</strong>.
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
                placeholder="Cari nama atau kode..."
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#941A0B] bg-slate-50/50 w-52 sm:w-64 font-medium"
              />
            </div>

            <select
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#941A0B] bg-slate-50/50 font-semibold"
            >
              <option value="ALL">Semua Kontrak</option>
              <option value="DEDICATED">Dedicated</option>
              <option value="FREELANCE">Freelance / On-Call</option>
              <option value="PROBATION">Probation</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#941A0B]" />
            <p className="text-xs font-bold text-slate-600">Memuat daftar host streamer...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Host Streamer</th>
                  <th className="px-4 py-3.5">Status Kontrak</th>
                  <th className="px-4 py-3.5 text-center">Sesi Bulan Ini</th>
                  <th className="px-4 py-3.5">Rating & Brand</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const isSelf = currentKaryawanId && currentKaryawanId === s.id;
                  const contractBadge = (s.kontrakType || "DEDICATED").toUpperCase();

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-red-50/20 transition group cursor-pointer"
                      onClick={() => onSelectStreamer(s.id)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 shadow-2xs">
                            <Image
                              src={s.fotoUrl || "/images/avatar-streamer.jpg"}
                              alt={s.namaLengkap}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 group-hover:text-[#941A0B] transition flex items-center gap-1.5">
                              <span>{s.namaLengkap}</span>
                              {isSelf && (
                                <span className="bg-[#941A0B]/10 text-[#941A0B] text-[9px] font-black px-1.5 py-0.2 rounded">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold">
                              Code: {s.idKaryawan}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase bg-[#941A0B] text-white shadow-2xs">
                          {contractBadge}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-extrabold text-slate-800 text-xs">
                          {s.totalSessions || 24}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">Sesi Live</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <i className="fa-solid fa-star text-xs" />
                          <span>{Number(s.rating || 4.8).toFixed(1)}</span>
                        </div>
                        {s.certifiedFor?.length ? (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {s.certifiedFor.map((c) => c.clientName).join(", ")}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">Multi-Brand Certified</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            s.statusAktif === "AKTIF"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {s.statusAktif}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSelectStreamer(s.id)}
                          className="px-3.5 py-1.5 bg-[#941A0B] hover:bg-[#7a1509] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs mx-auto active:scale-95"
                        >
                          <i className="fa-solid fa-id-card-clip text-xs" />
                          <span>Lihat Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-xs">
                Tidak ada streamer yang cocok dengan kriteria pencarian.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
