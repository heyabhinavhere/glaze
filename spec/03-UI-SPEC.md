# Glaze — UI Spec

## Layout

### Desktop (>1024px)
Split screen layout.
- Left: Preview area (60% width)
- Right: Controls panel (40% width)
- Bottom: Export bar (full width, always visible)

### Tablet (768-1024px)
Same split but 50/50.

### Mobile (<768px)
Stacked layout:
- Top: Preview area (full width, ~50vh)
- Bottom: Controls as a drag-up sheet overlay
- Export bar inside the sheet

---

## Preview Area

### Glass Panel
- A card-shaped glass element, roughly 320x420px on desktop
- Contains sample content inside:
  - A small icon (SF Symbol style, simple geometric)
  - A heading: "Glass Panel"
  - A line of body text: "This is how text reads against the glass surface."
- The panel should be draggable within the preview area so users can move it over different parts of the background to see how the glass responds to different colors beneath it.

### Background Switcher
A row of small circular thumbnail buttons at the bottom of the preview area. Clicking one instantly changes the background.

Backgrounds to include:
1. **Colorful photo** — vibrant nature/landscape shot (default)
2. **Dark gradient** — deep blues/purples, simulating a dark app
3. **Light gradient** — soft warm pastels, simulating a light app
4. **Dark UI** — a screenshot of a dark mode dashboard/app
5. **Light UI** — a screenshot of a light mode app
6. **Mesh gradient** — colorful mesh gradient (popular in modern design)
7. **Custom** — upload or paste URL (v2, not required for launch)

### View Modes
Small segmented control in the top-left corner of preview:
- **Card** (default) — glass panel at card size
- **Bar** — glass stretches to full width, short height, simulating a nav bar
- **Pill** — small rounded pill, simulating a tab bar segment or button

### Zoom Loupe
A small toggle button (magnifying glass icon) in the top-right corner of preview. When enabled, shows a zoomed-in circular loupe of the top-left corner of the glass panel, revealing border glow detail, grain texture, and shadow subtleties.

This is a signature feature. It mirrors how the user shared zoomed-in Figma screenshots of each corner to analyze the effect. The tool acknowledges this level of scrutiny.

### Layer Visibility Toggles
Below the background switcher, a row of small labeled toggles:
[ Blur ] [ Tint ] [ Border ] [ Inner Shadow ] [ Drop Shadow ] [ Grain ] [ Specular ]

Each toggle shows/hides that specific layer in the preview. This is educational — users can see what each layer contributes. When a layer is toggled off, it grays out in the preview but the export code still includes it.

An "info" mode: clicking a layer name shows a one-sentence tooltip explaining what it does.

---

## Controls Panel

### Preset Bar (top of controls)
Horizontal scrollable row of preset chips. Each chip shows:
- Preset name
- A tiny circular preview swatch of the glass effect

Active preset is highlighted. When any control is manually changed, the active preset deselects and shows "Custom."

### Mode Toggle
Directly below presets. Two tabs: "Simple" | "Advanced"

### Simple Mode
5 controls stacked vertically with comfortable spacing.

#### Light Control
- Label: "Light"
- A circular angle picker (like a compass dial) for angle. The user drags a handle around the circle.
- A horizontal slider below it for intensity (0-100%)
- Show the degree value numerically next to the dial

#### Depth Control
- Label: "Depth"
- Single horizontal slider, 0-100
- Show numeric value

#### Blur Control
- Label: "Blur"
- Single horizontal slider, 0-100
- Show numeric value

#### Tint Control
- Label: "Tint"
- A small color swatch (click to open color picker)
- A horizontal slider for opacity, 0-50%
- Show hex value and opacity percentage

#### Grain Control
- Label: "Grain"
- A toggle switch (on/off)
- When on: a horizontal slider for intensity, 0-10%
- Show percentage value

Each control has a subtle "?" icon that on hover shows a one-line explanation.

### Advanced Mode
Collapsible accordion sections. Each section is a named layer.

Sections:
1. **Border** — lightOpacity, darkOpacity, width, softness sliders
2. **Inner Shadow** — followsLight toggle, angle (when manual), blur, spread, opacity sliders, color picker
3. **Drop Shadow** — x, y, blur, spread, opacity sliders, color picker
4. **Specular** — enabled toggle, followsLight toggle, size, intensity sliders
5. **Backdrop** — blur, saturation, brightness sliders

A "Reset to Simple" button at the top that clears all overrides and re-syncs to the smart controls.

Each section starts collapsed. Clicking expands it. Multiple can be open at once.

---

## Export Bar

Always visible at the bottom of the viewport (sticky).

### Tab Row
[ CSS ] [ Tailwind ] [ React ] [ SwiftUI ] [ AI Prompt ] [ JSON ]

### Code Output
Below tabs: a code block with syntax highlighting (mono font, dark background). Shows the output for the selected tab.

### Buttons
- **Copy** button (right side of code block) — copies code to clipboard, shows "Copied!" confirmation
- **Share** button — generates a URL with the config encoded, copies to clipboard

### AI Prompt Tab Content
Instead of code, shows natural language:
```
Create a glass panel with:
- 20px backdrop blur with 1.2x saturation
- White tint at 12% opacity
- 1px gradient border, bright at 315° (40% opacity) fading to 5% on the opposite side
- 4px inner shadow from the top-left at 10% opacity
- Drop shadow: 0px 8px 24px at 12% opacity
- 3% noise grain overlay
- Border radius: 20px
```

### JSON Tab Content
The raw GlassConfig object, formatted and syntax-highlighted.

---

## Page Structure (outside the tool)

### Header
- Tool name/logo (left)
- GitHub link (right, if open source)
- Twitter/X link (right)

### Hero Section
The tool itself. No preamble, no hero image. The tool IS the hero. Users land and immediately see the glass configurator.

### Below the tool (scroll down)

#### Section: "How Glass Works"
The 7-layer visual explainer. Show a diagram of the layers stacked:
1. Background content
2. Backdrop blur
3. Tint fill
4. Noise grain
5. Inner shadow
6. Border with directional light
7. Drop shadow (beneath)
8. Specular highlight (on top, optional)

Each layer is labeled and has a one-sentence description. Interactive: clicking a layer in the diagram highlights the corresponding control in the tool above and scrolls to it.

#### Section: "Use with AI Agents"
Ready-made prompts:
- "Paste this to create a glass card"
- "Paste this to create a glass navigation bar"
- "Paste this to create a glass modal overlay"
Each with a copy button.

#### Section: "Presets Gallery"
Visual grid showing each preset rendered as a card. Click to load it in the tool.

### Footer
- "Made by [your name]" with link to Twitter/X
- Brief credit line
- Link to Figma glass effect (as reference)

---

## Interaction Details

### Real-time Updates
Every slider/picker change updates the preview instantly. No "apply" button. No debounce delay (use requestAnimationFrame if needed for performance).

### Preset Selection
Clicking a preset instantly updates all controls and the preview. The slider positions animate to their new values (subtle 200ms ease).

### URL Sharing
Config is serialized to a compressed JSON string, base64 encoded, and appended as `?config=...` query param. On page load, if a config param exists, it's decoded and applied.

### Keyboard Shortcuts (v2)
- Cmd/Ctrl + C: Copy current tab's code
- 1-6: Switch export tabs
- R: Reset to default
- D: Toggle dark/light preview background

---

## Design Tokens for the Tool's Own UI

The tool's interface (controls, buttons, tabs) should use:
- Background: #0A0A0A (near black)
- Surface: #141414 (cards, panels)
- Surface elevated: #1A1A1A (controls background)
- Border: #262626
- Text primary: #FAFAFA
- Text secondary: #888888
- Accent: #3B82F6 (blue, for active states)
- Font: Inter or system font stack
- Mono font: JetBrains Mono or similar for code output
- Border radius: 8px for controls, 12px for panels
- Spacing unit: 4px base grid
