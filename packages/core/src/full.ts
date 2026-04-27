/**
 * @glazelab/core/full — superset entry.
 *
 * Re-exports everything from the default entry, plus registers the
 * Mode C DOM rasterizer at module-import time. Importing this entry
 * is what makes `createGlass(target)` (with no backdrop prop) fall
 * through to Mode C when no media element / CSS background-image
 * matches an ancestor — the canonical "fixed glass over scrolling
 * DOM content" case.
 *
 * The registration is a side effect; package.json marks this entry
 * with sideEffects: ["./dist/full.*"] so bundlers don't tree-shake
 * the import call.
 *
 * Sub-task 6a: synchronous main-thread rasterizer with computed-style
 * inlining. Sub-task 6c moves the heavy parts into a Worker; 6d adds
 * capture-tall-once + windowed re-capture for tall scroll contexts.
 */

import { registerDOMRasterizer } from "./internal/mode-c";
import { rasterizeDOM } from "./full/dom-rasterize";

// Module side effect — fires once on first import of this entry.
registerDOMRasterizer(rasterizeDOM);

export * from "./index";

export const __fullVersion = "0.0.0-mode-c-6a";
