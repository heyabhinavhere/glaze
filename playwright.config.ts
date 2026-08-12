import { defineConfig, devices } from "@playwright/test";

const useProductionBuild = process.env.M1_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests",
  outputDir: ".gstack/evidence/gate-1/playwright-output",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:3173",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2 },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], deviceScaleFactor: 2 },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: useProductionBuild
      ? "corepack pnpm --filter playground exec next start --port 3173"
      : "corepack pnpm --filter playground exec next dev --port 3173",
    url: "http://127.0.0.1:3173/m1",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
