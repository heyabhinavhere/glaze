# Glaze release readiness

Date: 2026-08-22

Branch: `aj/glaze-component-system`

Verdict: **GO for physical-device and real-product dogfood review; NO-GO for
merge, deployment, or publication until the remaining manual gates close.**

The owner-accepted optical material is unchanged. This document separates
repeatable engineering evidence from owner- and device-controlled release
approval.

## Completed automated gates

| Gate | Result |
| --- | --- |
| Optical-kernel unit contract | 5/5 passed |
| Optical kernel, development | 27/27 passed across Chromium, Firefox, and WebKit |
| Optical kernel, optimized production | 27/27 passed across Chromium, Firefox, and WebKit |
| Component-system unit contract | 3/3 passed |
| Component proof, development | 22 applicable passes; 2 declared duplicate-project skips |
| Component proof, optimized production | 22 applicable passes; 2 declared duplicate-project skips |
| Public package unit suite | 27/27 passed |
| Public API, development | 26 applicable passes; 22 declared one-browser probe skips |
| Public API, optimized production | 26 applicable passes; 22 declared one-browser probe skips |
| iPhone/iPad WebKit preflight, development | 4/4 passed |
| iPhone/iPad WebKit preflight, optimized production | 4/4 passed |
| Workspace React 19 and Next.js 16 consumers | 2/2 browser checks passed |
| Installed tarball consumers | React 18, React 19, and Next.js 16 builds passed; 2/2 browser checks passed |
| Repository build | Passed for core, React package, playground, Vite example, and Next.js example |
| TypeScript | Passed across every workspace package |
| Lint | Passed with two pre-existing legacy playground `img` warnings and no errors |

The final public matrix verifies:

- deterministic SSR and hydration;
- one authoritative semantic control tree and no duplicate events or IDs;
- keyboard interaction and form safety;
- one renderer per source with shared control lenses;
- controlled parent rerenders without renderer replacement;
- exact-material workbench editing and export;
- context loss and fresh-renderer restoration;
- reduced motion and forced-colors behavior;
- a visible semantic fallback when WebGL2 is unavailable;
- zero idle RAF after springs and media stop;
- same-kind media replacement without renderer replacement;
- source-kind replacement with a fresh renderer;
- canvas subscription invalidation;
- DPR 2 backing stores and resize without renderer replacement;
- offscreen media suspension;
- observer and renderer-output cleanup on unmount; and
- deterministic `source-not-origin-clean` failure plus clean-source recovery.

The separate mobile preflight uses iPhone 15 and iPad (7th generation) WebKit
profiles. It verifies responsive placement, no horizontal overflow, capped DPR
2 backing stores, touch action, below-fold suspension and resume, semantic
updates, renderer stability, console cleanliness, and full-page real-size
captures. The optimized-production captures were also inspected at real size for
source-label legibility, component overlap, and workbench placement. This is a
preflight only; it does not close the physical-device gate.

## Bundle gates

| Artifact | Measurement | Limit |
| --- | ---: | ---: |
| React base and shared ESM chunks | 7,861 B brotli | 8,192 B |
| Accepted optics chunk | 6,078 B brotli | 6,686 B |
| Workbench chunk | 1,322 B brotli | 2,048 B |
| React CSS | 2,000 B gzip | 6,144 B |
| Server-safe material entry | 546 B brotli | 2,048 B |

The optics measurement remains exactly the accepted baseline. The base entry
has 331 bytes of remaining budget; further public-surface growth requires
deliberate budget review.

## Completed real desktop review

The optimized production build was opened at real scale in actual Google
Chrome and macOS Safari on 2026-08-22. Both browsers:

- rendered the owned-decoration and live-video surfaces with WebGL2;
- reported the requested and effective capabilities truthfully;
- exposed the single semantic radiogroup, switch, and slider tree; and
- moved the accepted selection body when a segment changed.

This closes the macOS Chrome/Safari desktop review. It does not substitute for
physical mobile hardware.

## Completed keyboard and VoiceOver review

On 2026-08-22, macOS VoiceOver was enabled through System Settings and used
with actual Safari against two optimized-production builds. The workspace
workbench pass verified keyboard order and exposed names, roles, selected/on
states, and numeric values for both source surfaces and the live workbench.
Keyboard input changed and then restored the owned-source switch, media
segmented selection, media transmission, and live refraction value.

The release gate was then rerun against a retained Next.js 16.2.3 consumer that
installed `@glazelab/react` from the packed tarball rather than a workspace
link. VoiceOver exposed one `Account section` radiogroup with exactly three
radio buttons. Safari focused `Overview`, changed the selection to `Activity`
with the Right Arrow, kept `webgl2-displacement-map` effective with fallback
`None`, and restored `Overview`. VoiceOver was disabled after the review.

This closes the macOS keyboard and VoiceOver gate. It does not substitute for
VoiceOver on physical iPhone/iPad hardware.

## Remaining manual gates

These are release blockers:

1. physical iPhone review in Safari;
2. physical iPad review in Safari;
3. dogfooding the installed tarball in one real Next.js product consumer;
4. final owner review of the live installed component, including the visible
   CSS fallback with optical support disabled; and
5. explicit authorization for merge, deployment, or npm publication.

No screenshot, browser automation result, or agent judgment closes these
manual gates. Failure of any gate stops release and permits only one diagnosed,
bounded correction before the relevant gate is rerun.

## Reproduction

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm size
corepack pnpm test:unit
corepack pnpm test:optical-kernel:unit
corepack pnpm test:optical-kernel
corepack pnpm test:optical-kernel:production
corepack pnpm test:component-proof:unit
corepack pnpm test:component-proof
corepack pnpm test:component-proof:production
corepack pnpm test:public-api
corepack pnpm test:public-api:production
corepack pnpm test:mobile-release
corepack pnpm test:mobile-release:production
corepack pnpm test:consumers
corepack pnpm test:packed-consumers
corepack pnpm test:packed-consumers:retain
```
