# Optical kernel recovery report

Date: 2026-08-19

Branch: `aj/glaze-optics-recovery`

Route: `/optical-kernel`

Map contract: `glaze-optical-map-r3`

## Verdict

**RECOVERY CANDIDATE 1, REVISION 2. MECHANICS PASS. OWNER VISUAL ACCEPTANCE PENDING.**

Product, component extraction, public API, workbench, merge, deployment, and
release remain blocked.

This verdict does not reuse the withdrawn M1/M2 acceptance. Passing automation
is recorded only as mechanical evidence.

## What changed

### Revision 2 final visibility correction

- Recorded the owner's rejection of revision 1: despite improved metrics, the
  lens remained almost invisible at normal viewing size.
- Confirmed the runtime remained healthy and diagnosed the remaining problem:
  body visibility still depended on source detail and edge lighting.
- Increased thickness-driven source displacement while preserving one
  continuous selection shape.
- Added wavelength-biased absorption and broad environment transmission across
  the thickness field, making the lens visible over quiet and black pixels
  without adding a CSS fill, border, blur, or gray wash.
- Expanded pixel vetoes from one selected position to all three positions over
  every scene. Across Chromium, Firefox, and WebKit, selection-body deltas now
  range from `31.2` to `64.3` with selection-to-track ratios from `2.6x` to
  `7.6x`; outer-perimeter bright fractions remain at or below `28%`.

### Revision 1 visibility correction

- Recorded the owner's rejection of the first candidate: the moving lens was
  almost invisible at real size.
- Confirmed the renderer was healthy and isolated the cause to nearly equal
  track/selection transmission plus shading energy confined to the edge.
- Kept one material while making track and selection physically different
  thicknesses: a thin stable track and a thick selected lens.
- Increased thickness-driven refraction and magnification for the selected
  lens, broadened the directional normal response, and strengthened opposing
  occlusion.
- Replaced gray darkening with restrained wavelength-biased absorption so the
  material gains mass without hiding the source.
- Added source-versus-composite probes that separately measure track and
  selection visibility. Across all four scenes, the selected lens changes
  source pixels by `17.8` to `31.2` channel levels and is `2.0x` to `2.6x`
  stronger than the track. Outside pixels remain unchanged.

### Recovery foundation

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
| Pixel vetoes | Track, selection, perimeter, and outside thresholds pass in every browser |
| Lint | Zero errors; two unrelated historical `<img>` warnings |

These checks establish deterministic inputs, lifecycle, semantics, fallback,
and bounded rendering. They do not prove beauty.

## Owner review evidence

Generated evidence is ignored by Git and lives under
`.gstack/evidence/optical-kernel/`:

- full 1280×720 source-matrix captures for each browser;
- compact 390×844 captures;
- rest, departure, travel, and settled motion samples; and
- `review/reference-vs-candidate-real-size-r3.png`, with the supplied reference
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

The only next product decision is owner review of the live/full-scale final
revision. If rejected, stop modifying this shader and move to the math-only
transplant decision in `docs/RECOVERY.md`. Do not begin component extraction,
workbench work, or another renderer direction.
