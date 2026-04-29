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

## 2026-04-29 - Mode C Rects Must Track Scroll, Not Just Resize

- Task: Element scroll Mode C.
- Mistake: The element-scroll harness used an absolute overlay, but the renderer
  only refreshed viewport rects for sticky/fixed lenses.
- Root cause: ResizeObserver does not fire when page or container scrolling
  changes `getBoundingClientRect()`. The visible canvas moved with the DOM, but
  the shader sampled with stale lens coordinates.
- Why existing gates missed it: Top and mid page screenshots showed the auto and
  explicit sticky cases, but the element-scroll scenario was not checked after
  scrolling the page to the fixture and then scrolling the inner container.
- New rule: Mode C lenses must refresh their viewport rect during render because
  Mode C sampling depends on live scroll geometry.
- Required future behavior: Element-scroll evidence must include before and
  after inner-scroll screenshots plus debug output showing changing `scroll.y`.
- Artifact: `/test-mode-c` element-scroll fixture.
- Owner: Codex.

## 2026-04-29 - Visual Fixtures Need High-Signal Backdrops

- Task: Element scroll Mode C.
- Mistake: The element-scroll glass was positioned over top padding and text,
  so even a correct sample looked like a static white pill.
- Root cause: The fixture was designed to exercise a code path, not to make the
  optical result obvious to a reviewer.
- Why existing gates missed it: Console logs and route screenshots cannot prove
  visual correctness when the test scene itself has low contrast under the lens.
- New rule: Every glass verification fixture must place the lens over
  high-signal content: saturated color, image detail, or text crossing the rim.
- Required future behavior: Element-scroll screenshots must show the glass over
  different colored cards before and after inner scrolling.
- Artifact: `/test-mode-c` element-scroll fixture.
- Owner: Codex.

## 2026-04-29 - Overflow Capture Must Expand The Clone

- Task: Element scroll Mode C.
- Mistake: Element scroll was treated as a coordinate-mapping problem before
  proving the rasterized texture contained the full scrollable content.
- Root cause: `html2canvas` snapshots overflow elements as a clipped scrollport
  unless the cloned target is expanded, and parent wrappers with
  `overflow:hidden` can still clip the expanded clone. The renderer then sampled
  scroll offsets from a texture that did not contain the expected colored card
  content.
- Why existing gates missed it: The debug data exposed texture dimensions, but
  there was no gate proving that an overflow scroller's captured texture had
  been expanded before upload.
- New rule: For Mode C element scrollers, the rasterizer must expand the cloned
  target to its scrollWidth/scrollHeight, reset clone scroll offsets, and remove
  cloned ancestor overflow clipping before capture.
- Required future behavior: Element-scroll verification must prove both browser
  behavior and capture behavior: visible before/after inner-scroll screenshots,
  zero console errors, and debug capture dimensions matching scroll dimensions.
- Artifact: `packages/core/src/full/dom-rasterize.ts`.
- Owner: Codex.

## 2026-04-29 - Element Scrollers Need A Separate Capture Strategy

- Task: Element scroll Mode C.
- Mistake: Full-scroll capture was assumed to work for overflow elements because
  document/body capture works for long pages.
- Root cause: `html2canvas` can allocate a tall element-scroller canvas while
  still painting only the original visible scrollport; cloned target expansion
  and ancestor unclipping did not make later overflow children render into the
  texture.
- Why existing gates missed it: Texture dimensions were treated as proof of
  content coverage. Pixel inspection of the captured preview showed the later
  card bands were blank.
- New rule: Until the rasterizer is replaced, element scrollers must use
  current-scrollport capture plus an element scroll refresh, while document/body
  Mode C can keep full-scroll capture.
- Required future behavior: For element scrollers, debug evidence must show
  `capture.kind=windowed`, the element scroll offset changing, and the lens
  color/content changing after scroll-stop refresh.
- Artifact: `packages/core/src/create-glass.ts`.
- Owner: Codex.

## 2026-04-29 - Stop Playground Before Rebuilding Workspace Packages

- Task: Mode C verification.
- Mistake: `build:core` was run while the Next playground dev server was
  serving pages that import `@glazelab/core`.
- Root cause: The core build cleans `packages/core/dist` before writing new
  output, so the dev server can briefly resolve the workspace package while its
  entry files are missing.
- Why existing gates missed it: The build itself passed, but the browser/server
  log emitted transient `Module not found` errors during the clean window.
- New rule: Stop or avoid actively browsing the playground before rebuilding
  package `dist`; restart the dev server after the package build completes.
- Required future behavior: Visual evidence logs must not include transient
  package-resolution errors caused by our verification workflow.
- Artifact: Next dev-server log while rebuilding `@glazelab/core`.
- Owner: Codex.
