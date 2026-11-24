# NB-2–NB-10 and VER-1–VER-7 — Completed Default-Off Development Build

| Document control | Value |
|---|---|
| Date | 23 November 2026 |
| Repository | `Liamhigh/webdocsol` |
| Base | `438c7915d613b8727758e4b3d02c93d62894bbfd` (merged NB-0/NB-1 `main`) |
| Branch | `feat/nine-brain-development-completion` |
| Build status | Complete local development implementation and synthetic browser Test Lab; final-head peer review and CI remain required |
| Production status | **Not enabled**; a separate public synthetic Test Lab is included, but no production engine, report renderer, Findings JSON, analysis route, seal, QR or OpenTimestamps semantics changed |
| Canonical architecture | Exactly B1–B9; no tenth brain |
| NB-0 governance | `OPEN_AWAITING_GOVERNANCE_DECISION` |
| Concordance | `POLICY_UNRESOLVED` |
| Live independent review | Disabled and unconfigured; tests use mocked Mistral/DeepSeek responses |
| Human adjudication | Contract and revision-checked workflow implemented; only synthetic human decisions appear in tests |
| Legal coverage | Cross-border framework with the existing South African citation-syntax pack first; no governing-law or authoritative legal conclusion |
| Release flags | All `false` |

## 1. What “completed” means here

This build completes the remaining **development system** described by NB-2–NB-10 and VER-1–VER-7. It supplies executable contracts, deterministic orchestration, research algorithms, isolated provider adapters, fail-closed panel logic, human-adjudication records, grounded narrative provenance, annexes, tests and rollback controls. It also supplies a visible **Test Lab** at `/development-lab.html` (extensionless route `/development-lab`) so a non-technical reviewer can execute the synthetic workflow through numbered buttons, inspect the real development records, and download a JSON result.

It does **not** claim that ordinary production scans now perform nine-brain analysis, that NB-0 has selected a voting rule, that live AI verification is active, that legal conclusions are authoritative, or that a court has accepted or validated the software. The Test Lab accepts no document upload, uses local mocked Mistral/DeepSeek transports, and does not mutate production findings, reports or seals. Production promotion and deployment remain separate governance actions.

## 2. File map

New development modules under `development/nine-brain/`:

- `util.js` — canonical JSON, SHA-512 identities, deterministic IDs, immutability, coverage and safe-validation helpers.
- `allen-algebra.js` — all 13 Allen interval relations, converses, 169 generated compositions, bounded path consistency and concrete witness validation.
- `research.js` — RES-1–RES-9 structured research slices.
- `orchestration.js` — NB-2–NB-6, NB-8 and NB-10 two-pass orchestration and release controls.
- `legal.js` — B7 cross-border observation framework and separately gated archive-adapter envelope.
- `verification.js` — VER-1–VER-7 packets, provider adapter, review/panel records, secure development handler, dispositions, narrative provenance and annexes.

New synthetic Test Lab and tests:

- `development/nine-brain-console/runner.js` — executes the actual development modules against synthetic fixtures and local mock transports, with deterministic replay and a canonical export.
- `development/nine-brain-console/browser.js` — connects the visible controls to the runner and renders the nine brains, B7 observations, three review seats, human history, narrative/annex state, records and audit trail.
- `development-lab.html` and generated `development-lab.js` — the only public Test Lab page and browser bundle; no raw `development/` or `tests/` source is published.
- `scripts/build-development-lab.mjs` — pinned `esbuild@0.25.12` browser build.
- `tests/nine-brain-fixtures.js`
- `tests/nine-brain-orchestration-research-legal.test.mjs`
- `tests/nine-brain-verification-adjudication.test.mjs`
- `tests/nine-brain-console.test.mjs`
- `tests/browser/development-lab.spec.mjs`

Updated repository controls and documentation:

- `.assetsignore` and `worker/static-proxy.js` exclude/deny raw `development/`; the Worker allowlist explicitly exposes only the synthetic Test Lab page/bundle and its extensionless page route.
- `index.html` links to the Test Lab without changing scan or sealing behaviour.
- `tests/run-development.js` registers four development suites without changing the 65-suite production/baseline registry.
- `package.json` includes every new module in `npm run check` and provides reproducible Test Lab build/test scripts.
- `REFERENCE.md`, `.github/copilot-instructions.md` and `tests/README.md` describe the implementation and verification boundaries, including development-only rather than production Allen support.

No archive dependency was imported or installed. No real-matter evidence or credentials were added. The only new dependency is the pinned development-only browser bundler.

## 3. NB implementation record

| Work package | Implemented development capability | Explicit boundary |
|---|---|---|
| NB-2 | Canonical B1–B9 input views, evidence/claim/finding lineage, engagement decisions and complete unit accounting | Existing-finding mapping is orchestration input, not brain execution; all units remain skipped rather than falsely marked processed |
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
- **RES-2:** deterministic evidence/claim graph with complete coverage, unique claim IDs and candidate lineage.
- **RES-3:** bounded formal-fact saturation with derivation proofs, known/pending deduplication, conflict candidates and budget-exhaustion status.
- **RES-4:** cross-document contract duplicate map labelled false-positive-only, not a contradiction finding.
- **RES-5:** detection and exact-anchor localization metrics calculated separately; true negatives are emitted only with an explicit candidate universe and duplicate candidate IDs are rejected.
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
- Packets contain bounded minimum-necessary excerpts and original page offsets, never original PDF bytes or unrelated full-page text. Text context is limited to 160 UTF-16 code units on each side and quotes to 2,000 code units after validating the full original source anchor; oversized quotes must be narrowed before submission.
- Providers receive no other reviewer’s response.
- Distinct Mistral/DeepSeek URL origins and transport functions are required, including different paths on one host; duplicate/common-origin seats fail.
- Panel acceptance requires in-process trusted provenance from the responsible-brain workflow and actual configured provider transports. Caller-authored or merely rehashed review records cannot create a passing panel.
- Strict bounded JSON, response-size limits, timeout-triggered transport abortion, HTTPS endpoints and explicit unavailable/malformed statuses are implemented.
- No silent cross-provider fallback exists.
- Unknown anchors, changed propositions, cross-talk, missing raw output and status/raw-response inconsistencies fail closed.
- Source, context and independence tests must pass in every seat.
- Two passing seats out of three produce a failed panel, not verification.
- A technically supported panel still cannot grant an independent-verification label before separate human adjudication.

The VER-4 development handler awaits authorization and derives the responsible-brain review from trusted server-side run/candidate lineage, complete `FindingAudit` validation, original source texts and explicit source/context review evidence. Caller-supplied audits are ignored and matching anchors alone cannot pass the source/context tests. Endpoints/configuration come from trusted server-side dependencies. Client-supplied provider endpoints are not used. The handler is **not wired into the production Worker**.

## 6. Disposition, narrative and annex controls

`DispositionStore` implements monotonic revisions and compare-and-swap commits while preserving every committed revision in history. All instances share one explicitly non-durable process-lifetime state, preventing divergent same-process revision-1 commits; restart persistence is intentionally not claimed. A separately reviewed durable atomic-CAS adapter is required before service deployment. A stale expected revision is rejected. Confirmation requires a valid, recomputed three-seat technical panel with trusted review provenance. Context resolution requires anchored qualifying evidence IDs from the immutable packet; candidate IDs do not qualify. Rejection, resolution or narrative changes never delete evidence or audit history.

`NarrativeProvenance` requires separate human approval bound to both the current disposition digest and revision. Every material statement must be a verbatim quote reconciled directly against the linked disposition packet’s evidence IDs and anchors; caller-supplied excerpt maps cannot authorize invention. Narrative cannot itself resolve a contradiction.

`VerificationAnnex` validates packet, reviews, panel, disposition and packet-grounded narrative digests and checks freshness against the authoritative disposition store, refusing stale/superseded revisions. It reports `READY_FOR_EXISTING_EXTERNAL_SEALER`, `sealed: false` and `blockchain_anchor: null`; it does not alter the existing sealer or claim blockchain anchoring.

## 7. B7 cross-border framework

Jurisdictions and pack selections must be explicit. IP address, device region, language and locale are not used. Connecting factors require declared jurisdictions and source evidence IDs.

The South African pack is pinned as `za` version `1.0.0`, authority `CITATION_SYNTAX_ONLY`. Other declared jurisdictions remain visible coverage gaps unless separately implemented and reviewed. Citation occurrences retain `semantic_support: NOT_EVALUATED`.

The output always retains `governing_law: null` and empty authoritative-legal/admissibility conclusion arrays. Validation derives conflicts-review status from the declared jurisdictions and foreign connecting factors, so recomputed identities cannot erase mandatory review. Foreign elements produce `CROSS_BORDER_REVIEW_REQUIRED`, not an automatic conflicts rule.

Archive adapters require an explicit `APPROVED_FOR_DEVELOPMENT` licence/security review and emit default-off observations only. This build adds the adapter contract, not unreviewed third-party code.

## 8. Synthetic Test Lab

After the PR is merged and deployed, open `/development-lab.html` or choose **Test Lab** from the main website. Until that deployment is verified, the route is implemented on the PR but is not claimed to be available on the live main website.

Run the all-pass scenario first:

1. Leave **Reviewer scenario** on **All three reviews pass**.
2. Select **Run B1–B9**. Expect a valid two-pass run and a matching deterministic replay, with exactly nine brain rows.
3. Select **Run technical review**. Expect three distinct passing technical seats and `TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION`; this is not yet a human-verified finding.
4. Keep the synthetic adjudicator/reason values or enter test-only values, choose `CONFIRMED`, and select **Commit human decision**.
5. Select **Approve narrative & prepare annex**. Expect a grounded narrative and `READY_FOR_EXISTING_EXTERNAL_SEALER`, while `sealed` remains `false` and `blockchain_anchor` remains `null`.
6. Open the canonical-record inspector and audit trail to review the actual records.
7. Select **Download test JSON** and send the resulting `verum-development-test-all-pass.json` file back for review.

Then select **Reset test session** and repeat steps 2–4 for each failure scenario. DeepSeek dissent, provider unavailability and malformed output must each fail closed even though the deterministic and Mistral seats pass; `CONFIRMED` must be rejected and no narrative or annex may be created. Download each JSON result separately.

The page uses only bundled synthetic statements. It has no upload control, credential field, database, live provider transport, production report mutation or production seal mutation. Mocked reviewer agreement is not live independent AI verification, scientific validation, a court finding or a legal conclusion.

## 9. Verification evidence

Final local results on the isolated branch:

- `npm test` — **all 65 production/baseline suites GREEN** and **all four separately gated development suites GREEN**.
- `nine-brain-contracts.test.mjs` — **200 assertions passed**.
- `nine-brain-orchestration-research-legal.test.mjs` — **264 assertions passed**.
- `nine-brain-verification-adjudication.test.mjs` — **95 assertions passed**.
- `nine-brain-console.test.mjs` — **48 assertions passed**.
- Development total — **607 assertions passed, 0 failed**.
- Playwright — **27 tests passed** across Chromium, Firefox and WebKit: 15 Test Lab tests plus the existing 12 browser tests.
- Test Lab scenarios cover all-pass export/reset, dissent, unavailable provider, malformed response and responsive layouts at 375, 768, 1024 and 1440 pixels in every engine.
- Offline guards confirmed no unexpected document egress or live provider calls; downloaded JSON was parsed and checked in every engine.
- `npm run check` — all shipped and development JavaScript syntax checks passed.
- `tests/site-serving.test.mjs` — **64 assertions passed**, including public Test Lab assets and raw development/test-source denial.
- `tests/documentation-consistency.test.mjs` — **34 assertions passed**.
- Final rendered phone/tablet/desktop inspections found no document overflow or clipped status labels.

Earlier environment-only dependency and missing-browser failures were repaired and rerun rather than counted as passing tests. Browser-only UTF-8 byte counting, phone overflow, Firefox reset-state restoration and download-completion synchronisation defects were fixed with regressions. The final uninterrupted browser run passed all 27 tests.

## 10. PR #324 review remediation

The automated PR review findings were addressed with fail-closed implementation changes and regression tests rather than by weakening assertions:

- Minimum-necessary packet/provider excerpts with substantial unrelated-text absence tests.
- Awaited asynchronous authorization; trusted handler audit lineage; complete audit and exact packet/evidence reconciliation.
- Explicit responsible-brain source/context review evidence; packet-evidence-only review anchors; substantive grounded content for every passing review; shared-endpoint rejection; timeout cancellation.
- Evidence-only context resolution, complete disposition history, packet-grounded narrative and authoritative-store annex freshness.
- Consistent explicit B8 view/candidate mapping; guardian-approved certified-only second-pass `finding_ids`; cyclic/malformed run validation without throws.
- Precomputed Allen set composition; unique claim/metric identities; unresolved opposite-polarity/different-object alignment; formal deduplication and RES-9 budget propagation.
- Recomputed B7 observation IDs/digests and exact declared-jurisdiction/pack/coverage-gap reconciliation.
- True negatives omitted unless a candidate universe is defined.
- Fresh final-head review remediation: trusted in-process review provenance; distinct provider origins and transports; exact audit/guardian/candidate lineage; missing-evidence preservation; B8 media-only views and promotion anchors; no processed coverage without brain execution.
- Packet quote limits, cyclic-packet fail-closed validation, shared process-local disposition CAS state, and human narrative approval bound to both revision and digest.
- Unknown-object and equal-amount alignment guards, consistent oracle candidate universes, subject/predicate-scoped formal conflicts, malformed-witness error returns, and B7 conflicts-status recomputation.
- Semantic tamper regressions recompute record identities/digests so stale-hash checks alone cannot satisfy them.

The proposed common production module envelope was **not** applied to RES research outputs. These functions return explicitly development-only, non-module research records; wrapping them in `ModuleEnvelope` would falsely suggest a contracted analysis module executed and would silently mix research contracts with production module semantics. Their existing `vo.nine-brain-research.v1` schemas and production-finding prohibitions remain unchanged.

## 11. Production compatibility and rollback

The following production analysis and sealing files were not edited:

- `forensic-engine-page.js`
- `forensic-report.js`
- `worker/verum-rules.js`
- `analysis-config.js`
- `analysis-contracts.js`
- `tests/run-all.js`

`worker/static-proxy.js` received only the explicit synthetic Test Lab page mapping. Findings JSON remains `1.11.0`; the production engine remains `5.7.2-web`. Existing seals and OTS proofs are untouched. Ordinary production scans do not import or execute the development modules.

Rollback is revert-based: revert the branch changes or remove `development/nine-brain/`, `development/nine-brain-console/`, the four development test registrations/files, `development-lab.html`, `development-lab.js`, their browser test/build script and navigation/route entries, then restore the static-serving exclusions and documentation. There is no database migration, persisted production state, provider credential, live AI route or seal-format migration to unwind.

## 12. Remaining gates before any production claim

1. Technical, logical, legal and clarity peer review of the pull request.
2. A versioned human NB-0 governance decision selecting concordance policy, agreement unit and independence test.
3. Separate route/contract/security review before wiring VER-4 into a Worker.
4. Provider credentials, egress/privacy review, live-provider evaluation and resource limits before enabling external calls.
5. Qualified legal sourcing/review and additional jurisdiction packs before legal conclusions beyond syntax observations.
6. Real-corpus evaluation with lawfully usable data; synthetic tests are not scientific validation or exhaustive detection evidence.
7. Explicit production rollout approval, final-head CI and rollback readiness.
8. Separate approval for any merge, deployment or branch deletion.

Until those gates are complete, this is a completed **default-off development build**, not a completed production certification.

## 13. Axiom-inspired workflow contract increment — 25 November 2026

This later increment applies design-by-contract and explicit legal state transitions to the synthetic Test Lab. It was informed by the supplied Axiom manual, but it does **not** install Axiom, generate or execute C++, invoke mCRL2, or claim Axiom formal verification. The implementation is native browser-safe JavaScript and remains development-only.

`development/nine-brain-console/workflow-contract.js` defines the ordered states `INITIALIZED`, `ORCHESTRATION_COMPLETE`, `TECHNICAL_REVIEW_COMPLETE`, `HUMAN_DISPOSITION_COMMITTED` and `ANNEX_PREPARED`. Illegal or unknown events are rejected before execution; rejected transitions leave state and history unchanged. Successful operations append ordered transition records. This prevents the Test Lab from skipping orchestration, technical review or separate human adjudication, while leaving the underlying development records and production system unchanged.

The visible and exportable audit contains nine deterministic checks covering canonical B1–B9 ordering, the development boundary, state preconditions, three-seat integrity, reviewer isolation, advisory authority, fail-closed confirmation, production immutability and ordered audit history. A passing audit means that these software workflow contracts held for the synthetic session. It does not establish forensic truth, factual authenticity, reviewer correctness, legal validity, admissibility or formal verification.

Coverage is provided by `tests/nine-brain-workflow-contract.test.mjs` plus additions to the console and browser suites. Adversarial cases include skipped stages, illegal history insertion, non-contiguous sequencing, production-flag tampering, changed brain ordering, B9 authority tampering, duplicate reviewer origins, cross-reviewer context and sealed-annex misrepresentation. `tests/run-development.js` registers the new suite separately; the audited production registry remains unchanged.

Final local gates for this increment passed: `npm run check`; all 65 production/baseline suites; all five development suites with **650 assertions** (200 + 264 + 95 + 50 + 41); and all **27 Playwright tests** across Chromium, Firefox and WebKit. The browser matrix exercised all-pass export, every failure scenario, workflow inspection, offline/no-egress controls and responsive layouts. Desktop and 375-pixel rendered inspections found no document overflow, clipped status labels or broken claim-boundary wording. The generated browser bundle rebuilt reproducibly, `git diff --check` passed, and the protected production analysis, report, sealing, Worker-rule, contract and production-registry files listed above remained unchanged.
