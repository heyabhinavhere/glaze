"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorInput, HexColorPicker } from "react-colorful";

interface Props {
  label: string;
  /** Hex color (e.g. "#ffffff"). */
  color: string;
  onChange: (color: string) => void;
}

const POPOVER_W = 240;
const POPOVER_H = 264;
const POPOVER_GAP = 8;

/**
 * Color-input pill: pill-shaped row with a label on the left, hex value and
 * circular swatch on the right. Clicking opens a dark-theme popover with
 * a sat/val area, hue slider, and hex input — styled to match the rest of
 * the control panel. Popover is portal-rendered to `document.body` so it
 * can escape the panel's `overflow-hidden` clip.
 */
export function ColorPill({ label, color, onChange }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const positionPopover = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Prefer below the pill, right-aligned with its edge.
    let top = r.bottom + POPOVER_GAP;
    let left = r.right - POPOVER_W;
    // Flip above if it would overflow viewport bottom.
    if (top + POPOVER_H > window.innerHeight - POPOVER_GAP) {
      top = r.top - POPOVER_H - POPOVER_GAP;
    }
    // Clamp so it doesn't overflow left.
    if (left < POPOVER_GAP) left = POPOVER_GAP;
    // Clamp so it doesn't overflow right.
    if (left + POPOVER_W > window.innerWidth - POPOVER_GAP) {
      left = window.innerWidth - POPOVER_GAP - POPOVER_W;
    }
    setPos({ top, left });
  };

  // Re-position synchronously on open so there's no flash at (0,0).
  useLayoutEffect(() => {
    if (open) positionPopover();
  }, [open]);

  // Close on outside click and Escape. Also reposition on scroll/resize so
  // the popover stays anchored to the pill.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const pop = popoverRef.current;
      const btn = buttonRef.current;
      const target = e.target as Node;
      if (pop?.contains(target) || btn?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => positionPopover();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-full items-center rounded-xl px-3.5 transition-colors ${
          open ? "bg-white/[0.08]" : "bg-white/[0.04] hover:bg-white/[0.06]"
        }`}
      >
        <span className="text-[13px] text-white/80">{label}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="font-mono text-[11px] uppercase tabular-nums text-white/55">
            {color}
          </span>
          <span
            aria-hidden
            className="h-[18px] w-[18px] rounded-full border border-white/15 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
            style={{ background: color }}
          />
        </div>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="glaze-color-popover fixed z-50"
              style={{
                top: pos.top,
                left: pos.left,
                width: POPOVER_W,
              }}
              role="dialog"
              aria-label={`${label} color picker`}
            >
              <HexColorPicker color={color} onChange={onChange} />
              <div className="mt-3 flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-white/45">
                  Hex
                </span>
                <HexColorInput
                  color={color}
                  onChange={onChange}
                  prefixed
                  className="glaze-hex-input flex-1"
                  aria-label={`${label} hex`}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
