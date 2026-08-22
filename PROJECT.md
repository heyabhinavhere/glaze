# Glaze — current project state

Date: 2026-08-22

Product line: `aj/glaze-optics-recovery`

Status: **optical kernel accepted; component-system extraction authorized**

## Product target

Glaze is a React and Next.js component system that gives semantic controls
convincing liquid-glass optics over explicitly owned visual sources. After the
accepted material passes the multi-component proof, an in-app developer
workbench will tune and export that same live material.

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
- Component extraction is authorized. The public API and workbench remain
  frozen until the unchanged material passes the multi-component proof;
  publication, deployment, and release remain later gates.

The decision ledger and stopping rules live in `docs/RECOVERY.md`.

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
2. The unchanged material proves segmented control, switch, and slider across
   owned decoration and explicit media.
3. The serializable public material/API is frozen.
4. The workbench is connected to the exact runtime material.
5. Cross-browser, packed-consumer, physical-device, accessibility, and release
   gates run before merge or publication.

No later gate may begin early.

## Current verification

```bash
corepack pnpm test:optical-kernel:unit
corepack pnpm test:optical-kernel
corepack pnpm test:optical-kernel:production
corepack pnpm --filter playground typecheck
corepack pnpm --filter playground lint
corepack pnpm --filter playground build
```
