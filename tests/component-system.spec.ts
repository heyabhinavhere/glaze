import { expect, test, type Page } from "@playwright/test";

type Capability = "owned-decoration" | "explicit-media";

interface RendererDiagnostics {
  readonly rendererId: number;
  readonly frames: number;
  readonly mapRenders: number;
  readonly uploads: number;
  readonly controlCount: number;
  readonly settled: boolean;
  readonly controls: readonly {
    readonly id: string;
    readonly selectionCount: number;
    readonly selectedPosition: number;
    readonly targetPosition: number;
    readonly velocity: number;
    readonly settled: boolean;
  }[];
}

interface SurfaceSnapshot {
  readonly requested: Capability;
  readonly effective: Capability | "css-fallback";
  readonly reason?: string;
  readonly renderer?: RendererDiagnostics;
}

async function surfaceDiagnostics(
  page: Page,
  capability: Capability,
): Promise<SurfaceSnapshot | undefined> {
  return page.evaluate((requested) => {
    const harness = (
      window as Window & {
        __glazeComponentProof?: {
          surfaces: Partial<Record<Capability, {
            getDiagnostics(): SurfaceSnapshot;
          }>>;
        };
      }
    ).__glazeComponentProof;
    return harness?.surfaces[requested]?.getDiagnostics();
  }, capability);
}

async function openProof(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/component-proof");
  expect(response?.status()).toBe(200);
  const surfaces = page.locator("[data-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await expect(surface).toHaveAttribute("data-renderer", "webgl", {
      timeout: 15_000,
    });
  }
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
  return surfaces;
}

test("server output preserves the semantic proof before hydration", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one SSR request is enough");
  const response = await request.get("/component-proof");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("One accepted material. Two truthful sources.");
  expect(html).toContain('data-capability-requested="owned-decoration"');
  expect(html).toContain('data-capability-requested="explicit-media"');
  expect(html.match(/role="radiogroup"/g)).toHaveLength(2);
  expect(html.match(/role="switch"/g)).toHaveLength(2);
  expect(html.match(/type="range"/g)).toHaveLength(2);
  expect(html).toContain("/m1-flower.webm");
  expect(html).toContain("/m1-flower.mp4");
});

test("runs one renderer per source with three registered controls", async ({
  page,
}, testInfo) => {
  await openProof(page);
  await expect(page.locator('[data-control="segmented"]')).toHaveCount(2);
  await expect(page.locator('[data-control="switch"]')).toHaveCount(2);
  await expect(page.locator('[data-control="slider"]')).toHaveCount(2);

  const owned = await surfaceDiagnostics(page, "owned-decoration");
  const media = await surfaceDiagnostics(page, "explicit-media");
  expect(owned?.effective).toBe("owned-decoration");
  expect(media?.effective).toBe("explicit-media");
  expect(owned?.renderer?.rendererId).not.toBe(media?.renderer?.rendererId);

  for (const snapshot of [owned, media]) {
    const renderer = snapshot?.renderer;
    expect(renderer).toBeDefined();
    expect(renderer?.controlCount).toBe(3);
    expect(renderer?.controls.map((control) => control.selectionCount)).toEqual([
      3,
      2,
      6,
    ]);
    expect(renderer?.mapRenders).toBe(
      (renderer?.frames ?? 0) * (renderer?.controlCount ?? 0) * 2,
    );
  }

  const screenshotPath = testInfo.outputPath(
    `component-proof-${testInfo.project.name}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("full-viewport-proof", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("keeps one authoritative interactive tree and inert owned input", async ({
  page,
}) => {
  const surfaces = await openProof(page);
  const ownedInput = page.locator("[data-owned-decoration-input]");
  await expect(ownedInput).toHaveCount(1);
  await expect(ownedInput).toHaveAttribute("aria-hidden", "true");
  await expect(ownedInput.locator("svg")).toHaveCount(1);
  await expect(
    ownedInput.locator(
      "button,input,select,textarea,form,a[href],[id],[tabindex],[contenteditable]",
    ),
  ).toHaveCount(0);
  await expect(page.locator("[data-explicit-media-input='video']")).toHaveCount(1);
  await expect(page.locator("video source")).toHaveCount(2);

  for (const surface of await surfaces.all()) {
    await expect(surface.getByRole("radio")).toHaveCount(3);
    await expect(surface.getByRole("switch")).toHaveCount(1);
    await expect(surface.getByRole("slider")).toHaveCount(1);
    await expect(surface.locator("[id]")).toHaveCount(0);
  }

  const mechanics = await page.locator("[data-control]").evaluateAll((controls) =>
    controls.map((control) => {
      const style = getComputedStyle(control);
      const fallback = control.querySelector<HTMLElement>(
        "span[class*='fallbackSurface']",
      );
      return {
        background: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        backdropFilter: style.backdropFilter,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        fallbackDisplay: fallback ? getComputedStyle(fallback).display : null,
      };
    }),
  );
  for (const control of mechanics) {
    expect(control.background).toBe("none");
    expect(control.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(control.backdropFilter).toBe("none");
    expect(control.borderWidth).toBe("0px");
    expect(control.boxShadow).toBe("none");
    expect(control.fallbackDisplay).toBe("none");
  }
});

test("segmented, switch, and slider semantics drive the optical bodies", async ({
  page,
}) => {
  await openProof(page);
  const surface = page.locator(
    '[data-capability-requested="owned-decoration"]',
  );
  const group = surface.getByRole("radiogroup", { name: "View mode" });
  const flow = group.getByRole("radio", { name: "Flow" });
  const form = group.getByRole("radio", { name: "Form" });
  await expect(flow).toHaveAttribute("aria-checked", "true");
  await flow.focus();
  await flow.press("ArrowRight");
  await expect(form).toHaveAttribute("aria-checked", "true");
  await expect(group).toHaveAttribute("data-selected-position", "2");

  const moving = await surfaceDiagnostics(page, "owned-decoration");
  const movingSegmented = moving?.renderer?.controls.find((control) =>
    control.id.includes("segmented"),
  );
  expect(movingSegmented?.targetPosition).toBe(2);
  await expect.poll(async () => {
    const snapshot = await surfaceDiagnostics(page, "owned-decoration");
    return snapshot?.renderer?.controls.find((control) =>
      control.id.includes("segmented"),
    )?.settled;
  }).toBe(true);

  const switchControl = surface.getByRole("switch", { name: "Live optics" });
  await expect(switchControl).toHaveAttribute("aria-checked", "true");
  await switchControl.click();
  await expect(switchControl).toHaveAttribute("aria-checked", "false");

  const slider = surface.getByRole("slider", { name: "Transmission" });
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect.poll(async () => {
    const snapshot = await surfaceDiagnostics(page, "owned-decoration");
    return snapshot?.renderer?.controls.find((control) =>
      control.id.includes("slider"),
    )?.targetPosition;
  }).toBe(0);
});

test("static and paused sources stop rendering while live video follows frames", async ({
  page,
}) => {
  await openProof(page);
  await expect.poll(async () => {
    const snapshot = await surfaceDiagnostics(page, "explicit-media");
    return snapshot?.renderer?.frames ?? 0;
  }).toBeGreaterThan(2);

  const ownedBefore = await surfaceDiagnostics(page, "owned-decoration");
  const mediaBefore = await surfaceDiagnostics(page, "explicit-media");
  await page.waitForTimeout(300);
  const ownedAfter = await surfaceDiagnostics(page, "owned-decoration");
  const mediaAfter = await surfaceDiagnostics(page, "explicit-media");
  expect(ownedAfter?.renderer?.frames).toBe(ownedBefore?.renderer?.frames);
  expect(mediaAfter?.renderer?.frames).toBeGreaterThan(
    mediaBefore?.renderer?.frames ?? 0,
  );
  expect(mediaAfter?.renderer?.uploads).toBeGreaterThan(
    mediaBefore?.renderer?.uploads ?? 0,
  );

  await page.locator("video").evaluate((video) => video.pause());
  await page.waitForTimeout(80);
  const pausedBefore = await surfaceDiagnostics(page, "explicit-media");
  await page.waitForTimeout(300);
  const pausedAfter = await surfaceDiagnostics(page, "explicit-media");
  expect(pausedAfter?.renderer?.frames).toBe(pausedBefore?.renderer?.frames);
  expect(pausedAfter?.renderer?.uploads).toBe(pausedBefore?.renderer?.uploads);
});

test("reduced motion settles immediately without changing semantics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openProof(page);
  const surface = page.locator(
    '[data-capability-requested="owned-decoration"]',
  );
  await surface.getByRole("radio", { name: "Form" }).click();
  await expect.poll(async () => {
    const snapshot = await surfaceDiagnostics(page, "owned-decoration");
    const control = snapshot?.renderer?.controls.find((item) =>
      item.id.includes("segmented"),
    );
    return {
      position: control?.selectedPosition,
      target: control?.targetPosition,
      velocity: control?.velocity,
      settled: control?.settled,
    };
  }).toEqual({ position: 2, target: 2, velocity: 0, settled: true });
});

test("fallbacks and contract violations are truthful and visible", async ({
  page,
}) => {
  await page.goto("/component-proof?disableOptics=1");
  const surfaces = page.locator("[data-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await expect(surface).toHaveAttribute("data-renderer", "fallback");
    await expect(surface).toHaveAttribute(
      "data-capability-effective",
      "css-fallback",
    );
    await expect(surface).toHaveAttribute(
      "data-fallback-reason",
      "optics-disabled-by-test",
    );
  }
  await expect(page.locator("span[class*='fallbackSurface']")).toHaveCount(6);
  for (const fallback of await page.locator("span[class*='fallbackSurface']").all()) {
    await expect(fallback).toBeVisible();
  }

  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/component-proof?invalidOwned=1");
  const owned = page.locator(
    '[data-capability-requested="owned-decoration"]',
  );
  const media = page.locator(
    '[data-capability-requested="explicit-media"]',
  );
  await expect(owned).toHaveAttribute("data-renderer", "fallback");
  await expect(owned).toHaveAttribute(
    "data-fallback-reason",
    /owned-decoration-prohibits:\[id\]/,
  );
  await expect(media).toHaveAttribute("data-renderer", "webgl");
  if (process.env.COMPONENT_PROOF_PRODUCTION !== "1") {
    expect(warnings.some((warning) =>
      warning.includes("Invalid owned-decoration source"),
    )).toBe(true);
  }
});

test("context loss fails closed with an inspectable reason", async ({ page }) => {
  await openProof(page);
  await page.evaluate(() => {
    (
      window as Window & {
        __glazeComponentProof?: {
          surfaces: {
            "owned-decoration"?: { forceContextLoss(): void };
          };
        };
      }
    ).__glazeComponentProof?.surfaces["owned-decoration"]?.forceContextLoss();
  });
  const owned = page.locator(
    '[data-capability-requested="owned-decoration"]',
  );
  await expect(owned).toHaveAttribute("data-renderer", "fallback");
  await expect(owned).toHaveAttribute(
    "data-fallback-reason",
    "webgl-context-lost",
  );
});
