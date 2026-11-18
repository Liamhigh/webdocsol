# Decision record: citation parser approach (PR 2.1 spike)

- **Status**: decided by this spike's measured results, awaiting founder sign-off in PR review.
- **Date of the spike run**: 2026-11-18, reference `eyecite==2.7.8` (pinned), corpus v1.0.0 (17 cases).
- **Plan gate**: the selected approach must preserve exact spans and
  deterministic ordering, run locally, pass the compatibility corpus, and
  avoid an unmaintained production dependency — otherwise build the narrow
  parser rather than accept a black-box port.

This record lives in `evaluation/eyecite/` deliberately: the plan's
`docs/decisions/` convention is a new documentation convention for this
repository and is not introduced unilaterally. If the founder accepts that
convention, this file can move to `docs/decisions/citation-parser.md`
unchanged.

## Measured results (reproduce: `node evaluation/eyecite/compare.mjs`)

| Port | Exact case matches | Resolution clusters |
|---|---|---|
| `@beshkenadze/eyecite` 2.7.6-alpha.28 | 10/17 | agreed on all cases it extracted |
| `eyecite-ts` 0.34.2 | 3/17 | diverged on `supra` cases |

`@beshkenadze/eyecite` divergences: `full_span` boundaries (parallel cites,
statute trailing punctuation, one Unicode-offset edge), `supra` span and
matched text (includes the caption prefix), journal spans, missing
`metadata.extra` on parallels, and it *finds* a citation across the line
break the reference deliberately does not match.

`eyecite-ts` divergences: no normalized court identifiers (`9th Cir.` where
the reference reports `ca9`), different pin-cite normalization, `id.` matched
text includes the pin cite, `full_span` frequently absent, statute/journal
component groups absent, a citation found for the malformed unknown-reporter
case the reference rejects, and confidence scores throughout (stripped by the
adapter, per the Constitution's no-probabilities rule).

## Options considered

1. **Vendor a pinned port with local patches.** Rejected.
   `@beshkenadze/eyecite` is the closer port but is an alpha-versioned fork
   whose divergences sit exactly where Verum's anchors live (spans, short
   forms, parallels). Patching it means owning a divergent alpha fork of a
   black box; `eyecite-ts` is a different tool (document analysis with
   confidence semantics) rather than an eyecite-compatible parser.
2. **Write the narrow neutral parser using Eyecite-derived conformance
   fixtures.** Selected.
3. **Defer US full-case parsing; ship the neutral core plus the South African
   pack.** Folded into option 2 as its rollout: PR 2.2 ships the neutral
   occurrence core and the SA pack first; US full-case coverage is added
   fixture by fixture, and the corpus already records where the reference
   itself is silent (the line-break case), so a deliberate, documented
   divergence is possible without claiming reference parity.

## Decision

**Option 2 with option 3's rollout.** No production dependency is adopted.
PR 2.2 (citation occurrence core) implements the narrow neutral parser;
`conformance.json` becomes its regression fixture set alongside the SA pack
fixtures, with each fixture marked reference-exact or deliberately-divergent.

## Consequences

- No new production dependency; nothing is vendored yet. The spike installs
  live only in the gitignored `evaluation/.cache/`.
- The neutral core must preserve exact spans and deterministic ordering,
  emit explicit resolution states (never fuzzy antecedent scores), run
  locally, and use no regex lookbehind.
- eyecite remains the reference for US case-law behavior if US full-case
  parsing is later scheduled; the corpus and `compare.mjs` are the
  conformance harness for any such work.
