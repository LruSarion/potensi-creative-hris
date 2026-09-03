"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAlert } from "@/components/ui/custom-alert";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { TableLoadingState } from "@/components/ui/loading-states";
import { toast } from "@/components/ui/toast";

export default function PengajuanIzinPage() {
  const { data: session } = useSession();
  const { showConfirm } = useAlert();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(session?.user?.role || "");

  const [activeTab, setActiveTab] = useState<"ajukan" | "riwayat">("ajukan");

  // Form state
  const [formIzin, setFormIzin] = useState({
    jenis: "CUTI TAHUNAN",
    tanggalMulai: new Date().toISOString().split("T")[0],
    tanggalSelesai: new Date().toISOString().split("T")[0],
    alasan: "",
    buktiB64: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal zoom
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  // Employees for Admin & Submitter
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedKaryawanId, setSelectedKaryawanId] = useState("");

  // Search & Status filters for Riwayat
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadHistory();
    if (isAdmin) {
      loadEmployees();
    }
  }, [isAdmin]);

  async function loadEmployees() {
    try {
      const data = await fetchJson<any[]>("/api/employees");
      if (Array.isArray(data)) {
        setEmployees(data);
      }
    } catch {
      // ignore
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const data = await fetchJson<any>("/api/izin");
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Ukuran berkas maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormIzin((prev) => ({ ...prev, buktiB64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formIzin.alasan.trim()) {
      toast.warning("Mohon isi alasan pengajuan cuti/izin.");
      return;
    }

    setSubmitting(true);
    try {
      await sendJson("/api/izin", "POST", {
        karyawanId: isAdmin && selectedKaryawanId ? selectedKaryawanId : undefined,
        tipeIzin: formIzin.jenis,
        jenis: formIzin.jenis,
        tanggalMulai: new Date(formIzin.tanggalMulai).toISOString(),
        tanggalSelesai: new Date(formIzin.tanggalSelesai).toISOString(),
        alasan: formIzin.alasan,
        lampiranDriveId: formIzin.buktiB64 || undefined,
      });

      toast.success("Pengajuan cuti / izin berhasil dikirim!");
      setFormIzin({
        jenis: "CUTI TAHUNAN",
        tanggalMulai: new Date().toISOString().split("T")[0],
        tanggalSelesai: new Date().toISOString().split("T")[0],
        alasan: "",
        buktiB64: "",
      });
      setSelectedKaryawanId("");
      loadHistory();
      setActiveTab("riwayat");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengajukan izin"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id: string, approve: boolean) {
    const confirmed = await showConfirm(`Yakin ingin ${approve ? "MENYETUJUI" : "MENOLAK"} pengajuan cuti/izin ini?`);
    if (!confirmed) return;
    try {
      await sendJson(`/api/izin?id=${id}&approve=${approve}`, "PATCH");
      toast.success(approve ? "Pengajuan cuti/izin berhasil disetujui!" : "Pengajuan cuti/izin berhasil ditolak.");
      loadHistory();
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat memproses izin."));
    }
  }

  const selectedEmp = employees.find((emp) => emp.id === selectedKaryawanId);

  const filteredHistory = history.filter((h) => {
    if (statusFilter !== "ALL" && h.status !== statusFilter) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const nama = (h.karyawan?.namaLengkap || "").toLowerCase();
    const idKaryawan = (h.karyawan?.idKaryawan || h.karyawanId || "").toLowerCase();
    const alasan = (h.alasan || "").toLowerCase();
    const jenis = (h.tipeIzin || h.jenis || "").toLowerCase();
    return nama.includes(q) || idKaryawan.includes(q) || alasan.includes(q) || jenis.includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start gap-3.5 border-b border-slate-200/80 pb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 mt-0.5 text-white">
          <i className="fa-solid fa-calendar-xmark text-lg" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Pengajuan Cuti & Izin</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Ajukan cuti tahunan, izin sakit, atau keperluan mendesak beserta lampiran bukti.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-2xl bg-slate-100/70 w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("ajukan")}
          className={`py-2 px-6 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "ajukan"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-file-lines text-blue-600" />
          <span>Form Pengajuan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("riwayat")}
          className={`py-2 px-6 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === "riwayat"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left text-purple-600" />
          <span>Riwayat</span>
        </button>
      </div>

      {/* TAB 1: FORM PENGAJUAN */}
      {activeTab === "ajukan" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">Form Cuti / Izin</h3>
            <p className="text-xs text-slate-400 mt-0.5">Lengkapi formulir permohonan izin Anda secara akurat.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Informasi Pemohon */}
            {isAdmin ? (
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <i className="fa-solid fa-user-gear text-blue-600 mr-1.5" />
                      Pemohon / Karyawan Yang Mengajukan
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sebagai Administrator, Anda dapat mengajukan permohonan atas nama diri sendiri atau karyawan lain.
                    </p>
                  </div>
                  {selectedEmp && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                      {selectedEmp.kategori || selectedEmp.jabatan || "Karyawan"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <select
                      value={selectedKaryawanId}
                      onChange={(e) => setSelectedKaryawanId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- Diri Sendiri ({session?.user?.name || "Akun Saya"}) --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.namaLengkap} ({emp.idKaryawan || "No ID"}) - {emp.jabatan || emp.kategori || "Staff"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedEmp ? (
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-black text-xs flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {selectedEmp.fotoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={selectedEmp.fotoUrl} alt={selectedEmp.namaLengkap} className="w-full h-full object-cover" />
                        ) : (
                          <span>{selectedEmp.namaLengkap.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{selectedEmp.namaLengkap}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{selectedEmp.idKaryawan || "–"} • {selectedEmp.jabatan || selectedEmp.kategori || "Staff"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-medium shadow-2xs">
                      <i className="fa-solid fa-circle-user text-blue-600 text-sm" />
                      <span>Pengajuan dicatat untuk akun Anda: <strong>{session?.user?.name || "Super Admin"}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-blue-900">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold shadow-xs">
                  <i className="fa-solid fa-id-card text-sm" />
                </div>
                <div>
                  <div className="font-bold text-sm text-blue-950">
                    Informasi Pemohon: {session?.user?.name || "Karyawan"}
                  </div>
                  <div className="text-blue-700 text-[11px] mt-0.5">
                    Permohonan cuti/izin ini diajukan atas nama Anda dan akan ditinjau oleh Manajemen / Tim HRIS.
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Izin <span className="text-red-500">*</span></label>
                <select
                  value={formIzin.jenis}
                  onChange={(e) => setFormIzin({ ...formIzin, jenis: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                >
                  <option value="CUTI TAHUNAN">Cuti Tahunan</option>
                  <option value="SAKIT">Izin Sakit</option>
                  <option value="KEPERLUAN PRIBADI">Izin Keperluan Pribadi</option>
                  <option value="CUTI MELAHIRKAN">Cuti Melahirkan</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Lampiran Bukti (Surat Dokter, dll)
                  {formIzin.jenis === "SAKIT" && <span className="text-red-500 ml-1 font-bold">*Wajib</span>}
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-300 transition cursor-pointer shadow-2xs">
                    <i className="fa-solid fa-folder-open text-slate-500" />
                    <span>Unggah File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {formIzin.buktiB64 && (
                    <div className="relative border border-slate-200 rounded-xl p-1 bg-slate-50 w-16 h-10 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formIzin.buktiB64}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg cursor-pointer"
                        onClick={() => setPreviewModalImg(formIzin.buktiB64)}
                      />
                      <button
                        type="button"
                        onClick={() => setFormIzin((f) => ({ ...f, buktiB64: "" }))}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">*Opsional, wajib jika memilih Izin Sakit.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Mulai <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formIzin.tanggalMulai}
                  onChange={(e) => setFormIzin({ ...formIzin, tanggalMulai: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Selesai <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formIzin.tanggalSelesai}
                  onChange={(e) => setFormIzin({ ...formIzin, tanggalSelesai: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium cursor-pointer"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Alasan Cuti / Izin <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  value={formIzin.alasan}
                  onChange={(e) => setFormIzin({ ...formIzin, alasan: e.target.value })}
                  placeholder="Keterangan permohonan izin cuti secara jelas..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl text-xs sm:text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <i className={`fa-solid ${submitting ? "fa-circle-notch fa-spin" : "fa-paper-plane"}`} />
                <span>{submitting ? "Mengirim..." : "Kirim Pengajuan"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: RIWAYAT */}
      {activeTab === "riwayat" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Riwayat Cuti & Izin</h3>
              <p className="text-xs text-slate-400 mt-0.5">Daftar rekap dan status permohonan izin Anda.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                Total: {filteredHistory.length} Pengajuan
              </span>
              <button
                type="button"
                onClick={loadHistory}
                className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition text-xs cursor-pointer"
                title="Refresh Data"
              >
                <i className="fa-solid fa-rotate-right" />
              </button>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={isAdmin ? "Cari nama pemohon, ID karyawan, jenis izin, atau alasan..." : "Cari jenis izin atau alasan..."}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-semibold cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">TANGGAL PENGAJUAN</th>
                  {isAdmin && <th className="px-4 py-3 min-w-[200px]">PEMOHON / KARYAWAN</th>}
                  <th className="px-4 py-3">JENIS IZIN</th>
                  <th className="px-4 py-3">RENTANG WAKTU</th>
                  <th className="px-4 py-3">ALASAN</th>
                  <th className="px-4 py-3 text-center">LAMPIRAN</th>
                  <th className="px-4 py-3 text-center">STATUS</th>
                  {isAdmin && <th className="px-4 py-3 text-center min-w-[130px]">AKSI ADMIN</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loadingHistory ? (
                  <TableLoadingState
                    colSpan={isAdmin ? 8 : 6}
                    text="Memuat riwayat permohonan izin & cuti..."
                    subtext="Menyelaraskan data status persetujuan dari server..."
                  />
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((h, idx) => {
                    const startStr = h.tanggalMulai ? new Date(h.tanggalMulai).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";
                    const endStr = h.tanggalSelesai ? new Date(h.tanggalSelesai).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";
                    const createdStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";

                    return (
                      <tr key={h.id || idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">{createdStr}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center flex-shrink-0 border border-blue-200 overflow-hidden shadow-2xs">
                                {h.karyawan?.fotoUrl ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={h.karyawan.fotoUrl}
                                    alt={h.karyawan.namaLengkap}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{(h.karyawan?.namaLengkap || "?").slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs truncate">
                                  {h.karyawan?.namaLengkap || "–"}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-700">
                                    {h.karyawan?.idKaryawan || h.karyawanId || "–"}
                                  </span>
                                  {h.karyawan?.jabatan && (
                                    <span className="text-slate-500 font-sans truncate">• {h.karyawan.jabatan}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3 font-bold text-slate-900">{h.tipeIzin || h.jenis || "IZIN"}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="font-semibold text-slate-800">{startStr}</span>
                          {startStr !== endStr && <span className="text-slate-500"> s/d {endStr}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{h.alasan || "–"}</td>
                        <td className="px-4 py-3 text-center align-middle">
                          {h.lampiranDriveId ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(h.lampiranDriveId)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-file-image" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs uppercase tracking-wide inline-block ${
                            h.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : h.status === "REJECTED"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                            {h.status === "APPROVED" ? "Disetujui" : h.status === "REJECTED" ? "Ditolak" : "Menunggu"}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center align-middle">
                            {h.status === "PENDING" ? (
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleApprove(h.id, true)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(h.id, false)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">Selesai</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="px-4 py-12 text-center text-slate-400 italic">
                      <i className="fa-regular fa-folder-open text-3xl mb-2 block text-slate-300" />
                      {searchFilter || statusFilter !== "ALL"
                        ? "Tidak ada data permohonan yang sesuai dengan filter pencarian."
                        : "Belum ada riwayat permohonan cuti / izin tersimpan."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Zoom Foto */}
      {previewModalImg && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-image text-blue-500" />
                <span>Lampiran Bukti Izin</span>
              </h3>
              <button type="button" onClick={() => setPreviewModalImg(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6 text-center bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg.startsWith("http") || previewModalImg.startsWith("data:") ? previewModalImg : `https://drive.google.com/open?id=${previewModalImg}`}
                alt="Lampiran Bukti"
                className="max-h-80 mx-auto rounded-xl object-contain border border-slate-200 shadow-md bg-white"
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-xl text-xs transition"
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
