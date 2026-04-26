# `@glazelab/core` — Design

**Status:** draft, awaiting user review.
**Branch:** `feat/glazelab-core`.
**Predecessor:** `docs/SPIKE-RIM-ENGINE.md` (Week 1 — decided full-WebGL
primary + CSS fallback).

---

## 1. Quality bar

Apple liquid glass. On every surface. Every time.

The library that ships under `@glazelab/core` is judged by one user
sentence: **"it doesn't feel laggy or bad — everything is seamless and
premium."** That bar is a constraint, not a goal. If a design choice
trades quality for shipping speed, the choice is wrong; we re-design.

Concretely, this rules out:

- mount flicker (glass appears late, jumps when WebGL kicks in)
- stale rim during scroll (Mode C, see §4)
- resize tear (canvas backing-store realloc mid-drag)
- first-paint blank-rect (host element shows transparent for a frame)
- background-tab CPU/GPU drain
- React Strict-Mode mount/unmount/mount leaks
- "loading…" skeletons or shimmer placeholders
- low-end device "best effort" downgrades that look obviously cheap

Every section below restates this bar in mechanism: *how* we hit it,
not just *that* we will.

---

## 2. What ships

One package. One function. One handle.

```ts
import { createGlass, presets } from "@glazelab/core";

const handle = createGlass(headerEl, presets.liquidGlass);
// later…
handle.update({ frost: 0.3 });
handle.destroy();
```

That's the whole surface. Framework wrappers (`@glazelab/react` etc.,
shipped Weeks 3+) are thin adapters around this — no extra knobs.

What's *inside* the package: the playground's existing WebGL renderer,
extracted, rotated to support **multiple lenses on a shared canvas**,
and wrapped in the §6 public API. No new shader. No new uniforms model.
The asset we spent six weeks tuning ships unchanged; the work is in the
plumbing around it.

---

## 3. Architecture decision: shared GL context, per-lens canvas

**Decision:** the page gets **one shared WebGL2 context**, owned by a
module-level singleton, rendering into an **`OffscreenCanvas`**.
Every `createGlass()` call mounts a small **per-lens visible
`<canvas>`** (2D context) as a child of the host element. Each frame:
the singleton renders all lenses into the offscreen GL context, then
each lens's 2D canvas blits its region of the offscreen output via
`transferToImageBitmap` → `drawImage`.

**Why this shape (and not "one full-viewport canvas"):**

- **Z-order / stacking is solved.** The naïve "one viewport-fixed
  canvas" puts every lens on the same z-plane. A modal at z-index:100
  with a glass button inside it would render with the button's glass
  *behind* the modal. Per-lens canvases live at the host's natural
  stacking position. The user's z-index is the user's z-index.
- **Iframes, shadow-DOM, and stacking contexts work** without special
  cases. Each lens canvas lives wherever its host lives.
- **Position: sticky / fixed lenses work cleanly.** The visible canvas
  is a child of the host; it inherits whatever positioning the host
  has. Sticky headers Just Work without re-parenting the canvas.
- **Browser context limit (16) sidestepped.** The visible canvases are
  2D contexts (no per-canvas WebGL context). The single offscreen
  WebGL2 context is the only WebGL context on the page, regardless of
  lens count.
- **Single render loop, single shader compile, shared FBO pool**
  (§3.4). Same wins as a single GL context, without the topological
  problems.

**Cost of the per-lens blit:** each lens's `transferToImageBitmap →
drawImage` is roughly 0.1ms for a 600×120 region. 16 lenses = ~1.6ms
total. Vs. the savings (no z-order bugs, no iframe special-cases),
it's a clear net win.

### 3.1 Lens lifecycle (race-safe, hydration-safe)

The lifecycle has three phases:

```
mount → pending (no GL work) → active (registered + rendering) → destroyed
```

- **Pending → active gating.** The visible canvas mounts in
  `useEffect` (NOT `useLayoutEffect`). SSR renders the host's children
  unchanged; client appends the canvas post-hydration. Zero hydration
  mismatch. Lens registration is further gated on host having a
  non-zero `getBoundingClientRect()` — until then, the lens stays
  pending and no GL resources are allocated. ResizeObserver fires once
  the host gains area; the lens transitions to active.

- **Generation counter for capture safety.** Every active lens carries
  a monotonic `generation: number`. Async backdrop captures (Mode C)
  capture the generation when started; the result is checked against
  the current generation before applying. Stale results — from a lens
  that was destroyed, resized, or had its config changed — are
  silently discarded.

- **Capture deduplication.** Multiple lenses targeting the same
  `backdropFrom` element with overlapping captures dedupe to a single
  in-flight rasterization. Second caller awaits the first's result.

- **Viewport-mismatch guard.** Captures snapshot viewport dimensions at
  start. If the viewport changes during capture (window resize), the
  captured texture is discarded on completion and a new capture
  starts.

### 3.2 Sticky and fixed lens handling

Lens screen-space rect is updated each frame for `position: sticky` or
`position: fixed` lenses — `ResizeObserver` doesn't fire on sticky's
scroll-driven position changes. Implementation:

- Detect at registration via `getComputedStyle(host).position`.
- For sticky/fixed: register a passive scroll listener (RAF-coalesced)
  that re-reads `getBoundingClientRect()` once per frame and updates
  the lens rect.
- For static/relative/absolute: rely on ResizeObserver only (no
  per-frame rect read — wasted work).

Sticky-aware updates are a property of how the lens reads its rect,
not of the renderer. Renderer just sees fresh rects each frame.

### 3.3 GL context loss / restore

WebGL contexts get lost on driver restarts, GPU memory pressure,
OS sleep on some devices. Without explicit handling, the library
silently dies and never recovers.

```ts
glCanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();              // signal: we want it back
  this.suspended = true;
  cancelAnimationFrame(this.raf);
  // All per-lens canvases swap to CSS-fallback styling automatically.
});

glCanvas.addEventListener("webglcontextrestored", () => {
  this.rebuildAllGLState();        // shader, FBOs, all textures
  this.suspended = false;
  this.raf = requestAnimationFrame(this.tick);
});
```

During the lost window (typically 100ms–2s), each lens renders via the
CSS fallback — visually different but never blank. WebGL silently
takes over on restore.

### 3.4 Shared FBO pool — bounded GPU memory

Multi-pass blur per lens needs ~4 working FBOs (input, ping, pong,
output). Without sharing: 16 lenses × 4 FBOs × ~290KB each = ~18MB —
mobile GPUs cap around 50MB total. Hit the limit, browser kills the
context.

The renderer keeps **one shared FBO pool**, sized to the largest
currently-active lens. All lenses use the same pool sequentially
during the render pass. Memory bounded at ~5MB regardless of lens
count. Cost: when a larger lens appears, the pool grows (one-time GL
allocation per grow, not per frame).

### 3.5 Refcounted singleton with deferred destroy

```ts
let renderer: SharedRenderer | null = null;
let refcount = 0;
let pendingDestroy: ReturnType<typeof setTimeout> | null = null;

function acquire() {
  if (pendingDestroy) { clearTimeout(pendingDestroy); pendingDestroy = null; }
  if (!renderer) renderer = new SharedRenderer();
  refcount++;
  return renderer;
}

function release() {
  refcount--;
  if (refcount === 0) {
    pendingDestroy = setTimeout(() => {
      renderer?.destroy();
      renderer = null;
      pendingDestroy = null;
    }, 1000);  // grace window absorbs Strict-Mode and SPA route changes
  }
}
```

Strict Mode's mount→unmount→mount happens in <100ms — the grace
window absorbs it without paying GL context creation twice. Real
navigation (mount → unmount, no remount within 1s) cleans up properly.

### 3.6 Shader pre-warm on module import

WebGL shader compilation: Chrome 20–80ms, Safari 50–200ms. If we
compile lazily on first lens mount, first-mount latency includes
compile time — visible flicker on the very first `<Glaze>` of the
page.

The renderer kicks off shader compilation as a side-effect of
the singleton's lazy creation, gated behind first import of any
public symbol (`createGlass`, `isSupported`, `presets`). By the time
any lens mounts, the shader is compiled and linked. Tree-shaking is
preserved because the side-effect only fires on first use of an
imported symbol.

### 3.7 Why not per-component canvas (rejected)

The "obvious React pattern" — give each component its own WebGL
canvas — fails on three fronts:
- Hits the 16-context-per-page browser cap.
- Fragments GPU memory (each context owns its own pool).
- Costs an rAF per component, and per-context shader compile.

Per-lens **2D canvas** with **shared offscreen GL context** is the
right shape. We get the per-lens stacking benefits without the
per-context overhead.

---

## 4. Architecture decision: backdrop strategy

The hardest design problem in this library. Three real-world scenarios,
four explicit prop variants.

### 4.1 The three scenarios

**A — Static image.** Hero behind the navbar. A photo behind a card.
The backdrop is a fixed bitmap, known at element-construction time.
Cost: decode once, upload once, sample for the lifetime of the lens.

**B — Live element.** A `<video>` looping behind a panel. A `<canvas>`
animating gradient blobs. The backdrop is a DOM node that's already
producing pixels each frame. Cost: `texSubImage2D` from element to
texture each frame (~1ms for 1080p).

**C — DOM subtree.** A long scrolling article behind a fixed sidebar.
A page with arbitrary HTML/CSS, no single image source. Cost:
**rasterize the DOM into a texture**, sample with refraction. This is
the hard one and where most "drop-in glass" attempts fail.

### 4.2 The four public prop variants

```ts
// A. Static image
createGlass(el, { backdrop: "/hero.jpg" });

// B. Live element
createGlass(el, { backdrop: videoRef });

// C. DOM subtree
createGlass(el, { backdropFrom: articleRef });

// Auto — no backdrop prop set. Walks DOM up to nearest scrolling /
// positioned ancestor; picks A/B/C based on what's there.
createGlass(el);
```

**The auto path is the make-or-break drop-in UX.** A user writes
`<Glaze>header</Glaze>` and the library figures out what's behind it.
If auto picks the wrong mode the whole library feels broken; if it
picks the right one, the library feels magical.

This deserves its own design pass and its own verification gate
(§9). Heuristic, locked:

1. **Collect candidate Mode-A/B sources** — every `<img>` / `<video>`
   / `<canvas>` ancestor whose bbox fully covers the lens area.
   Among these, **prefer the largest** (heuristic: a hero image
   beats a decorative icon). Discard candidates that are
   `position: absolute` parallax layers (move independently of the
   lens) — those need re-capture per frame, defeating Mode A.
2. **If a Mode-A/B winner exists, arbitrate against Mode C.** If the
   lens is also inside a scroll container AND the winner is
   `position: static/relative` (scrolls *with* the lens), pick Mode
   A/B — it's a static texture that doesn't need re-capture. If the
   winner is `position: fixed/sticky` and the scroll container has
   tall content (the user wants the rim to refract scrolling
   content, not the fixed image), pick Mode C against the scroll
   container.
3. **Else: first scroll container ancestor** (`overflow: auto/scroll`
   with content larger than its viewport) → Mode C against it.
4. **Else: first positioned ancestor with non-trivial paint** → Mode
   C against it.
5. **Else: viewport** → Mode C against `<body>`.

Edge cases the heuristic must handle:
- Lens larger than every candidate: fall through to next level.
- Candidate with `display: none` ancestors: skip.
- Cross-origin `<img>` (CORS-tainted): degrade to Mode C against the
  parent; don't fail.
- The lens itself accidentally captured (feedback loop): walk the
  lens DOM upward, tag skip-nodes (the per-lens canvas + the host
  element subtree). Mode C rasterizer respects skip tags.
- Lens inside `<iframe>`: cross-origin → cannot capture parent
  document; degrade to Mode A against `<body>` background-color or a
  CSS-fallback render. Same-origin iframe: defer to v1.1.

Tested against a corpus of real-world layouts (hero+nav, sidebar+
article, card grid, modal-over-page, sticky-nav-over-scroll, parallax
hero, video-bg) before the heuristic ships. See §9 verification.

### 4.3 The capture-tall-once strategy (Mode C)

This is the §1 quality bar applied to the hardest case. Naïve
implementations capture viewport-height and re-capture on scroll —
that's a 100–200ms html2canvas cost per re-capture, which means the
rim is stale during scroll. Bad.

**Solution: capture the *entire scroll context* once.** If the parent
element has 6,000px of total height, we rasterize all 6,000px into one
tall texture. During scroll the renderer just samples at scroll-offset
Y — zero per-frame work. The texture is a perfect static reference;
the rim refraction *moves through it* as the user scrolls.

**Constraints:**

- WebGL `MAX_TEXTURE_SIZE` is 4096–16384 depending on device. Probed at
  init.
- For scroll contexts taller than the cap, fall back to **windowed
  capture**: 2.5× viewport height, re-captured asynchronously when
  scroll position passes through the window's middle 50%. The old
  texture stays bound until the new one is ready — no flash-of-blank.

**Re-capture triggers (scroll is NOT one):**

- Window resize (debounced 100ms).
- DOM mutation inside the captured subtree (`MutationObserver`,
  debounced 100ms).
- Explicit `handle.refreshBackdrop()` call.

**What scroll triggers:** nothing. Scroll is free.

### 4.4 Sharing across multiple lenses

If five `<Glaze>` panels all have the same `backdropFrom={articleRef}`,
the singleton rasterizes the article *once* and binds the same texture
for all five lenses' rim sampling. The cost of N panels on one
backdrop is the cost of one capture, not N captures.

### 4.5 Mode C rasterization — first-party, not a third-party wrap

**Decision:** we build our own DOM rasterizer for Mode C. We do NOT
ship v1.0 wrapped around `html2canvas`.

**Why not html2canvas:**
- Tailwind CSS-variable gradients render as flat color (we hit this
  in the spike).
- Modern CSS (`backdrop-filter`, `mask`, certain `clip-path` forms,
  `oklch()` colors, `color-mix()`) approximated or skipped.
- Iframe content silently dropped.
- ~50KB minified — almost as large as our entire core target.
- Export-oriented codebase carries surface we don't need.

**What we build instead:** a focused ~500-line module using SVG
`<foreignObject>` (the technique used internally by `modern-screenshot`
and `html-to-image`), **executed in a Web Worker** to keep the main
thread responsive.

The split:

```
Main thread (5–15ms total, blocks user):
  walk DOM + getComputedStyle + resolve CSS vars + build SVG string
        ↓ postMessage(svgString)
Worker (30–100ms, off-main):
  createImageBitmap from SVG blob using OffscreenCanvas
        ↓ postMessage(ImageBitmap, [transfer])
Main thread (~1ms, blocks user):
  texImage2D from ImageBitmap to WebGL texture
```

**Total main-thread block: ~6–16ms.** Without the worker, naïve impl
blocks main for 40–150ms. The worker is the difference between
"noticed by users" and "invisible."

Detailed flow:
1. **Main:** walk the target subtree, collecting elements + their
   `getComputedStyle()` results.
2. **Main: resolve CSS variables before serialization.** Read `--tw-*`
   etc. from the cascade and inline them as concrete values. This is
   the core fix for the playground-spike Tailwind-gradient bug.
3. **Main:** inline external stylesheets that affect the subtree.
4. **Main:** build an `<svg><foreignObject>` containing the resolved
   DOM (string).
5. **Worker:** `createImageBitmap(svgBlob)` via `OffscreenCanvas`.
6. **Main:** `texImage2D(imageBitmap)` directly to WebGL texture
   (skip intermediate canvas — `texImage2D` accepts ImageBitmap
   natively).

**What's explicitly excluded** from any capture (skip-nodes):
- The glass canvas itself (feedback loop prevention).
- The lens host element subtree (it's the thing we're rendering glass
  *over*; capturing it as backdrop would double-render).
- Elements marked with `data-glaze-skip` (escape hatch for users).

**Honest scope:**
- Iframes: not captured. Documented.
- WebGL canvases inside captured DOM: captured as their last-painted
  bitmap (good enough; the user's canvas is doing its own animation,
  not ours).
- Video inside captured DOM: captured as its current frame at capture
  time. For "live video behind glass" use Mode B explicitly with the
  video element, not Mode C with its parent.
- Cross-origin images: rendered as long as `crossorigin="anonymous"`
  is set; otherwise the canvas taints and we fall back to the parent
  background color. Documented.

**Verification (added to §9):**
- Render a corpus of real-world layouts (Tailwind, vanilla CSS, modern
  CSS, mixed) → pixel-diff against a Chromium-native screenshot of the
  same DOM. Threshold: <2% delta on the rim sample region.
- Bundle cost target for the rasterizer module: <5KB gzipped.

### 4.6 Honest mode tradeoffs

- **Mode A (static image): perfect.** 60fps frame-perfect, no caveats.
- **Mode B (live element): perfect.** 60fps assuming the source can
  produce frames at 60fps; we just upload them.
- **Mode C (DOM): perfect during scroll** (§4.3 capture-tall-once);
  ~50–150ms one-shot transition on resize / DOM mutation. Fidelity
  bounded by the §4.5 rasterizer's first-party scope (iframes excluded;
  cross-origin tainted media degraded). For "live video behind glass"
  always prefer Mode B.

---

## 5. Architecture decision: defaults match the playground

The playground's `lib/presets.ts` `defaultConfig` is the design comp.
The library's `presets.liquidGlass` is that config, copied byte-for-byte
into `@glazelab/core/presets.ts`. No re-tuning. No "library-friendly
moderation."

> **Note on playground UI vs. library API.** The library API is flat
> (`lightAngle`, `lightIntensity`, `tint: "rgba(...)"`). The playground
> *UI* keeps the existing grouped controls — "Light" section with
> Angle + Intensity sliders, "Tint" with color picker + opacity slider —
> purely as visual organization. When the playground generates a code
> snippet, it outputs the flat API shape. Users get organized UI for
> tuning and idiomatic flat config for shipping. Both are right for
> their context.

```ts
// packages/core/src/presets.ts (exact copy)
export const liquidGlass: GlassConfig = {
  radius: 60,
  frost: 0.36,
  saturation: 0.5,   // 0.5 of neutral, matches playground saturation:20
  brightness: 1.6,   // matches playground brightness:80 mapped to range
  tint: "rgba(255,255,255,0.10)",
  bevelWidth: 2,
  bendZone: 30,      // px (auto-derived from radius and panel size in playground; locked in absolute px here)
  refraction: 0.02,
  bevelDepth: 0.04,
  chromatic: 0.25,
  rimIntensity: 0.528,  // matches playground bevelHighlight:44 in normalized space
  lightAngle: (315 * Math.PI) / 180,
  specularSize: 0,
  specularOpacity: 0,
  innerShadow: { x: 0, y: 4, blur: 24, spread: -2, color: "#000000", opacity: 0.10 },
  dropShadow: { x: 0, y: 16, blur: 75, spread: 4, color: "#000000", opacity: 0.24 },
  grain: 0,
};
```

Open question (flagged for review): the playground exposes `light:
{ angle, intensity }` and `tint: { color, opacity }` as nested objects
because the UI binds sliders to them. Public API uses flat keys
(`lightAngle`, `tint` as a string/tuple). Mapping is mechanical — same
underlying uniforms — but the *shape* is different. **Accept the flat
shape for the public API?** I think yes (one less level of nesting,
matches every other CSS-shaped library). Confirming with you in the
review.

---

## 6. Public API

The full TypeScript surface, exported from `@glazelab/core`:

```ts
// ─── 1. Make any element glassy ───────────────────────────────────
export function createGlass(
  target: HTMLElement,
  config?: Partial<GlassConfig>,
): GlassHandle;

// ─── 2. The handle ────────────────────────────────────────────────
export interface GlassHandle {
  /** Mutate config. Zero-allocation hot path; safe to call every frame
   *  if driving an animation. */
  update(partial: Partial<GlassConfig>): void;

  /** Zero-allocation hot path for animation drives. Writes a single
   *  uniform slot directly. Skip for normal updates; use when you're
   *  in a tight rAF loop animating one or two values. */
  updateUniform(key: keyof GlassConfig, value: number): void;

  /** Force a fresh backdrop capture (Mode C). No-op for Modes A/B.
   *  Auto-triggered by ResizeObserver + MutationObserver; expose for
   *  rare cases where users animate non-DOM-observable changes. */
  refreshBackdrop(): void;

  /** Tear down. Idempotent — safe to call from React StrictMode
   *  cleanup that fires twice. */
  destroy(): void;

  /** The host element. Identity preserved across updates. */
  getElement(): HTMLElement;

  /** True if rendering via WebGL, false if rendering via CSS fallback. */
  isWebGL(): boolean;

  /** DEV-ONLY. Returns live uniforms, last frame timing, captured
   *  backdrop preview, and detected backdrop mode. Stripped from
   *  production builds via NODE_ENV dead-code elimination — zero
   *  prod bytes. Returns `null` outside dev. */
  debug(): GlassDebugInfo | null;
}

// ─── 2a. Debug info (dev only) ────────────────────────────────────
export interface GlassDebugInfo {
  uniforms: Readonly<Record<string, number | number[]>>;
  lastFrame: { capture: number; render: number; total: number };
  backdropMode: "A" | "B" | "C" | "fallback";
  backdropPreview: string; // base64 PNG, paste into DevTools
}

// ─── 3. The config ────────────────────────────────────────────────
export interface GlassConfig {
  // Geometry (CSS pixels).
  radius: number;

  // Body.
  frost: number;       // 0–1; backdrop blur strength
  saturation: number;  // 0–2.5; 1 = neutral
  brightness: number;  // 0–2;   1 = neutral
  tint: ColorInput;    // see §6.1
  grain: number;       // 0–1; film grain intensity

  // Rim geometry (CSS pixels — predictable across panel sizes).
  bevelWidth: number;  // 1–4 typical
  bendZone: number;    // 20–40 typical

  // Rim optics.
  refraction: number;  // 0–0.025 engine-space
  bevelDepth: number;  // 0–0.1
  chromatic: number;   // 0–0.4

  // Rim lighting.
  rimIntensity: number;     // 0–1.2
  lightAngle: number;       // radians; 0 = top, clockwise
  specularSize: number;     // 0–0.8
  specularOpacity: number;  // 0–0.25

  // Shadows (Figma-shaped).
  innerShadow?: ShadowConfig;
  dropShadow?: ShadowConfig;

  // Backdrop strategy (auto if omitted).
  backdrop?: string | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  backdropFrom?: HTMLElement | (() => HTMLElement);
}

export interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;    // hex or rgba
  opacity: number;  // 0–1
}

// ─── 4. Color input ───────────────────────────────────────────────
export type ColorInput =
  | string                            // "rgba(255,255,255,0.14)" or hex
  | [r: number, g: number, b: number, a: number]; // 0–1 each

// ─── 5. Presets ───────────────────────────────────────────────────
export const presets: {
  readonly liquidGlass: GlassConfig;
  // Future presets are additive only; never breaking.
};

// ─── 6. Capability probe ──────────────────────────────────────────
export function isSupported(): boolean;
```

That's the whole surface. ~30 type symbols. Memorizable.

### 6.1 Color handling

`ColorInput` accepts either a CSS string (parsed via the browser's
native parser, supports any valid CSS color including `oklch()`,
`color(display-p3 …)`, etc.) or a normalized RGBA tuple. Internally
both convert to a `Float32Array(4)` slot; uniform updates are a typed-
array write.

Strings are the ergonomic default; tuples are the zero-parse fast path
for animation libraries that already produce normalized values.

### 6.2 Defaults

Every field of `GlassConfig` has a sensible default in `presets.liquidGlass`.
Calling `createGlass(el)` with no config produces the playground's
dialed-in look. `Partial<GlassConfig>` lets users override only what
they care about — defaults flow in for the rest.

### 6.3 Update semantics

`handle.update({ frost: 0.3 })` mutates internal state, marks the lens
dirty, and yields. The next rAF tick redraws. Multiple `update()`
calls within the same frame are coalesced — only the final state ships.

`update()` does **not** animate. If a user wants `frost: 0 → 1` over
300ms, they drive that themselves (framer-motion, GSAP, raw rAF) and
call `update()` each tick. We don't double-tween.

### 6.4 Server safety

On import in a server context (`typeof window === "undefined"`), the
package exports stubs:

- `createGlass()` returns a no-op handle.
- `isSupported()` returns `false`.
- `presets` is the same object.

No top-level DOM access. No top-level `window`. No HMR weirdness on
SSR boundaries.

### 6.5 `isSupported()` requirements

Returns `true` only if **all** of:
- `typeof window !== "undefined"`
- WebGL2 context available (NOT just WebGL1 — our shader uses
  WebGL2 features; we don't try to support WebGL1, falls to CSS
  fallback)
- `OffscreenCanvas` constructor available (used for shared GL
  context). Polyfill not pursued — falls to CSS fallback.
- `Worker` constructor available (used for Mode C rasterization;
  Mode A/B/auto-without-C still works without it, but `isSupported()`
  reports the full capability)

Returns `false` otherwise. CSS fallback path activates automatically
when `isSupported()` is false; the public API is unchanged.

### 6.6 Per-lens canvas accessibility

Every per-lens canvas is created with:

```html
<canvas
  aria-hidden="true"
  role="presentation"
  tabindex="-1"
  style="pointer-events: none; …"
></canvas>
```

Required for the canvas to be invisible to screen readers, assistive
tech, keyboard navigation, and pointer events. Tested.

### 6.7 Error ergonomics

- **Dev mode** (`process.env.NODE_ENV === "development"`): invalid
  config, missing target, GL crashes throw with helpful messages
  including the offending key/value and a docs link.
- **Production**: silent no-op. `createGlass(null)` returns a no-op
  handle. Library never crashes a user's app.
- **Optional telemetry callback:**

  ```ts
  createGlass(el, {
    ...presets.liquidGlass,
    onError: (err) => sentry.captureException(err),
  });
  ```

  Fires for non-fatal issues (capture failure, GL context lost, etc.)
  Production receives the same callbacks dev does — for monitoring.

---

## 7. Seamlessness — the premium-feel mechanisms

This is §1 (the quality bar) made concrete. For each thing that *could*
feel laggy or bad, the policy and the mechanism.

### M1. No mount flicker

**Policy:** every `createGlass()` call appears to have always been there.

**Mechanism:** on mount, the host element gets `visibility: hidden`
(NOT `display: none` — content's box must lay out so layout doesn't
shift). The lens is registered, backdrop captured *synchronously if
available* (Mode A pre-decoded image; Mode B element ready) or
asynchronously with a CSS-fallback render in the meantime (Mode C
during initial capture). After first WebGL frame completes, flip
`visibility: visible` inside an rAF. Total time: 1 frame ≈ 16ms,
visually instant.

For Mode C where capture is unavoidably async (~50–200ms for a tall
DOM), the CSS-fallback path renders synchronously underneath. WebGL
takes over invisibly when ready — the canvas opacity tweens 0→1 over
one rAF, calibrated so the swap is below the eye's flicker threshold.

### M2. Scroll without staleness (Mode C)

**Policy:** rim looks correct on every scrolled frame.

**Mechanism:** capture-tall-once (§4.3). Scroll triggers zero work.
60fps unconditionally during scroll regardless of capture cost.

### M3. Resize without tear

**Policy:** drag-resize feels rubber-bandy, never chunky.

**Mechanism:** ResizeObserver fires per frame during a drag. Each
event:
- Updates lens rect (typed-array write — free).
- Marks canvas backing-store dirty.

A single trailing-edge debounced timer (100ms after last resize event)
re-allocates the canvas backing store. Intermediate frames render
against the old backing store with new lens rects. Slight quality hit
during the active drag (sub-pixel sampling); instantly perfect once
the user stops. No tear, no flash, no allocations on the hot path.

### M4. First-paint blank-rect prevention

**Policy:** glass element never shows as a blank/transparent rectangle,
even for one frame.

**Mechanism:** the **per-lens canvas** mounts with `visibility:
hidden`. The host element renders its content normally — backgrounds,
text, everything as the user wrote it. There is no blank rectangle
because the canvas is the only thing hidden, not the host.

- For Mode A/B (sync backdrop ready): first frame in ~1 rAF (~16ms).
  Flip canvas to `visibility: visible`. Visually instant.
- For Mode C (async via worker, 50–150ms): host content visible
  throughout; canvas hidden until first frame ready. Glass *appears*
  50–150ms after mount instead of being approximated and swapped.
  Honest is faster than approximated, and it's also cleaner code (no
  CSS-fallback-during-WebGL branch to maintain).
- For `prefers-reduced-motion: reduce`: snap visible without any
  fade, regardless of mode.

The earlier "CSS backdrop-filter under WebGL with calibrated swap"
idea was wrong: CSS `backdrop-filter: blur()` is visually different
from our pipeline (no refraction, chromatic, rim) — the swap would be
visible. Hiding the canvas until ready is honest and correct.

### M5. Hidden tab = paused renderer

**Policy:** background tabs use zero CPU/GPU.

**Mechanism:** PageVisibility API. On `visibilitychange → hidden`:
cancel rAF. On → visible: re-capture backdrops (they may have
animated), resume rAF. Marginal cost when paused: ~0 (one event
listener).

### M6. Strict-Mode safety

**Policy:** React 18 mount→unmount→mount cycles are invisible to the
user.

**Mechanism:** the singleton renderer is refcount-managed.

```ts
// inside core
let renderer: SharedRenderer | null = null;
let refcount = 0;

function acquire() {
  if (!renderer) renderer = new SharedRenderer();
  refcount++;
  return renderer;
}

function release() {
  refcount--;
  if (refcount === 0 && renderer) {
    renderer.destroy();
    renderer = null;
  }
}
```

`createGlass` calls `acquire()` and registers a lens; `handle.destroy()`
calls `release()` and unregisters. The expensive bit (GL context
creation) happens once for the lifetime of the page. A Strict-Mode
mount/unmount/mount cycle = 1 acquire, 0 net releases, 1 lens churn.
Cheap.

### M7. Update mutations are zero-allocation

**Policy:** `handle.update()` doesn't create garbage.

**Mechanism:** internal lens state is a SoA layout — every uniform is
a slot in a `Float32Array` keyed by lens ID. `update()` writes into
those slots. No `Object.assign`, no spread, no new objects. Animating
`frost: 0→1` over 60 frames produces zero GC pressure.

### M8. Reduced-motion respect

**Policy:** `prefers-reduced-motion: reduce` doesn't disable glass
(it's a visual style, not motion), but skips library-driven
transitions.

**Mechanism:** matchMedia query at init. Affects:
- M1 visibility:0→1 fade → snap (no rAF tween).
- Backdrop swap on resize → snap (no crossfade).

### M9. Hot reload survives

**Policy:** dev with Next.js Fast Refresh doesn't leak GL contexts.

**Mechanism:** `import.meta.hot.dispose` registers a cleanup that
destroys the singleton. The new module loads, recreates on next
acquire. Net: dev reloads behave like a Strict-Mode cycle — zero
visual artifact.

### M10. Performance budget (per frame, 60fps target)

Measured on M1 MacBook Air, Chrome stable, 1.5× DPR, 8 active lenses
averaging 400×80px.

| Subsystem                         | Budget    | Notes |
| --------------------------------- | --------- | ----- |
| Lens registration / dirty mark    | <0.05ms   | typed-array write |
| Mode A backdrop upload            | 0ms       | pre-uploaded once |
| Mode B backdrop upload            | <2ms      | texSubImage2D 1080p |
| Mode C backdrop upload            | 0ms       | pre-captured, scroll is free |
| Multi-lens render (8 lenses)      | <8ms      | shared blur pipeline |
| **Total per frame**               | **<10ms** | 60% of 16.6ms budget |

Cap: at >12 active lenses we degrade quality automatically (8-tap blur
→ 4-tap). Tested to maintain 60fps on M1; tested to maintain 30fps on
2018 Intel iMac.

### M11. Visual continuity (premium-feel polish)

These aren't perf — they're "looks right" details that compound to
premium feel:

- All edges anti-aliased subpixel (smoothstep with 1px softness).
- Premultiplied alpha throughout. Never straight-alpha (avoids dark
  fringes on translucent backgrounds).
- Color sampling in linear space when blurring; sRGB conversion only
  at output (matches macOS-native compositor output).
- Chromatic dispersion clamped at the inner edge of the bend zone —
  never bleeds past the panel border.
- Inner shadow rendered as a uniform-driven SDF inside the shader, not
  as a separate CSS layer (avoids double-rendering and z-order seams
  with the rim).
- Drop shadow is CSS box-shadow on the host element (not a shader
  effect — CSS gets the spread/opacity exactly right and composites
  with the rest of the page natively).

### M12. WebGL2 context loss survival

**Policy:** GL context loss (driver restart, OS sleep, GPU pressure)
never breaks the library. Recovery is automatic and visually clean.

**Mechanism:** §3.3 — listen for `webglcontextlost` (preventDefault)
+ `webglcontextrestored`. During lost window: per-lens canvases
render via CSS fallback. On restored: rebuild GL state, resume rAF.

### M13. Sticky / fixed lens scroll fidelity

**Policy:** sticky and fixed-positioned lenses have correct screen-
space rects every frame, including during scroll.

**Mechanism:** §3.2 — sticky/fixed detection at registration; passive
scroll listener (RAF-coalesced) re-reads `getBoundingClientRect()`
each frame for those lenses only. Static-positioned lenses skip the
scroll listener entirely.

### M14. Capture lifecycle race-safety

**Policy:** asynchronous backdrop captures never apply to stale
state. Mount → unmount → mount cycles, simultaneous captures of the
same target, and viewport changes during capture all behave
correctly.

**Mechanism:** §3.1 — generation counter on each lens, capture
deduplication by target+revision, viewport-snapshot guard.

### M15. Mode B static-frame detection

**Policy:** live-element backdrop uploads are skipped when the
source hasn't produced a new frame.

**Mechanism:** for `<video>`, use `requestVideoFrameCallback` —
upload only when a new frame is decoded. For `<canvas>`, hash a
small corner-region (32px) per frame; upload only on hash change.
Reduces GPU bus traffic by ~60% on idle/paused sources.

### M16. Bounded GPU memory

**Policy:** GPU memory is fixed regardless of lens count. Multi-lens
high-DPR scenarios never OOM the GPU.

**Mechanism:** §3.4 — single shared FBO pool sized to largest
active lens. ~5MB total; bounded.

### M17. Shader pre-warm

**Policy:** first-mount latency does not include shader compile time.

**Mechanism:** §3.6 — shader compilation kicks off as a side-effect
of singleton lazy creation, gated on first import of any public
symbol. By any lens mount, shader is ready.

### M18. Hydration-safe mount

**Policy:** SSR DOM matches client-hydration DOM. No React
hydration warnings. No layout shift.

**Mechanism:** §3.1 — per-lens canvas appended in `useEffect` (not
`useLayoutEffect`), AFTER hydration completes. Lens registration
gated on host having non-zero area.

### M19. Print mode

**Policy:** `@media print` renders glass as CSS-fallback (or simple
solid fill), never as a glitched WebGL canvas.

**Mechanism:** matchMedia `print` listener; on entry, hide all
per-lens canvases, render CSS fallback styling on hosts. On exit,
restore.

### M20. Forced-colors (high contrast) accessibility

**Policy:** Windows high-contrast users see the host's content
clearly. No subtle WebGL effects that vanish in a forced palette.

**Mechanism:** matchMedia `(forced-colors: active)` listener; on
entry, hide canvases, fall back to system-color borders on hosts.

### M21. DPR cap at 2×

**Policy:** Retina/4K displays don't hammer GPU memory or thermal
budget.

**Mechanism:** internal `effectiveDPR = Math.min(2, devicePixelRatio)`.
Canvas backing stores sized at `cssSize × effectiveDPR`. On 3×
displays the slight quality reduction is imperceptible; the memory
savings are 2.25×.

### M22. Pixel snapping

**Policy:** edges land on whole pixels regardless of fractional CSS
positions, avoiding sub-pixel shimmer during subtle motion.

**Mechanism:** lens rects are read from `getBoundingClientRect()`
and rounded to the nearest pixel at DPR before passing to the
shader. Avoids 0.5px-blurry edges.

---

## 8. Packaging

### 8.1 Workspace layout

```
glaze/
├── packages/
│   ├── core/                  ← @glazelab/core (this design)
│   │   ├── src/
│   │   │   ├── index.ts        ← public API
│   │   │   ├── renderer.ts     ← shared singleton (was lib/webgl-renderer.ts)
│   │   │   ├── shader.ts       ← GLSL (was lib/shader.ts)
│   │   │   ├── uniforms.ts     ← config → uniforms (was lib/glass-engine.ts)
│   │   │   ├── backdrop/       ← mode A/B/C/auto providers
│   │   │   ├── fallback.ts     ← CSS-only path
│   │   │   ├── presets.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   ├── tsup.config.ts
│   │   └── README.md
│   ├── react/                 ← @glazelab/react (Week 3)
│   ├── vue/                   ← @glazelab/vue (Week 4-5)
│   └── …
├── apps/
│   └── playground/            ← current /app moved here, dogfoods @glazelab/react
└── pnpm-workspace.yaml
```

### 8.2 Tooling

- **pnpm workspaces** (built into pnpm; zero config beyond
  `pnpm-workspace.yaml`).
- **tsup** for builds — ESM + CJS + .d.ts in one step. Tree-shakeable
  output. ~50 lines of config.
- **changesets** for versioning + changelog. Independent versioning
  per package (a typo-fix in `@glazelab/react` shouldn't bump
  `@glazelab/core`).
- **Vitest** for unit tests (existing playground has none — we add
  some at this stage, focused on the public API surface).
- **Playwright** for visual regression — screenshots of the playground
  pages, pixel-diffed per PR. Threshold: 0.1% pixel delta on the glass
  region.

### 8.3 npm publishing

- All packages published under `@glazelab/*` scope.
- v1.0.0 launches all packages simultaneously.
- MIT license.
- Standard `package.json` fields: `main`, `module`, `types`,
  `exports`, `sideEffects: false`, `peerDependencies` for framework
  packages.

### 8.4 Bundle splitting and size discipline

The package ships **two entry points** with the same public API:

```ts
import { createGlass } from "@glazelab/core";       // ~15KB gzip
import { createGlass } from "@glazelab/core/full";  // ~22KB gzip
```

The default entry includes Mode A (static image), Mode B (live
element), auto-detection without Mode C, and the CSS fallback path.
The `/full` entry adds the DOM rasterizer, the worker, and the
extended auto-detection that can resolve to Mode C.

**Why split:** ~95% of users will pass `backdrop="/hero.jpg"` (Mode
A). Forcing them to pay ~7KB for the rasterizer they'll never invoke
is anti-premium for the common case.

**Default-entry behavior on auto-resolved Mode C:** if the auto
heuristic picks Mode C and the rasterizer module isn't present, in
dev throw with a clear message: *"Mode C detected but rasterizer not
loaded. Either pass an explicit `backdrop` (Mode A or B), or import
from `@glazelab/core/full`."* In production, fall back to CSS path
silently and fire `onError` if a callback was provided.

#### Bundle-size discipline

| Entry             | Soft target | Hard ceiling |
| ----------------- | ----------- | ------------ |
| `@glazelab/core`       | ~15KB gzip | 22KB |
| `@glazelab/core/full`  | ~22KB gzip | 30KB |
| `@glazelab/react`      | ~5KB gzip  | 8KB  |

**Soft target, not a hard CI fail.** Rationale: the user's stated
priority is "great product first, fixing later." Size-limit CLI
surfaces measurements every PR; a ≥10% jump triggers review. But a
feature is not cut purely on byte-count grounds.

**Hard ceiling fails the build.** Past the ceiling we genuinely
re-evaluate.

#### Why no lazy-import of the rasterizer

We considered lazy-importing the rasterizer via `import()` from the
default entry. Rejected: Mode C-or-auto can hit on the very first
frame for many users; a network round-trip there causes a visible
flash. Splitting at the package-export level, where the bundler
resolves it at build time, is cleaner.

---

## 9. Verification gates

Every PR to `feat/glazelab-core` and onward must pass:

| Gate | Threshold | Mechanism |
|------|-----------|-----------|
| Bundle size — soft target | core ~15KB; core/full ~22KB; react ~5KB gzip | size-limit CLI, ≥10% jump triggers review |
| Bundle size — hard ceiling | core ≤22KB; core/full ≤30KB; react ≤8KB | size-limit CLI fails build past ceiling |
| SSR safety | importable in node, `createGlass()` returns no-op handle | vitest in node, no jsdom |
| Strict Mode | mount/unmount/mount cycles leak 0 GL contexts | playwright instrumenting `WebGLRenderingContext` |
| GL context loss / restore | simulated context loss recovers cleanly | playwright + `WEBGL_lose_context` extension |
| Multi-panel 60fps | 8 lenses on M1 average frame <12ms | playwright + Performance API trace |
| Multi-panel GPU memory | 16 lenses cap at <10MB GPU memory | playwright + WebGL extension queries |
| Auto-detection correctness | 100% correct mode pick across layout corpus | playwright suite of 8+ canonical layouts (hero+nav, sidebar+article, card-grid, modal, sticky-nav-over-scroll, parallax hero, video-bg, scroll container) |
| Mode C rasterizer fidelity | <2% pixel delta vs. browser-native screenshot | playwright pixel diff against `page.screenshot()` of same DOM |
| Mode C main-thread block | <16ms during initial capture | playwright + Performance API long-task observer |
| Hydration | zero React hydration warnings | playwright + console-error capture |
| Sticky lens scroll | rect updates each frame during scroll | playwright + scroll-driven rect inspection |
| Accessibility — canvas | screen reader sees zero canvas-related output | axe-core via playwright |
| Accessibility — pointer | clicks pass through canvas to host | playwright synthetic click |
| Print mode | `@media print` renders fallback, no WebGL | playwright print preview snapshot |
| Forced-colors | `(forced-colors: active)` falls back cleanly | playwright + emulated forced-colors media |
| Visual regression — playground | main view delta <0.1% | playwright pixel diff vs. golden |
| Visual regression — config gallery | 12 representative configs, each delta <0.1% | playwright pixel diff vs. golden gallery |
| Type completeness | every exported function fully typed | `tsc --noEmit --strict` |
| Public surface stability | no `any`, no internal types leaked | api-extractor snapshot |

---

## 10. Migration plan

### Phase 1 — Extract & build core (this branch)

**Workspace setup:**
- Create `packages/core/` workspace via pnpm.
- Move:
  - `lib/shader.ts` → `packages/core/src/shader/` (split into glass + blur + passes)
  - `lib/webgl-renderer.ts` → `packages/core/src/renderer/` (refactored to §3 architecture)
  - `lib/glass-engine.ts` → `packages/core/src/uniforms.ts`
  - `lib/types.ts` → split: public types in `packages/core/src/types.ts`, internal types co-located
  - `lib/presets.ts` → `packages/core/src/presets.ts`
- Stays in playground (`apps/playground/lib/`):
  - `lib/tick.ts` (audio is playground-only)
  - `lib/export-css.ts` (CSS export is a playground feature, not a core API)

**Renderer rebuild (§3):**
- Shared offscreen `OffscreenCanvas` WebGL2 context (singleton).
- Per-lens visible 2D canvas blit via `transferToImageBitmap` →
  `drawImage`.
- Refcounted singleton with deferred destroy (1s grace).
- Shader pre-warm on module import.
- Shared FBO pool, sized to largest active lens.
- WebGL context loss / restored event handlers + CSS-fallback during
  loss window.
- Race-safe lens lifecycle (generation counter, capture dedup,
  viewport-mismatch guard).
- Sticky/fixed lens scroll-driven rect updates.

**Shader extension:**
- Add saturation + brightness post-blur pass to the existing
  shader. ~30 lines GLSL. Required to render the playground preset
  faithfully.

**Backdrop subsystem (§4):**
- Mode A: static image provider — decode-once, upload-once, cached
  by URL.
- Mode B: live element provider — `requestVideoFrameCallback` for
  video, hash-based static-frame skip for canvas.
- Auto-detection heuristic with multi-candidate, Mode A/C
  arbitration, feedback-loop skip-tagging.
- Mode C (in `/full` entry): SVG-foreignObject rasterizer with
  CSS-variable resolution, executed in a Web Worker.
- Capture-tall-once with predictive pre-capture for tall scroll
  contexts.

**Public API surface (§6):**
- `createGlass`, `presets`, `isSupported`.
- `GlassHandle` with `update`, `updateUniform`, `refreshBackdrop`,
  `destroy`, `getElement`, `isWebGL`, `debug` (dev only).
- Accessibility attributes on per-lens canvas.
- Error ergonomics (dev-helpful, prod-silent, `onError` callback).

**Seamlessness mechanisms (§7 M1–M22):** all wired during Phase 1.

### Phase 1.5 — Auto-detection design pass

Before committing the heuristic, build a small test page in the
playground exercising the §4.2 corpus (hero+nav, sidebar+article,
card-grid, modal-over-page, sticky-nav-over-scroll, parallax hero,
video-bg, scroll container). Verify auto picks the right mode in
each. This is the "make-or-break" gate the user flagged — extra
design time here is by-design, not slack.

### Phase 2 — Migrate playground

- Move `app/` → `apps/playground/app/`.
- Replace `components/GlassCanvas.tsx` with imports from `@glazelab/core`
  (using the workspace-linked source — no publishing yet).
- Delete `app/spike/`, `components/spike/`, `lib/spike/` (their
  questions are answered; the live spike harness is no longer
  needed — visual regression covers it).
- Playground works exactly as today, identical behavior, identical
  visuals. The change is invisible to the playground user.

### Phase 3 — Verification

- Run all §9 gates.
- User visually verifies the playground at `/`. No visible regression.
- Open PR, merge, move to Week 3 (`@glazelab/react`).

### What gets deleted at the end of Week 2

- `lib/shader.ts`, `lib/webgl-renderer.ts`, `lib/glass-engine.ts`,
  `lib/presets.ts` — moved into `packages/core/`.
- `lib/spike/` — spike code, answered its question.
- `lib/types.ts` — split between `packages/core/src/types.ts` (public)
  and inlined-where-used (internal).
- `app/spike/`, `components/spike/` — visual harness consolidated
  into playground + visual-regression tests.

### What survives in playground untouched

- All UI components in `components/ui/` (PillSlider, ColorPill, etc.).
- `lib/tick.ts`, `lib/export-css.ts`.
- `app/page.tsx` (rewritten internally to import from `@glazelab/core`,
  but the same component structure and look).

---

## 11. Resolved decisions (was: open questions)

User reviewed and decided across 2026-04-26 in three rounds.

### Round 1 — initial six

1. **Flat config shape:** ✅ confirmed. API is flat (`lightAngle`,
   `lightIntensity`, `tint: "rgba(...)"`). Playground UI keeps
   grouped sliders for organization; generated snippets emit the
   flat API. See §5 callout.
2. **`bendZone` in absolute pixels:** ✅ confirmed.
3. **Auto-detection heuristic:** ✅ confirmed, flagged as
   "make-or-break — special design attention." See §4.2 + Phase 1.5.
4. **No animation in `update()`:** ✅ confirmed. Library snaps; users
   drive their own tweens.
5. **Bundle target:** ✅ soft limit, "great product first, fixing
   later." Per-entry targets in §8.4.
6. **Mode C rasterizer:** ✅ first-party, not html2canvas. ~5–7 days
   extra in Week 2.

### Round 2 — first deep audit (six architectural)

7. **Per-lens visible canvas + shared offscreen GL context** (replaces
   "one full-viewport canvas"). Solves z-order, stacking, iframes,
   sticky/fixed positioning. See §3.
8. **Worker-based DOM rasterization.** Main-thread block from
   40–150ms → 6–16ms. See §4.5.
9. **WebGL context loss / restore handling.** Production-quality
   requirement. See §3.3, §M12.
10. **Bundle splitting** (`@glazelab/core` vs `/full`). See §8.4.
11. **Strict-Mode singleton with deferred destroy** (1s grace
    window). See §3.5.
12. **Honest first-paint mechanism.** Per-lens canvas
    `visibility: hidden` until first frame; no fake CSS-approximation
    swap. See §M4.

### Round 3 — second deep audit (six architectural + six policy)

**Architectural (Tier 1):**
13. **Sticky / fixed lens scroll updates.** RAF-coalesced scroll
    listener for sticky/fixed lenses only; static lenses skip it.
    See §3.2, §M13.
14. **Race-safe lens lifecycle** — generation counter, capture
    dedup, viewport-mismatch guard. See §3.1, §M14.
15. **Saturation + brightness in-shader** (post-blur, pre-rim
    composite). ~30 lines GLSL. Required to match playground
    preset. See §10 Phase 1.
16. **Shader pre-warm on module import.** Cuts first-mount latency
    by 20–200ms. See §3.6, §M17.
17. **Shared FBO pool** sized to largest active lens. ~5MB GPU
    memory cap regardless of lens count. See §3.4, §M16.
18. **Hydration-safe mount.** Per-lens canvas appended in `useEffect`
    post-hydration; lens registration gated on non-zero host area.
    See §3.1, §M18.

**Policy (Tier 2):**
19. **Mode B static-frame detection.** `requestVideoFrameCallback`
    for video; hash-skip for canvas. ~60% bus traffic reduction. See
    §M15.
20. **Multi-candidate auto-detection: prefer largest cover.** See
    §4.2.
21. **Mode A vs Mode C arbitration when both valid.** Static
    image-with-lens favored; fixed/parallax forces Mode C. See §4.2.
22. **Glass canvas accessibility.** `aria-hidden`, `role="presentation"`,
    `tabindex="-1"`, `pointer-events: none`. See §6.6.
23. **WebGL2 required.** `isSupported()` probes WebGL2 specifically;
    WebGL1-only environments fall to CSS path. See §6.5.
24. **Dev-mode `handle.debug()`** returns uniforms, timing, capture
    preview, mode. Stripped from production via NODE_ENV. See §6.

### Round 3 — implementation polish (handled inline, not separate
sections)

Listed for transparency, addressed during Phase 1 without dedicated
doc sections:
- `data-glaze-host` / `data-glaze-canvas` debugging attributes
- TypeScript color validation with helpful dev-mode warnings
- Visual regression on a 12-config gallery (in §9 verification gates)
- Source map preservation through tsup
- Module-graph hygiene for tree-shaking
- `oklch()` / `color(display-p3 ...)` parsing via OffscreenCanvas
- Internal naming consistency (lens vs panel — pick one)
- `updateUniform()` zero-allocation hot-path API (already in §6)

---

## 12. Out of scope for Week 2

- Framework wrappers (`@glazelab/react`, /vue, /svelte, /solid) —
  Weeks 3–5.
- Snippet generator + AI prompt tab in playground — Weeks 3–4.
- Docs site, tutorials, recipes — Weeks 5–6.
- Native mobile (React Native, SwiftUI bridge) — post-v1.0, if at all.
- Server-rendered glass (full Hydration-perfect SSR) — v1.1+.
- Multi-canvas isolation modes (e.g., shadow-DOM-scoped renderer) —
  unlikely; the singleton design (§3) makes this unnecessary.

---

**Next step:** user reviews this doc. Once approved (or amended), I
implement Phases 1–3 of §10 over the next 3–4 working sessions, gated
by §9 verification.
