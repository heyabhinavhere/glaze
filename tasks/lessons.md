# Glazelab Lessons

This file is the mistake ledger for Glazelab. Update it after any wrong fix,
unverified claim, visual regression, missed test, or bad assumption. A lesson is
not complete until it changes future behavior through a checklist item, harness,
test, doc update, or explicit parked limitation.

## 2026-04-29 - Visual Verification Was Overclaimed

- Task: PR #5 Mode C visual verification.
- Mistake: Static screenshots and build checks were treated as enough evidence
  for a scrolling WebGL/refraction claim.
- Root cause: The closeout process did not require route-specific scroll
  captures, console logs, main-vs-branch comparison, or a designer-level visual
  review before saying the work was verified.
- Why existing gates missed it: `lint`, `typecheck`, `build`, and `size` can
  prove mechanical health, but they cannot prove Apple-like optical behavior.
- New rule: Never mark visual rendering verified from build checks or a single
  static screenshot. Scrolling/WebGL claims require route-specific visual
  evidence, logs, and before/after proof.
- Required future behavior: For non-trivial rendering work, attach the evidence
  listed in `tasks/quality-gate.md` before calling the task complete.
- Artifact: PR #5 `/test-mode-c` is the failing baseline until the gate passes.
- Owner: Codex.

## 2026-04-29 - Package Defaults Are Not Fixture Approval

- Task: Mode C correctness harness.
- Mistake: Package default optical values were applied to a small high-contrast
  56px pill and produced a hot colored rim/dark capture artifact at mid-scroll.
- Root cause: The harness mixed correctness coverage with visual tuning and did
  not first check the result at the exact scroll offsets that users inspect.
- Why existing gates missed it: Typecheck, lint, build, and size all passed;
  only route-specific scroll screenshots exposed the bad visual.
- New rule: For small glass controls over saturated content, start with a
  conservative harness-specific optical profile and record screenshots before
  considering stronger refraction/rim values.
- Required future behavior: Do not use package defaults as visual proof for a
  new fixture. Defaults need their own native-reference tuning pass.
- Artifact: `.gstack/evidence/mode-c-2026-04-29/test-mode-c-mid-scroll.png`.
- Owner: Codex.

## 2026-04-29 - Do Not Parallelize Build With Consumer Typecheck

- Task: Final quality gate.
- Mistake: `corepack pnpm build` and `corepack pnpm typecheck` were started in
  parallel even though the build cleans and regenerates `packages/core/dist`.
- Root cause: Playground typecheck reads package declaration output while the
  package build can temporarily remove or rewrite that output.
- Why existing gates missed it: Running the same commands serially is stable;
  the failure was caused by the verification workflow, not by source types.
- New rule: Run `corepack pnpm build` and package-consuming typechecks serially
  whenever workspace packages resolve through built `dist` declarations.
- Required future behavior: The quality gate order is status/diff, lint,
  typecheck, build, typecheck again if build regenerated package declarations,
  then size and visual checks.
- Artifact: Playground `TS2305` false errors while `packages/core` DTS output
  was being regenerated.
- Owner: Codex.
