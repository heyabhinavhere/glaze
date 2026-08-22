import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER as acceptedComposite,
  OPTICAL_MAP_CONTRACT as acceptedContract,
  OPTICAL_MAP_FRAGMENT_SHADER as acceptedMap,
  OPTICAL_VERTEX_SHADER as acceptedVertex,
} from "../apps/playground/app/optical-kernel/_lib/optical-map";
import {
  OPTICAL_COMPOSITE_FRAGMENT_SHADER as proofComposite,
  OPTICAL_MAP_CONTRACT as proofContract,
  OPTICAL_MAP_FRAGMENT_SHADER as proofMap,
  OPTICAL_VERTEX_SHADER as proofVertex,
} from "../apps/playground/app/component-proof/_lib/optical-map";
import { SOURCE_MAX_DPR } from "../apps/playground/app/component-proof/_lib/source-contract";

function normalizeVariableGeometry(shader: string): string {
  return shader
    .replace("uniform float u_selection_count;\n", "")
    .replaceAll("/ max(u_selection_count, 1.0);", "/ 3.0;")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeWhitespace = (source: string) => source.replace(/\s+/g, " ").trim();

describe("component-system optical freeze", () => {
  it("changes only selection-count geometry in the accepted shaders", () => {
    expect(proofVertex).toBe(acceptedVertex);
    expect(normalizeVariableGeometry(proofMap)).toBe(
      normalizeWhitespace(acceptedMap),
    );
    expect(normalizeVariableGeometry(proofComposite)).toBe(
      normalizeWhitespace(acceptedComposite),
    );
  });

  it("preserves the accepted displacement-map material contract", () => {
    expect(proofContract).toMatchObject(acceptedContract);
    expect(proofContract).toMatchObject({
      geometry: "registered-capsule-with-uniform-selection-count",
      maxDisplacementPx: 36,
      surfaces: ["track", "selection"],
    });
    expect(SOURCE_MAX_DPR).toBe(2);
  });

  it("copies the accepted material-decoration pixels without retuning", () => {
    const acceptedRenderer = readFileSync(
      resolve(
        "apps/playground/app/optical-kernel/_lib/optical-kernel-renderer.ts",
      ),
      "utf8",
    );
    const proofSource = readFileSync(
      resolve("apps/playground/app/component-proof/_lib/source-contract.ts"),
      "utf8",
    );
    const acceptedBody = acceptedRenderer
      .split("export function drawOwnedDecoration")[1]
      .split("export function drawOpticalSource")[0]
      .replace(/^[\s\S]*?const width/, "const width")
      .replace("owned-decoration-context-unavailable", "decoration-context")
      .trim();
    const proofBody = proofSource
      .split("export function drawAcceptedMaterialDecoration")[1]
      .replace(/^[\s\S]*?const width/, "const width")
      .replace("material-decoration-context-unavailable", "decoration-context")
      .trim();
    expect(normalizeWhitespace(proofBody)).toBe(
      normalizeWhitespace(acceptedBody),
    );
  });
});
