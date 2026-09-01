"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import type { ScheduleFormItem } from "@/types/jadwal";
import {
  generateNewScheduleId,
  minutesToTime,
} from "@/lib/utils/schedule-helpers";
import { calcDurationHours } from "@/lib/utils/date-format";
import FlatpickrPicker from "@/components/ui/flatpickr-picker";

export function TabMarketplace({
  streamers = [],
  clients = [],
  platformClientOptions = [],
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [marketplaceForms, setMarketplaceForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("MKT"),
      tanggal: "",
      platform: "",
      clientId: "",
      jamMulaiLive: "",
      jamSelesaiLive: "",
      durasi: "0",
      kuota: 1,
      judulLive: "",
      promoLive: "",
      filePendukungHost: "",
      filePendukungOts: "",
      produkPrioritas: [],
      targetHost: [],
      blacklistHost: [],
      isCollapsed: false,
    },
  ]);

  // Input states for chips
  const [inputProduk, setInputProduk] = useState<{ [id: number]: string }>({});
  const [inputTargetHost, setInputTargetHost] = useState<{ [id: number]: string }>({});
  const [inputBlacklistHost, setInputBlacklistHost] = useState<{ [id: number]: string }>({});

  // Split modal state
  const [modalSplit, setModalSplit] = useState<{
    isOpen: boolean;
    formIdx: number | null;
    numSessions: number;
  }>({ isOpen: false, formIdx: null, numSessions: 2 });

  const [isMarketplaceCrashVerified, setIsMarketplaceCrashVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =========================================================================
  // HELPER: HITUNG JAM SELESAI OTOMATIS (+2 JAM)
  // =========================================================================
  function calculateEndTime(startVal: string): string {
    if (!startVal) return "";
    const [h, m] = startVal.split(":").map(Number);
    const endH = (h + 2) % 24;
    return `${String(endH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  }

  // =========================================================================
  // FORM ACTIONS
  // =========================================================================
  function handleAddForm() {
    if (marketplaceForms.length >= 20) {
      showAlert("⚠️ Maksimal 20 formulir pengajuan marketplace sekaligus.");
      return;
    }
    const last = marketplaceForms[marketplaceForms.length - 1];

    // Collapse previous forms
    setMarketplaceForms((prev) =>
      prev.map((f) => ({ ...f, isCollapsed: true })).concat({
        id: Date.now(),
        idJadwal: generateNewScheduleId("MKT", last?.tanggal),
        tanggal: last?.tanggal || "",
        platform: last?.platform || "",
        clientId: last?.clientId || "",
        jamMulaiLive: "",
        jamSelesaiLive: "",
        durasi: "0",
        kuota: 1,
        judulLive: "",
        promoLive: "",
        filePendukungHost: "",
        filePendukungOts: "",
        produkPrioritas: [],
        targetHost: [],
        blacklistHost: [],
        isCollapsed: false,
      })
    );
    setIsMarketplaceCrashVerified(false);
  }

  function handleRemoveForm(id: number) {
    if (marketplaceForms.length <= 1) {
      showAlert("Minimal 1 form pengajuan.");
      return;
    }
    setMarketplaceForms((prev) => prev.filter((f) => f.id !== id));
    setIsMarketplaceCrashVerified(false);
  }

  function toggleCollapse(idx: number) {
    setMarketplaceForms((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], isCollapsed: !updated[idx].isCollapsed };
      return updated;
    });
  }

  function updateFormField(idx: number, field: keyof ScheduleFormItem, value: any) {
    setMarketplaceForms((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };

      if (field === "jamMulaiLive") {
        if (value && !item.jamSelesaiLive) {
          item.jamSelesaiLive = calculateEndTime(value);
        }
        if (value && item.jamSelesaiLive) {
          item.durasi = calcDurationHours(value, item.jamSelesaiLive);
        } else {
          item.durasi = "0";
        }
      }

      if (field === "jamSelesaiLive") {
        if (item.jamMulaiLive && value) {
          item.durasi = calcDurationHours(item.jamMulaiLive, value);
        } else {
          item.durasi = "0";
        }
      }

      if (field === "tanggal" && value) {
        item.idJadwal = generateNewScheduleId("MKT", value);
      }

      updated[idx] = item;
      return updated;
    });
    setIsMarketplaceCrashVerified(false);
  }

  // Copy data from top form
  function handleCopyFromTop(idx: number, type: "detail" | "target" | "blacklist") {
    if (idx === 0) return;
    const top = marketplaceForms[0];
    if (!top) return;

    if (type === "detail") {
      updateFormField(idx, "judulLive", top.judulLive || "");
      updateFormField(idx, "promoLive", top.promoLive || "");
      updateFormField(idx, "filePendukungHost", top.filePendukungHost || "");
      updateFormField(idx, "filePendukungOts", top.filePendukungOts || "");
      updateFormField(idx, "produkPrioritas", [
        ...((top.produkPrioritas as string[]) || []),
      ]);
    } else if (type === "target") {
      updateFormField(idx, "targetHost", [...((top.targetHost as string[]) || [])]);
    } else if (type === "blacklist") {
      updateFormField(idx, "blacklistHost", [
        ...((top.blacklistHost as string[]) || []),
      ]);
    }
  }

  // --- Chip Add / Remove Handlers ---
  function handleAddProdukChip(formId: number, idx: number) {
    const val = (inputProduk[formId] || "").trim();
    if (!val) return;
    const cur = (marketplaceForms[idx].produkPrioritas as string[]) || [];
    if (cur.includes(val)) {
      showAlert("⚠️ Produk ini sudah ditambahkan.");
      return;
    }
    updateFormField(idx, "produkPrioritas", [...cur, val]);
    setInputProduk((prev) => ({ ...prev, [formId]: "" }));
  }

  function handleRemoveProdukChip(formIdx: number, itemIdx: number) {
    const cur = [...((marketplaceForms[formIdx].produkPrioritas as string[]) || [])];
    cur.splice(itemIdx, 1);
    updateFormField(formIdx, "produkPrioritas", cur);
  }

  function handleAddTargetHostChip(formId: number, idx: number) {
    const val = (inputTargetHost[formId] || "").trim();
    if (!val) return;
    const cur = (marketplaceForms[idx].targetHost as string[]) || [];
    if (cur.includes(val)) {
      showAlert("⚠️ Host ini sudah ada di daftar eksklusif pada form ini.");
      return;
    }
    updateFormField(idx, "targetHost", [...cur, val]);
    setInputTargetHost((prev) => ({ ...prev, [formId]: "" }));
  }

  function handleRemoveTargetHostChip(formIdx: number, itemIdx: number) {
    const cur = [...((marketplaceForms[formIdx].targetHost as string[]) || [])];
    cur.splice(itemIdx, 1);
    updateFormField(formIdx, "targetHost", cur);
  }

  function handleAddBlacklistHostChip(formId: number, idx: number) {
    const val = (inputBlacklistHost[formId] || "").trim();
    if (!val) return;
    const cur = (marketplaceForms[idx].blacklistHost as string[]) || [];
    if (cur.includes(val)) {
      showAlert("⚠️ Host ini sudah ada di daftar pengecualian pada form ini.");
      return;
    }
    updateFormField(idx, "blacklistHost", [...cur, val]);
    setInputBlacklistHost((prev) => ({ ...prev, [formId]: "" }));
  }

  function handleRemoveBlacklistHostChip(formIdx: number, itemIdx: number) {
    const cur = [...((marketplaceForms[formIdx].blacklistHost as string[]) || [])];
    cur.splice(itemIdx, 1);
    updateFormField(formIdx, "blacklistHost", cur);
  }

  // --- Split Session ---
  function handleSplitMarketplace(idx: number, numSessions: number) {
    if (idx < 0 || idx >= marketplaceForms.length || numSessions < 2) return;
    const master = marketplaceForms[idx];
    const startVal = master.jamMulaiLive;
    const endVal = master.jamSelesaiLive;
    if (!startVal || !endVal) {
      showAlert("⚠️ Isi Jam Mulai & Selesai terlebih dahulu.");
      return;
    }

    if (marketplaceForms.length + (numSessions - 1) > 20) {
      showAlert(
        `⚠️ Batas maksimal adalah 20 form. Anda hanya bisa menambah ${
          20 - marketplaceForms.length
        } sesi lagi.`
      );
      return;
    }

    const [sh, sm] = startVal.split(":").map(Number);
    const [eh, em] = endVal.split(":").map(Number);
    let startMins = sh * 60 + (sm || 0);
    let endMins = eh * 60 + (em || 0);
    if (endMins <= startMins) endMins += 1440;

    const sessionDur = (endMins - startMins) / numSessions;

    const updated = [...marketplaceForms];
    const masterEnd = startMins + sessionDur;
    updated[idx] = {
      ...master,
      jamSelesaiLive: minutesToTime(masterEnd),
      durasi: calcDurationHours(master.jamMulaiLive, minutesToTime(masterEnd)),
    };

    const newForms: ScheduleFormItem[] = [];
    for (let i = 1; i < numSessions; i++) {
      const curStart = startMins + i * sessionDur;
      const curEnd = i === numSessions - 1 ? endMins : curStart + sessionDur;
      newForms.push({
        id: Date.now() + i,
        idJadwal: generateNewScheduleId("MKT", master.tanggal),
        tanggal: master.tanggal,
        platform: master.platform,
        clientId: master.clientId,
        jamMulaiLive: minutesToTime(curStart),
        jamSelesaiLive: minutesToTime(curEnd),
        durasi: calcDurationHours(minutesToTime(curStart), minutesToTime(curEnd)),
        kuota: master.kuota || 1,
        judulLive: master.judulLive || "",
        promoLive: master.promoLive || "",
        filePendukungHost: master.filePendukungHost || "",
        filePendukungOts: master.filePendukungOts || "",
        produkPrioritas: Array.isArray(master.produkPrioritas)
          ? [...master.produkPrioritas]
          : [],
        targetHost: Array.isArray(master.targetHost) ? [...master.targetHost] : [],
        blacklistHost: Array.isArray(master.blacklistHost) ? [...master.blacklistHost] : [],
        isCollapsed: false,
      });
    }

    updated.splice(idx + 1, 0, ...newForms);
    setMarketplaceForms(updated);
    setIsMarketplaceCrashVerified(false);
    setModalSplit({ isOpen: false, formIdx: null, numSessions: 2 });
    showAlert(`✅ Formulir berhasil dipecah menjadi ${numSessions} sesi berurutan!`);
  }

  // --- Bebas Crash Check ---
  function checkBebasCrashMarketplace() {
    if (marketplaceForms.length === 0) {
      showAlert("Tidak ada formulir aktif untuk diperiksa.");
      return;
    }

    for (let i = 0; i < marketplaceForms.length; i++) {
      const f = marketplaceForms[i];
      if (!f.platform || !f.tanggal || !f.jamMulaiLive || !f.jamSelesaiLive) {
        showAlert(
          `⚠️ VALIDASI GAGAL:\nKolom wajib pada Form Marketplace #${i + 1} belum Anda isi.`
        );
        return;
      }
    }

    const conflicts: any[] = [];
    const dataForm = marketplaceForms.map((f, idx) => {
      let sMins = 0;
      let eMins = 0;
      if (f.tanggal && f.jamMulaiLive && f.jamSelesaiLive) {
        const [y, m, d] = f.tanggal.split("-").map(Number);
        const baseTime = new Date(y, m - 1, d, 0, 0, 0).getTime();
        const [sh, sm] = f.jamMulaiLive.split(":").map(Number);
        const [eh, em] = f.jamSelesaiLive.split(":").map(Number);
        sMins = baseTime / 60000 + sh * 60 + (sm || 0);
        eMins = baseTime / 60000 + eh * 60 + (em || 0);
        if (eMins <= sMins) eMins += 1440;
      }
      return {
        idForm: idx + 1,
        tgl: f.tanggal,
        plat: (f.platform || "").trim().toUpperCase(),
        mulai: f.jamMulaiLive,
        selesai: f.jamSelesaiLive,
        sMins,
        eMins,
      };
    });

    for (let i = 0; i < dataForm.length; i++) {
      for (let j = i + 1; j < dataForm.length; j++) {
        const d1 = dataForm[i];
        const d2 = dataForm[j];
        if (!d1.sMins || !d2.sMins) continue;
        const overlap = d1.sMins < d2.eMins && d2.sMins < d1.eMins;
        if (overlap && d1.plat && d2.plat && d1.plat === d2.plat) {
          conflicts.push({
            type: `Platform Marketplace (${d1.plat})`,
            form1: d1.idForm,
            form2: d2.idForm,
            info1: `Tgl ${d1.tgl} [${d1.mulai} - ${d1.selesai}]`,
            info2: `Tgl ${d2.tgl} [${d2.mulai} - ${d2.selesai}]`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      setIsMarketplaceCrashVerified(false);
      setModalCrashData({
        isOpen: true,
        isSafe: false,
        title: `Ditemukan ${conflicts.length} Pengajuan Bentrok!`,
        conflicts,
      });
    } else {
      setIsMarketplaceCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Pengajuan Aman & Bebas Bentrok!",
        conflicts: [],
      });
    }
  }

  // --- Submit Schedules ---
  async function submitMarketplaceSchedules(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isMarketplaceCrashVerified) {
      showAlert(
        "⚠️ Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu untuk memastikan tidak ada tabrakan jadwal!"
      );
      return;
    }

    setLoading(true);

    try {
      for (const item of marketplaceForms) {
        let matchedClient = clients.find(
          (c) => c.namaClient === item.platform || c.id === item.clientId
        );
        if (!matchedClient && item.platform) {
          matchedClient = clients.find((c) =>
            item.platform.toLowerCase().includes((c.namaClient || "").toLowerCase())
          );
        }

        const jamMulaiIso = item.jamMulaiLive.includes("T")
          ? item.jamMulaiLive
          : `${item.tanggal}T${item.jamMulaiLive}:00.000Z`;
        const jamSelesaiIso = item.jamSelesaiLive.includes("T")
          ? item.jamSelesaiLive
          : `${item.tanggal}T${item.jamSelesaiLive}:00.000Z`;

        const payload = {
          idJadwal: item.idJadwal || generateNewScheduleId("MKT", item.tanggal),
          tanggal: item.tanggal ? new Date(item.tanggal).toISOString() : new Date().toISOString(),
          platform: item.platform || matchedClient?.platform || "Shopee Live",
          clientId: item.clientId || matchedClient?.id || null,
          jamMulaiLive: jamMulaiIso,
          jamSelesaiLive: jamSelesaiIso,
          kuotaHost: item.kuota || 1,
          judulLive: item.judulLive || null,
          promoLive: item.promoLive || null,
          filePendukungHostDriveId: item.filePendukungHost || null,
          filePendukungOtsDriveId: item.filePendukungOts || null,
          produkPrioritas: Array.isArray(item.produkPrioritas)
            ? item.produkPrioritas.join("**")
            : item.produkPrioritas || null,
          targetHost: Array.isArray(item.targetHost)
            ? item.targetHost.join("**")
            : item.targetHost || null,
          blacklistHost: Array.isArray(item.blacklistHost)
            ? item.blacklistHost.join("**")
            : item.blacklistHost || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setSuccess(
        `✅ BERHASIL:\nBerhasil mengirimkan ${marketplaceForms.length} Pengajuan Jadwal Marketplace!`
      );
      showAlert(
        `✅ BERHASIL:\nBerhasil mengirimkan ${marketplaceForms.length} Pengajuan Jadwal Marketplace!`
      );
      setIsMarketplaceCrashVerified(false);
      setMarketplaceForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("MKT"),
          tanggal: "",
          platform: "",
          clientId: "",
          jamMulaiLive: "",
          jamSelesaiLive: "",
          durasi: "0",
          kuota: 1,
          judulLive: "",
          promoLive: "",
          filePendukungHost: "",
          filePendukungOts: "",
          produkPrioritas: [],
          targetHost: [],
          blacklistHost: [],
          isCollapsed: false,
        },
      ]);
      fetchData();
    } catch {
      setError("Gagal mengirimkan pengajuan marketplace.");
      showAlert("❌ GAGAL: Terjadi kesalahan saat mengirim pengajuan marketplace.");
    } finally {
      setLoading(false);
    }
  }

  // Generate datalist streamer options
  const streamerOptions = (streamers || []).map((s) => {
    const nama = s.namaLengkap || s.namaPanggilan || s.name || "";
    const idKar = s.idKaryawan || "";
    return `${idKar} | ${nama}`;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          Pengajuan Jadwal Live (Marketplace)
        </h2>
        <p className="text-slate-500 text-sm">
          Silakan isi formulir pengajuan jadwal di bawah ini. Anda dapat menambahkan hingga 20 jadwal sekaligus dalam sekali pengiriman.
        </p>
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

      {/* FORM MASTER */}
      <form onSubmit={submitMarketplaceSchedules} className="space-y-4">
        <div className="space-y-4">
          {marketplaceForms.map((item, idx) => {
            let tanggalFormatted = "Tgl";
            if (item.tanggal) {
              const p = item.tanggal.split("-");
              if (p.length === 3) tanggalFormatted = `${p[2]}/${p[1]}/${p[0]}`;
            }
            const jamMulai = item.jamMulaiLive || "--:--";
            const jamSelesai = item.jamSelesaiLive || "--:--";

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4"
              >
                {/* Card Header */}
                <div
                  className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => toggleCollapse(idx)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      {item.platform ? (
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">
                          {item.platform}
                          <br />
                          <span className="text-[11px] font-normal text-slate-500 mt-0.5 inline-block">
                            {tanggalFormatted} | {jamMulai} - {jamSelesai}
                          </span>
                        </h3>
                      ) : (
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">
                          Jadwal Pengajuan Baru
                        </h3>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveForm(item.id);
                      }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                      title="Hapus Form"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                    <button
                      type="button"
                      className="text-[#941A0B] bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <i
                        className={`fa-solid ${
                          item.isCollapsed ? "fa-chevron-down" : "fa-chevron-up"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                {!item.isCollapsed && (
                  <div className="p-5 sm:p-6 space-y-6 block">
                    {/* SEKSI 1: INFORMASI JADWAL */}
                    <div className="bg-slate-50 border border-slate-100 p-4 sm:p-5 rounded-xl space-y-4 sm:space-y-5">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                        <i className="fa-solid fa-clock text-[#941A0B]" /> Informasi Jadwal
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Platform *
                          </label>
                          <select
                            value={item.platform}
                            onChange={(e) => {
                              const sel = e.target.value;
                              const matched = platformClientOptions.find(
                                (p) => p.value === sel
                              );
                              updateFormField(idx, "platform", sel);
                              if (matched?.clientId) {
                                updateFormField(idx, "clientId", matched.clientId);
                              }
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] bg-white outline-none"
                            required
                          >
                            <option value="">-- Pilih Platform Client --</option>
                            {platformClientOptions.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Tanggal Live *
                          </label>
                          <FlatpickrPicker
                            value={item.tanggal}
                            placeholder="Pilih Tanggal..."
                            options={{ mode: "single", dateFormat: "Y-m-d" }}
                            onChange={(dateStr) => updateFormField(idx, "tanggal", dateStr)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none cursor-pointer bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Jam Mulai *
                          </label>
                          <input
                            type="text"
                            value={item.jamMulaiLive}
                            onChange={(e) =>
                              updateFormField(idx, "jamMulaiLive", e.target.value)
                            }
                            placeholder="Contoh: 10:00"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Jam Selesai *
                          </label>
                          <input
                            type="text"
                            value={item.jamSelesaiLive}
                            onChange={(e) =>
                              updateFormField(idx, "jamSelesaiLive", e.target.value)
                            }
                            placeholder="Contoh: 12:00"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Kuota Host *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={item.kuota ?? 1}
                            onChange={(e) =>
                              updateFormField(idx, "kuota", Number(e.target.value))
                            }
                            placeholder="Contoh: 1"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white font-bold"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* SEKSI 2: DETAIL PENJUALAN */}
                    <div className="bg-slate-50 border border-slate-100 p-4 sm:p-5 rounded-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 border-b border-slate-200 pb-3">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <i className="fa-solid fa-bullseye text-[#941A0B]" /> Detail Penjualan
                        </h3>
                        {idx > 0 && (
                          <div className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                            <label className="flex items-center gap-2 text-xs text-[#941A0B] font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  if (e.target.checked) handleCopyFromTop(idx, "detail");
                                }}
                                className="w-4 h-4 rounded text-[#941A0B] focus:ring-[#941A0B] accent-[#941A0B]"
                              />{" "}
                              Samakan dgn Form Teratas
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 sm:space-y-5 block">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Judul Live / Campaign
                            </label>
                            <input
                              type="text"
                              value={item.judulLive || ""}
                              onChange={(e) =>
                                updateFormField(idx, "judulLive", e.target.value)
                              }
                              placeholder="Contoh: Payday Sale..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Promo Live / Diskon
                            </label>
                            <textarea
                              rows={1}
                              value={item.promoLive || ""}
                              onChange={(e) =>
                                updateFormField(idx, "promoLive", e.target.value)
                              }
                              placeholder="Contoh: Beli 1 Gratis 1..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              File Pendukung Host
                            </label>
                            <input
                              type="text"
                              value={item.filePendukungHost || ""}
                              onChange={(e) =>
                                updateFormField(idx, "filePendukungHost", e.target.value)
                              }
                              placeholder="Link dokumen/brief Host..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              File Pendukung OTS
                            </label>
                            <input
                              type="text"
                              value={item.filePendukungOts || ""}
                              onChange={(e) =>
                                updateFormField(idx, "filePendukungOts", e.target.value)
                              }
                              placeholder="Link dokumen/brief OTS..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                            />
                          </div>
                        </div>

                        {/* Produk Prioritas */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Produk Prioritas
                          </label>
                          <p className="text-xs text-slate-500 mb-2">
                            Pilih produk utama yang akan di-highlight.
                          </p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={inputProduk[item.id] || ""}
                              onChange={(e) =>
                                setInputProduk({
                                  ...inputProduk,
                                  [item.id]: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddProdukChip(item.id, idx);
                                }
                              }}
                              placeholder="Ketik nama produk..."
                              className="w-full flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddProdukChip(item.id, idx)}
                              className="bg-[#941A0B] hover:bg-[#7a1509] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap shadow-sm"
                            >
                              Tambah
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg min-h-[50px]">
                            {((item.produkPrioritas as string[]) || []).length === 0 ? (
                              <span className="text-xs text-slate-400 italic flex items-center h-full px-2">
                                Belum ada produk prioritas.
                              </span>
                            ) : (
                              ((item.produkPrioritas as string[]) || []).map((p, pi) => (
                                <div
                                  key={pi}
                                  className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs font-bold w-full"
                                >
                                  <span className="whitespace-normal leading-relaxed flex-1">
                                    <i className="fa-solid fa-box-open mr-1 mt-0.5 text-red-600" /> {p}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProdukChip(idx, pi)}
                                    className="text-red-500 hover:text-red-900 bg-red-100 hover:bg-red-200 rounded-full w-5 h-5 flex items-center justify-center transition flex-shrink-0 mt-0.5"
                                  >
                                    <i className="fa-solid fa-xmark text-xs" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SEKSI 3: TARGET HOST & BLACKLIST */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Target Host Eksklusif (Emerald) */}
                      <div className="bg-emerald-50/50 border border-emerald-100 p-4 sm:p-5 rounded-xl">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 border-b border-emerald-200 pb-3">
                          <h3 className="text-xs sm:text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-user-check text-emerald-500" /> Target Host Eksklusif
                          </h3>
                          {idx > 0 && (
                            <div className="bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200">
                              <label className="flex items-center gap-2 text-xs text-emerald-700 font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      handleCopyFromTop(idx, "target");
                                  }}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                                />{" "}
                                Samakan
                              </label>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mb-4">
                          Jika diisi, jadwal ini <b className="text-emerald-700">hanya</b> akan muncul untuk Host yang dipilih ini saja.
                        </p>
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1">
                            <input
                              list="listHostMarketplace"
                              type="text"
                              value={inputTargetHost[item.id] || ""}
                              onChange={(e) =>
                                setInputTargetHost({
                                  ...inputTargetHost,
                                  [item.id]: e.target.value,
                                })
                              }
                              placeholder="Ketik nama Host..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddTargetHostChip(item.id, idx)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap shadow-sm"
                          >
                            Tambah
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg min-h-[50px]">
                          {((item.targetHost as string[]) || []).length === 0 ? (
                            <span className="text-xs text-slate-400 italic flex items-center h-full px-2">
                              Belum ada host eksklusif (Jadwal Terbuka Umum).
                            </span>
                          ) : (
                            ((item.targetHost as string[]) || []).map((th, thi) => {
                              const namaHost = th.includes("|") ? th.split("|")[1].trim() : th;
                              return (
                                <div
                                  key={thi}
                                  className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold"
                                >
                                  <span>
                                    <i className="fa-solid fa-user-check mr-1" /> {namaHost}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTargetHostChip(idx, thi)}
                                    className="text-emerald-600 hover:text-emerald-900 bg-emerald-200 hover:bg-emerald-300 rounded-full w-5 h-5 flex items-center justify-center transition"
                                  >
                                    <i className="fa-solid fa-xmark text-xs" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Pengecualian Host (Blacklist - Red) */}
                      <div className="bg-red-50/50 border border-red-100 p-4 sm:p-5 rounded-xl">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 border-b border-red-200 pb-3">
                          <h3 className="text-xs sm:text-sm font-bold text-red-700 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-ban text-red-500" /> Pengecualian Host (Blacklist)
                          </h3>
                          {idx > 0 && (
                            <div className="bg-red-100 px-3 py-1.5 rounded-lg border border-red-200">
                              <label className="flex items-center gap-2 text-xs text-red-700 font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      handleCopyFromTop(idx, "blacklist");
                                  }}
                                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500 accent-red-600"
                                />{" "}
                                Samakan
                              </label>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mb-4">
                          Host yang dimasukkan ke sini tidak akan bisa melihat jadwal Anda.
                        </p>
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1">
                            <input
                              list="listHostMarketplace"
                              type="text"
                              value={inputBlacklistHost[item.id] || ""}
                              onChange={(e) =>
                                setInputBlacklistHost({
                                  ...inputBlacklistHost,
                                  [item.id]: e.target.value,
                                })
                              }
                              placeholder="Ketik nama Host..."
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddBlacklistHostChip(item.id, idx)}
                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition whitespace-nowrap shadow-sm"
                          >
                            Tambah
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg min-h-[50px]">
                          {((item.blacklistHost as string[]) || []).length === 0 ? (
                            <span className="text-xs text-slate-400 italic flex items-center h-full px-2">
                              Belum ada host yang dikecualikan.
                            </span>
                          ) : (
                            ((item.blacklistHost as string[]) || []).map((bh, bhi) => {
                              const namaHost = bh.includes("|") ? bh.split("|")[1].trim() : bh;
                              return (
                                <div
                                  key={bhi}
                                  className="flex items-center gap-2 bg-red-100 border border-red-200 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold"
                                >
                                  <span>
                                    <i className="fa-solid fa-user-slash mr-1" /> {namaHost}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBlacklistHostChip(idx, bhi)}
                                    className="text-red-500 hover:text-red-800 bg-red-200 hover:bg-red-300 rounded-full w-5 h-5 flex items-center justify-center transition"
                                  >
                                    <i className="fa-solid fa-xmark text-xs" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SEKSI 4: TOMBOL PECAH SESI */}
                    <div className="pt-3 mt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setModalSplit({ isOpen: true, formIdx: idx, numSessions: 2 })
                        }
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                      >
                        <i className="fa-solid fa-scissors" /> Pecah Form Ini Menjadi Beberapa Sesi Berurutan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <button
            type="button"
            onClick={handleAddForm}
            className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm border border-red-200"
          >
            <i className="fa-solid fa-plus" /> Tambah Jadwal (Maks 20)
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={checkBebasCrashMarketplace}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              <i className="fa-solid fa-shield-halved" /> Bebas Crash
            </button>
            <button
              type="submit"
              disabled={loading || !isMarketplaceCrashVerified}
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm text-white ${
                isMarketplaceCrashVerified && !loading
                  ? "bg-[#941A0B] hover:bg-[#7a1509] cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
            >
              <i className="fa-solid fa-paper-plane" />
              <span>{loading ? "Mengirim..." : "Kirim Semua Pengajuan"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Datalist Host Helper */}
      <datalist id="listHostMarketplace">
        {streamerOptions.map((opt, i) => (
          <option key={i} value={opt} />
        ))}
      </datalist>

      {/* Modal Split Sesi Marketplace (100% Match with Ref-Deploy modalSplitSesi) */}
      {modalSplit.isOpen && modalSplit.formIdx !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm p-6 sm:p-8 animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-indigo-50 border-4 border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">
                <i className="fa-solid fa-scissors" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Pecah Jadwal</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Jadwal ini berdurasi panjang. Ingin dipecah menjadi berapa sesi berurutan?
              </p>
            </div>

            <div className="mb-6">
              <input
                type="number"
                min={2}
                max={20}
                value={modalSplit.numSessions || ""}
                onChange={(e) =>
                  setModalSplit({
                    ...modalSplit,
                    numSessions: Number(e.target.value),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSplitMarketplace(
                      modalSplit.formIdx!,
                      modalSplit.numSessions || 2
                    );
                  }
                }}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-center text-xl font-bold text-indigo-700 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                placeholder="Ketik angka (Misal: 2)"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setModalSplit({ isOpen: false, formIdx: null, numSessions: 2 })
                }
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSplitMarketplace(
                    modalSplit.formIdx!,
                    modalSplit.numSessions || 2
                  )
                }
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md shadow-indigo-200 transition-all text-sm"
              >
                Proses Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
