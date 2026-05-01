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

## 2026-05-01 - Refraction Must Scale With Lens Size, Not Texture Size

- Task: Mode C scroll refraction quality.
- Mistake: The shader treated public refraction values as direct backdrop UV
  offsets. On tall document captures, a small fixed pill sampled content many
  pixels below the lens, so a distant color band appeared too early.
- Root cause: UV displacement was multiplied by the full backdrop texture
  dimensions. Mode C document textures can be thousands of pixels tall, while
  the glass control may only be 56px high.
- Why existing gates missed it: Element-scroll proof checked that the color
  changed after scrolling, but did not check whether fixed/sticky glass sampled
  distant content before it was visually close.
- New rule: Refraction displacement must be normalized by the lens footprint in
  texture pixels, not by the complete backdrop texture size.
- Required future behavior: Fixed/sticky Mode C screenshots must include a case
  where a saturated band is near but not touching the lens; no color should leak
  into the glass until the bend zone is visually close.
- Artifact: `packages/core/src/shader.ts`.
- Owner: Codex.

## 2026-05-01 - Do Not Poll Heavy Base64 Debug Previews In The Harness

- Task: Mode C browser verification.
- Mistake: The `/test-mode-c` debug panel polled `debug().backdropPreview` and
  rendered a large base64 PNG every 500ms.
- Root cause: The preview was useful for one-time diagnosis, but keeping it in
  the live harness created avoidable screenshot/browser automation hangs.
- Why existing gates missed it: Typecheck, lint, and build do not exercise
  repeated browser screenshot capture with a large changing data URL in the DOM.
- New rule: Keep heavy captured-backdrop previews available through
  `handle.debug()`, but do not render or poll them continuously in visual
  fixtures.
- Required future behavior: Verification routes should display lightweight text
  diagnostics by default; one-off image previews belong in saved evidence.
- Artifact: `/test-mode-c` debug panel.
- Owner: Codex.

## 2026-05-01 - Preserve Layout When Removing Glass From Mode C Captures

- Task: Mode C sticky/explicit backdrop correctness.
- Mistake: Glass hosts were excluded from `html2canvas` captures with
  `ignoreElements`, which removed their layout footprint from the captured
  texture.
- Root cause: A sticky glass element still occupies flow space. Removing the
  host from the cloned capture shifted later content upward by the host height
  and margin, so color bands appeared in the glass before the live DOM was
  visually close.
- Why existing gates missed it: The first refraction fix was verified against
  the fixed window lens, where removing a fixed host does not affect layout.
- New rule: Mode C feedback-loop prevention must hide glass hosts in the cloned
  DOM while preserving layout; only internal glass canvases should be skipped.
- Required future behavior: Sticky/flow glass screenshots must compare live
  layout distance against sampled color distance. If the capture removes UI,
  prove it did not collapse layout.
- Artifact: `packages/core/src/full/dom-rasterize.ts`.
- Owner: Codex.

## 2026-05-01 - Correct Sampling Is Not Liquid Glass Quality

- Task: Mode C liquid-glass visual recovery.
- Mistake: A bug fix that stopped early distant sampling was presented as a
  good visual outcome even though the rendered material read as static
  glassmorphism.
- Root cause: The shader displacement was changed from full-texture-normalized
  UVs to lens-footprint pixels, but the existing Mode C harness values
  (`refraction: 0.0035`, `bevelDepth: 0.006`) now produce less than one pixel of
  maximum displacement on a 52px pill. That removes visible lensing instead of
  preserving Apple-like liquid bending.
- Why existing gates missed it: The gate proved Mode C capture/mapping and zero
  console errors, but did not require visible dynamic refraction amplitude,
  scroll video, or designer-level rejection of static glassmorphism.
- New rule: Do not close rendering work from correctness proof alone. A liquid
  glass task needs visible bending over high-frequency content and scrolling
  evidence; if the result looks like a blurred translucent pill, it fails even
  when logs, build, and coordinate mapping are correct.
- Required future behavior: Before tuning, calculate the expected maximum
  displacement in pixels for the tested lens size and config. The visual gate
  must include motion evidence where content bends through the rim/body during
  scroll, not only static screenshots.
- Artifact:
  `.gstack/evidence/mode-c-2026-05-01/failed-static-glassmorphism-report.png`.
- Owner: Codex.

## 2026-05-01 - Shader Unit Changes Need Soft Visual Recalibration

- Task: Restore liquid bending after Mode C sampling fix.
- Mistake: The first attempt to restore displacement used a hard cap, which
  made high-contrast text collapse into a harsh rim line.
- Root cause: Refractive displacement needs a local maximum, but a hard
  `min()` clamp flattens the peak of the bend curve and creates an artificial
  ring. A soft saturation curve preserves continuity while still preventing
  distant content from being sampled too early.
- Why existing gates missed it: Static screenshots caught that refraction was
  visible again, but the artifact only became obvious when inspecting text
  crossing the rim.
- New rule: When changing shader units, calculate pixel displacement and use a
  continuous limiting function for optical caps. Hard caps in the visible bend
  path need designer review before they are accepted.
- Required future behavior: Evidence must include high-contrast text or grid
  content crossing the rim so hard-ring artifacts are visible.
- Artifact: `packages/core/src/shader.ts`.
- Owner: Codex.
