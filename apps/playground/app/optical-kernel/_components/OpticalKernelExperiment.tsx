"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../optical-kernel.module.css";
import {
  drawOwnedDecoration,
  drawOpticalSource,
  OPTICAL_MAP_CONTRACT,
  OpticalKernelRenderer,
  OPTICAL_KERNEL_BACKGROUNDS,
  OPTICAL_KERNEL_OPTIONS,
  resizeSourceCanvas,
  type OpticalKernelBackground,
  type OpticalKernelBackgroundId,
} from "../_lib/optical-kernel-renderer";

type RendererState = "initializing" | "webgl" | "fallback";
const INITIAL_SELECTED_INDEX = 1;

declare global {
  interface Window {
    __glazeOpticalKernel?: OpticalKernelRenderer;
  }
}

export function OpticalKernelExperiment() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const ownedDecorationRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OpticalKernelRenderer | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const backgroundOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const backgroundRef = useRef<OpticalKernelBackground>(OPTICAL_KERNEL_BACKGROUNDS[0]);
  const backgroundImagesRef = useRef<Partial<Record<OpticalKernelBackgroundId, HTMLImageElement>>>({});
  const requestSourceRenderRef = useRef<(() => void) | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(INITIAL_SELECTED_INDEX);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [readyBackgrounds, setReadyBackgrounds] = useState<ReadonlySet<OpticalKernelBackgroundId>>(
    () => new Set<OpticalKernelBackgroundId>(["reference"]),
  );
  const [rendererState, setRendererState] = useState<RendererState>("initializing");
  const [fallbackReason, setFallbackReason] = useState("renderer-initializing");

  const selectedBackground = OPTICAL_KERNEL_BACKGROUNDS[backgroundIndex];

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = [];

    for (const background of OPTICAL_KERNEL_BACKGROUNDS) {
      if (background.kind !== "image") continue;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (cancelled) return;
        backgroundImagesRef.current[background.id] = image;
        setReadyBackgrounds((current) => new Set(current).add(background.id));
        if (backgroundRef.current.id === background.id) {
          requestSourceRenderRef.current?.();
        }
      };
      image.src = background.src;
      images.push(image);
    }

    return () => {
      cancelled = true;
      for (const image of images) image.onload = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const source = sourceRef.current;
    const ownedDecoration = ownedDecorationRef.current;
    const output = outputRef.current;
    const control = controlRef.current;
    if (!stage || !source || !ownedDecoration || !output || !control) return;

    let animationFrame = 0;
    let destroyed = false;
    let sourceDirty = true;
    let announcedWebGL = false;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleFallback = (reason: string) => {
      if (destroyed) return;
      setFallbackReason(reason);
      setRendererState("fallback");
    };

    const scheduleFrame = () => {
      if (destroyed || animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(frame);
    };

    const requestSourceRender = () => {
      sourceDirty = true;
      scheduleFrame();
    };

    const frame = (time: number) => {
      animationFrame = 0;
      if (destroyed) return;
      const renderer = rendererRef.current;
      if (!renderer) return;

      if (sourceDirty) {
        const context = resizeSourceCanvas(source);
        if (!context) return;
        const background = backgroundRef.current;
        drawOpticalSource(
          source,
          context,
          time,
          reducedMotionQuery.matches,
          background,
          backgroundImagesRef.current[background.id],
        );
      }

      const result = renderer.render(
        time,
        reducedMotionQuery.matches,
        sourceDirty,
      );
      sourceDirty = false;
      if (result.rendered && !announcedWebGL) {
        announcedWebGL = true;
        setRendererState("webgl");
      }
      if (result.needsFrame) scheduleFrame();
    };

    try {
      drawOwnedDecoration(ownedDecoration);
      const renderer = new OpticalKernelRenderer({
        canvas: output,
        source,
        ownedDecoration,
        control,
        selectedIndex: INITIAL_SELECTED_INDEX,
        onFallback: handleFallback,
        onRequestFrame: scheduleFrame,
      });
      rendererRef.current = renderer;
      window.__glazeOpticalKernel = renderer;
      requestSourceRenderRef.current = requestSourceRender;
      requestSourceRender();
    } catch (error) {
      handleFallback(error instanceof Error ? error.message : "renderer-initialization-failed");
      const context = resizeSourceCanvas(source);
      if (context) drawOpticalSource(source, context, 0, true, backgroundRef.current);
    }

    const resizeObserver = new ResizeObserver(requestSourceRender);
    resizeObserver.observe(stage);
    const handleMotionPreference = () => scheduleFrame();
    reducedMotionQuery.addEventListener("change", handleMotionPreference);

    const handlePointerMove = (event: PointerEvent) => {
      rendererRef.current?.setPointer(event.clientX, event.clientY, event.buttons > 0);
    };
    const handlePointerLeave = () => rendererRef.current?.releasePointer();
    stage.addEventListener("pointermove", handlePointerMove);
    stage.addEventListener("pointerleave", handlePointerLeave);
    stage.addEventListener("pointerup", handlePointerLeave);

    return () => {
      destroyed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", handleMotionPreference);
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerleave", handlePointerLeave);
      stage.removeEventListener("pointerup", handlePointerLeave);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      requestSourceRenderRef.current = null;
      delete window.__glazeOpticalKernel;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setSelectedIndex(selectedIndex);
  }, [selectedIndex]);

  const selectOption = (index: number, focus = false) => {
    setSelectedIndex(index);
    if (focus) optionRefs.current[index]?.focus();
  };

  const selectBackground = (index: number, focus = false) => {
    backgroundRef.current = OPTICAL_KERNEL_BACKGROUNDS[index];
    setBackgroundIndex(index);
    requestSourceRenderRef.current?.();
    if (focus) backgroundOptionRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = selectedIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (selectedIndex + 1) % OPTICAL_KERNEL_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (selectedIndex - 1 + OPTICAL_KERNEL_OPTIONS.length) % OPTICAL_KERNEL_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = OPTICAL_KERNEL_OPTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectOption(nextIndex, true);
  };

  const handleBackgroundKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = backgroundIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (backgroundIndex + 1) % OPTICAL_KERNEL_BACKGROUNDS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (backgroundIndex - 1 + OPTICAL_KERNEL_BACKGROUNDS.length) % OPTICAL_KERNEL_BACKGROUNDS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = OPTICAL_KERNEL_BACKGROUNDS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectBackground(nextIndex, true);
  };

  return (
    <main className={styles.page}>
      <section
        ref={stageRef}
        className={styles.stage}
        data-renderer={rendererState}
        data-background={selectedBackground.id}
        data-background-ready={readyBackgrounds.has(selectedBackground.id)}
        data-optical-map={OPTICAL_MAP_CONTRACT.id}
        data-fallback-reason={rendererState === "fallback" ? fallbackReason : undefined}
        aria-labelledby="optical-kernel-title"
      >
        <canvas ref={sourceRef} className={styles.source} aria-hidden="true" />
        <canvas
          ref={ownedDecorationRef}
          className={styles.ownedDecoration}
          data-optical-source="owned-decoration"
          aria-hidden="true"
        />
        <canvas
          ref={outputRef}
          className={styles.output}
          data-optical-output="true"
          aria-hidden="true"
        />

        <header className={styles.header}>
          <p>Glaze / renderer gate</p>
          <h1 id="optical-kernel-title">One body. Bending light.</h1>
          <span>Proven displacement math · {selectedBackground.label} source</span>
        </header>

        <div
          className={styles.backgroundPicker}
          role="radiogroup"
          aria-label="Background scene"
          onKeyDown={handleBackgroundKeyDown}
        >
          <span className={styles.backgroundPickerLabel} aria-hidden="true">Source</span>
          {OPTICAL_KERNEL_BACKGROUNDS.map((background, index) => (
            <button
              ref={(node) => { backgroundOptionRefs.current[index] = node; }}
              className={styles.backgroundOption}
              key={background.id}
              type="button"
              role="radio"
              aria-checked={backgroundIndex === index}
              tabIndex={backgroundIndex === index ? 0 : -1}
              onClick={() => selectBackground(index)}
            >
              {background.label}
            </button>
          ))}
        </div>

        <div
          ref={controlRef}
          className={styles.control}
          role="radiogroup"
          aria-label="Optical mode"
          data-selected-index={selectedIndex}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.fallbackSurface} aria-hidden="true" />
          {OPTICAL_KERNEL_OPTIONS.map((option, index) => (
            <button
              ref={(node) => { optionRefs.current[index] = node; }}
              className={styles.option}
              key={option}
              type="button"
              role="radio"
              aria-checked={selectedIndex === index}
              tabIndex={selectedIndex === index ? 0 : -1}
              onClick={() => selectOption(index)}
            >
              {option}
            </button>
          ))}
        </div>

        <footer className={styles.footer}>
          <p>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.srOnly} aria-live="polite">
              Renderer: {rendererState === "fallback" ? `fallback, ${fallbackReason}` : rendererState}
            </span>
            {rendererState === "webgl"
              ? `${selectedBackground.label} source · refractive output`
              : "Accessible fallback"}
          </p>
          <p>One outer body · moving refractive selection</p>
        </footer>
      </section>
    </main>
  );
}
