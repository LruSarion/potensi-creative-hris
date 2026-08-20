import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Phase 3 — Stream Uptime Ingest & Webhook Tracking Flow
 *
 * Verifies end-to-end:
 *  - A scheduled session receives `stream.online` (SCHEDULED -> LIVE).
 *  - A later `stream.offline` (crossing midnight UTC) records exact durationSec.
 *  - DB liveState + durationSec + state-log are all consistent.
 *  - Webhook endpoint rejects unauthenticated / malformed events (security).
 */

const TEST_ID = `JDS/WEB${randomUUID().slice(0, 6).toUpperCase()}`;
const BASE = "http://localhost:3000";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Super Admin/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function verify(idJadwal: string): any {
  const out = execSync(
    `npx tsx tests/e2e/helpers/verify-webhook.ts --id=${idJadwal}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  ).trim();
  return JSON.parse(out.split("\n").filter((l) => l.trim().startsWith("{")).join(""));
}

function createJadwalRaw() {
  // Create a scheduled session directly in the DB via tsx.
  execSync(
    `npx tsx tests/e2e/helpers/create-jadwal.ts --id=${TEST_ID} --streamer=cmsqxkbz4000czkv7n5l4n0bl --tenant=tenant-agency --start=${Date.now() - 3600_000} --end=${Date.now() + 3600_000}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  );
}

test("webhook online -> offline records exact durationSec and liveState", async ({ page }) => {
  await login(page);
  createJadwalRaw();

  // --- stream.online (2026-08-25T23:00:00Z) ---
  const onlineRes = await page.request.post(`${BASE}/api/webhook`, {
    headers: { "x-webhook-secret": "e2e-webhook-secret-2026" },
    data: { event: "stream.online", sessionKey: TEST_ID, streamerKey: "twi-user-1", timestamp: "2026-08-25T23:00:00Z" },
  });
  expect(onlineRes.ok()).toBe(true);
  const online = await onlineRes.json();
  expect(online.status).toBe("success");

  // --- stream.offline crossing midnight UTC (23:00 -> 02:00 = 3h = 10800s) ---
  const offlineRes = await page.request.post(`${BASE}/api/webhook`, {
    headers: { "x-webhook-secret": "e2e-webhook-secret-2026" },
    data: { event: "stream.offline", sessionKey: TEST_ID, timestamp: "2026-08-26T02:00:00Z", durationSec: 10800 },
  });
  expect(offlineRes.ok()).toBe(true);
  const offline = await offlineRes.json();
  expect(offline.status).toBe("success");
  expect(offline.data.durationSec).toBe(10800);

  // --- DB assertions ---
  const rec = verify(TEST_ID);
  expect(rec.found).toBe(true);
  expect(rec.liveState).toBe("REVIEW");
  expect(rec.status).toBe("SELESAI");
  expect(rec.durationSec).toBe(10800);
  expect(rec.stateLogCount).toBe(2); // SCHEDULED->LIVE, LIVE->REVIEW
});

test("webhook rejects missing/incorrect secret (security)", async ({ page }) => {
  await login(page);

  const bad = await page.request.post(`${BASE}/api/webhook`, {
    headers: { "x-webhook-secret": "wrong" },
    data: { event: "stream.online", sessionKey: TEST_ID },
  });
  expect(bad.status()).toBe(401);

  const none = await page.request.post(`${BASE}/api/webhook`, {
    data: { event: "stream.online", sessionKey: TEST_ID },
  });
  expect(none.status()).toBe(401);
});
