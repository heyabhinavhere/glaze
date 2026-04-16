# Glass rendering — current pipeline + the failed paths

The glass effect is rendered entirely in WebGL. The DOM panel is a transparent
anchor for positioning + content; the visible glass is a `<canvas>` overlay on
top of the preview area.

This doc describes:
1. The current pipeline (what each pass does, why)
2. The shader's lighting / chromatic / refraction model
3. The decisions that *almost* shipped but didn't, with the failure mode

If you change `lib/shader.ts` or `lib/webgl-renderer.ts`, read this first.

---

## 1. Pipeline (per backdrop change → per frame)

### On backdrop upload (`uploadBackdrop`)
1. The chosen background image is drawn to an offscreen canvas at `dpr`-scaled
   preview-area dimensions.
2. That canvas is uploaded as `this.texture` (the SHARP source).
3. Two dirty flags are set: `blurDirty`, `lightBlurDirty`.

### On render — blur pipeline (only when dirty)
Two separate Gaussian blur targets, both ping-pong H+V passes via `blurOnce`:

- **`blurTexB`** — heavy body blur. Radius driven by `frost * 40` px, but
  achieved via **multiple chained passes** of capped per-pass radius (12 px
  max). Total Gaussian sigma after N passes = sqrt(N) * sigma_per_pass, so
  4 passes of 20 px ≈ one 40 px pass — but each pass samples densely with no
  aliasing. Single big-radius passes undersample and print a regular dot
  moiré pattern at high frost.
- **`lightTexB`** — fixed 6 px blur. Always present, independent of frost.
  This is the rim sample source. Only re-blurred when texture changes.

### On render — main draw
For each glass lens:
1. Set viewport to the lens rect on the canvas (`dpr`-scaled).
2. Bind `u_tex` = body texture (heavy-blur if frost > 0, else sharp original).
3. Bind `u_lightTex` = the always-on 6 px light blur.
4. Push uniforms (`u_radius`, `u_refraction`, `u_bevelDepth`, `u_bevelWidth`,
   `u_bendZone`, `u_frost`, `u_lightAngle`, `u_lightIntensity`,
   `u_specularSize/Opacity`, `u_bevelHighlight`, `u_tint`, `u_chromatic`,
   `u_grain`, `u_time`).
5. Draw the full-screen quad. The fragment shader does refraction, sampling,
   tint, lighting, specular, grain, and rounded-rect alpha mask.

### Inner shadow is NOT in the shader
It's a CSS `box-shadow: inset` on the DOM glass anchor. The shader-based
inner shadow we previously had created a rectangular ring that didn't follow
the corner radius. CSS inset follows the rounded shape natively.

---

## 2. The shader model (`lib/shader.ts`)

### Refraction (the bend at the rim)
- A **bell** profile: `bell = 4 * t * (1 - t)` where `t = clamp(d_in / bendZonePx, 0, 1)` and `d_in` is the inward distance from the rim.
- Bell is 0 at the rim, peaks at the middle of the bend zone, returns to 0 at
  the inner edge of the zone — guarantees continuity at both ends, no jumps.
- Two displacement terms add: `bell * refraction + bell^3 * bevelDepth`. The
  cube term concentrates extra bend at the steepest part of the curve.
- **Direction** = `+edgeNormal` (outward from rim). Models a CONVEX bulge:
  pixels near the rim sample EXTERIOR content pulled inward through the curve.
  Earlier we used `-edgeNormal` (inward) which sampled panel-interior content
  with a small shift — looked like a tiny ripple instead of refraction.
- **Bend zone** is independent of bevel width. Bend zone (default 7% of min
  dim) sets how wide the warped band is; bevel width (default ~1%) sets the
  thin lit-rim band only. Decoupled because a thin lit rim with a chunky
  warp is the desired Apple look.

### Two-source sampling: rim + body, blended on rim distance
```glsl
vec4 bodyRef = texture2D(u_tex,      mapped);     // un-displaced body
vec4 rimRef  = texture2D(u_lightTex, sampleUV);   // displaced light-blur
float rimMix = 1.0 - smoothstep(0.0, refractZonePx, d_in);
vec4 refrCol = mix(bodyRef, rimRef, rimMix);
```
- At the rim (`d_in = 0`): pure rim sample (lightly blurred + displaced).
- At the inner edge of the bend zone: pure body sample.
- Smooth fade between.

This decoupling is the key to making frost slider feel right at every value:
- frost = 0: body is sharp, rim still has soft refracted blur (matches Figma's
  no-frost panel).
- frost = max: body is heavily blurred, rim still has the same 6 px soft blur
  (matches Figma's heavy-frost panel where the rim shows recognizable detail).

### Chromatic dispersion
R / G / B sampled at slightly different displacement multipliers:
```glsl
sampleR = mapped + refractOffset * (1 - chromatic);
sampleB = mapped + refractOffset * (1 + chromatic);
```
- Naturally gated by `refractOffset`: in the body where offset = 0, all three
  channels sample the same point and there's no fringe. At the rim where
  offset is large, R and B diverge → visible RGB fringe.
- **Independent of bevel width.** Earlier model gated chromatic by `edge`
  (which falls off over `bevelWidth`), so with bevelWidth=2 the chromatic
  was trapped in a 5 px band even though bending happened across 30+ px.
- Reads from `u_lightTex`, same source as `rimRef`, so the fringe sits on
  the same material as the rest of the displaced rim — no sharp colored
  edges erupting from a soft frosted panel.

### Edge lighting (the bevel highlight)
Two-sided, smoothstep-based, no ambient floor:
```glsl
float facingFront = smoothstep(0.3, 1.0, dot(eN,  lightDir));
float facingBack  = smoothstep(0.5, 1.0, dot(eN, -lightDir)) * 0.85;
float facing = facingFront + facingBack;
```
- `facingFront` lights the lit corner peak + adjacent two edges. Smoothstep
  fades to zero ~22° into the off-axis corner arc so the lit band stops at
  the corner start.
- `facingBack` is **wider** (0.5 floor) than the corner-only version so
  off-axis EDGES still get a faint back rim — but the off-axis CORNER ARCS
  drop below 0.5 quickly and stay dark. This is the "stops at the perfect
  moment" pattern from Figma.
- `facing` then drives both `wash = pow(edge, 1.7) * facing * ...` (broad
  inward gradient) and `rim = pow(edge, 9) * facing * ...` (thin hairline).

Brightness map at light = 315°:

| Position                              | facing |
| ------------------------------------- | ------ |
| Lit corner (top-left)                 | 1.00   |
| Lit edges (top, left)                 | 0.62   |
| Off-axis edges (right, bottom)        | 0.32   |
| Diagonal opposite corner (bot-right)  | 0.85   |
| Off-axis corners (top-right, bot-lt)  | 0.00   |

### Specular
Soft diffuse spot near the light-source corner. Tuned tiny (size 0, opacity 0
in the default config) — Apple's Liquid Glass doesn't have a hot dot.

### Grain
Per-pixel hash, modulates color by `±intensity * 0.15`. Off by default.

### Alpha (rounded-rect clip)
```glsl
float dmask = sdRoundBox(p_px, b_px, u_radius);
float alpha = 1.0 - smoothstep(-1.5, 1.5, dmask);
```
2 px feathered edge to soften the hard boundary between the unblurred DOM
backdrop (outside the panel) and the displaced rim (inside).

---

## 3. Decisions that almost shipped but didn't

These are the wrong paths. Documented so we don't redo them.

### Sampling SHARP at the rim with displacement
- **What it was:** rim used `texture2D(u_tex, sampleUV)` where `u_tex` = sharp
  original. We thought blur would hide the bending.
- **Why it failed:** at the rim, you saw a **magnifying lens on a blurred
  photo** — sharp building lines curving violently while the body was a soft
  blur. Two materials, not one frosted glass.
- **Correct insight:** blurred content has soft gradient boundaries, and
  displacing a soft gradient produces a visible soft warp (Figma's effect).
  Sharp displaced content is wrong physics — real frosted glass scatters at
  the surface, then refracts the scattered light through the curve.

### Hybrid mix (sharp + blurred), blend zone past the bend zone
- **What it was:** `mix(sharpRef, blurredRef, smoothstep(refractZonePx, 2*refractZonePx, d_in))`.
- **Why it failed:** between 1× and 2× refractZonePx, sharp content was shown
  WITHOUT displacement (bell already at 0) and gradually faded to blur. That
  printed a ghost ring of un-displaced sharp content just inside the bend.

### Single-source sampling on `u_blurTex` only
- **What it was:** dropped `u_tex` entirely, sampled only the heavy body blur
  with displacement.
- **Why it failed:** at frost = 0 there's no blur to sample, so the rim showed
  the sharp-magnifier artifact. At frost = max, the rim displacement was
  invisible because the heavy blur smeared everything to uniform color.
- **Fix:** add a SECOND, fixed-radius (~6 px) light blur FBO. Sample THAT for
  the rim, body samples its own (variable-frost) blur. Decouples rim from
  body so both look right at any frost value.

### Single-pass big-radius blur
- **What it was:** one Gaussian pass with radius up to 40 px.
- **Why it failed:** 13 taps spread across a 70 px range = ~5–6 px tap
  spacing. That aliases on JPEG block artifacts and on tree-foliage spatial
  frequency, producing a regular ~6 px dot moiré at high frost.
- **Fix:** chain N passes at small radius. `passes = ceil(totalRadius / 12)`,
  `perPassRadius = totalRadius / sqrt(passes)`. Each pass samples densely;
  total sigma matches.

### Inward refraction direction (`-edgeNormal`)
- **What it was:** `refractDir = -eN`. Pulls content TOWARD the panel center.
- **Why it failed:** at the rim, you sampled panel-interior content shifted
  by ~20 px. Since interior is mostly the same blurred background, the
  displacement was invisible — looked like a tiny shimmer.
- **Fix:** `refractDir = +eN`. Pulls EXTERIOR content (outside the panel)
  inward through the rim curve. Now you see e.g. wood frames stretched into
  the panel along the rim.

### Bell zone driven by `bevelWidth`
- **What it was:** bend zone width = `bevelWidth * minDim`.
- **Why it failed:** users want a thin lit rim (bevelWidth = 2 → 1% = ~5 px)
  but a wide visible warp. Coupling them forced a tradeoff.
- **Fix:** separate `u_bendZone` uniform (default 7% of min dim, exposed as
  the "Bend zone" Advanced slider). Lit-rim width and warp width independent.

### Power-falloff lighting (`pow(dot, 0.7)` everywhere)
- **What it was:** `facingFront = pow(max(0,dot), 0.7)`,
  `facingBack = pow(max(0,dot), 0.7) * 0.6`.
- **Why it failed:** smooth pow falloff lit the off-axis corners and back
  edges to ~0.18, which read as "lit ring all around the panel". The user
  wanted off-axis dark.
- **Fix:** smoothstep with a hard floor (0.3 / 0.5) → off-axis goes to zero,
  but flat off-axis edges (back-dot = 0.707) still sit above the back floor.

### Ambient floor under the lighting
- **What it was:** `facing = 0.35 + 0.65*front + 0.40*back`.
- **Why it failed:** the constant 0.35 lit the entire rim including off-axis
  corners → read as a continuous stroke around the box, not directional
  Apple-style highlights.
- **Fix:** no ambient. The two smoothsteps already give "bright lit zones,
  visible back edges, dark off-axis" — adding a floor breaks that.

### Smoothstep too tight on back (`smoothstep(0.85, 1.0)`)
- **What it was:** back lighting only at the diagonal opposite corner peak.
- **Why it failed:** off-axis EDGES (back-dot = 0.707) went to zero too. The
  user wanted them visible-but-dim, so the panel didn't look half-dead.
- **Fix:** widen to `smoothstep(0.5, 1.0)`. Flat edges sit above the floor;
  corner ARCS where back-dot drops below 0.5 still go dark.

---

## 4. Important constants you might want to tune

- `LIGHT_BLUR_RADIUS_PX = 6` (`webgl-renderer.ts`) — fixed rim blur. Smaller
  = sharper rim (more "magnifier" feel). Larger = softer (more frosted).
- `PER_PASS_MAX = 12` (`webgl-renderer.ts blurBackdrop`) — max per-pass
  radius before chaining. Below this you get aliasing; above is overhead.
- Bend zone default `0.07` (`glass-engine.ts computeDerivedUniforms`) — 7%
  of the panel's smaller dimension. Override: 0.02–0.20.
- Smoothstep thresholds in shader lighting: front `(0.3, 1.0)`, back
  `(0.5, 1.0) × 0.85`. Tighter back range concentrates back glow at the
  corner; widen for more back-edge visibility.
- Alpha feather `(-1.5, 1.5)` in the rounded-rect clip. 2 px total.
- Wash falloff `pow(edge, 1.7)`, rim falloff `pow(edge, 9.0)` — broad inward
  vs thin hairline contributions.
