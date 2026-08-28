"use client";

import { useState, useEffect } from "react";

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

export default function InputKaryawanPage() {
  const [activeTab, setActiveTab] = useState<"input" | "edit" | "direktori">("input");

  // Multi-Form Input Kolektif State
  const [forms, setForms] = useState<FormKaryawan[]>([createDefaultForm(1, true)]);
  const [submitting, setSubmitting] = useState(false);

  // Perubahan Data (Edit) State
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [searchEditId, setSearchEditId] = useState("");
  const [targetEmployee, setTargetEmployee] = useState<any | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([{ field: "", value: "" }]);
  const [savingEdit, setSavingEdit] = useState(false);

  // PIN Change Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<any | null>(null);
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  // Direktori search
  const [dirSearch, setDirSearch] = useState("");

  useEffect(() => {
    loadAllEmployees();
  }, []);

  async function loadAllEmployees() {
    try {
      const res = await fetch("/api/employees");
      const d = await res.json();
      if (Array.isArray(d)) {
        setEmployeeList(d);
      } else if (d.status === "success" && Array.isArray(d.data)) {
        setEmployeeList(d.data);
      }
    } catch {
      // ignore
    }
  }

  // Add new form (up to 10)
  function handleAddForm() {
    if (forms.length >= 10) {
      alert("⚠️ Maksimal 10 data karyawan dalam satu kali proses upload.");
      return;
    }
    const updated = forms.map((f) => ({ ...f, isExpanded: false }));
    const newId = forms.length > 0 ? Math.max(...forms.map((f) => f.id)) + 1 : 1;
    setForms([...updated, createDefaultForm(newId, true)]);
  }

  function handleRemoveForm(id: number) {
    if (forms.length <= 1) {
      alert("Minimal harus ada 1 form untuk diisi.");
      return;
    }
    if (confirm(`Hapus formulir data #${id}?`)) {
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
    if (file.size > 5 * 1024 * 1024) { alert("⚠️ Ukuran file maksimal 5MB."); return; }
    const reader = new FileReader();
    reader.onload = () => updateFormField(id, field, reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmitMultiForm(e: React.FormEvent) {
    e.preventDefault();
    for (const f of forms) {
      if (!f.namaLengkap.trim()) { alert(`⚠️ Nama Lengkap pada Formulir #${f.id} wajib diisi.`); return; }
      if (!f.email.trim()) { alert(`⚠️ Email pada Formulir #${f.id} wajib diisi.`); return; }
      if (!f.jabatan) { alert(`⚠️ Jabatan pada Formulir #${f.id} wajib dipilih.`); return; }
      if (!f.nik.trim()) { alert(`⚠️ NIK KTP pada Formulir #${f.id} wajib diisi.`); return; }
    }

    setSubmitting(true);
    try {
      const items = forms.map((f) => ({
        namaLengkap: f.namaLengkap,
        namaPanggilan: f.namaPanggilan,
        gender: f.gender,
        tempatLahir: f.tempatLahir,
        tanggalLahir: f.tanggalLahir,
        agama: f.agama,
        nomorTelepon: `62${f.nomorTeleponSuffix}`,
        emergencyContact: `62${f.emergencyContactSuffix}`,
        email: f.email,
        statusPerkawinan: f.statusPerkawinan,
        riwayatPenyakit: f.riwayatPenyakit,
        jabatan: f.jabatan,
        kategori: f.kategori,
        tipeJadwal: f.tipeJadwal,
        startDate: f.startDate,
        endDate: f.endDate,
        statusAktif: f.statusAktif,
        nik: f.nik,
        npwp: f.npwp,
        statusPtkp: f.statusPtkp,
        alamatKtp: f.alamatKtp,
        alamatDomisili: f.alamatDomisili,
        namaBank: f.namaBank,
        nomorRekening: f.nomorRekening,
        namaPemilikRek: f.namaPemilikRek,
        scanKtpDriveId: f.scanKtp,
        scanKkDriveId: f.scanKk,
        scanNpwpDriveId: f.scanNpwp,
      }));

      const res = await fetch("/api/employees?action=bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (res.ok) {
        alert(`✅ Berhasil menyimpan ${forms.length} data karyawan baru ke sistem!`);
        setForms([createDefaultForm(1, true)]);
        loadAllEmployees();
      } else {
        const err = await res.json();
        alert(`❌ Gagal menyimpan data: ${err.message || "Terjadi kesalahan"}`);
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectTargetEmployee(customEmp?: any) {
    let target: any | null = customEmp || null;

    if (!target && searchEditId.trim()) {
      const raw = searchEditId.trim();
      const q = raw.toLowerCase();

      // 1. Check if raw contains [ID:...] tag or direct ID
      const idTagMatch = raw.match(/\[ID:([^\]]+)\]/i);
      const extractedId = idTagMatch ? idTagMatch[1].trim() : raw;
      target = employeeList.find((e) => e.id === extractedId || (e.id && e.id.toLowerCase() === q) || (e.idKaryawan && e.idKaryawan.toLowerCase() === q)) || null;

      // 2. Multi-token comprehensive matching
      if (!target) {
        const parts = q.split(/[-–|()]/).map((p) => p.trim()).filter(Boolean);
        const firstPart = parts[0] || q;

        target = employeeList.find((e) => {
          const eId = (e.id || "").toLowerCase();
          const eIdKaryawan = (e.idKaryawan || "").toLowerCase();
          const eName = (e.namaLengkap || "").toLowerCase();
          const eJabatan = (e.jabatan || "").toLowerCase();
          const eFull = `${eIdKaryawan} ${eName} ${eJabatan}`.toLowerCase();

          return (
            eId === q ||
            eIdKaryawan === q ||
            eIdKaryawan === firstPart ||
            eIdKaryawan.includes(firstPart) ||
            firstPart.includes(eIdKaryawan) ||
            eName === q ||
            eName.includes(q) ||
            eName.includes(firstPart) ||
            firstPart.includes(eName) ||
            eFull.includes(firstPart) ||
            q.includes(eName) ||
            q.includes(eIdKaryawan) ||
            (eJabatan && q.includes(eJabatan))
          );
        }) || null;
      }
    }

    if (target) {
      setTargetEmployee(target);
      setSearchEditId(`${target.idKaryawan} - ${target.namaLengkap}`);
      setEditRows([{ field: "NAMA_LENGKAP", value: target.namaLengkap || "" }]);
    } else {
      alert("⚠️ Karyawan dengan ID atau Nama tersebut tidak ditemukan.");
    }
  }

  function handleAddEditRow() {
    setEditRows([...editRows, { field: "", value: "" }]);
  }

  function handleRemoveEditRow(idx: number) {
    if (editRows.length <= 1) return;
    setEditRows(editRows.filter((_, i) => i !== idx));
  }

  function handleUpdateEditRow(idx: number, field: string, value: string) {
    const updated = [...editRows];
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
      const res = await fetch(`/api/employees?id=${targetEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert("✅ Data karyawan berhasil diperbarui!");
        setTargetEmployee(null);
        setSearchEditId("");
        setEditRows([{ field: "", value: "" }]);
        loadAllEmployees();
      } else {
        const err = await res.json();
        alert(`❌ Gagal memperbarui data: ${err.message || "Terjadi kesalahan"}`);
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi ke server.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinTarget) return;
    if (pinNew !== pinConfirm) { alert("⚠️ PIN baru dan konfirmasi PIN tidak cocok."); return; }
    if (pinNew.length < 4) { alert("⚠️ PIN minimal 4 digit."); return; }

    setSavingPin(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin: pinOld || undefined,
          newPin: pinNew,
          targetEmail: pinTarget.email,
          targetUserId: pinTarget.userId || pinTarget.id,
        }),
      });
      const d = await res.json();
      if (res.ok && d.status === "success") {
        alert(`✅ PIN Login untuk ${pinTarget.namaLengkap} berhasil diperbarui!`);
        setShowPinModal(false);
        setPinOld(""); setPinNew(""); setPinConfirm(""); setPinTarget(null);
      } else {
        alert(`❌ ${d.message || "Gagal mengubah PIN."}`);
      }
    } catch {
      alert("⚠️ Gagal mengubah PIN. Periksa koneksi server.");
    } finally {
      setSavingPin(false);
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
                        <input type="text" value={item.namaLengkap} onChange={(e) => updateFormField(item.id, "namaLengkap", e.target.value)} className={inputCls} required />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Panggilan</label>
                        <input type="text" value={item.namaPanggilan} onChange={(e) => updateFormField(item.id, "namaPanggilan", e.target.value)} className={inputCls} />
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
                        <input type="text" value={item.tempatLahir} onChange={(e) => updateFormField(item.id, "tempatLahir", e.target.value)} className={inputCls} />
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
                              // hanya angka
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              updateFormField(item.id, "nomorTeleponSuffix", val);
                            }}
                            placeholder="81234567890"
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
                            placeholder="81234567890"
                            className="flex-1 border border-slate-300 rounded-r-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#941A0B] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Email *</label>
                        <input type="email" value={item.email} onChange={(e) => updateFormField(item.id, "email", e.target.value)} className={inputCls} required />
                      </div>
                      <div>
                        <label className={labelCls}>Status Perkawinan</label>
                        <select value={item.statusPerkawinan} onChange={(e) => updateFormField(item.id, "statusPerkawinan", e.target.value)} className={selectCls}>
                          {["Belum Kawin", "Kawin Tercatat", "Cerai Hidup", "Cerai Mati"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Riwayat Penyakit</label>
                        <input type="text" value={item.riwayatPenyakit} onChange={(e) => updateFormField(item.id, "riwayatPenyakit", e.target.value)} placeholder="Isi '-' jika tidak ada" className={inputCls} />
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
                        <input type="text" value={item.nik} onChange={(e) => updateFormField(item.id, "nik", e.target.value)} maxLength={16} className={inputCls} required />
                      </div>
                      <div>
                        <label className={labelCls}>NPWP</label>
                        <input type="text" value={item.npwp} onChange={(e) => updateFormField(item.id, "npwp", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Status PTKP</label>
                        <select value={item.statusPtkp} onChange={(e) => updateFormField(item.id, "statusPtkp", e.target.value)} className={selectCls}>
                          {["TK/0","TK/1","TK/2","TK/3","K/0","K/1","K/2","K/3"].map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Alamat KTP</label>
                        <input type="text" value={item.alamatKtp} onChange={(e) => updateFormField(item.id, "alamatKtp", e.target.value)} className={inputCls} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Alamat Domisili</label>
                        <input type="text" value={item.alamatDomisili} onChange={(e) => updateFormField(item.id, "alamatDomisili", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Bank</label>
                        <select value={item.namaBank} onChange={(e) => updateFormField(item.id, "namaBank", e.target.value)} className={selectCls}>
                          {BANK_LIST.map((b) => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Nomor Rekening</label>
                        <input type="text" value={item.nomorRekening} onChange={(e) => updateFormField(item.id, "nomorRekening", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Nama Pemilik Rekening</label>
                        <input type="text" value={item.namaPemilikRek} onChange={(e) => updateFormField(item.id, "namaPemilikRek", e.target.value)} className={inputCls} />
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
                    list="listPegawaiEdit"
                    type="text"
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
                        handleSelectTargetEmployee();
                      }
                    }}
                    placeholder="Masukkan Nama atau ID Karyawan..."
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

                <datalist id="listPegawaiEdit">
                  {employeeList.map((emp) => (
                    <option key={emp.id} value={`${emp.idKaryawan} - ${emp.namaLengkap} (${emp.jabatan})`} />
                  ))}
                </datalist>

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
                  handleSelectTargetEmployee();
                }}
                className="bg-[#941A0B] hover:bg-[#7D1509] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-md shrink-0"
              >
                <i className="fa-solid fa-pen-to-square" />
                <span>Rubah Data</span>
              </button>
            </div>
          </div>

          {/* Target Employee Banner */}
          {targetEmployee && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
                Target Karyawan Terpilih
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">ID Karyawan</span>
                  <div className="font-mono font-bold text-base text-[#FA3737]">{targetEmployee.idKaryawan}</div>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Nama Lengkap</span>
                  <div className="font-bold text-base">{targetEmployee.namaLengkap}</div>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-0.5">Jabatan</span>
                  <div className="font-bold text-base text-slate-200">{targetEmployee.jabatan || "–"}</div>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { setPinTarget(targetEmployee); setShowPinModal(true); }}
                    className="text-xs font-bold text-white bg-[#941A0B] hover:bg-[#7D1509] px-4 py-2 rounded-xl flex items-center gap-2 transition"
                  >
                    <i className="fa-solid fa-key" />
                    <span>Ganti PIN Login</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Column Updater */}
          {targetEmployee && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-extrabold text-black mb-4 border-b border-slate-100 pb-2">Perbarui Kolom Data</h2>
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div className="space-y-3">
                  {editRows.map((row, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="w-full sm:w-1/3">
                        <select
                          value={row.field}
                          onChange={(e) => handleUpdateEditRow(idx, e.target.value, "")}
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

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button type="submit" disabled={savingEdit} className="bg-[#941A0B] hover:bg-[#7D1509] text-white font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center gap-2 text-sm disabled:opacity-50">
                    <i className={`fa-solid ${savingEdit ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                    <span>{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </form>
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
                          onClick={() => {
                            setActiveTab("edit");
                            setSearchEditId(emp.idKaryawan);
                            setTargetEmployee(emp);
                            setEditRows([{ field: "NAMA_LENGKAP", value: emp.namaLengkap || "" }]);
                          }}
                          className="text-[#941A0B] hover:bg-red-50 p-1.5 rounded-lg transition text-xs"
                          title="Edit Data"
                        >
                          <i className="fa-solid fa-pen" />
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
                  <div><span className="text-slate-400 block">Tanggal Lahir</span><span className="font-bold text-black">{detailEmployee.tanggalLahir || "-"}</span></div>
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
                  <div><span className="text-slate-400 block">Mulai Kerja</span><span className="font-bold text-black">{detailEmployee.startDate || "-"}</span></div>
                  <div><span className="text-slate-400 block">Akhir Kontrak</span><span className="font-bold text-black">{detailEmployee.endDate || "-"}</span></div>
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
