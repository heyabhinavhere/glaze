"use client";

import { Glass, type GlassOptics } from "@samasante/liquid-glass";
import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "../adoption.module.css";

export type AdoptionCase = "dom" | "duplicate" | "webgl" | "optics";

interface AdoptionDiagnostics {
  getDiagnostics: () => {
    caseId: AdoptionCase;
    glassCount: number;
    filterCount: number;
    uniqueFilterCount: number;
    duplicateIds: string[];
    semanticButtonCount: number;
    webglUnavailable: boolean;
    webglCanvasDisplay: string | null;
  };
}

declare global {
  interface Window {
    __glazeAdoption?: AdoptionDiagnostics;
  }
}

const CONTROLLED_OPTICS: Partial<GlassOptics> = Object.freeze({
  // Gate 2 isolated a coloured flash at the lens edge. This is the only
  // optical change allowed in Gate 3: reduce dispersion and change nothing
  // else, so the evidence can answer one question instead of hiding a retune.
  dispersion: 0.16,
});

function DecorativeTrack({ tone = 0 }: { tone?: number }) {
  return (
    <div className={styles.decorativeTrack} data-tone={tone} aria-hidden="true">
      <span />
    </div>
  );
}

function SafeLens({
  id,
  tuned = false,
}: {
  id: string;
  tuned?: boolean;
}) {
  return (
    <div className={styles.safeControl} data-testid={`safe-lens-${id}`}>
      <DecorativeTrack tone={Number(id) % 3} />
      <Glass
        className={styles.safeGlass}
        data-adoption-lens={id}
        data-optics={tuned ? "controlled-dispersion" : "package-default"}
        width={92}
        height={38}
        radius={19}
        center={{ x: 0.22 + (Number(id) % 3) * 0.28, y: 0.5 }}
        optics={tuned ? CONTROLLED_OPTICS : undefined}
        refract={<DecorativeTrack tone={Number(id) % 3} />}
        behind="transparent"
      />
      <div className={styles.safeLabels} role="group" aria-label={`View ${id}`}>
        <button type="button">Today</button>
        <button type="button">Week</button>
        <button type="button">Month</button>
      </div>
    </div>
  );
}

function DomStressCase() {
  const [generation, setGeneration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const instances = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  return (
    <section className={styles.caseSection} aria-labelledby="dom-case-title">
      <div className={styles.caseHeading}>
        <div>
          <p>DECORATIVE-ONLY CONTRACT</p>
          <h2 id="dom-case-title">Remount, resize, scroll, transform, and six lenses</h2>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => setGeneration((value) => value + 1)}>
            Remount lenses
          </button>
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            Resize suite
          </button>
        </div>
      </div>
      <div
        key={generation}
        className={styles.stressGrid}
        data-expanded={expanded}
        data-generation={generation}
      >
        {instances.map((instance) => (
          <article key={instance} className={styles.stressCard}>
            <span>Instance {instance + 1}</span>
            <SafeLens id={String(instance)} />
          </article>
        ))}
      </div>
      <div className={styles.scrollFrame} data-testid="scroll-frame">
        <div className={styles.transformedProbe}>
          <span>Transformed inside a scroll container</span>
          <SafeLens id="9" />
        </div>
      </div>
    </section>
  );
}

function DuplicationCase() {
  const unsafeContent = (
    <button id="sensitive-action" type="button">
      Sensitive action
    </button>
  );

  return (
    <section className={styles.caseSection} aria-labelledby="duplicate-case-title">
      <div className={styles.caseHeading}>
        <div>
          <p>CONTRACT FAILURE PROBE</p>
          <h2 id="duplicate-case-title">A copied semantic subtree is still semantic</h2>
        </div>
      </div>
      <div className={styles.duplicateComparison}>
        <article>
          <h3>Unsafe broad promise</h3>
          <p>The real application subtree and the optical copy reuse the same ID.</p>
          <div className={styles.originalContent}>{unsafeContent}</div>
          <Glass
            className={styles.duplicateGlass}
            width={180}
            height={48}
            radius={24}
            refract={unsafeContent}
            behind="transparent"
          />
        </article>
        <article>
          <h3>Allowed narrow promise</h3>
          <p>The copied input is decorative and explicitly hidden; semantics live once.</p>
          <button id="safe-action" type="button">
            Safe action
          </button>
          <Glass
            className={styles.duplicateGlass}
            width={180}
            height={48}
            radius={24}
            refract={<DecorativeTrack tone={2} />}
            behind="transparent"
          />
        </article>
      </div>
    </section>
  );
}

function PackageWebglGlass() {
  return (
    <Glass
      className={styles.webglGlass}
      style={{ width: 320, height: 180 }}
      width={108}
      height={52}
      radius={26}
      draw={(context, time) => {
        const width = context.canvas.width;
        const height = context.canvas.height;
        const gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#173b55");
        gradient.addColorStop(0.5, "#d46f52");
        gradient.addColorStop(1, "#254c40");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.fillStyle = "rgba(255,255,255,.7)";
        const x = ((time * 0.04) % (width + 80)) - 40;
        context.fillRect(x, 0, 22, height);
      }}
    />
  );
}

function DetachedStrictRoot() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = createRoot(host);
    root.render(
      <StrictMode>
        <PackageWebglGlass />
      </StrictMode>,
    );
    return () => root.unmount();
  }, []);

  return <div ref={hostRef} />;
}

function WebglStrictModeCase() {
  return (
    <section className={styles.caseSection} aria-labelledby="webgl-case-title">
      <div className={styles.caseHeading}>
        <div>
          <p>UPSTREAM ISSUE #2 REPRODUCTION</p>
          <h2 id="webgl-case-title">The package WebGL path under React Strict Mode</h2>
        </div>
      </div>
      <div className={styles.webglProbe} data-testid="package-webgl-probe">
        <DetachedStrictRoot />
      </div>
      <p className={styles.probeNote}>
        Development should expose the published Strict Mode failure; production should render
        the canvas. Both states are recorded instead of normalized away.
      </p>
    </section>
  );
}

function OpticsCase() {
  return (
    <section className={styles.caseSection} aria-labelledby="optics-case-title">
      <div className={styles.caseHeading}>
        <div>
          <p>ONE CONTROLLED REVISION</p>
          <h2 id="optics-case-title">Default dispersion versus 0.16</h2>
        </div>
      </div>
      <div className={styles.opticsGrid}>
        <article>
          <span>Published default</span>
          <SafeLens id="0" />
        </article>
        <article>
          <span>Only dispersion changed</span>
          <SafeLens id="0" tuned />
        </article>
      </div>
    </section>
  );
}

export function AdoptionProbe({ caseId }: { caseId: AdoptionCase }) {
  useLayoutEffect(() => {
    window.__glazeAdoption = {
      getDiagnostics: () => {
        const ids = Array.from(document.querySelectorAll<HTMLElement>("[id]"), (node) => node.id);
        const duplicateIds = Array.from(new Set(ids.filter((id, index) => ids.indexOf(id) !== index)));
        const filterIds = Array.from(
          document.querySelectorAll<SVGFilterElement>("[data-liquid-glass] filter[id]"),
          (filter) => filter.id,
        );
        const probe = document.querySelector('[data-testid="package-webgl-probe"]');
        const canvas = probe?.querySelector("canvas") ?? null;
        return {
          caseId,
          glassCount: document.querySelectorAll("[data-liquid-glass]").length,
          filterCount: filterIds.length,
          uniqueFilterCount: new Set(filterIds).size,
          duplicateIds,
          semanticButtonCount: document.querySelectorAll("button").length,
          webglUnavailable: probe?.textContent?.includes("WebGL unavailable") ?? false,
          webglCanvasDisplay: canvas ? getComputedStyle(canvas).display : null,
        };
      },
    };
    return () => {
      delete window.__glazeAdoption;
    };
  }, [caseId]);

  useEffect(() => {
    document.documentElement.dataset.adoptionReady = caseId;
    return () => {
      delete document.documentElement.dataset.adoptionReady;
    };
  }, [caseId]);

  return (
    <main className={styles.page} data-adoption-shell="server" data-case={caseId}>
      <header className={styles.pageHeader}>
        <div>
          <p>Glaze · Gate 3</p>
          <h1>Candidate adoption probe</h1>
        </div>
        <nav aria-label="Probe case">
          {(["dom", "duplicate", "webgl", "optics"] as const).map((item) => (
            <a key={item} href={`/research/adoption?case=${item}`} aria-current={caseId === item ? "page" : undefined}>
              {item}
            </a>
          ))}
        </nav>
      </header>
      {caseId === "dom" && <DomStressCase />}
      {caseId === "duplicate" && <DuplicationCase />}
      {caseId === "webgl" && <WebglStrictModeCase />}
      {caseId === "optics" && <OpticsCase />}
    </main>
  );
}
