export type NotificationType =
  | "IZIN"
  | "LEMBUR"
  | "APPROVAL"
  | "JADWAL"
  | "ABSENSI"
  | "PAYROLL"
  | "QC_VIOLATION"
  | "LMS"
  | "MARKETPLACE";

export const NOTIFICATION_TYPES: { key: NotificationType; label: string; icon: string }[] = [
  { key: "IZIN", label: "Pengajuan Izin / Cuti", icon: "fa-file-signature" },
  { key: "LEMBUR", label: "Pengajuan Lembur", icon: "fa-clock" },
  { key: "APPROVAL", label: "Persetujuan (Approval)", icon: "fa-check-circle" },
  { key: "JADWAL", label: "Jadwal Live / Perubahan Jadwal", icon: "fa-calendar" },
  { key: "ABSENSI", label: "Absensi / Check-in", icon: "fa-fingerprint" },
  { key: "PAYROLL", label: "Kompensasi & Payroll", icon: "fa-money-bill-wave" },
  { key: "QC_VIOLATION", label: "Pelanggaran QC Live", icon: "fa-shield-halved" },
  { key: "LMS", label: "LMS & Pelatihan", icon: "fa-graduation-cap" },
  { key: "MARKETPLACE", label: "Marketplace & Proyek", icon: "fa-diagram-project" },
];

export function normalizeNotifPrefs(raw: unknown): Record<string, boolean> {
  if (raw && typeof raw === "object") return raw as Record<string, boolean>;
  return {};
}
