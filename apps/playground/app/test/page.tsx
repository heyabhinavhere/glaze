"use client";

/**
 * /test — visual harness for the new @glazelab/core createGlass() API.
 *
 * Phase 1 sub-task 3c milestone: real glass shader rendering through the
 * new shared-offscreen-context architecture. Single button with a
 * hardcoded backdrop image. This page proves the new pipeline matches
 * the playground's visual quality — when sub-task 5 lands auto-detection,
 * the same effect renders without the explicit `backdrop` prop.
 *
 * This page deletes in Phase 2 once the playground (`/`) dogfoods
 * the new API. It's a transient harness, not a permanent route.
 */

import { useEffect, useRef } from "react";
import { createGlass, type GlassHandle } from "@glazelab/core";

export default function TestPage() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlassHandle | null>(null);

  useEffect(() => {
    if (!buttonRef.current) return;

    handleRef.current = createGlass(buttonRef.current, {
      backdrop: "/backgrounds/bg-4.jpg", // "Cups" — the playground's default
      radius: 24,
      // Sub-task 3c sends the playground's tuned defaults straight through
      // (DEFAULT_LENS_CONFIG matches presets.liquidGlass).
    });

    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: "url(/backgrounds/bg-4.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        ref={buttonRef}
        style={{
          width: 280,
          height: 88,
          borderRadius: 24,
          display: "grid",
          placeItems: "center",
          color: "white",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.02em",
          // The button renders as a regular DOM element; the glass canvas
          // is appended as its first child by createGlass(). Text below
          // sits on top because the canvas has pointer-events:none and
          // is behind in DOM order.
        }}
      >
        Hello, glass
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          color: "rgba(255,255,255,0.85)",
          fontSize: 13,
          letterSpacing: "0.04em",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: 6,
        }}
      >
        @glazelab/core 3c — createGlass() with explicit backdrop
      </div>
    </div>
  );
}
