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
 * destroy. The handle's `update`, `refreshBackdrop`, `destroy`,
 * `getElement`, `isWebGL`, and dev `debug` are real; `updateUniform`
 * remains a no-op until the zero-allocation hot path lands.
 */

import { acquire, release } from "./internal/shared-renderer";
import { Lens } from "./internal/lens";
import { DEFAULT_LENS_CONFIG } from "./internal/types";
import { ensurePrewarm } from "./internal/prewarm";
import { isSupported } from "./is-supported";
import { resolveBackdrop } from "./internal/backdrop-loader";
import { autoDetectBackdrop } from "./internal/auto-detect";
import { getDOMRasterizer } from "./internal/mode-c";
import type {
  ColorInput,
  GlassConfigUpdate,
  GlassDebugElement,
  GlassDebugInfo,
  GlassHandle,
} from "./public-types";

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
  let modeCTarget: HTMLElement | null = null;
  if (resolved.backdropFrom !== null) {
    modeCTarget = resolveBackdropFrom(resolved.backdropFrom);
    if (modeCTarget && resolved.backdropAnchor === null) {
      resolved.backdropAnchor = modeCTarget;
    }
  }
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
      modeCTarget = autoResult.domTarget;
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
  let modeCScrollCleanup: (() => void) | null = null;
  const startModeC = (captureTarget: HTMLElement, invalidate = false): void => {
    if (destroyed) return;
    if (invalidate) lens.generation++;
    modeCTarget = captureTarget;
    if (lens.config.backdropAnchor === null) {
      lens.config = { ...lens.config, backdropAnchor: captureTarget };
    }
    modeCScrollCleanup?.();
    modeCScrollCleanup = attachModeCScrollRefresh(captureTarget, () => {
      startModeC(captureTarget, true);
    });
    void loadAndApplyModeC(lens, renderer, captureTarget);
  };

  // Async backdrop load — when the config (explicit OR auto-detected)
  // resolved to a backdrop, kick off the decode and upload to GPU as
  // soon as it's ready. The lens renders blank until the texture is
  // bound; the module-level Promise cache (decodeImageOnce) shares a
  // single decode across same-URL callers.
  if (resolved.backdrop !== null) {
    void loadAndUploadBackdrop(lens, renderer, resolved.backdrop);
  } else if (modeCTarget) {
    // Mode C async path: invoke the registered rasterizer, upload the
    // resulting canvas as the backdrop texture. Race-safe via the
    // lens generation counter (loadAndApplyModeC checks it).
    startModeC(modeCTarget);
  } else if (resolved.backdropFrom !== null) {
    lens.lastError = "backdropFrom did not resolve to an HTMLElement";
  }

  return {
    update(partial) {
      if (destroyed) return;
      lens.applyUpdate(partial);
      // Backdrop changes through update() trigger a re-load.
      if (partial.backdrop !== undefined && partial.backdrop !== null) {
        lens.modeC = null;
        modeCTarget = null;
        void loadAndUploadBackdrop(lens, renderer, partial.backdrop);
      }
      if (partial.backdropFrom !== undefined) {
        const nextTarget = resolveBackdropFrom(partial.backdropFrom);
        if (nextTarget) {
          if (partial.backdropAnchor === undefined) {
            lens.config = { ...lens.config, backdropAnchor: nextTarget };
          }
          startModeC(nextTarget, true);
        } else {
          lens.lastError = "backdropFrom did not resolve to an HTMLElement";
        }
      }
    },
    updateUniform(_key, _value) {
      // Sub-task 7 wires the zero-allocation hot path. For 3b, this is
      // a no-op; consumers calling updateUniform during the rebuild
      // get a silent no-op rather than a crash.
    },
    refreshBackdrop() {
      if (!modeCTarget) return;
      startModeC(modeCTarget, true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      modeCScrollCleanup?.();
      modeCScrollCleanup = null;
      renderer.unregisterLens(lens.id);
      lens.destroy();
      release();
    },
    getElement: () => lens.host,
    isWebGL: () => true,
    debug: () => createDebugInfo(lens, renderer),
  };
}

/** Merge a user partial into the resolved default LensConfig. Color
 *  parsing for `tint` happens here so the Lens always sees a normalized
 *  RGBA tuple. */
function mergeConfig(partial: GlassConfigUpdate | undefined) {
  const merged = cloneDefaultConfig();
  if (!partial) return merged;
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

function cloneDefaultConfig() {
  return {
    ...DEFAULT_LENS_CONFIG,
    tint: [...DEFAULT_LENS_CONFIG.tint] as [number, number, number, number],
    innerShadow: DEFAULT_LENS_CONFIG.innerShadow
      ? { ...DEFAULT_LENS_CONFIG.innerShadow }
      : null,
    dropShadow: DEFAULT_LENS_CONFIG.dropShadow
      ? { ...DEFAULT_LENS_CONFIG.dropShadow }
      : null,
  };
}

function resolveBackdropFrom(
  source: HTMLElement | (() => HTMLElement) | null,
): HTMLElement | null {
  if (!source) return null;
  const el = typeof source === "function" ? source() : source;
  return el instanceof HTMLElement ? el : null;
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

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
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
    lens.modeC = null;
    lens.lastError = null;

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
      lens.backdropMode = "B";
      subscribeVideoFrames(lens, resolved);
    } else if (resolved instanceof HTMLCanvasElement) {
      lens.backdropKind = "live-canvas";
      lens.backdropMode = "B";
      // The renderer's tick will re-upload every frame. No extra
      // wiring needed beyond the kind tag.
    } else {
      lens.backdropKind = "static";
      lens.backdropMode = "A";
    }

    renderer.uploadBackdrop(lens, resolved);
  } catch (err) {
    lens.lastError = stringifyError(err);
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
  if (!rasterize) {
    lens.lastError = "Mode C requires importing createGlass from @glazelab/core/full";
    lens.modeC = {
      target,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      kind: "full",
      reason: null,
      lastError: lens.lastError,
    };
    return;
  }

  const startGeneration = lens.generation;
  const captureStart = performance.now();
  try {
    // Skip every glass host on the page (including this lens's own
    // host) so the rasterized image doesn't include glass elements.
    // Without this guard, the captured texture would contain the
    // lens's own canvas → recursive refraction → flickering.
    const skipNodes = Array.from(
      document.querySelectorAll("[data-glaze-host]"),
    ) as Node[];

    const capture = computeModeCCapture(target, lens, renderer.getMaxTextureSize());
    if (capture.width <= 0 || capture.height <= 0) {
      throw new Error("Mode C target has no capturable area");
    }

    const canvas = await rasterize(target, {
      skipNodes,
      capture: capture.kind === "windowed" ? capture : undefined,
      preserveScrollViewport: capture.reason === ELEMENT_SCROLL_CAPTURE_REASON,
    });
    if (lens.destroyed || lens.generation !== startGeneration) return;
    if (!canvas) {
      throw new Error("Mode C rasterizer returned null");
    }

    lens.backdropSource = canvas;
    lens.backdropMode = "C";
    lens.modeC = {
      target,
      x: capture.x,
      y: capture.y,
      width: canvas.width,
      height: canvas.height,
      kind: capture.kind,
      reason: capture.reason,
      lastError: null,
    };
    lens.lastError = null;
    // Mode C is a one-shot rasterization (sub-task 6a). The canvas is
    // STATIC after we draw to it — no per-frame re-upload needed.
    // Treat as static. Sub-task 6c's worker version stays static too;
    // sub-task 6d's capture-tall-once handles re-capture only on
    // resize / DOM mutation.
    lens.backdropKind = "static";
    renderer.uploadBackdrop(lens, canvas);
    const captureMs = performance.now() - captureStart;
    lens.lastFrame = {
      capture: captureMs,
      render: lens.lastFrame.render,
      total: captureMs + lens.lastFrame.render,
    };
  } catch (err) {
    const message = stringifyError(err);
    lens.lastError = message;
    lens.modeC = {
      target,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      kind: "full",
      reason: null,
      lastError: message,
    };
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("@glazelab/core: Mode C rasterization failed", err);
    }
  }
}

interface ModeCCapturePlan {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "full" | "windowed";
  reason: string | null;
}

const ELEMENT_SCROLL_CAPTURE_REASON = "element scroll viewport capture";

function computeModeCCapture(
  target: HTMLElement,
  lens: Lens,
  maxTextureSize: number,
): ModeCCapturePlan {
  if (isElementScrollTarget(target)) {
    return {
      x: target.scrollLeft,
      y: target.scrollTop,
      width: Math.max(1, target.clientWidth),
      height: Math.max(1, target.clientHeight),
      kind: "windowed",
      reason: ELEMENT_SCROLL_CAPTURE_REASON,
    };
  }

  const full = getModeCFullSize(target);
  if (full.width <= maxTextureSize && full.height <= maxTextureSize) {
    return {
      x: 0,
      y: 0,
      width: full.width,
      height: full.height,
      kind: "full",
      reason: null,
    };
  }

  const viewport = getModeCViewportSize(target);
  const margin = Math.max(128, Math.ceil(Math.max(lens.rect.w, lens.rect.h) * 2));
  const minWidth = Math.ceil(lens.rect.w + margin * 2);
  const minHeight = Math.ceil(lens.rect.h + margin * 2);
  if (minWidth > maxTextureSize || minHeight > maxTextureSize) {
    throw new Error(
      `Mode C lens (${minWidth}x${minHeight}) exceeds max texture size ${maxTextureSize}`,
    );
  }

  const width = Math.min(
    full.width,
    maxTextureSize,
    Math.max(minWidth, Math.ceil(viewport.width + margin * 2)),
  );
  const height = Math.min(
    full.height,
    maxTextureSize,
    Math.max(minHeight, Math.ceil(viewport.height + margin * 2)),
  );
  const point = getLensContentPoint(target, lens);
  return {
    x: clamp(point.x - margin, 0, Math.max(0, full.width - width)),
    y: clamp(point.y - margin, 0, Math.max(0, full.height - height)),
    width,
    height,
    kind: "windowed",
    reason: `full capture ${full.width}x${full.height} exceeds max texture size ${maxTextureSize}`,
  };
}

function getModeCFullSize(target: HTMLElement): { width: number; height: number } {
  if (isDocumentScrollTarget(target)) {
    const doc = document.documentElement;
    return {
      width: Math.max(
        1,
        target.scrollWidth,
        doc.scrollWidth,
        doc.clientWidth,
        window.innerWidth,
      ),
      height: Math.max(
        1,
        target.scrollHeight,
        doc.scrollHeight,
        doc.clientHeight,
        window.innerHeight,
      ),
    };
  }
  return {
    width: Math.max(1, target.clientWidth, target.scrollWidth),
    height: Math.max(1, target.clientHeight, target.scrollHeight),
  };
}

function getModeCViewportSize(
  target: HTMLElement,
): { width: number; height: number } {
  if (isDocumentScrollTarget(target)) {
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
    };
  }
  return {
    width: Math.max(1, target.clientWidth),
    height: Math.max(1, target.clientHeight),
  };
}

function getLensContentPoint(
  target: HTMLElement,
  lens: Lens,
): { x: number; y: number } {
  if (isDocumentScrollTarget(target)) {
    return {
      x: window.scrollX + lens.rect.x,
      y: window.scrollY + lens.rect.y,
    };
  }
  const r = target.getBoundingClientRect();
  return {
    x: target.scrollLeft + lens.rect.x - r.left,
    y: target.scrollTop + lens.rect.y - r.top,
  };
}

function isDocumentScrollTarget(target: HTMLElement): boolean {
  return target === document.body || target === document.documentElement;
}

function isElementScrollTarget(target: HTMLElement): boolean {
  if (isDocumentScrollTarget(target)) return false;
  return (
    target.scrollHeight > target.clientHeight ||
    target.scrollWidth > target.clientWidth
  );
}

function attachModeCScrollRefresh(
  target: HTMLElement,
  refresh: () => void,
): (() => void) | null {
  if (!isElementScrollTarget(target)) return null;

  let timer: number | null = null;
  const onScroll = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      refresh();
    }, 80);
  };

  target.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    target.removeEventListener("scroll", onScroll);
  };
}

function createDebugInfo(
  lens: Lens,
  renderer: ReturnType<typeof acquire>,
): GlassDebugInfo | null {
  if (process.env.NODE_ENV === "production") return null;
  const res = lens.glResources;
  const modeC = lens.modeC;
  return {
    uniforms: {
      radius: lens.config.radius,
      frost: lens.config.frost,
      saturation: lens.config.saturation,
      brightness: lens.config.brightness,
      tint: lens.config.tint,
      grain: lens.config.grain,
      bevelWidth: lens.config.bevelWidth,
      bendZone: lens.config.bendZone,
      refraction: lens.config.refraction,
      bevelDepth: lens.config.bevelDepth,
      chromatic: lens.config.chromatic,
      rimIntensity: lens.config.rimIntensity,
      lightAngle: lens.config.lightAngle,
      specularSize: lens.config.specularSize,
      specularOpacity: lens.config.specularOpacity,
    },
    lastFrame: lens.lastFrame,
    backdropMode: lens.backdropMode ?? "none",
    source: getDebugSource(lens),
    anchor: elementDebugInfo(lens.config.backdropAnchor),
    texture:
      res && res.textureW > 0 && res.textureH > 0
        ? {
            width: res.textureW,
            height: res.textureH,
            maxTextureSize: renderer.getMaxTextureSize(),
          }
        : null,
    scroll: modeC ? getDebugScroll(modeC.target) : null,
    capture: modeC
      ? {
          x: modeC.x,
          y: modeC.y,
          width: modeC.width,
          height: modeC.height,
          kind: modeC.kind,
          reason: modeC.reason,
        }
      : null,
    lastError: lens.lastError ?? modeC?.lastError ?? null,
    backdropPreview: getBackdropPreview(lens),
  };
}

function getBackdropPreview(lens: Lens): string {
  if (!(lens.backdropSource instanceof HTMLCanvasElement)) return "";
  try {
    return lens.backdropSource.toDataURL("image/png");
  } catch {
    return "";
  }
}

function getDebugSource(lens: Lens): GlassDebugInfo["source"] {
  if (lens.modeC) return "dom";
  const source = lens.backdropSource;
  if (source instanceof HTMLVideoElement) return "video";
  if (source instanceof HTMLCanvasElement) return "canvas";
  if (source instanceof HTMLImageElement) return "image";
  return "none";
}

function getDebugScroll(target: HTMLElement): NonNullable<GlassDebugInfo["scroll"]> {
  if (isDocumentScrollTarget(target)) {
    return { x: window.scrollX, y: window.scrollY, target: "window" };
  }
  return { x: target.scrollLeft, y: target.scrollTop, target: "element" };
}

function elementDebugInfo(el: HTMLElement | null): GlassDebugElement | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id,
    className: String(el.className ?? ""),
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
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
