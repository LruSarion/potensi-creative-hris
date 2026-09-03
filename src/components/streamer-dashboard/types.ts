// Shared types for the streamer dashboard page and its per-tab components.
// Extracted from page.tsx during refactor — shapes unchanged.

export type ActiveSession = {
  id: string;
  waktu: string;
  jadwalId?: string | null;
  jadwal?: Jadwal | null;
};

/** Karyawan stub nested in absensi/jadwal payloads (subset used by UI). */
export type KaryawanStub = {
  namaLengkap?: string | null;
  idKaryawan?: string | null;
};

/** Jadwal row as returned by the `terbatas` view (jeda terbatas list). */
export type JedaJadwal = Jadwal & {
  streamerKaryawan?: KaryawanStub | null;
};

/** Absensi row (with nested jadwal/karyawan) as returned by the `terbatas` view (perlu lapor list). */
export type PerluLaporItem = {
  id?: string;
  idAbsen?: string | null;
  jadwal?: JedaJadwal | null;
  karyawan?: KaryawanStub | null;
};

/** Form state prepared by siapkanFormKhusus for the special-attendance form. */
export type SelectedTerbatasJadwal = {
  id: string;
  idJadwal: string;
  platform: string;
  clientName: string;
  tanggal: string;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  streamerName: string;
  streamerId: string;
  idAbsen: string;
  tipeForm: "PULANG_TELAT" | "MASUK_PULANG_TERBATAS";
};

export type TerbatasData = { jedaTerbatas: JedaJadwal[]; perluLapor: PerluLaporItem[] };

/** Leave/shift request status from getStreamerRequestStatus (view=request-status). */
export type RequestStatusData = {
  allowLiburRequest?: boolean;
  allowShiftRequest?: boolean;
  defaultKuotaLibur?: number;
  defaultKuotaShift?: number;
  sisaKuotaLibur?: number;
  sisaKuotaShift?: number;
  leaveRequests: {
    id: string;
    tanggalMulai: string;
    alasan?: string | null;
    status: string;
  }[];
  shiftRequests: {
    id: string;
    tanggalMulai: string;
    jenis?: string | null;
    alasan?: string | null;
    status: string;
  }[];
  activeJadwal: {
    id: string;
    idJadwal: string;
    tanggal: string | Date;
    jamMulaiLive: string | Date;
    jamSelesaiLive: string | Date;
    platform: string | null;
  }[];
};

export type Jadwal = {
  id: string;
  idJadwal: string;
  tanggal: string;
  platform: string | null;
  studio: string | null;
  cabangStudio?: string | null;
  nomorStudio?: string | null;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  status: string;
  liveState: string;
  client?: { namaClient: string } | null;
  namaClient?: string | null;
  produk?: { namaProduk: string; sku: string }[];
  absensi?: { reportedGmv: number | null; waktuMasuk: string; waktuKeluar: string | null }[];
};

export type DashboardData = {
  karyawan: {
    namaLengkap: string;
    namaPanggilan: string | null;
    kontrakType: string | null;
    endDate: string | null;
    tags: string | null;
    fotoUrl: string | null;
    idKaryawan?: string | null;
  } | null;
  periode: string;
  totalJam: number;
  totalSesi: number;
  activeTier: { nama: string; ratePerJam: number } | null;
  grossPay: number;
  totalGmv: number;
  totalDenda: number;
  netPay: number;
  kontrakDaysLeft: number | null;
  incidents: {
    id: string;
    title: string;
    category: string | null;
    fineApplied: number;
    createdAt: string;
  }[];
};

export type AbsensiHistory = {
  id: string;
  idAbsen?: string;
  idJadwal?: string;
  status?: string;
  platform?: string;
  clientName?: string;
  tanggal?: string;
  jamMulai?: string;
  jamSelesai?: string;
  durasi?: string;
  cabang?: string;
  studio?: string;
  streamer?: string;
  idHost?: string;
  jamMasuk?: string;
  jamKeluar?: string;
  waktu?: string;
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  telatRaw?: string;
  isTelat?: boolean;
  nominalGmv?: number | null;
  reportedGmv?: number | null;
  buktiDriveId?: string | null;
  fotoMasuk?: string | null;
  lokasiMasuk?: string | null;
  fotoKeluar?: string | null;
  fotoGmv?: string | null;
  lokasiKeluar?: string | null;
  catatan?: string | null;
  rawDate?: string;
  rawTimestamp?: number;
  tipe?: string;
  kategori?: string;
  isTerusan?: boolean;
  jadwal?: {
    idJadwal: string;
    platform: string | null;
    jamMulaiLive?: string | null;
    jamSelesaiLive?: string | null;
    cabangStudio?: string | null;
    nomorStudio?: string | null;
    tanggal?: string | Date | null;
    client?: { namaClient: string } | null;
  } | null;
};

export const STREAMER_TABS = [
  { id: "overview", label: "Daftar & Profil Streamer", icon: "fa-solid fa-users-viewfinder" },
  { id: "checkin", label: "Check In", icon: "fa-solid fa-arrow-right-to-bracket" },
  { id: "checkout", label: "Check Out", icon: "fa-solid fa-arrow-right-from-bracket" },
  { id: "terbatas", label: "Terbatas", icon: "fa-solid fa-bolt" },
  { id: "jadwal", label: "Jadwal", icon: "fa-regular fa-calendar" },
  { id: "request", label: "Request", icon: "fa-solid fa-file-pen" },
  { id: "riwayat", label: "History", icon: "fa-solid fa-clock-rotate-left" },
  { id: "report", label: "Report", icon: "fa-solid fa-chart-pie" },
];