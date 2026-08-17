import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

const [, , referenceInput, candidateInput, outputInput] = process.argv;
if (!referenceInput || !candidateInput || !outputInput) {
  throw new Error(
    "usage: node scripts/build-optical-review-board.mjs <reference.png> <candidate.png> <output.png>",
  );
}

const reference = PNG.sync.read(readFileSync(resolve(referenceInput)));
const candidate = PNG.sync.read(readFileSync(resolve(candidateInput)));

const crop = (image, bounds) => {
  const result = new PNG({ width: bounds.width, height: bounds.height });
  PNG.bitblt(
    image,
    result,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
  );
  return result;
};

const resize = (image, width, height) => {
  const result = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      image.height - 1,
      Math.round((y / Math.max(height - 1, 1)) * (image.height - 1)),
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        image.width - 1,
        Math.round((x / Math.max(width - 1, 1)) * (image.width - 1)),
      );
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      result.data[targetIndex] = image.data[sourceIndex];
      result.data[targetIndex + 1] = image.data[sourceIndex + 1];
      result.data[targetIndex + 2] = image.data[sourceIndex + 2];
      result.data[targetIndex + 3] = image.data[sourceIndex + 3];
    }
  }
  return result;
};

const referenceControl = resize(
  crop(reference, { x: 386, y: 322, width: 799, height: 152 }),
  320,
  61,
);
const candidateControl = crop(candidate, {
  x: 22,
  y: 22,
  width: 320,
  height: 64,
});

const gap = 24;
const board = new PNG({
  width: referenceControl.width + gap + candidateControl.width,
  height: 64,
  colorType: 6,
  inputColorType: 6,
  inputHasAlpha: true,
});
for (let index = 0; index < board.data.length; index += 4) {
  board.data[index] = 19;
  board.data[index + 1] = 22;
  board.data[index + 2] = 25;
  board.data[index + 3] = 255;
}
PNG.bitblt(referenceControl, board, 0, 0, 320, 61, 0, 1);
PNG.bitblt(candidateControl, board, 0, 0, 320, 64, 320 + gap, 0);

const output = resolve(outputInput);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, PNG.sync.write(board));
process.stdout.write(`${output}\n`);
