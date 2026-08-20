import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Phase 1 — Database Layer & Streamer/Agency Onboarding Flow
 *
 * Verifies end-to-end:
 *  - Admin logs in via the Credentials provider (email+PIN).
 *  - Admin onboard a streamer with a CUSTOM commission split (60/40) via the UI.
 *  - UI auto-computes agencyCut = 100 - streamerCut, enforcing sum == 100.
 *  - Persisted Karyawan row has the exact Decimal split (60.00 / 40.00).
 *  - The DB relation (user linkage + tenant scoping) is correct.
 *
 * DB assertions run in a separate `tsx` process (ESM-safe), returning JSON.
 */

const TEST_ID = `PCE2E${randomUUID().slice(0, 8).toUpperCase()}`;
const TEST_EMAIL = `e2e-${TEST_ID.toLowerCase()}@potensicreative.test`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Super Admin/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/** Run the tsx DB verifier and return parsed JSON. */
function verifyDb(idKaryawan: string): any {
  const out = execSync(
    `npx tsx tests/e2e/helpers/verify-onboarding.ts --id=${idKaryawan}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  ).trim();
  const line = out.split("\n").filter((l) => l.trim().startsWith("{")).join("");
  return JSON.parse(line);
}

function cleanupDb(idKaryawan: string) {
  execSync(
    `npx tsx tests/e2e/helpers/cleanup-karyawan.ts --id=${idKaryawan}`,
    { cwd: process.cwd(), env: { ...process.env } }
  );
}

test("onboard a streamer with custom 60/40 split; assert exact DB precision", async ({ page }) => {
  await login(page);
  await page.goto("/input-karyawan");
  await expect(page.getByText("Master Karyawan & Onboarding Talent")).toBeVisible();

  await page.getByLabel("ID Karyawan").fill(TEST_ID);
  await page.getByLabel("Nama Lengkap").fill(`E2E Streamer ${TEST_ID}`);
  await page.getByLabel("Email").fill(TEST_EMAIL);

  // Custom split 60/40.
  await page.getByLabel("Streamer Cut (%)").fill("60");
  await expect(page.getByLabel("Agency Cut (%)")).toHaveValue("40");

  // Sum guard must be silent (60+40 == 100).
  await expect(page.getByText(/harus berjumlah tepat 100/)).toHaveCount(0);

  await page.getByRole("button", { name: /Daftarkan Karyawan Baru/ }).click();
  await expect(page.getByText(/berhasil didaftarkan/)).toBeVisible({ timeout: 10_000 });

  // DB assertions via tsx (ESM-safe).
  const rec = verifyDb(TEST_ID);
  expect(rec.found).toBe(true);
  expect(rec.idKaryawan).toBe(TEST_ID);
  expect(rec.namaLengkap).toBe(`E2E Streamer ${TEST_ID}`);
  expect(rec.email).toBe(TEST_EMAIL);
  expect(rec.kategori).toBe("STREAMER");
  expect(rec.statusAktif).toBe("AKTIF");
  // Tenant scoping.
  expect(rec.tenantId).toBe("tenant-agency");

  // Exact split math with zero drift.
  expect(rec.streamerCutPct).toBeCloseTo(60, 2);
  expect(rec.agencyCutPct).toBeCloseTo(40, 2);
  expect(rec.sum).toBeCloseTo(100, 2);

  // Cleanup the seeded row.
  cleanupDb(TEST_ID);
});

test("split guard: streamer cut 30 auto-sets agency 70 (sum 100)", async ({ page }) => {
  await login(page);
  await page.goto("/input-karyawan");

  await page.getByLabel("Streamer Cut (%)").fill("30");
  await expect(page.getByLabel("Agency Cut (%)")).toHaveValue("70");
  await expect(page.getByText(/harus berjumlah tepat 100/)).toHaveCount(0);
});
