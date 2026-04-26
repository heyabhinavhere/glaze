/**
 * @glazelab/core/full — superset entry.
 *
 * Re-exports everything from the default entry, plus the Mode C DOM
 * rasterizer and its Worker. Use this entry when your panels need to
 * refract a backdrop that's neither a static image (Mode A) nor a live
 * element (Mode B) — e.g., a scrolling article behind a fixed glass nav.
 *
 * This file is intentionally minimal — sub-task 1 of Week 2 establishes
 * the package skeleton. Real Mode C exports land in sub-task 6.
 */

export * from "./index";

export const __fullVersion = "0.0.0-scaffold";
