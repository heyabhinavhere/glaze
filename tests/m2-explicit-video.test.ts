import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";
import {
  M1_WEBGL_FRAGMENT_SHADER,
  M1_WEBGL_SURFACE_FIELD_CONTRACT,
} from "../apps/playground/app/m1/_lib/webgl-renderer";
import {
  formatMediaTime,
  resolveExplicitVideoContract,
  type ExplicitVideoMetadata,
} from "../apps/playground/app/m2/video/_lib/source-contract";

const localSource: ExplicitVideoMetadata = {
  id: "test-video",
  label: "Test video",
  provenance: "Research only",
  sources: [
    { src: "/m1-flower.webm", type: "video/webm" },
    { src: "/m1-flower.mp4", type: "video/mp4" },
  ],
};

describe("M2 explicit-video integration contract", () => {
  it("resolves only explicit same-origin video URLs", () => {
    expect(
      resolveExplicitVideoContract(localSource, "http://127.0.0.1:3173"),
    ).toEqual({
      sourceId: "test-video",
      urls: [
        "http://127.0.0.1:3173/m1-flower.webm",
        "http://127.0.0.1:3173/m1-flower.mp4",
      ],
      sameOrigin: true,
      failureReason: null,
    });

    expect(
      resolveExplicitVideoContract(
        { ...localSource, sources: [{ src: "https://media.example/video.mp4", type: "video/mp4" }] },
        "http://127.0.0.1:3173",
      ),
    ).toMatchObject({
      sameOrigin: false,
      failureReason: "source-not-origin-clean",
    });
  });

  it("rejects a missing explicit source", () => {
    expect(
      resolveExplicitVideoContract(
        { ...localSource, sources: [] },
        "http://127.0.0.1:3173",
      ),
    ).toEqual({
      sourceId: "test-video",
      urls: [],
      sameOrigin: false,
      failureReason: "source-missing",
    });
  });

  it("formats finite media time without client-only state", () => {
    expect(formatMediaTime(0)).toBe("0:00");
    expect(formatMediaTime(65.9)).toBe("1:05");
    expect(formatMediaTime(Number.NaN)).toBe("0:00");
    expect(formatMediaTime(-4)).toBe("0:00");
  });

  it("locks the accepted private material and shader contract", () => {
    expect(transportMaterial).toEqual({
      schemaVersion: 1,
      id: "m1-transport-controls",
      geometry: { cornerRadiusPx: 28, bevelWidthPx: 14 },
      optics: { displacementPx: 8, frostPx: 1.5, chromaPx: 0.35 },
      surface: {
        tint: [0.91, 0.96, 1],
        tintOpacity: 0.075,
        rimIntensity: 0.58,
        lightAngleDeg: 315,
      },
    });
    expect(M1_WEBGL_SURFACE_FIELD_CONTRACT.id).toBe(
      "m1.1-continuous-capsule-lighting-r1",
    );
    expect(
      createHash("sha256").update(M1_WEBGL_FRAGMENT_SHADER).digest("hex"),
    ).toBe("8128a135a4d85d46f6854909cb98c6984cb47aaeda8b309c93c3d32b5a85d251");
  });

  it("contains no DOM-capture or renderer auto-detection implementation", () => {
    const runtime = [
      "apps/playground/app/m2/video/page.tsx",
      "apps/playground/app/m2/video/_components/ExplicitVideoGlass.tsx",
      "apps/playground/app/m2/video/_lib/source-contract.ts",
    ]
      .map((path) => readFileSync(resolve(path), "utf8"))
      .join("\n");

    expect(runtime).not.toMatch(/from\s+["']html2canvas|import\(["']html2canvas/);
    expect(runtime).not.toMatch(/backdropFrom\s*[:=]/);
    expect(runtime).not.toMatch(/foreignObject|captureStream\(|getDisplayMedia\(|drawImage\(/);
    expect(runtime).not.toMatch(/HTMLImageElement|sourceKind:\s*["']canvas["']/);
  });
});
