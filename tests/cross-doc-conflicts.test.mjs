/**
 * Cross-document conflict detection (stage B; HELD for founder wording sign-off).
 *
 * The conflict SHAPE is classified before any sentence is written: two pages
 * merely naming the same vessel is not a conflict. A conflict needs the SAME
 * previous owner (transferor) transferring the vessel to two DIFFERENT people —
 *   type A (same date):  two transfers on one day; both cannot be the sole one.
 *   type B (diff dates):  successive transfers the record does not reconcile.
 * It is a detector, not a judge: no offence, no owner determination, no verdict,
 * fixed wording per type, pinned by a forbidden-words guard. The guard is a
 * LABELLED CHANNEL: it filters the engine's GENERATED STATEMENT only, never the
 * verbatim QUOTES — a quote is evidence and the engine never edits the record,
 * so a quote may legitimately contain a word ("title", "valid", "void") that the
 * guard would block in engine prose. Only record pages are compared — an
 * analysis/secondary page can never raise or join a conflict.
 *
 * Synthetic pages in the Louw v Naidoo shape; no real-matter document committed.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const conflicts = (pages, sec) => E.voCrossDocConflicts(E.voBuildFactIndex(pages, sec || []));

console.log('======================================================');
console.log('RUN  cross-doc-conflicts.test.mjs');
console.log('======================================================\n');

// ---- type A: same transferor, same date, different new owners --------------
const A = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD 782 C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]);
ok(A.length === 1 && A[0].type === 'A', 'two notices, same transferor, same date, different new owners → one type-A conflict');
ok(A.length === 1 && A[0].statement === 'Page 1 states T.F. Hardouin transferred DTD782C to R. Louw on 21 June 2024. Page 2 states T.F. Hardouin transferred the same vessel to Niven Naidoo on the same date, 21 June 2024. The record states two transfers of the same vessel by the same previous owner on the same day to two different people; both cannot be the sole transfer.',
  'type-A wording is exactly the approved form (both new owners named inline, symmetric with type B)');
ok(A.length === 1 && /previous owner T\.F\. Hardouin new owner R\. Louw/.test(A[0].a.quote || '') && /new owner Niven Naidoo/.test(A[0].b.quote || ''),
  'type A quotes both pages verbatim');

// ---- type B: same transferor, different dates (chain-of-title gap) ----------
const B = conflicts([
  'T.F. Hardouin transferred DTD782C to Ritzema Louw by swap on 15 July 2024.',
  'Deed of sale. T.F. Hardouin hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.'
]);
ok(B.length === 1 && B[0].type === 'B', 'a swap then a sale of one vessel by the same previous owner → one type-B conflict');
ok(B.length === 1 && B[0].statement === 'Page 1 states T.F. Hardouin transferred DTD782C to Ritzema Louw on 15 July 2024. Page 2 states T.F. Hardouin transferred the same vessel to Niven Naidoo on 13 September 2024. The record states two transfers of the same vessel by the same previous owner to two different people, and does not explain how the previous owner retained the vessel to make the second transfer after the first.',
  'type-B wording is exactly the approved chain-of-title form (no exclusivity over-claim)');

// ---- successive owners alone are NOT a conflict (different transferors) -----
ok(conflicts([
  'A. Seller transferred DTD500A to First Buyer on 1 January 2024.',
  'First Buyer transferred DTD500A to Second Buyer on 1 June 2024.'
]).length === 0,
  'a legitimate chain (A→B then B→C) raises no conflict — the transferors differ');

// ---- name normalisation: variants of one party are not a conflict ----------
ok(['R. Louw', 'Ritz Louw', 'Ritzema Louw', 'Mr. R. Louw', 'Ritzema Louw REQUEST'].every(v => E.voSameParty(v, 'Ritzema Louw')),
  'all Louw variants (incl. the "REQUEST" mis-parse) are one party');
ok(['T.F. Hardouin', 'Terry Hardouin', 'Terry H Hardouin', 'T. Hardouin'].every(v => E.voSameParty(v, 'T.F. Hardouin')),
  'all Hardouin variants are one party');
ok(conflicts([
  'previous owner T.F. Hardouin new owner Ritzema Louw. Vessel DTD900A. Dated 1 May 2024.',
  'Terry Hardouin transferred DTD900A to Ritzema Louw REQUEST on 2 June 2024.'
]).length === 0,
  'same transferor and same new owner across variants → no false conflict');

// ---- vessel identity: whitespace/case variants are the same vessel ---------
const vv = conflicts([
  'previous owner T.F. Hardouin new owner R. Louw. Vessel DTD 782 C. Dated 1 May 2024.',
  'previous owner T.F. Hardouin new owner Niven Naidoo. Vessel DTD782 C. Dated 1 May 2024.'
]);
ok(vv.length === 1 && vv[0].subject === 'DTD782C', 'DTD 782 C and DTD782 C are matched as the same vessel');

// ---- an analysis/secondary page can NEVER raise or join a conflict ---------
ok(conflicts([
  'previous owner T.F. Hardouin new owner A. Person. Vessel DTD111A. Dated 1 May 2024.',
  'Verum Omnis — Forensic Narrative • page 3 of 14 the applicant alleges T.F. Hardouin transferred DTD111A to B. Other.'
]).length === 0, 'a record page and a Verum Omnis analysis page do not raise a conflict');
ok(conflicts([
  'previous owner T.F. Hardouin new owner A. Person. Vessel DTD222B. Dated 1 May 2024.',
  'Counsel submits T.F. Hardouin transferred DTD222B to B. Other on 2 June 2024.'
], [2]).length === 0, 'a page flagged secondary cannot join a conflict');

// ---- the wording is neutral: no offence, no verdict, no conclusion ---------
const FORBIDDEN = /\b(fraud|fraudulent|forgery|forged|illegal|unlawful|the (?:true|rightful) owner|therefore|consequently|which (?:proves|shows)|guilty|crime|criminal|liable|wrongdoing|valid|invalid|void|title)\b/i;
const mixed = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.',
  'Deed of sale. T.F. Hardouin hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.'
]);
ok(mixed.length >= 1 && mixed.every(c => !FORBIDDEN.test(c.statement)),
  'no conflict statement contains an offence word, a verdict, or a legal conclusion (incl. therefore/valid/void/title)');

// ---- labelled channel (1/2): a verbatim QUOTE containing a forbidden word is
//      emitted INTACT. The guard never runs over quotes — they are evidence, and
//      editing a quote would corrupt the record (founder condition, 9 Oct 2026).
const qt = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD640D. previous owner T.F. Hardouin new owner R. Louw, holder of valid title. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD640D. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]);
ok(qt.length === 1 && qt[0].type === 'A', 'a conflict still fires when a quote contains the forbidden word "valid"/"title"');
ok(qt.length === 1 && /valid title/i.test(qt[0].a.quote || ''),
  'the verbatim quote keeps "valid title" intact — a quote is never run through the forbidden-words filter');
ok(qt.length === 1 && !FORBIDDEN.test(qt[0].statement),
  'the engine-generated statement for that same conflict carries no forbidden word');

// ---- labelled channel (2/2): the guard DOES block the engine's own prose. If a
//      generated statement would carry a forbidden word (here via a new-owner
//      name), the whole conflict is suppressed rather than emitted.
ok(conflicts([
  'Vessel DTD660F. previous owner T.F. Hardouin new owner Void Holdings. Dated 21 June 2024.',
  'Vessel DTD660F. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]).length === 0,
  'a conflict whose generated statement would contain a forbidden word ("Void") is suppressed');
// control: the identical shape with a clean new-owner name DOES fire, so the
// suppression above is the forbidden word and nothing else about the fixture.
ok(conflicts([
  'Vessel DTD660F. previous owner T.F. Hardouin new owner Grace Holdings. Dated 21 June 2024.',
  'Vessel DTD660F. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]).length === 1,
  'the identical shape with a clean new-owner name fires — the only difference is the forbidden word');

console.log('\ncross-doc-conflicts: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
