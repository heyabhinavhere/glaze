import { defineConfig, devices } from "@playwright/test";

const packedConsumerRoot = process.env.V1_PACKED_CONSUMER_ROOT;

export default defineConfig({
  testDir: "./tests/consumers",
  outputDir: ".gstack/evidence/v1/consumer-output",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: [
    {
      command: packedConsumerRoot
        ? `corepack pnpm@9.15.9 --dir ${packedConsumerRoot}/react-vite exec vite preview --host 127.0.0.1 --port 3183`
        : "corepack pnpm --filter @glazelab/example-react-vite exec vite preview --host 127.0.0.1 --port 3183",
      url: "http://127.0.0.1:3183",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: packedConsumerRoot
        ? `corepack pnpm@9.15.9 --dir ${packedConsumerRoot}/next-app exec next start -H 127.0.0.1 -p 3184`
        : "corepack pnpm --filter @glazelab/example-next-app exec next start -H 127.0.0.1 -p 3184",
      url: "http://127.0.0.1:3184",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
