"use client";

import {
  GlazeDiagnostics,
  GlazeMediaSurface,
  GlazeRoot,
  GlazeSegmentedControl,
  type GlazeCanvasSource,
  type GlazeMediaSource,
} from "@glazelab/react";
import { useMemo, useRef, useState } from "react";
import styles from "../public-api-fixtures.module.css";

const SEGMENTS = [
  { id: "first", label: "First" },
  { id: "second", label: "Second" },
  { id: "third", label: "Third" },
] as const;

type SourceMode = "image-a" | "image-b" | "canvas" | "video" | "tainted";

export function PublicApiFixtures() {
  const [mounted, setMounted] = useState(true);
  const [wide, setWide] = useState(false);
  const [mode, setMode] = useState<SourceMode>("image-a");
  const [selection, setSelection] = useState("first");
  const [canvasVersion, setCanvasVersion] = useState(0);
  const canvasVersionRef = useRef(0);
  const invalidatorsRef = useRef(new Set<() => void>());

  const canvasSource = useMemo<GlazeCanvasSource>(() => ({
    type: "canvas",
    draw: (context, size) => {
      const even = canvasVersionRef.current % 2 === 0;
      context.fillStyle = even ? "#1659a8" : "#b23a67";
      context.fillRect(0, 0, size.width, size.height);
      context.strokeStyle = "rgba(255,255,255,.55)";
      context.lineWidth = 1;
      for (let x = 0; x < size.width; x += 24) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size.height);
        context.stroke();
      }
      context.fillStyle = "#fff";
      context.font = "700 24px system-ui";
      context.fillText(`Canvas ${canvasVersionRef.current}`, 28, 54);
    },
    subscribe: (invalidate) => {
      invalidatorsRef.current.add(invalidate);
      return () => invalidatorsRef.current.delete(invalidate);
    },
  }), []);

  const source = useMemo<GlazeMediaSource>(() => {
    if (mode === "image-a") {
      return { type: "image", src: "/backgrounds/bg-1.jpg" };
    }
    if (mode === "image-b") {
      return { type: "image", src: "/backgrounds/bg-2.jpg" };
    }
    if (mode === "canvas") return canvasSource;
    if (mode === "video") {
      return {
        type: "video",
        sources: [
          { src: "/m1-flower.webm", type: "video/webm" },
          { src: "/m1-flower.mp4", type: "video/mp4" },
        ],
      };
    }
    return {
      type: "image",
      src: "http://127.0.0.1:3193/bg-4.jpg",
    };
  }, [canvasSource, mode]);

  const invalidateCanvas = () => {
    canvasVersionRef.current += 1;
    setCanvasVersion(canvasVersionRef.current);
    for (const invalidate of invalidatorsRef.current) invalidate();
  };

  return (
    <GlazeRoot>
      <main
        className={styles.page}
        data-fixture-mode={mode}
        data-fixture-mounted={mounted}
        data-fixture-canvas-version={canvasVersion}
      >
        <h1>Public API lifecycle fixtures</h1>
        <div className={styles.actions} aria-label="Fixture controls">
          <button type="button" onClick={() => setMode("image-a")}>Image A</button>
          <button type="button" onClick={() => setMode("image-b")}>Image B</button>
          <button type="button" onClick={() => setMode("canvas")}>Canvas</button>
          <button type="button" onClick={() => setMode("video")}>Video</button>
          <button type="button" onClick={() => setMode("tainted")}>Tainted image</button>
          <button type="button" onClick={invalidateCanvas}>Redraw canvas</button>
          <button type="button" onClick={() => setWide((value) => !value)}>
            Toggle width
          </button>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? "Unmount surface" : "Mount surface"}
          </button>
        </div>

        {mounted ? (
          <GlazeMediaSurface
            aria-label="Lifecycle fixture surface"
            className={styles.surface}
            data-fixture-surface="true"
            source={source}
            style={{ width: wide ? 620 : 420 }}
          >
            <div className={styles.content}>
              <GlazeSegmentedControl
                aria-label="Fixture selection"
                segments={SEGMENTS}
                value={selection}
                onValueChange={setSelection}
              />
              <GlazeDiagnostics />
            </div>
          </GlazeMediaSurface>
        ) : (
          <p data-fixture-unmounted="true">Surface unmounted</p>
        )}

        <div className={styles.offscreenTarget} data-fixture-offscreen="true">
          Offscreen observer target
        </div>
      </main>
    </GlazeRoot>
  );
}
