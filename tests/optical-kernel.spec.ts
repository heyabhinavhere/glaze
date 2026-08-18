import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

interface OpticalPixelMetrics {
  readonly background: string;
  readonly bodyMean: number;
  readonly trackBodyMean: number;
  readonly selectionBodyMean: number;
  readonly selectionToTrackRatio: number;
  readonly perimeterMean: number;
  readonly perimeterStrokeFraction: number;
  readonly outsideMean: number;
}

function capsuleDistance(x: number, y: number, width: number, height: number): number {
  const radius = height * 0.5;
  const qx = Math.abs(x - width * 0.5) - width * 0.5 + radius;
  const qy = Math.abs(y - height * 0.5);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function measureOpticalPixels(
  background: string,
  compositeBuffer: Buffer,
  sourceBuffer: Buffer,
  padding: number,
  controlWidth: number,
  controlHeight: number,
): OpticalPixelMetrics {
  const composite = PNG.sync.read(compositeBuffer);
  const source = PNG.sync.read(sourceBuffer);
  const body: number[] = [];
  const trackBody: number[] = [];
  const selectionBody: number[] = [];
  const perimeter: number[] = [];
  const outside: number[] = [];
  const scaleX = composite.width / (controlWidth + padding * 2);
  const scaleY = composite.height / (controlHeight + padding * 2);

  for (let y = 0; y < composite.height; y += 1) {
    for (let x = 0; x < composite.width; x += 1) {
      const index = (y * composite.width + x) * 4;
      const delta = (
        Math.abs(composite.data[index] - source.data[index])
        + Math.abs(composite.data[index + 1] - source.data[index + 1])
        + Math.abs(composite.data[index + 2] - source.data[index + 2])
      ) / 3;
      const distance = capsuleDistance(
        x / scaleX - padding,
        y / scaleY - padding,
        controlWidth,
        controlHeight,
      );
      const segmentWidth = (controlWidth - 8) / 3;
      const selectionWidth = segmentWidth - 3;
      const selectionHeight = controlHeight - 8;
      const selectionDistance = capsuleDistance(
        x / scaleX - padding - (controlWidth - selectionWidth) * 0.5,
        y / scaleY - padding - (controlHeight - selectionHeight) * 0.5,
        selectionWidth,
        selectionHeight,
      );
      if (distance < -8) {
        body.push(delta);
        if (selectionDistance < -6) selectionBody.push(delta);
        else if (selectionDistance > 4) trackBody.push(delta);
      }
      else if (Math.abs(distance) <= 1.5) perimeter.push(delta);
      else if (distance >= 5) outside.push(delta);
    }
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    background,
    bodyMean: mean(body),
    trackBodyMean: mean(trackBody),
    selectionBodyMean: mean(selectionBody),
    selectionToTrackRatio: mean(selectionBody) / Math.max(mean(trackBody), 0.001),
    perimeterMean: mean(perimeter),
    perimeterStrokeFraction: perimeter.filter((value) => value >= 28).length / perimeter.length,
    outsideMean: mean(outside),
  };
}

async function openKernel(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/optical-kernel");
  const stage = page.locator("section[data-renderer]");
  await expect(stage).toHaveAttribute("data-renderer", "webgl");
  await expect(stage).toHaveAttribute("data-optical-map", "glaze-optical-map-r2");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  return stage;
}

test("renders a real-size semantic WebGL optical control", async ({ page }, testInfo) => {
  const stage = await openKernel(page);
  const control = page.getByRole("radiogroup", { name: "Optical mode" });
  const output = page.locator("canvas[data-optical-output]");
  const fallback = control.locator("div").first();

  await expect(control).toBeVisible();
  await expect(output).toBeVisible();
  await expect(control.getByRole("radio")).toHaveCount(3);
  await expect(control.getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");

  const mechanics = await page.evaluate(() => {
    const controlElement = document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Optical mode"]');
    const outputElement = document.querySelector<HTMLCanvasElement>("canvas[data-optical-output]");
    const option = controlElement?.querySelector<HTMLElement>('[role="radio"]');
    if (!controlElement || !outputElement || !option) return null;
    const controlStyle = getComputedStyle(controlElement);
    const optionStyle = getComputedStyle(option);
    const rect = controlElement.getBoundingClientRect();
    return {
      rect: { width: rect.width, height: rect.height },
      output: { width: outputElement.width, height: outputElement.height },
      control: {
        background: controlStyle.backgroundImage,
        backdropFilter: controlStyle.backdropFilter,
        borderTopWidth: controlStyle.borderTopWidth,
        boxShadow: controlStyle.boxShadow,
      },
      option: {
        background: optionStyle.backgroundImage,
        backgroundColor: optionStyle.backgroundColor,
        borderTopWidth: optionStyle.borderTopWidth,
        boxShadow: optionStyle.boxShadow,
      },
    };
  });

  expect(mechanics).not.toBeNull();
  expect(mechanics?.rect).toEqual({ width: 320, height: 64 });
  expect(mechanics?.output.width).toBeGreaterThanOrEqual(1280);
  expect(mechanics?.output.height).toBeGreaterThanOrEqual(720);
  expect(mechanics?.control).toEqual({
    background: "none",
    backdropFilter: "none",
    borderTopWidth: "0px",
    boxShadow: "none",
  });
  expect(mechanics?.option).toEqual({
    background: "none",
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopWidth: "0px",
    boxShadow: "none",
  });
  await expect(fallback).toBeHidden();

  const screenshotPath = testInfo.outputPath("optical-kernel-desktop.png");
  await page.screenshot({ animations: "disabled", path: screenshotPath });
  await testInfo.attach("optical-kernel-desktop", { path: screenshotPath, contentType: "image/png" });
  await expect(stage).toHaveAttribute("data-renderer", "webgl");
});

test("switches across a four-source matrix without changing the optical material", async ({ page }, testInfo) => {
  const stage = await openKernel(page);
  const sourcePicker = page.getByRole("radiogroup", { name: "Background scene" });
  const opticalControl = page.getByRole("radiogroup", { name: "Optical mode" });
  const backgrounds = [
    { id: "reference", label: "Reference" },
    { id: "architecture", label: "Architecture" },
    { id: "color", label: "Color" },
    { id: "dark", label: "Dark" },
  ] as const;

  await expect(sourcePicker.getByRole("radio")).toHaveCount(backgrounds.length);
  await expect(opticalControl.getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");

  const initialDiagnostics = await page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): { frames: number; mapRenders: number; uploads: number };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());

  for (const background of backgrounds) {
    await sourcePicker.getByRole("radio", { name: background.label }).click();
    await expect(stage).toHaveAttribute("data-background", background.id);
    await expect(stage).toHaveAttribute("data-background-ready", "true");
    await expect(stage).toHaveAttribute("data-renderer", "webgl");
    await expect(opticalControl.getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");
    await page.waitForTimeout(80);

    const screenshotPath = testInfo.outputPath(`background-${background.id}.png`);
    await page.screenshot({ animations: "disabled", path: screenshotPath });
    await testInfo.attach(`background-${background.id}`, { path: screenshotPath, contentType: "image/png" });
  }

  const finalDiagnostics = await page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): { frames: number; mapRenders: number; uploads: number };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());
  expect(initialDiagnostics).toBeDefined();
  expect(finalDiagnostics).toBeDefined();
  expect(finalDiagnostics?.frames).toBeGreaterThan(initialDiagnostics?.frames ?? 0);
  expect(finalDiagnostics?.uploads).toBeGreaterThan(initialDiagnostics?.uploads ?? 0);
  expect(finalDiagnostics?.mapRenders).toBe((finalDiagnostics?.frames ?? 0) * 2);
});

test("keeps the body visible without drawing a continuous perimeter", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const stage = await openKernel(page);
  const sourcePicker = page.getByRole("radiogroup", { name: "Background scene" });
  const opticalControl = page.getByRole("radiogroup", { name: "Optical mode" });
  const output = page.locator("canvas[data-optical-output]");
  const padding = 12;
  const metrics: OpticalPixelMetrics[] = [];

  await opticalControl.getByRole("radio").evaluateAll((buttons) => {
    for (const button of buttons) button.style.visibility = "hidden";
  });

  for (const background of ["Reference", "Architecture", "Color", "Dark"] as const) {
    await sourcePicker.getByRole("radio", { name: background }).click();
    await expect(stage).toHaveAttribute("data-background-ready", "true");
    await page.waitForTimeout(80);
    const bounds = await opticalControl.boundingBox();
    if (!bounds) throw new Error("missing-optical-control-bounds");
    const clip = {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    };
    const composite = await page.screenshot({ animations: "disabled", clip });
    await output.evaluate((canvas) => { canvas.style.visibility = "hidden"; });
    const source = await page.screenshot({ animations: "disabled", clip });
    await output.evaluate((canvas) => { canvas.style.visibility = "visible"; });
    metrics.push(measureOpticalPixels(background.toLowerCase(), composite, source, padding, bounds.width, bounds.height));
  }

  await testInfo.attach("optical-pixel-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
  for (const result of metrics) {
    expect(result.bodyMean, `${result.background} body should visibly alter source pixels`).toBeGreaterThan(5);
    expect(result.selectionBodyMean, `${result.background} selected lens should remain visible at actual size`).toBeGreaterThan(12);
    expect(result.selectionToTrackRatio, `${result.background} selected lens should read as thicker than the track`).toBeGreaterThan(1.5);
    expect(result.perimeterMean, `${result.background} edge energy should stay bounded`).toBeLessThan(34);
    expect(result.perimeterStrokeFraction, `${result.background} edge should not form a uniform bright contour`).toBeLessThan(0.55);
    expect(result.outsideMean, `${result.background} pixels outside the material should remain unchanged`).toBeLessThan(0.75);
  }
});

test("selection travels with click and keyboard while DOM semantics stay authoritative", async ({ page }, testInfo) => {
  await openKernel(page);
  const group = page.getByRole("radiogroup", { name: "Optical mode" });
  const flow = page.getByRole("radio", { name: "Flow" });
  const form = page.getByRole("radio", { name: "Form" });
  const focus = page.getByRole("radio", { name: "Focus" });

  const captureMotionSample = async (name: string) => {
    const box = await group.boundingBox();
    if (!box) throw new Error("missing-control-bounds");
    const screenshotPath = testInfo.outputPath(`${name}.png`);
    await page.screenshot({
      animations: "allow",
      clip: {
        x: Math.max(0, box.x - 22),
        y: Math.max(0, box.y - 22),
        width: box.width + 44,
        height: box.height + 44,
      },
      path: screenshotPath,
    });
    await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
  };

  await captureMotionSample("motion-00-rest");
  await form.click();
  await expect(form).toHaveAttribute("aria-checked", "true");
  await expect(group).toHaveAttribute("data-selected-index", "2");
  await page.waitForTimeout(45);
  const moving = await page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): {
          selectedPosition: number;
          selectionVelocity: number;
          frames: number;
          settled: boolean;
        };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());
  expect(moving).toBeDefined();
  expect(moving?.selectedPosition).toBeGreaterThan(1);
  expect(moving?.selectedPosition).toBeLessThan(2.2);
  expect(Math.abs(moving?.selectionVelocity ?? 0)).toBeGreaterThan(0.02);
  expect(moving?.settled).toBe(false);

  await captureMotionSample("motion-01-departure");
  await page.waitForTimeout(55);
  await captureMotionSample("motion-02-travel");
  await expect.poll(async () => page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: { getDiagnostics(): { settled: boolean } };
    }
  ).__glazeOpticalKernel?.getDiagnostics().settled), { timeout: 2_000 }).toBe(true);
  await captureMotionSample("motion-03-settled");

  await form.press("ArrowRight");
  await expect(focus).toHaveAttribute("aria-checked", "true");
  await expect(focus).toBeFocused();
  await expect(group).toHaveAttribute("data-selected-index", "0");

  await focus.press("End");
  await expect(form).toHaveAttribute("aria-checked", "true");
  await form.press("Home");
  await expect(focus).toHaveAttribute("aria-checked", "true");
  await expect(flow).toHaveAttribute("aria-checked", "false");
});

test("static sources and settled springs stop all idle rendering", async ({ page }) => {
  await openKernel(page);
  const readDiagnostics = () => page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): {
          frames: number;
          mapRenders: number;
          uploads: number;
          settled: boolean;
          lastRenderMs: number;
          maxRenderMs: number;
        };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());
  await expect.poll(async () => (await readDiagnostics())?.settled).toBe(true);
  const before = await readDiagnostics();
  await page.waitForTimeout(300);
  const after = await readDiagnostics();
  expect(before).toBeDefined();
  expect(after).toBeDefined();
  expect(after?.frames).toBe(before?.frames);
  expect(after?.mapRenders).toBe(before?.mapRenders);
  expect(after?.uploads).toBe(before?.uploads);
  expect(after?.mapRenders).toBe((after?.frames ?? 0) * 2);
  expect(after?.lastRenderMs).toBeGreaterThan(0);
  expect(after?.maxRenderMs).toBeGreaterThanOrEqual(after?.lastRenderMs ?? 0);
});

test("compact layout keeps the authored control visible without horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openKernel(page);
  const geometry = await page.getByRole("radiogroup", { name: "Optical mode" }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      viewportWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(geometry).toMatchObject({ width: 320, height: 64, viewportWidth: 390, overflow: false });
  expect(geometry.left).toBeGreaterThanOrEqual(16);
  expect(geometry.right).toBeLessThanOrEqual(374);

  const sourcePickerGeometry = await page.getByRole("radiogroup", { name: "Background scene" }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  });
  expect(sourcePickerGeometry.left).toBeGreaterThanOrEqual(16);
  expect(sourcePickerGeometry.right).toBeLessThanOrEqual(374);
  expect(sourcePickerGeometry.width).toBeLessThanOrEqual(358);

  const screenshotPath = testInfo.outputPath("optical-kernel-compact.png");
  await page.screenshot({ animations: "disabled", path: screenshotPath });
  await testInfo.attach("optical-kernel-compact", { path: screenshotPath, contentType: "image/png" });
});

test("reduced motion snaps selection without velocity deformation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openKernel(page);
  await page.getByRole("radio", { name: "Form" }).click();
  await expect(page.getByRole("radio", { name: "Form" })).toHaveAttribute("aria-checked", "true");
  await page.waitForTimeout(34);

  const diagnostics = await page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): { selectedPosition: number; selectionVelocity: number };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());

  expect(diagnostics).toBeDefined();
  expect(diagnostics?.selectedPosition).toBe(2);
  expect(diagnostics?.selectionVelocity).toBe(0);
});

test("WebGL2 initialization failure preserves a truthful usable fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return nativeGetContext.call(this, type as "2d", ...args as []) as ReturnType<typeof nativeGetContext>;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/optical-kernel");
  const stage = page.locator("section[data-renderer]");
  await expect(stage).toHaveAttribute("data-renderer", "fallback");
  await expect(stage).toHaveAttribute("data-fallback-reason", "webgl2-unavailable");
  const control = page.getByRole("radiogroup", { name: "Optical mode" });
  await expect(control.getByRole("radio")).toHaveCount(3);
  await control.getByRole("radio", { name: "Form" }).click();
  await expect(control.getByRole("radio", { name: "Form" })).toHaveAttribute("aria-checked", "true");
});

test("context loss fails closed to the semantic fallback", async ({ page }) => {
  await openKernel(page);
  await page.evaluate(() => {
    (window as Window & { __glazeOpticalKernel?: { forceContextLoss(): void } }).__glazeOpticalKernel?.forceContextLoss();
  });
  const stage = page.locator("section[data-renderer]");
  await expect(stage).toHaveAttribute("data-renderer", "fallback");
  await expect(stage).toHaveAttribute("data-fallback-reason", "webgl-context-lost");
  await expect(page.getByRole("radiogroup", { name: "Optical mode" }).getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");
});
