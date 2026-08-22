# `@glazelab/react`

Semantic liquid-glass controls over explicitly owned React and media sources.

Status: `0.1.0-alpha.0`, owner-accepted optical kernel and frozen public API.
Not yet published to npm.

## Install

```bash
pnpm add @glazelab/react
```

React and React DOM 18 or newer are peer dependencies. Import the stylesheet
once near the application root:

```tsx
import "@glazelab/react/styles.css";
```

## Owned React decoration

`GlazeRefractSource` owns one visual-only SVG source. The source is wrapped in
an inert, `aria-hidden` subtree; semantic controls remain a single ordinary DOM
tree above the optical canvas.

```tsx
import {
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
} from "@glazelab/react";

export function PeriodControl() {
  return (
    <GlazeRoot>
      <GlazeRefractSource
        source={(
          <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
            <rect width="800" height="500" fill="#15334a" />
            <circle cx="620" cy="80" r="240" fill="#d9588a" />
          </svg>
        )}
      >
        <GlazeSegmentedControl
          aria-label="Report period"
          defaultValue="week"
          segments={[
            { id: "day", label: "Day" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
          ]}
        />
      </GlazeRefractSource>
    </GlazeRoot>
  );
}
```

Owned decoration must not contain IDs, forms, labels, interactive or editable
content, event handlers, `tabIndex`, `dangerouslySetInnerHTML`, or explicitly
sensitive nodes. Development builds warn and select the CSS fallback when the
contract is violated.

## Explicit media

`GlazeMediaSurface` samples an explicit image, video, or canvas. Every media
surface owns one source texture and one lazy WebGL renderer shared by all of
its control lenses.

```tsx
<GlazeMediaSurface
  source={{
    type: "video",
    sources: [
      { src: "/scene.webm", type: "video/webm" },
      { src: "/scene.mp4", type: "video/mp4" },
    ],
  }}
>
  <GlazeSwitch aria-label="Live optics" defaultChecked />
  <GlazeSlider aria-label="Transmission" defaultValue={62} />
</GlazeMediaSurface>
```

Cross-origin image/video sources must be CORS-enabled and origin-clean. Canvas
sources provide a `draw(context, size)` function and may provide
`subscribe(invalidate)` for demand-driven updates.

## Material and workbench

`GlazeRoot` holds serializable named materials. `useGlazeMaterial(name,
defaults)` reads the live resolved value. `GlazeWorkbench` edits that exact
registry—there is no separate preview renderer—and exports canonical JSON or a
React snippet.

```tsx
<GlazeRoot materials={{ product: { refraction: 1.1 } }}>
  <GlazeRefractSource material="product" source={<Artwork />}>
    <GlazeSegmentedControl {...props} />
    <GlazeDiagnostics />
  </GlazeRefractSource>
  <GlazeWorkbench material="product" />
</GlazeRoot>
```

The workbench is enabled by default only in development. Pass `enabled` to opt
in deliberately in production. Material fields are `refraction`, `thickness`,
`dispersion`, `roughness`, `transmission`, `tint`, and directional `lighting`;
motion uses `stiffness` and `damping`.

## Public surface

```ts
export {
  GlazeDiagnostics,
  GlazeMediaSurface,
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
  GlazeSlider,
  GlazeSwitch,
  GlazeWorkbench,
  useGlazeMaterial,
} from "@glazelab/react";
```

The pure `@glazelab/react/material` subpath is safe in Server Components and
other server code. The React entry preserves its client boundary, while pages
and layouts may remain Server Components and pass serializable props/slots.
The WebGL renderer and workbench panel are separate lazy ESM chunks.

## Capability truth

Supported optical capabilities are `owned-decoration` and `explicit-media`.
Unsupported environments use `css-fallback`; `GlazeDiagnostics` and surface
data attributes expose the requested capability, effective capability,
renderer, and reason.

Glaze does not capture arbitrary DOM, infer page backdrops, duplicate semantic
controls, promise cross-browser pixel identity, or claim Apple parity. The CSS
fallback is accessibility and failure behavior, not the primary material.

## Verification budgets

- initial ESM entry and shared chunks: 8 KB brotli;
- accepted optics chunk: 6,078 bytes brotli, with a 10% regression ceiling;
- pure material entry: 2 KB brotli; and
- stylesheet: 6 KB gzip.

Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm size`, unit tests, public
API browser matrices, and packed-consumer tests before release review.

License: MIT.
