# Glaze Milestone 1 — Rendering Feasibility Verdict

> **Superseded status — 2026-08-17:** Every visual-acceptance claim below is
> historical agent/orchestrator evidence and was withdrawn by later owner
> review. M1 now proves mechanics only. The current owner-gated status is
> `docs/RECOVERY.md`; no M1 material is an accepted product reference.

Date: 2026-08-12
Baseline commit: `2bd4a5ac1fd01358cef885f8a3cf4aabc0f7ef03`
Checkpoint branch: `aj/glaze-m1-research-spike`

## Verdict

**WEBGL STAGE A ACCEPTED / SAME-MATERIAL SVG PARITY NO-GO / ARCHITECTURE REFRAME ACCEPTED.** The private source-aware spike proves the explicit-source WebGL material, determinism, lifecycle, fallback, and browser-automation boundary. It disproves the proposed same-material owned-DOM SVG parity contract. M1.1 and M1 are closed as NO-GO for renderer parity. The owner/orchestrator subsequently accepted `docs/architecture/RENDERING-REFRAME.md` and only the private explicit-video M2 slice recorded in `docs/gates/M2-EXPLICIT-VIDEO-REPORT.md`.

> **Historical M1 closure state — earlier on 2026-08-12:** M2 was blocked until the rendering reframe and one exact capability slice received explicit owner/orchestrator acceptance. That gate has since been satisfied for explicit video only.

> **M1.1 Stage A decision — 2026-08-12:** The orchestrator explicitly accepted focused revision 1 as the locked WebGL material-lighting reference (`m1.1-continuous-capsule-lighting-r1`, material `m1-transport-controls`).
>
> **Stage B result — 2026-08-12:** **M1.1 NO-GO / REFRAME.** The honest owned-subtree SVG implementation preserved real semantics and used the accepted map/material, but original-resolution review rejected its opaque bright slab, continuous perimeter reading, high-frequency endpoint pinching, and material incoherence with WebGL. Correcting those defects requires a prohibited backdrop/source input or renderer-specific/shared-WebGL retuning. See `docs/gates/M1.1-STAGE-B-REPORT.md`.

The cleaned runtime preserves only the accepted WebGL Stage A implementation. The rejected Stage B SVG implementation is retained only in its report and ignored evidence directory; `/m1` exposes a disabled **SVG parity rejected / reframe required** state rather than a selectable candidate.

The accepted implementation does not require arbitrary DOM capture, `html2canvas`, automatic source detection, renderer-specific scene values, a workbench, package publication, or a public API change. One private material and one deterministic RGBA surface field power:

- WebGL2 sampling from explicit canvas and video elements.
- A visible CSS fallback with a machine-readable reason.
- Ordinary semantic DOM controls layered independently of the decorative renderer.

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

`/m1` is a statically prerendered Next.js 16 route with a Server Component page and a narrow Client Component experiment. Its one 240×56 accessible transport control switches between explicit canvas, video, and forced-fallback modes. Owned DOM is a disabled research outcome, not a renderer mode.

The provisional material is deliberately private and small:

- Schema version 1 and stable material ID.
- Pixel-based radius, bevel width, displacement, frost, and chroma.
- Tint, tint opacity, rim intensity, and light angle.
- A DPR cap of 2.

The displacement generator produces neutral RG values outside the rounded shape and at the settled interior, signed outward vectors from one continuous capsule field, and a B-channel convex thickness field. WebGL reads RG plus thickness from the encoded bytes for refraction, lighting, occlusion, tint, and transmission. The rejected SVG use of this field is not part of the runtime contract.

### Accepted WebGL visual revision

The owner's first review correctly classified the initial result as good glass but not yet liquid glass: it lacked material personality, physical response, and beauty. The permitted M1 revision therefore kept the architecture and material vocabulary fixed while changing the optical behavior:

- The resting material is quieter, clearer, and less glassmorphism-like.
- Hover pulls the body toward the pointer, shifts the light field, increases refraction, and adds localized internal illumination.
- Press compresses the rounded body, concentrates transmitted light, and increases the refraction response without turning the whole control into a magnifier.
- Source luminance now modulates tint and edge lighting in the WebGL path.
- Semantic controls remain independent DOM overlays while the WebGL body supplies geometry-led flex and surface illumination.
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
- Raw pixel SHA-256: `c25ed78d12145887f8595f21be4059417a92d95a9636e0c9b81062b3001ccddb`.
- PNG SHA-256: `7115eea3edeba0bb3183e41dbc22c349e8d0879922a24aa8aaf37444ab6a5f82`.
- Center probe: `[128, 132, 255, 255]`; nearly neutral RG with maximum settled-body thickness in B.
- Left/right X probes: `-0.8346` / `+0.8031` normalized vectors.
- Top/bottom Y probes: `-0.8346` / `+0.8031` normalized vectors.
- WebGL continuity probes exercise the actual encoded map at rest and maximum interaction energy and report zero local foldovers.

Artifacts: `.gstack/evidence/gate-1/m1.1-stage-a-revision-1/determinism/`.

## Browser, lifecycle, and performance evidence

The accepted Stage A suite passed again after SVG cleanup against both a fresh development server and the built production application:

- 27/27 development tests and 27/27 production tests passed: Chromium, Firefox, and Playwright WebKit.
- SSR response contains the semantic control and honest CSS fallback.
- Hydration produced no captured console or page errors.
- Keyboard focus and Space activation work.
- All explicit renderer modes report their actual renderer/fallback state.
- DPR regeneration, zero-size recovery, renderer cleanup, and forced WebGL context loss pass.
- Rest, hover, and press preserve the normal semantic control and are exercised with real pointer input.
- All 40 Stage A fixed crops remain directly reviewable across rest, hover, press, and representative cross-engine states. The 27 tracked baseline snapshots remain unchanged.

Reference production-run metrics at DPR 2:

| Engine | Static canvas frames | Paused canvas delta | Canvas max render | Long tasks | Paused video delta | Video callbacks / uploads |
|---|---:|---:|---:|---:|---:|---:|
| Chromium | 3 | 0 | 6.4 ms | 0 | 0 | 25 / 26 |
| Firefox | 3 | 0 | 1 ms | 0 | 0 | 20 / 20 |
| WebKit | 3 | 0 | 3 ms | 0 | 0 | 20 / 21 |

The one permitted extra video upload is the explicit playback transition. These are controlled headless results on the reference Mac, not universal performance claims.

Artifacts:

- `.gstack/evidence/gate-1/m1.1-stage-a-revision-1/metrics/{development,production}/{chromium,firefox,webkit}.json`
- `.gstack/evidence/gate-1/m1.1-stage-a-revision-1/playwright-output/`
- `.gstack/evidence/gate-1/m1.1-stage-a-revision-1/reports/`

Playwright WebKit is automation evidence only. It is not evidence of compatibility with shipping Safari or iOS Safari.

## Visual assessment

The bounded visual revision is materially stronger than the recorded baseline and the first M1 review state:

- The glass surface is consistently visible on high-frequency DOM/canvas and natural video.
- Refraction is bounded across one continuous capsule field rather than concentrated in a pinching internal bevel.
- The surface has distinct resting, energized, and pressed behavior; deformation, refraction, and light move together.
- The same pressed behavior is materially consistent in Chromium, Firefox, and Playwright WebKit.
- No black renderer output, clipped corner, harsh chromatic ring, or hidden control text appears in the fixed scenes.
- CSS fallback is visibly less refractive but remains coherent and usable.
- Chromium, Firefox, and WebKit crops are materially consistent.

This remains an engineering fixture, not final product polish. The owner remains the final authority for the Milestone 1 visual pass; automation proves consistency and lifecycle behavior, not beauty.

### Extended owner-review gallery

After the bounded optical revision, the owner requested broader examples before making the gate decision. The private `/m1` fixture now includes three canvas stress studies—Prism, Contours, and Nocturne—alongside natural video and forced fallback. These are evaluation scenes, not new product capabilities or material presets.

- Prism exposes high-frequency refraction and chromatic restraint.
- Contours exposes continuity and depth across the lens profile.
- Nocturne exposes low-light transmission, highlights, and press response.
- Every canvas study retains the same material, map hash, displacement value, geometry, and WebGL path.
- Development and built-production Stage A suites pass 27/27 checks across Chromium, Firefox, and Playwright WebKit.
- The reviewed visual set now contains 27 goldens, including the resting and pressed Nocturne states.

This extension gathers evidence for the existing human decision; it does not reopen unlimited M1 tuning or authorize Milestone 2.

### Rejected edge-light experiment

Owner review correctly identified that the surface still read as an outlined capsule rather than material shaped by light. A follow-up experiment replaced the hard perimeter with a masked CSS conic gradient and softened the nested play-control outline. The result erased the silhouette, muddied the control, and read as a blurred glow pasted over the component rather than renderer-native illumination. It was rejected immediately and removed.

Focused WebGL revision 1 resolved the border concern with renderer-native directional light, opposing occlusion, tint, and transmission derived from the accepted continuous field. The same-material SVG attempt subsequently failed because its legal `SourceGraphic` input cannot transmit the already-composited backdrop. CSS gradients, masks, borders, shadow approximations, duplicated substrates, and DOM capture remain disallowed as substitutes.

Reviewed screenshots are stored under `.gstack/evidence/gate-1/m1.1-stage-a-revision-1/fixed-crops/` with a hash manifest. The tracked visual-regression goldens are under `tests/m1.spec.ts-snapshots/`.

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
- No public package, deployment, push, or pull request was created. Closure is limited to a recoverable local research branch and commit.

## Current gate decision

M1.1 and M1 remain **NO-GO for renderer parity**. WebGL Stage A is accepted and locked; owned-DOM SVG Stage B is rejected and absent from executable source. The owner/orchestrator subsequently accepted `docs/architecture/RENDERING-REFRAME.md` and accepted only the capability-scoped M2 explicit-video Next.js slice recorded in `docs/gates/M2-EXPLICIT-VIDEO-REPORT.md`. That later acceptance does not reopen renderer parity or broaden M1.

M1.1 is closed:

1. ~~Prove the lighting model in WebGL without a CSS finish perimeter, scene-specific optical values, or snapshot replacement.~~ Accepted in focused revision 1.
2. ~~Pause for explicit owner visual acceptance.~~ Resolved: **ACCEPT WEBGL LIGHTING FOR STAGE A**.
3. ~~Prove or disprove an owned-DOM SVG path driven by the same locked material and surface field.~~ Resolved: **NO-GO / REFRAME**.
4. ~~Stop or reframe Glaze if either renderer requires CSS lighting tricks, renderer-specific materials, or repeated subjective tuning.~~ Resolved by the explicit capability-tier reframe.

The rendering reframe gate and explicit-video M2 slice are now resolved. Any further slice requires a new owner/orchestrator architecture decision naming one capability. Workbench development, public API/schema freeze, multi-framework support, publishing, deployment, and unscoped renderer expansion remain unauthorized.
