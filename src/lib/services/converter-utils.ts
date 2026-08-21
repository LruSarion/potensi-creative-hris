/**
 * Pure converter heuristics — no DB/auth imports, fully unit-testable.
 */

/** Detect the delimiter in a pasted text block (tab, semicolon, comma, pipe). */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return "\t";
  const sample = lines[0];
  if (sample.includes("\t")) return "\t";
  if (sample.includes(";")) return ";";
  if (sample.includes("|")) return "|";
  if (sample.includes(",")) return ",";
  return "\t";
}

/** Parse a pasted text block into rows, auto-detecting delimiter + header. */
export function parsePastedText(text: string): { rows: Record<string, string>[]; headers: string[]; detectedDelimiter: string } {
  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], headers: [], detectedDelimiter: delim };

  const split = (line: string) => line.split(delim).map((c) => c.trim());
  const headers = split(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    if (Object.values(row).every((v) => !v)) continue;
    rows.push(row);
  }
  return { rows, headers, detectedDelimiter: delim };
}

/** Normalize common Indonesian monetary strings -> number. */
export function normalizeRupiah(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Normalize common date formats -> ISO date string (YYYY-MM-DD). */
export function normalizeDate(v: string): string | null {
  if (!v) return null;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0"), mo = m[2].padStart(2, "0");
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}

/** Normalize gender/jabatan/tier aliases to canonical values. */
export function normalizeEnum(v: string, kind: "gender" | "status" | "tipeAbsensi"): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (kind === "gender") {
    // Single letters are ambiguous; only map clear words.
    if (t.length === 1) return null;
    if (/laki|pria|male|putra/.test(t)) return "LAKI_LAKI";
    if (/perempuan|wanita|female|putri/.test(t)) return "PEREMPUAN";
    return null;
  }
  if (kind === "status") {
    // Check negatives first ("non aktif" must not match "aktif").
    if (/non|tidak|inactive|resign|berhenti|false|^0$/.test(t)) return "NON_AKTIF";
    if (/aktif|active|true|^1$/.test(t)) return "AKTIF";
    return null;
  }
  if (kind === "tipeAbsensi") {
    if (/out|pulang|keluar/.test(t)) return "CHECK_OUT";
    return "CHECK_IN";
  }
  return null;
}

/** Field schemas per module so the LLM knows what columns to produce. */
export const MODULE_FIELDS: Record<string, string> = {
  karyawan: "idKaryawan, namaLengkap, namaPanggilan, gender (LAKI_LAKI/PEREMPUAN), jabatan, kategori, tipeJadwal (OFFICE_HOURS/SHIFT/LIVE), nomorTelepon, email, startDate (YYYY-MM-DD), statusAktif (AKTIF/NON_AKTIF), namaBank, nomorRekening, namaPemilikRek",
  jadwal: "idJadwal, tanggal (YYYY-MM-DD), platform, jamMulai (HH:MM), jamSelesai (HH:MM), cabangStudio, nomorStudio, streamer, judulLive, promoLive, produkPrioritas",
  client: "namaClient, platform, pic, kontak",
  payroll: "idKaryawan, periode, totalJam, tier, ratePerJam, grossPay",
  absensi: "idKaryawan, tipe (CHECK_IN/CHECK_OUT), waktu (ISO datetime), kategori (STREAMER/STAFF/OTS), catatan",
};

/** Build the LLM extraction prompt for a module from messy raw text. */
export function buildLlmPrompt(module: string, rawText: string): string {
  return [
    `Anda adalah asisten konversi data HRIS. Ubah teks mentah berikut menjadi baris data terstruktur untuk modul "${module}".`,
    "",
    `Kolom yang wajib dihasilkan (sesuai urutan, gunakan nama persis ini): ${MODULE_FIELDS[module] ?? "terserah, ikuti konteks"}`,
    "",
    "Aturan:",
    "- Keluarkan HANYA JSON, tanpa markdown/penjelasan.",
    "- Format: { \"rows\": [ { \"kolom\": \"nilai\" }, ... ] }",
    "- Normalisasi: Rp 25.000 -> 25000; 08/01/2026 -> 2026-01-08; gender/jabatan disesuaikan ke nilai valid.",
    "- Abaikan baris judul/ringkasan/header yang tidak berisi data (mis. 'RANGKUMAN', 'TOTAL', kolom kosong).",
    "- Jika tidak ada data valid, keluarkan { \"rows\": [] }.",
    "",
    "Teks mentah:",
    "```",
    rawText.slice(0, 20000),
    "```",
  ].join("\n");
}
