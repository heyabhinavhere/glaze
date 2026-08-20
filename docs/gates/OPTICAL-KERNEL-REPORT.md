# Optical kernel recovery report

Date: 2026-08-20

Branch: `aj/glaze-optics-recovery`

Route: `/optical-kernel`

Map contract: `glaze-optical-map-transplant`

## Verdict

**FINAL MATH-ONLY TRANSPLANT. MECHANICS PASS. OWNER VISUAL ACCEPTANCE PENDING.**

Product extraction, public API, workbench, merge, deployment, and release
remain blocked. The earlier hand-tuned shader failed owner review even though
its checks passed; no automated result in this report grants acceptance.

## Rejection that triggered the transplant

The owner rejected `glaze-optical-map-r3` on 2026-08-20 because it still felt
invisible at 1x and contained additional visual errors. Inspection confirmed
that cyan absorption was manufacturing an inner button, the track and
selection formed competing contours, and source-pixel delta ratios were being
mistaken for material quality. The r3 shader path is closed.

## Final transplant

- Adapted only spherical-cap normalization, the soft inward field, and the
  single-field meniscus math from the MIT-licensed
  [`samasante/liquid-glass`](https://github.com/samasante/liquid-glass) commit
  `4e7b769e1df7e5a7d3669fef22417fe3d2f79ade`.
- Preserved Glaze's renderer, two RGBA maps, semantic DOM, motion, DPR handling,
  fallback, diagnostics, context handling, and demand-driven frame lifecycle.
- Kept one outer track as the visible glass body. The moving selection is a
  thickness-weighted refractive bulge inside it, without an independent rim or
  opaque selected pill.
- Added a small visual-only owned decoration canvas for a soft moving highlight.
  It has no labels, IDs, controls, forms, or events; DOM labels remain the only
  authoritative rendering and accessibility input.
- Replaced the cyan body wash with fixed neutral transmission. Source detail,
  refraction, directional highlight, and opposing occlusion remain visible in
  the same material across every scene.
- Retired the selected-to-track pixel-ratio gate. It had pushed the output
  toward a hard second pill and had already failed to predict owner judgment.
  Pixel probes now remain mechanical bounds only.

The first transplant integration was vetoed internally before owner review
because it over-bent the wide geometry and produced a hard inner oval. The
frozen integration uses anisotropic displacement for the `320 x 64` capsule,
one outer meniscus, and a soft internal selection field.

## Mechanical evidence

| Gate | Result |
| --- | --- |
| Focused map/provenance contract | 5/5 unit tests pass |
| Playground TypeScript | Pass |
| Next.js 16.2.3 optimized build | Pass; `/optical-kernel` statically prerendered |
| Development browser matrix | 27/27 across Chromium, Firefox, and Playwright WebKit |
| Production browser matrix | 27/27 across Chromium, Firefox, and Playwright WebKit |
| Real component size | `320 x 64` at 1280×720 and 390×844 |
| Separate maps | Two map renders for every composite frame |
| Idle scheduling | Frame, map-render, and upload counts stop after settlement |
| Source switching | Four scenes retain one renderer and unchanged material constants |
| Semantic control | Click, arrows, Home, End, focus, and selected state pass |
| Reduced motion | Selection snaps with zero velocity |
| Failure handling | WebGL2 failure and context loss preserve controls and expose reasons |
| CSS success-path finish | No material background, backdrop filter, border, or shadow |
| Pixel sanity bounds | Interior changes, perimeter remains bounded, outside remains unchanged |
| Lint | Zero errors; two unrelated historical `<img>` warnings |

These checks establish determinism, lifecycle, semantics, fallback, and
bounded rendering. They do not establish aesthetic acceptance.

## Owner review evidence

Generated evidence is ignored by Git and lives under
`.gstack/evidence/optical-kernel/`:

- full 1280×720 captures for the reference, architecture, color, and dark scenes;
- compact 390×844 captures;
- rest, departure, travel, and settled motion samples; and
- `review/reference-vs-transplant-real-size.png`, with the supplied reference
  and transplant control side by side at the same authored scale.

The reference is user-provided external evidence and is not copied into the
distributable package.

## Boundaries still open

- Owner visual acceptance is not inferred or recorded.
- Physical iPhone/iPad and native Safari performance are not tested.
- The proof remains one Canvas 2D scene plus one visual-only decoration source;
  public owned-decoration and explicit-media adapters remain frozen.
- Context restoration fails closed and requires remount.
- Material values remain private candidate constants, not a public schema.
- The three-option segmented control is the only authorized geometry.

## Next decision

The only next decision is owner review of the live/full-scale transplant. If it
is accepted, component extraction may begin from the validated foundation. If
it is rejected, record a product `NO-GO`; do not begin another shader or
renderer direction.
