import { findHeaderRowIndex, parseCsv } from "@/lib/services/migration";
import { buildLlmPrompt, detectDelimiter, parsePastedText, normalizeRupiah, normalizeDate, normalizeEnum, cleanTime } from "@/lib/services/converter-utils";

describe("findHeaderRowIndex & parseCsv banner skipping", () => {
  it("skips title banner row on line 1 and uses line 2 as headers", () => {
    const csv = [
      "PLOTING JADWAL LIVE HARIAN (Maksimal 300 baris data),,,,,,,,,,,",
      "ID_JADWAL,TANGGAL,PLATFORM,JAM_MULAI_LIVE,JAM_SELESAI_LIVE,STREAMER",
      "JDW-001,23/08/2026,TikTok,08:00:00,10:00:00,Streamer A",
    ].join("\n");
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      ID_JADWAL: "JDW-001",
      TANGGAL: "23/08/2026",
      PLATFORM: "TikTok",
      JAM_MULAI_LIVE: "08:00:00",
      JAM_SELESAI_LIVE: "10:00:00",
      STREAMER: "Streamer A",
    });
  });
});

describe("detectDelimiter", () => {
  it("detects tab from spreadsheet paste", () => {
    expect(detectDelimiter("Nama\tEmail\tJabatan\nAndi\ta@b.com\tStreamer")).toBe("\t");
  });
  it("detects semicolon", () => {
    expect(detectDelimiter("Nama;Email;Jabatan\nAndi;a@b.com;Streamer")).toBe(";");
  });
  it("defaults to tab for single column", () => {
    expect(detectDelimiter("Nama Lengkap")).toBe("\t");
  });
});

describe("parsePastedText", () => {
  it("parses tab-separated with header", () => {
    const { rows, headers } = parsePastedText("Nama\tEmail\nAndi\ta@b.com\nBudi\tb@b.com");
    expect(headers).toEqual(["Nama", "Email"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Nama: "Andi", Email: "a@b.com" });
  });
  it("skips blank lines", () => {
    const { rows } = parsePastedText("Nama\tEmail\nAndi\ta@b.com\n\n\nBudi\tb@b.com");
    expect(rows).toHaveLength(2);
  });
});

describe("normalizeRupiah", () => {
  it("strips Rp and thousands separators", () => {
    expect(normalizeRupiah("Rp 25.000")).toBe(25000);
  });
  it("handles plain numbers", () => {
    expect(normalizeRupiah("100000")).toBe(100000);
  });
  it("returns null for empty", () => {
    expect(normalizeRupiah("")).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("keeps ISO date", () => {
    expect(normalizeDate("2026-01-08")).toBe("2026-01-08");
  });
  it("converts DD/MM/YYYY", () => {
    expect(normalizeDate("08/01/2026")).toBe("2026-01-08");
  });
  it("converts DD-MM-YY", () => {
    expect(normalizeDate("08-01-26")).toBe("2026-01-08");
  });
});

describe("cleanTime", () => {
  it("normalizes dot format 10.30 -> 10:30", () => {
    expect(cleanTime("10.30")).toBe("10:30");
  });
  it("normalizes HH:MM:SS format 14:00:00 -> 14:00", () => {
    expect(cleanTime("14:00:00")).toBe("14:00");
  });
  it("handles single digit hour 9 -> 09:00", () => {
    expect(cleanTime("9")).toBe("09:00");
  });
  it("returns default value when empty", () => {
    expect(cleanTime("", "10:00")).toBe("10:00");
  });
});

describe("normalizeEnum", () => {
  it("maps gender aliases", () => {
    expect(normalizeEnum("laki-laki", "gender")).toBe("LAKI_LAKI");
    expect(normalizeEnum("Wanita", "gender")).toBe("PEREMPUAN");
  });
  it("maps status aliases (negative first)", () => {
    expect(normalizeEnum("aktif", "status")).toBe("AKTIF");
    expect(normalizeEnum("non aktif", "status")).toBe("NON_AKTIF");
  });
  it("maps absensi tipe", () => {
    expect(normalizeEnum("pulang", "tipeAbsensi")).toBe("CHECK_OUT");
    expect(normalizeEnum("masuk", "tipeAbsensi")).toBe("CHECK_IN");
  });
});

describe("buildLlmPrompt", () => {
  it("includes module fields and raw text", () => {
    const prompt = buildLlmPrompt("karyawan", "Some messy data here");
    expect(prompt).toContain("karyawan");
    expect(prompt).toContain("idKaryawan");
    expect(prompt).toContain("Some messy data here");
    expect(prompt).toContain("rows");
  });
});
