# Glaze V1 release contract

Date: 2026-08-13

Status: active implementation contract

Branch: `aj/glaze-v1`

## Product promise

Glaze is a developer tool and React library for designing, inspecting, and shipping clear, premium glass UI without lying about what the browser can render.

The workflow is DialKit-like:

1. install the package in an existing React or Next.js application;
2. render real semantic controls, not a canvas replacement;
3. tune a small material model in the Glaze workbench;
4. inspect the effective renderer, fallback, accessibility state, and cost;
5. copy a stable configuration or component example into the application; and
6. keep the optical backend replaceable as browser capabilities improve.

V1 is successful when an engineer can complete that workflow in a fresh consumer application without importing playground internals or understanding Glaze's renderer history.

## V1 vertical slice

V1 ships one complete slice before adding a component catalogue:

- `GlazeSurface`: the material primitive for ordinary semantic DOM content.
- `GlazeSegmentedControl`: three or more real buttons with roving focus, selection state, keyboard navigation, and a Glaze selection lens.
- `GlazeDiagnostics`: a small development-facing readout of requested material, effective capability, fallback reason, reduced-motion state, and forced-colors state.
- A workbench that tunes the vertical slice over light, dark, image, text, and motion scenes and exports React plus material JSON.

The segmented control is the acceptance component because it exposes the failures hidden by decorative cards: active-state clarity, compact geometry, text crossing the material, focus, keyboard behavior, reduced motion, and multiple instances.

## Public architecture

### Package boundary

The public React package is `@glazelab/react`.

Initial public exports are deliberately small:

```ts
export {
  GlazeSurface,
  GlazeSegmentedControl,
  GlazeDiagnostics,
  glazeMaterials,
  resolveGlazeMaterial,
} from "@glazelab/react";

export type {
  GlazeCapability,
  GlazeMaterial,
  GlazeMaterialName,
  GlazeSegment,
} from "@glazelab/react";
```

Consumers explicitly import `@glazelab/react/styles.css`. Components render meaningful SSR HTML before JavaScript runs.

### Material model

The workbench and components share semantic intent, not renderer-specific shader uniforms:

- `clarity`: foreground legibility and active-state separation;
- `frost`: background diffusion;
- `tint` and `tintOpacity`;
- `depth`: grounding and elevation;
- `edge`: directional edge-light strength;
- `lightAngle`;
- `radius`; and
- `motion`: `none`, `subtle`, or `expressive`, always subordinate to reduced motion.

Renderer-specific values stay private. A public material remains valid when the implementation changes.

### Capability model

V1 names capabilities instead of pretending they are equivalent:

| Capability | Input | V1 status | Public promise |
|---|---|---|---|
| `css` | Browser-composited local backdrop | Required default | Clear premium material, no refraction claim |
| `explicit-media` | Author-owned image, video, or canvas | Private/experimental | Separately named optical rendering only |
| `owned-decoration` | Explicit decorative duplicate | Research only | Not public until semantics, bundle, and visual gates pass |
| `page-backdrop` | Arbitrary surrounding DOM | Unsupported | Never inferred or silently captured |

`GlazeSurface` defaults to `css`. V1 may report an experimental capability, but it must never silently substitute a different ownership model.

## Visual contract

The CSS engine is not allowed to imitate refraction with noisy chromatic rings or exaggerated blur. It must instead excel at what CSS can honestly deliver:

- immediate foreground clarity;
- a coherent surface with restrained tint and frost;
- directional edge light that does not read as a continuous stroke;
- grounded depth without a broad halo;
- selected-state contrast that survives every acceptance scene;
- no magnifier, colored-ring, pinched, washed-out, or static translucent-pill failure; and
- no visual dependency on animation.

Visual review uses the whole control at real scale first. Crops diagnose defects; they cannot be used to manufacture approval.

## Accessibility and semantics

- Semantic descendants appear exactly once in the DOM and accessibility tree.
- `GlazeSegmentedControl` uses buttons and exposes group/selection semantics without replacing controls with canvas content.
- Arrow Left/Right, Home, and End work; focus is visible; disabled items remain understandable.
- Forced colors removes decorative glass layers and preserves system colors and outlines.
- Reduced motion disables non-essential interpolation.
- Decorative layers use `aria-hidden`, cannot receive focus, and cannot intercept input.
- Material contrast cannot be the only selected-state indicator.

## SSR and framework contract

- Importing the package in Node has no top-level `window`, `document`, canvas, or WebGL access.
- Server-rendered markup and the first client render are structurally identical.
- React Strict Mode mount, cleanup, remount, and hot reload do not leak observers, timers, animation frames, styles, or global listeners.
- The package works in React 18+ and the repository's current Next.js App Router version.
- Styling works through an explicit package CSS export; no runtime style injection is required for first paint.

## Performance and package budgets

- Static CSS components schedule no continuous animation frames.
- Pointer and selection motion is CSS-driven and bounded.
- No observers or global listeners are installed unless a component needs them; every installation has deterministic cleanup.
- `@glazelab/react` initial JavaScript budget: 8 KB gzip excluding React/ReactDOM.
- Package CSS budget: 6 KB gzip.
- A page with twenty static surfaces must remain idle after settlement.
- The workbench is allowed application dependencies that the published package does not inherit.

## Workbench contract

The workbench must make the system easier to trust, not merely prettier:

- show requested material and effective capability;
- show the fallback/unsupported reason;
- compare at least five acceptance scenes at real component scale;
- offer compact controls with understandable values and reset;
- export a React usage example and canonical JSON material;
- expose forced-colors and reduced-motion simulations;
- show package/bundle and animation-ownership notes; and
- never label CSS output as refraction or imply renderer parity.

## Verification matrix

Every release-candidate change must pass, serially where generated package output is consumed:

1. clean Git status/diff review and `git diff --check`;
2. package lint and typecheck;
3. package build, export-map inspection, tarball inspection, and size limits;
4. consumer typecheck/build after package output exists;
5. unit tests for material resolution and exports;
6. React Strict Mode, SSR/hydration, keyboard, accessibility-tree, cleanup, idle, and multi-instance browser tests;
7. development and production Chromium, Firefox, and Playwright WebKit;
8. shipping macOS Safari and iOS Simulator Safari inspection;
9. real-scale visual evidence for light, dark, image, text, and motion scenes; and
10. one final fresh consumer install from the packed tarball, not a workspace symlink.

Physical iPhone/iPad testing remains the only allowed hardware release gate. It cannot be relabeled as completed from Playwright WebKit or Simulator evidence.

## Explicit non-goals

- No arbitrary DOM capture, `html2canvas`, hidden page substrate, or automatic backdrop inference.
- No universal renderer that claims CSS, SVG, and WebGL parity.
- No broad component catalogue before the segmented-control slice passes.
- No SwiftUI/React Native implementation in V1.
- No deployment, npm publication, push, merge, or public launch without owner authorization.
- No visual acceptance based only on passing tests or a single screenshot.

## Stopping condition

The V1 goal is complete only when the package, workbench, both fresh consumer fixtures, documentation, validation matrix, and visual evidence all satisfy this contract; the branch is clean and checkpointed; and the only remaining step is an explicitly owner-controlled external action such as physical-device approval, npm publication, deployment, push, or merge.
