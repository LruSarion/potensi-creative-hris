"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import "flatpickr/dist/flatpickr.min.css";

type LemburRow = any;

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
}

function nowHM(): string {
  const now = new Date();
  return now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
}

export default function PengajuanLemburPage() {
  const [activeTab, setActiveTab] = useState<"ajukan" | "mulai" | "selesai" | "riwayat">("ajukan");

  // Form Ajukan (persis ref: tanpa default)
  const [alTanggal, setAlTanggal] = useState("");
  const [alSpv, setAlSpv] = useState("");
  const [alMulai, setAlMulai] = useState("");
  const [alSelesai, setAlSelesai] = useState("");
  const [alKegiatan, setAlKegiatan] = useState("");
  const [submittingAjukan, setSubmittingAjukan] = useState(false);

  // Form Mulai (persis ref: native capture)
  const [mlIdLembur, setMlIdLembur] = useState("");
  const [mlFotoPreview, setMlFotoPreview] = useState("");
  const [submittingMulai, setSubmittingMulai] = useState(false);
  const mlFotoInputRef = useRef<HTMLInputElement | null>(null);

  // Form Selesai (persis ref: ID readonly dari activeLembur)
  const [slIdLembur, setSlIdLembur] = useState("");
  const [slCatatan, setSlCatatan] = useState("");
  const [slFotoPreview, setSlFotoPreview] = useState("");
  const [submittingSelesai, setSubmittingSelesai] = useState(false);
  const slFotoInputRef = useRef<HTMLInputElement | null>(null);

  // Riwayat
  const [history, setHistory] = useState<LemburRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Sesi lembur aktif (persis ref: localStorage activeLembur)
  const [activeLembur, setActiveLembur] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await fetchJson<any>("/api/lembur");
      if (Array.isArray(data)) setHistory(data);
    } catch (err) {
      console.error("Gagal memuat data lembur:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // checkActiveSession persis ref
  const checkActiveSession = useCallback(() => {
    try {
      const stored = localStorage.getItem("activeLembur");
      if (stored) {
        setActiveLembur(stored);
        setSlIdLembur(stored);
        setActiveTab("selesai");
      } else {
        setActiveLembur(null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadHistory();
    checkActiveSession();
  }, [loadHistory, checkActiveSession]);

  // flatpickr persis ref
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const flatpickr = (await import("flatpickr")).default;
      if (cancelled) return;
      flatpickr("input[type=date]", { dateFormat: "Y-m-d", allowInput: false, disableMobile: true } as any);
      flatpickr("input[type=time]:not([readonly])", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        allowInput: false,
        disableMobile: true,
      } as any);
    })();
    return () => { cancelled = true; };
  }, []);

  function switchTab(tabId: "ajukan" | "mulai" | "selesai" | "riwayat") {
    setActiveTab(tabId);
  }

  // previewPhoto / removePhoto persis ref
  function previewPhoto(file: File | undefined, target: "mulai" | "selesai") {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = String(e.target?.result ?? "");
      if (target === "mulai") setMlFotoPreview(url);
      else setSlFotoPreview(url);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(target: "mulai" | "selesai") {
    if (target === "mulai") {
      if (mlFotoInputRef.current) mlFotoInputRef.current.value = "";
      setMlFotoPreview("");
    } else {
      if (slFotoInputRef.current) slFotoInputRef.current.value = "";
      setSlFotoPreview("");
    }
  }

  async function handleAjukan(e: React.FormEvent) {
    e.preventDefault();
    if (!alKegiatan.trim()) {
      toast.warning("Kegiatan / alasan lembur wajib diisi.");
      return;
    }
    setSubmittingAjukan(true);
    try {
      const startIso = new Date(`${alTanggal}T${alMulai}:00`).toISOString();
      const endIso = new Date(`${alTanggal}T${alSelesai}:00`).toISOString();
      await sendJson("/api/lembur", "POST", {
        tanggal: new Date(alTanggal).toISOString(),
        jamMulai: startIso,
        jamSelesai: endIso,
        alasan: `[SPV: ${alSpv}] ${alKegiatan}`,
      });
      toast.success("Pengajuan Berhasil Dikirim!");
      setAlTanggal(""); setAlSpv(""); setAlMulai(""); setAlSelesai(""); setAlKegiatan("");
      loadHistory();
      switchTab("mulai");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengajukan lembur"));
    } finally {
      setSubmittingAjukan(false);
    }
  }

  async function handleMulai(e: React.FormEvent) {
    e.preventDefault();
    const file = mlFotoInputRef.current?.files?.[0];
    if (!mlIdLembur.trim() || !file) {
      toast.warning("ID Lembur dan Foto Masuk wajib diisi.");
      return;
    }
    setSubmittingMulai(true);
    try {
      const base64FotoMasuk = await getBase64(file);
      const jamSekarang = nowHM();
      await sendJson(`/api/lembur?id=${mlIdLembur.trim()}`, "PATCH", {
        buktiDriveId: `data:image/jpeg;base64,${base64FotoMasuk}`,
        alasan: `Mulai lembur pukul ${jamSekarang}`,
      });
      toast.success("Mulai Lembur Terekam!");
      try { localStorage.setItem("activeLembur", mlIdLembur.trim()); } catch { /* ignore */ }
      setMlIdLembur("");
      removePhoto("mulai");
      loadHistory();
      checkActiveSession();
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat mencatat mulai lembur."));
    } finally {
      setSubmittingMulai(false);
    }
  }

  async function handleSelesai(e: React.FormEvent) {
    e.preventDefault();
    const file = slFotoInputRef.current?.files?.[0];
    if (!slIdLembur.trim() || !file || !slCatatan.trim()) {
      toast.warning("ID Lembur, Foto Keluar, dan Laporan Pekerjaan Akhir wajib diisi.");
      return;
    }
    setSubmittingSelesai(true);
    try {
      const base64FotoKeluar = await getBase64(file);
      const jamSekarang = nowHM();
      await sendJson(`/api/lembur?id=${slIdLembur.trim()}`, "PATCH", {
        buktiDriveId: `data:image/jpeg;base64,${base64FotoKeluar}`,
        alasan: `${slCatatan} (Selesai pukul ${jamSekarang})`,
      });
      toast.success("Selesai Lembur Terekam!");
      try { localStorage.removeItem("activeLembur"); } catch { /* ignore */ }
      setActiveLembur(null);
      setSlIdLembur(""); setSlCatatan("");
      removePhoto("selesai");
      loadHistory();
      switchTab("riwayat");
    } catch (err) {
      toast.error(errorMessage(err, "Terjadi kesalahan koneksi saat menyelesaikan lembur."));
    } finally {
      setSubmittingSelesai(false);
    }
  }

  const tabBtn = (id: string, isActive: boolean) =>
    `py-2 px-4 rounded-lg text-sm transition ${isActive ? "tab-active" : "tab-inactive"}`;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <style>{`.tab-active{background-color:#f1f5f9;border:1px solid #cbd5e1;font-weight:600;color:#1e293b;}.tab-inactive{color:#64748b;font-weight:500;border:1px solid transparent;}.tab-inactive:hover{background-color:#f8fafc;color:#334155;}`}</style>

      <div className="flex items-center gap-3 mb-6">
        <i className="fa-solid fa-clock text-blue-600 text-3xl" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengajuan Lembur</h1>
          <p className="text-slate-500 text-sm mt-1">Ajukan jadwal dan laporkan jam aktual lembur Anda.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 mb-6 w-fit">
        <button onClick={() => switchTab("ajukan")} id="btn-ajukan" className={tabBtn("ajukan", activeTab === "ajukan")}><i className="fa-solid fa-file-pen mr-2" />Ajukan Lembur</button>
        <button
          onClick={() => switchTab("mulai")}
          id="btn-mulai"
          disabled={!!activeLembur}
          className={`${tabBtn("mulai", activeTab === "mulai")} ${activeLembur ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
        >
          {activeLembur ? "Selesaikan Lembur Dulu" : (<><i className="fa-solid fa-play mr-2" />Mulai Lembur</>)}
        </button>
        <button onClick={() => switchTab("selesai")} id="btn-selesai" className={tabBtn("selesai", activeTab === "selesai")}><i className="fa-solid fa-stop mr-2" />Selesai Lembur</button>
        <button onClick={() => switchTab("riwayat")} id="btn-riwayat" className={tabBtn("riwayat", activeTab === "riwayat")}><i className="fa-solid fa-clock-rotate-left mr-2" />Riwayat</button>
      </div>

      {activeTab === "ajukan" && (
        <div id="tab-ajukan" className="border border-slate-200 rounded-xl p-6 shadow-sm bg-white block">
          <h3 className="font-bold text-lg text-slate-900 mb-6">Form Pengajuan Lembur</h3>
          <form id="formAjukan" onSubmit={handleAjukan} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                <input type="date" id="alTanggal" value={alTanggal} onChange={(e) => setAlTanggal(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer" placeholder="Pilih Tanggal" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Penanggung Jawab (SPV)</label>
                <input type="text" id="alSpv" value={alSpv} onChange={(e) => setAlSpv(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Mulai (Rencana)</label>
                <input type="time" id="alMulai" value={alMulai} onChange={(e) => setAlMulai(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer" placeholder="Pilih Jam" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Berakhir (Rencana)</label>
                <input type="time" id="alSelesai" value={alSelesai} onChange={(e) => setAlSelesai(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer" placeholder="Pilih Jam" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Kegiatan / Alasan Lembur</label>
                <textarea id="alKegiatan" value={alKegiatan} onChange={(e) => setAlKegiatan(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={3} placeholder="Jelaskan secara detail pekerjaan yang akan dilakukan..." required />
              </div>
            </div>
            <button type="submit" disabled={submittingAjukan} className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition mt-2 w-full md:w-auto disabled:opacity-60">{submittingAjukan ? "Mengirim..." : "Kirim Pengajuan"}</button>
          </form>
        </div>
      )}

      {activeTab === "mulai" && (
        <div id="tab-mulai" className="border border-slate-200 rounded-xl p-6 shadow-sm bg-white block">
          <h3 className="font-bold text-lg text-slate-900 mb-1">Absen Mulai Lembur</h3>
          <p className="text-slate-500 text-sm mb-6">Lakukan absen saat Anda akan memulai pekerjaan lembur.</p>
          <form id="formMulai" onSubmit={handleMulai} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID Lembur (Disetujui)</label>
                <input type="text" id="mlIdLembur" value={mlIdLembur} onChange={(e) => setMlIdLembur(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: LMB-XXX" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Absen Masuk</label>
                <input type="time" id="mlJamMasuk" readOnly className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 cursor-not-allowed text-slate-500" />
                <p className="text-xs text-slate-400 mt-1">*Otomatis mengikuti waktu server saat dikirim.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Foto Masuk (Bukti Mulai) *Kamera</label>
                {mlFotoPreview && (
                  <div id="mlFotoContainer" className="relative inline-block border border-slate-200 rounded-lg p-1 bg-slate-50 mb-2 w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img id="mlFotoPreview" src={mlFotoPreview} alt="Foto masuk" className="max-h-32 rounded object-cover" />
                    <button type="button" onClick={() => removePhoto("mulai")} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center"><i className="fa-solid fa-xmark text-sm" /></button>
                  </div>
                )}
                <input ref={mlFotoInputRef} type="file" id="mlFotoInput" accept="image/*" capture="user" onChange={(e) => previewPhoto(e.target.files?.[0], "mulai")} className="w-full border border-slate-300 rounded-lg text-sm file:mr-2 file:py-1 file:px-2 file:border-0 file:bg-blue-50 text-blue-700 cursor-pointer" required />
              </div>
            </div>
            <button type="submit" disabled={submittingMulai} className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition mt-2 w-full md:w-auto disabled:opacity-60">{submittingMulai ? "Mengirim..." : "Submit Mulai Lembur"}</button>
          </form>
        </div>
      )}

      {activeTab === "selesai" && (
        <div id="tab-selesai" className="border border-slate-200 rounded-xl p-6 shadow-sm bg-white block">
          <h3 className="font-bold text-lg text-slate-900 mb-1">Absen Selesai Lembur</h3>
          <p className="text-slate-500 text-sm mb-6">Laporkan penyelesaian lembur dan bukti hasil kerja akhir.</p>
          <form id="formSelesai" onSubmit={handleSelesai} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID Lembur (Aktif)</label>
                <input type="text" id="slIdLembur" value={slIdLembur} readOnly className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 cursor-not-allowed text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Absen Keluar</label>
                <input type="time" id="slJamKeluar" readOnly className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 cursor-not-allowed text-slate-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Foto Keluar (Bukti Selesai) *Kamera</label>
                {slFotoPreview && (
                  <div id="slFotoContainer" className="relative inline-block border border-slate-200 rounded-lg p-1 bg-slate-50 mb-2 w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img id="slFotoPreview" src={slFotoPreview} alt="Foto keluar" className="max-h-32 rounded object-cover" />
                    <button type="button" onClick={() => removePhoto("selesai")} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center"><i className="fa-solid fa-xmark text-sm" /></button>
                  </div>
                )}
                <input ref={slFotoInputRef} type="file" id="slFotoInput" accept="image/*" capture="user" onChange={(e) => previewPhoto(e.target.files?.[0], "selesai")} className="w-full border border-slate-300 rounded-lg text-sm file:mr-2 file:py-1 file:px-2 file:border-0 file:bg-blue-50 text-blue-700 cursor-pointer" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Laporan Pekerjaan Akhir</label>
                <textarea id="slCatatan" value={slCatatan} onChange={(e) => setSlCatatan(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={3} required />
              </div>
            </div>
            <button type="submit" disabled={submittingSelesai} className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition mt-2 w-full md:w-auto disabled:opacity-60">{submittingSelesai ? "Mengirim..." : "Submit Selesai Lembur"}</button>
          </form>
        </div>
      )}

      {activeTab === "riwayat" && (
        <div id="tab-riwayat" className="border border-slate-200 rounded-xl p-6 shadow-sm bg-white block">
          <h3 className="font-bold text-lg text-slate-900 mb-6">Riwayat Pengajuan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">ID Lembur</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Kegiatan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr><td colSpan={4} className="text-center py-4 text-slate-500 italic">Memuat riwayat...</td></tr>
                ) : history.length > 0 ? (
                  history.map((h: any, idx: number) => (
                    <tr key={h.id ?? idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{h.id}</td>
                      <td className="px-4 py-3">{h.tanggal ? new Date(h.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{h.alasan ?? "-"}</td>
                      <td className="px-4 py-3">{h.status === "APPROVED" ? "Disetujui" : h.status === "REJECTED" ? "Ditolak" : h.status === "PENDING" ? "Menunggu" : (h.status ?? "-")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="text-center py-4 text-slate-500 italic">Data masih kosong...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
