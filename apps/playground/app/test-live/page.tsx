"use client";

/**
 * /test-live — Mode B harness. Glass panel sits over an animated
 * <canvas> drawing drifting gradient blobs. The renderer re-uploads
 * the canvas content every frame; the lens samples through it with
 * proper backdrop refraction.
 *
 * What this proves:
 *   - HTMLCanvasElement backdrop works (Mode B live-canvas path)
 *   - backdropAnchor auto-set to the canvas element so the lens
 *     samples the right region
 *   - Live content updates frame-to-frame; the rim refraction tracks
 *     the moving content
 *
 * Deletes in Phase 2 alongside the other /test-* harnesses.
 */

import { useEffect, useRef } from "react";
import { createGlass, type GlassHandle } from "@glazelab/core";

export default function TestLivePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlassHandle | null>(null);

  // Animate the backdrop canvas — drifting colored blobs on a slate base.
  // Same fixture style as the spike's AnimatedCanvas, just inlined here.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const blobs = [
      { x: 0.20, y: 0.30, vx: 0.00010, vy: 0.00007, r: 0.32, color: "#5b8ad9" },
      { x: 0.78, y: 0.38, vx: -0.00009, vy: 0.00011, r: 0.30, color: "#d98a5b" },
      { x: 0.45, y: 0.62, vx: 0.00012, vy: -0.00008, r: 0.36, color: "#b85bd9" },
      { x: 0.62, y: 0.82, vx: -0.00007, vy: -0.00010, r: 0.28, color: "#5bd9b8" },
      { x: 0.15, y: 0.78, vx: 0.00011, vy: 0.00009, r: 0.26, color: "#d9b85b" },
      { x: 0.88, y: 0.65, vx: -0.00010, vy: -0.00011, r: 0.24, color: "#5bd9d9" },
      { x: 0.35, y: 0.15, vx: 0.00008, vy: 0.00012, r: 0.22, color: "#d95b8a" },
      { x: 0.68, y: 0.18, vx: -0.00012, vy: 0.00007, r: 0.20, color: "#8ad95b" },
    ];

    let lastT = performance.now();
    const tick = (now: number) => {
      const dt = now - lastT;
      lastT = now;
      const rect = c.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.fillStyle = "#28324a";
      ctx.fillRect(0, 0, w, h);

      for (const b of blobs) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0.1 || b.x > 0.9) b.vx = -b.vx;
        if (b.y < 0.1 || b.y > 0.9) b.vy = -b.vy;

        const cx = b.x * w;
        const cy = b.y * h;
        const radius = b.r * Math.min(w, h);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Mount glass panel over the animated canvas.
  useEffect(() => {
    if (!panelRef.current || !canvasRef.current) return;
    handleRef.current = createGlass(panelRef.current, {
      backdrop: canvasRef.current, // Mode B — live canvas
      // backdropAnchor auto-sets to the canvas element
      radius: 28,
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
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <div
        ref={panelRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          height: 180,
          borderRadius: 28,
          display: "grid",
          placeItems: "center",
          color: "white",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textShadow: "0 1px 8px rgba(0,0,0,0.4)",
        }}
      >
        Mode B — live canvas
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
        @glazelab/core 5b — animated canvas backdrop, refracted in real time
      </div>
    </div>
  );
}
