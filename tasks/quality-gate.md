# Glazelab Quality Gate

Use this gate before closing any non-trivial task. For visual/rendering work,
missing evidence means the task is not complete.

## Task Record

- Goal and user-facing behavior.
- Root cause and why the old behavior failed.
- Files touched and explicit non-goals.
- Risk class: rendering, API, packaging, playground, tooling, or docs.
- Expected visual delta and acceptance scenes.

## Required Commands

```bash
git status --short --branch
git diff --name-status main...HEAD
git diff --stat main...HEAD
git diff --check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm size
```

## Visual Evidence

- Main vs branch screenshots for every touched route.
- For glass/refraction work: captures at top, mid-scroll, and fast-scroll stop.
- Zoomed crops of the body, rim, and corners.
- Motion evidence for scroll/refraction work: a short capture or frame strip
  proving background content bends through the glass while the page moves.
- Refraction-amplitude note: expected maximum displacement in pixels for each
  tested lens size and config.
- Console warnings and errors summarized explicitly.
- Native Liquid Glass reference comparison linked from `.gstack/evidence/`.

## Required Rendering Scenarios

- Fixed glass over scrolling DOM.
- Explicit `backdropFrom`.
- Element scroll container, not only window scroll.
- Image/video backdrop still works.
- Two no-config lenses do not leak backdrop/config state.
- Long pages do not exceed GPU texture limits silently.

## Review Questions

- Staff engineer: Is the root cause fixed, not hidden by a workaround?
- Staff engineer: Is the change scoped to the task and compatible with the
  public API, SSR, lifecycle cleanup, and package size budget?
- Staff engineer: Are visual-tuning values still meaningful after any shader
  unit change, or did the implementation silently change their scale?
- Designer: Does it avoid the known wrong reads: magnifier, colored ring,
  continuous stroke, halo, wrong frost, dead edges, or illegible foreground?
- Designer: Does the result avoid the static glassmorphism read? If a frozen
  frame looks like a translucent blurred pill with no optical bending, fail it.
- Designer: Would the visual hold up next to the native reference captures?
