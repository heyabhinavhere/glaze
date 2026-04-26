import type { GlassUniforms } from "@glazelab/core";
import type { RimConfig } from "./rim-config";

/**
 * Adapter from the spike's RimConfig (pixel-based, trimmed surface) to the
 * playground's GlassUniforms (fractional units, full surface). Keeps the
 * RimConfig type stable as we iterate on API; changes to the shader side
 * only require updating this mapping.
 *
 * Called per-render in the spike's useEffect that updates lens uniforms,
 * so cheap and allocation-free is the bar.
 */
export function rimConfigToUniforms(
  config: RimConfig,
  panelMinDim: number,
): GlassUniforms {
  // The playground shader expects bevelWidth and bendZone as fractions of
  // min(width, height). Convert from our CSS-px values. Guard against a
  // zero panel (can happen on first render before layout).
  const safeMin = Math.max(1, panelMinDim);
  return {
    radius: config.radius,
    refraction: config.refraction,
    bevelDepth: config.bevelDepth,
    bevelWidth: config.bevelWidth / safeMin,
    bendZone: config.bendZone / safeMin,
    frost: config.frost,
    lightAngle: config.lightAngle,
    lightIntensity: config.lightStrength,
    specularSize: config.specularSize,
    specularOpacity: config.specularOpacity,
    bevelHighlight: config.rimIntensity,
    tint: config.tint,
    chromatic: config.chromatic,
    grain: 0,
  };
}
