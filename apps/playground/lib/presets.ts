import { type GlassConfig } from "./types";

/**
 * The single default Glass configuration. Captures the user's hand-tuned
 * "Apple Liquid Glass" target as of 2026-04-16: heavy refraction, thin
 * lit bevel rim, soft frost with desaturated/dimmed backdrop, prominent
 * inner-shadow, lifted drop-shadow at 4px spread.
 *
 * Presets were removed — every config edit just mutates this starting
 * point, no preset gallery anymore.
 */
export const defaultConfig: GlassConfig = {
  light: { angle: 315, intensity: 100 },
  depth: 45,
  blur: 16,
  tint: { color: "#ffffff", opacity: 10 },
  grain: { enabled: false, intensity: 2 },
  dropShadow: {
    intensity: 43,
    color: "#000000",
    xOffset: null,
    yOffset: 16,
    blur: 75,
    spread: 4,
    opacity: 24,
  },
  innerShadow: {
    color: "#000000",
    opacity: 10,
    xOffset: 0,
    yOffset: 4,
    blur: 24,
    spread: -2,
  },
  advanced: {
    refraction: 100,
    bevelDepth: 100,
    bevelWidth: 2,
    bendZone: null,
    chromatic: 100,
    bevelHighlight: 44,
    specularSize: 0,
    specularOpacity: 0,
    frost: 40,
    saturation: 20,
    brightness: 80,
  },
  preset: null,
  borderRadius: 60,
};
