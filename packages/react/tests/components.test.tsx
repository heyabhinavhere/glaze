import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GlazeDiagnostics,
  GlazeSegmentedControl,
  GlazeSurface,
} from "../src";

describe("GlazeSurface", () => {
  it("renders deterministic CSS output during SSR", () => {
    const first = renderToStaticMarkup(
      <GlazeSurface material="clear">Account balance</GlazeSurface>,
    );
    const second = renderToStaticMarkup(
      <GlazeSurface material="clear">Account balance</GlazeSurface>,
    );

    expect(first).toBe(second);
    expect(first).toContain('data-glaze-capability="css"');
    expect(first).not.toContain("data-glaze-fallback");
  });

  it("reports an honest CSS fallback for unavailable optical modes", () => {
    const output = renderToStaticMarkup(
      <GlazeSurface capability="page-backdrop">Navigation</GlazeSurface>,
    );

    expect(output).toContain('data-glaze-capability="css"');
    expect(output).toContain(
      'data-glaze-fallback="page-backdrop-not-enabled"',
    );
  });
});

describe("GlazeSegmentedControl", () => {
  const segments = [
    { id: "today", label: "Today", disabled: true },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ] as const;

  it("falls back to the first enabled option for an invalid default", () => {
    const output = renderToStaticMarkup(
      <GlazeSegmentedControl
        aria-label="Report period"
        defaultValue="missing"
        segments={segments}
      />,
    );

    expect(output).toContain('role="radiogroup"');
    expect(output).toContain('data-glaze-has-selection="true"');
    expect(output).toMatch(
      /aria-checked="true"[^>]*tabindex="0"[^>]*>Week<\/button>/,
    );
    expect(output.match(/aria-checked="true"/g)).toHaveLength(1);
  });

  it("renders no false selection when every option is disabled", () => {
    const output = renderToStaticMarkup(
      <GlazeSegmentedControl
        aria-label="Unavailable period"
        segments={segments.map((segment) => ({ ...segment, disabled: true }))}
      />,
    );

    expect(output).toContain('data-glaze-has-selection="false"');
    expect(output).not.toContain('aria-checked="true"');
  });
});

describe("GlazeDiagnostics", () => {
  it("renders requested, effective, and fallback capability truth during SSR", () => {
    const output = renderToStaticMarkup(
      <GlazeDiagnostics capability="page-backdrop" material={{ frost: 50 }} />,
    );

    expect(output).toContain("custom");
    expect(output).toContain("page-backdrop");
    expect(output).toContain("page-backdrop not enabled");
    expect(output).toContain(">CSS<");
  });
});
