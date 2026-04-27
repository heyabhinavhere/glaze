/**
 * Auto-detection — when createGlass is called with no `backdrop` and
 * no `backdropFrom`, walks the host's ancestors to figure out what's
 * visually behind it. The whole point of "drop-in glass" UX:
 *
 *   <Glaze>nav</Glaze>
 *
 * just works, no `backdrop=` prop needed.
 *
 * Heuristic (design §4.2):
 *
 *   1. Walk up from host.parentElement. At each ancestor level:
 *        Find <img> / <video> / <canvas> in the ancestor's subtree
 *        (excluding the host's own subtree and excluding our own
 *        data-glaze-canvas elements — feedback-loop prevention).
 *      For each candidate, check if its bbox fully covers the lens
 *      area. If multiple candidates qualify, pick the largest cover.
 *      First ancestor level with a winner stops the walk.
 *
 *   2. If no media element found anywhere up the tree: walk up again,
 *      this time checking each ancestor's computed `background-image`.
 *      First ancestor with a `url(...)` background wins — the URL
 *      string becomes the backdrop (Mode A path), and the ancestor
 *      element becomes the anchor.
 *
 *   3. If neither path finds anything: return null. Sub-task 6's
 *      Mode C will eventually fill this hole — it captures arbitrary
 *      DOM content as a texture for the cases where there's no
 *      actual media element to refract.
 *
 * Phase 1.5 of the design doc validates this heuristic against an 8+
 * layout corpus. For now, this is a faithful first implementation.
 */

export interface AutoDetectResult {
  backdrop:
    | string
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | null;
  backdropAnchor: HTMLElement | null;
  /** Diagnostic — what mode was chosen. Useful for the dev-mode debug
   *  API in sub-task 7 and for the auto-detection corpus tests. */
  mode: "A-element" | "A-bg-image" | "none";
}

/** Run auto-detection against the host. SSR-safe: returns no-match if
 *  window/document aren't available. */
export function autoDetectBackdrop(host: HTMLElement): AutoDetectResult {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { backdrop: null, backdropAnchor: null, mode: "none" };
  }

  const lensRect = host.getBoundingClientRect();
  if (lensRect.width <= 0 || lensRect.height <= 0) {
    // 0-area lens — no meaningful coverage check possible. Fall through
    // gracefully; createGlass already gates on lens area, this is just
    // belt-and-suspenders.
    return { backdrop: null, backdropAnchor: null, mode: "none" };
  }

  // ---- Phase 1: media element search ----------------------------------
  let current: HTMLElement | null = host.parentElement;
  while (current && current !== document.documentElement) {
    const winner = findCoveringMedia(current, host, lensRect);
    if (winner) {
      return {
        backdrop: winner,
        backdropAnchor: winner,
        mode: "A-element",
      };
    }
    current = current.parentElement;
  }

  // ---- Phase 2: CSS background-image fallback -------------------------
  current = host.parentElement;
  while (current && current !== document.documentElement) {
    const bgUrl = extractBackgroundImageUrl(current);
    if (bgUrl) {
      return {
        backdrop: bgUrl,
        backdropAnchor: current,
        mode: "A-bg-image",
      };
    }
    current = current.parentElement;
  }

  // Also check <body> and <html> for background-image — common for
  // page-wide backgrounds.
  for (const el of [document.body, document.documentElement] as HTMLElement[]) {
    if (!el) continue;
    const bgUrl = extractBackgroundImageUrl(el);
    if (bgUrl) {
      return {
        backdrop: bgUrl,
        // Anchor on body/html → bounds will compute relative to the
        // viewport effectively (since body usually fills the viewport
        // for cover-fit page backgrounds). For non-fullscreen body
        // contexts, this still gives the most reasonable answer.
        backdropAnchor: el,
        mode: "A-bg-image",
      };
    }
  }

  return { backdrop: null, backdropAnchor: null, mode: "none" };
}

/** Find an <img> / <video> / <canvas> within `root`'s subtree (excluding
 *  `excludeSubtree`'s subtree and our own glass canvases) whose bbox
 *  fully covers `lensRect`. Returns the largest covering candidate. */
function findCoveringMedia(
  root: HTMLElement,
  excludeSubtree: HTMLElement,
  lensRect: DOMRect,
): HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null {
  const media = root.querySelectorAll(
    "img, video, canvas",
  ) as NodeListOf<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement>;

  let bestEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null =
    null;
  let bestArea = 0;

  for (const el of media) {
    // Feedback-loop guard: don't refract our own glass canvas. The
    // Lens stamps `data-glaze-canvas` on its visible canvas at mount.
    if (el.hasAttribute("data-glaze-canvas")) continue;
    // Skip media inside the host's subtree (the lens's own children
    // can't be the lens's backdrop).
    if (excludeSubtree.contains(el)) continue;

    const r = el.getBoundingClientRect();
    // Must fully cover the lens — partial cover means refraction would
    // sample outside the texture for some lens regions.
    if (
      r.left <= lensRect.left &&
      r.right >= lensRect.right &&
      r.top <= lensRect.top &&
      r.bottom >= lensRect.bottom &&
      r.width > 0 &&
      r.height > 0
    ) {
      const area = r.width * r.height;
      if (area > bestArea) {
        bestEl = el;
        bestArea = area;
      }
    }
  }

  return bestEl;
}

/** Extract the first url(...) from a computed `background-image`.
 *  Returns null when none, or when the value is `none`, a gradient, or
 *  any other non-url form. Resolves to absolute URL via the browser's
 *  built-in href resolution. */
function extractBackgroundImageUrl(el: HTMLElement): string | null {
  const cs = getComputedStyle(el);
  const bg = cs.backgroundImage;
  if (!bg || bg === "none") return null;
  // background-image can be a comma-separated list. Take the first one
  // that has a url(...). Gradient stops or `none` entries get skipped.
  const layers = splitTopLevel(bg);
  for (const layer of layers) {
    const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(layer);
    if (m) return m[1] ?? null;
  }
  return null;
}

/** Split a CSS list value at top-level commas (i.e., commas not inside
 *  parentheses). `linear-gradient(45deg, red, blue), url(a.png)` →
 *  ["linear-gradient(45deg, red, blue)", "url(a.png)"]. */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out;
}
