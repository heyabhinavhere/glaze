"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultGlazeMaterial,
  glazeMaterialPresets,
} from "./material";
import { useGlazeMaterial, useGlazeRuntime } from "./internal/context";
import type {
  GlazeSurfaceSnapshot,
} from "./internal/context";
import type { GlazeMaterial, GlazeWorkbenchProps } from "./types";

interface NumberFieldProps {
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
  readonly step: number;
  readonly value: number;
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: NumberFieldProps) {
  return (
    <label className="glaze-workbench__field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <output>{Number(value.toFixed(4))}</output>
    </label>
  );
}

function materialExport(name: string, material: GlazeMaterial) {
  const json = JSON.stringify(material, null, 2);
  return {
    json,
    react: `<GlazeRoot materials={{ ${JSON.stringify(name)}: ${json} }}>
  {/* The live Glaze source surface and controls */}
</GlazeRoot>`,
  };
}

export default function WorkbenchPanel({
  className,
  material: materialName = "default",
  ...props
}: Omit<GlazeWorkbenchProps, "enabled">) {
  const runtime = useGlazeRuntime();
  const material = useGlazeMaterial(materialName, defaultGlazeMaterial);
  const [format, setFormat] = useState<"json" | "react">("json");
  const [copied, setCopied] = useState(false);
  const [surfaces, setSurfaces] = useState<readonly GlazeSurfaceSnapshot[]>([]);
  const exported = useMemo(
    () => materialExport(materialName, material),
    [material, materialName],
  );
  const output = exported[format];

  useEffect(() => {
    const update = () => setSurfaces(runtime.getSurfaceSnapshots());
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [runtime]);

  const updateMaterial = (next: GlazeMaterial) => {
    runtime.setMaterial(materialName, next);
    setCopied(false);
  };
  const update = <Key extends keyof GlazeMaterial>(
    key: Key,
    value: GlazeMaterial[Key],
  ) => updateMaterial({ ...material, [key]: value });

  return (
    <aside
      {...props}
      className={["glaze-workbench", className].filter(Boolean).join(" ")}
      data-glaze-workbench="true"
      aria-label="Glaze workbench"
    >
      <header className="glaze-workbench__header">
        <div>
          <p>Glaze workbench</p>
          <h2>{materialName}</h2>
        </div>
        <button type="button" onClick={() => runtime.resetMaterial(materialName)}>
          Reset
        </button>
      </header>

      <section className="glaze-workbench__presets" aria-label="Material presets">
        {Object.entries(glazeMaterialPresets).map(([name, preset]) => (
          <button
            key={name}
            type="button"
            onClick={() => updateMaterial(preset)}
          >
            {name}
          </button>
        ))}
      </section>

      <section className="glaze-workbench__fields" aria-label="Material values">
        <NumberField label="Refraction" min={0} max={2} step={0.01} value={material.refraction} onChange={(value) => update("refraction", value)} />
        <NumberField label="Thickness" min={0} max={2} step={0.01} value={material.thickness} onChange={(value) => update("thickness", value)} />
        <NumberField label="Dispersion" min={0} max={2} step={0.01} value={material.dispersion} onChange={(value) => update("dispersion", value)} />
        <NumberField label="Roughness" min={0} max={1} step={0.01} value={material.roughness} onChange={(value) => update("roughness", value)} />
        <NumberField label="Transmission" min={0} max={1} step={0.001} value={material.transmission} onChange={(value) => update("transmission", value)} />
        <label className="glaze-workbench__field">
          <span>Tint</span>
          <input
            type="color"
            value={material.tint.color}
            onChange={(event) => update("tint", {
              ...material.tint,
              color: event.currentTarget.value,
            })}
          />
          <output>{material.tint.color}</output>
        </label>
        <NumberField label="Tint opacity" min={0} max={1} step={0.01} value={material.tint.opacity} onChange={(value) => update("tint", { ...material.tint, opacity: value })} />
        <NumberField label="Light angle" min={0} max={359} step={1} value={material.lighting.angle} onChange={(value) => update("lighting", { ...material.lighting, angle: value })} />
        <NumberField label="Highlight" min={0} max={2} step={0.01} value={material.lighting.highlight} onChange={(value) => update("lighting", { ...material.lighting, highlight: value })} />
        <NumberField label="Occlusion" min={0} max={2} step={0.01} value={material.lighting.occlusion} onChange={(value) => update("lighting", { ...material.lighting, occlusion: value })} />
        <NumberField label="Stiffness" min={1} max={1000} step={1} value={runtime.motion.stiffness} onChange={(value) => runtime.setMotion({ stiffness: value })} />
        <NumberField label="Damping" min={0} max={200} step={0.5} value={runtime.motion.damping} onChange={(value) => runtime.setMotion({ damping: value })} />
      </section>

      <section className="glaze-workbench__runtime" aria-label="Runtime diagnostics">
        <p>{surfaces.length} source surface{surfaces.length === 1 ? "" : "s"}</p>
        {surfaces.map((surface) => (
          <p key={surface.id}>
            {surface.requested} → {surface.effective}
            {surface.renderer ? ` · #${surface.renderer.rendererId}` : ""}
            {surface.reason ? ` · ${surface.reason}` : ""}
          </p>
        ))}
      </section>

      <section className="glaze-workbench__export" aria-label="Material export">
        <div role="radiogroup" aria-label="Export format">
          {(["json", "react"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={format === value}
              onClick={() => { setFormat(value); setCopied(false); }}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        <pre><code>{output}</code></pre>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(output);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy export"}
        </button>
      </section>
    </aside>
  );
}
