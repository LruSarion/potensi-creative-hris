"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";

interface KPIRow {
  rowIndex: number;
  id: string;
  idKaryawan: string;
  karyawanDbId: string;
  namaLengkap: string;
  jabatan: string;
  periode: string;
  // Streamer indicators
  productKnowledge?: number;
  interaksiDanPenampilan?: number;
  metrikObjektif?: number;
  keterampilanImprovisasi?: number;
  kemampuanKomunikasi?: number;
  professionalismDanOrganism?: number;
  // OTS indicators
  setupTeknis?: number;
  kedisiplinanWaktu?: number;
  troubleshooting?: number;
  kerjasamaTim?: number;
  kebersihanStudio?: number;
  dokumentasiQc?: number;
  // Common
  totalSkor: number;
  catatanEvaluasi: string;
  idPenilaian: string;
  penilai: string;
  hasRating: boolean;
}

export default function PenilaianSDMPage() {
  const { data: session } = useSession();
  const userRole = (session?.user?.role || "").toUpperCase();
  const isRater = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "QC_MANAGER", "QC_REVIEWER", "TRAINER"].includes(userRole);

  // Tabs state
  const [activeTab, setActiveTab] = useState<"streamer" | "ots">("streamer");

  // Data state
  const [rawKpiData, setRawKpiData] = useState<KPIRow[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchName, setSearchName] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");

  // Pending changes state (keyed by karyawanDbId)
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<KPIRow>>>({});
  const [savingBatch, setSavingBatch] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Modals state
  const [modalCatatanText, setModalCatatanText] = useState<string | null>(null);
  const [modalPenilaiInfo, setModalPenilaiInfo] = useState<{ idPenilaian: string; namaPenilai: string } | null>(null);

  // Edit Modal state
  const [editingRow, setEditingRow] = useState<KPIRow | null>(null);
  const [editForm, setEditForm] = useState({
    val1: 80,
    val2: 80,
    val3: 80,
    val4: 80,
    val5: 80,
    val6: 80,
    catatan: "",
  });

  useEffect(() => {
    fetchMatrixData();
  }, [activeTab, filterPeriode]);

  async function fetchMatrixData() {
    try {
      setLoading(true);
      const roleParam = activeTab === "ots" ? "&role=OTS" : "&role=STREAMER";
      const periodeParam = filterPeriode ? `&periode=${encodeURIComponent(filterPeriode)}` : "";
      const url = `/api/penilaian-sdm?view=matrix${roleParam}${periodeParam}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && Array.isArray(data.rows)) {
        setRawKpiData(data.rows);
        if (Array.isArray(data.periods)) {
          setPeriods(data.periods);
          if (!filterPeriode && data.periods.length > 0) {
            setFilterPeriode(data.periods[0]);
          }
        }
      }
    } catch (err) {
      console.error("Gagal memuat data KPI:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate composite weighted total score (Ref-deploy standard: 20%, 20%, 20%, 15%, 15%, 10%)
  function calculateTotal(
    v1: number,
    v2: number,
    v3: number,
    v4: number,
    v5: number,
    v6: number
  ) {
    if (!v1 && !v2 && !v3 && !v4 && !v5 && !v6) return 0;
    return Math.round(
      v1 * 0.2 +
        v2 * 0.2 +
        v3 * 0.2 +
        v4 * 0.15 +
        v5 * 0.15 +
        v6 * 0.1
    );
  }

  // Traffic Light Badge styling
  function getScoreBadge(score: number) {
    if (!score) return "bg-slate-100 text-slate-500 border border-slate-200";
    if (score >= 80) return "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold";
    if (score >= 60) return "bg-amber-100 text-amber-800 border border-amber-300 font-bold";
    return "bg-red-100 text-red-800 border border-red-300 font-bold";
  }

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rawKpiData.filter((row) => {
      const currentPending = pendingChanges[row.karyawanDbId] || {};
      const mergedRow = { ...row, ...currentPending };

      // Search name
      if (searchName) {
        const q = searchName.toLowerCase();
        const matchName = mergedRow.namaLengkap.toLowerCase().includes(q) || mergedRow.idKaryawan.toLowerCase().includes(q);
        if (!matchName) return false;
      }

      // Filter periode
      if (filterPeriode && filterPeriode !== "Semua") {
        if (mergedRow.periode !== filterPeriode) return false;
      }

      return true;
    });
  }, [rawKpiData, pendingChanges, searchName, filterPeriode]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;

  // Open Edit Modal
  function openEditModal(row: KPIRow) {
    const currentPending = pendingChanges[row.karyawanDbId] || {};
    const merged = { ...row, ...currentPending };

    setEditingRow(row);
    if (activeTab === "ots") {
      setEditForm({
        val1: merged.setupTeknis || 80,
        val2: merged.kedisiplinanWaktu || 80,
        val3: merged.troubleshooting || 80,
        val4: merged.kerjasamaTim || 80,
        val5: merged.kebersihanStudio || 80,
        val6: merged.dokumentasiQc || 80,
        catatan: merged.catatanEvaluasi || "",
      });
    } else {
      setEditForm({
        val1: merged.productKnowledge || 80,
        val2: merged.interaksiDanPenampilan || 80,
        val3: merged.metrikObjektif || 80,
        val4: merged.keterampilanImprovisasi || 80,
        val5: merged.kemampuanKomunikasi || 80,
        val6: merged.professionalismDanOrganism || 80,
        catatan: merged.catatanEvaluasi || "",
      });
    }
  }

  // Save temporary change in pendingChanges
  function saveTemporaryEdit() {
    if (!editingRow) return;

    const total = calculateTotal(
      Number(editForm.val1),
      Number(editForm.val2),
      Number(editForm.val3),
      Number(editForm.val4),
      Number(editForm.val5),
      Number(editForm.val6)
    );

    const updatePayload = activeTab === "ots" ? {
      setupTeknis: Number(editForm.val1),
      kedisiplinanWaktu: Number(editForm.val2),
      troubleshooting: Number(editForm.val3),
      kerjasamaTim: Number(editForm.val4),
      kebersihanStudio: Number(editForm.val5),
      dokumentasiQc: Number(editForm.val6),
      totalSkor: total,
      catatanEvaluasi: editForm.catatan,
      periode: filterPeriode || editingRow.periode,
    } : {
      productKnowledge: Number(editForm.val1),
      interaksiDanPenampilan: Number(editForm.val2),
      metrikObjektif: Number(editForm.val3),
      keterampilanImprovisasi: Number(editForm.val4),
      kemampuanKomunikasi: Number(editForm.val5),
      professionalismDanOrganism: Number(editForm.val6),
      totalSkor: total,
      catatanEvaluasi: editForm.catatan,
      periode: filterPeriode || editingRow.periode,
    };

    setPendingChanges((prev) => ({
      ...prev,
      [editingRow.karyawanDbId]: updatePayload,
    }));

    setEditingRow(null);
  }

  // Cancel all pending changes
  function cancelAllChanges() {
    setPendingChanges({});
  }

  // Submit batch to server
  async function submitBatchToServer() {
    const itemsToSave = Object.entries(pendingChanges).map(([karyawanDbId, changes]) => ({
      karyawanId: karyawanDbId,
      tipeRole: activeTab === "ots" ? ("OTS" as const) : ("STREAMER" as const),
      productKnowledge: changes.productKnowledge,
      interaksiPenampilan: changes.interaksiDanPenampilan,
      metrikObjektif: changes.metrikObjektif,
      keterampilanImprovisasi: changes.keterampilanImprovisasi,
      kemampuanKomunikasi: changes.kemampuanKomunikasi,
      professionalism: changes.professionalismDanOrganism,
      setupTeknis: changes.setupTeknis,
      kedisiplinanWaktu: changes.kedisiplinanWaktu,
      troubleshooting: changes.troubleshooting,
      kerjasamaTim: changes.kerjasamaTim,
      kebersihanStudio: changes.kebersihanStudio,
      dokumentasiQc: changes.dokumentasiQc,
      komentar: changes.catatanEvaluasi,
      periode: changes.periode || filterPeriode,
    }));

    if (itemsToSave.length === 0) return;

    setSavingBatch(true);
    try {
      const res = await fetch("/api/penilaian-sdm?action=batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSave }),
      });

      if (res.ok) {
        alert(`✅ Berhasil menyimpan ${itemsToSave.length} data penilaian KPI ke server!`);
        setPendingChanges({});
        fetchMatrixData();
      } else {
        alert("❌ Gagal menyimpan data KPI ke server.");
      }
    } catch {
      alert("⚠️ Terjadi kesalahan koneksi.");
    } finally {
      setSavingBatch(false);
    }
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 text-white">
            <i className="fa-regular fa-star text-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Penilaian SDM</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Evaluasi performa dan kedisiplinan Streamer & Tim OTS berbasis 6 matriks KPI berbobot.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMatrixData}
          className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
          title="Refresh Data"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
        </button>
      </div>

      {/* Main Tabs (Streamer vs OTS) */}
      <div className="border-b border-slate-200 flex gap-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab("streamer");
            setPendingChanges({});
            setCurrentPage(1);
          }}
          className={`pb-3 border-b-2 font-bold px-2 text-sm transition-all focus:outline-none flex items-center gap-2 ${
            activeTab === "streamer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
          }`}
        >
          <i className="fa-solid fa-video" />
          <span>KPI Streamer</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("ots");
            setPendingChanges({});
            setCurrentPage(1);
          }}
          className={`pb-3 border-b-2 font-bold px-2 text-sm transition-all focus:outline-none flex items-center gap-2 ${
            activeTab === "ots"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
          }`}
        >
          <i className="fa-solid fa-headset" />
          <span>KPI OTS (Operator & Support)</span>
        </button>
      </div>

      {/* ======================================================= */}
      {/* FILTER & MATRIX CONTAINER                               */}
      {/* ======================================================= */}
      <div className="space-y-4">
        {/* Filters Bar */}
        <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Cari Nama {activeTab === "ots" ? "OTS / Operator" : "Streamer"}
            </label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={`Ketik nama ${activeTab === "ots" ? "operator OTS..." : "streamer..."}`}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs transition"
              />
              {searchName && (
                <button
                  type="button"
                  onClick={() => setSearchName("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="w-full sm:w-80 relative">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Periode Minggu (Ketik atau Pilih)</label>
            <div className="relative">
              <input
                list="listPeriode"
                value={filterPeriode}
                onChange={(e) => {
                  setFilterPeriode(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Pilih atau ketik periode..."
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium"
              />
              <datalist id="listPeriode">
                {periods.map((p, idx) => (
                  <option key={idx} value={p} />
                ))}
              </datalist>
              {filterPeriode && (
                <button
                  type="button"
                  onClick={() => setFilterPeriode("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Batch Action Bar */}
        {hasPendingChanges && (
          <div className="flex flex-wrap gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm items-center justify-between animate-fade-in">
            <div className="text-xs sm:text-sm font-bold text-blue-900 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-blue-600 text-base" />
              <span>Terdapat {Object.keys(pendingChanges).length} data {activeTab.toUpperCase()} yang diubah dan menunggu untuk disimpan ke server.</span>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={cancelAllChanges}
                className="px-4 py-2 bg-white text-slate-700 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition text-xs shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitBatchToServer}
                disabled={savingBatch}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <i className={`fa-solid ${savingBatch ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                <span>{savingBatch ? "Menyimpan..." : "Simpan Perubahan"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Enterprise Matrix Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[700px] relative">
            <table className="w-full text-xs text-left relative border-collapse min-w-[1200px]">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0 z-20 shadow-2xs border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3.5 text-center w-12 bg-slate-100 sticky left-0 z-30 border-r border-slate-200">NO</th>
                  <th className="px-4 py-3.5 bg-slate-100">{activeTab === "ots" ? "OPERATOR OTS" : "STREAMER"}</th>
                  <th className="px-4 py-3.5 bg-slate-100">PERIODE</th>

                  {activeTab === "ots" ? (
                    <>
                      <th className="px-4 py-3.5 text-center bg-slate-100">SETUP TEKNIS (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">KEDISIPLINAN WAKTU (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">TROUBLESHOOTING (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">KERJASAMA TIM (15%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">KEBERSIHAN STUDIO (15%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">DOKUMENTASI QC (10%)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3.5 text-center bg-slate-100">PRODUCT KNOWLEDGE (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">INTERAKSI & TAMPILAN (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">METRIK OBJEKTIF (20%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">IMPROVISASI (15%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">KOMUNIKASI (15%)</th>
                      <th className="px-4 py-3.5 text-center bg-slate-100">PROFESSIONALISM (10%)</th>
                    </>
                  )}

                  <th className="px-4 py-3.5 text-center bg-slate-100">TOTAL SKOR</th>
                  <th className="px-4 py-3.5 text-center bg-slate-100">EVALUASI</th>
                  <th className="px-4 py-3.5 text-center bg-slate-100">PENILAI</th>
                  {isRater && <th className="px-4 py-3.5 text-center bg-slate-100 sticky right-0 z-20">AKSI</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={isRater ? 13 : 12} className="px-4 py-16 text-center text-slate-400">
                      <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500 mb-3 block" />
                      <span>Memuat matriks data KPI {activeTab === "ots" ? "OTS" : "Streamer"}...</span>
                    </td>
                  </tr>
                ) : paginatedRows.length > 0 ? (
                  paginatedRows.map((row, idx) => {
                    const currentPending = pendingChanges[row.karyawanDbId] || {};
                    const merged = { ...row, ...currentPending };
                    const isModified = Boolean(pendingChanges[row.karyawanDbId]);

                    return (
                      <tr key={row.karyawanDbId} className={`hover:bg-slate-50 transition-colors ${isModified ? "bg-amber-50/60 font-medium" : ""}`}>
                        <td className="px-3 py-3 text-center font-bold text-slate-500 sticky left-0 bg-inherit border-r border-slate-100 z-10">
                          {(currentPage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{merged.namaLengkap}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{merged.idKaryawan} | {merged.jabatan}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                          {merged.periode}
                        </td>

                        {activeTab === "ots" ? (
                          <>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.setupTeknis || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.kedisiplinanWaktu || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.troubleshooting || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.kerjasamaTim || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.kebersihanStudio || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.dokumentasiQc || "–"}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.productKnowledge || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.interaksiDanPenampilan || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.metrikObjektif || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.keterampilanImprovisasi || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.kemampuanKomunikasi || "–"}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{merged.professionalismDanOrganism || "–"}</td>
                          </>
                        )}

                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 text-xs rounded-lg inline-block shadow-2xs ${getScoreBadge(merged.totalSkor)}`}>
                            {merged.totalSkor || "0"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {merged.catatanEvaluasi ? (
                            <button
                              type="button"
                              onClick={() => setModalCatatanText(merged.catatanEvaluasi)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                              <i className="fa-solid fa-book-open" />
                              <span>Catatan</span>
                            </button>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setModalPenilaiInfo({ idPenilaian: merged.idPenilaian, namaPenilai: merged.penilai })}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg transition"
                          >
                            <i className="fa-solid fa-circle-info" />
                            <span>Info</span>
                          </button>
                        </td>
                        {isRater && (
                          <td className="px-4 py-3 text-center sticky right-0 bg-inherit z-10">
                            <button
                              type="button"
                              onClick={() => openEditModal(merged as KPIRow)}
                              className="inline-flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95"
                            >
                              <i className="fa-solid fa-pen" />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isRater ? 13 : 12} className="px-4 py-16 text-center text-slate-400 italic">
                      <i className="fa-regular fa-folder-open text-3xl mb-2 block text-slate-300" />
                      <span>Tidak ada data {activeTab === "ots" ? "OTS" : "streamer"} ditemukan.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200">
            <div className="text-xs text-slate-500 font-bold">
              Menampilkan {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredRows.length)} dari {filteredRows.length} data
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition shadow-2xs"
              >
                <i className="fa-solid fa-chevron-left mr-1" /> Prev
              </button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-700">{currentPage} / {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition shadow-2xs"
              >
                Next <i className="fa-solid fa-chevron-right ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* MODAL: EDIT KPI                                         */}
      {/* ======================================================= */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-pen text-blue-600" />
                <span>Edit KPI {activeTab === "ots" ? "Operator OTS" : "Streamer"}</span>
              </h3>
              <button type="button" onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="font-bold text-slate-900 text-sm">{editingRow.namaLengkap} ({editingRow.idKaryawan})</p>
                <p className="text-xs text-slate-500 mt-0.5">{editingRow.jabatan}</p>
                <p className="text-xs font-semibold text-blue-600 mt-1.5">Periode: {filterPeriode || editingRow.periode}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Setup Teknis" : "Product Knowledge"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val1}
                    onChange={(e) => setEditForm({ ...editForm, val1: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Disiplin Waktu" : "Interaksi & Tampilan"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val2}
                    onChange={(e) => setEditForm({ ...editForm, val2: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Troubleshooting" : "Metrik Objektif"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val3}
                    onChange={(e) => setEditForm({ ...editForm, val3: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Kerjasama Tim" : "Improvisasi"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val4}
                    onChange={(e) => setEditForm({ ...editForm, val4: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Kebersihan Studio" : "Komunikasi"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val5}
                    onChange={(e) => setEditForm({ ...editForm, val5: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {activeTab === "ots" ? "Dokumentasi QC" : "Professionalism"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.val6}
                    onChange={(e) => setEditForm({ ...editForm, val6: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Skor (Auto)</label>
                  <input
                    type="number"
                    readOnly
                    value={calculateTotal(
                      Number(editForm.val1),
                      Number(editForm.val2),
                      Number(editForm.val3),
                      Number(editForm.val4),
                      Number(editForm.val5),
                      Number(editForm.val6)
                    )}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-700 text-center font-bold text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Evaluasi</label>
                <textarea
                  rows={3}
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                  placeholder={`Komentar atau evaluasi performa ${activeTab === "ots" ? "operator OTS..." : "streamer..."}`}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveTemporaryEdit}
                className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md transition"
              >
                Simpan Sementara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: CATATAN EVALUASI                                 */}
      {/* ======================================================= */}
      {modalCatatanText !== null && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-book-open text-blue-600" />
                <span>Catatan Evaluasi</span>
              </h3>
              <button type="button" onClick={() => setModalCatatanText(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {modalCatatanText || "Belum ada catatan evaluasi khusus untuk karyawan ini."}
              </p>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setModalCatatanText(null)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: INFO PENILAI                                     */}
      {/* ======================================================= */}
      {modalPenilaiInfo !== null && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-circle-info text-blue-600" />
                <span>Info Penilai</span>
              </h3>
              <button type="button" onClick={() => setModalPenilaiInfo(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="block font-bold text-slate-400 uppercase text-[10px]">ID Penilaian</span>
                <p className="font-mono font-bold text-slate-800 mt-0.5">{modalPenilaiInfo.idPenilaian}</p>
              </div>
              <div>
                <span className="block font-bold text-slate-400 uppercase text-[10px]">Nama Penilai</span>
                <p className="font-bold text-slate-800 mt-0.5">{modalPenilaiInfo.namaPenilai}</p>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setModalPenilaiInfo(null)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
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
