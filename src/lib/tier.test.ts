import { describe, it, expect } from "vitest";
import { matchTier } from "@/lib/tier";

const bands = [
  { tier: "Basic", jamMinimal: 1, jamMaksimal: 80, ratePerJam: 25000 },
  { tier: "Standard", jamMinimal: 81, jamMaksimal: 120, ratePerJam: 27500 },
  { tier: "Optimal", jamMinimal: 121, jamMaksimal: 155, ratePerJam: 28500 },
  { tier: "Advance", jamMinimal: 156, jamMaksimal: 208, ratePerJam: 30000 },
  { tier: "High Performer", jamMinimal: 209, jamMaksimal: 999, ratePerJam: 35000 },
];

describe("matchTier", () => {
  it("matches Basic at lower boundary (80h)", () => {
    expect(matchTier(bands, 80)?.tier).toBe("Basic");
  });
  it("matches Standard at 100h", () => {
    expect(matchTier(bands, 100)?.tier).toBe("Standard");
  });
  it("matches Advance at 160h", () => {
    expect(matchTier(bands, 160)?.tier).toBe("Advance");
  });
  it("matches High Performer at 209h", () => {
    expect(matchTier(bands, 209)?.tier).toBe("High Performer");
  });
  it("returns null below minimum (0h)", () => {
    expect(matchTier(bands, 0)).toBeNull();
  });
  it("returns correct rate", () => {
    expect(matchTier(bands, 100)?.ratePerJam).toBe(27500);
  });
  it("Optimal exists between 121-155h and Advance between 156-208h", () => {
    expect(matchTier(bands, 121)?.tier).toBe("Optimal");
    expect(matchTier(bands, 155)?.tier).toBe("Optimal");
    expect(matchTier(bands, 156)?.tier).toBe("Advance");
    expect(matchTier(bands, 208)?.tier).toBe("Advance");
  });
  it("High Performer rate is correct at upper range", () => {
    expect(matchTier(bands, 500)?.ratePerJam).toBe(35000);
  });
  it("does not match above the max band", () => {
    expect(matchTier(bands, 1000)).toBeNull();
  });
});
