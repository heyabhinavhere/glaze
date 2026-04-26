"use client";

/**
 * /test — visual harness for @glazelab/core's createGlass() API.
 *
 * Three panels at different sizes on the same backdrop, and seven
 * backdrops to switch between (matching SPIKE_BACKDROPS). Lets us
 * validate the engine across:
 *   - panel sizes (rim character at small vs large)
 *   - backdrop variety (low-contrast solid, vibrant photo, dark, etc.)
 *
 * This page deletes in Phase 2 once the playground (`/`) dogfoods
 * the new API. Transient harness; not a permanent route.
 */

import { useEffect, useRef, useState } from "react";
import { createGlass, type GlassHandle } from "@glazelab/core";

const BACKGROUNDS = [
  { id: "cups",   label: "Cups",    src: "/backgrounds/bg-4.jpg" },
  { id: "curves", label: "Curves",  src: "/backgrounds/bg-3.jpg" },
  { id: "warmth", label: "Warmth",  src: "/backgrounds/bg-7.jpg" },
  { id: "window", label: "Window",  src: "/backgrounds/bg-1.jpg" },
  { id: "abyss",  label: "Abyss",   src: "/backgrounds/bg-2.jpg" },
  { id: "ember",  label: "Ember",   src: "/backgrounds/bg-5.jpg" },
  { id: "sky",    label: "Sky",     src: "/backgrounds/bg-6.jpg" },
] as const;

export default function TestPage() {
  const [bgIdx, setBgIdx] = useState(0);
  const bg = BACKGROUNDS[bgIdx]!;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${bg.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Three glass panels: small / medium / large — at different
          page positions so each lens sees different backdrop content. */}
      <GlassPanel
        backdrop={bg.src}
        style={{ top: "12%", left: "50%", transform: "translateX(-50%)", width: 720, height: 220 }}
        label="Large"
      />
      <GlassPanel
        backdrop={bg.src}
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, height: 140 }}
        label="Medium"
      />
      <GlassPanel
        backdrop={bg.src}
        style={{ bottom: "14%", left: "50%", transform: "translateX(-50%)", width: 280, height: 80 }}
        label="Small"
      />

      {/* Background switcher */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          padding: "8px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: 10,
          backdropFilter: "blur(20px)",
          fontSize: 12,
          color: "white",
        }}
      >
        {BACKGROUNDS.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setBgIdx(i)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background:
                i === bgIdx ? "rgba(255,255,255,0.2)" : "transparent",
              color: "white",
              cursor: "pointer",
              fontWeight: i === bgIdx ? 600 : 400,
              letterSpacing: "0.04em",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          color: "white",
          background: "rgba(0,0,0,0.55)",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
          letterSpacing: "0.04em",
        }}
      >
        @glazelab/core — sub-task 4 (saturation+brightness pass)
      </div>
    </div>
  );
}

interface GlassPanelProps {
  backdrop: string;
  style: React.CSSProperties;
  label: string;
}

function GlassPanel({ backdrop, style, label }: GlassPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlassHandle | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    handleRef.current = createGlass(ref.current, {
      backdrop,
      radius: 28,
    });
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [backdrop]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        ...style,
        borderRadius: 28,
        display: "grid",
        placeItems: "center",
        color: "white",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textShadow: "0 1px 8px rgba(0,0,0,0.25)",
      }}
    >
      {label}
    </div>
  );
}
