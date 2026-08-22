# Glaze — current project state

Date: 2026-08-22

Product line: `aj/glaze-component-system`

Accepted optical source: `aj/glaze-optics-recovery` at `162c1cb`

Status: **automated verification passed; manual device release gates active**

## Product target

Glaze is a React and Next.js component system that gives semantic controls
convincing liquid-glass optics over explicitly owned visual sources. The
accepted material now powers the frozen public component API and the in-app
developer workbench. The workbench tunes and exports the exact live material;
it does not own a second preview renderer.

The product does not promise arbitrary page capture, automatic backdrop
inference, cross-browser pixel identity, or Apple parity.

## Current authorized slice

`/optical-kernel` is the accepted renderer proof:

- one component-owned Canvas 2D source at a time;
- one real-size `320 x 64` segmented control;
- separate stable-track and moving-selection displacement maps;
- semantic DOM buttons above one transparent WebGL2 output;
- explicit CSS fallback when optical rendering is unavailable; and
- explicit owner acceptance at full scale on 2026-08-22.

The accepted map contract is `glaze-optical-map-transplant`: R/G encode source
displacement, B encodes thickness, and A encodes coverage. The renderer is
demand-driven and stops once the source and spring are idle.

## Truthful current state

- The final optical transplant at `afc7112` has owner visual acceptance.
- M1, M1.1, and M2 remain mechanics and architecture evidence only.
- The CSS-first V1 passed engineering checks but failed the liquid-glass
  product gate. Draft PR #6 is closed.
- The rejected M2 visual reset is preserved at `aj/glaze-visual-reset`
  commit `371a110` and cannot re-enter the product path.
- `/component-proof` runs the unchanged accepted optics over one inert owned
  React SVG and one same-origin live video. Each source has one renderer shared
  by a segmented control, switch, and slider.
- The component proof passes its development and optimized-production browser
  matrices in Chromium, Firefox, and WebKit.
- `/` and `/workbench` dogfood the frozen package API over owned React artwork
  and explicit video. Development and optimized-production public matrices
  pass in Chromium, Firefox, and WebKit.
- The exact-material workbench, truthful diagnostics, lazy optics/workbench
  chunks, context restoration, zero-idle scheduling, and source-contract
  failure behavior pass their public browser gates.
- Source replacement, DPR resize, offscreen suspension, observer cleanup,
  unavailable-WebGL fallback, and tainted-source failure/recovery pass in both
  development and optimized-production public matrices.
- Focused iPhone/iPad WebKit preflights pass responsive layout, capped DPR,
  touch interaction, offscreen resume, semantics, and renderer stability in
  development and optimized production. Physical hardware remains required.
- Packed React 18, React 19, and Next.js 16 consumers build and run from the
  installed tarball rather than a workspace link.
- The optimized production build passed real-scale interaction review in
  actual macOS Chrome and Safari.
- Actual macOS VoiceOver and Safari pass on an optimized retained Next.js 16
  consumer installed from the package tarball; semantics and keyboard state
  changes were verified and restored.
- A credential-free disposable copy of BON Credit Demo passes an installed
  tarball dogfood route in its real Next.js 16/Tailwind product environment;
  the dirty BON source repository was not changed.
- Physical iPhone/iPad, final live owner review, publication, deployment, and
  merge remain owner-controlled release gates.

The decision ledger and stopping rules live in `docs/RECOVERY.md`.
The exact automated/manual split lives in `docs/RELEASE-READINESS.md`.

## Retained assets

- semantic React controls and accessibility behavior;
- explicit fallback and diagnostics patterns;
- packed React 18, React 19, and Next.js consumer verification;
- WebGL lifecycle, DPR, context-loss, and source-ownership evidence;
- the four-source optical evaluation harness; and
- historical rejected artifacts as non-mergeable evidence.

## Retired product paths

- Mode C and `html2canvas` arbitrary-DOM capture;
- automatic source detection or page-backdrop inference;
- CSS glassmorphism as the primary product renderer;
- the rejected M1/M2 materials and visual baselines; and
- automation, crops, or agent judgment as visual acceptance.

## Gate order

1. **Complete:** owner accepts one real-size optical kernel.
2. **Complete:** the unchanged material proves segmented control, switch, and
   slider across owned decoration and explicit media.
3. **Complete:** the serializable public material/API is frozen.
4. **Complete:** the workbench is connected to the exact runtime material.
5. **Active:** automated repository and packed-consumer gates are complete;
   physical-device, final owner review, and release authorization remain before
   merge or publication.

No later gate may begin early.

## Current verification

```bash
corepack pnpm test:optical-kernel:unit
corepack pnpm test:optical-kernel
corepack pnpm test:optical-kernel:production
corepack pnpm test:component-proof:unit
corepack pnpm test:component-proof
corepack pnpm test:component-proof:production
corepack pnpm test:public-api
corepack pnpm test:public-api:production
corepack pnpm test:mobile-release
corepack pnpm test:mobile-release:production
corepack pnpm test:consumers
corepack pnpm test:packed-consumers
corepack pnpm test:packed-consumers:retain
corepack pnpm --filter @glazelab/react size
corepack pnpm --filter playground typecheck
corepack pnpm --filter playground lint
corepack pnpm --filter playground build
```
