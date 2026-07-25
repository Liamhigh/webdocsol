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
  const vs = [...html.matchAll(/\?v=([0-9.]+-\d+)"/g)].map((m) => m[1]);
  ok(vs.length >= 3, `expected 3+ versioned script tags, found ${vs.length}`);
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
  ok(/await voEnsureForensicScripts\(\)/.test(html), 'the scan awaits the script-recovery loader');
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

console.log(`\n[page-boot] PASS=${pass} FAIL=${fail}`);
if (fail > 0) {
  console.log('[page-boot] FAILURES');
  process.exit(1);
}
console.log('[page-boot] ALL GREEN');
