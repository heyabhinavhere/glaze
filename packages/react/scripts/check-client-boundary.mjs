import { readFile } from "node:fs/promises";

const entrypoints = ["index.js", "index.cjs"];

for (const entrypoint of entrypoints) {
  const contents = await readFile(
    new URL(`../dist/${entrypoint}`, import.meta.url),
    "utf8",
  );
  if (!/^(?:["']use strict["'];)?["']use client["'];/.test(contents)) {
    throw new Error(`${entrypoint} is missing its emitted client boundary.`);
  }
}

const material = await readFile(
  new URL("../dist/material.js", import.meta.url),
  "utf8",
);
if (material.startsWith('"use client";')) {
  throw new Error("The pure material subpath must remain server-safe.");
}

console.log("@glazelab/react client and server-safe boundaries verified");
