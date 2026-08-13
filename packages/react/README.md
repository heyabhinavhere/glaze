# `@glazelab/react`

Semantic, CSS-first glass surfaces and controls for React and Next.js.

This package is under active V1 development. Its current public contract is documented in `docs/V1-RELEASE-CONTRACT.md` at the repository root.

```tsx
import { GlazeSegmentedControl } from "@glazelab/react";
import "@glazelab/react/styles.css";

<GlazeSegmentedControl
  aria-label="Report period"
  defaultValue="today"
  segments={[
    { id: "today", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ]}
/>
```

Glaze V1 guarantees a clear CSS material and does not claim arbitrary page refraction. Experimental optical capabilities are separately named and never silently inferred.
