import { describe, it, expect } from "vitest";
import { buildLlmPrompt, detectDelimiter, parsePastedText, normalizeRupiah, normalizeDate, normalizeEnum, excelSerialToDate, excelSerialToTime, normalizeExcelCell } from "@/lib/services/converter-utils";

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

describe("excelSerialToDate", () => {
  it("converts Excel serial date to ISO", () => {
    // 46257 = 2026-08-23 (Excel epoch 1899-12-30)
    expect(excelSerialToDate(46257)).toBe("2026-08-23");
  });
  it("returns null for invalid", () => {
    expect(excelSerialToDate(0)).toBeNull();
    expect(excelSerialToDate(NaN)).toBeNull();
  });
});

describe("excelSerialToTime", () => {
  it("converts Excel serial time fraction to HH:MM", () => {
    // 0.3333... = 08:00
    expect(excelSerialToTime(0.3333333333333333)).toBe("08:00");
    // 0.5 = 12:00
    expect(excelSerialToTime(0.5)).toBe("12:00");
  });
  it("returns null for out-of-range", () => {
    expect(excelSerialToTime(1.5)).toBeNull();
    expect(excelSerialToTime(-0.1)).toBeNull();
  });
});

describe("normalizeExcelCell", () => {
  it("converts serial date cell", () => {
    expect(normalizeExcelCell("46257", "date")).toBe("2026-08-23");
  });
  it("converts serial time cell", () => {
    expect(normalizeExcelCell("0.5", "time")).toBe("12:00");
  });
  it("passes through plain strings", () => {
    expect(normalizeExcelCell("2026-08-21", "date")).toBe("2026-08-21");
    expect(normalizeExcelCell("08:00", "time")).toBe("08:00");
  });
  it("returns empty for blank", () => {
    expect(normalizeExcelCell("", "date")).toBe("");
  });
});
