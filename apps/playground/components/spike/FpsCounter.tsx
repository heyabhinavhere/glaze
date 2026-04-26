"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Label shown next to the counter (e.g. "WebGL", "SVG"). */
  label: string;
  /** When true, the underlying rAF loop is running and we're sampling. */
  active?: boolean;
}

/**
 * Sliding-window frame-time counter. Measures time between paints via
 * requestAnimationFrame, converts to FPS, reports 1% low (worst frame in
 * the last ~1s) so we catch jank the average hides.
 *
 * Not perfectly accurate for GPU-bound work (rAF fires after composite,
 * not after GPU finish) but good enough to tell "60 fps" from "30 fps"
 * and to spot single-digit dips.
 *
 * Pure display component. Each of the two rim engines runs its own
 * instance so the spike can show side-by-side perf without cross-talk.
 */
export function FpsCounter({ label, active = true }: Props) {
  const [avgFps, setAvgFps] = useState(0);
  const [lowFps, setLowFps] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastTRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let cancelled = false;
    lastTRef.current = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = now - lastTRef.current;
      lastTRef.current = now;
      const times = frameTimesRef.current;
      times.push(dt);
      // Keep a ~1-second sliding window (assume ≥30fps → ≤33 entries).
      while (times.length > 60) times.shift();

      if (times.length >= 15) {
        const sum = times.reduce((a, b) => a + b, 0);
        const avg = 1000 / (sum / times.length);
        const worst = Math.max(...times);
        const low = 1000 / worst;
        // Throttle React updates so the counter itself doesn't cost frames.
        if (Math.abs(avg - avgFps) > 0.5 || Math.abs(low - lowFps) > 0.5) {
          setAvgFps(avg);
          setLowFps(low);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, avgFps, lowFps]);

  const color =
    avgFps >= 58 ? "text-emerald-400"
    : avgFps >= 45 ? "text-amber-400"
    : "text-rose-400";

  return (
    <div className="flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-[11px] font-mono tabular-nums text-white/80 backdrop-blur-sm">
      <span className="text-white/50">{label}</span>
      <span className={color}>{avgFps.toFixed(0)} avg</span>
      <span className="text-white/40">·</span>
      <span className="text-white/60">{lowFps.toFixed(0)} low</span>
    </div>
  );
}
