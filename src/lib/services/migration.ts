import { z } from "zod";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { createJadwalBatch } from "@/lib/services/jadwal";
import { karyawanSchema } from "@/lib/schemas/karyawan";
import type { Role } from "@/generated/prisma/enums";

const IMPORT_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"];

/**
 * Data migration wizard backend.
 * Accepts CSV or Excel (xlsx/xls) and imports into the chosen module.
 * Non-tech friendly: parse file -> preview rows -> auto-map common columns -> import.
 */

/** Parse CSV text into rows of { header: value }. */
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

/**
 * Parse file content into rows. Supports CSV text or Excel (xlsx/xls).
 * `fileContent` is a base64-encoded buffer for Excel, or raw CSV string.
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
  const wb = XLSX.read(fileContent, { type: "base64" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const rows = jsonRows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v).trim()]))
  );
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { rows, headers, sheetName };
}

// ---------- MODULE IMPORTERS ----------

/** Generic column matcher: map a required field to a best-guess header. */
function pick(headerAliases: string[], row: Record<string, string>): string | undefined {
  for (const alias of headerAliases) {
    const found = Object.keys(row).find((h) => h.trim().toLowerCase() === alias.toLowerCase());
    if (found) return row[found];
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
  for (const r of rows) {
    try {
      const input = karyawanSchema.parse({
        idKaryawan: pickKaryawan.idKaryawan(r) ?? "",
        namaLengkap: pickKaryawan.namaLengkap(r) ?? "",
        namaPanggilan: pickKaryawan.namaPanggilan(r) ?? null,
        gender: pickKaryawan.gender(r) ?? null,
        jabatan: pickKaryawan.jabatan(r) ?? null,
        kategori: pickKaryawan.kategori(r) ?? null,
        tipeJadwal: pickKaryawan.tipeJadwal(r) ?? null,
        nomorTelepon: pickKaryawan.nomorTelepon(r) ?? null,
        email: pickKaryawan.email(r) ?? null,
        startDate: pickKaryawan.startDate(r) ?? null,
        statusAktif: pickKaryawan.statusAktif(r) ?? "AKTIF",
        namaBank: pickKaryawan.namaBank(r) ?? null,
        nomorRekening: pickKaryawan.nomorRekening(r) ?? null,
        namaPemilikRek: pickKaryawan.namaPemilikRek(r) ?? null,
      });
      // Build a Prisma-typed data object (Zod's parsed enum types don't always
      // match Prisma's input types when spread directly).
      const data = {
        idKaryawan: input.idKaryawan,
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
      const existing = await db.karyawan.findFirst({ where: { idKaryawan: input.idKaryawan } });
      if (existing) {
        await db.karyawan.update({ where: { id: existing.id }, data });
      } else {
        await db.karyawan.create({ data: { ...data, tenantId: user.tenantId || undefined } });
      }
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Baris ${imported + skipped}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors: errors.slice(0, 20) };
}

export async function importJadwalRows(rows: Record<string, string>[]) {
  const user = await requireRole(...IMPORT_ROLES);
  const inputRows: z.infer<typeof jadwalImportSchema>[] = [];
  for (const r of rows) {
    const idJadwal = pick(["id jadwal", "idjadwal", "id_jadwal"], r) ?? "";
    const tanggal = pick(["tanggal", "date", "tgl"], r) ?? "";
    const platform = pick(["platform", "marketplace", "e-commerce"], r) ?? "";
    const cabang = pick(["cabang studio", "cabang", "studio"], r) ?? "";
    const nomor = pick(["nomor studio", "no studio", "nomor_studio"], r) ?? "";
    const mulai = pick(["jam mulai", "jam mulai live", "jam_mulai_live", "start"], r) ?? "10:00";
    const selesai = pick(["jam selesai", "jam selesai live", "jam_selesai_live", "end"], r) ?? "12:00";
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
  for (const row of inputRows) {
    if (!row.idJadwal || !row.tanggal) continue;
    let streamerKaryawanId: string | null = null;
    if (row.streamer) {
      const k = await db.karyawan.findFirst({ where: { OR: [{ idKaryawan: row.streamer }, { namaLengkap: { contains: row.streamer } }] } });
      streamerKaryawanId = k?.id ?? null;
    }
    const start = new Date(`${row.tanggal}T${row.mulai}`);
    const end = new Date(`${row.tanggal}T${row.selesai}`);
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
  const created = await createJadwalBatch(jadwalInputs);
  return { imported: created.length, skipped: jadwalInputs.length - created.length, errors: [] };
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
export async function runMigration(params: { module: string; fileContent: string; fileName: string }) {
  const parsed = parseImportFile(params.fileContent, params.fileName);
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

/** Preview: parse file + return headers + first N rows (no DB write). */
export function previewMigration(params: { fileContent: string; fileName: string }) {
  const parsed = parseImportFile(params.fileContent, params.fileName);
  return {
    sheetName: parsed.sheetName ?? null,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    preview: parsed.rows.slice(0, 5),
  };
}
