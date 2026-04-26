import { defineConfig } from "tsup";

/**
 * Two entries:
 *   - index   — Mode A (static image) + Mode B (live element) + auto-detection
 *               without Mode C. Target: ~15KB gzipped.
 *   - full    — adds Mode C (DOM rasterization with Worker). Target: ~22KB.
 *
 * Both produce ESM + CJS + .d.ts. Tree-shakeable (sideEffects: false in
 * package.json). The Worker is bundled inline via tsup's Web Worker support.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    full: "src/full.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false, // unminified for readable bundle-size diffs in dev; CI runs minify check
  target: "es2022",
  // Workers: tsup supports new Worker(new URL("./worker.ts", import.meta.url)).
  // We'll wire the worker at the rasterizer module level.
});
