"use client";

/**
 * /test-mode-c — Mode C correctness harness.
 *
 * This page is intentionally a failing/verification surface, not a polished
 * marketing demo. It proves the hard cases:
 *   1. Auto Mode C: fixed glass over window-scrolling DOM.
 *   2. Explicit Mode C: createGlass(el, { backdropFrom }).
 *   3. Element scroll Mode C: a glass overlay samples an overflow scroller.
 */

import { useEffect, useRef, useState } from "react";
import {
  createGlass,
  type GlassConfigUpdate,
  type GlassHandle,
} from "@glazelab/core/full";

declare global {
  interface Window {
    __glazeModeCHandles?: GlassHandle[];
  }
}

const MODE_C_GLASS = {
  radius: 28,
  frost: 0.3,
  tint: [1, 1, 1, 0.16],
  refraction: 0.0035,
  bevelDepth: 0.006,
  bevelWidth: 1.5,
  bendZone: 14,
  chromatic: 0.008,
  rimIntensity: 0.26,
  specularSize: 0,
  specularOpacity: 0,
} satisfies GlassConfigUpdate;

const COLORS = [
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#4f46e5",
  "#c026d3",
  "#e11d48",
  "#84cc16",
];

export default function TestModeCPage() {
  const autoNavRef = useRef<HTMLDivElement>(null);
  const explicitSourceRef = useRef<HTMLElement>(null);
  const explicitGlassRef = useRef<HTMLDivElement>(null);
  const scrollerSourceRef = useRef<HTMLDivElement>(null);
  const scrollerGlassRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<GlassHandle[]>([]);
  const [debugRows, setDebugRows] = useState<string[]>([]);

  useEffect(() => {
    let debugInterval: number | null = null;
    const id = requestAnimationFrame(() => {
      const handles: GlassHandle[] = [];

      if (autoNavRef.current) {
        handles.push(createGlass(autoNavRef.current, MODE_C_GLASS));
      }

      if (explicitGlassRef.current && explicitSourceRef.current) {
        handles.push(
          createGlass(explicitGlassRef.current, {
            ...MODE_C_GLASS,
            backdropFrom: explicitSourceRef.current,
            backdropAnchor: explicitSourceRef.current,
          }),
        );
      }

      if (scrollerGlassRef.current && scrollerSourceRef.current) {
        handles.push(
          createGlass(scrollerGlassRef.current, {
            ...MODE_C_GLASS,
            backdropFrom: scrollerSourceRef.current,
            backdropAnchor: scrollerSourceRef.current,
          }),
        );
      }

      handlesRef.current = handles;
      window.__glazeModeCHandles = handles;

      const readDebug = () => {
        setDebugRows(
          handles.map((handle, index) => {
            const debug = handle.debug();
            if (!debug) return `${index}: debug unavailable`;
            const texture = debug.texture
              ? `${debug.texture.width}x${debug.texture.height}/max${debug.texture.maxTextureSize ?? "?"}`
              : "none";
            const capture = debug.capture
              ? `${debug.capture.kind}@${debug.capture.x},${debug.capture.y} ${debug.capture.width}x${debug.capture.height}`
              : "none";
            const scroll = debug.scroll
              ? `${debug.scroll.target}:${debug.scroll.x},${debug.scroll.y}`
              : "none";
            return [
              `${index}: mode=${debug.backdropMode}`,
              `source=${debug.source}`,
              `texture=${texture}`,
              `capture=${capture}`,
              `scroll=${scroll}`,
              `error=${debug.lastError ?? "none"}`,
            ].join(" ");
          }),
        );
      };

      readDebug();
      debugInterval = window.setInterval(readDebug, 500);
    });

    return () => {
      cancelAnimationFrame(id);
      if (debugInterval !== null) window.clearInterval(debugInterval);
      for (const handle of handlesRef.current) handle.destroy();
      handlesRef.current = [];
      delete window.__glazeModeCHandles;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#fafaf7",
        fontFamily: "system-ui, sans-serif",
        color: "#222",
      }}
    >
      <div
        ref={autoNavRef}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(680px, 92vw)",
          height: 56,
          borderRadius: 28,
          zIndex: 20,
          display: "grid",
          placeItems: "center",
          color: "#222",
          fontWeight: 650,
          letterSpacing: "0.04em",
          fontSize: 13,
        }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>
          Auto Mode C — fixed glass over window scroll
        </span>
      </div>

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "144px 32px 96px",
          lineHeight: 1.65,
        }}
      >
        <header style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 36, fontWeight: 760, marginBottom: 12 }}>
            Mode C correctness harness
          </h1>
          <p style={{ margin: 0, color: "#555", maxWidth: 680 }}>
            This route should prove real DOM refraction while content scrolls.
            If the glass reads as a faint white pill, a magnifier, or a static
            blur, the task is not complete.
          </p>
        </header>

        <article
          ref={explicitSourceRef}
          style={{ position: "relative", background: "#fafaf7" }}
        >
          <div
            ref={explicitGlassRef}
            style={{
              position: "sticky",
              top: 96,
              width: "min(520px, 100%)",
              height: 52,
              borderRadius: 26,
              zIndex: 10,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 36px",
              color: "#1f2937",
              fontWeight: 650,
              fontSize: 13,
              letterSpacing: "0.035em",
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>
              Explicit backdropFrom — article DOM
            </span>
          </div>

          {Array.from({ length: 8 }, (_, i) => (
            <ContentSection key={i} index={i} />
          ))}
        </article>

        <section style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>
            Element scroll container
          </h2>
          <p style={{ color: "#555", marginBottom: 18 }}>
            The overlay below samples an overflow scroller. Scrolling inside
            the box should move the refracted content through the glass.
          </p>

          <div
            style={{
              position: "relative",
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.10)",
            }}
          >
            <div
              ref={scrollerGlassRef}
              style={{
                position: "absolute",
                top: 272,
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(520px, calc(100% - 40px))",
                height: 52,
                borderRadius: 26,
                zIndex: 5,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                color: "#111827",
                fontWeight: 650,
                fontSize: 13,
                letterSpacing: "0.035em",
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>
                Element scroll Mode C
              </span>
            </div>

            <div
              ref={scrollerSourceRef}
              style={{
                height: 360,
                overflowY: "auto",
                background: "#fffdf8",
                padding: "96px 28px 28px",
              }}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <ContentSection key={i} index={i + 8} compact />
              ))}
            </div>
          </div>
        </section>

        {debugRows.length > 0 && (
          <section
            data-testid="mode-c-debug"
            style={{
              marginTop: 32,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              background: "#111827",
              color: "#f9fafb",
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {debugRows.join("\n")}
            </pre>
          </section>
        )}
      </main>

      <div
        style={{
          position: "fixed",
          bottom: 14,
          left: 14,
          color: "white",
          background: "rgba(0,0,0,0.60)",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
          letterSpacing: "0.04em",
          zIndex: 30,
        }}
      >
        @glazelab/core/full — Mode C verification route
      </div>
    </div>
  );
}

function ContentSection({
  index,
  compact = false,
}: {
  index: number;
  compact?: boolean;
}) {
  const color = COLORS[index % COLORS.length];

  return (
    <section style={{ marginBottom: compact ? 34 : 56 }}>
      <h2
        style={{
          fontSize: compact ? 18 : 22,
          fontWeight: 680,
          marginBottom: 10,
        }}
      >
        Section {index + 1}
      </h2>
      <p style={{ marginBottom: 14, color: "#444" }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation.
      </p>
      <div
        style={{
          marginBottom: 14,
          height: compact ? 82 : 112,
          borderRadius: compact ? 12 : 16,
          background: color,
        }}
      />
      <p style={{ color: "#444", margin: 0 }}>
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
        officia deserunt mollit anim id est laborum.
      </p>
    </section>
  );
}
