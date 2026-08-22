# Archived CSS-first V1 release contract

Date archived: 2026-08-17

Status: **superseded; not a release authorization**

The former CSS-first V1 passed useful package, semantic, accessibility, and
consumer engineering checks, but its material failed the liquid-glass product
gate. Draft PR #6 was closed. `GlazeSurface`, the old material names, and the
old `css`/`page-backdrop` capability schema are not public Glaze APIs.

The current contract is component-first liquid glass over explicitly owned
sources:

- implementation and types: `packages/react/src/`;
- public usage: `packages/react/README.md`;
- frozen API: `docs/PUBLIC-API.md`;
- rendering boundary: `docs/architecture/RENDERING-REFRAME.md`; and
- gate authority and evidence: `docs/RECOVERY.md`.

The retained CSS is a truthful semantic fallback only. It must not be revived
as the primary renderer or described as refraction.
