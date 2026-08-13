import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

type AdoptionCase = "dom" | "duplicate" | "webgl" | "optics";

interface AdoptionDiagnostics {
  caseId: AdoptionCase;
  glassCount: number;
  filterCount: number;
  uniqueFilterCount: number;
  duplicateIds: string[];
  semanticButtonCount: number;
  webglUnavailable: boolean;
  webglCanvasDisplay: string | null;
}

interface PerfProbe {
  scheduled: number;
  fired: number;
  longTasks: number;
}

const production = process.env.ADOPTION_PRODUCTION === "1";
const evidenceRun = production ? "production" : "development";
const evidenceRoot = resolve(
  `.gstack/evidence/gate-3/candidate-adoption/${evidenceRun}`,
);

async function installPerfProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const runtimeWindow = window as typeof window & { __adoptionPerf?: PerfProbe };
    runtimeWindow.__adoptionPerf = { scheduled: 0, fired: 0, longTasks: 0 };
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      runtimeWindow.__adoptionPerf!.scheduled += 1;
      return nativeRaf((time) => {
        runtimeWindow.__adoptionPerf!.fired += 1;
        callback(time);
      });
    };
    if (typeof PerformanceObserver !== "undefined") {
      try {
        new PerformanceObserver((entries) => {
          runtimeWindow.__adoptionPerf!.longTasks += entries.getEntries().length;
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // Not every engine implements the longtask entry type.
      }
    }
  });
}

async function openCase(page: Page, caseId: AdoptionCase): Promise<void> {
  await page.goto(`/research/adoption?case=${caseId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('main[data-adoption-shell="server"] h1')).toHaveText(
    "Candidate adoption probe",
  );
  await page.waitForFunction(
    (value) =>
      document.documentElement.dataset.adoptionReady === value &&
      Boolean(window.__glazeAdoption),
    caseId,
  );
}

const diagnostics = (page: Page) =>
  page.evaluate(() => {
    if (!window.__glazeAdoption) {
      throw new Error("Adoption diagnostics are unavailable.");
    }
    return window.__glazeAdoption.getDiagnostics() as AdoptionDiagnostics;
  });

const perf = (page: Page) =>
  page.evaluate(() => {
    const runtimeWindow = window as typeof window & { __adoptionPerf?: PerfProbe };
    if (!runtimeWindow.__adoptionPerf) throw new Error("Performance probe missing.");
    return { ...runtimeWindow.__adoptionPerf };
  });

test("decorative-only DOM lenses survive remount, resize, scroll, and transform", async ({
  context,
  page,
}) => {
  await installPerfProbe(context);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openCase(page, "dom");

  await expect(page.locator('[data-adoption-lens]')).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Today" })).toHaveCount(7);
  const initial = await diagnostics(page);
  expect(initial).toMatchObject({
    caseId: "dom",
    glassCount: 7,
    filterCount: 7,
    uniqueFilterCount: 7,
    duplicateIds: [],
  });

  await page.waitForTimeout(500);
  const settled = await perf(page);
  await page.waitForTimeout(600);
  const idle = await perf(page);
  expect(idle.fired - settled.fired).toBeLessThanOrEqual(2);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    await page.getByRole("button", { name: "Remount lenses" }).click();
  }
  await expect(page.locator('[data-adoption-lens]')).toHaveCount(7);
  const remounted = await diagnostics(page);
  expect(remounted.glassCount).toBe(7);
  expect(remounted.filterCount).toBe(7);
  expect(remounted.uniqueFilterCount).toBe(7);
  expect(remounted.duplicateIds).toEqual([]);

  const beforeResize = await page.getByTestId("safe-lens-1").boundingBox();
  await page.getByRole("button", { name: "Resize suite" }).click();
  const afterResize = await page.getByTestId("safe-lens-1").boundingBox();
  expect(afterResize?.x).not.toBe(beforeResize?.x);
  await page.getByTestId("scroll-frame").evaluate((element) => {
    element.scrollLeft = 240;
  });
  await expect(page.getByText("Transformed inside a scroll container")).toBeVisible();
  expect((await diagnostics(page)).filterCount).toBe(7);
  expect(errors).toEqual([]);
});

test("the broad copy API duplicates IDs and accessible controls unless constrained", async ({
  page,
}) => {
  await openCase(page, "duplicate");
  await expect(page.getByRole("button", { name: "Sensitive action" })).toHaveCount(2);
  await expect(page.locator("#sensitive-action")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Safe action" })).toHaveCount(1);
  const result = await diagnostics(page);
  expect(result.duplicateIds).toContain("sensitive-action");
  expect(result.glassCount).toBe(2);
});

test("the package WebGL path exposes its Strict Mode and continuous-loop boundaries", async ({
  context,
  page,
}) => {
  await installPerfProbe(context);
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await openCase(page, "webgl");

  if (production) {
    await expect(page.getByText("WebGL unavailable")).toHaveCount(0);
    await expect
      .poll(async () => (await diagnostics(page)).webglCanvasDisplay)
      .toBe("block");
    const before = await perf(page);
    await page.waitForTimeout(500);
    const after = await perf(page);
    expect(after.fired - before.fired).toBeGreaterThan(10);
    expect((await diagnostics(page)).webglUnavailable).toBe(false);
  } else {
    await expect(page.getByText("WebGL unavailable")).toBeVisible();
    const result = await diagnostics(page);
    expect(result.webglUnavailable).toBe(true);
    expect(result.webglCanvasDisplay).toBe("none");
    expect(warnings.some((warning) => warning.includes("WebGL renderer unavailable"))).toBe(true);
  }
});

test("@visual records the single controlled dispersion revision", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One evidence engine is sufficient.");
  mkdirSync(evidenceRoot, { recursive: true });
  await openCase(page, "optics");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: resolve(evidenceRoot, "optics-default-vs-dispersion-016.png"),
    fullPage: false,
  });
  await page.locator('[class*="opticsGrid"]').screenshot({
    path: resolve(evidenceRoot, "optics-comparison-crop.png"),
  });
});
