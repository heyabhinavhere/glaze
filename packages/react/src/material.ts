import type {
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMaterialName,
  GlazeMotion,
  ResolvedGlazeMaterial,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const normalizeTint = (tint: string) => {
  const value = tint.trim();
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) {
    return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();
  }
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : "#ffffff";
};

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const motionDuration = (motion: GlazeMotion) => {
  if (motion === "none") return 0;
  return motion === "expressive" ? 320 : 180;
};

const normalizeMotion = (motion: unknown): GlazeMotion =>
  motion === "none" || motion === "expressive" ? motion : "subtle";

export const glazeMaterials: Readonly<Record<GlazeMaterialName, GlazeMaterial>> =
  Object.freeze({
    clear: Object.freeze({
      clarity: 92,
      frost: 14,
      tint: "#ffffff",
      tintOpacity: 8,
      depth: 28,
      edge: 32,
      lightAngle: 315,
      radius: 22,
      motion: "subtle",
    }),
    regular: Object.freeze({
      clarity: 82,
      frost: 36,
      tint: "#ffffff",
      tintOpacity: 12,
      depth: 46,
      edge: 48,
      lightAngle: 315,
      radius: 22,
      motion: "subtle",
    }),
    frosted: Object.freeze({
      clarity: 76,
      frost: 66,
      tint: "#ffffff",
      tintOpacity: 18,
      depth: 54,
      edge: 38,
      lightAngle: 300,
      radius: 24,
      motion: "subtle",
    }),
    dark: Object.freeze({
      clarity: 86,
      frost: 42,
      tint: "#0a1118",
      tintOpacity: 24,
      depth: 58,
      edge: 34,
      lightAngle: 315,
      radius: 22,
      motion: "subtle",
    }),
  });

export function resolveGlazeMaterial(
  input: GlazeMaterialInput = "regular",
): ResolvedGlazeMaterial {
  const candidate =
    typeof input === "string"
      ? glazeMaterials[input] ?? glazeMaterials.regular
      : { ...glazeMaterials.regular, ...input };
  const clarity = clamp(candidate.clarity, 0, 100);
  const frost = clamp(candidate.frost, 0, 100);
  const tint = normalizeTint(candidate.tint);
  const tintOpacity = clamp(candidate.tintOpacity, 0, 50);
  const depth = clamp(candidate.depth, 0, 100);
  const edge = clamp(candidate.edge, 0, 100);
  const lightAngle = normalizeAngle(candidate.lightAngle);
  const radius = clamp(candidate.radius, 0, 999);
  const motion = normalizeMotion(candidate.motion);

  return {
    clarity,
    frost,
    tint,
    tintOpacity,
    depth,
    edge,
    lightAngle,
    radius,
    motion,
    cssVariables: {
      "--glaze-blur": `${Math.round(4 + frost * 0.24)}px`,
      "--glaze-saturation": `${(1 + frost * 0.005).toFixed(3)}`,
      "--glaze-brightness": `${(0.96 + clarity * 0.0008).toFixed(3)}`,
      "--glaze-tint-rgb": hexToRgb(tint),
      "--glaze-tint-alpha": `${(tintOpacity / 100).toFixed(3)}`,
      "--glaze-depth": `${(depth / 100).toFixed(3)}`,
      "--glaze-edge": `${(edge / 100).toFixed(3)}`,
      "--glaze-surface-top-alpha": `${(0.055 + edge * 0.00045).toFixed(3)}`,
      "--glaze-surface-bottom-alpha": `${(0.025 + depth * 0.00055).toFixed(3)}`,
      "--glaze-shadow-alpha": `${(0.09 + depth * 0.0013).toFixed(3)}`,
      "--glaze-inset-top-alpha": `${(0.11 + edge * 0.0012).toFixed(3)}`,
      "--glaze-inset-bottom-alpha": `${(0.04 + depth * 0.0008).toFixed(3)}`,
      "--glaze-edge-strong-alpha": `${(0.12 + edge * 0.005).toFixed(3)}`,
      "--glaze-edge-weak-alpha": `${(0.025 + edge * 0.00035).toFixed(3)}`,
      "--glaze-edge-dark-alpha": `${(0.03 + depth * 0.001).toFixed(3)}`,
      "--glaze-edge-soft-alpha": `${(0.035 + edge * 0.0008).toFixed(3)}`,
      "--glaze-sheen-alpha": `${(0.05 + edge * 0.0007).toFixed(3)}`,
      "--glaze-light-angle": `${lightAngle}deg`,
      "--glaze-radius": `${radius}px`,
      "--glaze-motion-duration": `${motionDuration(motion)}ms`,
    },
  };
}

export type {
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMaterialName,
  GlazeMotion,
  ResolvedGlazeMaterial,
} from "./types";
