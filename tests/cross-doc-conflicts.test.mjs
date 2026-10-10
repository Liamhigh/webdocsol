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

// ---- shared negation gate (voNegatedBefore): ONE matcher used by BOTH the CT11
//      authority detector (bundle-19 F1) and the cross-document owner-direction
//      extractor. Tested against both detectors' real text; the two paths are
//      not fixed separately (founder directive, 9 Oct 2026).
{
  const ct11 = 'to show that the respondent’s document, on its face, was never signed by or on behalf of the respondent';
  ok(E.voNegatedBefore(ct11, ct11.indexOf('signed')), 'voNegatedBefore: "was never signed …" is negated (CT11 path)');
  const xdoc = 'the vessel DTD700X was never transferred from T.F. Hardouin to R. Louw';
  ok(E.voNegatedBefore(xdoc, xdoc.indexOf('transferred')), 'voNegatedBefore: "was never transferred from …" is negated (cross-doc path)');
  const notSigned = 'the memorandum was not signed by or on behalf of the firm';
  ok(E.voNegatedBefore(notSigned, notSigned.indexOf('signed')), 'voNegatedBefore: "was not signed …" is negated');
  const pos = 'T.F. Hardouin transferred DTD700X to R. Louw on 1 May 2024';
  ok(!E.voNegatedBefore(pos, pos.indexOf('transferred')), 'voNegatedBefore: a plain positive transfer is NOT negated');
  const noun = 'there is no dispute that T.F. Hardouin transferred DTD700X to R. Louw';
  ok(!E.voNegatedBefore(noun, noun.indexOf('transferred')), 'voNegatedBefore: a distant noun-negation ("no dispute that …") does NOT suppress a real transfer');
}

// ---- a NEGATED transfer is not a transfer: it cannot raise a conflict --------
ok(conflicts([
  'The vessel DTD700X was never transferred from T.F. Hardouin to R. Louw.',
  'Vessel DTD700X. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]).length === 0,
  'a page stating the vessel was NEVER transferred raises no conflict (negation gate, cross-doc path)');

// ---- #5 transfer-local date: the shape is set by the TRANSFER date, not the
//      first date on the page. An unrelated earlier date must not flip A→B.
const td = conflicts([
  'Registered 2 January 2020. Vessel DTD800Y. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Vessel DTD800Y. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]);
ok(td.length === 1 && td[0].type === 'A',
  'an unrelated earlier page date ("Registered 2 January 2020") does not flip a same-day conflict to Type B');
ok(td.length === 1 && / on 21 June 2024\. /.test(td[0].statement) && !/2 January 2020/.test(td[0].statement),
  'the Type A statement uses the transfer date (21 June 2024), never the unrelated page date');

// ---- #1 precision: a shared surname ALONE does not merge two different people -
ok(!E.voSameParty('John Smith', 'Jane Smith'), 'different given names, same surname → NOT the same party (Sourcery #1)');
ok(E.voSameParty('John Smith', 'J. Smith') && E.voSameParty('John Smith', 'John Smith') && E.voSameParty('Smith', 'John Smith'),
  'an initial, an exact first name, or a bare surname still matches (no over-correction)');
const sn = conflicts([
  'Vessel DTD120A. previous owner T.F. Hardouin new owner John Smith. Dated 1 April 2024.',
  'Vessel DTD120A. previous owner T.F. Hardouin new owner Jane Smith. Dated 1 April 2024.'
]);
ok(sn.length === 1 && sn[0].type === 'A',
  'two different new owners who share a surname (John vs Jane Smith) DO raise a conflict — the old shared-surname merge hid it');

// ---- #2 precision: a transfer is bound to ITS vessel, not every vessel on page
ok(conflicts([
  'A fleet notice. T.F. Hardouin sells DTD200A to R. Louw on 1 May 2024. DTD300B remains unsold.',
  'Vessel DTD300B. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 1 June 2024.'
]).length === 0,
  'a transfer of DTD200A on a page that also lists DTD300B is NOT paired against a DTD300B transfer (Sourcery #2)');

// ---- #4 precision: a transfer stated in the title sentence is not stripped away
const t4 = conflicts([
  'Deed: Terry Hardouin sells DTD910Z to Ritzema Louw on 1 March 2024. Registered.',
  'Deed: Terry Hardouin sells DTD910Z to Niven Naidoo on 1 March 2024. Registered.'
]);
ok(t4.length === 1 && t4[0].type === 'A',
  'a transfer in the same sentence as the document title ("Deed: X sells … to Y") is not lost to title-stripping (Sourcery #4)');

// ---- #1 (bare "no"): "no transfer from X to Y" is a non-event, not a claim ----
{
  const noT = 'The register records no transfer from T.F. Hardouin to R. Louw';
  ok(E.voNegatedBefore(noT, noT.indexOf('transfer')), 'voNegatedBefore: "no transfer from …" is negated (Sourcery #1, bare "no")');
  const nd = 'there is no dispute that T.F. Hardouin transferred DTD700X to R. Louw';
  ok(!E.voNegatedBefore(nd, nd.indexOf('transferred')), 'voNegatedBefore: "no dispute that X transferred" is NOT suppressed (no over-correction)');
}
ok(conflicts([
  'The register records no transfer from T.F. Hardouin to R. Louw.',
  'Vessel DTD140A. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 1 April 2024.'
]).length === 0,
  'a page stating "no transfer from X to Y" raises no conflict (negation gate, bare "no")');

// ---- #2 (before-vessel): a multi-vessel page whose transferred vessel is named in
//      the PRECEDING sentence still binds to it — not lost (Sourcery #2) ----------
ok(conflicts([
  'Vessel DTD200A. previous owner T.F. Hardouin new owner R. Louw. DTD300B is also noted. Dated 1 May 2024.',
  'Vessel DTD200A. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 1 June 2024.'
]).length === 1,
  'a transfer whose vessel (DTD200A) sits in the preceding sentence binds to it, not lost (Sourcery #2 before-vessel)');
// a multi-vessel LISTING before the transfer is ambiguous → the transfer is NOT
// bound to either vessel, so it cannot raise a false conflict (the risk that
// motivated dropping the naive backward look — now pinned).
ok(conflicts([
  'Vessels DTD200A and DTD300B. previous owner T.F. Hardouin new owner R. Louw. Dated 1 May 2024.',
  'Vessel DTD300B. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 1 June 2024.'
]).length === 0,
  'a multi-vessel listing before the transfer is ambiguous — not bound to either, no false conflict');

// ---- #6 paired control: the multi-vessel transfer is RETAINED and conflicts with
//      its OWN vessel, while staying isolated from the other listed vessel --------
const mv = conflicts([
  'A fleet notice. T.F. Hardouin sells DTD200A to R. Louw on 1 May 2024. DTD300B remains unsold.',
  'T.F. Hardouin sells DTD200A to Niven Naidoo on 2 May 2024.',
  'Vessel DTD300B. previous owner T.F. Hardouin new owner A. Third. Dated 3 May 2024.'
]);
ok(mv.length === 1 && mv[0].subject === 'DTD200A',
  'the DTD200A transfer on a multi-vessel page is retained and conflicts with the other DTD200A transfer, isolated from DTD300B (Sourcery #6 paired control)');

// ---- #7 quote fidelity: the STORED quote is the EXACT source slice (byte-faithful);
// DISPLAY is derived from it. The record keeps a verbatim substring of the page with
// its original whitespace — not a normalised or window-clipped excerpt — so the page
// says "quoted from the page", never a false "verbatim" (Sourcery #7, #4, #3).
const WS_PAGE1 = 'Notice.\n\n  Vessel DTD130A.  previous owner T.F. Hardouin new owner R. Louw.\n\n  Dated 1 February 2024.';
const wsp = conflicts([
  WS_PAGE1,
  'Notice. Vessel DTD130A. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 1 February 2024.'
]);
ok(wsp.length === 1 && wsp[0].type === 'A', 'a conflict still fires when the source has irregular whitespace');
ok(wsp.length === 1 && wsp[0].a.quoteFull === '  previous owner T.F. Hardouin new owner R. Louw.',
  'quoteFull is the EXACT source slice (byte-faithful: original double-space kept, not normalised, not window-clipped)');
ok(wsp.length === 1 && WS_PAGE1.indexOf(wsp[0].a.quoteFull) !== -1,
  'quoteFull is a verbatim substring of the source page — a true slice, not an altered excerpt (Sourcery #3)');
ok(wsp.length === 1 && wsp[0].a.quote && !/\n|\s{2,}/.test(wsp[0].a.quote) && wsp[0].a.quote !== wsp[0].a.quoteFull,
  'quote (display) is whitespace-collapsed and differs from the stored slice — so it is never called "verbatim"');

console.log('\ncross-doc-conflicts: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
