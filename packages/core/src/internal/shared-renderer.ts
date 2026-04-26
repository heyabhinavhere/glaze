/**
 * SharedRenderer — the singleton at the heart of @glazelab/core.
 *
 * One per page realm. Owns:
 *   - An OffscreenCanvas + WebGL2 rendering context (offscreen so per-lens
 *     visible canvases can sit at correct z-order in the host's stacking
 *     context — see design §3).
 *   - The compiled shader programs (one set, shared across all lenses).
 *   - The shared FBO pool (sub-task 3c — sized to largest active lens).
 *   - The set of registered lenses (sub-task 3b adds Lens registration).
 *   - The render loop (sub-task 3b).
 *   - WebGL context loss/restored handling (sub-task 3c).
 *
 * Lifecycle is refcount-managed via {@link acquire} / {@link release} with
 * a 1-second deferred destroy that absorbs Strict-Mode mount-cycles and
 * SPA route navigations (design §3.5).
 *
 * SCOPE — sub-task 3a (this file):
 *   - Constructor: OffscreenCanvas + GL2 context + shader compile.
 *   - Lifecycle: acquire / release with deferred destroy + HMR cleanup.
 *   - destroy(): tears down GL resources idempotently.
 *   - NO render loop, NO lens registration, NO context loss handling
 *     yet — those land in 3b/3c.
 */

import {
  BLUR_FRAGMENT,
  BLUR_VERTEX,
  FRAGMENT_SHADER,
  VERTEX_SHADER,
} from "../shader";
import type { Lens } from "./lens";

/** Devicepixel cap. Design §M21 — capped at 2× even on 3× displays;
 *  the slight quality reduction is imperceptible, the memory savings
 *  are 2.25×. Per-frame allocation cost is also smaller. */
const MAX_DPR = 2;

/** Grace window before destroying the singleton when refcount hits 0.
 *  Tuned so Strict-Mode mount→unmount→mount (typically <100ms) and
 *  SPA route changes that re-mount glass on the new page (typically
 *  <500ms) absorb without paying GL context creation twice. */
const DEFERRED_DESTROY_MS = 1000;

export class SharedRenderer {
  /** The offscreen canvas the GL2 context renders into. Lens visible
   *  canvases blit from this via transferToImageBitmap. */
  readonly offscreen: OffscreenCanvas;
  /** The WebGL2 context. Kept readonly for callers; mutable internally. */
  readonly gl: WebGL2RenderingContext;

  /** Compiled glass program (vertex + fragment for the body+rim shader). */
  private readonly glassProgram: WebGLProgram;
  /** Compiled blur program (separable Gaussian for the body-blur pipeline). */
  private readonly blurProgram: WebGLProgram;

  /** Registered lenses. Keyed by lens.id. */
  private readonly lenses = new Map<number, Lens>();

  /** Active rAF id, or null when no tick is pending. */
  private rafId: number | null = null;

  /** True once destroy() has run; subsequent calls are no-ops. */
  private destroyed = false;

  constructor() {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error(
        "@glazelab/core: OffscreenCanvas is not available in this environment. " +
          "Falls back to CSS path automatically; this constructor should not be reached.",
      );
    }
    // 1×1 starts; FBO pool resizes drawing buffer per-lens (sub-task 3c).
    this.offscreen = new OffscreenCanvas(1, 1);

    const gl = this.offscreen.getContext("webgl2", {
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false, // we do shader-side anti-aliasing
      // Hint browsers that this is a foreground, low-power-friendly draw.
      powerPreference: "low-power",
    });
    if (!gl) {
      throw new Error(
        "@glazelab/core: WebGL2 context unavailable. Caller must check " +
          "isSupported() before constructing SharedRenderer.",
      );
    }
    this.gl = gl;

    this.glassProgram = compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.blurProgram = compileProgram(gl, BLUR_VERTEX, BLUR_FRAGMENT);
  }

  /** Register a lens for per-frame rendering. Idempotent. */
  registerLens(lens: Lens): void {
    if (this.destroyed) return;
    this.lenses.set(lens.id, lens);
    this.scheduleTick();
  }

  /** Unregister a lens. Idempotent. */
  unregisterLens(id: number): void {
    this.lenses.delete(id);
    if (this.lenses.size === 0) this.cancelTick();
  }

  /** Tear down all GL resources. Idempotent — safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelTick();
    this.lenses.clear();
    // Programs first (their attached shaders get freed).
    this.gl.deleteProgram(this.glassProgram);
    this.gl.deleteProgram(this.blurProgram);
    // Force the context to lose itself so the browser frees driver memory
    // immediately rather than waiting on GC.
    const lose = this.gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
  }

  /* ------------------------------------------------------------------------ */
  /* Render loop                                                              */
  /* ------------------------------------------------------------------------ */

  private scheduleTick(): void {
    if (this.rafId !== null) return;
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private cancelTick(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    this.rafId = null;
    if (this.destroyed || this.lenses.size === 0) return;

    for (const lens of this.lenses.values()) {
      if (lens.destroyed) continue;
      this.renderLens(lens);
    }

    // Schedule the next tick. Sub-task 3d adds visibility / dirty-flag
    // gating so we only tick when something actually changed; for 3b
    // we tick continuously while any lens is registered.
    this.scheduleTick();
  };

  /** Render a single lens's content. Sub-task 3b: test pattern (a soft
   *  translucent gradient) — exercises the full offscreen → bitmap →
   *  per-lens-canvas blit pipeline. Sub-task 3c replaces the test
   *  pattern with the real glass shader. */
  private renderLens(lens: Lens): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(lens.rect.w * dpr));
    const h = Math.max(1, Math.round(lens.rect.h * dpr));

    // Resize the shared offscreen canvas to fit this lens. This also
    // resizes the GL drawing buffer; viewport tracks the buffer.
    if (this.offscreen.width !== w) this.offscreen.width = w;
    if (this.offscreen.height !== h) this.offscreen.height = h;

    const gl = this.gl;
    gl.viewport(0, 0, w, h);

    /* ----- 3b test pattern ---------------------------------------------
     * Clear with a translucent vertical gradient by drawing two clears
     * at half-height each. (Real GL gradient needs a small program;
     * we'll have one in 3c, so for 3b we keep it shader-less and just
     * exercise glClear / blit.) Result: two-tone semi-transparent fill,
     * visually proves the offscreen → bitmap → blit path. */
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, h / 2, w, h / 2);
    gl.clearColor(1, 1, 1, 0.18);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.scissor(0, 0, w, h / 2);
    gl.clearColor(1, 1, 1, 0.06);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);

    // Take ownership of the offscreen pixels — this is the cheap part
    // (just transferring a reference, not copying pixels). After this,
    // the offscreen is blanked for the next lens.
    const bitmap = this.offscreen.transferToImageBitmap();

    // Blit to the lens's visible 2D canvas.
    lens.blit(bitmap);
  }
}

/* -------------------------------------------------------------------------- */
/* Singleton lifecycle — refcount + deferred destroy                          */
/* -------------------------------------------------------------------------- */

let instance: SharedRenderer | null = null;
let refcount = 0;
let pendingDestroy: ReturnType<typeof setTimeout> | null = null;

/** Acquire (creating if necessary) the page's shared renderer. Increments
 *  refcount. Cancels any pending destroy from a recent release().
 *
 *  THROWS if WebGL2 / OffscreenCanvas are unavailable. Callers must check
 *  {@link isSupported} first, or wrap in try/catch and degrade to the CSS
 *  fallback. */
export function acquire(): SharedRenderer {
  if (pendingDestroy !== null) {
    clearTimeout(pendingDestroy);
    pendingDestroy = null;
  }
  if (instance === null) {
    instance = new SharedRenderer();
  }
  refcount++;
  return instance;
}

/** Release a reference. When refcount reaches 0, schedules deferred destroy
 *  after {@link DEFERRED_DESTROY_MS}; an acquire() within that window
 *  cancels the destroy. */
export function release(): void {
  // Defensive: don't go negative if destroy() ran out-of-band (HMR, etc).
  if (refcount <= 0) return;
  refcount--;
  if (refcount === 0 && instance !== null) {
    pendingDestroy = setTimeout(() => {
      instance?.destroy();
      instance = null;
      pendingDestroy = null;
    }, DEFERRED_DESTROY_MS);
  }
}

/** Reads the current refcount. Internal/diagnostic only. */
export function _getRefcount(): number {
  return refcount;
}

/** Reads the current instance (or null). Internal/diagnostic only. */
export function _getInstance(): SharedRenderer | null {
  return instance;
}

/* -------------------------------------------------------------------------- */
/* HMR — clean up the singleton when this module reloads in dev. Without      */
/* this, hot-reloading leaks the GL context — the new module gets a fresh     */
/* `instance` variable but the old context is still bound to the (now-        */
/* orphaned) OffscreenCanvas.                                                 */
/*                                                                            */
/* Covers Vite, esbuild, Turbopack (what Next.js 13+ uses), and any other     */
/* bundler honoring the standard `import.meta.hot` HMR contract.              */
/* -------------------------------------------------------------------------- */

if (typeof window !== "undefined") {
  type Hot = { dispose: (cb: () => void) => void };
  const hot = (import.meta as ImportMeta & { hot?: Hot }).hot;
  if (hot && typeof hot.dispose === "function") {
    hot.dispose(() => {
      if (pendingDestroy !== null) {
        clearTimeout(pendingDestroy);
        pendingDestroy = null;
      }
      instance?.destroy();
      instance = null;
      refcount = 0;
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Shader compilation helpers (private)                                       */
/* -------------------------------------------------------------------------- */

function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("@glazelab/core: gl.createShader returned null");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(no log)";
    gl.deleteShader(shader);
    throw new Error(
      `@glazelab/core: shader compile failed: ${log}\nSource:\n${source.slice(0, 200)}…`,
    );
  }
  return shader;
}

function compileProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
  const frag = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error("@glazelab/core: gl.createProgram returned null");
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Once linked, individual shaders can be detached + deleted; the program
  // retains them. This frees their source strings from GL memory.
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(no log)";
    gl.deleteProgram(program);
    throw new Error(`@glazelab/core: program link failed: ${log}`);
  }
  return program;
}
