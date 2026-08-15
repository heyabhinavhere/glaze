# Optical Kernel Gate Report

Date: 2026-08-15

Branch: `aj/glaze-optical-kernel`

Route: `/optical-kernel`

## Verdict

**KERNEL PASS. PRODUCT/RELEASE GO IS STILL WITHHELD.**

The real-size control now reads as a refractive lens rather than CSS glassmorphism. Grid lines, concentric rings, color bands, and large type are visibly displaced through the quiet outer capsule and the stronger selection lens. Selection motion is spring-driven and velocity stretches the optical geometry. Pointer interaction energizes renderer-native lighting.

This verdict is intentionally narrow. It proves the owned-source optical kernel and fallback contract. It does not prove arbitrary DOM capture, video sources, a stable public package API, a DialKit-style workbench, device performance, or release readiness.

## Acceptance results

| Gate | Result | Evidence |
| --- | --- | --- |
| Visible source displacement | Pass | Full-viewport production screenshots show rings, bands, and type changing position/direction through the lens. |
| Not blur-led | Pass | The shader has no blur path; refraction is driven by SDF height gradients and displaced texture sampling. |
| Multiple coherent optical cues | Pass | Thickness, normal-derived refraction, restrained channel separation, Fresnel, directional specular, opposing-edge occlusion, and transmitted light are combined in one shader. |
| Real component scale | Pass | Browser-measured control rect is exactly `320 x 64 CSS px` at `1280 x 720`; compact width remains `320 x 64` with safe margins at `390 x 844`. |
| Dynamic response | Pass | Selection position uses a damped spring; shader geometry stretches from selection velocity; pointer position and interaction energy alter light and refraction. |
| Semantic DOM | Pass | Three DOM radio buttons remain authoritative, keyboard-operable, focusable, and layered above the WebGL canvas. |
| No CSS material on success path | Pass | Browser assertions confirm the control and buttons have transparent backgrounds, zero borders, no box shadow, and no backdrop filter. |
| Cross-browser mechanics | Pass | Chromium, Firefox, and WebKit all activate WebGL, render desktop/compact layouts, advance source/output frames, and pass interaction checks. |
| Truthful failure handling | Pass | Both WebGL2 initialization failure and context loss expose `data-renderer="fallback"`, preserve semantics, and report a reason. |
| Production build | Pass | Next.js 16.2.3 production build completed and the static `/optical-kernel` route loaded without browser warnings, errors, or development overlays. |

## Verification run

- `corepack pnpm --filter playground build` — pass
- `corepack pnpm --filter playground typecheck` — pass
- `corepack pnpm --filter playground lint` — pass with two unrelated pre-existing `<img>` warnings outside this route
- `corepack pnpm test:optical-kernel:unit` — 3/3 pass
- `corepack pnpm test:optical-kernel` against the production server — 18/18 pass across Chromium, Firefox, and WebKit
- Human production review at `1280 x 720` and `390 x 844` — kernel pass

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
quiet outer capsule + moving selection lens
        |
        | transparent pixels outside the material
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

## Next gate after visual acceptance

1. Extract this kernel behind an internal explicit-source renderer interface without widening to arbitrary DOM.
2. Add a video-texture adapter and physical Safari performance evidence.
3. Only then build the DialKit-like typed tuning workflow: inferred controls, nested optical groups, live presets, JSON export/import, and copyable React/Next.js output.
4. Freeze the public API only after at least two source types and three component shapes use the same renderer without bespoke shader forks.
