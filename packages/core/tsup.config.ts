import { defineConfig } from "tsup";

/**
 * Two entries:
 *   - index   — Mode A (static image) + Mode B (live element) + auto-detection
 *               without Mode C. Target: ~15KB gzipped.
 *   - full    — adds Mode C (DOM rasterization with Worker). Target: ~22KB.
 *
 * Both produce ESM + CJS + .d.ts. Tree-shakeable (sideEffects: false in
 * package.json). The Worker is bundled inline via tsup's Web Worker support.
 *
 * external: html2canvas — lazy-loaded by the Mode C rasterizer via
 * `await import("html2canvas")`. Marking it external keeps it out of
 * /full's bundle entirely; the consumer's bundler resolves it at
 * runtime, and users who never invoke Mode C never load the ~50KB
 * library at all.
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
  external: ["html2canvas"],
});
