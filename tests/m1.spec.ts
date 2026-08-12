import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Diagnostics {
  mode: "canvas" | "video" | "fallback";
  rendererKind: "webgl" | "css-fallback";
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
    materialId: string;
    lightingModelId: string;
    effectiveLightAngleDeg: number;
    activation: number;
    mapTextureMinFilter: number;
    mapTextureMagFilter: number;
    mapTextureWrapS: number;
    mapTextureWrapT: number;
  };
}

interface LightingMeasurement {
  sourceProbe: string;
  effectiveLightAngleDeg: number;
  activation: number;
  interiorLuminance: number;
  litRimLuminance: number;
  opposingRimLuminance: number;
  highlightLift: number;
  occlusionDrop: number;
  tintBlueShift: number;
  transmissionLuminance: number;
  highFrequencyEnergy: number;
  highlightVector: readonly [number, number];
  sampledPixels: number;
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

const setLightAngle = (page: Page, angleDeg: number) =>
  page.evaluate((angle) => window.__glazeM1?.setLightAngleDeg(angle), angleDeg);

const measureLighting = (page: Page, sourceProbe: string) =>
  page.evaluate(
    (probe) => window.__glazeM1?.measureLighting(probe) as LightingMeasurement,
    sourceProbe,
  );

const setSourceProbe = (
  page: Page,
  probe: "scene" | "bright" | "dark" | "high-frequency",
) => page.evaluate((value) => window.__glazeM1?.setSourceProbe(value), probe);

const evidenceRun = process.env.M1_PRODUCTION === "1" ? "production" : "development";
const revisionEvidenceRoot =
  ".gstack/evidence/gate-1/m1.1-stage-a-revision-1";

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

  await expect(page.getByTestId("mode-owned-dom")).toBeDisabled();
  await expect(page.getByTestId("mode-owned-dom")).toContainText(
    "SVG parity rejected / reframe required",
  );
  await expect(page.getByTestId("renderer-kind")).toHaveText("webgl");
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
  await page.waitForTimeout(450);
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
  const initialMaterialId = (await diagnostics(page)).renderer?.materialId;
  const initialLightingModelId = (await diagnostics(page)).renderer?.lightingModelId;

  for (const scene of ["topography", "nocturne", "prism"] as const) {
    await chooseCanvasScene(page, scene);
    expect((await diagnostics(page)).mapHash).toBe(initialHash);
    expect((await diagnostics(page)).renderer?.displacementPx).toBe(
      initialDisplacement,
    );
    expect((await diagnostics(page)).renderer?.materialId).toBe(initialMaterialId);
    expect((await diagnostics(page)).renderer?.lightingModelId).toBe(
      initialLightingModelId,
    );
    await expect(page.getByTestId("renderer-kind")).toHaveText("webgl");
  }

  await chooseMode(page, "video", "webgl");
  expect((await diagnostics(page)).renderer?.materialId).toBe(initialMaterialId);
  expect((await diagnostics(page)).renderer?.lightingModelId).toBe(
    initialLightingModelId,
  );
});

test("WebGL success path has no CSS material perimeter or lighting finish", async ({
  page,
}) => {
  await chooseMode(page, "canvas", "webgl");
  const surface = page.getByTestId("glass-surface");
  const styles = await surface.evaluate((element) => {
    const surfaceStyle = getComputedStyle(element);
    const playStyle = getComputedStyle(
      element.querySelector('[data-testid="play-toggle"]') as Element,
    );
    return {
      borderTopWidth: surfaceStyle.borderTopWidth,
      borderImageSource: surfaceStyle.borderImageSource,
      backgroundImage: surfaceStyle.backgroundImage,
      boxShadow: surfaceStyle.boxShadow,
      playBorderTopWidth: playStyle.borderTopWidth,
      finishCount: element.querySelectorAll('[class*="fallbackFinish"]').length,
      fallbackDisplay: getComputedStyle(
        element.querySelector('[class*="fallbackLayer"]') as Element,
      ).display,
    };
  });
  expect(styles).toEqual({
    borderTopWidth: "0px",
    borderImageSource: "none",
    backgroundImage: "none",
    boxShadow: "none",
    playBorderTopWidth: "0px",
    finishCount: 0,
    fallbackDisplay: "none",
  });
  const renderer = (await diagnostics(page)).renderer;
  expect(renderer).toMatchObject({
    lightingModelId: "m1.1-continuous-capsule-lighting-r1",
    mapTextureMinFilter: 9729,
    mapTextureMagFilter: 9729,
    mapTextureWrapS: 33071,
    mapTextureWrapT: 33071,
  });
  await chooseMode(page, "fallback", "css-fallback");
  const fallbackLayers = await surface.evaluate((element) => ({
    finishCount: element.querySelectorAll('[class*="fallbackFinish"]').length,
    fallbackDisplay: getComputedStyle(
      element.querySelector('[class*="fallbackLayer"]') as Element,
    ).display,
  }));
  expect(fallbackLayers).toEqual({ finishCount: 1, fallbackDisplay: "block" });
});

test("renderer-native light angle, source luminance, and interaction are measurable", async ({
  page,
}, testInfo) => {
  await chooseMode(page, "canvas", "webgl");
  const measurements: Record<string, LightingMeasurement> = {};

  await setSourceProbe(page, "bright");
  await setLightAngle(page, 90);
  measurements.brightAngle90 = await measureLighting(page, "bright-angle-90");
  await setLightAngle(page, 270);
  measurements.brightAngle270 = await measureLighting(page, "bright-angle-270");
  expect(measurements.brightAngle90.highlightVector[0]).toBeGreaterThan(0);
  expect(measurements.brightAngle270.highlightVector[0]).toBeLessThan(0);
  expect(
    Math.abs(
      measurements.brightAngle90.litRimLuminance -
        measurements.brightAngle270.opposingRimLuminance,
    ),
  ).toBeGreaterThan(0.01);

  await setLightAngle(page, 315);
  await setSourceProbe(page, "high-frequency");
  measurements.prismRest = await measureLighting(page, "prism-rest");
  const surface = page.getByTestId("glass-surface");
  await surface.hover({ position: { x: 185, y: 18 } });
  measurements.prismHover = await measureLighting(page, "prism-hover");
  const bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move((bounds?.x ?? 0) + 185, (bounds?.y ?? 0) + 18);
  await page.mouse.down();
  measurements.prismPress = await measureLighting(page, "prism-press");
  await page.mouse.up();
  await page.mouse.move(0, 0);
  expect(measurements.prismHover.activation).toBeGreaterThan(0);
  expect(measurements.prismPress.activation).toBe(1);
  expect(measurements.prismHover.effectiveLightAngleDeg).not.toBeCloseTo(
    measurements.prismRest.effectiveLightAngleDeg,
    1,
  );
  expect(measurements.prismPress.highlightLift).not.toBeCloseTo(
    measurements.prismRest.highlightLift,
    3,
  );

  await setSourceProbe(page, "bright");
  measurements.bright = await measureLighting(page, "bright");
  await setSourceProbe(page, "dark");
  measurements.dark = await measureLighting(page, "dark");
  await setSourceProbe(page, "high-frequency");
  measurements.highFrequency = await measureLighting(page, "high-frequency");
  expect(measurements.highFrequency.highFrequencyEnergy).toBeGreaterThan(
    measurements.bright.highFrequencyEnergy,
  );
  expect(measurements.bright.transmissionLuminance).toBeGreaterThan(
    measurements.dark.transmissionLuminance,
  );
  expect(measurements.dark.tintBlueShift).toBeGreaterThan(
    measurements.bright.tintBlueShift,
  );
  expect(measurements.bright.highlightLift).toBeGreaterThan(
    measurements.dark.highlightLift,
  );
  expect(measurements.bright.occlusionDrop).toBeGreaterThan(
    measurements.dark.occlusionDrop,
  );

  const evidenceDirectory = resolve(
    `${revisionEvidenceRoot}/measurements`,
  );
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    resolve(
      evidenceDirectory,
      `${evidenceRun}-${testInfo.project.name}.json`,
    ),
    `${JSON.stringify(
      {
        project: testInfo.project.name,
        materialId: (await diagnostics(page)).renderer?.materialId,
        lightingModelId: (await diagnostics(page)).renderer?.lightingModelId,
        measurements,
      },
      null,
      2,
    )}\n`,
  );
});

test("reduced motion and forced colors preserve physical response and semantic fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__glazeM1));
  await chooseMode(page, "canvas", "webgl");
  await setSourceProbe(page, "bright");
  const surface = page.getByTestId("glass-surface");
  const restTransform = await surface.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const restLighting = await measureLighting(page, "reduced-motion-rest");
  await surface.hover({ position: { x: 185, y: 18 } });
  const hoverTransform = await surface.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const hoverLighting = await measureLighting(page, "reduced-motion-hover");
  expect(hoverTransform).toBe(restTransform);
  expect(hoverLighting.activation).toBeGreaterThan(0);
  expect(hoverLighting.effectiveLightAngleDeg).not.toBeCloseTo(
    restLighting.effectiveLightAngleDeg,
    1,
  );

  // Firefox persists dynamic form-control state across same-URL reloads. Use a
  // fresh navigation so that behavior cannot manufacture a hydration warning.
  await page.goto("about:blank");
  await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "active" });
  await page.goto("/m1");
  await page.waitForFunction(() => Boolean(window.__glazeM1));
  await chooseMode(page, "canvas", "webgl");
  const accessibilityStyles = await page.getByTestId("glass-surface").evaluate(
    (element) => ({
      outputDisplay: getComputedStyle(
        element.querySelector('canvas[role="presentation"]') as Element,
      ).display,
      fallbackDisplay: getComputedStyle(
        element.querySelector('[class*="fallbackLayer"]') as Element,
      ).display,
    }),
  );
  expect(accessibilityStyles).toEqual({
    outputDisplay: "none",
    fallbackDisplay: "block",
  });
  await expect(page.getByTestId("play-toggle")).toBeVisible();
});

test("@revision Stage A fixed crops remain directly reviewable", async ({
  page,
}, testInfo) => {
  const cropDirectory = resolve(
    revisionEvidenceRoot,
    "fixed-crops",
    evidenceRun,
    testInfo.project.name,
  );
  mkdirSync(cropDirectory, { recursive: true });

  await chooseMode(page, "canvas", "webgl");
  const surface = page.getByTestId("glass-surface");
  const captureCrop = async (name: string) => {
    const bounds = await surface.boundingBox();
    expect(bounds).not.toBeNull();
    const horizontalPadding = 48;
    const verticalPadding = 32;
    await page.screenshot({
      path: resolve(cropDirectory, `${name}.png`),
      clip: {
        x: (bounds?.x ?? 0) - horizontalPadding,
        y: (bounds?.y ?? 0) - verticalPadding,
        width: (bounds?.width ?? 0) + horizontalPadding * 2,
        height: (bounds?.height ?? 0) + verticalPadding * 2,
      },
    });
  };
  const captureStates = async (name: string) => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
    await captureCrop(`${name}-rest`);
    if (testInfo.project.name !== "chromium") return;
    await surface.hover({ position: { x: 185, y: 18 } });
    await page.waitForTimeout(120);
    await captureCrop(`${name}-hover`);
    const bounds = await surface.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move((bounds?.x ?? 0) + 185, (bounds?.y ?? 0) + 18);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await captureCrop(`${name}-press`);
    await page.mouse.up();
  };

  for (const scene of ["prism", "topography", "nocturne"] as const) {
    await chooseCanvasScene(page, scene);
    await captureStates(scene === "topography" ? "contours" : scene);
  }
  await chooseMode(page, "video", "webgl");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      video.pause();
      video.currentTime = 1;
    }
  });
  await page.waitForTimeout(250);
  await captureStates("video");
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
    `${revisionEvidenceRoot}/metrics`,
    evidenceRun,
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
