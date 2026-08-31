"use client";

import React, { useState } from "react";
import type { TabSharedProps } from "./types";
import { inputCls, selectCls, labelCls } from "./shared-styles";

export function TabHybrid({
  allJadwal,
  fetchData,
  showAlert,
  showConfirm,
  setModalCrashData,
}: TabSharedProps) {
  const [hybridSubTab, setHybridSubTab] = useState<"export" | "import">("export");
  const [hybridImportMode, setHybridImportMode] = useState<"baru" | "revisi">("baru");
  const [hybridImportMethod, setHybridImportMethod] = useState<"excel" | "link">("excel");
  const [hybridLink, setHybridLink] = useState("");
  const [hybridOldId, setHybridOldId] = useState("");
  const [exportTanggal, setExportTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [importData, setImportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Export template / data
  function handleDownloadTemplate() {
    const csvHeader = "ID Jadwal,Tanggal (YYYY-MM-DD),Platform,Brand/Client,Host/Streamer ID,Host/Streamer Nama,Jam Mulai (HH:mm),Jam Selesai (HH:mm),Cabang Studio,Nomor Studio,Device,OTS ID,OTS Nama,Catatan\n";
    const sampleRow = "STR/260831/101,2026-08-31,Shopee Live,Brand A,EMP-001,Nama Host,10:00,12:00,Timoho,Studio 1,Tidak Pakai,EMP-002,Nama OTS,Sample Catatan\n";
    const blob = new Blob([csvHeader + sampleRow], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Template_Jadwal_Hybrid_${exportTanggal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert("✅ Template Jadwal Hybrid berhasil diunduh.");
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (hybridImportMethod === "link" && !hybridLink.trim()) {
      setError("Silakan masukkan URL spreadsheet Google Sheets.");
      return;
    }

    if (importData.length === 0 && hybridImportMethod === "excel") {
      setError("Silakan pilih file Excel / CSV terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      if (hybridImportMethod === "link") {
        const res = await fetch("/api/scheduler-tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import-hybrid-link",
            url: hybridLink,
            mode: hybridImportMode,
            oldId: hybridOldId,
          }),
        });
        const d = await res.json();
        if (d.status === "success") {
          setSuccess(`✅ Berhasil mengimpor ${d.count || 0} jadwal dari spreadsheet!`);
          fetchData();
        } else {
          setError(d.message || "Gagal mengimpor data spreadsheet.");
        }
      } else {
        // Direct batch post
        const res = await fetch("/api/jadwal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: importData, mode: hybridImportMode }),
        });
        const d = await res.json();
        if (d.status === "success" || res.ok) {
          setSuccess(`✅ Berhasil mengimpor ${importData.length} jadwal!`);
          setImportData([]);
          fetchData();
        } else {
          setError(d.message || "Gagal mengimpor data jadwal.");
        }
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat mengimpor data.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length <= 1) {
        showAlert("⚠️ File kosong atau hanya berisi header.");
        return;
      }
      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 8) {
          parsed.push({
            idJadwal: cols[0] || "",
            tanggal: cols[1] || "",
            platform: cols[2] || "Shopee Live",
            streamerNama: cols[5] || "",
            jamMulaiLive: cols[6] || "",
            jamSelesaiLive: cols[7] || "",
            cabangStudio: cols[8] || "Timoho",
            nomorStudio: cols[9] || "01",
            status: "TERJADWAL",
          });
        }
      }
      setImportData(parsed);
      showAlert(`✅ Berhasil membaca ${parsed.length} baris jadwal dari file.`);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setHybridSubTab("export")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            hybridSubTab === "export"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <i className="fa-solid fa-file-export mr-1.5" />
          Export Template Jadwal
        </button>
        <button
          type="button"
          onClick={() => setHybridSubTab("import")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            hybridSubTab === "import"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <i className="fa-solid fa-file-import mr-1.5" />
          Import Jadwal Hybrid
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

      {/* SUBTAB 1: EXPORT */}
      {hybridSubTab === "export" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-download" />
            </div>
            <div>
              <h3 className="font-extrabold text-black text-sm">Unduh Template Ploting Jadwal</h3>
              <p className="text-xs text-slate-500">
                Gunakan template CSV/Excel standar untuk mempermudah ploting jadwal massal
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelCls}>Pilih Tanggal Target</label>
              <input
                type="date"
                value={exportTanggal}
                onChange={(e) => setExportTanggal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full py-2.5 px-6 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <i className="fa-solid fa-file-csv text-emerald-400" />
                Unduh Template CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: IMPORT */}
      {hybridSubTab === "import" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-cloud-arrow-up" />
            </div>
            <div>
              <h3 className="font-extrabold text-black text-sm">Import Jadwal Massal</h3>
              <p className="text-xs text-slate-500">
                Unggah file CSV/Excel atau gunakan integrasi tautan Google Sheets
              </p>
            </div>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Mode Import</label>
                <select
                  value={hybridImportMode}
                  onChange={(e) => setHybridImportMode(e.target.value as any)}
                  className={selectCls}
                >
                  <option value="baru">Jadwal Baru (Insert)</option>
                  <option value="revisi">Revisi Jadwal (Update / Override)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Metode Import</label>
                <select
                  value={hybridImportMethod}
                  onChange={(e) => setHybridImportMethod(e.target.value as any)}
                  className={selectCls}
                >
                  <option value="excel">Unggah File (CSV / Excel)</option>
                  <option value="link">Tautan Google Sheets</option>
                </select>
              </div>
            </div>

            {hybridImportMethod === "excel" ? (
              <div>
                <label className={labelCls}>Pilih File CSV / Excel</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>URL Spreadsheet Google Sheets</label>
                  <input
                    type="url"
                    value={hybridLink}
                    onChange={(e) => setHybridLink(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className={inputCls}
                  />
                </div>
                {hybridImportMode === "revisi" && (
                  <div>
                    <label className={labelCls}>ID Ploting Lama (Opsional)</label>
                    <input
                      type="text"
                      value={hybridOldId}
                      onChange={(e) => setHybridOldId(e.target.value)}
                      placeholder="e.g. PLOT-2026-08"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Preview table if data parsed */}
            {importData.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">
                    Preview Data ({importData.length} baris)
                  </span>
                  <button
                    type="button"
                    onClick={() => setImportData([])}
                    className="text-xs text-red-600 font-bold hover:underline"
                  >
                    Hapus Data
                  </button>
                </div>
                <div className="overflow-auto max-h-60 rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-slate-600 sticky top-0">
                      <tr>
                        <th className="p-2.5">No</th>
                        <th className="p-2.5">ID Jadwal</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Platform</th>
                        <th className="p-2.5">Streamer</th>
                        <th className="p-2.5">Waktu</th>
                        <th className="p-2.5">Studio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-600">{row.idJadwal}</td>
                          <td className="p-2.5">{row.tanggal}</td>
                          <td className="p-2.5">{row.platform}</td>
                          <td className="p-2.5">{row.streamerNama}</td>
                          <td className="p-2.5 font-mono">{row.jamMulaiLive} - {row.jamSelesaiLive}</td>
                          <td className="p-2.5">{row.cabangStudio} {row.nomorStudio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2"
              >
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{loading ? "Memproses Import..." : "Import Jadwal"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
