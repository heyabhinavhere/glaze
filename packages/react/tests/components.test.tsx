import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GlazeDiagnostics,
  GlazeMediaSurface,
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
  GlazeSlider,
  GlazeSwitch,
  GlazeWorkbench,
} from "../src";
import { inspectOwnedDecorationElement } from "../src/internal/source-contract";

const segments = [
  { id: "today", label: "Today", disabled: true },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
] as const;

function OwnedArtwork() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
      <rect width="320" height="240" fill="#124966" />
      <circle cx="250" cy="40" r="90" fill="#e75f91" />
    </svg>
  );
}

function renderOwnedControls() {
  return renderToStaticMarkup(
    <GlazeRoot>
      <GlazeRefractSource
        aria-label="Owned source proof"
        source={<OwnedArtwork />}
      >
        <GlazeSegmentedControl
          aria-label="Report period"
          defaultValue="missing"
          segments={segments}
        />
        <GlazeSwitch aria-label="Live optics" defaultChecked />
        <GlazeSlider aria-label="Transmission" defaultValue={62} />
        <GlazeDiagnostics aria-label="Surface diagnostics" />
      </GlazeRefractSource>
    </GlazeRoot>,
  );
}

describe("public source surfaces", () => {
  it("renders deterministic semantic SSR with truthful initialization state", () => {
    const first = renderOwnedControls();
    const second = renderOwnedControls();

    expect(first).toBe(second);
    expect(first).toContain(
      'data-glaze-capability-requested="owned-decoration"',
    );
    expect(first).toContain(
      'data-glaze-capability-effective="css-fallback"',
    );
    expect(first).toContain('data-glaze-fallback="renderer-initializing"');
    expect(first).toContain('data-glaze-owned-decoration="true"');
    expect(first).toContain('aria-hidden="true" inert=""');
    expect(first.match(/role="radiogroup"/g)).toHaveLength(1);
    expect(first.match(/role="switch"/g)).toHaveLength(1);
    expect(first.match(/type="range"/g)).toHaveLength(1);
  });

  it("declares explicit media without duplicating interactive content", () => {
    const output = renderToStaticMarkup(
      <GlazeRoot>
        <GlazeMediaSurface
          source={{
            type: "video",
            sources: [
              { src: "/material.webm", type: "video/webm" },
              { src: "/material.mp4", type: "video/mp4" },
            ],
          }}
        >
          <GlazeSwitch aria-label="Playback" />
        </GlazeMediaSurface>
      </GlazeRoot>,
    );

    expect(output).toContain(
      'data-glaze-capability-requested="explicit-media"',
    );
    expect(output).toContain('<video');
    expect(output.match(/<source/g)).toHaveLength(2);
    expect(output.match(/role="switch"/g)).toHaveLength(1);
  });

  it("reports invalid explicit media truthfully during SSR", () => {
    const output = renderToStaticMarkup(
      <GlazeRoot>
        <GlazeMediaSurface source={{ type: "video", sources: [] }}>
          <GlazeDiagnostics />
        </GlazeMediaSurface>
      </GlazeRoot>,
    );

    expect(output).toContain('data-glaze-renderer="fallback"');
    expect(output).toContain(
      'data-glaze-fallback="explicit-media-video-source-required"',
    );
    expect(output).toContain('>css-fallback<');
  });
});

describe("semantic controls", () => {
  it("falls back to the first enabled segment for an invalid default", () => {
    const output = renderOwnedControls();
    expect(output).toContain('data-glaze-has-selection="true"');
    expect(output).toMatch(
      /aria-checked="true" tabindex="0">Week<\/button>/,
    );
    expect(output.match(/aria-checked="true"/g)).toHaveLength(2);
  });

  it("renders no false selection when every option is disabled", () => {
    const output = renderToStaticMarkup(
      <GlazeRoot>
        <GlazeRefractSource source={<OwnedArtwork />}>
          <GlazeSegmentedControl
            aria-label="Unavailable period"
            segments={segments.map((segment) => ({
              ...segment,
              disabled: true,
            }))}
          />
        </GlazeRefractSource>
      </GlazeRoot>,
    );

    expect(output).toContain('data-glaze-has-selection="false"');
    expect(output).not.toContain('aria-checked="true"');
  });
});

describe("diagnostics and development workbench", () => {
  it("reports an honest standalone CSS fallback", () => {
    const output = renderToStaticMarkup(
      <GlazeRoot><GlazeDiagnostics /></GlazeRoot>,
    );
    expect(output).toContain(">css-fallback<");
    expect(output).toContain(">no-source-surface<");
    expect(output).toContain(">CSS<");
  });

  it("can be explicitly disabled", () => {
    const output = renderToStaticMarkup(
      <GlazeRoot><GlazeWorkbench enabled={false} /></GlazeRoot>,
    );
    expect(output).toBe("");
  });
});

describe("owned-decoration React contract", () => {
  it("rejects IDs, event handlers, and raw HTML before DOM rendering", () => {
    const reasons = inspectOwnedDecorationElement(
      <svg
        id="not-allowed"
        onClick={() => undefined}
        dangerouslySetInnerHTML={{ __html: "<path />" }}
      />,
    );
    expect(reasons).toEqual([
      "owned-decoration-prohibits:[id]",
      "owned-decoration-prohibits-event-prop:onClick",
      "owned-decoration-prohibits:dangerouslySetInnerHTML",
    ]);
  });
});
