"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { playTick } from "@/lib/tick";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Number of dot markers to render across the track (e.g. for 0–10 discrete steps). */
  dots?: number;
  /** True if this parameter was manually overridden vs. derived from a parent control. */
  isOverridden?: boolean;
  /** Callback to clear the override. Required if `isOverridden` can be true. */
  onReset?: () => void;
  onChange: (value: number) => void;
}

/**
 * Pill-shaped slider: the entire row is the track. Label sits left, value
 * right. A lighter band fills 0 → current value; a thin vertical handle bar
 * marks the current position. Click or drag anywhere in the pill to change
 * the value. Arrow keys step ±step; Shift+arrow steps ±5×step.
 *
 * When `isOverridden` is true, a tiny reset icon appears next to the value
 * on hover — clicking it invokes `onReset()` to return to the derived value.
 */
export function PillSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  dots,
  isOverridden,
  onReset,
  onChange,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // Tracks the most recent value emitted by either props or user interaction.
  // Updated every render so ticks only fire on genuine changes.
  const lastEmitted = useRef(value);
  lastEmitted.current = value;

  const clamp = (v: number) => Math.min(Math.max(v, min), max);
  const snap = (v: number) =>
    step > 0 ? Math.round(v / step) * step : v;

  /** Emit a value change. Only fires the audible tick when the snapped value
   *  actually differs from the most recent one, so dragging within a single
   *  step stays silent. */
  const emit = useCallback(
    (next: number) => {
      const snapped = clamp(snap(next));
      if (snapped === lastEmitted.current) return;
      lastEmitted.current = snapped;
      playTick();
      onChange(snapped);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step, onChange],
  );

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const raw = min + t * (max - min);
      emit(raw);
    },
    [emit, min, max],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromPointer(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromPointer(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // releasing an already-released pointer throws on some browsers
    }
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = (e.shiftKey ? 5 : 1) * step;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      emit(value - s);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      emit(value + s);
    } else if (e.key === "Home") {
      e.preventDefault();
      emit(min);
    } else if (e.key === "End") {
      e.preventDefault();
      emit(max);
    }
  };

  const percent = ((clamp(value) - min) / (max - min)) * 100;
  const display =
    step > 0 && step < 1
      ? value.toFixed(1)
      : Math.round(value).toString();

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={`group relative flex h-9 w-full cursor-pointer touch-none select-none items-center overflow-hidden rounded-xl transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40 ${
        dragging
          ? "bg-white/[0.08]"
          : "bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      {/* Progress fill (0 → current value) */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.06]"
        style={{ width: `${percent}%` }}
      />

      {/* Dot markers (optional — for discrete low-step ranges) */}
      {dots && dots > 0 ? (
        <div className="pointer-events-none absolute inset-y-0 flex w-full items-center">
          {Array.from({ length: dots }, (_, i) => {
            const p = ((i + 0.5) / dots) * 100;
            return (
              <span
                key={i}
                aria-hidden
                className="absolute h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/15"
                style={{ left: `${p}%` }}
              />
            );
          })}
        </div>
      ) : null}

      {/* Handle indicator — thin vertical bar at current position */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[22%] bottom-[22%] w-[2px] rounded-full bg-white/85"
        style={{ left: `calc(${percent}% - 1px)` }}
      />

      {/* Label (left) */}
      <span className="pointer-events-none relative z-10 pl-3.5 text-[13px] text-white/80">
        {label}
      </span>

      {/* Reset icon (appears on hover when overridden) + value (right) */}
      <div className="relative z-10 ml-auto flex items-center gap-1.5 pr-3.5">
        {isOverridden && onReset ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-4 w-4 items-center justify-center rounded text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white"
            title="Reset to auto"
          >
            <RotateCcw size={10} />
          </button>
        ) : null}
        <span className="pointer-events-none font-mono text-[12.5px] tabular-nums text-white/90">
          {display}
          {suffix}
        </span>
      </div>
    </div>
  );
}
