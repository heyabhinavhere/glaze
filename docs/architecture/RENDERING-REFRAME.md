# Glaze rendering architecture

Date: 2026-08-22

Status: component-first boundary and optical kernel accepted

## Decision

Glaze renders liquid-glass components only over visual sources explicitly
owned by the component. Semantic controls remain authoritative DOM above the
decorative renderer.

Glaze does not inspect, infer, rasterize, screenshot, serialize, or transmit
arbitrary page DOM. Mode C, `html2canvas`, hidden duplicate substrates, and
automatic backdrop discovery are rejected product paths.

No earlier M1, M1.1, M2, CSS V1, or hand-tuned optical-kernel treatment is an
accepted visual reference. The accepted exception is the final
`glaze-optical-map-transplant` at `afc7112`. Earlier lifecycle, source,
semantic, package, and testing work may be reused only when it does not carry
forward a rejected material claim.

## Accepted optical kernel

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
| Optical kernel | Owned Canvas 2D fixture | Separate GPU track/selection maps | One DOM radiogroup above output | Accepted 2026-08-22 |
| Owned decoration | Visual-only, inert React layer | Accepted kernel over owned pixels | No interactive or identified duplicate content | Public and verified |
| Explicit media | Origin-clean image, video, or canvas | Shared WebGL source with multiple lenses | Controls remain DOM | Public and verified |
| CSS fallback | No sampleable source required | Legible non-optical CSS surface | Full semantics preserved | Retained |
| Arbitrary page backdrop | Surrounding live DOM | None | Unsupported | Rejected |

Unsupported, unsafe, forced-color, reduced-transparency, or context-loss states
must expose a reason and preserve the same semantic control. A fallback may
not be described as optical fidelity.

## React and Next.js boundary

Pages and layouts remain Server Components. The public optical surfaces are
narrow Client Components because they own state, events, Canvas, WebGL,
browser media queries, and teardown. The material object is plain and
serializable. Renderer code is lazy-loaded only when an optical source is
requested; the pure material entry remains server-safe.

## Lifecycle requirements

- Static sources upload only when initially drawn, resized, or changed.
- Spring animation schedules bounded frames and stops when settled.
- Video will use presented-frame callbacks rather than a permanent RAF.
- DPR is capped at 2 and resize/zero-size transitions remain recoverable.
- Context loss fails closed to the semantic fallback and restoration creates a
  fresh renderer; unsafe uploads remain in the fallback with a visible reason.
- Image/video sources are origin-clean checked once per descriptor; subscribed
  canvas sources are checked on redraw. Replacing a tainted image/video clears
  the owned source canvas before repaint so a clean source can recover.
- Every texture, framebuffer, buffer, program, observer, callback, and listener
  is released by its owner.

## Acceptance authority

Automation validates map contracts, source ownership, semantics, lifecycle,
fallback, bounds, and regression metrics. It cannot certify beauty. The owner
explicitly accepted the live, full-scale kernel on 2026-08-22, unlocking source
adapters and component extraction. The unchanged material has since passed the
multi-component proof, frozen public API, exact-material workbench, and public
development/production browser matrices.

The authoritative status and stop rule live in `docs/RECOVERY.md`.
