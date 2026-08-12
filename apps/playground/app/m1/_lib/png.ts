import type { M1DisplacementMap } from "./displacement";

export function displacementMapDataUrl(map: M1DisplacementMap): string {
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is required to encode the M1 map.");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(map.pixels), map.width, map.height),
    0,
    0,
  );
  return canvas.toDataURL("image/png");
}
