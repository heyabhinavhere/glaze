"use client";

import { SourceSurface } from "./internal/source-surface";
import type {
  GlazeMediaSurfaceProps,
  GlazeRefractSourceProps,
} from "./types";

export function GlazeRefractSource({
  children,
  material = "default",
  materialDefaults,
  source,
  ...props
}: GlazeRefractSourceProps) {
  return (
    <SourceSurface
      {...props}
      capability="owned-decoration"
      material={material}
      materialDefaults={materialDefaults}
      ownedSource={source}
    >
      {children}
    </SourceSurface>
  );
}

export function GlazeMediaSurface({
  children,
  material = "default",
  materialDefaults,
  source,
  ...props
}: GlazeMediaSurfaceProps) {
  return (
    <SourceSurface
      {...props}
      capability="explicit-media"
      material={material}
      materialDefaults={materialDefaults}
      mediaSource={source}
    >
      {children}
    </SourceSurface>
  );
}
