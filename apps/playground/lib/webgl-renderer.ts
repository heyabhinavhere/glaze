import {
  BLUR_FRAGMENT,
  BLUR_VERTEX,
  FRAGMENT_SHADER,
  VERTEX_SHADER,
} from "./shader";

/**
 * Uniforms passed to the glass fragment shader per frame.
 * Not all need to be updated per frame — changes are batched on render.
 */
export interface GlassUniforms {
  radius: number;
  refraction: number;
  bevelDepth: number;
  bevelWidth: number;
  bendZone: number;
  frost: number;
  lightAngle: number; // radians (compass: 0 = top, CW)
  lightIntensity: number;
  specularSize: number;
  specularOpacity: number;
  bevelHighlight: number;
  tint: [number, number, number, number]; // rgba, 0..1 per channel
  chromatic: number;
  grain: number;
}

/**
 * Describes where this glass sits inside the backdrop texture, so the
 * shader samples the right region. Coords in texture-UV space (0..1).
 */
export interface GlassBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A single glass lens — one rendered glass region. Multiple lenses can share
 * a renderer/texture.
 */
export interface GlassLens {
  /** Pixel rect of the glass element on screen (viewport coords). */
  rectPx: { left: number; top: number; width: number; height: number };
  /** Current uniform values. */
  uniforms: GlassUniforms;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src.trim());
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error("shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function link(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | null {
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.error("program link error:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

/**
 * Full-viewport WebGL canvas that renders one or more glass lenses over a
 * shared captured backdrop. Positioned absolutely, transparent, pointer-
 * events: none — DOM content (text, icons) sits on top at higher z-index.
 */
export class WebGLGlassRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private textureW = 0;
  private textureH = 0;
  private lenses: GlassLens[] = [];
  private running = false;
  private startTime = performance.now();
  private uniformLocs: Record<string, WebGLUniformLocation | null> = {};
  private rafId: number | null = null;

  // Blur pipeline — two-pass separable Gaussian on an FBO.
  // Two output textures:
  //   blurTexB    — heavy body blur, radius driven by u_frost
  //   lightTexB   — fixed soft blur (~6px) for the rim displacement source
  // The rim ALWAYS reads from lightTexB so the rim's frosty character is
  // independent of the body frost. When frost=0 the body is sharp but the
  // rim still shows softly-blurred displaced content (Figma's behavior).
  private blurProgram: WebGLProgram | null = null;
  private blurUniforms: Record<string, WebGLUniformLocation | null> = {};
  private blurFBO: WebGLFramebuffer | null = null;
  private blurTexA: WebGLTexture | null = null; // intermediate (after H pass)
  private blurTexB: WebGLTexture | null = null; // body blur output
  private lightTexA: WebGLTexture | null = null; // intermediate (light, H)
  private lightTexB: WebGLTexture | null = null; // light blur output
  private blurFBOW = 0;
  private blurFBOH = 0;
  private lastBlurRadius = -1; // cache to skip re-blur when frost unchanged
  private blurDirty = true; // re-blur when texture changes
  private lightBlurDirty = true; // re-do light blur when texture changes
  private static readonly LIGHT_BLUR_RADIUS_PX = 6;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
    parent.appendChild(this.canvas);

    const ctxOpts = { alpha: true, antialias: true, premultipliedAlpha: true };
    const gl = (this.canvas.getContext("webgl", ctxOpts) ||
      this.canvas.getContext("experimental-webgl", ctxOpts)) as
      | WebGLRenderingContext
      | null;
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;

    // --- Main glass shader ---
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) throw new Error("shader compile failed");
    const prog = link(gl, vs, fs);
    if (!prog) throw new Error("program link failed");
    this.program = prog;

    // --- Blur shader ---
    const bvs = compile(gl, gl.VERTEX_SHADER, BLUR_VERTEX);
    const bfs = compile(gl, gl.FRAGMENT_SHADER, BLUR_FRAGMENT);
    if (bvs && bfs) {
      const bp = link(gl, bvs, bfs);
      if (bp) {
        this.blurProgram = bp;
        this.blurUniforms = {
          u_tex: gl.getUniformLocation(bp, "u_tex"),
          u_direction: gl.getUniformLocation(bp, "u_direction"),
          u_radius: gl.getUniformLocation(bp, "u_radius"),
        };
      }
    }

    // Full-screen quad covering the viewport; per-lens viewport is set in render().
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Cache all uniform locations so render() is a straight-line hot path.
    const names = [
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
    ];
    for (const n of names) {
      this.uniformLocs[n] = gl.getUniformLocation(prog, n);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  /**
   * Upload an image/canvas/imageBitmap as the backdrop texture. Called once
   * on mount and again whenever the background changes.
   */
  uploadBackdrop(
    source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ) {
    const gl = this.gl;
    if (!this.texture) {
      this.texture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
    if ("width" in source && "height" in source) {
      this.textureW = (source as { width: number }).width;
      this.textureH = (source as { height: number }).height;
    }
    this.blurDirty = true;
    this.lightBlurDirty = true;
    this.lastBlurRadius = -1;
  }

  /**
   * One H+V Gaussian sweep from `inputTex` → `outB`, using `outA` as the
   * H-pass intermediate. Pure function over inputs/outputs so the caller
   * can chain it (multi-pass blur).
   */
  private blurOnce(
    inputTex: WebGLTexture,
    outA: WebGLTexture,
    outB: WebGLTexture,
    radiusPx: number,
  ) {
    const gl = this.gl;
    if (!this.blurProgram) return;
    const w = this.textureW;
    const h = this.textureH;
    if (w === 0 || h === 0) return;

    gl.useProgram(this.blurProgram);
    const posLoc = gl.getAttribLocation(this.blurProgram, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);

    // Pass 1: horizontal (inputTex → outA)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      outA,
      0,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(this.blurUniforms.u_tex, 0);
    gl.uniform2f(this.blurUniforms.u_direction, 1.0 / w, 0.0);
    gl.uniform1f(this.blurUniforms.u_radius, radiusPx);
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
    gl.uniform2f(this.blurUniforms.u_direction, 0.0, 1.0 / h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
  }

  private ensureFBOTextures() {
    const gl = this.gl;
    const w = this.textureW;
    const h = this.textureH;
    if (!this.blurTexA || this.blurFBOW !== w || this.blurFBOH !== h) {
      this.blurTexA = this._createFBOTexture(w, h, this.blurTexA);
      this.blurTexB = this._createFBOTexture(w, h, this.blurTexB);
      this.lightTexA = this._createFBOTexture(w, h, this.lightTexA);
      this.lightTexB = this._createFBOTexture(w, h, this.lightTexB);
      if (!this.blurFBO) this.blurFBO = gl.createFramebuffer();
      this.blurFBOW = w;
      this.blurFBOH = h;
    }
  }

  /**
   * Body blur — heavy, frost-driven. Achieves the target Gaussian sigma by
   * chaining N passes of a smaller per-pass radius, because a single huge
   * radius (40px+) undersamples the source: the 13-tap kernel ends up with
   * ~5–8px tap spacing, which aliases on JPEG block artifacts and high-
   * frequency texture detail and prints a visible regular dot pattern.
   *
   * Total Gaussian sigma after N independent passes adds in quadrature:
   *   sigma_total = sqrt(N) * sigma_per_pass
   * So perPassRadius = totalRadius / sqrt(N). With per-pass capped at 12px
   * (the kernel's sweet spot), every pass samples densely and the final
   * accumulated blur is smooth.
   *
   * Cost is N * (H+V) = 2N draws per frost change. The blur only re-runs
   * when texture or radius changes, so this is amortized across many
   * frames; 4–5 passes at the heaviest setting is well within budget.
   */
  private blurBackdrop(totalRadiusPx: number) {
    if (!this.blurProgram || !this.texture) return;
    if (this.textureW === 0 || this.textureH === 0) return;
    this.ensureFBOTextures();

    const PER_PASS_MAX = 12;
    const passes = Math.max(
      1,
      Math.ceil(totalRadiusPx / PER_PASS_MAX),
    );
    const perPassRadius = totalRadiusPx / Math.sqrt(passes);

    let input = this.texture as WebGLTexture;
    for (let i = 0; i < passes; i++) {
      this.blurOnce(input, this.blurTexA!, this.blurTexB!, perPassRadius);
      input = this.blurTexB!;
    }
  }

  /** Rim blur — fixed light radius, refreshed once per texture change.
      Single pass is fine because 6px is well within the kernel's dense
      sampling range (no aliasing risk like the body blur has). */
  private updateLightBlur() {
    if (!this.texture || !this.blurProgram) return;
    if (this.textureW === 0 || this.textureH === 0) return;
    this.ensureFBOTextures();
    this.blurOnce(
      this.texture,
      this.lightTexA!,
      this.lightTexB!,
      WebGLGlassRenderer.LIGHT_BLUR_RADIUS_PX,
    );
    this.lightBlurDirty = false;
  }

  private _createFBOTexture(
    w: number,
    h: number,
    existing: WebGLTexture | null,
  ): WebGLTexture {
    const gl = this.gl;
    const tex = existing || gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  setLenses(lenses: GlassLens[]) {
    this.lenses = lenses;
  }

  /** True when a backdrop texture has been uploaded. Consumers can poll this
   *  to verify capture actually landed (rather than being silently cancelled
   *  by a Strict Mode unmount / remount race). */
  get hasTexture(): boolean {
    return this.texture !== null && this.textureW > 0 && this.textureH > 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  render() {
    const gl = this.gl;
    if (!this.texture || this.textureW === 0) return;

    // Canvas size may have changed (container resize, dpr change).
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    // Determine blur radius from the first lens (assume all share the
    // same frost setting for the two-pass blur). Convert frost uniform
    // (0–1) to pixel radius.
    const frost = this.lenses[0]?.uniforms.frost ?? 0;
    const blurRadiusPx = frost * 40; // 0–40px Gaussian at full frost

    // Run the two-pass Gaussian blur if frost > 0 and either the texture
    // changed (blurDirty) or the frost amount changed.
    if (frost > 0.001 && this.blurProgram) {
      const radiusChanged =
        Math.abs(blurRadiusPx - this.lastBlurRadius) > 0.5;
      if (this.blurDirty || radiusChanged) {
        this.blurBackdrop(blurRadiusPx);
        this.lastBlurRadius = blurRadiusPx;
        this.blurDirty = false;
      }
    }

    // Light blur (always present, fixed radius). Drives the rim displacement
    // sample so the rim has consistent character regardless of body frost.
    if (this.lightBlurDirty) {
      this.updateLightBlur();
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // Re-bind the quad VBO and attrib for the main program.
    const mainPosLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(mainPosLoc);
    gl.vertexAttribPointer(mainPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Two texture bindings:
    //   u_tex      = body sample. Heavy frost blur when frost>0, sharp
    //                original when frost=0. Read at the un-displaced UV
    //                in the body (no refraction in the interior).
    //   u_lightTex = rim sample. Always softly blurred (~6px). Read at
    //                the displaced UV inside the bend zone, so the rim
    //                shows lightly-blurred refracted content. Independent
    //                of frost, so even with frost=0 the rim displacement
    //                stays soft (Figma's behavior) instead of magnifying
    //                sharp content.
    gl.activeTexture(gl.TEXTURE0);
    const hasBlur = frost > 0.001 && this.blurTexB;
    gl.bindTexture(gl.TEXTURE_2D, hasBlur ? this.blurTexB : this.texture);
    gl.uniform1i(this.uniformLocs.u_tex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lightTexB ?? this.texture);
    gl.uniform1i(this.uniformLocs.u_lightTex, 1);
    gl.uniform2f(
      this.uniformLocs.u_textureResolution,
      this.textureW,
      this.textureH,
    );
    gl.uniform1f(
      this.uniformLocs.u_time,
      (performance.now() - this.startTime) / 1000,
    );

    const canvasRect = rect;
    for (const lens of this.lenses) {
      // Per-lens viewport (glass rect within the overlay canvas).
      // lens.rectPx is in CANVAS-RELATIVE coords (already preview-relative,
      // and the canvas is positioned inset:0 within the preview, so those
      // two coord systems are the same). Convert to device pixels, then to
      // WebGL's bottom-origin y by flipping against canvas height.
      const x = lens.rectPx.left * dpr;
      const y =
        this.canvas.height - (lens.rectPx.top + lens.rectPx.height) * dpr;
      const w = lens.rectPx.width * dpr;
      const h = lens.rectPx.height * dpr;
      if (w <= 0 || h <= 0) continue;

      gl.viewport(x, y, w, h);
      gl.uniform2f(this.uniformLocs.u_resolution, w, h);

      // Where this glass sits in the backdrop texture's UV space.
      // Texture spans the whole preview area (= canvas), so glass coords
      // divided by canvas dimensions give the normalized region.
      gl.uniform4f(
        this.uniformLocs.u_bounds,
        lens.rectPx.left / canvasRect.width,
        lens.rectPx.top / canvasRect.height,
        lens.rectPx.width / canvasRect.width,
        lens.rectPx.height / canvasRect.height,
      );

      const u = lens.uniforms;
      gl.uniform1f(this.uniformLocs.u_radius, u.radius * dpr);
      gl.uniform1f(this.uniformLocs.u_refraction, u.refraction);
      gl.uniform1f(this.uniformLocs.u_bevelDepth, u.bevelDepth);
      gl.uniform1f(this.uniformLocs.u_bevelWidth, u.bevelWidth);
      gl.uniform1f(this.uniformLocs.u_bendZone, u.bendZone);
      gl.uniform1f(this.uniformLocs.u_frost, u.frost);
      gl.uniform1f(this.uniformLocs.u_lightAngle, u.lightAngle);
      gl.uniform1f(this.uniformLocs.u_lightIntensity, u.lightIntensity);
      gl.uniform1f(this.uniformLocs.u_specularSize, u.specularSize);
      gl.uniform1f(this.uniformLocs.u_specularOpacity, u.specularOpacity);
      gl.uniform1f(this.uniformLocs.u_bevelHighlight, u.bevelHighlight);
      gl.uniform4f(
        this.uniformLocs.u_tint,
        u.tint[0],
        u.tint[1],
        u.tint[2],
        u.tint[3],
      );
      gl.uniform1f(this.uniformLocs.u_chromatic, u.chromatic);
      gl.uniform1f(this.uniformLocs.u_grain, u.grain);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  dispose() {
    this.stop();
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.blurTexA) gl.deleteTexture(this.blurTexA);
    if (this.blurTexB) gl.deleteTexture(this.blurTexB);
    if (this.lightTexA) gl.deleteTexture(this.lightTexA);
    if (this.lightTexB) gl.deleteTexture(this.lightTexB);
    if (this.blurFBO) gl.deleteFramebuffer(this.blurFBO);
    gl.deleteProgram(this.program);
    if (this.blurProgram) gl.deleteProgram(this.blurProgram);
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
