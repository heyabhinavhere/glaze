import { defineConfig, devices } from "@playwright/test";

const production = process.env.BAKEOFF_PRODUCTION === "1";
const evidenceRun = production ? "production" : "development";
const evidenceRoot = ".gstack/evidence/gate-0-2/engine-bakeoff";

export default defineConfig({
  testDir: "./tests",
  outputDir: `${evidenceRoot}/playwright-output/${evidenceRun}`,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: `${evidenceRoot}/reports/${evidenceRun}.json` }],
  ],
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3273",
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
    command: production
      ? "corepack pnpm --filter playground exec next start --port 3273"
      : "corepack pnpm --filter playground exec next dev --port 3273",
    url: "http://127.0.0.1:3273/research/bakeoff",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
