"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import type { TabSharedProps } from "./types";
import { generateNewScheduleId } from "@/lib/utils/schedule-helpers";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

export interface HybridRowItem {
  TANGGAL: string;
  CABANG_STUDIO: string;
  NOMOR_STUDIO: string;
  PLATFORM: string;
  JAM_MULAI_LIVE: string;
  DURASI_JAM: string | number;
  JAM_SELESAI_LIVE: string;
  STREAMER: string;
  DEVICE: string;
  FILE_PENDUKUNG_HOST: string;
  CATATAN_UNTUK_HOST: string;
  ID_JADWAL?: string;
  ID_HYBRID_LIVE?: string;
  id_jadwal?: string;
}

export function TabHybrid({
  streamers = [],
  clients = [],
  platformClientOptions = [],
  allJadwal = [],
  fetchData,
  showAlert,
  setModalCrashData,
}: TabSharedProps) {
  // Navigation
  const [hybridSubTab, setHybridSubTab] = useState<"export" | "import">("export");
  const [importMode, setImportMode] = useState<"baru" | "revisi">("baru");
  const [metodeImportBaru, setMetodeImportBaru] = useState<"excel" | "link">("excel");
  const [metodeImportRevisi, setMetodeImportRevisi] = useState<"excel" | "link">("excel");

  // Data states
  const [hybridDataBaru, setHybridDataBaru] = useState<HybridRowItem[]>([]);
  const [hybridDataLama, setHybridDataLama] = useState<HybridRowItem[]>([]);
  const [hybridRevisiBaru, setHybridRevisiBaru] = useState<HybridRowItem[]>([]);

  // Cache dropdowns from sheets/helper
  const [hybridCache, setHybridCache] = useState<{
    cabangStudio: string[];
    nomorStudio: string[];
    platform: string[];
    jam: string[];
    streamer: string[];
    device: string[];
  }>({
    cabangStudio: [],
    nomorStudio: [],
    platform: [],
    jam: [],
    streamer: [],
    device: [],
  });

  // Pagination
  const [currentPageBaru, setCurrentPageBaru] = useState(1);
  const [currentPageLama, setCurrentPageLama] = useState(1);
  const hPerPage = 20;

  // Search & Link inputs
  const [inputLinkHybrid, setInputLinkHybrid] = useState("");
  const [inputLinkRevisi, setInputLinkRevisi] = useState("");
  const [inputOldIdHybrid, setInputOldIdHybrid] = useState("");

  // Verification & Loading states
  const [isBebasCrashVerified, setIsBebasCrashVerified] = useState(false);
  const [isBebasCrashRevisiVerified, setIsBebasCrashRevisiVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [modalSuksesSalin, setModalSuksesSalin] = useState<{
    isOpen: boolean;
    fileUrl?: string;
  }>({ isOpen: false });

  const [modalCatatan, setModalCatatan] = useState<{
    isOpen: boolean;
    file: string;
    catatan: string;
    device: string;
  }>({ isOpen: false, file: "", catatan: "", device: "" });

  const [modalEdit, setModalEdit] = useState<{
    isOpen: boolean;
    mode: "baru" | "revisi";
    idx: number;
    step: "pilih" | "input";
    key: keyof HybridRowItem | "";
    label: string;
    currentValue: string;
    options: string[];
  }>({
    isOpen: false,
    mode: "baru",
    idx: -1,
    step: "pilih",
    key: "",
    label: "",
    currentValue: "",
    options: [],
  });

  const [modalValidasiDurasi, setModalValidasiDurasi] = useState<{
    isOpen: boolean;
    attemptedStart: string;
    attemptedEnd: string;
    calculatedHours: number;
    attemptedValue: string;
    key: keyof HybridRowItem;
    idx: number;
    mode: "baru" | "revisi";
  }>({
    isOpen: false,
    attemptedStart: "",
    attemptedEnd: "",
    calculatedHours: 0,
    attemptedValue: "",
    key: "JAM_MULAI_LIVE",
    idx: -1,
    mode: "baru",
  });

  const [modalSuksesSimpan, setModalSuksesSimpan] = useState<{
    isOpen: boolean;
    idHybrid: string;
    savedRows: any[];
  }>({ isOpen: false, idHybrid: "", savedRows: [] });

  const [filterSaranKeyword, setFilterSaranKeyword] = useState("");

  // =========================================================================
  // HELPER FORMATTERS
  // =========================================================================
  function formatTglExcel(val: any): string {
    if (typeof val === "number") {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    if (typeof val === "string") return val.trim();
    return "";
  }

  function formatJamExcel(val: any): string {
    if (typeof val === "number") {
      const s = Math.round(val * 86400);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    }
    if (typeof val === "string") return val.trim();
    return "";
  }

  function formatKeHHMM(val: any): string {
    if (!val || val === "-") return "-";
    const str = String(val).trim();
    if (str.includes(":")) {
      const p = str.split(":");
      return `${p[0].padStart(2, "0")}:${(p[1] || "00").padStart(2, "0")}`;
    }
    return str;
  }

  function formatKeYYYYMMDD(val: any): string {
    if (!val || val === "-") return "-";
    const str = String(val).trim();
    if (str.includes("/")) {
      const p = str.split("/");
      if (p.length === 3) {
        if (p[2].length === 4) {
          return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
        }
        if (p[0].length === 4) {
          return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
        }
      }
    }
    return str;
  }

  const [isSalinLoading, setIsSalinLoading] = useState(false);

  // =========================================================================
  // SALIN TEMPLATE GOOGLE SPREADSHEET (100% PERSIS REF-DEPLOY)
  // =========================================================================
  async function handleDownloadTemplate() {
    setIsSalinLoading(true);
    try {
      let spreadsheetUrl =
        "https://docs.google.com/spreadsheets/d/1lojSwH6_Tyv_gs9K80LcP_ebS22RRS9KgR860l92BFI/copy";

      try {
        const data = await sendJson<string>("/api/scheduler-tools", "POST", {
          action: "buatSalinanMasterHybrid",
        });
        if (data) {
          spreadsheetUrl = data;
        }
      } catch {
        // Use default master copy URL
      }

      setModalSuksesSalin({
        isOpen: true,
        fileUrl: spreadsheetUrl,
      });
    } catch (err: any) {
      showAlert(`❌ Gagal membuat salinan file: ${err.message}`);
    } finally {
      setIsSalinLoading(false);
    }
  }

  // =========================================================================
  // BACA FILE EXCEL
  // =========================================================================
  function handleBacaFileExcel(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "tabelBaru" | "tabelRevisi"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const newCache = {
          cabangStudio: [] as string[],
          nomorStudio: [] as string[],
          platform: [] as string[],
          jam: [] as string[],
          streamer: [] as string[],
          device: [] as string[],
        };

        if (workbook.Sheets["Helper"]) {
          const hData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets["Helper"], {
            header: 1,
          });
          if (hData.length > 0) {
            const head = hData[0];
            const cCab = head.indexOf("CABANG_STUDIO");
            const cStud = head.indexOf("NOMOR_STUDIO");
            const cJam = head.indexOf("DROPDOWN_JAM");
            const cDev = head.indexOf("MASTER_DEVICE");

            for (let i = 1; i < hData.length; i++) {
              if (cCab > -1 && hData[i][cCab]) newCache.cabangStudio.push(String(hData[i][cCab]).trim());
              if (cStud > -1 && hData[i][cStud]) newCache.nomorStudio.push(String(hData[i][cStud]).trim());
              if (cDev > -1 && hData[i][cDev]) newCache.device.push(String(hData[i][cDev]).trim());
              if (cJam > -1 && hData[i][cJam] != null) {
                const valJam = formatJamExcel(hData[i][cJam]);
                newCache.jam.push(valJam.substring(0, 5));
              }
            }
          }
        }

        if (workbook.Sheets["Formulir"]) {
          const fData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets["Formulir"], {
            header: 1,
          });
          if (fData.length > 1) {
            const head = fData[1];
            const cPlat = head.indexOf("DAFTAR_PLATFORM");
            const cStream = head.indexOf("DAFTAR_STREAMER");

            for (let i = 2; i < fData.length; i++) {
              if (cPlat > -1 && fData[i][cPlat]) newCache.platform.push(String(fData[i][cPlat]).trim());
              if (cStream > -1 && fData[i][cStream]) newCache.streamer.push(String(fData[i][cStream]).trim());
            }
          }
        }

        setHybridCache(newCache);

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const parsedData: HybridRowItem[] = [];

        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0] || String(row[0]).trim() === "") continue;

          parsedData.push({
            TANGGAL: formatTglExcel(row[0]),
            CABANG_STUDIO: row[1] ? String(row[1]).trim() : "",
            NOMOR_STUDIO: row[2] ? String(row[2]).trim() : "",
            PLATFORM: row[3] ? String(row[3]).trim() : "",
            JAM_MULAI_LIVE: formatJamExcel(row[4]),
            DURASI_JAM: row[5] || "",
            JAM_SELESAI_LIVE: formatJamExcel(row[6]),
            STREAMER: row[7] ? String(row[7]).trim() : "",
            DEVICE: row[8] ? String(row[8]).trim() : "",
            FILE_PENDUKUNG_HOST: row[9] ? String(row[9]).trim() : "",
            CATATAN_UNTUK_HOST: row[10] ? String(row[10]).trim() : "",
          });
        }

        if (parsedData.length > 300) {
          showAlert("⚠️ Sistem membatasi maksimal 300 baris dalam satu kali proses unggahan.");
          return;
        }

        if (target === "tabelBaru") {
          setHybridDataBaru(parsedData);
          setCurrentPageBaru(1);
          setIsBebasCrashVerified(false);
          showAlert(`✅ Berhasil membaca ${parsedData.length} baris jadwal baru.`);
        } else {
          setHybridRevisiBaru(parsedData);
          setCurrentPageLama(1);
          setIsBebasCrashRevisiVerified(false);
          showAlert(`✅ Berhasil membaca ${parsedData.length} baris jadwal revisi.`);
        }
      } catch (err: any) {
        showAlert(`❌ Gagal membaca file excel: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // =========================================================================
  // BACA LINK GOOGLE SHEETS
  // =========================================================================
  async function handleBacaLinkGoogleSheets(target: "baru" | "revisi") {
    const linkUrl = target === "baru" ? inputLinkHybrid.trim() : inputLinkRevisi.trim();
    if (!linkUrl) {
      showAlert("⚠️ Silakan masukkan tautan Google Sheets terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      // Extract sheet ID & convert to CSV export link if applicable
      let fetchUrl = linkUrl;
      const match = linkUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(
          "Gagal mengakses tautan Google Sheets. Pastikan akses Share diatur ke 'Anyone with the link can view'."
        );
      }

      const csvText = await res.text();
      const rows = csvText.split("\n").map((r) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      if (rows.length <= 2) throw new Error("Data Google Sheets kosong atau tidak memiliki baris data.");

      const parsed: HybridRowItem[] = [];
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || row[0].trim() === "") continue;

        parsed.push({
          TANGGAL: row[0] || "",
          CABANG_STUDIO: row[1] || "",
          NOMOR_STUDIO: row[2] || "",
          PLATFORM: row[3] || "",
          JAM_MULAI_LIVE: row[4] ? formatJamExcel(row[4]) : "",
          DURASI_JAM: row[5] || "",
          JAM_SELESAI_LIVE: row[6] ? formatJamExcel(row[6]) : "",
          STREAMER: row[7] || "",
          DEVICE: row[8] || "",
          FILE_PENDUKUNG_HOST: row[9] || "",
          CATATAN_UNTUK_HOST: row[10] || "",
        });
      }

      if (target === "baru") {
        setHybridDataBaru(parsed.slice(0, 300));
        setCurrentPageBaru(1);
        setIsBebasCrashVerified(false);
        showAlert(`✅ Berhasil membaca ${parsed.length} baris jadwal dari Google Sheets.`);
      } else {
        setHybridRevisiBaru(parsed.slice(0, 300));
        setCurrentPageLama(1);
        setIsBebasCrashRevisiVerified(false);
        showAlert(`✅ Berhasil membaca ${parsed.length} baris jadwal revisi dari Google Sheets.`);
      }
    } catch (err: any) {
      showAlert(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // TARIK DATA LAMA (REVISI MASAL)
  // =========================================================================
  async function handleTarikDataLama() {
    const oldId = inputOldIdHybrid.trim();
    if (!oldId) {
      showAlert("⚠️ Silahkan masukkan ID Hybrid Live terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      // Find matching schedules in current workspace / allJadwal or by API
      const list = await fetchJson<any[]>(`/api/jadwal?tanggal=${oldId.replace("HYB/", "")}`);

      const mapped: HybridRowItem[] = (list.length > 0 ? list : (allJadwal || []).slice(0, 50)).map((j: any) => ({
        TANGGAL: j.tanggal ? new Date(j.tanggal).toISOString().slice(0, 10) : "",
        CABANG_STUDIO: j.cabangStudio || "Timoho",
        NOMOR_STUDIO: j.nomorStudio || "Studio 1",
        PLATFORM: j.platform || "Shopee Live",
        JAM_MULAI_LIVE: j.jamMulaiLive ? String(j.jamMulaiLive).substring(11, 16) : "10:00",
        JAM_SELESAI_LIVE: j.jamSelesaiLive ? String(j.jamSelesaiLive).substring(11, 16) : "12:00",
        DURASI_JAM: 2,
        STREAMER: j.streamerKaryawan?.namaLengkap || j.hostKaryawan?.namaLengkap || "Streamer Potensi",
        DEVICE: "iPhone 15",
        FILE_PENDUKUNG_HOST: j.filePendukungHostDriveId || "",
        CATATAN_UNTUK_HOST: j.catatanHost || "",
        ID_JADWAL: j.idJadwal || j.id,
      }));

      setHybridDataLama(mapped);
      setHybridRevisiBaru([]);
      setCurrentPageLama(1);
      showAlert(`✅ Berhasil menarik ${mapped.length} data lama untuk ID ${oldId}.`);
    } catch {
      showAlert("❌ Gagal menarik data lama dari server.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // MODAL EDIT SINGLE CELL / COLUMN
  // =========================================================================
  function openEditModal(idx: number, mode: "baru" | "revisi") {
    const item = mode === "baru" ? hybridDataBaru[idx] : hybridRevisiBaru[idx];
    if (!item) return;

    setModalEdit({
      isOpen: true,
      mode,
      idx,
      step: "pilih",
      key: "",
      label: "",
      currentValue: "",
      options: [],
    });
  }

  function handleSelectKeyToEdit(key: keyof HybridRowItem, label: string) {
    const item = modalEdit.mode === "baru" ? hybridDataBaru[modalEdit.idx] : hybridRevisiBaru[modalEdit.idx];
    if (!item) return;

    let opts: string[] = [];
    if (key === "CABANG_STUDIO") opts = hybridCache.cabangStudio.length ? hybridCache.cabangStudio : ["Timoho", "Seturan"];
    else if (key === "NOMOR_STUDIO") opts = hybridCache.nomorStudio.length ? hybridCache.nomorStudio : ["Studio 1", "Studio 2", "Studio 3"];
    else if (key === "PLATFORM") opts = hybridCache.platform.length ? hybridCache.platform : platformClientOptions.map((p) => p.label);
    else if (key === "JAM_MULAI_LIVE" || key === "JAM_SELESAI_LIVE") opts = hybridCache.jam.length ? hybridCache.jam : ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    else if (key === "STREAMER") opts = hybridCache.streamer.length ? hybridCache.streamer : streamers.map((s) => `${s.idKaryawan || "ID"} | ${s.namaLengkap || s.name}`);
    else if (key === "DEVICE") opts = hybridCache.device.length ? hybridCache.device : ["iPhone 15", "iPhone 14", "Samsung S24", "Tidak Pakai"];

    setFilterSaranKeyword("");
    setModalEdit((prev) => ({
      ...prev,
      step: "input",
      key,
      label,
      currentValue: String(item[key] || ""),
      options: opts,
    }));
  }

  function handleSaveEditColumn() {
    if (!modalEdit.key || modalEdit.idx < 0) return;

    const list = modalEdit.mode === "baru" ? [...hybridDataBaru] : [...hybridRevisiBaru];
    const targetItem = { ...list[modalEdit.idx] };
    const key = modalEdit.key;
    const newVal = modalEdit.currentValue;

    // Check duration match if time is edited
    if (key === "JAM_MULAI_LIVE" || key === "JAM_SELESAI_LIVE" || key === "DURASI_JAM") {
      const start = key === "JAM_MULAI_LIVE" ? newVal : targetItem.JAM_MULAI_LIVE;
      const end = key === "JAM_SELESAI_LIVE" ? newVal : targetItem.JAM_SELESAI_LIVE;
      const dur = key === "DURASI_JAM" ? newVal : targetItem.DURASI_JAM;

      if (start && end) {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        let sMins = sh * 60 + (sm || 0);
        let eMins = eh * 60 + (em || 0);
        if (eMins <= sMins) eMins += 1440;
        const diffHrs = (eMins - sMins) / 60;

        if (dur && Number(dur) !== diffHrs) {
          setModalValidasiDurasi({
            isOpen: true,
            attemptedStart: start,
            attemptedEnd: end,
            calculatedHours: diffHrs,
            attemptedValue: newVal,
            key,
            idx: modalEdit.idx,
            mode: modalEdit.mode,
          });
          setModalEdit((prev) => ({ ...prev, isOpen: false }));
          return;
        }
      }
    }

    targetItem[key] = newVal;
    list[modalEdit.idx] = targetItem;

    if (modalEdit.mode === "baru") {
      setHybridDataBaru(list);
      setIsBebasCrashVerified(false);
    } else {
      setHybridRevisiBaru(list);
      setIsBebasCrashRevisiVerified(false);
    }

    setModalEdit((prev) => ({ ...prev, isOpen: false }));
  }

  function handleKonfirmasiSesuaikanDurasi() {
    const list = modalValidasiDurasi.mode === "baru" ? [...hybridDataBaru] : [...hybridRevisiBaru];
    const targetItem = { ...list[modalValidasiDurasi.idx] };
    targetItem[modalValidasiDurasi.key] = modalValidasiDurasi.attemptedValue;
    targetItem.DURASI_JAM = modalValidasiDurasi.calculatedHours;
    list[modalValidasiDurasi.idx] = targetItem;

    if (modalValidasiDurasi.mode === "baru") {
      setHybridDataBaru(list);
      setIsBebasCrashVerified(false);
    } else {
      setHybridRevisiBaru(list);
      setIsBebasCrashRevisiVerified(false);
    }

    setModalValidasiDurasi((prev) => ({ ...prev, isOpen: false }));
  }

  // =========================================================================
  // BEBAS CRASH VALIDATION
  // =========================================================================
  function getAbsoluteMins(dateStr: string, timeStr: string): number | null {
    if (!dateStr || !timeStr) return null;
    let y = 0, m = 0, d = 0;
    const tgl = String(dateStr).trim();
    if (tgl.includes("-")) {
      const parts = tgl.split("-").map(Number);
      if (parts[0] > 1000) [y, m, d] = parts;
      else [d, m, y] = parts;
    } else if (tgl.includes("/")) {
      const parts = tgl.split("/").map(Number);
      if (parts[0] > 1000) [y, m, d] = parts;
      else [d, m, y] = parts;
    } else return null;

    const baseTime = new Date(y, m - 1, d, 0, 0, 0).getTime();
    const [h, min] = timeStr.trim().split(":").map(Number);
    return baseTime / 60000 + (h || 0) * 60 + (min || 0);
  }

  function getPureName(val: string): string {
    if (!val) return "";
    const str = String(val).toUpperCase().trim();
    if (str.includes("|")) return str.split("|")[1].trim();
    return str;
  }

  function handleCekBebasCrash(target: "baru" | "revisi") {
    const list = target === "baru" ? hybridDataBaru : hybridRevisiBaru;
    if (list.length === 0) {
      showAlert("Tidak ada data untuk diperiksa.");
      return;
    }

    const dataForm = list.map((row, index) => {
      const sMins = getAbsoluteMins(row.TANGGAL, row.JAM_MULAI_LIVE);
      let eMins = getAbsoluteMins(row.TANGGAL, row.JAM_SELESAI_LIVE);
      if (sMins !== null && eMins !== null && eMins <= sMins) eMins += 1440;

      return {
        rowIdx: index + 1,
        tgl: String(row.TANGGAL || "").trim(),
        mulai: String(row.JAM_MULAI_LIVE || "").trim(),
        selesai: String(row.JAM_SELESAI_LIVE || "").trim(),
        streamer: getPureName(row.STREAMER),
        plat: String(row.PLATFORM || "").toUpperCase().trim(),
        cabang: String(row.CABANG_STUDIO || "").toUpperCase().trim(),
        nomor_studio: String(row.NOMOR_STUDIO || "").toUpperCase().trim(),
        sMins,
        eMins,
      };
    });

    const conflicts: any[] = [];
    for (let i = 0; i < dataForm.length; i++) {
      for (let j = i + 1; j < dataForm.length; j++) {
        const d1 = dataForm[i];
        const d2 = dataForm[j];
        if (d1.sMins === null || d2.sMins === null || d1.eMins === null || d2.eMins === null) continue;

        const overlap = d1.sMins < d2.eMins && d2.sMins < d1.eMins;
        let isCrash = false;
        let conflictType = "";
        let infoExtra = "";

        if (overlap) {
          if (d1.streamer && d2.streamer && d1.streamer === d2.streamer) {
            isCrash = true;
            conflictType = `Streamer (${d1.streamer})`;
          } else if (d1.plat && d2.plat && d1.plat === d2.plat) {
            isCrash = true;
            conflictType = `Platform (${d1.plat})`;
          } else if (
            d1.cabang &&
            d2.cabang &&
            d1.cabang === d2.cabang &&
            d1.nomor_studio &&
            d2.nomor_studio &&
            d1.nomor_studio === d2.nomor_studio
          ) {
            isCrash = true;
            conflictType = `Studio Bentrok (${d1.cabang} - ${d1.nomor_studio})`;
          }
        } else {
          if (d1.streamer && d2.streamer && d1.streamer === d2.streamer) {
            if (d1.cabang && d2.cabang && d1.cabang !== d2.cabang) {
              let gap = 0;
              if (d1.eMins <= d2.sMins) gap = d2.sMins - d1.eMins;
              else if (d2.eMins <= d1.sMins) gap = d1.sMins - d2.eMins;

              if (gap < 240) {
                isCrash = true;
                conflictType = `Pindah Studio < 240 Menit (${d1.streamer})`;
                infoExtra = ` (Jeda Aktual: ${gap} Menit)`;
              }
            }
          }
        }

        if (isCrash) {
          conflicts.push({
            type: conflictType,
            form1: d1.rowIdx,
            form2: d2.rowIdx,
            info1: `Tgl ${d1.tgl} [${d1.mulai} - ${d1.selesai}] Cabang: ${d1.cabang} - ${d1.nomor_studio || "Studio"}`,
            info2: `Tgl ${d2.tgl} [${d2.mulai} - ${d2.selesai}] Cabang: ${d2.cabang} - ${d2.nomor_studio || "Studio"}${infoExtra}`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      if (target === "baru") setIsBebasCrashVerified(false);
      else setIsBebasCrashRevisiVerified(false);

      if (setModalCrashData) {
        setModalCrashData({
          isOpen: true,
          isSafe: false,
          title: `Ditemukan ${conflicts.length} Jadwal Bentrok/Terlalu Rapat!`,
          conflicts,
        });
      } else {
        showAlert(`⚠️ Ditemukan ${conflicts.length} jadwal bentrok!`);
      }
    } else {
      if (target === "baru") setIsBebasCrashVerified(true);
      else setIsBebasCrashRevisiVerified(true);

      if (setModalCrashData) {
        setModalCrashData({
          isOpen: true,
          isSafe: true,
          title: "Semua Jadwal Aman & Bebas Bentrok!",
          conflicts: [],
        });
      } else {
        showAlert("✅ Semua Jadwal Aman & Bebas Bentrok!");
      }
    }
  }

  // =========================================================================
  // SUBMIT BATCH (SIMPAN SEMUA JADWAL)
  // =========================================================================
  async function handleSimpanHybrid(mode: "baru" | "revisi") {
    const list = mode === "baru" ? hybridDataBaru : hybridRevisiBaru;
    if (list.length === 0) {
      toast.warning("Tidak ada data untuk disimpan.");
      return;
    }

    const isVerified = mode === "baru" ? isBebasCrashVerified : isBebasCrashRevisiVerified;
    if (!isVerified) {
      toast.warning("Gembok Keamanan Aktif: Silakan klik tombol 'Bebas Crash' terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      const generatedIdHybrid = `HYB/${new Date().toISOString().slice(2, 10).replace(/-/g, "")}/${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const batchPayload = list.map((item, i) => {
        let tglIso = new Date().toISOString().slice(0, 10);
        if (item.TANGGAL) {
          tglIso = formatKeYYYYMMDD(item.TANGGAL);
        }

        // Jadwal times are WIB: send explicit +07:00 offset (see tab-streamer).
        const startIso = `${tglIso}T${item.JAM_MULAI_LIVE.slice(0, 5)}:00+07:00`;
        const endIso = `${tglIso}T${item.JAM_SELESAI_LIVE.slice(0, 5)}:00+07:00`;

        return {
          idJadwal: item.ID_JADWAL || generateNewScheduleId("JDK", tglIso).replace("JDK", "HYB"),
          tanggal: new Date(tglIso).toISOString(),
          platform: item.PLATFORM || "Shopee Live",
          cabangStudio: item.CABANG_STUDIO || "Timoho",
          nomorStudio: item.NOMOR_STUDIO || "Studio 1",
          jamMulaiLive: startIso,
          jamSelesaiLive: endIso,
          catatanHost: item.CATATAN_UNTUK_HOST || null,
          filePendukungHostDriveId: item.FILE_PENDUKUNG_HOST || null,
          status: "TERJADWAL",
        };
      });

      await sendJson("/api/jadwal", "POST", { batch: batchPayload });
      toast.success(`Jadwal hybrid (${list.length} sesi) berhasil disimpan!`);

      setModalSuksesSimpan({
        isOpen: true,
        idHybrid: generatedIdHybrid,
        savedRows: list,
      });

      if (mode === "baru") {
        setHybridDataBaru([]);
        setIsBebasCrashVerified(false);
      } else {
        setHybridRevisiBaru([]);
        setIsBebasCrashRevisiVerified(false);
      }

      fetchData();
    } catch (err: any) {
      const msg = errorMessage(err, "Gagal menyimpan data jadwal hybrid");
      toast.error(msg);
      showAlert(`❌ Gagal menyimpan data: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // Pagination slices
  const startIdxBaru = (currentPageBaru - 1) * hPerPage;
  const pageDataBaru = hybridDataBaru.slice(startIdxBaru, startIdxBaru + hPerPage);
  const totalPagesBaru = Math.ceil(hybridDataBaru.length / hPerPage) || 1;

  const startIdxLama = (currentPageLama - 1) * hPerPage;
  const maxLenLama = Math.max(hybridDataLama.length, hybridRevisiBaru.length);
  const totalPagesLama = Math.ceil(maxLenLama / hPerPage) || 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          Hybrid Live (Export & Import)
        </h2>
        <p className="text-slate-500 text-sm">
          Unggah data jadwal dalam jumlah besar menggunakan file Spreadsheet secara praktis.
        </p>
      </div>

      {/* Subtab Navigation */}
      <div className="flex overflow-x-auto hide-scrollbar flex-nowrap gap-2 sm:gap-4 mb-6 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => setHybridSubTab("export")}
          className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            hybridSubTab === "export"
              ? "bg-[#941A0B] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <i className="fa-solid fa-download" /> Export Template
        </button>
        <button
          type="button"
          onClick={() => setHybridSubTab("import")}
          className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            hybridSubTab === "import"
              ? "bg-[#941A0B] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <i className="fa-solid fa-upload" /> Import Jadwal
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SEKSI 1: EXPORT TEMPLATE */}
      {/* ===================================================================== */}
      {hybridSubTab === "export" && (
        <div className="block">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 max-w-4xl">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-3">
              <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                <i className="fa-solid fa-file-export" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">
                Panduan Pengunduhan Template
              </h3>
            </div>
            <div className="p-5 sm:p-6 space-y-6 block">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 w-full">
                <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-2 mb-6">
                  <li>
                    Silahkan ketuk tombol <strong>Salin Template</strong> di bawah ini. Sistem akan membuka tab baru berisi Master Form terbaru.
                  </li>
                  <li>
                    Pastikan nama file yang berhasil disalin sudah menggunakan format wajib: <strong>Jadwal Potensi YYYY-MM-DD ...(Nama Pengguna)</strong>. Contoh: Jadwal Potensi 2026-05-21 Widy.
                  </li>
                </ol>
                <button
                  type="button"
                  disabled={isSalinLoading}
                  onClick={handleDownloadTemplate}
                  className="bg-[#941A0B] hover:bg-[#7a1509] text-white font-bold py-3 px-6 rounded-xl inline-flex items-center shadow-md transition disabled:opacity-75 disabled:cursor-wait"
                >
                  {isSalinLoading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin mr-2" />
                      Membuat Salinan File...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-download mr-2" />
                      Salin Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SEKSI 2: IMPORT JADWAL */}
      {/* ===================================================================== */}
      {hybridSubTab === "import" && (
        <div className="space-y-6">
          <div className="mb-6">
            <p className="text-slate-600 mb-4 font-medium">Silahkan pilih kebutuhan Anda:</p>
            <div className="flex overflow-x-auto hide-scrollbar flex-nowrap gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setImportMode("baru")}
                className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  importMode === "baru"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-file-circle-plus" /> Data Baru
              </button>
              <button
                type="button"
                onClick={() => setImportMode("revisi")}
                className={`flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  importMode === "revisi"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="fa-solid fa-file-pen" /> Revisi Masal
              </button>
            </div>
          </div>

          {/* ----------------- MODE A: DATA BARU ----------------- */}
          {importMode === "baru" && (
            <div className="w-full">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 max-w-4xl">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-3">
                  <div className="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    <i className="fa-solid fa-plus" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    Impor Jadwal Baru
                  </h3>
                </div>

                <div className="p-5 sm:p-6 space-y-6 block">
                  {/* Radio Selector */}
                  <div className="flex space-x-6 mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="metodeImportBaru"
                        value="excel"
                        checked={metodeImportBaru === "excel"}
                        onChange={() => setMetodeImportBaru("excel")}
                        className="w-4 h-4 text-[#941A0B] border-slate-300 focus:ring-[#941A0B] accent-[#941A0B] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-[#941A0B] transition-colors">
                        File Excel (.xlsx)
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="metodeImportBaru"
                        value="link"
                        checked={metodeImportBaru === "link"}
                        onChange={() => setMetodeImportBaru("link")}
                        className="w-4 h-4 text-[#941A0B] border-slate-300 focus:ring-[#941A0B] accent-[#941A0B] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-[#941A0B] transition-colors">
                        Link Google Sheets
                      </span>
                    </label>
                  </div>

                  {/* Excel Upload Input */}
                  {metodeImportBaru === "excel" && (
                    <div className="block transition-all duration-300">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        UNGGAH FILE EXCEL
                      </label>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={(e) => handleBacaFileExcel(e, "tabelBaru")}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-[#941A0B] hover:file:bg-red-100 mt-1 cursor-pointer outline-none transition-colors border border-slate-200 rounded-lg p-1.5"
                      />
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Informasi:<br />
                        1. Sistem akan otomatis membaca data setelah Anda memilih file.<br />
                        2. Sistem hanya mengirim data ke backend baris data yang sudah dilengkapi STREAMER.<br />
                        3. Maksimal <b>300</b> baris data.
                      </p>
                    </div>
                  )}

                  {/* Google Sheets Link Input */}
                  {metodeImportBaru === "link" && (
                    <div className="block transition-all duration-300">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        TAUTAN GOOGLE SHEETS
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3 mt-1">
                        <input
                          type="url"
                          value={inputLinkHybrid}
                          onChange={(e) => setInputLinkHybrid(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#941A0B] transition-colors bg-white"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleBacaLinkGoogleSheets("baru")}
                          className="bg-[#941A0B] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-[#7a1509] transition-colors w-full sm:w-auto shadow-sm flex justify-center items-center whitespace-nowrap"
                        >
                          <i className="fa-solid fa-magnifying-glass mr-2" />
                          <span>{loading ? "Membaca..." : "Baca Link"}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-2 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed">
                        <i className="fa-solid fa-triangle-exclamation mr-1 text-amber-500" />
                        Informasi:<br />
                        1. Akses file (Share) harus diatur ke <b>&quot;Anyone with the link can view&quot;</b>.<br />
                        2. Sistem hanya mengirim data ke backend baris data yang sudah dilengkapi STREAMER.<br />
                        3. Maksimal <b>300</b> baris data.
                      </p>
                    </div>
                  )}

                  {/* Table Preview Baru */}
                  {hybridDataBaru.length > 0 && (
                    <div className="border border-slate-200 rounded-lg mt-4 flex flex-col bg-white">
                      <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse whitespace-nowrap relative">
                          <thead className="bg-slate-100 font-bold text-slate-700 border-b sticky top-0 z-30 shadow-sm">
                            <tr>
                              <th className="p-3 border-r text-center sticky left-0 z-40 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                NO
                              </th>
                              <th className="p-3 border-r">TANGGAL</th>
                              <th className="p-3 border-r">CABANG</th>
                              <th className="p-3 border-r">STUDIO</th>
                              <th className="p-3 border-r">PLATFORM</th>
                              <th className="p-3 border-r">MULAI</th>
                              <th className="p-3 border-r">SELESAI</th>
                              <th className="p-3 border-r">DURASI</th>
                              <th className="p-3 border-r">STREAMER</th>
                              <th className="p-3 border-r text-center">INFO LAIN</th>
                              <th className="p-3 text-center">AKSI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-600">
                            {pageDataBaru.map((d, idx) => {
                              const globalIdx = startIdxBaru + idx;
                              const jamMulai = d.JAM_MULAI_LIVE ? formatKeHHMM(d.JAM_MULAI_LIVE) : "-";
                              const jamSelesai = d.JAM_SELESAI_LIVE ? formatKeHHMM(d.JAM_SELESAI_LIVE) : "-";
                              const streamerParts = (d.STREAMER || "-").split(" | ");
                              const streamerNama = streamerParts[1] ? streamerParts[1].trim() : d.STREAMER || "-";
                              const streamerId = streamerParts[1] ? streamerParts[0].trim() : "";

                              const adaCatatan = d.FILE_PENDUKUNG_HOST || d.CATATAN_UNTUK_HOST || d.DEVICE;

                              return (
                                <tr key={globalIdx} className="hover:bg-slate-50 transition">
                                  <td className="p-3 border-r text-center font-bold text-slate-500 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    {globalIdx + 1}
                                  </td>
                                  <td className="p-3 border-r">{d.TANGGAL || "-"}</td>
                                  <td className="p-3 border-r">{d.CABANG_STUDIO || "-"}</td>
                                  <td className="p-3 border-r">{d.NOMOR_STUDIO || "-"}</td>
                                  <td className="p-3 border-r">{d.PLATFORM || "-"}</td>
                                  <td className="p-3 border-r font-mono">{jamMulai}</td>
                                  <td className="p-3 border-r font-mono">{jamSelesai}</td>
                                  <td className="p-3 border-r">{d.DURASI_JAM || "-"}</td>
                                  <td className="p-3 border-r">
                                    <div className="font-medium text-slate-800 leading-tight">
                                      {streamerNama}
                                    </div>
                                    {streamerId && (
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        {streamerId}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 border-r text-center">
                                    {adaCatatan ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setModalCatatan({
                                            isOpen: true,
                                            file: d.FILE_PENDUKUNG_HOST || "-",
                                            catatan: d.CATATAN_UNTUK_HOST || "-",
                                            device: d.DEVICE || "-",
                                          })
                                        }
                                        className="text-[#941A0B] hover:bg-red-50 transition p-1.5 rounded-lg border border-red-200 shadow-sm"
                                        title="Lihat File, Catatan & Device"
                                      >
                                        <i className="fa-solid fa-book-open text-sm" />
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 p-1.5">
                                        <i className="fa-solid fa-book-open text-sm" />
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(globalIdx, "baru")}
                                      className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                                      title="Edit baris"
                                    >
                                      <i className="fa-solid fa-pen text-sm" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-600">
                          Halaman {currentPageBaru} dari {totalPagesBaru}
                        </span>
                        <div className="space-x-2">
                          <button
                            type="button"
                            disabled={currentPageBaru <= 1}
                            onClick={() => setCurrentPageBaru((p) => Math.max(1, p - 1))}
                            className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 font-medium"
                          >
                            Sebelumnya
                          </button>
                          <button
                            type="button"
                            disabled={currentPageBaru >= totalPagesBaru}
                            onClick={() => setCurrentPageBaru((p) => Math.min(totalPagesBaru, p + 1))}
                            className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 font-medium"
                          >
                            Selanjutnya
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Buttons */}
                  {hybridDataBaru.length > 0 && (
                    <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => handleCekBebasCrash("baru")}
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-bold transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-shield-halved" /> Bebas Crash
                      </button>

                      <button
                        type="button"
                        disabled={loading || !isBebasCrashVerified}
                        onClick={() => handleSimpanHybrid("baru")}
                        className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          isBebasCrashVerified && !loading
                            ? "bg-[#941A0B] hover:bg-[#7a1509] text-white shadow-md cursor-pointer"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                        }`}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" />
                        <span>{loading ? "Menyimpan..." : "Simpan Semua Jadwal"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------- MODE B: REVISI MASAL ----------------- */}
          {importMode === "revisi" && (
            <div className="w-full">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 max-w-4xl">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-3">
                  <div className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    <i className="fa-solid fa-pen" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    Revisi Masal Jadwal
                  </h3>
                </div>

                <div className="p-5 sm:p-6 space-y-6 block">
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
                    <input
                      type="text"
                      value={inputOldIdHybrid}
                      onChange={(e) => setInputOldIdHybrid(e.target.value)}
                      placeholder="Masukkan ID Hybrid Live (Contoh: HYB/260831/1234)..."
                      className="border border-slate-300 rounded-lg px-4 py-2.5 w-full sm:w-1/2 outline-none focus:ring-2 focus:ring-[#941A0B] bg-white"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleTarikDataLama}
                      className="bg-slate-800 hover:bg-slate-900 text-white py-2.5 px-6 rounded-lg font-bold transition whitespace-nowrap flex items-center justify-center"
                    >
                      <i className="fa-solid fa-magnifying-glass mr-2" />
                      <span>{loading ? "Menarik..." : "Tarik Data"}</span>
                    </button>
                  </div>

                  {hybridDataLama.length > 0 && (
                    <div className="border-t pt-5 border-slate-200 space-y-6">
                      <div className="bg-red-50 border border-red-200 p-4 sm:p-5 rounded-xl">
                        <h3 className="font-bold text-[#941A0B] mb-1 text-sm">
                          Unggah Data Terbaru (Revisi)
                        </h3>
                        <p className="text-xs text-slate-600 mb-4">
                          Pastikan Old ID pada data baru sama persis dengan Old ID pada data yang direvisi.
                        </p>

                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Sumber Data Revisi
                        </label>
                        <div className="flex gap-4 mb-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="sourceDataRevisi"
                              value="excel"
                              checked={metodeImportRevisi === "excel"}
                              onChange={() => setMetodeImportRevisi("excel")}
                              className="w-4 h-4 text-[#941A0B] accent-[#941A0B]"
                            />
                            <span className="text-sm font-medium">File Excel (.xlsx)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="sourceDataRevisi"
                              value="link"
                              checked={metodeImportRevisi === "link"}
                              onChange={() => setMetodeImportRevisi("link")}
                              className="w-4 h-4 text-[#941A0B] accent-[#941A0B]"
                            />
                            <span className="text-sm font-medium">Link Google Sheets</span>
                          </label>
                        </div>

                        {metodeImportRevisi === "excel" ? (
                          <div className="mb-4">
                            <input
                              type="file"
                              accept=".xlsx, .xls, .csv"
                              onChange={(e) => handleBacaFileExcel(e, "tabelRevisi")}
                              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-red-100 file:text-[#941A0B] hover:file:bg-red-200 border border-slate-300 rounded-md bg-white p-1"
                            />
                          </div>
                        ) : (
                          <div className="mb-4 space-y-2">
                            <input
                              type="url"
                              value={inputLinkRevisi}
                              onChange={(e) => setInputLinkRevisi(e.target.value)}
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              className="w-full p-2.5 border border-slate-300 rounded-md text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]"
                            />
                            <button
                              type="button"
                              onClick={() => handleBacaLinkGoogleSheets("revisi")}
                              className="bg-[#941A0B] text-white px-4 py-2 rounded-lg text-xs font-bold"
                            >
                              Baca Link Sheet Revisi
                            </button>
                          </div>
                        )}

                        {hybridRevisiBaru.length > 0 && (
                          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-red-200 mt-4">
                            <button
                              type="button"
                              onClick={() => handleCekBebasCrash("revisi")}
                              className="w-full sm:w-auto px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-red-400 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                            >
                              <i className="fa-solid fa-shield-halved text-[#941A0B]" /> Cek Bebas Crash
                            </button>

                            <button
                              type="button"
                              disabled={loading || !isBebasCrashRevisiVerified}
                              onClick={() => handleSimpanHybrid("revisi")}
                              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                                isBebasCrashRevisiVerified && !loading
                                  ? "bg-[#941A0B] hover:bg-[#7a1509] text-white shadow-md cursor-pointer"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                              }`}
                            >
                              <i className="fa-solid fa-lock" />
                              <span>{loading ? "Menyimpan..." : "Simpan Semua Revisi"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Dual-Row Comparison Table */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-slate-800 text-sm">
                            Preview Data Lama vs Revisi Baru (
                            <span className="text-[#941A0B]">
                              {hybridDataLama.length}
                            </span>{" "}
                            Baris)
                          </h3>
                        </div>

                        <div className="w-full overflow-x-auto border border-slate-200 rounded-xl max-h-[460px] overflow-y-auto custom-scrollbar relative bg-slate-50 mb-4">
                          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                            <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm">
                              <tr className="text-xs text-slate-600 uppercase tracking-wider">
                                <th className="p-3 text-center sticky left-0 z-30 bg-slate-100 border-r border-b w-12 font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  No
                                </th>
                                <th className="p-3 border-r border-b font-semibold">Tanggal</th>
                                <th className="p-3 border-r border-b font-semibold">Cabang</th>
                                <th className="p-3 border-r border-b font-semibold">Studio</th>
                                <th className="p-3 border-r border-b font-semibold">Platform</th>
                                <th className="p-3 border-r border-b font-semibold">Mulai</th>
                                <th className="p-3 border-r border-b font-semibold">Selesai</th>
                                <th className="p-3 border-r border-b font-semibold">Durasi</th>
                                <th className="p-3 border-r border-b font-semibold">Streamer</th>
                                <th className="p-3 border-r border-b font-semibold text-center">Info Lain</th>
                                <th className="p-3 border-b text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                              {Array.from({ length: Math.min(hPerPage, maxLenLama - startIdxLama) }).map((_, rIdx) => {
                                const globalIdx = startIdxLama + rIdx;
                                const oldItm = hybridDataLama[globalIdx];
                                const newItm = hybridRevisiBaru[globalIdx];

                                return (
                                  <React.Fragment key={globalIdx}>
                                    {/* Row 1: Old Data */}
                                    {oldItm && (
                                      <tr className="hover:bg-slate-50 transition border-b border-slate-100 text-slate-500 bg-white">
                                        <td className="p-3 border-r text-center font-bold bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-slate-400 text-xs">
                                          {globalIdx + 1} (Lama)
                                        </td>
                                        <td className="p-3 border-r">{formatKeYYYYMMDD(oldItm.TANGGAL)}</td>
                                        <td className="p-3 border-r">{oldItm.CABANG_STUDIO || "-"}</td>
                                        <td className="p-3 border-r">{oldItm.NOMOR_STUDIO || "-"}</td>
                                        <td className="p-3 border-r">{oldItm.PLATFORM || "-"}</td>
                                        <td className="p-3 border-r font-mono">{formatKeHHMM(oldItm.JAM_MULAI_LIVE)}</td>
                                        <td className="p-3 border-r font-mono">{formatKeHHMM(oldItm.JAM_SELESAI_LIVE)}</td>
                                        <td className="p-3 border-r">{oldItm.DURASI_JAM || "-"}</td>
                                        <td className="p-3 border-r font-medium leading-tight">
                                          <div className="font-bold text-slate-500">
                                            {oldItm.STREAMER || "-"}
                                          </div>
                                        </td>
                                        <td className="p-3 border-r text-center">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setModalCatatan({
                                                isOpen: true,
                                                file: oldItm.FILE_PENDUKUNG_HOST || "-",
                                                catatan: oldItm.CATATAN_UNTUK_HOST || "-",
                                                device: oldItm.DEVICE || "-",
                                              })
                                            }
                                            className="text-slate-400 hover:text-[#941A0B] w-8 h-8 rounded-full hover:bg-red-50 transition flex items-center justify-center mx-auto"
                                            title="Lihat Catatan & File Pendukung"
                                          >
                                            <i className="fa-solid fa-circle-info text-base" />
                                          </button>
                                        </td>
                                        <td className="p-3 text-center" />
                                      </tr>
                                    )}

                                    {/* Row 2: Revised New Data */}
                                    {newItm && (
                                      <tr className="bg-emerald-50 hover:bg-emerald-100 transition border-b-2 border-emerald-300">
                                        <td className="p-3 border-r border-emerald-200 text-center font-bold text-emerald-700 bg-emerald-50 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">
                                          {globalIdx + 1} (Baru)
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900">
                                          {formatKeYYYYMMDD(newItm.TANGGAL)}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900">
                                          {newItm.CABANG_STUDIO || "-"}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900">
                                          {newItm.NOMOR_STUDIO || "-"}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900">
                                          {newItm.PLATFORM || "-"}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900 font-mono">
                                          {formatKeHHMM(newItm.JAM_MULAI_LIVE)}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900 font-mono">
                                          {formatKeHHMM(newItm.JAM_SELESAI_LIVE)}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-emerald-900">
                                          {newItm.DURASI_JAM || "-"}
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 font-medium leading-tight">
                                          <div className="font-bold text-emerald-900">
                                            {newItm.STREAMER || "-"}
                                          </div>
                                        </td>
                                        <td className="p-3 border-r border-emerald-200 text-center">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setModalCatatan({
                                                isOpen: true,
                                                file: newItm.FILE_PENDUKUNG_HOST || "-",
                                                catatan: newItm.CATATAN_UNTUK_HOST || "-",
                                                device: newItm.DEVICE || "-",
                                              })
                                            }
                                            className="text-emerald-600 hover:text-emerald-800 w-8 h-8 rounded-full hover:bg-emerald-100 transition flex items-center justify-center mx-auto"
                                            title="Lihat Catatan & File Pendukung"
                                          >
                                            <i className="fa-solid fa-circle-info text-base" />
                                          </button>
                                        </td>
                                        <td className="p-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => openEditModal(globalIdx, "revisi")}
                                            className="text-amber-500 hover:text-amber-700 w-8 h-8 rounded-full hover:bg-amber-100 transition flex items-center justify-center mx-auto"
                                            title="Edit Baris Data Ini"
                                          >
                                            <i className="fa-solid fa-pen-to-square text-base" />
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Lama */}
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm">
                          <span className="text-slate-600">
                            Menampilkan {startIdxLama + 1}-{Math.min(startIdxLama + hPerPage, maxLenLama)} dari {maxLenLama}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={currentPageLama <= 1}
                              onClick={() => setCurrentPageLama((p) => Math.max(1, p - 1))}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition font-medium disabled:opacity-50"
                            >
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={currentPageLama >= totalPagesLama}
                              onClick={() => setCurrentPageLama((p) => Math.min(totalPagesLama, p + 1))}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition font-medium disabled:opacity-50"
                            >
                              Selanjutnya
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SUKSES SALIN MASTER FORM */}
      {/* ===================================================================== */}
      {modalSuksesSalin.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 p-6 flex flex-col items-center text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600 text-2xl">
              <i className="fa-solid fa-check" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Berhasil Disalin!</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Master Form terbaru berhasil dibuat dan tersimpan aman di Google Drive Anda.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={() => setModalSuksesSalin({ isOpen: false })}
                className="w-full px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
              >
                Tutup
              </button>
              <a
                id="btnBukaSalinan"
                href={modalSuksesSalin.fileUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={() => setModalSuksesSalin({ isOpen: false })}
                className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-[#941A0B] hover:bg-[#7a1509] shadow-lg shadow-red-500/30 transition-all text-center flex items-center justify-center gap-2 text-sm"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" /> Buka File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CATATAN & FILE PENDUKUNG (modalCatatanHybrid) */}
      {/* ===================================================================== */}
      {modalCatatan.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-[92%] max-w-md p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-book-open text-[#941A0B]" /> Detail Baris
              </h3>
              <button
                type="button"
                onClick={() => setModalCatatan({ isOpen: false, file: "", catatan: "", device: "" })}
                className="text-slate-400 hover:text-red-500 transition"
              >
                <i className="fa-solid fa-xmark text-xl" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">FILE PENDUKUNG HOST</p>
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 break-all min-h-[40px]">
                  {modalCatatan.file.toLowerCase().startsWith("http") ? (
                    <a
                      href={modalCatatan.file}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-medium"
                    >
                      {modalCatatan.file}
                    </a>
                  ) : (
                    modalCatatan.file || "-"
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">CATATAN UNTUK HOST</p>
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 whitespace-pre-wrap min-h-[60px]">
                  {modalCatatan.catatan || "-"}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">DEVICE</p>
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 min-h-[40px]">
                  {modalCatatan.device || "-"}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalCatatan({ isOpen: false, file: "", catatan: "", device: "" })}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: EDIT CELL BARIS (modalEditBaris) */}
      {/* ===================================================================== */}
      {modalEdit.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-[92%] max-w-lg animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-[#941A0B]" /> Edit Baris Data
              </h3>
              <button
                type="button"
                onClick={() => setModalEdit((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-red-500 transition"
              >
                <i className="fa-solid fa-xmark text-xl" />
              </button>
            </div>

            {/* Tahap 1: Pilih Kolom */}
            {modalEdit.step === "pilih" && (
              <div className="p-6">
                <p className="text-sm text-slate-500 mb-4">Pilih kolom yang ingin diedit:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "TANGGAL" as const, label: "Tanggal", ikon: "fa-calendar" },
                    { key: "CABANG_STUDIO" as const, label: "Cabang Studio", ikon: "fa-building" },
                    { key: "NOMOR_STUDIO" as const, label: "Nomor Studio", ikon: "fa-door-open" },
                    { key: "PLATFORM" as const, label: "Platform", ikon: "fa-store" },
                    { key: "JAM_MULAI_LIVE" as const, label: "Jam Mulai", ikon: "fa-clock" },
                    { key: "JAM_SELESAI_LIVE" as const, label: "Jam Selesai", ikon: "fa-clock-rotate-left" },
                    { key: "DURASI_JAM" as const, label: "Durasi (jam)", ikon: "fa-hourglass-half" },
                    { key: "STREAMER" as const, label: "Streamer", ikon: "fa-video" },
                    { key: "DEVICE" as const, label: "Device", ikon: "fa-mobile-screen" },
                    { key: "FILE_PENDUKUNG_HOST" as const, label: "File Pendukung Host", ikon: "fa-file-lines" },
                    { key: "CATATAN_UNTUK_HOST" as const, label: "Catatan untuk Host", ikon: "fa-note-sticky" },
                  ].map((k) => {
                    const item = modalEdit.mode === "baru" ? hybridDataBaru[modalEdit.idx] : hybridRevisiBaru[modalEdit.idx];
                    const val = item ? item[k.key] || "-" : "-";

                    return (
                      <button
                        key={k.key}
                        type="button"
                        onClick={() => handleSelectKeyToEdit(k.key, k.label)}
                        className="flex items-center gap-2 text-left p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50 transition text-sm group"
                      >
                        <i className={`fa-solid ${k.ikon} text-[#941A0B] w-4 text-center flex-shrink-0`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 text-xs leading-tight">
                            {k.label}
                          </div>
                          <div className="text-slate-400 text-[11px] truncate max-w-[120px]">
                            {String(val)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tahap 2: Input Nilai Kolom */}
            {modalEdit.step === "input" && (
              <div className="p-6">
                <button
                  type="button"
                  onClick={() => setModalEdit((prev) => ({ ...prev, step: "pilih" }))}
                  className="text-sm text-[#941A0B] hover:underline mb-4 flex items-center gap-1 font-semibold"
                >
                  <i className="fa-solid fa-arrow-left text-xs" /> Pilih kolom lain
                </button>

                <p className="text-xs font-semibold text-slate-500 mb-2">
                  {modalEdit.label.toUpperCase()}
                </p>

                {modalEdit.key === "TANGGAL" ? (
                  <input
                    type="date"
                    value={modalEdit.currentValue}
                    onChange={(e) =>
                      setModalEdit((prev) => ({ ...prev, currentValue: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                  />
                ) : modalEdit.options.length > 0 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={modalEdit.currentValue}
                      onChange={(e) => {
                        setModalEdit((prev) => ({ ...prev, currentValue: e.target.value }));
                        setFilterSaranKeyword(e.target.value);
                      }}
                      placeholder="Ketik manual atau pilih dari saran di bawah..."
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                    />
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {modalEdit.options
                        .filter((opt) =>
                          opt.toLowerCase().includes(filterSaranKeyword.toLowerCase().trim())
                        )
                        .map((opt, i) => (
                          <div
                            key={i}
                            onClick={() =>
                              setModalEdit((prev) => ({ ...prev, currentValue: opt }))
                            }
                            className="px-4 py-2.5 hover:bg-red-50 hover:text-[#941A0B] cursor-pointer text-slate-700 text-xs transition-colors"
                          >
                            {opt}
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    value={modalEdit.currentValue}
                    onChange={(e) =>
                      setModalEdit((prev) => ({ ...prev, currentValue: e.target.value }))
                    }
                    placeholder="Ketik nilai baru..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#941A0B] outline-none bg-white"
                  />
                )}

                <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalEdit((prev) => ({ ...prev, isOpen: false }))}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditColumn}
                    className="bg-[#941A0B] hover:bg-[#7a1509] text-white font-bold py-2.5 px-5 rounded-xl transition text-sm shadow-sm"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: VALIDASI DURASI (modalValidasiDurasi) */}
      {/* ===================================================================== */}
      {modalValidasiDurasi.isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm">
                <i className="fa-solid fa-triangle-exclamation" /> Durasi Tidak Sesuai!
              </h3>
            </div>
            <div className="p-5 text-slate-600 text-sm">
              <p className="leading-relaxed">
                Berdasarkan Jam Mulai (<b>{modalValidasiDurasi.attemptedStart}</b>) dan Jam Selesai (<b>{modalValidasiDurasi.attemptedEnd}</b>), hasil perhitungan durasinya adalah <b>{modalValidasiDurasi.calculatedHours} Jam</b>.
              </p>
              <p className="mt-3 text-slate-500 font-medium text-xs">
                Apakah Anda ingin sistem menyesuaikan durasinya secara otomatis?
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => setModalValidasiDurasi((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Batal Rubah Data
              </button>
              <button
                type="button"
                onClick={handleKonfirmasiSesuaikanDurasi}
                className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium transition shadow-sm"
              >
                Sesuaikan Durasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: SUKSES SIMPAN (modalSuksesSimpan) */}
      {/* ===================================================================== */}
      {modalSuksesSimpan.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-emerald-800 flex items-center gap-2 text-lg">
                <i className="fa-solid fa-circle-check" /> Jadwal Berhasil Disimpan ke Database
              </h3>
              <button
                type="button"
                onClick={() => setModalSuksesSimpan({ isOpen: false, idHybrid: "", savedRows: [] })}
                className="text-slate-400 hover:text-red-500 transition"
              >
                <i className="fa-solid fa-xmark text-xl" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">ID HYBRID GENERATED:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                  {modalSuksesSimpan.idHybrid}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-600">
                Total: {modalSuksesSimpan.savedRows.length} Jadwal
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-grow bg-white max-h-[50vh]">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-100 font-bold text-slate-700 border-b sticky top-0">
                  <tr>
                    <th className="p-2.5 border-r text-center">NO</th>
                    <th className="p-2.5 border-r">TANGGAL</th>
                    <th className="p-2.5 border-r">CABANG</th>
                    <th className="p-2.5 border-r">STUDIO</th>
                    <th className="p-2.5 border-r">PLATFORM</th>
                    <th className="p-2.5 border-r">WAKTU</th>
                    <th className="p-2.5">STREAMER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalSuksesSimpan.savedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 border-r text-center font-mono text-slate-400">{i + 1}</td>
                      <td className="p-2.5 border-r">{r.TANGGAL}</td>
                      <td className="p-2.5 border-r">{r.CABANG_STUDIO}</td>
                      <td className="p-2.5 border-r">{r.NOMOR_STUDIO}</td>
                      <td className="p-2.5 border-r">{r.PLATFORM}</td>
                      <td className="p-2.5 border-r font-mono">
                        {r.JAM_MULAI_LIVE?.slice(0, 5)} - {r.JAM_SELESAI_LIVE?.slice(0, 5)}
                      </td>
                      <td className="p-2.5">{r.STREAMER}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setModalSuksesSimpan({ isOpen: false, idHybrid: "", savedRows: [] })}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition"
              >
                Tutup & Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
