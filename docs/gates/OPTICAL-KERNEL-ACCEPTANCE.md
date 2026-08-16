# Optical Kernel Acceptance Gate

Status: revised after reference-video review on 2026-08-16. The first implementation passed its mechanical checks but failed owner visual review because its body was too close to the untouched source and its strict outside-pixel rule prohibited grounded optical separation.

## Purpose

Prove that Glaze can render a small interactive control as a transparent, refractive, responsive lens on the web. This is a renderer gate, not a library API, workbench, documentation, or release gate.

The experiment lives at `/optical-kernel`. It is intentionally one component with a small set of owned-source scenes so that source capture, optical geometry, interaction, and semantic HTML can be evaluated without arbitrary-DOM capture complexity or per-background material tuning.

## Reference-derived requirements

- Refraction/displacement is the material. Blur, tint, borders, shadows, and gradients cannot substitute for visible bending of the source.
- Optical mass must be legible across the full `320 x 64` body at rest. A viewer must not need to hunt for the curved edge to discover the material.
- The silhouette may produce a narrow renderer-native contact shadow and caustic halo. These are consequences of the same material field, not CSS finish, and must decay to transparent within a bounded region.
- The lens is a floating control layer. The content layer remains the visual subject.
- Interaction moves and energizes the lens with light; the resting state stays quieter.
- A selected segment is communicated by a lens that travels between options, not by a CSS-filled active pill.
- Semantic controls remain DOM elements above the rendered material.
- DialKit-like live parameter tuning is a later workflow layer. It is not part of this renderer gate and cannot make a failed material acceptable.

## Fixed experiment

- Four switchable, component-owned Canvas 2D sources: the animated geometric reference plus same-origin architecture, bright-color, and dark high-contrast image fixtures. These provide materially different displacement and visibility probes.
- Background switching changes only the uploaded source pixels. Lens geometry, shader code, optical constants, selected segment, and renderer instance remain fixed.
- One shared transparent WebGL2 overlay.
- One real-size three-option segmented control: `320 x 64 CSS px` on desktop and `min(320px, viewport - 32px)` on compact screens.
- One coherent outer capsule plus a stronger moving selection deformation. The active region must remain part of the same volume rather than reading as a dark pill stacked on top of glass.
- Three semantic DOM buttons in a `radiogroup`, with keyboard selection and visible focus.

## Renderer success path

- Source pixels are explicitly uploaded to a WebGL texture owned by the component.
- Lens geometry is generated from a signed-distance field.
- The fragment shader derives thickness, surface normal, refraction offset, restrained channel separation, Fresnel rim, directional specular response, opposing-edge occlusion, and transmitted light.
- Pixels beyond the bounded optical halo are transparent. A narrow renderer-native contact shadow and caustic may extend outside the geometric body.
- The glass surface uses no CSS `backdrop-filter`, background fill/gradient, border, or box shadow on the WebGL success path.
- Pointer position affects lighting. Selection motion changes optical geometry rather than cross-fading a CSS decoration.

## Fallback contract

When WebGL2 is unavailable, initialization fails, or the context is lost, semantic controls remain usable and an explicit CSS fallback is shown. The fallback may use a solid/translucent treatment, but it must expose `data-renderer="fallback"` and a readable reason. It is not accepted as optical proof.

## Pass/fail checks

At both `1280 x 720` and `390 x 844`, without zooming or cropping:

1. Background lines and rings visibly change direction or position across the full lens body, with stronger bending at its curved edges.
2. The material silhouette is immediately legible at `320 x 64` because full-volume transmission, a coherent bright rim, opposing-edge occlusion, and a narrow contact shadow/caustic agree. It must not rely on a continuous drawn outline.
3. The selected deformation is dimensional but remains optically continuous with the outer capsule; it must not read as a dark or opaque pill stacked on top.
4. Source detail remains visible through the control. Blur is not the dominant cue.
5. The lens remains legible over both bright and dark moving source regions without turning milky or opaque.
6. Clicking or using arrow keys produces visibly elastic geometry: stretch, edge-lobe deformation, and settling must be apparent across at least three motion samples rather than translating a rigid capsule.
7. Pixels farther than `14 CSS px` from the material silhouette remain visually unchanged.
8. DOM labels stay crisp and authoritative above the renderer during rest and motion.
9. The control fits the viewport, DOM labels remain readable, and focus is visible.
10. WebGL failure leaves a usable, truthfully labelled fallback.
11. There are no uncaught page errors, failed shader compilation, or leaked animation loops after unmount.
12. Switching among all four sources preserves the WebGL renderer, selected optical mode, frame/upload progression, and fixed material shader.

## Stop rule

Do not design the public package schema, add a parameter panel, generalize arbitrary-DOM capture, publish, merge, or claim renderer readiness until this real-size gate has passed visual inspection. Automated checks establish mechanics only; they do not overrule a visual rejection.

## Sources

- Apple, “Meet Liquid Glass” (WWDC25): dynamic lensing, adaptive lighting and separation, interaction energy, restrained use in the control/navigation layer.
- Aave, “Building Glass for the Web”: displacement as the core technique; semantic content above the effect; a moving glass selection indicator; shared WebGL renderer for live video.
- Josh Puckett, DialKit: installable, typed, live parameter tuning and preset/export workflow to consider only after the renderer is accepted.
