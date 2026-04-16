# Glaze — Build Plan

## How to Use This Document

This is a phase-by-phase build plan for Claude Code. Each phase has a clear scope and deliverable. Complete one phase fully before moving to the next. After each phase, manually review the result and hand-tune values before proceeding.

Read ALL spec files in this folder before starting any phase:
- 01-VISION.md — What we're building and why
- 02-PARAMETER-MODEL.md — Every parameter, its range, defaults, and relationships
- 03-UI-SPEC.md — Layout, interactions, design tokens
- 04-TECHNICAL-DECISIONS.md — Stack, architecture, file structure
- 05-BUILD-PLAN.md — This file (phase breakdown)
- 06-APPLE-GLASS-REFERENCE.md — How Apple's Liquid Glass works (reference for quality)

---

## Phase 1: Project Setup + Glass Engine

### Goal
Set up the Next.js project and build the core CSS translation engine with no UI.

### Tasks
1. Initialize Next.js project with TypeScript, Tailwind CSS, App Router
2. Install dependencies: framer-motion, react-colorful, lucide-react
3. Create `lib/types.ts` with the GlassConfig TypeScript interface (see 02-PARAMETER-MODEL.md for the full interface)
4. Create `lib/presets.ts` with preset config objects (use defaults from 02-PARAMETER-MODEL.md, these will be hand-tuned later)
5. Create `lib/glass-engine.ts` — the core function `glassConfigToCSS(config: GlassConfig)`
   - Input: a GlassConfig object
   - Output: an object with all CSS properties needed to render the glass effect
   - Must handle the "smart controls" logic: when advanced overrides are null, derive values from simple mode controls
   - Must calculate border gradient direction from light angle
   - Must calculate inner shadow offsets from light angle
   - Must coordinate depth value across inner shadow, drop shadow, and border glow

### Deliverable
A working engine where you can call `glassConfigToCSS(presets.appleRegular)` and get back a complete CSS property set. Write a simple test page that renders a div with these styles to visually verify.

### Quality Check
The output CSS should produce a glass panel that looks genuinely good, not just "has blur and a border." If the default preset doesn't look premium, stop and tune the engine before proceeding.

---

## Phase 2: Preview Area

### Goal
Build the glass preview with swappable backgrounds.

### Tasks
1. Create `components/GlassPreview.tsx`
   - Renders a glass panel using CSS from the engine
   - Panel contains sample content (icon, heading, body text)
   - Panel uses CSS custom properties for all glass values (for real-time updates later)
2. Create `components/BackgroundSwitcher.tsx`
   - Row of thumbnail buttons for switching backgrounds
   - Include 6 background options (see 03-UI-SPEC.md)
   - Source royalty-free background images and place in public/backgrounds/
3. Create `components/ZoomLoupe.tsx`
   - A toggleable circular magnifier that shows a zoomed-in view of the glass panel's corner
   - Shows border glow detail, grain texture, shadow subtleties
4. Assemble in `app/page.tsx` — the preview area takes up the full viewport for now

### Deliverable
A page showing a beautiful glass panel over a colorful background. You can switch backgrounds. You can toggle the zoom loupe to inspect corner details.

### Quality Check
Does the glass look as good as the Figma reference? Specifically check:
- Is the border glow directional (brighter on light-facing side)?
- Is the grain texture visible but subtle?
- Does the inner shadow create depth?
- Does the drop shadow separate the panel from the background?

If not, tune the engine values before proceeding.

---

## Phase 3: Controls Panel (Simple Mode)

### Goal
Build the 5 simple mode controls and wire them to the preview.

### Tasks
1. Create `components/AnglePicker.tsx` — custom circular angle input
   - A circle with a draggable handle
   - Shows degree value numerically
   - Smooth drag interaction
2. Create `components/SimpleControls.tsx` — the 5 controls
   - Light: AnglePicker + intensity slider
   - Depth: slider
   - Blur: slider
   - Tint: color swatch + opacity slider
   - Grain: toggle + intensity slider
3. Create `components/ControlsPanel.tsx` — wrapper with preset bar + mode toggle + controls
4. Wire controls to glass preview via React state
   - State lives in page.tsx, passed down as props
   - Every state change recalculates CSS via glass-engine and updates CSS custom properties on the preview element
   - Must be 60fps smooth — no visible lag when dragging sliders
5. Create `components/PresetBar.tsx` — horizontal scrollable preset chips
   - Clicking a preset updates all control values
   - Slider positions animate to new values

### Deliverable
A split-screen layout. Left: glass preview. Right: working controls. Every control updates the preview in real-time. Presets work.

### Quality Check
- Drag every slider. Is it smooth? Any jank?
- Does the light angle picker feel good to use?
- When you change the light angle, do you see the border glow shift?
- When you increase depth, does the panel feel "thicker"?
- Do presets apply instantly with smooth transitions?

---

## Phase 4: Advanced Mode + Layer Toggles

### Goal
Add advanced per-layer controls and the educational layer visibility toggles.

### Tasks
1. Create `components/AdvancedControls.tsx` — collapsible accordion sections for each layer
2. Wire advanced controls to the engine — advanced values override the smart-derived values
3. Add "Custom" indicator when advanced values differ from smart-derived values
4. Add "Reset to Simple" button
5. Create `components/LayerToggles.tsx` — row of toggles below the preview
   - Each toggle hides/shows one layer in the preview
   - Implemented by zeroing out specific CSS custom properties (not by removing CSS rules)

### Deliverable
Users can switch to Advanced mode, tweak individual layers, and toggle layers on/off to see their contribution.

---

## Phase 5: Export Bar

### Goal
Build the code export system.

### Tasks
1. Create export functions in lib/:
   - `export-css.ts` — vanilla CSS class output
   - `export-tailwind.ts` — Tailwind arbitrary value classes
   - `export-react.ts` — React component with inline styles
   - `export-swiftui.ts` — SwiftUI view modifier code
   - `export-prompt.ts` — natural language AI prompt
2. Create `components/ExportBar.tsx`
   - Sticky bottom bar with tab row and code output
   - Copy button with "Copied!" feedback
   - Share button that generates URL with config encoded in query params
3. Create `lib/config-url.ts` — URL encode/decode functions
   - On page load: check for ?config= param and apply if present

### Deliverable
All 6 export formats work. Copy works. Share URL works. Visiting a shared URL loads the exact configuration.

---

## Phase 6: Polish + Educational Content

### Goal
Make everything feel premium. Add the "How Glass Works" section and AI prompts section.

### Tasks
1. Create `components/HowItWorks.tsx`
   - Visual layer diagram showing the 7-layer glass sandwich
   - Each layer labeled with one-sentence description
   - Interactive: toggling a layer in the diagram toggles it in the preview
2. Add the "Use with AI Agents" section with ready-made prompts
3. Add the presets gallery below the tool
4. Add header with tool name and social links
5. Add footer
6. Polish:
   - Smooth transitions everywhere (preset switching, tab switching, mode switching)
   - Hover states on all interactive elements
   - Focus states for accessibility
   - Responsive layout (tablet, mobile)
   - Meta tags, favicon, Open Graph image for social sharing
   - Performance audit (no unnecessary re-renders)

### Deliverable
A complete, polished, ship-ready page.

---

## Phase 7: Hand-Tune Presets (MANUAL — NOT for Claude Code)

### Goal
The builder (you) personally tunes every preset until it looks genuinely premium.

### Process
1. Open the tool in the browser
2. For each preset:
   - Start with the current values
   - Compare against Apple's actual glass effects on iOS/visionOS
   - Adjust until it looks right to YOUR eye
   - Save the final values back into lib/presets.ts
3. Set the best-looking preset as the default on page load
4. Take screenshots of each preset for the gallery section

This phase cannot be automated. Your taste is the product.

---

## Phase 8: Ship

1. Deploy to Vercel
2. Buy domain (glasslab.dev, glasskit.dev, or similar)
3. Create Open Graph image (screenshot of the tool)
4. Write a tweet thread showing the tool in action
5. Post on Product Hunt (optional, v2)
