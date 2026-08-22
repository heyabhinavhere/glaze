"use client";

import {
  createContext,
  type HTMLAttributes,
  type PointerEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../component-proof.module.css";
import {
  drawAcceptedMaterialDecoration,
  drawOwnedSvgSource,
  drawVideoSource,
  inspectOwnedDecoration,
} from "../_lib/source-contract";
import type {
  OpticalControlRegistration,
  OpticalSurfaceDiagnostics,
  OpticalSurfaceRenderer,
} from "../_lib/optical-surface-renderer";

type SourceCapability = "owned-decoration" | "explicit-media";
type EffectiveCapability = SourceCapability | "css-fallback";
type RendererState = "initializing" | "webgl" | "fallback";

interface SurfaceSnapshot {
  readonly requested: SourceCapability;
  readonly effective: EffectiveCapability;
  readonly reason?: string;
  readonly renderer?: OpticalSurfaceDiagnostics;
}

interface ProofSurfaceHandle {
  getDiagnostics(): SurfaceSnapshot;
  forceContextLoss(): void;
}

interface ComponentProofHarness {
  readonly surfaces: Partial<Record<SourceCapability, ProofSurfaceHandle>>;
  inspectOwnedDecoration(root: HTMLElement): {
    readonly valid: boolean;
    readonly reasons: readonly string[];
  };
}

declare global {
  interface Window {
    __glazeComponentProof?: ComponentProofHarness;
  }
}

interface SurfaceRegistry {
  readonly capability: SourceCapability;
  register(registration: OpticalControlRegistration): () => void;
  update(id: string, selectionCount: number, selectedPosition: number): void;
  energize(id: string, active: boolean): void;
  release(id: string): void;
}

const SurfaceRegistryContext = createContext<SurfaceRegistry | null>(null);

function useSurfaceRegistry(): SurfaceRegistry {
  const registry = useContext(SurfaceRegistryContext);
  if (!registry) throw new Error("optical-control-requires-surface");
  return registry;
}

function useOpticalControl<Element extends HTMLElement>(
  name: string,
  selectionCount: number,
  selectedPosition: number,
) {
  const registry = useSurfaceRegistry();
  const reactId = useId();
  const id = `${registry.capability}-${name}-${reactId}`;
  const elementRef = useRef<Element>(null);
  const latestRegistration = useRef({ selectionCount, selectedPosition });

  useEffect(() => {
    latestRegistration.current = { selectionCount, selectedPosition };
  }, [selectedPosition, selectionCount]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const current = latestRegistration.current;
    return registry.register({
      id,
      element,
      selectionCount: current.selectionCount,
      selectedPosition: current.selectedPosition,
    });
  }, [id, registry]);

  useEffect(() => {
    registry.update(id, selectionCount, selectedPosition);
  }, [id, registry, selectedPosition, selectionCount]);

  const energize: PointerEventHandler<Element> = (event) => {
    registry.energize(id, event.buttons > 0 || event.type === "pointerenter");
  };
  const release: PointerEventHandler<Element> = () => registry.release(id);

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

function ensureHarness(): ComponentProofHarness {
  window.__glazeComponentProof ??= {
    surfaces: {},
    inspectOwnedDecoration: (root) => {
      const inspection = inspectOwnedDecoration(root);
      return { valid: inspection.valid, reasons: inspection.reasons };
    },
  };
  return window.__glazeComponentProof;
}

interface OpticalSurfaceProps {
  readonly capability: SourceCapability;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

function OpticalSurface({
  capability,
  eyebrow,
  title,
  description,
  children,
}: OpticalSurfaceProps) {
  const stageRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const materialDecorationRef = useRef<HTMLCanvasElement>(null);
  const ownedInputRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<OpticalSurfaceRenderer | null>(null);
  const pendingControlsRef = useRef(
    new Map<string, OpticalControlRegistration>(),
  );
  const requestFrameRef = useRef<(() => void) | null>(null);
  const rendererStateRef = useRef<RendererState>("initializing");
  const fallbackReasonRef = useRef("renderer-initializing");
  const [rendererState, setRendererState] = useState<RendererState>(
    "initializing",
  );
  const [fallbackReason, setFallbackReason] = useState(
    "renderer-initializing",
  );

  const register = useCallback(
    (registration: OpticalControlRegistration) => {
      pendingControlsRef.current.set(registration.id, registration);
      rendererRef.current?.registerControl(registration);
      return () => {
        pendingControlsRef.current.delete(registration.id);
        rendererRef.current?.unregisterControl(registration.id);
      };
    },
    [],
  );
  const update = useCallback(
    (id: string, selectionCount: number, selectedPosition: number) => {
      const pending = pendingControlsRef.current.get(id);
      if (pending) {
        pendingControlsRef.current.set(id, {
          ...pending,
          selectionCount,
          selectedPosition,
        });
      }
      rendererRef.current?.updateControl(
        id,
        selectionCount,
        selectedPosition,
      );
    },
    [],
  );
  const energize = useCallback((id: string, active: boolean) => {
    rendererRef.current?.setPointer(id, active);
  }, []);
  const release = useCallback((id: string) => {
    rendererRef.current?.releasePointer(id);
  }, []);
  const registry = useMemo<SurfaceRegistry>(
    () => ({ capability, register, update, energize, release }),
    [capability, energize, register, release, update],
  );

  useEffect(() => {
    const stage = stageRef.current;
    const source = sourceRef.current;
    const output = outputRef.current;
    const materialDecoration = materialDecorationRef.current;
    const ownedInput = ownedInputRef.current;
    const video = videoRef.current;
    if (!stage || !source || !output || !materialDecoration) return;

    let destroyed = false;
    let frameId = 0;
    let videoFrameId = 0;
    let sourceDirty = false;
    let visible = true;
    let sourcePaintVersion = 0;
    let initializationStarted = false;
    let warnedInvalidSource = false;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const search = new URLSearchParams(window.location.search);
    if (ownedInput && search.has("invalidOwned")) {
      ownedInput
        .querySelector("svg")
        ?.setAttribute("id", "invalid-owned-decoration-test-fixture");
    }

    const setState = (state: RendererState, reason?: string) => {
      if (destroyed) return;
      rendererStateRef.current = state;
      if (reason) fallbackReasonRef.current = reason;
      setRendererState(state);
      if (reason) setFallbackReason(reason);
    };

    const handleFallback = (reason: string) => setState("fallback", reason);

    const frame = (time: number) => {
      frameId = 0;
      if (destroyed || !visible || document.hidden) return;
      const result = rendererRef.current?.render(
        time,
        reducedMotion.matches,
        sourceDirty,
      );
      sourceDirty = false;
      if (result?.rendered && rendererStateRef.current === "initializing") {
        setState("webgl");
      }
      if (result?.needsFrame) scheduleFrame();
    };

    const scheduleFrame = (dirty = false) => {
      if (dirty) sourceDirty = true;
      if (destroyed || frameId !== 0 || !visible || document.hidden) return;
      frameId = window.requestAnimationFrame(frame);
    };
    requestFrameRef.current = () => scheduleFrame();

    const paintOwnedSource = async () => {
      if (!ownedInput) return false;
      const version = ++sourcePaintVersion;
      try {
        const inspection = await drawOwnedSvgSource(source, ownedInput);
        if (destroyed) return false;
        if (version !== sourcePaintVersion) {
          // A newer resize/intersection paint owns the source now. It will
          // schedule the upload; this superseded request is not a failure.
          return true;
        }
        if (!inspection.valid) {
          if (
            process.env.NODE_ENV !== "production"
            && !warnedInvalidSource
          ) {
            warnedInvalidSource = true;
            console.warn(
              "[Glaze] Invalid owned-decoration source:",
              inspection.reasons,
            );
          }
          handleFallback(inspection.reasons.join(","));
          return false;
        }
        scheduleFrame(true);
        return true;
      } catch (error) {
        handleFallback(
          error instanceof Error
            ? error.message
            : "owned-decoration-render-failed",
        );
        return false;
      }
    };

    const paintVideoSource = () => {
      if (!video) return false;
      try {
        const painted = drawVideoSource(source, video);
        if (painted) scheduleFrame(true);
        return painted;
      } catch (error) {
        handleFallback(
          error instanceof DOMException && error.name === "SecurityError"
            ? "source-not-origin-clean"
            : error instanceof Error
              ? error.message
              : "explicit-media-render-failed",
        );
        return false;
      }
    };

    const cancelVideoFrame = () => {
      if (!video || videoFrameId === 0) return;
      video.cancelVideoFrameCallback?.(videoFrameId);
      videoFrameId = 0;
    };
    const armVideoFrame = () => {
      if (
        !video
        || typeof video.requestVideoFrameCallback !== "function"
        || videoFrameId !== 0
        || video.paused
        || video.ended
        || !visible
        || document.hidden
      ) {
        return;
      }
      videoFrameId = video.requestVideoFrameCallback(() => {
        videoFrameId = 0;
        if (paintVideoSource()) armVideoFrame();
      });
    };

    const initialize = async () => {
      if (initializationStarted || rendererRef.current) return;
      initializationStarted = true;
      if (search.has("disableOptics")) {
        handleFallback("optics-disabled-by-test");
        if (capability === "owned-decoration") await paintOwnedSource();
        else paintVideoSource();
        return;
      }

      drawAcceptedMaterialDecoration(materialDecoration);
      if (capability === "owned-decoration") {
        if (!(await paintOwnedSource())) return;
      } else if (!paintVideoSource()) {
        initializationStarted = false;
        return;
      }
      if (destroyed) return;

      try {
        const { OpticalSurfaceRenderer: Renderer } = await import(
          "../_lib/optical-surface-renderer"
        );
        if (destroyed) return;
        const renderer = new Renderer({
          canvas: output,
          source,
          ownedDecoration: materialDecoration,
          onFallback: handleFallback,
          onRequestFrame: () => scheduleFrame(),
        });
        rendererRef.current = renderer;
        for (const registration of pendingControlsRef.current.values()) {
          renderer.registerControl(registration);
        }
        scheduleFrame(true);
      } catch (error) {
        handleFallback(
          error instanceof Error
            ? error.message
            : "renderer-initialization-failed",
        );
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (capability === "owned-decoration") void paintOwnedSource();
      else paintVideoSource();
    });
    resizeObserver.observe(stage);

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (!visible) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        cancelVideoFrame();
      } else {
        if (capability === "owned-decoration") void paintOwnedSource();
        else paintVideoSource();
        scheduleFrame();
        armVideoFrame();
      }
    });
    intersectionObserver.observe(stage);

    const handleVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        cancelVideoFrame();
      } else if (visible) {
        if (capability === "owned-decoration") void paintOwnedSource();
        else paintVideoSource();
        scheduleFrame();
        armVideoFrame();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const handleReducedMotion = () => scheduleFrame();
    reducedMotion.addEventListener("change", handleReducedMotion);

    const handleVideoReady = () => {
      if (!video) return;
      const current = new URL(video.currentSrc || video.src, window.location.href);
      if (current.origin !== window.location.origin) {
        handleFallback("explicit-media-must-be-same-origin");
        return;
      }
      if (paintVideoSource() && !rendererRef.current) void initialize();
      void video.play().catch(() => undefined);
      armVideoFrame();
    };
    const handleVideoFrameWithoutRvfc = () => {
      if (!video?.requestVideoFrameCallback) paintVideoSource();
    };
    const handleVideoError = () => handleFallback("explicit-media-load-failed");
    if (video) {
      video.addEventListener("loadeddata", handleVideoReady);
      video.addEventListener("play", armVideoFrame);
      video.addEventListener("pause", cancelVideoFrame);
      video.addEventListener("seeked", paintVideoSource);
      video.addEventListener("timeupdate", handleVideoFrameWithoutRvfc);
      video.addEventListener("error", handleVideoError);
    }

    const handle: ProofSurfaceHandle = {
      getDiagnostics: () => ({
        requested: capability,
        effective:
          rendererStateRef.current === "webgl"
            ? capability
            : "css-fallback",
        reason:
          rendererStateRef.current === "webgl"
            ? undefined
            : fallbackReasonRef.current,
        renderer: rendererRef.current?.getDiagnostics(),
      }),
      forceContextLoss: () => rendererRef.current?.forceContextLoss(),
    };
    ensureHarness().surfaces[capability] = handle;

    if (
      capability === "owned-decoration"
      || (video?.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      void initialize();
    }

    return () => {
      destroyed = true;
      sourcePaintVersion += 1;
      window.cancelAnimationFrame(frameId);
      cancelVideoFrame();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleReducedMotion);
      if (video) {
        video.removeEventListener("loadeddata", handleVideoReady);
        video.removeEventListener("play", armVideoFrame);
        video.removeEventListener("pause", cancelVideoFrame);
        video.removeEventListener("seeked", paintVideoSource);
        video.removeEventListener("timeupdate", handleVideoFrameWithoutRvfc);
        video.removeEventListener("error", handleVideoError);
      }
      rendererRef.current?.destroy();
      rendererRef.current = null;
      requestFrameRef.current = null;
      const harness = window.__glazeComponentProof;
      if (harness?.surfaces[capability] === handle) {
        delete harness.surfaces[capability];
      }
    };
  }, [capability]);

  const effectiveCapability: EffectiveCapability =
    rendererState === "webgl" ? capability : "css-fallback";

  return (
    <article
      ref={stageRef}
      className={styles.surface}
      data-capability-requested={capability}
      data-capability-effective={effectiveCapability}
      data-renderer={rendererState}
      data-fallback-reason={
        rendererState === "fallback" ? fallbackReason : undefined
      }
    >
      {capability === "owned-decoration" ? (
        <div
          ref={ownedInputRef}
          className={styles.ownedInput}
          data-owned-decoration-input="true"
          aria-hidden="true"
          inert
        >
          <OwnedDecorationArtwork />
        </div>
      ) : (
        <video
          ref={videoRef}
          className={styles.mediaInput}
          data-explicit-media-input="video"
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/m1-flower.webm" type="video/webm" />
          <source src="/m1-flower.mp4" type="video/mp4" />
        </video>
      )}
      <canvas
        ref={sourceRef}
        className={styles.source}
        data-optical-source={capability}
        aria-hidden="true"
      />
      <canvas
        ref={materialDecorationRef}
        className={styles.materialDecoration}
        data-material-decoration="accepted-kernel"
        aria-hidden="true"
      />
      <canvas
        ref={outputRef}
        className={styles.output}
        data-optical-output={capability}
        aria-hidden="true"
      />

      <header className={styles.surfaceHeader}>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </header>

      <SurfaceRegistryContext.Provider value={registry}>
        <div className={styles.controls}>{children}</div>
      </SurfaceRegistryContext.Provider>

      <footer className={styles.surfaceFooter}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span aria-live="polite">
          {rendererState === "webgl"
            ? `Active · ${capability} · one shared renderer`
            : rendererState === "fallback"
              ? `CSS fallback · ${fallbackReason}`
              : "Renderer initializing"}
        </span>
      </footer>
    </article>
  );
}

function OwnedDecorationArtwork() {
  const verticals = Array.from({ length: 17 }, (_, index) => index * 60);
  const horizontals = Array.from({ length: 13 }, (_, index) => index * 60);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="960"
      height="720"
      viewBox="0 0 960 720"
    >
      <rect width="960" height="720" fill="#11213b" />
      <circle cx="760" cy="120" r="270" fill="#df5d8a" opacity="0.82" />
      <circle cx="180" cy="610" r="330" fill="#176f91" opacity="0.9" />
      <path
        d="M-80 440 C180 180 420 640 1040 230 L1040 820 L-80 820 Z"
        fill="#edb549"
        opacity="0.56"
      />
      <path
        d="M-90 160 C220 420 610 -20 1050 360"
        fill="none"
        stroke="#f7e7ae"
        strokeWidth="18"
        opacity="0.82"
      />
      <g stroke="#f2fbff" strokeWidth="1" opacity="0.28">
        {verticals.map((x) => <path key={`v-${x}`} d={`M${x} 0 V720`} />)}
        {horizontals.map((y) => <path key={`h-${y}`} d={`M0 ${y} H960`} />)}
      </g>
      <g fill="#f8fdff" opacity="0.76">
        <rect x="74" y="82" width="280" height="12" rx="6" />
        <rect x="74" y="112" width="188" height="7" rx="3.5" />
        <rect x="706" y="580" width="174" height="9" rx="4.5" />
        <rect x="752" y="610" width="128" height="6" rx="3" />
      </g>
    </svg>
  );
}

const SEGMENTS = ["Focus", "Flow", "Form"] as const;

function SegmentedControl() {
  const [selected, setSelected] = useState(1);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { elementRef, pointerProps } = useOpticalControl<HTMLDivElement>(
    "segmented",
    SEGMENTS.length,
    selected,
  );

  const select = (index: number, focus = false) => {
    setSelected(index);
    if (focus) optionRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = selected;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (selected + 1) % SEGMENTS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (selected - 1 + SEGMENTS.length) % SEGMENTS.length;
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SEGMENTS.length - 1;
    else return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <div
      ref={elementRef}
      className={`${styles.opticalControl} ${styles.segmented}`}
      data-control="segmented"
      data-selected-position={selected}
      role="radiogroup"
      aria-label="View mode"
      onKeyDown={handleKeyDown}
      {...pointerProps}
    >
      <span className={styles.fallbackSurface} aria-hidden="true" />
      {SEGMENTS.map((segment, index) => (
        <button
          ref={(node) => { optionRefs.current[index] = node; }}
          key={segment}
          type="button"
          role="radio"
          aria-checked={selected === index}
          tabIndex={selected === index ? 0 : -1}
          onClick={() => select(index)}
        >
          {segment}
        </button>
      ))}
    </div>
  );
}

function SwitchControl() {
  const [checked, setChecked] = useState(true);
  const { elementRef, pointerProps } = useOpticalControl<HTMLButtonElement>(
    "switch",
    2,
    checked ? 1 : 0,
  );
  return (
    <div className={styles.controlRow}>
      <span>Live optics</span>
      <button
        ref={elementRef}
        className={`${styles.opticalControl} ${styles.switch}`}
        data-control="switch"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Live optics"
        onClick={() => setChecked((current) => !current)}
        {...pointerProps}
      >
        <span className={styles.fallbackSurface} aria-hidden="true" />
        <span className={styles.switchState} aria-hidden="true">
          {checked ? "On" : "Off"}
        </span>
      </button>
    </div>
  );
}

function SliderControl() {
  const [value, setValue] = useState(62);
  const selectionCount = 6;
  const selectedPosition = (value / 100) * (selectionCount - 1);
  const { elementRef, pointerProps } = useOpticalControl<HTMLLabelElement>(
    "slider",
    selectionCount,
    selectedPosition,
  );
  return (
    <label
      ref={elementRef}
      className={`${styles.opticalControl} ${styles.slider}`}
      data-control="slider"
      data-selected-position={selectedPosition.toFixed(3)}
      {...pointerProps}
    >
      <span className={styles.fallbackSurface} aria-hidden="true" />
      <span className={styles.sliderLabel}>Transmission</span>
      <output>{value}%</output>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        aria-label="Transmission"
        onChange={(event) => setValue(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function SurfaceControls() {
  return (
    <>
      <SegmentedControl />
      <div className={styles.lowerControls}>
        <SwitchControl />
        <SliderControl />
      </div>
    </>
  );
}

export function ComponentSystemProof() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <p>Glaze / component-system gate</p>
        <h1>One accepted material. Two truthful sources.</h1>
        <span>
          Segmented control, switch, and slider share one renderer per source.
        </span>
      </header>

      <section className={styles.proofGrid} aria-label="Capability proof matrix">
        <OpticalSurface
          capability="owned-decoration"
          eyebrow="Capability 01"
          title="Owned decoration"
          description="Inert React SVG · serialized by contract"
        >
          <SurfaceControls />
        </OpticalSurface>
        <OpticalSurface
          capability="explicit-media"
          eyebrow="Capability 02"
          title="Explicit media"
          description="Same-origin live video · one shared texture"
        >
          <SurfaceControls />
        </OpticalSurface>
      </section>

      <footer className={styles.pageFooter}>
        <span>Accepted optical constants unchanged</span>
        <span>No DOM capture · no duplicated controls · no idle loop</span>
      </footer>
    </main>
  );
}
