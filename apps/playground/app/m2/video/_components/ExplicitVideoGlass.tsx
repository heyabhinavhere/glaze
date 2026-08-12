"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  generateM1DisplacementMap,
  hashDisplacementMap,
} from "../../../m1/_lib/displacement";
import { transportMaterial } from "../../../m1/_lib/material";
import {
  getActiveM1RendererCount,
  M1WebGLRenderer,
  type M1RendererDiagnostics,
} from "../../../m1/_lib/webgl-renderer";
import {
  formatMediaTime,
  resolveExplicitVideoContract,
  type ExplicitVideoMetadata,
} from "../_lib/source-contract";
import styles from "../video.module.css";

type RendererKind = "webgl" | "css-fallback";
type InjectedSourceFailure = "source-not-origin-clean" | "source-upload-failed";

interface M2VideoDiagnostics {
  readonly capability: "explicit-video-webgl";
  readonly sourceKind: "video";
  readonly sourceId: string;
  readonly configuredSourcePaths: readonly string[];
  readonly currentSourceUrl: string;
  readonly sameOrigin: boolean;
  readonly rendererKind: RendererKind;
  readonly fallbackReason: string | null;
  readonly semanticControlCount: number;
  readonly activeRendererCount: number;
  readonly rendererMounts: number;
  readonly rendererCleanups: number;
  readonly longTasks: number;
  readonly mapHash: string;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly renderer: M1RendererDiagnostics | null;
}

interface M2VideoTestBoundary {
  getDiagnostics: () => M2VideoDiagnostics;
  forceContextLoss: () => void;
  forceRemount: () => void;
  injectSourceFailure: (reason: InjectedSourceFailure) => void;
  resetPerformanceMeasurements: () => void;
}

declare global {
  interface Window {
    __glazeM2?: M2VideoTestBoundary;
  }
}

const GLASS_WIDTH = 240;
const GLASS_HEIGHT = 56;

function fallbackMessage(reason: string | null): string {
  switch (reason) {
    case null:
      return "WebGL active for the explicit video source.";
    case "awaiting-client-enhancement":
      return "Awaiting client enhancement; semantic controls are ready.";
    case "video-not-ready":
      return "Video metadata is loading; semantic controls remain available.";
    case "source-not-origin-clean":
      return "Video source is not origin-clean. Using the explicit fallback.";
    case "source-upload-failed":
      return "Video upload failed. Using the explicit fallback.";
    case "video-source-error":
      return "Video source failed to load. Controls remain available.";
    case "video-playback-blocked":
      return "Playback was blocked by the browser. Try the play control again.";
    case "webgl-context-lost":
      return "WebGL context was lost. Using the explicit fallback.";
    default:
      return `Explicit fallback: ${reason}.`;
  }
}

export function ExplicitVideoGlass({
  source,
}: {
  readonly source: ExplicitVideoMetadata;
}) {
  const [rendererKind, setRendererKind] =
    useState<RendererKind>("css-fallback");
  const [fallbackReason, setFallbackReason] = useState<string | null>(
    "awaiting-client-enhancement",
  );
  const [videoReady, setVideoReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [browserDpr, setBrowserDpr] = useState(1);
  const [mapHash, setMapHash] = useState("");
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [rendererDiagnostics, setRendererDiagnostics] =
    useState<M1RendererDiagnostics | null>(null);
  const [interaction, setInteraction] = useState({
    active: false,
    pressed: false,
    x: 0.5,
    y: 0.5,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<M1WebGLRenderer | null>(null);
  const rendererMountsRef = useRef(0);
  const rendererCleanupsRef = useRef(0);
  const longTasksRef = useRef(0);

  const applyVisibleFallback = useCallback((reason: string) => {
    if (rendererRef.current) {
      rendererRef.current.destroy();
      rendererRef.current = null;
      rendererCleanupsRef.current += 1;
    }
    setRendererKind("css-fallback");
    setFallbackReason(reason);
  }, []);

  const map = useMemo(
    () =>
      generateM1DisplacementMap({
        cssWidth: GLASS_WIDTH,
        cssHeight: GLASS_HEIGHT,
        dpr: browserDpr,
        material: transportMaterial,
      }),
    [browserDpr],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
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
      // Firefox and WebKit do not currently expose long-task entries.
    }
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hashDisplacementMap(map).then((hash) => {
      if (!cancelled) setMapHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [map]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const markReady = () => {
      if (video.currentTime < 0.9) video.currentTime = 1;
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setVideoReady(true);
    };
    video.addEventListener("loadeddata", markReady);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      queueMicrotask(markReady);
    }
    return () => video.removeEventListener("loadeddata", markReady);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const canvas = outputCanvasRef.current;
    const contract = resolveExplicitVideoContract(source, window.location.origin);

    rendererRef.current?.destroy();
    rendererRef.current = null;
    if (contract.failureReason) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("css-fallback");
        setFallbackReason(contract.failureReason);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!video || !canvas || !videoReady) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRendererKind("css-fallback");
        setFallbackReason("video-not-ready");
      });
      return () => {
        cancelled = true;
      };
    }

    let constructionFallback: string | null = null;
    const applyFallback = (reason: string) => {
      constructionFallback = reason;
      queueMicrotask(() => {
        if (cancelled) return;
        if (rendererRef.current) {
          rendererRef.current.destroy();
          rendererRef.current = null;
          rendererCleanupsRef.current += 1;
        }
        setRendererKind("css-fallback");
        setFallbackReason(reason);
      });
    };
    try {
      const renderer = new M1WebGLRenderer({
        canvas,
        source: video,
        sourceKind: "video",
        material: transportMaterial,
        map,
        onFallback: applyFallback,
      });
      rendererMountsRef.current += 1;
      if (constructionFallback) {
        renderer.destroy();
        rendererCleanupsRef.current += 1;
      } else {
        rendererRef.current = renderer;
        queueMicrotask(() => {
          if (cancelled) return;
          setRendererKind("webgl");
          setFallbackReason(null);
        });
      }
    } catch (error) {
      applyFallback(
        error instanceof Error ? error.message : "webgl-initialization-failed",
      );
    }

    return () => {
      cancelled = true;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
        rendererCleanupsRef.current += 1;
      }
    };
  }, [map, rendererEpoch, source, videoReady]);

  useEffect(() => {
    rendererRef.current?.setInteraction(
      interaction.x,
      interaction.y,
      interaction.pressed ? 1 : interaction.active ? 0.58 : 0,
    );
  }, [interaction]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRendererDiagnostics(rendererRef.current?.getDiagnostics() ?? null);
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    window.__glazeM2 = {
      getDiagnostics: () => {
        const video = videoRef.current;
        const contract = resolveExplicitVideoContract(
          source,
          window.location.origin,
        );
        return {
          capability: "explicit-video-webgl",
          sourceKind: "video",
          sourceId: source.id,
          configuredSourcePaths: source.sources.map((item) => item.src),
          currentSourceUrl: video?.currentSrc ?? "",
          sameOrigin:
            contract.sameOrigin &&
            (!video?.currentSrc ||
              new URL(video.currentSrc).origin === window.location.origin),
          rendererKind,
          fallbackReason,
          semanticControlCount:
            controlsRef.current?.querySelectorAll("button, input, output")
              .length ?? 0,
          activeRendererCount: getActiveM1RendererCount(),
          rendererMounts: rendererMountsRef.current,
          rendererCleanups: rendererCleanupsRef.current,
          longTasks: longTasksRef.current,
          mapHash,
          playing,
          currentTime,
          duration,
          renderer: rendererRef.current?.getDiagnostics() ?? null,
        };
      },
      forceContextLoss: () => rendererRef.current?.forceContextLoss(),
      forceRemount: () => setRendererEpoch((value) => value + 1),
      injectSourceFailure: applyVisibleFallback,
      resetPerformanceMeasurements: () => {
        longTasksRef.current = 0;
        rendererRef.current?.resetPerformanceMeasurements();
      },
    };
  }, [
    applyVisibleFallback,
    currentTime,
    duration,
    fallbackReason,
    mapHash,
    playing,
    rendererKind,
    source,
  ]);

  useEffect(
    () => () => {
      delete window.__glazeM2;
    },
    [],
  );

  const updateVideoState = (video: HTMLVideoElement) => {
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch {
      applyVisibleFallback("video-playback-blocked");
    }
  };

  const progressMaximum = duration > 0 ? duration : 1;
  const statusMessage = fallbackMessage(fallbackReason);

  return (
    <section
      className={styles.integration}
      data-testid="m2-integration"
      data-capability="explicit-video-webgl"
      data-source-kind="video"
      data-source-id={source.id}
      data-renderer={rendererKind}
      data-fallback-reason={fallbackReason ?? "none"}
    >
      <div className={styles.player} data-testid="m2-player">
        <video
          ref={videoRef}
          className={styles.video}
          data-testid="explicit-video-source"
          data-source-ownership="component-owned-explicit-source"
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedMetadata={(event) => updateVideoState(event.currentTarget)}
          onDurationChange={(event) => updateVideoState(event.currentTarget)}
          onLoadedData={(event) => {
            const video = event.currentTarget;
            if (video.currentTime < 0.9) video.currentTime = 1;
            updateVideoState(video);
            setVideoReady(true);
          }}
          onTimeUpdate={(event) => updateVideoState(event.currentTarget)}
          onPlay={(event) => {
            setPlaying(true);
            updateVideoState(event.currentTarget);
          }}
          onPause={(event) => {
            setPlaying(false);
            updateVideoState(event.currentTarget);
          }}
          onError={() => applyVisibleFallback("video-source-error")}
        >
          {source.sources.map((item) => (
            <source key={item.src} src={item.src} type={item.type} />
          ))}
          The explicit research video cannot be played by this browser.
        </video>

        <div className={styles.copy} aria-hidden="true">
          <span>Explicit source · Next.js App Router</span>
          <strong>One video. One honest capability.</strong>
        </div>

        <div
          className={styles.glassSurface}
          data-testid="m2-glass-surface"
          data-renderer={rendererKind}
          data-active={interaction.active}
          data-pressed={interaction.pressed}
          style={{
            width: GLASS_WIDTH,
            height: GLASS_HEIGHT,
            borderRadius: transportMaterial.geometry.cornerRadiusPx,
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
            setInteraction((value) => ({
              ...value,
              x: (event.clientX - rect.left) / rect.width,
              y: (event.clientY - rect.top) / rect.height,
            }));
          }}
          onPointerLeave={() =>
            setInteraction({ active: false, pressed: false, x: 0.5, y: 0.5 })
          }
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setInteraction({
              active: true,
              pressed: true,
              x: (event.clientX - rect.left) / rect.width,
              y: (event.clientY - rect.top) / rect.height,
            });
          }}
          onPointerUp={() =>
            setInteraction((value) => ({ ...value, pressed: false }))
          }
        >
          <div
            className={styles.fallbackLayer}
            data-testid="m2-fallback-layer"
            aria-hidden="true"
          />
          <canvas
            key={rendererEpoch}
            ref={outputCanvasRef}
            className={styles.outputCanvas}
            data-testid="m2-webgl-output"
            data-active={rendererKind === "webgl"}
            aria-hidden="true"
            role="presentation"
          />
          {rendererKind === "css-fallback" ? (
            <div className={styles.fallbackFinish} aria-hidden="true" />
          ) : null}

          <div
            ref={controlsRef}
            className={styles.controls}
            role="group"
            aria-label={source.label}
            data-testid="semantic-controls"
            data-semantic-owner="dom"
          >
            <button
              type="button"
              className={styles.playButton}
              data-testid="m2-play-toggle"
              aria-label={playing ? "Pause explicit video" : "Play explicit video"}
              aria-pressed={playing}
              onClick={() => void togglePlayback()}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <label className={styles.progressLabel}>
              <span className={styles.visuallyHidden}>Video progress</span>
              <input
                type="range"
                data-testid="m2-progress"
                min="0"
                max={progressMaximum}
                step="0.01"
                value={Math.min(currentTime, progressMaximum)}
                aria-valuetext={`${formatMediaTime(currentTime)} of ${formatMediaTime(duration)}`}
                onChange={(event) => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.currentTime = Number(event.currentTarget.value);
                  updateVideoState(video);
                  rendererRef.current?.draw();
                }}
              />
            </label>
            <output
              className={styles.time}
              data-testid="m2-time"
              aria-live="off"
            >
              {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
            </output>
          </div>
        </div>

        <span className={styles.badge}>EXPLICIT VIDEO · SAME ORIGIN</span>
      </div>

      <div className={styles.readout}>
        <div>
          <span>Renderer</span>
          <strong data-testid="m2-renderer-kind">{rendererKind}</strong>
        </div>
        <div>
          <span>Material</span>
          <strong data-testid="m2-material-id">
            {rendererDiagnostics?.materialId ?? transportMaterial.id}
          </strong>
        </div>
        <div>
          <span>Frames / uploads</span>
          <strong data-testid="m2-frame-count">
            {rendererDiagnostics?.frames ?? 0} / {rendererDiagnostics?.uploads ?? 0}
          </strong>
        </div>
        <div>
          <span>Fallback reason</span>
          <strong data-testid="m2-fallback-reason">
            {fallbackReason ?? "none"}
          </strong>
        </div>
      </div>

      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        data-testid="m2-status"
        data-fallback-reason={fallbackReason ?? "none"}
      >
        {statusMessage}
      </p>
      <p className={styles.provenance}>{source.provenance}</p>
      <code className={styles.mapHash} data-testid="m2-map-hash">
        {mapHash || "hashing…"}
      </code>
    </section>
  );
}
