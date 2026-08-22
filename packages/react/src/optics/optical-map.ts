/**
 * The spherical-cap normalization and soft inward meniscus below are adapted
 * from Sam Asante's MIT-licensed liquid-glass displacement generator at commit
 * 4e7b769e1df7e5a7d3669fef22417fe3d2f79ade. Glaze keeps its own renderer,
 * semantic tree, lifecycle, motion, and RGBA map contract.
 */
export const OPTICAL_TRANSPLANT_PROVENANCE = Object.freeze({
  repository: "https://github.com/samasante/liquid-glass",
  commit: "4e7b769e1df7e5a7d3669fef22417fe3d2f79ade",
  license: "MIT",
  scope: "spherical-cap displacement and inward meniscus math",
});

export interface OpticalDomeConstants {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

function domeGradientMean(radius: number, halfExtent: number): number {
  if (halfExtent <= 0) return 0;
  return (
    radius - Math.sqrt(radius * radius - halfExtent * halfExtent)
  ) / halfExtent;
}

export function computeOpticalDomeConstants(
  capDepth: number,
  halfWidth: number,
  halfHeight: number,
): OpticalDomeConstants {
  const cap = Math.max(
    0.01,
    Math.min(capDepth, Math.min(halfWidth, halfHeight) - 1),
  );
  const radiusX = (halfWidth * halfWidth + cap * cap) / (2 * cap);
  const radiusY = (halfHeight * halfHeight + cap * cap) / (2 * cap);
  const meanX = domeGradientMean(radiusX, halfWidth);
  const meanY = domeGradientMean(radiusY, halfHeight);
  return {
    radiusX,
    radiusY,
    scaleX: meanX > 0 ? 0.5 / meanX : 1,
    scaleY: meanY > 0 ? 0.5 / meanY : 1,
  };
}

export const OPTICAL_MAP_CONTRACT = Object.freeze({
  id: "glaze-optical-map-transplant",
  geometry: "registered-capsule-with-uniform-selection-count",
  channels: Object.freeze({
    red: "horizontal-displacement",
    green: "vertical-displacement",
    blue: "thickness",
    alpha: "coverage",
  }),
  maxDisplacementPx: 36,
  surfaces: Object.freeze(["track", "selection"] as const),
});

export const OPTICAL_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const OPTICAL_MAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_map;

uniform vec2 u_resolution;
uniform vec4 u_control_rect;
uniform float u_selected_position;
uniform float u_selection_count;
uniform float u_selection_velocity;
uniform float u_selection_visible;
uniform float u_energy;
uniform int u_surface;

const float MAX_DISPLACEMENT = 36.0;
const float SQRT_PI = 1.7724538509;

float rounded_box_sdf(vec2 local, vec2 half_size, float radius) {
  vec2 q = abs(local) - half_size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float erf_approx(float value) {
  return tanh(SQRT_PI * value);
}

float dome_axis_gradient(float distance, float half_extent, float cap_depth) {
  float cap = clamp(cap_depth, 0.01, max(0.01, half_extent - 1.0));
  float radius = (half_extent * half_extent + cap * cap) / (2.0 * cap);
  float root = sqrt(max(radius * radius - half_extent * half_extent, 0.0001));
  float mean_gradient = (radius - root) / max(half_extent, 0.0001);
  float scale = mean_gradient > 0.0001 ? 0.5 / mean_gradient : 1.0;
  float sample_distance = min(abs(distance), radius * 0.999);
  float gradient = sample_distance
    / sqrt(max(radius * radius - sample_distance * sample_distance, 0.0001));
  return sign(distance) * gradient * scale;
}

void surface_geometry(out vec2 center, out vec2 half_size, out float radius) {
  vec2 track_center = u_control_rect.xy + u_control_rect.zw * 0.5;
  vec2 track_half = u_control_rect.zw * 0.5 - vec2(0.75);

  if (u_surface == 0) {
    center = track_center;
    half_size = track_half;
    radius = track_half.y;
    return;
  }

  float inset = 5.0;
  float segment_width = (u_control_rect.z - inset * 2.0)
    / max(u_selection_count, 1.0);
  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  float speed = abs(velocity);
  center = vec2(
    u_control_rect.x + inset + segment_width * (u_selected_position + 0.5)
      + velocity * 2.6,
    track_center.y + velocity * 0.25
  );
  half_size = vec2(
    segment_width * 0.5 - 1.8 + speed * 8.0 + u_energy * 0.7,
    track_half.y - 4.2 - speed * 1.0 + u_energy * 0.35
  );
  radius = half_size.y;
}

vec2 shape_point(vec2 point, vec2 center, vec2 half_size) {
  if (u_surface == 0) return point;
  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  vec2 local = point - center;
  float normalized_x = clamp(local.x / max(half_size.x, 1.0), -1.0, 1.0);
  local.y += velocity * (1.0 - normalized_x * normalized_x) * 1.8;
  return center + local;
}

vec2 transplanted_refraction_field(
  vec2 local,
  vec2 half_size,
  float radius,
  float sdf,
  float depth,
  float curvature,
  float bend,
  float bend_width
) {
  float min_half = min(half_size.x, half_size.y);
  float depth_px = min(depth * min_half, min_half - 1.0);
  vec2 inner_half = max(vec2(0.0), half_size - vec2(depth_px));
  float inner_radius = max(0.0, min(radius, min(inner_half.x, inner_half.y)));
  float inner_sdf = rounded_box_sdf(local, inner_half, inner_radius);
  float falloff = depth_px > 0.0 ? 0.7071067812 / depth_px : 1000000.0;
  float edge_opacity = 0.5 * (1.0 + erf_approx(inner_sdf * falloff));

  float cap_depth = curvature * min_half;
  vec2 direction = vec2(
    dome_axis_gradient(local.x, half_size.x, cap_depth),
    dome_axis_gradient(local.y, half_size.y, cap_depth)
  );
  vec2 field = 0.5 * direction * edge_opacity;

  float band_inverse = 1.0 / max(2.0, bend_width * min_half);
  float band_position = sdf < 0.0 ? max(0.0, 1.0 + sdf * band_inverse) : 0.0;
  float direction_length = length(direction);
  if (band_position > 0.0 && direction_length > 0.0001) {
    float meniscus = 6.75
      * band_position
      * band_position
      * (1.0 - band_position);
    field += normalize(direction) * 0.5 * bend * meniscus * edge_opacity;
  }
  return field;
}

void main() {
  vec2 point = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 center;
  vec2 half_size;
  float radius;
  surface_geometry(center, half_size, radius);
  vec2 shaped_point = shape_point(point, center, half_size);
  vec2 local = shaped_point - center;
  float sdf = rounded_box_sdf(local, half_size, radius);
  float coverage = smoothstep(1.15, -1.15, sdf);
  if (u_surface == 1) coverage *= u_selection_visible;
  if (coverage <= 0.001) {
    out_map = vec4(0.5, 0.5, 0.0, 0.0);
    return;
  }

  bool is_track = u_surface == 0;
  vec2 field = transplanted_refraction_field(
    local,
    half_size,
    radius,
    sdf,
    is_track ? 0.92 : 0.84,
    is_track ? 0.58 : 0.62,
    is_track ? 0.52 : 0.0,
    is_track ? 0.18 : 0.16
  );
  vec2 displacement = field * (is_track ? vec2(30.0, 12.0) : vec2(18.0, 10.0));

  if (!is_track) {
    float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
    float normalized_x = clamp(local.x / max(half_size.x, 1.0), -1.0, 1.0);
    displacement.x -= velocity * (1.0 - normalized_x * normalized_x) * 2.2;
  }

  float displacement_length = length(displacement);
  if (displacement_length > MAX_DISPLACEMENT) {
    displacement *= MAX_DISPLACEMENT / displacement_length;
  }

  float inside = clamp(-sdf / max(min(half_size.x, half_size.y), 1.0), 0.0, 1.0);
  float thickness = coverage * sqrt(max(0.0, 1.0 - (1.0 - inside) * (1.0 - inside)));
  vec2 encoded_displacement = displacement / MAX_DISPLACEMENT * 0.5 + 0.5;
  out_map = vec4(encoded_displacement, thickness, coverage);
}`;

export const OPTICAL_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

uniform sampler2D u_source;
uniform sampler2D u_owned_decoration;
uniform sampler2D u_track_map;
uniform sampler2D u_selection_map;
uniform vec2 u_resolution;
uniform vec4 u_control_rect;
uniform float u_selected_position;
uniform float u_selection_count;
uniform float u_selection_velocity;
uniform vec2 u_light_direction;
uniform float u_refraction;
uniform float u_thickness;
uniform float u_dispersion;
uniform float u_roughness;
uniform float u_transmission;
uniform vec3 u_tint_color;
uniform float u_tint_opacity;
uniform float u_highlight;
uniform float u_occlusion;

const float MAX_DISPLACEMENT = 36.0;

vec2 decode_displacement(vec4 optical_map) {
  return (optical_map.rg - 0.5) * 2.0 * MAX_DISPLACEMENT;
}

vec3 refracted_source(vec2 uv, vec2 displacement, float dispersion) {
  vec2 base_offset = vec2(displacement.x, -displacement.y) / u_resolution;
  vec2 safe_red = clamp(uv + base_offset * (1.0 + dispersion * 0.22), vec2(0.002), vec2(0.998));
  vec2 safe_green = clamp(uv + base_offset * (1.0 + dispersion * 0.11), vec2(0.002), vec2(0.998));
  vec2 safe_blue = clamp(uv + base_offset, vec2(0.002), vec2(0.998));
  return vec3(
    texture(u_source, safe_red).r,
    texture(u_source, safe_green).g,
    texture(u_source, safe_blue).b
  );
}

vec3 surface_normal(sampler2D optical_map, vec2 uv, float thickness_scale) {
  vec2 texel = 1.0 / u_resolution;
  float left = texture(optical_map, uv - vec2(texel.x, 0.0)).b;
  float right = texture(optical_map, uv + vec2(texel.x, 0.0)).b;
  float down = texture(optical_map, uv - vec2(0.0, texel.y)).b;
  float up = texture(optical_map, uv + vec2(0.0, texel.y)).b;
  vec2 gradient = vec2(right - left, up - down) * 0.5 * thickness_scale;
  return normalize(vec3(-gradient * 26.0, 1.0));
}

void selection_geometry(out vec2 center, out vec2 half_size) {
  vec2 track_center = u_control_rect.xy + u_control_rect.zw * 0.5;
  vec2 track_half = u_control_rect.zw * 0.5 - vec2(0.75);
  float inset = 5.0;
  float segment_width = (u_control_rect.z - inset * 2.0)
    / max(u_selection_count, 1.0);
  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  float speed = abs(velocity);
  center = vec2(
    u_control_rect.x + inset + segment_width * (u_selected_position + 0.5)
      + velocity * 2.6,
    track_center.y + velocity * 0.25
  );
  half_size = vec2(
    segment_width * 0.5 - 1.8 + speed * 8.0,
    track_half.y - 4.2 - speed * 1.0
  );
}

vec4 owned_decoration(vec2 displacement) {
  vec2 center;
  vec2 half_size;
  selection_geometry(center, half_size);
  vec2 point = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 local_uv = (point - center + displacement * 0.35) / (half_size * 2.0) + 0.5;
  vec2 decoration_uv = vec2(local_uv.x, 1.0 - local_uv.y);
  return texture(u_owned_decoration, clamp(decoration_uv, vec2(0.0), vec2(1.0)));
}

void main() {
  vec4 track_map = texture(u_track_map, v_uv);
  vec4 selection_map = texture(u_selection_map, v_uv);
  if (track_map.a <= 0.001) {
    out_color = vec4(0.0);
    return;
  }

  vec2 track_displacement = decode_displacement(track_map) * u_refraction;
  vec3 track_source = refracted_source(
    v_uv,
    track_displacement,
    0.20 * u_dispersion
  );

  vec3 normal = surface_normal(u_track_map, v_uv, u_thickness);
  vec2 light = normalize(u_light_direction);
  float edge_energy = pow(clamp(1.0 - normal.z, 0.0, 1.0), 0.48);
  float directional_rim = edge_energy
    * smoothstep(0.06, 0.86, dot(normal.xy, light));
  float directional_occlusion = edge_energy
    * smoothstep(0.08, 0.88, dot(normal.xy, -light));
  vec3 half_vector = normalize(vec3(light, 0.82) + vec3(0.0, 0.0, 1.0));
  float specular_power = max(4.0, 48.0 - u_roughness * 45.0);
  float specular = pow(
    max(dot(normal, half_vector), 0.0),
    specular_power
  ) * edge_energy;

  vec3 track_color = mix(
    track_source,
    vec3(0.74, 0.82, 0.87),
    0.105 * track_map.b * u_thickness
  );
  track_color *= 1.0 - directional_occlusion * 0.22 * u_occlusion;
  track_color += vec3(0.94, 0.985, 1.0)
    * directional_rim * 0.62 * u_highlight;
  track_color += vec3(1.0, 0.99, 0.96)
    * specular * 0.18 * u_highlight;

  vec2 selection_displacement = track_displacement * 0.18
    + decode_displacement(selection_map)
      * selection_map.b * u_thickness * u_refraction;
  vec3 selection_source = refracted_source(
    v_uv,
    selection_displacement,
    0.28 * u_dispersion
  );
  vec4 decoration = owned_decoration(selection_displacement);
  vec3 decorated_source = mix(
    selection_source,
    decoration.rgb,
    decoration.a * selection_map.b * u_thickness
  );
  decorated_source = mix(
    decorated_source,
    vec3(0.93, 0.97, 1.0),
    0.055 * selection_map.b * u_thickness
  );

  float selection_mix = smoothstep(
    0.02,
    0.68,
    selection_map.b * u_thickness
  );
  vec3 material = mix(track_color, decorated_source, selection_mix);
  float tint_weight = clamp(
    u_tint_opacity * max(track_map.b, selection_map.b),
    0.0,
    1.0
  );
  material = mix(material, u_tint_color, tint_weight);
  float coverage = track_map.a * u_transmission;
  out_color = vec4(clamp(material, 0.0, 1.0) * coverage, coverage);
}`;
