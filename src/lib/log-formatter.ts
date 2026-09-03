/**
 * Utility helper to parse and format raw system activity logs (LogAktivitas)
 * converts raw JSON payloads into clean, human-readable Indonesian text descriptions.
 */
export function formatLogEntry(log: {
  tipeAksi?: string | null;
  detail?: string | null;
  targetSheet?: string | null;
}) {
  let title = log.tipeAksi || "Aktivitas Sistem";
  let description = "";
  let icon = "fa-solid fa-bolt";
  let iconBg = "bg-blue-50 text-blue-600";

  const rawDetail = log.detail?.trim();

  if (!rawDetail) {
    return {
      title,
      description: log.targetSheet ? `Operasi pada data ${log.targetSheet}` : "Aktivitas sistem baru",
      icon,
      iconBg,
    };
  }

  if (rawDetail.startsWith("{") || rawDetail.startsWith("[")) {
    try {
      const data = JSON.parse(rawDetail);

      // Case 1: QC Violation / Notification (has title / message)
      if (data.title || data.message) {
        title = data.title || title;
        description = data.message || "Pelanggaran QC live stream baru.";
        icon = "fa-solid fa-triangle-exclamation";
        iconBg = "bg-rose-50 text-rose-600";
        // Internal routing keys never shown; keep only meaningful extras (e.g. severity, link label)
        const HIDDEN_KEYS = ["title", "message", "link", "type", "targetUserId", "targetKaryawanId", "runId", "lampiranDriveId", "read", "isRead", "readAt", "userId"];
        const extras: string[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (
            v !== null &&
            v !== undefined &&
            v !== "" &&
            !HIDDEN_KEYS.includes(k)
          ) {
            extras.push(`${k}: ${v}`);
          }
        }
        if (extras.length > 0) description = `${description}\n${extras.join(" • ")}`;
      }
      // Case 2: Suara Karyawan / Aspirasi
      else if (data.kategori || data.pesan) {
        title = data.kategori ? `Suara Karyawan: ${data.kategori}` : "Suara Karyawan Baru";
        description = data.pesan ? `"${data.pesan}"` : "Aspirasi karyawan baru diterima.";
        icon = "fa-solid fa-comment-dots";
        iconBg = "bg-indigo-50 text-indigo-600";
      }
      // Case 3: Payroll / Payout Run
      else if (data.periode || data.runId) {
        title = title === "Aktivitas Sistem" ? "Proses Payroll" : title;
        description = `Proses pencairan gaji periode ${data.periode || "Agustus 2026"}`;
        icon = "fa-solid fa-money-bill-wave";
        iconBg = "bg-emerald-50 text-emerald-600";
      }
      // Case 4: Standard Employee / Client / Schedule Data
      else if (data.namaLengkap || data.namaClient || data.idJadwal) {
        title = title === "Aktivitas Sistem" ? "Pembaruan Data" : title;
        description = data.namaLengkap
          ? `Data Karyawan: ${data.namaLengkap}`
          : data.namaClient
          ? `Brand Client: ${data.namaClient}`
          : `Jadwal: ${data.idJadwal}`;
        icon = "fa-solid fa-user-check";
        iconBg = "bg-blue-50 text-blue-600";
      }
      // Case 5: Generic JSON Object - extract clean readable key-values
      else {
        const HIDDEN_KEYS = ["runId", "targetUserId", "targetKaryawanId", "lampiranDriveId", "link", "type", "read", "isRead", "readAt", "userId"];
        const parts: string[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (
            v !== null &&
            v !== undefined &&
            v !== "" &&
            !HIDDEN_KEYS.includes(k)
          ) {
            parts.push(`${k}: ${v}`);
          }
        }
        description = parts.length > 0 ? parts.join(" • ") : rawDetail;
      }
    } catch {
      description = rawDetail;
    }
  } else {
    description = rawDetail;
  }

  // Adjust icons by title keywords
  const titleLower = title.toLowerCase();
  if (titleLower.includes("qc") || titleLower.includes("pelanggaran")) {
    icon = "fa-solid fa-triangle-exclamation";
    iconBg = "bg-rose-50 text-rose-600";
  } else if (titleLower.includes("payroll") || titleLower.includes("gaji") || titleLower.includes("insentif")) {
    icon = "fa-solid fa-money-bill-wave";
    iconBg = "bg-emerald-50 text-emerald-600";
  } else if (titleLower.includes("suara") || titleLower.includes("aspirasi")) {
    icon = "fa-solid fa-comment-dots";
    iconBg = "bg-indigo-50 text-indigo-600";
  } else if (titleLower.includes("jadwal") || titleLower.includes("live")) {
    icon = "fa-solid fa-video";
    iconBg = "bg-amber-50 text-amber-600";
  }

  return { title, description, icon, iconBg };
}
