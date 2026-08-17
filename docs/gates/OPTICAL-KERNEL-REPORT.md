# Optical kernel recovery report

Date: 2026-08-17

Branch: `aj/glaze-optics-recovery`

Route: `/optical-kernel`

Map contract: `glaze-optical-map-r1`

## Verdict

**RECOVERY CANDIDATE 1. MECHANICS PASS. OWNER VISUAL ACCEPTANCE PENDING.**

Product, component extraction, public API, workbench, merge, deployment, and
release remain blocked.

This verdict does not reuse the withdrawn M1/M2 acceptance. Passing automation
is recorded only as mechanical evidence.

## What changed

- Replaced the combined `max()` height field with two deterministic GPU maps:
  one stable track and one continuous moving selection lens.
- Defined portable RGBA semantics: horizontal displacement, vertical
  displacement, thickness, and coverage.
- Removed leading/trailing SDF lobes and the adaptive gray volume wash.
- Composited both surfaces from the same owned source with premultiplied RGB.
- Derived refraction, low optical roughness, restrained dispersion,
  directional highlight, and opposing occlusion from the map rather than CSS.
- Shifted material visibility from concentrated edge bend into full-body
  magnification and coherent cool transmission.
- Replaced the permanent animation loop with demand-driven source uploads and
  spring frames. Static sources and settled selection stop all work.
- Preserved one semantic DOM radiogroup above the decorative canvases and the
  explicit WebGL failure fallback.

## Mechanical evidence

| Gate | Result |
| --- | --- |
| Focused map contract | 4/4 unit tests pass |
| Playground TypeScript | Pass after serial core and React declaration builds |
| Next.js 16.2.3 optimized build | Pass; `/optical-kernel` statically prerendered |
| Development browser matrix | 27/27 across Chromium, Firefox, and Playwright WebKit |
| Production browser matrix | 27/27 across Chromium, Firefox, and Playwright WebKit |
| Real component size | `320 x 64` at 1280×720 and 390×844 |
| Separate maps | Two map renders for every composite frame |
| Idle scheduling | Frame, map-render, and upload counts remain unchanged after settlement |
| Source switching | Four sources retain one renderer and unchanged shaders/material values |
| Semantic control | Click, arrows, Home, End, focus, and selected state pass |
| Reduced motion | Selection snaps with zero velocity |
| Failure handling | WebGL2 failure and context loss preserve controls and expose reasons |
| CSS success-path finish | No background, backdrop filter, border, or shadow |
| Pixel vetoes | Interior, perimeter, and outside thresholds pass in every browser |
| Lint | Zero errors; two unrelated historical `<img>` warnings |

These checks establish deterministic inputs, lifecycle, semantics, fallback,
and bounded rendering. They do not prove beauty.

## Owner review evidence

Generated evidence is ignored by Git and lives under
`.gstack/evidence/optical-kernel/`:

- full 1280×720 source-matrix captures for each browser;
- compact 390×844 captures;
- rest, departure, travel, and settled motion samples; and
- `review/reference-vs-candidate-real-size.png`, with the supplied reference
  and candidate control shown side by side at the same scale.

The reference remains user-provided external evidence and is not copied into
the distributable package.

## Boundaries still open

- Owner visual acceptance is not inferred or recorded.
- Physical iPhone/iPad and native Safari performance are not tested.
- The source is Canvas 2D only; owned decoration and explicit media adapters
  remain frozen.
- Context restoration fails closed and requires remount.
- The values remain private candidate constants, not a public material schema.
- The three-option component is the only authorized geometry.

## Next decision

The only next product decision is owner review of the live/full-scale
candidate. If rejected, record the specific visual failure and make at most
one bounded correction to this candidate. Do not begin component extraction,
workbench work, or another renderer direction.
