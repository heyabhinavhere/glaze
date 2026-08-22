import {
  GlazeDiagnostics,
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
} from "@glazelab/react";

const segments = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

function ServerArtwork() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">
      <rect width="900" height="560" fill="#111f36" />
      <circle cx="720" cy="80" r="280" fill="#ae4f86" opacity=".88" />
      <circle cx="100" cy="540" r="340" fill="#246f7c" opacity=".92" />
      <path d="M-80 410 C220 100 460 650 980 180" fill="none" stroke="#edc45e" strokeWidth="32" opacity=".78" />
    </svg>
  );
}

export default function Page() {
  return (
    <GlazeRoot>
      <main>
        <p className="eyebrow">Fresh Next.js App Router consumer</p>
        <h1>Server markup first. Glass second.</h1>
        <p className="lede">
          This page remains a Server Component. Glaze owns only its narrow
          client runtime and the explicitly supplied visual source.
        </p>
        <GlazeRefractSource className="demo" source={<ServerArtwork />}>
          <span>Account workspace</span>
          <GlazeSegmentedControl
            aria-label="Account section"
            defaultValue="overview"
            segments={segments}
          />
          <GlazeDiagnostics compact />
        </GlazeRefractSource>
      </main>
    </GlazeRoot>
  );
}
