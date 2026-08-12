export interface M1Material {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly geometry: {
    readonly cornerRadiusPx: number;
    readonly bevelWidthPx: number;
  };
  readonly optics: {
    readonly displacementPx: number;
    readonly frostPx: number;
    readonly chromaPx: number;
  };
  readonly surface: {
    readonly tint: readonly [number, number, number];
    readonly tintOpacity: number;
    readonly rimIntensity: number;
    readonly lightAngleDeg: number;
  };
}

export const transportMaterial: M1Material = Object.freeze({
  schemaVersion: 1,
  id: "m1-transport-controls",
  geometry: Object.freeze({
    cornerRadiusPx: 28,
    bevelWidthPx: 14,
  }),
  optics: Object.freeze({
    displacementPx: 8,
    frostPx: 1.5,
    chromaPx: 0.35,
  }),
  surface: Object.freeze({
    tint: Object.freeze([0.91, 0.96, 1]) as readonly [number, number, number],
    tintOpacity: 0.075,
    rimIntensity: 0.58,
    lightAngleDeg: 315,
  }),
});
