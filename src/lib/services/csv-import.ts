import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { createJadwalBatch, type JadwalInput } from "@/lib/services/jadwal";
import { computePeriodeBulan } from "@/lib/schedule-rules";
import type { Role } from "@/generated/prisma/enums";

const IMPORT_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

/**
 * CSV import of the client's Google Sheets schedule templates.
 * Supports both sheet structures:
 *   - ID_PLOTING  (detailed): ID_JADWAL,TANGGAL,PLATFORM,JAM_MULAI_LIVE,JAM_SELESAI_LIVE,KUOTA_HOST,CABANG_STUDIO,NOMOR_STUDIO,STREAMER,DEVICE,JUDUL_LIVE,PROMO_LIVE,CATATAN_UNTUK_HOST,FILE_PENDUKUNG_HOST,PRODUK_PRIORITAS
 *   - ID_HYBRID_LIVE (daily ops): TANGGAL,CABANG_STUDIO,NOMOR_STUDIO,PLATFORM,JAM_MULAI_LIVE,DURASI_JAM,STREAMER,...
 *
 * We parse CSV rows into JadwalInput and delegate to the collision-aware batch importer.
 */

/** Parse a CSV string into rows of objects keyed by header. Handles quoted commas. */
export function parseCsv(csv: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = csv.split(/\r?\n/);
  if (lines.length === 0) return rows;

  const headers = parseCsvLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    // Skip fully-empty rows.
    if (Object.values(row).every((v) => !v)) continue;
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Build an ISO datetime from a date (YYYY-MM-DD or DD/MM/YYYY) + time (HH:MM or HH:MM:SS). */
function toIso(d: string, t: string): string {
  const date = d.includes("-") ? d : d.split("/").reverse().join("-");
  return `${date}T${t || "00:00"}`;
}

/** Resolve a streamer's karyawan id from a roster name/id, scoped to the tenant. */
async function resolveStreamer(tenantId: string, streamerRef: string): Promise<string | null> {
  if (!streamerRef) return null;
  const ref = streamerRef.trim();
  const byId = await db.karyawan.findFirst({
    where: { idKaryawan: ref, tenantId },
  });
  if (byId) return byId.id;
  const byName = await db.karyawan.findFirst({
    where: { namaLengkap: { contains: ref, mode: "insensitive" }, tenantId },
  });
  return byName?.id ?? null;
}

/**
 * Import rows in ID_PLOTING (detailed) format.
 */
export async function importPlottingCsv(csv: string): Promise<{ imported: number; skipped: string[] }> {
  const user = await requireRole(...IMPORT_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  const rows = parseCsv(csv);

  const jadwalRows: JadwalInput[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const idJadwal = r["ID_JADWAL"] || r["idJadwal"];
    if (!idJadwal) { skipped.push("row tanpa ID_JADWAL"); continue; }
    const streamerId = await resolveStreamer(user.tenantId, r["STREAMER"] || "");
    jadwalRows.push({
      idJadwal,
      tanggal: r["TANGGAL"] || new Date().toISOString().slice(0, 10),
      platform: r["PLATFORM"] || null,
      cabangStudio: r["CABANG_STUDIO"] || null,
      nomorStudio: r["NOMOR_STUDIO"] || null,
      jamMulaiLive: toIso(r["TANGGAL"], r["JAM_MULAI_LIVE"]),
      jamSelesaiLive: toIso(r["TANGGAL"], r["JAM_SELESAI_LIVE"]),
      streamerKaryawanId: streamerId,
      judulLive: r["JUDUL_LIVE"] || null,
      promoLive: r["PROMO_LIVE"] || null,
      produkPrioritas: r["PRODUK_PRIORITAS"] || null,
      catatanHost: r["CATATAN_UNTUK_HOST"] || null,
      status: "TERJADWAL",
    });
  }

  const created = await createJadwalBatch(jadwalRows);
  return { imported: created.length, skipped };
}

/**
 * Import rows in ID_HYBRID_LIVE (daily ops) format.
 * JAM_SELESAI is derived from JAM_MULAI + DURASI_JAM (MOD(K-J;1)).
 */
export async function importHybridCsv(csv: string): Promise<{ imported: number; skipped: string[] }> {
  const user = await requireRole(...IMPORT_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  const rows = parseCsv(csv);

  const jadwalRows: JadwalInput[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const tanggal = r["TANGGAL"] || "";
    const mulaiRaw = r["JAM_MULAI_LIVE"] || "";
    const durasiRaw = r["DURASI_JAM"] || "";
    if (!tanggal || !mulaiRaw) { skipped.push("baris tanpa tanggal/jam mulai"); continue; }

    // Compute end = start + duration hours (MOD(...,1)), overnight-safe.
    const durasi = parseFloat(durasiRaw) || 0;
    const start = new Date(toIso(tanggal, mulaiRaw));
    const end = new Date(start.getTime() + durasi * 3600 * 1000);

    const idJadwal = r["ID_JADWAL"] || r["idJadwal"] || `H${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).slice(2, 6)}`;
    const streamerId = await resolveStreamer(user.tenantId, r["STREAMER"] || "");

    jadwalRows.push({
      idJadwal,
      tanggal,
      platform: r["PLATFORM"] || null,
      cabangStudio: r["CABANG_STUDIO"] || null,
      nomorStudio: r["NOMOR_STUDIO"] || null,
      jamMulaiLive: start.toISOString(),
      jamSelesaiLive: end.toISOString(),
      streamerKaryawanId: streamerId,
      judulLive: r["JUDUL_LIVE"] || r["CATATAN_UNTUK_HOST"] || null,
      status: "TERJADWAL",
    });
  }

  const created = await createJadwalBatch(jadwalRows);
  return { imported: created.length, skipped };
}

/** Import by format tag. */
export async function importScheduleCsv(format: "ploting" | "hybrid", csv: string) {
  return format === "hybrid" ? importHybridCsv(csv) : importPlottingCsv(csv);
}

