"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { formatDateSafe, formatTimeSafe, calcWajibHadir } from "@/lib/utils/date-format";
import { fetchJson, sendJson, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import "flatpickr/dist/flatpickr.min.css";

type JadwalRow = any;
type HistoryRow = any;

const LOKASI_OPTIONS = ["Timoho", "Berbah", "Wiyoro", "Lainnya"];
const ROWS_JADWAL = 20;
const ROWS_RIWAYAT = 10;

function parseTanggalFlexible(tglStr: string | null | undefined): Date | null {
  if (!tglStr || tglStr === "-") return null;
  const cleanStr = String(tglStr).replace(/-/g, "/");
  const parts = cleanStr.split("/");
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const fallback = new Date(String(tglStr));
  if (!isNaN(fallback.getTime())) {
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return null;
}

function officeHoursLabel(): string {
  const now = new Date();
  const bulanIndo = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const hariIndo = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const tgl = hariIndo[now.getDay()] + ", " + ("0" + now.getDate()).slice(-2) + " " + bulanIndo[now.getMonth()] + " " + now.getFullYear();
  return "Office Hours — " + tgl;
}

function hitungTargetKeluarAbsolut(tglStr: string, wktStr: string): Date | null {
  const dStart = parseTanggalFlexible(tglStr);
  if (!dStart || !wktStr || wktStr.indexOf("-") === -1) return null;
  const parts = wktStr.split("-");
  const startP = parts[0].trim().split(":");
  const endP = parts[1].trim().split(":");
  const jamMulai = parseInt(startP[0], 10);
  const jamSelesai = parseInt(endP[0], 10);
  const dEnd = new Date(dStart.getTime());
  dEnd.setHours(jamSelesai, parseInt(endP[1] ?? "0", 10), 0, 0);
  if (jamSelesai <= jamMulai && jamMulai > 12) dEnd.setDate(dEnd.getDate() + 1);
  return dEnd;
}

export default function StaffDashboardPage() {
  const { data: session } = useSession();
  const roleSistem = String((session?.user as any)?.role ?? "").toUpperCase().trim();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(roleSistem);
  const isOtsRole = roleSistem === "OTS";
  const showJadwalTab = ["OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(roleSistem);

  const [activeTab, setActiveTab] = useState("checkin");

  // Sesi & stats
  const [sesi, setSesi] = useState<any | null>(null);
  const [stats, setStats] = useState<{ jamKerja: number; hariAktif: number; sisaCuti: number }>({ jamKerja: 0, hariAktif: 0, sisaCuti: 0 });
  const [pageLoading, setPageLoading] = useState(true);

  // Admin supervision
  const [searchStaffInput, setSearchStaffInput] = useState("");
  const [monitoredStaff, setMonitoredStaff] = useState<any | null>(null);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);

  // Check-In form (persis ref)
  const [shiftValue, setShiftValue] = useState("");
  const [shiftSelectValue, setShiftSelectValue] = useState("");
  const [shiftSummary, setShiftSummary] = useState<{ id: string; tanggal: string; waktu: string; idKar: string; nama: string; lokasi: string } | null>(null);
  const [lokasi, setLokasi] = useState("");
  const [lokasiLainnya, setLokasiLainnya] = useState("");
  const [alasan, setAlasan] = useState("");
  const [submittingIn, setSubmittingIn] = useState(false);

  // Kamera (persis ref: camStore + modal fullscreen + GPS)
  const [camMasukB64, setCamMasukB64] = useState("");
  const [camKeluarB64, setCamKeluarB64] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camTarget, setCamTarget] = useState<"masuk" | "keluar">("masuk");
  const [camMode] = useState<"user">("user");
  const [camLocating, setCamLocating] = useState(false);
  const [lokasiMaps, setLokasiMaps] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check-Out form (persis ref)
  const [coIdAbsen, setCoIdAbsen] = useState("");
  const [laporan, setLaporan] = useState("");
  const [submittingOut, setSubmittingOut] = useState(false);
  const [jamSelesaiSesi, setJamSelesaiSesi] = useState("");
  const [targetKeluar, setTargetKeluar] = useState<Date | null>(null);
  const [checkoutLocked, setCheckoutLocked] = useState(false);

  // Jadwal & Riwayat
  const [jadwalList, setJadwalList] = useState<JadwalRow[]>([]);
  const [jadwalLoading, setJadwalLoading] = useState(false);
  const [filterWaktuJadwal, setFilterWaktuJadwal] = useState("all");
  const [kategoriJadwal, setKategoriJadwal] = useState("all");
  const [cariJadwal, setCariJadwal] = useState("");
  const [customDateJadwal, setCustomDateJadwal] = useState("");
  const [pageJadwal, setPageJadwal] = useState(1);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterWaktuRiwayat, setFilterWaktuRiwayat] = useState("all");
  const [kategoriRiwayat, setKategoriRiwayat] = useState("all");
  const [cariRiwayat, setCariRiwayat] = useState("");
  const [customDateRiwayat, setCustomDateRiwayat] = useState("");
  const [pageRiwayat, setPageRiwayat] = useState(1);

  // Modal catatan/file (persis ref)
  const [modalCatatan, setModalCatatan] = useState<string | null>(null);
  const [modalFiles, setModalFiles] = useState<string[] | null>(null);

  const fpJadwalRef = useRef<any>(null);
  const fpRiwayatRef = useRef<any>(null);

  // ---------- data loading ----------
  const loadStats = useCallback(async (target?: string) => {
    try {
      const q = target ? `&search=${encodeURIComponent(target)}` : "";
      const data = await fetchJson<any>(`/api/staff?view=stats${q}`);
      if (data) {
        setStats({ jamKerja: data.jamKerja ?? 0, hariAktif: data.hariAktif ?? 0, sisaCuti: data.sisaCuti ?? 0 });
        if (target && data.karyawan) setMonitoredStaff(data.karyawan);
      }
    } catch { /* ignore */ }
  }, []);

  const loadSession = useCallback(async (target?: string) => {
    try {
      const q = target ? `&search=${encodeURIComponent(target)}` : "";
      const data = await fetchJson<any>(`/api/staff?view=sesi${q}`);
      setSesi(data ?? null);
    } catch { setSesi(null); }
  }, []);

  const loadHistory = useCallback(async (targetKaryawanId?: string) => {
    setHistoryLoading(true);
    try {
      const q = targetKaryawanId ? `&karyawanId=${encodeURIComponent(targetKaryawanId)}` : "";
      const data = await fetchJson<any[]>(`/api/absensi?view=history&kategori=STAFF${q}`);
      setHistory(data ?? []);
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  const loadJadwal = useCallback(async (targetKaryawanId?: string) => {
    setJadwalLoading(true);
    try {
      const q = targetKaryawanId ? `?karyawanId=${encodeURIComponent(targetKaryawanId)}` : "";
      const data = await fetchJson<any[]>(`/api/jadwal${q}`);
      setJadwalList(data ?? []);
    } catch { /* ignore */ } finally { setJadwalLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      setPageLoading(true);
      await Promise.all([loadSession(), loadStats(), loadHistory(), loadJadwal()]);
      setPageLoading(false);
    })();
  }, [loadSession, loadStats, loadHistory, loadJadwal]);

  useEffect(() => {
    if (!isOtsRole) setShiftValue((v) => v || officeHoursLabel());
  }, [isOtsRole]);

  // ---------- tab veto ala ref: checkActiveSession + lockCheckInTab ----------
  const switchTab = useCallback((tabId: string) => {
    try { sessionStorage.setItem("staffCurrentTab", tabId); } catch { /* ignore */ }
    setActiveTab(tabId);
    if (tabId === "riwayat") setPageRiwayat(1);
    if (tabId === "jadwal") setPageJadwal(1);
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem("staffCurrentTab"); } catch { /* ignore */ }
    if (sesi) {
      setCoIdAbsen(sesi.id ?? "");
      const target = saved && saved !== "checkin" ? saved : "checkout";
      setActiveTab(showJadwalTab || target !== "jadwal" ? target : "checkout");
    } else {
      setCoIdAbsen("");
      if (saved === "checkout") setActiveTab("checkin");
      else if (saved && saved !== "checkout") setActiveTab(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesi]);

  const checkinLocked = !!sesi;

  // ---------- kunci waktu check-out OTS (persis ref) ----------
  useEffect(() => {
    if (!sesi) { setTargetKeluar(null); setJamSelesaiSesi(""); setCheckoutLocked(false); return; }
    const linked = jadwalList.find((j) => j.id === (sesi.jadwalId ?? sesi.jadwal?.id)) ?? null;
    const jamMulai = linked?.jamMulaiLive ? new Date(linked.jamMulaiLive) : null;
    const jamSelesai = linked?.jamSelesaiLive ? new Date(linked.jamSelesaiLive) : null;
    if (isOtsRole && jamMulai && jamSelesai) {
      const tglStr = formatDateSafe(linked.tanggal);
      const wktStr = `${formatTimeSafe(linked.jamMulaiLive)} - ${formatTimeSafe(linked.jamSelesaiLive)}`;
      setJamSelesaiSesi(formatTimeSafe(linked.jamSelesaiLive));
      setTargetKeluar(hitungTargetKeluarAbsolut(tglStr, wktStr));
    } else {
      setTargetKeluar(null); setJamSelesaiSesi(""); setCheckoutLocked(false);
    }
  }, [sesi, jadwalList, isOtsRole]);

  useEffect(() => {
    if (!targetKeluar || !isOtsRole) return;
    const tick = () => setCheckoutLocked(Date.now() < targetKeluar.getTime());
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [targetKeluar, isOtsRole]);

  // ---------- shift options (OTS ambil dari jadwal, non-OTS office hours) ----------
  const shiftOptions = (() => {
    if (!isOtsRole) return [];
    const uname = String((session?.user as any)?.name ?? "").toLowerCase();
    return jadwalList
      .filter((j) => {
        const nm = `${j.otsKaryawan?.namaLengkap ?? ""} ${j.streamerKaryawan?.namaLengkap ?? ""}`.toLowerCase();
        return !uname || nm.includes(uname) || !j.otsKaryawan;
      })
      .slice(0, 50)
      .map((j) => {
        const tgl = formatDateSafe(j.tanggal);
        const jam = `${formatTimeSafe(j.jamMulaiLive)} - ${formatTimeSafe(j.jamSelesaiLive)}`;
        const idKar = j.otsKaryawan?.idKaryawan ?? j.streamerKaryawan?.idKaryawan ?? "";
        const nama = j.otsKaryawan?.namaLengkap ?? j.streamerKaryawan?.namaLengkap ?? "";
        const lok = j.cabangStudio ?? "";
        return { raw: j, value: `${j.idJadwal ?? j.id} | ${tgl} | ${jam} | ${idKar} | ${nama} | ${lok}`, idJadwalDb: j.id as string, idJadwalLabel: (j.idJadwal ?? j.id) as string, tanggal: tgl, waktu: jam, idKar, nama, lokasi: lok };
      });
  })();

  function handleOtsSelect(val: string) {
    setShiftSelectValue(val);
    if (!val) { setShiftSummary(null); setShiftValue(""); return; }
    const cols = val.split("|").map((x) => x.replace(/\|/g, "").trim());
    setShiftSummary({ id: cols[0] ?? "-", tanggal: cols[1] ?? "-", waktu: cols[2] ?? "-", idKar: cols[3] ?? "-", nama: cols[4] ?? "-", lokasi: cols[5] ?? "-" });
    setShiftValue(cols[0] ?? "");
    const cabangTarget = cols[5] ?? "";
    const found = LOKASI_OPTIONS.find((o) => o.toLowerCase() === cabangTarget.toLowerCase());
    if (found) { setLokasi(found === "Lainnya" ? "Lainnya" : found); if (found !== "Lainnya") setLokasiLainnya(""); }
    else if (cabangTarget) { setLokasi("Lainnya"); setLokasiLainnya(cabangTarget); }
  }

  // ---------- kamera persis ref ----------
  async function openCameraModal(target: "masuk" | "keluar") {
    setCamTarget(target);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camMode } });
      mediaStreamRef.current = stream;
      // tunggu video terpasang
      requestAnimationFrame(() => {
        if (videoRef.current) (videoRef.current as HTMLVideoElement).srcObject = stream;
      });
    } catch {
      toast.error("Gagal mengakses kamera.");
      closeCamera();
    }
  }

  function closeCamera() {
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setCameraOpen(false);
  }

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (!width || !height) return;
    const MAX_DIM = 1080;
    if (width > height && width > MAX_DIM) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
    else if (height > width && height > MAX_DIM) { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // injeksi anti-mirror persis ref
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.6);
    if (camTarget === "masuk") setCamMasukB64(base64Data);
    else setCamKeluarB64(base64Data);
    closeCamera();
  }

  function removeSnapshot(target: "masuk" | "keluar") {
    if (target === "masuk") setCamMasukB64("");
    else setCamKeluarB64("");
  }

  function openCameraWithLocationStaff(e: React.MouseEvent<HTMLButtonElement>, target: "masuk" | "keluar") {
    e.preventDefault();
    const btn = e.currentTarget;
    if (!shiftValue.trim()) { toast.error("Silakan tunggu Shift termuat atau pilih jadwal terlebih dahulu."); return; }
    if (!lokasi) { toast.error("Silakan pilih Lokasi terlebih dahulu."); return; }
    if (!navigator.geolocation) { toast.error("Browser Anda tidak mendukung fitur GPS. Absensi dibatalkan."); return; }
    const oriText = btn.innerHTML;
    setCamLocating(true);
    btn.innerHTML = "Mengecek Titik GPS...";
    btn.setAttribute("disabled", "true");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLokasiMaps(`https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`);
        btn.innerHTML = oriText; btn.removeAttribute("disabled");
        setCamLocating(false);
        openCameraModal(target);
      },
      () => {
        btn.innerHTML = oriText; btn.removeAttribute("disabled");
        setCamLocating(false);
        toast.error("Akses lokasi ditolak/tidak aktif. Anda wajib menyalakan GPS dan memberikan izin lokasi untuk absen.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ---------- submit persis ref (payload dipetakan ke /api/absensi) ----------
  async function submitCheckIn() {
    if (!shiftValue.trim()) { toast.error("Silakan pilih atau tunggu data Shift dimuat."); return; }
    if (!lokasi) { toast.error("Silakan pilih Lokasi Kerja."); return; }
    if (lokasi === "Lainnya" && !lokasiLainnya.trim()) { toast.error("Silakan ketik lokasi manual."); return; }
    if (!camMasukB64) { toast.error("Foto selfie dari kamera wajib diambil."); return; }
    setSubmittingIn(true);
    try {
      const lokasiKerja = lokasi === "Lainnya" ? lokasiLainnya.trim() : lokasi;
      const opt = shiftOptions.find((o) => o.idJadwalLabel === shiftValue);
      const targetKaryawanId = monitoredStaff?.id as string | undefined;
      await sendJson("/api/absensi", "POST", {
        tipe: "CHECK_IN",
        kategori: isOtsRole ? "OTS" : "STAFF",
        karyawanId: targetKaryawanId,
        jadwalId: opt?.idJadwalDb ?? null,
        lokasi: [lokasiKerja, lokasiMaps].filter(Boolean).join(" "),
        alasan: alasan || undefined,
        catatan: `Shift: ${shiftValue}${alasan ? ` | Alasan terlambat: ${alasan}` : ""}`,
        fotoBuktiUrl: camMasukB64 || undefined,
      });
      toast.success("Check-In Berhasil!");
      setCamMasukB64(""); setLokasiMaps(""); setLokasi(""); setLokasiLainnya(""); setAlasan("");
      if (isOtsRole && opt) {
        const parts = opt.waktu.split("-");
        if (parts[1]) setJamSelesaiSesi(parts[1].trim());
        const abs = hitungTargetKeluarAbsolut(opt.tanggal, opt.waktu);
        if (abs) setTargetKeluar(abs);
      }
      await Promise.all([loadSession(monitoredStaff?.id), loadHistory(monitoredStaff?.id), loadJadwal(monitoredStaff?.id)]);
    } catch (err) {
      toast.error(errorMessage(err, "Gagal Check-In"));
    } finally { setSubmittingIn(false); }
  }

  async function submitCheckOut() {
    if (!coIdAbsen.trim()) { toast.error("ID Absen tidak ditemukan."); return; }
    if (!laporan.trim()) { toast.error("Laporan pekerjaan wajib diisi."); return; }
    if (!camKeluarB64) { toast.error("Foto selfie keluar wajib diambil via kamera."); return; }
    if (checkoutLocked) { toast.error(`Tombol Check-Out akan terbuka otomatis pada pukul ${jamSelesaiSesi} WIB`); return; }
    setSubmittingOut(true);
    try {
      const targetKaryawanId = monitoredStaff?.id as string | undefined;
      await sendJson("/api/absensi", "POST", {
        tipe: "CHECK_OUT",
        kategori: isOtsRole ? "OTS" : "STAFF",
        karyawanId: targetKaryawanId,
        jadwalId: (sesi?.jadwalId ?? sesi?.jadwal?.id ?? null) as string | null,
        catatan: laporan,
        fotoBuktiUrl: camKeluarB64 || undefined,
      });
      toast.success("Check-Out Berhasil! Laporan tersimpan.");
      setCamKeluarB64(""); setLaporan(""); setCoIdAbsen("");
      setJamSelesaiSesi(""); setTargetKeluar(null); setCheckoutLocked(false);
      await Promise.all([loadSession(monitoredStaff?.id), loadHistory(monitoredStaff?.id)]);
      switchTab("riwayat");
    } catch (err) {
      toast.error(errorMessage(err, "Gagal Check-Out"));
    } finally { setSubmittingOut(false); }
  }

  // ---------- admin panel persis ref ----------
  async function handleSearchStaff() {
    if (!searchStaffInput.trim()) return;
    setAdminSearchLoading(true);
    try {
      const q = encodeURIComponent(searchStaffInput.trim());
      const [st, ss] = await Promise.all([
        fetchJson<any>(`/api/staff?view=stats&search=${q}`),
        fetchJson<any>(`/api/staff?view=sesi&search=${q}`).catch(() => null),
      ]);
      if (st?.karyawan) {
        setMonitoredStaff(st.karyawan);
        setStats({ jamKerja: st.jamKerja ?? 0, hariAktif: st.hariAktif ?? 0, sisaCuti: st.sisaCuti ?? 0 });
        setSesi(ss ?? null);
        await Promise.all([loadHistory(st.karyawan.id), loadJadwal(st.karyawan.id)]);
        toast.success(`Mode Pengawasan aktif untuk: ${st.karyawan.namaLengkap} (${st.karyawan.idKaryawan})`);
      } else toast.error("Staff tidak ditemukan");
    } catch (err) { toast.error(errorMessage(err, "Gagal memuat data pengawasan staff")); }
    finally { setAdminSearchLoading(false); }
  }

  function handleResetAdminSearch() {
    setSearchStaffInput(""); setMonitoredStaff(null);
    loadSession(); loadStats(); loadHistory(); loadJadwal();
  }

  // ---------- flatpickr custom date persis ref ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needJadwal = filterWaktuJadwal === "custom_single" || filterWaktuJadwal === "custom_range";
      const needRiwayat = filterWaktuRiwayat === "custom_single" || filterWaktuRiwayat === "custom_range";
      if (!needJadwal && !needRiwayat) return;
      const flatpickr = (await import("flatpickr")).default;
      if (cancelled) return;
      if (needJadwal) {
        const el = document.getElementById("inputCustomDateOTS") as HTMLInputElement | null;
        if (el) {
          if (fpJadwalRef.current) (fpJadwalRef.current as any).destroy();
          fpJadwalRef.current = flatpickr(el, {
            dateFormat: "d/m/Y",
            mode: filterWaktuJadwal === "custom_range" ? "range" : "single",
            onChange: (_d: Date[], s: string) => setCustomDateJadwal(s),
          });
        }
      }
      if (needRiwayat) {
        const el = document.getElementById("inputCustomDateRiwayat") as HTMLInputElement | null;
        if (el) {
          if (fpRiwayatRef.current) (fpRiwayatRef.current as any).destroy();
          fpRiwayatRef.current = flatpickr(el, {
            dateFormat: "d/m/Y",
            mode: filterWaktuRiwayat === "custom_range" ? "range" : "single",
            onChange: (_d: Date[], s: string) => setCustomDateRiwayat(s),
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [filterWaktuJadwal, filterWaktuRiwayat]);

  // ---------- filter + pagination jadwal (kolom persis ref) ----------
  const filteredJadwal = (() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return jadwalList.filter((j) => {
      const tglItem = parseTanggalFlexible(formatDateSafe(j.tanggal));
      let passWaktu = true;
      if (filterWaktuJadwal !== "all") {
        if (!tglItem) passWaktu = false;
        else {
          const diffDays = Math.round((tglItem.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (filterWaktuJadwal === "today") passWaktu = diffDays === 0;
          else if (filterWaktuJadwal === "last7") passWaktu = diffDays >= -7 && diffDays <= 0;
          else if (filterWaktuJadwal === "next7") passWaktu = diffDays >= 0 && diffDays <= 7;
          else if (filterWaktuJadwal === "last35") passWaktu = diffDays >= -35 && diffDays <= 0;
          else if (filterWaktuJadwal === "next35") passWaktu = diffDays >= 0 && diffDays <= 35;
          else if ((filterWaktuJadwal === "custom_single" || filterWaktuJadwal === "custom_range") && customDateJadwal.trim() !== "") {
            if (filterWaktuJadwal === "custom_single") {
              const d = parseTanggalFlexible(customDateJadwal);
              passWaktu = !!(d && tglItem.getTime() === d.getTime());
            } else {
              const parts = customDateJadwal.split(" to ");
              if (parts.length === 2) {
                const a = parseTanggalFlexible(parts[0]); const b = parseTanggalFlexible(parts[1]);
                if (a && b) passWaktu = tglItem >= a && tglItem <= b;
              }
            }
          }
        }
      }
      let passTeks = true;
      const q = cariJadwal.toLowerCase().trim();
      if (q !== "") {
        const idJadwal = String(j.idJadwal ?? j.id ?? "");
        const status = String(j.status ?? "");
        const nama = `${j.otsKaryawan?.namaLengkap ?? ""} ${j.streamerKaryawan?.namaLengkap ?? ""} ${j.hostKaryawan?.namaLengkap ?? ""}`;
        const cabang = String(j.cabangStudio ?? "");
        if (kategoriJadwal === "all") passTeks = `${idJadwal} ${status} ${nama} ${cabang}`.toLowerCase().includes(q);
        else if (kategoriJadwal === "id_jadwal") passTeks = idJadwal.toLowerCase().includes(q);
        else if (kategoriJadwal === "status") passTeks = status.toLowerCase().includes(q);
        else if (kategoriJadwal === "nama") passTeks = nama.toLowerCase().includes(q);
        else if (kategoriJadwal === "cabang") passTeks = cabang.toLowerCase().includes(q);
      }
      return passWaktu && passTeks;
    });
  })();
  const totalPagesJadwal = Math.max(1, Math.ceil(filteredJadwal.length / ROWS_JADWAL));
  const pagedJadwal = filteredJadwal.slice((pageJadwal - 1) * ROWS_JADWAL, pageJadwal * ROWS_JADWAL);

  // ---------- filter + pagination riwayat (kolom persis ref) ----------
  const filteredRiwayat = (() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return history.filter((h) => {
      const tglItem = h.waktu ? new Date(h.waktu) : null;
      if (tglItem) tglItem.setHours(0, 0, 0, 0);
      let passWaktu = true;
      if (filterWaktuRiwayat !== "all") {
        if (!tglItem) passWaktu = false;
        else {
          const diffDays = Math.round((tglItem.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (filterWaktuRiwayat === "today") passWaktu = diffDays === 0;
          else if (filterWaktuRiwayat === "last7") passWaktu = diffDays >= -7 && diffDays <= 0;
          else if (filterWaktuRiwayat === "last35") passWaktu = diffDays >= -35 && diffDays <= 0;
          else if ((filterWaktuRiwayat === "custom_single" || filterWaktuRiwayat === "custom_range") && customDateRiwayat.trim() !== "") {
            if (filterWaktuRiwayat === "custom_single") {
              const d = parseTanggalFlexible(customDateRiwayat);
              passWaktu = !!(d && tglItem.getTime() === d.getTime());
            } else {
              const parts = customDateRiwayat.split(" to ");
              if (parts.length === 2) {
                const a = parseTanggalFlexible(parts[0]); const b = parseTanggalFlexible(parts[1]);
                if (a && b) passWaktu = tglItem >= a && tglItem <= b;
              }
            }
          }
        }
      }
      let passTeks = true;
      const q = cariRiwayat.toLowerCase().trim();
      if (q !== "") {
        const idAbsen = String(h.id ?? "");
        const idJadwal = String(h.jadwal?.idJadwal ?? "");
        const status = h.tipe === "CHECK_OUT" ? "SELESAI" : "AKTIF";
        const cabang = String(h.jadwal?.cabangStudio ?? "");
        if (kategoriRiwayat === "all") passTeks = `${idAbsen} ${idJadwal} ${status} ${cabang}`.toLowerCase().includes(q);
        else if (kategoriRiwayat === "id_absen") passTeks = idAbsen.toLowerCase().includes(q);
        else if (kategoriRiwayat === "id_jadwal") passTeks = idJadwal.toLowerCase().includes(q);
        else if (kategoriRiwayat === "status") passTeks = status.toLowerCase().includes(q);
        else if (kategoriRiwayat === "cabang") passTeks = cabang.toLowerCase().includes(q);
      }
      return passWaktu && passTeks;
    });
  })();
  const totalPagesRiwayat = Math.max(1, Math.ceil(filteredRiwayat.length / ROWS_RIWAYAT));
  const pagedRiwayat = filteredRiwayat.slice((pageRiwayat - 1) * ROWS_RIWAYAT, pageRiwayat * ROWS_RIWAYAT);

  function statusBadge(status: string) {
    const s = String(status ?? "").toUpperCase();
    let c = "bg-slate-100 text-slate-700 border-slate-200";
    if (s === "SELESAI" || s === "JADWAL FIX") c = "bg-emerald-100 text-emerald-700 border-emerald-200";
    else if (s === "BATAL" || s === "REJECTED" || s === "DIBATALKAN") c = "bg-red-100 text-red-700 border-red-200";
    else if (s === "ON AIR" || s === "ON_GOING" || s === "BERJALAN") c = "bg-red-100 text-red-600 border-red-200 animate-pulse";
    else if (s === "PREPARE" || s === "PENDING" || s === "BOOKED" || s === "PERLU LAPOR") c = "bg-amber-100 text-amber-700 border-amber-200";
    else if (s === "TERJADWAL" || s === "AKTIF") c = "bg-blue-100 text-blue-700 border-blue-200";
    return <span className={`px-2 py-1 text-[10px] font-bold rounded shadow-sm border tracking-wide whitespace-nowrap ${c}`}>{status}</span>;
  }

  const userName = monitoredStaff?.namaLengkap ?? (session?.user as any)?.name ?? "Staff";

  return (
    <div className="max-w-5xl mx-auto w-full flex-1">
      <style>{`.tab-active{background-color:#f1f5f9;border:1px solid #cbd5e1;font-weight:600;color:#1e293b;}.tab-inactive{color:#64748b;font-weight:500;border:1px solid transparent;}.tab-inactive:hover{background-color:#f8fafc;color:#334155;}`}</style>

      {pageLoading && (
        <div id="loadingOverlay" className="fixed inset-0 bg-white/50 backdrop-blur-md z-[999] flex flex-col items-center justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-blue-600 text-5xl mb-5" />
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Memuat Ruang Kerja...</h2>
          <p className="text-sm font-medium text-slate-500 mt-2">Memindai otorisasi dan sinkronisasi server HRIS</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <i className="fa-solid fa-id-badge text-blue-600 text-2xl sm:text-3xl" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Staff Dashboard</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Kelola absensi harian dan pantau produktivitas kerja.</p>
        </div>
      </div>

      {isAdmin && (
        <div id="adminPanel" className="mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
            <i className="fa-solid fa-magnifying-glass text-blue-500 mr-2" />Panel Pengawasan (Admin)
            {monitoredStaff && <span className="ml-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-bold">Sedang Memantau: {monitoredStaff.namaLengkap} ({monitoredStaff.idKaryawan})</span>}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-500 mb-1">Cari ID Karyawan / Nama Staff</label>
              <input
                type="text"
                id="searchStaff"
                value={searchStaffInput}
                onChange={(e) => setSearchStaffInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchStaff()}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="Masukkan ID atau Nama Staff..."
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleSearchStaff} disabled={adminSearchLoading || !searchStaffInput.trim()} className="flex-1 sm:flex-none bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-50">
                <i className={`fa-solid ${adminSearchLoading ? "fa-circle-notch fa-spin" : "fa-search"} mr-1`} />Pantau Staff
              </button>
              <button onClick={handleResetAdminSearch} className="flex-1 sm:flex-none bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-300 transition">Reset</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Halo, <span id="welcomeName">{userName}</span>! 👋</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2"><i className="fa-solid fa-clock text-blue-500" /><span className="text-sm font-bold text-slate-500">Jam Kerja Bulan Ini</span></div>
            <div className="text-2xl font-black text-slate-800" id="statJamKerja">{stats.jamKerja.toFixed(1)} Jam</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-indigo-500">
            <div className="flex items-center gap-2 mb-2"><i className="fa-solid fa-user-check text-indigo-500" /><span className="text-sm font-bold text-slate-500">Hari Aktif Bulan Ini</span></div>
            <div className="text-2xl font-black text-slate-800" id="statHariAktif">{stats.hariAktif} Hari</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2 mb-2"><i className="fa-solid fa-calendar-minus text-emerald-500" /><span className="text-sm font-bold text-slate-500">Sisa Cuti</span></div>
            <div className="text-xl font-black text-slate-800" id="statSisaCuti">{stats.sisaCuti} Hari</div>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 border border-slate-200 p-1.5 rounded-xl bg-slate-50 mb-6 w-full sm:w-fit">
        <button onClick={() => !checkinLocked && switchTab("checkin")} id="btn-checkin" className={`whitespace-nowrap py-2 px-4 sm:px-5 rounded-lg text-sm transition flex-1 sm:flex-none ${activeTab === "checkin" ? "tab-active" : "tab-inactive"} ${checkinLocked ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}>
          <i className={`fa-solid ${checkinLocked ? "fa-lock" : "fa-arrow-right-to-bracket"} sm:mr-2`} /><span className="hidden sm:inline">Check In</span>
        </button>
        <button onClick={() => switchTab("checkout")} id="btn-checkout" className={`whitespace-nowrap py-2 px-4 sm:px-5 rounded-lg text-sm transition flex-1 sm:flex-none ${activeTab === "checkout" ? "tab-active" : "tab-inactive"}`}>
          <i className="fa-solid fa-arrow-right-from-bracket sm:mr-2" /><span className="hidden sm:inline">Check Out</span>
        </button>
        {showJadwalTab && (
          <button onClick={() => switchTab("jadwal")} id="btn-jadwal" className={`whitespace-nowrap py-2 px-4 sm:px-5 rounded-lg text-sm transition flex-1 sm:flex-none ${activeTab === "jadwal" ? "tab-active" : "tab-inactive"}`}>
            <i className="fa-regular fa-calendar sm:mr-2" /><span className="hidden sm:inline">Jadwal</span>
          </button>
        )}
        <button onClick={() => switchTab("riwayat")} id="btn-riwayat" className={`whitespace-nowrap py-2 px-4 sm:px-5 rounded-lg text-sm transition flex-1 sm:flex-none ${activeTab === "riwayat" ? "tab-active" : "tab-inactive"}`}>
          <i className="fa-solid fa-clock-rotate-left sm:mr-2" /><span className="hidden sm:inline">Riwayat</span>
        </button>
      </div>

      {/* TAB CHECK-IN persis ref */}
      {activeTab === "checkin" && (
        <div id="tab-checkin" className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm block">
          <h3 className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-3 mb-5">
            <i className="fa-solid fa-arrow-right-to-bracket text-blue-600 mr-2" />Form Absen Masuk
          </h3>
          <div id="formCheckIn" className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div id="shiftContainer">
                  {isOtsRole ? (
                    <>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Jadwal OTS <span className="text-red-500">*</span></label>
                      <select id="ciShiftSelect" value={shiftSelectValue} onChange={(e) => handleOtsSelect(e.target.value)} disabled={jadwalLoading || shiftOptions.length === 0} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" required>
                        <option value="" disabled>{shiftOptions.length === 0 ? "Tidak ada jadwal aktif" : "Pilih Jadwal OTS..."}</option>
                        {shiftOptions.map((o) => <option key={o.idJadwalDb} value={o.value}>{o.value}</option>)}
                      </select>
                      <input type="hidden" id="ciShiftValue" value={shiftValue} />
                      {shiftSummary && (
                        <div id="ciSummary" className="mt-4 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full">
                          <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Rangkuman Jadwal Terpilih</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
                            <div><p className="text-[10px] text-slate-400 mb-0.5">ID Jadwal</p><p id="sumId" className="text-sm font-bold text-blue-400">{shiftSummary.id}</p></div>
                            <div><p className="text-[10px] text-slate-400 mb-0.5">Tanggal</p><p id="sumTanggal" className="text-sm font-bold text-white">{shiftSummary.tanggal}</p></div>
                            <div><p className="text-[10px] text-slate-400 mb-0.5">Waktu Kerja</p><p id="sumWaktu" className="text-sm font-bold text-emerald-400">{shiftSummary.waktu}</p></div>
                            <div><p className="text-[10px] text-slate-400 mb-0.5">ID Karyawan</p><p id="sumIdKar" className="text-sm font-bold text-white">{shiftSummary.idKar}</p></div>
                            <div><p className="text-[10px] text-slate-400 mb-0.5">Nama Lengkap</p><p id="sumNama" className="text-sm font-bold text-white">{shiftSummary.nama}</p></div>
                            <div><p className="text-[10px] text-slate-400 mb-0.5">Lokasi Studio</p><p id="sumLokasi" className="text-sm font-bold text-white">{shiftSummary.lokasi}</p></div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Shift / Periode Kerja <span className="ml-1 text-xs font-normal text-slate-400">(Office Hours)</span></label>
                      <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-100 text-slate-700 font-medium">
                        <i className="fa-regular fa-calendar-check text-blue-500 flex-shrink-0" />
                        <span id="ciShiftLabel">{officeHoursLabel()}</span>
                      </div>
                      <input type="hidden" id="ciShiftValue" value={shiftValue || officeHoursLabel()} />
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi <span className="text-red-500">*</span></label>
                  <select id="ciLokasiSelect" value={lokasi} onChange={(e) => { setLokasi(e.target.value); if (e.target.value !== "Lainnya") setLokasiLainnya(""); }} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" required>
                    <option value="" disabled>Pilih Lokasi...</option>
                    <option value="Timoho">Timoho</option>
                    <option value="Berbah">Berbah</option>
                    <option value="Wiyoro">Wiyoro</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                  <input type="text" id="ciLokasiLainnya" value={lokasiLainnya} onChange={(e) => setLokasiLainnya(e.target.value)} placeholder="Ketik lokasi manual..." className={`${lokasi === "Lainnya" ? "" : "hidden "}mt-2 w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white`} required={lokasi === "Lainnya"} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Foto Selfie Masuk <span className="text-red-500">*Wajib</span></label>
                <button type="button" onClick={(e) => openCameraWithLocationStaff(e, "masuk")} disabled={camLocating} className="w-full bg-blue-50 text-blue-600 border border-blue-200 py-3 rounded-lg font-bold hover:bg-blue-100 transition shadow-sm mb-3 disabled:opacity-60">
                  <i className={`fa-solid ${camLocating ? "fa-location-dot fa-fade" : "fa-camera"} mr-2`} /> {camLocating ? "Mengecek Titik GPS..." : "Buka Kamera PC/HP"}
                </button>
                {camMasukB64 && (
                  <div id="ciPhotoContainer" className="relative inline-block border border-slate-200 rounded-lg p-1 bg-slate-50 mb-3 w-full shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img id="ciPreview" src={camMasukB64} alt="Selfie masuk" className="w-full max-h-48 rounded object-cover" />
                    <button type="button" onClick={() => removeSnapshot("masuk")} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow-md border-2 border-white transition z-10"><i className="fa-solid fa-xmark text-sm" /></button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2 mt-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">Alasan Terlambat (Opsional)</label>
                <textarea id="ciAlasan" value={alasan} onChange={(e) => setAlasan(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" rows={2} placeholder="Isi alasan jika Anda terlambat..." />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5 mt-4 flex justify-end">
              <button id="btnSubmitCheckIn" onClick={submitCheckIn} disabled={submittingIn} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition shadow-md w-full md:w-auto flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <i className={`fa-solid ${submittingIn ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} /> {submittingIn ? "Memproses... JANGAN Matikan Layar!" : "Submit Absen Masuk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CHECK-OUT persis ref */}
      {activeTab === "checkout" && (
        <div id="tab-checkout" className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm block">
          <h3 className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-3 mb-5">
            <i className="fa-solid fa-arrow-right-from-bracket text-amber-500 mr-2" />Form Absen Keluar
          </h3>
          <div id="formCheckOut" className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {sesi && (
                <div id="coSummary" className="md:col-span-2 bg-[#1e293b] rounded-xl p-5 shadow-lg w-full">
                  <h4 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Detail Jadwal Sesi Ini</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
                    <div><p className="text-[10px] text-slate-400 mb-0.5">ID Jadwal</p><p id="coSumId" className="text-sm font-bold text-blue-400">{sesi.jadwal?.idJadwal ?? sesi.jadwalId ?? "-"}</p></div>
                    <div><p className="text-[10px] text-slate-400 mb-0.5">Tanggal</p><p id="coSumTanggal" className="text-sm font-bold text-white">{formatDateSafe(sesi.waktu)}</p></div>
                    <div><p className="text-[10px] text-slate-400 mb-0.5">Waktu Kerja</p><p id="coSumWaktu" className="text-sm font-bold text-emerald-400">{formatTimeSafe(sesi.waktu)} WIB</p></div>
                    <div><p className="text-[10px] text-slate-400 mb-0.5">ID Karyawan</p><p id="coSumIdKar" className="text-sm font-bold text-white">{monitoredStaff?.idKaryawan ?? sesi.karyawan?.idKaryawan ?? "-"}</p></div>
                    <div><p className="text-[10px] text-slate-400 mb-0.5">Nama Lengkap</p><p id="coSumNama" className="text-sm font-bold text-white">{monitoredStaff?.namaLengkap ?? sesi.karyawan?.namaLengkap ?? userName}</p></div>
                    <div><p className="text-[10px] text-slate-400 mb-0.5">Lokasi Studio</p><p id="coSumLokasi" className="text-sm font-bold text-white">{sesi.jadwal?.cabangStudio ?? "-"}</p></div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ID Absen Aktif (Otomatis)</label>
                <input type="text" id="coIdAbsen" readOnly value={coIdAbsen} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-100 cursor-not-allowed text-blue-700 font-mono font-bold tracking-wider" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Foto Selfie Keluar <span className="text-red-500">*Wajib</span></label>
                <button type="button" onClick={() => openCameraModal("keluar")} className="w-full bg-amber-50 text-amber-600 border border-amber-200 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-100 transition mb-2">
                  <i className="fa-solid fa-camera mr-2" /> Buka Kamera PC/HP
                </button>
                {camKeluarB64 && (
                  <div id="coSelfiePhotoContainer" className="relative inline-block border border-slate-200 rounded-lg p-1 bg-slate-50 mb-3 w-full shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img id="coSelfiePreview" src={camKeluarB64} alt="Selfie keluar" className="w-full max-h-48 rounded object-cover" />
                    <button type="button" onClick={() => removeSnapshot("keluar")} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow-md border-2 border-white transition z-10"><i className="fa-solid fa-xmark text-sm" /></button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">Laporan Pekerjaan Hari Ini <span className="text-red-500">*Wajib</span></label>
                <textarea id="coLaporan" rows={4} value={laporan} onChange={(e) => setLaporan(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-slate-50 resize-none" placeholder="Deskripsikan tugas dan pekerjaan yang sudah diselesaikan hari ini..." />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5 flex flex-col items-end">
              {checkoutLocked && <div id="warningWaktuKeluar" className="text-xs font-bold text-red-500 w-full text-center mb-3 block"><i className="fa-solid fa-lock mr-1" /> Tombol Check-Out akan terbuka otomatis pada pukul {jamSelesaiSesi} WIB</div>}
              {!checkoutLocked && targetKeluar && <div id="warningWaktuKeluar" className="text-xs font-bold text-emerald-500 w-full text-center mb-3 block"><i className="fa-solid fa-unlock mr-1" /> Waktu Check-Out telah tiba, silahkan selesaikan sesi.</div>}
              <button id="btnSubmitCheckOut" onClick={submitCheckOut} disabled={submittingOut || checkoutLocked} className="bg-amber-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-amber-600 transition shadow-md w-full md:w-auto flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <i className={`fa-solid ${submittingOut ? "fa-spinner fa-spin" : "fa-upload"}`} /> {submittingOut ? "Memproses... JANGAN Matikan Layar!" : "Selesaikan Sesi (Check-Out)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB JADWAL persis ref */}
      {activeTab === "jadwal" && showJadwalTab && (
        <div id="tab-jadwal" className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm block">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-calendar-week text-blue-600" /> Jadwal Kerja Operator Technical Support
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Sistem monitoring jadwal operasional dan penugasan studio</p>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="lg:w-1/3 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-regular fa-calendar text-blue-500" /></div>
              <select id="filterWaktuJadwalOTS" value={filterWaktuJadwal} onChange={(e) => { setFilterWaktuJadwal(e.target.value); setCustomDateJadwal(""); setPageJadwal(1); }} className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                <option value="all">Semua Periode</option>
                <option value="today">Hari Ini</option>
                <option value="last7">7 Hari Ke Belakang</option>
                <option value="next7">7 Hari Ke Depan</option>
                <option value="last35">35 Hari Ke Belakang</option>
                <option value="next35">35 Hari Ke Depan</option>
                <option value="custom_single">Tentukan Tanggal</option>
                <option value="custom_range">Kustom Periode</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><i className="fa-solid fa-chevron-down text-slate-400 text-xs" /></div>
            </div>
            {(filterWaktuJadwal === "custom_single" || filterWaktuJadwal === "custom_range") && (
              <div id="containerCustomDateOTS" className="lg:w-1/4 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-pen-to-square text-amber-500" /></div>
                <input type="text" id="inputCustomDateOTS" placeholder="Pilih Tanggal..." defaultValue={customDateJadwal} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer" />
              </div>
            )}
            <div className="lg:w-1/4 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-layer-group text-blue-500" /></div>
              <select id="kategoriCariJadwalOTS" value={kategoriJadwal} onChange={(e) => { setKategoriJadwal(e.target.value); setPageJadwal(1); }} className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                <option value="all">Semua Data</option>
                <option value="id_jadwal">ID Jadwal</option>
                <option value="status">Status</option>
                <option value="nama">Nama OTS</option>
                <option value="cabang">Cabang Studio</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><i className="fa-solid fa-chevron-down text-slate-400 text-xs" /></div>
            </div>
            <div className="lg:flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-magnifying-glass text-slate-400" /></div>
              <input type="text" id="cariJadwalOTS" value={cariJadwal} onChange={(e) => { setCariJadwal(e.target.value); setPageJadwal(1); }} placeholder="Ketik kata kunci pencarian..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setFilterWaktuJadwal("all"); setKategoriJadwal("all"); setCariJadwal(""); setCustomDateJadwal(""); setPageJadwal(1); }} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center shadow-sm" title="Reset Filter"><i className="fa-solid fa-filter-circle-xmark" /></button>
              <button onClick={() => loadJadwal(monitoredStaff?.id)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center border border-blue-200 shadow-sm" title="Muat Ulang Data"><i className={`fa-solid fa-rotate-right ${jadwalLoading ? "fa-spin" : ""}`} /></button>
            </div>
          </div>
          {jadwalLoading ? (
            <div id="loaderJadwalOts" className="flex flex-col items-center justify-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-blue-600 text-4xl mb-4" />
              <p className="text-slate-500 font-medium">Menyinkronkan Jadwal Kerja...</p>
            </div>
          ) : (
            <div id="containerTabelJadwalOts" className="shadow-sm rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-100 z-20 text-center min-w-[50px]">NO</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[100px] whitespace-nowrap">STATUS</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">WAKTU KERJA</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[120px]">WAJIB HADIR</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[80px]">CATATAN</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[80px]">FILE</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">OTS</th>
                    </tr>
                  </thead>
                  <tbody id="wadahTabelJadwalOTS" className="divide-y divide-slate-100 bg-white">
                    {pagedJadwal.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">Tidak ada jadwal aktif.</td></tr>}
                    {pagedJadwal.map((j, i) => {
                      const idx = (pageJadwal - 1) * ROWS_JADWAL + i;
                      const status = String(j.status ?? "AKTIF");
                      const tanggal = formatDateSafe(j.tanggal);
                      const jam = `${formatTimeSafe(j.jamMulaiLive)} - ${formatTimeSafe(j.jamSelesaiLive)}`;
                      const dur = j.durasiMenit ? `${j.durasiMenit} menit` : "-";
                      const wajib = calcWajibHadir(j.jamMulaiLive);
                      const lokasiJ = j.cabangStudio ?? "-";
                      const catatan = j.catatanOts ?? j.catatanHost ?? "";
                      const fileRaw = j.filePendukungOtsDriveId ?? j.filePendukungHostDriveId ?? "";
                      const nama = j.otsKaryawan?.namaLengkap ?? j.streamerKaryawan?.namaLengkap ?? "-";
                      const idKar = j.otsKaryawan?.idKaryawan ?? j.streamerKaryawan?.idKaryawan ?? "-";
                      const idJadwal = j.idJadwal ?? "-";
                      return (
                        <tr key={j.id ?? idx} className="hover:bg-slate-50 transition duration-150 group border-b border-slate-100">
                          <td className="px-4 py-3 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-bold text-slate-500 text-sm">{idx + 1}</td>
                          <td className="px-4 py-3 text-center align-middle whitespace-nowrap">{statusBadge(status)}</td>
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-bold text-blue-600 mb-0.5">{tanggal}</p>
                            <p className="font-bold text-slate-800 text-sm whitespace-nowrap">{jam}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">Durasi: {dur}</p>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="text-xs font-bold text-emerald-600 mb-1 whitespace-nowrap">{wajib}</div>
                            <div className="text-xs font-bold text-slate-600 whitespace-nowrap"><i className="fa-solid fa-location-dot text-rose-500 mr-1" /> {lokasiJ}</div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">{catatan ? <button onClick={() => setModalCatatan(catatan)} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm mx-auto w-fit"><i className="fa-solid fa-note-sticky" /> Buka</button> : <span className="text-slate-300 font-bold">-</span>}</td>
                          <td className="px-4 py-3 text-center align-middle">{fileRaw ? <button onClick={() => setModalFiles(String(fileRaw).split(","))} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm mx-auto w-fit"><i className="fa-solid fa-folder-open" /> File</button> : <span className="text-slate-300 font-bold">-</span>}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-700 text-sm whitespace-normal max-w-[160px] break-words">{nama}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-1 whitespace-nowrap">ID KARYAWAN: <span className="font-bold">{idKar}</span></p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">ID JADWAL: <span className="font-bold">{idJadwal}</span></p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPagesJadwal > 1 && (
                <div id="paginationOTS" className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Menampilkan <span className="font-bold text-slate-700">{(pageJadwal - 1) * ROWS_JADWAL + 1}-{Math.min(pageJadwal * ROWS_JADWAL, filteredJadwal.length)}</span> dari <span className="font-bold text-slate-700">{filteredJadwal.length}</span> data</div>
                  <div className="flex items-center gap-1">
                    <button disabled={pageJadwal === 1} onClick={() => setPageJadwal((p) => p - 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"><i className="fa-solid fa-chevron-left text-[10px]" /></button>
                    <div className="px-2 text-[11px] font-bold text-slate-600">{pageJadwal} / {totalPagesJadwal}</div>
                    <button disabled={pageJadwal === totalPagesJadwal} onClick={() => setPageJadwal((p) => p + 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"><i className="fa-solid fa-chevron-right text-[10px]" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB RIWAYAT persis ref */}
      {activeTab === "riwayat" && (
        <div id="tab-riwayat" className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm block">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-blue-600" /> Riwayat Absensi OTS
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Rekam jejak kehadiran dan laporan jam kerja Anda</p>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="lg:w-1/3 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-regular fa-calendar text-blue-500" /></div>
              <select id="filterWaktuRiwayat" value={filterWaktuRiwayat} onChange={(e) => { setFilterWaktuRiwayat(e.target.value); setCustomDateRiwayat(""); setPageRiwayat(1); }} className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                <option value="all">Semua Periode</option>
                <option value="today">Hari Ini</option>
                <option value="last7">7 Hari Ke Belakang</option>
                <option value="last35">35 Hari Ke Belakang</option>
                <option value="custom_single">Tentukan Tanggal</option>
                <option value="custom_range">Kustom Periode</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><i className="fa-solid fa-chevron-down text-slate-400 text-xs" /></div>
            </div>
            {(filterWaktuRiwayat === "custom_single" || filterWaktuRiwayat === "custom_range") && (
              <div id="containerCustomDateRiwayat" className="lg:w-1/4 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-pen-to-square text-amber-500" /></div>
                <input type="text" id="inputCustomDateRiwayat" placeholder="Pilih Tanggal..." defaultValue={customDateRiwayat} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer" />
              </div>
            )}
            <div className="lg:w-1/4 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-layer-group text-blue-500" /></div>
              <select id="kategoriCariRiwayat" value={kategoriRiwayat} onChange={(e) => { setKategoriRiwayat(e.target.value); setPageRiwayat(1); }} className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                <option value="all">Semua Data</option>
                <option value="id_absen">ID Absen</option>
                <option value="id_jadwal">ID Jadwal</option>
                <option value="status">Status</option>
                <option value="cabang">Cabang Studio</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><i className="fa-solid fa-chevron-down text-slate-400 text-xs" /></div>
            </div>
            <div className="lg:flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-magnifying-glass text-slate-400" /></div>
              <input type="text" id="cariRiwayat" value={cariRiwayat} onChange={(e) => { setCariRiwayat(e.target.value); setPageRiwayat(1); }} placeholder="Ketik kata kunci..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setFilterWaktuRiwayat("all"); setKategoriRiwayat("all"); setCariRiwayat(""); setCustomDateRiwayat(""); setPageRiwayat(1); }} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center shadow-sm" title="Reset Filter"><i className="fa-solid fa-filter-circle-xmark" /></button>
              <button onClick={() => loadHistory(monitoredStaff?.id)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center border border-blue-200 shadow-sm" title="Muat Ulang Data"><i className={`fa-solid fa-rotate-right ${historyLoading ? "fa-spin" : ""}`} /></button>
            </div>
          </div>
          {historyLoading ? (
            <div id="loaderRiwayatStaff" className="flex flex-col items-center justify-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-blue-600 text-4xl mb-4" />
              <p className="text-slate-500 font-medium">Menarik Riwayat Absensi...</p>
            </div>
          ) : (
            <div id="containerTabelRiwayatStaff" className="shadow-sm rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-100 z-20 text-center min-w-[50px]">NO</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">ID ABSEN</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[100px] whitespace-nowrap">STATUS</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">WAKTU KERJA</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[100px]">AKSI</th>
                    </tr>
                  </thead>
                  <tbody id="tbodyRiwayatStaff" className="divide-y divide-slate-100 bg-white">
                    {pagedRiwayat.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic font-medium">Tidak ada rekaman absensi pada periode ini.</td></tr>}
                    {pagedRiwayat.map((h, i) => {
                      const idx = (pageRiwayat - 1) * ROWS_RIWAYAT + i;
                      const idAbsen = h.id ?? "-";
                      const idJadwal = h.jadwal?.idJadwal ?? "-";
                      const namaId = `${h.karyawan?.idKaryawan ?? "-"} - ${h.karyawan?.namaLengkap ?? userName}`;
                      const status = h.tipe === "CHECK_OUT" ? "SELESAI" : "AKTIF";
                      const tanggal = formatDateSafe(h.waktu);
                      const cabang = h.jadwal?.cabangStudio ?? "-";
                      const jamAktual = formatTimeSafe(h.waktu);
                      const isTerlambat = /terlambat/i.test(String(h.catatan ?? ""));
                      const keterlambatan = isTerlambat ? (h.catatan ?? "Terlambat") : "-";
                      const waText = `Halo kak, saya mau banding atas keterlambatan absen ${tanggal} dengan ID Absen: ${idAbsen}.\n\nSaya mengalami keterlambatan dikarenakan ...`;
                      const waLink = `https://wa.me/6288211446222?text=${encodeURIComponent(waText)}`;
                      return (
                        <tr key={h.id ?? idx} className="hover:bg-slate-50 transition duration-150 group border-b border-slate-100">
                          <td className="px-4 py-3 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-bold text-slate-500 text-sm">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800 text-sm whitespace-nowrap">{idAbsen}</div>
                            <div className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">ID Jadwal: <span className="font-bold text-blue-500">{idJadwal}</span></div>
                            <div className="text-[11px] font-bold text-slate-600 mt-0.5 whitespace-nowrap">{namaId}</div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle whitespace-nowrap">{statusBadge(status)}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800 text-sm whitespace-nowrap">{tanggal} <span className="text-slate-300 mx-1">|</span> <span className="text-rose-600"><i className="fa-solid fa-location-dot mr-1" />{cabang}</span></div>
                            <div className="text-[11px] font-bold text-emerald-600 mt-1 whitespace-nowrap"><i className="fa-solid fa-clock mr-1" /> {jamAktual}</div>
                            <div className="text-[11px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">Keterlambatan: <span className={`font-bold ${isTerlambat ? "text-red-500" : "text-slate-500"}`}>{keterlambatan}</span></div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            {isTerlambat ? <a href={waLink} target="_blank" rel="noreferrer" className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5 shadow-sm w-fit mx-auto border border-amber-200"><i className="fa-brands fa-whatsapp text-sm" /> Banding</a> : <span className="text-slate-300 font-bold">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPagesRiwayat > 1 && (
                <div id="paginationRiwayat" className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Menampilkan <span className="font-bold text-slate-700">{(pageRiwayat - 1) * ROWS_RIWAYAT + 1}-{Math.min(pageRiwayat * ROWS_RIWAYAT, filteredRiwayat.length)}</span> dari <span className="font-bold text-slate-700">{filteredRiwayat.length}</span> data</div>
                  <div className="flex items-center gap-1">
                    <button disabled={pageRiwayat === 1} onClick={() => setPageRiwayat((p) => p - 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"><i className="fa-solid fa-chevron-left text-[10px]" /></button>
                    <div className="px-2 text-[11px] font-bold text-slate-600">{pageRiwayat} / {totalPagesRiwayat}</div>
                    <button disabled={pageRiwayat === totalPagesRiwayat} onClick={() => setPageRiwayat((p) => p + 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"><i className="fa-solid fa-chevron-right text-[10px]" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center pb-4">
        <p className="text-xs text-slate-400">&copy; 2026 HRIS Potensi Creative. All rights reserved.</p>
      </div>

      {/* MODAL KAMERA persis ref */}
      {cameraOpen && (
        <div id="cameraModal" className="fixed inset-0 bg-slate-900 z-[100] flex flex-col">
          <div className="flex justify-between items-center p-5 bg-black border-b border-slate-800">
            <h3 className="text-white font-bold text-lg"><i className="fa-solid fa-camera text-blue-500 mr-2" /> Kamera Live</h3>
            <button type="button" onClick={closeCamera} className="text-slate-300 hover:text-red-500 transition"><i className="fa-solid fa-xmark text-2xl" /></button>
          </div>
          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden px-4">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-lg h-auto rounded-xl shadow-2xl object-cover border-2 border-slate-800 transform -scale-x-100" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-dashed border-white/30 rounded-full" />
            </div>
          </div>
          <div className="p-6 bg-black flex justify-center pb-12">
            <button type="button" onClick={takeSnapshot} className="w-20 h-20 bg-white rounded-full border-4 border-slate-400 active:scale-95 transition shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-slate-200" />
            </button>
          </div>
        </div>
      )}

      {modalCatatan && (
        <div id="modalCatatanJadwal" className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalCatatan(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><i className="fa-solid fa-comment-dots text-blue-600" /> Detail Catatan Jadwal</h3>
              <button onClick={() => setModalCatatan(null)} className="text-slate-400 hover:text-red-500 transition"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>
            <div className="p-6"><p id="isiModalCatatan" className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium">{modalCatatan}</p></div>
          </div>
        </div>
      )}

      {modalFiles && (
        <div id="modalFileJadwal" className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalFiles(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><i className="fa-solid fa-folder-open text-blue-600" /> Dokumen Lampiran</h3>
              <button onClick={() => setModalFiles(null)} className="text-slate-400 hover:text-red-500 transition"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>
            <div id="isiModalFile" className="p-6 space-y-2.5 max-h-[300px] overflow-y-auto">
              {modalFiles.filter((f) => f.trim() !== "").map((f, i) => (
                <a key={i} href={f.trim().startsWith("http") ? f.trim() : `https://drive.google.com/open?id=${f.trim()}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition group text-sm font-medium text-slate-700 mb-3">
                  <span className="flex items-center gap-2"><i className="fa-solid fa-file-pdf text-red-500 text-sm group-hover:scale-110 transition" /> Dokumen Lampiran #{i + 1}</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-slate-400 group-hover:translate-x-0.5 transition" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
