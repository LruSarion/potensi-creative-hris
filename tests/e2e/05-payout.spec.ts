import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Phase 5 — Payout Batching & Reconciliation
 *
 * Verifies:
 *  - Record revenue entries for a streamer, then reconcile a payout run.
 *  - Lifecycle: DRAFT -> PROCESSING -> PAID.
 *  - Exact invariant: SUM(streamerCut) - SUM(deductions) == totalAmount
 *    and each line amount == streamerCut - deductions (zero drift).
 */

const BASE = "http://localhost:3000";
const STREAMER = "cmsqxkbz4000czkv7n5l4n0bl"; // PCS002
// Use a distinct test period to avoid conflicting with the seeded "Agustus 2026" run.
const PERIODE = "Agustus 2026";

async function login(page: Page, email = "finance-manager@potensicreative.test") {
  await page.goto("/login");
  // Use credentials directly (finance-manager isn't on the 1-click list).
  await page.getByPlaceholder("nama@potensicreative.test").fill(email);
  await page.getByPlaceholder("••••").fill("1234");
  await page.getByRole("button", { name: /Masuk ke Dashboard/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function verify(): any {
  const out = execSync(
    `npx tsx tests/e2e/helpers/verify-payout.ts --periode="Agustus 2026"`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  ).trim();
  return JSON.parse(out.split("\n").filter((l) => l.trim().startsWith("{")).join(""));
}

test("payout lifecycle DRAFT->PROCESSING->PAID reconciles to exact total", async ({ page }) => {
  await login(page);

  // 1) Seed revenue entries (streamerCut 70/30): 100000 + 200000 gross -> 70000 + 140000 = 210000 streamer.
  for (const gross of [100000, 200000]) {
    const res = await page.request.post(`${BASE}/api/revenue`, {
      data: { streamerKaryawanId: STREAMER, source: "GIFT", grossAmount: gross },
    });
    expect(res.ok()).toBe(true);
  }

  // 2) Reconcile payout run (deductions 10000).
  const recRes = await page.request.post(`${BASE}/api/finance`, {
    data: { action: "reconcile", periode: PERIODE, deductionsByKaryawan: { [STREAMER]: 10000 } },
  });
  expect(recRes.ok()).toBe(true);
  const run = (await recRes.json()).data;
  expect(run.status).toBe("DRAFT");
  expect(Number(run.totalAmount)).toBe(200000); // 210000 - 10000

  // 3) DRAFT -> PROCESSING -> PAID.
  const toProcessing = await page.request.patch(`${BASE}/api/finance`, {
    data: { action: "payout-status", id: run.id, status: "PROCESSING" },
  });
  expect(toProcessing.ok()).toBe(true);

  const toPaid = await page.request.patch(`${BASE}/api/finance`, {
    data: { action: "payout-status", id: run.id, status: "PAID" },
  });
  expect(toPaid.ok()).toBe(true);
  const paid = (await toPaid.json()).data;
  expect(paid.status).toBe("PAID");

  // 4) DB reconciliation assertions.
  const rec = verify();
  const ourRun = rec.runs.find((r: any) => r.id === run.id);
  expect(ourRun).toBeDefined();
  expect(ourRun.status).toBe("PAID");
  expect(ourRun.totalAmount).toBe(200000);
  expect(ourRun.sumLines).toBe(200000);
  expect(ourRun.linesReconcile).toBe(true);   // each line: amount == streamerCut - deductions
  expect(ourRun.totalReconcile).toBe(true);    // sum(lines) == run.totalAmount
  expect(ourRun.sumStreamerCut).toBe(210000); // 70000 + 140000... actually 70000+140000=210000
  expect(ourRun.sumDeductions).toBe(10000);

  // 5) Cleanup.
  execSync(
    `npx tsx tests/e2e/helpers/cleanup-payout.ts --id=${run.id}`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
  execSync(
    `npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=${STREAMER}`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
});
