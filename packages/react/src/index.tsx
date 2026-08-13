"use client";

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { glazeMaterials, resolveGlazeMaterial } from "./material";
import type {
  GlazeSegmentedControlProps,
  GlazeSurfaceProps,
} from "./types";

const cx = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

export const GlazeSurface = forwardRef<HTMLElement, GlazeSurfaceProps>(
  function GlazeSurface(
    {
      as: Component = "div",
      capability = "css",
      className,
      material = "regular",
      style,
      ...props
    },
    ref,
  ) {
    const resolved = resolveGlazeMaterial(material);
    const effectiveCapability = capability === "css" ? "css" : "css";
    const fallbackReason =
      capability === "css" ? undefined : `${capability}-not-enabled`;

    return (
      <Component
        {...props}
        ref={ref as never}
        className={cx("glaze-surface", className)}
        data-glaze-capability={effectiveCapability}
        data-glaze-fallback={fallbackReason}
        style={{ ...resolved.cssVariables, ...style }}
      />
    );
  },
);

function nextEnabledIndex(
  start: number,
  direction: 1 | -1,
  segments: GlazeSegmentedControlProps["segments"],
) {
  for (let offset = 1; offset <= segments.length; offset += 1) {
    const index = (start + direction * offset + segments.length) % segments.length;
    if (!segments[index]?.disabled) return index;
  }
  return start;
}

function resolveSelectedValue(
  requestedValue: string | undefined,
  segments: GlazeSegmentedControlProps["segments"],
) {
  const requested = segments.find(
    (segment) => segment.id === requestedValue && !segment.disabled,
  );
  return requested?.id ?? segments.find((segment) => !segment.disabled)?.id ?? "";
}

export const GlazeSegmentedControl = forwardRef<
  HTMLDivElement,
  GlazeSegmentedControlProps
>(function GlazeSegmentedControl(
  {
    "aria-label": ariaLabel,
    className,
    defaultValue,
    disabled = false,
    material = "regular",
    onValueChange,
    segments,
    style,
    value,
    ...props
  },
  ref,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? "",
  );
  const selectedValue = resolveSelectedValue(
    value ?? uncontrolledValue,
    segments,
  );
  const selectedIndex = segments.findIndex(
    (segment) => segment.id === selectedValue,
  );
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resolved = useMemo(() => resolveGlazeMaterial(material), [material]);

  const select = (id: string) => {
    if (value === undefined) setUncontrolledValue(id);
    onValueChange?.(id);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled || segments[index]?.disabled) return;
    let target = index;
    if (event.key === "ArrowRight") target = nextEnabledIndex(index, 1, segments);
    else if (event.key === "ArrowLeft") target = nextEnabledIndex(index, -1, segments);
    else if (event.key === "Home") {
      target = segments.findIndex((segment) => !segment.disabled);
    } else if (event.key === "End") {
      target = segments.findLastIndex((segment) => !segment.disabled);
    } else return;

    event.preventDefault();
    const segment = segments[target];
    if (!segment) return;
    select(segment.id);
    buttonRefs.current[target]?.focus();
  };

  if (segments.length === 0) return null;

  return (
    <GlazeSurface
      {...props}
      ref={ref as never}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cx("glaze-segmented", className)}
      data-glaze-has-selection={selectedIndex >= 0}
      material={resolved}
      role="radiogroup"
      style={
        {
          ...style,
          "--glaze-segment-count": `${segments.length}`,
          "--glaze-selected-index": `${Math.max(0, selectedIndex)}`,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="glaze-segmented__selection" />
      {segments.map((segment, index) => {
        const selected = segment.id === selectedValue;
        return (
          <button
            aria-checked={selected}
            className="glaze-segmented__item"
            disabled={disabled || segment.disabled}
            key={segment.id}
            onClick={() => select(segment.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {segment.label}
          </button>
        );
      })}
    </GlazeSurface>
  );
});

export function GlazeDiagnostics({ className }: { className?: string }) {
  const [preferences, setPreferences] = useState({
    forcedColors: false,
    reducedMotion: false,
  });

  useEffect(() => {
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setPreferences({
        forcedColors: forcedColors.matches,
        reducedMotion: reducedMotion.matches,
      });
    update();
    forcedColors.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      forcedColors.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  return (
    <dl className={cx("glaze-diagnostics", className)}>
      <div><dt>Capability</dt><dd>CSS</dd></div>
      <div><dt>Reduced motion</dt><dd>{preferences.reducedMotion ? "On" : "Off"}</dd></div>
      <div><dt>Forced colors</dt><dd>{preferences.forcedColors ? "On" : "Off"}</dd></div>
    </dl>
  );
}

export { glazeMaterials, resolveGlazeMaterial };
export type {
  GlazeCapability,
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMaterialName,
  GlazeMotion,
  GlazeSegment,
  GlazeSegmentedControlProps,
  GlazeSurfaceProps,
  ResolvedGlazeMaterial,
} from "./types";
