/**
 * Regression test: per-page text extraction must not re-parse the whole PDF.
 *
 * extractPageText() used to call PDFDocument.load(pdfBytes) itself, so a
 * 159-page document was parsed 159 times. Extraction was quadratic in document
 * size and the sealing page froze on "Scanning 159 page(s)". The engine now
 * receives the already-parsed document and reuses it.
 *
 * This counts parses rather than asserting a wall-clock time, so it stays
 * meaningful on slow or loaded CI machines.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const g = globalThis;
new Function('window', 'self', 'globalThis', readFileSync(ROOT + '/vendor/pdf-lib.min.js', 'utf8'))(g, g, g);
const PDFLib = g.PDFLib;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  engine-perf.test.mjs');
console.log('======================================================\n');

// Count full-document parses performed during one scan.
let parses = 0;
const realLoad = PDFLib.PDFDocument.load.bind(PDFLib.PDFDocument);
PDFLib.PDFDocument.load = function (...args) { parses++; return realLoad(...args); };

const E = require(ROOT + '/forensic-engine-page.js');

const PAGES = 40;
const doc0 = await realLoad(readFileSync(ROOT + '/forensic_test_document.pdf'), { ignoreEncryption: true });
const builder = await PDFLib.PDFDocument.create();
// Repeat the real test document's pages until we have a large document.
while (builder.getPageCount() < PAGES) {
  const copied = await builder.copyPages(doc0, doc0.getPageIndices());
  for (const p of copied) {
    if (builder.getPageCount() >= PAGES) break;
    builder.addPage(p);
  }
}
const bytes = await builder.save();

parses = 0;
const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
const afterLoad = parses;

const progress = [];
const res = await E.runForensicEngine(bytes, doc, (done, total) => progress.push([done, total]));
const duringScan = parses - afterLoad;

console.log(`  pages=${doc.getPageCount()} parses during scan=${duringScan} findings=${res.totalFindings}`);

ok(duringScan === 0,
  `scan re-parsed the document ${duringScan} time(s); it must reuse the parsed doc`);
ok(res && typeof res.overallScore === 'number', 'engine still returns a scored result');
ok(res.totalFindings > 0, 'engine still finds contradictions in the test document');
ok(progress.length > 0, 'engine reports scan progress so the UI can update');
ok(progress.every(([d, t]) => d <= t && t === doc.getPageCount()), 'progress counts are coherent');

console.log(`\n[engine-perf] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[engine-perf] FAILURES'); process.exit(1); }
console.log('[engine-perf] ALL GREEN');
