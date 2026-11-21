# NB-2–NB-10 and VER-1–VER-7 — Completed Default-Off Development Build

| Document control | Value |
|---|---|
| Date | 22 November 2026 |
| Repository | `Liamhigh/webdocsol` |
| Base | `438c7915d613b8727758e4b3d02c93d62894bbfd` (merged NB-0/NB-1 `main`) |
| Branch | `feat/nine-brain-development-completion` |
| Build status | Complete local development implementation; pull-request and peer review remain required |
| Production status | **Not enabled**; no production engine, report renderer, Findings JSON, Worker route, seal, QR or OpenTimestamps semantics changed |
| Canonical architecture | Exactly B1–B9; no tenth brain |
| NB-0 governance | `OPEN_AWAITING_GOVERNANCE_DECISION` |
| Concordance | `POLICY_UNRESOLVED` |
| Live independent review | Disabled and unconfigured; tests use mocked Mistral/DeepSeek responses |
| Human adjudication | Contract and revision-checked workflow implemented; only synthetic human decisions appear in tests |
| Legal coverage | Cross-border framework with the existing South African citation-syntax pack first; no governing-law or authoritative legal conclusion |
| Release flags | All `false` |

## 1. What “completed” means here

This build completes the remaining **development system** described by NB-2–NB-10 and VER-1–VER-7. It supplies executable contracts, deterministic orchestration, research algorithms, isolated provider adapters, fail-closed panel logic, human-adjudication records, grounded narrative provenance, annexes, tests and rollback controls.

It does **not** claim that the production service now performs nine-brain analysis, that NB-0 has selected a voting rule, that live AI verification is active, that legal conclusions are authoritative, or that a court has accepted or validated the software. Production promotion and deployment remain separate governance actions.

## 2. File map

New development modules under `development/nine-brain/`:

- `util.js` — canonical JSON, SHA-512 identities, deterministic IDs, immutability, coverage and safe-validation helpers.
- `allen-algebra.js` — all 13 Allen interval relations, converses, 169 generated compositions, bounded path consistency and concrete witness validation.
- `research.js` — RES-1–RES-9 structured research slices.
- `orchestration.js` — NB-2–NB-6, NB-8 and NB-10 two-pass orchestration and release controls.
- `legal.js` — B7 cross-border observation framework and separately gated archive-adapter envelope.
- `verification.js` — VER-1–VER-7 packets, provider adapter, review/panel records, secure development handler, dispositions, narrative provenance and annexes.

New synthetic tests:

- `tests/nine-brain-fixtures.js`
- `tests/nine-brain-orchestration-research-legal.test.mjs`
- `tests/nine-brain-verification-adjudication.test.mjs`

Updated repository controls and documentation:

- `.assetsignore` and `worker/static-proxy.js` exclude/deny `development/`.
- `tests/run-development.js` registers three development suites without changing the 65-suite production/baseline registry.
- `package.json` includes every new module in `npm run check`.
- `REFERENCE.md` and `tests/README.md` describe the implementation and verification boundaries.

No archive dependency was imported or installed. No real-matter evidence was added.

## 3. NB implementation record

| Work package | Implemented development capability | Explicit boundary |
|---|---|---|
| NB-2 | Canonical B1–B9 input views, evidence/claim/finding lineage, engagement decisions and complete unit accounting | Existing-finding mapping is orchestration input, not proof of a new production detector |
| NB-3 | First-pass run records plus candidate, B4 support, opposition, exclusion and B9 recommendation registers | Candidates are not production findings; B4 support is not independent corroboration |
| NB-4 | P1–P7 promotion coordinator with exact `failed_rules` reconciliation | P2/P3/P4/P5/P7 require explicit review evidence; hashes cannot substitute for semantic review |
| NB-5 | Finding audits, guardian decisions and technical-reproducibility certifications tied to actual second-pass runs | No truth, judicial, admissibility or human-adjudication certification |
| NB-6 | Second-pass records, dissent and coverage-gap accounting | Concordance stays unresolved; no two- or three-brain agreement conclusion |
| NB-7 | RES-1–RES-9 research algorithms over structured or synthetic inputs | Research output remains advisory/candidate-level |
| NB-8 | Dedicated B8 media candidates using contracted rational-time anchors | Media observations only; no automatic authenticity or identification conclusion |
| NB-9 | Verification/disposition/narrative annex records bound to committed revisions | Production report renderer and sealing semantics are untouched; annex itself is not sealed |
| NB-10 | All release flags false, static exclusion, compatibility identities and revert-based rollback | No production rollout, migration, deployment or branch deletion |

## 4. Research slices

- **RES-1:** normalized claim alignment distinguishes polarity and numeric candidates from qualifier/actor mismatches and unknown polarity.
- **RES-2:** deterministic evidence/claim graph with complete coverage and candidate lineage.
- **RES-3:** bounded formal-fact saturation with derivation proofs, conflict candidates and budget-exhaustion status.
- **RES-4:** cross-document contract duplicate map labelled false-positive-only, not a contradiction finding.
- **RES-5:** detection and exact-anchor localization metrics calculated separately.
- **RES-6:** supplied reviewer-result disagreement analysis; no live reviewer call and no “agreement equals truth” inference.
- **RES-7:** exact Allen relation composition; path consistency is labelled `PATH_CONSISTENT_NOT_SCHEDULE_PROOF`, while a separate witness validator can prove a supplied schedule.
- **RES-8:** rejection register that retains evidence and audit history.
- **RES-9:** formal reasoner restricted to explicitly synthetic facts and reviewed synthetic rules; unknown is not disproof and no legal conclusion is emitted.

## 5. Triple Verification implementation

The technical review seats are:

1. The responsible eligible B1–B8 brain’s deterministic source/rule review.
2. An isolated Mistral review.
3. An isolated DeepSeek review.

The implementation enforces the following:

- Both model requests contain the byte-identical immutable packet and exact Constitution text/hash.
- Packets contain minimum-necessary excerpts and anchors, never original PDF bytes.
- Providers receive no other reviewer’s response.
- Distinct provider/model/endpoint origins are required; duplicate/common-origin seats fail.
- Strict bounded JSON, response-size limits, timeouts, HTTPS endpoints and explicit unavailable/malformed statuses are implemented.
- No silent cross-provider fallback exists.
- Unknown anchors, changed propositions, cross-talk, missing raw output and status/raw-response inconsistencies fail closed.
- Source, context and independence tests must pass in every seat.
- Two passing seats out of three produce a failed panel, not verification.
- A technically supported panel still cannot grant an independent-verification label before separate human adjudication.

The VER-4 development handler derives the responsible-brain review from the finding audit and obtains endpoints/configuration from trusted server-side dependencies. Client-supplied provider endpoints are not used. The handler is **not wired into the production Worker**.

## 6. Disposition, narrative and annex controls

`DispositionStore` implements monotonic revisions and compare-and-swap commits. A stale expected revision is rejected. Confirmation requires a valid, recomputed three-seat technical panel. Context resolution requires anchored qualifying evidence from the immutable packet. Rejection, resolution or narrative changes never delete evidence or audit history.

`NarrativeProvenance` requires separate human approval bound to the current disposition digest. Every material statement must be verbatim authorized source text mapped to source IDs; invented facts or law are rejected. Narrative cannot itself resolve a contradiction.

`VerificationAnnex` validates packet, reviews, panel, disposition and narrative digests and refuses stale/superseded revisions. It reports `READY_FOR_EXISTING_EXTERNAL_SEALER`, `sealed: false` and `blockchain_anchor: null`; it does not alter the existing sealer or claim blockchain anchoring.

## 7. B7 cross-border framework

Jurisdictions and pack selections must be explicit. IP address, device region, language and locale are not used. Connecting factors require declared jurisdictions and source evidence IDs.

The South African pack is pinned as `za` version `1.0.0`, authority `CITATION_SYNTAX_ONLY`. Other declared jurisdictions remain visible coverage gaps unless separately implemented and reviewed. Citation occurrences retain `semantic_support: NOT_EVALUATED`.

The output always retains `governing_law: null` and empty authoritative-legal/admissibility conclusion arrays. Foreign elements produce `CROSS_BORDER_REVIEW_REQUIRED`, not an automatic conflicts rule.

Archive adapters require an explicit `APPROVED_FOR_DEVELOPMENT` licence/security review and emit default-off observations only. This build adds the adapter contract, not unreviewed third-party code.

## 8. Verification evidence

Final local results on the isolated branch:

- `npm test` — **all 65 production/baseline suites GREEN**.
- `nine-brain-contracts.test.mjs` — **200 assertions passed**.
- `nine-brain-orchestration-research-legal.test.mjs` — **236 assertions passed**.
- `nine-brain-verification-adjudication.test.mjs` — **59 assertions passed**.
- Development total — **495 assertions passed, 0 failed**.
- Playwright — **12 tests passed** across Chromium, Firefox and WebKit.
- `npm run check` — all shipped and development JavaScript syntax checks passed.
- `tests/site-serving.test.mjs` — **61 assertions passed**, including `development/` exclusion/deny parity.
- `tests/documentation-consistency.test.mjs` — **34 assertions passed**.

The first full Node attempt had one environment-only startup failure because the clean worktree lacked locked development dependencies. After installing the lockfile dependencies without lifecycle scripts or bin symlinks, the complete suite passed. The first browser attempt likewise could not launch missing browser binaries; after installing the pinned Playwright browsers, all 12 tests passed. Neither environment failure is counted as a passing test.

## 9. Production compatibility and rollback

The following production files were not edited:

- `forensic-engine-page.js`
- `forensic-report.js`
- `seal-document.html`
- `worker/verum-rules.js`
- `analysis-config.js`
- `analysis-contracts.js`
- `tests/run-all.js`

Findings JSON remains `1.11.0`; the production engine remains `5.7.2-web`. Existing seals and OTS proofs are untouched. The new modules are not referenced by production pages or Worker routes.

Rollback is revert-based: revert the branch commit or remove `development/nine-brain/`, its three test files and registrations, then restore the two static-serving exclusions and documentation. There is no database migration, persisted production state, provider credential, live route or seal-format migration to unwind.

## 10. Remaining gates before any production claim

1. Technical, logical, legal and clarity peer review of the pull request.
2. A versioned human NB-0 governance decision selecting concordance policy, agreement unit and independence test.
3. Separate route/contract/security review before wiring VER-4 into a Worker.
4. Provider credentials, egress/privacy review, live-provider evaluation and resource limits before enabling external calls.
5. Qualified legal sourcing/review and additional jurisdiction packs before legal conclusions beyond syntax observations.
6. Real-corpus evaluation with lawfully usable data; synthetic tests are not scientific validation or exhaustive detection evidence.
7. Explicit production rollout approval, final-head CI and rollback readiness.
8. Separate approval for any merge, deployment or branch deletion.

Until those gates are complete, this is a completed **default-off development build**, not a completed production certification.
