import { createContext, useContext } from "react";
import type {
  GlazeCapabilityResult,
  GlazeRendererDiagnostics,
} from "../types";

export interface OpticalControlRegistration {
  readonly id: string;
  readonly element: HTMLElement;
  readonly selectionCount: number;
  readonly selectedPosition: number;
  readonly selectionVisible: boolean;
}

export interface GlazeSurfaceRuntime {
  readonly capability: GlazeCapabilityResult;
  readonly material: string;
  register(registration: OpticalControlRegistration): () => void;
  update(
    id: string,
    selectionCount: number,
    selectedPosition: number,
    selectionVisible: boolean,
  ): void;
  energize(id: string, active: boolean): void;
  release(id: string): void;
  getRendererDiagnostics(): GlazeRendererDiagnostics | undefined;
}

export const GlazeSurfaceContext = createContext<GlazeSurfaceRuntime | null>(
  null,
);

export function useGlazeSurface(): GlazeSurfaceRuntime {
  const surface = useContext(GlazeSurfaceContext);
  if (!surface) {
    throw new Error(
      "Glaze optical controls require a GlazeRefractSource or GlazeMediaSurface ancestor",
    );
  }
  return surface;
}

export function useOptionalGlazeSurface(): GlazeSurfaceRuntime | null {
  return useContext(GlazeSurfaceContext);
}
