import { describe, expect, it } from "vitest";
import {
  generateM1DisplacementMap,
  hashDisplacementMap,
  measureDisplacementContinuity,
  readDisplacementProbe,
} from "../apps/playground/app/m1/_lib/displacement";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";
import {
  M1_WEBGL_FRAGMENT_SHADER,
  M1_WEBGL_REFRACTION_MAX_SCALE,
  M1_WEBGL_REFRACTION_REST_SCALE,
  M1_WEBGL_SURFACE_FIELD_CONTRACT,
} from "../apps/playground/app/m1/_lib/webgl-renderer";

const makeMap = (dpr = 2) =>
  generateM1DisplacementMap({
    cssWidth: 240,
    cssHeight: 56,
    dpr,
    material: transportMaterial,
  });

describe("M1 deterministic displacement map", () => {
  it("produces byte-identical pixels and hashes for identical inputs", async () => {
    const first = makeMap();
    const second = makeMap();

    expect(first.pixels).toEqual(second.pixels);
    expect(await hashDisplacementMap(first)).toBe(
      await hashDisplacementMap(second),
    );
  });

  it("caps DPR at 2 and records physical dimensions", () => {
    expect(makeMap(1)).toMatchObject({ width: 240, height: 56, dpr: 1 });
    expect(makeMap(3)).toMatchObject({ width: 480, height: 112, dpr: 2 });
  });

  it("encodes outward vectors around a neutral center", () => {
    const map = makeMap(1);
    const center = readDisplacementProbe(map, 120, 28);
    const left = readDisplacementProbe(map, 7, 28);
    const right = readDisplacementProbe(map, 233, 28);
    const top = readDisplacementProbe(map, 120, 7);
    const bottom = readDisplacementProbe(map, 120, 49);

    expect(center.thickness).toBe(1);
    expect(Math.hypot(center.vector[0], center.vector[1])).toBeLessThan(0.1);
    expect(left.vector[0]).toBeLessThan(-0.6);
    expect(right.vector[0]).toBeGreaterThan(0.6);
    expect(top.vector[1]).toBeLessThan(-0.6);
    expect(bottom.vector[1]).toBeGreaterThan(0.6);
    expect(left.thickness).toBeGreaterThan(0.1);
  });

  it("keeps pixels outside rounded corners neutral", () => {
    const map = makeMap(1);
    expect(readDisplacementProbe(map, 0, 0).rgba).toEqual([
      128, 128, 0, 255,
    ]);
  });

  it("derives encoded normals, thickness, and curvature from one scalar field", () => {
    const map = makeMap(1);
    const center = readDisplacementProbe(map, 120, 28);
    const innerSlope = readDisplacementProbe(map, 14, 28);
    const boundary = readDisplacementProbe(map, 1, 28);

    expect(center.thickness).toBe(1);
    expect(Math.hypot(center.vector[0], center.vector[1])).toBeLessThan(0.1);
    expect(innerSlope.thickness).toBeGreaterThan(boundary.thickness);
    expect(Math.hypot(innerSlope.vector[0], innerSlope.vector[1])).toBeGreaterThan(0.9);
    expect(innerSlope.curvature).toBeGreaterThan(center.curvature);
  });

  it("keeps the actual rest refraction mapping ordered without local foldovers", () => {
    const map = makeMap(2);
    for (const scale of [
      M1_WEBGL_REFRACTION_REST_SCALE,
      M1_WEBGL_REFRACTION_MAX_SCALE,
    ]) {
      const continuity = measureDisplacementContinuity(
        map,
        transportMaterial.optics.displacementPx * scale,
      );

      expect(continuity.foldovers).toBe(0);
      expect(continuity.minHorizontalJacobian).toBeGreaterThan(0.35);
      expect(continuity.minVerticalJacobian).toBeGreaterThan(0.35);
      expect(continuity.maxAdjacentStepPx).toBeLessThan(0.65);
    }
  });

  it("binds the actual encoded map channels and thickness derivatives in WebGL", () => {
    expect(M1_WEBGL_SURFACE_FIELD_CONTRACT).toEqual({
      id: "m1.1-continuous-capsule-lighting-r1",
      displacementChannels: "rg",
      thicknessChannel: "b",
      textureMinFilter: "linear",
      textureMagFilter: "linear",
      wrap: "clamp-to-edge",
    });
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain(
      "vec2 vector = encoded.rg * 2.0 - 1.0",
    );
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("float thickness = encoded.b");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("float field_laplacian");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("float refraction_energy");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("vec3 surface_normal");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("float specular");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("float occlusion");
    expect(M1_WEBGL_FRAGMENT_SHADER).toContain("vec3 transmitted");
  });

});
