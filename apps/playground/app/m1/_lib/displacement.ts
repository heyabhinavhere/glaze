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
  readonly thickness: number;
  readonly curvature: number;
}

export interface DisplacementContinuity {
  readonly maxAdjacentStepPx: number;
  readonly minHorizontalJacobian: number;
  readonly minVerticalJacobian: number;
  readonly foldovers: number;
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
  const thicknessField = new Float32Array(width * height);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.min(
    input.material.geometry.cornerRadiusPx * dpr,
    halfWidth,
    halfHeight,
  );
  const bevel = Math.max(1, input.material.geometry.bevelWidthPx * dpr);
  // The rejected candidate spent the whole optical bend inside one narrow
  // bevel, then snapped to a flat body. A capsule lens instead needs its
  // scalar height to settle across the available half-depth so adjacent source
  // coordinates remain ordered. The material bevel still determines the
  // profile, but it is allowed to relax across twice its authored width.
  const profileDepth = Math.max(1, Math.min(halfHeight, bevel * 2));

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const x = px + 0.5 - halfWidth;
      const y = py + 0.5 - halfHeight;
      const distance = roundedRectDistance(x, y, halfWidth, halfHeight, radius);
      const insideDistance = -distance;
      let thickness = 0;

      if (insideDistance >= 0) {
        const t = clamp(insideDistance / profileDepth, 0, 1);
        // Smoothstep has zero slope at both the material boundary and the
        // settled body. Spreading it across the capsule depth removes the
        // narrow internal seam that caused duplicated bands and pinches.
        thickness = t * t * (3 - 2 * t);
      }

      const offset = (py * width + px) * 4;
      thicknessField[py * width + px] = thickness;
      pixels[offset] = 128;
      pixels[offset + 1] = 128;
      pixels[offset + 2] = Math.round(thickness * 255);
      pixels[offset + 3] = 255;
    }
  }

  const fieldAt = (x: number, y: number): number =>
    thicknessField[
      clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)
    ] ?? 0;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const thickness = fieldAt(px, py);
      if (thickness <= 0 || thickness >= 1) continue;

      const gradientX = (fieldAt(px + 1, py) - fieldAt(px - 1, py)) / 2;
      const gradientY = (fieldAt(px, py + 1) - fieldAt(px, py - 1)) / 2;
      const gradientLength = Math.hypot(gradientX, gradientY);
      if (gradientLength <= 0.000_001) continue;

      // B is the canonical convex thickness field. RG is its normalized,
      // outward-facing gradient with magnitude restored to the smoothstep
      // slope. Both displacement and lighting therefore consume derivatives
      // of the same scalar surface instead of separate decorative masks.
      const outwardX = -gradientX / gradientLength;
      const outwardY = -gradientY / gradientLength;
      const normalizedSlope = clamp(
        (gradientLength * profileDepth) / 1.5,
        0,
        1,
      );
      const offset = (py * width + px) * 4;
      pixels[offset] = Math.round(128 + outwardX * normalizedSlope * 127);
      pixels[offset + 1] = Math.round(128 + outwardY * normalizedSlope * 127);
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

export function measureDisplacementContinuity(
  map: M1DisplacementMap,
  displacementPx: number,
): DisplacementContinuity {
  const vectorAt = (x: number, y: number): readonly [number, number] => {
    const offset = (y * map.width + x) * 4;
    return [
      ((map.pixels[offset] ?? 128) - 128) / 127,
      ((map.pixels[offset + 1] ?? 128) - 128) / 127,
    ];
  };
  let maxAdjacentStepPx = 0;
  let minHorizontalJacobian = Number.POSITIVE_INFINITY;
  let minVerticalJacobian = Number.POSITIVE_INFINITY;
  let foldovers = 0;

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const current = vectorAt(x, y);
      if (x + 1 < map.width) {
        const next = vectorAt(x + 1, y);
        const step = Math.abs((next[0] - current[0]) * displacementPx);
        const jacobian = 1 + (next[0] - current[0]) * displacementPx;
        maxAdjacentStepPx = Math.max(maxAdjacentStepPx, step);
        minHorizontalJacobian = Math.min(minHorizontalJacobian, jacobian);
        if (jacobian <= 0) foldovers += 1;
      }
      if (y + 1 < map.height) {
        const next = vectorAt(x, y + 1);
        const step = Math.abs((next[1] - current[1]) * displacementPx);
        const jacobian = 1 + (next[1] - current[1]) * displacementPx;
        maxAdjacentStepPx = Math.max(maxAdjacentStepPx, step);
        minVerticalJacobian = Math.min(minVerticalJacobian, jacobian);
        if (jacobian <= 0) foldovers += 1;
      }
    }
  }

  return {
    maxAdjacentStepPx,
    minHorizontalJacobian,
    minVerticalJacobian,
    foldovers,
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
  const byteAt = (probeX: number, probeY: number): number => {
    const clampedX = clamp(probeX, 0, map.width - 1);
    const clampedY = clamp(probeY, 0, map.height - 1);
    return map.pixels[(clampedY * map.width + clampedX) * 4 + 2] ?? 0;
  };
  const vector = [(rgba[0] - 128) / 127, (rgba[1] - 128) / 127] as const;
  const centerThickness = rgba[2] / 255;
  const fieldLaplacian =
    (Math.abs(byteAt(x + 1, y) - 2 * rgba[2] + byteAt(x - 1, y)) +
      Math.abs(byteAt(x, y + 1) - 2 * rgba[2] + byteAt(x, y - 1))) /
    255;
  const curvature = clamp(
    Math.hypot(vector[0], vector[1]) * 0.74 + fieldLaplacian * 18,
    0,
    1,
  );
  return {
    x,
    y,
    rgba,
    vector,
    thickness: centerThickness,
    curvature,
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
