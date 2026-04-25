# Spike: rim-engine architecture for Glazelab

**Status**: resolved — implementation path decided and validated.
**Branch**: `spike/rim-engine` (merged into main as the Week-1 deliverable).
**Decision date**: 2026-04-19.

This doc records what we tried, what we learned, and what the upcoming
library (`@glazelab/*`) will ship. The iterative mess of the branch's
commit history compresses here into a single coherent decision record so
future contributors (and future us) don't rehash the same dead ends.

---

## Context

Before the pivot, Glaze was a configurator web app: tune a glass effect,
copy a CSS snippet. The snippet couldn't reproduce the effect because
CSS has no primitive for refraction or per-channel chromatic dispersion.
To honestly ship Apple-quality glass to users, we had to ship a library
that runs the rendering engine, not an "export CSS" button.

The spike's one question: **what's the right rim-rendering architecture
for the library?** "Rim" meaning the ~30 px band at a panel's edge
where refraction bends exterior content inward, chromatic splits the
channels, and directional lighting highlights the lit corner. That
character is the thing that reads as "Apple Liquid Glass" vs. "generic
glassmorphism."

Candidates entering the spike:

1. **WebGL rim only, CSS body** — hybrid. Body handled by native
   `backdrop-filter`, rim painted by a custom WebGL overlay.
2. **SVG filter rim, CSS body** — hybrid. Same body path, rim via an
   SVG `<filter>` chain (`feDisplacementMap` for refraction, per-channel
   `feColorMatrix` for chromatic, gradients for rim lighting).
3. **Full WebGL, no CSS body** — single pipeline: shader produces body
   and rim together. What the main playground already does today.

---

## What we tried (in order)

### Attempt 1 — SVG filter rim (ruled out)

Idea: apply a `filter: url(#glaze-rim)` CSS filter scoped to a ring
overlay element, with the filter chain `feDisplacementMap` for
refraction, separated RGB channels with per-channel displacement for
chromatic.

**Why it failed, non-obvious**: SVG's `filter` acts on the element's
own rendered pixels, not on the backdrop. To refract the backdrop, you
need `backdrop-filter: url(#filter-id)`. That CSS combination has **zero
browser support** in Chrome/Safari/Firefox/Edge — `backdrop-filter` only
accepts named function primitives (`blur()`, `saturate()`, etc.), not
URL-referenced custom filters. The `<feBackdrop>` primitive exists in
the spec but no browser implements it.

Without backdrop access, `feDisplacementMap` has nothing to refract.
The rim produces pretty gradient banding but no actual refraction —
defeats the purpose.

**Verdict**: not viable. Killed before we built it out.

### Attempt 2 — Custom WebGL rim + CSS body (hybrid)

Idea: body handled by `backdrop-filter: blur() saturate() brightness()`
(free, native, works over any DOM content). Rim handled by a small
WebGL overlay running a rim-only shader that samples a captured
backdrop texture.

Built a 400-line custom rim shader + renderer. Wired it up. The result
showed **a visible seam at the rim/body boundary**:

- CSS's `backdrop-filter: blur()` produces a specific blur kernel, saturation
  math, and brightness curve that are all browser-implementation-defined.
- WebGL's rim samples a captured-then-blurred backdrop through our own
  multi-pass Gaussian at a specific sigma.
- At the handoff boundary (where the rim's alpha fades out and the CSS
  body takes over), the two pipelines produced visibly different pixel
  values from the same underlying content. The eye catches this as
  "two different materials glued together."

I tried to fix it in two ways:

- **Match CSS in WebGL** — replicate the browser's blur + saturate +
  brightness math inside the shader so the rim's output matched CSS's
  output at the boundary. Every browser implements these slightly
  differently; getting pixel-perfect agreement is a 2-3 day project
  with no guarantee of success across the matrix.
- **Feather the seam** — overlap the rim with a gradient alpha fade
  into the body. Blurs the mismatch; doesn't fix it. Eye-dominant
  viewers still catch the tone difference.

**Verdict**: architecturally wrong. The hybrid's only upside was "body
works over any content for free because CSS does it natively." But the
rim already requires a captured backdrop texture — so we're already
paying the capture cost. Once you have the capture, running the body
through the same shader costs nothing extra and removes the seam by
construction.

### Attempt 3 — Full WebGL (SHIPS)

Dropped 400 lines of custom rim code. Rewrote the spike's `WebglRim`
component as a thin wrapper around the main playground's existing
`WebGLGlassRenderer` (`lib/webgl-renderer.ts`) with the dialed-in
`FRAGMENT_SHADER` (`lib/shader.ts`) — the same renderer that produces
the "really good" visuals in the playground today.

**Verdict**: ships. Zero seam possible — single pipeline. Reuses a
known-good asset. Visual quality matches the playground bar.

---

## What ships in the library

### Primary engine — full WebGL

- Everything painted by the playground's existing shader: refraction,
  chromatic dispersion, directional rim lighting, body frost, tint,
  saturation, brightness, specular, optional grain.
- Single texture upload per backdrop change (or per frame for live
  sources); `u_bounds` UV math places the panel correctly inside the
  captured backdrop.
- Backdrop sources: image (one-shot upload), canvas (per-frame upload),
  video (per-frame upload, extension of canvas path).

### Fallback engine — CSS only

- `backdrop-filter: blur() saturate() brightness()` for body.
- `background-color` with alpha for tint.
- Radial gradient overlay positioned by `lightAngle` for directional
  rim highlight; a second dimmer gradient at the opposite corner for
  back-scatter.
- Inset `box-shadow` for subtle bevel suggestion; outer `box-shadow`
  for elevation.

No refraction, no chromatic dispersion, no real bevel lensing — those
require WebGL. Reads as a clean glassmorphism panel; explicitly *not*
Apple Liquid Glass, and we'll document this as graceful degradation
rather than pretend otherwise.

### Engine-selection policy

Auto-detect WebGL availability at mount. WebGL path by default; CSS
fallback when WebGL is unavailable. A `rimEngine: "auto" | "webgl" |
"css"` prop lets users force either explicitly (performance-sensitive
pages, or WebGL-incapable environments we can't auto-detect, or
deliberate artistic choice).

---

## Engineering learnings we carry forward

These transfer directly into `@glazelab/core`'s design.

### 1. Absolute-pixel rim width, not fractional

First implementation used `bendZone: 0.07` (7 % of `min(width, height)`).
On a 1000 px panel that's a 70 px rim — chunky and unconvincing. Apple's
rim reads the same visual width regardless of panel size.

**Library design**: `bendZone` and `bevelWidth` are CSS pixel values.
A 30 px rim is a 30 px rim on a 100 px panel and on a 1000 px panel.
Shader takes these in device-px units (multiplied by DPR at upload).

### 2. Cover-fit backdrop capture canvas

The shader's `u_bounds` assumes the texture covers the target element's
viewport exactly. Uploading the raw image's native resolution
(e.g. 1920×1280) causes UV drift — samples land outside the intended
region and get clamp-sampled to edge garbage.

**Library design**: always draw the source (image, canvas, video) onto
an intermediate 2D canvas sized to the target's viewport rect in device
pixels, cover-fitted. That canvas is what's uploaded as the texture.

### 3. Callback-ref for the target element

On first render, a `useRef` hasn't populated yet; the glass component's
`useLayoutEffect` would initialise the renderer against the wrong parent
element (the immediate DOM parent, not the backdrop container). Callback
ref pattern (`ref={setViewport}` with state) triggers a re-render when
the element mounts, giving children a stable target.

**Library design**: `useGlaze(ref, config)` accepts a standard
`RefObject`, but internally handles the null-initial case by waiting
for the ref to populate before spinning up the renderer. The `<Glaze>`
wrapper doesn't have this problem because it owns the element it
renders.

### 4. Module-level decode-Promise dedup (already shipped via PR #1)

Multiple `new Image() + .decode()` calls for the same URL fight each
other; one decode takes ~100 ms, a second one can stall 10 s while the
first completes. Shared-promise dedup via a module-level
`Map<src, Promise<HTMLImageElement>>` kills the stall.

**Library design**: the shared decode cache lives in `@glazelab/core`
as a shared-across-instances singleton. Any consumer (preload,
per-panel upload) goes through the same cache.

### 5. Strict Mode double-mount hygiene

React's Strict Mode in dev double-invokes effects. The renderer class
needs to be idempotent on cleanup — dispose WebGL context, remove
canvas from DOM, release GL resources — and the component needs a
`if (rendererRef.current === renderer) rendererRef.current = null`
guard so late cleanups don't null a ref a newer mount has already
claimed.

**Library design**: `createGlass()` in `@glazelab/core` returns a
`{ update, destroy }` handle. Framework wrappers call `destroy()` in
their cleanup. The core tracks shared resources (shader program, SVG
filter defs for the fallback) via refcount, tearing down only when
the last panel unmounts.

---

## Open questions for v1.0 — not answered by this spike

The spike was scoped to the rim-engine question. The following are
real library-design problems that need dedicated work in Week 2 /
`@glazelab/core`:

### DOM-backdrop capture

The `backdrop="url"` path is solved — upload an image, done. The
"glass over arbitrary DOM content" path is genuinely hard:

- `html2canvas` works for simple static DOM but has well-documented
  failure modes: scroll position with `overflow: auto` elements,
  CSS custom-property-driven gradients (Tailwind `bg-gradient-*`),
  videos, iframes, canvases. The spike demonstrates one (scrolling
  article produces a degraded capture) — a blocking issue if we
  claim "works over any DOM content."
- Browser-native alternatives are emerging but not ready: CSS
  `element()` is Firefox-only, Houdini Paint API has limited
  browser support, `<feBackdrop>` has no browser support.
- Live sources (animated canvas, video) also need per-frame upload,
  which works cleanly when the source IS a canvas or video element,
  but not when it's arbitrary DOM.

**Plan**: Week 2 investigates this as its own workstream. Likely
library v1.0 ships with explicit modes:
- `backdrop={imageUrl}` — always works (primary path).
- `backdrop={canvasRef}` — works for canvas/WebGL scenes (Three.js, R3F).
- `backdrop={videoRef}` — works for video sources.
- `backdropFrom={domRef}` — opt-in html2canvas with documented caveats.
- No opinionated "auto-capture the page" behaviour in v1.0; too many
  ways it can fail silently.

### Multi-panel shared renderer

Each `WebGLGlassRenderer` instance creates its own WebGL context.
Browsers limit concurrent WebGL contexts (often 16). A dashboard
with 20 glass cards would exhaust the pool. The library needs ONE
renderer shared across all mounted glass elements, with each panel
as a `GlassLens` entry (the renderer already supports multi-lens
draw via `setLenses([])`; just need module-level sharing).

### SSR story for framework wrappers

The renderer is client-only (needs `window`, WebGL context). Next.js
+ Strict Mode hydration edge cases we hit in this repo's playground
(hydration warnings on `motion.div`, etc.) need clean solutions in
the public library. No top-level `window` access. All DOM work
behind `useLayoutEffect` / `onMount` / `createEffect`.

### Browser matrix + fallback cutover

We need to decide: which browser versions trigger the CSS fallback
automatically? Safari's `backdrop-filter` is fine; its WebGL is fine.
But Safari 15.4 and older has specific `backdrop-filter` quirks that
might justify fallback. Policy TBD after real cross-browser testing
in Week 5.

---

## The non-technical lesson

The spike took longer than planned not because the rim-engine question
was hard — it was decidable in an afternoon once the SVG option was
disqualified — but because I kept patching emergent bugs in the spike's
own test fixtures (animated-canvas content choice, html2canvas-over-
scroll-container capture) as if they were architectural problems. They
weren't. They were fixture-quality problems that the spike wasn't the
right place to solve.

**For Week 2 and beyond**: when a bug's root cause requires investigating
a dependency's behaviour in depth, lift it out of the current workstream
and investigate it deliberately. Don't patch it into submission inside
an unrelated spike. Name the limitation, park it, move forward.

---

## Artifacts on the branch

For reference when the spike branch is archived / deleted:

- `app/spike/page.tsx` — the side-by-side harness.
- `components/spike/WebglRim.tsx` — thin wrapper driving `WebGLGlassRenderer`.
- `components/spike/CssFallbackRim.tsx` — pure-CSS fallback.
- `components/spike/BackdropRenderer.tsx` — image / canvas / scroll
  test fixtures. (Canvas and scroll fixtures have known limitations
  documented above.)
- `lib/spike/rim-config.ts` — the trimmed public-facing config shape.
- `lib/spike/rim-config-adapter.ts` — `RimConfig` → `GlassUniforms`
  mapper.

None of these move into `@glazelab/core` as-is. They're tuning
fixtures. Week 2 rebuilds the public API cleanly from the playground's
`lib/*` modules, with the learnings above folded in.
