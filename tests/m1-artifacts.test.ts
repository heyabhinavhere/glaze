import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { expect, test } from "vitest";
import {
  generateM1DisplacementMap,
  readDisplacementProbe,
} from "../apps/playground/app/m1/_lib/displacement";
import { transportMaterial } from "../apps/playground/app/m1/_lib/material";

test("writes the reviewed M1 deterministic-map artifacts", () => {
  const outputDirectory = resolve(
    ".gstack/evidence/gate-1/result/determinism",
  );
  mkdirSync(outputDirectory, { recursive: true });

  const map = generateM1DisplacementMap({
    cssWidth: 240,
    cssHeight: 56,
    dpr: 2,
    material: transportMaterial,
  });
  const hash = createHash("sha256").update(map.pixels).digest("hex");
  const png = new PNG({ width: map.width, height: map.height });
  png.data = Buffer.from(map.pixels);
  const encoded = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  const pngHash = createHash("sha256").update(encoded).digest("hex");

  writeFileSync(resolve(outputDirectory, "displacement-map.png"), encoded);
  writeFileSync(
    resolve(outputDirectory, "displacement-map.sha256"),
    `${pngHash}  displacement-map.png\n`,
  );
  const probes = {
    center: readDisplacementProbe(map, 120, 28),
    left: readDisplacementProbe(map, 7, 28),
    right: readDisplacementProbe(map, 233, 28),
    top: readDisplacementProbe(map, 120, 7),
    bottom: readDisplacementProbe(map, 120, 49),
  };
  writeFileSync(
    resolve(outputDirectory, "pixel-probes.json"),
    `${JSON.stringify(probes, null, 2)}\n`,
  );
  writeFileSync(
    resolve(outputDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        material: transportMaterial,
        map: {
          cssWidth: map.cssWidth,
          cssHeight: map.cssHeight,
          dpr: map.dpr,
          width: map.width,
          height: map.height,
          rawPixelSha256: hash,
          pngSha256: pngHash,
        },
        probes,
      },
      null,
      2,
    )}\n`,
  );

  const snapshotsDirectory = resolve("tests/m1.spec.ts-snapshots");
  const screenshotsDirectory = resolve(
    ".gstack/evidence/gate-1/result/screenshots",
  );
  mkdirSync(screenshotsDirectory, { recursive: true });
  const screenshots = readdirSync(snapshotsDirectory)
    .filter((filename) => filename.endsWith(".png"))
    .sort()
    .map((filename) => {
      const source = resolve(snapshotsDirectory, filename);
      const destination = resolve(screenshotsDirectory, filename);
      copyFileSync(source, destination);
      return {
        filename,
        sha256: createHash("sha256")
          .update(readFileSync(destination))
          .digest("hex"),
      };
    });
  writeFileSync(
    resolve(screenshotsDirectory, "manifest.json"),
    `${JSON.stringify({ screenshots }, null, 2)}\n`,
  );

  const playwrightOutput = resolve(
    ".gstack/evidence/gate-1/playwright-output",
  );
  const tracesDirectory = resolve(".gstack/evidence/gate-1/result/traces");
  mkdirSync(tracesDirectory, { recursive: true });
  let traces = readdirSync(playwrightOutput, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(
          "m1--performance-static-and-paused-sources-become-idle-",
        ),
    )
    .map((entry) => {
      const project = entry.name.split("-").at(-1) ?? "unknown";
      const source = resolve(playwrightOutput, entry.name, "trace.zip");
      if (!existsSync(source)) throw new Error(`Missing trace: ${source}`);
      const filename = `${project}-performance-trace.zip`;
      const destination = resolve(tracesDirectory, filename);
      copyFileSync(source, destination);
      return {
        filename,
        sha256: createHash("sha256")
          .update(readFileSync(destination))
          .digest("hex"),
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
  if (traces.length === 0) {
    traces = readdirSync(tracesDirectory)
      .filter((filename) => filename.endsWith("-performance-trace.zip"))
      .sort()
      .map((filename) => ({
        filename,
        sha256: createHash("sha256")
          .update(readFileSync(resolve(tracesDirectory, filename)))
          .digest("hex"),
      }));
  }
  writeFileSync(
    resolve(tracesDirectory, "manifest.json"),
    `${JSON.stringify({ traces }, null, 2)}\n`,
  );

  expect(encoded.byteLength).toBeGreaterThan(1_000);
  expect(screenshots).toHaveLength(27);
  expect(traces).toHaveLength(3);
});
