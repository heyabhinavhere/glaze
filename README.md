# Glaze

Glaze is a React and Next.js component system that gives semantic controls
liquid-glass optics over explicitly owned React artwork, images, video, and
canvas sources.

Status: `@glazelab/react@0.1.0-alpha.0` has an owner-accepted optical kernel,
a frozen public API, and completed automated and macOS release gates. It is not
published to npm. Physical iPhone/iPad review, final live owner review, and
explicit release authorization remain required.

## Quick start

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) for the live material
workbench. It tunes and exports the exact material used by the rendered
components; there is no separate preview renderer.

## React usage

After the package is published:

```bash
pnpm add @glazelab/react
```

Import the stylesheet once near the application root. Then place semantic
controls over an explicitly owned source:

```tsx
import {
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
} from "@glazelab/react";
import "@glazelab/react/styles.css";

export function PeriodControl() {
  return (
    <GlazeRoot>
      <GlazeRefractSource
        source={
          <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
            <rect width="800" height="500" fill="#15334a" />
            <circle cx="620" cy="80" r="240" fill="#d9588a" />
          </svg>
        }
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

`GlazeRefractSource` accepts visual-only owned React decoration.
`GlazeMediaSurface` accepts an explicit image, video, or canvas and shares one
lazy WebGL renderer among every control lens on that surface. The semantic
controls remain one authoritative DOM tree above the optical layer.

For Next.js App Router, import the stylesheet from `app/layout.tsx`. Layouts and
pages may remain Server Components and pass serializable values or slots into
the narrow Glaze client boundary. `@glazelab/react/material` is server-safe.

See [`packages/react/README.md`](packages/react/README.md) for source contracts,
media usage, the workbench, and the complete public surface.

## Capability truth

| Capability | Behavior |
| --- | --- |
| `owned-decoration` | Refracts a developer-supplied, inert visual React source. |
| `explicit-media` | Samples an explicit image, video, or canvas through one shared renderer per surface. |
| `css-fallback` | Preserves semantic controls and reports why optics are unavailable. It is failure behavior, not the primary material. |

Glaze does not capture arbitrary page DOM, infer page backdrops, duplicate
interactive trees, promise cross-browser pixel identity, or claim Apple
parity. Fallbacks are exposed through `GlazeDiagnostics` and surface data
attributes instead of being silently presented as liquid glass.

## What ships in this repository

- `packages/react`: the frozen public React package and lazy optics/workbench
  chunks;
- `apps/playground`: the live workbench, accepted optical harness, component
  proof, and public verification fixtures;
- `examples/react-vite` and `examples/next-app`: tracked framework consumers;
- `tests`: optical-kernel, component-system, public-API, mobile-preflight, and
  installed-package coverage; and
- `packages/core`: retained renderer research, not the public component path.

## Verification

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm size
corepack pnpm test:unit
corepack pnpm test:public-api
corepack pnpm test:public-api:production
corepack pnpm test:mobile-release
corepack pnpm test:mobile-release:production
corepack pnpm test:consumers
corepack pnpm test:packed-consumers
```

The release evidence includes Chromium, Firefox, WebKit, React 18, React 19,
Next.js 16, SSR/hydration, accessibility, DPR/resize, context recovery,
origin-clean failures, renderer cleanup, and zero-idle-loop checks. Automated
evidence cannot grant visual acceptance.

Read [`docs/RELEASE-READINESS.md`](docs/RELEASE-READINESS.md) for exact results
and remaining gates, [`docs/PUBLIC-API.md`](docs/PUBLIC-API.md) for the frozen
contract, and [`docs/RECOVERY.md`](docs/RECOVERY.md) for decision authority and
stopping rules. The former CSS-first documents are retained as explicitly
superseded engineering history only.

## Release status

The code is ready for physical-device and final owner review. Merge,
deployment, and npm publication remain a **NO-GO** until those reviews pass and
the owner explicitly authorizes each release action.

License: MIT.
