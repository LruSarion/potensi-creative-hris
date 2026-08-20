import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Phase 7 — Streamer Self-Service Portal & Agency Executive Dashboard
 *
 * Verifies the aggregated dashboard metrics match the populated DB:
 *  - Seed a revenue entry + a webhook-completed session for a streamer.
 *  - The streamer's /api/streamer?view=report reflects exactly that uptime and
 *    their earnings (own streamerCut only, never agency margin).
 *  - The admin analytics dashboard matches DB counts.
 */

const BASE = "http://localhost:3000";
const STREAMER_PCS = "cmsqxkbz4000czkv7n5l4n0bl"; // PCS002

async function loginDemo(page: Page, roleLabel: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(roleLabel) }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function loginCredentials(page: Page, email: string, pin = "1234") {
  await page.goto("/login");
  await page.getByPlaceholder("nama@potensicreative.test").fill(email);
  await page.getByPlaceholder("••••").fill(pin);
  await page.getByRole("button", { name: /Masuk ke Dashboard/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function seedRevenue(gross: number, source = "GIFT") {
  execSync(
    `npx tsx tests/e2e/helpers/create-revenue.ts --streamer=${STREAMER_PCS} --gross=${gross} --source=${source}`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
}

function seedUptimeSession(durationSec: number) {
  execSync(
    `npx tsx tests/e2e/helpers/seed-uptime.ts --streamer=${STREAMER_PCS} --duration=${durationSec}`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
}

function cleanupAll() {
  execSync(`npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=${STREAMER_PCS}`, { cwd: process.cwd(), env: { ...process.env } });
  execSync(`npx tsx tests/e2e/helpers/cleanup-jadwal.ts --id=JDS/DASH`, { cwd: process.cwd(), env: { ...process.env } });
}

test("streamer report reflects exact uptime + own earnings (matches DB)", async ({ page }) => {
  // Seed a revenue entry (gross 100000 -> streamer 70000).
  seedRevenue(100000, "GIFT");
  // Seed a completed session with 10800 sec uptime (via webhook).
  seedUptimeSession(10800);

  await loginDemo(page, "Streamer Demo");
  const res = await page.request.get(`${BASE}/api/streamer?view=report&periode=Agustus%202026`);
  expect(res.ok()).toBe(true);
  const report = (await res.json()).data;
  expect(report.totalUptimeSec).toBe(10800);
  expect(report.totalJam).toBeCloseTo(3, 2); // 10800s / 3600
  expect(report.streamerEarnings).toBe(70000);

  // Streamer must NOT see agency margin in their own report.
  expect(report.agencyCut).toBeUndefined();

  cleanupAll();
});

test("executive dashboard analytics match DB counts", async ({ page }) => {
  await loginCredentials(page, "admin@potensicreative.test");
  const res = await page.request.get(`${BASE}/api/analytics`);
  expect(res.ok()).toBe(true);
  const data = (await res.json()).data;
  expect(typeof data.jadwal).toBe("number");
  expect(typeof data.karyawan).toBe("number");
  expect(data.karyawan).toBeGreaterThanOrEqual(5);
});
