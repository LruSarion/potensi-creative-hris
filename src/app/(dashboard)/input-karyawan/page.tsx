"use client";

import { useState, useEffect, useRef } from "react";
import { useAlert } from "@/components/ui/custom-alert";
import { formatDateIndo } from "@/lib/utils/date-format";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";

// ─── Daftar Jabatan Baku ─────────────────────────────────────────────────────
const JABATAN_LIST = [
  "Streamer Dedicated",
  "Streamer On-Call",
  "Accounting",
  "Operator Technical Support",
  "Human Resources",
  "Admin Human Resources",
  "Scheduling Coordinator",
  "Trainer",
  "Operational Supervisor",
  "Chief Executive Officer",
  "General Manager",
];

const BANK_LIST = [
  "BCA", "Mandiri", "BRI", "BNI", "BSI", "CIMB Niaga",
  "Danamon", "Permata", "Ocbc NISP", "BTN", "Lainnya",
];

interface FormKaryawan {
  id: number;
  sheetRowIndex?: number;
  isRegistered?: boolean;
  registeredReason?: string;
  namaLengkap: string;
  namaPanggilan: string;
  gender: string;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  nomorTeleponSuffix: string; // after prefix 62
  emergencyContactSuffix: string; // after prefix 62
  email: string;
  statusPerkawinan: string;
  riwayatPenyakit: string;
  jabatan: string;
  kategori: string;
  tipeJadwal: string;
  startDate: string;
  endDate: string;
  statusAktif: string;
  nik: string;
  npwp: string;
  statusPtkp: string;
  alamatKtp: string;
  alamatDomisili: string;
  namaBank: string;
  nomorRekening: string;
  namaPemilikRek: string;
  scanKtp: string | null;
  scanKk: string | null;
  scanNpwp: string | null;
  isExpanded: boolean;
}

interface EditRow {
  field: string;
  value: string;
}

function createDefaultForm(id: number, isExpanded = true): FormKaryawan {
  return {
    id,
    namaLengkap: "",
    namaPanggilan: "",
    gender: "Perempuan",
    tempatLahir: "",
    tanggalLahir: "",
    agama: "Islam",
    nomorTeleponSuffix: "",
    emergencyContactSuffix: "",
    email: "",
    statusPerkawinan: "Belum Kawin",
    riwayatPenyakit: "-",
    jabatan: "",
    kategori: "Host",
    tipeJadwal: "Shift",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    statusAktif: "Aktif",
    nik: "",
    npwp: "",
    statusPtkp: "TK/0",
    alamatKtp: "",
    alamatDomisili: "",
    namaBank: "BCA",
    nomorRekening: "",
    namaPemilikRek: "",
    scanKtp: null,
    scanKk: null,
    scanNpwp: null,
    isExpanded,
  };
}

// --- Normalisasi nilai hasil parse sheet untuk import ---
/** Tanggal dari sheet (dd/mm/yyyy, yyyy-mm-dd, serial Excel) → yyyy-mm-dd. Kosong bila tak valid. */
function normImportDate(val: string): string {
  const s = (val ?? "").trim();
  if (!s) return "";
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const serial = Number(s);
  if (!isNaN(serial) && serial > 20000 && serial < 80000) {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
}

/** Tipe jadwal dari sheet → enum form. */
function normImportTipe(val: string): string {
  const u = (val ?? "").trim().toUpperCase();
  if (!u) return "Shift";
  if (u.includes("OFFICE")) return "Office Hours";
  if (u.includes("LIVE") || u.includes("FLEX")) return "Flexible Hours";
  return "Shift";
}

/** Status aktif dari sheet → enum form. */
function normImportStatus(val: string): string {
  const u = (val ?? "").trim().toUpperCase();
  if (!u) return "Aktif";
  if (u.includes("NON")) return "Non-Aktif";
  if (u.includes("CUTI")) return "Cuti";
  if (u.includes("IZIN")) return "Izin";
  return "Aktif";
}

function populateEditForm(emp: any): FormKaryawan {
  const cleanSuffix = (phone?: string | null) => {
    if (!phone) return "";
    return String(phone).replace(/^62/, "").replace(/^0+/, "");
  };

  const toDateStr = (d?: string | Date | null) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const normGender = (g?: string | null) => {
    if (!g) return "Perempuan";
    const u = String(g).toUpperCase();
    if (u.includes("LAKI")) return "Laki-laki";
    return "Perempuan";
  };

  const normStatus = (s?: string | null) => {
    if (!s) return "Aktif";
    const u = String(s).toUpperCase();
    if (u.includes("NON")) return "Non-Aktif";
    if (u.includes("CUTI")) return "Cuti";
    if (u.includes("IZIN")) return "Izin";
    return "Aktif";
  };

  const normTipe = (t?: string | null) => {
    if (!t) return "Shift";
    const u = String(t).toUpperCase();
    if (u.includes("OFFICE")) return "Office Hours";
    if (u.includes("LIVE") || u.includes("FLEXIBLE")) return "Flexible Hours";
    return "Shift";
  };

  return {
    id: 1,
    namaLengkap: emp.namaLengkap || "",
    namaPanggilan: emp.namaPanggilan || "",
    gender: normGender(emp.gender),
    tempatLahir: emp.tempatLahir || "",
    tanggalLahir: toDateStr(emp.tanggalLahir),
    agama: emp.agama || "Islam",
    nomorTeleponSuffix: cleanSuffix(emp.nomorTelepon),
    emergencyContactSuffix: cleanSuffix(emp.emergencyContact),
    email: emp.email || "",
    statusPerkawinan: emp.statusPerkawinan || "Belum Kawin",
    riwayatPenyakit: emp.riwayatPenyakit || "-",
    jabatan: emp.jabatan || "",
    kategori: emp.kategori || "Host",
    tipeJadwal: normTipe(emp.tipeJadwal),
    startDate: toDateStr(emp.startDate) || new Date().toISOString().split("T")[0],
    endDate: toDateStr(emp.endDate),
    statusAktif: normStatus(emp.statusAktif),
    nik: emp.nik || "",
    npwp: emp.npwp || "",
    statusPtkp: emp.statusPtkp || "TK/0",
    alamatKtp: emp.alamatKtp || "",
    alamatDomisili: emp.alamatDomisili || "",
    namaBank: emp.namaBank || "BCA",
    nomorRekening: emp.nomorRekening || "",
    namaPemilikRek: emp.namaPemilikRek || emp.namaLengkap || "",
    scanKtp: emp.scanKtpDriveId || null,
    scanKk: emp.scanKkDriveId || null,
    scanNpwp: emp.scanNpwpDriveId || null,
    isExpanded: true,
  };
}

function getEmployeeFieldValue(emp: any, fieldKey: string): string {
  if (!emp) return "";
  const cleanPhone = (v?: string | null) => (v ? String(v).replace(/^62/, "").replace(/^0+/, "") : "");
  const toDateStr = (d?: any) => {
    if (!d) return "";
    try {
      return new Date(d).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  switch (fieldKey) {
    case "NAMA_LENGKAP": return emp.namaLengkap || "";
    case "NAMA_PANGGILAN": return emp.namaPanggilan || "";
    case "GENDER": return emp.gender === "LAKI_LAKI" ? "Laki-laki" : "Perempuan";
    case "TEMPAT_LAHIR": return emp.tempatLahir || "";
    case "TANGGAL_LAHIR": return toDateStr(emp.tanggalLahir);
    case "AGAMA": return emp.agama || "Islam";
    case "STATUS_PERKAWINAN": return emp.statusPerkawinan || "Belum Kawin";
    case "RIWAYAT_PENYAKIT": return emp.riwayatPenyakit || "-";
    case "NOMOR_TELEPON": return cleanPhone(emp.nomorTelepon);
    case "EMERGENCY_CONTACT": return cleanPhone(emp.emergencyContact);
    case "EMAIL": return emp.email || "";
    case "JABATAN": return emp.jabatan || "";
    case "KATEGORI": return emp.kategori || "Host";
    case "TIPE_JADWAL": return emp.tipeJadwal === "OFFICE_HOURS" ? "Office Hours" : emp.tipeJadwal === "LIVE" ? "Flexible Hours" : "Shift";
    case "START_DATE": return toDateStr(emp.startDate);
    case "END_DATE": return toDateStr(emp.endDate);
    case "STATUS_AKTIF": return emp.statusAktif === "NON_AKTIF" ? "Non-Aktif" : emp.statusAktif === "CUTI" ? "Cuti" : emp.statusAktif === "IZIN" ? "Izin" : "Aktif";
    case "NIK": return emp.nik || "";
    case "NPWP": return emp.npwp || "";
    case "STATUS_PTKP": return emp.statusPtkp || "TK/0";
    case "ALAMAT_KTP": return emp.alamatKtp || "";
    case "ALAMAT_DOMISILI": return emp.alamatDomisili || "";
    case "NAMA_BANK": return emp.namaBank || "BCA";
    case "NOMOR_REKENING": return emp.nomorRekening || "";
    case "NAMA_PEMILIK_REKENING": return emp.namaPemilikRek || emp.namaLengkap || "";
    default: return "";
  }
}

export default function InputKaryawanPage() {
  const { showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<"input" | "edit" | "direktori" | "import">("input");

  // Multi-Form Input Kolektif State
  const [forms, setForms] = useState<FormKaryawan[]>([createDefaultForm(1, true)]);
  const [submitting, setSubmitting] = useState(false);

  // Perubahan Data (Edit) State
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [searchEditId, setSearchEditId] = useState("");
  const [targetEmployee, setTargetEmployee] = useState<any | null>(null);
  const [editSubTab, setEditSubTab] = useState<"full" | "quick">("full");
  const [fullEditForm, setFullEditForm] = useState<FormKaryawan>(createDefaultForm(1, true));
  const [editRows, setEditRows] = useState<EditRow[]>([{ field: "", value: "" }]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [showDeleteEmployeeModal, setShowDeleteEmployeeModal] = useState(false);

  // PIN Change Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<any | null>(null);
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  // Direktori search
  const [dirSearch, setDirSearch] = useState("");

  // Import Sheets / Excel State
  const [importSource, setImportSource] = useState<"file" | "sheet">("sheet");
  const [importSheetUrl, setImportSheetUrl] = useState("");
  const [importLastSheetUrl, setImportLastSheetUrl] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importRows, setImportRows] = useState<FormKaryawan[]>([]);
  const [importRawHeaders, setImportRawHeaders] = useState<string[]>([]);
  const [importRawPreview, setImportRawPreview] = useState<any[]>([]);
  const [importRawCount, setImportRawCount] = useState(0);
  const [importMatchedHeaders, setImportMatchedHeaders] = useState<string[]>([]);
  const [importDupSkipped, setImportDupSkipped] = useState(0);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadAllEmployees();
  }, []);

  async function loadAllEmployees() {
    try {
      const data = await fetchJson<any>("/api/employees");
      if (Array.isArray(data)) {
        setEmployeeList(data);
      }
    } catch {
      // ignore
    }
  }

  // Add new form (up to 10)
  function handleAddForm() {
    if (forms.length >= 10) {
      toast.warning("Maksimal 10 data karyawan dalam satu kali proses upload.");
      return;
    }
    const updated = forms.map((f) => ({ ...f, isExpanded: false }));
    const newId = forms.length > 0 ? Math.max(...forms.map((f) => f.id)) + 1 : 1;
    setForms([...updated, createDefaultForm(newId, true)]);
  }

  async function handleRemoveForm(id: number) {
    if (forms.length <= 1) {
      toast.warning("Minimal harus ada 1 form untuk diisi.");
      return;
    }
    const confirmed = await showConfirm(`Hapus formulir data #${id}?`);
    if (confirmed) {
      setForms(forms.filter((f) => f.id !== id));
    }
  }

  function handleToggleAccordion(id: number) {
    setForms(
      forms.map((f) => {
        if (f.id === id) return { ...f, isExpanded: !f.isExpanded };
        return { ...f, isExpanded: false };
      })
    );
  }

  function updateFormField(id: number, field: keyof FormKaryawan, value: any) {
    setForms(forms.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }

  function handleFileUpload(id: number, field: "scanKtp" | "scanKk" | "scanNpwp", file: File | null) {
    if (!file) { updateFormField(id, field, null); return; }
    if (file.size > 5 * 1024 * 1024) { toast.warning("Ukuran file maksimal 5MB."); return; }
    const reader = new FileReader();
    reader.onload = () => updateFormField(id, field, reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmitMultiForm(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validations
    for (const f of forms) {
      if (!f.namaLengkap.trim() || f.namaLengkap.trim().length < 2) {
        toast.warning(`Mohon isi Nama Lengkap (minimal 2 karakter) pada Formulir #${f.id}`);
        return;
      }
      if (!f.nomorTeleponSuffix.trim()) {
        toast.warning(`Mohon isi Nomor WhatsApp pada Formulir #${f.id}`);
        return;
      }
      if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
        toast.warning(`Format email tidak valid pada Formulir #${f.id} (Contoh: nama@domain.com)`);
        return;
      }
      if (!f.jabatan) {
        toast.warning(`Mohon pilih Jabatan pada Formulir #${f.id}`);
        return;
      }
      if (!f.startDate) {
        toast.warning(`Mohon tentukan Start Date (Tanggal Mulai) pada Formulir #${f.id}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const items = forms.map((f) => ({
        namaLengkap: f.namaLengkap.trim(),
        namaPanggilan: f.namaPanggilan.trim() || undefined,
        gender: f.gender,
        tempatLahir: f.tempatLahir.trim() || undefined,
        tanggalLahir: f.tanggalLahir || undefined,
        agama: f.agama || undefined,
        nomorTelepon: f.nomorTeleponSuffix ? `62${f.nomorTeleponSuffix.replace(/^62/, "").replace(/^0+/, "")}` : undefined,
        emergencyContact: f.emergencyContactSuffix ? `62${f.emergencyContactSuffix.replace(/^62/, "").replace(/^0+/, "")}` : undefined,
        email: f.email.trim(),
        statusPerkawinan: f.statusPerkawinan || undefined,
        riwayatPenyakit: f.riwayatPenyakit.trim() || undefined,
        jabatan: f.jabatan,
        kategori: f.kategori,
        tipeJadwal: f.tipeJadwal,
        startDate: f.startDate || undefined,
        endDate: f.endDate || undefined,
        statusAktif: f.statusAktif,
        nik: f.nik.trim() || undefined,
        npwp: f.npwp.trim() || undefined,
        statusPtkp: f.statusPtkp || undefined,
        alamatKtp: f.alamatKtp.trim() || undefined,
        alamatDomisili: f.alamatDomisili.trim() || undefined,
        namaBank: f.namaBank || undefined,
        nomorRekening: f.nomorRekening.trim() || undefined,
        namaPemilikRek: f.namaPemilikRek.trim() || undefined,
        scanKtpDriveId: f.scanKtp || undefined,
        scanKkDriveId: f.scanKk || undefined,
        scanNpwpDriveId: f.scanNpwp || undefined,
      }));

      await sendJson("/api/employees?action=bulk", "POST", { items });
      toast.success(`Berhasil menyimpan ${forms.length} data karyawan baru ke sistem!`);
      setForms([createDefaultForm(1, true)]);
      loadAllEmployees();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menyimpan data karyawan"));
    } finally {
      setSubmitting(false);
    }
  }

  function findExactEmployee(query: string, list: any[]) {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();

    // 1. Check exact ID (e.g. "pcs001")
    let target = list.find((e) => (e.idKaryawan || "").toLowerCase() === q || (e.id || "").toLowerCase() === q);
    if (target) return target;

    // 2. Check exact full formatted tag (e.g. "pcs001 - siti nurhaliza (host)")
    target = list.find((e) => {
      const fullTag = `${e.idKaryawan} - ${e.namaLengkap} (${e.jabatan})`.toLowerCase();
      const shortTag = `${e.idKaryawan} - ${e.namaLengkap}`.toLowerCase();
      return fullTag === q || shortTag === q;
    });
    if (target) return target;

    // 3. Check exact full name
    target = list.find((e) => (e.namaLengkap || "").toLowerCase() === q);
    if (target) return target;

    return null;
  }

  function findMatchingEmployee(query: string, list: any[]) {
    if (!query || !query.trim()) return null;
    const raw = query.trim();
    const q = raw.toLowerCase();

    // 1. Try exact match first
    const exact = findExactEmployee(raw, list);
    if (exact) return exact;

    // 2. Check direct ID in brackets [ID:...]
    const idTagMatch = raw.match(/\[ID:([^\]]+)\]/i);
    const extractedId = idTagMatch ? idTagMatch[1].trim().toLowerCase() : "";
    if (extractedId) {
      const byExtracted = list.find((e) => (e.id || "").toLowerCase() === extractedId || (e.idKaryawan || "").toLowerCase() === extractedId);
      if (byExtracted) return byExtracted;
    }

    // 3. Check if starts with ID: "PCS001 - ..."
    const idPrefixMatch = raw.match(/^([A-Za-z0-9_-]+)\s*[-–|:]/);
    const prefixId = idPrefixMatch ? idPrefixMatch[1].trim().toLowerCase() : "";
    if (prefixId) {
      const byPrefix = list.find((e) => (e.id || "").toLowerCase() === prefixId || (e.idKaryawan || "").toLowerCase() === prefixId);
      if (byPrefix) return byPrefix;
    }

    // 4. Prefix name or ID match (minimum 2 chars)
    if (q.length >= 2) {
      const target = list.find((e) => {
        const eIdK = (e.idKaryawan || "").toLowerCase();
        const eName = (e.namaLengkap || "").toLowerCase();
        return eIdK === q || eName.startsWith(q) || eName === q;
      });
      if (target) return target;
    }

    return null;
  }

  function handleSelectTargetEmployee(customEmp?: any, customQuery?: string) {
    let target: any | null = customEmp || null;
    const queryStr = customQuery !== undefined ? customQuery : searchEditId;

    if (!target && queryStr && queryStr.trim()) {
      target = findMatchingEmployee(queryStr, employeeList);
    }

    if (target) {
      setTargetEmployee(target);
      setSearchEditId(`${target.idKaryawan} - ${target.namaLengkap}`);
      setFullEditForm(populateEditForm(target));
      setEditRows([{ field: "NAMA_LENGKAP", value: target.namaLengkap || "" }]);
      setShowEmployeeDropdown(false);

      fetch(`/api/employees?id=${target.id}`)
        .then((r) => r.json())
        .then((fresh) => {
          const empData = fresh?.data || fresh;
          if (empData && (empData.id || empData.idKaryawan)) {
            setTargetEmployee(empData);
            setFullEditForm(populateEditForm(empData));
          }
        })
        .catch(() => {});
    } else if (customQuery === undefined && !customEmp) {
      toast.warning("Karyawan dengan ID atau Nama tersebut tidak ditemukan.");
    }
  }

  function updateFullEditField(field: keyof FormKaryawan, value: any) {
    setFullEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFileUploadFullEdit(
    fieldName: "scanKtp" | "scanKk" | "scanNpwp",
    file: File | null
  ) {
    if (!file) {
      updateFullEditField(fieldName, null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Ukuran file maksimal 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      updateFullEditField(fieldName, e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitFullEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmployee) return;

    if (!fullEditForm.namaLengkap.trim() || fullEditForm.namaLengkap.trim().length < 2) {
      toast.warning("Mohon isi Nama Lengkap Karyawan (minimal 2 karakter).");
      return;
    }
    if (!fullEditForm.nomorTeleponSuffix.trim()) {
      toast.warning("Mohon isi Nomor WhatsApp.");
      return;
    }
    if (fullEditForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fullEditForm.email.trim())) {
      toast.warning("Format email tidak valid.");
      return;
    }

    const cleanPhone = (s: string) => (s ? `62${s.replace(/^62/, "").replace(/^0+/, "")}` : null);

    const payload = {
      namaLengkap: fullEditForm.namaLengkap.trim(),
      namaPanggilan: fullEditForm.namaPanggilan.trim() || null,
      gender: fullEditForm.gender,
      tempatLahir: fullEditForm.tempatLahir.trim() || null,
      tanggalLahir: fullEditForm.tanggalLahir || null,
      agama: fullEditForm.agama,
      nomorTelepon: cleanPhone(fullEditForm.nomorTeleponSuffix),
      emergencyContact: cleanPhone(fullEditForm.emergencyContactSuffix),
      email: fullEditForm.email.trim() || null,
      statusPerkawinan: fullEditForm.statusPerkawinan,
      riwayatPenyakit: fullEditForm.riwayatPenyakit.trim() || "-",
      jabatan: fullEditForm.jabatan || "Staff",
      kategori: fullEditForm.kategori || "Host",
      tipeJadwal: fullEditForm.tipeJadwal,
      startDate: fullEditForm.startDate || null,
      endDate: fullEditForm.endDate || null,
      statusAktif: fullEditForm.statusAktif,
      nik: fullEditForm.nik.trim() || null,
      npwp: fullEditForm.npwp.trim() || null,
      statusPtkp: fullEditForm.statusPtkp,
      alamatKtp: fullEditForm.alamatKtp.trim() || null,
      alamatDomisili: fullEditForm.alamatDomisili.trim() || null,
      namaBank: fullEditForm.namaBank,
      nomorRekening: fullEditForm.nomorRekening.trim() || null,
      namaPemilikRek: fullEditForm.namaPemilikRek.trim() || null,
      scanKtpDriveId: fullEditForm.scanKtp,
      scanKkDriveId: fullEditForm.scanKk,
      scanNpwpDriveId: fullEditForm.scanNpwp,
    };

    setSavingEdit(true);
    try {
      await sendJson(`/api/employees?id=${targetEmployee.id}`, "PATCH", payload);
      toast.success(`Data karyawan ${fullEditForm.namaLengkap} berhasil diperbarui secara lengkap!`);
      await loadAllEmployees();
      const updatedTarget = { ...targetEmployee, ...payload };
      setTargetEmployee(updatedTarget);
      setFullEditForm(populateEditForm(updatedTarget));
    } catch (err) {
      toast.error(errorMessage(err, "Gagal memperbarui data karyawan"));
    } finally {
      setSavingEdit(false);
    }
  }

  function handleAddEditRow() {
    setEditRows([...editRows, { field: "", value: "" }]);
  }

  function handleRemoveEditRow(idx: number) {
    if (editRows.length <= 1) return;
    setEditRows(editRows.filter((_, i) => i !== idx));
  }

  function handleUpdateEditRow(idx: number, field: string, customValue?: string) {
    const updated = [...editRows];
    const value = customValue !== undefined ? customValue : getEmployeeFieldValue(targetEmployee, field);
    updated[idx] = { field, value };
    setEditRows(updated);
  }

  async function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmployee) return;

    const payload: Record<string, any> = {};
    for (const r of editRows) {
      if (!r.field) continue;
      const keyMap: Record<string, string> = {
        NAMA_LENGKAP: "namaLengkap",
        NAMA_PANGGILAN: "namaPanggilan",
        GENDER: "gender",
        TEMPAT_LAHIR: "tempatLahir",
        TANGGAL_LAHIR: "tanggalLahir",
        AGAMA: "agama",
        STATUS_PERKAWINAN: "statusPerkawinan",
        RIWAYAT_PENYAKIT: "riwayatPenyakit",
        NOMOR_TELEPON: "nomorTelepon",
        EMERGENCY_CONTACT: "emergencyContact",
        EMAIL: "email",
        JABATAN: "jabatan",
        KATEGORI: "kategori",
        TIPE_JADWAL: "tipeJadwal",
        START_DATE: "startDate",
        END_DATE: "endDate",
        STATUS_AKTIF: "statusAktif",
        NIK: "nik",
        NPWP: "npwp",
        STATUS_PTKP: "statusPtkp",
        ALAMAT_KTP: "alamatKtp",
        ALAMAT_DOMISILI: "alamatDomisili",
        NAMA_BANK: "namaBank",
        NOMOR_REKENING: "nomorRekening",
        NAMA_PEMILIK_REKENING: "namaPemilikRek",
      };
      const mappedKey = keyMap[r.field] || r.field;
      payload[mappedKey] = r.value;
    }

    setSavingEdit(true);
    try {
      await sendJson(`/api/employees?id=${targetEmployee.id}`, "PATCH", payload);
      toast.success("Data karyawan berhasil diperbarui!");
      setTargetEmployee(null);
      setSearchEditId("");
      setEditRows([{ field: "", value: "" }]);
      loadAllEmployees();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal memperbarui data"));
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeleteEmployee() {
    if (!targetEmployee || !targetEmployee.id) return;
    setShowDeleteEmployeeModal(true);
  }

  async function executeConfirmDeleteEmployee() {
    if (!targetEmployee || !targetEmployee.id) return;
    setDeletingEmployee(true);
    try {
      await sendJson(`/api/employees?id=${targetEmployee.id}&permanent=true`, "DELETE");
      toast.success(`Karyawan ${targetEmployee.namaLengkap} (${targetEmployee.idKaryawan}) berhasil dihapus permanen dari database!`);
      setShowDeleteEmployeeModal(false);
      setTargetEmployee(null);
      setSearchEditId("");
      await loadAllEmployees();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menghapus karyawan"));
    } finally {
      setDeletingEmployee(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinTarget) return;
    if (pinNew !== pinConfirm) { toast.warning("PIN baru dan konfirmasi PIN tidak cocok."); return; }
    if (pinNew.length < 4) { toast.warning("PIN minimal 4 digit."); return; }

    setSavingPin(true);
    try {
      await sendJson("/api/auth/pin", "PUT", {
        currentPin: pinOld || undefined,
        newPin: pinNew,
        targetEmail: pinTarget.email,
        targetUserId: pinTarget.userId || pinTarget.id,
      });
      toast.success(`PIN Login untuk ${pinTarget.namaLengkap} berhasil diperbarui!`);
      setShowPinModal(false);
      setPinOld(""); setPinNew(""); setPinConfirm(""); setPinTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengubah PIN."));
    } finally {
      setSavingPin(false);
    }
  }

  // --- Import Google Sheets / Excel Handlers ---
  function handleResetImport() {
    setImportRows([]);
    setImportRawHeaders([]);
    setImportRawPreview([]);
    setImportRawCount(0);
    setImportMatchedHeaders([]);
    setImportDupSkipped(0);
  }

  function processImportedData(data: any) {
    const rawRows: Record<string, string>[] = data.rows || [];
    const headers: string[] = data.headers || [];
    // Simpan data mentah + ringkasan DULU — panel hasil dirender berdasarkan
    // rawRows, bukan importRows, supaya preview tetap muncul walau 0 baris
    // valid (semua duplikat / kolom tidak dikenali).
    setImportRawHeaders(headers);
    setImportRawPreview(rawRows.slice(0, 5).map((r) => headers.map((h) => r[h] || "")));
    setImportRawCount(rawRows.length);

    // Normalisasi nama kolom: lowercase + buang titik/underscore/hyphen/spasi.
    // "No. Telepon" = "notelepon", "No_Hp" = "nohp" — pencocokan alias jadi robust.
    const normKey = (k: string) =>
      k.trim().toLowerCase().replace(/[.\-_/]/g, "").replace(/\s+/g, "");

    // Definisi field DB -> daftar alias header sheet. Kolom dideteksi SEKALI
    // dari header (bukan per baris) — nama header sheets beda dari nama field
    // database, contoh: "Nomor Telepon" (sheet) = "Nomor WA" (DB) = field nomorTelepon.
    const FIELD_ALIASES: Record<string, string[]> = {
      namaLengkap: ["namalengkap", "nama", "fullname", "name", "namapegawai", "namakaryawan"],
      namaPanggilan: ["namapanggilan", "panggilan", "nickname"],
      gender: ["gender", "jeniskelamin", "sex"],
      tempatLahir: ["tempatlahir", "kotalahir"],
      tanggalLahir: ["tanggallahir", "tgllahir", "birthdate", "dateofbirth", "ttl"],
      agama: ["agama", "religion"],
      nomorTelepon: ["nomorwa", "nowa", "nomorwhatsapp", "whatsapp", "wa",
        "nomortelepon", "notelepon", "telepon", "telpon", "nomortelp", "notelp",
        "nohp", "nomorhp", "hp", "handphone", "nomorhandphone",
        "phone", "mobile", "nomorseluler", "noseluler"],
      emergencyContact: ["emergencycontact", "kontakdarurat", "nomordarurat", "nomorkontakdarurat"],
      email: ["email", "emailaddress", "surel"],
      statusPerkawinan: ["statusperkawinan", "statusnikah", "maritalstatus", "statuskawin"],
      riwayatPenyakit: ["riwayatpenyakit", "penyakit"],
      jabatan: ["jabatan", "posisi", "position", "jobtitle", "role", "pekerjaan"],
      kategori: ["kategori", "category", "tipekaryawan"],
      tipeJadwal: ["tipejadwal", "tipeschedule", "jadwal"],
      startDate: ["startdate", "tanggalmulai", "tglmulai", "joindate", "tanggalmulakerja", "tanggalmasuk", "tanggabergabung"],
      endDate: ["enddate", "tanggalselesai", "tglselesai", "contractend"],
      statusAktif: ["statusaktif", "statuskepegawaian", "status", "active"],
      nik: ["nik", "nikktp", "noktp", "nomorktp", "nomorindukkependudukan"],
      npwp: ["npwp", "nonpwp", "nomornpwp"],
      statusPtkp: ["statusptkp", "ptkp"],
      alamatKtp: ["alamatktp", "alamatsesuaiktp", "alamatktpktp"],
      alamatDomisili: ["alamatdomisili", "domisili", "alamatdomisiliktp", "alamattinggal"],
      namaBank: ["namabank", "bank"],
      nomorRekening: ["nomorrekening", "norekening", "norek", "rek", "accountnumber", "norekeningbank"],
      namaPemilikRek: ["namapemilikrekening", "namapemilikrek", "pemilikrekening", "atasnama", "accountholder"],
      scanKtp: ["scanktp", "linkktp", "linkscanktp", "fotoktp", "ktpdrive", "linkfotoktp", "dokumenktp"],
      scanKk: ["scankk", "linkkk", "linkscankk", "fotokk", "kkdrive", "linkfotokk", "dokumenkk"],
      scanNpwp: ["scannpwp", "linknpwp", "linkscannpwp", "fotonpwp", "npwpdrive", "linkfotonpwp", "dokumennpwp"],
    };

    // Deteksi kolom: pass 1 exact match, pass 2 includes (header mengandung alias).
    // Alias terlalu pendek/umum (hp, wa, rek, ktp, dsb.) hanya boleh exact match —
    // includes "ktp" akan salah tangkap "Scan KTP" milik field lain.
    const INCLUDE_BLOCKLIST = new Set([
      "hp", "wa", "rek", "status", "nama", "role", "bank", "phone", "mail",
      "email", "ktp", "kk", "npwp", "ttl", "sex",
    ]);
    const headerToField = new Map<string, string>();
    const matchedOriginal: string[] = [];
    const normalized = headers.map((h) => ({ original: h, norm: normKey(h) }));
    const takeHeader = (field: string, alias: string): string | undefined => {
      const found = normalized.find((h) => h.norm !== "" && h.norm === alias && !headerToField.has(h.original));
      if (found) {
        headerToField.set(found.original, field);
        matchedOriginal.push(found.original);
        return found.original;
      }
      return undefined;
    };
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      // Pass 1: exact
      let done = aliases.some((a) => takeHeader(field, a));
      // Pass 2: includes — hanya alias cukup spesifik
      if (!done) {
        done = aliases.some((a) => {
          if (a.length < 4 || INCLUDE_BLOCKLIST.has(a)) return false;
          const found = normalized.find(
            (h) => h.norm !== "" && h.norm.includes(a) && !headerToField.has(h.original)
          );
          if (found) {
            headerToField.set(found.original, field);
            matchedOriginal.push(found.original);
            return true;
          }
          return false;
        });
      }
    }

    const pick = (field: string, row: Record<string, string>): string => {
      for (const [h, f] of headerToField.entries()) {
        if (f !== field) continue;
        const v = row[h];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };

    // Dedupe: no HP ATAU email sudah ada di DB / di file sebelumnya → skip.
    const normSuffix = (p: string) => p.replace(/\D/g, "").replace(/^62/, "").replace(/^0+/, "");
    const existingPhones = new Set(
      employeeList.map((e) => normSuffix(e.nomorTelepon || "")).filter(Boolean)
    );
    const existingEmails = new Set(
      employeeList.map((e) => String(e.email || "").trim().toLowerCase()).filter(Boolean)
    );
    const seenPhonesInFile = new Set<string>();
    const seenEmailsInFile = new Set<string>();

    let dupCount = 0;
    const parsedForms: FormKaryawan[] = [];

    rawRows.forEach((r, idx) => {
      const nama = pick("namaLengkap", r);
      if (!nama) return;

      const phoneSuffix = normSuffix(pick("nomorTelepon", r));
      const emergencySuffix = normSuffix(pick("emergencyContact", r));
      const email = pick("email", r).toLowerCase().trim();

      // Duplikat: no HP ATAU email sama dengan yang sudah terdaftar di DB atau di file
      let isRegistered = false;
      let registeredReason = "";

      if (phoneSuffix && existingPhones.has(phoneSuffix)) {
        isRegistered = true;
        registeredReason = "No. Telepon / WA sudah terdaftar di sistem";
      } else if (email && existingEmails.has(email)) {
        isRegistered = true;
        registeredReason = "Email sudah terdaftar di sistem";
      } else if (phoneSuffix && seenPhonesInFile.has(phoneSuffix)) {
        isRegistered = true;
        registeredReason = "Duplikat No. Telepon / WA di file sheet ini";
      } else if (email && seenEmailsInFile.has(email)) {
        isRegistered = true;
        registeredReason = "Duplikat Email di file sheet ini";
      }

      if (isRegistered) {
        dupCount++;
      } else {
        if (phoneSuffix) seenPhonesInFile.add(phoneSuffix);
        if (email) seenEmailsInFile.add(email);
      }

      const genderRaw = pick("gender", r).toLowerCase();
      const gender = genderRaw.includes("l") || genderRaw.includes("pria") || genderRaw.includes("laki") ? "Laki-laki" : "Perempuan";

      const nik = pick("nik", r);
      const npwp = pick("npwp", r);

      parsedForms.push({
        id: idx + 1,
        sheetRowIndex: idx + 2, // Baris 1 adalah header, data mulai baris 2
        isRegistered,
        registeredReason,
        namaLengkap: nama,
        namaPanggilan: pick("namaPanggilan", r),
        gender,
        tempatLahir: pick("tempatLahir", r),
        tanggalLahir: normImportDate(pick("tanggalLahir", r)),
        agama: pick("agama", r) || "Islam",
        nomorTeleponSuffix: phoneSuffix,
        emergencyContactSuffix: emergencySuffix,
        email: email || `${nama.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        statusPerkawinan: pick("statusPerkawinan", r) || "Belum Kawin",
        riwayatPenyakit: pick("riwayatPenyakit", r) || "-",
        jabatan: pick("jabatan", r) || "Staff",
        kategori: pick("kategori", r) || "Host",
        tipeJadwal: normImportTipe(pick("tipeJadwal", r)),
        startDate: normImportDate(pick("startDate", r)) || new Date().toISOString().split("T")[0],
        endDate: normImportDate(pick("endDate", r)),
        statusAktif: normImportStatus(pick("statusAktif", r)),
        nik,
        npwp,
        statusPtkp: pick("statusPtkp", r) || "TK/0",
        alamatKtp: pick("alamatKtp", r),
        alamatDomisili: pick("alamatDomisili", r) || pick("alamatKtp", r),
        namaBank: pick("namaBank", r) || "BCA",
        nomorRekening: pick("nomorRekening", r),
        namaPemilikRek: pick("namaPemilikRek", r) || nama,
        // Scan dokumen disimpan sebagai LINK di sheet → simpan string (Drive ID/link).
        scanKtp: pick("scanKtp", r) || null,
        scanKk: pick("scanKk", r) || null,
        scanNpwp: pick("scanNpwp", r) || null,
        isExpanded: idx === 0,
      });
    });

    setImportMatchedHeaders(matchedOriginal);
    setImportDupSkipped(dupCount);
    setImportRows(parsedForms);
  }

  async function handleImportSheetUrl(customUrl?: string) {
    const url = customUrl || importSheetUrl;
    if (!url.trim()) {
      toast.warning("Masukkan URL Google Sheets terlebih dahulu.");
      return;
    }
    setImportBusy(true);
    try {
      const data = await sendJson<any>("/api/migration", "POST", {
        action: "preview",
        googleSheetUrl: url.trim(),
      });
      setImportLastSheetUrl(url.trim());
      processImportedData(data);
      toast.success(`Berhasil membaca data dari Google Sheets! Terdeteksi ${data.rows?.length || 0} baris.`);
    } catch (err) {
      toast.error(errorMessage(err, "Gagal membaca Google Sheets"));
    } finally {
      setImportBusy(false);
    }
  }

  function handleImportFile(file?: File) {
    if (!file) return;
    setImportFileName(file.name);
    setImportBusy(true);

    const reader = new FileReader();
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    reader.onload = async () => {
      try {
        let payload: any;
        if (isExcel) {
          const base64 = (reader.result as string).split(",")[1];
          payload = { action: "preview", fileContent: base64, fileName: file.name };
        } else {
          payload = { action: "preview", fileContent: reader.result as string, fileName: file.name };
        }
        const data = await sendJson<any>("/api/migration", "POST", payload);
        processImportedData(data);
        toast.success(`Berhasil membaca file ${file.name}! Terdeteksi ${data.rows?.length || 0} baris.`);
      } catch (err) {
        toast.error(errorMessage(err, "Gagal membaca file"));
      } finally {
        setImportBusy(false);
      }
    };

    if (isExcel) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  // TODO(import-kolektif): tombol "Kirim ke Input Kolektif" + handlePushImportToForms
  // dihapus — simpan langsung lewat handleSaveImportRows (bulk API).
  // Blok asli: slice(0,10) → setForms(reindexed) → setActiveTab("input").

  function handleDeleteImportRow(index: number) {
    setImportRows((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1)[0];
      toast.success(`Baris ${removed?.namaLengkap ? `"${removed.namaLengkap}"` : `#${index + 1}`} dihapus dari pratinjau`);
      return updated;
    });
  }

  function handleClearRegisteredRows() {
    setImportRows((prev) => {
      const filtered = prev.filter((r) => !r.isRegistered);
      const count = prev.length - filtered.length;
      toast.success(`${count} baris yang sudah terdaftar berhasil dibersihkan dari pratinjau`);
      return filtered;
    });
  }

  async function handleSaveImportRows() {
    const validRows = importRows.filter((f) => !f.isRegistered);
    if (!validRows.length) {
      toast.warning("Tidak ada baris baru yang valid untuk disimpan.");
      return;
    }
    setImportSaving(true);
    try {
      const items = validRows.map((f) => ({
        namaLengkap: f.namaLengkap.trim(),
        namaPanggilan: f.namaPanggilan.trim() || undefined,
        gender: f.gender,
        tempatLahir: f.tempatLahir.trim() || undefined,
        tanggalLahir: f.tanggalLahir || undefined,
        agama: f.agama || undefined,
        nomorTelepon: f.nomorTeleponSuffix ? `62${f.nomorTeleponSuffix.replace(/^62/, "").replace(/^0+/, "")}` : undefined,
        emergencyContact: f.emergencyContactSuffix ? `62${f.emergencyContactSuffix.replace(/^62/, "").replace(/^0+/, "")}` : undefined,
        email: f.email.trim() || undefined,
        statusPerkawinan: f.statusPerkawinan || undefined,
        riwayatPenyakit: f.riwayatPenyakit.trim() || undefined,
        jabatan: f.jabatan,
        kategori: f.kategori,
        tipeJadwal: f.tipeJadwal,
        startDate: f.startDate || undefined,
        endDate: f.endDate || undefined,
        statusAktif: f.statusAktif,
        nik: f.nik.trim() || undefined,
        npwp: f.npwp.trim() || undefined,
        statusPtkp: f.statusPtkp || undefined,
        alamatKtp: f.alamatKtp.trim() || undefined,
        alamatDomisili: f.alamatDomisili.trim() || undefined,
        namaBank: f.namaBank || undefined,
        nomorRekening: f.nomorRekening.trim() || undefined,
        namaPemilikRek: f.namaPemilikRek.trim() || undefined,
        scanKtpDriveId: f.scanKtp || undefined,
        scanKkDriveId: f.scanKk || undefined,
        scanNpwpDriveId: f.scanNpwp || undefined,
      }));

      await sendJson("/api/employees?action=bulk", "POST", { items });
      toast.success(`Berhasil mengimpor ${items.length} karyawan ke direktori!`);
      handleResetImport();
      await loadAllEmployees();
      setActiveTab("direktori");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengimpor karyawan"));
    } finally {
      setImportSaving(false);
    }
  }

  // Employee detail modal
  const [detailEmployee, setDetailEmployee] = useState<any | null>(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const filteredDirektori = employeeList.filter((e) =>
    !dirSearch ||
    (e.namaLengkap ?? "").toLowerCase().includes(dirSearch.toLowerCase()) ||
    (e.idKaryawan ?? "").toLowerCase().includes(dirSearch.toLowerCase()) ||
    (e.jabatan ?? "").toLowerCase().includes(dirSearch.toLowerCase())
  );

  // Input field helpers
  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-black focus:ring-2 focus:ring-[#941A0B] outline-none bg-white transition";
  const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5";
  const selectCls = `${inputCls} cursor-pointer`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 p-4 sm:p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-black">Kelola Data Karyawan</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          Input kolektif (maks 10), perubahan data, dan direktori karyawan.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "input", label: "Input Kolektif", icon: "fa-users" },
          { id: "edit", label: "Perubahan Data", icon: "fa-pen-to-square" },
          { id: "direktori", label: "Direktori Karyawan", icon: "fa-address-book" },
          { id: "import", label: "Import Excel / Sheets", icon: "fa-file-excel" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition border ${
              activeTab === tab.id
                ? "bg-[#941A0B] text-white border-[#941A0B] shadow-md"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ======== TAB 1: INPUT KOLEKTIF ======== */}
      {activeTab === "input" && (
        <form onSubmit={handleSubmitMultiForm} className="space-y-4">
          {forms.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Accordion Header */}
              <div
                onClick={() => handleToggleAccordion(item.id)}
                className="bg-[#F1F1F1] border-b border-slate-200 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-200/60 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-[#941A0B] text-white w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm">
                    #{item.id}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-black text-sm">
                      {item.namaLengkap ? item.namaLengkap : "Data Karyawan Baru"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      {item.jabatan ? item.jabatan : "Belum ada jabatan"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveForm(item.id); }}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                    title="Hapus Formulir"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                  <button type="button" className="text-[#941A0B] bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <i className={`fa-solid ${item.isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`} />
                    <span className="hidden sm:inline">{item.isExpanded ? "Tutup" : "Buka"}</span>
                  </button>
                </div>
              </div>

              {/* Accordion Body */}
              {item.isExpanded && (
                <div className="p-5 sm:p-6 space-y-8">
                  {/* SECTION 1: DATA PRIBADI */}
                  <div>
                    <h2 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                      1. Data Pribadi
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Nama Lengkap *</label>
                        <input
                          type="text"
                          value={item.namaLengkap}
                          onChange={(e) => updateFormField(item.id, "namaLengkap", e.target.value)}
                          placeholder="Contoh: Siti Nurhaliza"
                          className={inputCls}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Panggilan</label>
                        <input
                          type="text"
                          value={item.namaPanggilan}
                          onChange={(e) => updateFormField(item.id, "namaPanggilan", e.target.value)}
                          placeholder="Contoh: Siti"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Gender *</label>
                        <select value={item.gender} onChange={(e) => updateFormField(item.id, "gender", e.target.value)} className={selectCls} required>
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Tempat Lahir</label>
                        <input
                          type="text"
                          value={item.tempatLahir}
                          onChange={(e) => updateFormField(item.id, "tempatLahir", e.target.value)}
                          placeholder="Contoh: Jakarta"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Tanggal Lahir</label>
                        <input type="date" value={item.tanggalLahir} onChange={(e) => updateFormField(item.id, "tanggalLahir", e.target.value)} className={`${inputCls} cursor-pointer`} />
                      </div>
                      <div>
                        <label className={labelCls}>Agama</label>
                        <select value={item.agama} onChange={(e) => updateFormField(item.id, "agama", e.target.value)} className={selectCls}>
                          {["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Kepercayaan"].map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>

                      {/* Nomor WA — prefix 62 baku */}
                      <div>
                        <label className={labelCls}>Nomor WA *</label>
                        <div className="flex">
                          <span className="flex items-center px-3 bg-[#F1F1F1] border border-r-0 border-slate-300 rounded-l-xl text-sm font-extrabold text-[#941A0B] select-none">
                            +62
                          </span>
                          <input
                            type="tel"
                            value={item.nomorTeleponSuffix}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              updateFormField(item.id, "nomorTeleponSuffix", val);
                            }}
                            placeholder="Contoh: 81234567890"
                            className="flex-1 border border-slate-300 rounded-r-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#941A0B] outline-none"
                            required
                          />
                        </div>
                      </div>

                      {/* Emergency Contact — prefix 62 baku */}
                      <div>
                        <label className={labelCls}>Emergency Contact</label>
                        <div className="flex">
                          <span className="flex items-center px-3 bg-[#F1F1F1] border border-r-0 border-slate-300 rounded-l-xl text-sm font-extrabold text-[#941A0B] select-none">
                            +62
                          </span>
                          <input
                            type="tel"
                            value={item.emergencyContactSuffix}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              updateFormField(item.id, "emergencyContactSuffix", val);
                            }}
                            placeholder="Contoh: 81987654321"
                            className="flex-1 border border-slate-300 rounded-r-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#941A0B] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Email *</label>
                        <input
                          type="email"
                          value={item.email}
                          onChange={(e) => updateFormField(item.id, "email", e.target.value)}
                          placeholder="Contoh: siti.nurhaliza@gmail.com"
                          className={inputCls}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Status Perkawinan</label>
                        <select value={item.statusPerkawinan} onChange={(e) => updateFormField(item.id, "statusPerkawinan", e.target.value)} className={selectCls}>
                          {["Belum Kawin", "Kawin Tercatat", "Cerai Hidup", "Cerai Mati"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Riwayat Penyakit</label>
                        <input
                          type="text"
                          value={item.riwayatPenyakit}
                          onChange={(e) => updateFormField(item.id, "riwayatPenyakit", e.target.value)}
                          placeholder="Contoh: Asma, Alergi, atau '-' jika tidak ada"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: DATA PEKERJAAN */}
                  <div>
                    <h2 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                      2. Data Pekerjaan
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Jabatan *</label>
                        <select value={item.jabatan} onChange={(e) => updateFormField(item.id, "jabatan", e.target.value)} className={selectCls} required>
                          <option value="">-- Pilih Jabatan --</option>
                          {JABATAN_LIST.map((j) => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Kategori *</label>
                        <select value={item.kategori} onChange={(e) => updateFormField(item.id, "kategori", e.target.value)} className={selectCls} required>
                          {["Host", "OTS", "Management", "Staff"].map((k) => <option key={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Tipe Jadwal *</label>
                        <select value={item.tipeJadwal} onChange={(e) => updateFormField(item.id, "tipeJadwal", e.target.value)} className={selectCls} required>
                          {["Office Hours", "Shift", "Flexible Hours"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Start Date *</label>
                        <input type="date" value={item.startDate} onChange={(e) => updateFormField(item.id, "startDate", e.target.value)} className={`${inputCls} cursor-pointer`} required />
                      </div>
                      <div>
                        <label className={labelCls}>End Date</label>
                        <input type="date" value={item.endDate} onChange={(e) => updateFormField(item.id, "endDate", e.target.value)} className={`${inputCls} cursor-pointer`} />
                      </div>
                      <div>
                        <label className={labelCls}>Status Aktif *</label>
                        <select value={item.statusAktif} onChange={(e) => updateFormField(item.id, "statusAktif", e.target.value)} className={selectCls} required>
                          {["Aktif", "Izin", "Cuti", "Non-Aktif"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: LEGAL, ALAMAT & BANK */}
                  <div>
                    <h2 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                      3. Legal, Alamat & Bank
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>NIK KTP *</label>
                        <input
                          type="text"
                          value={item.nik}
                          onChange={(e) => updateFormField(item.id, "nik", e.target.value)}
                          placeholder="Contoh: 3201234567890001"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>NPWP</label>
                        <input
                          type="text"
                          value={item.npwp}
                          onChange={(e) => updateFormField(item.id, "npwp", e.target.value)}
                          placeholder="Contoh: 01.234.567.8-901.000"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Status PTKP</label>
                        <select value={item.statusPtkp} onChange={(e) => updateFormField(item.id, "statusPtkp", e.target.value)} className={selectCls}>
                          {["TK/0","TK/1","TK/2","TK/3","K/0","K/1","K/2","K/3"].map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Alamat KTP</label>
                        <input
                          type="text"
                          value={item.alamatKtp}
                          onChange={(e) => updateFormField(item.id, "alamatKtp", e.target.value)}
                          placeholder="Contoh: Jl. Merdeka No. 10, RT 01/RW 02, Gambir, Jakarta Pusat"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Alamat Domisili</label>
                        <input
                          type="text"
                          value={item.alamatDomisili}
                          onChange={(e) => updateFormField(item.id, "alamatDomisili", e.target.value)}
                          placeholder="Contoh: Sesuai KTP / Jl. Kebon Jeruk No. 5, Jakarta Barat"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Bank</label>
                        <select value={item.namaBank} onChange={(e) => updateFormField(item.id, "namaBank", e.target.value)} className={selectCls}>
                          {BANK_LIST.map((b) => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Nomor Rekening</label>
                        <input
                          type="text"
                          value={item.nomorRekening}
                          onChange={(e) => updateFormField(item.id, "nomorRekening", e.target.value)}
                          placeholder="Contoh: 1234567890"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Pemilik Rekening</label>
                        <input
                          type="text"
                          value={item.namaPemilikRek}
                          onChange={(e) => updateFormField(item.id, "namaPemilikRek", e.target.value)}
                          placeholder="Contoh: SITI NURHALIZA"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: DOKUMEN UPLOAD */}
                  <div>
                    <h2 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                      4. Dokumen Upload
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(["scanKtp", "scanKk", "scanNpwp"] as const).map((fieldName, fi) => {
                        const labels = ["Scan KTP (Maks 5MB)", "Scan KK (Maks 5MB)", "Scan NPWP (Maks 5MB)"];
                        const previewVal = item[fieldName];
                        return (
                          <div key={fieldName}>
                            <label className={labelCls}>{labels[fi]}</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileUpload(item.id, fieldName, e.target.files?.[0] || null)}
                              className="w-full border border-slate-300 rounded-xl p-1.5 text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-[#941A0B] hover:file:bg-red-100"
                            />
                            {previewVal && (
                              <div className="mt-2 relative w-fit">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previewVal} alt={fieldName} className="h-20 rounded-lg object-cover border border-slate-200" />
                                <button type="button" onClick={() => updateFormField(item.id, fieldName, null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Bottom Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              type="button"
              onClick={handleAddForm}
              className="w-full sm:w-auto text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm border border-red-200"
            >
              <i className="fa-solid fa-plus" />
              <span>Tambah Data Lain (Maks {10 - forms.length} lagi, total maks 10)</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <i className={`fa-solid ${submitting ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
              <span>{submitting ? "Menyimpan..." : `Simpan Semua Data (${forms.length} Formulir)`}</span>
            </button>
          </div>
        </form>
      )}

      {/* ======== TAB 2: PERUBAHAN DATA (EDIT) ======== */}
      {activeTab === "edit" && (
        <div className="space-y-6">
          {/* Search */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-extrabold text-black mb-3">Cari Karyawan</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="off"
                    value={searchEditId}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    onChange={(e) => {
                      setSearchEditId(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setShowEmployeeDropdown(false);
                        handleSelectTargetEmployee(undefined, searchEditId);
                      }
                    }}
                    placeholder="Contoh: PCS001 atau Siti Nurhaliza..."
                    className={inputCls}
                  />
                  {searchEditId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchEditId("");
                        setTargetEmployee(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>

                {/* Floating Live Suggestions for Employees */}
                {showEmployeeDropdown && searchEditId.trim() && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {employeeList
                      .filter((e) => {
                        const q = searchEditId.toLowerCase().trim();
                        return (
                          (e.namaLengkap || "").toLowerCase().includes(q) ||
                          (e.idKaryawan || "").toLowerCase().includes(q) ||
                          (e.jabatan || "").toLowerCase().includes(q) ||
                          (e.email || "").toLowerCase().includes(q)
                        );
                      })
                      .map((emp) => (
                        <div
                          key={emp.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectTargetEmployee(emp);
                            setShowEmployeeDropdown(false);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectTargetEmployee(emp);
                            setShowEmployeeDropdown(false);
                          }}
                          className="p-3 hover:bg-red-50/60 cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-black text-sm">{emp.namaLengkap}</span>
                            <span className="text-xs text-[#941A0B] font-mono font-bold ml-2">({emp.idKaryawan})</span>
                            <div className="text-xs text-slate-400">
                              Jabatan: <span className="text-slate-700 font-medium">{emp.jabatan || "-"}</span> • Kategori:{" "}
                              <span className="text-slate-700">{emp.kategori || "-"}</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#941A0B] bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                            Pilih
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEmployeeDropdown(false);
                  handleSelectTargetEmployee(undefined, searchEditId);
                }}
                className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-md shrink-0"
              >
                <i className="fa-solid fa-pen-to-square" />
                <span>Rubah Data</span>
              </button>
            </div>
          </div>

          {/* Target Employee Banner & Full Profile Summary */}
          {targetEmployee && (
            <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-700 shadow-sm relative overflow-hidden space-y-5">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <i className="fa-solid fa-id-card text-9xl text-white" />
              </div>

              {/* Header Profile */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#941A0B] text-white flex items-center justify-center font-extrabold text-lg shadow-md border border-red-400/20 shrink-0">
                    {targetEmployee.namaLengkap?.charAt(0)?.toUpperCase() || "K"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-extrabold text-lg text-white">{targetEmployee.namaLengkap}</h2>
                      {targetEmployee.namaPanggilan && (
                        <span className="text-xs bg-slate-800 text-amber-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">
                          &ldquo;{targetEmployee.namaPanggilan}&rdquo;
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40">
                        {targetEmployee.idKaryawan}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{targetEmployee.jabatan || "Staff"}</span>
                      <span>•</span>
                      <span className="text-slate-300 font-semibold">{targetEmployee.kategori || "Host"}</span>
                      <span>•</span>
                      <span className="text-slate-300">{targetEmployee.tipeJadwal || "Shift"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                      targetEmployee.statusAktif === "NON_AKTIF"
                        ? "bg-red-950/60 text-red-400 border-red-800/50"
                        : "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
                    }`}
                  >
                    ● {targetEmployee.statusAktif || "Aktif"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPinTarget(targetEmployee);
                      setShowPinModal(true);
                    }}
                    className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition border border-slate-600 shadow-sm"
                  >
                    <i className="fa-solid fa-key text-amber-400" />
                    <span>Ganti PIN</span>
                  </button>
                </div>
              </div>

              {/* Comprehensive Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 relative z-10 text-xs">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Nomor WhatsApp</span>
                  <div className="font-bold text-emerald-400 font-mono">
                    {targetEmployee.nomorTelepon ? (
                      <a
                        href={`https://wa.me/${targetEmployee.nomorTelepon.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        <i className="fa-brands fa-whatsapp" />
                        <span>+{targetEmployee.nomorTelepon}</span>
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Email</span>
                  <div className="font-semibold text-slate-200 truncate" title={targetEmployee.email || "-"}>
                    {targetEmployee.email || "-"}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Gender / Lahir</span>
                  <div className="font-semibold text-slate-200">
                    {targetEmployee.gender === "LAKI_LAKI" ? "Laki-laki" : "Perempuan"}
                    {targetEmployee.tempatLahir ? ` • ${targetEmployee.tempatLahir}` : ""}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Tanggal Lahir</span>
                  <div className="font-semibold text-slate-200">
                    {formatDateIndo(targetEmployee.tanggalLahir)}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">NIK KTP</span>
                  <div className="font-mono text-slate-200 font-medium">{targetEmployee.nik || "-"}</div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">NPWP / PTKP</span>
                  <div className="font-mono text-slate-200 font-medium">
                    {targetEmployee.npwp || "-"} {targetEmployee.statusPtkp ? `(${targetEmployee.statusPtkp})` : ""}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Rekening Bank</span>
                  <div className="font-semibold text-slate-200">
                    {targetEmployee.namaBank || "BCA"}: <span className="font-mono text-amber-300 font-bold">{targetEmployee.nomorRekening || "-"}</span>
                    {targetEmployee.namaPemilikRek && <div className="text-[10px] text-slate-400">a.n {targetEmployee.namaPemilikRek}</div>}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Emergency Contact</span>
                  <div className="font-mono text-slate-200">{targetEmployee.emergencyContact ? `+${targetEmployee.emergencyContact}` : "-"}</div>
                </div>

                <div className="col-span-2 sm:col-span-3 md:col-span-4 bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                  <span className="block text-[11px] text-slate-400 mb-0.5">Alamat KTP &amp; Domisili</span>
                  <div className="text-xs text-slate-200 font-medium">
                    <b>KTP:</b> {targetEmployee.alamatKtp || "-"} <span className="mx-2 text-slate-500">•</span> <b>Domisili:</b> {targetEmployee.alamatDomisili || "-"}
                  </div>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditSubTab("full")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                    editSubTab === "full"
                      ? "bg-[#941A0B] text-white border-[#941A0B]"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                  }`}
                >
                  <i className="fa-solid fa-list-check" />
                  <span>Formulir Lengkap (Semua Data)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditSubTab("quick")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                    editSubTab === "quick"
                      ? "bg-[#941A0B] text-white border-[#941A0B]"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                  }`}
                >
                  <i className="fa-solid fa-table-columns" />
                  <span>Per Baris Kolom (Quick Edit)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 1: FORMULIR LENGKAP PERUBAHAN DATA KARYAWAN                          */}
          {/* ========================================================================= */}
          {targetEmployee && editSubTab === "full" && (
            <form onSubmit={handleSubmitFullEdit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Formulir Lengkap Perubahan Data</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Semua kolom telah terisi otomatis sesuai database. Silakan ubah data yang diperlukan lalu klik simpan.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#941A0B] bg-red-50 px-3 py-1 rounded-lg border border-red-100 self-start sm:self-auto">
                  {targetEmployee.idKaryawan}
                </span>
              </div>

              {/* SECTION 1: DATA PRIBADI */}
              <div>
                <h4 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                  1. Data Pribadi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Nama Lengkap *</label>
                    <input
                      type="text"
                      value={fullEditForm.namaLengkap}
                      onChange={(e) => updateFullEditField("namaLengkap", e.target.value)}
                      placeholder="Contoh: Siti Nurhaliza"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nama Panggilan</label>
                    <input
                      type="text"
                      value={fullEditForm.namaPanggilan}
                      onChange={(e) => updateFullEditField("namaPanggilan", e.target.value)}
                      placeholder="Contoh: Siti"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Gender *</label>
                    <select
                      value={fullEditForm.gender}
                      onChange={(e) => updateFullEditField("gender", e.target.value)}
                      className={selectCls}
                      required
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tempat Lahir</label>
                    <input
                      type="text"
                      value={fullEditForm.tempatLahir}
                      onChange={(e) => updateFullEditField("tempatLahir", e.target.value)}
                      placeholder="Contoh: Jakarta"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Tanggal Lahir</label>
                    <input
                      type="date"
                      value={fullEditForm.tanggalLahir}
                      onChange={(e) => updateFullEditField("tanggalLahir", e.target.value)}
                      className={`${inputCls} cursor-pointer`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Agama</label>
                    <select
                      value={fullEditForm.agama}
                      onChange={(e) => updateFullEditField("agama", e.target.value)}
                      className={selectCls}
                    >
                      {["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Kepercayaan"].map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  {/* Nomor WA */}
                  <div>
                    <label className={labelCls}>Nomor WA *</label>
                    <div className="flex">
                      <span className="flex items-center px-3 bg-[#F1F1F1] border border-r-0 border-slate-300 rounded-l-xl text-sm font-extrabold text-[#941A0B] select-none">
                        +62
                      </span>
                      <input
                        type="tel"
                        value={fullEditForm.nomorTeleponSuffix}
                        onChange={(e) => updateFullEditField("nomorTeleponSuffix", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Contoh: 81234567890"
                        className="flex-1 border border-slate-300 rounded-r-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#941A0B] outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <label className={labelCls}>Emergency Contact</label>
                    <div className="flex">
                      <span className="flex items-center px-3 bg-[#F1F1F1] border border-r-0 border-slate-300 rounded-l-xl text-sm font-extrabold text-[#941A0B] select-none">
                        +62
                      </span>
                      <input
                        type="tel"
                        value={fullEditForm.emergencyContactSuffix}
                        onChange={(e) => updateFullEditField("emergencyContactSuffix", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Contoh: 81987654321"
                        className="flex-1 border border-slate-300 rounded-r-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#941A0B] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Email *</label>
                    <input
                      type="email"
                      value={fullEditForm.email}
                      onChange={(e) => updateFullEditField("email", e.target.value)}
                      placeholder="Contoh: siti.nurhaliza@gmail.com"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status Perkawinan</label>
                    <select
                      value={fullEditForm.statusPerkawinan}
                      onChange={(e) => updateFullEditField("statusPerkawinan", e.target.value)}
                      className={selectCls}
                    >
                      {["Belum Kawin", "Kawin Tercatat", "Cerai Hidup", "Cerai Mati"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Riwayat Penyakit</label>
                    <input
                      type="text"
                      value={fullEditForm.riwayatPenyakit}
                      onChange={(e) => updateFullEditField("riwayatPenyakit", e.target.value)}
                      placeholder="Contoh: Asma, Alergi, atau '-' jika tidak ada"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: DATA PEKERJAAN */}
              <div>
                <h4 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                  2. Data Pekerjaan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Jabatan *</label>
                    <select
                      value={fullEditForm.jabatan}
                      onChange={(e) => updateFullEditField("jabatan", e.target.value)}
                      className={selectCls}
                      required
                    >
                      <option value="">-- Pilih Jabatan --</option>
                      {JABATAN_LIST.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Kategori *</label>
                    <select
                      value={fullEditForm.kategori}
                      onChange={(e) => updateFullEditField("kategori", e.target.value)}
                      className={selectCls}
                      required
                    >
                      {["Host", "OTS", "Management", "Staff"].map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipe Jadwal *</label>
                    <select
                      value={fullEditForm.tipeJadwal}
                      onChange={(e) => updateFullEditField("tipeJadwal", e.target.value)}
                      className={selectCls}
                      required
                    >
                      {["Office Hours", "Shift", "Flexible Hours"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Start Date *</label>
                    <input
                      type="date"
                      value={fullEditForm.startDate}
                      onChange={(e) => updateFullEditField("startDate", e.target.value)}
                      className={`${inputCls} cursor-pointer`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>End Date</label>
                    <input
                      type="date"
                      value={fullEditForm.endDate}
                      onChange={(e) => updateFullEditField("endDate", e.target.value)}
                      className={`${inputCls} cursor-pointer`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status Aktif *</label>
                    <select
                      value={fullEditForm.statusAktif}
                      onChange={(e) => updateFullEditField("statusAktif", e.target.value)}
                      className={selectCls}
                      required
                    >
                      {["Aktif", "Izin", "Cuti", "Non-Aktif"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: LEGAL, ALAMAT & BANK */}
              <div>
                <h4 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                  3. Legal, Alamat &amp; Bank
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>NIK KTP *</label>
                    <input
                      type="text"
                      value={fullEditForm.nik}
                      onChange={(e) => updateFullEditField("nik", e.target.value)}
                      placeholder="Contoh: 3201234567890001"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>NPWP</label>
                    <input
                      type="text"
                      value={fullEditForm.npwp}
                      onChange={(e) => updateFullEditField("npwp", e.target.value)}
                      placeholder="Contoh: 01.234.567.8-901.000"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status PTKP</label>
                    <select
                      value={fullEditForm.statusPtkp}
                      onChange={(e) => updateFullEditField("statusPtkp", e.target.value)}
                      className={selectCls}
                    >
                      {["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Alamat Sesuai KTP *</label>
                    <input
                      type="text"
                      value={fullEditForm.alamatKtp}
                      onChange={(e) => updateFullEditField("alamatKtp", e.target.value)}
                      placeholder="Contoh: Jl. Merdeka No. 10, RT 01/RW 02, Gambir, Jakarta Pusat"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Alamat Domisili Saat Ini *</label>
                    <input
                      type="text"
                      value={fullEditForm.alamatDomisili}
                      onChange={(e) => updateFullEditField("alamatDomisili", e.target.value)}
                      placeholder="Contoh: Sesuai KTP / Jl. Kebon Jeruk No. 5, Jakarta Barat"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nama Bank *</label>
                    <select
                      value={fullEditForm.namaBank}
                      onChange={(e) => updateFullEditField("namaBank", e.target.value)}
                      className={selectCls}
                      required
                    >
                      {BANK_LIST.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nomor Rekening *</label>
                    <input
                      type="text"
                      value={fullEditForm.nomorRekening}
                      onChange={(e) => updateFullEditField("nomorRekening", e.target.value)}
                      placeholder="Contoh: 1234567890"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nama Pemilik Rekening *</label>
                    <input
                      type="text"
                      value={fullEditForm.namaPemilikRek}
                      onChange={(e) => updateFullEditField("namaPemilikRek", e.target.value)}
                      placeholder="Contoh: SITI NURHALIZA"
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: DOKUMEN UPLOAD */}
              <div>
                <h4 className="text-xs font-extrabold text-[#941A0B] uppercase tracking-widest mb-4 pb-1 border-b border-[#941A0B]/20">
                  4. Dokumen Upload
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(["scanKtp", "scanKk", "scanNpwp"] as const).map((fieldName, fi) => {
                    const labels = ["Scan KTP (Maks 5MB)", "Scan KK (Maks 5MB)", "Scan NPWP (Maks 5MB)"];
                    const previewVal = fullEditForm[fieldName];
                    return (
                      <div key={fieldName}>
                        <label className={labelCls}>{labels[fi]}</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUploadFullEdit(fieldName, e.target.files?.[0] || null)}
                          className="w-full border border-slate-300 rounded-xl p-1.5 text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-[#941A0B] hover:file:bg-red-100"
                        />
                        {previewVal && (
                          <div className="mt-2 relative w-fit">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewVal} alt={fieldName} className="h-20 rounded-lg object-cover border border-slate-200" />
                            <button
                              type="button"
                              onClick={() => updateFullEditField(fieldName, null)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Bar: Hapus Karyawan & Simpan Perubahan */}
              <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDeleteEmployee}
                  disabled={savingEdit || deletingEmployee}
                  className="w-full sm:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 active:scale-95"
                  title="Hapus data karyawan ini secara permanen dari database"
                >
                  <i className={`fa-solid ${deletingEmployee ? "fa-circle-notch fa-spin" : "fa-trash"}`} />
                  <span>{deletingEmployee ? "Menghapus..." : "Hapus Karyawan"}</span>
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || deletingEmployee}
                  className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3.5 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  <i className={`fa-solid ${savingEdit ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                  <span>{savingEdit ? "Menyimpan Data..." : "Simpan Perubahan Data Karyawan"}</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: PERUBAHAN KOLOM TERTENTU (QUICK COLUMN UPDATER)                   */}
          {/* ========================================================================= */}
          {targetEmployee && editSubTab === "quick" && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-extrabold text-black mb-4 border-b border-slate-100 pb-2">Perbarui Kolom Data Tertentu</h2>
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div className="space-y-3">
                  {editRows.map((row, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="w-full sm:w-1/3">
                        <select
                          value={row.field}
                          onChange={(e) => handleUpdateEditRow(idx, e.target.value)}
                          className={`${selectCls} text-sm`}
                          required
                        >
                          <option value="" disabled>-- Pilih Kolom Data --</option>
                          <option value="NAMA_LENGKAP">Nama Lengkap</option>
                          <option value="NAMA_PANGGILAN">Nama Panggilan</option>
                          <option value="GENDER">Gender</option>
                          <option value="TEMPAT_LAHIR">Tempat Lahir</option>
                          <option value="TANGGAL_LAHIR">Tanggal Lahir</option>
                          <option value="AGAMA">Agama</option>
                          <option value="STATUS_PERKAWINAN">Status Perkawinan</option>
                          <option value="RIWAYAT_PENYAKIT">Riwayat Penyakit</option>
                          <option value="NOMOR_TELEPON">Nomor WA</option>
                          <option value="EMERGENCY_CONTACT">Emergency Contact</option>
                          <option value="EMAIL">Email</option>
                          <option value="JABATAN">Jabatan</option>
                          <option value="KATEGORI">Kategori</option>
                          <option value="TIPE_JADWAL">Tipe Jadwal</option>
                          <option value="START_DATE">Start Date</option>
                          <option value="END_DATE">End Date</option>
                          <option value="STATUS_AKTIF">Status Aktif</option>
                          <option value="NIK">NIK KTP</option>
                          <option value="NPWP">NPWP</option>
                          <option value="STATUS_PTKP">Status PTKP</option>
                          <option value="ALAMAT_KTP">Alamat KTP</option>
                          <option value="ALAMAT_DOMISILI">Alamat Domisili</option>
                          <option value="NAMA_BANK">Nama Bank</option>
                          <option value="NOMOR_REKENING">Nomor Rekening</option>
                          <option value="NAMA_PEMILIK_REKENING">Nama Pemilik Rekening</option>
                        </select>
                      </div>

                      <div className="w-full sm:flex-1">
                        {row.field === "GENDER" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            <option value="Laki-laki">Laki-laki</option>
                            <option value="Perempuan">Perempuan</option>
                          </select>
                        ) : row.field === "STATUS_AKTIF" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            {["Aktif", "Izin", "Cuti", "Non-Aktif"].map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : row.field === "JABATAN" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            <option value="">-- Pilih Jabatan --</option>
                            {JABATAN_LIST.map((j) => <option key={j}>{j}</option>)}
                          </select>
                        ) : row.field === "KATEGORI" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            {["Host", "OTS", "Management", "Staff"].map((k) => <option key={k}>{k}</option>)}
                          </select>
                        ) : row.field === "TIPE_JADWAL" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            {["Office Hours", "Shift", "Flexible Hours"].map((t) => <option key={t}>{t}</option>)}
                          </select>
                        ) : row.field === "NAMA_BANK" ? (
                          <select value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={selectCls} required>
                            {BANK_LIST.map((b) => <option key={b}>{b}</option>)}
                          </select>
                        ) : ["TANGGAL_LAHIR", "START_DATE", "END_DATE"].includes(row.field) ? (
                          <input type="date" value={row.value} onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)} className={`${inputCls} cursor-pointer`} required />
                        ) : (
                          <input
                            type="text"
                            value={row.value}
                            disabled={!row.field}
                            onChange={(e) => handleUpdateEditRow(idx, row.field, e.target.value)}
                            placeholder={row.field ? `Masukkan nilai...` : "Pilih kolom data terlebih dahulu"}
                            className={`${inputCls} ${!row.field ? "bg-slate-100 cursor-not-allowed" : ""}`}
                            required
                          />
                        )}
                      </div>

                      <div className="w-full sm:w-auto flex justify-end">
                        <button type="button" onClick={() => handleRemoveEditRow(idx)} disabled={editRows.length === 1} className="text-red-500 hover:text-red-700 p-2 rounded-lg transition disabled:opacity-30">
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={handleAddEditRow} className="text-[#941A0B] hover:text-[#7D1509] text-sm font-bold flex items-center gap-2 transition">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                    <i className="fa-solid fa-plus text-[10px]" />
                  </div>
                  <span>Tambah Kolom Perubahan</span>
                </button>

                <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDeleteEmployee}
                    disabled={savingEdit || deletingEmployee}
                    className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 active:scale-95"
                    title="Hapus data karyawan ini secara permanen dari database"
                  >
                    <i className={`fa-solid ${deletingEmployee ? "fa-circle-notch fa-spin" : "fa-trash"}`} />
                    <span>{deletingEmployee ? "Menghapus..." : "Hapus Karyawan"}</span>
                  </button>
                  <button type="submit" disabled={savingEdit || deletingEmployee} className="w-full sm:w-auto bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer active:scale-95">
                    <i className={`fa-solid ${savingEdit ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal Konfirmasi Hapus Karyawan (Permanen) */}
          {showDeleteEmployeeModal && targetEmployee && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0">
                    <i className="fa-solid fa-user-xmark" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Hapus Karyawan Permanen
                    </h3>
                    <p className="text-xs text-rose-600 font-semibold">
                      Tindakan ini tidak dapat dibatalkan
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ID Karyawan:</span>
                    <span className="font-mono font-bold text-rose-700">{targetEmployee.idKaryawan || targetEmployee.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Lengkap:</span>
                    <span className="font-bold text-slate-800">{targetEmployee.namaLengkap}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jabatan / Kategori:</span>
                    <span className="font-semibold text-slate-700">{targetEmployee.jabatan || "-"} ({targetEmployee.kategori || "-"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-mono text-slate-700">{targetEmployee.email || "-"}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin <strong>menghapus permanen</strong> data karyawan ini dari database? Seluruh riwayat presensi, izin, lembur, serta akun login akan dibersihkan.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeleteEmployeeModal(false)}
                    disabled={deletingEmployee}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={executeConfirmDeleteEmployee}
                    disabled={deletingEmployee}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <i className={`fa-solid ${deletingEmployee ? "fa-circle-notch fa-spin" : "fa-trash"}`} />
                    <span>{deletingEmployee ? "Menghapus..." : "Ya, Hapus Permanen"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== TAB 3: DIREKTORI KARYAWAN ======== */}
      {activeTab === "direktori" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header & Search */}
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-base text-black">Direktori Karyawan & Host</h2>
              <p className="text-xs text-slate-500 mt-0.5">{filteredDirektori.length} karyawan terdaftar</p>
            </div>
            <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 w-full sm:w-72 focus-within:ring-2 focus-within:ring-[#941A0B]">
              <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 text-sm" />
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Cari nama, ID, jabatan..."
                className="border-none bg-transparent focus:ring-0 outline-none text-sm w-full text-slate-700"
              />
              {dirSearch && (
                <button onClick={() => setDirSearch("")} className="text-slate-400 hover:text-slate-700 ml-1">
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-white uppercase bg-[#941A0B]">
                <tr>
                  <th className="px-4 py-3 font-bold">ID KARYAWAN</th>
                  <th className="px-4 py-3 font-bold">NAMA LENGKAP</th>
                  <th className="px-4 py-3 font-bold">JABATAN</th>
                  <th className="px-4 py-3 font-bold">KATEGORI</th>
                  <th className="px-4 py-3 font-bold">TIPE JADWAL</th>
                  <th className="px-4 py-3 font-bold">NOMOR WA</th>
                  <th className="px-4 py-3 font-bold">EMAIL</th>
                  <th className="px-4 py-3 font-bold">STATUS</th>
                  <th className="px-4 py-3 font-bold">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDirektori.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#941A0B] text-xs">{emp.idKaryawan || "-"}</td>
                    <td className="px-4 py-3 font-bold text-black">{emp.namaLengkap}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{emp.jabatan || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {emp.kategori || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{emp.tipeJadwal || "-"}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                      {emp.nomorTelepon ? (
                        <a
                          href={`https://wa.me/${emp.nomorTelepon.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#941A0B] hover:underline flex items-center gap-1"
                        >
                          <i className="fa-brands fa-whatsapp" />
                          {emp.nomorTelepon}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{emp.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        emp.statusAktif === "Aktif" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        emp.statusAktif === "Non-Aktif" ? "bg-red-50 text-red-700 border border-red-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {emp.statusAktif || "Aktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailEmployee(emp)}
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition text-xs"
                          title="Lihat Detail Lengkap"
                        >
                          <i className="fa-solid fa-eye" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPinTarget(emp); setShowPinModal(true); }}
                          className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition text-xs"
                          title="Ganti PIN"
                        >
                          <i className="fa-solid fa-key" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDirektori.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic text-sm">
                      {dirSearch ? "Tidak ada karyawan yang cocok dengan pencarian." : "Belum ada data karyawan terdaftar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======== MODAL: DETAIL LENGKAP KARYAWAN ======== */}
      {detailEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-black">{detailEmployee.namaLengkap}</h3>
                <p className="text-xs text-[#941A0B] font-mono font-bold">{detailEmployee.idKaryawan} • {detailEmployee.jabatan || "Karyawan"}</p>
              </div>
              <button type="button" onClick={() => setDetailEmployee(null)} className="text-slate-400 hover:text-slate-700">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Data Pribadi */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px] mb-2 border-b border-slate-200 pb-1">1. Data Pribadi</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><span className="text-slate-400 block">Nama Panggilan</span><span className="font-bold text-black">{detailEmployee.namaPanggilan || "-"}</span></div>
                  <div><span className="text-slate-400 block">Jenis Kelamin</span><span className="font-bold text-black">{detailEmployee.gender || "-"}</span></div>
                  <div><span className="text-slate-400 block">Tempat Lahir</span><span className="font-bold text-black">{detailEmployee.tempatLahir || "-"}</span></div>
                  <div><span className="text-slate-400 block">Tanggal Lahir</span><span className="font-bold text-black">{formatDateIndo(detailEmployee.tanggalLahir)}</span></div>
                  <div><span className="text-slate-400 block">Agama</span><span className="font-bold text-black">{detailEmployee.agama || "-"}</span></div>
                  <div><span className="text-slate-400 block">Status Nikah</span><span className="font-bold text-black">{detailEmployee.statusPerkawinan || "-"}</span></div>
                </div>
              </div>

              {/* 2. Kontak & Alamat */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px] mb-2 border-b border-slate-200 pb-1">2. Kontak &amp; Alamat</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><span className="text-slate-400 block">Nomor WhatsApp</span><span className="font-bold text-black font-mono">{detailEmployee.nomorTelepon || "-"}</span></div>
                  <div><span className="text-slate-400 block">Kontak Darurat</span><span className="font-bold text-black font-mono">{detailEmployee.emergencyContact || "-"}</span></div>
                  <div className="sm:col-span-2"><span className="text-slate-400 block">Email</span><span className="font-bold text-black">{detailEmployee.email || "-"}</span></div>
                  <div className="sm:col-span-2"><span className="text-slate-400 block">Alamat KTP</span><span className="font-semibold text-slate-700">{detailEmployee.alamatKtp || "-"}</span></div>
                  <div className="sm:col-span-2"><span className="text-slate-400 block">Alamat Domisili</span><span className="font-semibold text-slate-700">{detailEmployee.alamatDomisili || "-"}</span></div>
                </div>
              </div>

              {/* 3. Kepegawaian & Finansial */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px] mb-2 border-b border-slate-200 pb-1">3. Kepegawaian &amp; Finansial</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><span className="text-slate-400 block">Jabatan</span><span className="font-bold text-black">{detailEmployee.jabatan || "-"}</span></div>
                  <div><span className="text-slate-400 block">Kategori</span><span className="font-bold text-black">{detailEmployee.kategori || "-"}</span></div>
                  <div><span className="text-slate-400 block">Tipe Jadwal</span><span className="font-bold text-black">{detailEmployee.tipeJadwal || "-"}</span></div>
                  <div><span className="text-slate-400 block">Mulai Kerja</span><span className="font-bold text-black">{formatDateIndo(detailEmployee.startDate)}</span></div>
                  <div><span className="text-slate-400 block">Akhir Kontrak</span><span className="font-bold text-black">{formatDateIndo(detailEmployee.endDate)}</span></div>
                  <div><span className="text-slate-400 block">Status Aktif</span><span className="font-bold text-emerald-700">{detailEmployee.statusAktif || "Aktif"}</span></div>
                  <div><span className="text-slate-400 block">NIK KTP</span><span className="font-mono font-bold text-black">{detailEmployee.nik || "-"}</span></div>
                  <div><span className="text-slate-400 block">NPWP</span><span className="font-mono font-bold text-black">{detailEmployee.npwp || "-"}</span></div>
                  <div><span className="text-slate-400 block">Status PTKP</span><span className="font-bold text-black">{detailEmployee.statusPtkp || "-"}</span></div>
                  <div><span className="text-slate-400 block">Nama Bank</span><span className="font-bold text-black">{detailEmployee.namaBank || "-"}</span></div>
                  <div><span className="text-slate-400 block">No. Rekening</span><span className="font-mono font-bold text-black">{detailEmployee.nomorRekening || "-"}</span></div>
                  <div><span className="text-slate-400 block">Atas Nama</span><span className="font-bold text-black">{detailEmployee.namaPemilikRek || "-"}</span></div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailEmployee(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#941A0B] text-white hover:bg-[#7D1509] transition shadow-sm"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== TAB 4: IMPORT EXCEL / SHEETS ======== */}
      {activeTab === "import" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-black flex items-center gap-2">
              <i className="fa-solid fa-file-excel text-emerald-600" />
              <span>Import Karyawan via Excel / Google Sheets</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Unggah file Excel / CSV atau masukkan tautan Google Sheets publik untuk memasukkan data karyawan sekaligus ke sistem.
            </p>
          </div>

          {/* Panel hasil dirender kalau ADA data mentah (rawRows terbaca) WALAUPUN
              importRows kosong — sebelumnya hanya cek importRows, sehingga saat
              semua baris duplikat / kolom tidak dikenali, preview data mentah
              tidak pernah muncul (gejala "preview belum muncul"). */}
          {!importRawHeaders.length ? (
            <>
              {/* Pilihan Sumber: File vs Google Sheets */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-xs">
                <button
                  type="button"
                  onClick={() => setImportSource("file")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    importSource === "file"
                      ? "bg-white text-[#941A0B] shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="fa-solid fa-file-csv mr-1.5" />
                  Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setImportSource("sheet")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    importSource === "sheet"
                      ? "bg-white text-[#941A0B] shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="fa-brands fa-google mr-1.5 text-emerald-600" />
                  Google Sheets
                </button>
              </div>

              {importSource === "file" ? (
                <div className="text-center space-y-4 p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={(e) => handleImportFile(e.target.files?.[0])}
                    className="hidden"
                  />
                  <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-[#941A0B] flex items-center justify-center text-2xl">
                    <i className="fa-solid fa-cloud-arrow-up" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => importFileRef.current?.click()}
                      disabled={importBusy}
                      className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold px-6 py-3 rounded-xl text-sm transition disabled:opacity-50 cursor-pointer shadow-md inline-flex items-center gap-2 active:scale-95"
                    >
                      <i className={`fa-solid ${importBusy ? "fa-circle-notch fa-spin" : "fa-folder-open"}`} />
                      <span>{importBusy ? "Membaca file..." : "Pilih File Excel / CSV"}</span>
                    </button>
                    {importFileName && (
                      <p className="text-xs text-slate-600 font-semibold mt-2">
                        File terpilih: <span className="text-[#941A0B] font-mono">{importFileName}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">
                      Mendukung file .xlsx, .xls, .csv dengan format header kolom standar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-6 border border-slate-200 rounded-2xl bg-slate-50/50">
                  <div>
                    <label className={labelCls}>Tautan Google Sheets</label>
                    <input
                      type="url"
                      value={importSheetUrl}
                      onChange={(e) => setImportSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <i className="fa-solid fa-circle-info text-blue-500" />
                      <span>Pastikan sheet di-share ke &quot;Siapa saja yang memiliki link (Anyone with the link can view)&quot;.</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportSheetUrl()}
                    disabled={importBusy || !importSheetUrl.trim()}
                    className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold px-6 py-3 rounded-xl text-sm transition disabled:opacity-50 cursor-pointer shadow-md inline-flex items-center gap-2 active:scale-95"
                  >
                    <i className={`fa-solid ${importBusy ? "fa-circle-notch fa-spin" : "fa-table"}`} />
                    <span>{importBusy ? "Membaca sheet..." : "Baca Google Sheets"}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Hasil parse: ringkasan + baris interaktif */}
              {(() => {
                const readyRows = importRows.filter((r) => !r.isRegistered);
                const registeredRows = importRows.filter((r) => r.isRegistered);

                return (
                  <div className="space-y-5">
                    {/* Header Ringkasan Import */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            readyRows.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              readyRows.length ? "fa-check" : "fa-triangle-exclamation"
                            } text-base`}
                          />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {importRows.length} Baris Data Terbaca
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {readyRows.length} Siap Diimpor
                            </span>
                            {registeredRows.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                {registeredRows.length} Sudah Terdaftar
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Kolom dikenali:{" "}
                            <span className="font-semibold text-slate-700">
                              {importMatchedHeaders.length ? importMatchedHeaders.join(", ") : "Tidak ada"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                        {registeredRows.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearRegisteredRows}
                            className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                            title="Hapus semua baris yang sudah terdaftar dari daftar pratinjau"
                          >
                            <i className="fa-solid fa-broom" />
                            <span>Hapus Terdaftar ({registeredRows.length})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleResetImport}
                          className="text-xs font-bold text-slate-600 hover:bg-slate-200 px-3.5 py-2 rounded-lg transition border border-slate-300 cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                          <i className="fa-solid fa-arrow-left" />
                          <span>Ganti Sumber File / Link</span>
                        </button>
                      </div>
                    </div>

                    {/* Tabel Pratinjau Interaktif */}
                    {importRows.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                            <i className="fa-solid fa-table-list text-[#941A0B]" />
                            <span>Pratinjau Data Karyawan Siap Impor</span>
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Menampilkan seluruh {importRows.length} baris
                          </span>
                        </div>

                        <div className="overflow-x-auto max-w-full border border-slate-200 rounded-xl shadow-2xs bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F8F9FA] text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="px-3.5 py-3 whitespace-nowrap w-24">No. Baris</th>
                                <th className="px-3.5 py-3 whitespace-nowrap w-36">Status</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Nama Karyawan</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Jabatan / Kategori</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Kontak (WA & Email)</th>
                                <th className="px-3.5 py-3 whitespace-nowrap">Jadwal / Mulai</th>
                                <th className="px-3.5 py-3 whitespace-nowrap text-center w-16">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {importRows.map((row, idx) => {
                                const isDup = !!row.isRegistered;
                                return (
                                  <tr
                                    key={idx}
                                    className={`transition ${
                                      isDup
                                        ? "bg-amber-50/60 hover:bg-amber-100/50 border-l-4 border-l-amber-500"
                                        : "hover:bg-slate-50/80"
                                    }`}
                                  >
                                    {/* No. Baris */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                      <span className="font-extrabold text-slate-900">#{idx + 1}</span>
                                      <span className="block text-[11px] font-mono text-slate-400">
                                        Baris {row.sheetRowIndex ?? idx + 2}
                                      </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                      {isDup ? (
                                        <div>
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            <i className="fa-solid fa-triangle-exclamation text-amber-600 text-[10px]" />
                                            Sudah Terdaftar
                                          </span>
                                          {row.registeredReason && (
                                            <span
                                              className="block text-[10px] text-amber-700 font-medium mt-0.5 max-w-[200px] truncate"
                                              title={row.registeredReason}
                                            >
                                              {row.registeredReason}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]" />
                                          Siap Diimpor
                                        </span>
                                      )}
                                    </td>

                                    {/* Nama Karyawan */}
                                    <td className="px-3.5 py-2.5">
                                      <div className="font-bold text-slate-900">{row.namaLengkap}</div>
                                      {row.namaPanggilan && (
                                        <span className="text-[11px] text-slate-500">
                                          Panggilan: {row.namaPanggilan}
                                        </span>
                                      )}
                                    </td>

                                    {/* Jabatan / Kategori */}
                                    <td className="px-3.5 py-2.5">
                                      <div className="font-medium text-slate-800">{row.jabatan || "-"}</div>
                                      <span className="text-[11px] text-slate-500">{row.kategori || "-"}</span>
                                    </td>

                                    {/* Kontak */}
                                    <td className="px-3.5 py-2.5">
                                      <div className="font-mono text-slate-700 text-[11px]">
                                        {row.nomorTeleponSuffix ? `0${row.nomorTeleponSuffix}` : "-"}
                                      </div>
                                      <div
                                        className="text-slate-500 text-[11px] truncate max-w-[180px]"
                                        title={row.email}
                                      >
                                        {row.email || "-"}
                                      </div>
                                    </td>

                                    {/* Jadwal / Mulai */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                      <span className="font-medium text-slate-700">{row.tipeJadwal || "-"}</span>
                                      <span className="block text-[11px] text-slate-400">
                                        {row.startDate ? formatDateIndo(row.startDate) : "-"}
                                      </span>
                                    </td>

                                    {/* Aksi Hapus */}
                                    <td className="px-3.5 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteImportRow(idx)}
                                        title="Hapus baris ini dari pratinjau"
                                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 transition cursor-pointer active:scale-90"
                                      >
                                        <i className="fa-solid fa-trash text-xs" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5" />
                        <div>
                          <strong>Data kosong:</strong> Tidak ada baris data valid yang terbaca. Pastikan sheet/file memiliki header yang sesuai (mis. Nama Lengkap, No HP, Email).
                        </div>
                      </div>
                    )}

                    {/* Pratinjau Kolom Mentah Asli (Collapsible) */}
                    {importRawHeaders.length > 0 && (
                      <details className="group border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <summary className="text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-between select-none">
                          <span className="flex items-center gap-2">
                            <i className="fa-solid fa-file-lines text-slate-400" />
                            <span>Pratinjau Data Mentah Asli dari File (Maks. 5 Baris Pertama)</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Total: {importRawCount} baris
                          </span>
                        </summary>
                        <div className="mt-3 overflow-x-auto max-w-full border border-slate-200 rounded-lg shadow-2xs">
                          <table className="text-left text-[11px]">
                            <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                {importRawHeaders.map((h, i) => (
                                  <th key={`${h}-${i}`} className="px-3.5 py-2 whitespace-nowrap max-w-[180px] truncate">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {importRawPreview.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  {importRawHeaders.map((_, c) => (
                                    <td key={c} className="px-3.5 py-2 text-slate-700 max-w-[180px] truncate font-medium" title={row[c] || "-"}>
                                      {row[c] || "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}

                    {/* Informasi Duplikasi */}
                    {registeredRows.length > 0 && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                        <i className="fa-solid fa-circle-info text-amber-600 mt-0.5" />
                        <div>
                          <strong>Pemberitahuan Duplikasi:</strong> Sebanyak <strong>{registeredRows.length} baris</strong> terdeteksi sudah terdaftar (nomor telepon/WA atau email cocok dengan data di sistem atau duplikat dalam sheet). Baris tersebut di-highlight dan akan <strong>otomatis dilewati</strong> (tidak diimpor ulang) saat penyimpanan. Anda juga dapat menghapusnya melalui tombol aksi hapus atau tombol <em>Hapus Terdaftar</em> di atas.
                        </div>
                      </div>
                    )}

                    {/* Tombol Simpan / Aksi Bawah */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200">
                      {importLastSheetUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setImportSource("sheet");
                            setImportSheetUrl(importLastSheetUrl);
                            setImportDupSkipped(0);
                            handleImportSheetUrl(importLastSheetUrl);
                          }}
                          disabled={importBusy || importSaving}
                          className="text-[#941A0B] bg-red-50 hover:bg-red-100 font-bold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-rotate-right" />
                          <span>Ambil Ulang dari Sheets Terakhir</span>
                        </button>
                      ) : (
                        <span />
                      )}

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={handleSaveImportRows}
                          disabled={importBusy || importSaving || readyRows.length === 0}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
                        >
                          <i className={`fa-solid ${importSaving ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                          <span>
                            {importSaving
                              ? "Menyimpan..."
                              : readyRows.length > 0
                              ? `Simpan ${readyRows.length} Baris Baru ke Direktori`
                              : "Tidak Ada Baris Baru untuk Disimpan"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ======== MODAL: GANTI PIN LOGIN ======== */}
      {showPinModal && pinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="font-bold text-base text-black flex items-center gap-2">
                <i className="fa-solid fa-key text-[#941A0B]" />
                <span>Ganti PIN Login</span>
              </h3>
              <button type="button" onClick={() => { setShowPinModal(false); setPinOld(""); setPinNew(""); setPinConfirm(""); }} className="text-slate-400 hover:text-slate-700">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
              <span className="text-slate-500">Karyawan: </span>
              <span className="font-bold text-black">{pinTarget.namaLengkap}</span>
              <span className="text-slate-400 ml-2 font-mono text-xs">({pinTarget.idKaryawan})</span>
            </div>

            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className={labelCls}>PIN Lama</label>
                <input
                  type="password"
                  value={pinOld}
                  onChange={(e) => setPinOld(e.target.value)}
                  maxLength={8}
                  placeholder="Masukkan PIN lama"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>PIN Baru (Min. 4 digit)</label>
                <input
                  type="password"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value)}
                  maxLength={8}
                  placeholder="Masukkan PIN baru"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Konfirmasi PIN Baru</label>
                <input
                  type="password"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  maxLength={8}
                  placeholder="Ulangi PIN baru"
                  className={`${inputCls} ${pinConfirm && pinConfirm !== pinNew ? "border-red-500 focus:ring-red-500" : ""}`}
                  required
                />
                {pinConfirm && pinConfirm !== pinNew && (
                  <p className="text-red-600 text-xs mt-1 font-medium">PIN tidak cocok!</p>
                )}
              </div>

              <div className="pt-2 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setShowPinModal(false); setPinOld(""); setPinNew(""); setPinConfirm(""); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F1F1F1] text-slate-600 hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPin || pinNew !== pinConfirm}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-[#941A0B] text-white hover:bg-[#7D1509] disabled:opacity-50 flex items-center gap-2"
                >
                  <i className={`fa-solid ${savingPin ? "fa-circle-notch fa-spin" : "fa-check"}`} />
                  {savingPin ? "Menyimpan..." : "Simpan PIN Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
