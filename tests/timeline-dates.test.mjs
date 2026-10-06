/**
 * Timeline date-extraction guard (6 October 2026).
 *
 * The Louw v Naidoo run (evidence-bundle-6-docs) sealed a report whose §25 read
 * "The engine emitted no dated events for this document" — even though the
 * pages named 22 May 2024, 21 June 2024, 15 July 2024, 13 September 2024 and
 * 16 January 2026. The timeline had been built ONLY from dates a finding
 * carried; that bundle's findings were ID/email/registration (dateless), so the
 * chronology came out empty. voBuildTimeline now also reads the dates the page
 * text states (text layer and OCR), anchors each to its page and line, orders
 * them, excludes impossible dates (never guessing a true date), and never
 * infers a missing one. Synthetic pages only; no real-matter document.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  timeline-dates.test.mjs');
console.log('======================================================\n');

// A bundle whose dates sit in the page text, with dateless findings — the
// Louw v Naidoo shape. An impossible date is present and must be excluded.
const pages = [
  'SAMSA Local General Safety Certificate issued at Durban on 22 May 2024 to the owner.',
  'Notice of Change of Ownership of a Vessel signed on 21 June 2024 for the vessel.',
  'By written agreement the parties swapped the vessel on 15 July 2024, no money changing hands.',
  'Deed of sale dated 13 September 2024 for three hundred thousand rand, balance by March 2025.',
  'SAMSA issued a Prohibition Order on 16 January 2026 against the owner.',
  'A clerk mistyped the invoice date as 25/13/2024 on this page.'
];

// ---- 1. dates in the page text become ordered events -----------------------
const tl = E.voBuildTimeline([], pages);
ok(tl.events.length >= 5, 'the timeline is built from the dates in the record, not left empty (' + tl.events.length + ' events)');
for (const d of ['22 May 2024', '21 June 2024', '15 July 2024', '13 September 2024', '16 January 2026']) {
  ok(tl.events.some(e => e.date === d), 'event present: ' + d);
}
ok(/^On 22 May 2024:/m.test(tl.narrative) && /On 16 January 2026:/.test(tl.narrative),
  'each line reads "On <date>: …" and quotes the line the date sits on');

// chronological order: 22 May 2024 before 16 January 2026
const i1 = tl.narrative.indexOf('22 May 2024'), i2 = tl.narrative.indexOf('16 January 2026');
ok(i1 !== -1 && i2 !== -1 && i1 < i2, 'the events are ordered chronologically');

// the event carries the page and the record's own words, no inference
const may = tl.events.find(e => e.date === '22 May 2024');
ok(may && may.page === 1 && /Durban/.test(may.evidence) && may.source === 'document',
  'a document-date event carries its page and quotes the line, marked source=document');

// ---- 2. an impossible date is never ordered and never guessed --------------
ok(!tl.events.some(e => /25\/13\/2024/.test(e.date)),
  'the impossible date 25/13/2024 is not placed in the chronology');

// ---- 3. a finding date and the same date in the text are ONE event ---------
const findings = [{
  type: 'CT01', evidence: 'the swap is recorded',
  anchor: { where: [1], who: [{ name: 'R. Louw' }], when: ['15 July 2024'], quote: [] }
}];
const merged = E.voBuildTimeline(findings, ['By written agreement the parties swapped on 15/07/2024.', 'nothing here']);
const julys = merged.events.filter(e => e.key === 20240715);
ok(julys.length === 1 && julys[0].source === 'finding',
  'a finding date and the same calendar date in the text on the same page make one event (the finding wins)');

// ---- 4. OCR-recovered pages are read too -----------------------------------
const ocr = E.voBuildTimeline([], ['[OCR] meeting held on 3 January 2025 at the club.']);
ok(ocr.events.some(e => e.date === '3 January 2025'),
  'dates on an OCR-recovered page ([OCR] prefix) enter the timeline');

// ---- 5. backward compatible: no textBlocks -> finding-only -----------------
const fo = E.voBuildTimeline([{ type: 'CT03', evidence: 'x', anchor: { where: [2], who: [], when: ['21 June 2024'], quote: [] } }]);
ok(fo.events.length === 1 && fo.events[0].source === 'finding',
  'called without page text, the timeline is finding-only (unchanged behaviour)');

console.log('\ntimeline-dates: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
