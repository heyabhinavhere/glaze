import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SVGProps,
} from "react";

export type GlazeCapability =
  | "owned-decoration"
  | "explicit-media"
  | "css-fallback";

export interface GlazeCapabilityResult {
  readonly requested: GlazeCapability;
  readonly effective: GlazeCapability;
  readonly reason?: string;
}

export interface GlazeMaterial {
  readonly refraction: number;
  readonly thickness: number;
  readonly dispersion: number;
  readonly roughness: number;
  readonly transmission: number;
  readonly tint: {
    readonly color: string;
    readonly opacity: number;
  };
  readonly lighting: {
    readonly angle: number;
    readonly highlight: number;
    readonly occlusion: number;
  };
}

export interface GlazeMotion {
  readonly stiffness: number;
  readonly damping: number;
}

export interface GlazeMaterialInput
  extends Partial<Omit<GlazeMaterial, "tint" | "lighting">> {
  readonly tint?: Partial<GlazeMaterial["tint"]>;
  readonly lighting?: Partial<GlazeMaterial["lighting"]>;
}

export type GlazeMaterialRegistry = Readonly<
  Record<string, GlazeMaterialInput>
>;

export interface GlazeRootProps {
  readonly children: ReactNode;
  readonly materials?: GlazeMaterialRegistry;
  readonly motion?: Partial<GlazeMotion>;
}

export interface GlazeSegment {
  readonly id: string;
  readonly label: ReactNode;
  readonly disabled?: boolean;
}

interface GlazeSourceSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material?: string;
  readonly materialDefaults?: GlazeMaterialInput;
}

export interface GlazeRefractSourceProps extends GlazeSourceSurfaceProps {
  readonly source: ReactElement<SVGProps<SVGSVGElement>>;
}

export interface GlazeImageSource {
  readonly type: "image";
  readonly src: string;
  readonly crossOrigin?: "anonymous" | "use-credentials";
  readonly focalPoint?: readonly [x: number, y: number];
}

export interface GlazeVideoSourceItem {
  readonly src: string;
  readonly type: string;
}

export interface GlazeVideoSource {
  readonly type: "video";
  readonly sources: readonly GlazeVideoSourceItem[];
  readonly autoPlay?: boolean;
  readonly crossOrigin?: "anonymous" | "use-credentials";
  readonly loop?: boolean;
  readonly muted?: boolean;
  readonly poster?: string;
  readonly preload?: "auto" | "metadata" | "none";
}

export interface GlazeCanvasDrawSize {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

export interface GlazeCanvasSource {
  readonly type: "canvas";
  readonly draw: (
    context: CanvasRenderingContext2D,
    size: GlazeCanvasDrawSize,
  ) => void;
  readonly subscribe?: (invalidate: () => void) => (() => void) | void;
}

export type GlazeMediaSource =
  | GlazeImageSource
  | GlazeVideoSource
  | GlazeCanvasSource;

export interface GlazeMediaSurfaceProps extends GlazeSourceSurfaceProps {
  readonly source: GlazeMediaSource;
}

export interface GlazeSegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  "aria-label": string;
  readonly defaultValue?: string;
  readonly disabled?: boolean;
  readonly onValueChange?: (value: string) => void;
  readonly segments: readonly GlazeSegment[];
  readonly value?: string;
}

export interface GlazeSwitchProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "defaultValue" | "onChange" | "value"
  > {
  "aria-label": string;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly label?: ReactNode;
  readonly onCheckedChange?: (checked: boolean) => void;
}

export interface GlazeSliderProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "onChange" | "type" | "value"
  > {
  "aria-label": string;
  readonly defaultValue?: number;
  readonly label?: ReactNode;
  readonly onValueChange?: (value: number) => void;
  readonly value?: number;
}

export interface GlazeDiagnosticsProps extends HTMLAttributes<HTMLDListElement> {
  readonly compact?: boolean;
}

export interface GlazeWorkbenchProps extends HTMLAttributes<HTMLElement> {
  readonly enabled?: boolean;
  readonly material?: string;
}

export interface GlazeRendererDiagnostics {
  readonly rendererId: number;
  readonly renderer: "webgl2-displacement-map";
  readonly frames: number;
  readonly mapRenders: number;
  readonly uploads: number;
  readonly controlCount: number;
  readonly settled: boolean;
  readonly contextLost: boolean;
}
