import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { PNG } from "pngjs";
import { expect, test } from "vitest";
import {
  generateM1DisplacementMap,
  measureDisplacementContinuity,
  readDisplacementProbe,
} from "../apps/playground/app/m1/_lib/displacement";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";
import {
  M1_WEBGL_REFRACTION_MAX_SCALE,
  M1_WEBGL_REFRACTION_REST_SCALE,
  M1_WEBGL_SURFACE_FIELD_CONTRACT,
} from "../apps/playground/app/m1/_lib/webgl-renderer";

const evidenceRoot = resolve(
  ".gstack/evidence/gate-1/m1.1-stage-a-revision-1",
);

function filesBelow(directory: string): string[] {
  if (!statSync(directory).isDirectory()) return [];
  return readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory() ? filesBelow(path) : [path];
    })
    .sort();
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function cropMaterialContext(source: PNG, width: number, height: number): PNG {
  const cropWidth = Math.round(source.width * (336 / 934));
  const cropHeight = Math.round(source.height * (120 / 525));
  const cropX = Math.round(source.width / 2 - cropWidth / 2);
  const cropY = Math.round(source.height * 0.58 - cropHeight / 2);
  const output = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      source.height - 1,
      cropY + Math.floor((y / height) * cropHeight),
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        cropX + Math.floor((x / width) * cropWidth),
      );
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      output.data[outputOffset] = source.data[sourceOffset] ?? 0;
      output.data[outputOffset + 1] = source.data[sourceOffset + 1] ?? 0;
      output.data[outputOffset + 2] = source.data[sourceOffset + 2] ?? 0;
      output.data[outputOffset + 3] = source.data[sourceOffset + 3] ?? 255;
    }
  }
  return output;
}

function writeComparison(input: {
  readonly checkpointPath: string;
  readonly rejectedPath: string;
  readonly revisionPath: string;
  readonly outputPath: string;
}): void {
  const revision = PNG.sync.read(readFileSync(input.revisionPath));
  const checkpoint = cropMaterialContext(
    PNG.sync.read(readFileSync(input.checkpointPath)),
    revision.width,
    revision.height,
  );
  const rejected = cropMaterialContext(
    PNG.sync.read(readFileSync(input.rejectedPath)),
    revision.width,
    revision.height,
  );
  const gap = 8;
  const comparison = new PNG({
    width: revision.width * 3 + gap * 2,
    height: revision.height,
  });
  comparison.data.fill(18);
  PNG.bitblt(checkpoint, comparison, 0, 0, revision.width, revision.height, 0, 0);
  PNG.bitblt(
    rejected,
    comparison,
    0,
    0,
    revision.width,
    revision.height,
    revision.width + gap,
    0,
  );
  PNG.bitblt(
    revision,
    comparison,
    0,
    0,
    revision.width,
    revision.height,
    (revision.width + gap) * 2,
    0,
  );
  writeFileSync(input.outputPath, PNG.sync.write(comparison));
}

test("writes the isolated M1.1 Stage A revision manifest", () => {
  const determinismDirectory = resolve(evidenceRoot, "determinism");
  mkdirSync(determinismDirectory, { recursive: true });
  const map = generateM1DisplacementMap({
    cssWidth: 240,
    cssHeight: 56,
    dpr: 2,
    material: transportMaterial,
  });
  const png = new PNG({ width: map.width, height: map.height });
  png.data = Buffer.from(map.pixels);
  const encoded = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  const mapPath = resolve(determinismDirectory, "surface-field.png");
  writeFileSync(mapPath, encoded);

  const probes = {
    outside: readDisplacementProbe(map, 0, 0),
    center: readDisplacementProbe(map, 120, 28),
    leftSlope: readDisplacementProbe(map, 8, 28),
    rightSlope: readDisplacementProbe(map, 232, 28),
    topSlope: readDisplacementProbe(map, 120, 8),
    bottomSlope: readDisplacementProbe(map, 120, 48),
  };
  const continuity = {
    rest: measureDisplacementContinuity(
      map,
      transportMaterial.optics.displacementPx * M1_WEBGL_REFRACTION_REST_SCALE,
    ),
    maximumInteraction: measureDisplacementContinuity(
      map,
      transportMaterial.optics.displacementPx * M1_WEBGL_REFRACTION_MAX_SCALE,
    ),
  };
  writeFileSync(
    resolve(determinismDirectory, "surface-field-probes.json"),
    `${JSON.stringify(probes, null, 2)}\n`,
  );

  const comparisonDirectory = resolve(evidenceRoot, "comparisons");
  mkdirSync(comparisonDirectory, { recursive: true });
  const sceneFiles = {
    prism: "canvas-chromium-darwin.png",
    contours: "canvas-topography-chromium-darwin.png",
    nocturne: "canvas-nocturne-chromium-darwin.png",
    video: "video-chromium-darwin.png",
  } as const;
  for (const [scene, checkpointFile] of Object.entries(sceneFiles)) {
    writeComparison({
      checkpointPath: resolve(
        ".gstack/evidence/gate-1/result/screenshots",
        checkpointFile,
      ),
      rejectedPath: resolve(
        ".gstack/evidence/gate-1/m1.1-stage-a-candidate/screenshots/development/chromium",
        `${scene}-rest.png`,
      ),
      revisionPath: resolve(
        evidenceRoot,
        "fixed-crops/development/chromium",
        `${scene}-rest.png`,
      ),
      outputPath: resolve(comparisonDirectory, `${scene}-rest.png`),
    });
  }
  writeFileSync(
    resolve(comparisonDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        leftToRight: ["checkpoint", "rejected Stage A candidate", "revision 1"],
        crop: "336x120 CSS pixels centered on the 240x56 material; checkpoint normalized to DPR 2",
        scenes: Object.keys(sceneFiles),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    resolve(determinismDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        material: transportMaterial,
        surfaceFieldContract: M1_WEBGL_SURFACE_FIELD_CONTRACT,
        map: {
          cssWidth: map.cssWidth,
          cssHeight: map.cssHeight,
          dpr: map.dpr,
          width: map.width,
          height: map.height,
          rawPixelSha256: createHash("sha256")
            .update(map.pixels)
            .digest("hex"),
          pngSha256: createHash("sha256").update(encoded).digest("hex"),
        },
        probes,
        continuity,
      },
      null,
      2,
    )}\n`,
  );

  const baselineSnapshots = filesBelow(resolve("tests/m1.spec.ts-snapshots"));
  const revisionFiles = filesBelow(evidenceRoot).filter(
    (path) => !path.endsWith("artifact-manifest.json"),
  );
  const manifest = {
    checkpointCommit: "469171ab7ff3a55ecc9122b2e34e05423a7c8898",
    revisionRoot: evidenceRoot,
    acceptedBaselineSnapshots: baselineSnapshots.map((path) => ({
      path: relative(resolve("."), path),
      sha256: sha256(path),
    })),
    revisionArtifacts: revisionFiles.map((path) => ({
      path: relative(evidenceRoot, path),
      bytes: statSync(path).size,
      sha256: sha256(path),
    })),
  };
  writeFileSync(
    resolve(evidenceRoot, "artifact-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  expect(baselineSnapshots).toHaveLength(27);
  expect(continuity.rest.foldovers).toBe(0);
  expect(continuity.maximumInteraction.foldovers).toBe(0);
  expect(
    revisionFiles.filter(
      (path) => path.includes("/fixed-crops/") && path.endsWith(".png"),
    ),
  ).toHaveLength(40);
  expect(
    revisionFiles.filter(
      (path) => path.includes("/comparisons/") && path.endsWith(".png"),
    ),
  ).toHaveLength(4);
  expect(
    revisionFiles.filter((path) => path.includes("/measurements/") && path.endsWith(".json")),
  ).toHaveLength(6);
  expect(
    revisionFiles.filter((path) => path.includes("/metrics/") && path.endsWith(".json")),
  ).toHaveLength(6);
  expect(encoded.byteLength).toBeGreaterThan(1_000);
});
