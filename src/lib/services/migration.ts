import { z } from "zod";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { createJadwalBatch } from "@/lib/services/jadwal";
import { karyawanSchema } from "@/lib/schemas/karyawan";
import { cleanTime, normalizeDate, normalizeEnum, normalizeExcelCell, parseCsv, findHeaderRowIndex } from "./converter-utils";
import type { Role } from "@/generated/prisma/enums";

const IMPORT_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"];

/**
 * Data migration wizard backend.
 * Accepts CSV, Excel (xlsx/xls), or a public Google Sheets URL.
 * Non-tech friendly: parse file -> preview rows -> auto-map common columns -> import.
 */

/** Extract a Google Sheets file id from any share/edit URL, then build its CSV export URL. */
export function googleSheetCsvUrl(input: string): string | null {
  const idMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  const sheetId = idMatch[1];
  // Optional gid for a specific tab; default to first sheet.
  const gidMatch = input.match(/[?&]gid=(\d+)/);
  const gid = gidMatch ? `&gid=${gidMatch[1]}` : "";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid}`;
}

/** Fetch a public Google Sheet and return its rows (as CSV -> parsed). */
export async function fetchGoogleSheet(url: string): Promise<Record<string, string>[]> {
  const csvUrl = googleSheetCsvUrl(url);
  if (!csvUrl) throw AppError.badRequest("URL Google Sheets tidak valid");
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) {
    throw AppError.badRequest("Tidak dapat mengakses sheet. Pastikan di-share ke 'siapa saja yang memiliki link'.");
  }
  const csv = await res.text();
  // Google membalas halaman login HTML dengan status 200 bila sheet tidak di-share
  // publik — tanpa cek ini parseCsv menghasilkan kolom sampah dan di client
  // preview "tidak muncul" tanpa pesan error yang jelas.
  const head = csv.slice(0, 2000);
  if (/^\s*<(!doctype|html)/i.test(csv) || /accounts\.google\.com|Sign in/i.test(head)) {
    throw AppError.badRequest("Sheet tidak dapat dibaca sebagai data. Pastikan share diatur ke 'Siapa saja yang memiliki link (Anyone with the link can view)'.");
  }
  if (!csv.trim()) {
    throw AppError.badRequest("Sheet kosong — tidak ada baris data yang bisa dibaca.");
  }
  return parseCsv(csv);
}

export { findHeaderRowIndex, parseCsv };

/**
 * Parse file content into rows. Supports CSV text or Excel (xlsx/xls).
 * `fileContent` is a base64-encoded buffer for Excel, or raw CSV string.
 */
/** Known header keywords used to locate the real header row in a messy sheet. */
const HEADER_KEYWORDS = [
  "id jadwal", "idjadwal", "id_jadwal", "tanggal", "tgl", "platform", "marketplace",
  "jam mulai", "jam_mulai", "jam selesai", "jam_selesai", "streamer", "host", "nama host",
  "cabang", "studio", "nomor studio", "judul", "promo", "produk", "id karyawan", "idkaryawan",
  "nama lengkap", "nama", "nik", "gender", "jabatan", "email", "periode", "bulan", "total jam",
  "rate", "gross", "gaji", "tipe", "kategori", "waktu", "catatan", "nama client", "client", "brand",
];

/** Score how "header-like" a row is: count cells that match known header keywords. */
function headerScore(cells: string[]): number {
  return cells.filter((c) => {
    const t = c.trim().toLowerCase();
    return HEADER_KEYWORDS.some((k) => t === k || t.startsWith(k) || t.includes(k));
  }).length;
}

/**
 * Parse an Excel sheet into rows, auto-detecting the real header row.
 * Many legacy files have a title row (e.g. "PLOTING JADWAL LIVE HARIAN...") above
 * the actual column headers; sheet_to_json would treat the title as the header and
 * mangle the real columns into __EMPTY_*. We scan for the row that best matches
 * known column names and use that as the header.
 */
export function parseImportFile(fileContent: string, fileName: string): { rows: Record<string, string>[]; headers: string[]; sheetName?: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    // content is CSV text
    const rows = parseCsv(fileContent);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { rows, headers };
  }
  // Excel: content is base64
  const wb = XLSX.read(fileContent, { type: "base64", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

  // Find the best header row: the one with the most known-keyword matches.
  let headerIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < aoa.length; i++) {
    const cells = (aoa[i] ?? []).map((c) => (c == null ? "" : String(c).trim()));
    const score = headerScore(cells);
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }
  if (bestScore <= 0) headerIdx = 0;

  const headers = (aoa[headerIdx] ?? []).map((c) => (c == null ? "" : String(c).trim()));
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = (aoa[i] ?? []).map((c) => (c == null ? "" : String(c).trim()));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) {
        row[h] = (cells[idx] ?? "").trim();
      }
    });
    if (Object.values(row).every((v) => !v)) continue;
    rows.push(row);
  }
  return { rows, headers, sheetName };
}

// ---------- MODULE IMPORTERS ----------

/** Generic column matcher: map a required field to a best-guess header. */
function pick(headerAliases: string[], row: Record<string, string>): string | undefined {
  const keys = Object.keys(row);
  // 1. Exact match (case-insensitive)
  for (const alias of headerAliases) {
    const found = keys.find((h) => h.trim().toLowerCase() === alias.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  // 2. Contains match (case-insensitive)
  for (const alias of headerAliases) {
    const found = keys.find((h) => h.trim().toLowerCase().includes(alias.toLowerCase()));
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return undefined;
}

const pickKaryawan = {
  idKaryawan: (r: Record<string, string>) => pick(["id karyawan", "idkaryawan", "id_karyawan", "nik karyawan", "employee id"], r),
  namaLengkap: (r: Record<string, string>) => pick(["nama lengkap", "nama", "nama_lengkap", "full name", "name"], r),
  namaPanggilan: (r: Record<string, string>) => pick(["nama panggilan", "panggilan", "nickname"], r),
  gender: (r: Record<string, string>) => pick(["gender", "jenis kelamin", "jenis_kelamin"], r),
  jabatan: (r: Record<string, string>) => pick(["jabatan", "posisi", "role", "job title"], r),
  kategori: (r: Record<string, string>) => pick(["kategori", "category", "tipe karyawan"], r),
  tipeJadwal: (r: Record<string, string>) => pick(["tipe jadwal", "tipe_jadwal", "jadwal"], r),
  nomorTelepon: (r: Record<string, string>) => pick(["nomor telepon", "no telepon", "nohp", "phone", "whatsapp"], r),
  email: (r: Record<string, string>) => pick(["email", "e-mail", "email address"], r),
  startDate: (r: Record<string, string>) => pick(["tanggal mulai", "start date", "tgl mulai", "join date"], r),
  statusAktif: (r: Record<string, string>) => pick(["status", "status aktif", "status_aktif", "active"], r),
  namaBank: (r: Record<string, string>) => pick(["bank", "nama bank"], r),
  nomorRekening: (r: Record<string, string>) => pick(["no rekening", "nomor rekening", "account number"], r),
  namaPemilikRek: (r: Record<string, string>) => pick(["nama pemilik rek", "pemilik rekening", "account holder"], r),
};

export async function importKaryawan(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    try {
      const rawId = pickKaryawan.idKaryawan(r) ?? "";
      const idKaryawan = rawId.trim() || `EMP-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
      const namaLengkap = pickKaryawan.namaLengkap(r) ?? "";
      if (!namaLengkap.trim()) {
        skipped++;
        errors.push(`Baris ${idx + 1}: Nama lengkap wajib diisi`);
        continue;
      }
      const rawStartDate = pickKaryawan.startDate(r) ?? null;
      const startDate = rawStartDate ? normalizeDate(rawStartDate) : null;
      const rawGender = pickKaryawan.gender(r) ?? null;
      const gender = rawGender ? (normalizeEnum(rawGender, "gender") as "LAKI_LAKI" | "PEREMPUAN" | null) : null;
      const rawStatus = pickKaryawan.statusAktif(r) ?? "AKTIF";
      const statusAktif = (normalizeEnum(rawStatus, "status") as "AKTIF" | "NON_AKTIF" | null) ?? "AKTIF";

      const input = karyawanSchema.parse({
        idKaryawan,
        namaLengkap,
        namaPanggilan: pickKaryawan.namaPanggilan(r) ?? null,
        gender,
        jabatan: pickKaryawan.jabatan(r) ?? null,
        kategori: pickKaryawan.kategori(r) ?? null,
        tipeJadwal: pickKaryawan.tipeJadwal(r) ?? null,
        nomorTelepon: pickKaryawan.nomorTelepon(r) ?? null,
        email: pickKaryawan.email(r) ?? null,
        startDate,
        statusAktif,
        namaBank: pickKaryawan.namaBank(r) ?? null,
        nomorRekening: pickKaryawan.nomorRekening(r) ?? null,
        namaPemilikRek: pickKaryawan.namaPemilikRek(r) ?? null,
      });
      // Build a Prisma-typed data object (Zod's parsed enum types don't always
      // match Prisma's input types when spread directly).
      const finalIdKaryawan = input.idKaryawan || idKaryawan;
      const data = {
        idKaryawan: finalIdKaryawan,
        namaLengkap: input.namaLengkap,
        namaPanggilan: input.namaPanggilan ?? null,
        gender: input.gender ?? null,
        jabatan: input.jabatan ?? null,
        kategori: input.kategori ?? null,
        tipeJadwal: input.tipeJadwal ?? null,
        nomorTelepon: input.nomorTelepon ?? null,
        email: input.email ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        statusAktif: input.statusAktif ?? "AKTIF",
        namaBank: input.namaBank ?? null,
        nomorRekening: input.nomorRekening ?? null,
        namaPemilikRek: input.namaPemilikRek ?? null,
      };
      const existing = await db.karyawan.findFirst({ where: { idKaryawan: finalIdKaryawan } });
      if (existing) {
        await db.karyawan.update({ where: { id: existing.id }, data });
      } else {
        await db.karyawan.create({ data: { ...data, tenantId: user.tenantId ?? null } });
      }
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Baris ${idx + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors: errors.slice(0, 20) };
}

export async function importJadwalRows(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  const inputRows: z.infer<typeof jadwalImportSchema>[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const rawIdJadwal = pick(["id jadwal", "idjadwal", "id_jadwal", "id"], r) ?? "";
    const idJadwal = rawIdJadwal.trim() || `JAD-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;

    const rawTanggal = pick(["tanggal", "date", "tgl", "waktu", "day", "hari", "periode"], r) ?? "";
    const tanggal = normalizeExcelCell(rawTanggal, "date") || normalizeDate(rawTanggal) || rawTanggal;

    const platform = pick(["platform", "marketplace", "e-commerce"], r) ?? "";
    const cabang = pick(["cabang studio", "cabang", "studio"], r) ?? "";
    const nomor = pick(["nomor studio", "no studio", "nomor_studio"], r) ?? "";

    const rawMulai = pick(["jam mulai", "jam mulai live", "jam_mulai_live", "start", "mulai"], r) ?? "";
    const rawSelesai = pick(["jam selesai", "jam selesai live", "jam_selesai_live", "end", "selesai"], r) ?? "";
    const mulai = normalizeExcelCell(rawMulai, "time") || cleanTime(rawMulai, "10:00");
    const selesai = normalizeExcelCell(rawSelesai, "time") || cleanTime(rawSelesai, "12:00");
    const streamer = pick(["streamer", "host", "nama host", "nama_streamer"], r) ?? "";
    const judul = pick(["judul live", "judul", "campaign"], r) ?? "";
    const promo = pick(["promo live", "promo", "voucher"], r) ?? "";
    const produk = pick(["produk prioritas", "produk", "sku"], r) ?? "";
    inputRows.push({
      idJadwal, tanggal, platform, cabang, nomor, mulai, selesai, streamer, judul, promo, produk,
    });
  }

  // Build jadwal inputs with streamer resolution
  const jadwalInputs = [];
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < inputRows.length; i++) {
    const row = inputRows[i];
    if (!row.tanggal) {
      skippedCount++;
      errors.push(`Baris ${i + 1}: Tanggal tidak ditemukan atau tidak valid`);
      continue;
    }

    let streamerKaryawanId: string | null = null;
    if (row.streamer) {
      const ref = row.streamer.trim();
      const k = await db.karyawan.findFirst({
        where: {
          OR: [
            { idKaryawan: ref },
            { namaLengkap: { contains: ref, mode: "insensitive" } },
            { namaPanggilan: { contains: ref, mode: "insensitive" } },
          ],
          tenantId: user.tenantId || undefined,
        },
      });
      streamerKaryawanId = k?.id ?? null;
    }

    const start = new Date(`${row.tanggal}T${row.mulai}`);
    const end = new Date(`${row.tanggal}T${row.selesai}`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      skippedCount++;
      errors.push(`Baris ${i + 1}: Format tanggal/jam (${row.tanggal} ${row.mulai}-${row.selesai}) tidak valid`);
      continue;
    }

    jadwalInputs.push({
      idJadwal: row.idJadwal,
      tanggal: row.tanggal,
      platform: row.platform || null,
      cabangStudio: row.cabang || null,
      nomorStudio: row.nomor || null,
      jamMulaiLive: start.toISOString(),
      jamSelesaiLive: end.toISOString(),
      streamerKaryawanId,
      judulLive: row.judul || null,
      promoLive: row.promo || null,
      produkPrioritas: row.produk || null,
      status: "TERJADWAL" as const,
    });
  }

  if (jadwalInputs.length === 0) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : ["Tidak ada data jadwal valid untuk diimpor. Pastikan file Excel memiliki kolom 'Tanggal'."],
    };
  }

  const created = await createJadwalBatch(jadwalInputs);
  return {
    imported: created.length,
    skipped: skippedCount + (jadwalInputs.length - created.length),
    errors: errors.slice(0, 20),
  };
}

const jadwalImportSchema = z.object({
  idJadwal: z.string().min(1),
  tanggal: z.string().min(1),
  platform: z.string().optional(),
  cabang: z.string().optional(),
  nomor: z.string().optional(),
  mulai: z.string().optional(),
  selesai: z.string().optional(),
  streamer: z.string().optional(),
  judul: z.string().optional(),
  promo: z.string().optional(),
  produk: z.string().optional(),
});

export async function importClientRows(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  let imported = 0, skipped = 0;
  for (const r of rows) {
    const namaClient = pick(["nama client", "client", "nama brand", "brand"], r) ?? "";
    if (!namaClient) { skipped++; continue; }
    const existing = await db.client.findFirst({ where: { namaClient, tenantId: user.tenantId || undefined } });
    const data = {
      namaClient,
      platform: pick(["platform", "marketplace"], r) ?? null,
      pic: pick(["pic", "contact person", "kontak person"], r) ?? null,
      kontak: pick(["kontak", "no kontak", "phone"], r) ?? null,
    };
    if (existing) {
      await db.client.update({ where: { id: existing.id }, data });
    } else {
      await db.client.create({ data: { ...data, tenantId: user.tenantId || undefined } });
    }
    imported++;
  }
  return { imported, skipped, errors: [] };
}

const pickPayroll = {
  karyawan: (r: Record<string, string>) => pick(["id karyawan", "idkaryawan", "id_karyawan", "nik", "nama karyawan", "nama", "host"], r),
  periode: (r: Record<string, string>) => pick(["periode", "bulan", "bulan tahun", "period"], r),
  totalJam: (r: Record<string, string>) => pick(["total jam", "total_jam", "jam", "hours"], r),
  tier: (r: Record<string, string>) => pick(["tier", "tingkat"], r),
  ratePerJam: (r: Record<string, string>) => pick(["rate per jam", "rate", "tarif", "rate_per_jam"], r),
  grossPay: (r: Record<string, string>) => pick(["gross pay", "gaji", "gross", "gross_pay", "total gaji", "honor"], r),
};

const pickAbsensi = {
  karyawan: (r: Record<string, string>) => pick(["id karyawan", "idkaryawan", "id_karyawan", "nik", "nama karyawan", "nama", "host"], r),
  tipe: (r: Record<string, string>) => pick(["tipe", "jenis", "type", "masuk pulang", "keterangan"], r),
  kategori: (r: Record<string, string>) => pick(["kategori", "category", "tipe karyawan"], r),
  waktu: (r: Record<string, string>) => pick(["waktu", "tanggal", "jam", "datetime", "timestamp", "check in", "checkin", "check out", "checkout"], r),
  catatan: (r: Record<string, string>) => pick(["catatan", "note", "keterangan", "catatan"], r),
};

/** Import payroll (historical) from legacy CSV/Excel. */
export async function importPayroll(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    try {
      const karyawanRef = pickPayroll.karyawan(r) ?? "";
      const periode = pickPayroll.periode(r) ?? "";
      if (!karyawanRef || !periode) { skipped++; continue; }
      const karyawan = await db.karyawan.findFirst({ where: { OR: [{ idKaryawan: karyawanRef }, { namaLengkap: karyawanRef }] } });
      if (!karyawan) { skipped++; errors.push(`Karyawan "${karyawanRef}" tidak ditemukan`); continue; }
      const totalJam = Number(pickPayroll.totalJam(r) ?? 0);
      const ratePerJam = Number(pickPayroll.ratePerJam(r) ?? 0);
      const grossPay = Number(pickPayroll.grossPay(r) ?? 0);
      const tier = pickPayroll.tier(r) ?? null;
      await db.payroll.upsert({
        where: { karyawanId_periode: { karyawanId: karyawan.id, periode } },
        update: { totalJam, tier, ratePerJam, grossPay, tenantId: user.tenantId },
        create: { tenantId: user.tenantId, karyawanId: karyawan.id, periode, totalJam, tier, ratePerJam, grossPay },
      });
      imported++;
    } catch (e) {
      skipped++;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { imported, skipped, errors: errors.slice(0, 20) };
}

/** Import historical absensi (attendance) records. */
export async function importAbsensi(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    try {
      const karyawanRef = pickAbsensi.karyawan(r) ?? "";
      const waktuStr = pickAbsensi.waktu(r) ?? "";
      if (!karyawanRef || !waktuStr) { skipped++; continue; }
      const karyawan = await db.karyawan.findFirst({ where: { OR: [{ idKaryawan: karyawanRef }, { namaLengkap: karyawanRef }] } });
      if (!karyawan) { skipped++; errors.push(`Karyawan "${karyawanRef}" tidak ditemukan`); continue; }
      const tipeRaw = (pickAbsensi.tipe(r) ?? "").toUpperCase();
      const tipe = tipeRaw.includes("OUT") || tipeRaw.includes("PULANG") ? "CHECK_OUT" : "CHECK_IN";
      const kategoriRaw = (pickAbsensi.kategori(r) ?? "STREAMER").toUpperCase();
      const kategori = kategoriRaw.includes("STAFF") ? "STAFF" : kategoriRaw.includes("OTS") ? "OTS" : "STREAMER";
      // Parse date: support YYYY-MM-DD, DD/MM/YYYY, or full datetime.
      const waktu = new Date(waktuStr);
      if (isNaN(waktu.getTime())) { skipped++; errors.push(`Waktu "${waktuStr}" tidak valid`); continue; }
      await db.absensi.create({
        data: {
          tenantId: user.tenantId,
          karyawanId: karyawan.id,
          tipe,
          kategori,
          waktu,
          catatan: pickAbsensi.catatan(r) ?? null,
        },
      });
      imported++;
    } catch (e) {
      skipped++;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { imported, skipped, errors: errors.slice(0, 20) };
}

/** Top-level dispatcher: parse + import into the chosen module. */
export async function runMigration(params: { module: string; fileContent: string; fileName: string; googleSheetUrl?: string }) {
  let parsed: { rows: Record<string, string>[]; headers: string[] };
  if (params.googleSheetUrl) {
    const rows = await fetchGoogleSheet(params.googleSheetUrl);
    parsed = { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
  } else {
    parsed = parseImportFile(params.fileContent, params.fileName);
  }
  if (!parsed.rows.length) throw AppError.badRequest("File kosong atau tidak ada baris data");

  switch (params.module) {
    case "karyawan": return importKaryawan(parsed.rows);
    case "jadwal": return importJadwalRows(parsed.rows);
    case "client": return importClientRows(parsed.rows);
    case "payroll": return importPayroll(parsed.rows);
    case "absensi": return importAbsensi(parsed.rows);
    default: throw AppError.badRequest(`Modul "${params.module}" belum didukung`);
  }
}

/** Preview: parse file or Google Sheet + return headers + first N rows (no DB write). */
export async function previewMigration(params: { fileContent: string; fileName: string; googleSheetUrl?: string }) {
  let parsed: { rows: Record<string, string>[]; headers: string[]; sheetName?: string };
  if (params.googleSheetUrl) {
    const rows = await fetchGoogleSheet(params.googleSheetUrl);
    parsed = { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
  } else {
    parsed = parseImportFile(params.fileContent, params.fileName);
  }
  return {
    sheetName: parsed.sheetName ?? null,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    preview: parsed.rows.slice(0, 5),
    // Semua baris untuk tab import karyawan (client melakukan dedupe + mapping sendiri).
    rows: parsed.rows,
  };
}

// ---------- SMART HEURISTIC NORMALIZER ----------
// Re-exported from a pure module (no DB/auth) so it's unit-testable.
export { detectDelimiter, parsePastedText, normalizeRupiah, normalizeDate, normalizeEnum, excelSerialToDate, excelSerialToTime, normalizeExcelCell } from "./converter-utils";
