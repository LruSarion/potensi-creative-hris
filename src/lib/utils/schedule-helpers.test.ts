import { describe, it, expect } from "vitest";
import {
  generateNewScheduleId,
  applyShiftOts,
  formatRowItem,
  resolvePlatformClientValue,
  minutesToTime,
  isTimeOverlap,
  calculateEndTime,
} from "./schedule-helpers";

describe("schedule-helpers utilities", () => {
  it("generateNewScheduleId creates matching pattern", () => {
    const id = generateNewScheduleId("STR", "2026-08-31");
    expect(id).toMatch(/^STR\/\d{6}\/\d{3}$/);
  });

  it("applyShiftOts maps known presets", () => {
    expect(applyShiftOts("07:00-15:00")).toEqual({ masuk: "07:00", keluar: "15:00" });
    expect(applyShiftOts("15:00-23:00")).toEqual({ masuk: "15:00", keluar: "23:00" });
    expect(applyShiftOts("23:00-07:00")).toEqual({ masuk: "23:00", keluar: "07:00" });
    expect(applyShiftOts("custom")).toEqual({ masuk: "", keluar: "" });
  });

  it("formatRowItem formats employee item string or object", () => {
    expect(formatRowItem("EMP-1 | Budi")).toBe("EMP-1 | Budi");
    expect(formatRowItem({ idKaryawan: "EMP-2", namaLengkap: "Siti" })).toBe("EMP-2 | Siti");
  });

  it("resolvePlatformClientValue resolves exact and brand matches", () => {
    const options = [
      { label: "Brand A Shopee Live", value: "Brand A Shopee Live", clientId: "c1" },
      { label: "Brand B TikTok Shop", value: "Brand B TikTok Shop", clientId: "c2" },
    ];

    expect(resolvePlatformClientValue({ platform: "Brand A Shopee Live" }, options)).toBe("Brand A Shopee Live");
    expect(resolvePlatformClientValue({ clientId: "c2", platform: "TikTok Shop" }, options)).toBe("Brand B TikTok Shop");
  });

  it("minutesToTime converts minutes to HH:mm", () => {
    expect(minutesToTime(600)).toBe("10:00");
    expect(minutesToTime(750)).toBe("12:30");
  });

  it("isTimeOverlap checks intervals correctly", () => {
    expect(isTimeOverlap("10:00", "12:00", "11:00", "13:00")).toBe(true);
    expect(isTimeOverlap("10:00", "12:00", "12:00", "14:00")).toBe(false);
    expect(isTimeOverlap("10:00", "12:00", "13:00", "15:00")).toBe(false);
  });

  it("calculateEndTime adds offset hours wrapping midnight", () => {
    expect(calculateEndTime("10:00", 2)).toBe("12:00");
    expect(calculateEndTime("23:00", 2)).toBe("01:00");
    expect(calculateEndTime("15:00", 8)).toBe("23:00");
    expect(calculateEndTime("23:00", 8)).toBe("07:00");
    expect(calculateEndTime("", 2)).toBe("");
  });
});
