# BON Credit installed-tarball dogfood

Date: 2026-08-22

Glaze branch: `aj/glaze-component-system`

Glaze checkpoint: `098321b`

BON Credit baseline: `dbb9ede72581e34a29864da8e4dfdbd66d2bfa83`

## Scope and safety

The current BON Credit Demo working tree was copied to a credential-free
disposable directory. The copy excluded `.git`, `node_modules`, `.next`, and
every `.env*` file. The dirty source repository was not edited.

The dogfood copy ran Next.js 16.1.6 and installed
`@glazelab/react@0.1.0-alpha.0` from the retained package tarball. The tarball
SHA-256 was:

```text
42a091d86be34864ea2de7c514522149b75df37ffa1d89b5c1522bd26947d3a6
```

Package resolution pointed inside the disposable consumer's own
`node_modules`, not to the Glaze workspace.

## Integration

The trial imported `@glazelab/react/styles.css` once in the BON root layout and
added an isolated `/glaze-dogfood` App Router page. The route used BON's actual
Next.js/Tailwind environment and a product-themed, inert financial SVG field.
One `GlazeRefractSource` hosted a segmented control, switch, slider, and compact
diagnostics. No arbitrary page capture or duplicate control tree was added.

## Evidence

- `npx tsc --noEmit`: passed.
- focused ESLint for the root layout and dogfood route: passed.
- `npm run build`: passed with Turbopack; `/glaze-dogfood` was statically
  prerendered.
- host-level HTTP check: `200`.
- actual macOS Safari: requested and effective capability were both
  `owned-decoration`; renderer was `webgl2-displacement-map`; fallback was
  `None`.
- Safari exposed one three-option radiogroup, one named switch, and one named
  slider. Keyboard input changed Overview to Cards, toggled Smart alerts,
  changed Payment target from 62 to 63, and restored every default.
- real-scale engineering inspection showed visible accepted optics, preserved
  labels, and no source-title/control overlap. This is not owner visual
  acceptance of the BON integration.

The host product's repository-wide lint remained red because of three existing
errors outside the dogfood route. `npm install` also reported one low and eight
high dependency advisories. No unrelated lint or dependency remediation was
attempted, and these host-project issues are not recorded as Glaze passes.

## Boundary

This closes Glaze's real-product compatibility/dogfood gate without mutating a
dirty product repository. It does not land Glaze in BON, close physical-device
review, or authorize merge, deployment, or publication. The disposable route
must not be presented as shipped product integration.
