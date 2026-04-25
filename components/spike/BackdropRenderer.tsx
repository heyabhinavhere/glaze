"use client";

import { useEffect, useRef } from "react";
import type { BackdropDef } from "@/lib/spike/rim-config";

interface Props {
  backdrop: BackdropDef;
  /** Marks this element / descendants to be ignored by html2canvas-style
   *  backdrop captures in the WebGL path. Matches the existing playground's
   *  convention so we can hot-swap captures later. */
  ignoreAttribute?: string;
}

/**
 * Renders the chosen backdrop filling its container. The rim-engine overlays
 * sit on top and sample from whatever this produces. Kinds:
 *
 *   - image: a fixed-cover <div> with background-image
 *   - canvas: an animated 2D canvas (gradient blobs drifting) — exercises
 *     "live content" so we can verify the rim holds up frame-to-frame
 *   - scroll: a tall scrollable article (lorem text + inline images) —
 *     exercises "content moves under a fixed rim"
 */
export function BackdropRenderer({ backdrop, ignoreAttribute }: Props) {
  const extra = ignoreAttribute ? { [ignoreAttribute]: true } : {};

  if (backdrop.kind === "image") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backdrop.src})` }}
        {...extra}
      />
    );
  }

  if (backdrop.kind === "canvas") {
    return <AnimatedCanvas extra={extra} />;
  }

  if (backdrop.kind === "scroll") {
    return <ScrollingArticle extra={extra} />;
  }

  return null;
}

/* ------------------------------------------------------------------------ */
/* Animated canvas — colored gradient blobs drifting. Fast, cheap, gives the */
/* rim engine lots of color variance to refract through. No deps.            */
/* ------------------------------------------------------------------------ */

function AnimatedCanvas({ extra }: { extra: Record<string, unknown> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Eight drifting blobs of varied size + mid-saturation hue. Numerous
    // enough that the rim displacement always has *something* to bend
    // (the v2 attempt with 3 huge soft blobs was so smooth that refraction
    // shifts by a few px landed on visually-identical sample colours, so
    // the rim character disappeared). Saturation kept moderate so the
    // chromatic dispersion stays in liquid-glass territory rather than
    // turning into rainbow streaks.
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

      // Mid slate base — gives the rim's refraction a neutral floor to
      // bend at, but bright enough that the blobs' shifts are visible
      // against it (a very-dark base would make blobs the only visible
      // thing, so refraction outside blob regions looks flat).
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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      {...extra}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Scrolling article — long content that scrolls under the fixed glass      */
/* panel. Verifies the "rim holds up while content moves" use case.          */
/* ------------------------------------------------------------------------ */

function ScrollingArticle({ extra }: { extra: Record<string, unknown> }) {
  // Inline styles instead of Tailwind gradient classes — html2canvas
  // doesn't reliably resolve `--tw-gradient-*` CSS custom properties, so
  // a Tailwind `bg-gradient-to-b` element captures as flat colour. Plain
  // CSS `linear-gradient(…)` round-trips fine.
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-y-scroll"
      style={{ background: "linear-gradient(to bottom, #0f172a, #334155)" }}
      {...extra}
    >
      <div
        style={{
          padding: "48px 32px",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1
          style={{
            marginBottom: 24,
            fontSize: 36,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          Rim engine test — scroll me
        </h1>
        {Array.from({ length: 20 }, (_, i) => (
          <section key={i} style={{ marginBottom: 40 }}>
            <h2
              style={{
                marginBottom: 12,
                fontSize: 20,
                fontWeight: 600,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              Section {i + 1}
            </h2>
            <p style={{ marginBottom: 12, lineHeight: 1.65 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
            <div
              style={{
                marginBottom: 12,
                height: 128,
                borderRadius: 8,
                background: `linear-gradient(${i * 17}deg, hsl(${(i * 40) % 360}, 70%, 55%), hsl(${(i * 40 + 60) % 360}, 70%, 45%))`,
              }}
            />
            <p style={{ lineHeight: 1.65 }}>
              Excepteur sint occaecat cupidatat non proident, sunt in culpa
              qui officia deserunt mollit anim id est laborum.
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
