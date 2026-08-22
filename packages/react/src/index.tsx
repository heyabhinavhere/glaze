"use client";

export {
  defaultGlazeMaterial,
  defaultGlazeMotion,
  glazeMaterialPresets,
  resolveGlazeMaterial,
  resolveGlazeMotion,
} from "./material";
export { GlazeRoot, useGlazeMaterial } from "./internal/context";
export { GlazeMediaSurface, GlazeRefractSource } from "./surfaces";
export {
  GlazeSegmentedControl,
  GlazeSlider,
  GlazeSwitch,
} from "./controls";
export { GlazeWorkbench } from "./workbench";
export { GlazeDiagnostics } from "./diagnostics";

export type {
  GlazeCanvasDrawSize,
  GlazeCanvasSource,
  GlazeCapability,
  GlazeCapabilityResult,
  GlazeDiagnosticsProps,
  GlazeImageSource,
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMaterialRegistry,
  GlazeMediaSource,
  GlazeMediaSurfaceProps,
  GlazeMotion,
  GlazeRefractSourceProps,
  GlazeRendererDiagnostics,
  GlazeRootProps,
  GlazeSegment,
  GlazeSegmentedControlProps,
  GlazeSliderProps,
  GlazeSwitchProps,
  GlazeVideoSource,
  GlazeVideoSourceItem,
  GlazeWorkbenchProps,
} from "./types";
