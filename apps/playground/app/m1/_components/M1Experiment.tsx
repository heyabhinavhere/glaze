"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  generateM1DisplacementMap,
  hashDisplacementMap,
  type M1DisplacementMap,
} from "../_lib/displacement";
import type { M1Material } from "../_lib/material";
import { displacementMapDataUrl } from "../_lib/png";
import {
  getActiveM1RendererCount,
  M1WebGLRenderer,
  type M1RendererDiagnostics,
} from "../_lib/webgl-renderer";
import styles from "../m1.module.css";

type M1Mode = "owned-dom" | "canvas" | "video" | "fallback";
type RendererKind = "svg-dom" | "webgl" | "css-fallback";
type M1CanvasScene = "prism" | "topography" | "nocturne";

interface M1GlobalDiagnostics {
  getDiagnostics: () => {
    mode: M1Mode;
    rendererKind: RendererKind;
    fallbackReason: string | null;
    mapHash: string;
    mapWidth: number;
    mapHeight: number;
    mapDpr: number;
    activeRendererCount: number;
    longTasks: number;
    renderer: M1RendererDiagnostics | null;
  };
  forceContextLoss: () => void;
  setForcedDpr: (dpr: number | null) => void;
  resetLongTasks: () => void;
}

declare global {
  interface Window {
    __glazeM1?: M1GlobalDiagnostics;
  }
}

const GLASS_WIDTH = 240;
const GLASS_HEIGHT = 56;

const MODES: readonly { id: M1Mode; label: string }[] = [
  { id: "owned-dom", label: "Owned DOM" },
  { id: "canvas", label: "Canvas" },
  { id: "video", label: "Video" },
  { id: "fallback", label: "Fallback" },
];

const CANVAS_SCENES: readonly {
  id: M1CanvasScene;
  label: string;
  purpose: string;
}[] = [
  { id: "prism", label: "Prism", purpose: "Refraction" },
  { id: "topography", label: "Contours", purpose: "Depth" },
  { id: "nocturne", label: "Nocturne", purpose: "Low light" },
];

const SCENE_COPY: Record<
  M1CanvasScene | Exclude<M1Mode, "canvas">,
  { eyebrow: string; title: string }
> = {
  prism: {
    eyebrow: "REFRACTION STUDY",
    title: "Edges should bend—not merely blur.",
  },
  topography: {
    eyebrow: "DEPTH STUDY",
    title: "Continuous contours expose the lens profile.",
  },
  nocturne: {
    eyebrow: "LOW-LIGHT STUDY",
    title: "Highlights should travel through the material.",
  },
  "owned-dom": {
    eyebrow: "OWNED DOM STUDY",
    title: "Semantic content stays live beneath the lens.",
  },
  video: {
    eyebrow: "TEMPORAL STUDY",
    title: "Natural motion without page capture.",
  },
  fallback: {
    eyebrow: "FALLBACK STUDY",
    title: "Legible material with no refraction claim.",
  },
};

function drawCanvasFixture(
  canvas: HTMLCanvasElement,
  time: number,
  scene: M1CanvasScene,
): void {
  const rect = canvas.getBoundingClientRect();
  // Source textures are allowed to use CSS resolution; the actual glass
  // output remains DPR-capped at 2. Avoiding a redundant 2x source upload is
  // part of the M1 steady-frame budget.
  const dpr = 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  if (scene === "prism") {
    const gradient = context.createLinearGradient(0, 0, cssWidth, cssHeight);
    gradient.addColorStop(0, "#0b1836");
    gradient.addColorStop(0.35, "#125b70");
    gradient.addColorStop(0.68, "#9e4168");
    gradient.addColorStop(1, "#f1a24c");
    context.fillStyle = gradient;
    context.fillRect(0, 0, cssWidth, cssHeight);

    context.save();
    context.translate(cssWidth / 2, cssHeight / 2);
    context.rotate(time * 0.000_08);
    for (let index = -9; index <= 9; index += 1) {
      context.fillStyle =
        index % 2 === 0
          ? "rgba(255,255,255,.72)"
          : "rgba(7,14,34,.42)";
      context.fillRect(index * 36 - 8, -cssHeight, 16, cssHeight * 2);
    }
    context.restore();

    const orbX = cssWidth * (0.5 + Math.sin(time * 0.000_45) * 0.24);
    const orb = context.createRadialGradient(
      orbX,
      cssHeight * 0.52,
      0,
      orbX,
      cssHeight * 0.52,
      110,
    );
    orb.addColorStop(0, "rgba(222,255,244,.95)");
    orb.addColorStop(0.35, "rgba(89,226,207,.58)");
    orb.addColorStop(1, "rgba(89,226,207,0)");
    context.fillStyle = orb;
    context.fillRect(0, 0, cssWidth, cssHeight);
  } else if (scene === "topography") {
    const gradient = context.createLinearGradient(0, 0, cssWidth, cssHeight);
    gradient.addColorStop(0, "#071522");
    gradient.addColorStop(0.5, "#173c48");
    gradient.addColorStop(1, "#455f58");
    context.fillStyle = gradient;
    context.fillRect(0, 0, cssWidth, cssHeight);

    context.strokeStyle = "rgba(183, 228, 219, .18)";
    context.lineWidth = 1;
    for (let x = 20; x < cssWidth; x += 28) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, cssHeight);
      context.stroke();
    }
    for (let y = 18; y < cssHeight; y += 28) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(cssWidth, y);
      context.stroke();
    }

    const phase = Math.sin(time * 0.000_55) * 7;
    const centerX = cssWidth * 0.58 + phase;
    const centerY = cssHeight * 0.53;
    for (let radius = 18; radius < 300; radius += 15) {
      context.beginPath();
      context.ellipse(centerX, centerY, radius * 1.42, radius, -0.18, 0, Math.PI * 2);
      context.strokeStyle =
        radius % 30 === 0
          ? "rgba(245, 211, 139, .78)"
          : "rgba(189, 238, 225, .5)";
      context.lineWidth = radius % 30 === 0 ? 1.7 : 1;
      context.stroke();
    }

    context.fillStyle = "rgba(235, 248, 238, .92)";
    context.font = "600 9px ui-monospace, monospace";
    context.fillText("DEPTH 14.2", cssWidth * 0.1, cssHeight * 0.82);
    context.fillText("+ 48.8", cssWidth * 0.78, cssHeight * 0.2);
  } else {
    const gradient = context.createLinearGradient(0, 0, cssWidth, cssHeight);
    gradient.addColorStop(0, "#02050d");
    gradient.addColorStop(0.48, "#0a1122");
    gradient.addColorStop(1, "#170d24");
    context.fillStyle = gradient;
    context.fillRect(0, 0, cssWidth, cssHeight);

    const lights = [
      { x: 0.22, y: 0.42, radius: 150, color: "93, 224, 206" },
      { x: 0.73, y: 0.58, radius: 190, color: "225, 103, 154" },
      { x: 0.51, y: 0.2, radius: 100, color: "247, 195, 105" },
    ];
    lights.forEach((light, index) => {
      const drift = Math.sin(time * 0.000_4 + index * 1.8) * 18;
      const x = cssWidth * light.x + drift;
      const y = cssHeight * light.y;
      const glow = context.createRadialGradient(x, y, 0, x, y, light.radius);
      glow.addColorStop(0, `rgba(${light.color}, .72)`);
      glow.addColorStop(0.18, `rgba(${light.color}, .24)`);
      glow.addColorStop(1, `rgba(${light.color}, 0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, cssWidth, cssHeight);
    });

    context.strokeStyle = "rgba(228, 241, 255, .32)";
    context.lineWidth = 1;
    for (let x = 54; x < cssWidth; x += 82) {
      context.beginPath();
      context.moveTo(x, cssHeight * 0.18);
      context.lineTo(x, cssHeight * 0.82);
      context.stroke();
    }
  }

}

function OwnedPattern({ lens = false }: { lens?: boolean }) {
  return (
    <div className={lens ? styles.ownedPatternLens : styles.ownedPattern}>
      <div className={styles.grid} />
      <span className={styles.coordinateA}>48.8° N</span>
      <span className={styles.coordinateB}>REFRACTION / OWNED SOURCE</span>
      <span className={styles.domMark}>DOM</span>
    </div>
  );
}

function M1SvgFilter({
  id,
  map,
  mapUrl,
  material,
}: {
  id: string;
  map: M1DisplacementMap;
  mapUrl: string;
  material: M1Material;
}) {
  return (
    <svg className={styles.filterDefinition} aria-hidden="true">
      <defs>
        <filter
          id={id}
          x="-20"
          y="-20"
          width={GLASS_WIDTH + 40}
          height={GLASS_HEIGHT + 40}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={material.optics.frostPx / 2}
            result="frosted"
          />
          <feImage
            href={mapUrl}
            x="0"
            y="0"
            width={GLASS_WIDTH}
            height={GLASS_HEIGHT}
            preserveAspectRatio="none"
            result="glaze-map"
          />
          <feDisplacementMap
            in="frosted"
            in2="glaze-map"
            scale={material.optics.displacementPx * 2}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <metadata data-map-width={map.width} data-map-height={map.height} />
    </svg>
  );
}

export function M1Experiment({ material }: { material: M1Material }) {
  const [mode, setMode] = useState<M1Mode>("owned-dom");
  const [canvasScene, setCanvasScene] = useState<M1CanvasScene>("prism");
  const [playing, setPlaying] = useState(false);
  const [browserDpr, setBrowserDpr] = useState(1);
  const [forcedDpr, setForcedDpr] = useState<number | null>(null);
  const [mapUrl, setMapUrl] = useState("");
  const [mapHash, setMapHash] = useState("");
  const [rendererKind, setRendererKind] = useState<RendererKind>("css-fallback");
  const [fallbackReason, setFallbackReason] = useState<string | null>(
    "awaiting-client-enhancement",
  );
  const [videoReady, setVideoReady] = useState(false);
  const [diagnosticTick, setDiagnosticTick] = useState(0);
  const [rendererDiagnostics, setRendererDiagnostics] =
    useState<M1RendererDiagnostics | null>(null);
  const [interaction, setInteraction] = useState({
    active: false,
    pressed: false,
    x: 0.5,
    y: 0.5,
  });
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<M1WebGLRenderer | null>(null);
  const longTasksRef = useRef(0);
  const rawId = useId();
  const filterId = `m1-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const effectiveDpr = forcedDpr ?? browserDpr;
  const reviewCopy = SCENE_COPY[mode === "canvas" ? canvasScene : mode];
  const canvasSceneLabel =
    CANVAS_SCENES.find((scene) => scene.id === canvasScene)?.label ?? "Canvas";

  const map = useMemo(
    () =>
      generateM1DisplacementMap({
        cssWidth: GLASS_WIDTH,
        cssHeight: GLASS_HEIGHT,
        dpr: effectiveDpr,
        material,
      }),
    [effectiveDpr, material],
  );

  useEffect(() => {
    const dprFrame = window.requestAnimationFrame(() => {
      setBrowserDpr(Math.min(2, window.devicePixelRatio || 1));
    });
    const observer =
      "PerformanceObserver" in window
        ? new PerformanceObserver((list) => {
            longTasksRef.current += list.getEntries().length;
          })
        : null;
    try {
      observer?.observe({ type: "longtask", buffered: true });
    } catch {
      // Firefox and WebKit do not currently expose the long-task entry type.
    }
    return () => {
      window.cancelAnimationFrame(dprFrame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const encodedMap = displacementMapDataUrl(map);
    queueMicrotask(() => {
      if (!cancelled) setMapUrl(encodedMap);
    });
    void hashDisplacementMap(map).then((hash) => {
      if (!cancelled) setMapHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [map]);

  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    let animationFrame = 0;
    const draw = (time: number) => {
      drawCanvasFixture(canvas, time, canvasScene);
      rendererRef.current?.draw();
      if (mode === "canvas" && playing) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };
    draw(1_600);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [canvasScene, mode, playing]);

  useEffect(() => {
    const video = sourceVideoRef.current;
    if (!video) return;
    const markReady = () => {
      if (video.currentTime < 0.9) video.currentTime = 1;
      setVideoReady(true);
    };
    video.addEventListener("loadeddata", markReady);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      queueMicrotask(markReady);
    }
    return () => video.removeEventListener("loadeddata", markReady);
  }, []);

  useEffect(() => {
    const video = sourceVideoRef.current;
    if (!video) return;
    if (mode !== "video" || !playing) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      setPlaying(false);
      setFallbackReason("video-playback-blocked");
    });
  }, [mode, playing]);

  useEffect(() => {
    let cancelled = false;
    rendererRef.current?.destroy();
    rendererRef.current = null;

    if (mode === "owned-dom") {
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind(mapUrl ? "svg-dom" : "css-fallback");
        setFallbackReason(mapUrl ? null : "map-not-encoded");
      });
      return () => {
        cancelled = true;
      };
    }
    if (mode === "fallback") {
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("css-fallback");
        setFallbackReason("forced-by-developer");
      });
      return () => {
        cancelled = true;
      };
    }

    const canvas = outputCanvasRef.current;
    const source =
      mode === "canvas" ? sourceCanvasRef.current : sourceVideoRef.current;
    if (!canvas || !source || (mode === "video" && !videoReady)) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("css-fallback");
        setFallbackReason(
          mode === "video" ? "video-not-ready" : "source-not-ready",
        );
      });
      return () => {
        cancelled = true;
      };
    }

    try {
      const renderer = new M1WebGLRenderer({
        canvas,
        source,
        sourceKind: mode,
        material,
        map,
        onFallback: (reason) => {
          setRendererKind("css-fallback");
          setFallbackReason(reason);
        },
      });
      rendererRef.current = renderer;
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("webgl");
        setFallbackReason(null);
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "webgl-initialization-failed";
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("css-fallback");
        setFallbackReason(reason);
      });
    }

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [map, mapUrl, material, mode, videoReady]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRendererDiagnostics(rendererRef.current?.getDiagnostics() ?? null);
      setDiagnosticTick((value) => value + 1);
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    window.__glazeM1 = {
      getDiagnostics: () => ({
        mode,
        rendererKind,
        fallbackReason,
        mapHash,
        mapWidth: map.width,
        mapHeight: map.height,
        mapDpr: map.dpr,
        activeRendererCount: getActiveM1RendererCount(),
        longTasks: longTasksRef.current,
        renderer: rendererRef.current?.getDiagnostics() ?? null,
      }),
      forceContextLoss: () => rendererRef.current?.forceContextLoss(),
      setForcedDpr,
      resetLongTasks: () => {
        longTasksRef.current = 0;
        rendererRef.current?.resetPerformanceMeasurements();
      },
    };
  }, [fallbackReason, map, mapHash, mode, rendererKind, diagnosticTick]);

  useEffect(() => {
    rendererRef.current?.setInteraction(
      interaction.x,
      interaction.y,
      interaction.pressed ? 1 : interaction.active ? 0.58 : 0,
    );
  }, [interaction]);

  useEffect(
    () => () => {
      delete window.__glazeM1;
    },
    [],
  );

  return (
    <main className={styles.page} data-m1-boundary="client">
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Glaze · Milestone 1</p>
          <h1>Rendering foundation, under test.</h1>
        </div>
        <p>
          One material across six stress scenes. Move, press, and play the real
          control. No page capture and no scene-specific material tuning.
        </p>
      </header>

      <section className={styles.experiment} aria-labelledby="experiment-title">
        <div className={styles.modeBar} role="group" aria-label="Source renderer">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`mode-${item.id}`}
              aria-pressed={mode === item.id}
              onClick={() => {
                setPlaying(false);
                setMode(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.studyBar}>
          <div
            className={styles.sceneChooser}
            role="group"
            aria-label="Canvas study"
            aria-disabled={mode !== "canvas"}
          >
            {CANVAS_SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                data-testid={`scene-${scene.id}`}
                aria-pressed={canvasScene === scene.id}
                disabled={mode !== "canvas"}
                onClick={() => {
                  setPlaying(false);
                  setCanvasScene(scene.id);
                }}
              >
                <span>{scene.label}</span>
                <small>{scene.purpose}</small>
              </button>
            ))}
          </div>
          <p><span>Move</span> to energize · <span>Hold</span> to compress · <span>Play</span> for motion</p>
        </div>

        <div
          className={styles.mediaCard}
          data-testid="m1-card"
          data-mode={mode}
          data-scene={canvasScene}
          data-renderer={rendererKind}
        >
          <OwnedPattern />
          <canvas
            ref={sourceCanvasRef}
            className={styles.sourceMedia}
            data-active={mode === "canvas"}
            aria-hidden="true"
          />
          <video
            ref={sourceVideoRef}
            className={styles.sourceMedia}
            data-active={mode === "video"}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedData={(event) => {
              const video = event.currentTarget;
              if (video.currentTime < 0.9) video.currentTime = 1;
              setVideoReady(true);
            }}
          >
            <source src="/m1-flower.webm" type="video/webm" />
            <source src="/m1-flower.mp4" type="video/mp4" />
          </video>

          <div className={styles.sceneCopy}>
            <span>{reviewCopy.eyebrow}</span>
            <strong>{reviewCopy.title}</strong>
          </div>

          <div
            className={styles.glassSurface}
            data-testid="glass-surface"
            data-active={interaction.active}
            data-pressed={interaction.pressed}
            style={{
              width: GLASS_WIDTH,
              height: GLASS_HEIGHT,
              borderRadius: material.geometry.cornerRadiusPx,
              "--glaze-touch-x": `${interaction.x * 100}%`,
              "--glaze-touch-y": `${interaction.y * 100}%`,
              "--glaze-pull-x": `${(interaction.x - 0.5) * 5}px`,
              "--glaze-pull-y": `${(interaction.y - 0.5) * 3}px`,
            } as React.CSSProperties}
            onPointerEnter={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setInteraction({
                active: true,
                pressed: false,
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height,
              });
            }}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setInteraction((current) => ({
                active: current.active,
                pressed: current.pressed,
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height,
              }));
            }}
            onPointerLeave={() => {
              setInteraction({ active: false, pressed: false, x: 0.5, y: 0.5 });
            }}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setInteraction({
                active: true,
                pressed: true,
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height,
              });
            }}
            onPointerUp={() => {
              setInteraction((current) => ({
                ...current,
                active: true,
                pressed: false,
              }));
            }}
          >
            <div className={styles.fallbackLayer} aria-hidden="true" />
            {mode === "owned-dom" && mapUrl ? (
              <>
                <M1SvgFilter
                  id={filterId}
                  map={map}
                  mapUrl={mapUrl}
                  material={material}
                />
                <div
                  className={styles.ownedLensSource}
                  style={{
                    filter: `url(#${filterId})`,
                    transform: interaction.active
                      ? `translate(${(interaction.x - 0.5) * 6}px, ${(interaction.y - 0.5) * 4}px) scale(${interaction.pressed ? 1.055 : 1.032})`
                      : "translate(0, 0) scale(1)",
                  }}
                  aria-hidden="true"
                >
                  <OwnedPattern lens />
                </div>
              </>
            ) : null}
            {(mode === "canvas" || mode === "video") &&
            rendererKind === "webgl" ? (
              <canvas
                ref={outputCanvasRef}
                className={styles.outputCanvas}
                data-active={rendererKind === "webgl"}
                aria-hidden="true"
                role="presentation"
              />
            ) : mode === "canvas" || mode === "video" ? (
              <canvas
                ref={outputCanvasRef}
                className={styles.outputCanvas}
                data-active={false}
                aria-hidden="true"
                role="presentation"
              />
            ) : null}
            <div className={styles.glassFinish} aria-hidden="true" />
            <div className={styles.transportControls}>
              <button
                type="button"
                className={styles.playButton}
                data-testid="play-toggle"
                aria-label={playing ? "Pause source" : "Play source"}
                aria-pressed={playing}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <div className={styles.track} aria-hidden="true">
                <span style={{ width: playing ? "62%" : "38%" }} />
              </div>
              <span className={styles.time}>{playing ? "0:18" : "0:11"}</span>
            </div>
          </div>

          <div className={styles.sourceBadge}>
            {mode === "owned-dom"
              ? "LIVE DOM"
              : mode === "canvas"
                ? `CANVAS · ${canvasSceneLabel.toUpperCase()}`
                : mode.toUpperCase()}
          </div>
        </div>

        <div className={styles.readout} aria-live="polite">
          <div>
            <span>Renderer</span>
            <strong data-testid="renderer-kind">{rendererKind}</strong>
          </div>
          <div>
            <span>Map</span>
            <strong data-testid="map-size">{map.width}×{map.height}</strong>
          </div>
          <div>
            <span>Frames / uploads</span>
            <strong data-testid="frame-count">
              {rendererDiagnostics?.frames ?? 0} / {rendererDiagnostics?.uploads ?? 0}
            </strong>
          </div>
          <div>
            <span>Fallback reason</span>
            <strong data-testid="fallback-reason">{fallbackReason ?? "none"}</strong>
          </div>
        </div>
      </section>

      <section className={styles.contract}>
        <h2 id="experiment-title">What this route can prove</h2>
        <ul>
          <li>SVG and WebGL consume the same deterministic RGBA map.</li>
          <li>The interactive control remains ordinary semantic DOM.</li>
          <li>Static and paused sources stop rendering after they settle.</li>
          <li>Unsupported and lost contexts remain legible through CSS.</li>
        </ul>
        <code data-testid="map-hash">{mapHash || "hashing…"}</code>
      </section>
    </main>
  );
}
