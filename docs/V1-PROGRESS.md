# Glaze V1 progress ledger

This is the compact checkpoint log for the active Codex goal. A checkpoint is complete only when its evidence is recorded here.

## 2026-08-13 — Checkpoint 0: research closure

- Gates 0–2 neutralized the benchmark and rejected the current WebGL engine as the default ordinary-React workflow.
- Gate 3 rejected direct adoption, vendoring, or forking of `@samasante/liquid-glass` `0.1.1`.
- CSS remains the mandatory clarity/fallback baseline.
- Explicit-source WebGL remains a separately named capability, not a universal material engine.
- Evidence: `docs/gates/ENGINE-BAKEOFF-REPORT.md` and `docs/gates/CANDIDATE-ADOPTION-REPORT.md`.

## 2026-08-13 — Checkpoint 1: product-line isolation and contract

Status: complete

- Created isolated worktree `/private/tmp/glaze-v1` on `aj/glaze-v1` at research checkpoint `7459691`.
- Preserved the dirty `aj/glaze-visual-reset` checkout without modification.
- Audited the old configurator specs, current workbench, legacy `@glazelab/core`, accepted M1/M2 reports, quality gate, and mistake ledger.
- Found three conflicting promises: CSS configurator, automatic-backdrop WebGL core, and capability-scoped research.
- Replaced that ambiguity with `docs/V1-RELEASE-CONTRACT.md`.

Remaining before checkpoint completion:

- Removed the rejected dependency and executable Gate 0–3 routes/tests from the V1 product line. The reports remain in the tree and the executable probes remain recoverable in commit `7459691` and branch `aj/glaze-engine-bakeoff`.

Validation:

- `@samasante/liquid-glass` no longer appears in `apps/playground/package.json` or the active lockfile.
- The quarantined `aj/glaze-visual-reset` checkout remains untouched.
- `corepack pnpm lint` passed with zero errors and two pre-existing `<img>` warnings in legacy test routes; legacy `@glazelab/core` still has a placeholder lint command and this is not accepted for the new React package.
- `corepack pnpm build:core && corepack pnpm typecheck` passed in the required serial order.
- `corepack pnpm build` passed, including the Next.js `16.2.3` Turbopack production build.
- Post-build `corepack pnpm typecheck` passed.
- `corepack pnpm size` passed the legacy core budgets; its existing `import.meta`/IIFE analysis warning remains isolated to that legacy package and is not inherited by `@glazelab/react`.

## 2026-08-13 — Checkpoint 2: React package foundation

Status: complete

Implemented:

- Added the small public `@glazelab/react` package with explicit root, pure `./material`, and `./styles.css` exports.
- Added semantic `GlazeSurface` and `GlazeSegmentedControl` components plus a narrowly scoped preference diagnostic.
- Added deterministic named/custom material resolution, input normalization, honest capability fallback attributes, and unit coverage.
- Preserved `"use client"` in emitted ESM and CJS component entrypoints while keeping the pure material subpath server-safe. This is asserted by the package build.
- Replaced fragile runtime CSS alpha arithmetic and comma-separated color channels with precomputed standards-compatible variables.
- Added SSR markup tests for deterministic output, invalid/disabled selection recovery, and unsupported-capability reporting.

Validation:

- Package lint and TypeScript checks pass with no warnings.
- Nine focused material/SSR tests pass.
- The built root entry is 1.97 KB brotli against an 8 KB budget; the pure material entry is 785 B against 2 KB.
- Package CSS is 1,726 B gzip against a 6 KB budget.
- Packed tarball contains only README, package manifest, compiled JS/types/maps, and the explicit stylesheet.
- Development and production matrices each pass 12 tests across Chromium, Firefox, and Playwright WebKit.
- Browser coverage includes SSR/hydration, semantic counts, arrow/Home/End navigation, every preset/range/select/tint control, honest capability fallback, reduced-motion and forced-colors simulations, export/reset, Strict Mode listener cleanup, and mobile viewport fit.
- A packed React 18.3.1 consumer builds and runs without browser errors, closing the `react >=18` peer claim.

## 2026-08-13 — Checkpoint 3: workbench and fresh consumers

Status: complete

Implemented:

- Replaced the ambiguous legacy root configurator with a DialKit-like material workbench for the complete segmented-control slice.
- Added five real-scale acceptance scenes: image detail, light, dark, text crossing, and interaction.
- Added compact material controls, named presets, reset, requested/effective capability diagnostics, environment simulations, and copyable React/JSON output.
- Removed runtime font fetching from the V1 workbench's critical path and preloaded its primary acceptance image.
- Added self-contained React/Vite and Next.js App Router consumer applications that import only public package entrypoints.
- Changed the legacy playground's default production build to webpack after repeated default Turbopack stalls; retained `build:turbopack` as an explicit unresolved diagnostic command. The fresh Next consumer passes the same Next `16.2.3` Turbopack build, isolating the stall to legacy playground scope rather than the Glaze package.

Validation:

- Human-scale desktop and 390 px mobile inspection found no horizontal overflow, clipped controls, magnifier/ring artifact, or unreadable selected state in the five acceptance scenes.
- Interactive inspection caught and fixed a deferred React event-target bug in the tint/motion controls that lint, types, and builds did not catch.
- Forced-colors inspection caught and fixed inherited dark-scene text that defeated system colors.
- Both tracked consumers pass production builds and browser checks; the React consumer proves twenty static surfaces stay idle after settlement, and the Next consumer proves Server Component composition plus SSR/hydration.
- Both consumers also install and build outside the monorepo from the packed `.tgz`; resolved package paths point into pnpm's tarball store rather than a workspace link.
- The clean packed Next fixture passes its default Turbopack build and the pure `@glazelab/react/material` subpath imports in Node.
- Full workspace build, TypeScript, package-size, and 21-test unit suite pass. Repository lint has zero errors and retains two pre-existing legacy `<img>` warnings; legacy `@glazelab/core` still has its pre-existing placeholder lint command.

## 2026-08-13 — Checkpoint 4: native browser evidence and release handoff

Status: in progress

Remaining proof:

- inspect the production workbench in shipping macOS Safari and iOS Simulator Safari;
- capture final real-scale visual evidence after those inspections;
- replace stale repository onboarding and project-state documentation;
- run the complete final gate from a clean checkpoint and review the final diff; and
- leave physical iPhone/iPad acceptance, publication, deployment, push, and merge as explicit owner-controlled actions.
