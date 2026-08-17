# Glaze M2 — Explicit Video Next.js Integration

> **Superseded status — 2026-08-17:** The M2 acceptance below was granted by an
> agent/orchestrator and was withdrawn after live, full-viewport owner review.
> This slice proves source ownership, lifecycle, SSR/hydration, semantics, and
> fallback mechanics only. It is not an accepted visual product. See
> `docs/RECOVERY.md`.

Date: 2026-08-12
Starting commit: `d5a96731971a828ebddd26325a1667405d4a06e6`
Branch: `aj/glaze-m2-explicit-video-nextjs`
Architecture decision: `docs/architecture/RENDERING-REFRAME.md` accepted
Scope: one private explicit same-origin `HTMLVideoElement` integration only

## Candidate evidence root

`/Users/abhinavjain/.codex/worktrees/dfe2/glaze/.gstack/evidence/gate-2/m2-explicit-video-nextjs/`

The 27 accepted M1 visual baselines are immutable. Their pre-edit combined sorted hash is `a17ae5693a4c2bd92dafbabe405ba7a709a7b538e192dbdb08519858c3a49e09`.

## Preflight

- The starting branch was clean at exact commit `d5a9673` before creating this branch.
- The accepted M1 WebGL field/material contract is `m1.1-continuous-capsule-lighting-r1` / `m1-transport-controls`.
- `AGENTS.md`, the accepted rendering reframe, all M1.1 reports, the current M1 renderer/component/tests, the superseded core design, and the bundled Next.js 16.2.3 Server/Client Components, `use client`, self-hosted video, CSS, static export, Playwright, and supported-browser guidance were read before implementation edits.
- The existing same-origin `/m1-flower.webm` and `/m1-flower.mp4` research fixtures are reused. Their repository provenance/license remains unresolved, so they are not approved for distribution.
- The old `docs/GLAZELAB-CORE-DESIGN.md` Mode C milestone is superseded. Mode C, auto backdrop inference, DOM rasterization, `html2canvas`, and arbitrary capture are prohibited for this roadmap.

## Stopping condition

Pass only if `/m2/video` proves a statically rendered Server Component shell plus one narrow Client Component island receiving serializable explicit-video metadata; samples exactly one same-origin video with the accepted unchanged WebGL material; keeps one stable semantic DOM control tree through SSR/hydration, playback, fallback, and remount; passes lifecycle, accessibility, security-failure, development/production, cross-engine, material-integrity, and original-resolution visual gates; preserves all M1 evidence and baselines; and remains private and video-only.

Stop with **M2 NO-GO** if the slice needs material retuning, a public API/schema, image/canvas/backdrop support, renderer auto-detection, Mode C, DOM capture or duplication, silent fallback, semantic-control replacement, or cannot pass production SSR/hydration/lifecycle/accessibility checks.

## Progress log

- **Preflight complete.** Branch, checkpoint, required reading, immutable baseline hash, explicit source fixture, evidence root, capability scope, and stop boundary are recorded before implementation edits.
- **Private integration complete.** `/m2/video` is a statically prerendered Server Component page containing one narrow `ExplicitVideoGlass` Client Component. The server passes only serializable source metadata. The island owns one explicit same-origin video and layers one stable semantic DOM control tree over decorative WebGL.
- **Accepted renderer reused.** M2 imports the locked M1 displacement field, `m1-transport-controls` material, and WebGL renderer directly. The fragment shader hash remains `8128a135a4d85d46f6854909cb98c6984cb47aaeda8b309c93c3d32b5a85d251`; no shader, material, optical, or per-scene value changed.
- **Lifecycle gap closed without optical change.** The shared renderer now cancels video-frame scheduling when offscreen and resumes it when intersecting. The deterministic context-loss hook reports the requested context loss before a pending video upload can overwrite the reason. Both changes are lifecycle-only and passed the complete accepted M1 Stage A matrices.
- **Evidence complete.** Development and built-production M2 matrices, fixed crops, per-engine metrics, source/material/shader hashes, forbidden-path scan, accepted-reference comparison, and artifact manifest are isolated under the evidence root above.

## Integration contract proved

- Server HTML contains the semantic play button, range input, time output, explicit `css-fallback` renderer state, and machine-readable `awaiting-client-enhancement` reason.
- Hydration preserves exactly one `button → input → output` semantic tree and one component-owned video with the same two explicit source paths. It does not duplicate or reorder controls.
- Mouse and keyboard play/pause, native range seeking, focus, time state, accessible names/state, and fallback status remain ordinary DOM behavior. The WebGL canvas is decorative and pointer-transparent.
- WebGL samples only the explicit origin-clean `HTMLVideoElement`. Controlled unsafe-source and upload failures become visible machine-readable fallback reasons without removing the controls.
- Forced colors and reduced transparency expose the explicit solid CSS fallback. Reduced motion suppresses DOM deformation while pointer interaction still changes renderer-native activation.
- Presented-frame callbacks drive playback, unchanged frames are not uploaded, paused/static sources settle, hidden and offscreen callback deltas are zero, and remount/context loss/resize/DPR/zero-size recovery remain observable.
- No image/canvas slice, renderer auto-detection, backdrop renderer, Mode C, DOM capture, hidden substrate, public schema, framework wrapper, workbench, publication, or deployment was added.

## Verification

- Unit and deterministic contract tests: `12/12` passed across the existing displacement probes and new source/material/shader/private-boundary tests.
- M2 development matrix: `21/21` passed across Chromium, Firefox, and Playwright WebKit.
- M2 built-production matrix: `21/21` passed across the same engines.
- Accepted M1 Stage A development matrix: `27/27` passed.
- Accepted M1 Stage A built-production matrix: `27/27` passed.
- Lint passed with only the two pre-existing checkpoint `<img>` warnings; typecheck, production build, size limits, M1 artifact validation, M2 artifact validation, and diff checks passed.
- The production build statically prerendered `/m2/video`; SSR/hydration runs captured no console, page, or hydration errors.
- The 27 immutable baseline files remain unchanged. Their combined sorted SHA-256 listing hash is `a17ae5693a4c2bd92dafbabe405ba7a709a7b538e192dbdb08519858c3a49e09`.

Reference renderer-only lifecycle metrics at DPR 2:

| Environment | Engine | Settled frames / uploads | Playback callbacks / uploads | Hidden delta | Offscreen delta | Max render | Long tasks |
|---|---|---:|---:|---:|---:|---:|---:|
| Development | Chromium | 3 / 1 | 22 / 21 | 0 | 0 | 1.8 ms | 0 |
| Development | Firefox | 1 / 1 | 17 / 17 | 0 | 0 | 2 ms | 0 |
| Development | WebKit | 4 / 1 | 20 / 20 | 0 | 0 | 1 ms | 0 |
| Production | Chromium | 2 / 1 | 22 / 22 | 0 | 0 | 1.8 ms | 0 |
| Production | Firefox | 2 / 1 | 17 / 17 | 0 | 0 | 2 ms | 0 |
| Production | WebKit | 4 / 1 | 20 / 20 | 0 | 0 | 2 ms | 0 |

The one fewer Chromium development upload than callback is valid frame deduplication. These are controlled headless results on the reference Mac, not universal performance claims. Playwright WebKit is automation evidence, not shipping Safari or iOS Safari evidence.

## Visual gate

All 16 owner-facing development and production crops were inspected at their original 672×240 device-pixel resolution: Chromium rest, playing, paused, focus, context loss, and source fallback, plus Firefox and Playwright WebKit rest. The accepted Stage A/M2 comparison was inspected at original resolution.

The orchestrator independently accepted the M2 WebGL success state. It is materially visible and coherent with the accepted Stage A video transport, with no opaque slab, continuous drawn outline, foldover, CSS lighting finish, or lost semantic control. Context-loss and source-failure captures are honestly distinct solid fallback states. Native range-control appearance differs across engines because it remains real DOM; that difference is accepted and is not normalized by canvas or CSS fakery.

## Evidence inventory

- `fixed-crops/`: 16 original-resolution success, interaction, focus, cross-engine, and fallback captures.
- `comparisons/accepted-stage-a-vs-m2-video.png`: accepted M1 video reference beside the M2 production result; material coherence only, not pixel identity.
- `metrics/`: six per-engine/environment lifecycle and performance records.
- `reports/`: final development and production Playwright JSON reports.
- `playwright-output/`: full final traces and run output.
- `integrity/manifest.json`: branch, checkpoint, capability, route, field/material/shader, fixture, baseline, count, and forbidden-runtime-scan record.
- `artifact-manifest.json`: SHA-256 and byte-size inventory for the isolated evidence pack.

## Qualified boundaries

- The local flower fixtures remain research-only because source/license provenance is unresolved.
- Real Safari/macOS and iOS Safari were not tested; Playwright WebKit must not be broadened into that claim.
- This proves only private explicit same-origin video integration in this Next.js App Router fixture. Image, canvas, backdrop/CSS glass, public API/schema, package extraction, framework wrappers, and the workbench are not implied or authorized.
- The legacy core still contains superseded Mode C experiments; M2 does not call, modify, or legitimize them.

## Verdict

**M2 EXPLICIT-VIDEO NEXT.JS SLICE ACCEPTED.** The accepted scope is exactly `/m2/video`: one private Server Component shell, one private explicit-video Client Component island, the unchanged accepted WebGL material, and normal semantic DOM controls. This is not acceptance of a public package surface, another source class, backdrop rendering, Mode C, renderer parity, a workbench, publication, deployment, or any subsequent milestone.

The next authorized gate is an explicit owner/orchestrator architecture decision naming any further capability-scoped slice. No implementation beyond this accepted M2 slice is implicitly authorized.
