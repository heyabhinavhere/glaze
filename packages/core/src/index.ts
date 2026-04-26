/**
 * @glazelab/core — public entry (default).
 *
 * Includes Mode A (static image) + Mode B (live element) + auto-detection
 * without Mode C. For Mode C (DOM-subtree rasterization), import from
 * "@glazelab/core/full" instead.
 *
 * SUB-TASK 3a: adds isSupported() and the internal SharedRenderer
 * singleton (lifecycle + shader pre-warm). The full createGlass / Glass-
 * Handle public surface lands in 3b. Legacy types + the old WebGL-
 * GlassRenderer class continue to re-export so the playground keeps
 * dogfooding the same API during the rebuild; cleaned up in Phase 2.
 */

/* Public — new (sub-task 3+) */
export { isSupported } from "./is-supported";

/* Legacy — kept until Phase 2 migrates the playground onto createGlass */
export * from "./types";
export * from "./renderer";
export * from "./uniforms";
export * from "./presets";

export const __version = "0.0.0-rebuild-3a";
