# Enhancement plan — status record

This file records **where the multi-phase forensic-capability enhancement plan stands**. It is a
living status document, not the plan itself: the plan was supplied to the team as an external
briefing (`575b433c…PDF`, not committed to this repository). Update this file whenever a phase
slice is merged, opened, blocked or deferred.

Everything in this plan follows the non-negotiables in [`AGENTS.md`](./AGENTS.md): new analysis
capability is **flagged and default-off**, **observations-only** until separately reviewed, never
alters existing findings or the findings JSON without its own reviewed change, stays deterministic
(no clock, no randomness, no regex lookbehind), and keeps `node tests/run-all.js` green and
`npm run check` clean. Evaluation harnesses are **development/CI-only** and never imported by the
browser sealing path.

Last updated: **2026-11-19**.

## At a glance

| Phase | Slice | PR | Status |
|---|---|---|---|
| 0 | Verified deterministic analysis foundations (`analysis-contracts.js`, `analysis-config.js`) | #302 | **Merged** (2026-11-17) |
| 1 | Development-only B9 evaluation harness | #303 | **Merged** (2026-11-18) |
| 1 | Post-merge correction `042249f`; remove transfer payload | #308 | Open (corrected head `0c06cd215786761f3f5a4b2a4566f57e7300457f`; base of the stack) |
| 1 | ContractNLI evaluation adapter (PR 1.2) | #309 | Open |
| 1 | ContraDoc adapter + dual metrics (PR 1.3) | #310 | Open |
| 2 | Eyecite citation conformance spike + decision record (PR 2.1) | #311 | Open |
| 2 | Citation occurrence core + South African pack (PR 2.2) | #312 | Open |
| 2 | Signed authority packs (PR 2.3) | — | **Blocked** (founder key rotation) |
| 2 | ECTA note (PR 2.4) | — | **Blocked** (needs qualified legal review) |
| 3 | Synthetic redaction boundary fixtures (PR 3.1) | #313 | Open (ready for review) |
| 3 | Enhancement-plan status record | #314 | Open |
| 4 | PDF graph and incremental-revision forensics (PRs 4.1–4.2) | — | Not started |
| 5 | Allen temporal algebra (PR 5.1) | — | Not started |

The open phase work is a single stack, each PR based on the previous one. #307 is a duplicate
corrective PR that remains open; it is not the base of this stack.

```
main
 └─ #308 ─ #309 ─ #310 ─ #311 ─ #312 ─ #313 ─ #314
    P1      P1      P1      P2      P2      P3      docs
```

All PRs #308–#314 are open as of this update. Merge in stack order; each PR must land (or be
retargeted to `main`) before the one above it. Do not mark work merged until GitHub confirms the
merge.

## Phase detail

### Phase 0 — deterministic analysis foundations · Merged (#302)

Established the shared contracts every later phase builds on: `analysis-contracts.js`
(deterministic envelopes, UTF-16/structural/OCR/pair anchors, stable ordering/IDs, `sha512Hex`)
and `analysis-config.js` (the module feature-flag registry — every flag fails closed until a
module is implemented and reviewed). Guarded by `tests/analysis-contracts.test.mjs` and
`tests/documentation-consistency.test.mjs`.

### Phase 1 — B9 evaluation harness · Merged (#303) + open adapters (#308–#310)

A development/CI-only evaluation harness with a common schema, UTF-16 alignment, separate
detection/localization metrics, canonical developer reports and a CLI. It is never imported by the
browser sealing or production analysis path; downloaded dataset caches and generated reports are
git-ignored (`evaluation/.cache/`).

- **#303 (merged)** — the harness core (`tests/evaluation-metrics.test.mjs`).
- **#308 (open)** — applies the exact reviewed correction `042249f` and removes a transfer payload;
  it is the base of the open stack.
- **#309 (open)** — ContractNLI adapter: pinned dataset verification, code-point→UTF-16 span
  conversion, a conservative hypothesis map (all 17 hypotheses mapped `not_applicable` because no
  existing Verum detector matches their semantics), deterministic sharding and zip integrity
  (`tests/evaluation-contractnli.test.mjs`).
- **#310 (open)** — ContraDoc adapter and dual metrics: verbatim evidence/ref anchoring, published
  scope labels, `verum_exact` anchor metrics with per-document negative-set false positives, and a
  `published_comparable` reproduction of the official settings
  (`tests/evaluation-contradoc.test.mjs`).

### Phase 2 — legal citation capability (flagged, observations only)

- **#311 (open) — PR 2.1, Eyecite conformance spike.** A read-only conformance spike with a pinned
  17-case corpus generated against official Python Eyecite 2.7.8. Two candidate TypeScript ports
  were measured (`@beshkenadze/eyecite` 10/17, `eyecite-ts` 3/17) and **neither was vendored**; the
  decision record is `evaluation/eyecite/DECISION.md`. Guarded by `tests/evaluation-eyecite.test.mjs`
  (includes the no-lookbehind static guard).
- **#312 (open) — PR 2.2, citation occurrence core + ZA pack.** A neutral citation occurrence core
  (`legal-citations.js`), an explicit jurisdiction-pack registry (`legal-packs.js`) and the first
  South African pack (`legal-packs/za.js`), wired into the engine behind `opts.modules.citations`.
  The flag is **default-off**; when on, the module emits observations into
  `result.moduleResults.citations` with an always-empty `findings` array — it is **not** wired into
  the detector pipeline or the findings JSON. Occurrences keep raw text and page-local UTF-16
  offsets; `Id.`/`supra` resolution is `resolved`/`ambiguous`/`unresolved`, never a score.
  Guarded by `tests/legal-citations.test.mjs` and `tests/legal-citations-za.test.mjs`.
- **PR 2.3 — signed authority packs · Blocked.** The founder chose to **defer key rotation**.
  Rotation has **not started**. The signing key is not on the Worker, and every client pins
  `vo-master-1`; signed-pack work remains blocked unless and until the rotation proceeds.
- **PR 2.4 — ECTA note · Blocked.** Requires qualified legal review before any statutory note is
  written into the engine or reports.

### Phase 3 — redaction fixtures · Open (#313, ready for review)

Test-only, synthetic, CC0 fixtures for redaction-like spans with exact UTF-16 offsets, protected
verbatim-evidence quotes and passages that must remain unchanged
(`tests/fixtures/redaction/cases-v1.json`, `tests/redaction-fixtures.test.mjs`). **No production
redaction behaviour is implemented**: the `redaction` module in `analysis-config.js` is unlisted
as implemented and the test confirms it still fails closed. This encodes the binding boundary in
[`ENGINE.md`](./ENGINE.md) §12.22: redaction or other filtering may affect generated descriptions
only — never the record or verbatim evidence quotations.

### Phase 4 — PDF graph and incremental-revision forensics · Not started

The source plan defines two future slices; neither implementation is approved or merged:

- **PR 4.1 — QPDF/WASM feasibility and active-graph adapter · Not started.** Assess feasibility
  and, only if separately approved, expose a bounded description of the PDF's active object
  graph. QPDF's writer is not a revision-history API.
- **PR 4.2 — revision-chain scanner · Not started.** A separate bounded scanner for incremental
  revision history; it must not rewrite source bytes.

Any future work must fail closed on unsupported or ambiguous input, enforce explicit resource
bounds, preserve the original bytes, and never rewrite the source document. These are constraints
on future proposals, not claims that an implementation or approval exists.

### Phase 5 — Allen temporal algebra · Not started

PR 5.1 (Allen interval temporal algebra over the timeline) is a future slice. Not begun; no branch
or PR exists.

## Rules for the next slice

1. Confirm the exact next item against the plan briefing before implementing.
2. Keep new analysis capability flagged, default-off and observations-only; do not allocate
   contradiction types or touch the findings JSON without a separately reviewed change.
3. Re-run `node tests/run-all.js`, `npm run check` and `git diff --check`; re-splice any inlined
   source file and let `tests/inline-scripts.test.mjs` confirm byte-identity.
4. Update suite counts wherever they are written (`tests/run-all.js`, `ENGINE.md`, `AGENTS.md`,
   `REFERENCE.md`, `README.md`, `tests/README.md`, `tests/documentation-consistency.test.mjs`) and
   update **this file**.
5. Before updating statuses, check live PR states, exact heads and base refs; keep the full open
   stack (including the current status-record PR) accurate, list duplicate #307 separately, and
   update the PR description's stack diagram. Mark a slice merged only after GitHub confirms it.
