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
  renderer: "webgl2-sdf-refraction",
});

export interface OpticalKernelDiagnostics {
  readonly frames: number;
  readonly uploads: number;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly selectedIndex: number;
  readonly selectedPosition: number;
  readonly selectionVelocity: number;
  readonly contextLost: boolean;
  readonly lastRenderMs: number;
  readonly maxRenderMs: number;
}

interface OpticalKernelRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly source: HTMLCanvasElement;
  readonly control: HTMLElement;
  readonly selectedIndex: number;
  readonly onFallback: (reason: string) => void;
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const OPTICAL_KERNEL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec4 u_control_rect;
uniform float u_selected_position;
uniform vec2 u_pointer;
uniform float u_energy;
uniform float u_time;
uniform float u_selection_velocity;

float rounded_box_sdf(vec2 point, vec2 center, vec2 half_size, float radius) {
  vec2 q = abs(point - center) - half_size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float smooth_min(float a, float b, float radius) {
  float blend = clamp(0.5 + 0.5 * (b - a) / radius, 0.0, 1.0);
  return mix(b, a, blend) - radius * blend * (1.0 - blend);
}

float capsule_height(vec2 point, vec2 center, vec2 half_size, float radius) {
  float distance_to_edge = rounded_box_sdf(point, center, half_size, radius);
  float inside = smoothstep(1.25, -1.25, distance_to_edge);
  float bevel = smoothstep(0.0, min(17.0, radius * 0.62), -distance_to_edge);
  return inside * mix(0.0, 1.0, pow(bevel, 0.68));
}

float elastic_active_distance(
  vec2 point,
  vec2 active_center,
  vec2 active_half,
  float active_radius,
  float velocity,
  float speed,
  float touch_field
) {
  float direction = velocity < 0.0 ? -1.0 : 1.0;
  float base = rounded_box_sdf(point, active_center, active_half, active_radius);
  float end_axis = max(active_half.x - active_radius, 0.0);
  vec2 trailing_center = active_center - vec2(direction * (end_axis + speed * 7.0), velocity * 0.75);
  vec2 leading_center = active_center + vec2(direction * (end_axis + speed * 3.5), -velocity * 0.38);
  float trailing_lobe = length(point - trailing_center) - active_radius * (1.0 + speed * 0.08);
  float leading_lobe = length(point - leading_center) - active_radius * (0.94 + speed * 0.05);
  float elastic = smooth_min(base, trailing_lobe, 7.5 + speed * 2.5);
  elastic = smooth_min(elastic, leading_lobe, 5.5 + speed * 1.8);
  float motion_mix = smoothstep(0.07, 0.62, speed);
  return mix(base, elastic, motion_mix) - touch_field * 2.8;
}

float material_height(
  vec2 point,
  vec2 outer_center,
  vec2 outer_half,
  float outer_radius,
  vec2 active_center,
  vec2 active_half,
  float active_radius,
  float velocity,
  float speed,
  float touch_field
) {
  float outer_volume = capsule_height(point, outer_center, outer_half, outer_radius) * 0.72;
  float active_distance = elastic_active_distance(point, active_center, active_half, active_radius, velocity, speed, touch_field);
  float active_inside = smoothstep(1.25, -1.25, active_distance);
  float active_bevel = smoothstep(0.0, min(18.0, active_radius * 0.64), -active_distance);
  float active_volume = active_inside * mix(0.0, 1.0, pow(active_bevel, 0.64));
  return max(outer_volume, active_volume);
}

vec3 source_sample(vec2 uv, vec2 chroma_offset, float edge_energy) {
  vec2 safe_uv = clamp(uv, vec2(0.002), vec2(0.998));
  vec3 straight = texture(u_source, safe_uv).rgb;
  if (edge_energy < 0.035) return straight;

  float red = texture(u_source, clamp(safe_uv - chroma_offset, vec2(0.002), vec2(0.998))).r;
  float blue = texture(u_source, clamp(safe_uv + chroma_offset, vec2(0.002), vec2(0.998))).b;
  return vec3(red, straight.g, blue);
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 point = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 outer_center = u_control_rect.xy + u_control_rect.zw * 0.5;
  vec2 outer_half = u_control_rect.zw * 0.5;
  float outer_radius = outer_half.y;

  float inset = 4.0;
  float segment_width = (u_control_rect.z - inset * 2.0) / 3.0;
  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  float speed = abs(velocity);
  vec2 active_center = vec2(
    u_control_rect.x + inset + segment_width * (u_selected_position + 0.5) + velocity * 3.5,
    outer_center.y + velocity * 0.8
  );
  vec2 active_half = vec2(
    segment_width * 0.5 + 1.5 + u_energy * 1.4 + speed * 5.5,
    outer_half.y - 1.5 + u_energy * 1.2 - speed * 1.8
  );
  float active_radius = active_half.y;

  vec2 touch_delta = point - u_pointer;
  float touch_distance = length(touch_delta);
  float touch_field = exp(-touch_distance * touch_distance / 3200.0) * u_energy;

  float outer_distance = rounded_box_sdf(point, outer_center, outer_half, outer_radius);
  float active_distance = elastic_active_distance(
    point,
    active_center,
    active_half,
    active_radius,
    velocity,
    speed,
    touch_field
  );
  float material_distance = smooth_min(outer_distance, active_distance, 4.5);
  float outer_mask = smoothstep(1.1, -1.1, outer_distance);
  float active_mask = smoothstep(1.1, -1.1, active_distance);
  float material_mask = smoothstep(1.15, -1.15, material_distance);

  float shifted_outer_distance = rounded_box_sdf(point, outer_center + vec2(0.0, 4.5), outer_half + vec2(1.5, 1.0), outer_radius + 1.0);
  float shifted_active_distance = elastic_active_distance(
    point,
    active_center + vec2(velocity * 1.4, 4.0),
    active_half + vec2(1.2, 0.8),
    active_radius + 0.8,
    velocity,
    speed,
    touch_field
  );
  float contact_distance = smooth_min(shifted_outer_distance, shifted_active_distance, 5.0);
  float contact_shadow = smoothstep(10.0, -1.0, contact_distance) * (1.0 - material_mask);
  float outside_distance = max(material_distance, 0.0);
  float caustic_halo = exp(-pow((outside_distance - 2.4) / 2.2, 2.0)) * (1.0 - material_mask);
  float lower_side = smoothstep(-0.15, 0.85, (point.y - outer_center.y) / max(outer_half.y, 1.0));
  float halo_alpha = contact_shadow * mix(0.035, 0.115, lower_side) + caustic_halo * mix(0.018, 0.052, 1.0 - lower_side);
  halo_alpha *= 1.0 - smoothstep(9.0, 14.0, outside_distance);

  if (material_mask <= 0.001 && halo_alpha <= 0.001) {
    out_color = vec4(0.0);
    return;
  }

  if (material_mask <= 0.001) {
    vec3 halo_color = mix(vec3(0.005, 0.018, 0.032), vec3(0.48, 0.92, 1.0), caustic_halo * 0.34);
    out_color = vec4(halo_color, halo_alpha);
    return;
  }

  float sample_step = 1.35;
  float height_left = material_height(point - vec2(sample_step, 0.0), outer_center, outer_half, outer_radius, active_center, active_half, active_radius, velocity, speed, touch_field);
  float height_right = material_height(point + vec2(sample_step, 0.0), outer_center, outer_half, outer_radius, active_center, active_half, active_radius, velocity, speed, touch_field);
  float height_up = material_height(point - vec2(0.0, sample_step), outer_center, outer_half, outer_radius, active_center, active_half, active_radius, velocity, speed, touch_field);
  float height_down = material_height(point + vec2(0.0, sample_step), outer_center, outer_half, outer_radius, active_center, active_half, active_radius, velocity, speed, touch_field);
  vec2 height_gradient = vec2(height_right - height_left, height_down - height_up) / (sample_step * 2.0);
  float height = material_height(point, outer_center, outer_half, outer_radius, active_center, active_half, active_radius, velocity, speed, touch_field);

  vec2 outer_local = (point - outer_center) / max(outer_half, vec2(1.0));
  vec2 active_local = point - active_center;
  vec2 active_local_normalized = active_local / max(active_half, vec2(1.0));
  float active_edge = smoothstep(-19.0, -1.5, active_distance) * active_mask;
  float outer_edge = smoothstep(-17.0, -1.5, outer_distance) * outer_mask;
  float edge_energy = clamp(max(active_edge, outer_edge * 0.72), 0.0, 1.0);

  vec2 lens_normal = normalize(height_gradient + vec2(0.00001));
  float gradient_strength = clamp(length(height_gradient) * 8.5, 0.0, 1.0);
  vec2 edge_bend = lens_normal * mix(4.8, 12.8, active_mask) * gradient_strength;
  vec2 interior_splay = -outer_local * vec2(3.8, 2.5) * height * outer_mask;
  interior_splay += -active_local_normalized * vec2(4.1, 2.8) * height * active_mask;
  interior_splay.x += -velocity * (1.0 - min(abs(active_local_normalized.x), 1.0)) * active_mask * 3.2;
  vec2 touch_bend = touch_distance > 0.5
    ? normalize(touch_delta) * touch_field * 3.4
    : vec2(0.0);
  vec2 displaced_point = point + edge_bend + interior_splay + touch_bend;
  vec2 displaced_uv = vec2(displaced_point.x / u_resolution.x, 1.0 - displaced_point.y / u_resolution.y);
  vec2 chroma_offset = lens_normal * edge_energy * 1.28 / u_resolution;
  vec3 source_color = source_sample(displaced_uv, chroma_offset, edge_energy);
  vec2 scatter_step = vec2(0.85) / u_resolution;
  vec3 optical_scatter = source_color * 4.0;
  optical_scatter += texture(u_source, clamp(displaced_uv + vec2(scatter_step.x, 0.0), vec2(0.002), vec2(0.998))).rgb;
  optical_scatter += texture(u_source, clamp(displaced_uv - vec2(scatter_step.x, 0.0), vec2(0.002), vec2(0.998))).rgb;
  optical_scatter += texture(u_source, clamp(displaced_uv + vec2(0.0, scatter_step.y), vec2(0.002), vec2(0.998))).rgb;
  optical_scatter += texture(u_source, clamp(displaced_uv - vec2(0.0, scatter_step.y), vec2(0.002), vec2(0.998))).rgb;
  source_color = mix(source_color, optical_scatter * 0.125, height * 0.34);
  float source_luma = luminance(source_color);

  vec3 surface_normal = normalize(vec3(-height_gradient * 8.2, 1.0));
  vec2 pointer_direction = normalize((u_pointer - outer_center) / max(u_resolution, vec2(1.0)) + vec2(-0.46, -0.7));
  vec3 light_direction = normalize(vec3(pointer_direction, 0.72));
  vec3 view_direction = vec3(0.0, 0.0, 1.0);
  vec3 half_vector = normalize(light_direction + view_direction);
  float fresnel = pow(1.0 - clamp(surface_normal.z, 0.0, 1.0), 2.2);
  float specular = pow(max(dot(surface_normal, half_vector), 0.0), mix(36.0, 24.0, u_energy));
  float light_facing = max(dot(surface_normal.xy, light_direction.xy), 0.0);
  float opposing = max(-dot(surface_normal.xy, light_direction.xy), 0.0);
  float traveling_light = 0.5 + 0.5 * sin(u_time * 0.0018 + active_center.x * 0.012);

  float rim_direction = mix(0.2, 1.0, smoothstep(-0.3, 0.72, light_facing - opposing));
  float upper_body = 1.0 - smoothstep(-0.72, 0.48, outer_local.y);
  float lower_body = smoothstep(0.12, 0.92, outer_local.y);
  float adaptive_dim = mix(0.008, 0.026, source_luma) * mix(0.7, 1.0, active_mask);
  vec3 optical_lift = vec3(0.09, 0.18, 0.205) * height;
  vec3 transmitted = 1.0 - (1.0 - source_color) * (1.0 - optical_lift);
  transmitted *= 1.0 - adaptive_dim;
  transmitted += vec3(0.68, 0.91, 1.0) * upper_body * height * 0.018;
  transmitted += vec3(0.92, 0.99, 1.0) * edge_energy * (fresnel * 0.24 * rim_direction + specular * 0.48 + light_facing * 0.045);
  transmitted += vec3(0.58, 0.9, 1.0) * touch_field * (0.038 + traveling_light * 0.022);
  transmitted *= 1.0 - opposing * edge_energy * mix(0.075, 0.16, source_luma);
  transmitted *= 1.0 - lower_body * edge_energy * 0.045;

  float coverage = clamp(material_mask * (0.965 + edge_energy * 0.035), 0.0, 1.0);
  out_color = vec4(transmitted, coverage);
}`;

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

function requiredUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`missing-uniform:${name}`);
  return location;
}

export class OpticalKernelRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly source: HTMLCanvasElement;
  private readonly control: HTMLElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly buffer: WebGLBuffer;
  private readonly onFallback: (reason: string) => void;
  private targetPosition: number;
  private selectedPosition: number;
  private selectionVelocity = 0;
  private pointerX = 0;
  private pointerY = 0;
  private energy = 0;
  private targetEnergy = 0;
  private lastTime = 0;
  private frames = 0;
  private uploads = 0;
  private uploadedWidth = 0;
  private uploadedHeight = 0;
  private contextLost = false;
  private destroyed = false;
  private lastRenderMs = 0;
  private maxRenderMs = 0;

  constructor(options: OpticalKernelRendererOptions) {
    this.canvas = options.canvas;
    this.source = options.source;
    this.control = options.control;
    this.targetPosition = options.selectedIndex;
    this.selectedPosition = options.selectedIndex;
    this.onFallback = options.onFallback;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, OPTICAL_KERNEL_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("program-allocation-failed");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program-link-failed");
    }
    this.program = program;

    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    if (!texture || !buffer) throw new Error("resource-allocation-failed");
    this.texture = texture;
    this.buffer = buffer;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(requiredUniform(gl, program, "u_source"), 0);

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

  setSelectedIndex(index: number): void {
    this.targetPosition = Math.max(0, Math.min(OPTICAL_KERNEL_OPTIONS.length - 1, index));
    this.targetEnergy = 1;
  }

  setPointer(clientX: number, clientY: number, active: boolean): void {
    const sourceRect = this.source.getBoundingClientRect();
    this.pointerX = clientX - sourceRect.left;
    this.pointerY = clientY - sourceRect.top;
    this.targetEnergy = active ? 1 : 0.28;
  }

  releasePointer(): void {
    this.targetEnergy = 0;
  }

  render(time: number, reducedMotion = false): boolean {
    if (this.destroyed || this.contextLost) return false;
    const renderStart = performance.now();
    const sourceRect = this.source.getBoundingClientRect();
    const controlRect = this.control.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || controlRect.width <= 0) return false;

    const delta = this.lastTime === 0 ? 1 / 60 : Math.min((time - this.lastTime) / 1000, 1 / 20);
    this.lastTime = time;
    if (reducedMotion) {
      this.selectedPosition = this.targetPosition;
      this.selectionVelocity = 0;
      this.energy += (this.targetEnergy - this.energy) * Math.min(1, delta * 8);
    } else {
      const springForce = (this.targetPosition - this.selectedPosition) * 150;
      const dampingForce = this.selectionVelocity * 18.5;
      this.selectionVelocity += (springForce - dampingForce) * delta;
      this.selectedPosition += this.selectionVelocity * delta;
      this.energy += (this.targetEnergy - this.energy) * Math.min(1, delta * 10);
    }
    this.targetEnergy *= Math.pow(0.035, delta);

    const dpr = Math.min(OPTICAL_KERNEL_CONTRACT.maxDpr, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(sourceRect.width * dpr));
    const height = Math.max(1, Math.round(sourceRect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const gl = this.gl;
    try {
      gl.useProgram(this.program);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (this.uploadedWidth !== this.source.width || this.uploadedHeight !== this.source.height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
        this.uploadedWidth = this.source.width;
        this.uploadedHeight = this.source.height;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
      }
      this.uploads += 1;

      gl.uniform2f(requiredUniform(gl, this.program, "u_resolution"), sourceRect.width, sourceRect.height);
      gl.uniform4f(
        requiredUniform(gl, this.program, "u_control_rect"),
        controlRect.left - sourceRect.left,
        controlRect.top - sourceRect.top,
        controlRect.width,
        controlRect.height,
      );
      gl.uniform1f(requiredUniform(gl, this.program, "u_selected_position"), this.selectedPosition);
      gl.uniform2f(requiredUniform(gl, this.program, "u_pointer"), this.pointerX, this.pointerY);
      gl.uniform1f(requiredUniform(gl, this.program, "u_energy"), this.energy);
      gl.uniform1f(requiredUniform(gl, this.program, "u_time"), time);
      gl.uniform1f(requiredUniform(gl, this.program, "u_selection_velocity"), this.selectionVelocity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.frames += 1;
      this.lastRenderMs = Math.max(performance.now() - renderStart, 0.001);
      this.maxRenderMs = Math.max(this.maxRenderMs, this.lastRenderMs);
      return true;
    } catch (error) {
      this.onFallback(error instanceof DOMException && error.name === "SecurityError" ? "source-not-origin-clean" : "source-upload-failed");
      return false;
    }
  }

  getDiagnostics(): OpticalKernelDiagnostics {
    const rect = this.source.getBoundingClientRect();
    return {
      frames: this.frames,
      uploads: this.uploads,
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: rect.width > 0 ? this.canvas.width / rect.width : 1,
      selectedIndex: this.targetPosition,
      selectedPosition: this.selectedPosition,
      selectionVelocity: this.selectionVelocity,
      contextLost: this.contextLost,
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
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}

export function resizeSourceCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(OPTICAL_KERNEL_CONTRACT.maxDpr, window.devicePixelRatio || 1);
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
  time: number,
  reducedMotion: boolean,
  background: OpticalKernelBackground = OPTICAL_KERNEL_BACKGROUNDS[0],
  image?: HTMLImageElement,
): void {
  const dpr = Math.min(OPTICAL_KERNEL_CONTRACT.maxDpr, window.devicePixelRatio || 1);
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const motionTime = reducedMotion ? 0 : time * 0.001;

  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (background.kind === "image" && image?.complete && image.naturalWidth > 0) {
    drawImageBackground(context, image, width, height, background.focalX, background.focalY, motionTime);
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
  const scale = Math.max(destinationWidth / image.naturalWidth, destinationHeight / image.naturalHeight);
  const sourceWidth = destinationWidth / scale;
  const sourceHeight = destinationHeight / scale;
  const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) * (focalX + motionX)));
  const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, (image.naturalHeight - sourceHeight) * (focalY + motionY)));

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
  const glow = context.createRadialGradient(glowX, glowY, 4, glowX, glowY, Math.max(width, height) * 0.42);
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
