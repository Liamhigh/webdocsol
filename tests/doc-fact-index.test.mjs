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
const vals = (a) => a.map(x => x.value);
const f = E.voExtractPageFacts('Notice of Change of Ownership of a Vessel. Vessel DTD 782 C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.');
ok(vals(f.vessels)[0] === 'DTD782C', 'the vessel registration is normalised (spaces removed)');
ok(f.ownerFrom === 'T.F. Hardouin' && /^R\. Louw/.test(f.ownerTo) && !/Dated/.test(f.ownerTo), 'the owner direction is read and the party is not polluted by trailing words');
ok(f.date === '21 June 2024', 'the instrument date is read');
ok(f.vessels[0].quote && /DTD 782 C/.test(f.vessels[0].quote) && f.ownerQuote && /previous owner T\.F\. Hardouin new owner R\. Louw/.test(f.ownerQuote), 'every value carries its own verbatim quote');

const g = E.voExtractPageFacts('Deed of sale. The seller hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.');
ok(vals(g.vessels)[0] === 'DTD782C' && vals(g.amounts)[0] === 'R300,000' && g.date === '13 September 2024', 'the sale page yields vessel, amount and date');

const h = E.voExtractPageFacts('Commercial Traditional Linefish Right LF210223 for the holder.');
ok(vals(h.rights)[0] === 'LF210223' && h.vessels.length === 0, 'a fishing right is captured as a right, not a vessel');

// a two-digit-year date is not taken as the instrument date (century unknown)
const amb = E.voExtractPageFacts('Signed on 15/11/98 by the parties, vessel DTD900A.');
ok(amb.date === null && vals(amb.vessels)[0] === 'DTD900A', 'a two-digit-year date is not recorded as the instrument date');

// Sourcery #223: an owner name with lowercase particles is kept whole.
const vdm = E.voExtractPageFacts('previous owner Pieter van der Merwe new owner Johan de la Rey. Dated 1 May 2024.');
ok(vdm.ownerFrom === 'Pieter van der Merwe' && vdm.ownerTo === 'Johan de la Rey', 'owner names keep lowercase particles ("van der", "de la")');

// Sourcery #223: a company owner with a (Pty) Ltd suffix is kept whole.
const co = E.voExtractPageFacts('transferred from Harbor Marine (Pty) Ltd to Coastal Fishing CC on 2 June 2024.');
ok(co.ownerFrom === 'Harbor Marine (Pty) Ltd' && co.ownerTo === 'Coastal Fishing CC', 'company owners keep their legal suffix ((Pty) Ltd, CC)');

// Sourcery #223: all matches of a repeatable field are kept (a swap names two vessels).
const sw = E.voExtractPageFacts('By swap the parties exchanged DTD782C and DTD900B, no money changing hands.');
ok(vals(sw.vessels).length === 2 && vals(sw.vessels).indexOf('DTD782C') !== -1 && vals(sw.vessels).indexOf('DTD900B') !== -1, 'a page naming two vessels keeps both, not only the first');

// Sourcery #223: a record with ONLY an amount still carries a quote for it.
const amtOnly = E.voExtractPageFacts('Payment of R25,000 was received under the arrangement.');
const amtRows = E.voFactRows(amtOnly);
ok(amtRows.length === 1 && amtRows[0].label === 'amount' && amtRows[0].value === 'R25,000' && /R25,000/.test(amtRows[0].quote || ''), 'a record stating only an amount still has a quote anchored to that amount');

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
ok(idx.records.every(r => r.page && r.facts && r.facts.length && r.facts.every(x => x.quote)), 'every record carries a page and every stated fact has its own quote');
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
