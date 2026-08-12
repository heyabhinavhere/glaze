import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { PNG } from "pngjs";
import { expect, test } from "vitest";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";
import {
  M1_WEBGL_FRAGMENT_SHADER,
  M1_WEBGL_SURFACE_FIELD_CONTRACT,
} from "../apps/playground/app/m1/_lib/webgl-renderer";

const evidenceRoot = resolve(
  ".gstack/evidence/gate-2/m2-explicit-video-nextjs",
);
const baselineHash =
  "a17ae5693a4c2bd92dafbabe405ba7a709a7b538e192dbdb08519858c3a49e09";
const shaderHash =
  "8128a135a4d85d46f6854909cb98c6984cb47aaeda8b309c93c3d32b5a85d251";

function filesBelow(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
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

function combinedSnapshotHash(paths: readonly string[]): string {
  const listing = paths
    .map((path) => `${sha256(path)}  ${relative(resolve("."), path)}\n`)
    .join("");
  return createHash("sha256").update(listing).digest("hex");
}

function writeReferenceComparison(): string {
  const acceptedPath = resolve(
    ".gstack/evidence/gate-1/m1.1-stage-a-revision-1/fixed-crops/production/chromium/video-rest.png",
  );
  const integrationPath = resolve(
    evidenceRoot,
    "fixed-crops/production/chromium/rest.png",
  );
  const accepted = PNG.sync.read(readFileSync(acceptedPath));
  const integration = PNG.sync.read(readFileSync(integrationPath));
  const gap = 8;
  const comparison = new PNG({
    width: accepted.width + gap + integration.width,
    height: Math.max(accepted.height, integration.height),
  });
  comparison.data.fill(18);
  PNG.bitblt(
    accepted,
    comparison,
    0,
    0,
    accepted.width,
    accepted.height,
    0,
    Math.floor((comparison.height - accepted.height) / 2),
  );
  PNG.bitblt(
    integration,
    comparison,
    0,
    0,
    integration.width,
    integration.height,
    accepted.width + gap,
    Math.floor((comparison.height - integration.height) / 2),
  );
  const comparisonDirectory = resolve(evidenceRoot, "comparisons");
  mkdirSync(comparisonDirectory, { recursive: true });
  const outputPath = resolve(
    comparisonDirectory,
    "accepted-stage-a-vs-m2-video.png",
  );
  writeFileSync(outputPath, PNG.sync.write(comparison));
  writeFileSync(
    resolve(comparisonDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        left: relative(resolve("."), acceptedPath),
        right: relative(resolve("."), integrationPath),
        claim:
          "Human material-coherence comparison only; crop context differs and pixel identity is not claimed.",
      },
      null,
      2,
    )}\n`,
  );
  return outputPath;
}

test("validates and manifests the isolated M2 explicit-video evidence", () => {
  const baselineSnapshots = filesBelow(
    resolve("tests/m1.spec.ts-snapshots"),
  ).filter((path) => path.endsWith(".png"));
  const fixedCrops = filesBelow(resolve(evidenceRoot, "fixed-crops")).filter(
    (path) => path.endsWith(".png"),
  );
  const metrics = filesBelow(resolve(evidenceRoot, "metrics")).filter((path) =>
    path.endsWith(".json"),
  );
  const reports = ["development", "production"].map((environment) =>
    resolve(evidenceRoot, "reports", `${environment}.json`),
  );

  expect(baselineSnapshots).toHaveLength(27);
  expect(combinedSnapshotHash(baselineSnapshots)).toBe(baselineHash);
  expect(fixedCrops).toHaveLength(16);
  expect(metrics).toHaveLength(6);
  for (const report of reports) expect(existsSync(report)).toBe(true);

  const sourceFixtures = [
    {
      path: resolve("apps/playground/public/m1-flower.webm"),
      sha256:
        "c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda",
    },
    {
      path: resolve("apps/playground/public/m1-flower.mp4"),
      sha256:
        "0cd83d944a6ca7822b4a8306cecc60a36e859b041f6702c6a1ad9ead78924451",
    },
  ];
  for (const fixture of sourceFixtures) expect(sha256(fixture.path)).toBe(fixture.sha256);

  expect(
    createHash("sha256").update(M1_WEBGL_FRAGMENT_SHADER).digest("hex"),
  ).toBe(shaderHash);
  expect(M1_WEBGL_SURFACE_FIELD_CONTRACT.id).toBe(
    "m1.1-continuous-capsule-lighting-r1",
  );
  expect(transportMaterial.id).toBe("m1-transport-controls");

  const runtimePaths = [
    "apps/playground/app/m2/video/page.tsx",
    "apps/playground/app/m2/video/_components/ExplicitVideoGlass.tsx",
    "apps/playground/app/m2/video/_lib/source-contract.ts",
  ];
  const runtime = runtimePaths
    .map((path) => readFileSync(resolve(path), "utf8"))
    .join("\n");
  expect(runtime).not.toMatch(/html2canvas|foreignObject|captureStream\(|getDisplayMedia\(|drawImage\(/);
  expect(runtime).not.toMatch(/sourceKind:\s*["'](?:image|canvas)["']/);
  expect(runtime.match(/sourceKind:\s*["']video["']/g)).toHaveLength(3);
  expect(runtime).not.toMatch(/backdrop-filter|backdropFilter/);

  const comparisonPath = writeReferenceComparison();
  const integrityDirectory = resolve(evidenceRoot, "integrity");
  mkdirSync(integrityDirectory, { recursive: true });
  writeFileSync(
    resolve(integrityDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        branch: "aj/glaze-m2-explicit-video-nextjs",
        startingCommit: "d5a96731971a828ebddd26325a1667405d4a06e6",
        capability: "explicit-video-webgl",
        route: "/m2/video",
        fieldContract: M1_WEBGL_SURFACE_FIELD_CONTRACT.id,
        materialId: transportMaterial.id,
        shaderSha256: shaderHash,
        baselineSnapshots: {
          count: baselineSnapshots.length,
          combinedSortedSha256Listing: baselineHash,
        },
        sourceFixtures: sourceFixtures.map((fixture) => ({
          path: relative(resolve("."), fixture.path),
          sha256: fixture.sha256,
          provenance: "Research-only; source and license provenance unresolved.",
        })),
        evidence: {
          fixedCrops: fixedCrops.length,
          metrics: metrics.length,
          playwrightReports: reports.map((path) => relative(evidenceRoot, path)),
          comparison: relative(evidenceRoot, comparisonPath),
        },
        prohibitedRuntimeScan: "pass",
      },
      null,
      2,
    )}\n`,
  );

  const evidenceFiles = filesBelow(evidenceRoot).filter(
    (path) => !path.endsWith("artifact-manifest.json"),
  );
  writeFileSync(
    resolve(evidenceRoot, "artifact-manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: evidenceFiles.map((path) => ({
          path: relative(evidenceRoot, path),
          bytes: statSync(path).size,
          sha256: sha256(path),
        })),
      },
      null,
      2,
    )}\n`,
  );
});
