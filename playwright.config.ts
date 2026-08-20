import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for the HRIS Potensi Creative platform.
 * - Runs against the production server at localhost:3000 (next start).
 * - Uses the system-installed Chromium (no extra browser download needed).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // serial DB state per test
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
