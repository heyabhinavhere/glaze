"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEventHandler,
  type Ref,
} from "react";
import { useGlazeSurface } from "./internal/surface-context";
import type {
  GlazeSegmentedControlProps,
  GlazeSliderProps,
  GlazeSwitchProps,
} from "./types";

const cx = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

function assignRef<Element>(ref: Ref<Element> | undefined, value: Element | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function useOpticalControl<Element extends HTMLElement>(
  name: string,
  selectionCount: number,
  selectedPosition: number,
  selectionVisible = true,
) {
  const surface = useGlazeSurface();
  const reactId = useId();
  const id = `${surface.capability.requested}-${name}-${reactId}`;
  const elementRef = useRef<Element>(null);
  const latest = useRef({
    selectionCount,
    selectedPosition,
    selectionVisible,
  });

  useEffect(() => {
    latest.current = { selectionCount, selectedPosition, selectionVisible };
  }, [selectedPosition, selectionCount, selectionVisible]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const current = latest.current;
    return surface.register({ id, element, ...current });
  }, [id, surface]);

  useEffect(() => {
    surface.update(
      id,
      selectionCount,
      selectedPosition,
      selectionVisible,
    );
  }, [id, selectedPosition, selectionCount, selectionVisible, surface]);

  const energize: PointerEventHandler<Element> = (event) => {
    surface.energize(id, event.buttons > 0 || event.type === "pointerenter");
  };
  const release: PointerEventHandler<Element> = () => surface.release(id);

  return {
    elementRef,
    pointerProps: {
      onPointerDown: energize,
      onPointerEnter: energize,
      onPointerMove: energize,
      onPointerCancel: release,
      onPointerLeave: release,
      onPointerUp: release,
    } satisfies Pick<
      HTMLAttributes<Element>,
      | "onPointerDown"
      | "onPointerEnter"
      | "onPointerMove"
      | "onPointerCancel"
      | "onPointerLeave"
      | "onPointerUp"
    >,
  };
}

function nextEnabledIndex(
  start: number,
  direction: 1 | -1,
  segments: GlazeSegmentedControlProps["segments"],
) {
  for (let offset = 1; offset <= segments.length; offset += 1) {
    const index = (
      start + direction * offset + segments.length
    ) % segments.length;
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

function lastEnabledIndex(
  segments: GlazeSegmentedControlProps["segments"],
) {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (!segments[index]?.disabled) return index;
  }
  return -1;
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
    onValueChange,
    segments,
    style,
    value,
    ...props
  },
  forwardedRef,
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
  const { elementRef, pointerProps } = useOpticalControl<HTMLDivElement>(
    "segmented",
    Math.max(1, segments.length),
    Math.max(0, selectedIndex),
    selectedIndex >= 0,
  );

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
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = nextEnabledIndex(index, 1, segments);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = nextEnabledIndex(index, -1, segments);
    } else if (event.key === "Home") {
      target = segments.findIndex((segment) => !segment.disabled);
    } else if (event.key === "End") {
      target = lastEnabledIndex(segments);
    } else return;
    event.preventDefault();
    const segment = segments[target];
    if (!segment) return;
    select(segment.id);
    buttonRefs.current[target]?.focus();
  };

  if (segments.length === 0) return null;

  return (
    <div
      {...props}
      ref={(node) => {
        elementRef.current = node;
        assignRef(forwardedRef, node);
      }}
      className={cx("glaze-control", "glaze-segmented", className)}
      data-glaze-control="segmented"
      data-glaze-has-selection={selectedIndex >= 0}
      data-glaze-selected-position={Math.max(0, selectedIndex)}
      style={{
        ...style,
        "--glaze-segment-count": Math.max(1, segments.length),
      } as CSSProperties}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      role="radiogroup"
      {...pointerProps}
    >
      <span aria-hidden="true" className="glaze-control__fallback" />
      {segments.map((segment, index) => {
        const selected = segment.id === selectedValue;
        return (
          <button
            key={segment.id}
            ref={(node) => { buttonRefs.current[index] = node; }}
            className="glaze-segmented__item"
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || segment.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(segment.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
});

export const GlazeSwitch = forwardRef<HTMLButtonElement, GlazeSwitchProps>(
  function GlazeSwitch(
    {
      "aria-label": ariaLabel,
      checked,
      className,
      defaultChecked = false,
      disabled,
      label,
      onCheckedChange,
      onClick,
      ...props
    },
    forwardedRef,
  ) {
    const [uncontrolledChecked, setUncontrolledChecked] = useState(
      defaultChecked,
    );
    const active = checked ?? uncontrolledChecked;
    const { elementRef, pointerProps } = useOpticalControl<HTMLButtonElement>(
      "switch",
      2,
      active ? 1 : 0,
    );
    const toggle = () => {
      if (disabled) return;
      const next = !active;
      if (checked === undefined) setUncontrolledChecked(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        {...props}
        ref={(node) => {
          elementRef.current = node;
          assignRef(forwardedRef, node);
        }}
        className={cx("glaze-control", "glaze-switch", className)}
        data-glaze-control="switch"
        type="button"
        role="switch"
        aria-label={ariaLabel}
        aria-checked={active}
        disabled={disabled}
        onClick={(event) => {
          toggle();
          onClick?.(event);
        }}
        {...pointerProps}
      >
        <span aria-hidden="true" className="glaze-control__fallback" />
        <span className="glaze-switch__label">
          {label ?? (active ? "On" : "Off")}
        </span>
      </button>
    );
  },
);

export const GlazeSlider = forwardRef<HTMLInputElement, GlazeSliderProps>(
  function GlazeSlider(
    {
      "aria-label": ariaLabel,
      className,
      defaultValue = 50,
      disabled,
      label,
      max = 100,
      min = 0,
      onInput,
      onValueChange,
      step = 1,
      style,
      value,
      ...props
    },
    forwardedRef,
  ) {
    const minimum = Number(min);
    const maximum = Math.max(minimum, Number(max));
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const requested = value ?? uncontrolledValue;
    const current = Math.min(maximum, Math.max(minimum, Number(requested)));
    const normalized = maximum === minimum
      ? 0
      : (current - minimum) / (maximum - minimum);
    const selectionCount = 6;
    const selectedPosition = normalized * (selectionCount - 1);
    const { elementRef, pointerProps } = useOpticalControl<HTMLLabelElement>(
      "slider",
      selectionCount,
      selectedPosition,
    );

    return (
      <label
        ref={elementRef}
        className={cx("glaze-control", "glaze-slider", className)}
        data-glaze-control="slider"
        data-glaze-selected-position={selectedPosition.toFixed(4)}
        style={style}
        {...pointerProps}
      >
        <span aria-hidden="true" className="glaze-control__fallback" />
        <span className="glaze-slider__label">{label ?? ariaLabel}</span>
        <output className="glaze-slider__value">{current}</output>
        <input
          {...props}
          ref={forwardedRef}
          className="glaze-slider__input"
          type="range"
          aria-label={ariaLabel}
          disabled={disabled}
          min={minimum}
          max={maximum}
          step={step}
          value={current}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            if (value === undefined) setUncontrolledValue(next);
            onValueChange?.(next);
          }}
          onInput={(event) => {
            onInput?.(event);
          }}
        />
      </label>
    );
  },
);
