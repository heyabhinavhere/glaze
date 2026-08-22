# Glaze public API contract

Date frozen: 2026-08-22

Status: implemented and verified; release gates remain open

## Product boundary

Glaze gives semantic React controls liquid-glass optics over an explicitly
owned React decoration, image, video, or canvas. Arbitrary page capture,
automatic backdrop discovery, duplicated semantic trees, and CSS-as-refraction
are unsupported.

## Serializable contracts

```ts
type GlazeCapability =
  | "owned-decoration"
  | "explicit-media"
  | "css-fallback";

type GlazeCapabilityResult = {
  requested: GlazeCapability;
  effective: GlazeCapability;
  reason?: string;
};

type GlazeMaterial = {
  refraction: number;
  thickness: number;
  dispersion: number;
  roughness: number;
  transmission: number;
  tint: { color: string; opacity: number };
  lighting: { angle: number; highlight: number; occlusion: number };
};

type GlazeMotion = {
  stiffness: number;
  damping: number;
};
```

## React surface

- `GlazeRoot` owns named live materials, motion, and the source registry.
- `useGlazeMaterial(name, defaults)` reads the live serializable material.
- `GlazeRefractSource` declares one inert, `aria-hidden` owned SVG source.
- `GlazeMediaSurface` declares an explicit image, video, or canvas source.
- `GlazeSegmentedControl`, `GlazeSwitch`, and `GlazeSlider` register semantic
  controls with their nearest source renderer.
- `GlazeWorkbench` tunes, resets, diagnoses, presets, and exports the same live
  material. It is development-only unless deliberately enabled.
- `GlazeDiagnostics` exposes requested/effective capability, renderer, material,
  preferences, control count, and fallback reason.

Every source surface owns one renderer and one source texture. Multiple
controls share it. The accepted default material is invariant across source
types and components; custom values are uniform changes, not shader forks.

## Next.js boundary

The React entry is a client boundary. Pages and layouts remain Server
Components and pass serializable values or React slots into narrow Glaze client
components. The WebGL renderer loads only after a valid optical source is
ready. `@glazelab/react/material` has no client directive or browser access.

## Fallback truth

Unsupported WebGL, forced colors, invalid source contracts, media failures,
tainted sources, and context loss select `css-fallback` with an inspectable
reason. Image and video descriptors receive a bounded origin-clean check on
first paint; subscribed canvas sources are checked on redraw. A clean
replacement clears a prior taint and can recover without replacing a
same-kind renderer. Context restoration creates a fresh renderer. The semantic
control tree does not change.

This contract may not grow or change during release verification without
reopening the API gate and rerunning public and packed-consumer matrices.
