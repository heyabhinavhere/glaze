"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  WebGLGlassRenderer,
  type GlassLens,
  type GlassUniforms,
} from "@/lib/webgl-renderer";

/* ---- Module-level decode dedup ------------------------------------------
 * One in-flight decode Promise per URL, shared across the preload effect,
 * captureAsync, and Strict Mode's double-mount. Without this, each caller
 * creates its own <img>, and when the same URL decodes simultaneously from
 * multiple <img> elements the browser serialises and a later decode can
 * stall by 10+ seconds waiting for the first to release.
 *
 * Keyed by `src`. Survives component remounts (module scope). HMR in dev
 * clears it naturally with the module reload, which is the desired
 * behaviour since the rest of the state resets too.
 */
const decodePromises = new Map<string, Promise<HTMLImageElement>>();

function decodeImageOnce(src: string): Promise<HTMLImageElement> {
  const existing = decodePromises.get(src);
  if (existing) return existing;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  // `.decode()` returns a promise that resolves once the image is fully
  // decoded and ready to be painted (drawImage / texImage2D). Wrap to
  // return the Image itself so callers don't have to close over `img`.
  const promise = img.decode().then(() => img);
  decodePromises.set(src, promise);
  // On decode failure, evict so a future call can retry.
  promise.catch(() => decodePromises.delete(src));
  return promise;
}

export interface GlassCanvasProps {
  /** Ref to the element whose area will be captured as the backdrop. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Ref to the primary glass region (the draggable preview panel). */
  glassRef: React.RefObject<HTMLElement | null>;
  /** Uniforms for the primary glass. */
  uniforms: GlassUniforms;
  /** Optional ref to a secondary glass region (e.g. the floating controls panel). */
  panelRef?: React.RefObject<HTMLElement | null>;
  /** Uniforms for the secondary glass. Required if `panelRef` is provided. */
  panelUniforms?: GlassUniforms;
  /**
   * Re-capture trigger — bump this value (e.g. bgId) when the backdrop
   * content changes so the texture is refreshed.
   */
  captureKey: string | number;
  /**
   * Fast path: if provided, loads this image directly as the backdrop
   * texture instead of running html2canvas. Use when the backdrop is a
   * single static image.
   */
  fastImageSrc?: string;
  /**
   * Optional list of image sources to preload + decode on mount. Lets the
   * caller warm the cache so background switches are instant.
   */
  preloadSrcs?: readonly string[];
}

/**
 * WebGL glass overlay. Creates one full-viewport canvas over `targetRef`,
 * renders each of the provided lens rects with its own uniforms.
 */
export function GlassCanvas({
  targetRef,
  glassRef,
  uniforms,
  panelRef,
  panelUniforms,
  captureKey,
  fastImageSrc,
  preloadSrcs,
}: GlassCanvasProps) {
  const rendererRef = useRef<WebGLGlassRenderer | null>(null);
  const uniformsRef = useRef<GlassUniforms>(uniforms);
  uniformsRef.current = uniforms;
  const panelUniformsRef = useRef<GlassUniforms | undefined>(panelUniforms);
  panelUniformsRef.current = panelUniforms;

  /**
   * Cache decoded fast-path images by src. Module-level persistent map
   * across renders so repeated bg switches don't re-decode the same JPEG.
   */
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  /**
   * Bumped after the renderer is created so the capture useLayoutEffect
   * (which would otherwise run before the renderer-creation useEffect on
   * first mount) re-runs with a valid rendererRef. Without this, first load
   * shows a bare backdrop with no glass until the user changes bg — which
   * re-triggers the capture effect because captureKey changes.
   */
  const [rendererTick, setRendererTick] = useState(0);

  /* Create renderer once, tear down on unmount. */
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    let cancelled = false;
    let renderer: WebGLGlassRenderer | null = null;
    try {
      renderer = new WebGLGlassRenderer(target);
      rendererRef.current = renderer;
      renderer.start();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("WebGLGlassRenderer failed to init:", e);
      return;
    }

    // Signal the capture effect that the renderer is ready. This is what
    // makes first-mount work without requiring a bg switch: setting state
    // here causes a re-render, which triggers the capture useLayoutEffect
    // to re-run (its deps include rendererTick) with a valid rendererRef.
    setRendererTick((t) => t + 1);

    // Two reusable lens objects — we mutate them in-place each frame
    // instead of allocating per-frame to avoid GC churn.
    const primaryLens: GlassLens = {
      rectPx: { left: 0, top: 0, width: 0, height: 0 },
      uniforms: uniformsRef.current,
    };
    const secondaryLens: GlassLens = {
      rectPx: { left: 0, top: 0, width: 0, height: 0 },
      uniforms: uniformsRef.current,
    };

    const updateLenses = () => {
      const tgt = targetRef.current;
      if (!tgt || !renderer) return;
      const tr = tgt.getBoundingClientRect();
      const lenses: GlassLens[] = [];

      const glass = glassRef.current;
      if (glass) {
        const gr = glass.getBoundingClientRect();
        primaryLens.rectPx.left = gr.left - tr.left;
        primaryLens.rectPx.top = gr.top - tr.top;
        primaryLens.rectPx.width = gr.width;
        primaryLens.rectPx.height = gr.height;
        primaryLens.uniforms = uniformsRef.current;
        lenses.push(primaryLens);
      }

      const panel = panelRef?.current;
      const panelU = panelUniformsRef.current;
      if (panel && panelU) {
        const pr = panel.getBoundingClientRect();
        secondaryLens.rectPx.left = pr.left - tr.left;
        secondaryLens.rectPx.top = pr.top - tr.top;
        secondaryLens.rectPx.width = pr.width;
        secondaryLens.rectPx.height = pr.height;
        secondaryLens.uniforms = panelU;
        lenses.push(secondaryLens);
      }

      renderer.setLenses(lenses);
    };

    const tick = () => {
      if (cancelled) return;
      updateLenses();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      renderer?.dispose();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Warm the image cache so background switches are instant. Shares
     in-flight decodes with captureAsync via the module-level dedup map. */
  useEffect(() => {
    if (!preloadSrcs?.length) return;
    let cancelled = false;
    for (const src of preloadSrcs) {
      if (imgCacheRef.current.has(src)) continue;
      decodeImageOnce(src)
        .then((img) => {
          if (!cancelled) {
            imgCacheRef.current.set(src, img);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadSrcs?.join("|")]);

  /* Capture the backdrop whenever the renderer becomes ready, the capture
     key changes (bg swap), or the fast image src changes. Uses
     useLayoutEffect so the texture upload runs synchronously after React's
     DOM commit but before the browser paints — no visible flash on swap. */
  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    const target = targetRef.current;
    if (!renderer || !target) return;

    let cancelled = false;

    const renderImageToCanvas = (
      img: HTMLImageElement,
      rect: DOMRect,
    ): HTMLCanvasElement | null => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      const imgAspect = img.width / img.height;
      const canvasAspect = c.width / c.height;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return c;
    };

    const captureSyncIfCached = (): boolean => {
      if (!fastImageSrc) return false;
      const img = imgCacheRef.current.get(fastImageSrc);
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const c = renderImageToCanvas(img, rect);
      if (!c) return false;
      renderer.uploadBackdrop(c);
      return true;
    };

    const captureAsync = async () => {
      if (fastImageSrc) {
        try {
          let img = imgCacheRef.current.get(fastImageSrc) ?? null;
          if (!img) {
            // Shared in-flight decode — if preload already started the
            // decode for this URL, we await the same promise instead of
            // kicking off a duplicate Image() that would contend with it.
            img = await decodeImageOnce(fastImageSrc);
            if (cancelled) return;
            imgCacheRef.current.set(fastImageSrc, img);
          }
          const rect = target.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const c = renderImageToCanvas(img, rect);
          if (!c || cancelled) return;
          renderer.uploadBackdrop(c);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("fast image capture failed:", e);
        }
      } else {
        try {
          const canvas = await html2canvas(target, {
            backgroundColor: null,
            logging: false,
            useCORS: true,
            scale: Math.min(2, window.devicePixelRatio || 1),
            ignoreElements: (el) =>
              el.tagName === "CANVAS" || el.hasAttribute("data-glass-ignore"),
          });
          if (cancelled) return;
          renderer.uploadBackdrop(canvas);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("html2canvas failed:", e);
        }
      }
    };

    const synced = captureSyncIfCached();
    if (!synced) {
      Promise.resolve().then(captureAsync);
    }

    // Re-capture on resize (debounced).
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!captureSyncIfCached()) Promise.resolve().then(captureAsync);
      }, 60);
    });
    observer.observe(target);

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [captureKey, fastImageSrc, targetRef, rendererTick]);

  return null;
}
