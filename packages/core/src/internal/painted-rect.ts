/**
 * Painted-rect helper — given a backdrop-anchor element, returns the
 * viewport rect where the IMAGE CONTENT is actually painted (which can
 * differ from the element's CSS rect when object-fit crops or letter-
 * boxes).
 *
 * Why: the renderer's bounds calc maps (lens.rect - anchor.rect) /
 * anchor.size to texture UV. For most elements the CSS rect IS the
 * painted rect. But an <img> with object-fit:cover paints content at
 * a different rect (scaled to fill, cropped on overflow), so the
 * texture UV mapping needs to account for that or the lens samples
 * the wrong region.
 *
 * Default object-position: center is assumed.
 */

export interface PaintedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getPaintedRect(el: HTMLElement): PaintedRect {
  const r = el.getBoundingClientRect();

  // Only HTMLImageElement needs object-fit-aware handling.
  if (!(el instanceof HTMLImageElement)) {
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  const natW = el.naturalWidth;
  const natH = el.naturalHeight;
  if (natW === 0 || natH === 0) {
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  const fit = getComputedStyle(el).objectFit;
  const cssAspect = r.width / Math.max(1, r.height);
  const natAspect = natW / Math.max(1, natH);

  // cover: scale to fill, crop on overflow.
  // contain: scale to fit, letterbox on shorter axis.
  // none: natural size, centered.
  // scale-down: min of none and contain.
  // fill / default: stretched to CSS rect.
  if (fit === "cover" || fit === "contain") {
    return computeFit(r, natAspect, cssAspect, fit === "cover");
  }
  if (fit === "none") {
    return centerOf(r, natW, natH);
  }
  if (fit === "scale-down") {
    const contain = computeFit(r, natAspect, cssAspect, false);
    const none = centerOf(r, natW, natH);
    return none.w * none.h < contain.w * contain.h ? none : contain;
  }
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Shared cover/contain math. cover=true returns the painted rect that
 *  EXTENDS BEYOND the CSS rect on the cropped axis; cover=false (i.e.
 *  contain) returns one INSIDE the CSS rect with letterbox margins. */
function computeFit(
  r: DOMRect,
  natAspect: number,
  cssAspect: number,
  cover: boolean,
): PaintedRect {
  // For cover: image overflows on whichever axis matches natAspect's
  //   "longer" dimension relative to the CSS rect.
  // For contain: image is letterboxed on the OTHER axis.
  // The two are mirror operations — same branch logic, different
  // sign of the offset.
  const widerThanCss = natAspect > cssAspect;
  if (widerThanCss === cover) {
    // cover && wider, OR contain && taller — fit to height
    const h = r.height;
    const w = h * natAspect;
    const dx = (w - r.width) / 2;
    return cover
      ? { x: r.left - dx, y: r.top, w, h }
      : { x: r.left + dx, y: r.top, w, h };
  } else {
    // cover && taller, OR contain && wider — fit to width
    const w = r.width;
    const h = w / natAspect;
    const dy = (h - r.height) / 2;
    return cover
      ? { x: r.left, y: r.top - dy, w, h }
      : { x: r.left, y: r.top + dy, w, h };
  }
}

function centerOf(r: DOMRect, w: number, h: number): PaintedRect {
  return {
    x: r.left + (r.width - w) / 2,
    y: r.top + (r.height - h) / 2,
    w,
    h,
  };
}
