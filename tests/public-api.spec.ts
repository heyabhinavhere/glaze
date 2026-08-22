import { expect, test, type Page } from "@playwright/test";

async function openWorkbench(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/workbench");
  expect(response?.status()).toBe(200);
  const surfaces = page.locator("[data-glaze-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
      timeout: 15_000,
    });
    await expect(surface).toHaveAttribute("data-glaze-control-count", "3");
  }
  await expect(page.locator("[data-glaze-workbench='true']")).toBeVisible();
  await expect(page.locator(".glaze-workbench__runtime")).toContainText(
    "owned-decoration → owned-decoration",
  );
  await expect(page.locator(".glaze-workbench__runtime")).toContainText(
    "explicit-media → explicit-media",
  );
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
  return surfaces;
}

async function openLifecycleFixture(page: Page) {
  const response = await page.goto("/public-api-fixtures");
  expect(response?.status()).toBe(200);
  const surface = page.locator("[data-fixture-surface='true']");
  await expect(surface).toHaveCount(1);
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
    timeout: 15_000,
  });
  return surface;
}

test("server output exposes truthful source and semantic contracts", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one SSR request is enough");
  const response = await request.get("/workbench");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("The live material is now the workbench.");
  expect(html).toContain(
    'data-glaze-capability-requested="owned-decoration"',
  );
  expect(html).toContain(
    'data-glaze-capability-requested="explicit-media"',
  );
  expect(html.match(/role="radiogroup"/g)?.length).toBeGreaterThanOrEqual(2);
  expect(html.match(/role="switch"/g)).toHaveLength(2);
  expect(html.match(/type="range"/g)?.length).toBeGreaterThanOrEqual(2);
  expect(html).toContain("/m1-flower.webm");
  expect(html).toContain("/m1-flower.mp4");
});

test("uses one renderer per source and one authoritative control tree", async ({
  page,
}, testInfo) => {
  const surfaces = await openWorkbench(page);
  const rendererIds = await surfaces.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-glaze-renderer-id")),
  );
  expect(rendererIds.every(Boolean)).toBe(true);
  expect(new Set(rendererIds).size).toBe(2);

  const ownedInput = page.locator("[data-glaze-owned-decoration='true']");
  await expect(ownedInput).toHaveCount(1);
  await expect(ownedInput).toHaveAttribute("aria-hidden", "true");
  await expect(ownedInput.locator("svg")).toHaveCount(1);
  await expect(
    ownedInput.locator(
      "button,input,select,textarea,form,a[href],[id],[tabindex],[contenteditable]",
    ),
  ).toHaveCount(0);

  for (const surface of await surfaces.all()) {
    await expect(surface.getByRole("radio")).toHaveCount(3);
    await expect(surface.getByRole("switch")).toHaveCount(1);
    await expect(surface.getByRole("slider")).toHaveCount(1);
    await expect(surface.locator("canvas[data-glaze-output]")).toHaveCount(1);
  }

  const screenshotPath = testInfo.outputPath(
    `public-workbench-${testInfo.project.name}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("full-viewport-public-workbench", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("controlled parent rerenders do not replace either source renderer", async ({
  page,
}) => {
  const surfaces = await openWorkbench(page);
  const before = await surfaces.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-glaze-renderer-id")),
  );

  const owned = surfaces.filter({
    has: page.getByRole("radiogroup", { name: "Owned source view mode" }),
  });
  await owned.locator("form").evaluate((form) => {
    let submissions = 0;
    form.addEventListener("submit", () => { submissions += 1; });
    Object.defineProperty(form, "__glazeSubmissions", {
      get: () => submissions,
    });
  });
  await owned.getByRole("radio", { name: "Form" }).click();
  await owned.getByRole("switch", { name: "Owned source live optics" }).click();
  await owned.getByRole("slider", { name: "Owned source transmission" }).fill("37");
  await expect(
    owned.getByRole("radio", { name: "Form" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    owned.getByRole("slider", { name: "Owned source transmission" }),
  ).toHaveValue("37");
  expect(await owned.locator("form").evaluate(
    (form) => (form as HTMLFormElement & { __glazeSubmissions?: number })
      .__glazeSubmissions,
  )).toBe(0);

  const after = await surfaces.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-glaze-renderer-id")),
  );
  expect(after).toEqual(before);
});

test("semantic controls preserve native keyboard and form behavior", async ({
  page,
}) => {
  const surfaces = await openWorkbench(page);
  const owned = surfaces.filter({
    has: page.getByRole("radiogroup", { name: "Owned source view mode" }),
  });
  const flow = owned.getByRole("radio", { name: "Flow" });
  await flow.focus();
  await flow.press("ArrowRight");
  const form = owned.getByRole("radio", { name: "Form" });
  await expect(form).toHaveAttribute("aria-checked", "true");
  await expect(form).toBeFocused();
  await form.press("Home");
  await expect(owned.getByRole("radio", { name: "Focus" })).toBeFocused();

  const live = owned.getByRole("switch", { name: "Owned source live optics" });
  const before = await live.getAttribute("aria-checked");
  await live.focus();
  await live.press("Space");
  await expect(live).toHaveAttribute(
    "aria-checked",
    before === "true" ? "false" : "true",
  );
});

test("workbench edits and exports the live material without replacing renderers", async ({
  page,
}) => {
  const surfaces = await openWorkbench(page);
  const beforeIds = await surfaces.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-glaze-renderer-id")),
  );
  const owned = surfaces.nth(0);
  const before = await owned.screenshot();

  const refraction = page.getByRole("slider", { name: "Refraction" });
  await refraction.fill("0");
  await expect(page.locator(".glaze-workbench__export code")).toContainText(
    '"refraction": 0',
  );
  await page.waitForTimeout(100);
  const after = await owned.screenshot();
  expect(after.equals(before)).toBe(false);

  const afterIds = await surfaces.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-glaze-renderer-id")),
  );
  expect(afterIds).toEqual(beforeIds);
});

test("restores a lost WebGL context with a fresh renderer", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one lifecycle probe is enough");
  const surfaces = await openWorkbench(page);
  const owned = surfaces.nth(0);
  const before = await owned.getAttribute("data-glaze-renderer-id");
  const supported = await owned.locator("canvas[data-glaze-output]").evaluate(
    (canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      window.setTimeout(() => extension.restoreContext(), 80);
      return true;
    },
  );
  test.skip(!supported, "WEBGL_lose_context is unavailable");
  await expect(owned).toHaveAttribute("data-glaze-renderer", "webgl", {
    timeout: 10_000,
  });
  await expect.poll(
    () => owned.getAttribute("data-glaze-renderer-id"),
  ).not.toBe(before);
});

test("forced colors selects and explains the semantic CSS fallback", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one preference probe is enough");
  await page.emulateMedia({ forcedColors: "active" });
  const response = await page.goto("/workbench");
  expect(response?.status()).toBe(200);
  const surfaces = page.locator("[data-glaze-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await expect(surface).toHaveAttribute("data-glaze-renderer", "fallback");
    await expect(surface).toHaveAttribute(
      "data-glaze-capability-effective",
      "css-fallback",
    );
    await expect(surface).toHaveAttribute(
      "data-glaze-fallback",
      "forced-colors-active",
    );
  }
  await expect(page.getByRole("radiogroup", { name: "Owned source view mode" }))
    .toBeVisible();
});

test("unavailable WebGL keeps a visible and truthful semantic fallback", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one unsupported probe is enough");
  await page.addInitScript(() => {
    const prototype = HTMLCanvasElement.prototype;
    const original = prototype.getContext;
    Object.defineProperty(prototype, "getContext", {
      configurable: true,
      value: function getContext(contextId: string, ...args: unknown[]) {
        if (contextId === "webgl2") return null;
        return Reflect.apply(original, this, [contextId, ...args]);
      },
    });
  });
  const response = await page.goto("/workbench");
  expect(response?.status()).toBe(200);
  const surfaces = page.locator("[data-glaze-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await expect(surface).toHaveAttribute("data-glaze-renderer", "fallback");
    await expect(surface).toHaveAttribute(
      "data-glaze-capability-effective",
      "css-fallback",
    );
    await expect(surface).toHaveAttribute(
      "data-glaze-fallback",
      "webgl2-unavailable",
    );
    await expect(surface.getByRole("radio")).toHaveCount(3);
    await expect(surface.getByRole("switch")).toBeVisible();
    await expect(surface.getByRole("slider")).toBeVisible();
  }
  const screenshotPath = testInfo.outputPath("webgl-disabled-fallback.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("webgl-disabled-fallback", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("all sources stop scheduling frames when the video and springs are idle", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one idle-loop probe is enough");
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    let scheduled = 0;
    Object.defineProperty(window, "__glazeRafCount", {
      get: () => scheduled,
    });
    window.requestAnimationFrame = (callback) => {
      scheduled += 1;
      return original(callback);
    };
  });
  await openWorkbench(page);
  await page.locator("video").evaluate((video) => video.pause());
  await page.waitForTimeout(350);
  const before = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount,
  );
  await page.waitForTimeout(350);
  const after = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount,
  );
  expect(after).toBe(before);
});

test("runtime DOM contract violations fail visibly to CSS", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one contract probe is enough");
  const surfaces = await openWorkbench(page);
  const owned = surfaces.nth(0);
  await page.locator("[data-glaze-owned-decoration] svg").evaluate((svg) => {
    svg.setAttribute("id", "invalid-owned-source");
  });
  await page.setViewportSize({ width: 1439, height: 1100 });
  await expect(owned).toHaveAttribute("data-glaze-renderer", "fallback");
  await expect(owned).toHaveAttribute(
    "data-glaze-fallback",
    /owned-decoration-prohibits:\[id\]/,
  );
});

test("same-kind replacement reuses its renderer while source-kind changes rebuild it", async ({
  page,
}) => {
  const surface = await openLifecycleFixture(page);
  const initialRenderer = await surface.getAttribute("data-glaze-renderer-id");

  await page.getByRole("button", { name: "Image B" }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl");
  await expect(surface).toHaveAttribute(
    "data-glaze-renderer-id",
    initialRenderer ?? "",
  );

  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl");
  const canvasRenderer = await surface.getAttribute("data-glaze-renderer-id");
  expect(canvasRenderer).not.toBe(initialRenderer);

  const sourceCanvas = surface.locator("canvas[data-glaze-source]");
  const before = await sourceCanvas.evaluate((canvas) =>
    Array.from(
      (canvas as HTMLCanvasElement).getContext("2d")
        ?.getImageData(2, 2, 1, 1).data ?? [],
    )
  );
  await page.getByRole("button", { name: "Redraw canvas" }).click();
  await expect(page.locator("main")).toHaveAttribute(
    "data-fixture-canvas-version",
    "1",
  );
  await expect.poll(() => sourceCanvas.evaluate((canvas) =>
    Array.from(
      (canvas as HTMLCanvasElement).getContext("2d")
        ?.getImageData(2, 2, 1, 1).data ?? [],
    )
  )).not.toEqual(before);
  await expect(surface).toHaveAttribute(
    "data-glaze-renderer-id",
    canvasRenderer ?? "",
  );

  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
    timeout: 15_000,
  });
  expect(await surface.getAttribute("data-glaze-renderer-id"))
    .not.toBe(canvasRenderer);
});

test("tainted media fails truthfully and a clean replacement recovers", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one CORS probe is enough");
  const surface = await openLifecycleFixture(page);
  const renderer = await surface.getAttribute("data-glaze-renderer-id");

  await page.getByRole("button", { name: "Tainted image" }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "fallback", {
    timeout: 15_000,
  });
  await expect(surface).toHaveAttribute(
    "data-glaze-fallback",
    "source-not-origin-clean",
  );
  await expect(surface).toHaveAttribute(
    "data-glaze-capability-effective",
    "css-fallback",
  );

  await page.getByRole("button", { name: "Image A" }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
    timeout: 15_000,
  });
  await expect(surface).toHaveAttribute(
    "data-glaze-renderer-id",
    renderer ?? "",
  );
  await expect(surface).not.toHaveAttribute("data-glaze-fallback");
});

test("high-DPR resize updates backing stores without replacing the renderer", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one DPR probe is enough");
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1000, height: 800 },
  });
  const page = await context.newPage();
  try {
    const surface = await openLifecycleFixture(page);
    const renderer = await surface.getAttribute("data-glaze-renderer-id");
    const output = surface.locator("canvas[data-glaze-output]");
    const backingRatio = () => output.evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      return element.width / element.getBoundingClientRect().width;
    });
    await expect.poll(backingRatio).toBeCloseTo(2, 1);
    const beforeWidth = await output.evaluate(
      (canvas) => (canvas as HTMLCanvasElement).width,
    );

    await page.getByRole("button", { name: "Toggle width" }).click();
    await expect.poll(() => output.evaluate(
      (canvas) => (canvas as HTMLCanvasElement).width,
    )).toBeGreaterThan(beforeWidth);
    await expect.poll(backingRatio).toBeCloseTo(2, 1);
    await expect(surface).toHaveAttribute(
      "data-glaze-renderer-id",
      renderer ?? "",
    );
  } finally {
    await context.close();
  }
});

test("reduced motion settles a selection change without a continuing frame loop", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one motion probe is enough");
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    let scheduled = 0;
    Object.defineProperty(window, "__glazeRafCount", {
      get: () => scheduled,
    });
    window.requestAnimationFrame = (callback) => {
      scheduled += 1;
      return original(callback);
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const surface = await openLifecycleFixture(page);
  await expect(
    surface.locator("[data-glaze-diagnostic='reduced-motion'] dd"),
  ).toHaveText("On");
  await page.waitForTimeout(120);
  const before = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  await surface.getByRole("radio", { name: "Second" }).click();
  await expect(
    surface.getByRole("radio", { name: "Second" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.waitForTimeout(120);
  const after = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  await page.waitForTimeout(160);
  const settled = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  expect(after - before).toBeLessThanOrEqual(4);
  expect(settled).toBe(after);
});

test("offscreen media suspends source and render scheduling", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one suspension probe is enough");
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    let scheduled = 0;
    Object.defineProperty(window, "__glazeRafCount", {
      get: () => scheduled,
    });
    window.requestAnimationFrame = (callback) => {
      scheduled += 1;
      return original(callback);
    };
  });
  const surface = await openLifecycleFixture(page);
  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
    timeout: 15_000,
  });
  await expect.poll(() => page.locator("video").evaluate(
    (video) => !(video as HTMLVideoElement).paused,
  )).toBe(true);
  const runningBefore = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  await page.waitForTimeout(250);
  const runningAfter = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  expect(runningAfter).toBeGreaterThan(runningBefore);

  await page.locator("[data-fixture-offscreen]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const offscreenBefore = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  await page.waitForTimeout(350);
  const offscreenAfter = await page.evaluate(
    () => (window as Window & { __glazeRafCount?: number }).__glazeRafCount ?? 0,
  );
  expect(offscreenAfter).toBe(offscreenBefore);
});

test("unmount disconnects surface observers and removes renderer output", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one cleanup probe is enough");
  await page.addInitScript(() => {
    let resizeTargets = 0;
    let intersectionTargets = 0;
    const NativeResizeObserver = window.ResizeObserver;
    const NativeIntersectionObserver = window.IntersectionObserver;

    class CountingResizeObserver extends NativeResizeObserver {
      private readonly targets = new Set<Element>();
      override observe(target: Element, options?: ResizeObserverOptions) {
        if (!this.targets.has(target)) {
          this.targets.add(target);
          resizeTargets += 1;
        }
        super.observe(target, options);
      }
      override unobserve(target: Element) {
        if (this.targets.delete(target)) resizeTargets -= 1;
        super.unobserve(target);
      }
      override disconnect() {
        resizeTargets -= this.targets.size;
        this.targets.clear();
        super.disconnect();
      }
    }

    class CountingIntersectionObserver extends NativeIntersectionObserver {
      private readonly targets = new Set<Element>();
      override observe(target: Element) {
        if (!this.targets.has(target)) {
          this.targets.add(target);
          intersectionTargets += 1;
        }
        super.observe(target);
      }
      override unobserve(target: Element) {
        if (this.targets.delete(target)) intersectionTargets -= 1;
        super.unobserve(target);
      }
      override disconnect() {
        intersectionTargets -= this.targets.size;
        this.targets.clear();
        super.disconnect();
      }
    }

    window.ResizeObserver = CountingResizeObserver;
    window.IntersectionObserver = CountingIntersectionObserver;
    Object.defineProperty(window, "__glazeObserverCounts", {
      get: () => ({ resizeTargets, intersectionTargets }),
    });
  });
  await openLifecycleFixture(page);
  const mounted = await page.evaluate(() =>
    (window as Window & {
      __glazeObserverCounts?: { resizeTargets: number; intersectionTargets: number };
    }).__glazeObserverCounts
  );
  expect(mounted?.resizeTargets).toBeGreaterThanOrEqual(1);
  expect(mounted?.intersectionTargets).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: "Unmount surface" }).click();
  await expect(page.locator("[data-fixture-surface]")).toHaveCount(0);
  await expect(page.locator("canvas[data-glaze-output]")).toHaveCount(0);
  const baseline = {
    resizeTargets: (mounted?.resizeTargets ?? 1) - 1,
    intersectionTargets: (mounted?.intersectionTargets ?? 1) - 1,
  };
  await expect.poll(() => page.evaluate(() =>
    (window as Window & {
      __glazeObserverCounts?: { resizeTargets: number; intersectionTargets: number };
    }).__glazeObserverCounts
  )).toEqual(baseline);

  await page.getByRole("button", { name: "Mount surface" }).click();
  await expect(page.locator("[data-fixture-surface]")).toHaveAttribute(
    "data-glaze-renderer",
    "webgl",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Unmount surface" }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & {
      __glazeObserverCounts?: { resizeTargets: number; intersectionTargets: number };
    }).__glazeObserverCounts
  )).toEqual(baseline);
});
