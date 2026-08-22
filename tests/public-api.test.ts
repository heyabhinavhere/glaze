import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER as proofComposite,
  OPTICAL_MAP_CONTRACT as proofContract,
  OPTICAL_MAP_FRAGMENT_SHADER as proofMap,
  OPTICAL_VERTEX_SHADER as proofVertex,
} from "../apps/playground/app/component-proof/_lib/optical-map";
import { defaultGlazeMaterial } from "../packages/react/src/material";
import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER as publicComposite,
  OPTICAL_MAP_CONTRACT as publicContract,
  OPTICAL_MAP_FRAGMENT_SHADER as publicMap,
  OPTICAL_VERTEX_SHADER as publicVertex,
} from "../packages/react/src/optics/optical-map";

const normalizeWhitespace = (source: string) => source.replace(/\s+/g, "");

function restoreMapDefault(shader: string) {
  return shader
    .replace("uniform float u_selection_visible;\n", "")
    .replace("  if (u_surface == 1) coverage *= u_selection_visible;\n", "");
}

function restoreCompositeDefaults(shader: string) {
  return shader
    .replace(
      /uniform float u_refraction;\nuniform float u_thickness;\nuniform float u_dispersion;\nuniform float u_roughness;\nuniform float u_transmission;\nuniform vec3 u_tint_color;\nuniform float u_tint_opacity;\nuniform float u_highlight;\nuniform float u_occlusion;\n/,
      "",
    )
    .replace(
      "vec3 surface_normal(sampler2D optical_map, vec2 uv, float thickness_scale)",
      "vec3 surface_normal(sampler2D optical_map, vec2 uv)",
    )
    .replace(" * 0.5 * thickness_scale;", " * 0.5;")
    .replace("decode_displacement(track_map) * u_refraction", "decode_displacement(track_map)")
    .replace("0.20 * u_dispersion", "0.20")
    .replace("surface_normal(u_track_map, v_uv, u_thickness)", "surface_normal(u_track_map, v_uv)")
    .replace("  float specular_power = max(4.0, 48.0 - u_roughness * 45.0);\n", "")
    .replace("    specular_power\n", "    30.0\n")
    .replaceAll(" * u_thickness", "")
    .replaceAll(" * u_refraction", "")
    .replaceAll(" * u_occlusion", "")
    .replaceAll(" * u_highlight", "")
    .replace("0.28 * u_dispersion", "0.28")
    .replace(
      /  float tint_weight = clamp\([\s\S]*?  material = mix\(material, u_tint_color, tint_weight\);\n/,
      "",
    )
    .replace("track_map.a * u_transmission", "track_map.a * 0.985");
}

describe("public optics freeze", () => {
  it("keeps the accepted shader at the public defaults", () => {
    expect(publicVertex).toBe(proofVertex);
    expect(normalizeWhitespace(restoreMapDefault(publicMap))).toBe(
      normalizeWhitespace(proofMap),
    );
    expect(normalizeWhitespace(restoreCompositeDefaults(publicComposite))).toBe(
      normalizeWhitespace(proofComposite),
    );
    expect(publicContract).toEqual(proofContract);
  });

  it("maps the accepted light vector and alpha exactly", () => {
    const radians = defaultGlazeMaterial.lighting.angle * Math.PI / 180;
    const normalizedLength = Math.hypot(-0.64, 0.77);
    expect(Math.cos(radians)).toBeCloseTo(-0.64 / normalizedLength, 12);
    expect(Math.sin(radians)).toBeCloseTo(0.77 / normalizedLength, 12);
    expect(defaultGlazeMaterial.roughness).toBe(0.4);
    expect(defaultGlazeMaterial.transmission).toBe(0.985);
    expect(defaultGlazeMaterial.tint.opacity).toBe(0);
  });

  it("copies the accepted material decoration without retuning", () => {
    const proofSource = readFileSync(
      resolve("apps/playground/app/component-proof/_lib/source-contract.ts"),
      "utf8",
    );
    const publicSource = readFileSync(
      resolve("packages/react/src/internal/source-contract.ts"),
      "utf8",
    );
    const extract = (source: string) => source
      .split("export function drawAcceptedMaterialDecoration")[1]
      .replace(/^[\s\S]*?const width/, "const width")
      .replace(/\n}\n[\s\S]*$/, "\n}")
      .trim();
    expect(normalizeWhitespace(extract(publicSource))).toBe(
      normalizeWhitespace(extract(proofSource)),
    );
  });
});
