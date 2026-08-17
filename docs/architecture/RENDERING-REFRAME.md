# Glaze rendering architecture

Date: 2026-08-17

Status: component-first boundary accepted; optical fidelity pending owner review

## Decision

Glaze renders liquid-glass components only over visual sources explicitly
owned by the component. Semantic controls remain authoritative DOM above the
decorative renderer.

Glaze does not inspect, infer, rasterize, screenshot, serialize, or transmit
arbitrary page DOM. Mode C, `html2canvas`, hidden duplicate substrates, and
automatic backdrop discovery are rejected product paths.

No earlier M1, M1.1, M2, CSS V1, or optical-kernel treatment is an accepted
visual reference. Their lifecycle, source, semantic, package, and testing work
may be reused only when it does not carry forward a rejected material claim.

## Current optical gate

The private `/optical-kernel` route owns one Canvas 2D source and produces two
deterministic displacement maps:

```text
owned source pixels
      |
      +--> stable track map --------+
      |                             |
      +--> moving selection map ----+--> one premultiplied WebGL composite
                                           |
                                           +--> semantic DOM labels above
```

Both maps use the same channel contract: R/G displacement, B thickness, A
coverage. Track and selection are separate surfaces; they are not joined with
a maximum-height union. The selection remains one continuous, velocity-shaped
lens rather than leading/trailing lobes.

The composite pass preserves source detail, derives normals and directional
lighting from thickness, allows one non-uniform optical rim, adds opposing
occlusion, and emits premultiplied RGB. It must not introduce a gray volume
wash, uniform outline, double contour, CSS glow, or scene-specific tuning.

## Capability boundary

| Capability | Input | Renderer | Semantic contract | Current status |
| --- | --- | --- | --- | --- |
| Optical kernel | Owned Canvas 2D fixture | Separate GPU track/selection maps | One DOM radiogroup above output | Candidate; owner decision pending |
| Owned decoration | Visual-only, inert React layer | Future SVG displacement adapter | No interactive or identified duplicate content | Frozen |
| Explicit media | Origin-clean image, video, or canvas | Future shared WebGL source with multiple lenses | Controls remain DOM | Frozen |
| CSS fallback | No sampleable source required | Legible non-optical CSS surface | Full semantics preserved | Retained |
| Arbitrary page backdrop | Surrounding live DOM | None | Unsupported | Rejected |

Unsupported, unsafe, forced-color, reduced-transparency, or context-loss states
must expose a reason and preserve the same semantic control. A fallback may
not be described as optical fidelity.

## React and Next.js boundary

Pages and layouts remain Server Components. The optical experiment is a
narrow Client Component because it owns state, events, Canvas, WebGL, browser
media queries, and teardown. Any later public material object must stay plain
and serializable. Renderer code must be lazy-loaded when the optical capability
is requested; the pure material entry must remain server-safe.

## Lifecycle requirements

- Static sources upload only when initially drawn, resized, or changed.
- Spring animation schedules bounded frames and stops when settled.
- Video will use presented-frame callbacks rather than a permanent RAF.
- DPR is capped at 2 and resize/zero-size transitions remain recoverable.
- Context loss and unsafe uploads fail closed to the semantic fallback.
- Every texture, framebuffer, buffer, program, observer, callback, and listener
  is released by its owner.

## Acceptance authority

Automation validates map contracts, source ownership, semantics, lifecycle,
fallback, bounds, and regression metrics. It cannot certify beauty. Only
explicit owner approval of full-viewport, real-size evidence can unlock source
adapters, component extraction, public API design, or workbench work.

The authoritative status and stop rule live in `docs/RECOVERY.md`.
