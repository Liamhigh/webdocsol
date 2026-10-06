/**
 * Document fact index (PR A of cross-document reading; design note merged in
 * #221). The engine classifies each page and extracts a page-anchored factual
 * record from the RECORD pages, each field quoted from the page. This stage is
 * DESCRIPTIVE only: it states what a page says, quoted and paged. It asserts no
 * contradiction, names no offence, and reaches no conclusion about ownership or
 * conduct — those stay the court's (Verdict Reservation). A secondary-source or
 * analysis page is classified as such and never enters the record set.
 *
 * Synthetic pages in the shape of the Louw v Naidoo bundle; no real-matter
 * document is committed.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  doc-fact-index.test.mjs');
console.log('======================================================\n');

// ---- 1. page classification ------------------------------------------------
ok(E.voClassifyPage('Notice of Change of Ownership of a Vessel. Vessel DTD782C.') === 'ownership-notice', 'an ownership notice is classified');
ok(E.voClassifyPage('Deed of sale. The seller hereby sells DTD782C for R300,000.') === 'sale', 'a sale is classified');
ok(E.voClassifyPage('By written agreement the parties swapped the vessel, no money changing hands.') === 'swap', 'a swap is classified');
ok(E.voClassifyPage('Lease agreement. The lessee shall pay a monthly rental of R25,000.') === 'lease', 'a lease is classified');
ok(E.voClassifyPage('Commercial Traditional Linefish Right LF210223, permit conditions for Zone C.') === 'permit', 'a permit/right is classified');
ok(E.voClassifyPage('Local General Safety Certificate DBN14322/05/2024 issued at Durban.') === 'certificate', 'a certificate is classified');
ok(E.voClassifyPage('Dear Sir, please find attached the records. Yours faithfully, R. Louw.') === 'correspondence', 'correspondence is classified');
ok(E.voClassifyPage('Random page of notes with nothing in particular on it.') === 'other', 'an unmatched page is "other"');
// secondary / analysis pages
ok(E.voClassifyPage('Notice of Change of Ownership of a Vessel.', true) === 'analysis-secondary', 'a page flagged secondary is analysis-secondary regardless of its words');
ok(E.voClassifyPage('Verum Omnis — Forensic Narrative • page 4 of 14 the applicant alleges the sale') === 'analysis-secondary', 'a Verum Omnis analysis page is analysis-secondary');

// ---- 2. fact extraction ----------------------------------------------------
const f = E.voExtractPageFacts('Notice of Change of Ownership of a Vessel. Vessel DTD 782 C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.');
ok(f.vessel === 'DTD782C', 'the vessel registration is normalised (spaces removed)');
ok(f.ownerFrom === 'T.F. Hardouin' && /^R\. Louw/.test(f.ownerTo) && !/Dated/.test(f.ownerTo), 'the owner direction is read and the party is not polluted by trailing words');
ok(f.date === '21 June 2024', 'the instrument date is read');
ok(typeof f.quote === 'string' && /previous owner T\.F\. Hardouin new owner R\. Louw/.test(f.quote), 'a verbatim quote anchors the fact');

const g = E.voExtractPageFacts('Deed of sale. The seller hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.');
ok(g.vessel === 'DTD782C' && g.amount === 'R300,000' && g.date === '13 September 2024', 'the sale page yields vessel, amount and date');

const h = E.voExtractPageFacts('Commercial Traditional Linefish Right LF210223 for the holder.');
ok(h.right === 'LF210223' && h.vessel === null, 'a fishing right is captured as a right, not a vessel');

// a two-digit-year date is not taken as the instrument date (century unknown)
const amb = E.voExtractPageFacts('Signed on 15/11/98 by the parties, vessel DTD900A.');
ok(amb.date === null && amb.vessel === 'DTD900A', 'a two-digit-year date is not recorded as the instrument date');

// ---- 3. the index: record pages in, secondary/analysis pages out -----------
const pages = [
  'Notice of Change of Ownership of a Vessel. Vessel DTD 782 C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.',
  'Deed of sale. The seller hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.',
  'Verum Omnis — Forensic Narrative • page 4 of 14 the applicant alleges the vessel was sold on 1 April 2030.',
  'Just a cover page.'
];
const idx = E.voBuildFactIndex(pages, []);
ok(idx.records.length === 3, 'the index holds one record per record page that states a fact (' + idx.records.length + ')');
ok(idx.records.every(r => r.page && r.quote), 'every record carries a page and a quote');
ok(idx.excluded.some(e => e.page === 4 && e.kind === 'analysis-secondary'), 'the analysis page is listed as excluded, not as a record');
ok(!idx.records.some(r => r.page === 4), 'no analysis-page date or claim enters the record set');
ok(!idx.records.some(r => /2030/.test(r.date || '')), 'the analysis page\'s date never becomes a record fact');

// a page flagged secondary by the engine is excluded even if it reads like a record
const idx2 = E.voBuildFactIndex([
  'Notice of Change of Ownership of a Vessel. Vessel DTD111A. new owner A. Person. Dated 1 May 2024.',
  'Counsel submits the vessel DTD111A was transferred on 2 June 2024.'
], [2]);
ok(idx2.records.length === 1 && idx2.records[0].page === 1 && idx2.excluded.some(e => e.page === 2),
  'a page passed in secondaryPages is excluded from the record set');

console.log('\ndoc-fact-index: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
