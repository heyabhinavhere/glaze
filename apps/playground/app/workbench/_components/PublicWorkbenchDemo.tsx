"use client";

import {
  GlazeDiagnostics,
  GlazeMediaSurface,
  GlazeRefractSource,
  GlazeRoot,
  GlazeSegmentedControl,
  GlazeSlider,
  GlazeSwitch,
  GlazeWorkbench,
} from "@glazelab/react";
import { useState } from "react";
import styles from "../workbench.module.css";

const SEGMENTS = [
  { id: "focus", label: "Focus" },
  { id: "flow", label: "Flow" },
  { id: "form", label: "Form" },
] as const;

function OwnedArtwork() {
  const verticals = Array.from({ length: 17 }, (_, index) => index * 60);
  const horizontals = Array.from({ length: 13 }, (_, index) => index * 60);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="960"
      height="720"
      viewBox="0 0 960 720"
    >
      <rect width="960" height="720" fill="#11213b" />
      <circle cx="760" cy="120" r="270" fill="#df5d8a" opacity="0.82" />
      <circle cx="180" cy="610" r="330" fill="#176f91" opacity="0.9" />
      <path
        d="M-80 440 C180 180 420 640 1040 230 L1040 820 L-80 820 Z"
        fill="#edb549"
        opacity="0.56"
      />
      <path
        d="M-90 160 C220 420 610 -20 1050 360"
        fill="none"
        stroke="#f7e7ae"
        strokeWidth="18"
        opacity="0.82"
      />
      <g stroke="#f2fbff" strokeWidth="1" opacity="0.28">
        {verticals.map((x) => <path key={`v-${x}`} d={`M${x} 0 V720`} />)}
        {horizontals.map((y) => <path key={`h-${y}`} d={`M0 ${y} H960`} />)}
      </g>
      <g fill="#f8fdff" opacity="0.76">
        <rect x="74" y="82" width="280" height="12" rx="6" />
        <rect x="74" y="112" width="188" height="7" rx="3.5" />
        <rect x="706" y="580" width="174" height="9" rx="4.5" />
      </g>
    </svg>
  );
}

interface ControlsProps {
  readonly prefix: string;
  readonly period: string;
  readonly live: boolean;
  readonly transmission: number;
  readonly onPeriodChange: (value: string) => void;
  readonly onLiveChange: (value: boolean) => void;
  readonly onTransmissionChange: (value: number) => void;
}

function Controls({
  prefix,
  period,
  live,
  transmission,
  onPeriodChange,
  onLiveChange,
  onTransmissionChange,
}: ControlsProps) {
  return (
    <div className={styles.controls}>
      <GlazeSegmentedControl
        aria-label={`${prefix} view mode`}
        segments={SEGMENTS}
        value={period}
        onValueChange={onPeriodChange}
      />
      <div className={styles.controlRow}>
        <span>Live optics</span>
        <GlazeSwitch
          aria-label={`${prefix} live optics`}
          checked={live}
          onCheckedChange={onLiveChange}
        />
      </div>
      <GlazeSlider
        aria-label={`${prefix} transmission`}
        label="Transmission"
        value={transmission}
        onValueChange={onTransmissionChange}
      />
    </div>
  );
}

export function PublicWorkbenchDemo() {
  const [ownedPeriod, setOwnedPeriod] = useState("flow");
  const [ownedLive, setOwnedLive] = useState(true);
  const [ownedTransmission, setOwnedTransmission] = useState(62);
  const [mediaPeriod, setMediaPeriod] = useState("flow");
  const [mediaLive, setMediaLive] = useState(true);
  const [mediaTransmission, setMediaTransmission] = useState(62);

  return (
    <GlazeRoot>
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <p>Public API gate · accepted optics</p>
          <h1>The live material is now the workbench.</h1>
          <span>
            One public runtime · two explicit source contracts · no preview clone
          </span>
        </header>

        <section className={styles.proofGrid} aria-label="Public API proof">
          <GlazeRefractSource
            className={styles.surface}
            source={<OwnedArtwork />}
          >
            <header className={styles.surfaceHeader}>
              <p>owned-decoration</p>
              <h2>React artwork</h2>
              <span>Inert and aria-hidden source · semantic controls above</span>
            </header>
            <Controls
              prefix="Owned source"
              period={ownedPeriod}
              live={ownedLive}
              transmission={ownedTransmission}
              onPeriodChange={setOwnedPeriod}
              onLiveChange={setOwnedLive}
              onTransmissionChange={setOwnedTransmission}
            />
            <GlazeDiagnostics className={styles.diagnostics} compact />
          </GlazeRefractSource>

          <GlazeMediaSurface
            className={styles.surface}
            source={{
              type: "video",
              sources: [
                { src: "/m1-flower.webm", type: "video/webm" },
                { src: "/m1-flower.mp4", type: "video/mp4" },
              ],
            }}
          >
            <header className={styles.surfaceHeader}>
              <p>explicit-media</p>
              <h2>Shared video texture</h2>
              <span>One source renderer · three lenses</span>
            </header>
            <Controls
              prefix="Media source"
              period={mediaPeriod}
              live={mediaLive}
              transmission={mediaTransmission}
              onPeriodChange={setMediaPeriod}
              onLiveChange={setMediaLive}
              onTransmissionChange={setMediaTransmission}
            />
            <GlazeDiagnostics className={styles.diagnostics} compact />
          </GlazeMediaSurface>
        </section>

        <GlazeWorkbench className={styles.workbench} enabled />
      </main>
    </GlazeRoot>
  );
}
