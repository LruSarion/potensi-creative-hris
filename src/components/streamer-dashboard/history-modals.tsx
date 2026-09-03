"use client";

// Bukti Foto & GPS modal + full-screen image lightbox for the streamer
// dashboard History tab. Extracted verbatim from page.tsx (refactor only).

import type { AbsensiHistory } from "./types";
import {
  parseCoordinates,
  resolveImageUrl,
} from "./history-utils";

export function BuktiFotoModal({
  selectedBuktiHistory,
  selectedLocationTab,
  onSelectLocationTab,
  onClose,
  onPreviewImage,
}: {
  selectedBuktiHistory: AbsensiHistory;
  selectedLocationTab: "keluar" | "masuk";
  onSelectLocationTab: (tab: "keluar" | "masuk") => void;
  onClose: () => void;
  onPreviewImage: (modal: { url: string; title: string }) => void;
}) {
  // Photos
  const rawKeluar = selectedBuktiHistory.fotoKeluar;
  const rawGmv = selectedBuktiHistory.fotoGmv;

  // Detect if photos are the exact same (e.g. from legacy records or fallback duplication)
  const isSamePhoto = Boolean(rawKeluar && rawGmv && rawKeluar === rawGmv);

  // If same photo, prioritize it as Foto Keluar (Selfie Check-Out) and do not duplicate to GMV
  const fotoKeluarUrl = rawKeluar || (!rawGmv ? selectedBuktiHistory.buktiDriveId : null);
  const fotoGmvUrl = isSamePhoto ? null : (rawGmv || (rawKeluar ? null : selectedBuktiHistory.buktiDriveId));
  const fotoMasukUrl = selectedBuktiHistory.fotoMasuk;

  // Location
  const activeLocStr = selectedLocationTab === "masuk"
    ? (selectedBuktiHistory.lokasiMasuk || selectedBuktiHistory.lokasiKeluar)
    : (selectedBuktiHistory.lokasiKeluar || selectedBuktiHistory.lokasiMasuk);

  const parsedCoords = parseCoordinates(activeLocStr);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-500/30">
              <i className="fa-solid fa-camera-retro" />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-sm text-white truncate">
                Bukti Presensi & Sesi: {selectedBuktiHistory.idAbsen || selectedBuktiHistory.idJadwal || "Live Session"}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                {selectedBuktiHistory.streamer || "Streamer"} • {selectedBuktiHistory.platform || "Platform"} ({selectedBuktiHistory.cabang || "Timoho"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {/* SECTION 1: DUA FOTO CHECKOUT DITAMPILKAN SEKALIGUS (BUKTI GMV & FOTO KELUAR) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-images text-[#941A0B]" />
                <span>Dokumentasi Check-Out (Foto GMV & Foto Keluar)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Tampil Bersamaan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card 1: Foto Bukti GMV */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col shadow-sm">
                <div className="px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-chart-line text-emerald-400 text-xs" />
                    <span className="font-bold text-xs text-white">1. Bukti GMV (Screenshot)</span>
                  </div>
                  {selectedBuktiHistory.nominalGmv !== null && selectedBuktiHistory.nominalGmv !== undefined && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono text-[10px] font-black">
                      Rp {Number(selectedBuktiHistory.nominalGmv).toLocaleString("id-ID")}
                    </span>
                  )}
                </div>
                <div className="relative h-60 bg-slate-950 flex items-center justify-center p-2 group">
                  {fotoGmvUrl ? (
                    <img
                      src={resolveImageUrl(fotoGmvUrl)}
                      alt="Bukti GMV"
                      className="w-full h-full object-contain rounded-xl cursor-pointer hover:opacity-95 transition"
                      onClick={() => onPreviewImage({ url: resolveImageUrl(fotoGmvUrl), title: "Bukti Screenshot GMV" })}
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs p-6 flex flex-col items-center justify-center h-full">
                      <i className="fa-solid fa-file-invoice-dollar text-3xl mb-2 block text-slate-600" />
                      <span className="font-semibold text-slate-400 block">Screenshot GMV belum tersedia</span>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {isSamePhoto
                          ? "(Sesi ini hanya memiliki foto selfie check-out)"
                          : (selectedBuktiHistory.nominalGmv
                            ? `Nominal tercatat: Rp ${Number(selectedBuktiHistory.nominalGmv).toLocaleString("id-ID")}`
                            : "Tidak ada screenshot omzet terpisah yang diunggah")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">Bukti omzet penjualan</span>
                  {fotoGmvUrl && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPreviewImage({ url: resolveImageUrl(fotoGmvUrl), title: "Bukti Screenshot GMV" })}
                        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-expand text-[10px]" />
                        <span>Perbesar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = resolveImageUrl(fotoGmvUrl);
                          a.download = `bukti-gmv-${selectedBuktiHistory.idAbsen || "sesi"}.jpg`;
                          a.target = "_blank";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 transition flex items-center gap-1 cursor-pointer"
                        title="Unduh Bukti GMV"
                      >
                        <i className="fa-solid fa-download text-[10px]" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Foto Keluar (Selfie Check-Out) */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col shadow-sm">
                <div className="px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-camera text-blue-400 text-xs" />
                    <span className="font-bold text-xs text-white">2. Foto Keluar (Selfie Check-Out)</span>
                  </div>
                  {selectedBuktiHistory.jamKeluar && selectedBuktiHistory.jamKeluar !== "-" && (
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 font-mono text-[10px] font-black">
                      {selectedBuktiHistory.jamKeluar} WIB
                    </span>
                  )}
                </div>
                <div className="relative h-60 bg-slate-950 flex items-center justify-center p-2 group">
                  {fotoKeluarUrl ? (
                    <img
                      src={resolveImageUrl(fotoKeluarUrl)}
                      alt="Foto Selfie Keluar"
                      className="w-full h-full object-contain rounded-xl cursor-pointer hover:opacity-95 transition"
                      onClick={() => onPreviewImage({ url: resolveImageUrl(fotoKeluarUrl), title: "Foto Selfie Keluar" })}
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs p-6">
                      <i className="fa-solid fa-image-slash text-3xl mb-2 block text-slate-600" />
                      <span>Belum ada foto selfie keluar</span>
                    </div>
                  )}
                </div>
                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">Verifikasi wajah & GPS</span>
                  {fotoKeluarUrl && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPreviewImage({ url: resolveImageUrl(fotoKeluarUrl), title: "Foto Selfie Keluar" })}
                        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-expand text-[10px]" />
                        <span>Perbesar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = resolveImageUrl(fotoKeluarUrl);
                          a.download = `foto-keluar-${selectedBuktiHistory.idAbsen || "sesi"}.jpg`;
                          a.target = "_blank";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 transition flex items-center gap-1 cursor-pointer"
                        title="Unduh Foto Keluar"
                      >
                        <i className="fa-solid fa-download text-[10px]" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Row 3: Foto Masuk (Check-In) if available */}
            {fotoMasukUrl && fotoMasukUrl !== fotoKeluarUrl && fotoMasukUrl !== fotoGmvUrl && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-slate-950 rounded-xl overflow-hidden shrink-0 border border-slate-300 flex items-center justify-center">
                    <img
                      src={resolveImageUrl(fotoMasukUrl)}
                      alt="Foto Masuk"
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition"
                      onClick={() => onPreviewImage({ url: resolveImageUrl(fotoMasukUrl), title: "Foto Selfie Masuk (Check-In)" })}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider block">Foto Masuk (Check-In)</span>
                    <p className="font-bold text-xs text-slate-800">
                      Pukul {selectedBuktiHistory.jamMasuk || "-"} WIB • {selectedBuktiHistory.isTelat ? `Telat: ${selectedBuktiHistory.telatRaw}` : "Tepat Waktu"}
                    </p>
                    {selectedBuktiHistory.lokasiMasuk && (
                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-sm mt-0.5">
                        📍 {selectedBuktiHistory.lokasiMasuk}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPreviewImage({ url: resolveImageUrl(fotoMasukUrl), title: "Foto Selfie Masuk (Check-In)" })}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <i className="fa-solid fa-eye text-xs text-slate-500" />
                  <span>Lihat Foto Masuk</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: DETEKSI LOKASI GPS & GOOGLE MAPS EMBED */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  <i className="fa-solid fa-location-dot" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      Deteksi Lokasi GPS
                    </h5>
                    {selectedBuktiHistory.lokasiMasuk && selectedBuktiHistory.lokasiKeluar && (
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                        <button
                          type="button"
                          onClick={() => onSelectLocationTab("keluar")}
                          className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                            selectedLocationTab === "keluar" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Saat Check-Out
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectLocationTab("masuk")}
                          className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                            selectedLocationTab === "masuk" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Saat Check-In
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-slate-700 break-all mt-0.5 font-semibold leading-relaxed">
                    {activeLocStr || `Studio: ${selectedBuktiHistory.cabang || "Timoho"} - ${selectedBuktiHistory.studio || "Studio 1"}`}
                  </p>
                </div>
              </div>

              {parsedCoords && (
                <a
                  href={`https://www.google.com/maps?q=${parsedCoords.lat},${parsedCoords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-2xs flex items-center gap-2 self-start sm:self-auto cursor-pointer active:scale-95 shrink-0"
                >
                  <i className="fa-solid fa-map-location-dot text-sm" />
                  <span>Buka di Google Maps</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                </a>
              )}
            </div>

            {/* Embedded Map */}
            {parsedCoords ? (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 shadow-inner relative bg-slate-100">
                <iframe
                  title="Peta Lokasi Presensi"
                  src={`https://maps.google.com/maps?q=${parsedCoords.lat},${parsedCoords.lng}&z=16&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                <i className="fa-solid fa-location-pin text-slate-400 mr-1.5" />
                <span>Koordinat GPS tidak tersimpan secara numerik untuk sesi ini. Lokasi terjadwal: <strong>{selectedBuktiHistory.cabang || "Timoho"} ({selectedBuktiHistory.studio || "Studio 1"})</strong>.</span>
              </div>
            )}
          </div>

          {/* SECTION 3: RANGKUMAN SESI SIARAN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <i className="fa-solid fa-circle-info text-[#941A0B]" />
              <span>Rangkuman Sesi Siaran</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">ID JADWAL</p>
                <p className="font-mono font-bold text-[#941A0B]">{selectedBuktiHistory.idJadwal || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">STATUS SESI</p>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  {selectedBuktiHistory.status || "SELESAI"}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">NOMINAL GMV</p>
                <p className="font-bold text-emerald-600 font-mono">
                  {selectedBuktiHistory.nominalGmv !== null && selectedBuktiHistory.nominalGmv !== undefined
                    ? `Rp ${Number(selectedBuktiHistory.nominalGmv).toLocaleString("id-ID")}`
                    : selectedBuktiHistory.reportedGmv !== null && selectedBuktiHistory.reportedGmv !== undefined
                    ? `Rp ${Number(selectedBuktiHistory.reportedGmv).toLocaleString("id-ID")}`
                    : "Belum dilaporkan"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">TANGGAL & JAM</p>
                <p className="font-bold text-slate-700">{selectedBuktiHistory.tanggal || "-"}</p>
                <p className="text-[11px] text-blue-600 font-mono">
                  {selectedBuktiHistory.jamMulai && selectedBuktiHistory.jamSelesai
                    ? `${selectedBuktiHistory.jamMulai} - ${selectedBuktiHistory.jamSelesai} WIB`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">LOKASI STUDIO</p>
                <p className="font-bold text-slate-700">{selectedBuktiHistory.cabang || "Studio"}</p>
                <p className="text-[11px] text-slate-500">{selectedBuktiHistory.studio || "Studio 1"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">WAKTU ABSEN</p>
                <p className="font-mono text-slate-700">
                  {selectedBuktiHistory.jamMasuk && selectedBuktiHistory.jamMasuk !== "-" ? `${selectedBuktiHistory.jamMasuk} WIB` : "-"}
                  {" - "}
                  {selectedBuktiHistory.jamKeluar && selectedBuktiHistory.jamKeluar !== "-" ? `${selectedBuktiHistory.jamKeluar} WIB` : "-"}
                </p>
                <p className={`text-[10px] font-bold ${selectedBuktiHistory.isTelat ? "text-red-600 font-black" : "text-emerald-600"}`}>
                  {selectedBuktiHistory.isTelat ? `Telat: ${selectedBuktiHistory.telatRaw}` : "Tepat Waktu"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-6 py-2 rounded-xl transition shadow-sm active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageLightbox({
  previewImageModal,
  onClose,
}: {
  previewImageModal: { url: string; title: string };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between text-white pb-2 px-1">
          <span className="text-sm font-bold">{previewImageModal.title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-red-400 p-1 rounded-lg transition text-xl cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="relative w-full max-h-[80vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
          <img
            src={previewImageModal.url}
            alt={previewImageModal.title}
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
        <div className="pt-3 flex items-center gap-3">
          <a
            href={previewImageModal.url}
            download="bukti-foto.jpg"
            target="_blank"
            rel="noreferrer"
            className="bg-white text-slate-900 font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 hover:bg-slate-100 transition cursor-pointer"
          >
            <i className="fa-solid fa-download text-blue-600" />
            <span>Unduh Gambar Penuh</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-700 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}