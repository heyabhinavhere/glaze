import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

type CandidateId = "owned-svg" | "explicit-webgl" | "css-baseline";
type SceneId = "light" | "dark" | "photo" | "text" | "motion";

interface BakeoffDiagnostics {
  route: "research-bakeoff";
  selectedTab: string;
  scene: SceneId;
  focusCandidate: CandidateId | null;
  renderedCandidates: CandidateId[];
  activeRendererCount: number;
  explicitWebgl: null | {
    rendererKind: "webgl" | "css-fallback";
    fallbackReason: string | null;
    activeRendererCount: number;
    renderer: null | {
      active: boolean;
      contextLost: boolean;
      frames: number;
      uploads: number;
      presentedFrameCallbacks: number;
      displacementPx: number;
      materialId: string;
      lightingModelId: string;
    };
  };
}

const evidenceRun =
  process.env.BAKEOFF_PRODUCTION === "1" ? "production" : "development";
const evidenceRoot = resolve(
  `.gstack/evidence/gate-0-2/engine-bakeoff/${evidenceRun}`,
);

const diagnostics = (page: Page) =>
  page.evaluate(() => {
    const boundary = (
      window as typeof window & {
        __glazeBakeoff?: { getDiagnostics: () => BakeoffDiagnostics };
      }
    ).__glazeBakeoff;
    if (!boundary) throw new Error("Bake-off diagnostics are unavailable.");
    return boundary.getDiagnostics();
  });

async function waitForBakeoff(page: Page): Promise<void> {
  await expect(page.locator('main[data-bakeoff-shell="server"] h1')).toHaveText(
    "Engine bake-off",
  );
  await page.waitForFunction(() => Boolean(window.__glazeBakeoff));
}

async function openBakeoff(
  page: Page,
  path = "/research/bakeoff",
): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForBakeoff(page);
}

test("SSR shell hydrates without changing the semantic control tree", async ({
  browser,
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openBakeoff(page);

  const response = await request.get("/research/bakeoff?scene=text");
  const html = await response.text();
  expect(response.ok()).toBe(true);
  expect(html).toContain('data-bakeoff-shell="server"');
  expect(html).toContain('data-renderer="css-fallback"');
  expect(html).toContain('data-optics="package-default"');
  expect(html).toContain("Default optics, unchanged.");
  expect(html).toContain("No page capture.");
  expect(html).toContain("No refraction claim.");

  const noScriptContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3273",
    javaScriptEnabled: false,
  });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto("/research/bakeoff", { waitUntil: "domcontentloaded" });
  const serverSignature = await noScriptPage.locator('[role="tab"]').evaluateAll(
    (tabs) =>
      tabs.map(
        (tab) =>
          `${tab.textContent}:${tab.getAttribute("aria-selected")}:${tab.getAttribute("tabindex")}`,
      ),
  );
  await noScriptContext.close();

  const hydratedSignature = await page.locator('[role="tab"]').evaluateAll(
    (tabs) =>
      tabs.map(
        (tab) =>
          `${tab.textContent}:${tab.getAttribute("aria-selected")}:${tab.getAttribute("tabindex")}`,
      ),
  );

  expect(hydratedSignature).toEqual(serverSignature);
  await expect(page.getByRole("tablist")).toHaveCount(3);
  await expect(page.getByRole("tab")).toHaveCount(9);
  await expect(page.getByRole("tabpanel")).toHaveCount(3);
  await expect(page.locator('[data-candidate="owned-svg"] [data-optics="package-default"]')).toHaveCount(1);

  await expect
    .poll(async () => (await diagnostics(page)).explicitWebgl?.rendererKind)
    .toBe("webgl");
  const result = await diagnostics(page);
  expect(result).toMatchObject({
    route: "research-bakeoff",
    selectedTab: "overview",
    scene: "photo",
    focusCandidate: null,
    renderedCandidates: ["owned-svg", "explicit-webgl", "css-baseline"],
    activeRendererCount: 1,
  });
  expect(result.explicitWebgl?.renderer).toMatchObject({
    active: true,
    contextLost: false,
    displacementPx: 8,
    materialId: "m1-transport-controls",
    lightingModelId: "m1.1-continuous-capsule-lighting-r1",
  });
  expect(errors).toEqual([]);
});

test("mouse and roving keyboard interaction stay synchronized", async ({ page }) => {
  await openBakeoff(page);
  const activityTabs = page.getByRole("tab", { name: "Activity" });
  await activityTabs.first().click();
  await expect(activityTabs).toHaveCount(3);
  for (const tab of await activityTabs.all()) {
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByRole("tabpanel", { name: "Activity" })).toHaveCount(3);
  expect((await diagnostics(page)).selectedTab).toBe("activity");

  await activityTabs.first().press("ArrowRight");
  const settingsTabs = page.getByRole("tab", { name: "Settings" });
  for (const tab of await settingsTabs.all()) {
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
  await expect(settingsTabs.first()).toBeFocused();
  expect((await diagnostics(page)).selectedTab).toBe("settings");

  await settingsTabs.first().press("Home");
  await expect(page.getByRole("tab", { name: "Overview" }).first()).toBeFocused();
  expect((await diagnostics(page)).selectedTab).toBe("overview");
});

test("all stress scenes and isolated candidate routes remain truthful", async ({
  browser,
  page,
}) => {
  await openBakeoff(page);
  const scenes: readonly SceneId[] = ["light", "dark", "photo", "text", "motion"];
  for (const scene of scenes) {
    const button = page.getByRole("button", {
      name: scene[0].toUpperCase() + scene.slice(1),
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect((await diagnostics(page)).scene).toBe(scene);
  }

  const candidates: readonly CandidateId[] = [
    "owned-svg",
    "explicit-webgl",
    "css-baseline",
  ];
  for (const candidate of candidates) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3273",
      viewport: { width: 1280, height: 720 },
    });
    const isolatedPage = await context.newPage();
    await openBakeoff(
      isolatedPage,
      `/research/bakeoff?candidate=${candidate}&scene=text`,
    );
    await expect(isolatedPage.locator("article")).toHaveCount(1);
    await expect(
      isolatedPage.locator(`[data-candidate="${candidate}"]`),
    ).toBeVisible();
    const result = await diagnostics(isolatedPage);
    expect(result.focusCandidate).toBe(candidate);
    expect(result.renderedCandidates).toEqual([candidate]);
    expect(result.activeRendererCount).toBe(candidate === "explicit-webgl" ? 1 : 0);
    await context.close();
  }
});

test("static WebGL work becomes idle, moves on demand, and fails closed", async ({
  page,
}) => {
  await openBakeoff(page);
  await expect
    .poll(async () => (await diagnostics(page)).explicitWebgl?.rendererKind)
    .toBe("webgl");
  await page.waitForTimeout(500);
  const settled = await diagnostics(page);
  await page.waitForTimeout(600);
  const idle = await diagnostics(page);
  expect(idle.explicitWebgl?.renderer?.frames).toBe(
    settled.explicitWebgl?.renderer?.frames,
  );
  expect(idle.explicitWebgl?.renderer?.uploads).toBe(
    settled.explicitWebgl?.renderer?.uploads,
  );
  expect(idle.explicitWebgl?.renderer?.presentedFrameCallbacks).toBe(0);

  await page.getByRole("tab", { name: "Activity" }).first().click();
  await expect
    .poll(async () => (await diagnostics(page)).explicitWebgl?.renderer?.frames ?? 0)
    .toBeGreaterThan(idle.explicitWebgl?.renderer?.frames ?? 0);
  await page.waitForTimeout(500);
  const movedAndSettled = await diagnostics(page);
  await page.waitForTimeout(500);
  expect((await diagnostics(page)).explicitWebgl?.renderer?.frames).toBe(
    movedAndSettled.explicitWebgl?.renderer?.frames,
  );

  await page.evaluate(() => window.__glazeBakeoff?.forceContextLoss());
  await expect(page.locator('[data-renderer="css-fallback"]')).toHaveCount(1);
  await expect.poll(async () => (await diagnostics(page)).activeRendererCount).toBe(0);
  const fallback = await diagnostics(page);
  expect(fallback.explicitWebgl?.rendererKind).toBe("css-fallback");
  expect(fallback.explicitWebgl?.fallbackReason).toContain("webgl-context-");
  await expect(page.getByRole("tab", { name: "Activity" })).toHaveCount(3);
});

test("compact, reduced-motion, and forced-colors paths preserve control", async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBakeoff(
    page,
    "/research/bakeoff?candidate=css-baseline&scene=photo",
  );
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  const control = page.getByTestId("css-baseline-control");
  const box = await control.boundingBox();
  expect(box?.width).toBe(300);
  await expect(page.getByRole("tab")).toHaveCount(3);

  const reducedContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3273",
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    forcedColors: "none",
  });
  const reducedPage = await reducedContext.newPage();
  await openBakeoff(
    reducedPage,
    "/research/bakeoff?candidate=css-baseline&scene=photo",
  );
  const reduced = await reducedPage
    .getByTestId("css-baseline-control")
    .evaluate((element) => ({
    transition: getComputedStyle(element.querySelector("[class*='cssIndicator']") as Element)
      .transitionDuration,
    videoDisplay: getComputedStyle(document.querySelector("video") as Element).display,
    }));
  expect(reduced.videoDisplay).toBe("none");
  expect(reduced.transition).toMatch(/0\.00001s|1e-05s|0s/);
  await reducedContext.close();

  const forcedContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3273",
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
    forcedColors: "active",
  });
  const forcedPage = await forcedContext.newPage();
  await openBakeoff(
    forcedPage,
    "/research/bakeoff?candidate=css-baseline&scene=photo",
  );
  const selected = forcedPage.getByRole("tab", { name: "Overview" });
  const forcedOutline = await selected.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(forcedOutline).not.toBe("none");
  await forcedContext.close();
});

test("@visual captures whole-viewport desktop and compact evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One evidence set is sufficient.");
  mkdirSync(evidenceRoot, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  const scenes: readonly SceneId[] = ["light", "dark", "photo", "text", "motion"];
  for (const scene of scenes) {
    await page.goto(`/research/bakeoff?scene=${scene}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForBakeoff(page);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
        ),
      );
    });
    await page.screenshot({
      path: resolve(evidenceRoot, `desktop-${scene}.png`),
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const candidates: readonly CandidateId[] = [
    "owned-svg",
    "explicit-webgl",
    "css-baseline",
  ];
  for (const candidate of candidates) {
    await page.goto(`/research/bakeoff?candidate=${candidate}&scene=text`, {
      waitUntil: "domcontentloaded",
    });
    await waitForBakeoff(page);
    await page.screenshot({
      path: resolve(evidenceRoot, `compact-${candidate}-text.png`),
      fullPage: false,
    });
  }
});
