/**
 * Shared type definitions for schedule / jadwal entities.
 */

/** A single schedule form item used across Streamer, OTS, Klien, and Marketplace tabs. */
export interface ScheduleFormItem {
  id: number;
  idJadwal: string;
  tanggal: string;
  platform: string;
  clientId?: string;
  streamerKaryawanId?: string;
  streamerId?: string;
  streamerNama?: string;
  cabangStudio?: string;
  nomorStudio?: string;
  device?: string;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  durasi?: string;
  kuota?: number;
  kuotaHost?: number;
  filePendukungHost?: string;
  catatanHost?: string;
  otsKaryawanId?: string;
  otsId?: string;
  otsNama?: string;
  otsSearch?: string; // ketik-cari OTS (ref: O_CARI_OTS)
  shiftOts?: string;
  filesOts?: string[];
  judulLive?: string;
  promoLive?: string;
  filePendukungOts?: string;
  catatanOts?: string;
  produkPrioritas?: string | string[];
  targetHost?: string | string[];
  blacklistHost?: string | string[];
  catatan?: string;
  isCollapsed?: boolean;
}

/** Crash detection conflict entry. */
export interface CrashConflict {
  type: string;
  form1: number | string;
  form2: number | string;
  info1: string;
  info2: string;
}

/** Modal state for crash verification results. */
export interface CrashModalState {
  isOpen: boolean;
  isSafe: boolean;
  title: string;
  conflicts: CrashConflict[];
}

/** Edit form state for "Rubah Jadwal" tab. */
export interface EditJadwalFormState {
  id: string;
  idJadwal: string;
  tanggal: string;
  platform: string;
  clientId: string;
  streamerKaryawanId: string;
  streamerId: string;
  streamerNama: string;
  cabangStudio: string;
  nomorStudio: string;
  device: string;
  shiftOts?: string;
  jamMulaiLive: string;
  jamSelesaiLive: string;
  otsKaryawanId: string;
  otsId: string;
  otsNama: string;
  judulLive: string;
  promoLive: string;
  catatanHost: string;
  catatanOts: string;
  filePendukungHost?: string;
  filePendukungOts?: string;
  status: string;
}

/** Default values for a new EditJadwalFormState. */
export const EMPTY_EDIT_JADWAL_FORM: EditJadwalFormState = {
  id: "",
  idJadwal: "",
  tanggal: "",
  platform: "",
  clientId: "",
  streamerKaryawanId: "",
  streamerId: "",
  streamerNama: "",
  cabangStudio: "Timoho",
  nomorStudio: "Studio 1",
  device: "Tidak Pakai",
  shiftOts: "",
  jamMulaiLive: "",
  jamSelesaiLive: "",
  otsKaryawanId: "",
  otsId: "",
  otsNama: "",
  judulLive: "",
  promoLive: "",
  catatanHost: "",
  catatanOts: "",
  filePendukungHost: "",
  filePendukungOts: "",
  status: "TERJADWAL",
};

/** Modal state for Split Sesi Klien. */
export interface SplitKlienModalState {
  isOpen: boolean;
  formIdx: number | null;
  numSessions: number;
}

/** Modal state for ketentuan (blacklist / priority editing). */
export interface KetentuanModalState {
  isOpen: boolean;
  platformName: string;
  blacklist: string[];
  priority: string[];
  inputBlacklist: string;
  inputPriority: string;
}

/** Period filter values used across multiple tabs. */
export type PeriodeFilter =
  | "ALL"
  | "TODAY"
  | "PREV_7"
  | "NEXT_7"
  | "PREV_35"
  | "NEXT_35"
  | "EXACT_DATE"
  | "CUSTOM";

/** Main navigation tab identifiers. */
export type MainTabId =
  | "streamer"
  | "ots"
  | "rubah"
  | "klien"
  | "marketplace"
  | "hybrid"
  | "kendali";

/** Klien sub-tab identifiers. */
export type KlienSubTabId =
  | "formulir"
  | "rubah"
  | "ketentuan"
  | "export"
  | "import";

/** Streamer sub-tab identifiers. */
export type StreamerSubTabId = "form" | "info";

/** Hybrid sub-tab identifiers. */
export type HybridSubTabId = "export" | "import";

/** Static platform list. */
export const PLATFORMS = [
  "Bioaqua Shopee",
  "Bioaqua TikTok",
  "Glad2Glow Shopee",
  "Glad2Glow TikTok",
  "Originote Shopee",
  "Originote TikTok",
  "Skintific Shopee",
  "Skintific TikTok",
  "Somethinc Shopee",
  "Somethinc TikTok",
  "Shopee Live",
  "TikTok Shop",
  "Tokopedia Live",
  "Lazada Live",
  "Instagram Live",
];

/** Static studio list. */
export const STUDIOS = [
  { name: "Studio Timoho 1", cabang: "Timoho", no: "01" },
  { name: "Studio Timoho 2", cabang: "Timoho", no: "02" },
  { name: "Studio Berbah 1", cabang: "Berbah", no: "01" },
  { name: "Studio Berbah 2", cabang: "Berbah", no: "02" },
  { name: "Studio Wiyoro 1", cabang: "Wiyoro", no: "01" },
];
