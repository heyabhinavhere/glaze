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
import {
  createLensGLResources,
  disposeLensGLResources,
  ensureFBOTextures,
  type LensGLResources,
} from "./lens-gl";
import { getPaintedRect } from "./painted-rect";

/** Devicepixel cap. Design §M21 — capped at 2× even on 3× displays;
 *  the slight quality reduction is imperceptible, the memory savings
 *  are 2.25×. Per-frame allocation cost is also smaller. */
const MAX_DPR = 2;

/** Per-pass blur radius cap. Single huge radii (40px+) undersample —
 *  the kernel ends up with 5–8px tap spacing, aliasing on JPEG block
 *  artifacts and high-frequency texture detail (visible regular dot
 *  pattern). Chaining N passes at smaller radii sums in quadrature:
 *    sigma_total = sqrt(N) * sigma_per_pass
 *  so perPass = total / sqrt(N). 12px per pass keeps every pass
 *  densely sampled. Imported verbatim from the legacy renderer's
 *  battle-tested constants. */
const PER_PASS_MAX = 12;

/** Fixed soft blur radius for the rim displacement source. Single pass
 *  is fine because 6px is well within the kernel's dense sampling
 *  range — no aliasing risk. The rim ALWAYS reads from this softer
 *  blur regardless of body frost so the rim character stays soft
 *  even when frost=0 (Figma's behavior). */
const LIGHT_BLUR_RADIUS_PX = 6;

/** Maximum body-blur radius in pixels at frost=1.0. The shader's
 *  u_frost uniform 0–1 maps to 0–40px Gaussian. */
const MAX_BODY_BLUR_PX = 40;

/** Uniform locations we look up once per program-link. */
type UniformMap = Record<string, WebGLUniformLocation | null>;

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

  /** Compiled glass program. Mutable because context loss + restore
   *  rebuilds the program with a fresh GL handle. */
  private glassProgram: WebGLProgram;
  /** Compiled blur program. Mutable for the same reason. */
  private blurProgram: WebGLProgram;

  /** Cached uniform locations for the glass program. Re-looked-up on
   *  context restore. */
  private glassUniforms: UniformMap;
  /** Cached uniform locations for the blur program. */
  private blurUniforms: UniformMap;

  /** Shared full-screen quad VBO. The same six vertices serve every
   *  draw call; per-lens viewport positioning happens via gl.viewport.
   *  Mutable for context-restore rebuild. */
  private vbo: WebGLBuffer;

  /** Performance-API timestamp at construction. Drives the u_time
   *  uniform for any time-dependent shader effects (currently none in
   *  active use, but the uniform is wired so future passes can use it). */
  private readonly startTime: number;

  /** Registered lenses. Keyed by lens.id. */
  private readonly lenses = new Map<number, Lens>();

  /** Count of currently-registered lenses with `position: sticky` /
   *  `fixed`. The shared scroll listener attaches when this is > 0
   *  and detaches when it drops to 0. */
  private scrollLensCount = 0;

  /** Active rAF id, or null when no tick is pending. */
  private rafId: number | null = null;

  /** True when WebGL context is lost. Render loop pauses until restore. */
  private suspended = false;

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

    // Initial GL setup. The same routine runs on context-restored,
    // because all resources (programs, VBO, FBO textures) are gone
    // when the context is lost.
    const setup = this.buildGLState();
    this.glassProgram = setup.glassProgram;
    this.blurProgram = setup.blurProgram;
    this.glassUniforms = setup.glassUniforms;
    this.blurUniforms = setup.blurUniforms;
    this.vbo = setup.vbo;

    this.startTime = performance.now();

    // OffscreenCanvas exposes context-loss events on the canvas itself
    // (not on the GL context). Listen for both directions.
    this.offscreen.addEventListener(
      "webglcontextlost",
      this.handleContextLost as EventListener,
      { passive: false },
    );
    this.offscreen.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored as EventListener,
    );
  }

  /** (Re)build the GL programs, uniform caches, VBO, and pipeline
   *  state. Pure function over `this.gl`; called from constructor and
   *  context-restored. Returns the new resources without writing them
   *  to the instance, so the caller controls assignment ordering. */
  private buildGLState(): {
    glassProgram: WebGLProgram;
    blurProgram: WebGLProgram;
    glassUniforms: UniformMap;
    blurUniforms: UniformMap;
    vbo: WebGLBuffer;
  } {
    const gl = this.gl;
    const glassProgram = compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const blurProgram = compileProgram(gl, BLUR_VERTEX, BLUR_FRAGMENT);

    // Cache uniform locations once per program link. render() is then a
    // straight-line hot path with no string lookups per frame.
    const glassUniforms = lookupUniforms(gl, glassProgram, [
      "u_tex",
      "u_lightTex",
      "u_resolution",
      "u_textureResolution",
      "u_bounds",
      "u_radius",
      "u_refraction",
      "u_bevelDepth",
      "u_bevelWidth",
      "u_bendZone",
      "u_frost",
      "u_lightAngle",
      "u_lightIntensity",
      "u_specularSize",
      "u_specularOpacity",
      "u_bevelHighlight",
      "u_tint",
      "u_chromatic",
      "u_grain",
      "u_time",
      "u_saturation",
      "u_brightness",
    ]);
    const blurUniforms = lookupUniforms(gl, blurProgram, [
      "u_tex",
      "u_direction",
      "u_radius",
    ]);

    // Full-viewport quad — six vertices forming two triangles covering
    // [-1, 1] in clip space. The vertex shader passes a_position
    // straight through; per-lens positioning is via gl.viewport.
    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("@glazelab/core: gl.createBuffer returned null");
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    // Premultiplied-alpha blending — design §M11. Avoids dark fringes
    // on translucent backgrounds.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    return { glassProgram, blurProgram, glassUniforms, blurUniforms, vbo };
  }

  /* ------------------------------------------------------------------------ */
  /* Context loss / restored                                                  */
  /* ------------------------------------------------------------------------ */

  /** Browsers throw away GL resources when the context is lost (driver
   *  restart, GPU memory pressure, OS sleep, tab switch on some Android
   *  devices). preventDefault tells the browser we want a restored
   *  event when GL becomes available again. Without it, the canvas
   *  permanently dies. Design §3.3, §M12. */
  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.suspended = true;
    this.cancelTick();
    // All GL resources are now stale. Per-lens GL resources are re-
    // allocated on context restore. The lens's backdropSource (a JS
    // image, not a GL object) is preserved for re-upload then.
  };

  /** Re-allocate everything: programs, VBO, per-lens FBO textures
   *  and backdrop textures. Resume rAF afterward. */
  private handleContextRestored = (): void => {
    if (this.destroyed) return;
    const setup = this.buildGLState();
    this.glassProgram = setup.glassProgram;
    this.blurProgram = setup.blurProgram;
    this.glassUniforms = setup.glassUniforms;
    this.blurUniforms = setup.blurUniforms;
    this.vbo = setup.vbo;

    // Each lens needs its FBO + texture allocations remade. The lens's
    // backdropSource (the original HTMLImageElement / HTMLCanvasElement)
    // survives context loss — re-upload it.
    for (const lens of this.lenses.values()) {
      lens.glResources = createLensGLResources(this.gl);
      if (lens.backdropSource) {
        this.uploadBackdrop(lens, lens.backdropSource);
      }
    }

    this.suspended = false;
    this.scheduleTick();
  };

  /* ------------------------------------------------------------------------ */
  /* Sticky / fixed lens scroll handling                                      */
  /* ------------------------------------------------------------------------ */

  /** Single shared scroll listener. Attaches when the first sticky/
   *  fixed lens registers, detaches when the last one unregisters.
   *  Marks affected lenses dirty + schedules a tick; the tick reads
   *  fresh getBoundingClientRect for each. Capture phase + passive
   *  so we run before parent scroll handlers can stopPropagation. */
  private scrollListenerAttached = false;

  private ensureScrollListener(): void {
    if (this.scrollListenerAttached) return;
    this.scrollListenerAttached = true;
    window.addEventListener("scroll", this.handleScroll, {
      passive: true,
      capture: true,
    });
  }

  private detachScrollListener(): void {
    if (!this.scrollListenerAttached) return;
    this.scrollListenerAttached = false;
    window.removeEventListener("scroll", this.handleScroll, true);
  }

  private handleScroll = (): void => {
    // Just kick a tick. The render loop reads fresh rects for sticky/
    // fixed lenses each frame regardless, but a tick may not be
    // pending if all lenses were idle.
    this.scheduleTick();
  };

  /* ------------------------------------------------------------------------ */
  /* Lens registration                                                        */
  /* ------------------------------------------------------------------------ */

  /** Register a lens for per-frame rendering. Idempotent. Allocates
   *  per-lens GL resources (texture + FBOs); pairs with unregisterLens
   *  which frees them. Tracks sticky/fixed lens count to manage the
   *  shared scroll listener. */
  registerLens(lens: Lens): void {
    if (this.destroyed) return;
    if (lens.glResources === null) {
      lens.glResources = createLensGLResources(this.gl);
    }
    this.lenses.set(lens.id, lens);
    if (lens.needsScrollUpdate) {
      this.scrollLensCount++;
      this.ensureScrollListener();
    }
    this.scheduleTick();
  }

  /** Unregister a lens. Frees its GL resources. Idempotent. */
  unregisterLens(id: number): void {
    const lens = this.lenses.get(id);
    if (lens && lens.glResources) {
      disposeLensGLResources(this.gl, lens.glResources);
      lens.glResources = null;
    }
    if (lens && lens.needsScrollUpdate) {
      this.scrollLensCount = Math.max(0, this.scrollLensCount - 1);
      if (this.scrollLensCount === 0) this.detachScrollListener();
    }
    this.lenses.delete(id);
    if (this.lenses.size === 0) this.cancelTick();
  }

  /** Upload an image / canvas / video frame as a lens's backdrop texture.
   *  Marks the lens's blur layers dirty so the next render rebuilds them.
   *  WebGL's texImage2D accepts all four TexImageSource types natively. */
  uploadBackdrop(
    lens: Lens,
    source:
      | HTMLImageElement
      | HTMLCanvasElement
      | HTMLVideoElement
      | ImageBitmap,
  ): void {
    if (this.destroyed) return;
    if (!lens.glResources) return;
    const gl = this.gl;
    const res = lens.glResources;

    if (res.texture === null) {
      res.texture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, res.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Don't pre-multiply on upload — the shader does premultiplication
    // at the output stage to match the §M11 premultiplied-alpha policy
    // throughout the pipeline.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source as TexImageSource,
    );

    // Width/height come from different properties depending on type.
    // Video uses videoWidth/videoHeight (the raw frame dims, not the
    // <video> element's CSS size). Image/canvas/bitmap use width/height.
    if (source instanceof HTMLVideoElement) {
      res.textureW = source.videoWidth;
      res.textureH = source.videoHeight;
    } else {
      res.textureW = (source as { width: number }).width;
      res.textureH = (source as { height: number }).height;
    }
    res.bodyBlurDirty = true;
    res.lightBlurDirty = true;
    res.lastBlurRadius = -1;
  }

  /** Tear down all GL resources. Idempotent — safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelTick();
    this.detachScrollListener();
    // Detach context-loss listeners so they don't fire on the
    // about-to-be-discarded canvas.
    this.offscreen.removeEventListener(
      "webglcontextlost",
      this.handleContextLost as EventListener,
    );
    this.offscreen.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored as EventListener,
    );
    // Free per-lens resources before the context goes away.
    for (const lens of this.lenses.values()) {
      if (lens.glResources) {
        disposeLensGLResources(this.gl, lens.glResources);
        lens.glResources = null;
      }
    }
    this.lenses.clear();
    this.scrollLensCount = 0;
    // Programs first (their attached shaders get freed).
    this.gl.deleteProgram(this.glassProgram);
    this.gl.deleteProgram(this.blurProgram);
    this.gl.deleteBuffer(this.vbo);
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
    if (this.destroyed || this.suspended || this.lenses.size === 0) return;

    for (const lens of this.lenses.values()) {
      if (lens.destroyed) continue;
      // Sticky/fixed lenses change screen position during scroll without
      // firing ResizeObserver. Re-read their rect each frame they tick.
      // Cheap (~0.05ms per call). Static-positioned lenses keep their
      // ResizeObserver-fed rect.
      if (lens.needsScrollUpdate) {
        const r = lens.host.getBoundingClientRect();
        lens.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
      // Mode B refresh — live elements re-upload here:
      //   - live-canvas: every frame (no native change-event)
      //   - live-video: only when requestVideoFrameCallback fired
      //                 (needsTextureRefresh set by the callback)
      if (lens.backdropSource && lens.glResources) {
        if (lens.backdropKind === "live-canvas") {
          this.uploadBackdrop(lens, lens.backdropSource);
        } else if (
          lens.backdropKind === "live-video" &&
          lens.needsTextureRefresh
        ) {
          this.uploadBackdrop(lens, lens.backdropSource);
          lens.needsTextureRefresh = false;
        }
      }
      this.renderLens(lens);
    }

    // Schedule the next tick. Sub-task 7 adds visibility / dirty-flag
    // gating so we only tick when something actually changed; for now
    // we tick continuously while any lens is registered.
    this.scheduleTick();
  };

  /** Render a single lens's full glass+rim effect. Pipeline:
   *
   *  1. Skip if no backdrop is bound yet (texture is null) — the lens
   *     stays at its current canvas content (typically blank) until
   *     the asynchronous decode resolves.
   *  2. Resize the shared offscreen canvas to the lens's device-pixel
   *     size and set the GL viewport.
   *  3. Lazy-allocate the lens's FBO ping-pong textures at backdrop
   *     resolution (idempotent when the size hasn't changed).
   *  4. Body blur — multi-pass separable Gaussian, total radius driven
   *     by config.frost. Skipped when frost ≈ 0 (sharp body).
   *     Cached by lastBlurRadius so smooth frost animations don't
   *     re-blur unless the radius moved significantly.
   *  5. Light blur — fixed 6px single pass, runs once per backdrop
   *     change. Drives the rim displacement source so rim character
   *     stays soft regardless of body frost.
   *  6. Glass+rim shader pass — reads body sample (blurred or sharp)
   *     + light sample, applies refraction / chromatic / rim lighting
   *     / specular / tint / grain. Output to the offscreen drawing
   *     buffer.
   *  7. transferToImageBitmap → blit to the lens's visible 2D canvas.
   */
  private renderLens(lens: Lens): void {
    const res = lens.glResources;
    if (!res || !res.texture || res.textureW === 0) return;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(lens.rect.w * dpr));
    const h = Math.max(1, Math.round(lens.rect.h * dpr));

    // Resize the shared offscreen + drawing buffer to fit this lens.
    if (this.offscreen.width !== w) this.offscreen.width = w;
    if (this.offscreen.height !== h) this.offscreen.height = h;

    const gl = this.gl;

    // Ensure the FBO ping-pong textures exist at the backdrop's size.
    ensureFBOTextures(gl, res);

    // ---- Body blur (heavy, frost-driven) ------------------------------
    const cfg = lens.config;
    const bodyRadiusPx = cfg.frost * MAX_BODY_BLUR_PX;
    if (bodyRadiusPx > 0.5) {
      const radiusChanged = Math.abs(bodyRadiusPx - res.lastBlurRadius) > 0.5;
      if (res.bodyBlurDirty || radiusChanged) {
        this.runBodyBlur(res, bodyRadiusPx);
        res.lastBlurRadius = bodyRadiusPx;
        res.bodyBlurDirty = false;
      }
    }

    // ---- Light blur (fixed soft, drives rim) --------------------------
    if (res.lightBlurDirty) {
      this.runLightBlur(res);
      res.lightBlurDirty = false;
    }

    // ---- Glass+rim shader pass — output to offscreen drawing buffer ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.glassProgram);
    this.bindQuad(this.glassProgram);

    // Body sample (texture unit 0) — blurred result when frost > 0,
    // sharp source when frost ≈ 0. Read at the un-displaced UV inside
    // the body of the lens (no refraction in the interior).
    const hasBlur = bodyRadiusPx > 0.5;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hasBlur ? res.blurTexB : res.texture);
    gl.uniform1i(this.glassUniforms["u_tex"]!, 0);

    // Light sample (texture unit 1) — always softly blurred. Read at
    // the displaced UV inside the bend zone for the rim refraction.
    // Frost-independent so even at frost=0 the rim shows softly-
    // blurred refracted content (Figma's behavior).
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, res.lightTexB);
    gl.uniform1i(this.glassUniforms["u_lightTex"]!, 1);

    gl.uniform2f(
      this.glassUniforms["u_textureResolution"]!,
      res.textureW,
      res.textureH,
    );
    gl.uniform1f(
      this.glassUniforms["u_time"]!,
      (performance.now() - this.startTime) / 1000,
    );
    gl.uniform2f(this.glassUniforms["u_resolution"]!, w, h);

    // Lens position in backdrop UV space. The shader uses this to
    // sample the right region of the backdrop texture: body UV inside
    // the lens maps to bounds.x + bounds.w*localU (etc), so the
    // unrefracted body shows the actual content behind the lens.
    //
    // Coverage rect (where the backdrop CONTENT is actually painted
    // on the page) defaults to the viewport when no anchor is set.
    // With an anchor, we read the PAINTED rect — for HTMLImageElement
    // with object-fit:cover/contain/none, painted rect ≠ CSS rect, and
    // getPaintedRect handles the math. For other anchor types
    // (canvases, videos, divs), painted rect == CSS rect.
    let coverageX: number;
    let coverageY: number;
    let coverageW: number;
    let coverageH: number;
    if (cfg.backdropAnchor) {
      const p = getPaintedRect(cfg.backdropAnchor);
      coverageX = p.x;
      coverageY = p.y;
      coverageW = Math.max(1, p.w);
      coverageH = Math.max(1, p.h);
    } else {
      coverageX = 0;
      coverageY = 0;
      coverageW =
        window.innerWidth || document.documentElement.clientWidth || w;
      coverageH =
        window.innerHeight || document.documentElement.clientHeight || h;
    }
    gl.uniform4f(
      this.glassUniforms["u_bounds"]!,
      (lens.rect.x - coverageX) / coverageW,
      (lens.rect.y - coverageY) / coverageH,
      lens.rect.w / coverageW,
      lens.rect.h / coverageH,
    );

    // Per-lens shader uniforms. radius scaled by DPR so the rounded
    // corners match physical pixels regardless of display density.
    gl.uniform1f(this.glassUniforms["u_radius"]!, cfg.radius * dpr);
    gl.uniform1f(this.glassUniforms["u_refraction"]!, cfg.refraction);
    gl.uniform1f(this.glassUniforms["u_bevelDepth"]!, cfg.bevelDepth);

    // bevelWidth and bendZone are public-API CSS pixels; the legacy
    // shader expects fractions of the lens's smaller dimension.
    // Convert here so the shader can stay shape-agnostic.
    const minDim = Math.max(1, Math.min(lens.rect.w, lens.rect.h));
    gl.uniform1f(this.glassUniforms["u_bevelWidth"]!, cfg.bevelWidth / minDim);
    gl.uniform1f(this.glassUniforms["u_bendZone"]!, cfg.bendZone / minDim);

    gl.uniform1f(this.glassUniforms["u_frost"]!, cfg.frost);
    gl.uniform1f(this.glassUniforms["u_lightAngle"]!, cfg.lightAngle);
    gl.uniform1f(
      this.glassUniforms["u_lightIntensity"]!,
      cfg.rimIntensity, // public name for the light multiplier
    );
    gl.uniform1f(this.glassUniforms["u_specularSize"]!, cfg.specularSize);
    gl.uniform1f(
      this.glassUniforms["u_specularOpacity"]!,
      cfg.specularOpacity,
    );
    gl.uniform1f(this.glassUniforms["u_bevelHighlight"]!, cfg.rimIntensity);
    gl.uniform4f(
      this.glassUniforms["u_tint"]!,
      cfg.tint[0],
      cfg.tint[1],
      cfg.tint[2],
      cfg.tint[3],
    );
    gl.uniform1f(this.glassUniforms["u_chromatic"]!, cfg.chromatic);
    gl.uniform1f(this.glassUniforms["u_grain"]!, cfg.grain);
    gl.uniform1f(this.glassUniforms["u_saturation"]!, cfg.saturation);
    gl.uniform1f(this.glassUniforms["u_brightness"]!, cfg.brightness);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // ---- Transfer to lens's visible 2D canvas -------------------------
    const bitmap = this.offscreen.transferToImageBitmap();
    lens.blit(bitmap);
  }

  /** Multi-pass separable Gaussian on the body texture. Total radius
   *  achieved by chaining N passes at perPass = total/sqrt(N). */
  private runBodyBlur(res: LensGLResources, totalRadiusPx: number): void {
    if (!res.texture) return;
    const passes = Math.max(1, Math.ceil(totalRadiusPx / PER_PASS_MAX));
    const perPass = totalRadiusPx / Math.sqrt(passes);
    let input: WebGLTexture = res.texture;
    for (let i = 0; i < passes; i++) {
      this.runBlurPass(res, input, res.blurTexA, res.blurTexB, perPass);
      input = res.blurTexB;
    }
  }

  /** Single-pass soft blur for the rim displacement source. */
  private runLightBlur(res: LensGLResources): void {
    if (!res.texture) return;
    this.runBlurPass(
      res,
      res.texture,
      res.lightTexA,
      res.lightTexB,
      LIGHT_BLUR_RADIUS_PX,
    );
  }

  /** One H+V Gaussian sweep: input → outA (horizontal) → outB (vertical).
   *  Pure function over the input texture and the two output textures so
   *  callers can chain it. */
  private runBlurPass(
    res: LensGLResources,
    input: WebGLTexture,
    outA: WebGLTexture,
    outB: WebGLTexture,
    radiusPx: number,
  ): void {
    const gl = this.gl;
    const w = res.textureW;
    const h = res.textureH;
    if (w === 0 || h === 0) return;

    gl.useProgram(this.blurProgram);
    this.bindQuad(this.blurProgram);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);

    // Pass 1: horizontal (input → outA)
    gl.bindFramebuffer(gl.FRAMEBUFFER, res.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      outA,
      0,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform1i(this.blurUniforms["u_tex"]!, 0);
    gl.uniform2f(this.blurUniforms["u_direction"]!, 1.0 / w, 0);
    gl.uniform1f(this.blurUniforms["u_radius"]!, radiusPx);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2: vertical (outA → outB)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      outB,
      0,
    );
    gl.bindTexture(gl.TEXTURE_2D, outA);
    gl.uniform2f(this.blurUniforms["u_direction"]!, 0, 1.0 / h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
  }

  /** Bind the shared full-screen quad VBO + the program's a_position
   *  attribute. Called at the start of each program use. */
  private bindQuad(program: WebGLProgram): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
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

/** Look up a list of uniform locations once per program-link. Missing
 *  uniforms (e.g. dropped by GLSL optimizer) get null entries — callers
 *  must null-check before passing to gl.uniform*. */
function lookupUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): UniformMap {
  const out: UniformMap = {};
  for (const n of names) {
    out[n] = gl.getUniformLocation(program, n);
  }
  return out;
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
