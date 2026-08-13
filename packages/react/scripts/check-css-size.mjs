import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const budget = 6 * 1024;
const css = await readFile(new URL("../dist/styles.css", import.meta.url));
const gzipBytes = gzipSync(css).byteLength;

if (gzipBytes > budget) {
  throw new Error(
    `@glazelab/react CSS is ${gzipBytes} bytes gzip; budget is ${budget} bytes.`,
  );
}

console.log(`@glazelab/react CSS: ${gzipBytes} bytes gzip / ${budget} byte budget`);
