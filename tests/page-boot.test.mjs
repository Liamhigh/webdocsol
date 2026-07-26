/**
 * Regression test: the seal pages must still boot when pdf-lib is missing.
 *
 * `const { PDFDocument } = PDFLib || {}` throws ReferenceError on an
 * undeclared identifier, which aborted the whole inline <script> and left
 * every click handler undefined -- the page rendered but was frozen. These
 * tests extract the real inline script from the shipped HTML and evaluate it
 * with no PDFLib present.
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + msg); }
};

// Pages that load pdf-lib and would freeze if it were missing.
const PAGES = ['seal-document.html'];
const VENDOR = [
  'vendor/pdf-lib.min.js',
  'vendor/qrcode.min.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
];

console.log('======================================================');
console.log('RUN  page-boot.test.mjs');
console.log('======================================================\n');

// The libraries must be served from this origin, not a third-party CDN: an
// unreachable CDN is what made the library missing in the first place.
for (const f of VENDOR) {
  ok(existsSync(f), `vendored library missing: ${f}`);
}

for (const page of PAGES) {
  const html = readFileSync(page, 'utf8');

  // The primary source must be same-origin. A CDN URL inside a script *string*
  // is the deliberate fallback for a dropped request, so only real tags count.
  ok(!/<script[^>]*\bsrc="https:\/\/(unpkg|cdnjs|cdn\.jsdelivr)/.test(html),
    `${page} still loads a script tag from an external CDN`);
  ok(/<script[^>]*\bsrc="\/vendor\/pdf-lib\.min\.js"/.test(html),
    `${page} loads pdf-lib from /vendor/`);
  // A single dropped fetch previously killed the whole sealing pipeline.
  ok(/if \(!window\.PDFLib\)/.test(html),
    `${page} recovers if the vendored bundle fails to arrive`);

  ok(!/\}\s*=\s*PDFLib\s*\|\|/.test(html),
    `${page} still destructures the bare PDFLib identifier`);

  // Pull out the inline script that declares the page's globals -- the block
  // that used to die on line 1.
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  const boot = blocks.find((b) => b.includes('PDFLib') && b.includes('selectedFile'));
  ok(Boolean(boot), `${page}: could not locate the boot script block`);
  if (!boot) continue;

  // Evaluate with a bare window: no PDFLib, exactly like a failed script load.
  const sandbox = { window: {}, document: undefined, console: { log() {}, error() {}, warn() {}, debug() {} } };
  sandbox.globalThis = sandbox;
  let threw = null;
  try {
    // Only the declarations matter; stop before anything touches the DOM.
    const decls = boot.slice(0, boot.indexOf('function toggleSection'));
    vm.runInNewContext(decls, sandbox, { timeout: 5000 });
  } catch (e) {
    threw = e;
  }
  ok(threw === null,
    `${page}: boot script threw without pdf-lib (${threw && threw.message}) -- page would freeze`);
}

// The build version lives in four places in seal-document.html: the
// vo-seal-build meta and three ?v= cache keys. They are edited by hand -- this
// repo has no build step to substitute them, deliberately -- so this pins them
// to each other. A ?v= that lags the meta means a stale cache key that can
// serve an old (or poisoned) cached copy of that script.
{
  const html = readFileSync('seal-document.html', 'utf8');
  const meta = html.match(/name="vo-seal-build" content="(\d+\.\d+\.\d+-\d+)[^"]*"/);
  ok(Boolean(meta), 'seal-document.html declares a vo-seal-build version');
  // The forensic scripts are now inlined (see inline-scripts.test.mjs), so
  // there may be no external ?v= tags left. Any that remain must still match.
  const vs = [...html.matchAll(/\?v=([0-9.]+-\d+)"/g)].map((m) => m[1]);
  for (const v of vs) {
    ok(v === meta?.[1],
      `script cache key ?v=${v} out of sync with vo-seal-build ${meta?.[1]}`);
  }
}

// The mobile share button must stay wired: shown when navigator.share exists,
// called synchronously in the click handler (user-activation), and failing to
// a download instead of silently doing nothing. It regressed once by being
// hidden behind an over-strict canShare({files}) gate.
{
  const html = readFileSync('seal-document.html', 'utf8');
  ok(html.includes('function addShareButton'), 'seal page defines addShareButton');
  ok(html.includes('navigator.share'), 'share button uses the Web Share API');
  ok(html.includes('fallbackDownload'), 'share button falls back to download, never nothing');
  ok(html.includes("'shareSealedBtn'"), 'share button has a stable id');
}

// The forensic scripts are same-origin with no CDN fallback, so a dropped
// request must be recoverable: the scan re-injects them before running. It
// broke twice as "runForensicEngine is not defined".
{
  const html = readFileSync('seal-document.html', 'utf8');
  ok(html.includes('function voEnsureForensicScripts'), 'seal page can re-load dropped forensic scripts');
  ok(/await voEnsureForensicScripts\(/.test(html), 'the scan awaits the script-recovery loader');
}

// index.html is the home page. It was overwritten with a copy of the sealing
// app in 4cb88ff to paper over a blank screen, which silently deleted the
// site's front door -- `/` and `/seal-document` served the same thing.
{
  const home = readFileSync('index.html', 'utf8');
  ok(/<title>\s*Verum Omnis - AI Forensics for Truth\s*<\/title>/.test(home),
    'index.html is the home page, not a copy of the sealing app');
  ok(!home.includes('async function startSealing'),
    'index.html does not duplicate the sealing application');
  ok(home.includes('/seal-document'),
    'home page links to the sealing app');
}

// The forensic narrative must render as paragraphs, not one squashed block.
// san() converts every newline to a space, so sanitizing the whole narrative
// BEFORE splitting it on blank lines collapsed the entire section into a single
// dense paragraph. Guard: the renderer must NOT san the full narrative up front,
// and must split it into paragraphs before sanitizing each block.
{
  const rep = readFileSync('forensic-report.js', 'utf8');
  ok(!/data\.aiNarrative\s*\?\s*san\(data\.aiNarrative\)/.test(rep),
    'narrative is NOT sanitized before the paragraph split (would squash it)');
  ok(/var paras = narr\.split\(\/\\n\{2,\}\/\)/.test(rep),
    'narrative is split into paragraphs on blank lines');
  ok(/san\(paras\[p\]\)/.test(rep),
    'each narrative paragraph is sanitized after the split');
}

// Report-content regressions caught in the sealed Greensky report of 26 Jul 2026:
// (1) the AI-review trailer printed "19 of 0 engine findings retained" because
// the renderer read ar.assessed while the seal page supplied only ar.original;
// (2) the FINDINGS & CONTRADICTION MATRIX hardcoded its subsection labels as
// "3.x", so when the FORENSIC NARRATIVE section shifted it to section 4 the
// TOC and body showed "3.1..." under "4. FINDINGS & CONTRADICTION MATRIX".
{
  const rep = readFileSync('forensic-report.js', 'utf8');
  ok(/ar\.assessed != null \? ar\.assessed : ar\.original/.test(rep),
    'AI-review trailer accepts both `assessed` and legacy `original` counts');
  ok(!/subHeading\('3\.'/.test(rep),
    'matrix subsections derive their number from ctx.sectionNo, not a hardcoded "3."');
  ok(/subHeading\(ctx\.sectionNo \+ '\.'/.test(rep),
    'matrix subsections use the live section number');
  const html = readFileSync('seal-document.html', 'utf8');
  ok(/assessed:\s*assessedCount/.test(html),
    'seal page passes the assessed count to the report builder');
}

// A Constitutional Court bundle came out labelled "Advance Fee Fraud (419
// Scam)" / "Money Laundering" from keyword hits — a legal case file naturally
// contains the vocabulary of the offences it DESCRIBES. When the user enters
// case details, serial-pattern labels must be suppressed (aboutFraud rationale
// extended to court bundles).
{
  const html = readFileSync('seal-document.html', 'utf8');
  ok(html.includes('function voIsLegalCaseFile'), 'seal page can recognise a legal case file');
  ok(/aboutFraud === true\) \|\| voIsLegalCaseFile\(\)/.test(html),
    'serial-pattern label suppression also triggers on user-entered case details');
}

// Bundle mode: on a legal case file the single-document structural detectors
// (CT27 duplicate page numbers, CT08 term repetition, CT04 temporal word
// pairs, CT36 address counts, CT35 formalities, CT31 annexure references)
// must demote to Low and the indicator score must be recomputed — while
// contradiction/financial findings and serial patterns stay untouched.
// Executable harness, not just source inspection.
{
  const html = readFileSync('seal-document.html', 'utf8');
  const grab = (name) => {
    const m = html.match(new RegExp('(function ' + name + '\\([\\s\\S]*?\\n})\\n'));
    return m && m[1];
  };
  const structural = html.match(/var VO_BUNDLE_STRUCTURAL = \{[^}]*\};/);
  const fnBundle = grab('applyBundleMode');
  const fnLooks = grab('voLooksLikeBundle');
  ok(Boolean(structural && fnBundle && fnLooks), 'seal page defines VO_BUNDLE_STRUCTURAL, voLooksLikeBundle and applyBundleMode');
  if (structural && fnBundle && fnLooks) {
    const sandbox = { legalCaseFile: true, _pipelinePageCount: 0 };
    sandbox.voIsLegalCaseFile = () => sandbox.legalCaseFile;
    vm.createContext(sandbox);
    vm.runInContext(structural[0] + '\n' + fnLooks + '\n' + fnBundle, sandbox);
    const result = {
      findings: [
        { type: 'CT27', severity: 4, evidence: 'dup page' },
        { type: 'CT02', severity: 4, evidence: 'totals differ' },
        { type: 'SERIAL', severity: 5, evidence: 'pattern' },
        { type: 'CT08', severity: 3, evidence: 'term twice' }
      ],
      overallScore: 80, confidence: 'VERY_HIGH', clean: false, extractionNotes: 'note.'
    };
    const out = vm.runInContext('applyBundleMode(' + JSON.stringify(result) + ')', sandbox);
    ok(out.findings[0].severity === 2 && out.findings[0].bundleDemoted === true,
      'CT27 demotes to Low in bundle mode');
    ok(out.findings[3].severity === 2, 'CT08 demotes to Low in bundle mode');
    ok(out.findings[1].severity === 4 && out.findings[2].severity === 5,
      'CT02 and SERIAL findings are untouched by bundle mode');
    ok(out.overallScore === Math.round(((2 + 4 + 5 + 2) / 20) * 100),
      'indicator score is recomputed from demoted severities');
    ok(/Bundle mode/.test(out.extractionNotes), 'demotion is disclosed in extraction notes');

    // No case details AND a small document => ordinary document, no-op.
    sandbox.legalCaseFile = false;
    sandbox._pipelinePageCount = 10;
    const untouched = vm.runInContext('applyBundleMode(' + JSON.stringify(result) + ')', sandbox);
    ok(untouched.findings[0].severity === 4 && untouched.overallScore === 80,
      'bundle mode is a no-op on an ordinary document (no case details, few pages)');

    // No case details but a large PDF with repeated internal page numbers =>
    // auto-detected as a bundle so structural noise still demotes.
    sandbox._pipelinePageCount = 528;
    const bundleFindings = { findings: [
      { type: 'CT27', severity: 4, evidence: 'Page number 10 appears on multiple pages' },
      { type: 'CT27', severity: 4, evidence: 'Page number 11 appears on multiple pages' },
      { type: 'CT27', severity: 4, evidence: 'Page number 12 appears on multiple pages' },
      { type: 'CT02', severity: 4, evidence: 'totals differ' }
    ], overallScore: 80, confidence: 'VERY_HIGH', clean: false, extractionNotes: 'note.' };
    const auto = vm.runInContext('applyBundleMode(' + JSON.stringify(bundleFindings) + ')', sandbox);
    ok(auto.findings[0].severity === 2 && auto.findings[3].severity === 4,
      'large bundle auto-detected without case details: CT27 demotes, CT02 untouched');
    ok(auto.bundleMode && auto.bundleMode.auto === true,
      'auto-detected bundle mode is flagged as automatic');
    ok(/detected automatically/.test(auto.extractionNotes),
      'auto bundle detection is disclosed in extraction notes');
  }
}

// OCR rescue: image-only pages must be recoverable on-device. The vendored
// tesseract assets must exist (CDNs are blocked by the network policy), the
// seal page must define the hook, and the engine must call it guarded so the
// scan never dies when OCR is unavailable.
{
  for (const f of [
    'vendor/tesseract.min.js',
    'vendor/tesseract-worker.min.js',
    'vendor/tesseract-core-lstm.wasm.js',
    'vendor/tesseract-core-simd-lstm.wasm.js',
    'vendor/eng.traineddata.gz',
  ]) {
    ok(existsSync(f), `vendored OCR asset missing: ${f}`);
  }
  const html = readFileSync('seal-document.html', 'utf8');
  ok(html.includes('async function voOcrRescuePages'), 'seal page defines the OCR rescue helper');
  ok(/workerPath:\s*'\/vendor\/tesseract-worker\.min\.js'/.test(html),
    'OCR worker loads from /vendor (same-origin, no CDN)');
  const engine = readFileSync('forensic-engine-page.js', 'utf8');
  ok(/voOcrRescuePages/.test(engine), 'engine calls the OCR rescue hook');
  ok(/OCR rescue attempted but failed/.test(engine), 'engine discloses OCR failure instead of dying');
}

// Founder-reported issues of 26 Jul (PR #41 comment): missing watermark,
// unreadable contradiction codes, and password-protected forensic seals
// sharing only the document instead of the whole bundle.
{
  // Watermark: the fetched path must exist in the repo, and the pipeline must
  // retry the fetch at seal time instead of trusting one boot-time request.
  ok(existsSync('images/watermark_portrait.png'),
    'watermark exists at the path the page fetches (/images/watermark_portrait.png)');
  const html = readFileSync('seal-document.html', 'utf8');
  ok(html.includes('async function voEnsureWatermark'), 'watermark fetch has a retry helper');
  ok(/await voEnsureWatermark\(\);.*\n.*buildSealedPDF/.test(html),
    'the pipeline retries the watermark before sealing');

  // Whole-bundle share: report + findings JSON ride along with the document.
  ok(html.includes('function voShareFileList'), 'share builds the full bundle file list');
  ok(/_voShareFiles\.push\(\{ bytes: window\._voReportPack\.bytes/.test(html),
    'sealed forensic report is included in the share bundle');
  ok(/window\._voFindingsJson/.test(html) && /-findings\.json/.test(html),
    'findings JSON is included in the share bundle');

  // Human-readable findings: plain names lead, codes trail; the deterministic
  // narrative lists top findings as sentences under KEY CONTRADICTIONS.
  const rep = readFileSync('forensic-report.js', 'utf8');
  ok(!/det \+ ' · ' \+ g\.type/.test(rep),
    'matrix rows no longer lead with bare detector codes');
  ok(/\(CT_NAMES\[g\.type\] \|\| g\.type\) \+ '  \('/.test(rep),
    'matrix rows lead with the plain-language finding name');
  ok(html.includes('KEY CONTRADICTIONS'),
    'on-device narrative lists top findings as plain sentences with page anchors');
}

// False-clean guard: a 187-page scanned bundle that had been sealed before
// carried ~130 chars of seal-footer text per page, cleared the "some text
// exists" check, and reported "CLEAN: internally consistent" with 0 findings
// -- a false clean on a document the engine never read. The engine must flag
// such documents unreadable, the seal page must show an error (not a green
// tick), and the report must say NOT ANALYSED instead of clean.
{
  const engine = readFileSync('forensic-engine-page.js', 'utf8');
  ok(/var unreadable = allFindings\.length === 0 && textBlocks\.length >= 3/.test(engine),
    'engine flags zero-finding low-text multi-page documents as unreadable');
  ok(/clean: unreadable \? false : overallScore < 20/.test(engine),
    'an unreadable document is never reported clean');
  ok(/UNREADABLE: the document has no usable machine-readable text/.test(engine),
    'engine summary states the document was not read');
  const html = readFileSync('seal-document.html', 'utf8');
  ok(/forensicResult\.unreadable/.test(html) && /NOT analysed \(scanned\/image PDF\)/.test(html),
    'seal page shows an error status for unreadable documents, not a green tick');
  ok(/var THIN = 200/.test(html) && /thinCount >= Math\.ceil\(lens\.length \* 0\.6\)/.test(html),
    'OCR rescue also covers image-dominant documents (seal-footer-only pages)');
  const rep = readFileSync('forensic-report.js', 'utf8');
  ok(/DOCUMENT NOT ANALYSED — NOT A CLEAN RESULT/.test(rep),
    'report executive summary declares NOT ANALYSED for unreadable documents');
  ok(/No contradiction analysis was possible/.test(rep),
    'report matrix explains the absence of analysis instead of implying consistency');
}

console.log(`\n[page-boot] PASS=${pass} FAIL=${fail}`);
if (fail > 0) {
  console.log('[page-boot] FAILURES');
  process.exit(1);
}
console.log('[page-boot] ALL GREEN');
