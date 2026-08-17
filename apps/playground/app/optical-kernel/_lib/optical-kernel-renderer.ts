import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER,
  OPTICAL_MAP_CONTRACT,
  OPTICAL_MAP_FRAGMENT_SHADER,
  OPTICAL_VERTEX_SHADER,
} from "./optical-map";

export { OPTICAL_MAP_CONTRACT } from "./optical-map";
export const OPTICAL_KERNEL_OPTIONS = ["Focus", "Flow", "Form"] as const;

export const OPTICAL_KERNEL_BACKGROUNDS = Object.freeze([
  Object.freeze({ id: "reference", label: "Reference", kind: "generated" as const }),
  Object.freeze({ id: "architecture", label: "Architecture", kind: "image" as const, src: "/backgrounds/bg-3.jpg", focalX: 0.5, focalY: 0.52 }),
  Object.freeze({ id: "color", label: "Color", kind: "image" as const, src: "/backgrounds/bg-4.jpg", focalX: 0.5, focalY: 0.48 }),
  Object.freeze({ id: "dark", label: "Dark", kind: "image" as const, src: "/backgrounds/bg-2.jpg", focalX: 0.5, focalY: 0.43 }),
]);

export type OpticalKernelBackground = (typeof OPTICAL_KERNEL_BACKGROUNDS)[number];
export type OpticalKernelBackgroundId = OpticalKernelBackground["id"];

export const OPTICAL_KERNEL_CONTRACT = Object.freeze({
  width: 320,
  height: 64,
  inset: 4,
  segmentCount: OPTICAL_KERNEL_OPTIONS.length,
  maxDpr: 2,
  renderer: "webgl2-displacement-map",
  mapId: OPTICAL_MAP_CONTRACT.id,
});

export interface OpticalKernelDiagnostics {
  readonly frames: number;
  readonly mapRenders: number;
  readonly uploads: number;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly selectedIndex: number;
  readonly selectedPosition: number;
  readonly selectionVelocity: number;
  readonly contextLost: boolean;
  readonly settled: boolean;
  readonly lastRenderMs: number;
  readonly maxRenderMs: number;
}

export interface OpticalKernelFrameResult {
  readonly rendered: boolean;
  readonly needsFrame: boolean;
}

interface OpticalKernelRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly source: HTMLCanvasElement;
  readonly control: HTMLElement;
  readonly selectedIndex: number;
  readonly onFallback: (reason: string) => void;
  readonly onRequestFrame: () => void;
}

const QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);

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

export class OpticalKernelRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly source: HTMLCanvasElement;
  private readonly control: HTMLElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly mapProgram: WebGLProgram;
  private readonly compositeProgram: WebGLProgram;
  private readonly sourceTexture: WebGLTexture;
  private readonly trackMapTexture: WebGLTexture;
  private readonly selectionMapTexture: WebGLTexture;
  private readonly mapFramebuffer: WebGLFramebuffer;
  private readonly buffer: WebGLBuffer;
  private readonly onFallback: (reason: string) => void;
  private readonly onRequestFrame: () => void;
  private targetPosition: number;
  private selectedPosition: number;
  private selectionVelocity = 0;
  private energy = 0;
  private targetEnergy = 0;
  private lastTime = 0;
  private frames = 0;
  private mapRenders = 0;
  private uploads = 0;
  private uploadedWidth = 0;
  private uploadedHeight = 0;
  private mapWidth = 0;
  private mapHeight = 0;
  private contextLost = false;
  private destroyed = false;
  private settled = true;
  private lastRenderMs = 0;
  private maxRenderMs = 0;

  constructor(options: OpticalKernelRendererOptions) {
    this.canvas = options.canvas;
    this.source = options.source;
    this.control = options.control;
    this.targetPosition = options.selectedIndex;
    this.selectedPosition = options.selectedIndex;
    this.onFallback = options.onFallback;
    this.onRequestFrame = options.onRequestFrame;

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
    this.onFallback("webgl-context-restored-requires-remount");
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

  private renderMap(
    texture: WebGLTexture,
    surface: 0 | 1,
    width: number,
    height: number,
    sourceRect: DOMRect,
    controlRect: DOMRect,
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
    gl.uniform2f(
      requiredUniform(gl, this.mapProgram, "u_resolution"),
      sourceRect.width,
      sourceRect.height,
    );
    gl.uniform4f(
      requiredUniform(gl, this.mapProgram, "u_control_rect"),
      controlRect.left - sourceRect.left,
      controlRect.top - sourceRect.top,
      controlRect.width,
      controlRect.height,
    );
    gl.uniform1f(
      requiredUniform(gl, this.mapProgram, "u_selected_position"),
      this.selectedPosition,
    );
    gl.uniform1f(
      requiredUniform(gl, this.mapProgram, "u_selection_velocity"),
      this.selectionVelocity,
    );
    gl.uniform1f(requiredUniform(gl, this.mapProgram, "u_energy"), this.energy);
    gl.uniform1i(requiredUniform(gl, this.mapProgram, "u_surface"), surface);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.mapRenders += 1;
  }

  private renderComposite(width: number, height: number, sourceRect: DOMRect): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.bindQuad(this.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(requiredUniform(gl, this.compositeProgram, "u_source"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.trackMapTexture);
    gl.uniform1i(requiredUniform(gl, this.compositeProgram, "u_track_map"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.selectionMapTexture);
    gl.uniform1i(requiredUniform(gl, this.compositeProgram, "u_selection_map"), 2);
    gl.uniform2f(
      requiredUniform(gl, this.compositeProgram, "u_resolution"),
      sourceRect.width,
      sourceRect.height,
    );
    gl.uniform2f(
      requiredUniform(gl, this.compositeProgram, "u_light_direction"),
      -0.64,
      0.77,
    );
    gl.uniform1f(requiredUniform(gl, this.compositeProgram, "u_energy"), this.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private advanceMotion(delta: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.selectedPosition = this.targetPosition;
      this.selectionVelocity = 0;
      this.energy = 0;
      this.targetEnergy = 0;
      this.settled = true;
      return;
    }

    const springForce = (this.targetPosition - this.selectedPosition) * 150;
    const dampingForce = this.selectionVelocity * 18.5;
    this.selectionVelocity += (springForce - dampingForce) * delta;
    this.selectedPosition += this.selectionVelocity * delta;
    this.energy += (this.targetEnergy - this.energy) * Math.min(1, delta * 10);
    this.targetEnergy *= Math.pow(0.035, delta);

    const positionError = Math.abs(this.targetPosition - this.selectedPosition);
    const velocity = Math.abs(this.selectionVelocity);
    const energy = Math.abs(this.energy) + Math.abs(this.targetEnergy);
    this.settled = positionError < 0.002 && velocity < 0.01 && energy < 0.015;
    if (this.settled) {
      this.selectedPosition = this.targetPosition;
      this.selectionVelocity = 0;
      this.energy = 0;
      this.targetEnergy = 0;
    }
  }

  setSelectedIndex(index: number): void {
    const nextPosition = Math.max(
      0,
      Math.min(OPTICAL_KERNEL_OPTIONS.length - 1, index),
    );
    if (
      nextPosition === this.targetPosition
      && Math.abs(this.selectedPosition - nextPosition) < 0.0005
    ) {
      return;
    }
    this.targetPosition = nextPosition;
    this.targetEnergy = 1;
    this.settled = false;
    this.onRequestFrame();
  }

  setPointer(_clientX: number, _clientY: number, active: boolean): void {
    this.targetEnergy = active ? 1 : 0.26;
    this.settled = false;
    this.onRequestFrame();
  }

  releasePointer(): void {
    this.targetEnergy = 0;
    this.settled = false;
    this.onRequestFrame();
  }

  render(
    time: number,
    reducedMotion = false,
    sourceDirty = false,
  ): OpticalKernelFrameResult {
    if (this.destroyed || this.contextLost) {
      return { rendered: false, needsFrame: false };
    }
    const renderStart = performance.now();
    const sourceRect = this.source.getBoundingClientRect();
    const controlRect = this.control.getBoundingClientRect();
    if (
      sourceRect.width <= 0
      || sourceRect.height <= 0
      || controlRect.width <= 0
      || controlRect.height <= 0
    ) {
      return { rendered: false, needsFrame: false };
    }

    const delta = this.lastTime === 0
      ? 1 / 60
      : Math.min(Math.max((time - this.lastTime) / 1000, 1 / 240), 1 / 20);
    this.lastTime = time;
    this.advanceMotion(delta, reducedMotion);

    const dpr = Math.min(
      OPTICAL_KERNEL_CONTRACT.maxDpr,
      window.devicePixelRatio || 1,
    );
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
      this.renderMap(
        this.trackMapTexture,
        0,
        width,
        height,
        sourceRect,
        controlRect,
      );
      this.renderMap(
        this.selectionMapTexture,
        1,
        width,
        height,
        sourceRect,
        controlRect,
      );
      this.renderComposite(width, height, sourceRect);
      this.frames += 1;
      this.lastRenderMs = Math.max(performance.now() - renderStart, 0.001);
      this.maxRenderMs = Math.max(this.maxRenderMs, this.lastRenderMs);
      return { rendered: true, needsFrame: !this.settled };
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

  getDiagnostics(): OpticalKernelDiagnostics {
    const rect = this.source.getBoundingClientRect();
    return {
      frames: this.frames,
      mapRenders: this.mapRenders,
      uploads: this.uploads,
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: rect.width > 0 ? this.canvas.width / rect.width : 1,
      selectedIndex: this.targetPosition,
      selectedPosition: this.selectedPosition,
      selectionVelocity: this.selectionVelocity,
      contextLost: this.contextLost,
      settled: this.settled,
      lastRenderMs: this.lastRenderMs,
      maxRenderMs: this.maxRenderMs,
    };
  }

  forceContextLoss(): void {
    this.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    this.gl.deleteTexture(this.sourceTexture);
    this.gl.deleteTexture(this.trackMapTexture);
    this.gl.deleteTexture(this.selectionMapTexture);
    this.gl.deleteFramebuffer(this.mapFramebuffer);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.mapProgram);
    this.gl.deleteProgram(this.compositeProgram);
  }
}

export function resizeSourceCanvas(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(
    OPTICAL_KERNEL_CONTRACT.maxDpr,
    window.devicePixelRatio || 1,
  );
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d", { alpha: false });
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

export function drawOpticalSource(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  _time: number,
  _reducedMotion: boolean,
  background: OpticalKernelBackground = OPTICAL_KERNEL_BACKGROUNDS[0],
  image?: HTMLImageElement,
): void {
  const dpr = Math.min(
    OPTICAL_KERNEL_CONTRACT.maxDpr,
    window.devicePixelRatio || 1,
  );
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const motionTime = 0;

  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (background.kind === "image" && image?.complete && image.naturalWidth > 0) {
    drawImageBackground(
      context,
      image,
      width,
      height,
      background.focalX,
      background.focalY,
      motionTime,
    );
    context.restore();
    return;
  }

  drawReferenceBackground(context, width, height, motionTime);
  context.restore();
}

function drawImageBackground(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  focalX: number,
  focalY: number,
  motionTime: number,
): void {
  const motionX = Math.sin(motionTime * 0.18) * 0.012;
  const motionY = Math.cos(motionTime * 0.14) * 0.009;
  const destinationScale = 1.035;
  const destinationWidth = width * destinationScale;
  const destinationHeight = height * destinationScale;
  const scale = Math.max(
    destinationWidth / image.naturalWidth,
    destinationHeight / image.naturalHeight,
  );
  const sourceWidth = destinationWidth / scale;
  const sourceHeight = destinationHeight / scale;
  const sourceX = Math.max(
    0,
    Math.min(
      image.naturalWidth - sourceWidth,
      (image.naturalWidth - sourceWidth) * (focalX + motionX),
    ),
  );
  const sourceY = Math.max(
    0,
    Math.min(
      image.naturalHeight - sourceHeight,
      (image.naturalHeight - sourceHeight) * (focalY + motionY),
    ),
  );

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    (width - destinationWidth) * 0.5,
    (height - destinationHeight) * 0.5,
    destinationWidth,
    destinationHeight,
  );
}

function drawReferenceBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motionTime: number,
): void {
  context.fillStyle = "#07131f";
  context.fillRect(0, 0, width, height);

  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "#0c5370");
  wash.addColorStop(0.42, "#102338");
  wash.addColorStop(0.7, "#57274d");
  wash.addColorStop(1, "#cc5a43");
  context.globalAlpha = 0.78;
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;

  const glowX = width * (0.7 + Math.sin(motionTime * 0.35) * 0.07);
  const glowY = height * (0.34 + Math.cos(motionTime * 0.28) * 0.06);
  const glow = context.createRadialGradient(
    glowX,
    glowY,
    4,
    glowX,
    glowY,
    Math.max(width, height) * 0.42,
  );
  glow.addColorStop(0, "rgba(133, 255, 235, 0.78)");
  glow.addColorStop(0.22, "rgba(76, 206, 210, 0.28)");
  glow.addColorStop(1, "rgba(12, 28, 48, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const grid = Math.max(28, Math.min(44, width / 24));
  const offsetX = (motionTime * 10) % grid;
  const offsetY = (motionTime * 6) % grid;
  context.lineWidth = 1;
  context.strokeStyle = "rgba(205, 246, 255, 0.18)";
  context.beginPath();
  for (let x = -grid + offsetX; x <= width + grid; x += grid) {
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = -grid + offsetY; y <= height + grid; y += grid) {
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(width, Math.round(y) + 0.5);
  }
  context.stroke();

  context.save();
  context.translate(width * 0.53, height * 0.53);
  context.rotate(-0.16 + Math.sin(motionTime * 0.22) * 0.018);
  for (let index = -8; index <= 8; index += 1) {
    const x = index * 70 + Math.sin(motionTime * 0.48 + index) * 8;
    context.fillStyle = index % 3 === 0
      ? "rgba(255, 230, 150, 0.58)"
      : index % 3 === 1
        ? "rgba(142, 238, 240, 0.42)"
        : "rgba(255, 133, 154, 0.42)";
    context.fillRect(x - 13, -height, 26, height * 2);
  }
  context.restore();

  const ringX = width * (0.46 + Math.sin(motionTime * 0.18) * 0.035);
  const ringY = height * 0.52;
  context.strokeStyle = "rgba(211, 255, 244, 0.42)";
  context.lineWidth = 1.2;
  for (let radius = 34; radius < Math.max(width, height) * 0.72; radius += 34) {
    context.beginPath();
    context.ellipse(ringX, ringY, radius * 1.28, radius, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.font = `700 ${Math.max(62, Math.min(150, width * 0.12))}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(235, 249, 255, 0.18)";
  context.fillText("BEND LIGHT", width * 0.5, height * 0.53);
}
