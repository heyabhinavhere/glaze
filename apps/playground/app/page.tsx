"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Expand,
  Shrink,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  combinedShadowCss,
  glassConfigToCSS,
  uniformToUser,
} from "@/lib/glass-engine";
import { defaultConfig } from "@/lib/presets";
import { toVanillaCSS } from "@/lib/export-css";
import { GlassCanvas } from "@/components/GlassCanvas";
import {
  type GlassAdvanced,
  type GlassConfig,
  type GlassShaderUniforms,
} from "@/lib/types";
import { PillSlider } from "@/components/ui/PillSlider";
import { ColorPill } from "@/components/ui/ColorPill";
import { TogglePill } from "@/components/ui/TogglePill";
import { Section } from "@/components/ui/Section";

type Tone = "dark" | "light" | "vibrant";
type BgDef = {
  readonly id: string;
  readonly label: string;
  readonly src: string;
  readonly tone: Tone;
  readonly suggestedTint: { color: string; opacity: number };
};

const BACKGROUNDS: readonly BgDef[] = [
  {
    id: "cups",
    label: "Cups",
    src: "/backgrounds/bg-4.jpg",
    tone: "vibrant",
    suggestedTint: { color: "#ffffff", opacity: 14 },
  },
  {
    id: "bubbles",
    label: "Bubbles",
    src: "/backgrounds/bg-2.jpg",
    tone: "dark",
    suggestedTint: { color: "#ffffff", opacity: 6 },
  },
  {
    id: "architecture",
    label: "Curves",
    src: "/backgrounds/bg-3.jpg",
    tone: "vibrant",
    suggestedTint: { color: "#ffffff", opacity: 12 },
  },
  {
    id: "window",
    label: "Window",
    src: "/backgrounds/bg-1.jpg",
    tone: "dark",
    suggestedTint: { color: "#ffffff", opacity: 10 },
  },
  {
    id: "ember",
    label: "Ember",
    src: "/backgrounds/bg-5.jpg",
    tone: "dark",
    suggestedTint: { color: "#ffffff", opacity: 8 },
  },
  {
    id: "sky",
    label: "Sky",
    src: "/backgrounds/bg-6.jpg",
    tone: "light",
    suggestedTint: { color: "#0b1220", opacity: 10 },
  },
  {
    id: "warmth",
    label: "Warmth",
    src: "/backgrounds/bg-7.jpg",
    tone: "light",
    suggestedTint: { color: "#1f0c05", opacity: 8 },
  },
] as const;

const BG_SRCS = BACKGROUNDS.map((b) => b.src);

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/* ---- Panel morph dimensions --------------------------------------------- */
const PANEL_EXPANDED_W = 320;
const PANEL_COLLAPSED_W = 164;
const PANEL_HEADER_H = 56;
const PANEL_MARGIN = 16;
/** Apple-feel spring: snappy start, gentle settle, no overshoot bounce. */
const PANEL_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.9,
} as const;

export default function Home() {
  const [config, setConfig] = useState<GlassConfig>(defaultConfig);
  const [bgId, setBgId] = useState<string>("cups");
  const [autoTint, setAutoTint] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // MUST be the same initial value on server and client to avoid hydration
  // mismatch (we were branching on `typeof window` which diverged the two).
  // A reasonable desktop default keeps the first paint close to real size;
  // useLayoutEffect below overwrites it synchronously before paint with the
  // actual measured preview height.
  const [previewHeight, setPreviewHeight] = useState(600);

  // Glass panel position, measured as offset from centered.
  const [glassPos, setGlassPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Glass panel dimensions in pixels (state-managed, not derived from the
  // preview area % so the glass stays its set size when the code panel
  // toggles). Default 440x540.
  const [glassSize, setGlassSize] = useState({ width: 440, height: 540 });
  const [resizing, setResizing] = useState<ResizeHandle | null>(null);
  const resizeStart = useRef({
    mx: 0,
    my: 0,
    w: 0,
    h: 0,
    px: 0,
    py: 0,
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleGlassPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: glassPos.x,
      py: glassPos.y,
    };
    setDragging(true);
  };

  const handleGlassPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const preview = previewRef.current;
    const glass = glassRef.current;
    if (!preview || !glass) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const p = preview.getBoundingClientRect();
    const g = glass.getBoundingClientRect();
    const margin = 12;
    const maxX = (p.width - g.width) / 2 - margin;
    const maxY = (p.height - g.height) / 2 - margin;
    const newX = Math.min(Math.max(dragStart.current.px + dx, -maxX), maxX);
    const newY = Math.min(Math.max(dragStart.current.py + dy, -maxY), maxY);
    setGlassPos({ x: newX, y: newY });
  };

  const handleGlassPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  /* ---- Resize handle logic -------------------------------------------- */
  const MIN_GLASS_WIDTH = 160;
  const MIN_GLASS_HEIGHT = 160;

  const handleResizeStart =
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeStart.current = {
        mx: e.clientX,
        my: e.clientY,
        w: glassSize.width,
        h: glassSize.height,
        px: glassPos.x,
        py: glassPos.y,
      };
      setResizing(handle);
    };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizing) return;
    e.stopPropagation();
    const preview = previewRef.current;
    if (!preview) return;
    const dx = e.clientX - resizeStart.current.mx;
    const dy = e.clientY - resizeStart.current.my;
    const pr = preview.getBoundingClientRect();
    const maxW = pr.width - 24;
    const maxH = pr.height - 24;

    let newW = resizeStart.current.w;
    let newH = resizeStart.current.h;

    if (resizing.includes("e")) {
      newW = Math.min(
        Math.max(resizeStart.current.w + dx * 2, MIN_GLASS_WIDTH),
        maxW,
      );
    }
    if (resizing.includes("w")) {
      newW = Math.min(
        Math.max(resizeStart.current.w - dx * 2, MIN_GLASS_WIDTH),
        maxW,
      );
    }
    if (resizing.includes("s")) {
      newH = Math.min(
        Math.max(resizeStart.current.h + dy * 2, MIN_GLASS_HEIGHT),
        maxH,
      );
    }
    if (resizing.includes("n")) {
      newH = Math.min(
        Math.max(resizeStart.current.h - dy * 2, MIN_GLASS_HEIGHT),
        maxH,
      );
    }

    setGlassSize({ width: newW, height: newH });
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setResizing(null);
  };

  // Track preview area height so the panel can animate to the correct
  // expanded height. useLayoutEffect measures synchronously after mount.
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    setPreviewHeight(preview.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      setPreviewHeight(entry.contentRect.height);
    });
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  // Apply background's suggested tint whenever auto-adapt is on and the bg
  // changes.
  useEffect(() => {
    if (!autoTint) return;
    const current = BACKGROUNDS.find((b) => b.id === bgId);
    if (!current) return;
    setConfig((c) => {
      const t = c.tint;
      const s = current.suggestedTint;
      if (t.color === s.color && t.opacity === s.opacity) return c;
      return { ...c, tint: { ...s } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgId, autoTint]);

  const { resolved, uniforms, derivedUniforms } = useMemo(
    () => glassConfigToCSS(config),
    [config],
  );

  // UI glass panel — mirrors the preview's rim/lighting model (bevel depth,
  // bend zone, rim intensity, light) so the two glass surfaces read as the
  // same material under the same light. Panel diverges from preview on:
  //   - tint: solid black @ 72% for UI readability
  //   - corner radius: smaller (24px)
  //   - refraction + bevelWidth: kept subtle so text overlays don't warp
  //   - chromatic + specular: off (would distract at small UI scale)
  // Shares frost with preview because the renderer's body-blur is driven by
  // lens[0].frost and binds a single u_tex for all lenses.
  const panelUniforms = useMemo<GlassShaderUniforms>(
    () => ({
      radius: 24,
      refraction: 0.006,
      bevelDepth: uniforms.bevelDepth,
      bevelWidth: uniforms.bevelWidth,
      bendZone: uniforms.bendZone,
      frost: uniforms.frost,
      lightAngle: uniforms.lightAngle,
      lightIntensity: uniforms.lightIntensity,
      specularSize: 0.25,
      specularOpacity: 0,
      bevelHighlight: uniforms.bevelHighlight,
      tint: [0, 0, 0, 0.72],
      chromatic: 0,
      grain: 0,
    }),
    [
      uniforms.bevelDepth,
      uniforms.bevelWidth,
      uniforms.bendZone,
      uniforms.bevelHighlight,
      uniforms.frost,
      uniforms.lightAngle,
      uniforms.lightIntensity,
    ],
  );

  const setAdvanced = (patch: Partial<GlassAdvanced>) =>
    setConfig((c) => ({
      ...c,
      advanced: { ...c.advanced, ...patch },
      preset: null,
    }));

  const setDropShadow = (patch: Partial<GlassConfig["dropShadow"]>) =>
    setConfig((c) => ({
      ...c,
      dropShadow: { ...c.dropShadow, ...patch },
      preset: null,
    }));

  const setInnerShadow = (patch: Partial<GlassConfig["innerShadow"]>) =>
    setConfig((c) => ({
      ...c,
      innerShadow: { ...c.innerShadow, ...patch },
      preset: null,
    }));

  const exportCSS = useMemo(() => toVanillaCSS(resolved), [resolved]);

  const bg = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];

  const setLight = (patch: Partial<GlassConfig["light"]>) =>
    setConfig((c) => ({ ...c, light: { ...c.light, ...patch }, preset: null }));

  const setTint = (patch: Partial<GlassConfig["tint"]>) => {
    setAutoTint(false);
    setConfig((c) => ({
      ...c,
      tint: { ...c.tint, ...patch },
      preset: null,
    }));
  };

  const setGrain = (patch: Partial<GlassConfig["grain"]>) =>
    setConfig((c) => ({ ...c, grain: { ...c.grain, ...patch }, preset: null }));

  const setField = <K extends "depth" | "blur" | "borderRadius">(
    key: K,
    value: number,
  ) => setConfig((c) => ({ ...c, [key]: value, preset: null }));

  const changeBg = (id: string) => {
    setBgId(id);
    if (autoTint) {
      const next = BACKGROUNDS.find((b) => b.id === id);
      if (next) {
        setConfig((c) => ({ ...c, tint: { ...next.suggestedTint } }));
      }
    }
  };

  const toggleAutoTint = () => {
    const nowOn = !autoTint;
    setAutoTint(nowOn);
    if (nowOn) {
      const current = BACKGROUNDS.find((b) => b.id === bgId);
      if (current) {
        setConfig((c) => ({ ...c, tint: { ...current.suggestedTint } }));
      }
    }
  };

  const copyCSS = async () => {
    try {
      await navigator.clipboard.writeText(exportCSS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  /* ---- Advanced slider helpers -----------------------------------------
   * Advanced sliders show the derived value when `advanced[key]` is null,
   * the override value when set. uniformToUser converts the shader-space
   * derived number back into 0-100 for display.
   */
  const advancedValue = (key: keyof GlassAdvanced): number => {
    const v = config.advanced[key];
    if (v != null) return v;
    if (key === "saturation" || key === "brightness") return 100;
    const shaderKey = key as Parameters<typeof uniformToUser>[0];
    const raw = (derivedUniforms as unknown as Record<string, number>)[
      shaderKey
    ];
    if (typeof raw !== "number") return 0;
    return Math.round(uniformToUser(shaderKey, raw));
  };

  /* ---- Drop shadow derived values (mirrors glass-engine dropShadowCss) */
  const dsT = Math.min(Math.max(config.dropShadow.intensity, 0), 100) / 100;
  const dsDerived = {
    xOffset: 0,
    yOffset: Math.round(2 + (40 - 2) * dsT),
    blur: Math.round(6 + (80 - 6) * dsT),
    spread: 0,
    opacity: Math.round(10 + (45 - 10) * dsT),
  };

  const lightAngle = config.light.angle;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <div className="relative flex min-h-0 flex-1">
        {/* ================= PREVIEW (full width, glass floats on top) ============ */}
        <div
          ref={previewRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        >
          {/* Background image */}
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bg.src})` }}
            data-glass-ignore
          />

          {/* Primary (preview) glass anchor — draggable + resizable. */}
          <div
            ref={glassRef}
            className="group relative touch-none select-none rounded-[var(--r)]"
            onPointerDown={handleGlassPointerDown}
            onPointerMove={handleGlassPointerMove}
            onPointerUp={handleGlassPointerUp}
            onPointerCancel={handleGlassPointerUp}
            style={
              {
                width: `${glassSize.width}px`,
                height: `${glassSize.height}px`,
                "--r": `${config.borderRadius}px`,
                zIndex: 20,
                transform: `translate(${glassPos.x}px, ${glassPos.y}px)`,
                transition:
                  dragging || resizing
                    ? "none"
                    : "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
                cursor: dragging
                  ? "grabbing"
                  : resizing
                    ? HANDLE_CURSORS[resizing]
                    : "grab",
                boxShadow: combinedShadowCss(config),
              } as React.CSSProperties
            }
            data-glass-ignore
          >
            <ResizeHandles
              onPointerDownHandle={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              active={resizing}
            />
          </div>

          {/* Secondary glass anchor — the floating controls panel. Morphs
              between expanded and collapsed (Apple Dynamic-Island style).
              Transparent positioning container; WebGL renders glass into
              this rect. The children (logo, toggle, controls) sit on top
              because the canvas is at a lower z-index. */}
          <motion.div
            ref={panelRef}
            data-glass-ignore
            suppressHydrationWarning
            className="absolute top-4 right-4 z-20 flex flex-col overflow-hidden rounded-[24px]"
            initial={false}
            animate={{
              width: panelCollapsed ? PANEL_COLLAPSED_W : PANEL_EXPANDED_W,
              height: panelCollapsed
                ? PANEL_HEADER_H
                : Math.max(PANEL_HEADER_H, previewHeight - PANEL_MARGIN * 2),
            }}
            transition={PANEL_SPRING}
            style={{
              boxShadow:
                "0 24px 60px -20px rgba(0,0,0,0.55), 0 2px 8px -4px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header — logo left, collapse toggle right. Always visible. */}
            <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-3.5">
              <div className="pointer-events-none flex select-none items-center gap-2.5">
                <div
                  className="h-[18px] w-[18px] rounded-[5px]"
                  style={{
                    background:
                      "conic-gradient(from 315deg, rgba(255,255,255,0.95), rgba(255,255,255,0.1), rgba(255,255,255,0.95))",
                    boxShadow:
                      "inset 0 0 0 0.5px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.3)",
                  }}
                />
                <span
                  className="text-white"
                  style={{
                    fontFamily:
                      '"redaction-italic", "redaction", "redaction-35", serif',
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: "19px",
                    letterSpacing: "0.005em",
                    lineHeight: 1,
                  }}
                >
                  Glaze
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPanelCollapsed((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label={
                  panelCollapsed ? "Expand panel" : "Collapse panel"
                }
                title={panelCollapsed ? "Expand panel" : "Collapse panel"}
              >
                {panelCollapsed ? (
                  <Expand size={14} />
                ) : (
                  <Shrink size={14} />
                )}
              </button>
            </div>

            {/* Body — fades out BEFORE the container shrinks, fades in
                 AFTER the container finishes expanding. Clipped by the
                 parent's overflow-hidden during the morph. */}
            <motion.div
              initial={false}
              animate={{ opacity: panelCollapsed ? 0 : 1 }}
              transition={{
                duration: panelCollapsed ? 0.12 : 0.2,
                delay: panelCollapsed ? 0 : 0.22,
                ease: "easeOut",
              }}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6"
              style={{
                pointerEvents: panelCollapsed ? "none" : "auto",
              }}
              aria-hidden={panelCollapsed}
            >
              <ControlPanel
                config={config}
                derivedUniforms={derivedUniforms}
                advancedValue={advancedValue}
                autoTint={autoTint}
                lightAngle={lightAngle}
                dsDerived={dsDerived}
                setLight={setLight}
                setTint={setTint}
                setAutoTint={toggleAutoTint}
                setGrain={setGrain}
                setField={setField}
                setAdvanced={setAdvanced}
                setDropShadow={setDropShadow}
                setInnerShadow={setInnerShadow}
              />
            </motion.div>
          </motion.div>

          {/* WebGL renderer — samples `bg.src` and renders both lenses into
              their respective rects. */}
          <GlassCanvas
            targetRef={previewRef}
            glassRef={glassRef}
            uniforms={uniforms}
            panelRef={panelRef}
            panelUniforms={panelUniforms}
            captureKey={bgId}
            fastImageSrc={bg.src}
            preloadSrcs={BG_SRCS}
          />

          {/* Background switcher */}
          <div
            className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-md"
            data-glass-ignore
          >
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                onClick={() => changeBg(b.id)}
                className={`h-8 w-8 overflow-hidden rounded-full border bg-cover bg-center transition ${
                  bgId === b.id
                    ? "scale-110 border-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                    : "border-white/20 hover:scale-105"
                }`}
                style={{ backgroundImage: `url(${b.src})` }}
                title={b.label}
                aria-label={b.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Export bar — unchanged */}
      <div
        className="flex shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#070707] transition-[height] duration-300 ease-out"
        style={{ height: exportOpen ? 260 : 44 }}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-2.5">
          <div className="flex items-center gap-1">
            <button className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
              CSS
            </button>
            <button
              disabled
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white/30"
              title="Coming soon"
            >
              React (WebGL)
            </button>
            <button
              disabled
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white/30"
            >
              SwiftUI
            </button>
            <button
              disabled
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white/30"
            >
              AI Prompt
            </button>
            <button
              disabled
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-white/30"
            >
              JSON
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCSS}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label={exportOpen ? "Collapse code panel" : "Expand code panel"}
              title={exportOpen ? "Collapse" : "Expand"}
            >
              {exportOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto px-5 py-4 font-mono text-[11px] leading-5 text-white/75">
          <code>{exportCSS}</code>
        </pre>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Control panel — the 7 sections inside the floating glass panel             */
/* ========================================================================== */

interface ControlPanelProps {
  config: GlassConfig;
  derivedUniforms: GlassShaderUniforms;
  advancedValue: (key: keyof GlassAdvanced) => number;
  autoTint: boolean;
  lightAngle: number;
  dsDerived: {
    xOffset: number;
    yOffset: number;
    blur: number;
    spread: number;
    opacity: number;
  };
  setLight: (patch: Partial<GlassConfig["light"]>) => void;
  setTint: (patch: Partial<GlassConfig["tint"]>) => void;
  setAutoTint: () => void;
  setGrain: (patch: Partial<GlassConfig["grain"]>) => void;
  setField: (
    key: "depth" | "blur" | "borderRadius",
    value: number,
  ) => void;
  setAdvanced: (patch: Partial<GlassAdvanced>) => void;
  setDropShadow: (patch: Partial<GlassConfig["dropShadow"]>) => void;
  setInnerShadow: (
    patch: Partial<GlassConfig["innerShadow"]>,
  ) => void;
}

function ControlPanel({
  config,
  advancedValue,
  autoTint,
  lightAngle,
  dsDerived,
  setLight,
  setTint,
  setAutoTint,
  setGrain,
  setField,
  setAdvanced,
  setDropShadow,
  setInnerShadow,
}: ControlPanelProps) {
  const adv = config.advanced;
  const ins = config.innerShadow;
  const drs = config.dropShadow;

  return (
    <div className="space-y-0">
      {/* 1 — Light ---------------------------------------------------- */}
      <Section title="Light">
        <div className="px-0.5 py-1">
          <AnglePicker
            value={lightAngle}
            onChange={(angle) => setLight({ angle })}
          />
        </div>
        <PillSlider
          label="Angle"
          value={lightAngle}
          min={0}
          max={360}
          suffix="°"
          onChange={(angle) => setLight({ angle })}
        />
      </Section>

      {/* 2 — Material ------------------------------------------------- */}
      <Section title="Material">
        <ColorPill
          label="Tint"
          color={config.tint.color}
          onChange={(color) => setTint({ color })}
        />
        <PillSlider
          label="Opacity"
          value={config.tint.opacity}
          min={0}
          max={50}
          suffix="%"
          onChange={(opacity) => setTint({ opacity })}
        />
        <TogglePill
          label="Auto-adapt to background"
          value={autoTint}
          onChange={setAutoTint}
        />
        <PillSlider
          label="Frost"
          value={advancedValue("frost")}
          min={0}
          max={100}
          isOverridden={adv.frost != null}
          onReset={() => setAdvanced({ frost: null })}
          onChange={(v) => setAdvanced({ frost: v })}
        />
        <PillSlider
          label="Saturation"
          value={advancedValue("saturation")}
          min={0}
          max={200}
          suffix="%"
          isOverridden={adv.saturation != null}
          onReset={() => setAdvanced({ saturation: null })}
          onChange={(v) => setAdvanced({ saturation: v })}
        />
        <PillSlider
          label="Brightness"
          value={advancedValue("brightness")}
          min={0}
          max={200}
          suffix="%"
          isOverridden={adv.brightness != null}
          onReset={() => setAdvanced({ brightness: null })}
          onChange={(v) => setAdvanced({ brightness: v })}
        />
        <TogglePill
          label="Grain"
          value={config.grain.enabled}
          onChange={(enabled) => setGrain({ enabled })}
        />
        {config.grain.enabled ? (
          <PillSlider
            label="Grain intensity"
            value={config.grain.intensity}
            min={0}
            max={10}
            step={0.5}
            suffix="%"
            onChange={(intensity) => setGrain({ intensity })}
          />
        ) : null}
      </Section>

      {/* 3 — Refraction ---------------------------------------------- */}
      <Section title="Refraction">
        <PillSlider
          label="Refraction"
          value={advancedValue("refraction")}
          min={0}
          max={100}
          isOverridden={adv.refraction != null}
          onReset={() => setAdvanced({ refraction: null })}
          onChange={(v) => setAdvanced({ refraction: v })}
        />
        <PillSlider
          label="Bevel depth"
          value={advancedValue("bevelDepth")}
          min={0}
          max={100}
          isOverridden={adv.bevelDepth != null}
          onReset={() => setAdvanced({ bevelDepth: null })}
          onChange={(v) => setAdvanced({ bevelDepth: v })}
        />
        <PillSlider
          label="Bevel width"
          value={advancedValue("bevelWidth")}
          min={0}
          max={100}
          isOverridden={adv.bevelWidth != null}
          onReset={() => setAdvanced({ bevelWidth: null })}
          onChange={(v) => setAdvanced({ bevelWidth: v })}
        />
        <PillSlider
          label="Bend zone"
          value={advancedValue("bendZone")}
          min={0}
          max={100}
          isOverridden={adv.bendZone != null}
          onReset={() => setAdvanced({ bendZone: null })}
          onChange={(v) => setAdvanced({ bendZone: v })}
        />
        <PillSlider
          label="Chromatic"
          value={advancedValue("chromatic")}
          min={0}
          max={100}
          isOverridden={adv.chromatic != null}
          onReset={() => setAdvanced({ chromatic: null })}
          onChange={(v) => setAdvanced({ chromatic: v })}
        />
      </Section>

      {/* 4 — Rim ------------------------------------------------------ */}
      <Section title="Rim">
        <PillSlider
          label="Rim intensity"
          value={advancedValue("bevelHighlight")}
          min={0}
          max={100}
          isOverridden={adv.bevelHighlight != null}
          onReset={() => setAdvanced({ bevelHighlight: null })}
          onChange={(v) => setAdvanced({ bevelHighlight: v })}
        />
        <PillSlider
          label="Specular size"
          value={advancedValue("specularSize")}
          min={0}
          max={100}
          isOverridden={adv.specularSize != null}
          onReset={() => setAdvanced({ specularSize: null })}
          onChange={(v) => setAdvanced({ specularSize: v })}
        />
        <PillSlider
          label="Specular opacity"
          value={advancedValue("specularOpacity")}
          min={0}
          max={100}
          isOverridden={adv.specularOpacity != null}
          onReset={() => setAdvanced({ specularOpacity: null })}
          onChange={(v) => setAdvanced({ specularOpacity: v })}
        />
      </Section>

      {/* 5 — Shape ---------------------------------------------------- */}
      <Section title="Shape">
        <PillSlider
          label="Corner radius"
          value={config.borderRadius}
          min={0}
          max={60}
          suffix="px"
          onChange={(v) => setField("borderRadius", v)}
        />
      </Section>

      {/* 6 — Inner shadow -------------------------------------------- */}
      <Section title="Inner shadow">
        <ColorPill
          label="Color"
          color={ins.color}
          onChange={(color) => setInnerShadow({ color })}
        />
        <PillSlider
          label="Opacity"
          value={ins.opacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setInnerShadow({ opacity: v })}
        />
        <PillSlider
          label="X offset"
          value={ins.xOffset}
          min={-60}
          max={60}
          suffix="px"
          onChange={(v) => setInnerShadow({ xOffset: v })}
        />
        <PillSlider
          label="Y offset"
          value={ins.yOffset}
          min={-60}
          max={60}
          suffix="px"
          onChange={(v) => setInnerShadow({ yOffset: v })}
        />
        <PillSlider
          label="Blur"
          value={ins.blur}
          min={0}
          max={100}
          suffix="px"
          onChange={(v) => setInnerShadow({ blur: v })}
        />
        <PillSlider
          label="Spread"
          value={ins.spread}
          min={-40}
          max={40}
          suffix="px"
          onChange={(v) => setInnerShadow({ spread: v })}
        />
      </Section>

      {/* 7 — Drop shadow --------------------------------------------- */}
      <Section title="Drop shadow">
        <ColorPill
          label="Color"
          color={drs.color}
          onChange={(color) => setDropShadow({ color })}
        />
        <PillSlider
          label="Opacity"
          value={drs.opacity ?? dsDerived.opacity}
          min={0}
          max={100}
          suffix="%"
          isOverridden={drs.opacity != null}
          onReset={() => setDropShadow({ opacity: null })}
          onChange={(v) => setDropShadow({ opacity: v })}
        />
        <PillSlider
          label="X offset"
          value={drs.xOffset ?? dsDerived.xOffset}
          min={-60}
          max={60}
          suffix="px"
          isOverridden={drs.xOffset != null}
          onReset={() => setDropShadow({ xOffset: null })}
          onChange={(v) => setDropShadow({ xOffset: v })}
        />
        <PillSlider
          label="Y offset"
          value={drs.yOffset ?? dsDerived.yOffset}
          min={-60}
          max={60}
          suffix="px"
          isOverridden={drs.yOffset != null}
          onReset={() => setDropShadow({ yOffset: null })}
          onChange={(v) => setDropShadow({ yOffset: v })}
        />
        <PillSlider
          label="Blur"
          value={drs.blur ?? dsDerived.blur}
          min={0}
          max={100}
          suffix="px"
          isOverridden={drs.blur != null}
          onReset={() => setDropShadow({ blur: null })}
          onChange={(v) => setDropShadow({ blur: v })}
        />
        <PillSlider
          label="Spread"
          value={drs.spread ?? dsDerived.spread}
          min={-40}
          max={40}
          suffix="px"
          isOverridden={drs.spread != null}
          onReset={() => setDropShadow({ spread: null })}
          onChange={(v) => setDropShadow({ spread: v })}
        />
      </Section>

      <div className="h-4" />
    </div>
  );
}

/* ========================================================================== */
/* Resize handles + Angle picker                                              */
/* ========================================================================== */

/**
 * Eight drag handles positioned at the glass edges and corners. Edges resize
 * one axis, corners resize both. Hidden by default, revealed on hover (or
 * while a resize is active).
 */
function ResizeHandles({
  onPointerDownHandle,
  onPointerMove,
  onPointerUp,
  active,
}: {
  onPointerDownHandle: (
    h: ResizeHandle,
  ) => (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  active: ResizeHandle | null;
}) {
  const CORNER_SIZE = 14;
  const EDGE_THICKNESS = 10;

  const positions: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE },
    ne: { top: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE },
    sw: { bottom: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE },
    se: { bottom: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE },
    n: { top: -EDGE_THICKNESS / 2, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS },
    s: { bottom: -EDGE_THICKNESS / 2, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS },
    w: { left: -EDGE_THICKNESS / 2, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS },
    e: { right: -EDGE_THICKNESS / 2, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS },
  };

  const handles: ResizeHandle[] = ["nw", "ne", "sw", "se", "n", "s", "w", "e"];

  return (
    <>
      {handles.map((h) => {
        const isCorner = h.length === 2;
        const visible = active === h;
        return (
          <div
            key={h}
            data-glass-ignore
            onPointerDown={onPointerDownHandle(h)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`absolute touch-none select-none transition-opacity ${
              active ? "" : "opacity-0 group-hover:opacity-100"
            } ${visible || !active ? "" : "opacity-0"}`}
            style={{
              ...positions[h],
              cursor: HANDLE_CURSORS[h],
              zIndex: 25,
            }}
          >
            {isCorner ? (
              <div
                className="absolute inset-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#3b82f6] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.3)]"
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function AnglePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (angle: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    onChange(Math.round(deg));
  };

  const rad = ((value - 90) * Math.PI) / 180;
  const handleX = 50 + 42 * Math.cos(rad);
  const handleY = 50 + 42 * Math.sin(rad);

  return (
    <div className="flex items-center gap-4 px-1 py-1">
      <div
        ref={ref}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) handlePointer(e);
        }}
        className="relative h-[78px] w-[78px] shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <div className="absolute inset-0 rounded-full border border-white/15 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(10,10,10,0.6),0_0_8px_rgba(255,255,255,0.5)]"
          style={{ left: `${handleX}%`, top: `${handleY}%` }}
        />
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" />
      </div>
      <div className="flex-1 text-[11px] text-white/55">
        Drag the handle or use the slider below to rotate the lighting
        direction.
      </div>
    </div>
  );
}
