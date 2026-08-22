import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER,
  OPTICAL_MAP_FRAGMENT_SHADER,
  OPTICAL_VERTEX_SHADER,
} from "./optical-map";
import {
  defaultGlazeMaterial,
  defaultGlazeMotion,
} from "../material";
import type {
  GlazeMaterial,
  GlazeMotion,
} from "../types";
import type { OpticalControlRegistration } from "../internal/surface-context";

export { OPTICAL_MAP_CONTRACT } from "./optical-map";

interface OpticalControlState {
  id: string;
  element: HTMLElement;
  selectionCount: number;
  selectedPosition: number;
  selectionVisible: boolean;
  targetPosition: number;
  currentPosition: number;
  velocity: number;
  energy: number;
  targetEnergy: number;
  settled: boolean;
}

export interface OpticalSurfaceDiagnostics {
  readonly rendererId: number;
  readonly frames: number;
  readonly mapRenders: number;
  readonly uploads: number;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly controlCount: number;
  readonly contextLost: boolean;
  readonly settled: boolean;
  readonly lastRenderMs: number;
  readonly maxRenderMs: number;
  readonly controls: readonly {
    id: string;
    selectionCount: number;
    selectedPosition: number;
    targetPosition: number;
    velocity: number;
    settled: boolean;
  }[];
}

export interface OpticalSurfaceFrameResult {
  readonly rendered: boolean;
  readonly needsFrame: boolean;
}

export interface OpticalSurfaceRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly source: HTMLCanvasElement;
  readonly ownedDecoration: HTMLCanvasElement;
  readonly onFallback: (reason: string) => void;
  readonly onRequestFrame: () => void;
  readonly onContextRestored?: () => void;
  readonly material?: GlazeMaterial;
  readonly motion?: GlazeMotion;
}

const MAX_DPR = 2;
const QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);

let nextRendererId = 1;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader-allocation-failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "shader-compilation-failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, OPTICAL_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("program-allocation-failed");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "program-link-failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function requiredUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`missing-uniform:${name}`);
  return location;
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("texture-allocation-failed");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function clampPosition(position: number, selectionCount: number): number {
  const maximum = Math.max(0, selectionCount - 1);
  return Math.min(maximum, Math.max(0, Number.isFinite(position) ? position : 0));
}

function colorChannels(color: string): readonly [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export class OpticalSurfaceRenderer {
  readonly rendererId = nextRendererId++;

  private readonly canvas: HTMLCanvasElement;
  private readonly source: HTMLCanvasElement;
  private readonly ownedDecoration: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly mapProgram: WebGLProgram;
  private readonly compositeProgram: WebGLProgram;
  private readonly sourceTexture: WebGLTexture;
  private readonly ownedDecorationTexture: WebGLTexture;
  private readonly trackMapTexture: WebGLTexture;
  private readonly selectionMapTexture: WebGLTexture;
  private readonly mapFramebuffer: WebGLFramebuffer;
  private readonly buffer: WebGLBuffer;
  private readonly onFallback: (reason: string) => void;
  private readonly onRequestFrame: () => void;
  private readonly onContextRestored?: () => void;
  private readonly controls = new Map<string, OpticalControlState>();

  private frames = 0;
  private mapRenders = 0;
  private uploads = 0;
  private uploadedWidth = 0;
  private uploadedHeight = 0;
  private mapWidth = 0;
  private mapHeight = 0;
  private lastTime = 0;
  private contextLost = false;
  private destroyed = false;
  private lastRenderMs = 0;
  private maxRenderMs = 0;
  private material: GlazeMaterial;
  private motion: GlazeMotion;

  constructor(options: OpticalSurfaceRendererOptions) {
    this.canvas = options.canvas;
    this.source = options.source;
    this.ownedDecoration = options.ownedDecoration;
    this.onFallback = options.onFallback;
    this.onRequestFrame = options.onRequestFrame;
    this.onContextRestored = options.onContextRestored;
    this.material = options.material ?? defaultGlazeMaterial;
    this.motion = options.motion ?? defaultGlazeMotion;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;
    this.mapProgram = createProgram(gl, OPTICAL_MAP_FRAGMENT_SHADER);
    this.compositeProgram = createProgram(gl, OPTICAL_COMPOSITE_FRAGMENT_SHADER);
    this.sourceTexture = createTexture(gl);
    this.ownedDecorationTexture = createTexture(gl);
    this.trackMapTexture = createTexture(gl);
    this.selectionMapTexture = createTexture(gl);

    const mapFramebuffer = gl.createFramebuffer();
    const buffer = gl.createBuffer();
    if (!mapFramebuffer || !buffer) throw new Error("resource-allocation-failed");
    this.mapFramebuffer = mapFramebuffer;
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.destroyed) return;
    this.contextLost = true;
    this.onFallback("webgl-context-lost");
  };

  private readonly handleContextRestored = (): void => {
    if (this.destroyed) return;
    this.contextLost = false;
    if (this.onContextRestored) this.onContextRestored();
    else this.onFallback("webgl-context-restored-requires-remount");
  };

  private bindQuad(program: WebGLProgram): void {
    const gl = this.gl;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }

  private ensureMapTargets(width: number, height: number): void {
    if (this.mapWidth === width && this.mapHeight === height) return;
    const gl = this.gl;
    for (const texture of [this.trackMapTexture, this.selectionMapTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }
    this.mapWidth = width;
    this.mapHeight = height;
  }

  private uploadSourceIfNeeded(sourceDirty: boolean): void {
    if (
      !sourceDirty
      && this.uploadedWidth === this.source.width
      && this.uploadedHeight === this.source.height
    ) {
      return;
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (
      this.uploadedWidth !== this.source.width
      || this.uploadedHeight !== this.source.height
    ) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.source,
      );
      this.uploadedWidth = this.source.width;
      this.uploadedHeight = this.source.height;
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.source,
      );
    }
    this.uploads += 1;
  }

  private uploadOwnedDecoration(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.ownedDecorationTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.ownedDecoration,
    );
  }

  private setGeometryUniforms(
    program: WebGLProgram,
    sourceRect: DOMRect,
    controlRect: DOMRect,
    control: OpticalControlState,
  ): void {
    const gl = this.gl;
    gl.uniform2f(
      requiredUniform(gl, program, "u_resolution"),
      sourceRect.width,
      sourceRect.height,
    );
    gl.uniform4f(
      requiredUniform(gl, program, "u_control_rect"),
      controlRect.left - sourceRect.left,
      controlRect.top - sourceRect.top,
      controlRect.width,
      controlRect.height,
    );
    gl.uniform1f(
      requiredUniform(gl, program, "u_selected_position"),
      control.currentPosition,
    );
    gl.uniform1f(
      requiredUniform(gl, program, "u_selection_count"),
      control.selectionCount,
    );
    gl.uniform1f(
      requiredUniform(gl, program, "u_selection_velocity"),
      control.velocity,
    );
  }

  private renderMap(
    texture: WebGLTexture,
    surface: 0 | 1,
    width: number,
    height: number,
    sourceRect: DOMRect,
    controlRect: DOMRect,
    control: OpticalControlState,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mapFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("optical-map-framebuffer-incomplete");
    }
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0.5, 0.5, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.bindQuad(this.mapProgram);
    this.setGeometryUniforms(this.mapProgram, sourceRect, controlRect, control);
    gl.uniform1f(requiredUniform(gl, this.mapProgram, "u_energy"), control.energy);
    gl.uniform1f(
      requiredUniform(gl, this.mapProgram, "u_selection_visible"),
      control.selectionVisible ? 1 : 0,
    );
    gl.uniform1i(requiredUniform(gl, this.mapProgram, "u_surface"), surface);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.mapRenders += 1;
  }

  private renderComposite(
    width: number,
    height: number,
    sourceRect: DOMRect,
    controlRect: DOMRect,
    control: OpticalControlState,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.bindQuad(this.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(requiredUniform(gl, this.compositeProgram, "u_source"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.trackMapTexture);
    gl.uniform1i(requiredUniform(gl, this.compositeProgram, "u_track_map"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.selectionMapTexture);
    gl.uniform1i(
      requiredUniform(gl, this.compositeProgram, "u_selection_map"),
      2,
    );
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.ownedDecorationTexture);
    gl.uniform1i(
      requiredUniform(gl, this.compositeProgram, "u_owned_decoration"),
      3,
    );
    this.setGeometryUniforms(
      this.compositeProgram,
      sourceRect,
      controlRect,
      control,
    );
    gl.uniform2f(
      requiredUniform(gl, this.compositeProgram, "u_light_direction"),
      Math.cos(this.material.lighting.angle * Math.PI / 180),
      Math.sin(this.material.lighting.angle * Math.PI / 180),
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_refraction"),
      this.material.refraction,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_thickness"),
      this.material.thickness,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_dispersion"),
      this.material.dispersion,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_roughness"),
      this.material.roughness,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_transmission"),
      this.material.transmission,
    );
    const tint = colorChannels(this.material.tint.color);
    gl.uniform3f(
      requiredUniform(gl, this.compositeProgram, "u_tint_color"),
      tint[0],
      tint[1],
      tint[2],
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_tint_opacity"),
      this.material.tint.opacity,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_highlight"),
      this.material.lighting.highlight,
    );
    gl.uniform1f(
      requiredUniform(gl, this.compositeProgram, "u_occlusion"),
      this.material.lighting.occlusion,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private advanceMotion(
    control: OpticalControlState,
    delta: number,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) {
      control.currentPosition = control.targetPosition;
      control.velocity = 0;
      control.energy = 0;
      control.targetEnergy = 0;
      control.settled = true;
      return;
    }

    const springForce = (
      control.targetPosition - control.currentPosition
    ) * this.motion.stiffness;
    const dampingForce = control.velocity * this.motion.damping;
    control.velocity += (springForce - dampingForce) * delta;
    control.currentPosition += control.velocity * delta;
    control.energy += (
      control.targetEnergy - control.energy
    ) * Math.min(1, delta * 10);
    control.targetEnergy *= Math.pow(0.035, delta);

    const positionError = Math.abs(
      control.targetPosition - control.currentPosition,
    );
    const velocity = Math.abs(control.velocity);
    const energy = Math.abs(control.energy) + Math.abs(control.targetEnergy);
    control.settled = positionError < 0.002 && velocity < 0.01 && energy < 0.015;
    if (control.settled) {
      control.currentPosition = control.targetPosition;
      control.velocity = 0;
      control.energy = 0;
      control.targetEnergy = 0;
    }
  }

  registerControl(registration: OpticalControlRegistration): void {
    if (this.destroyed) return;
    const selectionCount = Math.max(1, registration.selectionCount);
    const selectedPosition = clampPosition(
      registration.selectedPosition,
      selectionCount,
    );
    this.controls.set(registration.id, {
      ...registration,
      selectionCount,
      selectedPosition,
      selectionVisible: registration.selectionVisible,
      targetPosition: selectedPosition,
      currentPosition: selectedPosition,
      velocity: 0,
      energy: 0,
      targetEnergy: 0,
      settled: true,
    });
    this.onRequestFrame();
  }

  unregisterControl(id: string): void {
    if (this.controls.delete(id)) this.onRequestFrame();
  }

  updateControl(
    id: string,
    selectionCount: number,
    selectedPosition: number,
    selectionVisible: boolean,
  ): void {
    const control = this.controls.get(id);
    if (!control) return;
    const nextCount = Math.max(1, selectionCount);
    const nextPosition = clampPosition(selectedPosition, nextCount);
    const visibilityChanged = control.selectionVisible !== selectionVisible;
    control.selectionCount = nextCount;
    control.selectedPosition = nextPosition;
    control.selectionVisible = selectionVisible;
    if (
      !visibilityChanged
      && nextPosition === control.targetPosition
      && Math.abs(control.currentPosition - nextPosition) < 0.0005
    ) {
      return;
    }
    control.targetPosition = nextPosition;
    control.targetEnergy = 1;
    control.settled = false;
    this.onRequestFrame();
  }

  setMaterial(material: GlazeMaterial): void {
    this.material = material;
    this.onRequestFrame();
  }

  setMotion(motion: GlazeMotion): void {
    this.motion = motion;
  }

  setPointer(id: string, active: boolean): void {
    const control = this.controls.get(id);
    if (!control) return;
    control.targetEnergy = active ? 1 : 0.26;
    control.settled = false;
    this.onRequestFrame();
  }

  releasePointer(id: string): void {
    const control = this.controls.get(id);
    if (!control) return;
    control.targetEnergy = 0;
    control.settled = false;
    this.onRequestFrame();
  }

  render(
    time: number,
    reducedMotion = false,
    sourceDirty = false,
  ): OpticalSurfaceFrameResult {
    if (this.destroyed || this.contextLost) {
      return { rendered: false, needsFrame: false };
    }
    const renderStart = performance.now();
    const sourceRect = this.source.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0) {
      return { rendered: false, needsFrame: false };
    }

    const delta = this.lastTime === 0
      ? 1 / 60
      : Math.min(Math.max((time - this.lastTime) / 1000, 1 / 240), 1 / 20);
    this.lastTime = time;
    for (const control of this.controls.values()) {
      this.advanceMotion(control, delta, reducedMotion);
    }

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(sourceRect.width * dpr));
    const height = Math.max(1, Math.round(sourceRect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      sourceDirty = true;
    }

    try {
      this.ensureMapTargets(width, height);
      this.uploadSourceIfNeeded(sourceDirty);
      if (this.frames === 0) this.uploadOwnedDecoration();

      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (const control of this.controls.values()) {
        const controlRect = control.element.getBoundingClientRect();
        if (controlRect.width <= 0 || controlRect.height <= 0) continue;
        this.renderMap(
          this.trackMapTexture,
          0,
          width,
          height,
          sourceRect,
          controlRect,
          control,
        );
        this.renderMap(
          this.selectionMapTexture,
          1,
          width,
          height,
          sourceRect,
          controlRect,
          control,
        );
        this.renderComposite(width, height, sourceRect, controlRect, control);
      }

      this.frames += 1;
      this.lastRenderMs = Math.max(performance.now() - renderStart, 0.001);
      this.maxRenderMs = Math.max(this.maxRenderMs, this.lastRenderMs);
      const needsFrame = Array.from(this.controls.values()).some(
        (control) => !control.settled,
      );
      return { rendered: true, needsFrame };
    } catch (error) {
      this.onFallback(
        error instanceof DOMException && error.name === "SecurityError"
          ? "source-not-origin-clean"
          : error instanceof Error
            ? error.message
            : "source-render-failed",
      );
      return { rendered: false, needsFrame: false };
    }
  }

  getDiagnostics(): OpticalSurfaceDiagnostics {
    const rect = this.source.getBoundingClientRect();
    const controls = Array.from(this.controls.values());
    return {
      rendererId: this.rendererId,
      frames: this.frames,
      mapRenders: this.mapRenders,
      uploads: this.uploads,
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: rect.width > 0 ? this.canvas.width / rect.width : 1,
      controlCount: controls.length,
      contextLost: this.contextLost,
      settled: controls.every((control) => control.settled),
      lastRenderMs: this.lastRenderMs,
      maxRenderMs: this.maxRenderMs,
      controls: controls.map((control) => ({
        id: control.id,
        selectionCount: control.selectionCount,
        selectedPosition: control.currentPosition,
        targetPosition: control.targetPosition,
        velocity: control.velocity,
        settled: control.settled,
      })),
    };
  }

  forceContextLoss(): void {
    this.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.controls.clear();
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    this.gl.deleteTexture(this.sourceTexture);
    this.gl.deleteTexture(this.ownedDecorationTexture);
    this.gl.deleteTexture(this.trackMapTexture);
    this.gl.deleteTexture(this.selectionMapTexture);
    this.gl.deleteFramebuffer(this.mapFramebuffer);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.mapProgram);
    this.gl.deleteProgram(this.compositeProgram);
  }
}
