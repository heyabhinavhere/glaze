"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import {
  GlazeDiagnostics,
  GlazeSegmentedControl,
  glazeMaterials,
  type GlazeCapability,
  type GlazeMaterial,
  type GlazeMaterialName,
} from "@glazelab/react";
import { useMemo, useState } from "react";
import styles from "./workbench.module.css";

const segments = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

const presets = Object.keys(glazeMaterials) as GlazeMaterialName[];

const ranges = [
  { key: "clarity", label: "Clarity", min: 0, max: 100, suffix: "%" },
  { key: "frost", label: "Frost", min: 0, max: 100, suffix: "%" },
  {
    key: "tintOpacity",
    label: "Tint opacity",
    min: 0,
    max: 50,
    suffix: "%",
  },
  { key: "depth", label: "Depth", min: 0, max: 100, suffix: "%" },
  { key: "edge", label: "Edge light", min: 0, max: 100, suffix: "%" },
  {
    key: "lightAngle",
    label: "Light angle",
    min: 0,
    max: 359,
    suffix: "°",
  },
  { key: "radius", label: "Radius", min: 0, max: 48, suffix: "px" },
] as const;

const capabilityOptions: ReadonlyArray<{
  value: GlazeCapability;
  label: string;
}> = [
  { value: "css", label: "CSS — available" },
  { value: "explicit-media", label: "Explicit media — not enabled" },
  { value: "owned-decoration", label: "Owned decoration — research" },
  { value: "page-backdrop", label: "Page backdrop — unsupported" },
];

type PresetSelection = GlazeMaterialName | "custom";
type ExportMode = "react" | "json";

function sceneClass(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function materialCopy(material: GlazeMaterial): GlazeMaterial {
  return { ...material };
}

async function writeClipboardText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard write was rejected.");
  }
}

function Scene({
  capability,
  id,
  label,
  material,
  onValueChange,
  value,
}: {
  capability: GlazeCapability;
  id: "image" | "light" | "dark" | "text" | "motion";
  label: string;
  material: GlazeMaterial;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <article
      className={sceneClass(styles.scene, styles[`scene_${id}`])}
      data-scene={id}
    >
      <div aria-hidden="true" className={styles.sceneDecoration} />
      {id === "text" ? (
        <p aria-hidden="true" className={styles.textTexture}>
          Structure should remain legible through the material.
        </p>
      ) : null}
      {id === "motion" ? (
        <div aria-hidden="true" className={styles.motionTexture}>
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div className={styles.sceneMeta}>
        <span>{label}</span>
        <small>1× component</small>
      </div>
      <GlazeSegmentedControl
        aria-label={`${label} preview navigation`}
        capability={capability}
        className={styles.previewControl}
        material={material}
        onValueChange={onValueChange}
        segments={segments}
        value={value}
      />
    </article>
  );
}

export function GlazeWorkbench() {
  const [material, setMaterial] = useState<GlazeMaterial>(() =>
    materialCopy(glazeMaterials.regular),
  );
  const [preset, setPreset] = useState<PresetSelection>("regular");
  const [capability, setCapability] = useState<GlazeCapability>("css");
  const [selectedValue, setSelectedValue] = useState("overview");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [forcedColors, setForcedColors] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("react");
  const [copied, setCopied] = useState(false);

  const materialJson = useMemo(
    () => JSON.stringify(material, null, 2),
    [material],
  );
  const reactSnippet = useMemo(
    () => `import { GlazeSegmentedControl } from "@glazelab/react";
import "@glazelab/react/styles.css";

const material = ${materialJson} as const;

<GlazeSegmentedControl
  aria-label="Account section"
  capability="${capability}"
  material={material}
  defaultValue="overview"
  segments={[
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "settings", label: "Settings" },
  ]}
/>`,
    [capability, materialJson],
  );

  const updateNumber = (
    key: (typeof ranges)[number]["key"],
    value: number,
  ) => {
    setPreset("custom");
    setMaterial((current) => ({ ...current, [key]: value }));
    setCopied(false);
  };

  const applyPreset = (name: GlazeMaterialName) => {
    setPreset(name);
    setMaterial(materialCopy(glazeMaterials[name]));
    setCopied(false);
  };

  const reset = () => {
    applyPreset("regular");
    setCapability("css");
    setSelectedValue("overview");
    setReducedMotion(false);
    setForcedColors(false);
  };

  const copyExport = async () => {
    await writeClipboardText(
      exportMode === "react" ? reactSnippet : materialJson,
    );
    setCopied(true);
  };

  const previewClassName = sceneClass(
    styles.previewRegion,
    reducedMotion && "glaze-simulate-reduced-motion",
    forcedColors && "glaze-simulate-forced-colors",
  );

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span aria-hidden="true" className={styles.brandMark} />
          <div>
            <strong>Glaze</strong>
            <span>Material workbench</span>
          </div>
        </div>
        <div className={styles.releaseStatus}>
          <span aria-hidden="true" />
          CSS engine · static at idle
        </div>
      </header>

      <div className={styles.workspace}>
        <section aria-labelledby="preview-heading" className={styles.canvasPanel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Acceptance matrix</p>
              <h1 id="preview-heading">One material. Five hard scenes.</h1>
              <p>
                Judge clarity at real component scale. CSS is never labelled as
                refraction.
              </p>
            </div>
            <button className={styles.resetButton} onClick={reset} type="button">
              <RotateCcw aria-hidden="true" size={14} />
              Reset
            </button>
          </div>

          <div className={previewClassName} data-testid="acceptance-scenes">
            <Scene
              capability={capability}
              id="image"
              label="Image detail"
              material={material}
              onValueChange={setSelectedValue}
              value={selectedValue}
            />
            <Scene
              capability={capability}
              id="light"
              label="Light surface"
              material={material}
              onValueChange={setSelectedValue}
              value={selectedValue}
            />
            <Scene
              capability={capability}
              id="dark"
              label="Dark surface"
              material={material}
              onValueChange={setSelectedValue}
              value={selectedValue}
            />
            <Scene
              capability={capability}
              id="text"
              label="Text crossing"
              material={material}
              onValueChange={setSelectedValue}
              value={selectedValue}
            />
            <Scene
              capability={capability}
              id="motion"
              label="Interaction"
              material={material}
              onValueChange={setSelectedValue}
              value={selectedValue}
            />
          </div>

          <GlazeDiagnostics
            aria-label="Renderer diagnostics"
            capability={capability}
            className={styles.diagnostics}
            material={preset === "custom" ? material : preset}
          />
        </section>

        <aside aria-label="Material controls" className={styles.inspector}>
          <div className={styles.inspectorHeader}>
            <div>
              <p className={styles.eyebrow}>Inspector</p>
              <h2>Material</h2>
            </div>
            <span className={styles.presetState}>{preset}</span>
          </div>

          <section className={styles.inspectorSection}>
            <h3>Preset</h3>
            <div className={styles.presetGrid}>
              {presets.map((name) => (
                <button
                  aria-pressed={preset === name}
                  key={name}
                  onClick={() => applyPreset(name)}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.inspectorSection}>
            <h3>Optics</h3>
            <div className={styles.controlStack}>
              {ranges.map(({ key, label, max, min, suffix }) => (
                <label className={styles.rangeControl} key={key}>
                  <span>
                    {label}
                    <output>{material[key]}{suffix}</output>
                  </span>
                  <input
                    aria-label={label}
                    max={max}
                    min={min}
                    onChange={(event) =>
                      updateNumber(key, Number(event.currentTarget.value))
                    }
                    type="range"
                    value={material[key]}
                  />
                </label>
              ))}

              <label className={styles.colorControl}>
                <span>Tint</span>
                <span>
                  <code>{material.tint}</code>
                  <input
                    aria-label="Tint color"
                    onChange={(event) => {
                      const tint = event.currentTarget.value;
                      setPreset("custom");
                      setMaterial((current) => ({
                        ...current,
                        tint,
                      }));
                      setCopied(false);
                    }}
                    type="color"
                    value={material.tint}
                  />
                </span>
              </label>

              <label className={styles.selectControl}>
                <span>Motion</span>
                <select
                  onChange={(event) => {
                    const motion = event.currentTarget.value as GlazeMaterial["motion"];
                    setPreset("custom");
                    setMaterial((current) => ({
                      ...current,
                      motion,
                    }));
                    setCopied(false);
                  }}
                  value={material.motion}
                >
                  <option value="none">None</option>
                  <option value="subtle">Subtle</option>
                  <option value="expressive">Expressive</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.inspectorSection}>
            <h3>Renderer truth</h3>
            <label className={styles.selectControl}>
              <span>Requested capability</span>
              <select
                onChange={(event) => {
                  setCapability(event.currentTarget.value as GlazeCapability);
                  setCopied(false);
                }}
                value={capability}
              >
                {capabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.truthNote}>
              Effective renderer: <strong>CSS</strong>. Unsupported requests
              fall back visibly and keep semantic DOM intact.
            </p>
          </section>

          <section className={styles.inspectorSection}>
            <h3>Environment simulation</h3>
            <div className={styles.simulationGrid}>
              <label>
                <input
                  checked={reducedMotion}
                  onChange={(event) => setReducedMotion(event.currentTarget.checked)}
                  type="checkbox"
                />
                Reduced motion
              </label>
              <label>
                <input
                  checked={forcedColors}
                  onChange={(event) => setForcedColors(event.currentTarget.checked)}
                  type="checkbox"
                />
                Forced colors
              </label>
            </div>
          </section>

          <section className={sceneClass(styles.inspectorSection, styles.exportSection)}>
            <div className={styles.exportHeader}>
              <h3>Use it</h3>
              <button onClick={copyExport} type="button">
                {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div aria-label="Export format" className={styles.exportTabs} role="tablist">
              {(["react", "json"] as const).map((mode) => (
                <button
                  aria-selected={exportMode === mode}
                  key={mode}
                  onClick={() => {
                    setExportMode(mode);
                    setCopied(false);
                  }}
                  role="tab"
                  type="button"
                >
                  {mode === "react" ? "React" : "Material JSON"}
                </button>
              ))}
            </div>
            <pre aria-live="polite">
              <code>{exportMode === "react" ? reactSnippet : materialJson}</code>
            </pre>
          </section>
        </aside>
      </div>
    </main>
  );
}
