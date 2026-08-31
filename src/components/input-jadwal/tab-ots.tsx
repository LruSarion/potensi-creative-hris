"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import { STUDIOS } from "@/types/jadwal";
import {
  generateNewScheduleId,
  applyShiftOts,
} from "@/lib/utils/schedule-helpers";
import {
  formatDateSafe,
  formatTimeSafe,
  calcWajibHadir,
} from "@/lib/utils/date-format";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { inputCls, selectCls, labelCls, getStatusBadgeClass } from "./shared-styles";

export function TabOts({
  otsStaff,
  allJadwal,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [otsForms, setOtsForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("OTS"),
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "Shopee Live",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      otsKaryawanId: "",
      otsId: "",
      otsNama: "",
      shiftOts: "",
      jamMulaiLive: "",
      jamSelesaiLive: "",
      catatanOts: "",
      filesOts: [""],
    },
  ]);
  const [isOtsCrashVerified, setIsOtsCrashVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Monitoring OTS Table states (Matching Staff Dashboard -> Tab Jadwal)
  const [otsFilterWaktu, setOtsFilterWaktu] = useState("all");
  const [otsFilterKategori, setOtsFilterKategori] = useState("all");
  const [otsSearchQuery, setOtsSearchQuery] = useState("");
  const [otsTablePage, setOtsTablePage] = useState(1);
  const [otsTablePageSize, setOtsTablePageSize] = useState(10);
  const [modalCatatanOts, setModalCatatanOts] = useState<string | null>(null);
  const [modalFileOts, setModalFileOts] = useState<string | null>(null);

  function handleAddOtsForm() {
    if (otsForms.length >= 50) {
      showAlert("⚠️ Maksimal 50 form sekaligus.");
      return;
    }
    const last = otsForms[otsForms.length - 1];
    setOtsForms((prev) => [
      ...prev,
      {
        id: Date.now(),
        idJadwal: generateNewScheduleId("OTS", last?.tanggal),
        tanggal: last?.tanggal || new Date().toISOString().slice(0, 10),
        platform: "Shopee Live",
        cabangStudio: last?.cabangStudio || "Timoho",
        nomorStudio: last?.nomorStudio || "01",
        otsKaryawanId: "",
        otsId: "",
        otsNama: "",
        shiftOts: last?.shiftOts || "",
        jamMulaiLive: last?.jamMulaiLive || "",
        jamSelesaiLive: last?.jamSelesaiLive || "",
        catatanOts: "",
        filesOts: [""],
      },
    ]);
    setIsOtsCrashVerified(false);
  }

  function handleRemoveOtsForm(id: number) {
    if (otsForms.length <= 1) return;
    setOtsForms((prev) => prev.filter((f) => f.id !== id));
    setIsOtsCrashVerified(false);
  }

  function handleDuplicateOtsForm(item: ScheduleFormItem) {
    setOtsForms((prev) => [
      ...prev,
      {
        ...item,
        id: Date.now(),
        idJadwal: generateNewScheduleId("OTS", item.tanggal),
      },
    ]);
    setIsOtsCrashVerified(false);
  }

  function updateOtsField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setOtsForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setIsOtsCrashVerified(false);
  }

  function checkBebasCrashOts() {
    const conflicts: any[] = [];
    for (let i = 0; i < otsForms.length; i++) {
      const d1 = otsForms[i];
      if (!d1.tanggal || !d1.jamMulaiLive || !d1.jamSelesaiLive) {
        showAlert("⚠️ Pastikan Tanggal, Jam Masuk, dan Jam Keluar terisi di semua form OTS.");
        return;
      }
      for (let j = i + 1; j < otsForms.length; j++) {
        const d2 = otsForms[j];
        if (d1.tanggal !== d2.tanggal) continue;

        const s1 = d1.jamMulaiLive;
        const e1 = d1.jamSelesaiLive;
        const s2 = d2.jamMulaiLive;
        const e2 = d2.jamSelesaiLive;
        const isOverlap = s1 < e2 && s2 < e1;

        if (isOverlap) {
          if (d1.otsKaryawanId && d2.otsKaryawanId && d1.otsKaryawanId === d2.otsKaryawanId) {
            conflicts.push({
              type: `Personel OTS (${d1.otsNama || "Staff"})`,
              form1: i + 1,
              form2: j + 1,
              info1: `Tgl ${d1.tanggal} [${s1} - ${e1}] - Cabang: ${d1.cabangStudio}`,
              info2: `Tgl ${d2.tanggal} [${s2} - ${e2}] - Cabang: ${d2.cabangStudio}`,
            });
          }
        }
      }
    }

    if (conflicts.length > 0) {
      setIsOtsCrashVerified(false);
      setModalCrashData({
        isOpen: true,
        isSafe: false,
        title: "Jadwal OTS Bentrok!",
        conflicts,
      });
    } else {
      setIsOtsCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Formulir OTS Aman & Bebas Bentrok!",
        conflicts: [],
      });
    }
  }

  async function submitOtsSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isOtsCrashVerified) {
      showAlert("⚠️ Silakan klik tombol 'Bebas Crash' terlebih dahulu sebelum menyimpan!");
      return;
    }

    setLoading(true);

    try {
      for (const item of otsForms) {
        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("OTS", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          otsKaryawanId: item.otsKaryawanId || null,
          idOts: item.otsId || null,
          cabangStudio: item.cabangStudio,
          nomorStudio: item.nomorStudio,
          jamMulaiLive: item.jamMulaiLive.includes("T") ? item.jamMulaiLive : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`,
          jamSelesaiLive: item.jamSelesaiLive.includes("T") ? item.jamSelesaiLive : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`,
          catatanOts: item.catatanOts || null,
          filePendukungOtsDriveId: (item.filesOts || []).filter(Boolean).join(", ") || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSuccess(`✅ Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      setIsOtsCrashVerified(false);
      setOtsForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("OTS"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "Shopee Live",
          cabangStudio: "Timoho",
          nomorStudio: "01",
          otsKaryawanId: "",
          otsId: "",
          otsNama: "",
          shiftOts: "",
          jamMulaiLive: "",
          jamSelesaiLive: "",
          catatanOts: "",
          filesOts: [""],
        },
      ]);
      fetchData();
    } catch {
      setError("Terjadi kesalahan koneksi saat menyimpan Jadwal OTS.");
    } finally {
      setLoading(false);
    }
  }

  // Filtered OTS schedules for monitoring table
  const otsSchedules = allJadwal.filter((j) => {
    const isOtsSchedule =
      j.idJadwal?.startsWith("OTS") ||
      (j.otsKaryawan && !j.streamerKaryawan) ||
      j.tipeRole === "OTS";
    if (!isOtsSchedule) return false;

    // Filter waktu
    const today = new Date().toISOString().slice(0, 10);
    const jDate = (j.tanggal || "").slice(0, 10);
    if (otsFilterWaktu === "hari_ini" && jDate !== today) return false;
    if (otsFilterWaktu === "akan_datang" && jDate < today) return false;
    if (otsFilterWaktu === "lewat" && jDate >= today) return false;

    // Filter kategori status
    if (otsFilterKategori !== "all") {
      const st = (j.status || "").toUpperCase();
      if (st !== otsFilterKategori.toUpperCase()) return false;
    }

    // Search text
    if (otsSearchQuery.trim()) {
      const q = otsSearchQuery.toLowerCase().trim();
      const match =
        j.idJadwal?.toLowerCase().includes(q) ||
        j.otsKaryawan?.namaLengkap?.toLowerCase().includes(q) ||
        j.otsNama?.toLowerCase().includes(q) ||
        j.cabangStudio?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const totalOtsPages = Math.max(1, Math.ceil(otsSchedules.length / otsTablePageSize));
  const currentOtsPage = Math.min(otsTablePage, totalOtsPages);
  const startOtsIndex = (currentOtsPage - 1) * otsTablePageSize;
  const paginatedOts = otsSchedules.slice(startOtsIndex, startOtsIndex + otsTablePageSize);

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="font-extrabold text-black text-base flex items-center gap-2">
            <i className="fa-solid fa-headphones text-[#941A0B]" />
            <span>Formulir Penugasan Jadwal Kerja OTS</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jadwalkan shift operator teknis support studio
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddOtsForm}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-[#941A0B] rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-red-200"
        >
          <i className="fa-solid fa-plus" /> Tambah Form OTS
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* FORM CARDS */}
      <form onSubmit={submitOtsSchedules} className="space-y-4">
        {otsForms.map((item, idx) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 relative"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-[#941A0B] text-white rounded-lg flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {item.idJadwal}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDuplicateOtsForm(item)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                  title="Duplikat Form"
                >
                  <i className="fa-solid fa-clone" /> Duplikat
                </button>
                {otsForms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOtsForm(item.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition"
                    title="Hapus Form"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Tanggal */}
              <div>
                <label className={labelCls}>Tanggal Kerja *</label>
                <FlatpickrPicker
                  value={item.tanggal}
                  placeholder="Pilih Tanggal..."
                  options={{ mode: "single", dateFormat: "Y-m-d" }}
                  onChange={(dateStr) => updateOtsField(idx, "tanggal", dateStr)}
                />
              </div>

              {/* Personel OTS */}
              <div>
                <label className={labelCls}>Personel OTS *</label>
                <select
                  value={item.otsKaryawanId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const o = otsStaff.find((x) => x.id === id);
                    updateOtsField(idx, "otsKaryawanId", id);
                    updateOtsField(idx, "otsId", o?.idKaryawan || "");
                    updateOtsField(idx, "otsNama", o?.namaLengkap || "");
                  }}
                  className={selectCls}
                  required
                >
                  <option value="">-- Pilih Staff OTS --</option>
                  {otsStaff.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.namaLengkap} ({o.idKaryawan})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cabang & Studio */}
              <div>
                <label className={labelCls}>Cabang & Studio</label>
                <select
                  value={`${item.cabangStudio}|${item.nomorStudio}`}
                  onChange={(e) => {
                    const [c, n] = e.target.value.split("|");
                    updateOtsField(idx, "cabangStudio", c);
                    updateOtsField(idx, "nomorStudio", n);
                  }}
                  className={selectCls}
                >
                  {STUDIOS.map((s) => (
                    <option key={s.name} value={`${s.cabang}|${s.no}`}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Preset */}
              <div>
                <label className={labelCls}>Preset Shift</label>
                <select
                  value={item.shiftOts || ""}
                  onChange={(e) => {
                    const shift = e.target.value;
                    const times = applyShiftOts(shift);
                    updateOtsField(idx, "shiftOts", shift);
                    if (times.masuk) updateOtsField(idx, "jamMulaiLive", times.masuk);
                    if (times.keluar) updateOtsField(idx, "jamSelesaiLive", times.keluar);
                  }}
                  className={selectCls}
                >
                  <option value="">Kustom (Manual)</option>
                  <option value="07:00-15:00">Shift Pagi (07:00 - 15:00)</option>
                  <option value="15:00-23:00">Shift Siang (15:00 - 23:00)</option>
                  <option value="23:00-07:00">Shift Malam (23:00 - 07:00)</option>
                </select>
              </div>

              {/* Jam Masuk */}
              <div>
                <label className={labelCls}>Jam Masuk *</label>
                <input
                  type="time"
                  value={item.jamMulaiLive}
                  onChange={(e) => updateOtsField(idx, "jamMulaiLive", e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              {/* Jam Keluar */}
              <div>
                <label className={labelCls}>Jam Keluar *</label>
                <input
                  type="time"
                  value={item.jamSelesaiLive}
                  onChange={(e) => updateOtsField(idx, "jamSelesaiLive", e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              {/* Link File Google Drive */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Link File Pendukung (Google Drive)</label>
                <input
                  type="text"
                  value={item.filesOts?.[0] || ""}
                  onChange={(e) => updateOtsField(idx, "filesOts", [e.target.value])}
                  placeholder="https://drive.google.com/..."
                  className={inputCls}
                />
              </div>
            </div>

            {/* Catatan OTS */}
            <div>
              <label className={labelCls}>Catatan Penugasan OTS</label>
              <textarea
                rows={2}
                value={item.catatanOts || ""}
                onChange={(e) => updateOtsField(idx, "catatanOts", e.target.value)}
                placeholder="Catatan penugasan khusus, kendala teknis, dll..."
                className={inputCls}
              />
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleAddOtsForm}
            className="w-full sm:w-auto px-6 py-3 bg-red-50 text-[#941A0B] rounded-xl hover:bg-red-100 font-bold transition flex items-center justify-center gap-2 text-xs border border-red-200"
          >
            <i className="fa-solid fa-plus" /> Tambah Form OTS
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={checkBebasCrashOts}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-xs"
            >
              <i className="fa-solid fa-shield-halved" /> Bebas Crash
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs text-white ${
                isOtsCrashVerified && !loading
                  ? "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              <i className="fa-solid fa-cloud-arrow-up" />
              <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal OTS"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* MONITORING OTS TABLE (Persis Staff Dashboard -> Tab Jadwal) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-8">
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-black text-sm flex items-center gap-2">
              <i className="fa-solid fa-list-check text-[#941A0B]" />
              <span>Tabel Monitoring Jadwal Kerja OTS</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan jadwal kerja dan status kehadiran personel operator technical support
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            Total {otsSchedules.length} Sesi OTS
          </span>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
              Periode Waktu
            </label>
            <select
              value={otsFilterWaktu}
              onChange={(e) => {
                setOtsFilterWaktu(e.target.value);
                setOtsTablePage(1);
              }}
              className={selectCls}
            >
              <option value="all">Semua Waktu</option>
              <option value="hari_ini">Hari Ini</option>
              <option value="akan_datang">Akan Datang</option>
              <option value="lewat">Sudah Lewat</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
              Status Jadwal
            </label>
            <select
              value={otsFilterKategori}
              onChange={(e) => {
                setOtsFilterKategori(e.target.value);
                setOtsTablePage(1);
              }}
              className={selectCls}
            >
              <option value="all">Semua Status</option>
              <option value="TERJADWAL">TERJADWAL</option>
              <option value="ON_GOING">BERJALAN / ON GOING</option>
              <option value="SELESAI">SELESAI</option>
              <option value="BATAL">DIBATALKAN</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
              Cari Staff / Studio / ID
            </label>
            <input
              type="text"
              value={otsSearchQuery}
              onChange={(e) => {
                setOtsSearchQuery(e.target.value);
                setOtsTablePage(1);
              }}
              placeholder="Ketik pencarian..."
              className={inputCls}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[500px]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="p-3 text-center w-12">NO</th>
                <th className="p-3 text-center w-28">STATUS</th>
                <th className="p-3">WAKTU KERJA</th>
                <th className="p-3 text-center">WAJIB HADIR</th>
                <th className="p-3 text-center w-24">CATATAN</th>
                <th className="p-3 text-center w-24">FILE</th>
                <th className="p-3">OTS / STAFF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedOts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    Tidak ada data jadwal OTS yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedOts.map((j, idx) => {
                  const badgeCls = getStatusBadgeClass(j.status || "TERJADWAL");
                  return (
                    <tr key={j.id || idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-center font-bold text-slate-400">
                        {startOtsIndex + idx + 1}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${badgeCls}`}>
                          {(j.status || "TERJADWAL").toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {formatDateSafe(j.tanggal)}
                          {j.cabangStudio && (
                            <span className="ml-2 text-rose-600 font-semibold">
                              {j.cabangStudio} {j.nomorStudio ? `(${j.nomorStudio})` : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-mono mt-0.5">
                          {formatTimeSafe(j.jamMulaiLive)} - {formatTimeSafe(j.jamSelesaiLive)} WIB
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: <span className="text-blue-600 font-bold">{j.idJadwal || "–"}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="font-bold text-amber-600 font-mono">
                          {calcWajibHadir(j.jamMulaiLive)}
                        </div>
                        <div className="text-[10px] text-slate-400">Brief & Persiapan</div>
                      </td>
                      <td className="p-3 text-center">
                        {j.catatanOts || j.catatanHost ? (
                          <button
                            type="button"
                            onClick={() => setModalCatatanOts(j.catatanOts || j.catatanHost)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold transition mx-auto"
                          >
                            Catatan
                          </button>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {j.filePendukungOtsDriveId || j.filePendukungHostDriveId ? (
                          <button
                            type="button"
                            onClick={() => setModalFileOts(j.filePendukungOtsDriveId || j.filePendukungHostDriveId)}
                            className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition mx-auto"
                          >
                            File
                          </button>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {j.otsKaryawan?.namaLengkap || j.otsNama || "Belum Ditugaskan"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {j.otsKaryawan?.idKaryawan || j.otsId || "–"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <div className="text-slate-500">
            Menampilkan <strong>{otsSchedules.length === 0 ? 0 : startOtsIndex + 1}</strong> - <strong>{Math.min(startOtsIndex + otsTablePageSize, otsSchedules.length)}</strong> dari <strong>{otsSchedules.length}</strong> jadwal
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentOtsPage <= 1}
              onClick={() => setOtsTablePage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1.5 text-xs font-bold text-slate-700">
              Hal {currentOtsPage} / {totalOtsPages}
            </span>
            <button
              type="button"
              disabled={currentOtsPage >= totalOtsPages}
              onClick={() => setOtsTablePage((p) => Math.min(totalOtsPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold transition"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Catatan Modal */}
      {modalCatatanOts && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">Catatan Jadwal OTS</h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
              {modalCatatanOts}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalCatatanOts(null)}
                className="px-5 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Modal */}
      {modalFileOts && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">File Pendukung OTS</h3>
            <div className="space-y-2">
              {modalFileOts.split(",").map((f, fi) => {
                const trimmed = f.trim();
                return (
                  <a
                    key={fi}
                    href={trimmed}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:underline break-all"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" />
                    {trimmed}
                  </a>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalFileOts(null)}
                className="px-5 py-2 bg-[#941A0B] text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
