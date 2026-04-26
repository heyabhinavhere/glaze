/**
 * @glazelab/core — public entry (default).
 *
 * Includes Mode A (static image) + Mode B (live element) + auto-detection
 * without Mode C. For Mode C (DOM-subtree rasterization), import from
 * "@glazelab/core/full" instead.
 *
 * NOTE — sub-task 2 of Phase 1: this entry currently re-exports the
 * full unchanged playground surface (types, uniform mapper, presets,
 * renderer class). Sub-task 3 onward refines this into the §6 public
 * API: createGlass / GlassHandle / presets / isSupported. The internal
 * symbols (WebGLGlassRenderer, raw uniforms, etc.) become package-
 * internal at that point. For now they're public so the playground can
 * keep dogfooding the same API while the rebuild happens.
 */

export * from "./types";
export * from "./renderer";
export * from "./uniforms";
export * from "./presets";

export const __version = "0.0.0-extract";
