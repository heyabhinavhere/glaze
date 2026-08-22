# Glaze recovery ledger

Date: 2026-08-22

Accepted recovery branch: `aj/glaze-optics-recovery` at `162c1cb`

Active product branch: `aj/glaze-component-system`

Active gate: physical-device, dogfood, and final owner release review

Owner visual decision: **ACCEPTED 2026-08-22**

## Product promise

Glaze is a React and Next.js component system for semantic controls with
liquid-glass optics over explicitly owned visual sources. Its in-app developer
workbench tunes and exports the exact material used by those components.

## Owner acceptance

On 2026-08-22 the owner explicitly accepted the live, real-size
`glaze-optical-map-transplant` material at commit `afc7112`. This closes the
optical gate and authorizes component extraction under the unchanged-material
rules below. It does not accept the legacy CSS renderer, broaden source
ownership, or authorize arbitrary DOM capture.

The tracked acceptance set and hashes live in
`docs/evidence/optical-kernel/accepted-2026-08-22/`.

## Repository reset

- `aj/glaze-visual-reset` commit `371a110` preserves the rejected M2
  multi-lens candidate and its `VISUAL NO-GO` evidence. It is archival and may
  not be merged into the product path.
- Draft PR #6, the CSS-first V1 release candidate, was closed on 2026-08-17.
  Its semantic React components, fallback behavior, diagnostics, and packed
  consumer checks remain useful scaffolding; its CSS material is not the
  product renderer.
- `aj/glaze-optics-recovery` starts at optical-kernel commit `17e47a5`. That
  commit is a harness baseline, not a visually accepted material.

## Accepted optical kernel

The owner rejected `glaze-optical-map-r1` on 2026-08-18 because the material,
especially the moving selection lens, was almost invisible at real size. The
runtime and renderer were healthy. Pixel and shader inspection showed that
the track and selection used nearly identical transmission while highlight
and occlusion energy were restricted to a narrow edge.

The owner rejected `glaze-optical-map-r2` on 2026-08-19 because it was still
almost invisible at real size. Revision 1 improved source-pixel deltas but
still depended on background detail and a directional edge to communicate
the selected body. That numeric improvement did not satisfy the visual gate.

The owner rejected `glaze-optical-map-r3` on 2026-08-20 because it was still
effectively invisible at real size and contained additional visual mistakes.
The selected body was communicated by cyan absorption and broad synthetic
lighting instead of coherent refraction. Sampling the page scene through both
the outer track and inner lens produced competing nested shapes. Passing pixel
delta thresholds did not make the material convincing.

`glaze-optical-map-transplant` is the accepted kernel. Its
spherical-cap normalization and inward meniscus math are adapted from the
MIT-licensed `samasante/liquid-glass` implementation at commit
`4e7b769e1df7e5a7d3669fef22417fe3d2f79ade`; the required notice is preserved
in `THIRD_PARTY_NOTICES.md`.

The transplant retains Glaze's semantic DOM, renderer ownership, spring,
diagnostics, context handling, zero-idle scheduling, and RGBA contract. It
renders one `320 x 64` segmented control from one owned Canvas 2D scene and one
small visual-only decoration canvas. The decoration contains no labels, IDs,
forms, events, or interactive content. Two deterministic GPU maps remain:

1. a stable track map; and
2. one continuous moving selection map.

Each map stores horizontal displacement, vertical displacement, thickness,
and coverage. The stable track supplies the only visible outer meniscus. The
selection map is thickness-weighted into that body as a moving refractive
bulge, so it does not draw a second pill or contour. The composite uses fixed
neutral transmission, restrained chromatic dispersion, a directional
highlight, and opposing occlusion. It emits premultiplied output and leaves the
single authoritative DOM label tree above the optical layer.

The same private material constants run on all four scenes and all three
states. The rejected cyan absorption, hard inner oval, page-specific values,
CSS finish, and aesthetic source-pixel ratio gates are absent. No other
library's React tree or lifecycle was imported.

## Gate authority

- Automated checks can reject broken mechanics. They cannot accept visual
  quality.
- Full-viewport, 1x, real-size evidence is primary. Crops and pixel metrics
  are supporting diagnostics only.
- Only an explicit owner decision can change `Owner visual decision` to
  `ACCEPTED`.
- “Better”, “improved”, passing tests, or an agent/orchestrator judgment do not
  unlock component extraction.

## Unlocked work and remaining freezes

Component extraction was authorized in this order:

1. **Complete:** port the accepted kernel into the validated React foundation;
2. **Complete:** prove owned decoration and explicit media across segmented
   control, switch, slider, and one live video source without changing the
   material;
3. **Complete:** freeze the serializable public API; and
4. **Complete:** build the workbench against the exact live material after the
   API is frozen.

The public contract and exact-material workbench now pass development and
optimized-production matrices in Chromium, Firefox, and WebKit. Packed React
18, React 19, and Next.js 16 consumers also pass from the installed tarball.
Real-scale review of the optimized build passes in actual macOS Chrome and
Safari. Actual macOS VoiceOver and Safari also pass against an optimized
Next.js 16 consumer installed from the package tarball. Physical iPhone/iPad,
real-product Next.js dogfood, final live owner review, publication, deployment,
release PRs, and component-specific optical patches remain blocked. Arbitrary
DOM capture, `html2canvas`, automatic source detection, and CSS glassmorphism
as the primary renderer remain permanently rejected.

## Public API and workbench proof

The active public contract is documented in `docs/PUBLIC-API.md` and emitted
from `@glazelab/react`. `/` and `/workbench` consume only that package surface.
Both source capabilities share the frozen material registry and the
development workbench edits that exact registry. Browser checks prove that a
material edit changes the live owned-source canvas without replacing either
source renderer.

The ESM renderer and workbench are separate lazy chunks. The initial entry and
shared chunks remain within the original 8 KiB brotli budget. The accepted
optics chunk measured 6,078 bytes brotli; its enforced ceiling is 10% above
that measurement. Workbench output is disabled by default in production unless
the consumer deliberately enables it.

The final public lifecycle matrix is recorded in
`docs/RELEASE-READINESS.md`. It covers source replacement, canvas invalidation,
DPR resize, reduced motion, offscreen suspension, cleanup, unavailable WebGL,
and deterministic tainted-source failure and recovery without changing the
accepted optical shader.

## Component-system proof

The private `/component-proof` route proves both authorized source contracts:

- `owned-decoration` serializes one inert, `aria-hidden` React SVG and rejects
  IDs, events, interactive elements, forms, labels, editable content, and
  explicitly sensitive nodes;
- `explicit-media` draws one same-origin live video into an owned canvas and
  uploads only presented frames; and
- each source surface owns one WebGL renderer and one source texture shared by
  a segmented control, switch, and slider.

All six controls use the accepted optical shader and material-decoration
pixels. The only shader generalization replaces the literal three-segment
division with a registered selection-count uniform. A source-level invariance
test removes that mechanical substitution and requires the remaining vertex,
map, composite, and material-decoration sources to match the accepted kernel.

Development and optimized-production matrices each completed with 22 passes
and two intentional duplicate-project SSR skips across Chromium, Firefox, and
WebKit. They verify SSR output, one authoritative interactive tree, renderer
ownership, control registration, keyboard semantics, reduced motion,
demand-driven idle shutdown, live and paused video scheduling, truthful CSS
fallback, source-contract rejection, and fail-closed context loss. Screenshots
are run evidence only and have not been blessed as new visual goldens.

## Optical freeze rule

Candidate 1 used both bounded owner-directed revisions and failed owner review.
The license-verified, math-only displacement transplant then passed owner
review. Its displacement equations, material constants, map contract, and
composite behavior are frozen during component extraction. A mechanical bug
may be fixed with regression evidence; aesthetic retuning requires reopening
the owner gate explicitly.

## Verification commands

```bash
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
corepack pnpm --filter @glazelab/react size
corepack pnpm --filter playground typecheck
corepack pnpm --filter playground lint
corepack pnpm --filter playground build
```
