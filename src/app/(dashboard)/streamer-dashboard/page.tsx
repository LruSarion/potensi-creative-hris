"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { LocationCoordinates } from "@/components/streamer-dashboard/live-camera-checkin";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import { STUDIOS } from "@/types/jadwal";
import {
  formatDateSafe,
} from "@/lib/utils/date-format";
import { TabReport } from "@/components/streamer-dashboard/tab-report";
import { TabJadwal } from "@/components/streamer-dashboard/tab-jadwal";
import { TabCheckIn } from "@/components/streamer-dashboard/tab-checkin";
import { TabCheckOut } from "@/components/streamer-dashboard/tab-checkout";
import {
  getScheduleEndFromSession,
  getCheckoutWindowState,
  // TODO(hapus-profil): hanya dipakai kartu profil (status pill) — ikut dihapus.
  // getStreamerActiveSessionState,
  CHECKOUT_WINDOW_HOURS,
} from "@/components/streamer-dashboard/checkout-window";
import { TabTerbatas } from "@/components/streamer-dashboard/tab-terbatas";
import { getLateCheckInStatus } from "@/components/streamer-dashboard/late-check";
import { TabRiwayat } from "@/components/streamer-dashboard/tab-riwayat";
import { TabRequest } from "@/components/streamer-dashboard/tab-request";
import type { ShiftFormEntry, KuotaCheckResult } from "@/components/streamer-dashboard/tab-request";
import { BuktiFotoModal, ImageLightbox } from "@/components/streamer-dashboard/history-modals";
import {
  STREAMER_TABS,
  type ActiveSession,
  type TerbatasData,
  type Jadwal,
  type DashboardData,
  type AbsensiHistory,
  type PerluLaporItem,
  type JedaJadwal,
  type SelectedTerbatasJadwal,
  type RequestStatusData,
} from "@/components/streamer-dashboard/types";

export default function StreamerDashboardPage() {
  const { data: session } = useSession();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(session?.user?.role ?? "");
  const isReportAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(session?.user?.role ?? "");
  // Pengajuan Libur hanya untuk role Streamer (ala ref-deploy isStreamer)
  const isStreamer = String(session?.user?.role ?? "").toUpperCase().includes("STREAMER");

  const [activeTab, setActiveTab] = useState("checkin");
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [pendingGmvList, setPendingGmvList] = useState<PerluLaporItem[]>([]);
  // Report tab host selection state (ref-deploy report-admin-filter)
  const [reportHostId, setReportHostId] = useState<string>("");
  const [reportHostList, setReportHostList] = useState<{ id: string; idKaryawan: string; namaLengkap: string }[]>([]);
  const [reportPeriode, setReportPeriode] = useState<string>("");
  // TODO(hapus-profil): state tiering hanya dipakai kartu profil — dipertahankan sebagai komentar.
  // const [tiering, setTiering] = useState<{ tier: string; jamMinimal: number; jamMaksimal: number; ratePerJam: number }[]>([]);
  const [absensiHistory, setAbsensiHistory] = useState<AbsensiHistory[]>([]);

  // Check-in form state
  const [selectedJadwalId, setSelectedJadwalId] = useState("");
  const [selectedJadwalDetail, setSelectedJadwalDetail] = useState<Jadwal | null>(null);
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState("");
  const [alasanTerlambat, setAlasanTerlambat] = useState("");
  const [checkInLocation, setCheckInLocation] = useState<LocationCoordinates | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Check-out form state
  const [reportedGmv, setReportedGmv] = useState("");
  const [checkoutStudio, setCheckoutStudio] = useState("Studio Timoho 1");
  const [studioList, setStudioList] = useState<{ name: string; cabang: string; no: string }[]>(STUDIOS);
  const [checkoutFotoGmv, setCheckoutFotoGmv] = useState("");
  const [checkoutFotoUrl, setCheckoutFotoUrl] = useState("");
  const [checkoutCatatan, setCheckoutCatatan] = useState("");
  const [checkoutLocation, setCheckoutLocation] = useState<LocationCoordinates | null>(null);
  const [checkoutHasCamera, setCheckoutHasCamera] = useState(true);
  const [checkoutCameraError, setCheckoutCameraError] = useState<string | null>(null);

  // Terbatas Tab state (Matches Ref-Deploy)
  const [subTabTerbatas, setSubTabTerbatas] = useState<"jeda" | "lapor">("jeda");
  const [terbatasData, setTerbatasData] = useState<TerbatasData>({ jedaTerbatas: [], perluLapor: [] });
  const [filterColTerbatas, setFilterColTerbatas] = useState<"ALL" | "DATE" | "PLATFORM" | "STREAMER">("ALL");
  const [filterTextTerbatas, setFilterTextTerbatas] = useState("");
  const [selectedTerbatasJadwal, setSelectedTerbatasJadwal] = useState<SelectedTerbatasJadwal | null>(null);
  const [formTerbatasStudio, setFormTerbatasStudio] = useState("Studio Timoho 1");
  const [formTerbatasGmv, setFormTerbatasGmv] = useState("");
  const [formTerbatasCatatan, setFormTerbatasCatatan] = useState("");
  const [formTerbatasFotoGmv, setFormTerbatasFotoGmv] = useState("");
  const [formTerbatasFotoKeluar, setFormTerbatasFotoKeluar] = useState("");
  const [formTerbatasLocGmv, setFormTerbatasLocGmv] = useState<LocationCoordinates | null>(null);
  const [formTerbatasLocKeluar, setFormTerbatasLocKeluar] = useState<LocationCoordinates | null>(null);
  const [submittingTerbatas, setSubmittingTerbatas] = useState(false);

  // Request Tab state
  const [requestStatus, setRequestStatus] = useState<RequestStatusData | null>(null);
  // TODO(ref-deploy-request): struktur lama — requestSubTab diganti reqCategory/reqSubLibur/reqSubSesi.
  // const [requestSubTab, setRequestSubTab] = useState<"libur" | "sesi">("libur");
  const [reqCategory, setReqCategory] = useState<"libur" | "sesilive">("libur");
  const [reqSubLibur, setReqSubLibur] = useState<"jadwal" | "pengajuan">("jadwal");
  const [reqSubSesi, setReqSubSesi] = useState<"history" | "pengajuan">("pengajuan");
  const [liburCalendar, setLiburCalendar] = useState<{ id: string; tanggal: string; alasan?: string | null }[]>([]);
  const [cekLiburMsg, setCekLiburMsg] = useState<string | null>(null);
  const [verifiedLiburDate, setVerifiedLiburDate] = useState<string | null>(null);
  const [leaveDate, setLeaveDate] = useState("");
  // Kuota libur: peta sebulan + detail tanggal + ketersediaan shift per form
  const [kuotaMap, setKuotaMap] = useState<Record<string, { kuota: number; sisa: number; blackout: boolean }>>({});
  const [liburDetail, setLiburDetail] = useState<null | {
    tanggal: string; kuota: number; terpakai: number; sisa: number;
    blackout: boolean; blackoutKind: string | null; kebutuhanJam: number;
  }>(null);
  const [shiftAvailByForm, setShiftAvailByForm] = useState<Record<number, { sesi: string; label: string; sisa: number }[]>>({});
  // Shift multi-form accordion state
  const [shiftForms, setShiftForms] = useState<ShiftFormEntry[]>([
    { id: 1, tanggal: "", shift: "", expanded: true },
  ]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [kuotaCheckResult, setKuotaCheckResult] = useState<KuotaCheckResult | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // History tab filters & pagination (matching ref-deploy)
  const [filterPeriodeHistory, setFilterPeriodeHistory] = useState("ALL");
  const [filterRangeStartHistory, setFilterRangeStartHistory] = useState("");
  const [filterRangeEndHistory, setFilterRangeEndHistory] = useState("");
  const [filterColHistory, setFilterColHistory] = useState("ALL");
  const [filterTextHistory, setFilterTextHistory] = useState("");
  const [filterStatusHistory, setFilterStatusHistory] = useState("");
  const [pageHistory, setPageHistory] = useState(1);
  const rowsPerPageHistory = 10;
  const [selectedBuktiHistory, setSelectedBuktiHistory] = useState<AbsensiHistory | null>(null);
  const [selectedLocationTab, setSelectedLocationTab] = useState<"keluar" | "masuk">("keluar");
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; title: string } | null>(null);

  // Tab Slider Horizontal Drag-to-Scroll & Mouse Wheel Scroll (ref-deploy parity)
  const tabSliderRef = useRef<HTMLDivElement | null>(null);
  const isTabDraggingRef = useRef(false);
  const startXTabRef = useRef(0);
  const scrollLeftTabRef = useRef(0);
  const hasTabDraggedRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const slider = tabSliderRef.current;
    if (!slider) return;
    setCanScrollLeft(slider.scrollLeft > 5);
    setCanScrollRight(slider.scrollLeft < slider.scrollWidth - slider.clientWidth - 5);
  };

  const scrollTabs = (direction: "left" | "right") => {
    const slider = tabSliderRef.current;
    if (!slider) return;
    const offset = direction === "left" ? -240 : 240;
    slider.scrollBy({ left: offset, behavior: "smooth" });
    setTimeout(updateScrollButtons, 350);
  };

  useEffect(() => {
    const slider = tabSliderRef.current;
    if (!slider) return;

    updateScrollButtons();
    slider.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);

    const handleWheel = (e: WheelEvent) => {
      if (slider.scrollWidth <= slider.clientWidth) return;
      // If scrolling mouse wheel vertically on laptop, convert deltaY into horizontal scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const canLeft = slider.scrollLeft > 0;
        const canRight = slider.scrollLeft < (slider.scrollWidth - slider.clientWidth - 1);
        if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
          e.preventDefault();
          slider.scrollLeft += e.deltaY;
          updateScrollButtons();
        }
      }
    };

    slider.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      slider.removeEventListener("scroll", updateScrollButtons);
      slider.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, []);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    const slider = tabSliderRef.current;
    if (!slider) return;
    const activeBtn = slider.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    setTimeout(updateScrollButtons, 350);
  }, [activeTab]);

  // Catatan: TANPA setPointerCapture — capture mengarahkan mouseup/click ke
  // container sehingga onClick tombol tab tidak pernah terpicu (tab tak bisa
  // dipilih). Drag cukup dilacak via pointermove di container + threshold,
  // klik ditelan hanya bila pointer benar-benar digeser > 6px.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const slider = tabSliderRef.current;
    if (!slider) return;
    isTabDraggingRef.current = true;
    hasTabDraggedRef.current = false;
    startXTabRef.current = e.clientX;
    scrollLeftTabRef.current = slider.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTabDraggingRef.current) return;
    const slider = tabSliderRef.current;
    if (!slider) return;
    const dx = e.clientX - startXTabRef.current;
    if (Math.abs(dx) > 6) {
      hasTabDraggedRef.current = true;
    }
    slider.scrollLeft = scrollLeftTabRef.current - dx * 1.5;
    updateScrollButtons();
  };

  const handlePointerUp = () => {
    if (!isTabDraggingRef.current) return;
    isTabDraggingRef.current = false;
    // Reset setelah click event sempat membaca flag (click menyusul pointerup).
    setTimeout(() => {
      hasTabDraggedRef.current = false;
    }, 80);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Lazy tab data loaders on tab change
  useEffect(() => {
    if (activeTab === "report") {
      if (isReportAdmin) {
        loadReportHostList();
      } else {
        loadDashboardData();
      }
    } else if (activeTab === "riwayat") {
      loadAbsensiHistory();
    } else if (activeTab === "terbatas") {
      loadTerbatasData();
    } else if (activeTab === "request") {
      loadRequestStatus();
      const now = new Date();
      loadKuotaBulan(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeSession && activeTab === "checkin") {
      setActiveTab("checkout");
    }
  }, [activeSession, activeTab]);

  async function loadRequestStatus(force = false) {
    if (requestStatus && !force) return;
    try {
      const [data, libur] = await Promise.all([
        fetchJson<RequestStatusData>("/api/streamer?view=request-status").catch(() => null),
        fetchJson<{ id: string; tanggal: string; alasan?: string | null }[]>("/api/streamer?view=libur").catch(() => null),
      ]);
      if (data) setRequestStatus(data);
      if (Array.isArray(libur)) setLiburCalendar(libur);
    } catch {
      // ignore
    }
  }

  async function loadDashboardData(force = false) {
    if (dashboardData && !force) return;
    try {
      const d = await fetchJson<DashboardData>("/api/streamer?view=dashboard");
      if (d) setDashboardData(d);
    } catch {
      // ignore
    }
  }

  async function loadAbsensiHistory(force = false) {
    if (absensiHistory.length > 0 && !force) return;
    try {
      const h = await fetchJson<AbsensiHistory[]>("/api/absensi?view=history");
      if (Array.isArray(h)) setAbsensiHistory(h);
    } catch {
      // ignore
    }
  }

  async function loadTerbatasData(force = false) {
    if ((terbatasData.jedaTerbatas.length > 0 || terbatasData.perluLapor.length > 0) && !force) return;
    try {
      const tb = await fetchJson<TerbatasData>("/api/streamer?view=terbatas");
      if (tb) {
        setTerbatasData(tb);
        if (tb.perluLapor) setPendingGmvList(tb.perluLapor);
      }
    } catch {
      // ignore
    }
  }

  // Cek Libur Terakhir (ref-deploy cekLiburMingguan) — re-fetch fresh ke API
  // kuota-libur agar validasi server (BLACKOUT/ALREADY_BOOKED/K3/WEEKLY/QUOTA).
  // Berhasil (code OK) -> verifiedLiburDate dikunci ke tanggal tsb;
  // ganti tanggal me-reset gate (handleLeaveDateChange).
  async function handleCekLibur() {
    if (!isStreamer) {
      const msg = "Akses Ditolak: fitur cek kuota libur hanya untuk role Streamer.";
      toast.warning(msg);
      setCekLiburMsg(msg);
      setVerifiedLiburDate(null);
      return;
    }
    if (!leaveDate) {
      setCekLiburMsg("Silakan pilih tanggal di kalender terlebih dahulu.");
      setVerifiedLiburDate(null);
      return;
    }
    try {
      const res = await fetchJson<{ code: string; message: string }>(
        `/api/streamer?view=kuota-libur&tanggal=${encodeURIComponent(leaveDate)}`,
        { cache: "no-store" }
      );
      setCekLiburMsg(res.message);
      setVerifiedLiburDate(res.code === "OK" ? leaveDate : null);
    } catch (err) {
      // Server melempar 4xx dengan pesan kode validasi (QUOTA_FULL, WEEKLY_LIMIT, ...)
      setCekLiburMsg(errorMessage(err, "Gagal mengecek kuota libur"));
      setVerifiedLiburDate(null);
    }
  }

  // Peta kuota sebulan untuk calendar history (kuota/sisa per tanggal)
  const loadKuotaBulan = useCallback(async (yyyyMM: string) => {
    try {
      const res = await fetchJson<{ map: Record<string, { kuota: number; sisa: number; blackout: boolean }> }>(
        `/api/streamer?view=kuota-bulan&bulan=${encodeURIComponent(yyyyMM)}`,
        { cache: "no-store" }
      );
      setKuotaMap(res.map ?? {});
    } catch { /* ignore — kalender tetap tampil tanpa badge kuota */ }
  }, []);

  // Klik tanggal di kalender -> tampilkan detail kuota (tanpa pindah tab)
  async function handleLiburDateSelect(ymd: string) {
    const m = kuotaMap[ymd];
    setLiburDetail({
      tanggal: ymd,
      kuota: m?.kuota ?? 0,
      terpakai: Math.max(0, (m?.kuota ?? 0) - (m?.sisa ?? 0)),
      sisa: m?.sisa ?? 0,
      blackout: !!m?.blackout,
      blackoutKind: null,
      kebutuhanJam: 0,
    });
    try {
      const res = await fetchJson<{
        tanggal: string; kuota: number; terpakai: number; sisa: number;
        blackout: boolean; blackoutKind: string | null; kebutuhanJam: number;
      }>(`/api/streamer?view=kuota-libur&tanggal=${encodeURIComponent(ymd)}`, { cache: "no-store" });
      setLiburDetail({
        tanggal: res.tanggal, kuota: res.kuota, terpakai: res.terpakai, sisa: res.sisa,
        blackout: res.blackout, blackoutKind: res.blackoutKind, kebutuhanJam: res.kebutuhanJam,
      });
    } catch { /* pertahankan fallback dari peta */ }
  }

  function handleLiburDetailAjukan() {
    if (!liburDetail) return;
    handleLeaveDateChange(liburDetail.tanggal);
    setReqSubLibur("pengajuan");
  }

  function handleLeaveDateChange(v: string) {
    setLeaveDate(v);
    // Tanggal berubah -> gate basi, wajib cek ulang (ala ref verifiedLiburDate=null)
    setCekLiburMsg(null);
    setVerifiedLiburDate(null);
  }

  // Ref-deploy tab-report: ganti periode bulan atau host streamer -> refetch data dashboard.
  async function loadDashboardPeriode(newPeriode?: string, newHostId?: string) {
    const activeP = newPeriode !== undefined ? newPeriode : reportPeriode;
    const activeH = newHostId !== undefined ? newHostId : reportHostId;
    if (newPeriode !== undefined) setReportPeriode(newPeriode);
    if (newHostId !== undefined) setReportHostId(newHostId);

    if (isReportAdmin && !activeH) {
      setDashboardData(null);
      return;
    }

    try {
      let url = "/api/streamer?view=dashboard";
      const params = new URLSearchParams();
      if (activeP) params.set("periode", activeP);
      if (isReportAdmin && activeH) params.set("hostId", activeH);
      const q = params.toString();
      if (q) url += `&${q}`;

      const d = await fetchJson<DashboardData>(url);
      setDashboardData(d);
    } catch {
      toast.error("Gagal memuat laporan" + (activeP ? " periode " + activeP : ""));
    }
  }

  async function loadReportHostList() {
    if (reportHostList.length > 0) return;
    try {
      const list = await fetchJson<{ id: string; idKaryawan: string; namaLengkap: string }[]>("/api/streamer?view=hosts");
      if (Array.isArray(list)) setReportHostList(list);
    } catch {
      // ignore
    }
  }

  async function loadInitialData(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError("");
    try {
      const [jRes, sRes, stdRes, pRes] = await Promise.all([
        fetchJson<Jadwal[]>("/api/streamer?view=jadwal").catch(() => null),
        fetchJson<ActiveSession | null>("/api/streamer?view=sesi").catch(() => null),
        fetchJson<{ name: string; cabang: string; no: string }[]>("/api/streamer?view=studios").catch(() => null),
        fetchJson<PerluLaporItem[]>("/api/streamer?view=pending-gmv").catch(() => null),
      ]);

      if (Array.isArray(stdRes) && stdRes.length > 0) {
        setStudioList(stdRes);
      } else {
        setStudioList(STUDIOS);
      }

      if (Array.isArray(jRes)) {
        setJadwal(jRes);
      } else {
        setError("Gagal memuat jadwal streamer");
      }

      if (sRes) {
        setActiveSession(sRes);
        const j = sRes.jadwal;
        if (j) {
          const c = (j.cabangStudio || "").trim();
          const n = (j.nomorStudio || "").trim();
          let sName = "";
          if (c && n) {
            sName = n.toLowerCase().includes(c.toLowerCase()) ? n : `Studio ${c} ${n.replace(/^Studio\s*/i, "")}`;
          } else {
            sName = c || n;
          }
          if (sName) setCheckoutStudio(sName);
        }
      } else {
        setActiveSession(null);
      }

      if (Array.isArray(pRes)) {
        setPendingGmvList(pRes);
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat memuat jadwal");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStreamer) {
      const msg = "Akses Ditolak: hanya role Streamer yang dapat mengajukan libur.";
      toast.warning(msg);
      setError(msg);
      return;
    }
    if (!leaveDate) return;
    // Gate ala ref: hanya tanggal yang lolos cek yang boleh disubmit
    if (!verifiedLiburDate || verifiedLiburDate !== leaveDate) {
      const msg = "Silakan klik Cek Libur Terakhir untuk tanggal ini terlebih dahulu.";
      toast.warning(msg);
      setError(msg);
      return;
    }
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      // Ref submitReqLibur hanya kirim target_date (tanpa alasan)
      await sendJson("/api/streamer", "POST", { action: "leave-request", tanggal: leaveDate });
      toast.success("Pengajuan Libur berhasil dikirim! Menunggu persetujuan Eksekutif.");
      setSuccess("✅ Pengajuan Libur berhasil dikirim! Menunggu persetujuan Eksekutif.");
      setLeaveDate("");
      setCekLiburMsg(null);
      setVerifiedLiburDate(null);
      loadRequestStatus();
    } catch (err) {
      const msg = errorMessage(err, "Gagal mengirim pengajuan libur");
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmittingRequest(false);
    }
  }

  // --- Shift multi-form accordion handlers ---
  function handleToggleShiftForm(id: number) {
    setShiftForms((prev) => prev.map((f) => f.id === id ? { ...f, expanded: !f.expanded } : f));
  }

  function handleShiftFormDateChange(id: number, v: string) {
    setShiftForms((prev) => prev.map((f) => f.id === id ? { ...f, tanggal: v, shift: "" } : f));
    setKuotaCheckResult(null); // reset gate on any date change
    // Ambil ketersediaan shift tanggal tsb (dropdown dinamis)
    setShiftAvailByForm((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!v) return;
    fetchJson<{ availableShifts: { sesi: string; label: string; sisa: number }[] }>(
      `/api/streamer?view=kuota-libur&tanggal=${encodeURIComponent(v)}`,
      { cache: "no-store" }
    )
      .then((res) => setShiftAvailByForm((prev) => ({ ...prev, [id]: res.availableShifts ?? [] })))
      .catch(() => { /* biarkan dropdown default; gate submit tetap validasi server */ });
  }

  function handleShiftFormShiftChange(id: number, v: string) {
    setShiftForms((prev) => prev.map((f) => f.id === id ? { ...f, shift: v } : f));
    setKuotaCheckResult(null);
  }

  function handleAddShiftForm() {
    if (shiftForms.length >= 3) return;
    const usedIds = shiftForms.map((f) => f.id);
    const newId = [1, 2, 3].find((n) => !usedIds.includes(n)) ?? shiftForms.length + 1;
    // Collapse previous forms, add new expanded
    setShiftForms((prev) => [
      ...prev.map((f) => ({ ...f, expanded: false })),
      { id: newId, tanggal: "", shift: "", expanded: true },
    ]);
    setKuotaCheckResult(null);
  }

  function handleRemoveShiftForm(id: number) {
    setShiftForms((prev) => prev.filter((f) => f.id !== id));
    setKuotaCheckResult(null);
  }

  async function handleCekKuotaMingguan() {
    const filled = shiftForms.filter((f) => f.tanggal && f.shift);
    if (filled.length === 0) {
      toast.warning("Isi minimal 1 form (tanggal + shift) sebelum cek kuota.");
      return;
    }
    setShiftLoading(true);
    setKuotaCheckResult(null);
    try {
      const res = await fetchJson<{ ok: boolean; message: string }>(
        `/api/streamer?view=cek-kuota-mingguan&requests=${encodeURIComponent(JSON.stringify(filled.map((f) => ({ tanggal: f.tanggal, shift: f.shift }))))}`
      );
      setKuotaCheckResult({ ok: res.ok, message: res.message });
    } catch (err) {
      setKuotaCheckResult({ ok: false, message: errorMessage(err, "Gagal mengecek kuota mingguan") });
    } finally {
      setShiftLoading(false);
    }
  }

  async function handleShiftSubmit() {
    const filled = shiftForms.filter((f) => f.tanggal && f.shift);
    if (filled.length === 0) return;
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/streamer", "POST", {
        action: "shift-request-batch",
        requests: filled.map((f) => ({ tanggal: f.tanggal, shift: f.shift })),
      });
      toast.success("Request Sesi Live berhasil dikirim! Menunggu konfirmasi Eksekutif.");
      setSuccess("✅ Request Sesi Live berhasil dikirim! Menunggu konfirmasi Eksekutif.");
      setShiftForms([{ id: 1, tanggal: "", shift: "", expanded: true }]);
      setKuotaCheckResult(null);
      loadRequestStatus();
    } catch (err) {
      const msg = errorMessage(err, "Gagal mengirim request sesi live");
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleCheckIn() {
    if (!selectedJadwalId) {
      toast.warning("Pilih jadwal live yang akan di-checkin terlebih dahulu.");
      setError("Pilih jadwal live yang akan di-checkin");
      return;
    }

    if (!hasCamera || cameraError) {
      const msg = cameraError || "Perangkat Anda tidak memiliki kamera. Presensi check-in wajib menggunakan kamera aktif.";
      toast.warning(msg);
      setError(msg);
      return;
    }

    if (!fotoBuktiUrl) {
      toast.warning("Foto selfie presensi wajib diambil langsung melalui kamera.");
      setError("Foto selfie presensi wajib diambil langsung melalui kamera.");
      return;
    }

    if (!checkInLocation) {
      toast.warning("Akses lokasi (GPS) wajib diaktifkan dan terdeteksi untuk melakukan presensi check-in.");
      setError("Akses lokasi (GPS) wajib diaktifkan dan terdeteksi untuk melakukan presensi check-in.");
      return;
    }

    // Dynamic late check
    const lateStatus = getLateCheckInStatus(selectedJadwalDetail);
    if (lateStatus.isLate && !alasanTerlambat.trim()) {
      const msg = `Sesi ini terlambat ${lateStatus.lateDurationText} dari jadwal (${lateStatus.scheduledTimeText} WIB). Harap isi Alasan Keterlambatan.`;
      toast.warning(msg);
      setError(msg);
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/absensi", "POST", {
        tipe: "CHECK_IN",
        kategori: "STREAMER",
        jadwalId: selectedJadwalId,
        fotoBuktiUrl: fotoBuktiUrl,
        alasan: alasanTerlambat || undefined,
        lokasi: checkInLocation.formattedText,
        isTerusan: !!activeSession,
      });
      toast.success("Presensi Check-In berhasil! Status sesi live sekarang ON-AIR.");
      setSuccess("✅ Presensi Check-In berhasil! Status sesi live sekarang ON-AIR.");
      setSelectedJadwalId("");
      setSelectedJadwalDetail(null);
      setFotoBuktiUrl("");
      setAlasanTerlambat("");
      setCheckInLocation(null);
      loadInitialData(true);
      setActiveTab("jadwal");
    } catch (e) {
      const msg = errorMessage(e, "Koneksi gagal saat presensi");
      toast.error(msg);
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOutSubmit() {
    // Checkout window guard: only allowed between the scheduled end time
    // and H+8 (mirrors the legacy SESI_AKTIF_STREAMER formula). Backend
    // enforces the same rule — this is the friendly fast-fail.
    const sessionEnd = getScheduleEndFromSession(activeSession?.jadwal);
    const windowState = getCheckoutWindowState(sessionEnd, Date.now());
    if (windowState === "SEBELUM" && sessionEnd) {
      const msg = `Check-out baru dibuka saat sesi berakhir (${formatDateSafe(sessionEnd, { hour: "2-digit", minute: "2-digit" })} WIB).`;
      toast.warning(msg);
      setError(msg);
      return;
    }
    if (windowState === "LEWAT") {
      const msg = `Jendela check-out (H+${CHECKOUT_WINDOW_HOURS} jam setelah sesi berakhir) sudah terlewat. Silakan lapor melalui tab Terbatas.`;
      toast.warning(msg);
      setError(msg);
      return;
    }
    if (!reportedGmv) {
      toast.warning("Harap isi total nominal GMV income untuk sesi ini.");
      setError("Harap isi total nominal GMV income untuk sesi ini.");
      return;
    }
    if (!checkoutFotoGmv) {
      toast.warning("Foto bukti GMV wajib dilampirkan.");
      setError("Foto bukti GMV wajib dilampirkan (bisa melalui kamera atau upload file galeri).");
      return;
    }
    if (!checkoutHasCamera || checkoutCameraError) {
      const msg = checkoutCameraError || "Perangkat Anda tidak memiliki kamera. Presensi selfie check-out wajib menggunakan kamera aktif.";
      toast.warning(msg);
      setError(msg);
      return;
    }
    if (!checkoutFotoUrl) {
      toast.warning("Foto selfie bukti check-out wajib diambil langsung melalui kamera.");
      setError("Foto selfie bukti check-out wajib diambil langsung melalui kamera.");
      return;
    }
    if (!checkoutLocation) {
      toast.warning("Akses lokasi (GPS) wajib diaktifkan dan terdeteksi untuk melakukan presensi check-out.");
      setError("Akses lokasi (GPS) wajib diaktifkan dan terdeteksi untuk melakukan presensi check-out.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/absensi", "POST", {
        tipe: "CHECK_OUT",
        kategori: "STREAMER",
        jadwalId: activeSession?.jadwalId || activeSession?.jadwal?.id || undefined,
        nomorStudio: checkoutStudio || undefined,
        fotoBuktiUrl: checkoutFotoUrl,
        fotoBuktiGmv: checkoutFotoGmv,
        catatan: checkoutCatatan || undefined,
        lokasi: checkoutLocation.formattedText,
        reportedGmv: parseFloat(reportedGmv),
      });
      toast.success("Presensi Check-Out berhasil! Sesi streaming tersimpan ke rekap payroll.");
      setSuccess("✅ Presensi Check-Out berhasil! Sesi streaming tersimpan ke rekap payroll.");
      setReportedGmv("");
      setCheckoutFotoGmv("");
      setCheckoutFotoUrl("");
      setCheckoutCatatan("");
      setCheckoutLocation(null);
      loadInitialData(true);
      loadAbsensiHistory(true);
      setActiveTab("riwayat");
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal saat check-out");
      toast.error(msg);
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  const formatRupiahInput = useCallback((val: string) => {
    const raw = val.replace(/[^0-9]/g, "");
    if (!raw) return "";
    return parseInt(raw, 10).toLocaleString("id-ID");
  }, []);

  function siapkanFormKhusus(item: JedaJadwal | PerluLaporItem, tipeForm: "PULANG_TELAT" | "MASUK_PULANG_TERBATAS") {
    const isPerluLapor = tipeForm === "PULANG_TELAT";
    const jadwalObj = isPerluLapor ? ((item as PerluLaporItem).jadwal || (item as JedaJadwal)) : (item as JedaJadwal);
    const idAbsen = isPerluLapor ? ((item as PerluLaporItem).id || (item as PerluLaporItem).idAbsen || "") : "";

    setSelectedTerbatasJadwal({
      id: jadwalObj?.id || "",
      idJadwal: jadwalObj?.idJadwal || "JDW-AUTO",
      platform: jadwalObj?.platform || "TikTok",
      clientName: jadwalObj?.client?.namaClient || jadwalObj?.namaClient || "Klien",
      tanggal: jadwalObj?.tanggal || new Date().toISOString(),
      jamMulaiLive: jadwalObj?.jamMulaiLive || new Date().toISOString(),
      jamSelesaiLive: jadwalObj?.jamSelesaiLive || new Date().toISOString(),
      streamerName: jadwalObj?.streamerKaryawan?.namaLengkap || (item as PerluLaporItem).karyawan?.namaLengkap || session?.user?.name || "Streamer",
      streamerId: jadwalObj?.streamerKaryawan?.idKaryawan || (item as PerluLaporItem).karyawan?.idKaryawan || dashboardData?.karyawan?.idKaryawan || "-",
      idAbsen,
      tipeForm,
    });

    const c = (jadwalObj?.cabangStudio || "").trim();
    const n = (jadwalObj?.nomorStudio || "").trim();
    let initialStudio = "";
    if (jadwalObj?.studio) {
      initialStudio = jadwalObj.studio;
    } else if (c && n) {
      initialStudio = n.toLowerCase().includes(c.toLowerCase()) ? n : `Studio ${c} ${n.replace(/^Studio\s*/i, "")}`;
    } else {
      initialStudio = c || n;
    }
    setFormTerbatasStudio(initialStudio || (studioList[0]?.name || "Studio Timoho 1"));
    setFormTerbatasGmv("");
    setFormTerbatasCatatan("");
    setFormTerbatasFotoGmv("");
    setFormTerbatasFotoKeluar("");
    setFormTerbatasLocGmv(null);
    setFormTerbatasLocKeluar(null);
    setError("");
    setSuccess("");

    setTimeout(() => {
      const el = document.getElementById("formTerbatasContainer");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleSubmitTerbatas(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTerbatasJadwal) return;
    const cleanGmv = formTerbatasGmv.replace(/[^0-9]/g, "");
    if (!cleanGmv || parseFloat(cleanGmv) < 0) {
      setError("Nominal GMV (Rp) Wajib diisi.");
      return;
    }
    if (!formTerbatasFotoGmv) {
      setError("Bukti GMV wajib diambil langsung melalui kamera.");
      return;
    }
    if (!formTerbatasLocGmv) {
      setError("Akses lokasi (GPS) wajib terdeteksi untuk bukti GMV.");
      return;
    }
    if (!formTerbatasFotoKeluar) {
      setError("Selfie keluar wajib diambil langsung melalui kamera.");
      return;
    }
    if (!formTerbatasLocKeluar) {
      setError("Akses lokasi (GPS) wajib terdeteksi untuk selfie keluar.");
      return;
    }

    setSubmittingTerbatas(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/absensi", "POST", {
        tipeForm: selectedTerbatasJadwal.tipeForm,
        idAbsen: selectedTerbatasJadwal.idAbsen || undefined,
        idJadwal: selectedTerbatasJadwal.idJadwal || selectedTerbatasJadwal.id,
        nomorStudio: formTerbatasStudio,
        reportedGmv: parseFloat(cleanGmv),
        catatan: formTerbatasCatatan || undefined,
        fotoBuktiGmv: formTerbatasFotoGmv || undefined,
        fotoBuktiKeluar: formTerbatasFotoKeluar || undefined,
        lokasiGmv: formTerbatasLocGmv.formattedText,
        lokasiKeluar: formTerbatasLocKeluar.formattedText,
      });
      const successMsg = selectedTerbatasJadwal.tipeForm === "PULANG_TELAT"
        ? "Pengiriman Data Berhasil! Keterlambatan telah dilaporkan ke HR dan omset GMV tersimpan."
        : "Pengiriman Data Berhasil! Sesi Jeda Terbatas Sukses Terdata!";
      toast.success(successMsg);
      setSuccess("✅ " + successMsg);
      setSelectedTerbatasJadwal(null);
      setFormTerbatasGmv("");
      setFormTerbatasCatatan("");
      setFormTerbatasFotoGmv("");
      setFormTerbatasFotoKeluar("");
      setFormTerbatasLocGmv(null);
      setFormTerbatasLocKeluar(null);
      loadInitialData(true);
      loadTerbatasData(true);
    } catch (err) {
      const msg = errorMessage(err, "Koneksi gagal saat mengirim data");
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmittingTerbatas(false);
    }
  }

  // TODO(hapus-profil): variabel kartu profil dihapus atas permintaan — dipertahankan sebagai komentar.
  // const totalLiveHours = dashboardData?.totalJam ?? 0;
  // const matchedTier = tiering.slice().reverse().find((b) => totalLiveHours >= b.jamMinimal)
  //   ?? tiering[0];
  // const currentTier = matchedTier?.tier ?? dashboardData?.activeTier?.nama ?? "Basic";
  // const currentRate = matchedTier?.ratePerJam ?? dashboardData?.activeTier?.ratePerJam ?? 25000;
  // const currentLiveJadwal = jadwal.find((j) => j.liveState === "LIVE" || j.status === "ON_GOING");
  // const activeJadwal = activeSession?.jadwal || currentLiveJadwal;
  // TODO(hapus-profil): status pill kartu profil ikut dihapus bersama kartunya.
  // const streamerActiveStatus = activeJadwal
  //   ? getStreamerActiveSessionState(activeJadwal)
  //   : activeSession
  //   ? "ON AIR"
  //   : null;
  // TODO(hapus-profil): tidak ada pemakai lain.
  // const isCurrentlyOnAir = Boolean(activeSession || currentLiveJadwal);

  const filteredJeda = useMemo(() => {
    return (terbatasData?.jedaTerbatas || []).filter((j) => {
      if (!filterTextTerbatas.trim()) return true;
      const q = filterTextTerbatas.toLowerCase();
      if (filterColTerbatas === "DATE") return formatDateSafe(j.tanggal).toLowerCase().includes(q);
      if (filterColTerbatas === "PLATFORM") return (j.platform || "").toLowerCase().includes(q) || (j.client?.namaClient || "").toLowerCase().includes(q);
      if (filterColTerbatas === "STREAMER") return (j.streamerKaryawan?.namaLengkap || "").toLowerCase().includes(q) || (j.streamerKaryawan?.idKaryawan || "").toLowerCase().includes(q);
      return (
        (j.idJadwal || "").toLowerCase().includes(q) ||
        (j.platform || "").toLowerCase().includes(q) ||
        (j.client?.namaClient || "").toLowerCase().includes(q) ||
        (j.streamerKaryawan?.namaLengkap || "").toLowerCase().includes(q) ||
        (j.streamerKaryawan?.idKaryawan || "").toLowerCase().includes(q) ||
        formatDateSafe(j.tanggal).toLowerCase().includes(q)
      );
    });
  }, [terbatasData?.jedaTerbatas, filterTextTerbatas, filterColTerbatas]);

  const rawLaporList = (terbatasData?.perluLapor && terbatasData.perluLapor.length > 0) ? terbatasData.perluLapor : pendingGmvList;
  const filteredLapor = useMemo(() => {
    return rawLaporList.filter((item) => {
      if (!filterTextTerbatas.trim()) return true;
      const q = filterTextTerbatas.toLowerCase();
      const j: JedaJadwal = (item.jadwal || item) as JedaJadwal;
      const k = item.karyawan || j.streamerKaryawan;
      if (filterColTerbatas === "DATE") return formatDateSafe(j.tanggal).toLowerCase().includes(q);
      if (filterColTerbatas === "PLATFORM") return (j.platform || "").toLowerCase().includes(q) || (j.client?.namaClient || "").toLowerCase().includes(q);
      if (filterColTerbatas === "STREAMER") return (k?.namaLengkap || "").toLowerCase().includes(q) || (k?.idKaryawan || "").toLowerCase().includes(q);
      return (
        (j.idJadwal || "").toLowerCase().includes(q) ||
        (item.id || "").toLowerCase().includes(q) ||
        (j.platform || "").toLowerCase().includes(q) ||
        (j.client?.namaClient || "").toLowerCase().includes(q) ||
        (k?.namaLengkap || "").toLowerCase().includes(q) ||
        (k?.idKaryawan || "").toLowerCase().includes(q) ||
        formatDateSafe(j.tanggal).toLowerCase().includes(q)
      );
    });
  }, [rawLaporList, filterTextTerbatas, filterColTerbatas]);

  // Filtered and paginated history matching ref-deploy
  const filteredHistory = useMemo(() => {
    let list = absensiHistory;

    // 1. Period filter
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (filterPeriodeHistory === "TODAY") {
      list = list.filter((h) => (h.rawDate || "").slice(0, 10) === todayStr);
    } else if (filterPeriodeHistory === "PREV_7") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      list = list.filter((h) => {
        const d = (h.rawDate || "").slice(0, 10);
        return d >= past7 && d <= todayStr;
      });
    } else if (filterPeriodeHistory === "NEXT_7") {
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      list = list.filter((h) => {
        const d = (h.rawDate || "").slice(0, 10);
        return d >= todayStr && d <= next7;
      });
    } else if (filterPeriodeHistory === "PREV_35") {
      const past35 = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      list = list.filter((h) => {
        const d = (h.rawDate || "").slice(0, 10);
        return d >= past35 && d <= todayStr;
      });
    } else if (filterPeriodeHistory === "NEXT_35") {
      const next35 = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      list = list.filter((h) => {
        const d = (h.rawDate || "").slice(0, 10);
        return d >= todayStr && d <= next35;
      });
    } else if (filterPeriodeHistory === "CUSTOM") {
      if (filterRangeStartHistory) {
        list = list.filter((h) => (h.rawDate || "").slice(0, 10) >= filterRangeStartHistory);
      }
      if (filterRangeEndHistory) {
        list = list.filter((h) => (h.rawDate || "").slice(0, 10) <= filterRangeEndHistory);
      }
    }

    // 2. Status select filter
    if (filterStatusHistory) {
      list = list.filter((h) => (h.status || "").toLowerCase() === filterStatusHistory.toLowerCase());
    }

    // 3. Column search filter
    if (filterTextHistory.trim()) {
      const q = filterTextHistory.toLowerCase();
      if (filterColHistory === "idAbsen") {
        list = list.filter((h) => (h.idAbsen || "").toLowerCase().includes(q));
      } else if (filterColHistory === "idJadwal") {
        list = list.filter((h) => (h.idJadwal || "").toLowerCase().includes(q));
      } else if (filterColHistory === "status") {
        list = list.filter((h) => (h.status || "").toLowerCase().includes(q));
      } else if (filterColHistory === "platform") {
        list = list.filter((h) => (h.platform || "").toLowerCase().includes(q) || (h.clientName || "").toLowerCase().includes(q));
      } else if (filterColHistory === "streamer") {
        list = list.filter((h) => (h.streamer || "").toLowerCase().includes(q));
      } else if (filterColHistory === "idHost") {
        list = list.filter((h) => (h.idHost || "").toLowerCase().includes(q));
      } else if (filterColHistory === "cabang") {
        list = list.filter((h) => (h.cabang || "").toLowerCase().includes(q) || (h.studio || "").toLowerCase().includes(q));
      } else {
        // ALL
        list = list.filter((h) =>
          (h.idAbsen || "").toLowerCase().includes(q) ||
          (h.idJadwal || "").toLowerCase().includes(q) ||
          (h.status || "").toLowerCase().includes(q) ||
          (h.platform || "").toLowerCase().includes(q) ||
          (h.clientName || "").toLowerCase().includes(q) ||
          (h.streamer || "").toLowerCase().includes(q) ||
          (h.idHost || "").toLowerCase().includes(q) ||
          (h.cabang || "").toLowerCase().includes(q) ||
          (h.studio || "").toLowerCase().includes(q)
        );
      }
    }

    return list;
  }, [absensiHistory, filterPeriodeHistory, filterRangeStartHistory, filterRangeEndHistory, filterStatusHistory, filterTextHistory, filterColHistory]);

  const totalPagesHistory = Math.max(1, Math.ceil(filteredHistory.length / rowsPerPageHistory));
  const paginatedHistory = filteredHistory.slice(
    (pageHistory - 1) * rowsPerPageHistory,
    pageHistory * rowsPerPageHistory
  );

  const visibleTabs = STREAMER_TABS;

  return (
    <div className="space-y-6 min-w-0">
      {/* TODO(hapus-profil): kartu profil gradient (avatar, nama, badge STREAMER,
          pill status PREPARE/ON AIR/PERLU LAPOR, 3 sel statistik tier/jam/sesi)
          DIHAPUS ATAS PERMINTAAN — jangan dibuang. Versi lama ada di git history
          (commit sebelum "hapus kartu profil"). Banner alert di bawah tetap. */}

      {/* Global Alerts */}

      {/* Global Alerts */}
      {success && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-red-600 text-sm" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending GMV Alerts */}
      {pendingGmvList.map((p) => (
        <div key={p.id} className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl mt-1" />
            <div>
              <h3 className="font-black text-red-700 uppercase tracking-wider text-xs">PENTING: LAPORAN GMV TERTUNDA</h3>
              <p className="text-xs text-red-800 mt-0.5">
                Sesi: <strong>{p.jadwal?.client?.namaClient ?? "Klien"} ({p.jadwal?.platform})</strong> pada {formatDateSafe(p.jadwal?.tanggal)}.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("terbatas");
              setSubTabTerbatas("lapor");
              siapkanFormKhusus(p, "PULANG_TELAT");
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md whitespace-nowrap active:scale-95"
          >
            Lengkapi GMV Sesi Ini
          </button>
        </div>
      ))}

      {/* Contract Alert */}
      {dashboardData?.kontrakDaysLeft !== null && dashboardData?.kontrakDaysLeft !== undefined && dashboardData.kontrakDaysLeft <= 30 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 flex items-start gap-3">
          <i className="fa-solid fa-triangle-exclamation text-red-500 text-lg mt-0.5" />
          <div>
            <div className="text-xs font-black text-red-800">Perhatian: Kontrak Hampir Berakhir!</div>
            <div className="text-[11px] text-red-700 mt-0.5">
              Kontrak Anda ({dashboardData.karyawan?.kontrakType ?? "Kontrak"}) akan berakhir dalam <strong>{dashboardData.kontrakDaysLeft} hari</strong> lagi.
            </div>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION — Horizontal scroll (ref-deploy scrollableTabContainer: Drag-to-Scroll + Wheel + Arrows) */}
      <div className="relative group">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs("left")}
            aria-label="Geser tab ke kiri"
            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md items-center justify-center text-slate-600 hover:text-[#941A0B] hover:bg-slate-50 transition cursor-pointer"
          >
            <i className="fa-solid fa-chevron-left text-xs" />
          </button>
        )}

        <div
          ref={tabSliderRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        >
          <div className="flex gap-1.5 min-w-max">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isCheckInLocked = tab.id === "checkin" && Boolean(activeSession);
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  draggable={false}
                  onClick={(e) => {
                    if (hasTabDraggedRef.current) {
                      e.preventDefault();
                      return;
                    }
                    if (isCheckInLocked) {
                      setActiveTab("checkout");
                      setError("Anda sedang dalam sesi live aktif (ON AIR). Tab Check-In terkunci sampai Anda menyelesaikan Check-Out.");
                      return;
                    }
                    setActiveTab(tab.id);
                    setError("");
                    setSuccess("");
                  }}
                  className={`shrink-0 whitespace-nowrap py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    isCheckInLocked
                      ? "opacity-65 bg-slate-200/70 text-slate-500 hover:bg-slate-200"
                      : isActive
                      ? "bg-[#941A0B] text-white shadow-md shadow-[#941A0B]/20 scale-[1.02]"
                      : "text-[#4D4D4D] hover:text-[#000000] hover:bg-[#F1F1F1]"
                  }`}
                  title={isCheckInLocked ? "Terkunci: Anda sedang siaran aktif. Selesaikan checkout terlebih dahulu." : undefined}
                >
                  <i className={`${isCheckInLocked ? "fa-solid fa-lock text-red-600" : tab.icon} ${isActive && !isCheckInLocked ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{tab.label}</span>
                  {isCheckInLocked && (
                    <span className="bg-red-400 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                      Live
                    </span>
                  )}
                  {tab.id === "checkout" && pendingGmvList.length > 0 && (
                    <span className="bg-red-400 text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                      {pendingGmvList.length}
                    </span>
                  )}
                  {tab.id === "terbatas" && (terbatasData?.perluLapor?.length || pendingGmvList.length) > 0 && (
                    <span className="bg-red-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                      {terbatasData?.perluLapor?.length || pendingGmvList.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs("right")}
            aria-label="Geser tab ke kanan"
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md items-center justify-center text-slate-600 hover:text-[#941A0B] hover:bg-slate-50 transition cursor-pointer"
          >
            <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        )}
      </div>

      {/* ======== TAB: CHECK IN ======== */}
      {activeTab === "checkin" && (
        <TabCheckIn
          activeSession={activeSession}
          jadwal={jadwal}
          selectedJadwalId={selectedJadwalId}
          selectedJadwalDetail={selectedJadwalDetail}
          fotoBuktiUrl={fotoBuktiUrl}
          alasanTerlambat={alasanTerlambat}
          checkInLocation={checkInLocation}
          hasCamera={hasCamera}
          cameraError={cameraError}
          actionLoading={actionLoading}
          onSelectJadwalChange={(id, detail) => {
            setSelectedJadwalId(id);
            setSelectedJadwalDetail(detail);
            setFotoBuktiUrl("");
            setCheckInLocation(null);
          }}
          onFotoBuktiChange={setFotoBuktiUrl}
          onAlasanTerlambatChange={setAlasanTerlambat}
          onLocationChange={setCheckInLocation}
          onCameraStatusChange={(ready, err) => {
            setHasCamera(ready);
            setCameraError(err);
          }}
          onGoCheckout={() => setActiveTab("checkout")}
          onSubmit={handleCheckIn}
        />
      )}

      {/* ======== TAB: CHECK OUT ======== */}
      {activeTab === "checkout" && (
        <TabCheckOut
          activeSession={activeSession}
          actionLoading={actionLoading}
          studioList={studioList}
          checkoutStudio={checkoutStudio}
          reportedGmv={reportedGmv}
          checkoutCatatan={checkoutCatatan}
          checkoutFotoGmv={checkoutFotoGmv}
          checkoutFotoUrl={checkoutFotoUrl}
          checkoutLocation={checkoutLocation}
          checkoutHasCamera={checkoutHasCamera}
          checkoutCameraError={checkoutCameraError}
          formatRupiahInput={formatRupiahInput}
          onStudioChange={setCheckoutStudio}
          onGmvChange={setReportedGmv}
          onCatatanChange={setCheckoutCatatan}
          onFotoGmvChange={setCheckoutFotoGmv}
          onFotoChange={setCheckoutFotoUrl}
          onLocationChange={setCheckoutLocation}
          onCameraStatusChange={(ready, err) => {
            setCheckoutHasCamera(ready);
            setCheckoutCameraError(err);
          }}
          onSubmit={handleCheckOutSubmit}
        />
      )}

      {/* ======== TAB: TERBATAS (AKSI KHUSUS) ======== */}
      {activeTab === "terbatas" && (
        <TabTerbatas
          sessionUserName={session?.user?.name}
          subTabTerbatas={subTabTerbatas}
          filterColTerbatas={filterColTerbatas}
          filterTextTerbatas={filterTextTerbatas}
          filteredJeda={filteredJeda}
          rawLaporCount={rawLaporList.length}
          filteredLapor={filteredLapor}
          selectedTerbatasJadwal={selectedTerbatasJadwal}
          studioList={studioList}
          formTerbatasStudio={formTerbatasStudio}
          formTerbatasGmv={formTerbatasGmv}
          formTerbatasCatatan={formTerbatasCatatan}
          formTerbatasFotoGmv={formTerbatasFotoGmv}
          formTerbatasFotoKeluar={formTerbatasFotoKeluar}
          formTerbatasLocGmv={formTerbatasLocGmv}
          formTerbatasLocKeluar={formTerbatasLocKeluar}
          submittingTerbatas={submittingTerbatas}
          formatRupiahInput={formatRupiahInput}
          onSubTabChange={(t) => {
            setSubTabTerbatas(t);
            setSelectedTerbatasJadwal(null);
            setError("");
            setSuccess("");
          }}
          onFilterColChange={setFilterColTerbatas}
          onFilterTextChange={setFilterTextTerbatas}
          onSiapkanJeda={(j) => siapkanFormKhusus(j, "MASUK_PULANG_TERBATAS")}
          onSiapkanLapor={(p) => siapkanFormKhusus(p, "PULANG_TELAT")}
          onCloseForm={() => setSelectedTerbatasJadwal(null)}
          onStudioChange={setFormTerbatasStudio}
          onGmvChange={setFormTerbatasGmv}
          onCatatanChange={setFormTerbatasCatatan}
          onFotoGmvChange={setFormTerbatasFotoGmv}
          onFotoKeluarChange={setFormTerbatasFotoKeluar}
          onLocGmvChange={setFormTerbatasLocGmv}
          onLocKeluarChange={setFormTerbatasLocKeluar}
          onSubmitTerbatas={handleSubmitTerbatas}
        />
      )}

      {/* ======== TAB: JADWAL ======== */}
      {activeTab === "jadwal" && (
        <TabJadwal
          jadwal={jadwal}
          loading={loading}
          onSelectForCheckIn={(j) => {
            setSelectedJadwalId(j.id);
            setSelectedJadwalDetail(j);
            setActiveTab("checkin");
          }}
          onGoCheckout={() => setActiveTab("checkout")}
        />
      )}

      {/* ======== TAB: REQUEST ======== */}
      {activeTab === "request" && (
        <TabRequest
          requestStatus={requestStatus}
          // TODO(ref-deploy-request): props lama requestSubTab/onRequestSubTabChange diganti struktur kategori ref-deploy.
          // requestSubTab={requestSubTab}
          // onRequestSubTabChange={setRequestSubTab}
          reqCategory={reqCategory}
          reqSubLibur={reqSubLibur}
          reqSubSesi={reqSubSesi}
          onReqCategoryChange={setReqCategory}
          onReqSubLiburChange={setReqSubLibur}
          onReqSubSesiChange={setReqSubSesi}
          leaveDate={leaveDate}
          onLeaveDateChange={handleLeaveDateChange}
          onLeaveSubmit={handleLeaveSubmit}
          shiftForms={shiftForms}
          shiftLoading={shiftLoading}
          kuotaCheckResult={kuotaCheckResult}
          onToggleShiftForm={handleToggleShiftForm}
          onShiftFormDateChange={handleShiftFormDateChange}
          onShiftFormShiftChange={handleShiftFormShiftChange}
          onAddShiftForm={handleAddShiftForm}
          onRemoveShiftForm={handleRemoveShiftForm}
          onCekKuotaMingguan={handleCekKuotaMingguan}
          onShiftSubmit={handleShiftSubmit}
          submittingRequest={submittingRequest}
          liburCalendar={liburCalendar}
          cekLiburMsg={cekLiburMsg}
          cekLiburOk={!!verifiedLiburDate && verifiedLiburDate === leaveDate && !!cekLiburMsg}
          onCekLibur={handleCekLibur}
          shiftAvailByForm={shiftAvailByForm}
          kuotaMap={kuotaMap}
          liburDetail={liburDetail}
          onLiburCalMonthChange={loadKuotaBulan}
          onLiburDateSelect={handleLiburDateSelect}
          onLiburDetailAjukan={handleLiburDetailAjukan}
          isStreamer={isStreamer}
        />
      )}

      {/* ======== TAB: HISTORY / RIWAYAT (REF-DEPLOY) ======== */}
      {activeTab === "riwayat" && (
        <>
          <TabRiwayat
            loading={loading}
            filteredHistory={filteredHistory}
            paginatedHistory={paginatedHistory}
            totalPagesHistory={totalPagesHistory}
            pageHistory={pageHistory}
            rowsPerPageHistory={rowsPerPageHistory}
            filterPeriodeHistory={filterPeriodeHistory}
            filterRangeStartHistory={filterRangeStartHistory}
            filterRangeEndHistory={filterRangeEndHistory}
            filterTextHistory={filterTextHistory}
            filterStatusHistory={filterStatusHistory}
            filterColHistory={filterColHistory}
            sessionUserName={session?.user?.name}
            onFilterPeriodeChange={(v) => {
              setFilterPeriodeHistory(v);
              setPageHistory(1);
            }}
            onFilterRangeStartChange={(v) => {
              setFilterRangeStartHistory(v);
              setPageHistory(1);
            }}
            onFilterRangeEndChange={(v) => {
              setFilterRangeEndHistory(v);
              setPageHistory(1);
            }}
            onFilterTextChange={(v) => {
              setFilterTextHistory(v);
              setPageHistory(1);
            }}
            onFilterStatusChange={(v) => {
              setFilterStatusHistory(v);
              setPageHistory(1);
            }}
            onFilterColChange={(v) => {
              setFilterColHistory(v);
              setPageHistory(1);
            }}
            onPageChange={(p) => setPageHistory(p)}
            onReportGmv={() => {
              setActiveTab("terbatas");
              setSubTabTerbatas("lapor");
            }}
            onShowBukti={(h) => {
              setSelectedBuktiHistory(h);
              setSelectedLocationTab("keluar");
            }}
          />

          {/* ======== MODAL: BUKTI FOTO & LOKASI GPS SESI ======== */}
          {selectedBuktiHistory && (
            <BuktiFotoModal
              selectedBuktiHistory={selectedBuktiHistory}
              selectedLocationTab={selectedLocationTab}
              onSelectLocationTab={setSelectedLocationTab}
              onClose={() => setSelectedBuktiHistory(null)}
              onPreviewImage={setPreviewImageModal}
            />
          )}

          {/* ======== LIGHTBOX IMAGE PREVIEW MODAL ======== */}
          {previewImageModal && (
            <ImageLightbox previewImageModal={previewImageModal} onClose={() => setPreviewImageModal(null)} />
          )}
        </>
      )}

      {/* ======== TAB: REPORT ======== */}
      {activeTab === "report" && (
        <TabReport
          dashboardData={dashboardData}
          onPeriodeChange={(p) => loadDashboardPeriode(p, undefined)}
          loading={loading}
          isAdmin={isReportAdmin}
          hostList={reportHostList}
          selectedHostId={reportHostId}
          onHostChange={(h) => loadDashboardPeriode(undefined, h)}
        />
      )}
    </div>
  );
}
