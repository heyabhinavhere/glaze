/**
 * Shader pre-warm — kicks off shared-renderer creation (which compiles
 * the shader) the first time any public symbol is invoked. By the time a
 * lens actually mounts, the shader is already compiled and linked.
 *
 * Without this, first-mount latency includes shader compile time
 * (Chrome 20–80ms, Safari 50–200ms — the user sees a flicker on the
 * very first <Glaze> of the page). Design §3.6, §M17.
 *
 * Side-effect-on-first-call (not on import) preserves tree-shaking: a
 * consumer that imports the package but never calls any function pays
 * zero runtime cost. The flag is module-scoped so subsequent calls
 * across many createGlass() invocations are no-ops.
 */

import { acquire, release } from "./shared-renderer";

let prewarmStarted = false;

/** Idempotent. Schedules a microtask that creates the singleton (compiling
 *  the shader) and immediately releases — the 1s deferred-destroy grace
 *  window keeps it alive long enough for a real createGlass()/render to
 *  find the renderer warm. SSR-safe: no-op if window is undefined. */
export function ensurePrewarm(): void {
  if (prewarmStarted) return;
  if (typeof window === "undefined") return;
  prewarmStarted = true;
  queueMicrotask(() => {
    try {
      // acquire() compiles the shader as a side effect of construction.
      // Immediate release() schedules the deferred destroy; if a real
      // createGlass() lands within 1s, it cancels the destroy and reuses
      // the warm singleton.
      acquire();
      release();
    } catch {
      // Silent — if WebGL2/OffscreenCanvas aren't available the singleton
      // throws, isSupported() reports false elsewhere, and consumers
      // automatically take the CSS fallback path. No need to surface
      // this as an error here.
    }
  });
}
