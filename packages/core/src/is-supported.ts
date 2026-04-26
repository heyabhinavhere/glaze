/**
 * Capability probe — returns true when the runtime can use the WebGL
 * rendering path. Returns false when CSS fallback should kick in.
 *
 * Design §6.5: requires ALL of:
 *   - window defined (rules out SSR)
 *   - WebGL2 context creatable on a probe canvas (NOT just WebGL1 — our
 *     shader uses WebGL2 features; we don't try to support WebGL1)
 *   - OffscreenCanvas constructor available (used for the shared GL
 *     context — see design §3)
 *   - Worker constructor available (used for Mode C rasterization;
 *     reported here even though Mode A/B don't strictly need it, to
 *     keep the capability signal a single boolean for consumers)
 *
 * The probe is cached after first invocation — capability doesn't change
 * after page load.
 *
 * Side effect: triggers shader pre-warm (design §3.6, §M17). Safe to
 * call from anywhere; pre-warm itself is idempotent and SSR-safe.
 */

import { ensurePrewarm } from "./internal/prewarm";

let cachedResult: boolean | null = null;

export function isSupported(): boolean {
  // Triggers pre-warm on the first invocation of any public symbol.
  // We do this even on cache hits — the prewarm function is itself
  // idempotent, and the dual call site (this + createGlass when it
  // lands) keeps tree-shaking honest.
  ensurePrewarm();

  if (cachedResult !== null) return cachedResult;

  if (typeof window === "undefined") {
    cachedResult = false;
    return false;
  }
  if (typeof OffscreenCanvas === "undefined") {
    cachedResult = false;
    return false;
  }
  if (typeof Worker === "undefined") {
    cachedResult = false;
    return false;
  }

  // Probe a real WebGL2 context. Some browsers report support but fail
  // to create a context (driver issues, blocklists, headless modes).
  // We use a fresh OffscreenCanvas, not the singleton's, so we don't
  // disturb any in-flight singleton state.
  let probeCtx: WebGL2RenderingContext | null = null;
  try {
    const probe = new OffscreenCanvas(1, 1);
    probeCtx = probe.getContext("webgl2");
  } catch {
    cachedResult = false;
    return false;
  }
  if (!probeCtx) {
    cachedResult = false;
    return false;
  }
  // Don't keep the probe context alive — release driver memory.
  const lose = probeCtx.getExtension("WEBGL_lose_context");
  if (lose) lose.loseContext();

  cachedResult = true;
  return true;
}

/** Reset the cached probe result. Internal/testing only — capability is
 *  static at runtime, so production callers never need this. */
export function _resetIsSupportedCache(): void {
  cachedResult = null;
}
