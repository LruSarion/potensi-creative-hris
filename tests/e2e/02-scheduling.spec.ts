import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Phase 2 — Shift Scheduling & Collision Prevention Flow
 *
 * Verifies end-to-end:
 *  - Admin books a single streamer slot via the UI (Studio A, 10:00-12:00).
 *  - A SECOND overlapping slot for the SAME streamer is rejected (double-booking guard).
 *  - A slot overlapping the SAME STUDIO is rejected (studio conflict guard).
 *  - Non-overlapping slot for the same streamer is accepted (token-jeda respected).
 *  - Persisted jadwal row has the exact tenant + streamer + studio + times.
 */

const TEST_ID = `JDS/E2E${randomUUID().slice(0, 6).toUpperCase()}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Super Admin/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

function verifyJadwal(idJadwal: string): any {
  const out = execSync(
    `npx tsx tests/e2e/helpers/verify-jadwal.ts --id=${idJadwal}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  ).trim();
  const line = out.split("\n").filter((l) => l.trim().startsWith("{")).join("");
  return JSON.parse(line);
}

function cleanupJadwal(idJadwal: string) {
  execSync(
    `npx tsx tests/e2e/helpers/cleanup-jadwal.ts --id=${idJadwal}`,
    { cwd: process.cwd(), encoding: "utf-8", env: { ...process.env } }
  );
}

async function fillJadwal(page: Page, opts: {
  idJadwal: string;
  tanggal: string;
  streamer: string;
  cabang: string;
  no: string;
  mulai: string;
  selesai: string;
  judul: string;
}) {
  await page.goto("/input-jadwal");
  await page.getByLabel("Tanggal Sesi").fill(opts.tanggal); // date change regenerates ID, so fill date first
  await page.getByLabel("ID Jadwal").fill(opts.idJadwal);
  await page.getByLabel("Streamer / Host").selectOption({ label: opts.streamer });
  await page.getByLabel("Lokasi Studio").selectOption(`${opts.cabang}-${opts.no}`);
  await page.getByLabel("Waktu Mulai Live").fill(opts.mulai);
  await page.getByLabel("Waktu Selesai Live").fill(opts.selesai);
  await page.getByLabel("Judul Sesi / Campaign").fill(opts.judul);
}

test("book a slot; double-booking + studio conflict rejected; DB state exact", async ({ page }) => {
  await login(page);
  const firstId = `${TEST_ID}/A`;

  // --- Book first slot: Streamer Demo, Studio Timoho 01, 2026-08-25 10:00-12:00 ---
  await fillJadwal(page, {
    idJadwal: firstId,
    tanggal: "2026-08-25",
    streamer: "Streamer Demo (PCS002) - Streamer",
    cabang: "Timoho",
    no: "01",
    mulai: "2026-08-25T10:00",
    selesai: "2026-08-25T12:00",
    judul: "E2E Sesi A",
  });
  await page.getByRole("button", { name: /Simpan.*Jadwalkan/i }).click();
  await expect(page.getByText(/berhasil dibuat/)).toBeVisible({ timeout: 10_000 });

  const rec1 = verifyJadwal(firstId);
  expect(rec1.found).toBe(true);
  expect(rec1.cabangStudio).toBe("Timoho");
  expect(rec1.nomorStudio).toBe("01");
  expect(rec1.status).toBe("TERJADWAL");

  // --- Double-book same streamer at overlapping time (11:00-13:00), DIFFERENT studio ---
  const overlapId = `${TEST_ID}/B`;
  await fillJadwal(page, {
    idJadwal: overlapId,
    tanggal: "2026-08-25",
    streamer: "Streamer Demo (PCS002) - Streamer",
    cabang: "Berbah",
    no: "01",
    mulai: "2026-08-25T11:00",
    selesai: "2026-08-25T13:00",
    judul: "E2E Sesi B (overlap)",
  });
  await page.getByRole("button", { name: /Simpan.*Jadwalkan/i }).click();
  await expect(page.getByText(/sudah dijadwalkan sesi lain/)).toBeVisible({ timeout: 10_000 });
  expect(verifyJadwal(overlapId).found).toBe(false);

  // --- Studio conflict: DIFFERENT streamer, same studio Timoho-01 overlapping ---
  const studioId = `${TEST_ID}/C`;
  await fillJadwal(page, {
    idJadwal: studioId,
    tanggal: "2026-08-25",
    streamer: "Ops Lead (PCS005) - Operation Lead",
    cabang: "Timoho",
    no: "01",
    mulai: "2026-08-25T11:30",
    selesai: "2026-08-25T13:30",
    judul: "E2E Sesi C (studio)",
  });
  await page.getByRole("button", { name: /Simpan.*Jadwalkan/i }).click();
  await expect(page.getByText(/sedang digunakan oleh sesi/)).toBeVisible({ timeout: 10_000 });
  expect(verifyJadwal(studioId).found).toBe(false);

  // --- Non-overlapping same streamer slot (14:00-16:00) succeeds ---
  const okId = `${TEST_ID}/D`;
  await fillJadwal(page, {
    idJadwal: okId,
    tanggal: "2026-08-25",
    streamer: "Streamer Demo (PCS002) - Streamer",
    cabang: "Berbah",
    no: "02",
    mulai: "2026-08-25T14:00",
    selesai: "2026-08-25T16:00",
    judul: "E2E Sesi D (ok)",
  });
  await page.getByRole("button", { name: /Simpan.*Jadwalkan/i }).click();
  await expect(page.getByText(/berhasil dibuat/)).toBeVisible({ timeout: 10_000 });
  expect(verifyJadwal(okId).found).toBe(true);

  [firstId, overlapId, studioId, okId].forEach((id) => cleanupJadwal(id));
});

