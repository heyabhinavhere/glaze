import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: ".gstack/evidence/optical-kernel/playwright-output",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: ".gstack/evidence/optical-kernel/report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3188",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "corepack pnpm --filter playground exec next dev --hostname 127.0.0.1 --port 3188",
    url: "http://127.0.0.1:3188/optical-kernel",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
