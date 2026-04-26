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

  /** Tear down all GL resources. Idempotent — safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    // Programs first (their attached shaders get freed).
    this.gl.deleteProgram(this.glassProgram);
    this.gl.deleteProgram(this.blurProgram);
    // Force the context to lose itself so the browser frees driver memory
    // immediately rather than waiting on GC.
    const lose = this.gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
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
