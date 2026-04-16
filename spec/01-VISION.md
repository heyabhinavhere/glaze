# Glaze — Vision & Goals

## What is this?

A standalone web tool that lets designers and developers visually compose, preview, and export production-ready glass/glassmorphism effects. Think of it as the bridge between Figma's beautiful glass material and the actual CSS code you need in production.

## The Problem

Figma's glass effect (and Apple's Liquid Glass) looks incredible in design tools. But when you try to implement it in code:

- Figma's dev mode outputs `backdrop-filter: blur(20px)` and a background color. That's maybe 30% of the effect.
- The remaining 70% — directional border glow, inner shadow for depth, drop shadow, noise grain, specular highlights — gets lost in translation.
- A proper glass effect requires 6-7 coordinated CSS layers. Nobody memorizes these. Nobody wants to hand-tune them blind.
- Existing CSS generators (glassmorphism.com etc.) are too simple. They give you blur + transparency and nothing else.

## The Solution

A visual playground where you:

1. Pick a preset or start from scratch
2. Tweak smart controls (Light, Depth, Blur, Tint, Grain) that coordinate multiple CSS layers automatically
3. See the result in real-time over various backgrounds
4. Export production-ready code (CSS, Tailwind, React, SwiftUI, AI prompt, JSON)
5. Share your config via URL

## Goals

### Primary
- Be the best glass effect configurator on the internet. Period.
- Show craft and taste — this is a personal brand play, not a startup.
- Be genuinely useful for daily design/dev work, not a one-time novelty.

### Secondary
- Educate people on how glass effects actually work (the layer system).
- Provide AI-ready prompts so people can reproduce effects via Cursor/Claude/GPT.
- Generate shareable URLs that spread on Twitter/X.

### Non-Goals
- This is NOT a full design system tool.

## Target Audience

1. Frontend developers who see a glass design in Figma and need to implement it
2. Designers who want to prototype glass effects and hand off accurate specs
3. AI-assisted developers who need precise prompts to describe glass effects
4. Design-curious builders who want to understand how premium glass effects work

## Success Metrics

- People share it on Twitter/X
- People bookmark it and come back to use it on real projects
- The presets look genuinely premium like that of Apple liquid glass, not like generic CSS demos
- The educational content gets screenshot and shared

## Aesthetic North Star

- The tool itself should feel like Linear, Raycast, or Vercel's design — minimal, dark, precise.
- No rounded colorful buttons. No playful illustrations. Clean, professional, confident.
- The glass preview should be the hero. Everything else serves it.
- Apple's own Liquid Glass (iOS 26) is the reference for what "good glass" looks like.
