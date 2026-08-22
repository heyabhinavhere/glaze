import type {
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMotion,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const normalizeColor = (color: string) => {
  const value = color.trim();
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) {
    return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();
  }
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : "#ffffff";
};

export const defaultGlazeMaterial: GlazeMaterial = Object.freeze({
  refraction: 1,
  thickness: 1,
  dispersion: 1,
  roughness: 0.4,
  transmission: 0.985,
  tint: Object.freeze({ color: "#ffffff", opacity: 0 }),
  lighting: Object.freeze({
    angle: 129.73230287195577,
    highlight: 1,
    occlusion: 1,
  }),
});

export const defaultGlazeMotion: GlazeMotion = Object.freeze({
  stiffness: 150,
  damping: 18.5,
});

export const glazeMaterialPresets = Object.freeze({
  accepted: defaultGlazeMaterial,
  quiet: Object.freeze({
    ...defaultGlazeMaterial,
    refraction: 0.72,
    dispersion: 0.62,
    lighting: Object.freeze({
      ...defaultGlazeMaterial.lighting,
      highlight: 0.72,
      occlusion: 0.76,
    }),
  }),
  vivid: Object.freeze({
    ...defaultGlazeMaterial,
    refraction: 1.24,
    thickness: 1.12,
    dispersion: 1.3,
    lighting: Object.freeze({
      ...defaultGlazeMaterial.lighting,
      highlight: 1.18,
      occlusion: 1.08,
    }),
  }),
} satisfies Readonly<Record<string, GlazeMaterial>>);

export function resolveGlazeMaterial(
  input: GlazeMaterialInput = defaultGlazeMaterial,
): GlazeMaterial {
  return {
    refraction: clamp(input.refraction ?? defaultGlazeMaterial.refraction, 0, 2),
    thickness: clamp(input.thickness ?? defaultGlazeMaterial.thickness, 0, 2),
    dispersion: clamp(input.dispersion ?? defaultGlazeMaterial.dispersion, 0, 2),
    roughness: clamp(input.roughness ?? defaultGlazeMaterial.roughness, 0, 1),
    transmission: clamp(
      input.transmission ?? defaultGlazeMaterial.transmission,
      0,
      1,
    ),
    tint: {
      color: normalizeColor(
        input.tint?.color ?? defaultGlazeMaterial.tint.color,
      ),
      opacity: clamp(
        input.tint?.opacity ?? defaultGlazeMaterial.tint.opacity,
        0,
        1,
      ),
    },
    lighting: {
      angle: normalizeAngle(
        input.lighting?.angle ?? defaultGlazeMaterial.lighting.angle,
      ),
      highlight: clamp(
        input.lighting?.highlight
          ?? defaultGlazeMaterial.lighting.highlight,
        0,
        2,
      ),
      occlusion: clamp(
        input.lighting?.occlusion
          ?? defaultGlazeMaterial.lighting.occlusion,
        0,
        2,
      ),
    },
  };
}

export function resolveGlazeMotion(
  input: Partial<GlazeMotion> = defaultGlazeMotion,
): GlazeMotion {
  return {
    stiffness: clamp(
      input.stiffness ?? defaultGlazeMotion.stiffness,
      1,
      1000,
    ),
    damping: clamp(input.damping ?? defaultGlazeMotion.damping, 0, 200),
  };
}

export type {
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMotion,
} from "./types";
