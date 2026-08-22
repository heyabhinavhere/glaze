import {
  GlazeDiagnostics,
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
  GlazeSwitch,
} from "@glazelab/react";
import { useState } from "react";

const segments = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

function Artwork() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">
      <rect width="900" height="560" fill="#132a35" />
      <circle cx="690" cy="80" r="260" fill="#d25386" opacity=".86" />
      <circle cx="120" cy="520" r="320" fill="#1f7682" opacity=".9" />
      <path d="M-80 390 C180 120 480 650 980 200" fill="none" stroke="#eec55b" strokeWidth="34" opacity=".8" />
    </svg>
  );
}

export function App() {
  const [period, setPeriod] = useState("week");
  const [live, setLive] = useState(true);

  return (
    <GlazeRoot>
      <main>
        <p className="eyebrow">Fresh React + Vite consumer</p>
        <h1>Glaze stays semantic.</h1>
        <p className="lede">
          The installed package renders one owned React source, one WebGL
          renderer, and ordinary buttons above it.
        </p>
        <GlazeRefractSource className="demo" source={<Artwork />}>
          <span className="demo-label">Selected period: {period}</span>
          <GlazeSegmentedControl
            aria-label="Report period"
            onValueChange={setPeriod}
            segments={segments}
            value={period}
          />
          <GlazeSwitch
            aria-label="Live optics"
            checked={live}
            onCheckedChange={setLive}
          />
          <GlazeDiagnostics compact />
        </GlazeRefractSource>
      </main>
    </GlazeRoot>
  );
}
