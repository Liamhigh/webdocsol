# Enhancement plan — living status record

This file records **where the forensic-engine enhancement programme stands**. The complete dependency-led design is now in **[`ENHANCEMENT-IMPLEMENTATION-PLAN.md`](./ENHANCEMENT-IMPLEMENTATION-PLAN.md)**. Read both: this file is the current status index; the detailed document supplies architecture, file-level work packages, security controls, tests, rollout, rollback and acceptance gates.

Court-record and public-law wording is governed by **[`LEGAL-VALIDATION.md`](./LEGAL-VALIDATION.md)**. Filing, receipt, non-exclusion and procedural orders are not judicial validation.

Everything follows the non-negotiables in [`AGENTS.md`](./AGENTS.md): new analysis capability is **flagged and default-off**, **observations-only** until separately reviewed, never alters existing findings or Findings JSON without its own reviewed change, stays deterministic (no clock, randomness or regex lookbehind), and keeps `node tests/run-all.js` green and `npm run check` clean. Evaluation harnesses are **development/CI-only** and never imported by the browser sealing path.

Last updated: **2026-11-20**.

Reviewed `main` baseline: **`48836bc7c2f245b00e181d66b539c199d6fcaf2d`**.

Engine: **`5.7.2-web`**. Production Findings JSON: **`1.11.0`**. Sealing standard: **VO-DSS-1.2**.

## At a glance

| Phase | Slice | PR | Reconciled status at the reviewed baseline |
|---|---|---|---|
| 0 | Verified deterministic analysis foundations (`analysis-contracts.js`, `analysis-config.js`) | #302 | **Merged** 2026-11-17 |
| 1 | Development-only B9 evaluation harness | #303 | **Merged** 2026-11-18 |
| 1 | Post-merge correction `042249f`; remove transfer payload | #308 | **Merged** 2026-11-19 (`574b276`) |
| 1 | ContractNLI evaluation adapter (PR 1.2) | #309 | **Merged** 2026-11-19 (`257ecc2`) |
| 1 | ContraDoc adapter + dual metrics (PR 1.3) | #310 | **Merged** 2026-11-19 (`65b1b55`) |
| 2 | Eyecite citation conformance spike + decision record (PR 2.1) | #311 | **Merged** 2026-11-20 (`a5dfefb`) |
| 2 | Citation occurrence core + South African pack (PR 2.2) | #312 | **Merged** 2026-11-20 (`b1cf41a`) |
| 2 | Signed authority packs (PR 2.3) | — | **Blocked** — coordinated key rotation deferred; no replacement trust key may be invented |
| 2 | ECTA note (PR 2.4) | — | **Blocked** — qualified legal review required |
| 3 | Synthetic redaction boundary fixtures (PR 3.1) | #313 | **Merged** 2026-11-20 (`baa2d27`); **fixtures only**, no production redaction module |
| Docs | Enhancement-plan status record | #314 | **Merged** 2026-11-20 (`1a48c83`) |
| 4 | Bounded QPDF-WASM active-graph feasibility prototype (PR 4.1) | #316 | **Merged** 2026-11-20 (`48836bc`); **prototype**, not full hardening or revision history |
| 4 | Incremental-revision chain scanner (PR 4.2) | — | **Not started** |
| 5 | Allen temporal algebra (PR 5.1) | — | **Not started** |
| 6 | Image metadata | — | **Not started**; dependency/capability spike required |
| 7 | Read-only C2PA / Content Credentials | — | **Not started**; SDK/WASM and trust-model review required |
| 8 | Spatial OCR and native coordination | — | **Not started** in `webdocsol`; external native paths require separate repository audits |

The former #308–#314/#316 stack is **merged**. Older instructions describing those PRs as open or requiring stack-order merges are historical and must not be followed. Check current source, current PR state and this record before selecting work; do not treat the detailed plan as evidence that an option has shipped.

## Current module registry

All eight flags are default-off. `IMPLEMENTED_MODULES` contains only `citations` and `pdfGraph`; every other flag fails closed if activated.

| Flag | Current implementation state | Authority and release boundary |
|---|---|---|
| `citations` | **Implemented, default-off** — citation occurrence extraction and South African jurisdiction pack | Emits observations in `result.moduleResults.citations`; no detector findings and no automatic legal conclusion |
| `pdfGraph` | **Bounded active-graph prototype, default-off** | Current usable object graph only; no revision history, authenticity finding or tampering verdict |
| `redaction` | **Synthetic fixtures only; production module not implemented** | Activation fails closed; no production redaction observation may be claimed |
| `revisions` | **Not implemented** | Requires a separate original-byte revision-chain scanner; QPDF writing is not revision forensics |
| `temporalAlgebra` | **Not implemented** | Planned pure Allen algebra and supplied-constraint observations only |
| `imageMetadata` | **Not implemented** | Dependency admission, deterministic normalisation, privacy and bounded-resource gates remain |
| `c2pa` | **Not implemented** | Read-only design only; no writer, inferred authenticity or hidden trust-network dependency |
| `spatialOcr` | **Not implemented here** | Planned parallel geometry/span output; existing text anchors remain compatible and no rectangles may be fabricated |

## Contract and compatibility state

- `tests/contracts/findings-extension-proposal.json` is proposal **`0.1.0`**, marked `PROPOSED_ONLY_NOT_APPROVED_FOR_PRODUCTION`, with `next_production_version: null`.
- Production `buildFindingsJson` remains **`1.11.0`**. Do **not** assume or pre-announce `1.12.0`.
- Observations remain in `result.moduleResults` and approved development/preview surfaces until coordinated website, `1verum`, `firebase` and relevant native/client review approves an additive extension version.
- Unknown-module and unknown-extension preservation, old-producer/new-reader, new-producer/old-reader, stable ordering and duplicate-retention behaviour require versioned golden fixtures before a cross-client release.
- The baseline assurance record is **65 registered Node suites**, `npm run check`, `git diff --check`, and **12 Playwright tests** across Chromium, Firefox and WebKit. These establish the reviewed baseline, not proof that unimplemented modules work.

## Phase detail

### Phase 0 — deterministic analysis foundations · Merged (#302)

Established `analysis-contracts.js` (deterministic envelopes, UTF-16/structural/OCR/pair anchors, stable ordering/IDs and `sha512Hex`) and `analysis-config.js` (the default-off feature-flag registry with fail-closed activation). Guarded by `tests/analysis-contracts.test.mjs` and `tests/documentation-consistency.test.mjs`.

### Phase 1 — B9 evaluation harness and adapters · Merged (#303, #308–#310)

The harness and adapters are development/CI-only. They are never imported by the browser sealing or production analysis path; downloaded dataset caches and generated reports remain git-ignored.

- **#303** — harness core and evaluation metrics.
- **#308** — exact reviewed correction `042249f` and transfer-payload removal.
- **#309** — ContractNLI adapter with pinned dataset verification, code-point→UTF-16 span conversion, conservative hypothesis mapping, deterministic sharding and ZIP integrity.
- **#310** — ContraDoc adapter and dual metrics with verbatim anchors, published-scope labels, negative-set false positives and the separately labelled `published_comparable` reproduction.

Evaluation output is not a sealed engine finding, verdict or production confidence score.

### Phase 2 — legal citation capability · Occurrences merged; authority and ECTA work blocked

- **#311 — Eyecite conformance spike, merged.** A read-only 17-case corpus generated against official Python Eyecite 2.7.8 measured two candidate TypeScript ports; neither met the admission decision and neither was vendored. See `evaluation/eyecite/DECISION.md` and `tests/evaluation-eyecite.test.mjs`.
- **#312 — citation occurrence core + ZA pack, merged.** `legal-citations.js`, `legal-packs.js` and `legal-packs/za.js` run behind `opts.modules.citations`. Occurrences preserve raw text and page-local UTF-16 offsets. `Id.`/`supra` resolution is `resolved`, `ambiguous` or `unresolved`, never a score. The module’s `findings` array remains empty.
- **PR 2.3 — signed authority packs, blocked.** Coordinated key rotation was deferred and has not started. Existing clients pin `vo-master-1`; do not request the missing original private key, create an unreviewed substitute trust root or imply signed packs are live.
- **PR 2.4 — ECTA note, blocked.** Qualified legal review is required before statutory language is written into engine or report output. The separate public-law status note does not discharge that review.

### Phase 3 — redaction boundary fixtures · Merged (#313); production inspection not started

Test-only, synthetic CC0 fixtures cover redaction-like spans with exact UTF-16 offsets, protected verbatim-evidence quotes and passages that must remain unchanged (`tests/fixtures/redaction/cases-v1.json`, `tests/redaction-fixtures.test.mjs`). **No production redaction behaviour is implemented.** The `redaction` flag remains unlisted as implemented and fails closed.

The next production slice must follow the detailed plan’s operator-state, render-differential, privacy and resource work packages. The strongest permitted observation concerns measured text/paint intersection and retained content-stream data; it must not infer who painted a region or an intention to conceal.

### Phase 4 — PDF graph and revision forensics · Active-graph prototype merged (#316); revision scanner not started

The merged `pdfGraph` prototype is explicit and default-off. QPDF 12.2.0 runs in a disposable browser worker with an 8-MiB input cap, a 256-MiB Wasm memory maximum, a 2-MiB JSON-output cap, object/reference/traversal limits and a 15-second deadline. It returns bounded active-graph observations, not findings. Stream data, raw objects and metadata do not leave the worker.

Over-limit input is rejected before hashing or worker creation; the required 128-hex `input_sha512` is then an all-zero sentinel and `failure.details` names `not_computed_input_over_limit` plus the exact `input_bytes`. In-bounds inputs retain their actual SHA-512 identity.

The active graph is the PDF’s current usable object graph. It is **not** historical revision analysis and does not establish authenticity or tampering. The separate revision-chain scanner must follow original byte-level `startxref` and `/Prev` chains, preserve the source bytes and never use a PDF writer on source evidence.

### Phases 5–8 — temporal, media, provenance and spatial OCR · Not started

No branch or implementation is recorded at the reviewed baseline for Allen temporal algebra, image metadata, C2PA or spatial OCR. Follow the detailed plan rather than creating a monolithic enhancement branch. Each track requires its own dependency admission, deterministic contract, negative corpus, privacy/security review, resource limits, replay evidence and independently reversible rollout.

## Rules for the next slice

1. Read [`AGENTS.md`](./AGENTS.md), this status record and the detailed implementation plan. Confirm the exact next item against current source and live PR state.
2. Complete or explicitly satisfy Gates A–D in the detailed plan. Do not start every option in parallel before shared contracts and compatibility review are ready.
3. Keep new capability flagged, default-off and observations-only. Do not allocate contradiction types, change production report language or alter Findings JSON without separately reviewed taxonomy/schema work.
4. Preserve original evidence bytes and every existing anchor, ordering, seal, OTS, QR, manifest and old-seal verification contract. Rollback changes future behaviour only; historical outputs are never rewritten.
5. Use the repository’s classic-script/namespaced-IIFE style and CommonJS test exports. Add new production JavaScript to `npm run check` and every new Node suite to `tests/run-all.js`.
6. Edit root production sources and re-splice every inlined copy byte-for-byte; let `tests/inline-scripts.test.mjs` confirm identity. Do not edit obsolete `seal-module/web/` snapshots as live sources.
7. Run `node tests/run-all.js`, `npm run check` and `git diff --check`; add focused positive, negative, ambiguous, malformed, unsupported, budget, replay and rollback evidence for the slice.
8. Update this file only with verified merged/open/blocked/not-started states. Keep dates, PR numbers and implementation boundaries accurate. Update suite counts wherever the repository records them when they change.
9. Merge to `main` deploys through Cloudflare Workers Builds. Opening or pushing a documentation branch is not deployment; do not merge or deploy as a side effect of selecting or planning work.
