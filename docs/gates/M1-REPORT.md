# Glaze Milestone 1 — Rendering Feasibility Verdict

Date: 2026-08-12
Baseline commit: `2bd4a5ac1fd01358cef885f8a3cf4aabc0f7ef03`
Checkpoint branch: `aj/glaze-m1-research-spike`

## Verdict

**MECHANICS PASS / VISUAL AND MATERIAL-LIGHTING BLOCKED: the private source-aware spike establishes useful determinism, lifecycle, fallback, and browser-automation evidence, but it has not proved Glaze's visual promise or a coherent renderer-native lighting model across SVG and WebGL. M1 is not accepted and Milestone 2 remains blocked.**

The current implementation is a preserved research checkpoint, not an approved material foundation. The owner accepted that it improved on the legacy baseline, but correctly rejected the remaining outlined appearance and the subsequent CSS-glow correction. The only permitted continuation is the bounded M1.1 renderer-native lighting proof defined below.

The experiment did not require arbitrary DOM capture, `html2canvas`, automatic source detection, renderer-specific material values, a workbench, package publication, or a public API change. One material and one deterministic RGBA displacement map power:

- SVG displacement over explicitly owned/duplicated DOM content.
- WebGL2 sampling from explicit canvas and video elements.
- A visible CSS fallback with a machine-readable reason.

The implementation remains private to the `/m1` Next.js route. It does not modify or legitimize the legacy `@glazelab/core` APIs.

## Baseline

The pre-change baseline is recorded in `.gstack/evidence/gate-1/baseline/baseline-manifest.json` against a clean checkout.

- `corepack pnpm lint`: exit 0, but core lint was and remains a placeholder; the playground has two pre-existing image warnings.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm build`: failed without network because the existing layout fetches Google Fonts; passed with network access.
- `/test`: labels rendered but the large and medium glass regions were not clearly distinguishable from the source.
- `/test-live`: headless Chrome produced a black capture except for DOM labels.
- `/test-mode-c`: Mode C pills did not visibly refract the high-frequency fixture.

Baseline screenshots and hashes are under `.gstack/evidence/gate-1/baseline/screenshots/`.

## Implemented vertical slice

`/m1` is a statically prerendered Next.js 16 route with a Server Component page and a narrow Client Component experiment. Its one 240×56 accessible transport control switches between explicit owned-DOM, canvas, video, and forced-fallback modes.

The provisional material is deliberately private and small:

- Schema version 1 and stable material ID.
- Pixel-based radius, bevel width, displacement, frost, and chroma.
- Tint, tint opacity, rim intensity, and light angle.
- A DPR cap of 2.

The displacement generator produces neutral RG values outside the rounded shape and at the settled interior, signed outward vectors within the bevel, and a B-channel convex thickness field. SVG reads the RG vector and WebGL reads RG plus thickness from the same encoded bytes. Both paths use the same CSS-pixel displacement equation.

### Completed visual revision — not accepted

The owner's first review correctly classified the initial result as good glass but not yet liquid glass: it lacked material personality, physical response, and beauty. The permitted M1 revision therefore kept the architecture and material vocabulary fixed while changing the optical behavior:

- The resting material is quieter, clearer, and less glassmorphism-like.
- Hover pulls the body toward the pointer, shifts the light field, increases refraction, and adds localized internal illumination.
- Press compresses the rounded body, concentrates transmitted light, and increases the refraction response without turning the whole control into a magnifier.
- Source luminance now modulates tint and edge lighting in the WebGL path.
- The owned-DOM path uses the same displacement map and gains matching geometry-led flex and surface illumination.
- Reduced-motion removes the geometry deformation.
- Interaction redraws only changed uniforms and reuses the most recently presented video texture; it does not create an unscheduled media-upload loop.
- Visual transforms no longer change WebGL backing resolution or cause one-pixel GPU allocation jitter.

This is a physically motivated digital material, not a claim of Apple implementation or pixel parity.

The WebGL path:

- Uses a normal visible WebGL2 canvas; it does not require Worker or OffscreenCanvas.
- Samples only explicit canvas/video sources.
- Stops after static canvas or paused video settles.
- Uses `requestVideoFrameCallback` where available and gates video uploads by `currentTime`.
- Deduplicates unchanged video uploads.
- Caps the output canvas at DPR 2 while keeping the source fixture at CSS resolution.
- Pauses scheduling when hidden/offscreen.
- Exposes context loss as `css-fallback` rather than a blank or silent no-op.
- Recovers from zero-size to 240×56 CSS pixels / 480×112 device pixels.
- Deletes textures, buffers, programs, observers, media callbacks, and listeners on destroy.

The semantic play/pause button remains normal DOM above decorative, pointer-transparent rendering layers.

## Determinism

At 240×56 CSS pixels and DPR 2:

- Physical map: 480×112.
- Raw pixel SHA-256: `bc73270d23f1bb58505084aa055488648a3e4c6a8b45feb9445ba658ce59e884`.
- PNG SHA-256: `ade9a27676c8a2dfe3578021c24d72a7680e72569656b9a7079faa0b1ef63dac`.
- Center probe: `[128, 128, 255, 255]`; neutral RG with maximum settled-body thickness in B.
- Left/right X probes: `-1` / `+1` normalized vectors.
- Top/bottom Y probes: `-1` / `+1` normalized vectors.
- Fixed SVG and WebGL probe equations agree within the required one CSS pixel; for the current map they are mathematically identical.

Artifacts:

- `.gstack/evidence/gate-1/result/determinism/displacement-map.png`
- `.gstack/evidence/gate-1/result/determinism/displacement-map.sha256`
- `.gstack/evidence/gate-1/result/determinism/pixel-probes.json`
- `.gstack/evidence/gate-1/result/determinism/manifest.json`

## Browser, lifecycle, and performance evidence

The complete suite passed against both a fresh development server and the built production application:

- 15/15 development tests and 15/15 production tests passed: Chromium, Firefox, and Playwright WebKit.
- SSR response contains the semantic control and honest CSS fallback.
- Hydration produced no captured console or page errors.
- Keyboard focus and Space activation work.
- All explicit renderer modes report their actual renderer/fallback state.
- DPR regeneration, zero-size recovery, renderer cleanup, and forced WebGL context loss pass.
- Rest, hover, and press preserve the normal semantic control and are exercised with real pointer input.
- All 18 fixed-scene visual regressions pass, including separate energized and pressed captures for each engine.

Reference production-run metrics at DPR 2:

| Engine | Static canvas frames | Paused canvas delta | Canvas max render | Long tasks | Paused video delta | Video callbacks / uploads |
|---|---:|---:|---:|---:|---:|---:|
| Chromium | 3 | 0 | 6.9 ms | 0 | 0 | 24 / 25 |
| Firefox | 3 | 0 | 1 ms | 0 | 0 | 19 / 19 |
| WebKit | 3 | 0 | 4 ms | 0 | 0 | 20 / 21 |

The one permitted extra video upload is the explicit playback transition. These are controlled headless results on the reference Mac, not universal performance claims.

Artifacts:

- `.gstack/evidence/gate-1/result/metrics/{chromium,firefox,webkit}.json`
- `.gstack/evidence/gate-1/result/traces/*-performance-trace.zip`
- `.gstack/evidence/gate-1/result/reports/playwright-report.json`
- `.gstack/evidence/gate-1/result/reports/playwright-production-report.json`

Playwright WebKit is automation evidence only. It is not evidence of compatibility with shipping Safari or iOS Safari.

## Visual assessment

The bounded visual revision is materially stronger than the recorded baseline and the first M1 review state:

- The glass surface is consistently visible on high-frequency DOM/canvas and natural video.
- Refraction is localized to a controlled bevel rather than a full-surface magnifier.
- The surface has distinct resting, energized, and pressed behavior; deformation, refraction, and light move together.
- The same pressed behavior is materially consistent in Chromium, Firefox, and Playwright WebKit.
- No black renderer output, clipped corner, harsh chromatic ring, or hidden control text appears in the fixed scenes.
- CSS fallback is visibly less refractive but remains coherent and usable.
- Chromium, Firefox, and WebKit crops are materially consistent.

This remains an engineering fixture, not final product polish. The owner remains the final authority for the Milestone 1 visual pass; automation proves consistency and lifecycle behavior, not beauty.

### Extended owner-review gallery

After the bounded optical revision, the owner requested broader examples before making the gate decision. The private `/m1` fixture now includes three canvas stress studies—Prism, Contours, and Nocturne—alongside owned DOM, natural video, and forced fallback. These are evaluation scenes, not new product capabilities or material presets.

- Prism exposes high-frequency refraction and chromatic restraint.
- Contours exposes continuity and depth across the lens profile.
- Nocturne exposes low-light transmission, highlights, and press response.
- Every canvas study retains the same material, map hash, displacement value, geometry, and WebGL path.
- Development and built-production suites now pass 18/18 checks across Chromium, Firefox, and Playwright WebKit.
- The reviewed visual set now contains 27 goldens, including the resting and pressed Nocturne states.

This extension gathers evidence for the existing human decision; it does not reopen unlimited M1 tuning or authorize Milestone 2.

### Rejected edge-light experiment

Owner review correctly identified that the surface still read as an outlined capsule rather than material shaped by light. A follow-up experiment replaced the hard perimeter with a masked CSS conic gradient and softened the nested play-control outline. The result erased the silhouette, muddied the control, and read as a blurred glow pasted over the component rather than renderer-native illumination. It was rejected immediately and removed.

The last coherent visual state has been restored. The border concern remains unresolved. Any further attempt must derive edge illumination from the same displacement/thickness geometry inside the SVG/WebGL rendering paths; CSS gradients, masks, borders, and shadow approximations are explicitly disallowed as a solution.

Reviewed screenshots are stored under `.gstack/evidence/gate-1/result/screenshots/` with a hash manifest. The tracked visual-regression goldens are under `tests/m1.spec.ts-snapshots/`.

## Verification commands

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm test:m1
M1_PRODUCTION=1 corepack pnpm test:m1
corepack pnpm test:m1:visual
corepack pnpm test:m1:performance
corepack pnpm evidence:m1
corepack pnpm size
```

## Qualified gaps and stop boundaries

- Real Safari/macOS and iOS Safari remain untested and unsupported as public claims.
- Cross-origin media failure is represented by an explicit fallback reason in the renderer, but M1 uses local origin-clean fixtures; a clean CORS fixture belongs in later compatibility hardening.
- The local flower video fixtures do not have source or license provenance recorded in the repository; they are research-only and must be replaced or documented before any distributable package or public example.
- The legacy public core still contains Mode C, `html2canvas`, silent no-ops, duplicate renderers/types, placeholder linting, and bundle-analysis warnings. M1 intentionally does not remove them.
- The playground production build still depends on Google Fonts network access.
- The package schema, API exports, React wrapper, workbench, Vite fixture, and production package boundaries are not frozen or implemented.
- No public package, deployment, commit, push, or pull request was created.

## Current gate decision

M1 is **not accepted**. Its mechanical evidence is retained, but the material-lighting proof remains incomplete and Milestone 2 is blocked.

The next and only permitted implementation step is **M1.1 — renderer-native material lighting**:

1. Prove the lighting model in WebGL without a CSS finish perimeter, scene-specific optical values, or snapshot replacement.
2. Pause for explicit owner visual acceptance.
3. Only after WebGL acceptance, prove an owned-DOM SVG path driven by the same material and surface field.
4. Stop or reframe Glaze if either renderer requires CSS lighting tricks, renderer-specific materials, or repeated subjective tuning.

Workbench development, public API/schema freeze, multi-framework support, publishing, deployment, and Milestone 2 remain prohibited until M1.1 passes and the owner explicitly accepts the result.
