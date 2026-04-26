/**
 * Glass fragment shader — the real Liquid Glass.
 *
 * Inputs: a texture of the content BEHIND the glass (captured via html2canvas
 * or loaded from an <img>), plus per-glass uniforms for refraction, bevel,
 * tint, light, chromatic dispersion, frost, grain and specular.
 *
 * Output: per-pixel refracted, tinted, shaded glass.
 *
 * References:
 *  - liquidGL (MIT, NaughtyDuk) for the core refraction formula and
 *    texture-sample architecture.
 *  - kube.io for the Convex-Squircle surface profile and Snell's-law framing.
 *  - Apple Liquid Glass docs for the material brief (refraction, light
 *    reflection, per-pixel adaptive behavior).
 *
 * Extensions beyond the liquidGL reference:
 *  - user-controllable light angle drives the specular position + bevel
 *    highlight direction (liquidGL animates it randomly)
 *  - per-channel R/B chromatic dispersion at the refracted sample
 *  - SDF-derived edge normal for a directional rim lighting term
 *  - tint color+opacity applied after refraction
 */

/* -------------------------------------------------------------------------- */
/* Separable Gaussian blur shaders — run as two passes (H then V) on the     */
/* backdrop texture to produce a perfectly smooth frosted glass base. The     */
/* result is uploaded to an FBO and the main glass shader samples THAT        */
/* instead of doing noisy per-pixel random sampling.                         */
/* -------------------------------------------------------------------------- */

export const BLUR_VERTEX = /* glsl */ `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const BLUR_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_direction;  // (1/w, 0) for horizontal, (0, 1/h) for vertical
uniform float u_radius;    // blur radius in pixels

// 13-tap Gaussian weights for sigma ≈ radius/3.
// The taps are at offsets 0, ±1.38, ±3.23, ±5.08, ±6.94, ±8.79, ±10.64
// which gives near-perfect Gaussian quality with only 13 texture fetches
// per pass (26 total for both passes = way cleaner than 32 random taps).
void main() {
  // Scale the tap offsets by how much radius the user wants relative to
  // the kernel size (designed for radius ~12). Larger radius = taps spread
  // further apart, still 13 fetches, slightly less perfect Gaussian but
  // visually indistinguishable.
  float scale = u_radius / 12.0;
  vec4 sum = vec4(0.0);
  float offsets[7];
  offsets[0] = 0.0;
  offsets[1] = 1.384;
  offsets[2] = 3.230;
  offsets[3] = 5.077;
  offsets[4] = 6.923;
  offsets[5] = 8.769;
  offsets[6] = 10.615;
  float weights[7];
  weights[0] = 0.1964825501511404;
  weights[1] = 0.2969069646728344;
  weights[2] = 0.2195956084680698;
  weights[3] = 0.1216188685498976;
  weights[4] = 0.0504054591942991;
  weights[5] = 0.0155935688263418;
  weights[6] = 0.0035970140744694;
  // Center tap
  sum += texture2D(u_tex, v_uv) * weights[0];
  float totalWeight = weights[0];
  // Symmetric taps
  for (int i = 1; i < 7; i++) {
    vec2 off = u_direction * offsets[i] * scale;
    sum += texture2D(u_tex, v_uv + off) * weights[i];
    sum += texture2D(u_tex, v_uv - off) * weights[i];
    totalWeight += 2.0 * weights[i];
  }
  // Normalize so colors are preserved exactly (not amplified).
  gl_FragColor = sum / totalWeight;
}
`;

/* -------------------------------------------------------------------------- */
/* Main glass shader                                                          */
/* -------------------------------------------------------------------------- */

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_tex;              // BODY sample — pre-blurred when
                                      // frost > 0, sharp original when
                                      // frost = 0. Read at the natural
                                      // (un-displaced) UV.
uniform sampler2D u_lightTex;         // RIM sample — always softly blurred
                                      // (fixed ~6px). Read at the
                                      // refracted UV. Decoupled from
                                      // frost so the rim's frosty
                                      // character is always present.
uniform vec2      u_resolution;       // glass element px size
uniform vec2      u_textureResolution; // backdrop texture px size
uniform vec4      u_bounds;           // where this glass sits in the texture UV (x, y, w, h)

// Glass properties
uniform float u_radius;               // corner radius in px
uniform float u_refraction;           // 0..1 gentle ambient refraction
uniform float u_bevelDepth;           // 0..1 sharp edge refraction
uniform float u_bevelWidth;           // 0..1 bevel zone as fraction of min dimension
uniform float u_bendZone;             // 0..1 refraction zone as fraction of min dimension
uniform float u_frost;                // 0..1 blur intensity

// Light
uniform float u_lightAngle;           // radians, compass style (0 = top, CW)
uniform float u_lightIntensity;       // 0..1
uniform float u_specularSize;         // 0..1
uniform float u_specularOpacity;      // 0..1
uniform float u_bevelHighlight;       // 0..1 brightness of directional rim

// Style
uniform vec4  u_tint;                 // rgba
uniform float u_chromatic;            // 0..1 chromatic dispersion
uniform float u_grain;                // 0..1 grain intensity
uniform float u_time;                 // seconds

/* -------------------------------------------------------------------------- */
/* Signed distance field for the rounded rectangle                            */
/* -------------------------------------------------------------------------- */

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

/* edgeFactor: 1.0 at the very edge, smooth falloff to 0 inside.
   Uses the SDF so corners are handled correctly (curves with the radius). */
float edgeFactor(vec2 uv, float radius_px) {
  vec2 p_px = (uv - 0.5) * u_resolution;
  vec2 b_px = 0.5 * u_resolution;
  float d = -sdRoundBox(p_px, b_px, radius_px);
  float bevel_px = u_bevelWidth * min(u_resolution.x, u_resolution.y);
  return 1.0 - smoothstep(0.0, bevel_px, d);
}

/* Gradient of the SDF → edge normal pointing outward from nearest edge.
   Used for directional rim lighting computation. */
vec2 edgeNormal(vec2 uv, float radius_px) {
  vec2 p_px = (uv - 0.5) * u_resolution;
  vec2 b_px = 0.5 * u_resolution;
  float eps = 1.0;
  float dx = sdRoundBox(p_px + vec2(eps, 0.0), b_px, radius_px)
           - sdRoundBox(p_px - vec2(eps, 0.0), b_px, radius_px);
  float dy = sdRoundBox(p_px + vec2(0.0, eps), b_px, radius_px)
           - sdRoundBox(p_px - vec2(0.0, eps), b_px, radius_px);
  vec2 n = vec2(dx, dy);
  float l = length(n);
  return l > 0.0001 ? n / l : vec2(0.0, -1.0);
}

/* Pseudo-random for grain */
float hash12(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

void main() {
  /* ---- 0. Coordinate setup -------------------------------------------- */
  // p: centered, aspect-corrected -1..1 coordinates for the glass element
  vec2 p = v_uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  // mapped: this pixel's location in the backdrop texture (no refraction)
  vec2 flippedUV = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 mapped = u_bounds.xy + flippedUV * u_bounds.zw;

  /* ---- 1. Refraction offset (Convex Squircle bell profile) ------------ */
  // Physical model: a convex lens surface is TANGENT to the flat backing
  // at the boundary AND tangent to the flat interior top. Max refraction
  // happens where the surface gradient is steepest — in the MIDDLE of the
  // bevel zone.
  //
  // Our edgeFactor gives 1 at boundary and 0 at interior. We turn that
  // into a bell curve that is 0 at both ends and peaks at edge=0.5:
  //    bell = 4 * edge * (1 - edge)    → parabola, peak value 1.0
  // This guarantees continuity at the boundary (no content jump) AND
  // at the interior (no inner ring artifact).
  //
  // Two terms compose the amount:
  //    1. bell * refraction        — wide gentle bend across the bevel
  //    2. pow(bell, 3) * bevelDepth — sharper concentrated bend at the
  //       steepest part of the curve (middle of bevel)
  // Refraction uses its own ZONE (u_bendZone, fraction of the glass's
  // smaller dimension) that is INDEPENDENT of bevelWidth. bevelWidth only
  // controls the thin rim-lighting band. This decoupling is critical: the
  // user can have a razor-thin lit rim (bevelWidth=2) while still getting
  // visible "liquid bending" across a 30-50px zone.
  //
  // The bell profile ensures continuity: zero refraction at the boundary
  // (no content jump) and at the interior (center stays clear).
  float refractZonePx = u_bendZone * min(u_resolution.x, u_resolution.y);
  vec2 refract_p_px = (v_uv - 0.5) * u_resolution;
  vec2 refract_b_px = 0.5 * u_resolution;
  float d_in = -sdRoundBox(refract_p_px, refract_b_px, u_radius);
  float refractT = clamp(d_in / max(refractZonePx, 1.0), 0.0, 1.0);
  float refractBell = 4.0 * refractT * (1.0 - refractT);
  float offsetAmt = refractBell * u_refraction
                  + pow(refractBell, 3.0) * u_bevelDepth;

  // Direction: OUTWARD along the SDF gradient (edge normal). Apple-style
  // Liquid Glass models a CONVEX bulge — light from BEHIND the rim is
  // refracted toward the viewer, so each rim pixel shows EXTERIOR content
  // pulled inward through the curve. At the left rim eN points -x, so we
  // sample from -x (further left in the texture, where the actual exterior
  // sits). Without this, the rim just samples panel-interior content with
  // a small shift — the displacement is invisible because the source and
  // the body are the same blurred landscape, just offset by a few pixels.
  vec2 eN_refract = edgeNormal(v_uv, u_radius);
  vec2 refractDir = eN_refract;
  // Flip y from v_uv space to texture space.
  vec2 refractOffsetV = refractDir * offsetAmt;
  vec2 refractOffset = vec2(refractOffsetV.x, -refractOffsetV.y);
  vec2 sampleUV = mapped + refractOffset;

  /* ---- 2. Body sample + rim sample, mixed by distance from rim ------- */
  // Two distinct sources, blended on rim proximity so the rim has its
  // own consistent frosty look while the body follows the user's frost
  // setting:
  //   bodyRef — texture2D(u_tex,    mapped):    body content, no shift,
  //                                             body frost level.
  //   rimRef  — texture2D(u_lightTex, sampleUV): exterior content pulled
  //                                             through the rim by
  //                                             refractOffset, always
  //                                             softly blurred.
  // rimMix is 1 right at the rim, fades to 0 over the bend zone. So the
  // very rim shows the soft refracted exterior; past the bend zone we
  // reveal the body sample (which can be sharp, lightly frosted, or
  // heavily frosted). This is why Figma's no-frost panel still has a
  // soft refracted rim — its rim source is decoupled from frost too.
  float edge = edgeFactor(v_uv, u_radius);
  vec4 bodyRef = texture2D(u_tex, mapped);

  // Rim sample, with chromatic dispersion baked in. We sample R/G/B at
  // slightly different displacement multipliers (R bends LESS than blue
  // physically, so its offset is shorter; B's is longer). Where there's
  // no displacement (the body) all three sample the same point and the
  // fringe vanishes naturally — no need to gate on edge or bevelWidth.
  // This is why chromatic now shows across the full bend zone instead
  // of being trapped in the thin lit-rim band.
  vec4 rimRef;
  if (u_chromatic > 0.001) {
    float disp = u_chromatic; // 0..0.4, the per-channel offset spread
    vec2 sampleR_uv = mapped + refractOffset * (1.0 - disp);
    vec2 sampleB_uv = mapped + refractOffset * (1.0 + disp);
    vec4 g = texture2D(u_lightTex, sampleUV);
    rimRef = vec4(
      texture2D(u_lightTex, sampleR_uv).r,
      g.g,
      texture2D(u_lightTex, sampleB_uv).b,
      g.a
    );
  } else {
    rimRef = texture2D(u_lightTex, sampleUV);
  }

  float rimMix = 1.0 - smoothstep(0.0, refractZonePx, d_in);
  vec4 refrCol = mix(bodyRef, rimRef, rimMix);
  vec2 texel = 1.0 / u_textureResolution;

  /* ---- 3. Apply tint -------------------------------------------------- */
  // Standard "over" composite: refracted backdrop below, tint on top.
  vec3 col = mix(refrCol.rgb, u_tint.rgb, u_tint.a);

  /* ---- 4. Directional edge lighting: thin rim + wide bevel ------------ */
  // Two lighting terms, carefully tuned to BLEND into a single coherent
  // light (not create the double-frame artifact):
  //
  //   rim   — pow(edge, 9) — concentrated at the outer 2-3px edge. Thin
  //           bright hairline. Blends into the wash below.
  //   wash  — pow(edge, 1.7) — wide soft gradient extending ~40-50% inward
  //           from the lit edges. The cinematic "lit top face" effect.
  //
  // Both scaled by the same facing term so they appear as one light.
  // Key insight: the rim curve's falloff is steep enough (edge^9) that by
  // the time you're past 5px inward, it contributes nothing — so the wash
  // takes over smoothly. No visible boundary.
  // lightDir lives in v_uv space (+y = up = toward the top of the glass),
  // so it's consistent with edgeNormal (also v_uv space) and with spotPos
  // (also v_uv space) when used below.
  // Compass convention: 0° = top, 90° = right, 180° = bottom, 270° = left.
  //   0°  → (0, +1)  pointing up
  //   90° → (+1, 0)  pointing right
  //   180°→ (0, -1)  pointing down
  //   270°→ (-1, 0)  pointing left
  //   315°→ (-0.707, +0.707)  pointing up-left ← classic "top-left light"
  vec2 lightDir = vec2(sin(u_lightAngle), cos(u_lightAngle));
  vec2 eN = edgeNormal(v_uv, u_radius);
  // Two-sided edge lighting via smoothstep — gives a near-binary
  // lit/unlit pattern that matches how Figma and Apple Liquid Glass
  // actually behave. With pow() falloff the off-axis corners and back
  // edges still pick up faint highlights (pow(0.7,4)*0.7 = 0.18), which
  // reads as "lit ring all around". smoothstep with a hard floor takes
  // those zones to exactly zero.
  //
  //   facingFront — smoothstep(0.3, 1.0). Lit corner = 1.0, lit edges
  //                 ≈ 0.62, lighting fades inside ~22° of the off-axis
  //                 corner arc and cuts to 0 past that. Drives both
  //                 the wash and the rim.
  //   facingBack  — smoothstep(0.85, 1.0) × 0.7. Concentrated tightly
  //                 at the SINGLE corner diametrically opposite the
  //                 light source. Back edges stay completely dark.
  //                 Drives only the rim — no inward wash on the back.
  // Two smoothsteps, no ambient floor. The OFF-AXIS CORNERS must be dark
  // (corner curve passes through normals that face neither toward nor
  // away from the light), but the OFF-AXIS EDGES still need a faint
  // back-rim because their flat normals do face away from the light.
  //
  //   facingFront — smoothstep(0.3, 1.0). Lights the lit corner peak +
  //                 the two adjacent edges. Fades to zero ~22° into the
  //                 off-axis corner arc, so the corner stops at the
  //                 perfect moment instead of leaking into the off-axis.
  //   facingBack  — smoothstep(0.5, 1.0) × 0.85. Wider range than the
  //                 corner-only version: at the FLAT off-axis edge
  //                 (back-dot = 0.707) it gives ~0.32, so the right and
  //                 bottom edges read as dim-but-visible. But at the
  //                 OFF-AXIS CORNER ARC the back-dot drops below 0.5
  //                 within ~25° of the corner mid, so the corner zone
  //                 stays dark. Back-corner peak (back-dot = 1.0)
  //                 lights at full 0.85 → matches lit-corner brightness.
  //
  // Brightness map for light at 315°:
  //   Top-left corner       1.00  (front peak)
  //   Top / left edge       0.62  (front)
  //   Top-right corner      0.00  (off-axis dark)
  //   Bottom-left corner    0.00  (off-axis dark)
  //   Right / bottom edge   0.32  (back, faint)
  //   Bottom-right corner   0.85  (back peak)
  float dotFront = dot(eN,  lightDir);
  float dotBack  = dot(eN, -lightDir);
  float facingFront = smoothstep(0.3, 1.0, dotFront);
  float facingBack  = smoothstep(0.5, 1.0, dotBack) * 0.85;
  float facing = facingFront + facingBack;

  // Both wash (broad inward gradient) and rim (thin hairline) use the
  // same facing curve. Wash naturally feels stronger on the front side
  // because facing is higher there; the back rim gets a real wash too
  // (matching Figma's bottom-right corner having a visible inward glow).
  float wash = pow(edge, 1.7) * facing * u_bevelHighlight * u_lightIntensity;
  float rim  = pow(edge, 9.0) * facing * u_bevelHighlight * u_lightIntensity * 0.9;
  col += vec3(wash + rim);

  // (Inner shadow has been moved out of the shader and into a CSS
  // box-shadow inset on the glass anchor — see InnerShadowConfig.)

  /* ---- 5. Specular — a wide, soft diffuse glow, NOT a hot dot --------- */
  // Positioned at the light-source corner. The key: use a very gradual
  // smoothstep (full size → zero) so it's a smudgy glow, not a visible spot.
  if (u_specularOpacity > 0.001) {
    vec2 spotPos = 0.5 + lightDir * 0.3;
    vec2 spotUV = v_uv - spotPos;
    spotUV.x *= u_resolution.x / u_resolution.y;
    float spotDist = length(spotUV);
    // Very wide falloff — spot reaches from specularSize down to 0 over the
    // FULL radius, so the gradient is extremely gradual. No hard disk.
    float spot = smoothstep(u_specularSize, 0.0, spotDist);
    // Square it to concentrate brightness at the center without a hard edge.
    spot = spot * spot;
    // Slow shimmer — very subtle liquid feel.
    float shimmer = 0.95 + 0.05 * sin(u_time * 0.6);
    col += vec3(spot * u_specularOpacity * shimmer);
  }

  /* ---- 6. Grain ------------------------------------------------------- */
  if (u_grain > 0.001) {
    // Fine grain, centered around 0 so it both darkens and lightens.
    float g = hash12(v_uv * u_resolution + u_time * 0.1) - 0.5;
    col += vec3(g * u_grain * 0.15);
  }

  /* ---- 7. Clip to the rounded rect ------------------------------------ */
  // Outside the shape: transparent. Inside: opaque.
  // 2-pixel feathered edge on the alpha — softens the sharp boundary
  // between the unblurred DOM backdrop outside the glass and the blurred
  // sample inside. A hard 1px edge reads as a visible seam when frost is
  // active; 2px of feather blends the transition without making the glass
  // feel mushy.
  vec2 p_px = (v_uv - 0.5) * u_resolution;
  vec2 b_px = 0.5 * u_resolution;
  float dmask = sdRoundBox(p_px, b_px, u_radius);
  float alpha = 1.0 - smoothstep(-1.5, 1.5, dmask);

  gl_FragColor = vec4(col * alpha, alpha);
}
`;
