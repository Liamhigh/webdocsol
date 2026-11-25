# Tests

The Node test suite for WebDocSol uses Node built-ins plus the browser libraries vendored in
`vendor/` (pdf-lib, pdf.js, Tesseract, qrcode, QPDF-WASM). There are no production dependencies.
CI pins Node 22 LTS and installs development-only Playwright and QPDF-WASM packages with `npm ci`.

```bash
# from the repository root
npm ci                  # development-only browser/QPDF tooling; no production dependencies
npm test                # every registered Node suite
npm run check           # node --check on shipped source and worker files
npm run test:browser    # Chromium, Firefox and WebKit gates
node tests/<file>       # one suite, e.g. node tests/worker.test.mjs
```

## How the suite runs

- **Run from the repository root.** `run-all.js` does not set a working directory, and 14 suites
  read repository files (`seal-document.html`, `verify.html`, `wrangler.toml`,
  `constitution.json`, `forensic-engine-page.js` and others) by paths relative to it. Run from
  `tests/`, those 14 fail with `ENOENT`. `npm test` and the `npm run test:*` aliases work from
  any folder, because npm runs scripts from the package root.
- Each suite runs in its own Node process, in the order listed in `run-all.js`. A suite fails
  only by exiting non-zero. `run-all.js` runs every suite regardless, then prints
  `RESULT: all suites GREEN`, or `RESULT: <n> suite(s) FAILED` and exits 1.
- Each suite ends with `[<label>] PASS=<n> FAIL=<m>`. `run-all.js` prints no total, so every
  total written in the docs is a hand count. To get one:

  ```bash
  node tests/run-all.js 2>&1 | grep -E '^\[[a-z-]+\] PASS=' \
    | awk -F'PASS=' '{split($2,a," "); s+=a[1]} END {print NR " suites, " s " assertions"}'
  ```

- `npm run check` runs `node --check` on `seal-guard.js`, `forensic-engine-page.js`,
  `forensic-report.js`, `ots-proof.js`, `pdf-encrypt.js`, `nine-brain-contracts.js`,
  `nine-brain-source-register.js`, `nine-brain-preview.js`, every module under
  `development/nine-brain/`, `worker/verum-rules.js`,
  `worker/static-proxy.js` and `worker/site-assets.js`. It does not cover `functions/[[path]].js`
  or the page-native scripts inside the HTML pages; `page-boot` evaluates the inline script of
  `seal-document.html` instead.
- Eleven suites have an npm alias: `test:forensic`, `test:ots`, `test:worker`, `test:page-boot`,
  `test:engine-perf`, `test:voice-crypto`, `test:pdf-encrypt`, `test:find-seal`,
  `test:seal-guard`, `test:inline-scripts`, `test:browser`. Run any other suite with `node tests/<file>`.
- Expected noise in a green run: `pdf-encrypt` prints pdf.js warnings (`DOMMatrix`, `Path2D`,
  fake worker, standard font data), and `pages-bridge` prints Node's `MODULE_TYPELESS_PACKAGE_JSON`
  warning for `functions/[[path]].js`. Do not add `"type": "module"` to `package.json` to silence
  it: `run-all.js` and the five `.js` suites are CommonJS.
- `.github/workflows/test.yml` runs syntax and Node suites on pull requests and pushes to
  `main`, then runs Playwright in Chromium, Firefox and WebKit. The separate
  `.github/workflows/live-site-probe.yml` remains a manual outside probe and does not replace CI.
  Run the suite and `npm run check` yourself before every push: merge to `main` is the deploy.

## What is covered

**66 registered production/baseline suites**: the 55-suite audited baseline of 15 November 2026, two Phase 0 suites, four Phase 1 evaluation suites, two Phase 2 citation suites, one Phase 3 redaction-fixture suite, one Phase 4 active-graph suite, and one PR #327 review suite. `run-all.js` is that registry — **a production/baseline test file that is not listed in it does not run**. Separately gated development contracts are registered in `run-development.js`; `npm test` runs both registries. What each production/baseline suite guards, and the real evidence bundle behind it, is in
[`../ENGINE.md`](../ENGINE.md) §10; the guards themselves are §4.

The five development suites are:

| File | Checks | Exercises |
|---|---|---|
| `nine-brain-contracts.test.mjs` | 200 | NB-0/NB-1 records and read-only preview |
| `nine-brain-orchestration-research-legal.test.mjs` | 264 | Two passes, P1–P7/audit/guardian/certification, B4/B8/B9 boundaries, RES-1–RES-9, all 169 Allen compositions, B7 cross-border gaps and adapter gating |
| `nine-brain-verification-adjudication.test.mjs` | 94 | Bounded immutable packets, trusted audit lineage, isolated mocked providers with cancellation, fail-closed panels, revision-history dispositions, packet-grounded narrative and authoritative-state annexes |

These suites use synthetic fixtures only. They do not call live providers, modify production Findings JSON, or exercise a production Worker route.

The registry, in run order. The label is what the suite prints in its `PASS=` line.

| # | Label | File | Checks | Exercises |
|---|-------|------|--------|-----------|
| 1 | `forensic-engine` | `forensic-engine.test.js` | 328 | `forensic-engine-page.js`: every detector on edge inputs without throwing; known contradictions detected; clean text silent; the serial-pattern engine; `runForensicEngine` via the raw-text fallback |
| 2 | `ots-proof` | `ots-proof.test.js` | 16 | `ots-proof.js`: OpenTimestamps receipt format and round trips |
| 3 | `worker` | `worker.test.mjs` | 408 | `worker/verum-rules.js` against a mocked `env` (no live KV or AI) |
| 4 | `page-boot` | `page-boot.test.mjs` | 101 | `seal-document.html` boots with pdf-lib missing; vendored libraries present; locks on the page's wiring |
| 5 | `engine-perf` | `engine-perf.test.mjs` | 5 | Per-page extraction parses the PDF once (counts parses, not time) |
| 6 | `voice-crypto` | `voice-crypto.test.mjs` | 7 | `.voice` encryption round trip between `seal-document.html` and `verify.html` |
| 7 | `pdf-encrypt` | `pdf-encrypt.test.mjs` | 8 | `pdf-encrypt.js` output opened by the vendored pdf.js |
| 8 | `find-seal` | `find-seal.test.mjs` | 8 | The sealed-document finder in `verify.html` |
| 9 | `seal-guard` | `seal-guard.test.mjs` | 16 | `seal-guard.js`: no unsealed PDF leaves the page |
| 10 | `franchise-lease` | `franchise-lease.test.mjs` | 15 | D38/D39 (CT44/CT45) |
| 11 | `role-capacity` | `role-capacity.test.mjs` | 13 | D40/CT46, no hardcoded parties |
| 12 | `detector-recall` | `detector-recall.test.mjs` | 107 | Detector recall and the §4 false-positive guards |
| 13 | `digital-forensics` | `digital-forensics.test.mjs` | 16 | `voDigitalForensicsScan` (raw PDF structure) |
| 14 | `ocr-rescue` | `ocr-rescue.test.mjs` | 44 | The page's OCR fallback, loader and deadline helper |
| 15 | `rule-classify` | `rule-classify.test.mjs` | 9 | The deterministic classification fallback in `seal-document.html` |
| 16 | `findings-json` | `findings-json.test.mjs` | 29 | `buildFindingsJson`, findings JSON contract 1.9.0 |
| 17 | `finding-anchors` | `finding-anchors.test.mjs` | 87 | WHO / WHERE / WHAT / WHEN anchoring per finding |
| 18 | `wrangler-config` | `wrangler-config.test.mjs` | 34 | `wrangler.toml` drift lock |
| 19 | `crop-normalize` | `crop-normalize.test.mjs` | 115 | CropBox normalisation, seal band, share ordering, certificate privacy, the voice-note path |
| 20 | `encrypt-detect` | `encrypt-detect.test.mjs` | 9 | `voPdfIsEncrypted` |
| 21 | `constitution-lock` | `constitution-lock.test.mjs` | 41 | `constitution.json`, `constitution.html` and the pages that cite a version agree |
| 22 | `ai-assess-batch` | `ai-assess-batch.test.mjs` | 19 | Client batching under the `/api/v1/ai/assess` caps; the review never removes or changes a finding, and a candidate is a duplicate only when it restates one |
| 23 | `narrate-excerpt` | `narrate-excerpt.test.mjs` | 16 | `voBuildNarrateExcerpt` |
| 24 | `human-report` | `human-report.test.mjs` | 81 | The court-ready narrative wiring: Worker, `forensic-report.js` and page agree |
| 25 | `site-serving` | `site-serving.test.mjs` | 61 | `worker/static-proxy.js` serving tiers, `.assetsignore`/deny-list parity including root and `development/nine-brain/` development modules, and `/api/v1/site/health` |
| 26 | `pages-bridge` | `pages-bridge.test.mjs` | 18 | `functions/[[path]].js`, the www bridge; static fallback denies Markdown |
| 27 | `zip-intake` | `zip-intake.test.mjs` | 25 | The page's ZIP reader for WhatsApp chat exports |
| 28 | `rule-package` | `rule-package.test.mjs` | 129 | Signed rule packages on the website |
| 29 | `inline-scripts` | `inline-scripts.test.mjs` | 25+ | The ten inline copies in `seal-document.html` are byte-identical to their sources |
| 30 | `legal-analysis` | `legal-analysis.test.js` | 216 | `forensic-report.js`: parties and jurisdiction, legal subjects, **PD16 language** (no scores, no bands, no hedging), the §15.2 narrative gate, sentence splitting, page anchors, SEALED FINDINGS integrity |
| 31 | `greensky-regression` | `greensky-regression.test.js` | 98 | The Greensky run of 7 August 2026, and its re-run of 3 October 2026 (§9; `ENGINE.md` §12.15) |
| 32 | `allfuels-regression` | `allfuels-regression.test.js` | 59 | The AllFuels run of 14 August 2026 |
| 33 | `annexure-eb` | `annexure-eb-regression.test.mjs` | 502 | The annexure EB run and every run after it up to the Public Protector submission (`ENGINE.md` §12.10–§12.14) |
| 34 | `evidence-bundle-7` | `evidence-bundle-7-regression.test.mjs` | 47 | The evidence-bundle-7-docs run of 5 October 2026, the founder's rulings and the review round (`ENGINE.md` §12.16) |
| 35 | `combine-06-april` | `combine-06-april-regression.test.mjs` | 30 | The Combine 06 April 2026 run and its review (`ENGINE.md` §12.17) |
| 56 | `analysis-contracts` | `analysis-contracts.test.mjs` | — | Deterministic envelopes, UTF-16/structural/OCR/pair anchors, stable ordering/IDs, disabled flags, old/new readers and fresh-process/time-zone replay |
| 57 | `documentation-consistency` | `documentation-consistency.test.mjs` | — | Current engine/taxonomy/detector/findings values and source-derived UI counts |
| 58 | `evaluation-metrics` | `evaluation-metrics.test.mjs` | 116 | Hand-calculated B9 development metrics, direct-call validation, bounded identifiers/diagnostics and early resource rejection, minimum-cost and scope-aware matching, distinct evidence locations, one-to-one evidence credit, UTF-16/normalization alignment, incomplete-pair exclusion, pairs, Unicode, negative documents, failures/exclusions, versioned canonical and atomic reports, strict UTF-8 and canonical-directory/symlink-safe CLI handling, and fully normalized encoded-path production isolation |
| 59 | `evaluation-contractnli` | `evaluation-contractnli.test.mjs` | 92 | ContractNLI adapter: pinned release/hashes, UTF-16 spans, conservative mapping, provenance and input safety, annotations, collision-free IDs, bounded shards, generation publication, zip integrity, CLI pipeline |
| 60 | `evaluation-contradoc` | `evaluation-contradoc.test.mjs` | 101 | ContraDoc adapter and dual metrics: verbatim evidence/ref anchoring, mapped scopes, incomplete-pair exclusion, verum_exact metrics with per-document negative-set false positives, published_comparable settings and input limits, generation publication, CLI pipeline |
| 61 | `evaluation-eyecite` | `evaluation-eyecite.test.mjs` | 60 | Eyecite conformance spike: bounded corpus and span validation, strict citation/group/cluster comparison, fixed adapter allowlist, package-pin and resolution-state handling, optional real extraction only for exact pinned installs, portable CLI and atomic-generator guards |
| 62 | `legal-citations` | `legal-citations.test.mjs` | 78 | Neutral citation occurrence core: registry and helper validation, exact spans and IDs, immediate-predecessor Id./exact-caption supra resolution, empty pack selection, envelope validity, engine flag on/off integration, exact failure identity and failed-page coverage |
| 63 | `legal-citations-za` | `legal-citations-za.test.mjs` | 98 | ZA pack fixtures: neutral/reported/docket/SAFLII forms and boundaries, multiword supra, pinpoints, captions, negatives and neutrality, verbatim round-trips, byte-identical replay |
| 64 | `redaction-fixtures` | `redaction-fixtures.test.mjs` | 54 | Phase 3 synthetic redaction corpus: exact UTF-16 ranges, protected verbatim evidence quotes, preserved references, and a fail-closed production-module flag |
| 65 | `pdf-graph` | `pdf-graph.test.mjs` | 28 | QPDF-WASM active graph: asset provenance, 256-MiB memory cap, pre-hash input limit and sentinel, resource limits, opt-in Worker, observations-only module and detector-finding parity |
| 66 | `pr327-review` | `pr327-review.test.mjs` | 40 | Synthetic review regressions for report exclusion, signed-rule masking, WF7, CT52, D02C, admissions and overlapping scans |
Rows 36–55 are the later detector, conduct, OTS, timeline, fact-index and cross-document suites;
`run-all.js` is always the authoritative complete production/baseline registry.

The separately gated development registry is `run-development.js`:

| Label | File | Checks | Exercises |
|-------|------|--------|-----------|
| `nine-brain-contracts` | `nine-brain-contracts.test.mjs` | 200 | NB-0 source register and unresolved concordance; NB-1 shared records and bundle evidence resolution; UTF-16/structural/media anchors; semantic run/output/engagement/promotion/audit/guardian reconciliation; malformed-input safety; read-only preview identity/tamper/replay and immutability checks |
| `nine-brain-orchestration-research-legal` | `nine-brain-orchestration-research-legal.test.mjs` | 264 | Exact promoted-candidate audit/guardian lineage; unresolved evidence preservation; B8 media-only views/anchors; unexecuted-analysis coverage; malformed Allen witnesses; unknown-object/equal-amount/formal-domain research guards; consistent oracle universes; B7 recomputed identity, coverage and conflicts reconciliation |
| `nine-brain-verification-adjudication` | `nine-brain-verification-adjudication.test.mjs` | 94 | Bounded quotes/privacy; semantic tamper tests with recomputed identities; trusted review provenance; distinct provider origins/transports; explicit source/context review; process-local shared compare-and-swap dispositions; revision-bound narrative approval and authoritative annex freshness |
| `nine-brain-console` | `nine-brain-console.test.mjs` | 50 | Nine-brain console runner, browser UI, and reset controls |
| `nine-brain-workflow-contract` | `nine-brain-workflow-contract.test.mjs` | 61 | Nine-brain workflow contract and output invariants |

**Writing a regression test:** use the **exact text from the real document** that caused the
failure, not a paraphrase. Every guard in `ENGINE.md` §4 has one, and that is why they have
survived reviewers asking for them to be "simplified".

## Adding a suite

1. Create `tests/<name>.test.mjs` (ES module) or `tests/<name>.test.js` (CommonJS:
   `package.json` has no `"type"` field).
2. Count with `tests/_assert.js` (`ok`, `noThrow`, `throws`, `done('<name>')`). It is CommonJS;
   from a `.mjs` file load it with `createRequire`, as `pages-bridge.test.mjs` does. A local
   `pass` / `fail` pair, as most suites use, works too.
3. End by printing `[<name>] PASS=<n> FAIL=<m>` and exit non-zero on any failure. `done()` does
   both. `run-all.js` reads only the exit status.
4. Add production/baseline files to the `suites` array in `tests/run-all.js`. Add an independently gated development contract to `tests/run-development.js` instead, leaving the production/baseline registry unchanged.
5. Build file paths from the test's own location (`path.join(__dirname, '..', f)`, or
   `import.meta.url` in a `.mjs` file), so the suite does not depend on the working directory.
6. Load shipped code the way the existing suites do. The root scripts load with `require`
   (`forensic-report.js` needs a `PDFLib` stub or the vendored `vendor/pdf-lib.min.js`). The
   Worker is imported as an ES module and called with a mocked `env`. Page-native code in
   `seal-document.html` or `verify.html` is cut out of the page by a marker comment or a known
   line, then evaluated with `new Function` (`rule-classify`, `findings-json`) or in `node:vm`
   (`zip-intake`, `page-boot`).
7. Run the full suite from the repository root, then update the counts wherever they are
   written: this file, `ENGINE.md` (§0 and §10), `AGENTS.md`, `REFERENCE.md`, `README.md` and
   `DEPLOYMENT.md`.

## Notes

- `seal-document.html` carries `analysis-contracts.js`, `analysis-config.js`,
  `forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`, `ots-proof.js` and
  `pdf-encrypt.js` inline, between `VO-INLINE` markers. It fetches
  `/forensic-engine-page.js`, `/forensic-report.js` or `/ots-proof.js` only if the inline copy
  did not define its global (`voEnsureForensicScripts`). The tests load the root files;
  `inline-scripts` proves the inline copies match them. Edit the source file, then re-splice the
  inline copy (`ENGINE.md` §9); `inline-scripts` fails until you do. There is no
  `forensic-engine.js` in this repository.
- `runForensicEngine`'s raw-text fallback calls `extractPdfText`, a global defined in
  `seal-document.html`; the pipeline test stubs it.
- Test inputs are built in the test files: verbatim strings from the real bundles, and synthetic
  bytes. The only PDF fixture a suite reads from disk is `forensic_test_document.pdf` at the
  repository root (`engine-perf`). `.assetsignore` keeps it, and `greensky-ocr-verify.pdf`, off
  the site.
- `page-boot` still runs the page's inline script in Node's `vm`, with pdf-lib absent, to catch
  the frozen-page regression. `tests/browser/` adds real Chromium, Firefox and WebKit boot,
  synthetic-PDF seal and root-`verify.html` checks. Browser tests read the result state rather
  than merely reaching `showResults`, block unexpected network egress, and retain only synthetic
  failure artifacts for three days in CI.
