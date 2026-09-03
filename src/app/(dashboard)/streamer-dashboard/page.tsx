"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { LocationCoordinates } from "@/components/streamer-dashboard/live-camera-checkin";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { StreamerProfileCardOverview } from "@/components/streamer-dashboard/streamer-profile-card-overview";
import { StreamerListView } from "@/components/streamer-dashboard/streamer-list-view";
import { STUDIOS } from "@/types/jadwal";
import {
  formatDateSafe,
} from "@/lib/utils/date-format";
import { TabReport } from "@/components/streamer-dashboard/tab-report";
import { TabJadwal } from "@/components/streamer-dashboard/tab-jadwal";
import { TabCheckIn } from "@/components/streamer-dashboard/tab-checkin";
import { TabCheckOut } from "@/components/streamer-dashboard/tab-checkout";
import { TabTerbatas } from "@/components/streamer-dashboard/tab-terbatas";
import { getLateCheckInStatus } from "@/components/streamer-dashboard/late-check";
import { TabRiwayat } from "@/components/streamer-dashboard/tab-riwayat";
import { TabRequest } from "@/components/streamer-dashboard/tab-request";
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

  const [activeTab, setActiveTab] = useState("checkin");
  const [selectedOverviewStreamerId, setSelectedOverviewStreamerId] = useState<string | null>(null);
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [pendingGmvList, setPendingGmvList] = useState<PerluLaporItem[]>([]);
  const [tiering, setTiering] = useState<{ tier: string; jamMinimal: number; jamMaksimal: number; ratePerJam: number }[]>([]);
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
  const [requestSubTab, setRequestSubTab] = useState<"libur" | "sesi">("libur");
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [selectedSesi, setSelectedSesi] = useState<"SESI_1" | "SESI_2" | "SESI_3">("SESI_2");
  const [shiftNote, setShiftNote] = useState("");
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

  useEffect(() => {
    loadData();
    loadRequestStatus();
  }, []);

  useEffect(() => {
    if (activeSession && activeTab === "checkin") {
      setActiveTab("checkout");
    }
  }, [activeSession, activeTab]);

  async function loadRequestStatus() {
    try {
      const data = await fetchJson<RequestStatusData>("/api/streamer?view=request-status");
      if (data) setRequestStatus(data);
    } catch {
      // ignore
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      // fetchJson throws on non-success; each endpoint keeps its original
      // fallback so one failing view never blocks the rest of the dashboard.
      const [jRes, sRes, dRes, pRes, tRes, hRes, tbRes, stdRes] = await Promise.all([
        fetchJson<Jadwal[]>("/api/streamer?view=jadwal").catch(() => null),
        fetchJson<ActiveSession | null>("/api/streamer?view=sesi").catch(() => null),
        fetchJson<DashboardData>("/api/streamer?view=dashboard").catch(() => null),
        fetchJson<PerluLaporItem[]>("/api/streamer?view=pending-gmv").catch(() => null),
        fetchJson<{ tier: string; jamMinimal: number; jamMaksimal: number; ratePerJam: number | string }[]>("/api/payroll?tiering=1").catch(() => null),
        fetchJson<AbsensiHistory[]>("/api/absensi?view=history").catch(() => null),
        fetchJson<TerbatasData>("/api/streamer?view=terbatas").catch(() => null),
        fetchJson<{ name: string; cabang: string; no: string }[]>("/api/streamer?view=studios").catch(() => null),
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
      if (dRes) setDashboardData(dRes);
      if (tbRes) {
        setTerbatasData(tbRes);
        setPendingGmvList(tbRes.perluLapor || []);
      } else if (Array.isArray(pRes)) {
        setPendingGmvList(pRes);
      }
      if (Array.isArray(hRes)) setAbsensiHistory(hRes);
      if (Array.isArray(tRes)) {
        setTiering(tRes.map((b) => ({
          tier: b.tier,
          jamMinimal: b.jamMinimal,
          jamMaksimal: b.jamMaksimal,
          ratePerJam: Number(b.ratePerJam),
        })));
      }

    } catch {
      setError("Terjadi kesalahan koneksi saat memuat jadwal");
    } finally {
      setLoading(false);
    }
  }

  // Conflict calculation for leaveDate
  const conflictingJadwal = leaveDate && requestStatus?.activeJadwal
    ? requestStatus.activeJadwal.find((j) => {
        const jDate = new Date(j.tanggal).toISOString().slice(0, 10);
        return jDate === leaveDate;
      }) ?? null
    : null;
  const hasScheduleConflict = Boolean(conflictingJadwal);

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveDate) return;
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/streamer", "POST", { action: "leave-request", tanggal: leaveDate, alasan: leaveReason });
      setSuccess("✅ Pengajuan Libur berhasil dikirim! Menunggu persetujuan Eksekutif.");
      setLeaveDate("");
      setLeaveReason("");
      loadRequestStatus();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengirim pengajuan libur"));
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftDate) return;
    setSubmittingRequest(true);
    setError("");
    setSuccess("");
    try {
      await sendJson("/api/streamer", "POST", { action: "shift-request", tanggal: shiftDate, sesi: selectedSesi, catatan: shiftNote });
      setSuccess("✅ Request Sesi Live berhasil dikirim! Menunggu konfirmasi Eksekutif.");
      setShiftDate("");
      setShiftNote("");
      loadRequestStatus();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengirim request sesi live"));
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleCheckIn() {
    if (!selectedJadwalId) {
      setError("Pilih jadwal live yang akan di-checkin");
      return;
    }

    if (!hasCamera || cameraError) {
      setError(cameraError || "Perangkat Anda tidak memiliki kamera. Presensi check-in wajib menggunakan kamera aktif.");
      return;
    }

    if (!fotoBuktiUrl) {
      setError("Foto selfie presensi wajib diambil langsung melalui kamera.");
      return;
    }

    if (!checkInLocation) {
      setError("Akses lokasi (GPS) wajib diaktifkan dan terdeteksi untuk melakukan presensi check-in.");
      return;
    }

    // Dynamic late check
    const lateStatus = getLateCheckInStatus(selectedJadwalDetail);
    if (lateStatus.isLate && !alasanTerlambat.trim()) {
      setError(`Sesi ini terlambat ${lateStatus.lateDurationText} dari jadwal (${lateStatus.scheduledTimeText} WIB). Harap isi Alasan Keterlambatan.`);
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
      setSuccess("✅ Presensi Check-In berhasil! Status sesi live sekarang ON-AIR.");
      setSelectedJadwalId("");
      setSelectedJadwalDetail(null);
      setFotoBuktiUrl("");
      setAlasanTerlambat("");
      setCheckInLocation(null);
      loadData();
      setActiveTab("jadwal");
    } catch (e) {
      setError(errorMessage(e, "Koneksi gagal saat presensi"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOutSubmit() {
    if (!reportedGmv) {
      setError("Harap isi total nominal GMV income untuk sesi ini.");
      return;
    }
    if (!checkoutFotoGmv) {
      setError("Foto bukti GMV wajib dilampirkan (bisa melalui kamera atau upload file galeri).");
      return;
    }
    if (!checkoutHasCamera || checkoutCameraError) {
      setError(checkoutCameraError || "Perangkat Anda tidak memiliki kamera. Presensi selfie check-out wajib menggunakan kamera aktif.");
      return;
    }
    if (!checkoutFotoUrl) {
      setError("Foto selfie bukti check-out wajib diambil langsung melalui kamera.");
      return;
    }
    if (!checkoutLocation) {
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
      setSuccess("✅ Presensi Check-Out berhasil! Sesi streaming tersimpan ke rekap payroll.");
      setReportedGmv("");
      setCheckoutFotoGmv("");
      setCheckoutFotoUrl("");
      setCheckoutCatatan("");
      setCheckoutLocation(null);
      loadData();
      setActiveTab("riwayat");
    } catch (err) {
      setError(errorMessage(err, "Koneksi gagal saat check-out"));
    } finally {
      setActionLoading(false);
    }
  }

  function formatRupiahInput(val: string) {
    const raw = val.replace(/[^0-9]/g, "");
    if (!raw) return "";
    return parseInt(raw, 10).toLocaleString("id-ID");
  }

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
      setSuccess(
        selectedTerbatasJadwal.tipeForm === "PULANG_TELAT"
          ? "✅ Pengiriman Data Berhasil! Keterlambatan telah dilaporkan ke HR dan omset GMV tersimpan."
          : "✅ Pengiriman Data Berhasil! Sesi Jeda Terbatas Sukses Terdata!"
      );
      setSelectedTerbatasJadwal(null);
      setFormTerbatasGmv("");
      setFormTerbatasCatatan("");
      setFormTerbatasFotoGmv("");
      setFormTerbatasFotoKeluar("");
      setFormTerbatasLocGmv(null);
      setFormTerbatasLocKeluar(null);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Koneksi gagal saat mengirim data"));
    } finally {
      setSubmittingTerbatas(false);
    }
  }

  const totalLiveHours = dashboardData?.totalJam ?? 0;
  const matchedTier = tiering.slice().reverse().find((b) => totalLiveHours >= b.jamMinimal)
    ?? tiering[0];
  const currentTier = matchedTier?.tier ?? dashboardData?.activeTier?.nama ?? "Basic";
  const currentRate = matchedTier?.ratePerJam ?? dashboardData?.activeTier?.ratePerJam ?? 25000;
  const currentLiveJadwal = jadwal.find((j) => j.liveState === "LIVE" || j.status === "ON_GOING");
  const isCurrentlyOnAir = Boolean(activeSession || currentLiveJadwal);

  const filteredJeda = (terbatasData?.jedaTerbatas || []).filter((j) => {
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

  const rawLaporList = (terbatasData?.perluLapor && terbatasData.perluLapor.length > 0) ? terbatasData.perluLapor : pendingGmvList;
  const filteredLapor = rawLaporList.filter((item) => {
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

  // Non-admin (streamer): hide the "overview" tab — accessed via sidebar instead.
  const visibleTabs = STREAMER_TABS
    .filter((t) => t.id !== "overview" || isAdmin)
    .map((t) => {
      if (t.id === "overview") {
        return {
          ...t,
          label: "Daftar & Profil Streamer",
          icon: "fa-solid fa-users-viewfinder",
        };
      }
      return t;
    });

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-[#4A0A04] via-[#6D1207] to-[#941A0B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {dashboardData?.karyawan?.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dashboardData.karyawan.fotoUrl}
                alt={dashboardData.karyawan.namaLengkap}
                className="w-14 h-14 rounded-2xl object-cover border border-white/20 shadow-inner"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                <i className="fa-solid fa-headset text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {session?.user?.name ?? "Host Streamer"}
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  STREAMER
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{session?.user?.email}</p>
            </div>
          </div>

          {isCurrentlyOnAir ? (
            <div className="flex items-center gap-2 bg-rose-500/25 border border-rose-400/40 px-3.5 py-1.5 rounded-xl shadow-xs animate-pulse">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span className="text-xs font-black text-rose-200 tracking-wider">SEDANG ON AIR</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1.5 rounded-xl text-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-xs font-bold text-slate-200 tracking-wider">OFF AIR</span>
            </div>
          )}
        </div>

        {/* Tier & Hours Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Tier Pencapaian</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white">{currentTier}</span>
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-400/20 px-2 py-0.5 rounded-full">
                Rp {currentRate.toLocaleString("id-ID")}/jam
              </span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Total Jam Live Bulan Ini</span>
            <div className="text-base font-extrabold text-white">
              {totalLiveHours.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ {matchedTier?.jamMaksimal ?? 80} Jam Target</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-slate-400 block mb-1">Total Sesi Selesai</span>
            <div className="text-base font-extrabold text-amber-300">
              {dashboardData?.totalSesi ?? 0} <span className="text-xs text-slate-400 font-normal">Sesi</span>
            </div>
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
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
          <i className="fa-solid fa-triangle-exclamation text-amber-500 text-lg mt-0.5" />
          <div>
            <div className="text-xs font-black text-amber-800">Perhatian: Kontrak Hampir Berakhir!</div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Kontrak Anda ({dashboardData.karyawan?.kontrakType ?? "Kontrak"}) akan berakhir dalam <strong>{dashboardData.kontrakDaysLeft} hari</strong> lagi.
            </div>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION — Streamlined & High Aesthetic */}
      <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isCheckInLocked = tab.id === "checkin" && Boolean(activeSession);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isCheckInLocked) {
                    setActiveTab("checkout");
                    setError("Anda sedang dalam sesi live aktif (ON AIR). Tab Check-In terkunci sampai Anda menyelesaikan Check-Out.");
                    return;
                  }
                  setActiveTab(tab.id);
                  setError("");
                  setSuccess("");
                }}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  isCheckInLocked
                    ? "opacity-65 bg-slate-200/70 text-slate-500 hover:bg-slate-200"
                    : isActive
                    ? "bg-[#941A0B] text-white shadow-md shadow-[#941A0B]/20 scale-[1.02]"
                    : "text-[#4D4D4D] hover:text-[#000000] hover:bg-[#F1F1F1]"
                }`}
                title={isCheckInLocked ? "Terkunci: Anda sedang siaran aktif. Selesaikan checkout terlebih dahulu." : undefined}
              >
                <i className={`${isCheckInLocked ? "fa-solid fa-lock text-amber-600" : tab.icon} ${isActive && !isCheckInLocked ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{tab.label}</span>
                {isCheckInLocked && (
                  <span className="bg-amber-400 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                    Live
                  </span>
                )}
                {tab.id === "checkout" && pendingGmvList.length > 0 && (
                  <span className="bg-amber-400 text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
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

      {/* ======== TAB: DAFTAR & PROFIL STREAMER (ROLE-AWARE) ======== */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {isAdmin ? (
            !selectedOverviewStreamerId ? (
              <StreamerListView
                onSelectStreamer={(id) => setSelectedOverviewStreamerId(id)}
                currentKaryawanId={session?.user?.karyawanId}
              />
            ) : (
              <StreamerProfileCardOverview
                streamerId={selectedOverviewStreamerId}
                onBackToList={() => setSelectedOverviewStreamerId(null)}
              />
            )
          ) : (
            /* Streamer role: only sees their own profile */
            <StreamerProfileCardOverview
              streamerId={session?.user?.karyawanId || undefined}
            />
          )}
        </div>
      )}

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
          requestSubTab={requestSubTab}
          onRequestSubTabChange={setRequestSubTab}
          leaveDate={leaveDate}
          onLeaveDateChange={setLeaveDate}
          leaveReason={leaveReason}
          onLeaveReasonChange={setLeaveReason}
          hasScheduleConflict={hasScheduleConflict}
          conflictingJadwal={conflictingJadwal}
          onLeaveSubmit={handleLeaveSubmit}
          shiftDate={shiftDate}
          onShiftDateChange={setShiftDate}
          selectedSesi={selectedSesi}
          onSelectedSesiChange={setSelectedSesi}
          shiftNote={shiftNote}
          onShiftNoteChange={setShiftNote}
          onShiftSubmit={handleShiftSubmit}
          submittingRequest={submittingRequest}
        />
      )}

      {/* ======== TAB: HISTORY / RIWAYAT (REF-DEPLOY) ======== */}
      {activeTab === "riwayat" && (
        <>
          <TabRiwayat
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
      {activeTab === "report" && <TabReport dashboardData={dashboardData} />}
    </div>
  );
}
