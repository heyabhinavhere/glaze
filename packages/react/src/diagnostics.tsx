"use client";

import { useEffect, useState } from "react";
import { useOptionalGlazeSurface } from "./internal/surface-context";
import type { GlazeDiagnosticsProps } from "./types";

const cx = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

export function GlazeDiagnostics({
  className,
  compact = false,
  ...props
}: GlazeDiagnosticsProps) {
  const surface = useOptionalGlazeSurface();
  const [preferences, setPreferences] = useState({
    forcedColors: false,
    reducedMotion: false,
  });

  useEffect(() => {
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPreferences({
      forcedColors: forcedColors.matches,
      reducedMotion: reducedMotion.matches,
    });
    update();
    forcedColors.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      forcedColors.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  const result = surface?.capability ?? {
    requested: "css-fallback" as const,
    effective: "css-fallback" as const,
    reason: "no-source-surface",
  };
  const renderer = surface?.getRendererDiagnostics();

  return (
    <dl
      {...props}
      className={cx("glaze-diagnostics", className)}
      data-glaze-diagnostics="true"
    >
      <div data-glaze-diagnostic="requested"><dt>Requested</dt><dd>{result.requested}</dd></div>
      <div data-glaze-diagnostic="effective"><dt>Effective</dt><dd>{result.effective}</dd></div>
      <div data-glaze-diagnostic="renderer"><dt>Renderer</dt><dd>{renderer?.renderer ?? "CSS"}</dd></div>
      <div data-glaze-diagnostic="fallback"><dt>Fallback</dt><dd>{result.reason ?? "None"}</dd></div>
      {!compact ? (
        <>
          <div data-glaze-diagnostic="material"><dt>Material</dt><dd>{surface?.material ?? "None"}</dd></div>
          <div data-glaze-diagnostic="controls"><dt>Controls</dt><dd>{renderer?.controlCount ?? 0}</dd></div>
          <div data-glaze-diagnostic="reduced-motion"><dt>Reduced motion</dt><dd>{preferences.reducedMotion ? "On" : "Off"}</dd></div>
          <div data-glaze-diagnostic="forced-colors"><dt>Forced colors</dt><dd>{preferences.forcedColors ? "On" : "Off"}</dd></div>
        </>
      ) : null}
    </dl>
  );
}
