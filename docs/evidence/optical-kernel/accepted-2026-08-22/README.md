# Accepted optical kernel evidence

Owner acceptance date: 2026-08-22

Accepted commit: `afc7112` (`feat: transplant proven optical displacement math`)

Accepted map contract: `glaze-optical-map-transplant`

The owner explicitly accepted the live, real-size optical kernel on
2026-08-22. These images were regenerated from the accepted commit with the
production Playwright harness after the temporary recovery worktree and its
ignored evidence directory disappeared.

The tracked set contains:

- four full-viewport `1280 x 720` source scenes at device scale factor 1;
- the primary desktop and compact layouts; and
- rest, departure, travel, and settled motion samples at authored scale.

The production browser report recorded 27 expected tests, zero unexpected
tests, and zero flaky tests across Chromium, Firefox, and Playwright WebKit.
The focused optical-map unit suite recorded 5/5 passing tests.

The original external reference file and the generated side-by-side board
were not recoverable after the temporary worktree disappeared. They are not
reconstructed or represented as tracked evidence. Owner acceptance was made
against the live implementation, not inferred from these files.

Automation and hashes preserve provenance and can veto regressions. They do
not replace the recorded owner decision or authorize aesthetic retuning.

Regenerate the source evidence with:

```bash
corepack pnpm test:optical-kernel:unit
corepack pnpm test:optical-kernel:production
```

Verify the tracked files and accepted implementation with:

```bash
shasum -a 256 -c docs/evidence/optical-kernel/accepted-2026-08-22/SHA256SUMS
```
