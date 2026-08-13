# Glaze Gate 3 — candidate adoption due diligence

Date: 2026-08-13

Branch: `aj/glaze-engine-bakeoff`

Gate 0–2 checkpoint: `87eceda`

Probe route: `/research/adoption`

Candidate: `@samasante/liquid-glass` `0.1.1`, pinned exactly

## Verdict

**NO-GO for direct dependency adoption, public wrapping, or vendoring/forking the complete package.**

The package demonstrates a useful optical technique, and its copied-DOM path survived the bounded lifecycle stress. It does not clear Glaze's product boundary, reliability, accessibility, performance, visual, or ownership gates as a foundation for a DialKit-like React/Next.js workflow.

This is not a decision to abandon the library product. It is a decision not to make this early, monolithic engine the library's contract. Glaze remains:

- a developer-facing React/Next.js library and visual workbench target;
- CSS-first for semantic clarity, unsupported hardware, forced colors, and fallback;
- explicit-source WebGL only for separately named image, video, or canvas capabilities; and
- open to a future, narrowly owned DOM-optics engine after its contract is independently proven.

No public API, package wrapper, workbench expansion, deployment, or release is authorized by this report.

## Decision matrix

| Ownership option | Decision | Reason |
|---|---|---|
| Depend directly on `0.1.1` | **Reject** | Early maintenance signal, unsplit client runtime, accessibility footgun, confirmed Strict Mode failure, continuous WebGL loop, unresolved edge artifact, and incomplete shipping-Safari coverage |
| Fork the upstream repository now | **Reject** | Fixing lifecycle and semantics would still leave visual quality, bundle separation, iOS proof, upgrade ownership, and the broad copied-DOM promise unresolved |
| Vendor the complete package | **Reject** | It would transfer responsibility for two rendering engines and their browser matrix without producing a better product contract |
| Preserve as research/reference | **Accept** | The owned decorative-DOM technique is useful evidence and can inform a later minimal engine contract without becoming production code |

## What is verified locally

### 1. The narrow decorative-only DOM path is technically viable

The allowed contract copies only an explicitly decorative subtree and layers the real semantic controls once. It passed the following stress in development and built production across Chromium, Firefox, and Playwright WebKit:

- seven simultaneous package lenses;
- twelve consecutive remounts;
- resize and responsive relayout;
- horizontal scroll and a transformed descendant;
- unique SVG filter IDs after mount and remount;
- no duplicate DOM IDs in the constrained case;
- no console or page errors; and
- demand-driven idling with no more than two observed animation-frame callbacks during the 600 ms settled window.

Shipping Safari on macOS also rendered the seven-lens case and remained usable after manual remount and resize actions. Mobile Safari in an iOS 26.2 iPhone 17 Pro Simulator rendered the compact optics case. This is positive evidence for the narrow copied-decoration technique, not approval of the package as a whole.

### 2. The broad copied-DOM promise is unsafe by default

Passing an application subtree through `refract` renders that subtree again. `pointer-events: none` prevents mouse targeting; it does not remove the copy from the accessibility tree, make duplicate IDs valid, or make sensitive content safe to duplicate.

The controlled failure probe renders one real `Sensitive action` button and passes the same button to `refract`. Verified result:

- two elements with `id="sensitive-action"`;
- two accessible buttons named `Sensitive action` in Chromium, Firefox, Playwright WebKit, and shipping macOS Safari; the duplicated content was also visibly reproduced in iOS Simulator Safari; and
- one accessible button only when the copied subtree is explicitly decorative and `aria-hidden`.

Therefore Glaze cannot honestly advertise arbitrary `wrap your component` refraction. Any future copied-DOM capability must be named and typed as decorative-only, with semantics, form state, IDs, private values, media, and eventful children excluded by contract.

### 3. The package WebGL lifecycle is not React-development safe

An isolated React root reproduces the upstream Strict Mode issue without Glaze's renderer or compatibility code:

1. mount the package WebGL `draw` path under `<StrictMode>`;
2. the development effect cleanup disposes the renderer and calls `WEBGL_lose_context.loseContext()`;
3. Strict Mode replays the effect against the same canvas; and
4. shader creation fails and the package permanently falls back.

The exact warning reproduced in development Chromium, Firefox, and Playwright WebKit:

`[liquid-glass] WebGL renderer unavailable, falling back: Error: glass-webgl shader: null`

Built production does render the same WebGL probe, confirming that the failure is lifecycle-specific rather than a missing-hardware result. Production also fires more than ten animation-frame callbacks in 500 ms for the static `draw` path. That path is a continuous renderer, not demand-driven work.

### 4. The Next.js client boundary does not isolate the needed engine

The installed package advertises `sideEffects: false`, React 18+ peer compatibility, zero runtime dependencies, and an MIT license. Its distributed ESM entry is 104,257 bytes raw and 25,729 bytes gzip.

In the actual Next.js `16.2.3` production build, the adoption route receives:

| Client asset | Raw | Gzip | Contents |
|---|---:|---:|---|
| Package chunk | 47,943 B | 15,750 B | Both SVG/DOM and WebGL/shader paths |
| Probe/UI chunk | 8,164 B | 2,595 B | Gate-only route and diagnostics |
| Incremental total | 56,107 B | 18,345 B | Excludes shared framework, CSS, and fonts |

Tree-shaking removes unused exports, but it cannot split the runtime branches inside the exported `Glass` component. A product needing only the safe DOM path still inherits the WebGL implementation unless the package introduces engine-specific entry points or Glaze owns a narrower implementation.

### 5. The one permitted optics revision failed

Gate 2 identified a bright/chromatic lens-edge seam. Gate 3 changed only `dispersion`, from the published default to `0.16`; every other optic, dimension, background, and control remained fixed.

Chromium production and shipping Safari show the same result: the lower dispersion slightly reduces color separation, but it does not remove the edge speck/seam or materially strengthen the selected state. Safari also renders the multi-lens material flatter and more striped than the intended glass object. The single evidence-led revision therefore fails; no subjective tuning loop is authorized.

### 6. Browser coverage is broad, with one explicit hardware limit

The probe passed 9/9 development checks and 9/9 built-production checks across Chromium, Firefox, and Playwright WebKit. Shipping Safari on macOS was then inspected directly for:

- the controlled optics comparison;
- the multi-lens remount/resize case; and
- the duplicated accessible-control failure.

Mobile Safari in an iOS 26.2 iPhone 17 Pro Simulator was inspected directly for the compact optics comparison and visible semantic-copy failure. Playwright WebKit is not Safari proof, and Simulator Safari is not proof of physical-device GPU, thermal, memory, or assistive-technology behavior. A physical iPhone/iPad run therefore remains a release gate, although it is no longer an untested browser-layout assumption.

## Upstream facts versus local conclusions

### Upstream facts

- The repository documents zero-copy live backdrop bending as Chrome/Edge-only; Safari and Firefox use wrapped/copied content for cross-browser bending.
- Its browser guide explicitly recommends one or a few content-sized lenses and warns that wide panels can bloom into an oval and that many instances can become GPU-bound.
- The repository history currently exposes only two changelog entries, `0.1.0` and `0.1.1`, both from June 2026.
- Open issue #2 describes the same React Strict Mode WebGL context-loss failure reproduced here.
- Open issue #1 reports an unexpected pixelated edge consistent with the independently observed lens-edge speck.

### Local conclusions

- The copied-DOM implementation is not intrinsically inaccessible, but its safe usage boundary is much narrower than a general component wrapper.
- The package's early status is not, by itself, a rejection reason. It becomes material because Glaze would immediately need to own lifecycle fixes, an accessibility adapter, bundle splitting, browser proof, and visual repair.
- A fork is unjustified until the visual result is worth owning. The permitted change did not cross that threshold.

## Evidence and reproducibility

Automated commands:

- `corepack pnpm --filter playground typecheck` — passed.
- `corepack pnpm --filter playground lint` — 0 errors; two pre-existing `<img>` warnings outside the research routes.
- Default Turbopack production build — passed with the Gate 3 route code; `/research/adoption` is server-rendered on demand.
- Final clean `next build --webpack` cross-check — passed after authorizing the existing `next/font` Google Fonts fetch required by the app layout.
- Development adoption gate — 9/9 across Chromium, Firefox, and Playwright WebKit.
- Built-production adoption gate — 9/9 across Chromium, Firefox, and Playwright WebKit.
- Production controlled-optics evidence — 1/1.

Generated evidence is intentionally ignored by Git under:

`.gstack/evidence/gate-3/candidate-adoption/`

Key captures:

- `production/optics-default-vs-dispersion-016.png`
- `production/optics-comparison-crop.png`
- `safari/optics-default-vs-dispersion-016.jpeg`
- `safari/dom-stress-after-remount-resize.jpeg`
- `ios-safari/optics-default-vs-dispersion-016.jpeg`
- `ios-safari/duplicate-semantic-subtree.jpeg`

## Conditions for a future re-evaluation

Do not reopen this dependency decision based on a prettier isolated demo. Re-evaluate only when a candidate can prove all of the following in one narrow vertical slice:

1. a DOM-only import that does not ship the WebGL renderer;
2. no permanent context loss under React Strict Mode, remount, and hot reload;
3. demand-driven static work with bounded animation ownership;
4. a decorative-copy API that is hidden from accessibility and rejects or clearly excludes semantic/sensitive descendants;
5. whole-control evidence with no bright seam, pixelated edge, pinching, or loss of selected-state clarity; and
6. development and production proof in Chromium, Firefox, shipping Safari on macOS, Simulator Mobile Safari, and a physical iOS/iPadOS device before release.

Until then, the correct next product step is not another renderer rewrite. It is to specify Glaze's small public workflow—installation, semantic component contract, CSS fallback, explicit capability detection, and diagnostic workbench—without promising arbitrary page refraction. The optical backend stays private and replaceable until one clears these gates.
