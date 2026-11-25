# NB-0/NB-1 Nine-Brain Foundation — Completed Development Build

| Document control | Value |
|---|---|
| Date | 21 November 2026 |
| Repository | `Liamhigh/webdocsol` |
| Base reviewed | `4f29b9a8076b4f68f66ec3c6bc4754f171dbd80e` |
| Build status | Completed development slice; pull-request review and merge remain separate |
| Production status | Not enabled; no production engine, report, sealing or Findings JSON behaviour changed |
| Canonical architecture | Exactly B1–B9; Constitution v8 permits B1–B8 to issue findings and B9 not to do so; the development voting model remains subject to NB-0 concordance governance |
| NB-0 governance | `OPEN_AWAITING_GOVERNANCE_DECISION` |
| Concordance | `POLICY_UNRESOLVED` |
| Independent Triple Verification | `NOT_IMPLEMENTED` |
| Human adjudication | `NOT_ADJUDICATED` |

## 1. What this build is

This is the first implementation slice from the archive-integration and nine-brain restoration plan. It establishes the deterministic records and read-only preview needed before admitting winkNLP, OpenContracts-derived deterministic behaviour, Meyda, Allen Temporal Algebra, LexNLP-derived extractors, or independent Mistral/DeepSeek review.

It is **not** a claim that the complete nine-brain architecture, cross-border legal engine, independent Triple Verification, or all useful archive adaptations have shipped. Those remain separately gated work packages.

## 2. Implemented components

### NB-0 source and historical-variant register

`nine-brain-source-register.js` records:

- The canonical B1–B9 names, ordering, voting status, and responsibilities.
- The supplied canonical implementation snapshot and its SHA-512 identity.
- Historical alternative numbering as non-canonical.
- Related v5.2.7/excerpt material without counting duplicates as independent corroboration.
- The current repository Constitution and the supplied v1.3 Addenda D/E design source.
- The unresolved choice between two-brain theme concordance and three-independent-brain agreement.

The register deliberately leaves the authoritative rule, agreement unit, independence test, B4 support treatment, and B8 unengaged treatment undecided. It does not edit the Constitution or enable production promotion.

### NB-1 deterministic shared records

`nine-brain-contracts.js` implements constructors and validators for:

1. `EvidenceAtom` — evidence identity, source/media locator, exact text/structural/media anchor, extraction route, source/OCR status, and handling provenance.
2. `ClaimRecord` — normalized claim fields linked back to source evidence IDs without replacing verbatim evidence.
3. `BrainRunRecord` — canonical brain identity/version, voting, execution mode, engagement, input-view hashes, complete coverage, candidate/support/opposition/exclusion/recommendation/finding IDs, uncertainties, rule hits, and output hash.
4. `PromotionDecision` — explicit P1–P7 states, failed rules, bounded proposition, independence analysis/rationale, reviewer/rule version, and decision reasons.
5. `FindingAudit` — original finding/brain/type identity, actors, source evidence and anchors, supporting excerpts, checks, uncertainties, and promotion/demotion reasons.
6. `GuardianDecision` — exact Constitution/rule-pack identity, reconciled item/count decisions, source/overclaim checks, limitations, and no fabricated human adjudication.
7. `FindingCertification` — technical reproducibility lineage only; no judicial certification, truth, admissibility, or human-approval claim.
8. `EvidenceBundle` — unique EvidenceAtom identities with every claim/audit evidence reference resolved and every audit anchor matched to its referenced atom.

The records reuse `analysis-contracts.js` for canonical JSON, SHA-512 identities, deep immutability, coverage accounting, and exact UTF-16/structural anchor validation. Unknown fields survive canonical construction and remain immutable. Media anchors use rational time bases, increasing tick ranges, optional or omitted frame ranges, decoder identity, sample rate, and channels rather than ambiguous floating-point seconds.

Validation reconciles semantics rather than accepting hash-shaped strings alone: run-output hashes are recomputed from contracted outputs; engaged/partial runs require input-view hashes and processed coverage; preview runs cannot emit analysis output; failed P-rules reconcile for every decision; guardian finding IDs are unique; claim null semantics are explicit; and finding-audit anchors are non-empty, evidence-linked and verified against complete source text where applicable. Public validators return invalid results for malformed nested records instead of throwing.

### Read-only existing-findings preview

`nine-brain-preview.js`:

- Accepts an exact input SHA-512, engine version, and existing findings.
- Reproduces the current report-side CT01–CT61 and `SERIAL` brain mapping.
- Preserves every finding and every unknown field, including duplicates.
- Gives each source finding a deterministic read-only candidate alias.
- Emits nine brain provenance envelopes with `execution_mode: PREVIEW` and `engagement_status: NOT_EVALUATED`.
- Keeps brain-run candidate/finding arrays empty: report-side grouping is not brain execution.
- Accounts for every source finding exactly once in separate read-only brain views.
- Computes deterministic source, candidate, run, preview, and complete-payload hashes.
- Detects source/candidate/mapping/coverage/view/hash inconsistencies during validation, including recomputation of every deterministic preview run ID and contracted run-output hash.
- Produces byte-identical canonical output for identical inputs across fresh processes and tested time zones.

The preview has no clock, randomness, network, telemetry, locale collation, model call, or archive dependency. Prototype-like unknown finding types use the same safe B1 report fallback rather than reading inherited object properties.

## 3. Development-only serving exclusion

The three new root modules are development contracts, not public website assets. `.assetsignore` prevents Workers Static Assets from uploading them, and `SITE_DENY_RE` in `worker/static-proxy.js` independently returns 404 for their repository-fallback paths. `tests/site-serving.test.mjs` locks the exclusion/deny-list parity and exercises all three paths. This is an access-control exclusion only; it does not connect the modules to a production page, API, analysis route or seal.

## 4. Development API

```js
const Preview = require('./nine-brain-preview.js');

const preview = Preview.buildNineBrainPreview({
  input_sha512: '<128 lowercase hexadecimal characters>',
  engine_version: '5.7.3-web',
  findings: existingEngineResult.findings
});

if (!Preview.validatePreview(preview).valid) {
  throw new Error('Invalid read-only preview');
}
```

The input is canonically cloned and deeply frozen in the output. The adapter does not mutate the supplied findings or evidence bytes. Unknown evidence identity fails closed; no `unknown_input_sha512` fallback exists.

## 5. Verification evidence

Local verification on the isolated implementation branch:

- `node tests/nine-brain-contracts.test.mjs` — **200 assertions passed, 0 failed**.
- `node tests/worker.test.mjs` — **408 assertions passed, 0 failed**.
- `node tests/site-serving.test.mjs` — **60 assertions passed, 0 failed**, including `.assetsignore`/`SITE_DENY_RE` parity.
- `node tests/documentation-consistency.test.mjs` — **34 assertions passed, 0 failed**.
- `npm test` — **all 65 registered production/baseline Node suites GREEN**, followed by the separately gated NB-0/NB-1 development suite with **200 assertions passed, 0 failed**.
- `npm run check` — **passed**, including the three new JavaScript modules.
- `git diff --check` — **passed**.
- Fresh-process replay under `TZ=UTC` and `TZ=Pacific/Honolulu` — **byte-identical canonical preview**.

Verification covers text, structural, OCR-compatible and media anchors; omitted/partial media frames; malformed nested records; source mutation; claim provenance and unresolved semantics; prototype-like IDs; bundle evidence resolution; all nine canonical voting assignments; B9 finding/candidate rejection; run output hashes and engagement provenance; complete brain coverage; P1–P7 fail-closed promotion and failed-rule reconciliation; verified audit anchors; guardian uniqueness/counts; certification demotion; exact canonical brain names; CT01–CT61/report mapping parity; duplicate preservation; preview run identity/output tampering; unknown-field preservation; unchanged original findings and actual engine-input bytes; malformed input hashes; public static-serving denial; and production forensic non-integration.

The final layout keeps the independently gated development suite in `tests/run-development.js`, outside the unchanged 65-suite production/baseline registry. `npm test` runs both registries. No existing test or inventory assertion was weakened.

## 6. Compatibility and security boundary

This slice changes no forensic analysis, report or sealing behaviour. The only serving change is to deny the three development-only module paths:

- No change to `forensic-engine-page.js`, `forensic-report.js`, `seal-document.html`, `worker/verum-rules.js`, `analysis-config.js`, or `analysis-contracts.js`.
- `worker/static-proxy.js` and `.assetsignore` exclude only `nine-brain-contracts.js`, `nine-brain-source-register.js` and `nine-brain-preview.js`; no public page or API gains access to them.
- No new CT type, detector ID, production module flag, Findings JSON version, seal/QR/OTS semantic, route, credential, external request, or AI lane.
- Production Findings JSON remains `1.11.0`; engine remains `5.7.3-web`.
- No new production or development dependency was installed from the supplied archives.
- No real-matter evidence, private fixture, ZIP, model, provider response, or secret was added.
- All new test content is synthetic.
- Existing report, sealing, old-seal verification, AI-candidate, B9-recommendation, and signed-rule-package suites remain green.

A hash in these records provides deterministic identity and tamper detection, not a digital signature, legal authority, proof of truth, or independent verification.

## 7. Explicitly not completed

- NB-0 human/versioned constitutional concordance decision.
- NB-2/NB-3 actual brain-specific input views, engagement, and first-pass execution.
- NB-4/NB-5/NB-6 coordinated promotion, guardian execution, certification execution, second pass, and concordance.
- B4/winkNLP, B5/Allen or LexNLP, B6/LexNLP, B7/OpenContracts or German pack, and B8/Meyda adapters.
- VER-1 immutable review-packet assembly beyond these foundational records; VER-2–VER-7 provider, endpoint, adjudication, narrative, annex, and rollback work.
- Independent Mistral/DeepSeek review or a three-seat verification claim.
- Production UI/report/seal integration, browser-facing deployment, or schema-owner approval.

## 8. Next reversible slices

1. Obtain schema-owner review of these records and a separate human NB-0 concordance decision.
2. Implement NB-2/NB-3 over synthetic immutable evidence atoms, with real per-brain input views, coverage, engagement, and candidate registers; do not infer engagement from this preview.
3. Implement NB-4–NB-6 only with versioned promotion/independence/guardian rules and complete dissent/gap preservation.
4. Admit individual archive adaptations through separate licence, security, anchor, resource, evaluation, and rollback PRs.
5. Build independent verification only over immutable packets and actual responsible-brain records; require all three technical reviewers and separate human adjudication.

Rollback of this slice removes the development files, their test registration/documentation and their static-serving exclusions. Since no production analysis path consumes them, no historical seal, finding, QR code, manifest, or OTS receipt needs rewriting.
