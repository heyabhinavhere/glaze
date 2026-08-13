import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const visualEvidenceRoot = ".gstack/evidence/v1/visual";
mkdirSync(visualEvidenceRoot, { recursive: true });

declare global {
  interface Window {
    __glazeAudit?: {
      activeMediaListeners: number;
    };
  }
}

const collectRuntimeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const audit = { activeMediaListeners: 0 };
    window.__glazeAudit = audit;
    const listeners = new WeakMap<MediaQueryList, Set<EventListenerOrEventListenerObject>>();
    const originalAdd = MediaQueryList.prototype.addEventListener;
    const originalRemove = MediaQueryList.prototype.removeEventListener;

    MediaQueryList.prototype.addEventListener = function (...args) {
      const listener = args[1];
      if (args[0] === "change" && listener) {
        const owned = listeners.get(this) ?? new Set();
        if (!owned.has(listener)) {
          owned.add(listener);
          listeners.set(this, owned);
          audit.activeMediaListeners += 1;
        }
      }
      return originalAdd.apply(this, args);
    };

    MediaQueryList.prototype.removeEventListener = function (...args) {
      const listener = args[1];
      const owned = listeners.get(this);
      if (args[0] === "change" && listener && owned?.delete(listener)) {
        audit.activeMediaListeners -= 1;
      }
      return originalRemove.apply(this, args);
    };
  });
});

test("SSR and hydration preserve the semantic acceptance matrix", async ({
  browserName,
  page,
  request,
}) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("One material. Five hard scenes.");
  expect(html.match(/role="radiogroup"/g)).toHaveLength(5);
  expect(html.match(/data-glaze-capability="css"/g)).toHaveLength(5);

  const errors = collectRuntimeErrors(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "One material. Five hard scenes." }),
  ).toBeVisible();
  await expect(page.getByRole("radiogroup")).toHaveCount(5);
  await expect(page.getByRole("radio")).toHaveCount(15);
  await expect(page.locator("[data-scene]")).toHaveCount(5);
  await expect(page.locator("[data-glaze-fallback]")).toHaveCount(0);
  if (browserName === "chromium") {
    await page.screenshot({
      path: `${visualEvidenceRoot}/${
        process.env.V1_PRODUCTION === "1" ? "production" : "development"
      }-desktop-chromium.png`,
    });
    await page.screenshot({
      fullPage: true,
      path: `${visualEvidenceRoot}/${
        process.env.V1_PRODUCTION === "1" ? "production" : "development"
      }-desktop-full-chromium.png`,
    });
  }
  expect(errors).toEqual([]);
});

test("keyboard selection and every material control update real output", async ({
  page,
}) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/");

  const imageGroup = page.getByRole("radiogroup", {
    name: "Image detail preview navigation",
  });
  await imageGroup.getByRole("radio", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  for (const activity of await page
    .getByRole("radio", { name: "Activity" })
    .all()) {
    await expect(activity).toHaveAttribute("aria-checked", "true");
  }
  await page.keyboard.press("End");
  await expect(
    imageGroup.getByRole("radio", { name: "Settings" }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    imageGroup.getByRole("radio", { name: "Overview" }),
  ).toBeFocused();

  for (const preset of ["clear", "frosted", "dark", "regular"]) {
    const button = page.getByRole("button", { name: preset, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  const rangeValues = {
    Clarity: "63",
    Frost: "48",
    "Tint opacity": "18",
    Depth: "55",
    "Edge light": "42",
    "Light angle": "280",
    Radius: "18",
  } as const;
  for (const [name, value] of Object.entries(rangeValues)) {
    const slider = page.getByRole("slider", { name, exact: true });
    await slider.fill(value);
    await expect(slider).toHaveValue(value);
  }

  const tint = page.getByLabel("Tint color");
  await tint.fill("#7aa3b0");
  await expect(tint).toHaveValue("#7aa3b0");
  const motion = page.getByRole("combobox", { name: "Motion", exact: true });
  await motion.selectOption("expressive");
  await expect(motion).toHaveValue("expressive");
  await expect(page.getByText("custom", { exact: true }).first()).toBeVisible();

  const capability = page.getByLabel("Requested capability");
  for (const value of [
    "explicit-media",
    "owned-decoration",
    "page-backdrop",
  ]) {
    await capability.selectOption(value);
    await expect(page.locator(`[data-glaze-fallback="${value}-not-enabled"]`)).toHaveCount(5);
  }
  await expect(page.getByLabel("Renderer diagnostics")).toContainText(
    "page-backdrop not enabled",
  );
  await expect(page.getByLabel("Renderer diagnostics")).toContainText("CSS");
  expect(errors).toEqual([]);
});

test("simulations, export, reset, and Strict Mode cleanup are bounded", async ({
  browserName,
  page,
}) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/");

  await expect
    .poll(() => page.evaluate(() => window.__glazeAudit?.activeMediaListeners))
    .toBe(2);

  const reducedMotion = page.getByRole("checkbox", { name: "Reduced motion" });
  const forcedColors = page.getByRole("checkbox", { name: "Forced colors" });
  await reducedMotion.check();
  await forcedColors.check();
  const scenes = page.getByTestId("acceptance-scenes");
  await expect(scenes).toHaveClass(/glaze-simulate-reduced-motion/);
  await expect(scenes).toHaveClass(/glaze-simulate-forced-colors/);

  const darkGroup = page.getByRole("radiogroup", {
    name: "Dark surface preview navigation",
  });
  const forcedStyles = await darkGroup.evaluate((element) => {
    const group = getComputedStyle(element);
    const inactive = getComputedStyle(
      element.querySelector('[aria-checked="false"]') as Element,
    );
    return {
      background: group.backgroundColor,
      color: group.color,
      inactiveColor: inactive.color,
    };
  });
  expect(forcedStyles.color).toBe(forcedStyles.inactiveColor);
  expect(forcedStyles.color).not.toBe(forcedStyles.background);

  await page.getByRole("tab", { name: "Material JSON" }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  if (browserName === "chromium") {
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('"clarity": 82');
  }

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(reducedMotion).not.toBeChecked();
  await expect(forcedColors).not.toBeChecked();
  await expect(page.locator("[data-glaze-fallback]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "regular", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__glazeAudit?.activeMediaListeners))
    .toBe(2);
  expect(errors).toEqual([]);
});

test("mobile layout keeps the workbench inside the viewport", async ({
  browserName,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "One material. Five hard scenes." }),
  ).toBeVisible();
  await expect(page.locator('[data-scene="image"]')).toHaveCSS(
    "background-image",
    /bg-4\.jpg/,
  );
  const fit = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(fit.scrollWidth).toBe(fit.clientWidth);
  if (browserName === "chromium") {
    await page.screenshot({
      path: `${visualEvidenceRoot}/${
        process.env.V1_PRODUCTION === "1" ? "production" : "development"
      }-mobile-chromium.png`,
    });
    await page.screenshot({
      fullPage: true,
      path: `${visualEvidenceRoot}/${
        process.env.V1_PRODUCTION === "1" ? "production" : "development"
      }-mobile-full-chromium.png`,
    });
  }
});
