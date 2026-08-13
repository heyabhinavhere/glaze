import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type GlazeCapability =
  | "css"
  | "explicit-media"
  | "owned-decoration"
  | "page-backdrop";

export type GlazeMotion = "none" | "subtle" | "expressive";

export interface GlazeMaterial {
  clarity: number;
  frost: number;
  tint: string;
  tintOpacity: number;
  depth: number;
  edge: number;
  lightAngle: number;
  radius: number;
  motion: GlazeMotion;
}

export type GlazeMaterialName = "clear" | "regular" | "frosted" | "dark";

export type GlazeMaterialInput =
  | GlazeMaterialName
  | Readonly<Partial<GlazeMaterial>>;

export interface ResolvedGlazeMaterial extends GlazeMaterial {
  cssVariables: CSSProperties & Record<`--glaze-${string}`, string>;
}

export interface GlazeSegment {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface GlazeSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "div" | "footer" | "header" | "nav" | "section" | "span";
  capability?: GlazeCapability;
  material?: GlazeMaterialInput;
}

export interface GlazeSegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  "aria-label": string;
  defaultValue?: string;
  disabled?: boolean;
  material?: GlazeMaterialInput;
  onValueChange?: (value: string) => void;
  segments: readonly GlazeSegment[];
  value?: string;
}
