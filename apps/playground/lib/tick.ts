/**
 * Web Audio-driven subtle tick for slider scrubbing. Lazy-initialises the
 * AudioContext on first user interaction (pointer / keyboard) so it respects
 * browser autoplay policies.
 *
 * Character: soft wood tap. A short white-noise burst is pushed through a
 * bandpass filter near ~1.1kHz (the "knock" sweet spot for small wood),
 * with a fast linear attack and exponential tail. No pitched component, so
 * it reads as tactile rather than electronic.
 */

let audioCtx: AudioContext | null = null;
/** Pre-synthesized noise buffer, reused for every tick to avoid per-call
 *  allocation. Generated on first call, lifetime of the app. */
let noiseBuffer: AudioBuffer | null = null;
let lastTickTime = 0;
/** Floor on inter-tick time so rapid drags don't overload the audio graph. */
const MIN_TICK_INTERVAL_MS = 22;

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const w = window as WindowWithWebkit;
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Build a ~30ms white-noise buffer with a linear decay so the tail doesn't
 *  clip when bandpassed. Reused across all ticks. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.032);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Random ∈ [-1, 1] with a soft linear fade so the raw noise has already
    // started decaying before the gain envelope closes it out.
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Play one tick. Throttled — calls faster than `MIN_TICK_INTERVAL_MS`
 * apart are dropped.
 */
export function playTick() {
  const t0 = performance.now();
  if (t0 - lastTickTime < MIN_TICK_INTERVAL_MS) return;
  lastTickTime = t0;

  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);

  // Bandpass isolates the "knock" frequency band. ~1.1kHz Q=4 sits where
  // small wood resonates — lower than that sounds like a thud, higher than
  // that turns shrill.
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1100, now);
  filter.Q.setValueAtTime(4, now);

  // Envelope — fast linear attack, exponential decay. Peak 0.22 feels about
  // right once the bandpass takes ~20dB off the signal.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + 0.05);
}
