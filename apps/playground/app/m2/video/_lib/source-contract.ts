export interface ExplicitVideoSource {
  readonly src: string;
  readonly type: "video/webm" | "video/mp4";
}

export interface ExplicitVideoMetadata {
  readonly id: string;
  readonly label: string;
  readonly sources: readonly ExplicitVideoSource[];
  readonly provenance: string;
}

export interface ResolvedExplicitVideoContract {
  readonly sourceId: string;
  readonly urls: readonly string[];
  readonly sameOrigin: boolean;
  readonly failureReason: "source-missing" | "source-not-origin-clean" | null;
}

export function resolveExplicitVideoContract(
  metadata: ExplicitVideoMetadata,
  applicationOrigin: string,
): ResolvedExplicitVideoContract {
  if (metadata.sources.length === 0) {
    return {
      sourceId: metadata.id,
      urls: [],
      sameOrigin: false,
      failureReason: "source-missing",
    };
  }

  const urls = metadata.sources.map(
    (source) => new URL(source.src, applicationOrigin).href,
  );
  const sameOrigin = urls.every(
    (url) => new URL(url).origin === applicationOrigin,
  );

  return {
    sourceId: metadata.id,
    urls,
    sameOrigin,
    failureReason: sameOrigin ? null : "source-not-origin-clean",
  };
}

export function formatMediaTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const wholeSeconds = Math.floor(value);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
