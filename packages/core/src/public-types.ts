/**
 * Public types for the @glazelab/core API.
 *
 * Names that don't conflict with the legacy surface (kept until Phase 2)
 * are exported under their canonical names from index.ts. The new
 * GlassConfig type is currently exposed only via the createGlass()
 * function signature — the legacy GlassConfig still claims the
 * top-level name during the rebuild and Phase 2 swaps them.
 */

/* -------------------------------------------------------------------------- */
/* Color input                                                                */
/* -------------------------------------------------------------------------- */

/** Either a CSS color string ("rgba(...)", "#hex", "oklch(...)" — anything
 *  the browser can parse) or a normalized RGBA tuple in 0–1 each.
 *
 *  Strings are the ergonomic default; tuples are the zero-parse fast path
 *  for animation libraries already producing normalized values. */
export type ColorInput =
  | string
  | readonly [r: number, g: number, b: number, a: number];

/* -------------------------------------------------------------------------- */
/* Shadow config (Figma-shaped)                                               */
/* -------------------------------------------------------------------------- */

export interface ShadowConfig {
  /** Pixel offset along X. */
  x: number;
  /** Pixel offset along Y. */
  y: number;
  /** Pixel blur radius. */
  blur: number;
  /** Pixel spread (positive = larger). */
  spread: number;
  /** Hex / rgb / rgba color string. */
  color: string;
  /** 0–1. Multiplies into the color's alpha. */
  opacity: number;
}

/* -------------------------------------------------------------------------- */
/* Handle returned by createGlass()                                           */
/* -------------------------------------------------------------------------- */

/** Live handle to a glass element. Returned by createGlass(); used to
 *  update config, force backdrop refreshes, and tear down. All methods
 *  are idempotent (safe to call after destroy()). */
export interface GlassHandle {
  /** Mutate config. Coalesced with any other update calls in the same
   *  frame. Zero-allocation hot path: see updateUniform for the
   *  per-frame animation drive. */
  update(partial: GlassConfigUpdate): void;

  /** Zero-allocation hot path for animation drives. Writes a single
   *  uniform slot directly. Use when in a tight rAF loop animating one
   *  value. Skip for one-shot updates — use `update()` instead. */
  updateUniform(key: GlassUniformKey, value: number): void;

  /** Force a fresh backdrop capture (Mode C). No-op for Modes A/B —
   *  capture happens automatically. Auto-triggered by ResizeObserver +
   *  MutationObserver in Mode C; this entry is for rare cases where
   *  consumers animate non-DOM-observable state. */
  refreshBackdrop(): void;

  /** Tear down. Idempotent — safe to call multiple times, including
   *  from React StrictMode cleanups that fire twice. */
  destroy(): void;

  /** The host element this handle is attached to. Identity preserved
   *  across update() / refreshBackdrop() calls. */
  getElement(): HTMLElement;

  /** True if rendering via WebGL, false if rendering via CSS fallback
   *  (no WebGL2, no OffscreenCanvas, after context loss without
   *  recovery, etc.) */
  isWebGL(): boolean;

  /** DEV-ONLY. Returns live uniforms, last-frame timing, captured
   *  backdrop preview, and detected backdrop mode. Stripped from
   *  production builds via NODE_ENV dead-code elimination — zero
   *  prod bytes. Returns null outside dev. */
  debug(): GlassDebugInfo | null;
}

/* -------------------------------------------------------------------------- */
/* Update payload                                                             */
/* -------------------------------------------------------------------------- */

/** Partial config payload passed to handle.update(). Each key is
 *  optional — missing keys keep their current value.
 *
 *  Phase 2 will rename to `Partial<GlassConfig>` once the legacy
 *  GlassConfig is removed. The shape is identical to GlassConfig
 *  in internal/types.ts. */
export interface GlassConfigUpdate {
  radius?: number;
  frost?: number;
  saturation?: number;
  brightness?: number;
  tint?: ColorInput;
  grain?: number;
  bevelWidth?: number;
  bendZone?: number;
  refraction?: number;
  bevelDepth?: number;
  chromatic?: number;
  rimIntensity?: number;
  lightAngle?: number;
  specularSize?: number;
  specularOpacity?: number;
  innerShadow?: ShadowConfig;
  dropShadow?: ShadowConfig;
  backdrop?: string | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  backdropFrom?: HTMLElement | (() => HTMLElement);
}

/** Keys writable via updateUniform()'s zero-allocation hot path. Restricted
 *  to scalar numeric uniforms (no color, no shadow, no backdrop). */
export type GlassUniformKey =
  | "radius"
  | "frost"
  | "saturation"
  | "brightness"
  | "grain"
  | "bevelWidth"
  | "bendZone"
  | "refraction"
  | "bevelDepth"
  | "chromatic"
  | "rimIntensity"
  | "lightAngle"
  | "specularSize"
  | "specularOpacity";

/* -------------------------------------------------------------------------- */
/* Debug info (dev-only)                                                      */
/* -------------------------------------------------------------------------- */

export interface GlassDebugInfo {
  /** Current uniform values, key → number-or-tuple. Read-only snapshot. */
  uniforms: Readonly<Record<string, number | readonly number[]>>;
  /** Last-frame timing in milliseconds. */
  lastFrame: { capture: number; render: number; total: number };
  /** Detected backdrop mode. "fallback" = CSS path, no GL. */
  backdropMode: "A" | "B" | "C" | "fallback";
  /** Base64 PNG of the current captured backdrop, paste into DevTools
   *  to inspect. Empty string for Mode A/B (just the source URL/element). */
  backdropPreview: string;
}
