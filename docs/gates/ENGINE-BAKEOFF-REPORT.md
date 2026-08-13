# Glaze Gates 0–2 — neutral engine bake-off

Date: 2026-08-13

Branch: `aj/glaze-engine-bakeoff`

Clean baseline: `1c68d98be1d831bed5f07c01fd5c3d5d55797a89`

Route: `/research/bakeoff`

## Verdict

**Gate 0 PASS. Gate 1 PASS. Gate 2 CONDITIONAL GO for one bounded owned-DOM adoption spike.**

The current Glaze WebGL renderer is **not** promoted as the default engine for a DialKit-like React workflow. The CSS candidate is accepted as the mandatory clarity/fallback baseline, but it does not satisfy the optical vision. `@samasante/liquid-glass` `0.1.1` is the only optical candidate promoted to the next research gate, and only for a component-owned DOM-copy capability. It is not accepted as Glaze's public runtime, architecture, API, or dependency yet.

No broad media player, public workbench, package API, deployment, or release is authorized by this report.

## Gate 0 — isolate the failed work

- The rejected visual-reset work remains untouched in its original checkout and branch.
- This bake-off started from clean commit `1c68d98` on `aj/glaze-engine-bakeoff`.
- Existing accepted M1/M2 renderer source, materials, reports, and baselines were not edited.
- New work is confined to a private research route, its test configuration, its test suite, one pinned research dependency, and this report.

## Gate 1 — neutral benchmark contract

The benchmark uses one 300×44 segmented control with the same:

- three real DOM tabs and associated tab panels;
- synchronized selection state;
- click, Arrow Left/Right, Home, and End behavior;
- roving `tabIndex`, focus, names, and selected state;
- five surrounding stress scenes: light, dark, photo, text, and motion;
- desktop comparison layout and 390-pixel focused layout; and
- honest SSR fallback, hydration, forced-colors, reduced-motion, context-loss, and cleanup behavior.

Only the visual strategy changes:

| Candidate | Exact implementation | Input boundary | Claim |
|---|---|---|---|
| A · owned SVG | `@samasante/liquid-glass` `0.1.1`, pinned, published default optics with no `optics` override | An explicit component-owned duplicate of the local track DOM | Cross-browser optical candidate for this narrow copied-DOM boundary |
| B · explicit WebGL | Existing `M1WebGLRenderer`, `m1-transport-controls`, and `m1.1-continuous-capsule-lighting-r1` without material retuning | An explicit component-owned canvas | Existing high-fidelity source renderer under its accepted source contract |
| C · CSS baseline | Native blur, tint, border, highlight, and shadow | Browser-composited local control backdrop | Legible material only; no refraction claim |

The motion scene tests contrast and distraction around the control. It does **not** imply that A or B samples the moving page background; both retain their declared local input boundary.

## Gate 2 — visual decision

### A · owned SVG: advance one gate, do not adopt yet

Strengths:

- The small selected lens remains a coherent object across light, dark, photo, text, and motion surroundings.
- It maps most directly to the desired React workflow: real semantic children plus a headless optical layer.
- It passed the same SSR, hydration, keyboard, compact, reduced-motion, forced-colors, and cross-engine route checks as the other candidates.
- The package is MIT licensed, declares React 18+ compatibility, has no runtime dependencies, and is pinned exactly at `0.1.1`.

Risks and failures still open:

- Bright and text scenes show a small chromatic flash/seam at the selected lens's left edge.
- The active state is subtler than the CSS baseline; default optics alone do not provide the clearest selection affordance.
- The package requires a copied component-owned DOM input for this cross-browser path. That is a different contract from the currently accepted no-duplication Glaze architecture and must remain explicit.
- `0.1.1` is an early dependency. The installed ESM entry is 104,257 bytes raw and 25,729 bytes gzip before application bundling; API stability, tree-shaking, maintenance, and upgrade ownership are not yet accepted.
- This gate did not prove arbitrary page backdrop sampling, nested transforms, virtualized lists, many simultaneous lenses, real shipping Safari/iOS, or a public Next.js package boundary.

Decision: **conditional GO to a bounded adoption/due-diligence spike only.** No optics tuning is accepted by this report.

### B · explicit WebGL: preserve its source capability, reject it as the default workflow

Strengths:

- It preserves the accepted explicit-source security and ownership boundary.
- Static work becomes fully idle after the bounded selection animation.
- It releases the renderer and fails closed to the semantic CSS state after context loss.
- Its existing material and lighting contract remained unchanged.

Why it loses this product decision:

- Light and text scenes retain an asymmetric bright crescent and a pinched/stretching transition near the selected lens edge.
- It needs an authored image/video/canvas source and therefore does not give an engineer the intended install-and-wrap React workflow for ordinary components.
- Generalizing it would require source duplication/capture or a new rendering architecture—the exact scope expansion this bake-off was designed to prevent.

Decision: **NO-GO as Glaze's default React material engine.** Keep it only for separately named explicit media/canvas capabilities.

### C · CSS baseline: accept as the reference and fallback, not the vision

Strengths:

- It is the clearest active-state treatment in every reviewed scene.
- It has no pinching, duplication, texture upload, renderer lifecycle, or source-ownership risk.
- It remains the most reliable compact, forced-colors, unsupported-hardware, and context-loss path.

Limit:

- It bends no content and cannot honestly be marketed as liquid-glass refraction.

Decision: **GO as the mandatory usability baseline and fallback.** It is not the optical engine winner.

## Verification

- `corepack pnpm --filter playground typecheck` — passed.
- `corepack pnpm --filter playground lint` — 0 errors; only the two pre-existing `<img>` warnings outside this route.
- `corepack pnpm --filter playground build` — passed with Next.js `16.2.3`; `/research/bakeoff` is server-rendered on demand because it awaits `searchParams`.
- Development browser gate — 15/15 across Chromium, Firefox, and Playwright WebKit.
- Built-production browser gate — 15/15 across Chromium, Firefox, and Playwright WebKit.
- Production visual evidence — 1/1 evidence generator passed.
- Manual in-app review — real-scale 1280×720 comparison inspected; no magnified crop was used to make the material look better.

Automated coverage proves semantic-tree stability, route truth, synchronized interaction, idle scheduling, bounded redraw, cleanup, context-loss fallback, no horizontal overflow at 390 pixels, reduced motion, forced colors, and the WebGL material/source IDs. Playwright WebKit is automation evidence, not proof of shipping Safari or iOS behavior.

## Evidence

Generated evidence is intentionally ignored by Git under:

`.gstack/evidence/gate-0-2/engine-bakeoff/production/`

It contains five 1280×720 whole-viewport comparisons and three 390×844 focused text-scene captures:

- `desktop-light.png`
- `desktop-dark.png`
- `desktop-photo.png`
- `desktop-text.png`
- `desktop-motion.png`
- `compact-owned-svg-text.png`
- `compact-explicit-webgl-text.png`
- `compact-css-baseline-text.png`

## Authorized next gate

Gate 3 is a bounded dependency/adoption spike for Candidate A. It must answer, before any wrapper or public workbench is built:

1. Does the package remain leak-free and demand-driven under Strict Mode, remount, resize, scroll, transform, and multiple-instance stress?
2. What exact DOM is duplicated, how is sensitive content handled, and can the capability be named without implying arbitrary backdrop capture?
3. Does the dependency tree-shake at the actual Next.js client boundary, and what is the route-level bundle cost?
4. Can one evidence-led optics adjustment remove the bright-edge seam and strengthen selected state without creating pinches or broad wash? One controlled candidate is allowed; parallel subjective tuning is not.
5. Does it behave acceptably in real shipping Safari on macOS and iOS, not only Playwright WebKit?
6. Is vendoring, forking, or depending on `0.1.1` the safer ownership model, and what upgrade/attribution policy follows from that choice?

If Gate 3 fails any hard boundary, Candidate A is rejected and Glaze remains CSS fallback plus separately named explicit-source WebGL—not a falsely unified liquid-glass library.

## Gate 3 closure

Gate 3 is complete. Candidate A failed the direct-adoption boundary. The final decision, evidence, and future re-evaluation conditions are recorded in `docs/gates/CANDIDATE-ADOPTION-REPORT.md`.
