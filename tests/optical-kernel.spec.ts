import { expect, test, type Page } from "@playwright/test";

async function openKernel(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/optical-kernel");
  const stage = page.locator("section[data-renderer]");
  await expect(stage).toHaveAttribute("data-renderer", "webgl");
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
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");

  const mechanics = await page.evaluate(() => {
    const controlElement = document.querySelector<HTMLElement>('[role="radiogroup"]');
    const outputElement = document.querySelector<HTMLCanvasElement>("canvas[data-optical-output]");
    const option = document.querySelector<HTMLElement>('[role="radio"]');
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
        getDiagnostics(): { selectedPosition: number; selectionVelocity: number; frames: number };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());
  expect(moving).toBeDefined();
  expect(moving?.selectedPosition).toBeGreaterThan(1);
  expect(moving?.selectedPosition).toBeLessThan(2.2);
  expect(Math.abs(moving?.selectionVelocity ?? 0)).toBeGreaterThan(0.05);

  await captureMotionSample("motion-01-departure");
  await page.waitForTimeout(55);
  await captureMotionSample("motion-02-travel");
  await page.waitForTimeout(420);
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

test("the owned source and optical output keep advancing together", async ({ page }) => {
  await openKernel(page);
  const readDiagnostics = () => page.evaluate(() => (
    window as Window & {
      __glazeOpticalKernel?: {
        getDiagnostics(): { frames: number; uploads: number; lastRenderMs: number; maxRenderMs: number };
      };
    }
  ).__glazeOpticalKernel?.getDiagnostics());
  const before = await readDiagnostics();
  await page.waitForTimeout(240);
  const after = await readDiagnostics();
  expect(before).toBeDefined();
  expect(after).toBeDefined();
  expect((after?.frames ?? 0) - (before?.frames ?? 0)).toBeGreaterThan(4);
  expect(after?.uploads).toBe(after?.frames);
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
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio", { name: "Form" }).click();
  await expect(page.getByRole("radio", { name: "Form" })).toHaveAttribute("aria-checked", "true");
});

test("context loss fails closed to the semantic fallback", async ({ page }) => {
  await openKernel(page);
  await page.evaluate(() => {
    (window as Window & { __glazeOpticalKernel?: { forceContextLoss(): void } }).__glazeOpticalKernel?.forceContextLoss();
  });
  const stage = page.locator("section[data-renderer]");
  await expect(stage).toHaveAttribute("data-renderer", "fallback");
  await expect(stage).toHaveAttribute("data-fallback-reason", "webgl-context-lost");
  await expect(page.getByRole("radio", { name: "Flow" })).toHaveAttribute("aria-checked", "true");
});
