import { defineConfig, devices } from "@playwright/test";

const production = process.env.PUBLIC_API_PRODUCTION === "1";
const evidenceRun = production ? "production" : "development";

export default defineConfig({
  testDir: "./tests",
  outputDir: `.gstack/evidence/public-api/playwright-output/${evidenceRun}`,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: `.gstack/evidence/public-api/${evidenceRun}.json` }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3192",
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 1100 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 1100 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: production
      ? "corepack pnpm --filter playground exec next start --hostname 127.0.0.1 --port 3192"
      : "corepack pnpm --filter playground exec next dev --hostname 127.0.0.1 --port 3192",
    url: "http://127.0.0.1:3192/workbench",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
