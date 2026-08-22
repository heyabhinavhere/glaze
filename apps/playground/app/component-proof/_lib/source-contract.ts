export const SOURCE_MAX_DPR = 2;

const PROHIBITED_OWNED_SELECTORS = Object.freeze([
  "a[href]",
  "button",
  "form",
  "input",
  "label",
  "select",
  "textarea",
  "[contenteditable]:not([contenteditable='false'])",
  "[id]",
  "[tabindex]",
  "[data-sensitive]",
]);

export interface OwnedDecorationInspection {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly svg: SVGSVGElement | null;
}

export function inspectOwnedDecoration(
  root: HTMLElement,
): OwnedDecorationInspection {
  const reasons: string[] = [];
  if (root.getAttribute("aria-hidden") !== "true") {
    reasons.push("owned-decoration-must-be-aria-hidden");
  }
  if (!root.inert) reasons.push("owned-decoration-must-be-inert");

  const svg = root.querySelector(":scope > svg");
  if (!(svg instanceof SVGSVGElement)) {
    reasons.push("owned-decoration-requires-one-svg-root");
  }
  if (root.querySelectorAll(":scope > svg").length !== 1) {
    reasons.push("owned-decoration-requires-one-svg-root");
  }

  for (const selector of PROHIBITED_OWNED_SELECTORS) {
    if (root.querySelector(selector)) {
      reasons.push(`owned-decoration-prohibits:${selector}`);
    }
  }

  for (const element of root.querySelectorAll("*")) {
    for (const attribute of element.getAttributeNames()) {
      if (attribute.toLowerCase().startsWith("on")) {
        reasons.push(`owned-decoration-prohibits-event:${attribute}`);
      }
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    valid: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    svg: svg instanceof SVGSVGElement ? svg : null,
  };
}

export function resizeSourceCanvas(
  canvas: HTMLCanvasElement,
  alpha = false,
): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(SOURCE_MAX_DPR, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d", { alpha });
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function canvasCssSize(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
  dpr: number;
} {
  const dpr = Math.min(SOURCE_MAX_DPR, window.devicePixelRatio || 1);
  return {
    width: canvas.width / dpr,
    height: canvas.height / dpr,
    dpr,
  };
}

function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(
    destinationWidth / sourceWidth,
    destinationHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (destinationWidth - width) * 0.5,
    y: (destinationHeight - height) * 0.5,
    width,
    height,
  };
}

export async function drawOwnedSvgSource(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
): Promise<OwnedDecorationInspection> {
  const inspection = inspectOwnedDecoration(root);
  if (!inspection.valid || !inspection.svg) return inspection;

  const context = resizeSourceCanvas(canvas);
  if (!context) throw new Error("owned-source-canvas-unavailable");
  const { width, height, dpr } = canvasCssSize(canvas);
  const serialized = new XMLSerializer().serializeToString(inspection.svg);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("owned-decoration-svg-load-failed"));
      image.src = url;
    });
    const sourceWidth = image.naturalWidth || 960;
    const sourceHeight = image.naturalHeight || 720;
    const target = coverRect(sourceWidth, sourceHeight, width, height);
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.drawImage(image, target.x, target.y, target.width, target.height);
    context.restore();
    return inspection;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function drawVideoSource(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
): boolean {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    || video.videoWidth <= 0
    || video.videoHeight <= 0
  ) {
    return false;
  }
  const context = resizeSourceCanvas(canvas);
  if (!context) throw new Error("media-source-canvas-unavailable");
  const { width, height, dpr } = canvasCssSize(canvas);
  const target = coverRect(
    video.videoWidth,
    video.videoHeight,
    width,
    height,
  );
  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.drawImage(video, target.x, target.y, target.width, target.height);
  context.restore();
  return true;
}

/**
 * Exact accepted material-decoration pixels from the frozen optical kernel.
 * The component proof varies only the developer-owned sampled source.
 */
export function drawAcceptedMaterialDecoration(
  canvas: HTMLCanvasElement,
): void {
  const width = 256;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("material-decoration-context-unavailable");
  context.clearRect(0, 0, width, height);

  const body = context.createLinearGradient(0, 0, width, height);
  body.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  body.addColorStop(0.38, "rgba(238, 249, 255, 0.18)");
  body.addColorStop(0.72, "rgba(211, 231, 244, 0.11)");
  body.addColorStop(1, "rgba(18, 31, 43, 0.14)");
  context.fillStyle = body;
  context.fillRect(0, 0, width, height);

  const highlight = context.createRadialGradient(
    width * 0.23,
    height * 0.12,
    0,
    width * 0.23,
    height * 0.12,
    width * 0.68,
  );
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.34)");
  highlight.addColorStop(0.34, "rgba(255, 255, 255, 0.11)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = highlight;
  context.fillRect(0, 0, width, height);

  const occlusion = context.createRadialGradient(
    width * 0.83,
    height * 0.94,
    0,
    width * 0.83,
    height * 0.94,
    width * 0.58,
  );
  occlusion.addColorStop(0, "rgba(1, 8, 14, 0.18)");
  occlusion.addColorStop(0.46, "rgba(1, 8, 14, 0.06)");
  occlusion.addColorStop(1, "rgba(1, 8, 14, 0)");
  context.fillStyle = occlusion;
  context.fillRect(0, 0, width, height);
}
