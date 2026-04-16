@AGENTS.md

## Project context — read these first

- **`PROJECT.md`** — what we're building, current state, default config,
  what's done and what's pending, file structure.
- **`docs/RENDERING.md`** — how the WebGL pipeline actually works, plus the
  failed paths we deliberately reverted from. Required reading before
  touching `lib/shader.ts` or `lib/webgl-renderer.ts`.

The `spec/` directory has older planning docs from before the WebGL work.
Treat them as historical, not current truth — `PROJECT.md` and
`docs/RENDERING.md` are the source of truth now.
