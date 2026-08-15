# Optical Kernel Acceptance Gate

Status: locked before implementation. This gate replaces visual progress-by-assertion with a real-size, inspectable optical proof.

## Purpose

Prove that Glaze can render a small interactive control as a transparent, refractive, responsive lens on the web. This is a renderer gate, not a library API, workbench, documentation, or release gate.

The experiment lives at `/optical-kernel`. It is intentionally one component in one owned scene so that source capture, optical geometry, interaction, and semantic HTML can be evaluated without arbitrary-DOM capture complexity.

## Reference-derived requirements

- Refraction/displacement is the material. Blur, tint, borders, shadows, and gradients cannot substitute for visible bending of the source.
- The lens is a floating control layer. The content layer remains the visual subject.
- Interaction moves and energizes the lens with light; the resting state stays quieter.
- A selected segment is communicated by a lens that travels between options, not by a CSS-filled active pill.
- Semantic controls remain DOM elements above the rendered material.
- DialKit-like live parameter tuning is a later workflow layer. It is not part of this renderer gate and cannot make a failed material acceptable.

## Fixed experiment

- Full-viewport, component-owned animated Canvas 2D source with fine grid lines, rings, color fields, and typography-sized marks. These provide obvious displacement probes.
- One shared transparent WebGL2 overlay.
- One real-size three-option segmented control: `320 x 64 CSS px` on desktop and `min(320px, viewport - 32px)` on compact screens.
- A quiet outer capsule plus a stronger moving selection lens.
- Three semantic DOM buttons in a `radiogroup`, with keyboard selection and visible focus.

## Renderer success path

- Source pixels are explicitly uploaded to a WebGL texture owned by the component.
- Lens geometry is generated from a signed-distance field.
- The fragment shader derives thickness, surface normal, refraction offset, restrained channel separation, Fresnel rim, directional specular response, opposing-edge occlusion, and transmitted light.
- Pixels outside the lens are transparent.
- The glass surface uses no CSS `backdrop-filter`, background fill/gradient, border, or box shadow on the WebGL success path.
- Pointer position affects lighting. Selection motion changes optical geometry rather than cross-fading a CSS decoration.

## Fallback contract

When WebGL2 is unavailable, initialization fails, or the context is lost, semantic controls remain usable and an explicit CSS fallback is shown. The fallback may use a solid/translucent treatment, but it must expose `data-renderer="fallback"` and a readable reason. It is not accepted as optical proof.

## Pass/fail checks

At both `1280 x 720` and `390 x 844`, without zooming or cropping:

1. Background lines and rings visibly change direction or position through the lens, especially at its curved edges.
2. The selected lens is clearly dimensional because multiple optical cues agree; it must not read as a blurred translucent pill.
3. Source detail remains visible through the control. Blur is not the dominant cue.
4. The lens remains legible over both bright and dark moving source regions.
5. Clicking or using arrow keys moves the selection lens and produces a brief, restrained light response.
6. Outside-lens source pixels remain visually unchanged.
7. The control fits the viewport, DOM labels remain readable, and focus is visible.
8. WebGL failure leaves a usable, truthfully labelled fallback.
9. There are no uncaught page errors, failed shader compilation, or leaked animation loops after unmount.

## Stop rule

Do not design the public package schema, add a parameter panel, generalize arbitrary-DOM capture, publish, merge, or claim renderer readiness until this real-size gate has passed visual inspection. Automated checks establish mechanics only; they do not overrule a visual rejection.

## Sources

- Apple, “Meet Liquid Glass” (WWDC25): dynamic lensing, adaptive lighting and separation, interaction energy, restrained use in the control/navigation layer.
- Aave, “Building Glass for the Web”: displacement as the core technique; semantic content above the effect; a moving glass selection indicator; shared WebGL renderer for live video.
- Josh Puckett, DialKit: installable, typed, live parameter tuning and preset/export workflow to consider only after the renderer is accepted.
