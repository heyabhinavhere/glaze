"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible section for the control panel. Small uppercase header with a
 * chevron; grid-template-rows trick for smooth height animation without
 * measuring content.
 */
export function Section({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pt-5 first:pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 mb-2 flex w-[calc(100%+0.5rem)] items-center justify-between rounded-md px-1 py-1.5 text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/50">
          {title}
        </span>
        <ChevronDown
          size={12}
          className={`text-white/35 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      <div
        className="grid overflow-hidden transition-[grid-template-rows] duration-250 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
