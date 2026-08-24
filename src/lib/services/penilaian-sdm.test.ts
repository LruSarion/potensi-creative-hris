import { describe, it, expect } from "vitest";

describe("Penilaian SDM 6-Indicator Weighted Formula", () => {
  function computeTotalSkor(scores: {
    productKnowledge: number;
    interaksiPenampilan: number;
    metrikObjektif: number;
    keterampilanImprovisasi: number;
    kemampuanKomunikasi: number;
    professionalism: number;
  }) {
    const bobotTotal =
      scores.productKnowledge * 0.2 +
      scores.interaksiPenampilan * 0.2 +
      scores.metrikObjektif * 0.2 +
      scores.keterampilanImprovisasi * 0.15 +
      scores.kemampuanKomunikasi * 0.15 +
      scores.professionalism * 0.1;
    return Math.round(bobotTotal);
  }

  it("computes 100 for perfect scores across all 6 indicators", () => {
    const total = computeTotalSkor({
      productKnowledge: 100,
      interaksiPenampilan: 100,
      metrikObjektif: 100,
      keterampilanImprovisasi: 100,
      kemampuanKomunikasi: 100,
      professionalism: 100,
    });
    expect(total).toBe(100);
  });

  it("correctly weights different scores according to ref-deploy percentages (20,20,20,15,15,10)", () => {
    // 80*0.2 + 90*0.2 + 70*0.2 + 85*0.15 + 85*0.15 + 90*0.10 = 16 + 18 + 14 + 12.75 + 12.75 + 9 = 82.5 -> 83
    const total = computeTotalSkor({
      productKnowledge: 80,
      interaksiPenampilan: 90,
      metrikObjektif: 70,
      keterampilanImprovisasi: 85,
      kemampuanKomunikasi: 85,
      professionalism: 90,
    });
    expect(total).toBe(83);
  });
});
