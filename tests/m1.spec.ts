import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Diagnostics {
  mode: "owned-dom" | "canvas" | "video" | "fallback";
  rendererKind: "svg-dom" | "webgl" | "css-fallback";
  fallbackReason: string | null;
  mapHash: string;
  mapWidth: number;
  mapHeight: number;
  mapDpr: number;
  activeRendererCount: number;
  longTasks: number;
  renderer: null | {
    frames: number;
    uploads: number;
    presentedFrameCallbacks: number;
    displacementPx: number;
    maxRenderMs: number;
    contextLost: boolean;
    canvasWidth: number;
  };
}

const diagnostics = (page: Page) =>
  page.evaluate(() => {
    const glaze = (
      window as typeof window & {
        __glazeM1?: { getDiagnostics: () => Diagnostics };
      }
    ).__glazeM1;
    if (!glaze) throw new Error("M1 diagnostics are unavailable.");
    return glaze.getDiagnostics();
  });

async function chooseMode(
  page: Page,
  mode: Diagnostics["mode"],
  expected: Diagnostics["rendererKind"],
) {
  await page.getByTestId(`mode-${mode}`).click();
  await expect(page.getByTestId("renderer-kind")).toHaveText(expected, {
    timeout: 10_000,
  });
  await expect.poll(async () => (await diagnostics(page)).mapHash).not.toBe("");
}

async function chooseCanvasScene(
  page: Page,
  scene: "prism" | "topography" | "nocturne",
) {
  await page.getByTestId(`scene-${scene}`).click();
  await expect(page.getByTestId(`scene-${scene}`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/m1");
  await expect(page.getByRole("heading", { name: "Rendering foundation, under test." })).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__glazeM1));
  await expect.poll(async () => (await diagnostics(page)).mapHash).not.toBe("");
});

test("SSR, hydration, explicit modes, and semantic interaction remain honest", async ({
  page,
  request,
}) => {
  const response = await request.get("/m1");
  const html = await response.text();
  expect(html).toContain("Rendering foundation, under test.");
  expect(html).toContain("Play source");
  expect(html).toContain('data-renderer="css-fallback"');

  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__glazeM1));

  await chooseMode(page, "owned-dom", "svg-dom");
  const initialHash = (await diagnostics(page)).mapHash;

  await page.getByTestId("play-toggle").focus();
  await expect(page.getByTestId("play-toggle")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("play-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await chooseMode(page, "canvas", "webgl");
  expect((await diagnostics(page)).mapHash).toBe(initialHash);
  await chooseMode(page, "video", "webgl");
  expect((await diagnostics(page)).mapHash).toBe(initialHash);
  await chooseMode(page, "fallback", "css-fallback");
  await expect(page.getByTestId("fallback-reason")).toHaveText(
    "forced-by-developer",
  );
  await expect.poll(async () => (await diagnostics(page)).activeRendererCount).toBe(0);

  expect(errors).toEqual([]);
});

test("DPR regeneration and WebGL context loss are explicit", async ({ page }) => {
  await page.evaluate(() => {
    const glaze = (
      window as typeof window & {
        __glazeM1?: { setForcedDpr: (dpr: number) => void };
      }
    ).__glazeM1;
    glaze?.setForcedDpr(1);
  });
  await expect(page.getByTestId("map-size")).toHaveText("240×56");
  const dpr1Hash = (await diagnostics(page)).mapHash;

  await page.evaluate(() => {
    const glaze = (
      window as typeof window & {
        __glazeM1?: { setForcedDpr: (dpr: number) => void };
      }
    ).__glazeM1;
    glaze?.setForcedDpr(2);
  });
  await expect(page.getByTestId("map-size")).toHaveText("480×112");
  await expect.poll(async () => (await diagnostics(page)).mapHash).not.toBe(dpr1Hash);

  await chooseMode(page, "canvas", "webgl");
  await page.evaluate(() => {
    const glaze = (
      window as typeof window & {
        __glazeM1?: { forceContextLoss: () => void };
      }
    ).__glazeM1;
    glaze?.forceContextLoss();
  });
  await expect(page.getByTestId("renderer-kind")).toHaveText("css-fallback");
  await expect(page.getByTestId("fallback-reason")).toContainText(
    "webgl-context-",
  );
  await expect(page.getByTestId("play-toggle")).toBeVisible();
});

test("liquid interaction flexes without replacing semantic controls", async ({
  page,
}) => {
  await chooseMode(page, "canvas", "webgl");
  const surface = page.getByTestId("glass-surface");
  const control = page.getByTestId("play-toggle");

  await surface.hover({ position: { x: 185, y: 18 } });
  await expect(surface).toHaveAttribute("data-active", "true");
  await expect(control).toBeVisible();
  await control.focus();
  await expect(control).toBeFocused();

  const bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move((bounds?.x ?? 0) + 185, (bounds?.y ?? 0) + 18);
  await page.mouse.down();
  await expect(surface).toHaveAttribute("data-pressed", "true");
  await page.mouse.up();
  await expect(surface).toHaveAttribute("data-pressed", "false");

  await page.mouse.move(0, 0);
  await expect(surface).toHaveAttribute("data-active", "false");
});

test("stress scenes preserve one material and renderer contract", async ({
  page,
}) => {
  await chooseMode(page, "canvas", "webgl");
  const initialHash = (await diagnostics(page)).mapHash;
  const initialDisplacement = (await diagnostics(page)).renderer?.displacementPx;

  for (const scene of ["topography", "nocturne", "prism"] as const) {
    await chooseCanvasScene(page, scene);
    expect((await diagnostics(page)).mapHash).toBe(initialHash);
    expect((await diagnostics(page)).renderer?.displacementPx).toBe(
      initialDisplacement,
    );
    await expect(page.getByTestId("renderer-kind")).toHaveText("webgl");
  }
});

test("@performance static and paused sources become idle", async ({ page }, testInfo) => {
  await chooseMode(page, "canvas", "webgl");
  await page.waitForTimeout(400);
  const settled = await diagnostics(page);
  await page.waitForTimeout(600);
  const idle = await diagnostics(page);
  expect(idle.renderer?.frames).toBe(settled.renderer?.frames);
  expect(idle.renderer?.uploads).toBe(settled.renderer?.uploads);

  await page.evaluate(() => {
    const glaze = (
      window as typeof window & {
        __glazeM1?: { resetLongTasks: () => void };
      }
    ).__glazeM1;
    glaze?.resetLongTasks();
  });
  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(700);
  const active = await diagnostics(page);
  expect(active.renderer?.frames ?? 0).toBeGreaterThan(idle.renderer?.frames ?? 0);
  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(300);
  const paused = await diagnostics(page);
  await page.waitForTimeout(600);
  const pausedLater = await diagnostics(page);
  expect(pausedLater.renderer?.frames).toBe(paused.renderer?.frames);
  expect(pausedLater.renderer?.maxRenderMs ?? 51).toBeLessThan(50);
  expect(pausedLater.longTasks).toBe(0);

  await chooseMode(page, "video", "webgl");
  await page.waitForTimeout(300);
  const videoSettled = await diagnostics(page);
  await page.waitForTimeout(600);
  const videoPaused = await diagnostics(page);
  expect(videoPaused.renderer?.frames).toBe(videoSettled.renderer?.frames);
  expect(videoPaused.renderer?.uploads).toBe(videoSettled.renderer?.uploads);

  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(800);
  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(250);
  const videoActive = await diagnostics(page);
  const callbackDelta =
    (videoActive.renderer?.presentedFrameCallbacks ?? 0) -
    (videoPaused.renderer?.presentedFrameCallbacks ?? 0);
  const uploadDelta =
    (videoActive.renderer?.uploads ?? 0) -
    (videoPaused.renderer?.uploads ?? 0);
  expect(callbackDelta).toBeGreaterThan(0);
  expect(uploadDelta).toBeLessThanOrEqual(callbackDelta + 1);

  const glass = page.getByTestId("glass-surface");
  await glass.evaluate((element) => {
    element.style.width = "0px";
    element.style.height = "0px";
  });
  await page.waitForTimeout(150);
  await glass.evaluate((element) => {
    element.style.width = "240px";
    element.style.height = "56px";
  });
  await expect
    .poll(async () => (await diagnostics(page)).renderer?.canvasWidth)
    .toBe(480);
  const recovered = await diagnostics(page);

  const metricsDirectory = resolve(
    ".gstack/evidence/gate-1/result/metrics",
  );
  mkdirSync(metricsDirectory, { recursive: true });
  writeFileSync(
    resolve(metricsDirectory, `${testInfo.project.name}.json`),
    `${JSON.stringify(
      {
        project: testInfo.project.name,
        userAgent: await page.evaluate(() => navigator.userAgent),
        devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
        canvas: {
          settledFrames: settled.renderer?.frames ?? null,
          idleFrames: idle.renderer?.frames ?? null,
          activeFrames: active.renderer?.frames ?? null,
          pausedFrames: paused.renderer?.frames ?? null,
          pausedLaterFrames: pausedLater.renderer?.frames ?? null,
          maxRenderMs: pausedLater.renderer?.maxRenderMs ?? null,
          longTasks: pausedLater.longTasks,
        },
        video: {
          settledFrames: videoSettled.renderer?.frames ?? null,
          pausedFrames: videoPaused.renderer?.frames ?? null,
          callbackDelta,
          uploadDelta,
          maxRenderMs: videoActive.renderer?.maxRenderMs ?? null,
        },
        zeroSizeRecovery: {
          canvasWidth: recovered.renderer?.canvasWidth ?? null,
          expectedCanvasWidth: 480,
        },
      },
      null,
      2,
    )}\n`,
  );
});

test("@visual fixed source scenes remain reviewable", async ({ page }) => {
  await chooseMode(page, "owned-dom", "svg-dom");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot("owned-dom.png");

  await chooseMode(page, "canvas", "webgl");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot("canvas.png");
  const surface = page.getByTestId("glass-surface");
  await surface.hover({ position: { x: 185, y: 18 } });
  await expect(surface).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot(
    "canvas-energized.png",
  );
  const bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move((bounds?.x ?? 0) + 185, (bounds?.y ?? 0) + 18);
  await page.mouse.down();
  await expect(surface).toHaveAttribute("data-pressed", "true");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot(
    "canvas-pressed.png",
  );
  await page.mouse.up();
  await page.mouse.move(0, 0);

  await chooseCanvasScene(page, "topography");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot(
    "canvas-topography.png",
  );

  await chooseCanvasScene(page, "nocturne");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot(
    "canvas-nocturne.png",
  );
  const nocturneSurface = page.getByTestId("glass-surface");
  const nocturneBounds = await nocturneSurface.boundingBox();
  expect(nocturneBounds).not.toBeNull();
  await page.mouse.move(
    (nocturneBounds?.x ?? 0) + 166,
    (nocturneBounds?.y ?? 0) + 26,
  );
  await page.mouse.down();
  await expect(nocturneSurface).toHaveAttribute("data-pressed", "true");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot(
    "canvas-nocturne-pressed.png",
  );
  await page.mouse.up();
  await page.mouse.move(0, 0);

  await chooseMode(page, "video", "webgl");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      video.pause();
      video.currentTime = 1;
    }
  });
  await page.waitForTimeout(250);
  await expect(page.getByTestId("m1-card")).toHaveScreenshot("video.png");

  await chooseMode(page, "fallback", "css-fallback");
  await expect(page.getByTestId("m1-card")).toHaveScreenshot("fallback.png");
});
