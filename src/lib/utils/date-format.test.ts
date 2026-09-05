import { describe, it, expect } from "vitest";
import {
  formatDateSafe,
  formatTimeSafe,
  formatTimeOnly,
  formatDateOnly,
  calcDurationHours,
  formatDurationHHMM,
  calcWajibHadir,
  getWajibHadirTime,
} from "./date-format";

describe("date-format utilities", () => {
  it("formatDateSafe formats plain YYYY-MM-DD correctly without timezone shifts", () => {
    const res = formatDateSafe("2026-08-31");
    expect(res).toContain("31");
    expect(res).toContain("2026");
  });

  it("formatDateSafe returns fallback on null/empty", () => {
    expect(formatDateSafe(null)).toBe("–");
    expect(formatDateSafe(undefined, undefined, "-")).toBe("-");
  });

  it("formatTimeSafe formats HH:mm strings", () => {
    expect(formatTimeSafe("10:00")).toBe("10:00");
    expect(formatTimeSafe("9:05")).toBe("09:05");
  });

  it("formatTimeOnly extracts time portion in WIB (Asia/Jakarta)", () => {
    // 14:30 UTC = 21:30 WIB
    expect(formatTimeOnly("2026-08-31T14:30:00.000Z")).toBe("21:30");
    // 18:30 UTC = 01:30 WIB (next day)
    expect(formatTimeOnly("2026-08-31T18:30:00.000Z")).toBe("01:30");
    expect(formatTimeOnly("18:45")).toBe("18:45");
  });

  it("formatDateOnly extracts date portion in WIB (Asia/Jakarta)", () => {
    expect(formatDateOnly("2026-08-31T14:30:00.000Z")).toBe("2026-08-31");
    // 18:30 UTC on 31 Aug is 01:30 on 01 Sep in WIB
    expect(formatDateOnly("2026-08-31T18:30:00.000Z")).toBe("2026-09-01");
    expect(formatDateOnly("2026-08-31")).toBe("2026-08-31");
  });

  it("calcDurationHours calculates duration correctly including overnight", () => {
    expect(calcDurationHours("10:00", "12:00")).toBe("2");
    expect(calcDurationHours("23:00", "07:00")).toBe("8");
    expect(calcDurationHours("10:00", "10:00")).toBe("24");
  });

  it("getWajibHadirTime calculates 15 mins prior", () => {
    expect(getWajibHadirTime("10:00")).toBe("09.45 WIB");
    expect(getWajibHadirTime("00:00")).toBe("23.45 WIB");
  });

  it("formatDurationHHMM formats HH:MM duration", () => {
    expect(formatDurationHHMM("10:00", "12:30")).toBe("02:30");
    expect(formatDurationHHMM("09:00", "11:00")).toBe("02:00");
    expect(formatDurationHHMM("23:00", "01:30")).toBe("02:30");
    expect(formatDurationHHMM("", "12:00")).toBe("–");
    expect(formatDurationHHMM("10:00", "")).toBe("–");
    expect(formatDurationHHMM("10:00", "10:00")).toBe("24:00");
  });
});
