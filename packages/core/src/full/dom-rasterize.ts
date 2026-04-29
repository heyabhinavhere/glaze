/**
 * DOM rasterizer — captures arbitrary HTML content into a `<canvas>`
 * for use as a glass backdrop (Mode C).
 *
 * Sub-task 6a (this version): pragmatic — uses html2canvas via dynamic
 * import. html2canvas is widely-deployed, well-tested, handles the
 * 99% case (text, divs, gradients, basic CSS). Its known bugs
 * (Tailwind CSS-variable gradients render flat, iframe content
 * inaccessible) are limitations we accept for the initial
 * implementation.
 *
 * Lazy-load: `import("html2canvas")` defers the ~50KB library until
 * Mode C is actually invoked. Users who never trigger Mode C pay
 * zero for it. tsup marks html2canvas as external in build config
 * so it's resolved by the consumer's bundler at runtime.
 *
 * Roadmap:
 *   - Sub-task 6b: CSS-variable resolution helper that runs BEFORE
 *     html2canvas, so Tailwind gradients render correctly.
 *   - Sub-task 6c: replace html2canvas with a first-party SVG-
 *     foreignObject + Worker implementation. The original first-party
 *     attempt produced transparent output (likely an SVG sandbox
 *     constraint with embedded HTML); 6c isolates that in a Worker
 *     where we have more control over the resource pipeline.
 *   - Sub-task 6d: capture-tall-once with windowed re-capture.
 */

import type { DOMRasterizer, DOMRasterizerOptions } from "../internal/mode-c";

export const rasterizeDOM: DOMRasterizer = async (
  target: HTMLElement,
  options: DOMRasterizerOptions = {},
): Promise<HTMLCanvasElement | null> => {
  // Lazy-load html2canvas. The dynamic import is split into its own
  // chunk by the bundler — users who never invoke Mode C don't pay
  // for it.
  let html2canvas: typeof import("html2canvas").default;
  try {
    const mod = await import("html2canvas");
    html2canvas = mod.default;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error(
        "@glazelab/core/full: html2canvas import failed. " +
          "Mode C requires html2canvas as a peer dependency.",
        err,
      );
    }
    return null;
  }

  // Build a Set of nodes to skip — feedback-loop prevention plus any
  // user-marked exclusions (e.g., other glass hosts).
  const skipNodes = new Set<Node>(options.skipNodes ?? []);

  try {
    const captureWidth = Math.max(target.clientWidth, target.scrollWidth);
    const captureHeight = Math.max(target.clientHeight, target.scrollHeight);
    const crop = options.capture;
    const x = crop ? Math.max(0, Math.floor(crop.x)) : 0;
    const y = crop ? Math.max(0, Math.floor(crop.y)) : 0;
    const width = crop
      ? Math.max(1, Math.ceil(crop.width))
      : Math.max(1, captureWidth);
    const height = crop
      ? Math.max(1, Math.ceil(crop.height))
      : Math.max(1, captureHeight);

    const canvas = await html2canvas(target, {
      // Capture at 1x DPR — the texture's natural pixel resolution
      // matches our shader's expectations. Higher DPR is wasteful.
      scale: 1,
      // Width/height tracks the target's full scroll dimensions, not
      // just the visible rect. This is "capture-tall-once" — the
      // entire scroll context becomes one tall texture, sampled with
      // scroll offset by the renderer.
      x,
      y,
      width,
      height,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      // Fill skipped glass-host holes with the target/body background
      // instead of transparent black. This keeps Mode C from sampling
      // premultiplied-alpha voids where the current glass host was
      // intentionally excluded from the capture.
      backgroundColor: captureBackgroundColor(target),
      // Skip our glass canvases. html2canvas's `ignoreElements`
      // callback runs per-element; we return true for nodes in the
      // skipNodes set OR any element with data-glaze-canvas /
      // data-glaze-host (defense-in-depth — the renderer already
      // passes data-glaze-host elements via skipNodes).
      ignoreElements: (el) => {
        if (skipNodes.has(el)) return true;
        if (el.hasAttribute("data-glaze-canvas")) return true;
        if (el.hasAttribute("data-glaze-host")) return true;
        return false;
      },
      // Don't allow taint — strict CORS for cross-origin resources.
      // If a CORS-tainted resource is embedded, we'd rather fail and
      // return null than have texImage2D reject a tainted canvas
      // with a SecurityError later.
      allowTaint: false,
      useCORS: true,
      // Quiet logs in production; emit in dev.
      logging: process.env.NODE_ENV === "development",
    });

    return canvas;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("@glazelab/core/full: html2canvas rasterize failed", err);
    }
    return null;
  }
};

function captureBackgroundColor(target: HTMLElement): string | null {
  const targetBg = getComputedStyle(target).backgroundColor;
  if (!isTransparent(targetBg)) return targetBg;

  const bodyBg = getComputedStyle(document.body).backgroundColor;
  if (!isTransparent(bodyBg)) return bodyBg;

  const rootBg = getComputedStyle(document.documentElement).backgroundColor;
  if (!isTransparent(rootBg)) return rootBg;

  return null;
}

function isTransparent(value: string): boolean {
  if (!value || value === "transparent") return true;
  return /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(value);
}
