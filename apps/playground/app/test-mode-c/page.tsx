"use client";

/**
 * /test-mode-c — Mode C harness. Glass refracts arbitrary DOM
 * content (text, cards, gradients — no media element).
 *
 * Setup:
 *   - Import createGlass from "@glazelab/core/full" (NOT default)
 *     so the /full entry's side-effect registers the DOM rasterizer.
 *   - A fixed glass nav at the top.
 *   - Scrolling article content below: headings, paragraphs, color-
 *     varied cards. NO <img> / <video> / <canvas>. NO CSS bg-image.
 *     This is the case where Modes A and B can't help.
 *   - createGlass(navEl) — no backdrop prop. Auto-detection's Mode C
 *     fallback rasterizes the body, the lens samples through it.
 *
 * What this proves end-to-end:
 *   - The /full entry registers the rasterizer at module-import time
 *   - Auto-detection finds no media + no CSS bg → falls through to
 *     Mode C against the body (since no scroll container ancestor)
 *   - createGlass's loadAndApplyModeC awaits the rasterizer, gets a
 *     canvas, uploads it as the lens's backdrop texture
 *   - The glass nav now refracts the article content beneath it
 *
 * Sub-task 6a limitations (visible here):
 *   - One-shot rasterization at mount. Scroll past the captured area
 *     hits the texture edge (clamp). Sub-task 6d's capture-tall-once
 *     fixes this.
 *   - No CSS-variable resolution yet. Tailwind gradients won't render
 *     correctly inside the SVG sandbox. Sub-task 6b fixes this.
 *   - Synchronous main-thread rasterization. Mount-time spike
 *     visible. Sub-task 6c moves it to a Worker.
 *
 * Deletes in Phase 2 alongside the other /test-* harnesses.
 */

import { useEffect, useRef } from "react";
// IMPORTANT: import from /full to register the rasterizer
import { createGlass, type GlassHandle } from "@glazelab/core/full";

export default function TestModeCPage() {
  const navRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlassHandle | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Defer one rAF so the article content has laid out before we
    // rasterize. Without this, the rasterizer might capture an empty
    // body and the lens shows nothing.
    const id = requestAnimationFrame(() => {
      if (!navRef.current) return;
      handleRef.current = createGlass(navRef.current, {
        // No `backdrop` prop — auto-detection's Mode C fallback runs.
        radius: 28,
      });
    });

    return () => {
      cancelAnimationFrame(id);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        background: "#fafaf7",
        fontFamily: "system-ui, sans-serif",
        color: "#222",
      }}
    >
      {/* Fixed glass nav at top of viewport. Stays put while body scrolls. */}
      <div
        ref={navRef}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(680px, 92vw)",
          height: 56,
          borderRadius: 28,
          zIndex: 10,
          display: "grid",
          placeItems: "center",
          color: "#222",
          fontWeight: 600,
          letterSpacing: "0.04em",
          fontSize: 13,
        }}
      >
        Glass over scrolling DOM (Mode C, auto-detected)
      </div>

      {/* Scrolling article content. No images, no canvases — just
          text + colorful cards. Mode C is the only way to refract
          this. */}
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "144px 32px 96px",
          lineHeight: 1.65,
        }}
      >
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>
          A page made of pure DOM
        </h1>
        <p style={{ marginBottom: 24, color: "#555" }}>
          No images. No videos. No canvases. Just headings, paragraphs,
          and colorful divs. The glass nav above refracts whatever
          slides under it as you scroll.
        </p>

        {Array.from({ length: 8 }, (_, i) => (
          <section key={i} style={{ marginBottom: 56 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Section {i + 1}
            </h2>
            <p style={{ marginBottom: 16, color: "#444" }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
              do eiusmod tempor incididunt ut labore et dolore magna
              aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
            </p>
            <div
              style={{
                marginBottom: 16,
                height: 96,
                borderRadius: 12,
                background: `hsl(${(i * 47) % 360}, 70%, 55%)`,
              }}
            />
            <p style={{ color: "#444" }}>
              Excepteur sint occaecat cupidatat non proident, sunt in
              culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </section>
        ))}
      </article>

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
        @glazelab/core/full — Mode C: rasterized DOM as backdrop
      </div>
    </div>
  );
}
