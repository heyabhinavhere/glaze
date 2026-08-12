# Glaze rendering reframe

Date: 2026-08-12
Decision source: M1.1 Stage B NO-GO
Status: architecture gate; Milestone 2 is not started or authorized

## Decision

Glaze has explicit capability tiers. It does not promise one renderer, one pixel result, or one physical material across WebGL and browser backdrop composition.

The accepted high-fidelity path is the M1.1 Stage A WebGL material for explicit image, video, and canvas sources that Glaze owns. Semantic DOM remains real DOM above or beside that visual layer. A future browser-native backdrop path may be researched under a separate contract and visibly different fidelity claim. It must never be called the same renderer or a parity implementation.

## Capability matrix

| Capability | Input and ownership | Rendering contract | Semantic content | Support and fallback | Fidelity claim |
|---|---|---|---|---|---|
| Explicit-source WebGL | An origin-clean image, video, or canvas supplied explicitly and owned for sampling by the component | Accepted `m1.1-continuous-capsule-lighting-r1` field with private `m1-transport-controls` material | Controls and labels remain ordinary DOM overlays; WebGL never owns their semantics | Requires WebGL2 and an uploadable source; context loss, unsupported hardware, or unsafe source falls back explicitly | High-fidelity Glaze reference for this source class only |
| Semantic DOM overlay | Application-owned HTML controls and content | No optical rendering; normal browser layout and paint | Fully selectable, focusable, interactive, and assistive-technology visible | Works wherever the application DOM works | No glass or refraction claim |
| Future CSS/backdrop capability | Browser-composited pixels behind a declared element boundary; no copied or captured DOM | Separate browser-native backdrop/CSS contract with its own support matrix and values | Real DOM remains real DOM | Must feature-detect, disclose unsupported states, and choose an explicit fallback | Browser-native backdrop effect; never WebGL parity or the same material |
| Accessibility and unsupported fallback | No sampled source required | Opaque or translucent legible CSS surface with no refraction claim | Full semantic DOM | Used for forced colors, reduced transparency, unavailable/lost WebGL, unsafe sources, and explicit developer fallback | Legibility and state continuity only |

## Source ownership, security, and privacy

- WebGL accepts only an explicit `HTMLImageElement`, `HTMLVideoElement`, or `HTMLCanvasElement` source boundary that the component is authorized to sample. It never discovers page content automatically.
- The source must be origin-clean. A failed or security-restricted texture upload becomes an explicit fallback reason; it is never hidden as a successful glass renderer.
- Glaze does not inspect, serialize, duplicate, rasterize, screenshot, or transmit arbitrary DOM. `html2canvas`, screenshot textures, hidden duplicate substrates, and automatic page capture are prohibited.
- Semantic controls and sensitive text remain in the application DOM and are not copied into renderer buffers. Applications retain responsibility for media authorization, CORS configuration, provenance, and disposal.

## React and Next.js consumption

The route or product shell remains a Server Component where possible. The interactive renderer is a narrow Client Component receiving serializable private configuration and explicit source ownership. Browser APIs, observers, WebGL context creation, media callbacks, and teardown run only after hydration in effects.

Server output must contain the semantic control and an honest fallback state. Hydration may replace only the decorative visual layer after capability and source checks; it must not replace, duplicate, or reorder the semantic control. A renderer failure after hydration returns to the same explicit fallback without losing focus or control state.

This M1 research material is not a frozen public React API or schema. Any future wrapper must preserve the explicit-source boundary rather than infer or capture surrounding content.

## Accessibility behavior

- Controls use native DOM semantics, keyboard behavior, focus, names, and state independently of the visual renderer.
- Reduced motion keeps the semantic interaction but removes nonessential geometry motion and continuous animation; renderer work remains demand-driven.
- Reduced transparency and forced colors expose a legible CSS surface and hide decorative renderer output. They do not pretend to preserve optical fidelity.
- Renderer loss, unsupported hardware, or unsafe media cannot make text, controls, or status disappear.
- Contrast and target-size requirements belong to the semantic overlay and are tested independently of the sampled source.

## Performance and lifecycle responsibilities

- Static and paused sources render only until settled. Video uses presented-frame callbacks when available and uploads only changed frames.
- Rendering pauses when hidden or offscreen. Interaction schedules bounded redraws rather than creating a permanent animation loop.
- Output resolution follows element size, caps device pixel ratio at 2, and recovers from zero-size and resize transitions.
- Every renderer owns and releases its textures, buffers, programs, observers, media callbacks, event listeners, and context-loss handlers.
- Context loss and upload failures are observable and transition to the explicit fallback. No blank or silent renderer is an acceptable state.
- Performance evidence is recorded by engine and environment; Playwright WebKit is automation evidence, not a Safari or iOS support claim.

## What may be shared

The workbench may share semantic intent: geometry role, clarity/frost intent, tint intent, light direction, interaction energy, accessibility policy, and named quality levels. It may also share test vocabulary and units when engines implement those meanings honestly.

Renderer implementation values, compositing equations, sampling constraints, rasterization, and support behavior are capability-specific. A CSS/backdrop implementation may therefore require its own validated parameterization. The UI must expose that difference instead of silently mapping one renderer's constants onto another or claiming pixel/material identity.

## DialKit-like workflow implications

A future developer workbench may preview one semantic material model across the capabilities that are actually available, but every preview must show:

- the active capability and exact source class;
- whether the result is WebGL reference, browser-native backdrop, or fallback;
- unsupported and accessibility states;
- capability-specific controls that cannot honestly be shared; and
- measured lifecycle, source-ownership, and visual evidence for the chosen target.

The workbench cannot imply that a CSS/backdrop preview proves WebGL output, or that WebGL over an explicit texture proves arbitrary DOM backdrop behavior. It is a diagnostic/tuning surface, not an abstraction that erases browser composition boundaries.

## Rejected alternatives

- Same-material owned-DOM SVG parity: rejected because `SourceGraphic` does not expose already-composited backdrop pixels. The honest candidate became an opaque outlined slab and pinched high-frequency content.
- Renderer-specific SVG retuning: rejected because it would falsely preserve a shared-material claim and would not solve the missing backdrop input.
- Shared retuning after Stage A acceptance: rejected because it would regress or reopen the locked WebGL result.
- CSS borders, lighting gradients, inset strokes, decorative masks, or continuous perimeters on the WebGL success path: rejected because they draw the material instead of deriving it from renderer light.
- Arbitrary DOM capture, `html2canvas`, screenshot textures, hidden duplicated substrates, and non-portable SVG background inputs: rejected for ownership, privacy, performance, lifecycle, and honesty reasons.
- Silent renderer substitution: rejected because it conceals capability and fidelity differences from developers and users.

## Exact Milestone 2 entry contract

Milestone 2 may begin only after the owner explicitly accepts this reframe and authorizes one capability-scoped implementation slice. Entry requires all of the following:

1. The requested slice names exactly one source class and capability: explicit-source WebGL, semantic overlay, future browser-native backdrop research, or fallback.
2. Its public promise does not claim WebGL/DOM/backdrop parity, automatic DOM capture, or a frozen cross-renderer material schema.
3. The accepted Stage A WebGL reference, its 27 snapshot baselines, field contract, material ID, lifecycle behavior, and artifact pack remain locked.
4. The API design makes source ownership, origin cleanliness, capability detection, fallback reason, SSR output, hydration, accessibility behavior, and cleanup explicit.
5. Test gates cover deterministic renderer inputs, computed-style boundaries, semantic keyboard/accessibility behavior, reduced motion/transparency, forced colors, SSR/hydration, context loss, resize/DPR, idle scheduling, cleanup, source security failure, and production build behavior.
6. Evidence gates include development and built-production runs in Chromium, Firefox, and Playwright WebKit; original-resolution visual review; hashes for immutable baselines and candidate artifacts; and qualified statements for real Safari/iOS coverage.
7. Any future backdrop research starts with a browser capability/support proof and a separately named visual contract. It cannot inherit WebGL acceptance.

The next authorized gate is owner/orchestrator review of this architecture and M2 entry contract. M2 implementation, the workbench, public schema freeze, framework wrappers, legacy Mode C changes, dependency installation, publication, deployment, push, and pull request creation remain non-goals until that gate is explicitly passed.
