/**
 * Backdrop loader — module-level Promise cache so the same URL decoded
 * from multiple createGlass() calls (or Strict Mode mount→unmount→mount
 * cycles) shares a single decode. Pattern matches the perf fix from
 * PR #1: parallel decodes serialize at the browser level and one decode
 * stalls behind the other; sharing the Promise avoids that.
 *
 * Sub-task 3c only handles HTMLImageElement and URL strings. Sub-tasks
 * 5/6 add HTMLVideoElement / HTMLCanvasElement (Mode B) and the Mode C
 * DOM rasterizer.
 */

const decodePromises = new Map<string, Promise<HTMLImageElement>>();

/** Decode an image URL once, share the Promise. Subsequent calls for the
 *  same URL return the cached Promise — caller awaits the same Image
 *  decode regardless of which createGlass() call kicked it off. */
export function decodeImageOnce(src: string): Promise<HTMLImageElement> {
  const cached = decodePromises.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Anonymous CORS so the image is usable as a WebGL texture without
    // tainting the canvas. Servers without `Access-Control-Allow-Origin`
    // will fail to decode; Mode A docs guide users to host appropriately.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      // .decode() ensures the image is fully ready for GPU upload (no
      // first-frame stall). Modern browsers treat onload + decode() as
      // belt-and-suspenders here.
      const decode = img.decode?.();
      if (decode) {
        decode.then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => {
      // Drop from cache on error so a subsequent call can retry.
      decodePromises.delete(src);
      reject(new Error(`@glazelab/core: failed to decode image: ${src}`));
    };
    img.src = src;
  });

  decodePromises.set(src, promise);
  return promise;
}

/** Resolve a backdrop config value to a usable image source.
 *
 *  - string: decode the image at that URL (Promise-cached).
 *  - HTMLImageElement: await decode if not already loaded.
 *  - HTMLCanvasElement: return as-is (renderer re-uploads each frame).
 *  - HTMLVideoElement: await first frame ready, then return for the
 *    renderer to subscribe to requestVideoFrameCallback. */
export async function resolveBackdrop(
  source: string | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement> {
  if (typeof source === "string") {
    return decodeImageOnce(source);
  }
  if (source instanceof HTMLImageElement) {
    // If the image isn't loaded yet, await its decode.
    if (!source.complete) {
      await new Promise<void>((resolve, reject) => {
        const onLoad = () => {
          source.removeEventListener("load", onLoad);
          source.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          source.removeEventListener("load", onLoad);
          source.removeEventListener("error", onError);
          reject(new Error("@glazelab/core: passed HTMLImageElement failed to load"));
        };
        source.addEventListener("load", onLoad);
        source.addEventListener("error", onError);
      });
    }
    return source;
  }
  if (source instanceof HTMLCanvasElement) {
    return source;
  }
  if (source instanceof HTMLVideoElement) {
    // Wait for the video to have its first frame available — readyState
    // ≥ HAVE_CURRENT_DATA (2) means there's something to upload. Lower
    // states would either upload garbage (HAVE_NOTHING) or work in
    // some browsers but not others (HAVE_METADATA).
    if (source.readyState < 2) {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("@glazelab/core: HTMLVideoElement failed to load"));
        };
        const cleanup = () => {
          source.removeEventListener("loadeddata", onReady);
          source.removeEventListener("error", onError);
        };
        source.addEventListener("loadeddata", onReady);
        source.addEventListener("error", onError);
      });
    }
    return source;
  }
  // Unknown type: never crash the consumer's app.
  return makePlaceholderImage();
}

function makePlaceholderImage(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  return c;
}
