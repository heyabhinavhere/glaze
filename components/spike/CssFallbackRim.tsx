"use client";

import type { RimConfig } from "@/lib/spike/rim-config";

interface Props {
  config: RimConfig;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * CSS-only "soft glass" fallback.
 *
 * Ships as the graceful-degradation tier — what users see when WebGL isn't
 * available, or when they explicitly opt into the pure-CSS mode (for perf
 * on very low-end devices or to avoid spinning up a GL context for trivial
 * decorative glass). It is *not* refractive — backdrop content does not
 * bend at the edge. But it still looks like glass: blurred tinted backdrop
 * via native `backdrop-filter`, plus faked directional rim lighting via
 * inset box-shadow gradients.
 *
 * This cannot do:
 *   - Refraction (displacement of backdrop pixels — needs WebGL)
 *   - Chromatic dispersion (per-channel displacement — same reason)
 *   - True bevel lensing (a real convex-surface light model)
 *
 * This can do, and does, via CSS alone:
 *   - Blur + saturation + brightness of backdrop (native backdrop-filter)
 *   - Tint overlay (background-color with alpha)
 *   - Directional rim highlight (radial gradient positioned by lightAngle)
 *   - Subtle inner edge bevel (inset box-shadow)
 *   - Opposite-corner back-glow
 *   - Drop shadow / elevation (outer box-shadow)
 *
 * Visually reads as a Figma-style glassmorphism panel — good, but not
 * Apple Liquid Glass. Good enough as a fallback; not enough as the primary.
 */
export function CssFallbackRim({ config, className, style, children }: Props) {
  // Convert the light angle (radians, 0 = top, clockwise) into an (x, y)
  // unit vector. Positive y in CSS is down, so invert the cosine term.
  const lx = Math.sin(config.lightAngle);
  const ly = -Math.cos(config.lightAngle);

  // Normalize direction to 0-100% coordinates for the radial gradient.
  // lightAngle 0 (top) → (50, 0). lightAngle 315° (top-left) → (~15, ~15).
  const gradientX = 50 + lx * 50;
  const gradientY = 50 + ly * 50;

  // Highlight strength derived from config so the slider affects both
  // engines identically.
  const highlightAlpha = Math.min(
    0.6,
    config.rimIntensity * config.lightStrength * 0.7,
  );
  // Bevel-suggesting inner hairline. Scaled with bevelWidth but capped.
  const bevelBorderPx = Math.max(1, Math.min(6, config.bevelWidth * 200));

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        ...style,
        borderRadius: config.radius,
        backdropFilter: "blur(24px) saturate(1.25) brightness(1.05)",
        WebkitBackdropFilter: "blur(24px) saturate(1.25) brightness(1.05)",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        boxShadow: [
          "0 20px 50px -20px rgba(0,0,0,0.4)",
          `inset 0 0 0 1px rgba(255,255,255,0.14)`,
          `inset 0 0 ${bevelBorderPx}px 0 rgba(255,255,255,0.12)`,
        ].join(", "),
      }}
    >
      {/* Directional rim highlight over the backdrop-filter body. Screen
          blending keeps it additive, so it reads as a glowing rim rather
          than pasted paint. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          background: `radial-gradient(
            circle at ${gradientX}% ${gradientY}%,
            rgba(255, 255, 255, ${highlightAlpha}) 0%,
            rgba(255, 255, 255, ${highlightAlpha * 0.3}) 25%,
            rgba(255, 255, 255, 0) 60%
          )`,
          mixBlendMode: "screen",
        }}
      />
      {/* Opposite-corner back-glow — dimmer, blue-white for "back-scatter"
          feel. Mirrors Apple Liquid Glass' subtle glow diagonally across
          from the lit corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          background: `radial-gradient(
            circle at ${100 - gradientX}% ${100 - gradientY}%,
            rgba(220, 230, 255, ${highlightAlpha * 0.35}) 0%,
            rgba(220, 230, 255, 0) 40%
          )`,
          mixBlendMode: "screen",
        }}
      />
      {children}
    </div>
  );
}
