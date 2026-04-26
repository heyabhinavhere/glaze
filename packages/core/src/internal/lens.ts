/**
 * Lens — internal per-lens state.
 *
 * Each createGlass() call constructs one Lens. The Lens owns:
 *   - A unique numeric id.
 *   - The host HTMLElement.
 *   - A visible per-lens 2D <canvas> appended to the host as first
 *     child, with all the accessibility attributes (design §6.6).
 *   - The lens's resolved LensConfig.
 *   - The lens's screen-space rect (bounding box in device pixels).
 *   - A ResizeObserver that updates the rect on host resize.
 *
 * The Lens does NOT do any GL work. The SharedRenderer reads each lens's
 * rect + config + canvas, performs the GL render into its offscreen
 * buffer, then asks the lens to blit the result to its 2D canvas.
 *
 * Sub-task 3b scope: lifecycle, rect tracking, blit method. Real config
 * mutation, generation counter, and sticky-position handling come in 3d.
 */

import type { GlassConfigUpdate, ColorInput } from "../public-types";
import type { LensConfig } from "./types";
import { DEFAULT_LENS_CONFIG } from "./types";
import type { LensGLResources } from "./lens-gl";

let lensIdCounter = 0;

export class Lens {
  readonly id: number;
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Resolved current config. Mutated in place by `applyUpdate`. */
  config: LensConfig;

  /** Screen-space rect in CSS pixels. Updated by ResizeObserver and
   *  (in 3d) by scroll listener for sticky/fixed lenses. */
  rect: { x: number; y: number; w: number; h: number };

  /** Backing-store device-pixel size at the last render — used to
   *  decide if the visible canvas needs resizing on the next frame. */
  lastBackingSize: { w: number; h: number } = { w: 0, h: 0 };

  /** Resolved backdrop image, ready for GL upload. Set by the renderer
   *  after asynchronous decode completes. Until set, the lens is gated
   *  off — renderLens skips lenses without a resolved source. */
  backdropSource: HTMLImageElement | HTMLCanvasElement | null = null;

  /** Per-lens GL resources (texture + FBOs + dirty flags). Set by the
   *  renderer when the lens registers; freed when it unregisters. */
  glResources: LensGLResources | null = null;

  /** True once destroy() has run; subsequent calls are no-ops. */
  destroyed = false;

  /** Monotonic counter incremented when state changes that should
   *  invalidate in-flight async work (config update with new backdrop,
   *  destroy, etc). Async backdrop decoders snapshot this at start;
   *  on resolve, if the snapshot doesn't match the current value, the
   *  result is silently discarded. Design §3.1, §M14. */
  generation = 0;

  /** True for `position: sticky` / `fixed` hosts. The shared renderer's
   *  scroll listener re-reads getBoundingClientRect each frame for these
   *  lenses (ResizeObserver doesn't fire on scroll-driven sticky moves).
   *  Static / relative / absolute lenses skip the listener. Design §3.2. */
  needsScrollUpdate = false;

  private readonly resizeObserver: ResizeObserver;
  private readonly originalHostPosition: string;

  constructor(host: HTMLElement, config: LensConfig) {
    this.id = ++lensIdCounter;
    this.host = host;
    this.config = config;

    // Per-lens visible canvas. Aria + role + tabindex + pointer-events
    // are all required for the canvas to be invisible to screen readers,
    // assistive tech, keyboard navigation, and pointer events. Verified
    // in §9 accessibility gates.
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.setAttribute("role", "presentation");
    this.canvas.tabIndex = -1;
    this.canvas.setAttribute("data-glaze-canvas", "");
    // Tagged so the (sub-task 6) Mode C rasterizer can skip our own
    // canvases when capturing the DOM — feedback-loop prevention.
    this.canvas.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "pointer-events:none",
      "user-select:none",
      // border-radius matches the CSS pixel radius from config; updated
      // when config changes. Smooths the visible canvas's edges so they
      // don't show as a sharp rectangle outside the lens shape.
      `border-radius:${config.radius}px`,
    ].join(";");

    const ctx2d = this.canvas.getContext("2d", {
      // Default alpha:true preserves transparency in the blit path.
      // willReadFrequently:false because we never readBack from this
      // canvas — it's a draw-only surface fed by transferToImageBitmap.
      alpha: true,
      willReadFrequently: false,
    });
    if (!ctx2d) {
      throw new Error(
        "@glazelab/core: 2D context unavailable on lens canvas. " +
          "This should not happen in any browser supporting WebGL2.",
      );
    }
    this.ctx = ctx2d;

    // The host needs a positioning context so our absolute-positioned
    // canvas anchors correctly. Don't override an existing non-static
    // position; only fix `static`. Original is preserved for restore on
    // destroy() so we don't leak this side effect.
    const computed = window.getComputedStyle(host);
    this.originalHostPosition = host.style.position;
    if (computed.position === "static") {
      host.style.position = "relative";
    }

    // Sticky/fixed lenses need per-frame rect updates because their
    // screen position changes during scroll without firing a Resize
    // Observer event. The shared renderer's scroll listener honors
    // this flag.
    if (computed.position === "sticky" || computed.position === "fixed") {
      this.needsScrollUpdate = true;
    }

    // Append as first child so subsequent host content stacks above it
    // (the user's actual button/text/etc renders ON TOP of the glass).
    host.insertBefore(this.canvas, host.firstChild);

    // Tag the host so DevTools and Mode C rasterizer (sub-task 6) can
    // identify glass-owned hosts. The data attribute is purely
    // diagnostic — runtime behavior doesn't depend on it.
    host.setAttribute("data-glaze-host", "");

    // Initial rect snapshot.
    const r = host.getBoundingClientRect();
    this.rect = { x: r.left, y: r.top, w: r.width, h: r.height };

    // Resize tracking. Static-positioned lenses get rect updates only
    // from this; sticky/fixed need the additional scroll listener that
    // sub-task 3d adds.
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(host);
  }

  /** Apply a partial update to the resolved LensConfig. Bumps
   *  generation when fields change that should invalidate in-flight
   *  async work — the backdrop is the canonical example (a new URL
   *  starts a fresh decode; any earlier decode that resolves later
   *  must be discarded). */
  applyUpdate(partial: GlassConfigUpdate): void {
    if (this.destroyed) return;
    if (
      partial.backdrop !== undefined ||
      partial.backdropFrom !== undefined
    ) {
      this.generation++;
    }

    // Most fields copy through 1:1.
    if (partial.radius !== undefined) {
      this.config = { ...this.config, radius: partial.radius };
      this.canvas.style.borderRadius = `${partial.radius}px`;
    }
    if (partial.frost !== undefined) this.config = { ...this.config, frost: partial.frost };
    if (partial.saturation !== undefined)
      this.config = { ...this.config, saturation: partial.saturation };
    if (partial.brightness !== undefined)
      this.config = { ...this.config, brightness: partial.brightness };
    if (partial.grain !== undefined) this.config = { ...this.config, grain: partial.grain };
    if (partial.bevelWidth !== undefined)
      this.config = { ...this.config, bevelWidth: partial.bevelWidth };
    if (partial.bendZone !== undefined)
      this.config = { ...this.config, bendZone: partial.bendZone };
    if (partial.refraction !== undefined)
      this.config = { ...this.config, refraction: partial.refraction };
    if (partial.bevelDepth !== undefined)
      this.config = { ...this.config, bevelDepth: partial.bevelDepth };
    if (partial.chromatic !== undefined)
      this.config = { ...this.config, chromatic: partial.chromatic };
    if (partial.rimIntensity !== undefined)
      this.config = { ...this.config, rimIntensity: partial.rimIntensity };
    if (partial.lightAngle !== undefined)
      this.config = { ...this.config, lightAngle: partial.lightAngle };
    if (partial.specularSize !== undefined)
      this.config = { ...this.config, specularSize: partial.specularSize };
    if (partial.specularOpacity !== undefined)
      this.config = { ...this.config, specularOpacity: partial.specularOpacity };

    // Tint requires color parsing.
    if (partial.tint !== undefined) {
      this.config = { ...this.config, tint: parseColor(partial.tint) };
    }

    // Shadows replace wholesale.
    if (partial.innerShadow !== undefined)
      this.config = { ...this.config, innerShadow: partial.innerShadow };
    if (partial.dropShadow !== undefined)
      this.config = { ...this.config, dropShadow: partial.dropShadow };

    // Backdrop bindings — providers in sub-task 5 will wire these to
    // texture loading; for 3b we just store the reference.
    if (partial.backdrop !== undefined)
      this.config = { ...this.config, backdrop: partial.backdrop };
    if (partial.backdropFrom !== undefined)
      this.config = { ...this.config, backdropFrom: partial.backdropFrom };
  }

  /** Idempotent. Removes the canvas, disconnects observers, restores
   *  the host's original position style. Bumps generation so any
   *  in-flight async work (backdrop decode, etc.) discards its result. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation++;
    this.resizeObserver.disconnect();
    this.canvas.remove();
    this.host.removeAttribute("data-glaze-host");
    // Restore original `position` style if we modified it.
    if (this.originalHostPosition === "") {
      this.host.style.removeProperty("position");
    } else {
      this.host.style.position = this.originalHostPosition;
    }
  }

  /** Re-read the host's rect. Triggered by ResizeObserver and (sub-
   *  task 3d) by scroll for sticky/fixed lenses. */
  private handleResize = (): void => {
    if (this.destroyed) return;
    const r = this.host.getBoundingClientRect();
    this.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  /** Blit a rendered ImageBitmap (from the offscreen GL output) onto
   *  this lens's visible 2D canvas. Resizes the canvas backing store
   *  if needed. Closes the bitmap when done — caller doesn't need to.
   *
   *  Coordinates: bitmap is in device pixels (DPR-multiplied). Canvas
   *  backing store matches. CSS sizing on the canvas is `width:100%
   *  height:100%` so the device-pixel buffer scales down to CSS px
   *  smoothly. */
  blit(bitmap: ImageBitmap): void {
    if (this.destroyed) {
      bitmap.close();
      return;
    }
    const w = bitmap.width;
    const h = bitmap.height;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.lastBackingSize = { w, h };
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Color parsing — public-types.ts ColorInput → RGBA tuple                    */
/* -------------------------------------------------------------------------- */

/** Parses any CSS color string into a normalized RGBA tuple. Tuples pass
 *  through unchanged (clamped). Uses an offscreen 2D context for the
 *  parse — handles every format the browser knows (rgba, hsl, oklch,
 *  named colors, etc). Falls back to white-50% on parse failure. */
function parseColor(input: ColorInput): [number, number, number, number] {
  if (Array.isArray(input)) {
    const [r, g, b, a] = input as readonly [number, number, number, number];
    return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
  }
  // Browser-native parse via OffscreenCanvas 2D context.
  // OffscreenCanvas is gated by isSupported(); if we got here, it exists.
  const oc = new OffscreenCanvas(1, 1);
  const cx = oc.getContext("2d");
  if (!cx) return [1, 1, 1, 0.5];
  cx.fillStyle = "#000";
  cx.fillStyle = input as string;
  // After assigning a parsable string, fillStyle is normalized to an
  // rgb()/rgba() string. Read it back and parse the channels.
  const normalized = cx.fillStyle;
  if (typeof normalized !== "string") return [1, 1, 1, 0.5];
  const m = /rgba?\(([^)]+)\)/.exec(normalized);
  if (!m) return [1, 1, 1, 0.5];
  const parts = m[1]!.split(",").map((s) => parseFloat(s.trim()));
  const r = (parts[0] ?? 0) / 255;
  const g = (parts[1] ?? 0) / 255;
  const b = (parts[2] ?? 0) / 255;
  const a = parts[3] !== undefined ? parts[3] : 1;
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export { DEFAULT_LENS_CONFIG };
