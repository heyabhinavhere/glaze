/**
 * createGlass — public entry. Wraps a target element with the WebGL
 * liquid-glass effect by appending a per-lens canvas as the host's
 * first child and registering the lens with the shared renderer.
 *
 * SSR-safe: when window is undefined, returns a no-op handle that
 * preserves the API surface (so callers don't have to branch).
 *
 * Capability fallback: when isSupported() reports false (no WebGL2,
 * no OffscreenCanvas, no Worker), returns a no-op handle. Sub-task 7
 * replaces the no-op fallback with the CSS-only path.
 *
 * Sub-task 3b scope: lens construction, registration, basic update +
 * destroy. The handle's `update`, `destroy`, `getElement`, `isWebGL`
 * are real; `updateUniform`, `refreshBackdrop`, `debug` are stubbed
 * (sub-tasks 5/7 wire them).
 */

import { acquire, release } from "./internal/shared-renderer";
import { Lens } from "./internal/lens";
import { DEFAULT_LENS_CONFIG } from "./internal/types";
import { ensurePrewarm } from "./internal/prewarm";
import { isSupported } from "./is-supported";
import { resolveBackdrop } from "./internal/backdrop-loader";
import { autoDetectBackdrop } from "./internal/auto-detect";
import { getDOMRasterizer } from "./internal/mode-c";
import type { ColorInput, GlassConfigUpdate, GlassHandle } from "./public-types";

/** No-op handle — returned when the runtime can't create a real lens
 *  (SSR, WebGL2 unavailable, OffscreenCanvas missing). Preserves the
 *  API surface so consumer code doesn't need to branch. */
function noopHandle(target: HTMLElement | null): GlassHandle {
  const el = target ?? createDetachedHostStub();
  return {
    update: () => {},
    updateUniform: () => {},
    refreshBackdrop: () => {},
    destroy: () => {},
    getElement: () => el,
    isWebGL: () => false,
    debug: () => null,
  };
}

function createDetachedHostStub(): HTMLElement {
  // Server-side: we never actually touch this element, but the handle
  // signature expects an HTMLElement. Construct one that won't blow up
  // a Node test that calls handle.getElement().
  if (typeof document !== "undefined") return document.createElement("div");
  // No DOM at all — the handle's getElement() shouldn't be called in
  // SSR contexts; if it is, the caller has a bug. Return a minimal
  // object that satisfies the type system.
  return {} as HTMLElement;
}

export function createGlass(
  target: HTMLElement,
  config?: GlassConfigUpdate,
): GlassHandle {
  // Always trigger prewarm — first-public-call kicks shader compile
  // off the critical path. Idempotent.
  ensurePrewarm();

  // SSR safety. The handle's API is preserved so server code doesn't
  // need to branch on `typeof window`.
  if (typeof window === "undefined") {
    return noopHandle(target);
  }

  // Capability gate. Sub-task 7 replaces this with the CSS fallback.
  if (!isSupported()) {
    return noopHandle(target);
  }

  // Defensive: treat null/undefined target as "no-op" rather than
  // throwing. Production code shouldn't crash an app.
  if (!target || !(target instanceof HTMLElement)) {
    return noopHandle(target ?? null);
  }

  // Acquire the shared renderer. Constructor may throw if WebGL2 isn't
  // really available (some browsers report support but fail to create
  // a context). Catch and degrade gracefully.
  let renderer;
  try {
    renderer = acquire();
  } catch {
    return noopHandle(target);
  }

  // Build the resolved LensConfig from defaults + user partial.
  const resolved = mergeConfig(config);

  // Auto-detection: when no backdrop and no backdropFrom were
  // provided, walk the host's ancestors to figure out what's behind
  // it. This is the "drop-in glass" UX — `<Glaze>nav</Glaze>` works
  // without an explicit prop. Sub-task 5c.
  //
  // Mode C is included as a fallback when the /full entry has
  // registered a DOM rasterizer. When auto resolves to "C-dom", the
  // backdrop is null at this point — the async rasterization happens
  // after lens registration so the lens is alive while we wait.
  let autoResult: ReturnType<typeof autoDetectBackdrop> | null = null;
  if (resolved.backdrop === null && resolved.backdropFrom === null) {
    const modeCAvailable = getDOMRasterizer() !== null;
    autoResult = autoDetectBackdrop(target, modeCAvailable);
    if (autoResult.backdrop !== null) {
      resolved.backdrop = autoResult.backdrop;
      if (resolved.backdropAnchor === null) {
        resolved.backdropAnchor = autoResult.backdropAnchor;
      }
    } else if (autoResult.mode === "C-dom" && autoResult.domTarget) {
      // Mode C: anchor set immediately so bounds calc works, backdrop
      // populated after rasterization completes.
      if (resolved.backdropAnchor === null) {
        resolved.backdropAnchor = autoResult.backdropAnchor;
      }
    }
  }

  const lens = new Lens(target, resolved);
  renderer.registerLens(lens);

  // Track destroy state so the handle is idempotent across multiple
  // calls (e.g., React StrictMode cleanup that fires twice).
  let destroyed = false;

  // Async backdrop load — when the config (explicit OR auto-detected)
  // resolved to a backdrop, kick off the decode and upload to GPU as
  // soon as it's ready. The lens renders blank until the texture is
  // bound; the module-level Promise cache (decodeImageOnce) shares a
  // single decode across same-URL callers.
  if (resolved.backdrop !== null) {
    void loadAndUploadBackdrop(lens, renderer, resolved.backdrop);
  } else if (autoResult?.mode === "C-dom" && autoResult.domTarget) {
    // Mode C async path: invoke the registered rasterizer, upload the
    // resulting canvas as the backdrop texture. Race-safe via the
    // lens generation counter (loadAndApplyModeC checks it).
    void loadAndApplyModeC(lens, renderer, autoResult.domTarget);
  }

  return {
    update(partial) {
      if (destroyed) return;
      lens.applyUpdate(partial);
      // Backdrop changes through update() trigger a re-load.
      if (partial.backdrop !== undefined && partial.backdrop !== null) {
        void loadAndUploadBackdrop(lens, renderer, partial.backdrop);
      }
    },
    updateUniform(_key, _value) {
      // Sub-task 7 wires the zero-allocation hot path. For 3b, this is
      // a no-op; consumers calling updateUniform during the rebuild
      // get a silent no-op rather than a crash.
    },
    refreshBackdrop() {
      // Sub-task 5 wires Mode C providers. For 3b, no-op.
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      renderer.unregisterLens(lens.id);
      lens.destroy();
      release();
    },
    getElement: () => lens.host,
    isWebGL: () => true,
    debug: () => null,
  };
}

/** Merge a user partial into the resolved default LensConfig. Color
 *  parsing for `tint` happens here so the Lens always sees a normalized
 *  RGBA tuple. */
function mergeConfig(partial: GlassConfigUpdate | undefined) {
  if (!partial) return DEFAULT_LENS_CONFIG;
  const merged = { ...DEFAULT_LENS_CONFIG };
  if (partial.radius !== undefined) merged.radius = partial.radius;
  if (partial.frost !== undefined) merged.frost = partial.frost;
  if (partial.saturation !== undefined) merged.saturation = partial.saturation;
  if (partial.brightness !== undefined) merged.brightness = partial.brightness;
  if (partial.grain !== undefined) merged.grain = partial.grain;
  if (partial.bevelWidth !== undefined) merged.bevelWidth = partial.bevelWidth;
  if (partial.bendZone !== undefined) merged.bendZone = partial.bendZone;
  if (partial.refraction !== undefined) merged.refraction = partial.refraction;
  if (partial.bevelDepth !== undefined) merged.bevelDepth = partial.bevelDepth;
  if (partial.chromatic !== undefined) merged.chromatic = partial.chromatic;
  if (partial.rimIntensity !== undefined) merged.rimIntensity = partial.rimIntensity;
  if (partial.lightAngle !== undefined) merged.lightAngle = partial.lightAngle;
  if (partial.specularSize !== undefined) merged.specularSize = partial.specularSize;
  if (partial.specularOpacity !== undefined)
    merged.specularOpacity = partial.specularOpacity;
  if (partial.tint !== undefined) merged.tint = parseColorTuple(partial.tint);
  if (partial.innerShadow !== undefined) merged.innerShadow = partial.innerShadow;
  if (partial.dropShadow !== undefined) merged.dropShadow = partial.dropShadow;
  if (partial.backdrop !== undefined) merged.backdrop = partial.backdrop;
  if (partial.backdropFrom !== undefined) merged.backdropFrom = partial.backdropFrom;
  if (partial.backdropAnchor !== undefined) merged.backdropAnchor = partial.backdropAnchor;
  return merged;
}

/** Parse a ColorInput at config-merge time. Lens.applyUpdate has its
 *  own copy of this for in-place tint changes; this one is the
 *  config-merge path used at construction. */
function parseColorTuple(input: ColorInput): [number, number, number, number] {
  if (Array.isArray(input)) {
    const [r, g, b, a] = input as readonly [number, number, number, number];
    return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
  }
  // OffscreenCanvas-based parse — see lens.ts parseColor for rationale.
  const oc = new OffscreenCanvas(1, 1);
  const cx = oc.getContext("2d");
  if (!cx) return [1, 1, 1, 0.5];
  cx.fillStyle = "#000";
  cx.fillStyle = input as string;
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

/** Decode + upload a backdrop. Fire-and-forget. Race-safe: snapshots the
 *  lens generation at start; on resolve, if the generation no longer
 *  matches (lens destroyed, or backdrop URL changed during decode), the
 *  result is silently discarded. This handles three real races:
 *    1. Mount → unmount race: lens destroyed mid-decode.
 *    2. Strict-Mode mount/unmount/mount: a NEW lens with a NEW generation
 *       takes over; the old promise's result is irrelevant.
 *    3. handle.update({ backdrop: newURL }) mid-decode: old result must
 *       not clobber the new state.
 *
 *  Also classifies the backdrop into one of three kinds (Mode A static,
 *  Mode B live-canvas, Mode B live-video) and wires the appropriate
 *  refresh path:
 *    - static  → upload once
 *    - canvas  → upload every render frame (renderer.tick handles this)
 *    - video   → subscribe to requestVideoFrameCallback so we re-upload
 *                only when a new frame is decoded (60% bus-traffic
 *                reduction vs naive every-frame for paused/idle videos)
 *
 *  Auto-set backdropAnchor: when the user passes an HTMLElement
 *  backdrop and didn't supply an explicit anchor, we default the
 *  anchor to the element itself. The lens then samples from the right
 *  region of the canvas/video texture as it sits on the page. */
async function loadAndUploadBackdrop(
  lens: Lens,
  renderer: ReturnType<typeof acquire>,
  source:
    | string
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement,
): Promise<void> {
  const startGeneration = lens.generation;
  try {
    const resolved = await resolveBackdrop(source);
    // Generation guard. If this is a stale promise (lens destroyed or
    // backdrop changed during decode), discard the result. The decode
    // itself is shared across same-URL calls via decodeImageOnce, so
    // the work isn't wasted — just unused for this caller.
    if (lens.destroyed || lens.generation !== startGeneration) return;

    lens.backdropSource = resolved;

    // Auto-anchor for live elements: if the user didn't pass an
    // explicit backdropAnchor, use the element itself. Static images
    // (URLs / HTMLImageElement) don't auto-anchor — those stay at
    // viewport-default unless the user sets backdropAnchor.
    if (!lens.config.backdropAnchor) {
      if (
        resolved instanceof HTMLCanvasElement ||
        resolved instanceof HTMLVideoElement
      ) {
        lens.config = { ...lens.config, backdropAnchor: resolved };
      }
    }

    // Classify and wire refresh.
    if (resolved instanceof HTMLVideoElement) {
      lens.backdropKind = "live-video";
      subscribeVideoFrames(lens, resolved);
    } else if (resolved instanceof HTMLCanvasElement) {
      lens.backdropKind = "live-canvas";
      // The renderer's tick will re-upload every frame. No extra
      // wiring needed beyond the kind tag.
    } else {
      lens.backdropKind = "static";
    }

    renderer.uploadBackdrop(lens, resolved);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("@glazelab/core: backdrop decode failed", err);
    }
  }
}

/** Mode C async path — invoke the registered DOM rasterizer against
 *  the target element, upload the resulting canvas as the lens's
 *  backdrop. Race-safe via the lens generation counter. Skip nodes
 *  marked with `data-glaze-host` to prevent feedback loops where
 *  glass-on-page would capture itself. */
async function loadAndApplyModeC(
  lens: Lens,
  renderer: ReturnType<typeof acquire>,
  target: HTMLElement,
): Promise<void> {
  const rasterize = getDOMRasterizer();
  if (!rasterize) return; // Should not happen — caller already gated on this.

  const startGeneration = lens.generation;
  try {
    // Skip every glass host on the page (including this lens's own
    // host) so the rasterized image doesn't include glass elements.
    // Without this guard, the captured texture would contain the
    // lens's own canvas → recursive refraction → flickering.
    const skipNodes = Array.from(
      document.querySelectorAll("[data-glaze-host]"),
    ) as Node[];

    const canvas = await rasterize(target, { skipNodes });
    if (lens.destroyed || lens.generation !== startGeneration) return;
    if (!canvas) return;

    lens.backdropSource = canvas;
    // Mode C is a one-shot rasterization (sub-task 6a). The canvas is
    // STATIC after we draw to it — no per-frame re-upload needed.
    // Treat as static. Sub-task 6c's worker version stays static too;
    // sub-task 6d's capture-tall-once handles re-capture only on
    // resize / DOM mutation.
    lens.backdropKind = "static";
    renderer.uploadBackdrop(lens, canvas);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("@glazelab/core: Mode C rasterization failed", err);
    }
  }
}

/** Subscribe to requestVideoFrameCallback. Re-arms itself in the
 *  callback so each new frame triggers a fresh upload. Cleared on
 *  lens destroy. Falls back to "always re-upload" (treated as
 *  live-canvas) on browsers without the API (Safari before 16). */
function subscribeVideoFrames(lens: Lens, video: HTMLVideoElement): void {
  type RVFVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
  };
  const v = video as RVFVideo;
  if (typeof v.requestVideoFrameCallback !== "function") {
    // Older browser fallback — pretend it's a canvas so the renderer
    // re-uploads every render frame instead.
    lens.backdropKind = "live-canvas";
    return;
  }
  const tick = (): void => {
    if (lens.destroyed) return;
    lens.needsTextureRefresh = true;
    lens.videoFrameCallbackId = v.requestVideoFrameCallback!(tick);
  };
  lens.videoFrameCallbackId = v.requestVideoFrameCallback(tick);
}
