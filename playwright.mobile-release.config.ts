import { defineConfig, devices } from "@playwright/test";

const production = process.env.MOBILE_RELEASE_PRODUCTION === "1";
const evidenceRun = production ? "production" : "development";

export default defineConfig({
  testDir: "./tests",
  outputDir: `.gstack/evidence/mobile-release/playwright-output/${evidenceRun}`,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", {
      outputFile: `.gstack/evidence/mobile-release/${evidenceRun}.json`,
    }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3194",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-15-webkit",
      use: { ...devices["iPhone 15"] },
    },
    {
      name: "ipad-gen-7-webkit",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],
  webServer: {
    command: production
      ? "corepack pnpm --filter playground exec next start --hostname 127.0.0.1 --port 3194"
      : "corepack pnpm --filter playground exec next dev --hostname 127.0.0.1 --port 3194",
    url: "http://127.0.0.1:3194/workbench",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
