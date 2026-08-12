import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const evidenceRun =
  process.env.M1_PRODUCTION === "1" ? "production" : "development";
const evidenceRoot = `.gstack/evidence/gate-1/m1.1-stage-a-revision-1`;

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
});
