import type { M1Material } from "./material";

export interface M1DisplacementMap {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export interface DisplacementProbe {
  readonly x: number;
  readonly y: number;
  readonly rgba: readonly [number, number, number, number];
  readonly vector: readonly [number, number];
}

export function svgDisplacementOffsetPx(
  channelByte: number,
  displacementPx: number,
): number {
  return displacementPx * (2 * (channelByte / 255) - 1);
}

export function webglDisplacementOffsetPx(
  channelByte: number,
  displacementPx: number,
): number {
  return displacementPx * (2 * (channelByte / 255) - 1);
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function roundedRectDistance(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

export function generateM1DisplacementMap(input: {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
  readonly material: M1Material;
}): M1DisplacementMap {
  const dpr = clamp(input.dpr, 1, 2);
  const width = Math.max(1, Math.round(input.cssWidth * dpr));
  const height = Math.max(1, Math.round(input.cssHeight * dpr));
  const pixels = new Uint8ClampedArray(width * height * 4);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.min(
    input.material.geometry.cornerRadiusPx * dpr,
    halfWidth,
    halfHeight,
  );
  const bevel = Math.max(1, input.material.geometry.bevelWidthPx * dpr);

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const x = px + 0.5 - halfWidth;
      const y = py + 0.5 - halfHeight;
      const distance = roundedRectDistance(x, y, halfWidth, halfHeight, radius);
      const insideDistance = -distance;
      let normalX = 0;
      let normalY = 0;
      let profile = 0;
      let thickness = 0;

      if (insideDistance >= 0) {
        const t = clamp(insideDistance / bevel, 0, 1);
        // A smooth convex thickness field: zero at the material boundary and
        // fully settled in the body. The RG vector is its strongest slope,
        // while B records thickness for adaptive transmission in WebGL.
        thickness = t * t * (3 - 2 * t);
      }

      if (insideDistance >= 0 && insideDistance <= bevel) {
        const dx =
          roundedRectDistance(x + 0.5, y, halfWidth, halfHeight, radius) -
          roundedRectDistance(x - 0.5, y, halfWidth, halfHeight, radius);
        const dy =
          roundedRectDistance(x, y + 0.5, halfWidth, halfHeight, radius) -
          roundedRectDistance(x, y - 0.5, halfWidth, halfHeight, radius);
        const length = Math.hypot(dx, dy);
        if (length > 0.000_001) {
          normalX = dx / length;
          normalY = dy / length;
        }
        const t = clamp(insideDistance / bevel, 0, 1);
        profile = Math.sin(Math.PI * t);
      }

      const offset = (py * width + px) * 4;
      pixels[offset] = Math.round(128 + normalX * profile * 127);
      pixels[offset + 1] = Math.round(128 + normalY * profile * 127);
      pixels[offset + 2] = Math.round(thickness * 255);
      pixels[offset + 3] = 255;
    }
  }

  return {
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    dpr,
    width,
    height,
    pixels,
  };
}

export function readDisplacementProbe(
  map: M1DisplacementMap,
  cssX: number,
  cssY: number,
): DisplacementProbe {
  const x = clamp(Math.round(cssX * map.dpr), 0, map.width - 1);
  const y = clamp(Math.round(cssY * map.dpr), 0, map.height - 1);
  const offset = (y * map.width + x) * 4;
  const rgba = [
    map.pixels[offset] ?? 128,
    map.pixels[offset + 1] ?? 128,
    map.pixels[offset + 2] ?? 0,
    map.pixels[offset + 3] ?? 255,
  ] as const;
  return {
    x,
    y,
    rgba,
    vector: [(rgba[0] - 128) / 127, (rgba[1] - 128) / 127],
  };
}

export async function hashDisplacementMap(
  map: M1DisplacementMap,
): Promise<string> {
  const bytes = new Uint8Array(map.pixels);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
