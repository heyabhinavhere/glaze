import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __consumerAudit?: {
      activeMediaListeners: number;
      rafCallbacks: number;
    };
  }
}

const installRuntimeAudit = async (page: Page) => {
  await page.addInitScript(() => {
    const audit = { activeMediaListeners: 0, rafCallbacks: 0 };
    window.__consumerAudit = audit;

    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      originalRaf((time) => {
        audit.rafCallbacks += 1;
        callback(time);
      });

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
};

const runtimeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

test("fresh React/Vite consumer stays semantic, strict, and idle", async ({
  page,
}) => {
  await installRuntimeAudit(page);
  const errors = runtimeErrors(page);
  await page.goto("http://127.0.0.1:3183/");
  await expect(
    page.getByRole("heading", { name: "Glaze stays semantic." }),
  ).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Report period" })).toBeVisible();
  const source = page.locator('[data-glaze-capability-requested="owned-decoration"]');
  await expect(source).toHaveAttribute("data-glaze-renderer", "webgl");
  await expect(source).toHaveAttribute("data-glaze-control-count", "2");

  await page.getByRole("radio", { name: "Week" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Month" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByText("Selected period: month")).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => window.__consumerAudit?.activeMediaListeners))
    .toBe(4);
  await expect.poll(async () => {
    const before = await page.evaluate(
      () => window.__consumerAudit?.rafCallbacks ?? -1,
    );
    await page.waitForTimeout(300);
    const after = await page.evaluate(
      () => window.__consumerAudit?.rafCallbacks ?? -1,
    );
    return after - before;
  }, { timeout: 5_000 }).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("fresh Next App Router consumer preserves SSR and hydration", async ({
  page,
  request,
}) => {
  const response = await request.get("http://127.0.0.1:3184/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Server markup first. Glass second.");
  expect(html).toContain('role="radiogroup"');
  expect(html).toContain('data-glaze-capability-requested="owned-decoration"');

  await installRuntimeAudit(page);
  const errors = runtimeErrors(page);
  await page.goto("http://127.0.0.1:3184/");
  await expect(
    page.getByRole("heading", { name: "Server markup first. Glass second." }),
  ).toBeVisible();
  const group = page.getByRole("radiogroup", { name: "Account section" });
  await expect(
    page.locator('[data-glaze-capability-requested="owned-decoration"]'),
  ).toHaveAttribute("data-glaze-renderer", "webgl");
  await group.getByRole("radio", { name: "Overview" }).focus();
  await page.keyboard.press("End");
  await expect(group.getByRole("radio", { name: "Settings" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => window.__consumerAudit?.activeMediaListeners))
    .toBe(4);
  expect(errors).toEqual([]);
});
