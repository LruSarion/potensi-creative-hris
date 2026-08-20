import { describe, it, expect } from "vitest";
import {
  computeDurationMinutes,
  computeWajibHadir,
  computeBatasTerlambat,
  validateTokenJeda,
  computePeriodeBulan,
  validateStudioRoomConflict,
  isTimeOverlapping,
} from "@/lib/schedule-rules";

function d(h: number, m = 0): Date {
  return new Date(2026, 4, 10, h, m); // 2026-05-10
}

describe("computeDurationMinutes", () => {
  it("computes same-day duration", () => {
    expect(computeDurationMinutes(d(16, 0), d(18, 0))).toBe(120);
  });
  it("handles overnight (23:00 -> 02:00 = 3h)", () => {
    expect(computeDurationMinutes(d(23, 0), d(2, 0))).toBe(180);
  });
  it("handles midnight boundary (00:00 -> 02:00)", () => {
    expect(computeDurationMinutes(d(0, 0), d(2, 0))).toBe(120);
  });
});

describe("computeWajibHadir / computeBatasTerlambat", () => {
  it("wajib hadir = start - 25min", () => {
    expect(computeWajibHadir(d(16, 0)).getHours()).toBe(15);
    expect(computeWajibHadir(d(16, 0)).getMinutes()).toBe(35);
  });
  it("batas terlambat = start - 24min", () => {
    expect(computeBatasTerlambat(d(16, 0)).getHours()).toBe(15);
    expect(computeBatasTerlambat(d(16, 0)).getMinutes()).toBe(36);
  });
});

describe("validateTokenJeda", () => {
  it("returns TIDAK when another schedule ends within 30min before start", () => {
    const prior = { start: d(14, 0), end: d(15, 50) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("TIDAK");
  });
  it("returns BISA_TOKEN when gap is >= 30min", () => {
    const prior = { start: d(14, 0), end: d(15, 20) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("BISA_TOKEN");
  });
  it("returns BISA_TOKEN with no other schedules", () => {
    expect(validateTokenJeda(d(16, 0), [])).toBe("BISA_TOKEN");
  });
  it("handles overnight prior schedule end", () => {
    const prior = {
      start: new Date(2026, 4, 10, 23, 0),
      end: new Date(2026, 4, 11, 1, 0),
    };
    expect(validateTokenJeda(new Date(2026, 4, 11, 1, 20), [prior])).toBe("TIDAK");
  });
  it("exact 30min gap is TIDAK (inclusive legacy boundary)", () => {
    const prior = { start: d(14, 0), end: d(15, 30) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("TIDAK");
  });
  it("29min gap is TIDAK (boundary just under)", () => {
    const prior = { start: d(14, 0), end: d(15, 31) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("TIDAK");
  });
  it("only considers schedules within the 30-min pre-window", () => {
    const prior = { start: d(10, 0), end: d(12, 0) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("BISA_TOKEN");
  });
});

describe("validateStudioRoomConflict & isTimeOverlapping", () => {
  it("detects direct time collision in the same room", () => {
    const existing = [
      { studio: "Timoho Studio 1", start: d(14, 0), end: d(16, 0), idJadwal: "JADWAL-001" },
    ];
    const check = validateStudioRoomConflict("Timoho Studio 1", d(15, 0), d(17, 0), existing);
    expect(check.hasConflict).toBe(true);
    expect(check.conflictingJadwal).toBe("JADWAL-001");
  });

  it("permits booking in a different room during the same time", () => {
    const existing = [
      { studio: "Timoho Studio 1", start: d(14, 0), end: d(16, 0), idJadwal: "JADWAL-001" },
    ];
    const check = validateStudioRoomConflict("Timoho Studio 2", d(14, 0), d(16, 0), existing);
    expect(check.hasConflict).toBe(false);
  });

  it("permits consecutive booking in the same room without overlap", () => {
    const existing = [
      { studio: "Timoho Studio 1", start: d(14, 0), end: d(16, 0), idJadwal: "JADWAL-001" },
    ];
    const check = validateStudioRoomConflict("Timoho Studio 1", d(16, 0), d(18, 0), existing);
    expect(check.hasConflict).toBe(false);
  });
});

describe("computePeriodeBulan", () => {
  it("day <= 22 stays in current month", () => {
    expect(computePeriodeBulan(new Date(2026, 4, 15))).toBe("Mei 2026");
  });
  it("day > 22 rolls to next month", () => {
    expect(computePeriodeBulan(new Date(2026, 4, 23))).toBe("Juni 2026");
  });
  it("day 22 boundary stays", () => {
    expect(computePeriodeBulan(new Date(2026, 4, 22))).toBe("Mei 2026");
  });
  it("rolls across year boundary", () => {
    expect(computePeriodeBulan(new Date(2026, 11, 25))).toBe("Januari 2027");
  });
});
