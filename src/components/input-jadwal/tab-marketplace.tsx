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
import { inputCls, selectCls, labelCls } from "./shared-styles";

export function TabMarketplace({
  streamers,
  clients,
  platformClientOptions,
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  const [marketplaceForms, setMarketplaceForms] = useState<ScheduleFormItem[]>([
    {
      id: 1,
      idJadwal: generateNewScheduleId("MKT"),
      tanggal: new Date().toISOString().slice(0, 10),
      platform: "",
      clientId: "",
      jamMulaiLive: "10:00",
      jamSelesaiLive: "12:00",
      durasi: "2",
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
        tanggal: last?.tanggal || new Date().toISOString().slice(0, 10),
        platform: last?.platform || "",
        clientId: last?.clientId || "",
        jamMulaiLive: "10:00",
        jamSelesaiLive: "12:00",
        durasi: "2",
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
      showAlert("⚠️ Minimal 1 formulir pengajuan.");
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
      if (field === "jamMulaiLive" || field === "jamSelesaiLive") {
        item.durasi = calcDurationHours(item.jamMulaiLive, item.jamSelesaiLive);
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
      showAlert("⚠️ Host ini sudah ditambahkan.");
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
      showAlert("⚠️ Host ini sudah ada di blacklist.");
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
        showAlert(`⚠️ Form #${i + 1}: Platform, Tanggal, Jam Mulai, dan Jam Selesai wajib diisi!`);
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
        title: `Ditemukan ${conflicts.length} Jadwal Marketplace Bentrok!`,
        conflicts,
      });
    } else {
      setIsMarketplaceCrashVerified(true);
      setModalCrashData({
        isOpen: true,
        isSafe: true,
        title: "Formulir Marketplace Aman & Bebas Bentrok!",
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
      showAlert("⚠️ Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu!");
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
            ? item.targetHost.join(", ")
            : item.targetHost || null,
          blacklistHost: Array.isArray(item.blacklistHost)
            ? item.blacklistHost.join(", ")
            : item.blacklistHost || null,
          status: "TERJADWAL",
        };

        await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setSuccess(`✅ Berhasil mengirimkan ${marketplaceForms.length} Pengajuan Jadwal Marketplace!`);
      setIsMarketplaceCrashVerified(false);
      setMarketplaceForms([
        {
          id: 1,
          idJadwal: generateNewScheduleId("MKT"),
          tanggal: new Date().toISOString().slice(0, 10),
          platform: "",
          clientId: "",
          jamMulaiLive: "10:00",
          jamSelesaiLive: "12:00",
          durasi: "2",
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="mb-2">
        <h2 className="text-lg font-bold text-slate-800 mb-1">
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
        {marketplaceForms.map((item, idx) => {
          const headTitle =
            item.platform && item.tanggal
              ? `${item.platform} | ${item.tanggal} | ${item.jamMulaiLive} - ${item.jamSelesaiLive}`
              : "Jadwal Pengajuan Baru";

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
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    #{idx + 1}
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    {headTitle}
                  </h3>
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
                    className="text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
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
                      <i className="fa-solid fa-clock text-blue-500" /> Informasi Jadwal
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
                          className={selectCls}
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
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Jam Mulai *
                        </label>
                        <input
                          type="time"
                          value={item.jamMulaiLive}
                          onChange={(e) =>
                            updateFormField(idx, "jamMulaiLive", e.target.value)
                          }
                          className={inputCls}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Jam Selesai *
                        </label>
                        <input
                          type="time"
                          value={item.jamSelesaiLive}
                          onChange={(e) =>
                            updateFormField(idx, "jamSelesaiLive", e.target.value)
                          }
                          className={inputCls}
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
                          value={item.kuota || 1}
                          onChange={(e) =>
                            updateFormField(idx, "kuota", Number(e.target.value))
                          }
                          className={inputCls}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEKSI 2: DETAIL PENJUALAN */}
                  <div className="bg-slate-50 border border-slate-100 p-4 sm:p-5 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 border-b border-slate-200 pb-3">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <i className="fa-solid fa-bullseye text-blue-500" /> Detail Penjualan
                      </h3>
                      {idx > 0 && (
                        <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <label className="flex items-center gap-2 text-xs text-blue-700 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) handleCopyFromTop(idx, "detail");
                              }}
                              className="w-4 h-4 rounded text-blue-600"
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
                            placeholder="Contoh: Payday Sale 9.9..."
                            className={inputCls}
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
                            className={inputCls}
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
                            placeholder="Link dokumen / brief Host..."
                            className={inputCls}
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
                            placeholder="Link dokumen / brief OTS..."
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {/* Produk Prioritas */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Produk Prioritas
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                          Pilih produk utama yang akan di-highlight saat live streaming.
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
                            placeholder="Ketik nama produk lalu klik Tambah..."
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddProdukChip(item.id, idx)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap"
                          >
                            Tambah
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl min-h-[48px]">
                          {((item.produkPrioritas as string[]) || []).length === 0 ? (
                            <span className="text-slate-400 text-xs italic self-center">
                              Belum ada produk prioritas ditambahkan
                            </span>
                          ) : (
                            ((item.produkPrioritas as string[]) || []).map((p, pi) => (
                              <span
                                key={pi}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                              >
                                {p}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProdukChip(idx, pi)}
                                  className="text-red-400 hover:text-red-700"
                                >
                                  ✕
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SEKSI 3: TARGET HOST & BLACKLIST */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Target Host Eksklusif */}
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
                                className="w-4 h-4 rounded text-emerald-600"
                              />{" "}
                              Samakan
                            </label>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 mb-3">
                        Jika diisi, jadwal ini <strong className="text-emerald-700">hanya</strong> akan muncul untuk Host yang dipilih ini saja.
                      </p>
                      <div className="flex gap-2 mb-3">
                        <select
                          value={inputTargetHost[item.id] || ""}
                          onChange={(e) =>
                            setInputTargetHost({
                              ...inputTargetHost,
                              [item.id]: e.target.value,
                            })
                          }
                          className={selectCls}
                        >
                          <option value="">-- Pilih Nama Streamer --</option>
                          {streamers.map((s) => (
                            <option
                              key={s.id}
                              value={`${s.namaLengkap} (${s.idKaryawan})`}
                            >
                              {s.namaLengkap} ({s.idKaryawan})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddTargetHostChip(item.id, idx)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap"
                        >
                          Tambah
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl min-h-[48px]">
                        {((item.targetHost as string[]) || []).length === 0 ? (
                          <span className="text-slate-400 text-xs italic self-center">
                            Tidak ada target host eksklusif
                          </span>
                        ) : (
                          ((item.targetHost as string[]) || []).map((th, thi) => (
                            <span
                              key={thi}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold"
                            >
                              {th}
                              <button
                                type="button"
                                onClick={() => handleRemoveTargetHostChip(idx, thi)}
                                className="text-emerald-500 hover:text-emerald-800"
                              >
                                ✕
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pengecualian Host (Blacklist) */}
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
                                className="w-4 h-4 rounded text-red-600"
                              />{" "}
                              Samakan
                            </label>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 mb-3">
                        Host yang dimasukkan ke sini tidak akan dapat melihat jadwal ini.
                      </p>
                      <div className="flex gap-2 mb-3">
                        <select
                          value={inputBlacklistHost[item.id] || ""}
                          onChange={(e) =>
                            setInputBlacklistHost({
                              ...inputBlacklistHost,
                              [item.id]: e.target.value,
                            })
                          }
                          className={selectCls}
                        >
                          <option value="">-- Pilih Nama Streamer --</option>
                          {streamers.map((s) => (
                            <option
                              key={s.id}
                              value={`${s.namaLengkap} (${s.idKaryawan})`}
                            >
                              {s.namaLengkap} ({s.idKaryawan})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddBlacklistHostChip(item.id, idx)}
                          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap"
                        >
                          Tambah
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl min-h-[48px]">
                        {((item.blacklistHost as string[]) || []).length === 0 ? (
                          <span className="text-slate-400 text-xs italic self-center">
                            Tidak ada host yang di-blacklist
                          </span>
                        ) : (
                          ((item.blacklistHost as string[]) || []).map((bh, bhi) => (
                            <span
                              key={bhi}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-800 border border-red-300 rounded-lg text-xs font-bold"
                            >
                              {bh}
                              <button
                                type="button"
                                onClick={() => handleRemoveBlacklistHostChip(idx, bhi)}
                                className="text-red-500 hover:text-red-800"
                              >
                                ✕
                              </button>
                            </span>
                          ))
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
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      <i className="fa-solid fa-scissors" /> Pecah Form Ini Menjadi Beberapa Sesi Berurutan
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <button
            type="button"
            onClick={handleAddForm}
            className="w-full sm:w-auto text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
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
              className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm ${
                isMarketplaceCrashVerified && !loading
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
            >
              <i className="fa-solid fa-paper-plane" />
              <span>{loading ? "Mengirim..." : "Kirim Semua Pengajuan"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal Split Sesi Marketplace */}
      {modalSplit.isOpen && modalSplit.formIdx !== null && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">
              Pecah Sesi Live Marketplace Berurutan
            </h3>
            <p className="text-xs text-slate-500">
              Formulir pengajuan akan otomatis dibagi menjadi beberapa sesi dengan durasi yang sama.
            </p>
            <div>
              <label className={labelCls}>Jumlah Sesi</label>
              <select
                value={modalSplit.numSessions}
                onChange={(e) =>
                  setModalSplit({
                    ...modalSplit,
                    numSessions: Number(e.target.value),
                  })
                }
                className={selectCls}
              >
                <option value={2}>2 Sesi</option>
                <option value={3}>3 Sesi</option>
                <option value={4}>4 Sesi</option>
                <option value={5}>5 Sesi</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setModalSplit({ isOpen: false, formIdx: null, numSessions: 2 })
                }
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSplitMarketplace(modalSplit.formIdx!, modalSplit.numSessions)
                }
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Pecah Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
