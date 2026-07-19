import { defineConfig, devices } from "@playwright/test";

// Reproduzierbare E2E-Konfiguration.
// - Chromium ist verbindlicher Mindestbrowser.
// - Firefox/WebKit optional über PLAYWRIGHT_ALL_BROWSERS=1.
// - Ohne Test-Supabase laufen nur @public-Tests (siehe e2e/README bzw. E2E_TESTS.md).
const PORT = process.env.E2E_PORT || "3000";
const BASE = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "on-first-retry" : "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PLAYWRIGHT_ALL_BROWSERS
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
  // Startet den Produktionsserver (setzt vorherigen `next build` voraus).
  // Für externe Umgebungen mit E2E_NO_WEBSERVER=1 deaktivierbar.
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: process.env.E2E_WEBSERVER_CMD || "npm run start",
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
