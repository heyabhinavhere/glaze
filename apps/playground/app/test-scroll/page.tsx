"use client";

/**
 * /test-scroll — proves the engine handles scroll-with-refraction.
 *
 * Iteration: keep the simplest possible setup so that if it works,
 * the engine is fine; if it doesn't, the bug is obvious.
 *
 *   - One <img> at natural aspect, full width (Cups — vibrant
 *     content so the refraction is obviously visible vs a dark
 *     image where black-on-black hides the effect)
 *   - Page padded below to 200vh so there's scroll distance even
 *     when the image is shorter than the viewport
 *   - Glass nav fixed at top — sticky/fixed lens handling re-reads
 *     its rect each frame
 *   - backdrop = the <img>, backdropAnchor = the same <img>.
 *     As the page scrolls, the image moves, the anchor's rect
 *     shifts, bounds traverse the full image UV from 0→1.
 *
 * If this works, we then enhance with multi-image stacks /
 * composite textures. One step at a time.
 *
 * Deletes in Phase 2 alongside the other /test-* harnesses.
 */

import { useEffect, useRef } from "react";
import { createGlass, type GlassHandle } from "@glazelab/core";

const SCROLL_IMAGE = "/backgrounds/bg-4.jpg"; // Cups — vibrant

export default function TestScrollPage() {
  const imgRef = useRef<HTMLImageElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlassHandle | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    const nav = navRef.current;
    if (!img || !nav) return;

    const mount = () => {
      handleRef.current = createGlass(nav, {
        backdrop: img,
        backdropAnchor: img,
        radius: 28,
      });
    };

    if (img.complete && img.naturalWidth > 0) {
      mount();
    } else {
      img.addEventListener("load", mount, { once: true });
    }

    return () => {
      img.removeEventListener("load", mount);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "200vh",
        background: "#0a0a0a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Fixed glass nav */}
      <div
        ref={navRef}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(640px, 90vw)",
          height: 64,
          borderRadius: 28,
          zIndex: 10,
          display: "grid",
          placeItems: "center",
          color: "white",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          fontSize: 14,
        }}
      >
        Scroll the page — glass refracts the image moving beneath
      </div>

      <img
        ref={imgRef}
        src={SCROLL_IMAGE}
        alt=""
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
      />

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
        @glazelab/core — single &lt;img&gt; (Cups), fixed glass, scroll
      </div>
    </div>
  );
}
