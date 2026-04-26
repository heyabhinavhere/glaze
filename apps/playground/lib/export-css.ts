import type { ResolvedGlass } from "./types";

/**
 * CSS approximation — this is the EXPORT path, not the live preview.
 * The live preview renders with a WebGL shader for full Apple-grade quality;
 * this function gives developers a portable plain-CSS fallback they can ship.
 *
 * Trade-offs compared to the live preview:
 *   - no per-pixel refraction (just backdrop blur)
 *   - no chromatic dispersion
 *   - no animated specular
 *   - subtle rim lighting is faked via box-shadow
 *
 * For the real premium effect, developers can use the React (WebGL) export.
 */
export function toVanillaCSS(r: ResolvedGlass): string {
  const { r: tr, g: tg, b: tb, a: ta } = r.tint;
  const tint = `rgba(${tr}, ${tg}, ${tb}, ${ta})`;

  const innerShadow = `inset 0 0 ${r.innerShadow.blur}px rgba(0, 0, 0, ${r.innerShadow.opacity})`;
  const topHighlight = `inset 0 1px 0 rgba(255, 255, 255, 0.25)`;
  const topGlow = `inset 0 2px 16px -6px rgba(255, 255, 255, 0.3)`;
  const dropShadow = `0 ${r.dropShadow.y}px ${r.dropShadow.blur}px rgba(0, 0, 0, ${r.dropShadow.opacity})`;

  const boxShadow = [topHighlight, topGlow, innerShadow, dropShadow]
    .map((s) => `    ${s}`)
    .join(",\n");

  return `.glass {
  position: relative;
  border-radius: ${r.borderRadius}px;
  background: ${tint};
  backdrop-filter: blur(${r.backdrop.blur}px) saturate(${r.backdrop.saturation});
  -webkit-backdrop-filter: blur(${r.backdrop.blur}px) saturate(${r.backdrop.saturation});
  box-shadow:
${boxShadow};
}
`;
}
