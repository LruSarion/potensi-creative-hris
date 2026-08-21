import { describe, it, expect } from "vitest";
import {
  computeDurationMinutes,
  computeDurationMinutesOvernightSafe,
  computeWajibHadir,
  computeBatasTerlambat,
  validateTokenJeda,
  computePeriodeBulan,
  validateStudioRoomConflict,
  isTimeOverlapping,
  computeLastSessionEnd,
  resolveTransitionGapMinutes,
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

describe("resolveTransitionGapMinutes — studio/branch transitions", () => {
  const timoho1 = { cabang: "Timoho", nomor: "01" };
  const timoho2 = { cabang: "Timoho", nomor: "02" };
  const berbah1 = { cabang: "Berbah", nomor: "01" };

  it("same studio room -> fastest turnaround (default 15m)", () => {
    expect(resolveTransitionGapMinutes(timoho1, timoho1)).toBe(15);
  });

  it("same branch, different studio -> medium gap (default 20m)", () => {
    expect(resolveTransitionGapMinutes(timoho1, timoho2)).toBe(20);
  });

  it("different branch -> cross-branch travel gap (default 30m)", () => {
    expect(resolveTransitionGapMinutes(timoho1, berbah1)).toBe(30);
  });

  it("respects tenant config overrides", () => {
    const cfg = { sameStudioGapMinutes: 5, sameBranchGapMinutes: 10, crossBranchGapMinutes: 25 };
    expect(resolveTransitionGapMinutes(timoho1, timoho1, cfg)).toBe(5);
    expect(resolveTransitionGapMinutes(timoho1, timoho2, cfg)).toBe(10);
    expect(resolveTransitionGapMinutes(timoho1, berbah1, cfg)).toBe(25);
  });

  it("falls back to restGapMinutes when studio info is missing", () => {
    expect(resolveTransitionGapMinutes(null, { cabang: "Timoho", nomor: "01" }, { restGapMinutes: 45 })).toBe(45);
    expect(resolveTransitionGapMinutes(timoho1, null, { restGapMinutes: 45 })).toBe(45);
  });

  it("treats studio references case-insensitively", () => {
    expect(resolveTransitionGapMinutes({ cabang: "timoho", nomor: "01" }, { cabang: "Timoho", nomor: "01" })).toBe(15);
  });
});

describe("validateTokenJeda — studio-aware transition gaps", () => {
  const timoho1 = { cabang: "Timoho", nomor: "01" };
  const berbah1 = { cabang: "Berbah", nomor: "01" };

  it("allows same-studio turnaround with a short 15m gap", () => {
    // Prior ends 15:30; next starts 15:50 in the same studio (20m gap > 15m) -> OK.
    const prior = { start: d(14, 0), end: d(15, 30), studio: timoho1 };
    expect(validateTokenJeda(d(15, 50), [prior], 30, {}, timoho1)).toBe("BISA_TOKEN");
  });

  it("rejects same-studio booking with less than the 15m turnaround", () => {
    const prior = { start: d(14, 0), end: d(15, 30), studio: timoho1 };
    expect(validateTokenJeda(d(15, 40), [prior], 30, {}, timoho1)).toBe("TIDAK");
  });

  it("requires a longer gap when switching branches (travel time)", () => {
    // Prior ends 15:30 in Timoho; next starts 15:45 in Berbah -> only 15m < 30m travel -> rejected.
    const prior = { start: d(14, 0), end: d(15, 30), studio: timoho1 };
    expect(validateTokenJeda(d(15, 45), [prior], 30, {}, berbah1)).toBe("TIDAK");
    // 31m gap is enough for cross-branch travel.
    expect(validateTokenJeda(d(16, 1), [prior], 30, {}, berbah1)).toBe("BISA_TOKEN");
  });

  it("uses tenant transition config when provided", () => {
    const cfg = { sameStudioGapMinutes: 5, sameBranchGapMinutes: 10, crossBranchGapMinutes: 20 };
    const prior = { start: d(14, 0), end: d(15, 30), studio: timoho1 };
    // 10m gap same studio (>= 5) -> OK with config.
    expect(validateTokenJeda(d(15, 40), [prior], 30, cfg, timoho1)).toBe("BISA_TOKEN");
    // Same 10m gap but cross-branch (needs 20m) -> rejected.
    expect(validateTokenJeda(d(15, 40), [prior], 30, cfg, berbah1)).toBe("TIDAK");
  });
});

describe("computeDurationMinutesOvernightSafe (Lembur time-of-day)", () => {
  it("same-day duration is unchanged", () => {
    expect(computeDurationMinutesOvernightSafe(d(10, 0), d(12, 0))).toBe(120);
  });
  it("overnight lembur end<start adds a day (22:00 -> 02:00 = 4h)", () => {
    expect(computeDurationMinutesOvernightSafe(d(22, 0), d(2, 0))).toBe(240);
  });
  it("cross-midnight 10:16 -> 05:22 = ~19h (the payroll bug case)", () => {
    const start = new Date(2026, 7, 21, 10, 16);
    const end = new Date(2026, 7, 21, 5, 22);
    expect(computeDurationMinutesOvernightSafe(start, end)).toBe(19 * 60 + 6);
  });
  it("never returns negative", () => {
    expect(computeDurationMinutesOvernightSafe(d(23, 0), d(1, 0))).toBeGreaterThan(0);
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
