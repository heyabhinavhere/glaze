# Glaze — current project state

Date: 2026-08-13

Product line: `aj/glaze-v1`

Status: V1 release candidate; not published or deployed

## Product target

Glaze is a DialKit-like developer workflow for glass UI on the web: install a small React package, render real semantic controls, tune a compact material in a visual workbench, inspect renderer and fallback truth, and copy a stable configuration into an existing React or Next.js app.

V1 optimizes an honest CSS material for clarity and reliability. It does not call CSS output refraction and does not capture arbitrary page DOM.

## Completed vertical slice

- `GlazeSurface`: semantic polymorphic material surface.
- `GlazeSegmentedControl`: real buttons with radio-group semantics, roving focus, click, Arrow Left/Right, Home, End, disabled states, and visible selection.
- `GlazeDiagnostics`: requested/effective capability, fallback, material, reduced-motion, and forced-colors truth.
- Named and custom material resolution with stable public values.
- Explicit ESM/CJS client entry plus a pure server-safe `./material` subpath.
- Explicit package CSS; no runtime style injection.
- Five-scene workbench with presets, all material controls, reset, simulations, and React/JSON export.
- Self-contained React/Vite and Next App Router consumers.

## Evidence state

- Package lint and TypeScript pass with no warnings.
- Root package: 2.01 KB brotli / 8 KB budget.
- Pure material entry: 785 B brotli / 2 KB budget.
- CSS: approximately 1.7 KB gzip / 6 KB budget.
- Unit suite: 21 tests across four files.
- Workbench: 12 development and 12 production checks across Chromium, Firefox, and Playwright WebKit.
- Consumers: linked and packed-tarball production builds plus browser checks.
- React compatibility: packed React 18.3.1 consumer build and runtime interaction pass.
- Next compatibility: Next `16.2.3` App Router default Turbopack build, SSR, hydration, and keyboard pass.
- Native inspection: shipping macOS Safari and iOS 26.5 Simulator Safari on iPhone 17 Pro.

Generated evidence lives under `.gstack/evidence/v1/` and is intentionally ignored by Git. Durable results and caveats live in `docs/V1-PROGRESS.md`.

## Architecture decisions that must not drift

1. Public materials express semantic intent, never raw shader uniforms.
2. `css` is the default and only supported public V1 renderer.
3. Unsupported capabilities fall back visibly and preserve semantic DOM.
4. Arbitrary page capture, `html2canvas`, duplicated interactive subtrees, and automatic backdrop inference are outside V1.
5. Optical experiments remain private and separately named until ownership, semantics, performance, bundle, and visual gates pass.
6. A passing build is not visual acceptance. Real-scale human review remains a separate gate.
7. No broad component catalogue until the segmented-control slice stays green.

## Legacy boundaries

`packages/core`, `/m1`, `/m2/video`, and historical test routes preserve renderer research. They are not the ordinary React API and must not leak into public examples.

The legacy playground currently builds with webpack by default because its Turbopack production compile repeatedly stalls. `pnpm --filter playground build:turbopack` preserves that diagnostic path. The fresh Next consumer passes the same Next version's Turbopack build, so the issue is scoped to legacy playground history rather than `@glazelab/react`.

The rejected candidate probe remains recoverable from commit `7459691` and branch `aj/glaze-engine-bakeoff`; it is not executable on the V1 branch.

## Release commands

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm quality:v1
```

Focused commands:

```bash
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm size
corepack pnpm test:unit
corepack pnpm test:v1
corepack pnpm test:v1:production
corepack pnpm test:consumers
corepack pnpm test:packed-consumers
```

## Remaining owner-controlled gates

- Inspect on at least one physical iPhone and one physical iPad.
- Decide whether the visual material is accepted for alpha publication.
- Choose npm ownership/name and publish.
- Choose deployment destination and deploy the workbench.
- Push, open/approve a pull request, and merge.

None of those actions may be inferred from local release-candidate completion.
