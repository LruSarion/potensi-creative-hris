import { describe, it, expect } from "vitest";
import {
  computeDurationMinutes,
  computeWajibHadir,
  computeBatasTerlambat,
  validateTokenJeda,
  computePeriodeBulan,
  validateStudioRoomConflict,
  isTimeOverlapping,
  computeLastSessionEnd,
} from "@/lib/schedule-rules";

function d(h: number, m = 0): Date {
  return new Date(2026, 4, 10, h, m); // 2026-05-10
}

describe("computeDurationMinutes", () => {
  it("computes same-day duration", () => {
    expect(computeDurationMinutes(d(16, 0), d(18, 0))).toBe(120);
  });
  it("handles overnight (23:00 day10 -> 02:00 day11 = 3h)", () => {
    expect(computeDurationMinutes(new Date(2026, 4, 10, 23, 0), new Date(2026, 4, 11, 2, 0))).toBe(180);
  });
  it("handles midnight boundary (00:00 -> 02:00)", () => {
    expect(computeDurationMinutes(new Date(2026, 4, 11, 0, 0), new Date(2026, 4, 11, 2, 0))).toBe(120);
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

describe("isTimeOverlapping — 24/7 overnight edge cases", () => {
  const d = (day: number, h: number) => new Date(2026, 7, day, h);
  it("same-day overlap", () => {
    expect(isTimeOverlapping(d(25, 10), d(25, 12), d(25, 11), d(25, 13))).toBe(true);
  });
  it("same-day adjacent (no overlap)", () => {
    expect(isTimeOverlapping(d(25, 10), d(25, 12), d(25, 12), d(25, 14))).toBe(false);
  });
  it("overnight 23:00->02:00 overlaps 01:00->03:00 next day", () => {
    expect(isTimeOverlapping(d(25, 23), d(26, 2), d(26, 1), d(26, 3))).toBe(true);
  });
  it("overnight 23:00->02:00 does NOT overlap 03:00->05:00 next day", () => {
    expect(isTimeOverlapping(d(25, 23), d(26, 2), d(26, 3), d(26, 5))).toBe(false);
  });
  it("overnight session does NOT overlap the next night's overnight session", () => {
    expect(isTimeOverlapping(d(25, 23), d(26, 2), d(26, 23), d(27, 2))).toBe(false);
  });
  it("two overnight sessions on the SAME night overlap", () => {
    expect(isTimeOverlapping(d(25, 22), d(26, 1), d(25, 23), d(26, 2))).toBe(true);
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

describe("computeLastSessionEnd (JAM_SELESAI_TERAKHIR)", () => {
  it("returns null for no sessions", () => {
    expect(computeLastSessionEnd([])).toBeNull();
  });

  it("returns the latest end for same-day sessions", () => {
    const end = computeLastSessionEnd([
      { start: d(10, 0), end: d(12, 0) },
      { start: d(14, 0), end: d(16, 0) },
    ]);
    expect(end!.getHours()).toBe(16);
    expect(end!.getMinutes()).toBe(0);
  });

  it("handles an overnight session with an absolute end on the next day", () => {
    // Overnight 23:00 day10 -> 02:00 day11 (end is an absolute datetime on day 11).
    const end = computeLastSessionEnd([
      { start: new Date(2026, 4, 10, 23, 0), end: new Date(2026, 4, 11, 2, 0) },
    ]);
    expect(end!.getDate()).toBe(11);
    expect(end!.getHours()).toBe(2);
  });

  it("picks the max end across sessions (same-day + next-day overnight)", () => {
    const end = computeLastSessionEnd([
      { start: new Date(2026, 4, 10, 14, 0), end: new Date(2026, 4, 10, 16, 0) }, // day 10 16:00
      { start: new Date(2026, 4, 10, 23, 0), end: new Date(2026, 4, 11, 1, 0) }, // day 11 01:00
    ]);
    expect(end!.getDate()).toBe(11);
    expect(end!.getHours()).toBe(1);
  });
});

describe("validateTokenJeda configurable rest gap", () => {
  it("defaults to 30-min gap (existing behavior)", () => {
    const prior = { start: d(14, 0), end: d(15, 30) };
    expect(validateTokenJeda(d(16, 0), [prior])).toBe("TIDAK");
    expect(validateTokenJeda(d(16, 0), [prior], 30)).toBe("TIDAK");
  });

  it("respects a larger custom rest gap", () => {
    // 60-min gap: end 15:30 -> next start must be > 16:30 (inclusive boundary).
    const prior = { start: d(14, 0), end: d(15, 30) };
    expect(validateTokenJeda(d(16, 0), [prior], 60)).toBe("TIDAK"); // only 30m gap
    expect(validateTokenJeda(d(16, 30), [prior], 60)).toBe("TIDAK"); // exactly 60m (inclusive)
    expect(validateTokenJeda(d(16, 31), [prior], 60)).toBe("BISA_TOKEN"); // > 60m
  });

  it("respects a smaller custom rest gap", () => {
    // 10-min gap: end 15:30 -> next start must be > 15:40 (inclusive boundary).
    const prior = { start: d(14, 0), end: d(15, 30) };
    expect(validateTokenJeda(d(15, 40), [prior], 10)).toBe("TIDAK"); // exactly 10m
    expect(validateTokenJeda(d(15, 41), [prior], 10)).toBe("BISA_TOKEN");
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
