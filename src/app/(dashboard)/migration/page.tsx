"use client";

import { useRef, useState } from "react";

const MODULES = [
  {
    key: "karyawan",
    label: "Data Karyawan / Host",
    desc: "Nama, jabatan, kontak, bank, status — untuk HRIS",
    icon: "fa-user-plus",
  },
  {
    key: "jadwal",
    label: "Jadwal Live Streaming",
    desc: "ID jadwal, tanggal, jam, streamer, studio",
    icon: "fa-calendar-plus",
  },
  {
    key: "client",
    label: "Brand / Klien",
    desc: "Nama brand, platform, PIC, kontak",
    icon: "fa-building",
  },
  {
    key: "payroll",
    label: "Payroll / Kompensasi",
    desc: "Periode, total jam, tier, rate, gaji — untuk Finance",
    icon: "fa-money-bill-wave",
  },
  {
    key: "absensi",
    label: "Absensi / Presensi",
    desc: "Riwayat check-in/out karyawan",
    icon: "fa-fingerprint",
  },
];

type PreviewRow = Record<string, string>;
type Preview = { sheetName: string | null; headers: string[]; rowCount: number; preview: PreviewRow[] };

export default function MigrationWizardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [module, setModule] = useState("karyawan");
  const [source, setSource] = useState<"file" | "sheet" | "paste">("file");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [engine, setEngine] = useState<"llm" | "heuristic" | null>(null);

  async function runPreview(payload: { fileContent?: string; fileName?: string; googleSheetUrl?: string; pastedText?: string }) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", ...payload }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setPreview(d.data);
        setEngine(null);
        setStep(3);
      } else {
        setError(d.message ?? "Gagal membaca data");
      }
    } catch {
      setError("Gagal membaca data");
    } finally {
      setBusy(false);
    }
  }

  function handleSheetUrl() {
    setError("");
    setSuccess("");
    setResult(null);
    if (!sheetUrl.trim()) {
      setError("Tempel URL Google Sheets terlebih dahulu");
      return;
    }
    runPreview({ googleSheetUrl: sheetUrl.trim() });
  }

  // Paste-text: use the hybrid converter (LLM if configured, else heuristic).
  async function handlePasteText() {
    setError("");
    setSuccess("");
    setResult(null);
    if (!pastedText.trim()) {
      setError("Tempel teks data terlebih dahulu");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert", module, pastedText }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setEngine(d.data.engine ?? "heuristic");
        setPreview({
          sheetName: null,
          headers: d.data.rows.length ? Object.keys(d.data.rows[0]) : [],
          rowCount: d.data.rowCount ?? d.data.rows.length,
          preview: d.data.preview ?? d.data.rows.slice(0, 5),
        });
        setStep(3);
      } else {
        setError(d.message ?? "Gagal mengonversi teks");
      }
    } catch {
      setError("Gagal mengonversi teks");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file: File | undefined | null) {
    setError("");
    setSuccess("");
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      // For Excel, pass base64; for CSV, pass text.
      const content = isExcel ? (reader.result as string).split(",")[1] ?? "" : (reader.result as string);
      setFileContent(content);
      runPreview({ fileContent: content, fileName: file.name });
    };
    if (isExcel) reader.readAsDataURL(file);
    else reader.readAsText(file);
  }

  async function doImport() {
    setBusy(true);
    setError("");
    setSuccess("");
    setResult(null);
    try {
      const r = await fetch("/api/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          module,
          fileContent: source === "file" ? fileContent : undefined,
          fileName: source === "file" ? fileName : undefined,
          googleSheetUrl: source === "sheet" ? sheetUrl.trim() : undefined,
          pastedText: source === "paste" ? pastedText : undefined,
        }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setResult(d.data);
        setSuccess("Data berhasil diimpor ke aplikasi!");
        setStep(4);
      } else {
        setError(d.message ?? "Gagal mengimpor data");
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(1);
    setFileName("");
    setFileContent("");
    setPreview(null);
    setError("");
    setSuccess("");
    setResult(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Impor Data Lama</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Migrasi mudah dari Excel/CSV ke aplikasi — tanpa ribet. Ikuti 4 langkah sederhana.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-bold">
        {["Pilih Data", "Upload File", "Lihat Preview", "Selesai"].map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className={`flex items-center gap-2 ${i > 0 ? "flex-1" : ""}`}>
              {i > 0 && <div className={`h-0.5 flex-1 ${done ? "bg-emerald-500" : "bg-slate-200"}`} />}
              <div className={`flex items-center gap-1.5 ${active ? "text-blue-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${active ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? "✓" : n}
                </span>
                <span className="whitespace-nowrap">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4">⚠ {error}</div>
      )}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">✓ {success}</div>
      )}

      {/* Step 1: pilih modul */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-semibold">Data apa yang ingin Anda impor?</p>
          {MODULES.map((m) => (
            <button
              key={m.key}
              onClick={() => { setModule(m.key); setStep(2); }}
              className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition ${
                module === m.key ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <span className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                <i className={`fa-solid ${m.icon}`} />
              </span>
              <span>
                <span className="block font-bold text-slate-900 text-sm">{m.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{m.desc}</span>
              </span>
              <i className="fa-solid fa-chevron-right ml-auto text-slate-300 self-center" />
            </button>
          ))}
        </div>
      )}

      {/* Step 2: pilih sumber */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="text-center">
            <i className="fa-solid fa-cloud-arrow-up text-4xl text-blue-500" />
            <p className="text-sm font-bold text-slate-800 mt-2">Pilih sumber data lama</p>
            <p className="text-xs text-slate-500 mt-1">Kolom akan dikenali otomatis dari judul (mis. "Nama", "Email", "Jabatan").</p>
          </div>

          {/* Source toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit mx-auto">
            <button
              onClick={() => setSource("sheet")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${source === "sheet" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"}`}
            >
              Google Sheets
            </button>
            <button
              onClick={() => setSource("file")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${source === "file" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"}`}
            >
              Excel / CSV
            </button>
            <button
              onClick={() => setSource("paste")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${source === "paste" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"}`}
            >
              Paste Teks
            </button>
          </div>

          {source === "sheet" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Link Google Sheets</label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pastikan sheet di-share ke "siapa saja yang memiliki link". Data akan dibaca langsung dari sheet.
                </p>
              </div>
              <button
                onClick={handleSheetUrl}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {busy ? "Membaca sheet..." : "Baca Google Sheets"}
              </button>
            </div>
          ) : source === "paste" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tempel data mentah di sini</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={7}
                  placeholder="Salin & tempel data dari sheet/email/dokumen. Contoh:&#10;Nama Lengkap	Email	Jabatan	Status&#10;Andi	andi@test.com	Streamer	AKTIF&#10;Atau tempel teks berantakan — converter akan merapikannya."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Converter otomatis merapikan data (kolom, angka Rp, tanggal, dsb). Untuk data berantakan, gunakan engine AI bila dikonfigurasi.
                </p>
              </div>
              <button
                onClick={handlePasteText}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {busy ? "Mengonversi data..." : "Konversi & Lanjutkan"}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {busy ? "Membaca file..." : "Pilih File Excel / CSV"}
              </button>
              {fileName && <p className="text-xs text-emerald-600 font-semibold">✓ {fileName}</p>}
            </div>
          )}

          <button onClick={() => setStep(1)} className="block mx-auto text-xs text-slate-500 hover:underline">← Kembali</button>
        </div>
      )}

      {/* Step 3: preview */}
      {step === 3 && preview && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 text-sm">Preview Data ({preview.rowCount} baris)</div>
              {preview.sheetName && <span className="text-[11px] text-slate-400">Sheet: {preview.sheetName}</span>}
            </div>
            <p className="text-xs text-slate-500">Kolom terdeteksi: <strong>{preview.headers.join(", ")}</strong></p>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>{preview.headers.map((h) => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.preview.map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((h) => <td key={h} className="px-3 py-2 text-slate-700">{row[h] || "-"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100">← Ganti File</button>
              <button onClick={doImport} disabled={busy} className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition disabled:opacity-50">
                {busy ? "Mengimpor..." : `✓ Impor ${preview.rowCount} Baris`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: result */}
      {step === 4 && result && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-4 text-center">
          <i className="fa-solid fa-circle-check text-5xl text-emerald-500" />
          <h3 className="font-bold text-slate-900 text-lg">Import Selesai!</h3>
          <div className="flex justify-center gap-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="text-2xl font-black text-emerald-600">{result.imported ?? 0}</div>
              <div className="text-slate-500">Berhasil diimpor</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="text-2xl font-black text-amber-600">{result.skipped ?? 0}</div>
              <div className="text-slate-500">Dilewati / error</div>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-left bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 max-h-32 overflow-auto">
              {result.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
            </div>
          )}
          <button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition">
            Impor Data Lain
          </button>
        </div>
      )}
    </div>
  );
}
