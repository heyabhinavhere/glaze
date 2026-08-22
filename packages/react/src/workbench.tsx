"use client";

import { lazy, Suspense } from "react";
import type { GlazeWorkbenchProps } from "./types";

const WorkbenchPanel = lazy(() => import("./workbench-panel"));

export function GlazeWorkbench({
  enabled = process.env.NODE_ENV !== "production",
  material = "default",
  ...props
}: GlazeWorkbenchProps) {
  if (!enabled) return null;
  return (
    <Suspense
      fallback={(
        <aside {...props} className="glaze-workbench" aria-busy="true">
          Loading Glaze workbench…
        </aside>
      )}
    >
      <WorkbenchPanel {...props} material={material} />
    </Suspense>
  );
}
