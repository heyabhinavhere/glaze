import { ExplicitVideoGlass } from "./_components/ExplicitVideoGlass";
import type { ExplicitVideoMetadata } from "./_lib/source-contract";
import styles from "./video.module.css";

const explicitVideo: ExplicitVideoMetadata = Object.freeze({
  id: "m2-explicit-flower-video",
  label: "Flower research video transport",
  sources: Object.freeze([
    Object.freeze({ src: "/m1-flower.webm", type: "video/webm" as const }),
    Object.freeze({ src: "/m1-flower.mp4", type: "video/mp4" as const }),
  ]),
  provenance:
    "Research-only local fixture. Source and license provenance remain unresolved; do not distribute.",
});

export default function M2ExplicitVideoPage() {
  return (
    <main className={styles.page} data-m2-shell="server">
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Glaze · Milestone 2</p>
          <h1>Explicit video, integrated honestly.</h1>
        </div>
        <p>
          A Server Component shell passes serializable source metadata to one
          narrow client island. WebGL samples only that owned video; controls
          remain normal semantic DOM.
        </p>
      </header>

      <ExplicitVideoGlass source={explicitVideo} />

      <section className={styles.contract} aria-labelledby="m2-contract-title">
        <h2 id="m2-contract-title">This private slice proves</h2>
        <ul>
          <li>One explicit, same-origin video source—never surrounding DOM.</li>
          <li>The accepted WebGL material without new configuration knobs.</li>
          <li>Stable semantic controls through SSR, hydration, and fallback.</li>
          <li>Demand-driven video uploads, cleanup, and observable failure.</li>
          <li>No Mode C, auto-detection, backdrop renderer, or public API.</li>
        </ul>
      </section>
    </main>
  );
}
