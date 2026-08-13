# Glaze

Glaze is a developer workbench and React library for designing, inspecting, and shipping clear glass UI without overstating what the browser can render.

The V1 workflow is intentionally small:

1. render semantic React controls;
2. tune one renderer-independent material model;
3. inspect the same component on difficult backgrounds;
4. see the requested capability, effective renderer, and fallback truth; and
5. copy React or canonical material JSON into an application.

> V1 is a local release candidate. `@glazelab/react` has not been published to npm yet.

## Quick start

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) to use the material workbench.

## React usage

After the package is published:

```bash
pnpm add @glazelab/react
```

Import the explicit stylesheet once near the application root, then render a semantic component:

```tsx
import { GlazeSegmentedControl } from "@glazelab/react";
import "@glazelab/react/styles.css";

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

For Next.js App Router, import the stylesheet from `app/layout.tsx`. A Server Component may render Glaze components with serializable props. Put callbacks and controlled state in a small Client Component.

## Honest capability model

| Capability | V1 behavior |
|---|---|
| `css` | Default and supported. Clear composited material; no refraction claim. |
| `explicit-media` | Named but not enabled in the public V1 package. Falls back visibly to CSS. |
| `owned-decoration` | Research only. Falls back visibly to CSS. |
| `page-backdrop` | Unsupported. Glaze never captures or duplicates arbitrary page DOM. |

The public material describes intent—clarity, frost, tint, depth, edge light, angle, radius, and motion. Shader uniforms and renderer-specific values remain private so a saved material survives future renderer changes.

## What ships in this repository

- `packages/react`: the V1 public React package.
- `apps/playground`: the five-scene material workbench.
- `examples/react-vite`: a self-contained React/Vite consumer with twenty static surfaces.
- `examples/next-app`: a self-contained Next.js `16.2.3` App Router consumer.
- `tests/v1`: development and production browser gates across Chromium, Firefox, and Playwright WebKit.
- `tests/consumers`: packed/linked consumer SSR, Strict Mode, keyboard, cleanup, and idle checks.
- `packages/core`: retained renderer research; it is not the default V1 ordinary-DOM workflow.

## Verification

```bash
corepack pnpm quality:v1
```

The gate builds every workspace package, checks types and package budgets, runs unit tests, exercises the workbench in development and production across three browser engines, verifies the tracked consumers, and installs fresh React 19, React 18, and Next.js consumers from the packed tarball outside the monorepo.

Current package budgets are 8 KB brotli for the React entry, 2 KB brotli for the pure material entry, and 6 KB gzip for CSS. The current release candidate is substantially below all three.

## Boundaries

Glaze V1 does not promise arbitrary DOM refraction, browser-renderer parity, canvas-replaced controls, or a broad component catalogue. CSS is the production baseline because it preserves real DOM, SSR, accessibility, and predictable idle cost. Explicit-source optical rendering remains a separate research capability.

Read [the V1 release contract](docs/V1-RELEASE-CONTRACT.md), [the progress/evidence ledger](docs/V1-PROGRESS.md), and [the research mistake ledger](docs/RESEARCH-MISTAKE-LEDGER.md) before widening the product promise.

## Status

The code and simulator/browser evidence are release-candidate ready. Physical iPhone/iPad acceptance, npm publication, deployment, push, and merge remain explicit owner-controlled actions.

License: MIT.
