/**
 * Mode C registry — bridge between the default entry (which doesn't
 * ship the rasterizer) and the /full entry (which does).
 *
 * Why split: 95% of users pass `backdrop="/hero.jpg"` (Mode A) and
 * never need Mode C. Forcing the rasterizer into the default bundle
 * would add ~7KB they don't use. Splitting at the entry-point level
 * lets tree-shaking + bundlers do the right thing automatically:
 *
 *   import { createGlass } from "@glazelab/core";        // ~15KB, no Mode C
 *   import { createGlass } from "@glazelab/core/full";   // ~22KB, Mode C works
 *
 * Mechanism: this module owns a single function reference. The /full
 * entry's first import sets it (via a side-effect of `full.ts`). The
 * default entry's createGlass checks getDOMRasterizer() before any
 * Mode C fallback — if null, dev throws a helpful error and prod
 * falls through to no-op.
 */

/** Async rasterizer signature. Takes a target element, returns a
 *  canvas containing the rasterized DOM content, or null on failure
 *  (e.g., cross-origin tainting). */
export type DOMRasterizer = (
  target: HTMLElement,
  options?: DOMRasterizerOptions,
) => Promise<HTMLCanvasElement | null>;

export interface DOMRasterizerOptions {
  /** Nodes (and their subtrees) to skip during capture. The renderer
   *  passes all `data-glaze-host` elements here to prevent feedback
   *  loops — without this, capturing a page with our own glass on it
   *  would render the glass-of-the-glass-of-the-glass... */
  skipNodes?: Iterable<Node>;
  /** Optional content-space crop. Used when the full scroll context is
   *  larger than the GPU's max texture size; the renderer captures a
   *  window around the lens instead of uploading an impossible texture. */
  capture?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Capture the target's current visible scrollport instead of trying
   *  to rasterize its full scrollHeight. Used for element scrollers,
   *  where html2canvas clips offscreen overflow content. */
  preserveScrollViewport?: boolean;
}

let rasterizer: DOMRasterizer | null = null;

/** Register the DOM rasterizer. Called once at import time by
 *  packages/core/src/full.ts. Idempotent — second registration
 *  replaces the first. */
export function registerDOMRasterizer(fn: DOMRasterizer): void {
  rasterizer = fn;
}

/** Look up the registered rasterizer. Returns null if no /full import
 *  has registered one. */
export function getDOMRasterizer(): DOMRasterizer | null {
  return rasterizer;
}
