import { defineConfig, devices } from "@playwright/test";

/**
 * By default this boots a local `next dev` server and runs against it - set E2E_BASE_URL to point at an
 * already-running instance (a deployed environment, or a server you're already running) instead, in which case
 * the local webServer is skipped entirely.
 */
// Next.js 16's dev server blocks cross-origin webpack-hmr WebSocket connections by default, and treats
// 127.0.0.1 as cross-origin from localhost - using 127.0.0.1 here silently breaks client-side hydration (the
// page looks fine but nothing is interactive: forms fall back to native HTML submission). Use "localhost".
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";
const usingExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Firebase Auth's web SDK persists sessions via IndexedDB, which Playwright's storageState() doesn't reliably
  // snapshot (it's built around cookies/localStorage) - so each test signs in for real instead of reusing a
  // saved session. Cheap to run serially given the suite's small size; keeps things simple and correct rather
  // than fighting IndexedDB storageState support.
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: usingExternalServer
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
