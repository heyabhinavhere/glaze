"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import { useGlazeMaterial, useGlazeRuntime } from "./context";
import {
  defaultGlazeMaterial,
  defaultGlazeMotion,
} from "../material";
import {
  GlazeSurfaceContext,
  type GlazeSurfaceRuntime,
  type OpticalControlRegistration,
} from "./surface-context";
import {
  drawAcceptedMaterialDecoration,
  drawCanvasSource,
  drawImageSource,
  drawOwnedSvgSource,
  drawVideoSource,
  inspectOwnedDecorationElement,
} from "./source-contract";
import type { OpticalSurfaceRenderer } from "../optics/renderer";
import type {
  GlazeCapability,
  GlazeCapabilityResult,
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMediaSource,
  GlazeRendererDiagnostics,
} from "../types";

type RendererState = "initializing" | "webgl" | "fallback";

interface SourceSurfaceProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  readonly capability: Exclude<GlazeCapability, "css-fallback">;
  readonly children?: ReactNode;
  readonly material: string;
  readonly materialDefaults?: GlazeMaterialInput;
  readonly mediaSource?: GlazeMediaSource;
  readonly ownedSource?: ReactElement<SVGProps<SVGSVGElement>>;
}

function rendererDiagnostics(
  renderer: OpticalSurfaceRenderer | null,
): GlazeRendererDiagnostics | undefined {
  if (!renderer) return undefined;
  const diagnostics = renderer.getDiagnostics();
  return {
    rendererId: diagnostics.rendererId,
    renderer: "webgl2-displacement-map",
    frames: diagnostics.frames,
    mapRenders: diagnostics.mapRenders,
    uploads: diagnostics.uploads,
    controlCount: diagnostics.controlCount,
    settled: diagnostics.settled,
    contextLost: diagnostics.contextLost,
  };
}

function fallbackVariables(material: GlazeMaterial): CSSProperties {
  return {
    "--glaze-fallback-blur": `${Math.round(5 + material.roughness * 15)}px`,
    "--glaze-fallback-tint": material.tint.color,
    "--glaze-fallback-tint-opacity": `${Math.max(
      0.08,
      material.tint.opacity,
    )}`,
    "--glaze-fallback-highlight": `${material.lighting.highlight}`,
    "--glaze-fallback-occlusion": `${material.lighting.occlusion}`,
  } as CSSProperties;
}

function validateMediaSource(source: GlazeMediaSource | undefined) {
  if (source?.type === "image" && !source.src) {
    return "explicit-media-image-source-required";
  }
  if (source?.type === "video" && source.sources.length === 0) {
    return "explicit-media-video-source-required";
  }
  return undefined;
}

function mediaSourceDescriptorKey(
  source: GlazeMediaSource | undefined,
): string | undefined {
  if (!source) return undefined;
  if (source.type === "image") {
    return `image:${source.src}|${source.crossOrigin ?? ""}|${
      source.focalPoint?.join(",") ?? ""
    }`;
  }
  if (source.type === "video") return `video:${JSON.stringify(source)}`;
  return "canvas";
}

export function SourceSurface({
  capability,
  children,
  className,
  material: materialName,
  materialDefaults,
  mediaSource,
  ownedSource,
  style,
  ...props
}: SourceSurfaceProps) {
  const runtime = useGlazeRuntime();
  const { motion, registerSurface } = runtime;
  const material = useGlazeMaterial(materialName, materialDefaults);
  const mediaSourceType = mediaSource?.type;
  const desiredMediaSourceKey = mediaSourceDescriptorKey(mediaSource);
  const sourceValidationReason = validateMediaSource(mediaSource);
  const elementContractReasons = useMemo(
    () => inspectOwnedDecorationElement(ownedSource),
    [ownedSource],
  );
  const surfaceId = `glaze-surface-${useId().replaceAll(":", "")}`;
  const stageRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const materialDecorationRef = useRef<HTMLCanvasElement>(null);
  const ownedInputRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<OpticalSurfaceRenderer | null>(null);
  const repaintRef = useRef<(() => void) | null>(null);
  const mediaSourceRef = useRef(mediaSource);
  const elementContractReasonsRef = useRef(elementContractReasons);
  const materialRef = useRef(defaultGlazeMaterial);
  const motionRef = useRef(defaultGlazeMotion);
  const pendingControls = useRef(new Map<string, OpticalControlRegistration>());
  const [rendererState, setRendererState] = useState<RendererState>(
    "initializing",
  );
  const [fallbackReason, setFallbackReason] = useState(
    "renderer-initializing",
  );
  const [rendererIdentity, setRendererIdentity] = useState<{
    readonly id: number;
    readonly kind: GlazeRendererDiagnostics["renderer"];
    readonly sourceType: GlazeMediaSource["type"] | undefined;
  } | null>(null);
  const [activeMediaSourceKey, setActiveMediaSourceKey] = useState<
    string | undefined
  >(undefined);
  const [controlCount, setControlCount] = useState(0);
  const rendererMatchesSource = !rendererIdentity
    || rendererIdentity.sourceType === mediaSourceType;
  const sourceTransitioning = capability === "explicit-media"
    && desiredMediaSourceKey !== activeMediaSourceKey;
  const effectiveRendererState = sourceValidationReason
    ? "fallback"
    : sourceTransitioning || !rendererMatchesSource
      ? "initializing"
      : rendererState;
  const capabilityResult: GlazeCapabilityResult = useMemo(
    () => ({
      requested: capability,
      effective: effectiveRendererState === "webgl"
        ? capability
        : "css-fallback",
      reason: effectiveRendererState === "webgl"
        ? undefined
        : sourceValidationReason
          ?? (effectiveRendererState === "initializing" && sourceTransitioning
            ? "explicit-media-source-loading"
            : fallbackReason),
    }),
    [
      capability,
      effectiveRendererState,
      fallbackReason,
      sourceTransitioning,
      sourceValidationReason,
    ],
  );
  const register = useCallback((registration: OpticalControlRegistration) => {
    pendingControls.current.set(registration.id, registration);
    setControlCount(pendingControls.current.size);
    rendererRef.current?.registerControl(registration);
    return () => {
      pendingControls.current.delete(registration.id);
      setControlCount(pendingControls.current.size);
      rendererRef.current?.unregisterControl(registration.id);
    };
  }, []);
  const update = useCallback((
    id: string,
    selectionCount: number,
    selectedPosition: number,
    selectionVisible: boolean,
  ) => {
    const pending = pendingControls.current.get(id);
    if (pending) {
      pendingControls.current.set(id, {
        ...pending,
        selectionCount,
        selectedPosition,
        selectionVisible,
      });
    }
    rendererRef.current?.updateControl(
      id,
      selectionCount,
      selectedPosition,
      selectionVisible,
    );
  }, []);
  const energize = useCallback((id: string, active: boolean) => {
    rendererRef.current?.setPointer(id, active);
  }, []);
  const release = useCallback((id: string) => {
    rendererRef.current?.releasePointer(id);
  }, []);
  const getRendererDiagnostics = useCallback(
    () => rendererDiagnostics(rendererRef.current),
    [],
  );
  const surfaceRuntime = useMemo<GlazeSurfaceRuntime>(
    () => ({
      capability: capabilityResult,
      material: materialName,
      register,
      update,
      energize,
      release,
      getRendererDiagnostics,
    }),
    [
      capabilityResult,
      energize,
      getRendererDiagnostics,
      materialName,
      register,
      release,
      update,
    ],
  );

  useEffect(() => registerSurface(surfaceId, {
    getSnapshot: () => ({
      id: surfaceId,
      material: materialName,
      ...capabilityResult,
      renderer: rendererDiagnostics(rendererRef.current),
    }),
  }), [capabilityResult, materialName, registerSurface, surfaceId]);

  useEffect(() => {
    materialRef.current = material;
    rendererRef.current?.setMaterial(material);
  }, [material]);

  useEffect(() => {
    motionRef.current = motion;
    rendererRef.current?.setMotion(motion);
  }, [motion]);

  useEffect(() => {
    mediaSourceRef.current = mediaSource;
  }, [mediaSource]);

  useEffect(() => {
    elementContractReasonsRef.current = elementContractReasons;
  }, [elementContractReasons]);

  useEffect(() => {
    const stage = stageRef.current;
    const source = sourceRef.current;
    const output = outputRef.current;
    const materialDecoration = materialDecorationRef.current;
    const ownedInput = ownedInputRef.current;
    const image = imageRef.current;
    const video = videoRef.current;
    if (!stage || !source || !output || !materialDecoration) return;

    let destroyed = false;
    let frameId = 0;
    let videoFrameId = 0;
    let sourceDirty = false;
    let sourceValid = false;
    let visible = true;
    let sourcePaintVersion = 0;
    let verifiedOriginCleanKey: string | undefined;
    let initializationStarted = false;
    let warnedInvalidSource = false;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const forcedColors = window.matchMedia("(forced-colors: active)");

    const setState = (state: RendererState, reason?: string) => {
      if (destroyed) return;
      setRendererState((current) => current === state ? current : state);
      if (reason) setFallbackReason(reason);
    };
    const handleFallback = (reason: string) => setState("fallback", reason);

    const frame = (time: number) => {
      frameId = 0;
      if (destroyed || !visible || document.hidden || forcedColors.matches) {
        return;
      }
      const result = rendererRef.current?.render(
        time,
        reducedMotion.matches,
        sourceDirty,
      );
      sourceDirty = false;
      if (result?.rendered && sourceValid) setState("webgl");
      if (result?.needsFrame) scheduleFrame();
    };

    const scheduleFrame = (dirty = false) => {
      if (dirty) sourceDirty = true;
      if (
        destroyed
        || frameId !== 0
        || !visible
        || document.hidden
        || forcedColors.matches
      ) {
        return;
      }
      frameId = window.requestAnimationFrame(frame);
    };
    const reportInvalidOwnedSource = (reasons: readonly string[]) => {
      sourceValid = false;
      if (process.env.NODE_ENV !== "production" && !warnedInvalidSource) {
        warnedInvalidSource = true;
        console.warn("[Glaze] Invalid owned-decoration source:", reasons);
      }
      handleFallback(reasons.join(","));
    };

    const paintOwnedSource = async () => {
      if (!ownedInput) return false;
      const reasons = elementContractReasonsRef.current;
      if (reasons.length > 0) {
        reportInvalidOwnedSource(reasons);
        return false;
      }
      const version = ++sourcePaintVersion;
      try {
        const inspection = await drawOwnedSvgSource(source, ownedInput);
        if (destroyed) return false;
        if (version !== sourcePaintVersion) return true;
        if (!inspection.valid) {
          reportInvalidOwnedSource(inspection.reasons);
          return false;
        }
        sourceValid = true;
        scheduleFrame(true);
        return true;
      } catch (error) {
        sourceValid = false;
        handleFallback(
          error instanceof Error
            ? error.message
            : "owned-decoration-render-failed",
        );
        return false;
      }
    };

    const paintMediaSource = () => {
      const currentSource = mediaSourceRef.current;
      if (!currentSource) return false;
      try {
        const painted = currentSource.type === "image"
          ? image ? drawImageSource(source, image, currentSource) : false
          : currentSource.type === "video"
            ? video ? drawVideoSource(source, video) : false
            : drawCanvasSource(source, currentSource);
        if (painted) {
          const paintedKey = mediaSourceDescriptorKey(currentSource);
          if (
            currentSource.type === "canvas"
            || verifiedOriginCleanKey !== paintedKey
          ) {
            source.getContext("2d")?.getImageData(0, 0, 1, 1);
            verifiedOriginCleanKey = paintedKey;
          }
          sourceValid = true;
          setActiveMediaSourceKey((current) =>
            current === paintedKey ? current : paintedKey
          );
          scheduleFrame(true);
        }
        return painted;
      } catch (error) {
        sourceValid = false;
        setActiveMediaSourceKey(mediaSourceDescriptorKey(currentSource));
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
        || forcedColors.matches
      ) {
        return;
      }
      videoFrameId = video.requestVideoFrameCallback(() => {
        videoFrameId = 0;
        if (paintMediaSource()) armVideoFrame();
      });
    };

    const initialize = async () => {
      if (initializationStarted || rendererRef.current) return;
      if (forcedColors.matches) {
        handleFallback("forced-colors-active");
        return;
      }
      initializationStarted = true;
      drawAcceptedMaterialDecoration(materialDecoration);
      const painted = capability === "owned-decoration"
        ? await paintOwnedSource()
        : paintMediaSource();
      if (!painted) {
        initializationStarted = false;
        return;
      }
      if (destroyed) return;

      try {
        const { OpticalSurfaceRenderer: Renderer } = await import(
          "../optics/renderer"
        );
        if (destroyed) return;
        const renderer = new Renderer({
          canvas: output,
          source,
          ownedDecoration: materialDecoration,
          material: materialRef.current,
          motion: motionRef.current,
          onFallback: handleFallback,
          onRequestFrame: () => scheduleFrame(),
          onContextRestored: () => {
            rendererRef.current?.destroy();
            rendererRef.current = null;
            initializationStarted = false;
            setState("initializing", "webgl-context-restoring");
            void initialize();
          },
        });
        rendererRef.current = renderer;
        setRendererIdentity({
          id: renderer.rendererId,
          kind: "webgl2-displacement-map",
          sourceType: mediaSourceType,
        });
        for (const registration of pendingControls.current.values()) {
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

    const repaint = () => {
      if (capability === "owned-decoration") void paintOwnedSource();
      else paintMediaSource();
    };
    repaintRef.current = repaint;
    const resizeObserver = new ResizeObserver(repaint);
    resizeObserver.observe(stage);
    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (!visible) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        cancelVideoFrame();
      } else {
        repaint();
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
        repaint();
        scheduleFrame();
        armVideoFrame();
      }
    };
    const handleReducedMotion = () => scheduleFrame();
    const handleForcedColors = () => {
      if (forcedColors.matches) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        cancelVideoFrame();
        handleFallback("forced-colors-active");
      } else if (rendererRef.current) {
        setState("webgl");
        scheduleFrame();
        armVideoFrame();
      } else {
        void initialize();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleReducedMotion);
    forcedColors.addEventListener("change", handleForcedColors);

    const handleMediaReady = () => {
      if (paintMediaSource() && !rendererRef.current) void initialize();
      if (video) void video.play().catch(() => undefined);
      armVideoFrame();
    };
    const handleMediaFrameWithoutRvfc = () => {
      if (!video?.requestVideoFrameCallback) paintMediaSource();
    };
    const handleMediaError = () => {
      sourceValid = false;
      setActiveMediaSourceKey(mediaSourceDescriptorKey(mediaSourceRef.current));
      handleFallback("explicit-media-load-failed");
    };
    image?.addEventListener("load", handleMediaReady);
    image?.addEventListener("error", handleMediaError);
    video?.addEventListener("loadeddata", handleMediaReady);
    video?.addEventListener("play", armVideoFrame);
    video?.addEventListener("pause", cancelVideoFrame);
    video?.addEventListener("seeked", paintMediaSource);
    video?.addEventListener("timeupdate", handleMediaFrameWithoutRvfc);
    video?.addEventListener("error", handleMediaError);

    const currentSource = mediaSourceRef.current;
    if (
      capability === "owned-decoration"
      || currentSource?.type === "canvas"
      || (currentSource?.type === "image" && image?.complete)
      || (
        currentSource?.type === "video"
        && (video?.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA
      )
    ) {
      void initialize();
    }

    return () => {
      destroyed = true;
      sourcePaintVersion += 1;
      repaintRef.current = null;
      window.cancelAnimationFrame(frameId);
      cancelVideoFrame();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleReducedMotion);
      forcedColors.removeEventListener("change", handleForcedColors);
      image?.removeEventListener("load", handleMediaReady);
      image?.removeEventListener("error", handleMediaError);
      video?.removeEventListener("loadeddata", handleMediaReady);
      video?.removeEventListener("play", armVideoFrame);
      video?.removeEventListener("pause", cancelVideoFrame);
      video?.removeEventListener("seeked", paintMediaSource);
      video?.removeEventListener("timeupdate", handleMediaFrameWithoutRvfc);
      video?.removeEventListener("error", handleMediaError);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [
    capability,
    mediaSourceType,
  ]);

  useEffect(() => {
    repaintRef.current?.();
  }, [elementContractReasons, ownedSource]);

  const imageSourceKey = mediaSource?.type === "image"
    ? desiredMediaSourceKey
    : undefined;
  const videoSourceKey = mediaSource?.type === "video"
    ? desiredMediaSourceKey
    : undefined;
  const canvasDraw = mediaSource?.type === "canvas"
    ? mediaSource.draw
    : undefined;
  const canvasSubscribe = mediaSource?.type === "canvas"
    ? mediaSource.subscribe
    : undefined;

  useEffect(() => {
    const currentSource = mediaSourceRef.current;
    if (currentSource?.type === "image") {
      if (!currentSource.src) return;
      const source = sourceRef.current;
      if (source) source.width = source.width;
      repaintRef.current?.();
    } else if (currentSource?.type === "video") {
      if (currentSource.sources.length === 0) return;
      const source = sourceRef.current;
      if (source) source.width = source.width;
      videoRef.current?.load();
    }
  }, [imageSourceKey, mediaSourceType, videoSourceKey]);

  useEffect(() => {
    if (!canvasDraw) return;
    repaintRef.current?.();
    return canvasSubscribe?.(() => repaintRef.current?.());
  }, [canvasDraw, canvasSubscribe]);

  const classes = ["glaze-source-surface", className].filter(Boolean).join(" ");
  return (
    <section
      {...props}
      ref={stageRef}
      className={classes}
      data-glaze-capability-effective={capabilityResult.effective}
      data-glaze-capability-requested={capabilityResult.requested}
      data-glaze-fallback={capabilityResult.reason}
      data-glaze-control-count={controlCount}
      data-glaze-renderer-id={rendererIdentity?.id}
      data-glaze-renderer-kind={rendererIdentity?.kind}
      data-glaze-renderer={effectiveRendererState}
      style={{ ...fallbackVariables(material), ...style }}
    >
      {ownedSource ? (
        <div
          ref={ownedInputRef}
          className="glaze-source-surface__input"
          data-glaze-owned-decoration="true"
          aria-hidden="true"
          inert
        >
          {ownedSource}
        </div>
      ) : null}
      {mediaSource?.type === "image" ? (
        // The sampled media is explicitly visual-only; the surface owns the
        // accessible label and the semantic controls remain in `children`.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          className="glaze-source-surface__input"
          src={mediaSource.src}
          crossOrigin={mediaSource.crossOrigin}
          alt=""
          aria-hidden="true"
        />
      ) : null}
      {mediaSource?.type === "video" ? (
        <video
          ref={videoRef}
          className="glaze-source-surface__input"
          autoPlay={mediaSource.autoPlay ?? true}
          crossOrigin={mediaSource.crossOrigin}
          loop={mediaSource.loop ?? true}
          muted={mediaSource.muted ?? true}
          playsInline
          poster={mediaSource.poster}
          preload={mediaSource.preload ?? "auto"}
          aria-hidden="true"
        >
          {mediaSource.sources.map((item) => (
            <source key={`${item.src}:${item.type}`} {...item} />
          ))}
        </video>
      ) : null}
      <canvas
        ref={sourceRef}
        className="glaze-source-surface__source"
        data-glaze-source={capability}
        aria-hidden="true"
      />
      <canvas
        ref={materialDecorationRef}
        className="glaze-source-surface__input"
        data-glaze-material-decoration="accepted-kernel"
        aria-hidden="true"
      />
      <canvas
        ref={outputRef}
        className="glaze-source-surface__output"
        data-glaze-output={capability}
        aria-hidden="true"
      />
      <GlazeSurfaceContext.Provider value={surfaceRuntime}>
        <div className="glaze-source-surface__content">{children}</div>
      </GlazeSurfaceContext.Provider>
    </section>
  );
}
