# Glaze — Project state

A visual configurator for **Apple Liquid Glass / Figma-quality** glass effects.
You position a draggable, resizable glass panel over a chosen backdrop and tune
parameters until it looks the way you want, then export the result.

The bar for "good" is **Figma's glass material** and Apple's Liquid Glass — not
generic CSS glassmorphism. Anything that reads as a magnifier, a coloured ring,
a stroke, or a halo is wrong.

---

## Current state (2026-04-16)

### What works
- Live WebGL preview with refraction, frosted body, lit rim, opposite-corner
  back-glow, chromatic dispersion, drop + inner shadow.
- Single hand-tuned default config in `lib/presets.ts` (no preset gallery).
- Draggable + corner/edge-resizable glass panel.
- 7 backgrounds with optional auto-tint suggestion.
- Advanced overrides for every shader uniform (refraction, bevel depth, bevel
  width, **bend zone**, chromatic, rim intensity, specular, frost, saturation,
  brightness) plus advanced drop-shadow XYZ + spread + opacity.
- Plain-CSS export (collapsed by default; click the bottom bar to expand).

### What's pending
- **#25 — React (WebGL) component export.** Currently the only export is plain
  CSS, which loses everything WebGL does (refraction, chromatic, lit rim).
  Stub button exists in the bottom bar.
- **CSS export accuracy.** What we emit covers blur/tint/shadows but NOT
  refraction or chromatic. Either label honestly as "approximate" or improve it.
- **SwiftUI / AI Prompt / JSON export tabs** are stubbed buttons.
- **Mobile layout.** Controls panel is fixed 380px; won't fit on phones.
- **Auto-adapt to background** toggle is wired in UI; verify it actually moves
  the tint when you swap backgrounds (haven't tested end-to-end recently).

### What's NOT planned
- More backgrounds (7 is enough).
- More effect parameters (the model is dialed in).
- Preset gallery (deliberately removed).
- A "simple/advanced" mode toggle (collapsed Advanced section is enough).

---

## Default config (current source of truth)

Lives in `lib/presets.ts` as `defaultConfig`. Captures the user's hand-tuned
target as of 2026-04-16:

```
light            angle 315°, intensity 100
tint             #FFFFFF / 10%
grain            off
border radius    60px

inner shadow     #000 / 10%, X 0, Y 4, blur 24, spread −2

drop shadow      Y 16, blur 75, spread 4, opacity 24%

advanced
  refraction         100
  bevel depth        100
  bevel width        2
  bend zone          (auto = 0.07)
  chromatic          100
  rim intensity      44
  specular size      0
  specular opacity   0
  frost              40
  saturation         20%
  brightness         80%
```

`light.intensity = 100` is fixed because there's no Simple slider for it.

---

## File structure

```
app/
  page.tsx              Main UI: backdrop picker, glass panel (drag/resize),
                        Simple controls panel, collapsible export bar.
  layout.tsx            Preloads the 7 background JPEGs with crossOrigin.
  globals.css           Slider + scrollbar styling.

components/
  GlassCanvas.tsx       Bridges React → WebGL renderer. Captures the backdrop
                        (fast path: decode the bg image directly; fallback:
                        html2canvas of the DOM). useLayoutEffect for sync
                        texture upload on background change.
  AdvancedControls.tsx  The Advanced panel: collapsible sections + override
                        sliders with reset-to-derived buttons.

lib/
  shader.ts             GLSL — main glass fragment, vertex, plus the 13-tap
                        Gaussian blur shader used by the FBO pipeline.
  webgl-renderer.ts     WebGLGlassRenderer class: two FBOs (heavy body blur
                        + fixed light rim blur), multi-pass blur, per-lens
                        viewport draw.
  glass-engine.ts       Pure config → uniforms transform. ADVANCED_RANGES
                        maps user 0–100 → uniform scale. CSS-export helpers
                        (drop/inner shadow strings).
  types.ts              GlassConfig, GlassAdvanced, GlassShaderUniforms.
  presets.ts            Just defaultConfig now (presets removed).
  export-css.ts         Plain-CSS export string builder.

spec/                   Pre-WebGL planning docs. Mostly stale — keep for
                        history but don't trust them as current architecture.
```

---

## Where to look first
- **`docs/RENDERING.md`** — the WebGL pipeline as it actually works today,
  plus the failed approaches we deliberately reverted from. Read this before
  touching shader.ts or webgl-renderer.ts.
- `lib/shader.ts` — the rendering model lives in comments here too.

---

## Working with the user
The user is uncompromising about visual quality. They reference Apple's
material brief and Figma's glass effect as the bar, and will show side-by-side
comparisons when something doesn't match. They expect:
- Diagnose before changing code. When asked to investigate, say what's wrong
  and why before proposing a fix.
- Test before claiming done. They've explicitly called out passing untested
  changes as unacceptable. The browse skill has no WebGL — admit when you
  can't visually verify and ask them to test.
- No half-baked fixes. Don't bury problems behind workarounds; understand
  the root cause.
- They iterate fast and give precise visual feedback. Trust their eye.
