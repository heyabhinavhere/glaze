import { describe, expect, it } from "vitest";
import {
  OPTICAL_KERNEL_BACKGROUNDS,
  OPTICAL_KERNEL_CONTRACT,
  OPTICAL_KERNEL_OPTIONS,
} from "../apps/playground/app/optical-kernel/_lib/optical-kernel-renderer";
import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER,
  OPTICAL_MAP_CONTRACT,
  OPTICAL_MAP_FRAGMENT_SHADER,
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
      mapId: "glaze-optical-map-r2",
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
      id: "glaze-optical-map-r2",
      channels: {
        red: "horizontal-displacement",
        green: "vertical-displacement",
        blue: "thickness",
        alpha: "coverage",
      },
      maxDisplacementPx: 24,
      surfaces: ["track", "selection"],
    });
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("out_map");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("u_surface");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("surface_height");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("thickness_scale");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain("encoded_displacement");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).not.toContain("smooth_min");
    expect(OPTICAL_MAP_FRAGMENT_SHADER).not.toContain("lobe");
  });

  it("composites separate track and selection maps without a gray wash", () => {
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("u_track_map");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("u_selection_map");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("directional_rim");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("directional_occlusion");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("absorption");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("material * coverage");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("adaptive_volume");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("blur");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("/backgrounds/");
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).not.toContain("u_background");
  });

  it("keeps every pixel outside both optical surfaces transparent", () => {
    expect(OPTICAL_MAP_FRAGMENT_SHADER).toContain(
      "out_map = vec4(0.5, 0.5, 0.0, 0.0)",
    );
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain(
      "track_map.a <= 0.001 && selection_map.a <= 0.001",
    );
    expect(OPTICAL_COMPOSITE_FRAGMENT_SHADER).toContain("out_color = vec4(0.0)");
  });
});
