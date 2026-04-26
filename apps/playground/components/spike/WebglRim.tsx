"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  WebGLGlassRenderer,
  type GlassLens,
} from "@glazelab/core";
import type { RimConfig } from "@/lib/spike/rim-config";
import { rimConfigToUniforms } from "@/lib/spike/rim-config-adapter";

interface Props {
  config: RimConfig;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** The ancestor element whose rect the shader samples into. Should be
   *  the backdrop container — the element holding the image/canvas/scroll
   *  content this panel is glass over. */
  targetElement?: HTMLElement | null;
  /** Source for the backdrop texture. The playground renderer supports
   *  Image, Canvas, and ImageBitmap directly. Video is supported by the
   *  renderer but needs per-frame upload (not yet wired in this spike). */
  backdropSource?: HTMLImageElement | HTMLCanvasElement | null;
  /** True = re-upload backdrop every frame (canvas / video). */
  live?: boolean;
}

/**
 * Primary engine — full WebGL glass using the playground's proven renderer.
 *
 * This spike component is intentionally thin: all the hard rendering work
 * (multi-pass blur, refraction, rim lighting, chromatic, tint, specular)
 * lives in lib/webgl-renderer.ts + lib/shader.ts, which are the same
 * modules that produce the visual quality in the main playground. We
 * mount the renderer against a parent target (for backdrop extent) and
 * a panel element (for the glass rect), hand it a single lens with the
 * spike's config mapped to shader uniforms, and push backdrop sources
 * through its uploadBackdrop() entry point.
 *
 * No CSS backdrop-filter — the shader produces the entire panel. Zero
 * seam risk because there's a single pipeline.
 */
export function WebglRim({
  config,
  className,
  style,
  children,
  targetElement,
  backdropSource,
  live,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLGlassRenderer | null>(null);
  const lensRef = useRef<GlassLens | null>(null);
  // Triggers subsequent effects (backdrop upload, observers) once the
  // renderer is initialised. A plain ref wouldn't cause a re-render.
  const [ready, setReady] = useState(0);

  /* Initialise renderer once the target element is known. useLayoutEffect
     so the canvas is appended synchronously and React Strict Mode's
     double-invoke doesn't leave a stray WebGL context. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !targetElement) return;

    let renderer: WebGLGlassRenderer;
    try {
      renderer = new WebGLGlassRenderer(targetElement);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[spike] WebGLGlassRenderer failed to init:", e);
      return;
    }
    rendererRef.current = renderer;
    renderer.start();

    // One lens for this panel. The rectPx is updated each frame in the
    // tick below. Uniforms are refreshed whenever config changes.
    const lens: GlassLens = {
      rectPx: { left: 0, top: 0, width: 0, height: 0 },
      uniforms: rimConfigToUniforms(config, 1),
    };
    lensRef.current = lens;
    renderer.setLenses([lens]);

    setReady((t) => t + 1);

    return () => {
      renderer.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
      lensRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetElement]);

  /* Per-frame tick: measure the panel's rect against the target, update
     the lens's rectPx + uniforms so the renderer picks them up next draw. */
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const panel = panelRef.current;
      const target = targetElement;
      const lens = lensRef.current;
      if (panel && target && lens) {
        const pr = panel.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        lens.rectPx.left = pr.left - tr.left;
        lens.rectPx.top = pr.top - tr.top;
        lens.rectPx.width = pr.width;
        lens.rectPx.height = pr.height;
        // bevelWidth / bendZone depend on the panel's min dim, so recompute
        // uniforms every tick. It's a cheap object rebuild (no GL work).
        lens.uniforms = rimConfigToUniforms(
          config,
          Math.min(pr.width, pr.height),
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [config, targetElement, ready]);

  /* Upload backdrop when source / target changes. Cover-fits the source
     onto a viewport-sized canvas so u_bounds math is correct in shader
     (identical pattern to the playground's GlassCanvas). For live sources
     (canvas, video-in-future) re-upload every animation frame. */
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !backdropSource || !targetElement) return;

    const rebuild = (): HTMLCanvasElement | null => {
      const rect = targetElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      if (backdropSource instanceof HTMLImageElement) {
        if (!backdropSource.complete || backdropSource.naturalWidth === 0) {
          return null;
        }
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = c.getContext("2d");
      if (!ctx) return null;

      const srcW =
        backdropSource instanceof HTMLImageElement
          ? backdropSource.naturalWidth
          : backdropSource.width;
      const srcH =
        backdropSource instanceof HTMLImageElement
          ? backdropSource.naturalHeight
          : backdropSource.height;
      if (srcW === 0 || srcH === 0) return null;

      // Cover-fit: preserve aspect, crop to match viewport.
      const srcAspect = srcW / srcH;
      const dstAspect = c.width / c.height;
      let sx = 0,
        sy = 0,
        sw = srcW,
        sh = srcH;
      if (srcAspect > dstAspect) {
        sw = srcH * dstAspect;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / dstAspect;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(backdropSource, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return c;
    };

    if (!live) {
      const doUpload = () => {
        const c = rebuild();
        if (c) renderer.uploadBackdrop(c);
      };
      if (
        backdropSource instanceof HTMLImageElement &&
        (!backdropSource.complete || backdropSource.naturalWidth === 0)
      ) {
        backdropSource.addEventListener("load", doUpload, { once: true });
        return () => backdropSource.removeEventListener("load", doUpload);
      }
      doUpload();
      return;
    }

    let cancelled = false;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      const c = rebuild();
      if (c) {
        try {
          renderer.uploadBackdrop(c);
        } catch {
          // Occasional failures (e.g. video before first frame) — retry next rAF.
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [backdropSource, live, targetElement, ready]);

  return (
    <div
      ref={panelRef}
      className={`relative ${className ?? ""}`}
      style={{
        ...style,
        borderRadius: config.radius,
        // No backdrop-filter here — the shader produces the whole panel
        // including body blur. A bare DOM anchor is all we need.
      }}
    >
      {children}
    </div>
  );
}
