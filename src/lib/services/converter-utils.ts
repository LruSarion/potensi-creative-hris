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

/**
 * Detect the header row index (0-based) from an array of parsed row cells.
 * Skips top title/banner rows (e.g. "PLOTING JADWAL LIVE HARIAN...").
 */
export function findHeaderRowIndex(linesOfCells: string[][]): number {
  if (linesOfCells.length === 0) return 0;

  for (let i = 0; i < Math.min(linesOfCells.length, 10); i++) {
    const cells = linesOfCells[i].map((c) => (c ?? "").toString().trim().toLowerCase());
    const matchCount = cells.filter((c) =>
      /tanggal|tgl|date|name|nama|id|streamer|host|platform|jabatan|email|status|periode|bulan|karyawan|client|brand|jam|studio|promo|produk|nik|role/i.test(c)
    ).length;
    const nonCount = cells.filter(Boolean).length;
    if (matchCount >= 2 || (matchCount >= 1 && nonCount >= 3)) {
      return i;
    }
  }
  return 0;
}

/** Parse CSV text into rows of { header: value }. */
export function parseCsv(csv: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const rawLines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return rows;

  const parsedLines = rawLines.map(parseCsvLine);
  const headerIdx = findHeaderRowIndex(parsedLines);
  const headers = parsedLines[headerIdx].map((h) => h.trim());

  for (let i = headerIdx + 1; i < parsedLines.length; i++) {
    const cells = parsedLines[i];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) {
        row[h] = (cells[idx] ?? "").trim();
      }
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

/** Normalize common Indonesian monetary strings -> number. */
export function normalizeRupiah(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Normalize common date formats -> ISO date string (YYYY-MM-DD). */
export function normalizeDate(v: string | number | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const str = String(v).trim();
  if (!str) return null;

  // 1. Direct YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(str)) {
    const parts = str.split(/[-\/.]/);
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const d = parts[2].slice(0, 2).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmY = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmY) {
    const d = dmY[1].padStart(2, "0");
    const mo = dmY[2].padStart(2, "0");
    const y = dmY[3].length === 2 ? `20${dmY[3]}` : dmY[3];
    return `${y}-${mo}-${d}`;
  }

  // 3. Excel serial date number (e.g. 45524 or "45524")
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial > 1000 && serial < 100000) {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      if (!isNaN(dateInfo.getTime())) {
        return dateInfo.toISOString().slice(0, 10);
      }
    }
  }

  // 4. Indonesian month names (e.g. 22 Agustus 2026, 22 Agt 2026)
  const indoMonths: Record<string, string> = {
    januari: "01", jan: "01",
    februari: "02", feb: "02",
    maret: "03", mar: "03",
    april: "04", apr: "04",
    mei: "05",
    juni: "06", jun: "06",
    juli: "07", jul: "07",
    agustus: "08", agt: "08", agus: "08",
    september: "09", sep: "09", sept: "09",
    oktober: "10", okt: "10",
    november: "11", nov: "11",
    desember: "12", des: "12",
  };
  const indoMatch = str.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (indoMatch) {
    const d = indoMatch[1].padStart(2, "0");
    const monthName = indoMatch[2];
    const y = indoMatch[3];
    const mo = indoMonths[monthName];
    if (mo) return `${y}-${mo}-${d}`;
  }

  // 5. Native JS Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** Clean time strings (e.g. "10:00:00", "10.00", "10:00", "10") -> HH:MM. */
export function cleanTime(t: string | null | undefined, defaultTime = "10:00"): string {
  if (!t) return defaultTime;
  const str = t.trim().replace(".", ":");
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].padStart(2, "0");
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  if (/^\d{1,2}$/.test(str)) {
    return `${str.padStart(2, "0")}:00`;
  }
  return defaultTime;
}

/** Convert an Excel serial date (days since 1899-12-30) to YYYY-MM-DD. */
export function excelSerialToDate(serial: number): string | null {
  if (!isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Convert an Excel serial time (fraction of a day) to HH:MM. */
export function excelSerialToTime(serial: number): string | null {
  if (!isFinite(serial) || serial < 0 || serial >= 1) return null;
  const totalMin = Math.round(serial * 24 * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Normalize a cell that may be an Excel serial date/time or a plain string. */
export function normalizeExcelCell(v: string, kind: "date" | "time"): string {
  const t = v.trim();
  if (!t) return "";
  const n = Number(t);
  if (isFinite(n)) {
    if (kind === "date") return excelSerialToDate(n) ?? t;
    return excelSerialToTime(n) ?? t;
  }
  return t;
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
