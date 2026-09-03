"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { fetchJson, sendJson } from "@/lib/api-client";

type MarketplaceListing = {
  id: string;
  title: string;
  description?: string | null;
  platform?: string | null;
  ratePerSesi: number;
  quota: number;
  client?: { id: string; namaClient: string } | null;
  course?: { id: string; title: string } | null;
  eligible: boolean;
  alreadyApplied: boolean;
  filled: boolean;
};

type TabMarketplaceProps = {
  onNavigateToLms?: () => void;
};

export default function TabMarketplace({ onNavigateToLms }: TabMarketplaceProps) {
  const { status } = useSession();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEligible, setFilterEligible] = useState<"ALL" | "ELIGIBLE" | "APPLIED" | "CERTIFIED">("ALL");
  const [filterPlatform, setFilterPlatform] = useState("ALL");

  // Modal Apply State
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [applyNote, setApplyNote] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      loadListings();
    }
  }, [status]);

  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<MarketplaceListing[]>("/api/marketplace?view=eligible");
      setListings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat bursa proyek marketplace.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedListing) return;
    setApplying(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/marketplace", "POST", {
        action: "apply",
        listingId: selectedListing.id,
        note: applyNote.trim() || undefined,
      });
      setSuccess(`✅ Lamaran Anda untuk proyek "${selectedListing.title}" berhasil dikirim! Tim Klien/HR akan meninjau pengajuan Anda.`);
      setSelectedListing(null);
      setApplyNote("");
      loadListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim lamaran proyek.");
    } finally {
      setApplying(false);
    }
  }

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (filterEligible === "ELIGIBLE" && (!l.eligible || l.filled || l.alreadyApplied)) return false;
      if (filterEligible === "APPLIED" && !l.alreadyApplied) return false;
      if (filterEligible === "CERTIFIED" && !l.course) return false;

      if (filterPlatform !== "ALL") {
        const plat = (l.platform || "").toLowerCase();
        if (!plat.includes(filterPlatform.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchDesc = (l.description || "").toLowerCase().includes(q);
        const matchClient = (l.client?.namaClient || "").toLowerCase().includes(q);
        const matchCourse = (l.course?.title || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchClient && !matchCourse) return false;
      }

      return true;
    });
  }, [listings, filterEligible, filterPlatform, searchQuery]);

  // Statistics
  const totalOpen = listings.filter((l) => !l.filled).length;
  const eligibleCount = listings.filter((l) => l.eligible && !l.filled && !l.alreadyApplied).length;
  const appliedCount = listings.filter((l) => l.alreadyApplied).length;
  const certifiedProjectsCount = listings.filter((l) => Boolean(l.course)).length;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-store" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Marketplace Bursa Proyek Brand</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Ambil peluang siaran live streaming berbayar dari brand mitra sesuai sertifikasi dan kualifikasi keahlian Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadListings}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs self-start sm:self-auto"
          >
            <i className="fa-solid fa-rotate-right text-slate-500" />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-slate-400 block mb-0.5 text-[11px] font-bold">Total Proyek Terbuka</span>
            <div className="text-lg font-black text-slate-900">{totalOpen} Proyek</div>
          </div>
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100">
            <span className="text-emerald-600 block mb-0.5 text-[11px] font-bold">Memenuhi Syarat (Eligible)</span>
            <div className="text-lg font-black text-emerald-800">{eligibleCount} Proyek</div>
          </div>
          <div className="bg-blue-50/60 rounded-2xl p-3.5 border border-blue-100">
            <span className="text-blue-600 block mb-0.5 text-[11px] font-bold">Proyek Telah Dilamar</span>
            <div className="text-lg font-black text-blue-800">{appliedCount} Proyek</div>
          </div>
          <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-100">
            <span className="text-amber-600 block mb-0.5 text-[11px] font-bold">Perlu Sertifikasi LMS</span>
            <div className="text-lg font-black text-amber-800">{certifiedProjectsCount} Proyek</div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setFilterEligible("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterEligible === "ALL"
                ? "bg-[#941A0B] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua Proyek ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEligible("ELIGIBLE")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterEligible === "ELIGIBLE"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Dapat Dilamar ({eligibleCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterEligible("APPLIED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterEligible === "APPLIED"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sudah Dilamar ({appliedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterEligible("CERTIFIED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterEligible === "CERTIFIED"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Program Sertifikasi ({certifiedProjectsCount})
          </button>
        </div>

        {/* Platform & Text Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="w-full sm:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">Semua Platform</option>
            <option value="Shopee">Shopee Live</option>
            <option value="TikTok">TikTok Live</option>
            <option value="Lazada">Lazada</option>
            <option value="Tokopedia">Tokopedia</option>
          </select>

          <div className="relative w-full sm:w-60">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari brand / proyek..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:bg-white outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl mx-auto animate-pulse">
            <i className="fa-solid fa-store" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Memuat Bursa Proyek Marketplace...</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Menyelaraskan data proyek brand, kualifikasi sertifikasi, dan kuota host streamer.
          </p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto">
            <i className="fa-solid fa-briefcase" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Tidak Ada Proyek Ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || filterEligible !== "ALL" || filterPlatform !== "ALL"
              ? "Tidak ada listing proyek yang sesuai dengan kriteria filter Anda."
              : "Saat ini belum ada listing proyek baru di marketplace. Silakan cek kembali secara berkala."}
          </p>
        </div>
      ) : (
        /* Listings Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((listing) => {
            const hasCourseReq = Boolean(listing.course);

            return (
              <div
                key={listing.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-orange-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-5 shadow-2xs"
              >
                {/* Top Brand & Platform */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-lg shadow-md shrink-0">
                        <i className="fa-solid fa-store" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 line-clamp-1">
                          {listing.client?.namaClient || "Brand Partner"}
                        </div>
                        <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                          {listing.platform || "Shopee Live"}
                        </span>
                      </div>
                    </div>

                    {/* Eligibility Badge */}
                    {listing.alreadyApplied ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        ✓ Dilamar
                      </span>
                    ) : listing.filled ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">
                        Penuh
                      </span>
                    ) : listing.eligible ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Eligible ✓
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        Perlu Sertifikat
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-black text-slate-900 text-base leading-snug">
                      {listing.title}
                    </h3>
                    {listing.description && (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {listing.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rates, Quota, Cert & Action */}
                <div className="space-y-4 pt-3 border-t border-slate-100">
                  {/* Fee & Quota */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Rate per Sesi</span>
                      <span className="font-black text-slate-900 font-mono text-xs">
                        Rp {listing.ratePerSesi ? listing.ratePerSesi.toLocaleString("id-ID") : "Sesuai Tier"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Kebutuhan Host</span>
                      <span className="font-black text-slate-900 text-xs">
                        {listing.quota} Personel
                      </span>
                    </div>
                  </div>

                  {/* Certification requirement box */}
                  {hasCourseReq && (
                    <div
                      className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                        listing.eligible
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                          : "bg-amber-50/70 border-amber-200 text-amber-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <i
                          className={`fa-solid ${
                            listing.eligible ? "fa-certificate text-emerald-600" : "fa-lock text-amber-600"
                          } shrink-0 text-sm`}
                        />
                        <div className="truncate">
                          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                            {listing.eligible ? "Sertifikasi Terpenuhi" : "Syarat Sertifikasi Brand"}
                          </div>
                          <div className="font-bold truncate text-[11px]">
                            {listing.course?.title}
                          </div>
                        </div>
                      </div>

                      {!listing.eligible && onNavigateToLms && (
                        <button
                          type="button"
                          onClick={onNavigateToLms}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition shrink-0 shadow-2xs"
                        >
                          Buka LMS
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action CTA Button */}
                  <div>
                    {listing.alreadyApplied ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                      >
                        <i className="fa-solid fa-circle-check" />
                        <span>Lamaran Terkirim (Menunggu Review)</span>
                      </button>
                    ) : listing.filled ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <span>Kuota Proyek Telah Terpenuhi</span>
                      </button>
                    ) : !listing.eligible ? (
                      <button
                        type="button"
                        onClick={onNavigateToLms}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition"
                      >
                        <i className="fa-solid fa-graduation-cap" />
                        <span>Selesaikan Pelatihan di LMS Dulu</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedListing(listing);
                          setApplyNote("");
                          setError("");
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#941A0B] hover:bg-[#6D1207] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-red-900/20 active:scale-95"
                      >
                        <i className="fa-solid fa-paper-plane text-[11px]" />
                        <span>Lamar Proyek Ini</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Note Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-full border border-orange-200">
                  Konfirmasi Lamaran Proyek
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {selectedListing.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedListing.client?.namaClient} • {selectedListing.platform || "Shopee Live"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Project Summary in Modal */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Rate / Honor:</span>
                <span className="font-bold text-slate-900 font-mono">
                  Rp {selectedListing.ratePerSesi ? selectedListing.ratePerSesi.toLocaleString("id-ID") : "Sesuai Tier"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Kualifikasi:</span>
                <span className="font-bold text-emerald-700">Memenuhi Syarat (Eligible) ✓</span>
              </div>
            </div>

            {/* Application Note Input */}
            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan Tambahan / Pitching Singkat (Opsional)
                </label>
                <textarea
                  rows={4}
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="Contoh: Saya memiliki pengalaman 2+ tahun mempromosikan produk kecantikan di TikTok Live dengan GMV rata-rata 15jt/sesi..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Catatan ini akan langsung dibaca oleh Tim Operasional dan Klien saat menentukan streamer terpilih.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedListing(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="px-5 py-2.5 rounded-xl bg-[#941A0B] hover:bg-[#6D1207] disabled:opacity-60 text-white text-xs font-bold transition shadow-md shadow-red-900/20 flex items-center gap-2 active:scale-95"
                >
                  {applying ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin" />
                      <span>Mengirim Lamaran...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane" />
                      <span>Kirim Lamaran Proyek</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
