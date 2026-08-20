# Optical kernel acceptance gate

Date: 2026-08-20

Status: final math-only transplant; owner visual acceptance pending

## Purpose

Prove that Glaze can render one small semantic control as a clear, refractive,
responsive lens over explicitly owned pixels. This is a renderer gate, not a
public API, component catalogue, workbench, documentation-polish, or release
gate.

## Fixed experiment

- Route: `/optical-kernel`.
- Control: one three-option `320 x 64` DOM radiogroup.
- Sources: generated high-frequency reference, architecture, bright color,
  and dark/high-contrast fixtures.
- Renderer: one transparent WebGL2 output sampling one owned Canvas 2D scene
  plus one small visual-only decoration texture.
- Material: unchanged across every source and selected state.
- Geometry: one stable outer body plus one separate, continuous moving
  selection field blended by thickness. No SDF-lobe union, inner rim, or opaque
  selected pill.
- Motion: a damped spring may stretch/skew the single selection surface. The
  renderer stops requesting frames after the spring settles.

## Optical-map contract

Both the stable track and selection maps are deterministic RGBA textures:

- R: horizontal source displacement;
- G: vertical source displacement;
- B: thickness; and
- A: coverage.

The composite pass samples the same base source through both maps and derives
surface normals from thickness gradients. The selection additionally samples
the visual-only owned decoration; it contains no labels or interactive content.
The outer map supplies the only visible meniscus. Normals drive visible
refraction, restrained dispersion, directional highlight, and opposing
occlusion.

The renderer may produce one thin, directional rim where the surface normal
and light agree. It may not draw a uniform perimeter, double contour, neon
halo, CSS border, gradient, mask, backdrop filter, or box shadow on the WebGL
success path. Source detail must remain recognizable; a gray/milky wash is a
failure.

Partially covered output uses premultiplied RGB. Pixels outside both map
coverages remain transparent.

## Semantic and fallback contract

The three buttons remain the only interactive and assistive-technology-visible
tree. Labels are not copied into source pixels. Arrow keys, Home, End, click,
focus, and selected state work independently of WebGL.

WebGL2 initialization failure or context loss exposes
`data-renderer="fallback"`, a readable reason, and a usable semantic control.
The fallback is legible but makes no optical claim.

## Mechanical vetoes

At `1280 x 720` and `390 x 844`:

1. The control measures `320 x 64`, remains inside the viewport, and keeps
   crisp DOM labels above the renderer.
2. All four sources use the same map contract and shader programs.
3. Track and selection maps render separately; map renders equal two per
   composite frame.
4. Static sources stop uploading, and composite/map frame counts stop changing
   once the spring settles.
5. Reduced motion snaps selection with zero velocity.
6. WebGL initialization and context-loss failure preserve semantics and expose
   explicit reasons.
7. The success path has no CSS material finish.
8. Source-versus-composite probes cover every selected position on all four
   fixtures. They require mean interior change greater than `12` and non-empty
   refracted output in every selected region. Mean perimeter change must remain
   below `34`, fewer than `55%` of perimeter samples may reach channel-mean
   delta `28`, and mean outside change must remain below `0.75`. No pixel ratio
   is allowed to grant or steer aesthetic acceptance.
9. There are no uncaught page errors, failed shaders/framebuffers, or leaked
   animation loops.

These checks may reject mechanics. Passing them does not accept the material.

## Owner visual gate

Primary evidence is a full viewport at 1x plus a same-scale reference. A
real-size crop and motion frames are supporting evidence only.

The candidate passes only when the owner explicitly accepts all of the
following:

- refraction and local magnification are obvious at actual size;
- the material has clear volume without a smoky overlay;
- source detail survives light, dark, quiet, noisy, and photographic scenes;
- highlight and opposing occlusion describe one coherent surface;
- there is no uniform neon or double outline;
- the active lens remains one body during travel; and
- the unchanged material works across every source.

“Better”, “improved”, passing tests, or agent approval do not count.

## Stop rule

Do not change the public schema, add source adapters/components, build the
workbench, publish, deploy, merge, or reopen a release PR before owner visual
acceptance.

The hand-tuned candidate used both bounded owner-directed revisions and failed.
This final math-only transplant is the only remaining candidate. If it fails
owner review, record a product `NO-GO`; do not start another shader direction.
