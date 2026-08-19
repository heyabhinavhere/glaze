export const OPTICAL_MAP_CONTRACT = Object.freeze({
  id: "glaze-optical-map-r3",
  channels: Object.freeze({
    red: "horizontal-displacement",
    green: "vertical-displacement",
    blue: "thickness",
    alpha: "coverage",
  }),
  maxDisplacementPx: 28,
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
uniform float u_selection_velocity;
uniform float u_energy;
uniform int u_surface;

const float MAX_DISPLACEMENT = ${28}.0;

float rounded_box_sdf(vec2 point, vec2 center, vec2 half_size, float radius) {
  vec2 q = abs(point - center) - half_size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void surface_geometry(out vec2 center, out vec2 half_size, out float radius) {
  vec2 track_center = u_control_rect.xy + u_control_rect.zw * 0.5;
  vec2 track_half = u_control_rect.zw * 0.5;

  if (u_surface == 0) {
    center = track_center;
    half_size = track_half;
    radius = track_half.y;
    return;
  }

  float inset = 4.0;
  float segment_width = (u_control_rect.z - inset * 2.0) / 3.0;
  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  float speed = abs(velocity);
  center = vec2(
    u_control_rect.x + inset + segment_width * (u_selected_position + 0.5) + velocity * 2.2,
    track_center.y + velocity * 0.35
  );
  half_size = vec2(
    segment_width * 0.5 - 1.5 + speed * 7.0 + u_energy * 0.8,
    track_half.y - 4.0 - speed * 1.2 + u_energy * 0.5
  );
  radius = half_size.y;
}

float surface_height(vec2 point) {
  vec2 center;
  vec2 half_size;
  float radius;
  surface_geometry(center, half_size, radius);

  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  if (u_surface == 1) {
    vec2 local = point - center;
    float normalized_x = clamp(local.x / max(half_size.x, 1.0), -1.0, 1.0);
    local.y += velocity * (1.0 - normalized_x * normalized_x) * 2.2;
    point = center + local;
  }

  float distance_to_edge = rounded_box_sdf(point, center, half_size, radius);
  float coverage = smoothstep(1.25, -1.25, distance_to_edge);
  float normalized_depth = clamp(-distance_to_edge / max(radius, 1.0), 0.0, 1.0);
  float spherical = sqrt(max(0.0, 1.0 - pow(1.0 - normalized_depth, 2.0)));
  float exponent = u_surface == 0 ? 0.92 : 0.82;
  float thickness_scale = u_surface == 0 ? 0.54 : 1.0;
  return coverage * pow(spherical, exponent) * thickness_scale;
}

void main() {
  vec2 point = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 center;
  vec2 half_size;
  float radius;
  surface_geometry(center, half_size, radius);

  float velocity = clamp(u_selection_velocity / 7.5, -1.0, 1.0);
  vec2 shaped_point = point;
  if (u_surface == 1) {
    vec2 local = point - center;
    float normalized_x = clamp(local.x / max(half_size.x, 1.0), -1.0, 1.0);
    local.y += velocity * (1.0 - normalized_x * normalized_x) * 2.2;
    shaped_point = center + local;
  }

  float distance_to_edge = rounded_box_sdf(shaped_point, center, half_size, radius);
  float coverage = smoothstep(1.25, -1.25, distance_to_edge);
  if (coverage <= 0.001) {
    out_map = vec4(0.5, 0.5, 0.0, 0.0);
    return;
  }

  float sample_step = 1.0;
  float left = surface_height(point - vec2(sample_step, 0.0));
  float right = surface_height(point + vec2(sample_step, 0.0));
  float up = surface_height(point - vec2(0.0, sample_step));
  float down = surface_height(point + vec2(0.0, sample_step));
  vec2 gradient = vec2(right - left, down - up) / (sample_step * 2.0);
  float thickness = surface_height(point);
  float gradient_length = length(gradient);
  vec2 outward = gradient_length > 0.00001 ? -gradient / gradient_length : vec2(0.0);
  float slope = clamp(gradient_length * 6.5, 0.0, 1.0);

  vec2 local = shaped_point - center;
  vec2 magnification = u_surface == 0 ? vec2(0.050, 0.095) : vec2(0.180, 0.290);
  float edge_strength = u_surface == 0 ? 2.8 : 9.5;
  vec2 displacement = -local * magnification * thickness;
  displacement += outward * edge_strength * slope;

  if (u_surface == 1) {
    float normalized_x = clamp(local.x / max(half_size.x, 1.0), -1.0, 1.0);
    displacement.x -= velocity * (1.0 - normalized_x * normalized_x) * 2.8 * thickness;
  }

  float displacement_length = length(displacement);
  if (displacement_length > MAX_DISPLACEMENT) {
    displacement *= MAX_DISPLACEMENT / displacement_length;
  }

  vec2 encoded_displacement = displacement / MAX_DISPLACEMENT * 0.5 + 0.5;
  out_map = vec4(encoded_displacement, thickness, coverage);
}`;

export const OPTICAL_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

uniform sampler2D u_source;
uniform sampler2D u_track_map;
uniform sampler2D u_selection_map;
uniform vec2 u_resolution;
uniform vec2 u_light_direction;
uniform float u_energy;

const float MAX_DISPLACEMENT = ${28}.0;

vec2 decode_displacement(vec4 optical_map) {
  return (optical_map.rg - 0.5) * 2.0 * MAX_DISPLACEMENT;
}

vec3 source_sample(
  vec2 uv,
  vec2 displacement,
  float dispersion,
  float roughness
) {
  vec2 displaced_uv = uv + vec2(displacement.x, -displacement.y) / u_resolution;
  vec2 direction = length(displacement) > 0.001 ? normalize(displacement) : vec2(0.0);
  vec2 chroma = vec2(direction.x, -direction.y) * dispersion / u_resolution;
  vec2 roughness_uv = vec2(roughness) / u_resolution;
  vec2 safe_uv = clamp(displaced_uv, vec2(0.002), vec2(0.998));
  vec3 center = texture(u_source, safe_uv).rgb;
  vec3 softened = center * 0.44;
  softened += texture(u_source, clamp(safe_uv + vec2(roughness_uv.x, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.14;
  softened += texture(u_source, clamp(safe_uv - vec2(roughness_uv.x, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.14;
  softened += texture(u_source, clamp(safe_uv + vec2(0.0, roughness_uv.y), vec2(0.002), vec2(0.998))).rgb * 0.14;
  softened += texture(u_source, clamp(safe_uv - vec2(0.0, roughness_uv.y), vec2(0.002), vec2(0.998))).rgb * 0.14;
  if (dispersion <= 0.001) return softened;
  float red = texture(u_source, clamp(displaced_uv - chroma, vec2(0.002), vec2(0.998))).r;
  float blue = texture(u_source, clamp(displaced_uv + chroma, vec2(0.002), vec2(0.998))).b;
  return mix(softened, vec3(red, softened.g, blue), 0.42);
}

vec3 surface_normal(sampler2D optical_map, vec2 uv) {
  vec2 texel = 1.0 / u_resolution;
  float left = texture(optical_map, uv - vec2(texel.x, 0.0)).b;
  float right = texture(optical_map, uv + vec2(texel.x, 0.0)).b;
  float down = texture(optical_map, uv - vec2(0.0, texel.y)).b;
  float up = texture(optical_map, uv + vec2(0.0, texel.y)).b;
  vec2 gradient = vec2(right - left, up - down) * 0.5;
  return normalize(vec3(-gradient * 20.0, 1.0));
}

vec3 shade_surface(
  sampler2D optical_map,
  vec4 map_sample,
  vec3 source_color,
  float active_strength
) {
  vec3 normal = surface_normal(optical_map, v_uv);
  vec2 light = normalize(u_light_direction);
  float edge_energy = pow(clamp(1.0 - normal.z, 0.0, 1.0), 0.42);
  float directional_rim = edge_energy
    * smoothstep(-0.10, 0.78, dot(normal.xy, light));
  float directional_occlusion = edge_energy
    * smoothstep(-0.10, 0.78, dot(normal.xy, -light));
  vec3 half_vector = normalize(vec3(light, 0.72) + vec3(0.0, 0.0, 1.0));
  float specular = pow(
    max(dot(normal, half_vector), 0.0),
    mix(34.0, 20.0, active_strength)
  ) * mix(0.28, 0.72, edge_energy);

  vec3 transmitted = source_color;
  float volume = pow(clamp(map_sample.b, 0.0, 1.0), 0.86);
  float light_facing = clamp(
    0.5 + dot(normal.xy, light) * 0.5,
    0.0,
    1.0
  );
  vec3 absorption = mix(
    vec3(0.060, 0.030, 0.015),
    vec3(0.420, 0.200, 0.080),
    active_strength
  );
  transmitted *= exp(-absorption * volume);
  transmitted = mix(
    transmitted,
    vec3(0.48, 0.82, 0.95),
    volume * mix(0.080, 0.26, active_strength)
  );
  transmitted += vec3(0.40, 0.72, 0.92)
    * volume
    * mix(0.022, 0.095, active_strength)
    * mix(0.78, 1.0, light_facing);
  transmitted *= 1.0 - directional_occlusion * mix(0.12, 0.30, active_strength);
  transmitted += vec3(0.88, 0.97, 1.0)
    * directional_rim
    * mix(0.22, 0.48, active_strength);
  transmitted += vec3(1.0, 0.985, 0.95)
    * specular
    * mix(0.065, 0.15, active_strength);
  return transmitted;
}

void main() {
  vec4 track_map = texture(u_track_map, v_uv);
  vec4 selection_map = texture(u_selection_map, v_uv);
  if (track_map.a <= 0.001 && selection_map.a <= 0.001) {
    out_color = vec4(0.0);
    return;
  }

  vec2 track_displacement = decode_displacement(track_map);
  vec3 track_source = source_sample(
    v_uv,
    track_displacement,
    0.06 * track_map.b,
    0.30
  );
  vec3 track_color = shade_surface(u_track_map, track_map, track_source, 0.0);

  vec2 selection_displacement = decode_displacement(selection_map) + track_displacement * 0.22;
  vec3 selection_source = source_sample(
    v_uv,
    selection_displacement,
    (0.34 + u_energy * 0.10) * selection_map.b,
    0.40
  );
  vec3 selection_color = shade_surface(
    u_selection_map,
    selection_map,
    selection_source,
    1.0
  );

  float selection_mix = smoothstep(0.02, 0.96, selection_map.a);
  vec3 material = mix(track_color, selection_color, selection_mix);
  float coverage = max(track_map.a * 0.965, selection_map.a * 0.992);
  out_color = vec4(material * coverage, coverage);
}`;
