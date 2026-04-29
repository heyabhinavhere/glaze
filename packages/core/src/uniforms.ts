import type {
  CssVarMap,
  GlassCssOutput,
  GlassConfig,
  GlassShaderUniforms,
  ResolvedGlass,
} from "./types";

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const deg2rad = (deg: number) => (deg * Math.PI) / 180;
const round = (v: number, d = 3) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

const hexToRgb = (hex: string) => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/* -------------------------------------------------------------------------- */
/* Advanced mapping — converts 0–100 user-facing slider values to shader     */
/* uniform scales. Edit the right-hand numbers to re-shape the entire       */
/* tunable space without touching UI or preset code.                         */
/* -------------------------------------------------------------------------- */

export const ADVANCED_RANGES = {
  refraction: { min: 0, max: 0.02 },
  bevelDepth: { min: 0, max: 0.04 },
  bevelWidth: { min: 0, max: 0.5 },
  // bendZone is the FRACTION of the panel's smaller dimension over which
  // refraction happens. 0.07 (default) ≈ Figma; 0.20 = chunky liquid.
  bendZone: { min: 0.02, max: 0.2 },
  chromatic: { min: 0, max: 0.4 },
  bevelHighlight: { min: 0, max: 1.2 },
  specularSize: { min: 0.02, max: 0.8 },
  specularOpacity: { min: 0, max: 0.25 },
  frost: { min: 0, max: 1 },
  saturation: { min: 0, max: 2.5 }, // user 100 = 1.0 in shader
  brightness: { min: 0, max: 2 }, // user 100 = 1.0 in shader
} as const;

/** Map user-facing 0–100 value to the shader's actual range. */
export function userToUniform(
  key: keyof typeof ADVANCED_RANGES,
  value: number,
): number {
  const r = ADVANCED_RANGES[key];
  if (key === "saturation" || key === "brightness") {
    // These are ratios: user 100 = 1.0 (neutral), below 100 reduces,
    // above 100 boosts. Do not map across the full min/max range like the
    // other sliders, or the default 80% brightness becomes 1.6x.
    return clamp(value / 100, r.min, r.max);
  }
  return lerp(r.min, r.max, clamp(value, 0, 100) / 100);
}

/** Inverse: shader value → user 0–100 slider value. */
export function uniformToUser(
  key: keyof typeof ADVANCED_RANGES,
  uniform: number,
): number {
  const r = ADVANCED_RANGES[key];
  if (key === "saturation" || key === "brightness") {
    return uniform * 100;
  }
  return ((uniform - r.min) / (r.max - r.min)) * 100;
}

/* -------------------------------------------------------------------------- */
/* Resolver                                                                   */
/* -------------------------------------------------------------------------- */

export function resolveGlass(config: GlassConfig): ResolvedGlass {
  const { depth, blur, tint, grain, borderRadius, light } = config;
  const depthT = clamp(depth, 0, 100) / 100;
  const blurT = clamp(blur, 0, 100) / 100;
  const intensityT = clamp(light.intensity, 0, 100) / 100;
  const tintRgb = hexToRgb(tint.color);
  const tintOpacity = clamp(tint.opacity, 0, 100) / 100;

  const innerShadow = {
    x: 0,
    y: 0,
    blur: round(lerp(0, 14, depthT)),
    spread: 0,
    opacity: round(lerp(0, 0.2, depthT), 4),
    color: "#000000",
  };
  const dropShadow = {
    x: 0,
    y: round(lerp(4, 28, depthT)),
    blur: round(lerp(12, 60, depthT)),
    spread: 0,
    opacity: round(lerp(0.15, 0.38, depthT), 4),
    color: "#000000",
  };

  return {
    borderRadius,
    backdrop: {
      blur: round(lerp(0, 40, blurT)),
      saturation: round(lerp(1.0, 1.8, blurT)),
      brightness: 1,
    },
    tint: { ...tintRgb, a: round(tintOpacity, 4) },
    edges: {
      top: emptyEdge(),
      right: emptyEdge(),
      bottom: emptyEdge(),
      left: emptyEdge(),
    },
    cornerGlow: { x: 50, y: 50, opacity: 0, radiusX: 0, radiusY: 0 },
    innerShadow,
    dropShadow,
    specular: {
      enabled: true,
      x: round(50 + 40 * Math.sin(deg2rad(light.angle))),
      y: round(50 - 40 * Math.cos(deg2rad(light.angle))),
      size: 40,
      intensity: round(lerp(0.08, 0.2, intensityT), 4),
    },
    grain: {
      enabled: grain.enabled,
      opacity: grain.enabled ? round(grain.intensity / 10, 4) : 0,
    },
  };
}

const emptyEdge = () => ({
  factor: 0,
  rimOpacity: 0,
  glowOpacity: 0,
  shadowOpacity: 0,
  glowDepth: 0,
});

export function resolvedToCssVars(r: ResolvedGlass): CssVarMap {
  const { r: tr, g: tg, b: tb, a: ta } = r.tint;
  const innerShadow = `inset 0 0 ${r.innerShadow.blur}px rgba(0,0,0,${r.innerShadow.opacity})`;
  const dropShadow = `0 ${r.dropShadow.y}px ${r.dropShadow.blur}px rgba(0,0,0,${r.dropShadow.opacity})`;
  return {
    "--glass-radius": `${r.borderRadius}px`,
    "--glass-tint": `rgba(${tr}, ${tg}, ${tb}, ${ta})`,
    "--glass-backdrop-filter": `blur(${r.backdrop.blur}px) saturate(${r.backdrop.saturation})`,
    "--glass-box-shadow": `${innerShadow}, ${dropShadow}`,
    "--glass-grain-opacity": `${r.grain.opacity}`,
  };
}

/**
 * Simple-derived uniforms (before Advanced overrides). This is what each
 * shader parameter WOULD be if no advanced controls were touched.
 */
function computeDerivedUniforms(
  r: ResolvedGlass,
  cfg: GlassConfig,
): GlassShaderUniforms {
  const depthT = clamp(cfg.depth, 0, 100) / 100;
  const blurT = clamp(cfg.blur, 0, 100) / 100;
  const intensityT = clamp(cfg.light.intensity, 0, 100) / 100;

  return {
    radius: cfg.borderRadius,
    refraction: lerp(0.004, 0.025, depthT),
    bevelDepth: lerp(0.02, 0.1, depthT),
    bevelWidth: lerp(0.08, 0.16, depthT),
    bendZone: 0.07,
    frost: blurT * 0.9,
    lightAngle: deg2rad(cfg.light.angle),
    lightIntensity: intensityT,
    specularSize: lerp(0.28, 0.5, intensityT),
    specularOpacity: lerp(0.04, 0.13, intensityT),
    bevelHighlight: lerp(0.25, 0.85, intensityT),
    tint: [r.tint.r / 255, r.tint.g / 255, r.tint.b / 255, r.tint.a],
    chromatic: lerp(0.06, 0.25, depthT),
    grain: r.grain.opacity,
  };
}

/**
 * Final uniforms: derived from Simple, then any non-null Advanced override
 * replaces the corresponding field.
 */
function applyAdvanced(
  derived: GlassShaderUniforms,
  adv: GlassConfig["advanced"],
): GlassShaderUniforms {
  const u = { ...derived };
  const over = <K extends keyof typeof ADVANCED_RANGES>(
    k: K,
    prop: keyof GlassShaderUniforms & string,
  ) => {
    const userValue = adv[k];
    if (userValue != null) {
      // @ts-expect-error: prop is narrowed at each call site.
      u[prop] = userToUniform(k, userValue);
    }
  };

  over("refraction", "refraction");
  over("bevelDepth", "bevelDepth");
  over("bevelWidth", "bevelWidth");
  over("bendZone", "bendZone");
  over("chromatic", "chromatic");
  over("bevelHighlight", "bevelHighlight");
  over("specularSize", "specularSize");
  over("specularOpacity", "specularOpacity");
  over("frost", "frost");
  // Saturation/brightness are intentionally not applied to this legacy
  // uniform model. The shader still has neutral uniforms set by the legacy
  // renderer; tonal controls need a deliberate pass before they affect UI.
  return u;
}

export function glassConfigToCSS(config: GlassConfig): GlassCssOutput {
  const resolved = resolveGlass(config);
  const derived = computeDerivedUniforms(resolved, config);
  const uniforms = applyAdvanced(derived, config.advanced);
  return {
    resolved,
    cssVars: resolvedToCssVars(resolved),
    uniforms,
    derivedUniforms: derived,
  };
}

export function applyCssVars(el: HTMLElement, vars: CssVarMap) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}

/**
 * Compute the CSS box-shadow string for the OUTER drop shadow.
 *   intensity (0–100) drives Y, Blur, and Opacity together.
 *   X offset and Spread default to 0.
 *   All fields can be individually overridden in Advanced.
 */
export function dropShadowCss(config: GlassConfig): string {
  const ds = config.dropShadow;
  const t = clamp(ds.intensity, 0, 100) / 100;
  const x = ds.xOffset ?? 0;
  const y = ds.yOffset ?? round(lerp(2, 40, t));
  const blur = ds.blur ?? round(lerp(6, 80, t));
  const spread = ds.spread ?? 0;
  const opacity = (ds.opacity ?? round(lerp(10, 45, t))) / 100;
  const rgb = hexToRgb(ds.color);
  return `${x}px ${y}px ${blur}px ${spread}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(opacity, 3)})`;
}

/**
 * INNER shadow as a CSS `box-shadow: inset` string. Renders inside the
 * border-box of the glass anchor and follows the rounded-rect shape
 * natively. Returns null when opacity is 0 so we can omit the layer.
 */
export function innerShadowCss(config: GlassConfig): string | null {
  const is = config.innerShadow;
  const opacity = clamp(is.opacity, 0, 100) / 100;
  if (opacity <= 0) return null;
  const rgb = hexToRgb(is.color);
  return `inset ${is.xOffset}px ${is.yOffset}px ${is.blur}px ${is.spread}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(opacity, 3)})`;
}

/**
 * Combined CSS box-shadow string: outer drop shadow plus inner shadow.
 * Apply directly to the glass anchor's `style.boxShadow`.
 */
export function combinedShadowCss(config: GlassConfig): string {
  const outer = dropShadowCss(config);
  const inner = innerShadowCss(config);
  return inner ? `${outer}, ${inner}` : outer;
}

export { hexToRgb };
