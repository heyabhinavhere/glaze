import { defineConfig, type Options } from "tsup";

const shared: Options = {
  sourcemap: true,
  treeshake: false,
  minify: true,
  target: "es2022",
  external: ["react", "react-dom"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.tsx" },
    format: ["esm"],
    splitting: true,
    dts: true,
    clean: true,
  },
  {
    ...shared,
    entry: { index: "src/index.tsx" },
    format: ["cjs"],
    splitting: false,
    dts: true,
    clean: false,
  },
  {
    ...shared,
    entry: { material: "src/material.ts" },
    format: ["esm", "cjs"],
    splitting: false,
    dts: true,
    clean: false,
  },
]);
