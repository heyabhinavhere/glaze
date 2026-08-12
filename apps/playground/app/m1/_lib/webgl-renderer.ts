import type { M1DisplacementMap } from "./displacement";
import type { M1Material } from "./material";

export type M1WebGLSource = HTMLCanvasElement | HTMLVideoElement;
export type M1WebGLSourceKind = "canvas" | "video";

export interface M1RendererDiagnostics {
  readonly renderer: "webgl";
  readonly sourceKind: M1WebGLSourceKind;
  readonly active: boolean;
  readonly contextLost: boolean;
  readonly frames: number;
  readonly uploads: number;
  readonly presentedFrameCallbacks: number;
  readonly displacementPx: number;
  readonly maxRenderMs: number;
  readonly lastRenderMs: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly dpr: number;
  readonly materialId: string;
  readonly lightingModelId: string;
  readonly effectiveLightAngleDeg: number;
  readonly activation: number;
  readonly mapTextureMinFilter: number;
  readonly mapTextureMagFilter: number;
  readonly mapTextureWrapS: number;
  readonly mapTextureWrapT: number;
}

export interface M1LightingMeasurement {
  readonly sourceProbe: string;
  readonly effectiveLightAngleDeg: number;
  readonly activation: number;
  readonly interiorLuminance: number;
  readonly litRimLuminance: number;
  readonly opposingRimLuminance: number;
  readonly highlightLift: number;
  readonly occlusionDrop: number;
  readonly tintBlueShift: number;
  readonly transmissionLuminance: number;
  readonly highFrequencyEnergy: number;
  readonly highlightVector: readonly [number, number];
  readonly sampledPixels: number;
}

export const M1_WEBGL_SURFACE_FIELD_CONTRACT = Object.freeze({
  id: "m1.1-continuous-capsule-lighting-r1",
  displacementChannels: "rg",
  thicknessChannel: "b",
  textureMinFilter: "linear",
  textureMagFilter: "linear",
  wrap: "clamp-to-edge",
});

export const M1_WEBGL_REFRACTION_REST_SCALE = 0.52;
export const M1_WEBGL_REFRACTION_MAX_SCALE = 0.68;

interface M1WebGLRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly source: M1WebGLSource;
  readonly sourceKind: M1WebGLSourceKind;
  readonly material: M1Material;
  readonly map: M1DisplacementMap;
  readonly onFallback: (reason: string) => void;
  readonly lightAngleDeg?: number;
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const M1_WEBGL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

uniform sampler2D u_source;
uniform sampler2D u_map;
uniform vec2 u_source_size;
uniform vec2 u_map_texel;
uniform vec4 u_source_rect;
uniform float u_displacement_px;
uniform float u_frost_px;
uniform float u_chroma_px;
uniform vec3 u_tint;
uniform float u_tint_opacity;
uniform float u_rim_intensity;
uniform vec2 u_light_direction;
uniform vec2 u_pointer;
uniform float u_activation;

vec3 sample_source(vec2 uv, vec2 blur_step) {
  vec3 color = texture(u_source, uv).rgb * 0.40;
  color += texture(u_source, uv + vec2(blur_step.x, 0.0)).rgb * 0.15;
  color += texture(u_source, uv - vec2(blur_step.x, 0.0)).rgb * 0.15;
  color += texture(u_source, uv + vec2(0.0, blur_step.y)).rgb * 0.15;
  color += texture(u_source, uv - vec2(0.0, blur_step.y)).rgb * 0.15;
  return color;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 map_uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 encoded = texture(u_map, map_uv);
  vec2 vector = encoded.rg * 2.0 - 1.0;
  float thickness = encoded.b;
  float thickness_left = texture(u_map, map_uv - vec2(u_map_texel.x, 0.0)).b;
  float thickness_right = texture(u_map, map_uv + vec2(u_map_texel.x, 0.0)).b;
  float thickness_down = texture(u_map, map_uv - vec2(0.0, u_map_texel.y)).b;
  float thickness_up = texture(u_map, map_uv + vec2(0.0, u_map_texel.y)).b;
  float field_laplacian = abs(
    thickness_left + thickness_right + thickness_down + thickness_up
      - 4.0 * thickness
  );
  float slope = clamp(length(vector), 0.0, 1.0);
  float curvature = clamp(slope * 0.68 + field_laplacian * 8.0, 0.0, 1.0);
  vec2 base_uv = u_source_rect.xy + v_uv * u_source_rect.zw;
  vec2 pointer_delta = v_uv - u_pointer;
  pointer_delta.x *= u_source_size.x / u_source_size.y;
  float pointer_distance = length(pointer_delta);
  float touch_field = exp(-pointer_distance * pointer_distance * 3.6) * u_activation;
  vec2 touch_direction = pointer_distance > 0.001
    ? pointer_delta / pointer_distance
    : vec2(0.0);
  float refraction_energy = mix(
    ${M1_WEBGL_REFRACTION_REST_SCALE.toFixed(2)},
    ${M1_WEBGL_REFRACTION_MAX_SCALE.toFixed(2)},
    u_activation
  );
  float energized_displacement = u_displacement_px * refraction_energy;
  vec2 gel_offset = touch_direction
    * touch_field
    * mix(0.55, 0.9, thickness)
    / u_source_size;
  vec2 displaced_uv = base_uv
    + vector * energized_displacement / u_source_size
    + gel_offset;
  vec2 blur_step = vec2(u_frost_px) / u_source_size;

  vec3 color = sample_source(displaced_uv, blur_step);
  if (u_chroma_px > 0.0 && slope > 0.0) {
    vec2 chroma = vector * u_chroma_px / u_source_size;
    color.r = sample_source(displaced_uv - chroma, blur_step).r;
    color.b = sample_source(displaced_uv + chroma, blur_step).b;
  }

  float source_luminance = luminance(color);
  vec2 responsive_light = normalize(
    u_light_direction + (u_pointer - vec2(0.5)) * u_activation * 0.9
  );
  vec2 touch_slope = touch_direction * touch_field * 0.12;
  vec2 normal_xy = vector * (0.58 + curvature * 0.14) + touch_slope;
  float normal_z = sqrt(max(0.18, 1.0 - min(dot(normal_xy, normal_xy), 0.82)));
  vec3 surface_normal = normalize(vec3(normal_xy, normal_z));
  vec3 light_direction = normalize(vec3(responsive_light * 0.86, 0.68));
  vec3 half_vector = normalize(light_direction + vec3(0.0, 0.0, 1.0));
  float directional = max(dot(surface_normal, light_direction), 0.0);
  float opposing = max(-dot(surface_normal.xy, responsive_light), 0.0);
  float fresnel = pow(1.0 - surface_normal.z, 1.7);
  float specular_power = mix(24.0, 34.0, u_activation);
  float specular = pow(max(dot(surface_normal, half_vector), 0.0), specular_power);
  float broad_light = max(directional - 0.46, 0.0);
  float highlight = mix(slope, curvature, 0.28)
    * mix(0.5, 1.0, fresnel)
    * (broad_light * 0.28 + specular * 0.72)
    * u_rim_intensity
    * mix(0.72, 1.14, source_luminance);
  float occlusion = mix(slope, curvature, 0.24)
    * pow(opposing, 1.22)
    * mix(0.018, 0.17, source_luminance)
    * mix(0.9, 1.08, u_activation);

  float absorption = u_tint_opacity
    * mix(0.62, 0.28, source_luminance)
    * mix(0.7, 1.0, thickness);
  float forward_scatter = curvature
    * (1.0 - thickness)
    * opposing
    * mix(0.012, 0.065, source_luminance);
  float touch_caustic = touch_field
    * mix(0.018, 0.052, source_luminance)
    * mix(0.35, 0.72, curvature);
  vec3 transmitted = color * (1.0 - absorption + forward_scatter);
  transmitted += color * touch_caustic;

  float adaptive_tint = u_tint_opacity
    * mix(1.32, 0.7, source_luminance)
    * mix(0.74, 1.08, thickness);
  vec3 material_color = mix(transmitted, u_tint, adaptive_tint);
  material_color += u_tint
    * thickness
    * u_tint_opacity
    * mix(0.24, 0.07, source_luminance);
  material_color += u_tint * highlight;
  material_color *= 1.0 - occlusion;
  out_color = vec4(material_color, 1.0);
}`;

const QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);

let activeRendererCount = 0;

export function getActiveM1RendererCount(): number {
  return activeRendererCount;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function requiredUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`Missing WebGL uniform: ${name}`);
  return location;
}

export class M1WebGLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly source: M1WebGLSource;
  private readonly sourceKind: M1WebGLSourceKind;
  private readonly material: M1Material;
  private readonly map: M1DisplacementMap;
  private readonly onFallback: (reason: string) => void;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly sourceTexture: WebGLTexture;
  private readonly mapTexture: WebGLTexture;
  private readonly buffer: WebGLBuffer;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private videoFrameId: number | null = null;
  private destroyed = false;
  private visible = true;
  private contextLost = false;
  private frames = 0;
  private uploads = 0;
  private presentedFrameCallbacks = 0;
  private lastUploadedVideoTime = -1;
  private maxRenderMs = 0;
  private lastRenderMs = 0;
  private pointerX = 0.5;
  private pointerY = 0.5;
  private activation = 0;
  private lightAngleDeg: number;

  constructor(options: M1WebGLRendererOptions) {
    this.canvas = options.canvas;
    this.source = options.source;
    this.sourceKind = options.sourceKind;
    this.material = options.material;
    this.map = options.map;
    this.onFallback = options.onFallback;
    this.lightAngleDeg =
      options.lightAngleDeg ?? options.material.surface.lightAngleDeg;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      M1_WEBGL_FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate a WebGL program.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "WebGL link failed.");
    }
    this.program = program;

    const buffer = gl.createBuffer();
    const sourceTexture = gl.createTexture();
    const mapTexture = gl.createTexture();
    if (!buffer || !sourceTexture || !mapTexture) {
      throw new Error("Unable to allocate WebGL resources.");
    }
    this.buffer = buffer;
    this.sourceTexture = sourceTexture;
    this.mapTexture = mapTexture;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.map.width,
      this.map.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.map.pixels,
    );
    gl.uniform1i(requiredUniform(gl, program, "u_map"), 1);
    gl.uniform1i(requiredUniform(gl, program, "u_source"), 0);
    gl.uniform2f(
      requiredUniform(gl, program, "u_map_texel"),
      1 / this.map.width,
      1 / this.map.height,
    );

    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    document.addEventListener("visibilitychange", this.handleVisibility);
    if (this.source instanceof HTMLVideoElement) {
      this.source.addEventListener("play", this.handleVideoPlay);
      this.source.addEventListener("pause", this.handleVideoPause);
      this.source.addEventListener("seeked", this.handleVideoSeeked);
      this.source.addEventListener("loadeddata", this.handleVideoSeeked);
    }

    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.canvas);
    this.resizeObserver.observe(this.source);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? true;
      if (this.visible) this.draw();
    });
    this.intersectionObserver.observe(this.canvas);

    activeRendererCount += 1;
    this.draw();
    this.scheduleVideoFrame();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.destroyed) return;
    this.contextLost = true;
    this.cancelVideoFrame();
    this.onFallback("webgl-context-lost");
  };

  private readonly handleContextRestored = (): void => {
    if (this.destroyed) return;
    this.onFallback("webgl-context-restored-requires-remount");
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState === "visible") {
      this.draw();
      this.scheduleVideoFrame();
    } else {
      this.cancelVideoFrame();
    }
  };

  private readonly handleVideoPlay = (): void => this.scheduleVideoFrame();
  private readonly handleVideoPause = (): void => {
    this.cancelVideoFrame();
  };
  private readonly handleVideoSeeked = (): void => {
    this.draw();
  };

  private scheduleVideoFrame(): void {
    if (
      this.destroyed ||
      this.sourceKind !== "video" ||
      !(this.source instanceof HTMLVideoElement) ||
      this.source.paused ||
      this.videoFrameId !== null ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (typeof this.source.requestVideoFrameCallback === "function") {
      this.videoFrameId = this.source.requestVideoFrameCallback(() => {
        this.videoFrameId = null;
        this.presentedFrameCallbacks += 1;
        this.draw();
        this.scheduleVideoFrame();
      });
    } else {
      this.videoFrameId = window.requestAnimationFrame(() => {
        this.videoFrameId = null;
        this.presentedFrameCallbacks += 1;
        this.draw();
        this.scheduleVideoFrame();
      });
    }
  }

  private cancelVideoFrame(): void {
    if (this.videoFrameId === null) return;
    if (
      this.source instanceof HTMLVideoElement &&
      typeof this.source.cancelVideoFrameCallback === "function"
    ) {
      this.source.cancelVideoFrameCallback(this.videoFrameId);
    } else {
      window.cancelAnimationFrame(this.videoFrameId);
    }
    this.videoFrameId = null;
  }

  draw(uploadSource = true): boolean {
    if (
      this.destroyed ||
      this.contextLost ||
      !this.visible ||
      document.visibilityState !== "visible"
    ) {
      return false;
    }
    if (
      this.source instanceof HTMLVideoElement &&
      (this.source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        this.source.videoWidth === 0 ||
        this.source.videoHeight === 0)
    ) {
      return false;
    }

    const start = performance.now();
    const gl = this.gl;
    const canvasRect = this.canvas.getBoundingClientRect();
    const sourceRect = this.source.getBoundingClientRect();
    const logicalCanvasWidth = this.canvas.clientWidth;
    const logicalCanvasHeight = this.canvas.clientHeight;
    if (
      logicalCanvasWidth <= 0 ||
      logicalCanvasHeight <= 0 ||
      sourceRect.width <= 0 ||
      sourceRect.height <= 0
    ) {
      return false;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Backing resolution follows the authored material geometry, not the
    // animated transform. Hover/press flex must not reallocate GPU storage or
    // introduce one-pixel resolution jitter.
    const canvasWidth = Math.max(1, Math.round(logicalCanvasWidth * dpr));
    const canvasHeight = Math.max(1, Math.round(logicalCanvasHeight * dpr));
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
    }

    try {
      gl.useProgram(this.program);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const shouldUpload =
        uploadSource &&
        (!(this.source instanceof HTMLVideoElement) ||
          this.source.currentTime !== this.lastUploadedVideoTime);
      if (shouldUpload) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          this.source,
        );
        this.uploads += 1;
        if (this.source instanceof HTMLVideoElement) {
          this.lastUploadedVideoTime = this.source.currentTime;
        }
      }

      const left = (canvasRect.left - sourceRect.left) / sourceRect.width;
      const top = (canvasRect.top - sourceRect.top) / sourceRect.height;
      const width = canvasRect.width / sourceRect.width;
      const height = canvasRect.height / sourceRect.height;
      const lightRadians = ((this.lightAngleDeg - 90) * Math.PI) / 180;

      gl.uniform2f(
        requiredUniform(gl, this.program, "u_source_size"),
        sourceRect.width,
        sourceRect.height,
      );
      gl.uniform4f(
        requiredUniform(gl, this.program, "u_source_rect"),
        left,
        1 - top - height,
        width,
        height,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_displacement_px"),
        this.material.optics.displacementPx,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_frost_px"),
        this.material.optics.frostPx,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_chroma_px"),
        this.material.optics.chromaPx,
      );
      gl.uniform3f(
        requiredUniform(gl, this.program, "u_tint"),
        ...this.material.surface.tint,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_tint_opacity"),
        this.material.surface.tintOpacity,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_rim_intensity"),
        this.material.surface.rimIntensity,
      );
      gl.uniform2f(
        requiredUniform(gl, this.program, "u_light_direction"),
        Math.cos(lightRadians),
        Math.sin(lightRadians),
      );
      gl.uniform2f(
        requiredUniform(gl, this.program, "u_pointer"),
        this.pointerX,
        1 - this.pointerY,
      );
      gl.uniform1f(
        requiredUniform(gl, this.program, "u_activation"),
        this.activation,
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.frames += 1;
      this.lastRenderMs = performance.now() - start;
      this.maxRenderMs = Math.max(this.maxRenderMs, this.lastRenderMs);
      return true;
    } catch (error) {
      this.onFallback(
        error instanceof DOMException && error.name === "SecurityError"
          ? "source-not-origin-clean"
          : "source-upload-failed",
      );
      return false;
    }
  }

  forceContextLoss(): void {
    const extension = this.gl.getExtension("WEBGL_lose_context");
    if (extension) {
      extension.loseContext();
    } else {
      this.canvas.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      );
    }
  }

  getDiagnostics(): M1RendererDiagnostics {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTexture);
    const mapTextureMinFilter = gl.getTexParameter(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
    ) as number;
    const mapTextureMagFilter = gl.getTexParameter(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
    ) as number;
    const mapTextureWrapS = gl.getTexParameter(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
    ) as number;
    const mapTextureWrapT = gl.getTexParameter(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
    ) as number;
    gl.activeTexture(gl.TEXTURE0);
    return {
      renderer: "webgl",
      sourceKind: this.sourceKind,
      active: !this.destroyed,
      contextLost: this.contextLost,
      frames: this.frames,
      uploads: this.uploads,
      presentedFrameCallbacks: this.presentedFrameCallbacks,
      displacementPx: this.material.optics.displacementPx,
      maxRenderMs: this.maxRenderMs,
      lastRenderMs: this.lastRenderMs,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      materialId: this.material.id,
      lightingModelId: M1_WEBGL_SURFACE_FIELD_CONTRACT.id,
      effectiveLightAngleDeg: this.getEffectiveLightAngleDeg(),
      activation: this.activation,
      mapTextureMinFilter,
      mapTextureMagFilter,
      mapTextureWrapS,
      mapTextureWrapT,
    };
  }

  private getEffectiveLightDirection(): readonly [number, number] {
    const lightRadians = ((this.lightAngleDeg - 90) * Math.PI) / 180;
    const x =
      Math.cos(lightRadians) +
      (this.pointerX - 0.5) * this.activation * 0.9;
    const y =
      Math.sin(lightRadians) +
      (0.5 - this.pointerY) * this.activation * 0.9;
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  }

  private getEffectiveLightAngleDeg(): number {
    const [x, y] = this.getEffectiveLightDirection();
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  measureLighting(sourceProbe: string): M1LightingMeasurement {
    this.draw(false);
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width <= 0 || height <= 0) {
      throw new Error("Cannot measure an empty WebGL surface.");
    }
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const luminanceAt = (x: number, y: number): number => {
      const clampedX = Math.min(width - 1, Math.max(0, Math.round(x)));
      const clampedY = Math.min(height - 1, Math.max(0, Math.round(y)));
      const offset = (clampedY * width + clampedX) * 4;
      return (
        ((pixels[offset] ?? 0) * 0.2126 +
          (pixels[offset + 1] ?? 0) * 0.7152 +
          (pixels[offset + 2] ?? 0) * 0.0722) /
        255
      );
    };
    const blueShiftAt = (x: number, y: number): number => {
      const clampedX = Math.min(width - 1, Math.max(0, Math.round(x)));
      const clampedY = Math.min(height - 1, Math.max(0, Math.round(y)));
      const offset = (clampedY * width + clampedX) * 4;
      return (
        ((pixels[offset + 2] ?? 0) -
          ((pixels[offset] ?? 0) + (pixels[offset + 1] ?? 0)) / 2) /
        255
      );
    };

    const [lightX, lightY] = this.getEffectiveLightDirection();
    const centerX = width / 2;
    const centerY = height / 2;
    const interiorSamples = [
      luminanceAt(centerX, centerY),
      luminanceAt(centerX - width * 0.12, centerY),
      luminanceAt(centerX + width * 0.12, centerY),
    ];
    const interiorLuminance =
      interiorSamples.reduce((sum, sample) => sum + sample, 0) /
      interiorSamples.length;

    // Classify framebuffer samples with the actual encoded surface normals.
    // Fixed ellipse coordinates became invalid once the rejected narrow bevel
    // was replaced by the full-depth profile; this keeps the measurement tied
    // to the map the shader really consumes without inferring visual quality.
    let litLuminanceTotal = 0;
    let litWeightTotal = 0;
    let opposingLuminanceTotal = 0;
    let opposingWeightTotal = 0;
    let litCentroidX = 0;
    let litCentroidY = 0;
    const mapStep = Math.max(1, Math.floor(this.map.dpr));
    for (let mapY = 0; mapY < this.map.height; mapY += mapStep) {
      for (let mapX = 0; mapX < this.map.width; mapX += mapStep) {
        const offset = (mapY * this.map.width + mapX) * 4;
        const normalX = ((this.map.pixels[offset] ?? 128) - 128) / 127;
        const normalY = ((this.map.pixels[offset + 1] ?? 128) - 128) / 127;
        const slope = Math.hypot(normalX, normalY);
        if (slope < 0.18) continue;
        // Texture rows are uploaded top-first while readPixels uses WebGL's
        // bottom-left origin, so the map-space Y component is inverted here.
        const alignment = (normalX * lightX - normalY * lightY) / slope;
        const framebufferX = ((mapX + 0.5) / this.map.width) * width;
        const framebufferY =
          height - ((mapY + 0.5) / this.map.height) * height;
        const sample = luminanceAt(framebufferX, framebufferY);
        if (alignment > 0.5) {
          const weight = (alignment - 0.5) * slope;
          litLuminanceTotal += sample * weight;
          litCentroidX += framebufferX * weight;
          litCentroidY += framebufferY * weight;
          litWeightTotal += weight;
        } else if (alignment < -0.5) {
          const weight = (-alignment - 0.5) * slope;
          opposingLuminanceTotal += sample * weight;
          opposingWeightTotal += weight;
        }
      }
    }
    const litRimLuminance =
      litWeightTotal > 0
        ? litLuminanceTotal / litWeightTotal
        : interiorLuminance;
    const opposingRimLuminance =
      opposingWeightTotal > 0
        ? opposingLuminanceTotal / opposingWeightTotal
        : interiorLuminance;
    const litX =
      litWeightTotal > 0 ? litCentroidX / litWeightTotal : centerX;
    const litY =
      litWeightTotal > 0 ? litCentroidY / litWeightTotal : centerY;

    let highFrequencyEnergy = 0;
    let highFrequencySamples = 0;
    const sampleY = Math.round(height / 2);
    let previous = luminanceAt(width * 0.2, sampleY);
    for (let x = Math.round(width * 0.2) + 1; x < width * 0.8; x += 1) {
      const current = luminanceAt(x, sampleY);
      highFrequencyEnergy += Math.abs(current - previous);
      highFrequencySamples += 1;
      previous = current;
    }

    return {
      sourceProbe,
      effectiveLightAngleDeg: this.getEffectiveLightAngleDeg(),
      activation: this.activation,
      interiorLuminance,
      litRimLuminance,
      opposingRimLuminance,
      highlightLift: litRimLuminance - interiorLuminance,
      occlusionDrop: interiorLuminance - opposingRimLuminance,
      tintBlueShift: blueShiftAt(centerX, centerY),
      transmissionLuminance: interiorLuminance,
      highFrequencyEnergy:
        highFrequencySamples > 0
          ? highFrequencyEnergy / highFrequencySamples
          : 0,
      highlightVector: [litX - centerX, litY - centerY],
      sampledPixels: pixels.length / 4,
    };
  }

  resetPerformanceMeasurements(): void {
    this.maxRenderMs = 0;
    this.lastRenderMs = 0;
  }

  setLightAngleDeg(angleDeg: number): void {
    this.lightAngleDeg = ((angleDeg % 360) + 360) % 360;
    this.draw(false);
  }

  setInteraction(x: number, y: number, activation: number): void {
    this.pointerX = Math.min(1, Math.max(0, x));
    this.pointerY = Math.min(1, Math.max(0, y));
    this.activation = Math.min(1, Math.max(0, activation));
    // Interaction changes only uniforms. Reusing the most recently presented
    // texture prevents pointer movement from becoming an unscheduled video
    // upload path outside requestVideoFrameCallback.
    this.draw(false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelVideoFrame();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    if (this.source instanceof HTMLVideoElement) {
      this.source.removeEventListener("play", this.handleVideoPlay);
      this.source.removeEventListener("pause", this.handleVideoPause);
      this.source.removeEventListener("seeked", this.handleVideoSeeked);
      this.source.removeEventListener("loadeddata", this.handleVideoSeeked);
    }
    if (!this.contextLost) {
      this.gl.deleteTexture(this.sourceTexture);
      this.gl.deleteTexture(this.mapTexture);
      this.gl.deleteBuffer(this.buffer);
      this.gl.deleteProgram(this.program);
    }
    activeRendererCount = Math.max(0, activeRendererCount - 1);
  }
}
