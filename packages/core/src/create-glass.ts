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
  const lens = new Lens(target, resolved);
  renderer.registerLens(lens);

  // Track destroy state so the handle is idempotent across multiple
  // calls (e.g., React StrictMode cleanup that fires twice).
  let destroyed = false;

  // Async backdrop load — when the config provides a backdrop, kick
  // off the decode and upload to GPU as soon as it's ready. The lens
  // renders blank until the texture is bound; with the perf-fix
  // module-level Promise cache (decodeImageOnce) the same URL across
  // multiple lenses shares one decode. Errors degrade silently in
  // production (lens stays blank) and surface in dev via console.
  if (resolved.backdrop !== null) {
    void loadAndUploadBackdrop(lens, renderer, resolved.backdrop);
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
 *       not clobber the new state. */
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
    renderer.uploadBackdrop(lens, resolved);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("@glazelab/core: backdrop decode failed", err);
    }
  }
}
