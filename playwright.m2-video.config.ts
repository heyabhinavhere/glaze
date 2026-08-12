import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const production = process.env.M2_PRODUCTION === "1";
const evidenceRun = production ? "production" : "development";
const evidenceRoot = ".gstack/evidence/gate-2/m2-explicit-video-nextjs";

export default defineConfig({
  ...baseConfig,
  outputDir: `${evidenceRoot}/playwright-output/${evidenceRun}`,
  reporter: [
    ["line"],
    ["json", { outputFile: `${evidenceRoot}/reports/${evidenceRun}.json` }],
  ],
  use: {
    ...baseConfig.use,
    screenshot: "only-on-failure",
    trace: "on",
  },
  webServer: {
    command: production
      ? "corepack pnpm --filter playground exec next start --port 3173"
      : "corepack pnpm --filter playground exec next dev --port 3173",
    url: "http://127.0.0.1:3173/m2/video",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
