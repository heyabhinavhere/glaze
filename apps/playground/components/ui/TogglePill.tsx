"use client";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Toggle pill: pill-shaped row with label on the left and an iOS-style
 * switch on the right. Whole pill is clickable.
 */
export function TogglePill({ label, value, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex h-9 w-full items-center rounded-xl bg-white/[0.04] px-3.5 text-left transition-colors hover:bg-white/[0.06]"
      aria-pressed={value}
    >
      <span className="text-[13px] text-white/80">{label}</span>
      <span
        aria-hidden
        className={`relative ml-auto h-[18px] w-[30px] rounded-full transition-colors ${
          value ? "bg-[#3b82f6]" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-[3px] h-3 w-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-all ${
            value ? "left-[15px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
