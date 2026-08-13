import {
  GlazeDiagnostics,
  GlazeSegmentedControl,
  GlazeSurface,
} from "@glazelab/react";
import { useState } from "react";

const segments = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

export function App() {
  const [period, setPeriod] = useState("week");

  return (
    <main>
      <p className="eyebrow">Fresh React + Vite consumer</p>
      <h1>Glaze stays semantic.</h1>
      <p className="lede">
        This app imports only the published entrypoints. Twenty surfaces remain
        static after first paint.
      </p>
      <GlazeSegmentedControl
        aria-label="Report period"
        material="regular"
        onValueChange={setPeriod}
        segments={segments}
        value={period}
      />
      <section aria-label="Static surface grid" className="surface-grid">
        {Array.from({ length: 20 }, (_, index) => (
          <GlazeSurface as="article" key={index} material={index % 2 ? "clear" : "regular"}>
            <span>Surface {index + 1}</span>
            <strong>{period}</strong>
          </GlazeSurface>
        ))}
      </section>
      <GlazeDiagnostics aria-label="React consumer diagnostics" material="regular" />
    </main>
  );
}
