import { expect, test, type Page } from "@playwright/test";

async function openMobileWorkbench(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/workbench");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", {
    name: "The live material is now the workbench.",
  })).toBeVisible();
  const surfaces = page.locator("[data-glaze-capability-requested]");
  await expect(surfaces).toHaveCount(2);
  for (const surface of await surfaces.all()) {
    await surface.scrollIntoViewIfNeeded();
    await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl", {
      timeout: 15_000,
    });
    await expect(surface).toHaveAttribute("data-glaze-control-count", "3");
  }
  await expect(page.locator("[data-nextjs-dialog]"))
    .toHaveCount(0);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  return surfaces;
}

test("mobile viewport preserves the accepted runtime without horizontal overflow", async ({
  page,
}, testInfo) => {
  const surfaces = await openMobileWorkbench(page);
  expect(await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(expect.objectContaining({
    clientWidth: testInfo.project.name.startsWith("iphone") ? 393 : 810,
  }));
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth
      <= document.documentElement.clientWidth + 1,
  )).toBe(true);

  for (const surface of await surfaces.all()) {
    expect(await surface.evaluate((element) =>
      getComputedStyle(element).touchAction
    )).toBe("manipulation");
    const output = surface.locator("canvas[data-glaze-output]");
    const dpr = await output.evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      return element.width / element.getBoundingClientRect().width;
    });
    expect(dpr).toBeGreaterThanOrEqual(1.9);
    expect(dpr).toBeLessThanOrEqual(2.05);
  }

  const proof = page.getByRole("region", { name: "Public API proof" });
  const workbench = page.locator("[data-glaze-workbench='true']");
  const proofBox = await proof.boundingBox();
  const workbenchBox = await workbench.boundingBox();
  expect(proofBox).not.toBeNull();
  expect(workbenchBox).not.toBeNull();
  expect(workbenchBox!.y).toBeGreaterThanOrEqual(
    proofBox!.y + proofBox!.height - 1,
  );

  const screenshotPath = testInfo.outputPath(
    `mobile-workbench-${testInfo.project.name}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("full-page-mobile-workbench", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("touch interaction updates semantics and keeps both renderers healthy", async ({
  page,
}) => {
  const surfaces = await openMobileWorkbench(page);
  for (const surface of await surfaces.all()) {
    const renderer = await surface.getAttribute("data-glaze-renderer-id");
    await surface.getByRole("radio", { name: "Form" }).tap();
    await expect(
      surface.getByRole("radio", { name: "Form" }),
    ).toHaveAttribute("aria-checked", "true");
    await surface.getByRole("switch").tap();
    await expect(surface.getByRole("switch"))
      .toHaveAttribute("aria-checked", "false");
    await surface.getByRole("slider").fill("44");
    await expect(surface.getByRole("slider")).toHaveValue("44");
    await expect(surface).toHaveAttribute("data-glaze-renderer", "webgl");
    await expect(surface).toHaveAttribute(
      "data-glaze-renderer-id",
      renderer ?? "",
    );
  }
});
