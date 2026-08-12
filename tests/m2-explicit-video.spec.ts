import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface M2Diagnostics {
  capability: "explicit-video-webgl";
  sourceKind: "video";
  sourceId: string;
  configuredSourcePaths: string[];
  currentSourceUrl: string;
  sameOrigin: boolean;
  rendererKind: "webgl" | "css-fallback";
  fallbackReason: string | null;
  semanticControlCount: number;
  activeRendererCount: number;
  rendererMounts: number;
  rendererCleanups: number;
  longTasks: number;
  mapHash: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  renderer: null | {
    frames: number;
    uploads: number;
    presentedFrameCallbacks: number;
    displacementPx: number;
    maxRenderMs: number;
    canvasWidth: number;
    canvasHeight: number;
    dpr: number;
    materialId: string;
    lightingModelId: string;
    activation: number;
  };
}

const evidenceRun =
  process.env.M2_PRODUCTION === "1" ? "production" : "development";
const evidenceRoot = ".gstack/evidence/gate-2/m2-explicit-video-nextjs";

const diagnostics = (page: Page) =>
  page.evaluate(() => {
    const boundary = (
      window as typeof window & {
        __glazeM2?: { getDiagnostics: () => M2Diagnostics };
      }
    ).__glazeM2;
    if (!boundary) throw new Error("M2 diagnostics are unavailable.");
    return boundary.getDiagnostics();
  });

const forceRemount = (page: Page) =>
  page.evaluate(() => window.__glazeM2?.forceRemount());

async function expectWebGL(page: Page) {
  await expect(page.getByTestId("m2-renderer-kind")).toHaveText("webgl", {
    timeout: 12_000,
  });
  await expect.poll(async () => (await diagnostics(page)).mapHash).not.toBe("");
  await expect.poll(async () => (await diagnostics(page)).activeRendererCount).toBe(1);
}

async function semanticSignature(page: Page): Promise<string[]> {
  return page.getByTestId("semantic-controls").evaluate((root) =>
    Array.from(root.querySelectorAll("button, input, output")).map(
      (element) =>
        `${element.tagName.toLowerCase()}:${element.getAttribute("data-testid") ?? ""}`,
    ),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/m2/video");
  await expect(
    page.getByRole("heading", { name: "Explicit video, integrated honestly." }),
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__glazeM2));
  await expectWebGL(page);
});

test("SSR shell hydrates one stable semantic tree around one explicit source", async ({
  browser,
  page,
  request,
}) => {
  const response = await request.get("/m2/video");
  const html = await response.text();
  expect(response.ok()).toBe(true);
  expect(html).toContain('data-m2-shell="server"');
  expect(html).toContain('data-capability="explicit-video-webgl"');
  expect(html).toContain('data-source-kind="video"');
  expect(html).toContain('data-renderer="css-fallback"');
  expect(html).toContain('data-fallback-reason="awaiting-client-enhancement"');
  expect(html).toContain("/m1-flower.webm");
  expect(html).toContain("/m1-flower.mp4");

  const noScriptContext = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://127.0.0.1:3173",
  });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto("/m2/video");
  const serverSignature = await semanticSignature(noScriptPage);
  await noScriptContext.close();

  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__glazeM2));
  await expectWebGL(page);

  expect(await semanticSignature(page)).toEqual(serverSignature);
  await expect(page.getByTestId("semantic-controls")).toHaveCount(1);
  await expect(page.getByTestId("explicit-video-source")).toHaveCount(1);
  await expect(page.locator("video source")).toHaveCount(2);
  const result = await diagnostics(page);
  expect(result).toMatchObject({
    capability: "explicit-video-webgl",
    sourceKind: "video",
    sourceId: "m2-explicit-flower-video",
    configuredSourcePaths: ["/m1-flower.webm", "/m1-flower.mp4"],
    sameOrigin: true,
    semanticControlCount: 3,
    activeRendererCount: 1,
  });
  expect(new URL(result.currentSourceUrl).origin).toBe(
    "http://127.0.0.1:3173",
  );
  expect(result.renderer).toMatchObject({
    materialId: "m1-transport-controls",
    lightingModelId: "m1.1-continuous-capsule-lighting-r1",
    displacementPx: 8,
  });
  expect(errors).toEqual([]);
});

test("mouse and keyboard control playback, focus, time, and progress", async ({
  page,
}) => {
  const play = page.getByTestId("m2-play-toggle");
  const progress = page.getByTestId("m2-progress");
  await expect(progress).toBeEnabled();

  const initialTime = (await diagnostics(page)).currentTime;
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await diagnostics(page)).currentTime).toBeGreaterThan(
    initialTime,
  );
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");

  const progressBox = await progress.boundingBox();
  expect(progressBox).not.toBeNull();
  await progress.click({
    position: {
      x: (progressBox?.width ?? 1) * 0.72,
      y: (progressBox?.height ?? 1) / 2,
    },
  });
  await expect.poll(async () => (await diagnostics(page)).currentTime).toBeGreaterThan(
    (await diagnostics(page)).duration * 0.5,
  );
  await progress.focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => (await diagnostics(page)).currentTime).toBeLessThan(0.1);

  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press("Space");
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("m2-time")).toContainText("/");
});

test("success CSS is finish-free and accessibility media keeps controls honest", async ({
  page,
}) => {
  const surface = page.getByTestId("m2-glass-surface");
  const successStyles = await surface.evaluate((element) => {
    const surfaceStyle = getComputedStyle(element);
    const playStyle = getComputedStyle(
      element.querySelector('[data-testid="m2-play-toggle"]') as Element,
    );
    return {
      borderTopWidth: surfaceStyle.borderTopWidth,
      backgroundImage: surfaceStyle.backgroundImage,
      boxShadow: surfaceStyle.boxShadow,
      playBorderTopWidth: playStyle.borderTopWidth,
      fallbackDisplay: getComputedStyle(
        element.querySelector('[data-testid="m2-fallback-layer"]') as Element,
      ).display,
      finishCount: element.querySelectorAll('[class*="fallbackFinish"]').length,
    };
  });
  expect(successStyles).toEqual({
    borderTopWidth: "0px",
    backgroundImage: "none",
    boxShadow: "none",
    playBorderTopWidth: "0px",
    fallbackDisplay: "none",
    finishCount: 0,
  });

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__glazeM2));
  await expectWebGL(page);
  const reducedSurface = page.getByTestId("m2-glass-surface");
  const restTransform = await reducedSurface.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await reducedSurface.hover({ position: { x: 185, y: 18 } });
  expect(
    await reducedSurface.evaluate((element) => getComputedStyle(element).transform),
  ).toBe(restTransform);
  expect((await diagnostics(page)).renderer?.activation ?? 0).toBeGreaterThan(0);

  await page.goto("about:blank");
  await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "active" });
  await page.goto("/m2/video");
  await page.waitForFunction(() => Boolean(window.__glazeM2));
  await expectWebGL(page);
  const accessibilityStyles = await page
    .getByTestId("m2-glass-surface")
    .evaluate((element) => ({
      outputDisplay: getComputedStyle(
        element.querySelector('[data-testid="m2-webgl-output"]') as Element,
      ).display,
      fallbackDisplay: getComputedStyle(
        element.querySelector('[data-testid="m2-fallback-layer"]') as Element,
      ).display,
    }));
  expect(accessibilityStyles).toEqual({
    outputDisplay: "none",
    fallbackDisplay: "block",
  });
  await expect(page.getByTestId("semantic-controls")).toBeVisible();
  await expect(page.getByTestId("m2-play-toggle")).toBeEnabled();
});

test("paused, hidden, and offscreen video scheduling is demand-driven", async ({
  page,
}, testInfo) => {
  await page.waitForTimeout(450);
  await page.evaluate(() =>
    window.__glazeM2?.resetPerformanceMeasurements(),
  );
  const settled = await diagnostics(page);
  await page.waitForTimeout(600);
  const idle = await diagnostics(page);
  expect(idle.renderer?.frames).toBe(settled.renderer?.frames);
  expect(idle.renderer?.uploads).toBe(settled.renderer?.uploads);

  await page.getByTestId("m2-play-toggle").click();
  await page.waitForTimeout(700);
  await page.getByTestId("m2-play-toggle").click();
  await page.waitForTimeout(250);
  const played = await diagnostics(page);
  const callbackDelta =
    (played.renderer?.presentedFrameCallbacks ?? 0) -
    (idle.renderer?.presentedFrameCallbacks ?? 0);
  const uploadDelta =
    (played.renderer?.uploads ?? 0) - (idle.renderer?.uploads ?? 0);
  expect(callbackDelta).toBeGreaterThan(0);
  expect(uploadDelta).toBeLessThanOrEqual(callbackDelta + 1);

  await page.getByTestId("m2-play-toggle").click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  const hidden = await diagnostics(page);
  await page.waitForTimeout(550);
  const hiddenLater = await diagnostics(page);
  expect(hiddenLater.renderer?.presentedFrameCallbacks).toBe(
    hidden.renderer?.presentedFrameCallbacks,
  );

  await page.evaluate(() => {
    delete (document as Document & { visibilityState?: string }).visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(async () => (await diagnostics(page)).renderer?.presentedFrameCallbacks ?? 0)
    .toBeGreaterThan(hiddenLater.renderer?.presentedFrameCallbacks ?? 0);

  const surface = page.getByTestId("m2-glass-surface");
  await surface.evaluate((element) => {
    element.style.top = "1400px";
  });
  await page.waitForTimeout(300);
  const offscreen = await diagnostics(page);
  await page.waitForTimeout(550);
  const offscreenLater = await diagnostics(page);
  expect(offscreenLater.renderer?.presentedFrameCallbacks).toBe(
    offscreen.renderer?.presentedFrameCallbacks,
  );
  await surface.evaluate((element) => {
    element.style.top = "62%";
  });
  await expect
    .poll(async () => (await diagnostics(page)).renderer?.presentedFrameCallbacks ?? 0)
    .toBeGreaterThan(offscreenLater.renderer?.presentedFrameCallbacks ?? 0);
  await page.getByTestId("m2-play-toggle").click();

  const metricsDirectory = resolve(evidenceRoot, "metrics", evidenceRun);
  mkdirSync(metricsDirectory, { recursive: true });
  writeFileSync(
    resolve(metricsDirectory, `${testInfo.project.name}.json`),
    `${JSON.stringify(
      {
        project: testInfo.project.name,
        environment: evidenceRun,
        userAgent: await page.evaluate(() => navigator.userAgent),
        devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
        paused: {
          frames: idle.renderer?.frames ?? null,
          uploads: idle.renderer?.uploads ?? null,
        },
        playback: { callbackDelta, uploadDelta },
        hiddenCallbackDelta:
          (hiddenLater.renderer?.presentedFrameCallbacks ?? 0) -
          (hidden.renderer?.presentedFrameCallbacks ?? 0),
        offscreenCallbackDelta:
          (offscreenLater.renderer?.presentedFrameCallbacks ?? 0) -
          (offscreen.renderer?.presentedFrameCallbacks ?? 0),
        maxRenderMs: (await diagnostics(page)).renderer?.maxRenderMs ?? null,
        longTasks: (await diagnostics(page)).longTasks,
      },
      null,
      2,
    )}\n`,
  );
});

test("resize, zero-size recovery, remount cleanup, and context loss are explicit", async ({
  page,
}) => {
  const initial = await diagnostics(page);
  expect(initial.activeRendererCount).toBe(1);
  await forceRemount(page);
  await expect
    .poll(async () => (await diagnostics(page)).rendererMounts)
    .toBeGreaterThan(initial.rendererMounts);
  await expectWebGL(page);
  const remounted = await diagnostics(page);
  expect(remounted.rendererCleanups).toBeGreaterThan(initial.rendererCleanups);

  const surface = page.getByTestId("m2-glass-surface");
  await surface.evaluate((element) => {
    element.style.width = "0px";
    element.style.height = "0px";
  });
  await page.waitForTimeout(150);
  await surface.evaluate((element) => {
    element.style.width = "240px";
    element.style.height = "56px";
  });
  await expect
    .poll(async () => (await diagnostics(page)).renderer?.canvasWidth)
    .toBe(480);
  expect((await diagnostics(page)).renderer?.dpr).toBe(2);

  await page.evaluate(() => window.__glazeM2?.forceContextLoss());
  await expect(page.getByTestId("m2-renderer-kind")).toHaveText("css-fallback");
  await expect(page.getByTestId("m2-fallback-reason")).toHaveText(
    "webgl-context-lost",
  );
  await expect.poll(async () => (await diagnostics(page)).activeRendererCount).toBe(0);
  await expect(page.getByTestId("semantic-controls")).toBeVisible();

  await forceRemount(page);
  await expectWebGL(page);
  expect((await diagnostics(page)).activeRendererCount).toBe(1);
});

test("controlled security and upload failures are visible without losing controls", async ({
  page,
}) => {
  for (const reason of [
    "source-not-origin-clean",
    "source-upload-failed",
  ] as const) {
    await page.evaluate(
      (value) => window.__glazeM2?.injectSourceFailure(value),
      reason,
    );
    await expect(page.getByTestId("m2-renderer-kind")).toHaveText(
      "css-fallback",
    );
    await expect(page.getByTestId("m2-fallback-reason")).toHaveText(reason);
    await expect(page.getByTestId("m2-status")).toHaveAttribute(
      "data-fallback-reason",
      reason,
    );
    await expect(page.getByTestId("semantic-controls")).toBeVisible();
    await expect(page.getByTestId("m2-play-toggle")).toBeEnabled();
    await forceRemount(page);
    await expectWebGL(page);
  }
});

test("@evidence captures integration and fallback states at original resolution", async ({
  page,
}, testInfo) => {
  const cropDirectory = resolve(
    evidenceRoot,
    "fixed-crops",
    evidenceRun,
    testInfo.project.name,
  );
  mkdirSync(cropDirectory, { recursive: true });
  const surface = page.getByTestId("m2-glass-surface");
  const capture = async (name: string) => {
    const bounds = await surface.boundingBox();
    expect(bounds).not.toBeNull();
    await page.screenshot({
      path: resolve(cropDirectory, `${name}.png`),
      clip: {
        x: (bounds?.x ?? 0) - 48,
        y: (bounds?.y ?? 0) - 32,
        width: (bounds?.width ?? 0) + 96,
        height: (bounds?.height ?? 0) + 64,
      },
    });
  };

  await page.evaluate(() => {
    const video = document.querySelector(
      '[data-testid="explicit-video-source"]',
    ) as HTMLVideoElement | null;
    if (video) {
      video.pause();
      video.currentTime = 1;
    }
  });
  await page.waitForTimeout(250);
  await capture("rest");
  if (testInfo.project.name !== "chromium") return;

  await page.getByTestId("m2-play-toggle").focus();
  await capture("focus");
  await page.getByTestId("m2-play-toggle").click();
  await page.waitForTimeout(300);
  await capture("playing");
  await page.getByTestId("m2-play-toggle").click();
  await page.waitForTimeout(180);
  await capture("paused");

  await page.evaluate(() => window.__glazeM2?.forceContextLoss());
  await expect(page.getByTestId("m2-renderer-kind")).toHaveText("css-fallback");
  await capture("context-loss");
  await forceRemount(page);
  await expectWebGL(page);
  await page.evaluate(() =>
    window.__glazeM2?.injectSourceFailure("source-not-origin-clean"),
  );
  await expect(page.getByTestId("m2-renderer-kind")).toHaveText("css-fallback");
  await capture("source-fallback");
});
