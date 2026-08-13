"use client";

import { Glass } from "@samasante/liquid-glass";
import {
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { generateM1DisplacementMap } from "../../../m1/_lib/displacement";
import { transportMaterial } from "../../../m1/_lib/material";
import {
  getActiveM1RendererCount,
  type M1RendererDiagnostics,
  M1WebGLRenderer,
} from "../../../m1/_lib/webgl-renderer";
import styles from "../bakeoff.module.css";

export type CandidateId = "owned-svg" | "explicit-webgl" | "css-baseline";
export type SceneId = "light" | "dark" | "photo" | "text" | "motion";

type RendererKind = "webgl" | "css-fallback";

interface WebglBridge {
  forceContextLoss: () => void;
  getDiagnostics: () => {
    rendererKind: RendererKind;
    fallbackReason: string | null;
    activeRendererCount: number;
    renderer: M1RendererDiagnostics | null;
  };
}

interface BakeoffDiagnostics {
  getDiagnostics: () => {
    route: "research-bakeoff";
    selectedTab: string;
    scene: SceneId;
    focusCandidate: CandidateId | null;
    renderedCandidates: readonly CandidateId[];
    activeRendererCount: number;
    explicitWebgl: ReturnType<WebglBridge["getDiagnostics"]> | null;
  };
  forceContextLoss: () => void;
}

declare global {
  interface Window {
    __glazeBakeoff?: BakeoffDiagnostics;
  }
}

const CANDIDATES: readonly {
  id: CandidateId;
  marker: string;
  title: string;
  engine: string;
  truth: string;
}[] = [
  {
    id: "owned-svg",
    marker: "A",
    title: "Owned DOM · SVG",
    engine: "@samasante/liquid-glass 0.1.1",
    truth: "Refracts a component-owned DOM copy. Default optics, unchanged.",
  },
  {
    id: "explicit-webgl",
    marker: "B",
    title: "Explicit source · WebGL",
    engine: "Current Glaze M1 renderer",
    truth: "Samples only the component-owned canvas. No page capture.",
  },
  {
    id: "css-baseline",
    marker: "C",
    title: "CSS material baseline",
    engine: "Native CSS",
    truth: "Blur, tint, border, and shadow only. No refraction claim.",
  },
];

const SCENES: readonly { id: SceneId; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "photo", label: "Photo" },
  { id: "text", label: "Text" },
  { id: "motion", label: "Motion" },
];

const TABS = [
  {
    id: "overview",
    label: "Overview",
    title: "Clear direction",
    body: "A compact surface should preserve the scene while keeping the active choice unmistakable.",
  },
  {
    id: "activity",
    label: "Activity",
    title: "Recent work",
    body: "Movement is bounded to the selection change. Static scenes must become idle after settling.",
  },
  {
    id: "settings",
    label: "Settings",
    title: "Material rules",
    body: "Capability truth, fallback behavior, and accessibility stay visible instead of being hidden by polish.",
  },
] as const;

const CONTROL_WIDTH = 300;
const CONTROL_HEIGHT = 44;
const INDICATOR_WIDTH = 96;
const INDICATOR_HEIGHT = 38;

const SCENE_PALETTES: Record<
  SceneId,
  {
    base: string;
    secondary: string;
    line: string;
    glow: string;
  }
> = {
  light: {
    base: "#e6e4dc",
    secondary: "#b9c9d3",
    line: "rgba(29, 49, 61, .22)",
    glow: "rgba(255, 255, 255, .88)",
  },
  dark: {
    base: "#11192a",
    secondary: "#30445c",
    line: "rgba(222, 240, 255, .24)",
    glow: "rgba(82, 177, 201, .5)",
  },
  photo: {
    base: "#27556c",
    secondary: "#d2723c",
    line: "rgba(255, 240, 214, .3)",
    glow: "rgba(255, 182, 91, .58)",
  },
  text: {
    base: "#e9e6dd",
    secondary: "#8c9b9c",
    line: "rgba(19, 30, 34, .36)",
    glow: "rgba(255, 255, 255, .82)",
  },
  motion: {
    base: "#32482f",
    secondary: "#bd473b",
    line: "rgba(255, 240, 218, .3)",
    glow: "rgba(236, 150, 116, .62)",
  },
};

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawOwnedTrack(canvas: HTMLCanvasElement, scene: SceneId): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palette = SCENE_PALETTES[scene];
  const gradient = context.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, palette.base);
  gradient.addColorStop(0.48, palette.secondary);
  gradient.addColorStop(1, palette.base);
  drawRoundedRect(context, 0, 0, rect.width, rect.height, rect.height / 2);
  context.fillStyle = gradient;
  context.fill();

  context.save();
  drawRoundedRect(context, 0, 0, rect.width, rect.height, rect.height / 2);
  context.clip();
  context.lineWidth = 1;
  context.strokeStyle = palette.line;
  for (let x = -18; x < rect.width + 24; x += 24) {
    context.beginPath();
    context.moveTo(x, rect.height + 4);
    context.lineTo(x + 20, -4);
    context.stroke();
  }
  const glow = context.createRadialGradient(
    rect.width * 0.58,
    rect.height * 0.35,
    0,
    rect.width * 0.58,
    rect.height * 0.35,
    rect.width * 0.32,
  );
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, rect.width, rect.height);
  context.restore();
}

function OpticalTrack({ scene }: { scene: SceneId }) {
  return (
    <div className={styles.opticalTrack} data-scene={scene} aria-hidden="true">
      <span />
    </div>
  );
}

function OwnedSvgIndicator({
  selected,
  scene,
}: {
  selected: number;
  scene: SceneId;
}) {
  return (
    <div className={styles.visualTrack} data-scene={scene} aria-hidden="true">
      <OpticalTrack scene={scene} />
      <Glass
        className={styles.ownedGlass}
        data-optics="package-default"
        width={INDICATOR_WIDTH}
        height={INDICATOR_HEIGHT}
        radius={INDICATOR_HEIGHT / 2}
        center={{ x: (selected + 0.5) / TABS.length, y: 0.5 }}
        refract={<OpticalTrack scene={scene} />}
        behind="transparent"
      />
    </div>
  );
}

function ExplicitWebglIndicator({
  selected,
  scene,
  bridgeRef,
}: {
  selected: number;
  scene: SceneId;
  bridgeRef: MutableRefObject<WebglBridge | null>;
}) {
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<M1WebGLRenderer | null>(null);
  const motionFrameRef = useRef<number | null>(null);
  const sceneRef = useRef(scene);
  const [rendererKind, setRendererKind] =
    useState<RendererKind>("css-fallback");
  const [fallbackReason, setFallbackReason] = useState<string | null>(
    "awaiting-client-enhancement",
  );
  const map = useMemo(
    () =>
      generateM1DisplacementMap({
        cssWidth: INDICATOR_WIDTH,
        cssHeight: INDICATOR_HEIGHT,
        dpr: 2,
        material: transportMaterial,
      }),
    [],
  );

  useLayoutEffect(() => {
    const source = sourceRef.current;
    if (source) drawOwnedTrack(source, scene);
  }, [scene]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    const source = sourceRef.current;
    const output = outputRef.current;
    if (!source || !output) return;
    let mounted = true;

    try {
      const renderer = new M1WebGLRenderer({
        canvas: output,
        source,
        sourceKind: "canvas",
        material: transportMaterial,
        map,
        onFallback: (reason) => {
          if (!mounted) return;
          setFallbackReason(reason);
          setRendererKind("css-fallback");
          queueMicrotask(() => {
            rendererRef.current?.destroy();
            rendererRef.current = null;
          });
        },
      });
      rendererRef.current = renderer;
      queueMicrotask(() => {
        if (!mounted) return;
        setFallbackReason(null);
        setRendererKind("webgl");
      });
      renderer.draw();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "webgl-init-failed";
      queueMicrotask(() => {
        if (!mounted) return;
        setFallbackReason(reason);
        setRendererKind("css-fallback");
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      drawOwnedTrack(source, sceneRef.current);
      rendererRef.current?.draw();
    });
    resizeObserver.observe(source);

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
        motionFrameRef.current = null;
      }
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const source = sourceRef.current;
    if (!renderer || !source) return;
    drawOwnedTrack(source, scene);
    renderer.draw(true);
  }, [scene]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (motionFrameRef.current !== null) {
      window.cancelAnimationFrame(motionFrameRef.current);
    }
    const startedAt = performance.now();
    const drawMovingLens = (time: number) => {
      renderer.draw(false);
      if (time - startedAt < 360) {
        motionFrameRef.current = window.requestAnimationFrame(drawMovingLens);
      } else {
        motionFrameRef.current = null;
      }
    };
    motionFrameRef.current = window.requestAnimationFrame(drawMovingLens);
    return () => {
      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
        motionFrameRef.current = null;
      }
    };
  }, [selected]);

  useEffect(() => {
    bridgeRef.current = {
      forceContextLoss: () => rendererRef.current?.forceContextLoss(),
      getDiagnostics: () => ({
        rendererKind,
        fallbackReason,
        activeRendererCount: getActiveM1RendererCount(),
        renderer: rendererRef.current?.getDiagnostics() ?? null,
      }),
    };
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, fallbackReason, rendererKind]);

  return (
    <div
      className={styles.visualTrack}
      data-scene={scene}
      data-renderer={rendererKind}
      aria-hidden="true"
    >
      <canvas ref={sourceRef} className={styles.webglSource} />
      <span
        className={styles.webglFallback}
        style={{ transform: `translate3d(${selected * 100}%, 0, 0)` }}
      />
      <canvas
        ref={outputRef}
        className={styles.webglOutput}
        data-active={rendererKind === "webgl"}
        style={{ transform: `translate3d(${selected * 100}%, 0, 0)` }}
      />
    </div>
  );
}

function CssIndicator({
  selected,
  scene,
}: {
  selected: number;
  scene: SceneId;
}) {
  return (
    <div className={styles.visualTrack} data-scene={scene} aria-hidden="true">
      <OpticalTrack scene={scene} />
      <span
        className={styles.cssIndicator}
        style={{ transform: `translate3d(${selected * 100}%, 0, 0)` }}
      />
    </div>
  );
}

function SceneBackdrop({ scene }: { scene: SceneId }) {
  return (
    <>
      <video
        className={styles.motionBackdrop}
        data-visible={scene === "motion"}
        src="/m1-flower.webm"
        poster="/backgrounds/bg-6.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className={styles.textBackdrop} aria-hidden="true">
        <span>01 / MATERIAL STUDY</span>
        <strong>Clarity before decoration.</strong>
        <p>Transmission · Refraction · Fallback · Motion</p>
      </div>
      <div className={styles.stageGlow} aria-hidden="true" />
    </>
  );
}

function SegmentedControl({
  candidate,
  selected,
  scene,
  onSelect,
  bridge,
}: {
  candidate: CandidateId;
  selected: number;
  scene: SceneId;
  onSelect: (index: number) => void;
  bridge: MutableRefObject<WebglBridge | null>;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;

    event.preventDefault();
    onSelect(nextIndex);
    document
      .getElementById(`${candidate}-tab-${TABS[nextIndex].id}`)
      ?.focus();
  };

  let visual: ReactNode;
  if (candidate === "owned-svg") {
    visual = <OwnedSvgIndicator selected={selected} scene={scene} />;
  } else if (candidate === "explicit-webgl") {
    visual = (
      <ExplicitWebglIndicator
        selected={selected}
        scene={scene}
        bridgeRef={bridge}
      />
    );
  } else {
    visual = <CssIndicator selected={selected} scene={scene} />;
  }

  return (
    <div className={styles.controlAndPanel}>
      <div
        className={styles.segmentedControl}
        data-testid={`${candidate}-control`}
        style={{ width: CONTROL_WIDTH, height: CONTROL_HEIGHT }}
      >
        {visual}
        <div
          className={styles.tabList}
          role="tablist"
          aria-label={`${CANDIDATES.find((item) => item.id === candidate)?.title} view`}
        >
          {TABS.map((tab, index) => (
            <button
              id={`${candidate}-tab-${tab.id}`}
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected === index}
              aria-controls={`${candidate}-panel-${tab.id}`}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {TABS.map((tab, index) => (
        <div
          id={`${candidate}-panel-${tab.id}`}
          key={tab.id}
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby={`${candidate}-tab-${tab.id}`}
          hidden={selected !== index}
        >
          <strong>{tab.title}</strong>
          <span>{tab.body}</span>
        </div>
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  scene,
  selected,
  onSelect,
  bridge,
}: {
  candidate: (typeof CANDIDATES)[number];
  scene: SceneId;
  selected: number;
  onSelect: (index: number) => void;
  bridge: MutableRefObject<WebglBridge | null>;
}) {
  return (
    <article className={styles.candidateCard} data-candidate={candidate.id}>
      <header className={styles.cardHeader}>
        <span className={styles.candidateMarker}>{candidate.marker}</span>
        <div>
          <h2>{candidate.title}</h2>
          <p>{candidate.engine}</p>
        </div>
      </header>
      <div className={styles.stage} data-scene={scene}>
        <SceneBackdrop scene={scene} />
        <div className={styles.stageCopy}>
          <span>ENGINE BAKE-OFF</span>
          <strong>One control. Three honest strategies.</strong>
        </div>
        <SegmentedControl
          candidate={candidate.id}
          selected={selected}
          scene={scene}
          onSelect={onSelect}
          bridge={bridge}
        />
      </div>
      <p className={styles.capabilityTruth}>
        <span>Capability truth</span>
        {candidate.truth}
      </p>
    </article>
  );
}

export function EngineBakeoff({
  initialCandidate,
  initialScene,
}: {
  initialCandidate: CandidateId | null;
  initialScene: SceneId;
}) {
  const [selected, setSelected] = useState(0);
  const [scene, setScene] = useState<SceneId>(initialScene);
  const webglBridge = useRef<WebglBridge | null>(null);
  const visibleCandidates = useMemo(
    () =>
      initialCandidate
        ? CANDIDATES.filter((candidate) => candidate.id === initialCandidate)
        : CANDIDATES,
    [initialCandidate],
  );

  useLayoutEffect(() => {
    window.__glazeBakeoff = {
      getDiagnostics: () => ({
        route: "research-bakeoff",
        selectedTab: TABS[selected].id,
        scene,
        focusCandidate: initialCandidate,
        renderedCandidates: visibleCandidates.map((candidate) => candidate.id),
        activeRendererCount: getActiveM1RendererCount(),
        explicitWebgl: webglBridge.current?.getDiagnostics() ?? null,
      }),
      forceContextLoss: () => webglBridge.current?.forceContextLoss(),
    };
    return () => {
      delete window.__glazeBakeoff;
    };
  }, [initialCandidate, scene, selected, visibleCandidates]);

  return (
    <main
      className={styles.page}
      data-bakeoff-shell="server"
      data-focus-mode={initialCandidate !== null}
    >
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Glaze · Gate 1–2</p>
          <h1>Engine bake-off</h1>
        </div>
        <p>
          A real-scale segmented control with shared semantics, state, geometry,
          and stress scenes. This page evaluates engines—not product styling.
        </p>
      </header>

      <div className={styles.testBar}>
        <fieldset className={styles.scenePicker}>
          <legend>Scene</legend>
          {SCENES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={scene === item.id}
              onClick={() => setScene(item.id)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        <nav className={styles.focusNav} aria-label="Candidate view">
          {initialCandidate ? (
            <a href={`/research/bakeoff?scene=${scene}`}>Compare all</a>
          ) : (
            <span>Comparison mode · synchronized selection</span>
          )}
        </nav>
      </div>

      <section
        className={styles.candidateGrid}
        data-count={visibleCandidates.length}
        aria-label="Rendering candidates"
      >
        {visibleCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            scene={scene}
            selected={selected}
            onSelect={setSelected}
            bridge={webglBridge}
          />
        ))}
      </section>
    </main>
  );
}
