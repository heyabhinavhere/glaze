# Glaze — Apple Liquid Glass Reference

## Purpose of This Document

This documents how Apple's Liquid Glass actually works so that the tool's presets and default output quality can be benchmarked against the real thing. This is a reference for quality, not an implementation guide for Apple's native rendering (which uses GPU shaders we can't replicate in CSS).

## What is Liquid Glass?

Apple's Liquid Glass is the design language introduced at WWDC 2025 (June 9, 2025) for iOS 26, iPadOS 26, macOS Tahoe, watchOS 26, and visionOS 26. It's Apple's most significant visual overhaul since iOS 7.

Key quote from Apple: "A translucent material that reflects and refracts its surroundings, while dynamically transforming to help bring greater focus to content."

The design team physically fabricated glass samples of various opacities and lensing properties in Apple's industrial design studios to match interface properties to real glass behavior.

## Core Optical Properties

### 1. Lensing (Refraction)
Unlike old glassmorphism which just blurs, Liquid Glass BENDS the background content. The background isn't scattered — it's distorted at the edges like looking through a curved glass lens. The center of the glass element may be relatively clear while edges refract.

**CSS approximation**: Not possible with pure CSS. Can be approximated with SVG `feDisplacementMap` in Chromium browsers. For our tool (Tier 1, CSS-only), we approximate this with stronger backdrop blur that's visually convincing even without actual refraction.

### 2. Specular Highlights
Bright rim lighting that follows a light direction. Apple implements this as a rim light effect where the highlight appears around the edges, with intensity varying based on the angle of the surface normal relative to a fixed light direction.

The specular highlight reacts to device movement (gyroscope) on real devices. On the web, we make it static but correctly positioned based on the light angle parameter.

**CSS approximation**: Gradient border using conic-gradient or linear-gradient, brighter on light-facing edges. Plus optional radial gradient for a highlight spot.

### 3. Depth (Shadows)
Inner shadow + drop shadow create thickness illusion. Larger glass elements simulate thicker, more substantial material. Shadows become more prominent when content scrolls underneath to create separation.

**CSS approximation**: `box-shadow` with both inset and regular values. This translates well to CSS.

### 4. Adaptive Behavior
- Elements automatically adapt between light and dark modes
- Color from surrounding content can "spill" onto the glass surface
- The material becomes more opaque during focused interactions

**CSS approximation**: Light/dark presets in our tool. Color spillover is not practical in CSS (would require real-time sampling of background colors).

### 5. Concentricity
Nested glass elements use concentric corner radii. Inner radius = outer radius - padding. This creates harmonious nested shapes.

**CSS approximation**: Straightforward math. Our tool should output the correct border-radius and note the concentricity rule in comments.

## Three Layers of Liquid Glass

Apple describes the material as having three fundamental layers:

1. **Highlight** — light casting and movement. The bright edge that shows where light hits.
2. **Shadow** — depth and separation. The darkness that grounds the element.
3. **Illumination** — the flexible properties of the material itself. How it interacts with what's behind it (blur, tint, transparency).

## Figma's Glass Implementation (Reference Values)

From the user's Figma screenshots, Figma's glass effect exposes these controls:

| Figma Parameter | Value in Reference | Our Tool Equivalent |
|---|---|---|
| Light angle | -45° | Light angle: 315° |
| Light intensity | 80% | Light intensity: 80% |
| Refraction | 75 | Blur (approximation): ~20 |
| Depth | 42 | Depth: 42 |
| Dispersion | 10 | Not in v1 (chromatic aberration, Tier 2 only) |
| Frost | 8 | Grain intensity: ~3% |
| Splay | 16 | Border softness: ~4px |
| Fill | #FFFFFF at 12% | Tint: #FFFFFF at 12% |

## Visual Details from Corner Close-ups

The user provided zoomed-in screenshots of all 4 corners of a Figma glass panel. Key observations:

**Top-left corner (light source side):**
- Border glow is brightest here, approximately 2-3px of soft white light
- The glow feathers outward, not a sharp line
- Both the top edge and left edge are bright, with the corner being the brightest point

**Top-right corner:**
- Top edge still bright but fading as it moves away from light source
- Right edge has much dimmer border
- The corner radius has a smooth light falloff, not uniform

**Bottom-right corner (shadow side):**
- Border barely visible
- Strong drop shadow cast downward and to the right
- This corner shows the most shadow/depth

**Bottom-left corner:**
- Similar to bottom-right, dim border
- Left edge has slightly more light than bottom edge (because light is top-left)

**Top edge (full width):**
- Uniformly bright across its length
- Fine noise texture visible on the glass surface

## iOS Photos App Reference

The user shared a screenshot of iOS Photos' tab bar with glass effect. Observations:

- The segmented pill ("Years | Months | All") has a clear glass treatment
- The selected segment ("All") has a MORE INTENSE glass effect (brighter border, stronger inner shadow, more depth)
- Circular icon buttons (Photos, Search) have their own subtler glass treatment
- The blur behind the pill is heavier than behind the circular buttons
- The border light wraps around the entire pill but is brightest on top

## Apple's Design Guidelines for Glass Usage

- Glass is best for the navigation layer that floats above content
- Avoid using glass on glass (stacking glass elements)
- Two variants exist: Regular (most versatile, adaptive) and Clear (no adaptive behavior, lets content show through more)
- Tinting allows applying color to glass while staying consistent with the material
- Tints should only be used to bring emphasis to primary elements
- Controls should sit on glass materials, never directly on content

## What We CAN'T Replicate (and shouldn't try)

1. **Real-time lensing/refraction** — requires GPU shaders or SVG displacement (Chromium only)
2. **Gyroscope-reactive highlights** — requires device motion API, not practical for a configurator
3. **Dynamic color sampling** — glass adapting its tint to match the content beneath it in real-time
4. **Shape morphing** — Liquid Glass elements that change shape fluidly between states

## What We CAN Nail (and should)

1. **Directional border glow** — the single biggest quality gap between good and bad glass CSS
2. **Layered shadows** — inner + drop shadow coordinated correctly
3. **Noise grain** — the texture that makes digital glass feel physical
4. **Correct defaults** — presets that match Apple's visual quality as closely as CSS allows
5. **Smart parameter coordination** — one "Light" control that moves border, shadow, and specular together, just like Figma's panel does
