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

Status: in progress

Implemented:

- Added the small public `@glazelab/react` package with explicit root, pure `./material`, and `./styles.css` exports.
- Added semantic `GlazeSurface` and `GlazeSegmentedControl` components plus a narrowly scoped preference diagnostic.
- Added deterministic named/custom material resolution, input normalization, honest capability fallback attributes, and unit coverage.
- Preserved `"use client"` in emitted ESM and CJS component entrypoints while keeping the pure material subpath server-safe. This is asserted by the package build.
- Replaced fragile runtime CSS alpha arithmetic and comma-separated color channels with precomputed standards-compatible variables.
- Added SSR markup tests for deterministic output, invalid/disabled selection recovery, and unsupported-capability reporting.

Validation:

- Package lint and TypeScript checks pass with no warnings.
- Eight focused material/SSR tests pass.
- The built root entry is 1.90 KB brotli against an 8 KB budget; the pure material entry is 785 B against 2 KB.
- Package CSS is 1,630 B gzip against a 6 KB budget.
- Packed tarball contains only README, package manifest, compiled JS/types/maps, and the explicit stylesheet.

Remaining before checkpoint completion:

- Strict Mode cleanup, hydration, keyboard behavior, accessibility, static-idle, and multi-instance behavior require browser coverage in real consumers.
