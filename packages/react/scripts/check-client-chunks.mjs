import { readdir, readFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";

const directory = new URL("../dist/", import.meta.url);
const files = await readdir(directory);
const brotliBytes = async (name) => brotliCompressSync(
  await readFile(new URL(name, directory)),
).byteLength;
const matching = (pattern) => files.filter((name) => pattern.test(name));

const baseFiles = ["index.js", ...matching(/^chunk-[A-Z0-9]+\.js$/)];
const rendererFiles = matching(/^renderer-[A-Z0-9]+\.js$/);
const workbenchFiles = matching(/^workbench-panel-[A-Z0-9]+\.js$/);

if (rendererFiles.length !== 1 || workbenchFiles.length !== 1) {
  throw new Error(
    "Expected exactly one lazy optics chunk and one lazy workbench chunk.",
  );
}

const index = await readFile(new URL("index.js", directory), "utf8");
if (!/import\(["']\.\/renderer-/.test(index)) {
  throw new Error("The WebGL renderer is not a lazy ESM chunk.");
}
if (!/import\(["']\.\/workbench-panel-/.test(index)) {
  throw new Error("The workbench panel is not a lazy ESM chunk.");
}

const baseBytes = (await Promise.all(baseFiles.map(brotliBytes)))
  .reduce((total, bytes) => total + bytes, 0);
const rendererBytes = await brotliBytes(rendererFiles[0]);
const workbenchBytes = await brotliBytes(workbenchFiles[0]);

const baseBudget = 8 * 1024;
const acceptedRendererMeasurement = 6078;
const rendererBudget = Math.ceil(acceptedRendererMeasurement * 1.1);
const workbenchBudget = 2 * 1024;

if (baseBytes > baseBudget) {
  throw new Error(
    `@glazelab/react base is ${baseBytes} bytes brotli; budget is ${baseBudget}.`,
  );
}
if (rendererBytes > rendererBudget) {
  throw new Error(
    `Glaze optics is ${rendererBytes} bytes brotli; accepted +10% budget is ${rendererBudget}.`,
  );
}
if (workbenchBytes > workbenchBudget) {
  throw new Error(
    `Glaze workbench is ${workbenchBytes} bytes brotli; budget is ${workbenchBudget}.`,
  );
}

console.log(
  `@glazelab/react base: ${baseBytes}/${baseBudget} bytes brotli`,
);
console.log(
  `Glaze optics: ${rendererBytes}/${rendererBudget} bytes brotli (accepted ${acceptedRendererMeasurement})`,
);
console.log(
  `Glaze workbench: ${workbenchBytes}/${workbenchBudget} bytes brotli`,
);
