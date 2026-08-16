# Optical Kernel Gate Report

Date: 2026-08-16

Branch: `aj/glaze-optical-kernel`

Route: `/optical-kernel`

## Verdict

**REVISION 2 CANDIDATE. OWNER VISUAL ACCEPTANCE IS PENDING; PRODUCT/RELEASE GO IS WITHHELD.**

The 2026-08-15 candidate passed its mechanical suite but was visually rejected: the outer body stayed too close to the untouched source, the selected region read as an isolated glossy blob, and rigid-translation motion lacked the reference's elastic continuity. The earlier `KERNEL PASS` verdict is superseded.

Revision 2 is tuned from the owner's supplied `342 x 65` reference and 14.658-second motion recording. The real-size control now applies refraction and adaptive transmission across the full outer volume, retains a stronger selection deformation without an opaque fill, produces a narrow renderer-native contact shadow/caustic, and deforms its signed-distance geometry from spring velocity. This is a candidate for owner review, not a self-declared visual pass.

This verdict is intentionally narrow. It proves the owned-source optical kernel and fallback contract. It does not prove arbitrary DOM capture, video sources, a stable public package API, a DialKit-style workbench, device performance, or release readiness.

## Acceptance results

| Gate | Result | Evidence |
| --- | --- | --- |
| Visible source displacement | Candidate | Rings, bands, and type change position across the full body; final perceptual sufficiency remains an owner decision. |
| Not blur-led | Pass | The shader has no blur path; refraction is driven by SDF height gradients and displaced texture sampling. |
| Multiple coherent optical cues | Candidate | Thickness, full-volume splay, optical scattering, normal-derived refraction, restrained channel separation, Fresnel, directional specular, opposing-edge occlusion, adaptive transmission, and a bounded renderer-native halo are combined in one shader. |
| Real component scale | Pass | Browser-measured control rect is exactly `320 x 64 CSS px` at `1280 x 720`; compact width remains `320 x 64` with safe margins at `390 x 844`. |
| Dynamic response | Candidate | Selection position uses a damped spring; velocity stretches and reshapes leading/trailing SDF lobes; pointer position and interaction energy alter geometry, light, and refraction. Rest, departure, travel, and settled frames are captured in the browser evidence. |
| Semantic DOM | Pass | Three DOM radio buttons remain authoritative, keyboard-operable, focusable, and layered above the WebGL canvas. |
| No CSS material on success path | Pass | Browser assertions confirm the control and buttons have transparent backgrounds, zero borders, no box shadow, and no backdrop filter. |
| Cross-browser mechanics | Pass | Chromium, Firefox, and WebKit activate WebGL, preserve authored desktop/compact geometry, advance source/output frames, exercise rest/departure/travel/settled states, and retain semantic/fallback behavior. |
| Truthful failure handling | Pass | Both WebGL2 initialization failure and context loss expose `data-renderer="fallback"`, preserve semantics, and report a reason. |
| Production build | Pass | Next.js 16.2.3 production build completed and the static `/optical-kernel` route loaded without browser warnings, errors, or development overlays. |

## Verification run

- `corepack pnpm --filter playground build` — pass
- `corepack pnpm --filter playground typecheck` — pass
- `corepack pnpm --filter playground lint` — pass with two unrelated pre-existing `<img>` warnings outside this route
- `corepack pnpm test:optical-kernel:unit` — 3/3 pass
- Focused Chromium browser checks and reference-derived motion capture — pass
- `corepack pnpm test:optical-kernel` — 21/21 pass across Chromium, Firefox, and WebKit, including reduced motion
- `corepack pnpm test:optical-kernel:production` — 21/21 pass against the optimized Next.js server across Chromium, Firefox, and WebKit
- Owner review at `1280 x 720` and `390 x 844` — pending

## Architecture proven

```text
owned Canvas 2D source
        |
        | texture upload each visible frame
        v
one transparent WebGL2 canvas
        |
        | SDF height field + displaced sampling + lighting
        v
coherent outer volume + moving selection deformation
        |
        | bounded GPU contact shadow / caustic
        | transparent pixels beyond 14 CSS px
        v
semantic DOM radiogroup above the renderer
```

The public success path no longer depends on browser backdrop capture or arbitrary-DOM rasterization. That limitation is deliberate: source ownership makes the optical truth and performance model testable before capture adapters are introduced.

## Remaining boundaries

- Physical iPhone/iPad Safari and lower-power GPU performance are not verified.
- Reduced Transparency and Increased Contrast need a formal material variant; Reduced Motion is implemented for source and spring motion.
- Context restoration currently fails closed and requires remount instead of rebuilding GPU resources in place.
- The source adapter is Canvas 2D only. Video and other explicit GPU-safe sources remain separate milestones.
- The current shader values are internal experimental constants, not a frozen public schema.
- The existing CSS-first V1 remains the fallback/release baseline and must not be represented as this renderer.

## Next gate after owner visual acceptance

1. Extract this kernel behind an internal explicit-source renderer interface without widening to arbitrary DOM.
2. Add a video-texture adapter and physical Safari performance evidence.
3. Only then build the DialKit-like typed tuning workflow: inferred controls, nested optical groups, live presets, JSON export/import, and copyable React/Next.js output.
4. Freeze the public API only after at least two source types and three component shapes use the same renderer without bespoke shader forks.
