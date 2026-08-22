import { describe, expect, it } from "vitest";
import {
  defaultGlazeMaterial,
  defaultGlazeMotion,
  glazeMaterialPresets,
  resolveGlazeMaterial,
  resolveGlazeMotion,
} from "../packages/react/src/material";

describe("resolveGlazeMaterial", () => {
  it("is deterministic and does not mutate the accepted preset", () => {
    const before = JSON.stringify(glazeMaterialPresets.accepted);
    const first = resolveGlazeMaterial(glazeMaterialPresets.accepted);
    const second = resolveGlazeMaterial(glazeMaterialPresets.accepted);
    expect(first).toEqual(second);
    expect(JSON.stringify(glazeMaterialPresets.accepted)).toBe(before);
    expect(first).toEqual(defaultGlazeMaterial);
  });

  it("clamps public values and normalizes colors and angles", () => {
    const result = resolveGlazeMaterial({
      refraction: 12,
      thickness: -4,
      dispersion: Number.NaN,
      roughness: 7,
      transmission: -1,
      tint: { color: "#AbC", opacity: 4 },
      lighting: { angle: -45, highlight: 8, occlusion: -3 },
    });
    expect(result).toEqual({
      refraction: 2,
      thickness: 0,
      dispersion: 0,
      roughness: 1,
      transmission: 0,
      tint: { color: "#aabbcc", opacity: 1 },
      lighting: { angle: 315, highlight: 2, occlusion: 0 },
    });
  });

  it("keeps nested defaults when only one material value changes", () => {
    expect(resolveGlazeMaterial({ refraction: 0.5 })).toEqual({
      ...defaultGlazeMaterial,
      refraction: 0.5,
    });
  });
});

describe("resolveGlazeMotion", () => {
  it("preserves accepted defaults and clamps unsafe spring values", () => {
    expect(resolveGlazeMotion()).toEqual(defaultGlazeMotion);
    expect(resolveGlazeMotion({ stiffness: 5000, damping: -1 })).toEqual({
      stiffness: 1000,
      damping: 0,
    });
  });
});
