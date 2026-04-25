"use client";

/**
 * Rim-engine spike harness.
 *
 * Not linked from the main playground — reach it at /spike only. Purpose:
 * validate the hybrid CSS-body + WebGL-rim architecture against a
 * CSS-only fallback, across multiple backdrop types (image, animated
 * canvas, scrolling article).
 *
 * Shape:
 *   - Shared backdrop fills a viewport area (picker at top-left).
 *   - Two identical glass panels side-by-side — left uses the WebGL rim
 *     engine (primary), right uses CSS-only (fallback). Same RimConfig
 *     feeds both.
 *   - FPS counter above each panel.
 *   - Config tuning sidebar on the right.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import html2canvas from "html2canvas";
import { PillSlider } from "@/components/ui/PillSlider";
import { Section } from "@/components/ui/Section";
import {
  DEFAULT_RIM_CONFIG,
  SPIKE_BACKDROPS,
  type BackdropDef,
  type RimConfig,
} from "@/lib/spike/rim-config";
import { BackdropRenderer } from "@/components/spike/BackdropRenderer";
import { FpsCounter } from "@/components/spike/FpsCounter";
import { CssFallbackRim } from "@/components/spike/CssFallbackRim";
import { WebglRim } from "@/components/spike/WebglRim";

const PANEL_W = 360;
const PANEL_H = 440;

export default function SpikePage() {
  const [config, setConfig] = useState<RimConfig>(DEFAULT_RIM_CONFIG);
  const [bgId, setBgId] = useState<string>("cups");

  /* Callback-ref for the viewport element so child components get notified
   *  via re-render when the element mounts. A plain `useRef` doesn't trigger
   *  a re-render, which means the WebglRim would initialise against the
   *  fallback parent (the flex container, not the viewport) and miscompute
   *  u_bounds for refraction sampling. */
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [backdropSource, setBackdropSource] = useState<
    HTMLImageElement | HTMLCanvasElement | null
  >(null);
  const [live, setLive] = useState(false);

  const backdrop: BackdropDef =
    SPIKE_BACKDROPS.find((b) => b.id === bgId) ?? SPIKE_BACKDROPS[0];

  /* Resolve the backdrop into a texture source the WebGL rim can upload.
     - image: decode the URL into an HTMLImageElement (one-shot, live=false)
     - canvas: find the animated canvas in the viewport, share a ref,
       live=true so we re-upload per frame
     - scroll: capture the scrolling-article DOM via html2canvas. Re-capture
       debounced on scroll so the rim refracts the actual content the user
       sees behind the panel, not a stale snapshot. This is the same path
       the library will use for arbitrary DOM backdrops in v1.0. */
  useEffect(() => {
    let cancelled = false;
    setBackdropSource(null);

    if (backdrop.kind === "image" && backdrop.src) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = backdrop.src;
      img
        .decode()
        .then(() => {
          if (!cancelled) {
            setBackdropSource(img);
            setLive(false);
          }
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[spike] image decode failed:", e);
        });
      return () => {
        cancelled = true;
      };
    }

    if (backdrop.kind === "canvas") {
      // Find the animated canvas that BackdropRenderer inserted as a child
      // of the viewport. Defer one frame so React has mounted it.
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        const canvas = viewport?.querySelector("canvas");
        if (canvas instanceof HTMLCanvasElement) {
          setBackdropSource(canvas);
          setLive(true);
        }
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    if (backdrop.kind === "scroll" && viewport) {
      // Capture the WHOLE viewport rather than the scroll container. This
      // avoids html2canvas's unreliable scroll-position handling and its
      // trouble with Tailwind's CSS-variable-driven gradients on the
      // container — capturing the viewport gets us the visible composited
      // result (which is what backdrop-filter shows). Panel wrappers are
      // marked data-spike-ignore so they don't end up in the texture and
      // create a feedback loop.
      const findScroller = (): HTMLElement | null => {
        const candidates = viewport.querySelectorAll("div");
        for (const el of Array.from(candidates)) {
          if (el.classList.contains("overflow-y-scroll")) {
            return el as HTMLElement;
          }
        }
        return null;
      };

      const capture = async () => {
        if (cancelled) return;
        try {
          const c = await html2canvas(viewport, {
            backgroundColor: null,
            logging: false,
            useCORS: true,
            scale: Math.min(2, window.devicePixelRatio || 1),
            ignoreElements: (el) =>
              el.tagName === "CANVAS" || el.hasAttribute("data-spike-ignore"),
          });
          if (cancelled) return;
          setBackdropSource(c);
          setLive(false);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[spike] scroll capture failed:", e);
        }
      };

      const initRaf = requestAnimationFrame(capture);

      // Re-capture debounced on scroll. The scroll listener targets the
      // inner scroll container (where the actual scroll event fires);
      // capture() still html2canvases the whole viewport.
      let scrollTimer: ReturnType<typeof setTimeout> | null = null;
      const onScroll = () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(capture, 150);
      };
      const scroller = findScroller();
      scroller?.addEventListener("scroll", onScroll);

      return () => {
        cancelled = true;
        cancelAnimationFrame(initRaf);
        if (scrollTimer) clearTimeout(scrollTimer);
        scroller?.removeEventListener("scroll", onScroll);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [bgId, backdrop.kind, backdrop.src, viewport]);

  const set =
    <K extends keyof RimConfig>(key: K) =>
    (value: RimConfig[K]) =>
      setConfig((c) => ({ ...c, [key]: value }));

  // Angle shown in degrees in the UI; we store radians internally.
  const angleDeg = useMemo(
    () => Math.round((config.lightAngle * 180) / Math.PI),
    [config.lightAngle],
  );

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-black text-white">
      {/* ============ VIEWPORT (backdrop + two panels) ============= */}
      <div
        ref={setViewport}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <BackdropRenderer
          backdrop={backdrop}
          ignoreAttribute="data-spike-ignore"
        />

        {/* The panel wrappers are marked data-spike-ignore so html2canvas
            (used for the scroll backdrop's WebGL capture) skips them and
            we don't get the panels in the captured texture, which would
            create a feedback loop. */}
        <div className="relative z-10 flex gap-10" data-spike-ignore>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                primary
              </span>
              <FpsCounter label="WebGL rim" />
            </div>
            <WebglRim
              config={config}
              targetElement={viewport}
              backdropSource={backdropSource}
              live={live}
              style={{ width: PANEL_W, height: PANEL_H }}
            />
            <span className="text-[10px] text-white/40">
              refraction · chromatic · directional rim lighting
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                fallback
              </span>
              <FpsCounter label="CSS only" />
            </div>
            <CssFallbackRim
              config={config}
              style={{ width: PANEL_W, height: PANEL_H }}
            />
            <span className="text-[10px] text-white/40">
              CSS backdrop-filter + faked rim highlights · no refraction
            </span>
          </div>
        </div>

        {/* Top-left: nav + backdrop picker. Data-spike-ignore keeps these
            out of any html2canvas-style captures we might add later. */}
        <div
          className="absolute top-4 left-4 z-20 flex items-center gap-2"
          data-spike-ignore
        >
          <Link
            href="/"
            className="rounded-md border border-white/15 bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
          >
            ← playground
          </Link>
          <select
            value={bgId}
            onChange={(e) => setBgId(e.target.value)}
            className="rounded-md border border-white/15 bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm outline-none focus:border-white/40"
          >
            {SPIKE_BACKDROPS.map((b) => (
              <option key={b.id} value={b.id} className="bg-black">
                {b.label}
              </option>
            ))}
          </select>
          <span className="rounded-md bg-black/40 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-sm">
            rim-engine spike
          </span>
        </div>
      </div>

      {/* ============ CONTROLS SIDEBAR ============= */}
      <aside
        className="z-30 flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0a0a0a] p-5"
        data-spike-ignore
      >
        <h1 className="mb-1 text-[13px] font-semibold tracking-tight text-white">
          Rim config
        </h1>
        <p className="mb-5 text-[11px] text-white/50">
          Same config feeds both engines. Values are in engine space (not
          user 0-100) so they map 1:1 to the existing shader.
        </p>

        <Section title="Geometry" defaultOpen>
          <PillSlider
            label="Radius (px)"
            value={config.radius}
            min={0}
            max={120}
            step={1}
            onChange={set("radius")}
          />
          <PillSlider
            label="Bevel width (px)"
            value={config.bevelWidth}
            min={1}
            max={8}
            step={0.5}
            suffix="px"
            onChange={set("bevelWidth")}
          />
          <PillSlider
            label="Rim band (px)"
            value={config.bendZone}
            min={8}
            max={80}
            step={1}
            suffix="px"
            onChange={set("bendZone")}
          />
        </Section>

        <Section title="Body" defaultOpen>
          <PillSlider
            label="Frost"
            value={config.frost}
            min={0}
            max={1}
            step={0.02}
            onChange={set("frost")}
          />
          <PillSlider
            label="Tint opacity"
            value={config.tint[3]}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(a) =>
              setConfig((c) => ({
                ...c,
                tint: [c.tint[0], c.tint[1], c.tint[2], a],
              }))
            }
          />
        </Section>

        <Section title="Refraction" defaultOpen>
          <PillSlider
            label="Amount"
            value={config.refraction}
            min={0}
            max={0.05}
            step={0.001}
            onChange={set("refraction")}
          />
          <PillSlider
            label="Bevel depth"
            value={config.bevelDepth}
            min={0}
            max={0.1}
            step={0.002}
            onChange={set("bevelDepth")}
          />
          <PillSlider
            label="Chromatic"
            value={config.chromatic}
            min={0}
            max={0.6}
            step={0.01}
            onChange={set("chromatic")}
          />
        </Section>

        <Section title="Light" defaultOpen>
          <PillSlider
            label="Intensity"
            value={config.rimIntensity}
            min={0}
            max={1.2}
            step={0.02}
            onChange={set("rimIntensity")}
          />
          <PillSlider
            label="Strength"
            value={config.lightStrength}
            min={0}
            max={1}
            step={0.02}
            onChange={set("lightStrength")}
          />
          <PillSlider
            label="Angle (°)"
            value={angleDeg}
            min={0}
            max={360}
            step={1}
            suffix="°"
            onChange={(deg) => set("lightAngle")((deg * Math.PI) / 180)}
          />
        </Section>

        <div className="mt-4 border-t border-white/5 pt-4 text-[10px] text-white/40">
          Primary engine now uses the same WebGL shader as the main
          playground — no more rim/body seam. Fallback stays pure CSS.
        </div>
      </aside>
    </div>
  );
}
