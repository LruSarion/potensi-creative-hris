"use client";

// Tab Jadwal — rebuild penuh 1:1 ref-deploy/streamer-dashboard.html #tab-jadwal
// Header Jadwal & Marketplace + 4 sub-tab + filter 4 blok + tabel 7 kolom + modal INFO.
// Data jadwal diambil dari /api/streamer?view=jadwal (DB Supabase); Durasi & Wajib Hadir
// dihitung client (formatDurationHHMM + calcWajibHadir). Sub-tab Market/Keranjang/History
// diadaptasi reuse listing marketplace existing — booking instan ref jadi proyek tersendiri.

import { useEffect, useMemo, useState } from "react";
import type { Jadwal } from "./types";
import {
  formatDateSafe,
  formatTimeSafe,
  formatDurationHHMM,
  calcWajibHadir,
} from "@/lib/utils/date-format";
import { SectionLoader } from "@/components/ui/loading-states";
import { fetchJson, sendJson } from "@/lib/api-client";
import { useSession } from "next-auth/react";

type SubTab = "live" | "market" | "keranjang" | "history_market";

export function TabJadwal({
  jadwal,
  loading,
  onSelectForCheckIn: _onSelectForCheckIn,
  onGoCheckout: _onGoCheckout,
}: {
  jadwal: Jadwal[];
  loading: boolean;
  onSelectForCheckIn: (j: Jadwal) => void;
  onGoCheckout: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("live");

  // ---- Jadwal Live filters (ref 4 blok + pagination) ----
  const [filterPeriode, setFilterPeriode] = useState("ALL");
  const [filterExactDate, setFilterExactDate] = useState("");
  const [filterRangeStart, setFilterRangeStart] = useState("");
  const [filterRangeEnd, setFilterRangeEnd] = useState("");
  const [filterWaktuToggle, setFilterWaktuToggle] = useState("ALL");
  const [filterJamMulai, setFilterJamMulai] = useState("");
  const [filterJamAkhir, setFilterJamAkhir] = useState("");
  const [filterCol, setFilterCol] = useState("ALL");
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCabang, setFilterCabang] = useState("");
  const [filterStudio, setFilterStudio] = useState("");

  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Market sub-filters (mirip ref filterMarketplace)
  const [filterDateMarket, setFilterDateMarket] = useState("");
  const [filterCabangMarket, setFilterCabangMarket] = useState("");
  const [filterWaktuMarket, setFilterWaktuMarket] = useState("");

  const [infoJadwal, setInfoJadwal] = useState<Jadwal | null>(null);

  // ---- Marketplace (ref sub-tabs market/keranjang/history) ----
  type MarketListing = {
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
    jadwal?: { id: string; idJadwal: string; tanggal: string; jamMulaiLive: string; jamSelesaiLive: string; cabangStudio?: string | null; nomorStudio?: string | null; judulLive?: string | null; platform?: string | null } | null;
  };
  type KeranjangItem = {
    id: string;
    listingId: string;
    status: string;
    createdAt: string;
    waktuBooking: string;
    expireAt: string;
    listing?: MarketListing & { jadwal?: { id: string; idJadwal: string; tanggal: string; jamMulaiLive: string; jamSelesaiLive: string; cabangStudio?: string | null; nomorStudio?: string | null; judulLive?: string | null; platform?: string | null; status?: string } | null } | null;
    streamer?: { id: string; idKaryawan: string; namaLengkap: string } | null;
  };
  type HistoryItem = KeranjangItem & { updatedAt: string };
  const { data: session } = useSession();
  const isAdminMarket = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes((session?.user as { role?: string })?.role ?? "");
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [keranjangList, setKeranjangList] = useState<KeranjangItem[]>([]);
  const [keranjangLoading, setKeranjangLoading] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [marketActionId, setMarketActionId] = useState<string | null>(null);
  const [selectedKeranjangIds, setSelectedKeranjangIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [confirmTakeId, setConfirmTakeId] = useState<string | null>(null);
  const [hostFilterKeranjang, setHostFilterKeranjang] = useState("");
  const [hostOptions, setHostOptions] = useState<{ id: string; idKaryawan: string; namaLengkap: string }[]>([]);

  // ---- Helpers ----
  function parseMinutes(timeStr: string): number | null {
    if (!timeStr) return null;
    const p = timeStr.split(":").map(Number);
    if (p.length < 2 || p.some(Number.isNaN)) return null;
    return p[0] * 60 + p[1];
  }

  const filteredLive = useMemo(() => {
    let result = [...jadwal];

    // Periode
    if (filterPeriode !== "ALL") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter((j) => {
        const raw = j.tanggal;
        if (!raw) return false;
        const dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return false;
        const rowDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const diff = Math.round((rowDate.getTime() - today.getTime()) / 86400000);
        if (filterPeriode === "TODAY") return diff === 0;
        if (filterPeriode === "PREV_7") return diff >= -7 && diff <= 0;
        if (filterPeriode === "NEXT_7") return diff >= 0 && diff <= 7;
        if (filterPeriode === "PREV_35") return diff >= -35 && diff <= 0;
        if (filterPeriode === "NEXT_35") return diff >= 0 && diff <= 35;
        if (filterPeriode === "EXACT_DATE") {
          if (!filterExactDate) return true;
          const exact = new Date(filterExactDate);
          exact.setHours(0, 0, 0, 0);
          return rowDate.getTime() === exact.getTime();
        }
        if (filterPeriode === "CUSTOM") {
          if (!filterRangeStart || !filterRangeEnd) return true;
          const start = new Date(filterRangeStart);
          const end = new Date(filterRangeEnd);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return rowDate >= start && rowDate <= end;
        }
        return true;
      });
    }

    // Rentang jam
    if (filterWaktuToggle === "CUSTOM" && (filterJamMulai || filterJamAkhir)) {
      const minStart = parseMinutes(filterJamMulai);
      const minEnd = parseMinutes(filterJamAkhir);
      result = result.filter((j) => {
        const mulai = formatTimeSafe(j.jamMulaiLive, "");
        if (!mulai || mulai === "–") return false;
        const minTarget = parseMinutes(mulai);
        if (minTarget === null) return false;
        if (minStart !== null && minEnd !== null) {
          if (minStart <= minEnd) return minTarget >= minStart && minTarget <= minEnd;
          return minTarget >= minStart || minTarget <= minEnd;
        }
        if (minStart !== null) return minTarget >= minStart;
        if (minEnd !== null) return minTarget <= minEnd;
        return true;
      });
    }

    // Kolom khusus
    if (filterCol === "6") {
      const keyCabang = filterCabang.toLowerCase().trim();
      const keyStudio = filterStudio.toLowerCase().trim();
      if (keyCabang || keyStudio) {
        result = result.filter((j) => {
          const c = (j.cabangStudio || "").toLowerCase();
          const n = (j.nomorStudio || j.studio || "").toLowerCase();
          const matchC = !keyCabang || c.includes(keyCabang);
          const matchS = !keyStudio || n.includes(keyStudio);
          return matchC && matchS;
        });
      }
    } else if (filterCol !== "ALL") {
      let keyword = "";
      if (filterCol === "1") keyword = filterStatus.toLowerCase().trim();
      else keyword = filterText.toLowerCase().trim();
      if (keyword) {
        const colIdx = filterCol;
        result = result.filter((j) => {
          let val = "";
          if (colIdx === "0") val = j.idJadwal || "";
          else if (colIdx === "1") val = j.status || "";
          else if (colIdx === "3") val = j.platform || "";
          else if (colIdx === "5") val = j.streamerKaryawan?.namaLengkap || "";
          else if (colIdx === "4") val = j.streamerKaryawan?.idKaryawan || "";
          return val.toLowerCase().includes(keyword);
        });
      }
    }

    return result;
  }, [jadwal, filterPeriode, filterExactDate, filterRangeStart, filterRangeEnd, filterWaktuToggle, filterJamMulai, filterJamAkhir, filterCol, filterText, filterStatus, filterCabang, filterStudio]);

  const totalPages = Math.max(1, Math.ceil(filteredLive.length / rowsPerPage));
  const paginatedLive = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredLive.slice(start, start + rowsPerPage);
  }, [filteredLive, page]);

  // ---- Fetch marketplace per subTab ----
  async function loadMarket() {
    setMarketLoading(true);
    try {
      const data = await fetchJson<MarketListing[]>("/api/marketplace?view=eligible");
      setMarketListings(Array.isArray(data) ? data : []);
    } catch {
      setMarketListings([]);
    } finally {
      setMarketLoading(false);
    }
  }
  async function loadKeranjang(hostId?: string) {
    setKeranjangLoading(true);
    try {
      const qs = hostId ? `&hostId=${encodeURIComponent(hostId)}` : "";
      const data = await fetchJson<KeranjangItem[]>(`/api/marketplace?view=keranjang${qs}`);
      setKeranjangList(Array.isArray(data) ? data : []);
    } catch {
      setKeranjangList([]);
    } finally {
      setKeranjangLoading(false);
    }
  }
  async function loadHistory(hostId?: string) {
    setHistoryLoading(true);
    try {
      const qs = hostId ? `&hostId=${encodeURIComponent(hostId)}` : "";
      const data = await fetchJson<HistoryItem[]>(`/api/marketplace?view=history_market${qs}`);
      setHistoryList(Array.isArray(data) ? data : []);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Timer tick for keranjang 15-min countdown (ref startKeranjangTimers)
  useEffect(() => {
    if (subTab !== "keranjang" || keranjangList.length === 0) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [subTab, keranjangList.length]);

  // Auto-refresh keranjang when expiry hits 0 (call auto-cancel via backend expire)
  useEffect(() => {
    if (subTab !== "keranjang") return;
    const hasExpiring = keranjangList.some((k) => new Date(k.expireAt).getTime() - nowMs <= 0);
    if (hasExpiring) {
      // Re-fetch to let backend expireStaleBookings move APPLIED → DECLINED
      const timer = setTimeout(() => loadKeranjang(hostFilterKeranjang || undefined), 1200);
      return () => clearTimeout(timer);
    }
  }, [nowMs, keranjangList, subTab, hostFilterKeranjang]);

  useEffect(() => {
    if (subTab === "market") loadMarket();
    if (subTab === "keranjang") loadKeranjang(hostFilterKeranjang || undefined);
    if (subTab === "history_market") loadHistory(hostFilterKeranjang || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // Admin host options for keranjang filter (reuse eligible listings' streamers or fetch karyawan)
  useEffect(() => {
    if (!isAdminMarket || subTab === "live") return;
    // Build host list from keranjang+history+market streamers
    const ids = new Map<string, { id: string; idKaryawan: string; namaLengkap: string }>();
    [...keranjangList, ...historyList].forEach((k) => {
      const s = k.streamer;
      if (s && s.id && !ids.has(s.id)) ids.set(s.id, s);
    });
    if (ids.size > 0) setHostOptions(Array.from(ids.values()));
  }, [keranjangList, historyList, isAdminMarket, subTab]);

  async function handleTake(listingId: string) {
    setMarketActionId(listingId);
    try {
      await sendJson("/api/marketplace", "POST", { action: "takeMarketplaceJob", listingId });
      await Promise.all([loadMarket(), loadKeranjang(hostFilterKeranjang || undefined)]);
      setConfirmTakeId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengambil jadwal");
    } finally {
      setMarketActionId(null);
    }
  }
  async function handleCancel(listingId: string) {
    if (!confirm("Yakin ingin membatalkan pengambilan jadwal ini? Orderan akan dikembalikan ke Marketplace.")) return;
    setMarketActionId(listingId);
    try {
      await sendJson("/api/marketplace", "POST", { action: "cancelMarketplaceJob", listingId });
      await Promise.all([loadMarket(), loadKeranjang(hostFilterKeranjang || undefined)]);
      setSelectedKeranjangIds((prev) => prev.filter((id) => id !== listingId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setMarketActionId(null);
    }
  }
  function toggleKeranjangSelect(listingId: string, checked: boolean) {
    setSelectedKeranjangIds((prev) => (checked ? [...prev, listingId] : prev.filter((id) => id !== listingId)));
  }
  async function handleFinalizeMassal() {
    if (selectedKeranjangIds.length === 0) return;
    if (!confirm(`Yakin ingin menyetujui ${selectedKeranjangIds.length} Jadwal ini menjadi JADWAL FIX?`)) return;
    setMarketActionId("finalize");
    try {
      await sendJson("/api/marketplace", "POST", { action: "finalizeKeranjangMassal", TARGET_IDS: selectedKeranjangIds });
      setSelectedKeranjangIds([]);
      await Promise.all([loadMarket(), loadKeranjang(hostFilterKeranjang || undefined), loadHistory(hostFilterKeranjang || undefined)]);
      alert("Berhasil difinalisasi menjadi JADWAL FIX");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal finalisasi");
    } finally {
      setMarketActionId(null);
    }
  }

  // Market filter uses real marketListings, not jadwal
  const filteredMarket = useMemo(() => {
    let items = [...marketListings];
    if (filterDateMarket && items.some((m) => m.jadwal?.tanggal)) {
      items = items.filter((m) => {
        const jadwalTanggal = m.jadwal?.tanggal;
        if (jadwalTanggal) {
          const d = new Date(jadwalTanggal);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return iso === filterDateMarket;
        }
        return true;
      });
    }
    if (filterCabangMarket) {
      const key = filterCabangMarket.toLowerCase();
      items = items.filter((m) => {
        const c = (m.jadwal?.cabangStudio || "").toLowerCase();
        return c.includes(key) || (m.title || "").toLowerCase().includes(key);
      });
    }
    if (filterWaktuMarket) {
      items = items.filter((m) => {
        const j = m.jadwal;
        if (!j?.jamMulaiLive) return true;
        const jam = parseMinutes(formatTimeSafe(j.jamMulaiLive, ""));
        if (jam === null) return false;
        const h = Math.floor(jam / 60);
        if (filterWaktuMarket === "09-17") return h >= 9 && h < 17;
        if (filterWaktuMarket === "17-01") return h >= 17 || h < 1;
        if (filterWaktuMarket === "01-09") return h >= 1 && h < 9;
        return true;
      });
    }
    return items;
  }, [marketListings, filterDateMarket, filterCabangMarket, filterWaktuMarket]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <SectionLoader text="Memuat jadwal live streaming Anda..." subtext="Menyelaraskan data sesi siaran dan status on air..." />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
      {/* Header + sub-tabs ref */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 border-b border-slate-200 pb-3 gap-4">
        <h3 className="font-bold text-lg text-slate-900">Jadwal & Marketplace</h3>
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
          <button type="button" onClick={() => setSubTab("live")} className={`py-1.5 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${subTab === "live" ? "text-[#941A0B] border-[#941A0B]" : "text-slate-500 border-transparent hover:text-[#941A0B]"}`}>
            Jadwal Live
          </button>
          <button type="button" onClick={() => setSubTab("market")} className={`py-1.5 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${subTab === "market" ? "text-[#941A0B] border-[#941A0B]" : "text-slate-500 border-transparent hover:text-[#941A0B]"}`}>
            Marketplace
          </button>
          <button type="button" onClick={() => setSubTab("keranjang")} className={`py-1.5 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${subTab === "keranjang" ? "text-[#941A0B] border-[#941A0B]" : "text-slate-500 border-transparent hover:text-[#941A0B]"}`}>
            <i className="fa-solid fa-cart-shopping" /> Keranjang
          </button>
          <button type="button" onClick={() => setSubTab("history_market")} className={`py-1.5 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${subTab === "history_market" ? "text-[#941A0B] border-[#941A0B]" : "text-slate-500 border-transparent hover:text-[#941A0B]"}`}>
            <i className="fa-solid fa-clock-rotate-left" /> History Market
          </button>
        </div>
      </div>

      {/* VIEW: JADWAL LIVE */}
      {subTab === "live" && (
        <div className="space-y-4">
          {/* Filter grid 4 kolom ref */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full">
            {/* Blok 1: Periode */}
            <div className="flex flex-col gap-2 w-full">
              <select value={filterPeriode} onChange={(e) => { setFilterPeriode(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#941A0B]">
                <option value="ALL">-- Semua Periode --</option>
                <option value="TODAY">Hari Ini</option>
                <option value="PREV_7">7 Hari Ke Belakang</option>
                <option value="NEXT_7">7 Hari Ke Depan</option>
                <option value="PREV_35">35 Hari Ke Belakang</option>
                <option value="NEXT_35">35 Hari Ke Depan</option>
                <option value="EXACT_DATE">Tentukan Tanggal...</option>
                <option value="CUSTOM">Kustom Periode...</option>
              </select>
              {filterPeriode === "EXACT_DATE" && (
                <input type="date" value={filterExactDate} onChange={(e) => { setFilterExactDate(e.target.value); setPage(1); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B] font-bold" />
              )}
              {filterPeriode === "CUSTOM" && (
                <div className="flex items-center gap-1.5">
                  <input type="date" value={filterRangeStart} onChange={(e) => { setFilterRangeStart(e.target.value); setPage(1); }} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                  <span className="text-slate-500 font-bold">-</span>
                  <input type="date" value={filterRangeEnd} onChange={(e) => { setFilterRangeEnd(e.target.value); setPage(1); }} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                </div>
              )}
            </div>

            {/* Blok 2: Rentang Jam */}
            <div className="flex flex-col gap-2 w-full">
              <select value={filterWaktuToggle} onChange={(e) => { setFilterWaktuToggle(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#941A0B]">
                <option value="ALL">-- Semua Jam --</option>
                <option value="CUSTOM">Pilih Rentang Jam...</option>
              </select>
              {filterWaktuToggle === "CUSTOM" && (
                <div className="flex gap-2 items-center">
                  <input type="time" value={filterJamMulai} onChange={(e) => { setFilterJamMulai(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B] font-bold" />
                  <span className="text-slate-500 font-bold">-</span>
                  <input type="time" value={filterJamAkhir} onChange={(e) => { setFilterJamAkhir(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B] font-bold" />
                </div>
              )}
            </div>

            {/* Blok 3: Kolom Data */}
            <div className="flex flex-col gap-2 w-full">
              <select value={filterCol} onChange={(e) => { setFilterCol(e.target.value); setFilterStatus(""); setFilterCabang(""); setFilterStudio(""); setFilterText(""); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-[#941A0B]">
                <option value="ALL">-- Semua Data --</option>
                <option value="0">ID Jadwal</option>
                <option value="1">Status</option>
                <option value="3">Platform</option>
                <option value="5">Nama Streamer</option>
                <option value="4">ID Host</option>
                <option value="6">Cabang & Studio</option>
              </select>
            </div>

            {/* Blok 4: Pencarian / dropdown pengganti */}
            <div className="flex flex-col gap-2 w-full">
              {filterCol === "ALL" || ["0", "3", "5", "4"].includes(filterCol) ? (
                <div className="relative w-full">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm" />
                  <input type="text" value={filterText} onChange={(e) => { setFilterText(e.target.value); setPage(1); }} placeholder="Ketik untuk mencari..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]" />
                </div>
              ) : null}
              {filterCol === "1" && (
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]">
                  <option value="">-- Pilih Status --</option>
                  <option value="TERJADWAL">TERJADWAL</option>
                  <option value="PREPARE">PREPARE</option>
                  <option value="ON AIR">ON AIR</option>
                  <option value="PERLU LAPOR">PERLU LAPOR</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="BATAL">BATAL</option>
                </select>
              )}
              {filterCol === "6" && (
                <>
                  <select value={filterCabang} onChange={(e) => { setFilterCabang(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]">
                    <option value="">-- Semua Cabang --</option>
                    <option value="timoho">Timoho</option>
                    <option value="berbah">Berbah</option>
                    <option value="wiyoro">Wiyoro</option>
                  </select>
                  <select value={filterStudio} onChange={(e) => { setFilterStudio(e.target.value); setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]">
                    <option value="">-- Semua Studio --</option>
                    <option value="studio 1">Studio 1</option>
                    <option value="studio 2">Studio 2</option>
                    <option value="studio 3">Studio 3</option>
                    <option value="studio 4">Studio 4</option>
                    <option value="studio 5">Studio 5</option>
                    <option value="studio 6">Studio 6</option>
                    <option value="studio 7">Studio 7</option>
                    <option value="studio 8">Studio 8</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative">
              <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-100 z-30 shadow-[1px_0_0_#cbd5e1] text-center min-w-[50px]">NO</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[100px]">STATUS</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">WAKTU LIVE</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[130px]">WAJIB HADIR</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">PLATFORM</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">STREAMER</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[80px]">INFO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLive.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">Tidak ada jadwal untuk filter tersebut.</td></tr>
                  ) : (
                    paginatedLive.map((j, idx) => {
                      const globalIdx = (page - 1) * rowsPerPage + idx + 1;
                      const status = j.status || "TERJADWAL";
                      let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                      if (status === "SELESAI" || status === "JADWAL FIX") badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
                      else if (status === "BATAL" || status === "REJECTED") badgeColor = "bg-red-100 text-red-700 border-red-200";
                      else if (status === "ON AIR" || j.liveState === "LIVE") badgeColor = "bg-rose-100 text-rose-700 border-rose-200 animate-pulse";
                      else if (["PREPARE", "PENDING", "BOOKED"].includes(status)) badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
                      else if (status === "TERJADWAL") badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
                      else if (status === "PERLU LAPOR") badgeColor = "bg-orange-100 text-orange-700 border-orange-200";

                      const mulai = formatTimeSafe(j.jamMulaiLive, "-");
                      const selesai = formatTimeSafe(j.jamSelesaiLive, "-");
                      const durasi = formatDurationHHMM(j.jamMulaiLive, j.jamSelesaiLive, "-");
                      const wajib = calcWajibHadir(j.jamMulaiLive);
                      const tgl = formatDateSafe(j.tanggal, { day: "2-digit", month: "short", year: "numeric" });
                      const cabang = j.cabangStudio || "-";
                      const studio = j.nomorStudio || j.studio || "-";
                      const plat = j.platform || "-";
                      const idJadwal = j.idJadwal || "-";
                      const idKaryawan = j.streamerKaryawan?.idKaryawan || "-";
                      const streamer = j.streamerKaryawan?.namaLengkap || "-";
                      const hasInfo = Boolean((j.judulLive && j.judulLive !== "-") || (j.promoLive && j.promoLive !== "-") || (j.produkPrioritas && j.produkPrioritas !== "-") || (j.filePendukungHostDriveId && j.filePendukungHostDriveId !== "-") || (j.catatanHost && j.catatanHost !== "-"));

                      return (
                        <tr key={j.id} className="hover:bg-slate-50 transition duration-150 group border-b border-slate-100">
                          <td className="px-4 py-3 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#cbd5e1] font-bold text-slate-500 text-sm">{globalIdx}</td>
                          <td className="px-4 py-3 text-center align-middle"><span className={`px-2 py-1 text-[10px] font-bold rounded shadow-sm border tracking-wide ${badgeColor}`}>{status}</span></td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 text-sm tabular-nums">{mulai} - {selesai}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 tabular-nums">Durasi: {durasi}</p>
                            <p className="text-[11px] font-bold text-[#941A0B] mt-0.5">{tgl}</p>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="text-sm font-black text-emerald-600 mb-1 tabular-nums">{wajib}</div>
                            <div className="text-[11px] font-bold text-slate-700 mt-0.5 whitespace-normal max-w-[130px] break-words mx-auto">{cabang}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{studio}</div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 text-sm whitespace-normal max-w-[150px] break-words">{plat}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID JADWAL: <span className="font-bold">{idJadwal}</span></p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-700 text-sm whitespace-normal max-w-[160px] break-words">{streamer}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID HOST: <span className="font-bold">{idKaryawan}</span></p>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            {hasInfo ? (
                              <button type="button" onClick={() => setInfoJadwal(j)} className="text-[#941A0B] hover:text-white hover:bg-[#941A0B] bg-[#941A0B]/10 w-8 h-8 rounded-full transition-colors flex items-center justify-center mx-auto border border-[#941A0B]/20" title="Lihat Info Lengkap"><i className="fa-solid fa-book text-xs" /></button>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination ref */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 w-full">
              <p className="text-sm text-slate-600 font-medium">Menampilkan halaman <span className="font-black text-[#941A0B]">{page}</span> dari <span className="font-black text-slate-800">{totalPages}</span> (<span className="font-bold">{filteredLive.length}</span> Jadwal)</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50">Prev</button>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>

          {/* Modal INFO ala ref lihatInfoLainDinamicStreamer */}
          {infoJadwal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={() => setInfoJadwal(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#941A0B] p-4 flex justify-between items-center text-white border-b border-[#7a160a] shrink-0">
                  <h3 className="font-bold text-base"><i className="fa-solid fa-circle-info mr-2" /> Info Jadwal Live</h3>
                  <button type="button" onClick={() => setInfoJadwal(null)} className="text-white hover:text-red-200"><i className="fa-solid fa-xmark text-xl" /></button>
                </div>
                <div className="p-6 space-y-4 text-sm text-left overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                  <div><span className="block text-slate-500 font-bold mb-1.5 text-xs uppercase tracking-wider"><i className="fa-solid fa-bullhorn mr-1" /> Judul Live:</span><div className="bg-white p-3 rounded-xl border border-slate-200 font-bold shadow-sm">{infoJadwal.judulLive || "-"}</div></div>
                  <div><span className="block text-slate-500 font-bold mb-1.5 text-xs uppercase tracking-wider"><i className="fa-solid fa-tags mr-1" /> Promo Live:</span><div className="bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap shadow-sm">{infoJadwal.promoLive || "-"}</div></div>
                  <div><span className="block text-slate-500 font-bold mb-1.5 text-xs uppercase tracking-wider"><i className="fa-solid fa-box-open mr-1" /> Produk Prioritas:</span><div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">{infoJadwal.produkPrioritas || "-"}</div></div>
                  <div><span className="block text-slate-500 font-bold mb-1.5 text-xs uppercase tracking-wider"><i className="fa-solid fa-clipboard mr-1" /> Catatan Host:</span><div className="bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap shadow-sm">{infoJadwal.catatanHost || "-"}</div></div>
                  <div><span className="block text-slate-500 font-bold mb-1.5 text-xs uppercase tracking-wider"><i className="fa-solid fa-link mr-1" /> File Pendukung:</span><div className="bg-[#941A0B]/10 p-3 rounded-xl border border-[#941A0B]/20 shadow-sm">{infoJadwal.filePendukungHostDriveId ? <a href={infoJadwal.filePendukungHostDriveId.startsWith("http") ? infoJadwal.filePendukungHostDriveId : `https://${infoJadwal.filePendukungHostDriveId}`} target="_blank" rel="noopener noreferrer" className="text-[#941A0B] underline font-bold break-all flex items-center gap-2"><i className="fa-solid fa-cloud-arrow-down" /> Buka Tautan File</a> : "-"}</div></div>
                </div>
                <div className="p-4 bg-white border-t border-slate-200 text-right shrink-0">
                  <button type="button" onClick={() => setInfoJadwal(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-md">Tutup Info</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: MARKETPLACE — listing OPEN dengan Ambil */}
      {subTab === "market" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-blue-800 mb-1">Tanggal Live</label>
              <input type="date" value={filterDateMarket} onChange={(e) => setFilterDateMarket(e.target.value)} className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-blue-800 mb-1">Lokasi Studio</label>
              <select value={filterCabangMarket} onChange={(e) => setFilterCabangMarket(e.target.value)} className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Semua Cabang --</option>
                <option value="Timoho">Timoho</option><option value="Berbah">Berbah</option><option value="Wiyoro">Wiyoro</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-blue-800 mb-1">Rentang Waktu</label>
              <select value={filterWaktuMarket} onChange={(e) => setFilterWaktuMarket(e.target.value)} className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Semua Waktu --</option>
                <option value="09-17">09.00 - 17.00 WIB</option>
                <option value="17-01">17.00 - 01.00 WIB</option>
                <option value="01-09">01.00 - 09.00 WIB</option>
              </select>
            </div>
          </div>

          {marketLoading ? (
            <div className="text-center py-12 text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#941A0B] mb-2 block" />Memuat marketplace...</div>
          ) : filteredMarket.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><i className="fa-regular fa-folder-open text-4xl text-slate-300 mb-3 block" /><p className="text-slate-500 text-sm font-medium">Jadwal Marketplace tidak ditemukan.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMarket.slice(0, 12).map((m) => {
                const jadwalTanggal = m.jadwal?.tanggal;
                const jamMulai = m.jadwal?.jamMulaiLive;
                const jamSelesai = m.jadwal?.jamSelesaiLive;
                const tgl = jadwalTanggal ? formatDateSafe(jadwalTanggal) : "-";
                const jam = jamMulai && jamSelesai ? `${formatTimeSafe(jamMulai)} - ${formatTimeSafe(jamSelesai)}` : "-";
                const durasi = jamMulai && jamSelesai ? formatDurationHHMM(jamMulai, jamSelesai, "-") : "-";
                const cabang = m.jadwal?.cabangStudio || "-";
                const isTaking = marketActionId === m.id;
                const canTake = m.eligible && !m.alreadyApplied && !m.filled;
                return (
                  <div key={m.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="font-black text-slate-800 text-sm truncate" title={m.platform || m.title}>{m.platform || m.title}</h4>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200"><i className="fa-solid fa-clock mr-1" />{durasi}</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 tabular-nums">
                        <span className="flex items-center gap-1.5"><i className="fa-regular fa-calendar text-[#941A0B]" /> {tgl}</span><span className="text-emerald-600 text-[11px]">{jam}</span>
                      </div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Campaign / Judul Live</p><p className="text-sm font-bold text-slate-800 leading-tight">{m.title}</p>{m.client && <p className="text-[11px] text-slate-500">{m.client.namaClient}</p>}</div>
                      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Studio</p><p className="text-xs font-bold text-slate-700 flex items-center gap-1"><i className="fa-solid fa-building text-slate-400" /> {cabang}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kuota Host</p><p className="text-xs font-bold text-slate-700 flex items-center gap-1"><i className="fa-solid fa-users text-slate-400" /> {m.quota} Orang</p></div>
                      </div>
                      {!m.eligible && m.course && <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1.5 rounded-lg">Perlu sertifikasi: {m.course.title}</div>}
                      {m.filled && <div className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border">Kuota penuh</div>}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      {m.alreadyApplied ? (
                        <div className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold py-2.5 rounded-lg text-sm flex justify-center items-center gap-2"><i className="fa-solid fa-check" /> Sudah di Keranjang</div>
                      ) : canTake ? (
                        <button type="button" onClick={() => setConfirmTakeId(m.id)} disabled={isTaking} className="w-full bg-[#941A0B] hover:bg-[#7a160a] text-white font-bold py-2.5 rounded-lg text-sm shadow-md flex justify-center items-center gap-2 disabled:opacity-60">
                          {isTaking ? <><i className="fa-solid fa-circle-notch fa-spin" /> Memproses...</> : <><i className="fa-solid fa-hand-sparkles" /> Ambil Jadwal Ini</>}
                        </button>
                      ) : (
                        <button type="button" disabled className="w-full bg-slate-200 text-slate-400 font-bold py-2.5 rounded-lg text-sm cursor-not-allowed flex justify-center items-center gap-2"><i className="fa-solid fa-lock" /> Tidak Eligible</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm modal Ambil */}
          {confirmTakeId && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={() => setConfirmTakeId(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <h4 className="font-black text-slate-900">Ambil Jadwal Marketplace?</h4>
                  <p className="text-sm text-slate-600 mt-2">Jadwal akan masuk ke Keranjang (booking 15 menit). Lanjut finalisasi sebelum expired.</p>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmTakeId(null)} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold">Batal</button>
                  <button type="button" onClick={() => handleTake(confirmTakeId)} className="px-5 py-2 bg-[#941A0B] hover:bg-[#7a160a] text-white rounded-xl text-sm font-bold">Ya, Ambil</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: KERANJANG — BOOKED 15 menit + checkbox + Batal + Finalisasi massal */}
      {subTab === "keranjang" && (
        <div className="space-y-4">
          {isAdminMarket && (
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1"><i className="fa-solid fa-users text-[#941A0B] mr-1" />Pilih Host / Streamer (Admin)</label>
                <select value={hostFilterKeranjang} onChange={(e) => { setHostFilterKeranjang(e.target.value); loadKeranjang(e.target.value || undefined); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#941A0B]">
                  <option value="">-- Semua Host (booking saya) --</option>
                  {hostOptions.map((h) => <option key={h.id} value={h.id}>{h.idKaryawan} | {h.namaLengkap}</option>)}
                  <option value="__manual">🔍 Ketik manual belum tersedia — filter via histori</option>
                </select>
              </div>
              <button type="button" onClick={() => loadKeranjang(hostFilterKeranjang || undefined)} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold">Refresh</button>
            </div>
          )}

          {selectedKeranjangIds.length > 0 && (
            <div className="flex justify-between items-center bg-[#941A0B]/10 p-3 border border-[#941A0B]/20 rounded-lg">
              <span className="text-sm font-bold text-[#941A0B]"><span className="bg-white px-2 py-0.5 rounded shadow-sm text-[#941A0B] mr-1">{selectedKeranjangIds.length}</span> Jadwal Terpilih</span>
              <button type="button" onClick={handleFinalizeMassal} disabled={marketActionId === "finalize"} className="bg-[#941A0B] hover:bg-[#7a160a] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md disabled:opacity-60 flex items-center gap-2">
                {marketActionId === "finalize" ? <><i className="fa-solid fa-circle-notch fa-spin" /> Memproses...</> : <><i className="fa-solid fa-check-double" /> Finalisasi / Checkout</>}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-max text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center min-w-[60px]">PILIH</th>
                  <th className="px-4 py-3 min-w-[130px]">ID JADWAL</th>
                  <th className="px-4 py-3 min-w-[200px]">PLATFORM & CAMPAIGN</th>
                  <th className="px-4 py-3 min-w-[120px]">LOKASI STUDIO</th>
                  <th className="px-4 py-3 min-w-[160px]">TANGGAL & WAKTU</th>
                  <th className="px-4 py-3 text-center min-w-[150px]">AKSI / TIMER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {keranjangLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-[#941A0B] mr-2" />Memuat keranjang...</td></tr>
                ) : keranjangList.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500"><i className="fa-solid fa-cart-arrow-down text-3xl mb-2 text-slate-300 block" />Keranjang kosong.</td></tr>
                ) : (
                  keranjangList.map((k) => {
                    const listing = k.listing;
                    const jadwalData = listing?.jadwal;
                    const tgl = jadwalData?.tanggal ? formatDateSafe(jadwalData.tanggal) : "-";
                    const jam = jadwalData?.jamMulaiLive && jadwalData?.jamSelesaiLive ? `${formatTimeSafe(jadwalData.jamMulaiLive)} - ${formatTimeSafe(jadwalData.jamSelesaiLive)}` : listing?.title || "-";
                    const platformUi = listing?.platform || listing?.title || "-";
                    const lokasi = jadwalData?.cabangStudio || "-";
                    const idJadwal = jadwalData?.idJadwal || listing?.id || "-";
                    const isChecked = selectedKeranjangIds.includes(listing?.id || "");
                    const expireMs = new Date(k.expireAt).getTime() - nowMs;
                    const isExpired = expireMs <= 0;
                    const mins = Math.floor(Math.max(0, expireMs) / 60000);
                    const secs = Math.floor((Math.max(0, expireMs) % 60000) / 1000);
                    return (
                      <tr key={k.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center align-middle">
                          {isExpired ? <i className="fa-solid fa-lock text-slate-300" title="Expired" /> : <input type="checkbox" checked={isChecked} onChange={(e) => toggleKeranjangSelect(listing!.id, e.target.checked)} className="w-4 h-4 text-[#941A0B] rounded border-slate-300 focus:ring-[#941A0B] cursor-pointer" />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 align-middle">{idJadwal}</td>
                        <td className="px-4 py-3 align-middle"><p className="font-bold text-slate-800">{platformUi}</p><p className="text-[10px] text-slate-500 max-w-[200px] truncate">{listing?.title}</p></td>
                        <td className="px-4 py-3 align-middle"><p className="text-xs font-bold text-slate-700 flex items-center gap-1"><i className="fa-solid fa-building text-slate-400" /> {lokasi}</p></td>
                        <td className="px-4 py-3 align-middle"><p className="font-medium text-slate-700">{tgl}</p><p className="text-xs font-bold text-emerald-600 mt-0.5">{jam}</p></td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button type="button" id={`btnCancel_${listing?.id}`} onClick={() => handleCancel(listing!.id)} disabled={marketActionId === listing?.id} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap disabled:opacity-50">
                              {marketActionId === listing?.id ? <><i className="fa-solid fa-circle-notch fa-spin mr-1" /> Memproses...</> : <><i className="fa-solid fa-xmark mr-1" /> Batal Ambil</>}
                            </button>
                            <div className="keranjang-timer text-[11px] flex justify-center items-center" data-booktime={k.waktuBooking} data-jobid={listing?.id}>
                              {isExpired ? <span className="text-red-600 font-black"><i className="fa-solid fa-skull-crossbones mr-1" /> EXPIRED</span> : <span className="bg-red-50 text-red-600 px-2 py-1 rounded shadow-sm border border-red-200"><i className="fa-regular fa-clock mr-1" />{mins}m {secs}s</span>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: HISTORY MARKET */}
      {subTab === "history_market" && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-max text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 min-w-[130px]">ID JADWAL</th>
                <th className="px-4 py-3 min-w-[200px]">PLATFORM & CAMPAIGN</th>
                <th className="px-4 py-3 min-w-[120px]">LOKASI STUDIO</th>
                <th className="px-4 py-3 min-w-[160px]">TANGGAL & WAKTU</th>
                <th className="px-4 py-3 text-center min-w-[150px]">STATUS TRANSAKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {historyLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-[#941A0B] mr-2" />Memuat history...</td></tr>
              ) : historyList.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Tidak ada history.</td></tr>
              ) : (
                historyList.map((h) => {
                  const listing = h.listing;
                  const jadwalData = listing?.jadwal;
                  const idJadwal = jadwalData?.idJadwal || listing?.id || "-";
                  const tgl = jadwalData?.tanggal ? formatDateSafe(jadwalData.tanggal) : "-";
                  const jam = jadwalData?.jamMulaiLive && jadwalData?.jamSelesaiLive ? `${formatTimeSafe(jadwalData.jamMulaiLive)} - ${formatTimeSafe(jadwalData.jamSelesaiLive)}` : "-";
                  const isPicked = h.status === "PICKED";
                  const badge = isPicked ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200";
                  const label = isPicked ? "JADWAL FIX" : h.status === "DECLINED" ? "BATAL" : h.status;
                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{idJadwal}</td>
                      <td className="px-4 py-3"><p className="font-bold text-slate-800">{listing?.platform || listing?.title || "-"}</p><p className="text-[10px] text-slate-500 truncate max-w-[200px]">{listing?.title}</p></td>
                      <td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{jadwalData?.cabangStudio || "-"}</p></td>
                      <td className="px-4 py-3"><p className="font-medium text-slate-700">{tgl}</p><p className="text-xs font-bold text-emerald-600">{jam}</p></td>
                      <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 text-[10px] font-bold rounded border ${badge}`}>{label}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
