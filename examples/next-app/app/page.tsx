import {
  GlazeDiagnostics,
  GlazeSegmentedControl,
  GlazeSurface,
} from "@glazelab/react";

const segments = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

export default function Page() {
  return (
    <main>
      <p className="eyebrow">Fresh Next.js App Router consumer</p>
      <h1>Server markup first. Glass second.</h1>
      <p className="lede">
        This page is a Server Component that renders Glaze client components
        through the package boundary.
      </p>
      <GlazeSurface as="section" className="demo" material="dark">
        <span>Account workspace</span>
        <GlazeSegmentedControl
          aria-label="Account section"
          defaultValue="overview"
          material="regular"
          segments={segments}
        />
      </GlazeSurface>
      <GlazeDiagnostics aria-label="Next consumer diagnostics" material="dark" />
    </main>
  );
}
