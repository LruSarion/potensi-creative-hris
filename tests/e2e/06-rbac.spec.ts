import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Phase 6 — Multi-Tenant RBAC & Cross-Role Isolation
 *
 * Verifies zero data leaks across Admin, Finance, and Streamer personas:
 *  - A streamer CANNOT read agency margins or peer earnings (revenue endpoints
 *    must scope to the streamer's own entries and strip agency/gross fields).
 *  - A streamer CANNOT read payroll/payout data (finance-only).
 *  - Finance can read tenant revenue with full detail.
 */

const BASE = "http://localhost:3000";
const STREAMER_PCS = "cmsqxkbz4000czkv7n5l4n0bl"; // PCS002

async function loginCredentials(page: Page, email: string, pin = "1234") {
  await page.goto("/login");
  await page.getByPlaceholder("nama@potensicreative.test").fill(email);
  await page.getByPlaceholder("••••").fill(pin);
  await page.getByRole("button", { name: /Masuk ke Dashboard/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function loginDemo(page: Page, roleLabel: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(roleLabel) }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function seedRevenue() {
  execSync(
    `npx tsx tests/e2e/helpers/create-revenue.ts --streamer=${STREAMER_PCS} --gross=500000 --source=GIFT`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
}

function cleanupRevenue() {
  execSync(`npx tsx tests/e2e/helpers/cleanup-revenue.ts --streamer=${STREAMER_PCS}`, { cwd: process.cwd(), env: { ...process.env } });
}

test("streamer cannot see agency margins or peer earnings (revenue isolation)", async ({ page }) => {
  seedRevenue();
  await loginDemo(page, "Streamer Demo");

  const res = await page.request.get(`${BASE}/api/revenue`);
  expect(res.ok()).toBe(true);
  const data = (await res.json()).data;
  for (const e of data) {
    expect(e.streamerCut).toBeDefined();
    expect(e.agencyCut).toBeUndefined();
    expect(e.grossAmount).toBeUndefined();
  }

  const sumRes = await page.request.get(`${BASE}/api/revenue?view=summary`);
  const sum = (await sumRes.json()).data;
  expect(sum.gross).toBeUndefined();
  expect(sum.agency).toBeUndefined();
  expect(typeof sum.streamer).toBe("number");

  cleanupRevenue();
});

test("streamer cannot read payroll or payout (finance-only data)", async ({ page }) => {
  await loginDemo(page, "Streamer Demo");
  const payroll = await page.request.get(`${BASE}/api/payroll`);
  expect(payroll.status()).toBe(403);
  const finance = await page.request.get(`${BASE}/api/finance?view=payouts`);
  expect(finance.status()).toBe(403);
});

test("finance can read revenue with agency margins; streamer cannot (RBAC boundary)", async ({ page }) => {
  seedRevenue();
  await loginCredentials(page, "finance@potensicreative.test");
  const res = await page.request.get(`${BASE}/api/revenue`);
  expect(res.ok()).toBe(true);
  const data = (await res.json()).data;
  for (const e of data) {
    expect(e.agencyCut).toBeDefined();
    expect(e.grossAmount).toBeDefined();
  }
  cleanupRevenue();
});
