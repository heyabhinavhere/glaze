"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../optical-kernel.module.css";
import {
  drawOpticalSource,
  OpticalKernelRenderer,
  OPTICAL_KERNEL_OPTIONS,
  resizeSourceCanvas,
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
  const outputRef = useRef<HTMLCanvasElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OpticalKernelRenderer | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState(INITIAL_SELECTED_INDEX);
  const [rendererState, setRendererState] = useState<RendererState>("initializing");
  const [fallbackReason, setFallbackReason] = useState("renderer-initializing");

  useEffect(() => {
    const stage = stageRef.current;
    const source = sourceRef.current;
    const output = outputRef.current;
    const control = controlRef.current;
    if (!stage || !source || !output || !control) return;

    let animationFrame = 0;
    let destroyed = false;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleFallback = (reason: string) => {
      if (destroyed) return;
      setFallbackReason(reason);
      setRendererState("fallback");
    };

    try {
      const renderer = new OpticalKernelRenderer({
        canvas: output,
        source,
        control,
        selectedIndex: INITIAL_SELECTED_INDEX,
        onFallback: handleFallback,
      });
      rendererRef.current = renderer;
      window.__glazeOpticalKernel = renderer;
      let announcedWebGL = false;

      const frame = (time: number) => {
        if (destroyed) return;
        const context = resizeSourceCanvas(source);
        if (context) {
          drawOpticalSource(source, context, time, reducedMotionQuery.matches);
          const rendered = renderer.render(time, reducedMotionQuery.matches);
          if (rendered && !announcedWebGL) {
            announcedWebGL = true;
            setRendererState("webgl");
          }
        }
        animationFrame = window.requestAnimationFrame(frame);
      };
      animationFrame = window.requestAnimationFrame(frame);
    } catch (error) {
      handleFallback(error instanceof Error ? error.message : "renderer-initialization-failed");
      const context = resizeSourceCanvas(source);
      if (context) drawOpticalSource(source, context, 0, true);
    }

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
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerleave", handlePointerLeave);
      stage.removeEventListener("pointerup", handlePointerLeave);
      rendererRef.current?.destroy();
      rendererRef.current = null;
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

  return (
    <main className={styles.page}>
      <section
        ref={stageRef}
        className={styles.stage}
        data-renderer={rendererState}
        data-fallback-reason={rendererState === "fallback" ? fallbackReason : undefined}
        aria-labelledby="optical-kernel-title"
      >
        <canvas ref={sourceRef} className={styles.source} aria-hidden="true" />
        <canvas
          ref={outputRef}
          className={styles.output}
          data-optical-output="true"
          aria-hidden="true"
        />

        <header className={styles.header}>
          <p>Glaze / renderer gate</p>
          <h1 id="optical-kernel-title">One lens. Real pixels.</h1>
          <span>WebGL2 optical kernel · 320 × 64</span>
        </header>

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
            {rendererState === "webgl" ? "Live source · refractive output" : "Accessible fallback"}
          </p>
          <p>Move, click, or use arrow keys</p>
        </footer>
      </section>
    </main>
  );
}
