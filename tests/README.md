# Tests

Zero-dependency test suite for the WebDocSol production code. It runs on plain Node: Node
built-ins, plus the browser libraries already vendored in `vendor/` (pdf-lib, pdf.js, Tesseract,
qrcode). `package.json` declares no dependencies, so no `npm install` is needed. The repository
pins no Node version; last verified green on Node v22.22.2 (3 October 2026).

```bash
# from the repository root
node tests/run-all.js   # every suite (npm test runs the same file)
npm run check           # node --check on the eight shipped source files
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
  `forensic-report.js`, `ots-proof.js`, `pdf-encrypt.js`, `worker/verum-rules.js`,
  `worker/static-proxy.js` and `worker/site-assets.js`. It does not cover `functions/[[path]].js`
  or the page-native scripts inside the HTML pages; `page-boot` evaluates the inline script of
  `seal-document.html` instead.
- Ten suites have an npm alias: `test:forensic`, `test:ots`, `test:worker`, `test:page-boot`,
  `test:engine-perf`, `test:voice-crypto`, `test:pdf-encrypt`, `test:find-seal`,
  `test:seal-guard`, `test:inline-scripts`. Run any other suite with `node tests/<file>`.
- Expected noise in a green run: `pdf-encrypt` prints pdf.js warnings (`DOMMatrix`, `Path2D`,
  fake worker, standard font data), and `pages-bridge` prints Node's `MODULE_TYPELESS_PACKAGE_JSON`
  warning for `functions/[[path]].js`. Do not add `"type": "module"` to `package.json` to silence
  it: `run-all.js` and the five `.js` suites are CommonJS.
- Nothing in this repository runs the suite for you. The only GitHub workflow,
  `.github/workflows/live-site-probe.yml`, is a hand-run probe of the live site
  (`workflow_dispatch` only), and the Workers Builds build command is set in the Cloudflare
  dashboard, not here. Run the suite and `npm run check` yourself before every push: merge to
  `main` is the deploy.

## What is covered

**37 suites, 2761 assertions**, all green (counted 6 October 2026, with photos sealed as
documents (`ENGINE.md` §12.18) and the Louw v Naidoo precision fixes (§12.19)). `run-all.js` is the
registry — **a test file that is not listed in it does not run**, so register every new file
there. What each suite guards, and the real evidence bundle behind it, is in
[`../ENGINE.md`](../ENGINE.md) §10; the guards themselves are §4.

The registry, in run order. The label is what the suite prints in its `PASS=` line.

| # | Label | File | Checks | Exercises |
|---|-------|------|--------|-----------|
| 1 | `forensic-engine` | `forensic-engine.test.js` | 328 | `forensic-engine-page.js`: every detector on edge inputs without throwing; known contradictions detected; clean text silent; the serial-pattern engine; `runForensicEngine` via the raw-text fallback |
| 2 | `ots-proof` | `ots-proof.test.js` | 16 | `ots-proof.js`: OpenTimestamps receipt format and round trips |
| 3 | `worker` | `worker.test.mjs` | 388 | `worker/verum-rules.js` against a mocked `env` (no live KV or AI) |
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
| 16 | `findings-json` | `findings-json.test.mjs` | 25 | `buildFindingsJson`, findings JSON contract 1.8.0 |
| 17 | `finding-anchors` | `finding-anchors.test.mjs` | 87 | WHO / WHERE / WHAT / WHEN anchoring per finding |
| 18 | `wrangler-config` | `wrangler-config.test.mjs` | 34 | `wrangler.toml` drift lock |
| 19 | `crop-normalize` | `crop-normalize.test.mjs` | 115 | CropBox normalisation, seal band, share ordering, certificate privacy, the voice-note path |
| 20 | `encrypt-detect` | `encrypt-detect.test.mjs` | 9 | `voPdfIsEncrypted` |
| 21 | `constitution-lock` | `constitution-lock.test.mjs` | 41 | `constitution.json`, `constitution.html` and the pages that cite a version agree |
| 22 | `ai-assess-batch` | `ai-assess-batch.test.mjs` | 19 | Client batching under the `/api/v1/ai/assess` caps; the review never removes or changes a finding, and a candidate is a duplicate only when it restates one |
| 23 | `narrate-excerpt` | `narrate-excerpt.test.mjs` | 16 | `voBuildNarrateExcerpt` |
| 24 | `human-report` | `human-report.test.mjs` | 81 | The court-ready narrative wiring: Worker, `forensic-report.js` and page agree |
| 25 | `site-serving` | `site-serving.test.mjs` | 56 | `worker/static-proxy.js` serving tiers and `/api/v1/site/health` |
| 26 | `pages-bridge` | `pages-bridge.test.mjs` | 16 | `functions/[[path]].js`, the www bridge |
| 27 | `zip-intake` | `zip-intake.test.mjs` | 25 | The page's ZIP reader for WhatsApp chat exports |
| 28 | `rule-package` | `rule-package.test.mjs` | 129 | Signed rule packages on the website |
| 29 | `inline-scripts` | `inline-scripts.test.mjs` | 25 | The five inline copies in `seal-document.html` are byte-identical to their sources |
| 30 | `legal-analysis` | `legal-analysis.test.js` | 216 | `forensic-report.js`: parties and jurisdiction, legal subjects, **PD16 language** (no scores, no bands, no hedging), the §15.2 narrative gate, sentence splitting, page anchors, SEALED FINDINGS integrity |
| 31 | `greensky-regression` | `greensky-regression.test.js` | 98 | The Greensky run of 7 August 2026, and its re-run of 3 October 2026 (§9; `ENGINE.md` §12.15) |
| 32 | `allfuels-regression` | `allfuels-regression.test.js` | 59 | The AllFuels run of 14 August 2026 |
| 33 | `annexure-eb` | `annexure-eb-regression.test.mjs` | 497 | The annexure EB run and every run after it up to the Public Protector submission (`ENGINE.md` §12.10–§12.14) |
| 34 | `evidence-bundle-7` | `evidence-bundle-7-regression.test.mjs` | 47 | The evidence-bundle-7-docs run of 5 October 2026, the founder's rulings and the review round (`ENGINE.md` §12.16) |
| 35 | `combine-06-april` | `combine-06-april-regression.test.mjs` | 30 | The Combine 06 April 2026 run and its review (`ENGINE.md` §12.17) |

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
4. Add the file name to the `suites` array in `tests/run-all.js`.
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

- `seal-document.html` carries `forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`,
  `ots-proof.js` and `pdf-encrypt.js` inline, between `VO-INLINE` markers. It fetches
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
- There is no browser test in this repository. `page-boot` runs the page's inline script in
  Node's `vm`, with pdf-lib absent, to catch the frozen-page regression. Any real-browser check
  happens outside the suite (`page-boot.test.mjs` records a headless run on 6 September 2026).
  A headless check must read the results panel, not just whether `showResults` was reached
  (`AGENTS.md`, PR #205).
