import { describe, expect, it } from "vitest";
import {
  OPTICAL_KERNEL_BACKGROUNDS,
  OPTICAL_KERNEL_CONTRACT,
  OPTICAL_KERNEL_OPTIONS,
} from "../apps/playground/app/optical-kernel/_lib/optical-kernel-renderer";
import {
  computeOpticalDomeConstants,
  OPTICAL_COMPOSITE_FRAGMENT_SHADER,
  OPTICAL_MAP_CONTRACT,
  OPTICAL_MAP_FRAGMENT_SHADER,
  OPTICAL_TRANSPLANT_PROVENANCE,
} from "../apps/playground/app/optical-kernel/_lib/optical-map";

describe("optical kernel contract", () => {
  it("keeps the proof at authored component scale", () => {
    expect(OPTICAL_KERNEL_CONTRACT).toMatchObject({
      width: 320,
      height: 64,
      inset: 4,
      segmentCount: 3,
      maxDpr: 2,
      renderer: "webgl2-displacement-map",
      mapId: "glaze-optical-map-transplant",
    });
    expect(OPTICAL_KERNEL_OPTIONS).toEqual(["Focus", "Flow", "Form"]);
    expect(OPTICAL_KERNEL_BACKGROUNDS).toEqual([
      { id: "reference", label: "Reference", kind: "generated" },
      { id: "architecture", label: "Architecture", kind: "image", src: "/backgrounds/bg-3.jpg", focalX: 0.5, focalY: 0.52 },
      { id: "color", label: "Color", kind: "image", src: "/backgrounds/bg-4.jpg", focalX: 0.5, focalY: 0.48 },
      { id: "dark", label: "Dark", kind: "image", src: "/backgrounds/bg-2.jpg", focalX: 0.5, focalY: 0.43 },
    ]);
  });

  it("defines a portable deterministic displacement-map contract", () => {
    expect(OPTICAL_MAP_CONTRACT).toEqual({
      id: "glaze-optical-map-transplant",
      channels: {
        red: "horizontal-displacement",
        green: "vertical-displacement",
        blue: "thickness",
        alpha: "coverage",
      },
      maxDisplacementPx: 36,
      surfaces: ["track", "selection"],
    });
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("out_map");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("u_surface");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("dome_axis_gradient");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("transplanted_refraction_field");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("meniscus");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("encoded_displacement");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).not.toContain("smooth_min");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).not.toContain("lobe");
  });

  it("uses the license-verified spherical-cap transplant deterministically", () => {
    expect(OPTICAL_TRANSPLANT_PROVENANCE).toEqual({
      repository: "https://github.com/samasante/liquid-glass",
      commit: "4e7b769e1df7e5a7d3669fef22417fe3d2f79ade",
      license: "MIT",
      scope: "spherical-cap displacement and inward meniscus math",
    });
    const first = computeOpticalDomeConstants(17.6, 159.25, 31.25);
    const second = computeOpticalDomeConstants(17.6, 159.25, 31.25);
    expect(second).toEqual(first);
    expect(first.radiusX).toBeCloseTo(729.27, 1);
    expect(first.radiusY).toBeCloseTo(36.54, 1);
    expect(first.scaleX).toBeGreaterThan(4);
    expect(first.scaleY).toBeGreaterThan(0.7);
  });

  it("composites separate maps as one body without the rejected cyan wash", () => {
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("u_track_map");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("u_selection_map");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("u_owned_decoration");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("directional_rim");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("directional_occlusion");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("decoration.a * selection_map.b");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("absorption");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("0.48, 0.82, 0.95");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("blur");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("/backgrounds/");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("u_background");
  });

  it("keeps every pixel outside both optical surfaces transparent", () => {
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain(
      "out_map = vec4(0.5, 0.5, 0.0, 0.0)",
    );
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain(
      "track_map.a <= 0.001",
    );
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("out_color = vec4(0.0)");
  });
});
