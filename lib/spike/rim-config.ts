/**
 * Shared config for the rim-engine spike.
 *
 * Two engines under test:
 *   - WebGL: the full glass shader from the playground (body + rim in one
 *     pipeline). Requires a backdrop texture. Produces Apple Liquid Glass
 *     quality across the whole panel — no seam.
 *   - CSS fallback: native backdrop-filter body + radial-gradient rim
 *     highlights. No refraction. Graceful degradation for browsers without
 *     WebGL and for explicit perf-sensitive opt-in.
 *
 * RimConfig is the single source of truth for glass parameters in the
 * spike. It's a trimmed + friendlier view of the playground's full
 * GlassUniforms — with bevelWidth and bendZone in absolute CSS pixels
 * (not fractions of panel size) so the rim looks visually identical on
 * any panel dimension. The WebGL adapter converts to the shader's
 * fractional units at render time.
 */

export interface RimConfig {
  /** Corner radius in CSS pixels. */
  radius: number;

  // ---- Body ----
  /** Backdrop blur strength, 0-1. 0 = sharp, 1 = max frosted. Mapped to
   *  the shader's u_frost uniform which drives the body-blur pipeline. */
  frost: number;
  /** Tint colour overlaid on the body. RGBA, each channel 0-1. */
  tint: [number, number, number, number];

  // ---- Rim geometry (in CSS pixels for predictable visuals) ----
  /** Width of the lit rim hairline band in CSS pixels. Typical 1-4. */
  bevelWidth: number;
  /** Width of the refraction + bevel zone in CSS pixels, measured from
   *  the edge inward. Absolute, not a fraction of the panel. Typical 20-40. */
  bendZone: number;

  // ---- Rim optics ----
  /** Broad refraction across the bend zone. 0-0.025 engine-space. */
  refraction: number;
  /** Sharp additional refraction at the deepest part of the bevel curve.
   *  0-0.1 engine-space. */
  bevelDepth: number;
  /** Chromatic dispersion (per-channel refraction offset spread). 0-0.5. */
  chromatic: number;

  // ---- Rim lighting ----
  /** Rim highlight brightness multiplier. 0-1.2. */
  rimIntensity: number;
  /** Additional master multiplier on the lit rim. 0-1. Separate from
   *  rimIntensity so "light on/off" is a single knob. */
  lightStrength: number;
  /** Light direction in radians. 0 = top, clockwise. 5.497 ≈ 315° (top-left). */
  lightAngle: number;
  /** Specular hot-spot diameter, 0-1. */
  specularSize: number;
  /** Specular hot-spot opacity, 0-0.25. */
  specularOpacity: number;
}

/** Tuned defaults matching the playground's dialed-in state. */
export const DEFAULT_RIM_CONFIG: RimConfig = {
  radius: 24,
  frost: 0.36, // moderate frost — matches playground default frost=40
  tint: [1, 1, 1, 0.14], // white @ 14% — matches "Cups" bg suggested tint
  bevelWidth: 2,
  bendZone: 30,
  refraction: 0.02,
  bevelDepth: 0.04,
  chromatic: 0.18,
  rimIntensity: 0.528,
  lightStrength: 1.0,
  lightAngle: (315 * Math.PI) / 180,
  specularSize: 0,
  specularOpacity: 0,
};

/** Backdrop scenarios the spike tests against. Real-world breadth matters
 *  more than prettiness — we want cases where engines are likely to fail. */
export type BackdropKind =
  | "image" // one of the 7 bundled JPEGs
  | "video" // a looping muted video (not yet wired)
  | "canvas" // animated 2D canvas
  | "scroll"; // long scrolling article

export interface BackdropDef {
  readonly id: string;
  readonly label: string;
  readonly kind: BackdropKind;
  readonly src?: string;
}

export const SPIKE_BACKDROPS: readonly BackdropDef[] = [
  { id: "cups", label: "Cups (vibrant photo)", kind: "image", src: "/backgrounds/bg-4.jpg" },
  { id: "curves", label: "Curves (architecture)", kind: "image", src: "/backgrounds/bg-3.jpg" },
  { id: "warmth", label: "Warmth (gradient)", kind: "image", src: "/backgrounds/bg-7.jpg" },
  { id: "window", label: "Window (landscape)", kind: "image", src: "/backgrounds/bg-1.jpg" },
  { id: "abyss", label: "Abyss (dark)", kind: "image", src: "/backgrounds/bg-2.jpg" },
  { id: "ember", label: "Ember (noise)", kind: "image", src: "/backgrounds/bg-5.jpg" },
  { id: "sky", label: "Sky (clouds)", kind: "image", src: "/backgrounds/bg-6.jpg" },
  { id: "canvas", label: "Animated canvas", kind: "canvas" },
  { id: "scroll", label: "Scrolling article", kind: "scroll" },
] as const;
