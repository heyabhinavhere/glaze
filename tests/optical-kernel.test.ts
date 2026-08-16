import { describe, expect, it } from "vitest";
import {
  OPTICAL_KERNEL_CONTRACT,
  OPTICAL_KERNEL_FRAGMENT_SHADER,
  OPTICAL_KERNEL_OPTIONS,
} from "../apps/playground/app/optical-kernel/_lib/optical-kernel-renderer";

describe("optical kernel contract", () => {
  it("keeps the proof at authored component scale", () => {
    expect(OPTICAL_KERNEL_CONTRACT).toMatchObject({
      width: 320,
      height: 64,
      inset: 4,
      segmentCount: 3,
      maxDpr: 2,
      renderer: "webgl2-sdf-refraction",
    });
    expect(OPTICAL_KERNEL_OPTIONS).toEqual(["Focus", "Flow", "Form"]);
  });

  it("implements renderer-native optical cues rather than blur finishing", () => {
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("rounded_box_sdf");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("height_gradient");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("displaced_uv");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("fresnel");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("specular");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("opposing");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("interior_splay");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("optical_scatter");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("contact_shadow");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("caustic_halo");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("elastic_active_distance");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).not.toContain("blur");
  });

  it("bounds renderer-native separation and leaves distant pixels transparent", () => {
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("if (material_mask <= 0.001 && halo_alpha <= 0.001)");
    expect(OPTICAL_KERNEL_FRAGMENT_SHADER).toContain("out_color = vec4(0.0)");
  });
});
