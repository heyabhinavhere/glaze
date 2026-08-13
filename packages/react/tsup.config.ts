import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: false,
  minify: true,
  target: "es2022",
  external: ["react", "react-dom"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.tsx" },
    clean: true,
  },
  {
    ...shared,
    entry: { material: "src/material.ts" },
    clean: false,
  },
]);
