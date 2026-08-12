import { describe, expect, it } from "vitest";
import {
  generateM1DisplacementMap,
  hashDisplacementMap,
  readDisplacementProbe,
  svgDisplacementOffsetPx,
  webglDisplacementOffsetPx,
} from "../apps/playground/app/m1/_lib/displacement";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";

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

    expect(center.rgba).toEqual([128, 128, 255, 255]);
    expect(left.vector[0]).toBeLessThan(-0.9);
    expect(right.vector[0]).toBeGreaterThan(0.9);
    expect(top.vector[1]).toBeLessThan(-0.9);
    expect(bottom.vector[1]).toBeGreaterThan(0.9);
    expect(left.rgba[2]).toBeGreaterThan(105);
  });

  it("keeps pixels outside rounded corners neutral", () => {
    const map = makeMap(1);
    expect(readDisplacementProbe(map, 0, 0).rgba).toEqual([
      128, 128, 0, 255,
    ]);
  });

  it("keeps fixed SVG and WebGL displacement probes within one CSS pixel", () => {
    const map = makeMap(1);
    const probes = [
      readDisplacementProbe(map, 7, 28),
      readDisplacementProbe(map, 233, 28),
      readDisplacementProbe(map, 120, 7),
      readDisplacementProbe(map, 120, 49),
    ];

    for (const probe of probes) {
      for (const channel of probe.rgba.slice(0, 2)) {
        const svg = svgDisplacementOffsetPx(
          channel,
          transportMaterial.optics.displacementPx,
        );
        const webgl = webglDisplacementOffsetPx(
          channel,
          transportMaterial.optics.displacementPx,
        );
        expect(Math.abs(svg - webgl)).toBeLessThanOrEqual(1);
      }
    }
  });
});
