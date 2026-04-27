"use client";

/**
 * /test-auto — auto-detection harness.
 *
 * Proves the "drop-in glass" UX from sub-task 5c. The createGlass
 * call passes NO `backdrop` and NO `backdropAnchor` — the library
 * walks ancestors and figures out what's behind the lens itself.
 *
 * Two scenarios on this page:
 *
 *   1. Top half — page-CSS-bg-image case. The body has a CSS
 *      background-image. Auto-detect's Phase 2 (CSS bg-image
 *      fallback) finds it; the lens samples through that.
 *
 *   2. Bottom half — explicit <img> case. A real <img> element is
 *      laid out as a sibling of the lens (inside a wrapper div).
 *      Auto-detect's Phase 1 (media-element search) finds it; the
 *      lens samples that <img>.
 *
 * Both panels mount with `createGlass(el)` — no second argument.
 *
 * Deletes in Phase 2 alongside the other /test-* harnesses.
 */

import { useEffect, useRef } from "react";
import { createGlass, type GlassHandle } from "@glazelab/core";

export default function TestAutoPage() {
  const cssBgPanelRef = useRef<HTMLDivElement>(null);
  const imgPanelRef = useRef<HTMLDivElement>(null);
  const cssBgHandleRef = useRef<GlassHandle | null>(null);
  const imgHandleRef = useRef<GlassHandle | null>(null);

  useEffect(() => {
    if (cssBgPanelRef.current) {
      cssBgHandleRef.current = createGlass(cssBgPanelRef.current, {
        radius: 28,
      });
    }
    if (imgPanelRef.current) {
      // Image needs to be loaded before auto-detection can measure
      // its bbox. Defer one tick so layout is settled.
      requestAnimationFrame(() => {
        if (imgPanelRef.current) {
          imgHandleRef.current = createGlass(imgPanelRef.current, {
            radius: 28,
          });
        }
      });
    }
    return () => {
      cssBgHandleRef.current?.destroy();
      cssBgHandleRef.current = null;
      imgHandleRef.current?.destroy();
      imgHandleRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top half — page CSS bg-image case */}
      <section
        style={{
          position: "relative",
          height: "100vh",
          // Page-bg-image (Window). Auto-detect Phase 2 picks this up.
          backgroundImage: "url(/backgrounds/bg-1.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          ref={cssBgPanelRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 480,
            height: 140,
            borderRadius: 28,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          }}
        >
          Auto: page CSS background-image
        </div>
      </section>

      {/* Bottom half — explicit <img> ancestor case with cover-fit.
          The renderer's painted-rect helper accounts for object-fit:
          cover so the lens samples the correctly-positioned region
          of the underlying image texture (not the cropped CSS rect). */}
      <section
        style={{
          position: "relative",
          height: "100vh",
          background: "#0a0a0a",
        }}
      >
        <img
          src="/backgrounds/bg-4.jpg"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          ref={imgPanelRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 480,
            height: 140,
            borderRadius: 28,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          }}
        >
          Auto: covering &lt;img&gt; sibling (object-fit: cover)
        </div>
      </section>

      <div
        style={{
          position: "fixed",
          bottom: 14,
          left: 14,
          color: "white",
          background: "rgba(0,0,0,0.55)",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
          letterSpacing: "0.04em",
          zIndex: 20,
        }}
      >
        @glazelab/core 5c — createGlass(el) with no backdrop prop;
        ancestors auto-detected
      </div>
    </div>
  );
}
