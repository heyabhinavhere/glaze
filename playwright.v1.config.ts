import { defineConfig, devices } from "@playwright/test";

const production = process.env.V1_PRODUCTION === "1";
const port = 3182;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/v1",
  outputDir: `.gstack/evidence/v1/playwright-output/${
    production ? "production" : "development"
  }`,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL,
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: production
      ? `corepack pnpm --filter @glazelab/react build && corepack pnpm --filter playground build && corepack pnpm --filter playground exec next start -H 127.0.0.1 -p ${port}`
      : `corepack pnpm --filter @glazelab/react build && corepack pnpm --filter playground exec next dev -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
