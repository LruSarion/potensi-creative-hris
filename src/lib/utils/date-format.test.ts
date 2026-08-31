import { describe, it, expect } from "vitest";
import {
  formatDateSafe,
  formatTimeSafe,
  formatTimeOnly,
  formatDateOnly,
  calcDurationHours,
  calculateEndTime,
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

  it("formatTimeOnly extracts time portion", () => {
    expect(formatTimeOnly("2026-08-31T14:30:00.000Z")).toBe("14:30");
    expect(formatTimeOnly("18:45")).toBe("18:45");
  });

  it("formatDateOnly extracts date portion", () => {
    expect(formatDateOnly("2026-08-31T14:30:00.000Z")).toBe("2026-08-31");
    expect(formatDateOnly("2026-08-31")).toBe("2026-08-31");
  });

  it("calcDurationHours calculates duration correctly including overnight", () => {
    expect(calcDurationHours("10:00", "12:00")).toBe("2");
    expect(calcDurationHours("23:00", "07:00")).toBe("8");
    expect(calcDurationHours("10:00", "10:00")).toBe("24");
  });

  it("calculateEndTime calculates time + 2 hours", () => {
    expect(calculateEndTime("10:00")).toBe("12:00");
    expect(calculateEndTime("23:00")).toBe("01:00");
  });

  it("getWajibHadirTime calculates 15 mins prior", () => {
    expect(getWajibHadirTime("10:00")).toBe("09.45 WIB");
    expect(getWajibHadirTime("00:00")).toBe("23.45 WIB");
  });
});
