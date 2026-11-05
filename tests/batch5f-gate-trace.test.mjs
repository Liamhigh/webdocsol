// Batch 5f — two report-facing features, borrowed from formal-verification
// practice (component contracts and well-formedness gates; counter-example
// traces):
//  - voWellFormedness: seven integrity checks on the CONTAINER (text layer,
//    page coverage, analysis contamination, parties, dates, structure,
//    prior-seal recognition), disclosed ahead of the findings on the
//    contents. The gate changes no finding and no score.
//  - serial trace: every SERIAL finding carries a stage-by-stage trace in
//    scheme order, each stage anchored to the page where its keyword was
//    found (rendered in Serial Pattern Analysis; exported as serial_trace).
//
// Run: node tests/batch5f-gate-trace.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

t.ok(typeof E.voWellFormedness === 'function', 'voWellFormedness is exported');
t.ok(typeof E.detectSerialPatterns === 'function', 'detectSerialPatterns is exported');
t.ok(E.VO_ENGINE_VERSION === '5.5.0-web', 'engine version is 5.5.0-web');

const DATED = 'The applicant John Smith confirmed on 12 March 2026 that payment of R50,000 was made.';

// ---- gate: a healthy record passes all seven checks ----
const good = E.voWellFormedness({
  textBlocks: [DATED + ' ' + DATED],
  contentChars: 800,
  imageOnlyPages: [], ocrRan: false, ocrPages: [],
  markdownPages: [], docSegs: [{ start: 1 }], footerOnlyPages: [],
  selfSealed: false,
  parties: E.voExtractParties(DATED),
  dates: E.voExtractDates(DATED)
});
t.ok(good.total === 7, 'gate runs exactly 7 checks');
t.ok(good.passed === 7, 'healthy record passes all 7 gate checks');
t.ok(good.checks.every(c => c.id && c.name && typeof c.pass === 'boolean' && c.note),
  'every check carries id, name, pass and a note');

// ---- gate: an unreadable image bundle fails WF1 and WF2 ----
const img = E.voWellFormedness({
  textBlocks: ['', '', ''],
  contentChars: 0,
  imageOnlyPages: [1, 2, 3], ocrRan: false, ocrPages: [],
  markdownPages: [], docSegs: [], footerOnlyPages: [],
  selfSealed: false, parties: [], dates: []
});
const byId = {};
for (const c of img.checks) byId[c.id] = c;
t.ok(!byId.WF1.pass, 'no text layer fails WF1');
t.ok(!byId.WF2.pass && /p\. 1, 2, 3/.test(byId.WF2.note), 'image-only pages fail WF2 and are listed');

// ---- WF2 after OCR rescue: only the UNEXAMINED remainder fails the gate ----
// The image-only list holds both OCR-recovered and unrecovered pages (the
// rescue loop marks both); the gate may only fail on the pages nobody read.
// Greensky, 5 Nov 2026: 30 image-only pages were reported "not examined"
// while 22 of them had been OCR-recovered and examined — only 8 were truly
// unreadable. The report cover's own count was the correct 8.
const mkWf2 = (io, ocr) => {
  const g = E.voWellFormedness({
    textBlocks: ['x'.repeat(300)],
    contentChars: 300,
    imageOnlyPages: io, ocrRan: ocr.length > 0, ocrPages: ocr,
    markdownPages: [], docSegs: [{ start: 1 }], footerOnlyPages: [],
    selfSealed: false,
    parties: E.voExtractParties(DATED), dates: E.voExtractDates(DATED)
  });
  return g.checks.find(c => c.id === 'WF2');
};
const greenskyIo = []; for (let gi = 1; gi <= 30; gi++) greenskyIo.push(gi);
const greenskyRescued = greenskyIo.slice(0, 22); // pages 1-22 rescued, 23-30 unreadable
const wf2g = mkWf2(greenskyIo, greenskyRescued);
t.ok(!wf2g.pass, 'WF2 still fails when pages remain unreadable after OCR');
t.ok(/8 page\(s\) carry no machine-readable text/.test(wf2g.note) && /p\. 23, 24, 25, 26, 27, 28, 29, 30/.test(wf2g.note),
  'WF2 names only the 8 unexamined pages, not the 30 image-only pages');
t.ok(/22 image page\(s\) were recovered by OCR rescue and examined/.test(wf2g.note),
  'WF2 discloses the 22 rescued pages as examined');
const wf2full = mkWf2([5, 9], [5, 9]);
t.ok(wf2full.pass, 'full OCR rescue passes WF2');
t.ok(/2 image page\(s\).*recovered by OCR rescue and examined/.test(wf2full.note),
  'full-rescue note says the pages were examined');
const wf2noOcr = mkWf2([4, 7], []);
t.ok(!wf2noOcr.pass && /p\. 4, 7/.test(wf2noOcr.note) && !/OCR rescue/.test(wf2noOcr.note),
  'no OCR rescue: all image-only pages fail, no rescue claim');
const wf2clean = mkWf2([], []);
t.ok(wf2clean.pass && /no image-only pages/.test(wf2clean.note), 'clean record keeps the original pass note');
t.ok(!byId.WF4.pass, 'no parties fails WF4');
t.ok(!byId.WF5.pass, 'no dates fails WF5');
t.ok(!byId.WF6.pass, 'no segments fails WF6');
t.ok(byId.WF7.pass, 'prior-seal check never fails (disclosure only)');

// ---- gate: a bundle that is ALL rendered analysis fails WF3 ----
const allMd = E.voWellFormedness({
  textBlocks: ['**analysis** of the record', '**more analysis** of the record'],
  contentChars: 400,
  imageOnlyPages: [], ocrRan: false, ocrPages: [],
  markdownPages: [1, 2], docSegs: [{ start: 1 }], footerOnlyPages: [],
  selfSealed: false,
  parties: E.voExtractParties(DATED), dates: E.voExtractDates(DATED)
});
t.ok(!allMd.checks.find(c => c.id === 'WF3').pass, 'all-analysis bundle fails WF3');

// ---- gate: a few quarantined analysis pages do NOT fail WF3 ----
const someMd = E.voWellFormedness({
  textBlocks: ['record text ' + 'x'.repeat(300), '**analysis** page', 'record text ' + 'y'.repeat(300)],
  contentChars: 700,
  imageOnlyPages: [], ocrRan: false, ocrPages: [],
  markdownPages: [2], docSegs: [{ start: 1 }], footerOnlyPages: [],
  selfSealed: false,
  parties: E.voExtractParties(DATED), dates: E.voExtractDates(DATED)
});
const wf3 = someMd.checks.find(c => c.id === 'WF3');
t.ok(wf3.pass, 'quarantined analysis pages pass WF3');
t.ok(/quarantined as a secondary source/.test(wf3.note), 'WF3 note discloses the quarantine');

// ---- gate: robust on edge input ----
t.ok((() => { const g = E.voWellFormedness(null); return g.total === 7 && g.passed >= 0; })(),
  'gate never throws on null input');
t.ok((() => { const g = E.voWellFormedness({}); return g.total === 7; })(),
  'gate never throws on empty input');

// ---- trace: stages recorded in scheme order, anchored to their page ----
const scam = [
  'Dear beneficiary, I write with a confidential proposal regarding unclaimed funds of ten million dollars.',
  'To proceed, a processing fee is required. This is time sensitive.',
  'Please keep secret our arrangement; do not disclose this private matter to anyone.'
];
const sp01 = E.detectSerialPatterns(scam).filter(f => f.serialPattern === 'SP01_ADVANCE_FEE_FRAUD');
t.ok(sp01.length === 1, 'SP01 detected on the canonical 419 text');
t.ok(Array.isArray(sp01[0].trace) && sp01[0].trace.length >= 3, 'SP01 carries a stage trace');
t.ok(sp01[0].trace[0].stage === 'Unsolicited contact' && sp01[0].trace[0].page === 1,
  'trace stage 1 is the opening stage, anchored to page 1');
t.ok(sp01[0].trace.every(e => e.page >= 1 && e.page <= 3),
  'every trace anchor lies inside the matched window');
t.ok(sp01[0].trace.map(e => e.stage).join('|').indexOf('Unsolicited contact') === 0 &&
   sp01[0].trace.map(e => e.stage).join('|').indexOf('Secrecy demanded') > 0,
  'trace preserves the scheme order');
// the finding still carries its human-readable evidence and page range
t.ok(/stages matched/.test(sp01[0].evidence) && /Pages 1-3/.test(sp01[0].location),
  'evidence and location unchanged by the trace');

// ---- trace: determinism ----
const sp01b = E.detectSerialPatterns(scam).filter(f => f.serialPattern === 'SP01_ADVANCE_FEE_FRAUD');
t.ok(JSON.stringify(sp01b[0].trace) === JSON.stringify(sp01[0].trace),
  'the trace is deterministic — same input, same chain');

// ---- trace: silent corpus stays silent ----
t.ok(E.detectSerialPatterns(['Nothing relevant here.', 'Nor here.', 'Nor there.']).length === 0,
  'no stages, no finding, no trace');

t.done('batch5f-gate-trace');
