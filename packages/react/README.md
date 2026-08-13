# `@glazelab/react`

Semantic, CSS-first glass surfaces and controls for React and Next.js.

Status: `0.1.0-alpha.0` release candidate. Not yet published to npm.

## Install

```bash
pnpm add @glazelab/react
```

React and React DOM 18 or newer are peer dependencies.

## Quick start

Import the stylesheet once near the application root:

```tsx
import "@glazelab/react/styles.css";
```

Then render a real semantic control:

```tsx
import { GlazeSegmentedControl } from "@glazelab/react";

export function PeriodControl() {
  return (
    <GlazeSegmentedControl
      aria-label="Report period"
      defaultValue="week"
      material="regular"
      segments={[
        { id: "day", label: "Day" },
        { id: "week", label: "Week" },
        { id: "month", label: "Month" },
      ]}
    />
  );
}
```

The component renders buttons with radio-group semantics. Arrow Left/Right, Home, End, pointer selection, focus visibility, disabled options, forced colors, and reduced motion are supported.

## Next.js App Router

Import package CSS from `app/layout.tsx`:

```tsx
import "@glazelab/react/styles.css";
```

A Server Component may render Glaze with serializable props. Use a small Client Component when you need controlled state or callbacks.

The emitted component entry preserves `"use client"`. The `@glazelab/react/material` subpath is pure and safe to import in server code.

## Public surface

```ts
export {
  GlazeDiagnostics,
  GlazeSegmentedControl,
  GlazeSurface,
  glazeMaterials,
  resolveGlazeMaterial,
} from "@glazelab/react";
```

Named materials are `clear`, `regular`, `frosted`, and `dark`. A custom material may set:

- `clarity`: `0–100`
- `frost`: `0–100`
- `tint`: six- or three-digit hex color
- `tintOpacity`: `0–50`
- `depth`: `0–100`
- `edge`: `0–100`
- `lightAngle`: normalized to `0–359`
- `radius`: non-negative pixels
- `motion`: `none`, `subtle`, or `expressive`

Runtime values are normalized without mutating the input or named presets.

## Capability truth

`css` is the supported V1 renderer. `explicit-media`, `owned-decoration`, and `page-backdrop` are named so a consumer can request and inspect them, but the public package deliberately falls back to CSS and reports the reason through `data-glaze-fallback` and `GlazeDiagnostics`.

Glaze V1 does not claim arbitrary DOM refraction. It does not replace semantic controls with canvas, capture the page, duplicate interactive descendants, schedule continuous animation frames, or inject first-paint styles at runtime.

## Styling

Glaze styles live in the `glaze` CSS cascade layer. Application styles outside a layer can override layout, color, and typography. Material variables are private implementation details; prefer the public material object rather than persisting CSS variables.

## Package budgets

- root entry: 8 KB brotli maximum
- pure material entry: 2 KB brotli maximum
- stylesheet: 6 KB gzip maximum

Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm size` before packing.

License: MIT.
