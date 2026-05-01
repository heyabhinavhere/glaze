# Mode C Visual Recovery Checklist

Status: failed visual acceptance. Do not merge PR #5 as Apple-quality glass.

## Current Failure

- Route: `/test-mode-c?verify=1777471245810-layout-final`.
- Evidence:
  `.gstack/evidence/mode-c-2026-05-01/failed-static-glassmorphism-report.png`.
- Debug at capture time:
  `mode=C`, `source=dom`, full document texture `1020x3892`, no console
  warnings/errors.
- User-visible failure: the effect reads as static glassmorphism, not liquid
  glass. It has blur/tint/rim, but not convincing optical bending.

## Root Cause To Fix Next

- The previous correctness fix moved refraction from full-texture UV units to
  lens-footprint pixels.
- That fixed distant color leakage but invalidated old tuning values.
- Current harness values produce less than one pixel of maximum displacement on
  a 52px pill:
  - `refraction: 0.0035`
  - `bevelDepth: 0.006`
  - approximate peak: `(0.0035 + 0.006) * 52 = 0.494px`
- Apple-like liquid glass needs a calibrated optical model where public
  parameters map to visible, restrained pixel displacement without sampling
  distant content too early.

## Recovery Procedure

1. Keep the current commit as a known failing visual baseline.
2. Add a focused visual scene with high-frequency background content crossing
   under the lens: text lines, colored bars, and a checker/grid strip.
3. Capture before/after evidence at top, mid-scroll, and scroll-stop.
4. Calculate and record expected displacement in pixels for each preset.
5. Tune the optical model in code, not only the playground config:
   - decide whether `refraction`/`bevelDepth` should remain ratios or become
     documented pixel-scaled strength values;
   - keep max sample reach local to the lens footprint;
   - preserve a non-dead edge, soft body, restrained rim, and legible text.
6. Compare against native Liquid Glass captures once they exist locally.
7. Only close the task if staff-engineer and designer review questions in
   `tasks/quality-gate.md` pass.

## Non-Goals For The Next Patch

- Do not raise package size limits to hide rendering changes.
- Do not mark build/lint/typecheck as visual approval.
- Do not tune only `/test-mode-c` if the public default still reads wrong.
- Do not merge PR #5 until this checklist has passing evidence.
