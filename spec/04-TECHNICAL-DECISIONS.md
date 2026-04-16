# Glaze — Technical Decisions

## Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion (for preset transitions, UI interactions)
- **Language**: TypeScript
- **Deployment**: Vercel
- **No backend needed** — everything is client-side

## Key Technical Approaches

### The CSS Engine

The core of the tool is a pure function: `glassConfigToCSS(config) => styles`

This function must be:
- Pure (no side effects, same input always gives same output)
- Fast (called on every slider change, must not cause jank)
- Separate from the UI (so it can later be extracted into a library)

The function lives in its own file: `lib/glass-engine.ts`

### Gradient Border Implementation

The directional border glow is the hardest CSS challenge. There are two approaches:

**Approach A: Pseudo-element with mask (recommended)**
- Use a `::before` pseudo-element slightly larger than the glass panel
- Fill it with a `conic-gradient` centered on the element, rotating based on the light angle
- The gradient goes from white at `lightOpacity` to white at `darkOpacity`
- Mask it so only the border area is visible
- This gives smooth, directional border glow with feathering

**Approach B: border-image with gradient**
- Simpler but less control over softness/feathering
- Cannot do the "outer glow" effect where the border light feathers outward

Go with Approach A. It matches what Figma renders.

### Noise/Grain Texture

Use an SVG filter, NOT a PNG texture image. This is important because:
- SVG filters scale perfectly at any resolution
- No extra network request for an image asset
- Can be generated dynamically with adjustable parameters

Implementation:
```html
<svg width="0" height="0">
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
</svg>
```

Apply via a `::after` pseudo-element with:
```css
.glass::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  filter: url(#grain);
  opacity: 0.03; /* intensity value */
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

### Specular Highlight

Implemented as a radial gradient on a `::before` pseudo-element (or the same one as the border glow, composed together):
```css
background: radial-gradient(
  ellipse at 25% 25%, /* position based on light angle */
  rgba(255, 255, 255, 0.1), /* intensity */
  transparent 50% /* size */
);
```

### Inner Shadow

CSS `box-shadow` with `inset` keyword:
```css
box-shadow: inset 2px 2px 4px rgba(0, 0, 0, 0.1);
```
The x/y offsets are calculated from the light angle:
- x = cos(lightAngle) * offset
- y = sin(lightAngle) * offset

### URL Config Sharing

Serialize the config to JSON, compress (optional: use lz-string for shorter URLs), base64 encode, put in query param.

```typescript
// Encode
const encoded = btoa(JSON.stringify(config));
const url = `${window.location.origin}?config=${encoded}`;

// Decode
const params = new URLSearchParams(window.location.search);
const config = JSON.parse(atob(params.get('config')));
```

For v1, skip compression. Base64 is fine. URLs will be long-ish but functional.

### Export Code Generation

Each export format is a separate function that takes the resolved CSS values and formats them:

- `toVanillaCSS(styles)` — outputs a `.glass { ... }` class
- `toTailwind(styles)` — outputs Tailwind arbitrary value classes
- `toReact(styles)` — outputs a `<GlassPanel />` component with inline styles
- `toSwiftUI(styles)` — outputs SwiftUI view modifiers (.background, .shadow, etc.)
- `toAIPrompt(config)` — outputs natural language description
- `toJSON(config)` — outputs the raw config object

### Color Picker

Use a lightweight color picker library or build a simple one. Options:
- `react-colorful` — tiny, no dependencies, good enough
- Custom: a hex input field + a small grid of common colors

Don't use a full-featured color picker with gradients/HSL sliders. The tint color is almost always white or black with low opacity. Keep it simple.

### Performance Considerations

- All preview updates happen via CSS variable changes on the glass element, NOT by re-rendering React components. This ensures 60fps slider dragging.
- Use CSS custom properties (variables) on the glass element: `--glass-blur`, `--glass-tint-opacity`, etc.
- Sliders update CSS variables directly via `element.style.setProperty()`.
- React state is only used for the control values and export generation, not for real-time preview rendering.

---

## File Structure

```
glaze/
├── app/
│   ├── layout.tsx          # Root layout with fonts, metadata
│   ├── page.tsx            # Main page — assembles all sections
│   └── globals.css         # Tailwind imports, base styles
├── components/
│   ├── GlassPreview.tsx    # The preview area with glass panel + backgrounds
│   ├── ControlsPanel.tsx   # The controls sidebar
│   ├── SimpleControls.tsx  # The 5 smart controls
│   ├── AdvancedControls.tsx # Layer-by-layer overrides
│   ├── AnglePicker.tsx     # Custom circular angle input for Light
│   ├── ExportBar.tsx       # Bottom export tabs + code output
│   ├── PresetBar.tsx       # Horizontal preset selector
│   ├── BackgroundSwitcher.tsx # Background thumbnail row
│   ├── LayerToggles.tsx    # Individual layer visibility toggles
│   ├── ZoomLoupe.tsx       # Corner zoom feature
│   └── HowItWorks.tsx     # Educational section below the tool
├── lib/
│   ├── glass-engine.ts     # Core: config → CSS translation
│   ├── presets.ts          # Preset config objects
│   ├── export-css.ts       # CSS export formatter
│   ├── export-tailwind.ts  # Tailwind export formatter
│   ├── export-react.ts     # React component export
│   ├── export-swiftui.ts   # SwiftUI export formatter
│   ├── export-prompt.ts    # AI prompt generator
│   ├── config-url.ts       # URL encode/decode for sharing
│   └── types.ts            # TypeScript interfaces (GlassConfig, etc.)
├── public/
│   └── backgrounds/        # Background images for preview
└── package.json
```

---

## Dependencies

Minimal dependency footprint:
- `next` — framework
- `tailwindcss` — styling
- `framer-motion` — animations
- `react-colorful` — color picker (2KB gzipped)
- `lucide-react` — icons (tree-shakeable)

No state management library needed. React useState + useReducer is sufficient.
No syntax highlighting library for v1 — use a styled `<pre>` with manual color classes.
