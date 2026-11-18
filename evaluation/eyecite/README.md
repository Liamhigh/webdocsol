# Eyecite conformance spike (B9, development/CI only)

Read-only evaluation of candidate browser/TypeScript ports of
[eyecite](https://github.com/freelawproject/eyecite) (Free Law Project,
BSD-2-Clause) against the pinned official reference, per the enhancement plan
(PR 2.1). Nothing here is imported by browser or production analysis code; the
spike produces a conformance report and a decision record, not a production
dependency decision made by README claims.

## Layout

- `generate-conformance.py` — regenerates `conformance.json` from the **pinned**
  reference (`eyecite==2.7.8`, Python). Development-only; the corpus is
  committed and reviewed, and regeneration must be byte-identical.
- `conformance.json` — 17 hand-written cases covering exact full spans,
  captions, volume/reporter/page/pin cites, parallel citations, `id.`/`supra`
  short forms, ambiguous antecedents, a section-heading boundary, Unicode text,
  a line break inside a citation, hyphenated captions, malformed citations, a
  statute, a journal, and two South African negative cases. Expected output is
  the reviewed behavior of the pinned reference, including its limitations
  (the reference finds nothing in `line-break-in-cite`).
- `ports/*.mjs` — one adapter per candidate port. Adapters normalize output to
  the comparison record and **strip confidence scores and telemetry fields**
  (`strippedFields` lists what was removed). Verum occurrence records carry
  parsed facts and explicit resolution states, never probabilities.
- `compare.mjs` — runs the corpus against every adapter and emits a canonical
  JSON report: per-case exact span/text/group/metadata agreement, cluster
  (resolution) agreement, and explicit `not_installed` / `error` /
  resolution-state reporting. Differences require explanation, never a silent
  winner.
- `DECISION.md` — the decision record required by the plan's decision gate.

## Running

```sh
# one-time, into the gitignored cache:
mkdir -p evaluation/.cache/eyecite-ports && cd evaluation/.cache/eyecite-ports && \
  npm init -y && npm install eyecite-ts@0.34.2 @beshkenadze/eyecite@2.7.6-alpha.28
# from the repository root:
node evaluation/eyecite/compare.mjs
```

A port that is not installed is reported `not_installed`, not failed; the
comparison logic itself is covered hermetically by
`tests/evaluation-eyecite.test.mjs` (no network, no packages required).

## Candidates evaluated (pinned)

| Port | Upstream | Version | License |
|---|---|---|---|
| `@beshkenadze/eyecite` | beshkenadze/eyecite-js | 2.7.6-alpha.28 | BSD-2-Clause |
| `eyecite-ts` | medelman17/eyecite-ts | 0.34.2 | MIT |

## Rules this spike enforces

- Exact spans and deterministic ordering are the pass condition; parser
  differentials are recorded, not resolved by preference.
- No confidence score reaches the comparison record.
- New parser code must not use regex lookbehind (older Safari/WebKit cannot
  parse it); a static test scans this directory.
- No Python runtime in any client; the reference implementation is used only
  to generate fixtures on a developer machine.
