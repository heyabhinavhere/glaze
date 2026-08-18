# Glaze recovery ledger

Date: 2026-08-18

Active branch: `aj/glaze-optics-recovery`

Active gate: optical kernel candidate 1, revision 1

Owner visual decision: **REVISION 1 PENDING**

## Product promise

Glaze is a React and Next.js component system for semantic controls with
liquid-glass optics over explicitly owned visual sources. A later in-app
developer workbench will tune and export the exact material used by those
components.

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

## Current candidate

The owner rejected `glaze-optical-map-r1` on 2026-08-18 because the material,
especially the moving selection lens, was almost invisible at real size. The
runtime and renderer were healthy. Pixel and shader inspection showed that
the track and selection used nearly identical transmission while highlight
and occlusion energy were restricted to a narrow edge.

`glaze-optical-map-r2` is bounded revision 1. It renders one `320 x 64`
segmented control from one owned
Canvas 2D source. It generates two deterministic GPU maps:

1. a stable track map; and
2. one continuous moving selection map.

Each map stores horizontal displacement, vertical displacement, thickness,
and coverage. The composite pass samples the same source through both maps,
derives lighting from thickness gradients, emits premultiplied output, and
keeps semantic DOM labels above the optical layer.

This candidate removes the rejected `max()`-merged height field, leading and
trailing SDF lobes, adaptive gray volume wash, scene-specific values, and
continuous render loop. A directional renderer-native rim is permitted; a
uniform border, double contour, CSS glow, and neon halo are not.

Revision 1 keeps one material and makes the geometry legible through optical
signals: the stable track is thinner, the selected lens is thicker, source
displacement increases with that thickness, normals drive a broader
directional Fresnel response, and colored absorption replaces gray opacity.
The values are unchanged across all four scenes.

## Gate authority

- Automated checks can reject broken mechanics. They cannot accept visual
  quality.
- Full-viewport, 1x, real-size evidence is primary. Crops and pixel metrics
  are supporting diagnostics only.
- Only an explicit owner decision can change `Owner visual decision` to
  `ACCEPTED`.
- “Better”, “improved”, passing tests, or an agent/orchestrator judgment do not
  unlock component extraction.

## Frozen work

Until the owner accepts the optical kernel, do not:

- change the public material schema;
- build or expand the workbench;
- add switch, slider, video, or DOM-source adapters;
- publish, deploy, merge, or reopen a release PR; or
- restore arbitrary DOM capture, `html2canvas`, automatic source detection,
  or CSS glassmorphism as the primary renderer.

## Stop rule

Candidate 1 has used one of at most two bounded owner-directed revisions. If
revision 1 fails, one final diagnosed revision remains. If that also fails,
stop changing this shader. The only remaining experiment is a
license-verified, math-only displacement transplant behind Glaze's semantic
and lifecycle layer. If that also fails owner review, record a product
`NO-GO`; do not retreat to decorative CSS or widen the capture problem.

## Verification commands

```bash
corepack pnpm test:optical-kernel:unit
corepack pnpm test:optical-kernel
corepack pnpm test:optical-kernel:production
corepack pnpm --filter playground typecheck
corepack pnpm --filter playground lint
corepack pnpm --filter playground build
```
