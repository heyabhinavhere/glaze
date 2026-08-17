# Optical Kernel Gate Report

Date: 2026-08-17

Branch: `aj/glaze-optical-kernel`

Route: `/optical-kernel`

## Verdict

**REVISION 3 CANDIDATE. OWNER VISUAL ACCEPTANCE IS PENDING; PRODUCT/RELEASE GO IS WITHHELD.**

The 2026-08-15 candidate passed its mechanical suite but was visually rejected: the outer body stayed too close to the untouched source, the selected region read as an isolated glossy blob, and rigid-translation motion lacked the reference's elastic continuity. Revision 2 was then visually rejected on 2026-08-17 because its body remained weak while bright double contours dominated detailed, bright, and dark sources. The earlier `KERNEL PASS` verdict and Revision 2 candidate are superseded.

The contour had two concrete causes. First, the shader intentionally concentrated Fresnel/specular energy into continuous outer and active edge bands. Second, the WebGL context used premultiplied-alpha compositing while the fragment shader emitted unpremultiplied RGB, so antialiased edge pixels added full source color on top of the page. Revision 3 removes both edge bands and all external halo pixels, premultiplies RGB by coverage, and makes the body legible through spherical thickness, interior refraction, source-adaptive transmission, and directional surface response. The active selection is a raised region within the shared volume, not a separately outlined pill.

The review route now includes a four-source matrix: animated reference geometry, detailed architecture, bright ribbed color, and a dark highlight scene. The same renderer instance and shader remain active while only the same-origin Canvas 2D source pixels change. This makes bright/dark/detail robustness directly inspectable without background-specific optical tuning.

This verdict is intentionally narrow. It proves the owned-source optical kernel and fallback contract. It does not prove arbitrary DOM capture, video sources, a stable public package API, a DialKit-style workbench, device performance, or release readiness.

## Acceptance results

| Gate | Result | Evidence |
| --- | --- | --- |
| Visible source displacement | Candidate | Rings, bands, and type change position across the full body; final perceptual sufficiency remains an owner decision. |
| Not blur-led | Pass | The shader has no blur path; refraction is driven by SDF height gradients and displaced texture sampling. |
| Multiple coherent optical cues | Candidate | Spherical thickness, full-volume splay, normal-derived refraction, restrained active-region channel separation, directional reflection, opposing-edge occlusion, and source-adaptive transmission are combined in one shader. |
| No continuous perimeter | Pass mechanically | Source-versus-composite probes reject a weak body, high mean perimeter delta, a high fraction of bright perimeter samples, or any material change outside the capsule on architecture, bright-color, and dark fixtures. Visual sufficiency remains an owner decision. |
| Real component scale | Pass | Browser-measured control rect is exactly `320 x 64 CSS px` at `1280 x 720`; compact width remains `320 x 64` with safe margins at `390 x 844`. |
| Dynamic response | Candidate | Selection position uses a damped spring; velocity stretches and reshapes leading/trailing SDF lobes; pointer position and interaction energy alter geometry, light, and refraction. Rest, departure, travel, and settled frames are captured in the browser evidence. |
| Semantic DOM | Pass | Three DOM radio buttons remain authoritative, keyboard-operable, focusable, and layered above the WebGL canvas. |
| No CSS material on success path | Pass | Browser assertions confirm the control and buttons have transparent backgrounds, zero borders, no box shadow, and no backdrop filter. |
| Cross-browser mechanics | Pass | Chromium, Firefox, and WebKit activate WebGL, preserve authored desktop/compact geometry, advance source/output frames, exercise rest/departure/travel/settled states, and retain semantic/fallback behavior. |
| Multi-source robustness harness | Pass | Four accessible source choices switch same-origin pixels while the material shader, selected mode, and renderer instance remain fixed; every source is captured in each browser run. Visual quality still requires owner review. |
| Truthful failure handling | Pass | Both WebGL2 initialization failure and context loss expose `data-renderer="fallback"`, preserve semantics, and report a reason. |
| Production build | Pass | Next.js 16.2.3 production build completed and the static `/optical-kernel` route loaded without browser warnings, errors, or development overlays. |

## Verification run

- `corepack pnpm build` — pass
- `corepack pnpm typecheck` — pass
- `corepack pnpm lint` — pass with two unrelated pre-existing `<img>` warnings outside this route
- `corepack pnpm test:optical-kernel:unit` — 3/3 pass
- Focused Chromium browser checks and reference-derived motion capture — pass
- `corepack pnpm test:optical-kernel` — 27/27 pass across Chromium, Firefox, and WebKit, including the four-source matrix, source-versus-composite pixel gate, and reduced motion
- `corepack pnpm test:optical-kernel:production` — 27/27 pass against the optimized Next.js server across Chromium, Firefox, and WebKit
- Owner review at `1280 x 720` and `390 x 844` — pending

## Architecture proven

```text
switchable owned Canvas 2D sources
        |
        | texture upload each visible frame
        v
one transparent WebGL2 canvas
        |
        | SDF height field + displaced sampling + lighting
        v
coherent outer volume + moving selection deformation
        |
        | premultiplied antialiased coverage
        | transparent pixels outside the body
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
- The existing image fixtures are suitable for this internal preview; their provenance/license must be resolved before any public distribution that bundles them.
- The existing CSS-first V1 remains the fallback/release baseline and must not be represented as this renderer.

## Next gate after owner visual acceptance

1. Extract this kernel behind an internal explicit-source renderer interface without widening to arbitrary DOM.
2. Add a video-texture adapter and physical Safari performance evidence.
3. Only then build the DialKit-like typed tuning workflow: inferred controls, nested optical groups, live presets, JSON export/import, and copyable React/Next.js output.
4. Freeze the public API only after at least two source types and three component shapes use the same renderer without bespoke shader forks.
