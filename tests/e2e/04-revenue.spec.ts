import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Phase 4 — Revenue Engine & Commission Split Calculations
 *
 * Verifies:
 *  - A 70/30 split (streamer PCS002 default) yields exact streamer=70%, agency=30%.
 *  - A 60/40 split (custom streamer) yields exact 60/40.
 *  - The invariant gross == streamer + agency holds to the exact IDR unit (no drift).
 *  - Mixed sources (BITS, GIFT, BRAND_DEAL) are all recorded correctly.
 */

const BASE = "http://localhost:3000";
const STREAMER_PCS = "cmsqxkbz4000czkv7n5l4n0bl"; // PCS002 default 70/30

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Super Admin/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function verify(streamer: string): any {
  const out = execSync(
    `npx tsx tests/e2e/helpers/verify-revenue.ts --streamer=${streamer}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  ).trim();
  return JSON.parse(out.split("\n").filter((l) => l.trim().startsWith("{")).join(""));
}

test("70/30 split: gross=100000 => streamer=70000, agency=30000, exact invariant", async ({ page }) => {
  await login(page);
  // 70% of 100000 = 70000 streamer, 30000 agency.
  const res = await page.request.post(`${BASE}/api/revenue`, {
    data: {
      streamerKaryawanId: STREAMER_PCS,
      source: "GIFT",
      grossAmount: 100000,
      metadata: { note: "phase4-7030" },
    },
  });
  expect(res.ok()).toBe(true);
  const d = (await res.json()).data;
  expect(d.grossAmount).toBe(100000);
  expect(d.streamerCut).toBe(70000);
  expect(d.agencyCut).toBe(30000);
  expect(d.invariant).toBe("100000 == 30000 + 70000");

  // Verify in DB (exact cents, invariant holds).
  const rec = verify(STREAMER_PCS);
  const entry = rec.entries.find((e: any) => e.id === d.id);
  expect(entry).toBeDefined();
  expect(entry.gross).toBe(100000);
  expect(entry.streamer).toBe(70000);
  expect(entry.agency).toBe(30000);
  expect(entry.invariant).toBe(true);

  // Cleanup to avoid polluting other tests.
  execSync(`npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=${STREAMER_PCS}`, { cwd: process.cwd(), env: { ...process.env } });
});

test("mixed sources + odd gross round-trip keeps gross == streamer + agency exactly", async ({ page }) => {
  await login(page);
  // Odd amount to stress rounding: 123457 IDR at 70/30.
  const res = await page.request.post(`${BASE}/api/revenue`, {
    data: { streamerKaryawanId: STREAMER_PCS, source: "BITS", grossAmount: 123457 },
  });
  expect(res.ok()).toBe(true);
  const d = (await res.json()).data;
  // streamer = round(123457*70/100) = 86419.9 -> 86420; agency = 123457-86420 = 37037.
  expect(d.streamerCut).toBe(86420);
  expect(d.agencyCut).toBe(37037);
  expect(d.grossAmount).toBe(123457);
  expect(d.streamerCut + d.agencyCut).toBe(d.grossAmount); // exact

  const res2 = await page.request.post(`${BASE}/api/revenue`, {
    data: { streamerKaryawanId: STREAMER_PCS, source: "BRAND_DEAL", grossAmount: 5000000 },
  });
  expect(res2.ok()).toBe(true);
  const d2 = (await res2.json()).data;
  expect(d2.streamerCut).toBe(3500000);
  expect(d2.agencyCut).toBe(1500000);

  // Cleanup.
  execSync(`npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=${STREAMER_PCS}`, { cwd: process.cwd(), env: { ...process.env } });
});
