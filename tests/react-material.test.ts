import { describe, expect, it } from "vitest";
import {
  glazeMaterials,
  resolveGlazeMaterial,
} from "../packages/react/src/material";

describe("resolveGlazeMaterial", () => {
  it("is deterministic and does not mutate a named preset", () => {
    const before = JSON.stringify(glazeMaterials.regular);
    const first = resolveGlazeMaterial("regular");
    const second = resolveGlazeMaterial("regular");
    expect(first).toEqual(second);
    expect(JSON.stringify(glazeMaterials.regular)).toBe(before);
  });

  it("clamps public values and normalizes colors and angles", () => {
    const result = resolveGlazeMaterial({
      clarity: 140,
      frost: -20,
      tint: "#AbC",
      tintOpacity: 80,
      depth: Number.NaN,
      edge: 120,
      lightAngle: -45,
      radius: -8,
      motion: "none",
    });
    expect(result).toMatchObject({
      clarity: 100,
      frost: 0,
      tint: "#aabbcc",
      tintOpacity: 50,
      depth: 0,
      edge: 100,
      lightAngle: 315,
      radius: 0,
      motion: "none",
    });
    expect(result.cssVariables["--glaze-motion-duration"]).toBe("0ms");
  });

  it("falls back to the regular preset for an unknown runtime name", () => {
    expect(resolveGlazeMaterial("unknown" as "regular")).toEqual(
      resolveGlazeMaterial("regular"),
    );
  });

  it("normalizes unsupported runtime motion values", () => {
    const result = resolveGlazeMaterial({
      motion: "instant" as "subtle",
    });
    expect(result.motion).toBe("subtle");
    expect(result.cssVariables["--glaze-motion-duration"]).toBe("180ms");
  });
});
