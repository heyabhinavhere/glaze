export interface LightConfig {
  angle: number;
  intensity: number;
}

export interface TintConfig {
  color: string;
  opacity: number;
}

export interface GrainConfig {
  enabled: boolean;
  intensity: number;
}

/**
 * Advanced overrides — each field maps directly to a shader uniform. When
 * a field is null, the engine derives its value from the Simple controls.
 * When set, it overrides — so Advanced sliders stack cleanly on Simple
 * intent without erasing it.
 *
 * All values are in user-facing 0–100 space; the engine scales to shader
 * uniform ranges. Exception: saturation and brightness are percentage-of-
 * normal (100 = neutral, >100 boosts, <100 reduces).
 */
export interface GlassAdvanced {
  // --- Refraction / lensing ---
  /** Ambient refraction across the bevel zone. 0–100. */
  refraction: number | null;
  /** Sharp refraction AT the rim (the "glass lip" effect). 0–100. */
  bevelDepth: number | null;
  /** How far inward the bevel zone extends. 0–100. Thickness of the lit band. */
  bevelWidth: number | null;
  /** How far inward the refraction "bending zone" extends, as a fraction
      of the panel's smaller dimension. 0–100. Larger = wider warped rim. */
  bendZone: number | null;
  /** Chromatic dispersion (RGB split at rim). 0–100. */
  chromatic: number | null;

  // --- Lighting ---
  /** Rim + wash brightness multiplier. 0–100. */
  bevelHighlight: number | null;
  /** Diameter of the specular spot. 0–100. */
  specularSize: number | null;
  /** Opacity of the specular spot. 0–100. */
  specularOpacity: number | null;

  // --- Frost (tonal) ---
  /** Backdrop blur radius. 0–100. */
  frost: number | null;
  /** Backdrop saturation — 100 = neutral, 0 = monochrome, 200 = super-saturated. */
  saturation: number | null;
  /** Backdrop brightness — 100 = neutral, 50 = dim, 150 = bright. */
  brightness: number | null;
}

export const EMPTY_ADVANCED: GlassAdvanced = {
  refraction: null,
  bevelDepth: null,
  bevelWidth: null,
  bendZone: null,
  chromatic: null,
  bevelHighlight: null,
  specularSize: null,
  specularOpacity: null,
  frost: null,
  saturation: null,
  brightness: null,
};

/**
 * Drop shadow that GROUNDS the glass panel. Renders via CSS box-shadow on
 * the glass anchor (not drop-shadow — an empty element has no alpha for
 * drop-shadow to cast from; box-shadow works on the border-box).
 * Matches Figma's drop-shadow config: X, Y, Blur, Spread, Color, Opacity.
 */
/**
 * Inner shadow — Figma-style. Renders as CSS box-shadow inset on the glass
 * anchor (combined with the outer drop shadow). Follows the rounded rect
 * shape natively. No master intensity slider — values are direct, like Figma.
 */
export interface InnerShadowConfig {
  /** Hex color. */
  color: string;
  /** Opacity 0–100%. */
  opacity: number;
  xOffset: number; // px
  yOffset: number; // px
  blur: number; // px
  spread: number; // px
}

export interface DropShadowConfig {
  /** 0–100, master slider — drives Y, Blur, and Opacity together. */
  intensity: number;
  /** Hex color of the shadow. */
  color: string;
  /** Advanced overrides — when set, take precedence over the derived values. */
  xOffset: number | null; // px
  yOffset: number | null; // px
  blur: number | null; // px
  spread: number | null; // px
  opacity: number | null; // 0..100
}

export interface GlassConfig {
  light: LightConfig;
  depth: number;
  blur: number;
  tint: TintConfig;
  grain: GrainConfig;
  dropShadow: DropShadowConfig;
  innerShadow: InnerShadowConfig;
  advanced: GlassAdvanced;
  preset: string | null;
  borderRadius: number;
}

/**
 * The resolved / computed glass values. Still contains legacy CSS shadow
 * values for the CSS-export fallback path, but the live preview consumes
 * only `uniforms`.
 */
export interface ResolvedGlass {
  borderRadius: number;
  backdrop: {
    blur: number;
    saturation: number;
    brightness: number;
  };
  tint: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  // Legacy CSS fallback fields — used only by export-css.
  edges: { top: EdgeLight; right: EdgeLight; bottom: EdgeLight; left: EdgeLight };
  cornerGlow: { x: number; y: number; opacity: number; radiusX: number; radiusY: number };
  innerShadow: {
    x: number;
    y: number;
    blur: number;
    spread: number;
    opacity: number;
    color: string;
  };
  dropShadow: {
    x: number;
    y: number;
    blur: number;
    spread: number;
    opacity: number;
    color: string;
  };
  specular: {
    enabled: boolean;
    x: number;
    y: number;
    size: number;
    intensity: number;
  };
  grain: {
    enabled: boolean;
    opacity: number;
  };
}

export interface EdgeLight {
  factor: number;
  rimOpacity: number;
  glowOpacity: number;
  shadowOpacity: number;
  glowDepth: number;
}

export type CssVarMap = Record<string, string>;

export interface GlassShaderUniforms {
  radius: number;
  refraction: number;
  bevelDepth: number;
  bevelWidth: number;
  bendZone: number;
  frost: number;
  lightAngle: number;
  lightIntensity: number;
  specularSize: number;
  specularOpacity: number;
  bevelHighlight: number;
  tint: [number, number, number, number];
  chromatic: number;
  grain: number;
}

export interface GlassCssOutput {
  resolved: ResolvedGlass;
  cssVars: CssVarMap;
  uniforms: GlassShaderUniforms;
  /** Simple-derived uniform values (before Advanced overrides applied).
      Used by the control panel to show the "default" value a slider would
      snap to if the override were cleared. */
  derivedUniforms: GlassShaderUniforms;
}
