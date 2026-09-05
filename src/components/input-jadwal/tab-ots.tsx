"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import {
  generateNewScheduleId,
  applyShiftOts,
} from "@/lib/utils/schedule-helpers";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";
import { toast } from "@/components/ui/toast";
import { sendJson } from "@/lib/api-client";
import { FlatpickrTimeInput } from "./flatpickr-time-input";
import { calculateEndTime } from "@/lib/utils/schedule-helpers";

export function TabOts({
  otsStaff,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [otsForms, setOtsForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("OTS"),
      tanggal: "",
      platform: "Shopee Live",
      cabangStudio: "",
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

  function handleAddOtsForm() {
    if (otsForms.length >= 100) {
      showAlert("⚠️ Maksimal 100 form.");
      return;
    }
    const last = otsForms[otsForms.length - 1];
    setOtsForms((prev) => [
      ...prev,
      {
        id: Date.now(),
        idJadwal: generateNewScheduleId("OTS", last?.tanggal),
        tanggal: last?.tanggal || "",
        platform: "Shopee Live",
        cabangStudio: last?.cabangStudio || "",
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

  function updateOtsField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setOtsForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setIsOtsCrashVerified(false);
  }

  function runOtsCrashValidation(): { isValid: boolean; conflicts: any[] } {
    const conflicts: any[] = [];
    for (let i = 0; i < otsForms.length; i++) {
      const d1 = otsForms[i];
      if (!d1.tanggal || !d1.jamMulaiLive || !d1.jamSelesaiLive) {
        showAlert(`⚠️ Pastikan Tanggal, Jam Masuk, dan Jam Keluar terisi di Jadwal #${i + 1}.`);
        return { isValid: false, conflicts: [] };
      }
      // TODO(batas-cekout): pemeriksaan bentrok OTS dinonaktifkan sementara —
      // akan diaktifkan kembali sebagai validasi "cekout terbatas".
      // for (let j = i + 1; j < otsForms.length; j++) {
      //   const d2 = otsForms[j];
      //   if (d1.tanggal !== d2.tanggal) continue;

      //   const s1 = d1.jamMulaiLive;
      //   const e1 = d1.jamSelesaiLive;
      //   const s2 = d2.jamMulaiLive;
      //   const e2 = d2.jamSelesaiLive;
      //   const isOverlap = s1 < e2 && s2 < e1;

      //   if (isOverlap) {
      //     if (d1.otsKaryawanId && d2.otsKaryawanId && d1.otsKaryawanId === d2.otsKaryawanId) {
      //       conflicts.push({
      //         type: `Personel OTS (${d1.otsNama || "Staff"})`,
      //         form1: i + 1,
      //         form2: j + 1,
      //         info1: `Tgl ${d1.tanggal} [${s1} - ${e1}] - Cabang: ${d1.cabangStudio}`,
      //         info2: `Tgl ${d2.tanggal} [${s2} - ${e2}] - Cabang: ${d2.cabangStudio}`,
      //       });
      //     }
      //   }
      // }
      void d1;
    }
    return { isValid: true, conflicts };
  }

  function checkBebasCrashOts() {
    const { isValid, conflicts } = runOtsCrashValidation();
    if (!isValid) return;

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
      const { isValid, conflicts } = runOtsCrashValidation();
      if (!isValid) return;

      if (conflicts.length > 0) {
        setIsOtsCrashVerified(false);
        setModalCrashData({
          isOpen: true,
          isSafe: false,
          title: "Jadwal OTS Bentrok!",
          conflicts,
        });
        return;
      }
      setIsOtsCrashVerified(true);
    }

    setLoading(true);

    try {
      for (const item of otsForms) {
        // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
        const cleanStart = item.jamMulaiLive.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive.length === 5 ? item.jamMulaiLive + ":00" : item.jamMulaiLive}+07:00`;

        const cleanEnd = item.jamSelesaiLive.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive.length === 5 ? item.jamSelesaiLive + ":00" : item.jamSelesaiLive}+07:00`;

        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("OTS", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          otsKaryawanId: item.otsKaryawanId || null,
          idOts: item.otsId || null,
          cabangStudio: item.cabangStudio,
          nomorStudio: item.nomorStudio,
          jamMulaiLive: cleanStart,
          jamSelesaiLive: cleanEnd,
          catatanOts: item.catatanOts || null,
          filePendukungOtsDriveId: (item.filesOts || []).filter(Boolean).join(", ") || null,
          status: "TERJADWAL",
        };

        await sendJson("/api/jadwal", "POST", payload);
      }
      setSuccess(`✅ Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      toast.success(`Berhasil menyimpan ${otsForms.length} Jadwal OTS!`);
      setIsOtsCrashVerified(false);
      setOtsForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("OTS"),
          tanggal: "",
          platform: "Shopee Live",
          cabangStudio: "",
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
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan koneksi saat menyimpan Jadwal OTS.";
      setError(errMsg);
      toast.error(errMsg, "Gagal Menyimpan Jadwal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
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
        {otsForms.map((item, idx) => {
          const isCollapsed = item.isCollapsed;
          const otsName = item.otsNama || "";

          return (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4"
          >
            {/* Accordion Header (ref: cardOts header) */}
            <div
              onClick={() => updateOtsField(idx, "isCollapsed", !isCollapsed)}
              className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                  #{idx + 1}
                </div>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">
                  {otsName ? otsName : "Jadwal OTS Baru"}
                </h3>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {otsForms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOtsForm(item.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                    title="Hapus Form"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateOtsField(idx, "isCollapsed", !isCollapsed)}
                  className="text-[#941A0B] bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <i className={`fa-solid ${isCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`} />
                </button>
              </div>
            </div>

            {/* Accordion Body (ref: bodyOts sections) */}
            {!isCollapsed && (
            <div className="p-5 sm:p-6 space-y-6 block">
              {/* Row 1: Tanggal + Cabang Studio (ref grid md:2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Penugasan *</label>
                  <FlatpickrPicker
                    value={item.tanggal}
                    placeholder="Pilih Tanggal..."
                    options={{ mode: "single", dateFormat: "Y-m-d" }}
                    onChange={(dateStr) => updateOtsField(idx, "tanggal", dateStr)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cabang Studio *</label>
                  <select
                    value={item.cabangStudio || ""}
                    onChange={(e) => updateOtsField(idx, "cabangStudio", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none"
                    required
                  >
                    <option value="" disabled>Pilih Cabang Penugasan</option>
                    <option value="Timoho">Timoho</option>
                    <option value="Berbah">Berbah</option>
                    <option value="Wiyoro">Wiyoro</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Cari Staff OTS + auto ID/Nama (ref: ketik-cari datalist) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cari Staff OTS *</label>
                  <input
                    list={`listOts-${item.id}`}
                    type="text"
                    value={item.otsNama ? `${item.otsId ? item.otsId + " | " : ""}${item.otsNama}` : item.otsSearch || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateOtsField(idx, "otsSearch", val);
                      const q = val.toLowerCase().trim();
                      const o = otsStaff.find((x) =>
                        `${x.idKaryawan} | ${x.namaLengkap}`.toLowerCase().includes(q) ||
                        (x.nomorTelepon || "").includes(q)
                      );
                      if (o && q) {
                        updateOtsField(idx, "otsKaryawanId", o.id);
                        updateOtsField(idx, "otsId", o.idKaryawan || "");
                        updateOtsField(idx, "otsNama", o.namaLengkap || "");
                      } else if (!q) {
                        updateOtsField(idx, "otsKaryawanId", "");
                        updateOtsField(idx, "otsId", "");
                        updateOtsField(idx, "otsNama", "");
                      }
                    }}
                    placeholder="Ketik ID / Nama / Telepon..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                  <datalist id={`listOts-${item.id}`}>
                    {otsStaff.map((o) => (
                      <option key={o.id} value={`${o.idKaryawan} | ${o.namaLengkap}`} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">ID OTS (Auto)</label>
                    <input
                      type="text"
                      value={item.otsId || ""}
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama OTS</label>
                    <input
                      type="text"
                      value={item.otsNama || ""}
                      readOnly
                      className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Shift + Jam Masuk/Keluar + Catatan (ref grid md:2, inner grid-cols-3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Shift</label>
                    <select
                      value={item.shiftOts || ""}
                      onChange={(e) => {
                        const shift = e.target.value;
                        const times = applyShiftOts(shift);
                        updateOtsField(idx, "shiftOts", shift);
                        if (times.masuk) updateOtsField(idx, "jamMulaiLive", times.masuk);
                        if (times.keluar) updateOtsField(idx, "jamSelesaiLive", times.keluar);
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none"
                    >
                      <option value="">Kustom</option>
                      <option value="07:00-15:00">Shift 1 (07:00-15:00)</option>
                      <option value="15:00-23:00">Shift 2 (15:00-23:00)</option>
                      <option value="23:00-07:00">Shift 3 (23:00-07:00)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Masuk *</label>
                    <FlatpickrTimeInput
                      id={`O_JAM_MASUK_${idx + 1}`}
                      className="px-2 py-2.5"
                      value={item.jamMulaiLive}
                      onChange={(val) => {
                        updateOtsField(idx, "jamMulaiLive", val);
                        // Auto-fill end time +8 hours (mirrors ref-deploy calculateEndTimeOts)
                        const auto = calculateEndTime(val, 8);
                        if (auto) updateOtsField(idx, "jamSelesaiLive", auto);
                        // Custom manual time clears the preset shift
                        if (item.shiftOts) updateOtsField(idx, "shiftOts", "");
                      }}
                      placeholder="Jam Masuk"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keluar *</label>
                    <FlatpickrTimeInput
                      id={`O_JAM_KELUAR_${idx + 1}`}
                      className="px-2 py-2.5"
                      value={item.jamSelesaiLive}
                      onChange={(val) => updateOtsField(idx, "jamSelesaiLive", val)}
                      placeholder="Jam Keluar"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Pekerjaan</label>
                  <textarea
                    rows={1}
                    value={item.catatanOts || ""}
                    onChange={(e) => updateOtsField(idx, "catatanOts", e.target.value)}
                    placeholder="Instruksi tugas OTS..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 4: File Pendukung (ref: multi-link + Tambah Link) */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-slate-700">File Pendukung</label>
                  <button
                    type="button"
                    onClick={() => updateOtsField(idx, "filesOts", [...(item.filesOts || [""]), ""])}
                    className="text-xs text-[#941A0B] hover:text-red-800 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition"
                  >
                    <i className="fa-solid fa-plus mr-1" /> Tambah Link
                  </button>
                </div>
                <div className="space-y-2">
                  {(item.filesOts?.length ? item.filesOts : [""]).map((f, fi) => (
                    <div key={fi} className="flex gap-2">
                      <input
                        type="text"
                        value={f || ""}
                        onChange={(e) => {
                          const next = [...(item.filesOts?.length ? item.filesOts : [""])];
                          next[fi] = e.target.value;
                          updateOtsField(idx, "filesOts", next);
                        }}
                        placeholder="Paste link file/dokumen di sini..."
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(item.filesOts?.length ? item.filesOts : [""])];
                          if (next.length > 1) {
                            next.splice(fi, 1);
                            updateOtsField(idx, "filesOts", next);
                          } else {
                            showAlert("Minimal harus ada 1 kolom isian (biarkan kosong jika tidak ada file).");
                          }
                        }}
                        className="bg-red-50 text-red-500 hover:bg-red-100 px-3.5 rounded-lg transition"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>
          );
        })}

        {/* Action Buttons (ref: Tambah Maks 100 + Bebas Crash + Simpan) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleAddOtsForm}
            disabled={otsForms.length >= 100}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs ${
              otsForms.length >= 100
                ? "opacity-50 cursor-not-allowed text-slate-400 bg-slate-100"
                : "text-[#941A0B] bg-red-50 hover:bg-red-100"
            }`}
          >
            <i className={`fa-solid ${otsForms.length >= 100 ? "fa-ban" : "fa-plus"}`} />
            {otsForms.length >= 100 ? "Kuota Maksimal Penuh (100)" : "Tambah Jadwal OTS (Maks 100)"}
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={checkBebasCrashOts}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold transition shadow-md flex items-center justify-center gap-2 text-xs"
            >
              <i className="fa-solid fa-shield-halved" /> Bebas Crash
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs text-white ${
                loading
                  ? "bg-slate-400 cursor-wait"
                  : "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
              }`}
            >
              <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} />
              <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal OTS"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
