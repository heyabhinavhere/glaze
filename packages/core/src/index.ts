/**
 * @glazelab/core — public entry (default).
 *
 * Includes Mode A (static image) + Mode B (live element) + auto-detection
 * without Mode C. For Mode C (DOM-subtree rasterization), import from
 * "@glazelab/core/full" instead.
 *
 * SUB-TASK 3b: adds createGlass() returning a GlassHandle; renders a
 * test pattern (translucent gradient) per lens via the full offscreen
 * → bitmap → per-lens 2D canvas blit pipeline. The real glass shader
 * replaces the test pattern in 3c. Legacy types + the old WebGL-
 * GlassRenderer class continue to re-export so the playground keeps
 * dogfooding the same API during the rebuild; cleaned up in Phase 2.
 */

/* Public — new (sub-task 3+) */
export { createGlass } from "./create-glass";
export { isSupported } from "./is-supported";
export type {
  ColorInput,
  GlassConfigUpdate,
  GlassDebugInfo,
  GlassHandle,
  GlassUniformKey,
  ShadowConfig,
} from "./public-types";

/* Legacy — kept until Phase 2 migrates the playground onto createGlass */
export * from "./types";
export * from "./renderer";
export * from "./uniforms";
export * from "./presets";

export const __version = "0.0.0-rebuild-3b";
