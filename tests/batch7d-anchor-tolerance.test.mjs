/**
 * Batch 7d / N1 — strict-first OCR anchor tolerance.
 *
 * The normaliser exists only on comparison copies. These tests execute the
 * real Worker gate and prove that rescued output is the original draft bytes,
 * fabrication still fails, and a rescue rejected by a later gate is not counted.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const workerPath = path.join(__dirname, '..', 'worker', 'verum-rules.js');
let source = fs.readFileSync(workerPath, 'utf8');
source = source
  .replace(/^import .*$/gm, '')
  .replace(/export default verum_rules_default;\s*$/, 'this.workerDefault = verum_rules_default;');
const sandbox = {
  console, URL, URLSearchParams, Response, Request, Headers,
  TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Blob, FormData,
  setTimeout, clearTimeout, fetch: async () => { throw new Error('unexpected fetch'); },
  serveSite: async () => null, serveFromAssets: async () => null,
  serveFromRepo: async () => null, REPO_RAW_ORIGIN: '', ORIGIN: '',
  LOGO_FULL_PNG_B64: '', WATERMARK_PNG_B64: '', b64ToBytes: () => new Uint8Array()
};
vm.createContext(sandbox);
vm.runInContext(source + '\nthis.gate = humanGate; this.norm = humanNorm; this.pages = humanPageTextNorms; this.tolerant = humanTolerantNorm;', sandbox, { filename: 'verum-rules.js' });

let pass = 0, fail = 0;
const ok = (condition, name) => {
  if (condition) pass++;
  else { fail++; console.log('  ✗ FAIL: ' + name); }
};
console.log('======================================================');
console.log('RUN  batch7d-anchor-tolerance.test.mjs');
console.log('======================================================\n');

const record = '[Page 7]\nAt 43231 AM on 1/3/2026 the mbined Summons was issued.';
const rescuedSentence = 'The record states "At 4¢3231 AM on 1/3/3026 the mbined Summons was issued" [F1] (page 7).';
const supportingSentence = 'The same page identifies the mbined Summons [F1] (page 7).';
const corpusNorm = sandbox.norm(record);
const pageText = sandbox.pages([record]);
const ids = new Set(['F1']);
const pages = new Set([7]);
const types = new Map([['F1', 'CT02']]);
const quote = rescuedSentence.match(/"([^"]+)"/)[1];
ok(corpusNorm.indexOf(sandbox.norm(quote)) < 0, 'the OCR-noisy quotation fails strict matching');
ok(sandbox.tolerant(corpusNorm).indexOf(sandbox.tolerant(quote)) >= 0, 'the specified normalised comparison rescues the OCR quotation');
ok(sandbox.tolerant(quote).indexOf('2026') >= 0 && sandbox.tolerant(quote).indexOf('43231') >= 0,
  'only the declared year/currency OCR forms change in the match copy');

const noisyRecord = '[Page 7]\nAt 4¢3231 AM on 1/3/3026 the mbined Summons was issued.';
const cleanSentence = 'The record states "At 43231 AM on 1/3/2026 the mbined Summons was issued" [F1] (page 7).';
const noisyRescue = sandbox.gate(cleanSentence + ' ' + supportingSentence, ids, pages,
  sandbox.norm(noisyRecord), types, false, [], sandbox.pages([noisyRecord]), null,
  sandbox.tolerant(noisyRecord), sandbox.pages([noisyRecord], true));
ok(sandbox.norm(noisyRecord).indexOf(sandbox.norm('At 43231 AM on 1/3/2026 the mbined Summons was issued')) < 0
    && noisyRescue.stats.anchorTolerant === 1 && noisyRescue.stats.anchorTolerantPages.join(',') === '7',
  'raw tolerant corpus/page copies also rescue OCR noise on the sealed-record side');

const rescued = sandbox.gate(rescuedSentence + ' ' + supportingSentence, ids, pages, corpusNorm, types, false, [], pageText, null);
ok(rescued.stats.anchorTolerant === 1, 'anchorTolerant increments once for the rescued sentence');
ok(rescued.stats.anchorTolerantPages.join(',') === '7', 'the disclosure records the sealed-record page');
ok(rescued.text.indexOf(rescuedSentence) >= 0, 'printed bytes are the original pre-normalisation draft bytes');
ok(rescued.text.indexOf('4¢3231 AM') >= 0 && rescued.text.indexOf('3026') >= 0,
  'normalised comparison text never replaces the printed quotation');

const fabricatedSentence = 'The record states "At 4¢3231 AM on 1/3/3026 an entirely fabricated order was issued" [F1] (page 7).';
const fabricated = sandbox.gate(fabricatedSentence, ids, pages, corpusNorm, types, false, [], pageText, null);
ok(fabricated.stats.quote === 1 && fabricated.stats.kept === 0, 'a fabricated quotation fails both strict and tolerant matching');
ok(fabricated.stats.anchorTolerant === 0 && fabricated.text.indexOf('fabricated order') < 0,
  'fabrication is neither counted as rescued nor printed');

const laterGate = sandbox.gate('The record probably states "At 4¢3231 AM on 1/3/3026 the mbined Summons was issued" [F1] (page 7).',
  ids, pages, corpusNorm, types, false, [], pageText, null);
ok(laterGate.stats.language === 1 && laterGate.stats.anchorTolerant === 0,
  'a tolerant match rejected by the language gate is not counted as rescued');

// The 30xx correction is a date repair, never a licence to alter an amount.
const amountRecord = '[Page 4]\nThe invoice totalled R3050 on 12 May 2026.';
const amountSentence = 'The record states "The invoice totalled R2050 on 12 May 2026" [F1] (page 4).';
const amountGate = sandbox.gate(amountSentence, ids, new Set([4]), sandbox.norm(amountRecord), types, false, [], sandbox.pages([amountRecord]), null);
ok(amountGate.stats.quote === 1 && amountGate.stats.kept === 0 && amountGate.stats.anchorTolerant === 0,
  'a fabricated 20xx amount never rescues a different 30xx amount in the record');
ok(sandbox.tolerant('12 May 3026').indexOf('12 may 2026') >= 0 && sandbox.tolerant('R3050').indexOf('2050') < 0,
  'year correction applies beside a month name but leaves a bare 30xx amount unchanged');

// Tolerant-only page evidence must not loosen a later strict contradiction.
const twoPageRecord = '[Page 7]\nAt 43231 AM on 1/3/2026 the first entry was made.\n[Page 8]\nAt 53231 PM on 2/3/2026 the second entry was made.';
const twoPageText = sandbox.pages([twoPageRecord]);
const tolerantPair = 'The record states "At 4¢3231 AM on 1/3/3026 the first entry was made" and "At 5¢3231 PM on 2/3/3026 the second entry was made" (pages 7, 8).';
const strictContradiction = 'The two accounts contradict each other on pages 7 and 8.';
const isolatedMaps = sandbox.gate(tolerantPair + ' ' + strictContradiction, ids, new Set([7, 8]), sandbox.norm(twoPageRecord), types, false, [], twoPageText, null);
ok(isolatedMaps.stats.anchorTolerant === 1 && isolatedMaps.stats.overclaim === 1 && isolatedMaps.text.indexOf(strictContradiction) < 0,
  'tolerant-only verified pages never authorise a later strict contradiction');

const report = require('../forensic-report.js');
const disclosure = report._voAnchorToleranceDisclosure(rescued.stats.anchorTolerant, rescued.stats.anchorTolerantPages);
ok(disclosure === 'Anchor matching on OCR-rescued pages used normalised text comparison for 1 sentence; all printed quotations remain verbatim from the sealed record. Sealed-record pages: 7.',
  'the exact disclosure and sealed-record page list print');
ok(report._voAnchorToleranceDisclosure(0, []) === '', 'no disclosure prints without a printed OCR rescue');
const renderReconciled = report._voPrintedAnchorTolerance({
  anchorTolerant: 2,
  anchorTolerantSentences: [
    { text: rescuedSentence, pages: [7] },
    { text: 'This rescued draft sentence was removed at render time.', pages: [8] }
  ]
}, rescuedSentence);
ok(renderReconciled.count === 1 && renderReconciled.pages.join(',') === '7',
  'only the exact rescued sentence surviving render contributes its count and page');
ok(report._voPrintedAnchorTolerance({ anchorTolerant: 3, anchorTolerantPages: [7] }, rescuedSentence).count === 0,
  'part-level legacy counters cannot overclaim sentence-level printed rescues');

// Build the real court-ready PDF and read its content streams back. This pins
// the disclosure at the report face, not merely at the formatting helper.
const engine = require('../forensic-engine-page.js');
const g = globalThis;
g.window = g;
g.self = g;
if (!g.PDFLib) {
  new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(__dirname, '..', 'vendor', 'pdf-lib.min.js'), 'utf8'))(g, g, g);
}
const pdfText = async (bytes) => {
  const loaded = await g.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = [];
  for (let i = 0; i < loaded.getPageCount(); i++) {
    pages.push((await engine.extractPageText(bytes, i, loaded)).join(' '));
  }
  return pages.join(' \n ').replace(/[ \t]+/g, ' ');
};
const pdfOpts = {
  documents: [{ name: 'ocr-fixture.pdf', pageCount: 7, sha512: 'ab'.repeat(64), sealId: 'VO-BATCH7DFIXTURE' }],
  findings: {
    clean: false, overallScore: 50, confidence: 'LOW', totalFindings: 1,
    findings: [{ type: 'CT02', severity: 4, evidence: 'The record states "At 43231 AM on 1/3/2026 the mbined Summons was issued"', location: 'Page 7', anchor: { where: [7], who: [], when: [] } }],
    summary: '1 page-anchored finding established.', contradictionTypesUsed: 1
  },
  ocrPages: [7], images: {}, generatedAt: '2026-11-12T08:45:31.000Z',
  humanProvenance: { sectionsAttempted: 1, model: 'batch7d-test-narrator' }
};
const quiet = console.log;
let rescuedPdf, strictPdf, standalonePdf, standaloneStrictPdf, standaloneResult;
console.log = () => {};
try {
  rescuedPdf = await pdfText(await report.buildHumanReport(Object.assign({}, pdfOpts, {
    humanSections: {
      critical_evidence: { provenance: 'ai', text: rescued.text, gate: rescued.stats },
      // A discarded draft's counters must never leak into printed provenance.
      legal_framework: { provenance: 'none', reason: 'gate_failed', discarded: 1,
        gate: { dropped: 1, anchorTolerant: 4, anchorTolerantPages: [8] } }
    }
  })));
  strictPdf = await pdfText(await report.buildHumanReport(Object.assign({}, pdfOpts, {
    humanSections: {
      critical_evidence: { provenance: 'ai', text: rescued.text,
        gate: { kept: 2, dropped: 0, anchorTolerant: 0, anchorTolerantPages: [] } }
    }
  })));
  standaloneResult = await report.buildForensicNarrative(Object.assign({}, pdfOpts, {
    narrativeParts: [
      { index: 1, provenance: 'ai', text: rescued.text, gate: rescued.stats },
      { index: 2, provenance: 'ai', text: '| discarded tabular draft',
        gate: { dropped: 1, anchorTolerant: 4, anchorTolerantPages: [8] } }
    ]
  }));
  standalonePdf = await pdfText(standaloneResult.bytes);
  const standaloneStrictResult = await report.buildForensicNarrative(Object.assign({}, pdfOpts, {
    narrativeParts: [{ index: 1, provenance: 'ai', text: rescued.text,
      gate: { kept: 2, dropped: 0, anchorTolerant: 0, anchorTolerantPages: [] } }]
  }));
  standaloneStrictPdf = await pdfText(standaloneStrictResult.bytes);
} finally {
  console.log = quiet;
}
ok(rescuedPdf.indexOf(disclosure) >= 0,
  'the generated court-ready PDF prints the exact disclosure on its provenance face');
ok(rescuedPdf.indexOf('At 4¢3231 AM on 1/3/3026 the mbined Summons was issued') >= 0,
  'the generated PDF preserves the rescued quotation’s original bytes');
ok(rescuedPdf.indexOf('4 sentences') < 0 && rescuedPdf.indexOf('Sealed-record pages: 7, 8') < 0,
  'a discarded AI draft contributes no OCR-rescue count or page to the PDF');
ok(strictPdf.indexOf('Anchor matching on OCR-rescued pages used normalised text comparison') < 0,
  'the generated PDF omits the disclosure when strict matching passed everywhere');
ok(standaloneResult.gateStats.anchorTolerant === 1 && standaloneResult.gateStats.anchorTolerantPages.join(',') === '7'
    && standalonePdf.indexOf(disclosure) >= 0,
  'the standalone narrative PDF prints only the rescued AI part’s disclosure and page');
ok(standalonePdf.indexOf('At 4¢3231 AM on 1/3/3026 the mbined Summons was issued') >= 0,
  'the standalone narrative PDF preserves the rescued quotation’s original bytes');
ok(standaloneStrictPdf.indexOf('Anchor matching on OCR-rescued pages used normalised text comparison') < 0,
  'the standalone narrative PDF omits the disclosure after strict-only matching');

console.log(`\n[batch7d-anchor-tolerance] PASS=${pass} FAIL=${fail}`);
if (fail) process.exit(1);
console.log('[batch7d-anchor-tolerance] ALL GREEN');
