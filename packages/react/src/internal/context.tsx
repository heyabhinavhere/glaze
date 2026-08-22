"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  defaultGlazeMaterial,
  defaultGlazeMotion,
  resolveGlazeMaterial,
  resolveGlazeMotion,
} from "../material";
import type {
  GlazeCapabilityResult,
  GlazeMaterial,
  GlazeMaterialInput,
  GlazeMotion,
  GlazeRendererDiagnostics,
  GlazeRootProps,
} from "../types";

export interface GlazeSurfaceSnapshot extends GlazeCapabilityResult {
  readonly id: string;
  readonly material: string;
  readonly renderer?: GlazeRendererDiagnostics;
}

export interface GlazeSurfaceHandle {
  getSnapshot(): GlazeSurfaceSnapshot;
}

interface GlazeRuntimeContextValue {
  readonly materials: Readonly<Record<string, GlazeMaterial>>;
  readonly motion: GlazeMotion;
  readonly setMaterial: (name: string, material: GlazeMaterialInput) => void;
  readonly resetMaterial: (name: string) => void;
  readonly setMotion: (motion: Partial<GlazeMotion>) => void;
  readonly resetMotion: () => void;
  readonly registerSurface: (
    id: string,
    handle: GlazeSurfaceHandle,
  ) => () => void;
  readonly getSurfaceSnapshots: () => readonly GlazeSurfaceSnapshot[];
}

const GlazeRuntimeContext = createContext<GlazeRuntimeContextValue | null>(
  null,
);

function resolveRegistry(
  registry: GlazeRootProps["materials"],
): Record<string, GlazeMaterial> {
  const resolved: Record<string, GlazeMaterial> = {
    default: defaultGlazeMaterial,
  };
  for (const [name, material] of Object.entries(registry ?? {})) {
    resolved[name] = resolveGlazeMaterial(material);
  }
  return resolved;
}

export function GlazeRoot({
  children,
  materials: initialMaterials,
  motion: initialMotion,
}: GlazeRootProps) {
  const resolvedInitialMaterials = useMemo(
    () => resolveRegistry(initialMaterials),
    [initialMaterials],
  );
  const resolvedInitialMotion = useMemo(
    () => resolveGlazeMotion(initialMotion),
    [initialMotion],
  );
  const [materials, setMaterials] = useState<
    Readonly<Record<string, GlazeMaterial>>
  >(() => resolvedInitialMaterials);
  const [motion, updateMotion] = useState<GlazeMotion>(
    () => resolvedInitialMotion,
  );
  const surfaces = useRef(new Map<string, GlazeSurfaceHandle>());

  const setMaterial = useCallback(
    (name: string, material: GlazeMaterialInput) => {
      setMaterials((current) => ({
        ...current,
        [name]: resolveGlazeMaterial(material),
      }));
    },
    [],
  );
  const resetMaterial = useCallback((name: string) => {
    setMaterials((current) => ({
      ...current,
      [name]: resolvedInitialMaterials[name] ?? defaultGlazeMaterial,
    }));
  }, [resolvedInitialMaterials]);
  const setMotion = useCallback((next: Partial<GlazeMotion>) => {
    updateMotion((current) => resolveGlazeMotion({ ...current, ...next }));
  }, []);
  const resetMotion = useCallback(() => {
    updateMotion(resolvedInitialMotion);
  }, [resolvedInitialMotion]);
  const registerSurface = useCallback(
    (id: string, handle: GlazeSurfaceHandle) => {
      surfaces.current.set(id, handle);
      return () => {
        if (surfaces.current.get(id) === handle) surfaces.current.delete(id);
      };
    },
    [],
  );
  const getSurfaceSnapshots = useCallback(
    () => Array.from(surfaces.current.values(), (handle) => handle.getSnapshot()),
    [],
  );

  const value = useMemo<GlazeRuntimeContextValue>(
    () => ({
      materials,
      motion,
      setMaterial,
      resetMaterial,
      setMotion,
      resetMotion,
      registerSurface,
      getSurfaceSnapshots,
    }),
    [
      getSurfaceSnapshots,
      materials,
      motion,
      registerSurface,
      resetMaterial,
      resetMotion,
      setMaterial,
      setMotion,
    ],
  );

  return (
    <GlazeRuntimeContext.Provider value={value}>
      {children}
    </GlazeRuntimeContext.Provider>
  );
}

export function useGlazeRuntime(): GlazeRuntimeContextValue {
  const runtime = useContext(GlazeRuntimeContext);
  if (!runtime) throw new Error("Glaze components require a GlazeRoot ancestor");
  return runtime;
}

export function useGlazeMaterial(
  name = "default",
  defaults: GlazeMaterialInput = defaultGlazeMaterial,
): GlazeMaterial {
  const { materials, setMaterial } = useGlazeRuntime();
  const [initialDefaults] = useState(() => resolveGlazeMaterial(defaults));
  const material = materials[name];

  useEffect(() => {
    if (!material) {
      setMaterial(name, initialDefaults);
    }
  }, [initialDefaults, material, name, setMaterial]);

  return material ?? initialDefaults;
}
