/**
 * Internal types — the shape of fully-resolved lens state.
 *
 * Public-facing config (with optional fields + ColorInput strings) lives
 * in ../public-types.ts; the LensConfig here is the resolved internal
 * shape after defaults have been merged in and tint string has been
 * parsed to a normalized RGBA tuple.
 *
 * Phase 2 will promote a subset of these to public names (e.g. LensConfig
 * → GlassConfig) once the legacy GlassConfig is removed.
 */

import type { ShadowConfig } from "../public-types";

/* -------------------------------------------------------------------------- */
/* LensConfig — fully-resolved internal config (no Partial, no Color strings) */
/* -------------------------------------------------------------------------- */

export interface LensConfig {
  // Geometry (CSS pixels).
  radius: number;

  // Body.
  frost: number; // 0–1
  saturation: number; // 0–2.5; 1 = neutral
  brightness: number; // 0–2; 1 = neutral
  tint: readonly [number, number, number, number]; // RGBA 0–1
  grain: number; // 0–1

  // Rim geometry (CSS pixels).
  bevelWidth: number;
  bendZone: number;

  // Rim optics.
  refraction: number;
  bevelDepth: number;
  chromatic: number;

  // Rim lighting.
  rimIntensity: number;
  lightAngle: number; // radians
  specularSize: number;
  specularOpacity: number;

  // Shadows.
  innerShadow: ShadowConfig | null;
  dropShadow: ShadowConfig | null;

  // Backdrop binding (sub-task 5 wires the providers).
  backdrop:
    | string
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | null;
  backdropFrom: HTMLElement | (() => HTMLElement) | null;
}

/* -------------------------------------------------------------------------- */
/* Default LensConfig — matches the §5 playground preset exactly             */
/* -------------------------------------------------------------------------- */

/** Locked from playground's `defaultConfig` mapped to flat units.
 *  Sub-task 4 may revisit specific fields when the saturation/brightness
 *  pass lands; this is the design-doc default for now. */
export const DEFAULT_LENS_CONFIG: LensConfig = {
  // Geometry
  radius: 60,

  // Body
  frost: 0.36,
  saturation: 0.5, // playground saturation:20 mapped through ADVANCED_RANGES
  brightness: 1.6, // playground brightness:80 mapped through ADVANCED_RANGES
  tint: [1, 1, 1, 0.1], // white @ 10%
  grain: 0,

  // Rim geometry — absolute pixels
  bevelWidth: 2,
  bendZone: 30,

  // Rim optics
  refraction: 0.02,
  bevelDepth: 0.04,
  chromatic: 0.25,

  // Rim lighting
  rimIntensity: 0.528,
  lightAngle: (315 * Math.PI) / 180,
  specularSize: 0,
  specularOpacity: 0,

  // Shadows
  innerShadow: {
    x: 0,
    y: 4,
    blur: 24,
    spread: -2,
    color: "#000000",
    opacity: 0.1,
  },
  dropShadow: {
    x: 0,
    y: 16,
    blur: 75,
    spread: 4,
    color: "#000000",
    opacity: 0.24,
  },

  // Backdrop — set by createGlass arg or auto-detected (sub-task 5)
  backdrop: null,
  backdropFrom: null,
};
