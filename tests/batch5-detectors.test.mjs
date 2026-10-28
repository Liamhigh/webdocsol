// Batch 5 — the deterministic shapes from the defamation record
// (case 2026-179949, Drive sweep 28 Oct 2026), each validated against the
// real sealed text:
//  - billing after claimed end: lease pleaded terminated 31 July 2026 vs
//    INV98185 "Damages October 2026" (D02D).
//  - relabelling pair: INV68876 "Rental August 2026" R199,405.63 vs
//    INV68913 "Damages August 2026" R199,405.63 (D01D).
//  - unevidenced authority: "I am duly authorised to depose" with no
//    resolution cited or annexed anywhere in the filing (D07A).
//  - blank execution blocks: tripartite agreement, all three
//    "SIGNED at ___" blocks blank, R1.5m paid under it (D07B).
//  - unreadable pages: image-only runs inside a text-bearing bundle (D08A).
//  - coordinated near-duplicates: two firms' letters of 7 and 9 July 2026,
//    word-for-word identical bar letterhead and signature (D09A).
//
// Run: node tests/batch5-detectors.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

const D02D = E.DETECTORS.D02D_DETECT_BILLING_AFTER_CLAIMED_END;
const D01D = E.DETECTORS.D01D_DETECT_RELABELLING_PAIR;
const D07A = E.DETECTORS.D07A_DETECT_UNEVIDENCED_AUTHORITY;
const D07B = E.DETECTORS.D07B_DETECT_BLANK_SIGNATURE_BLOCKS;
const D08A = E.DETECTORS.D08A_DETECT_SCAN_ONLY_PAGE;
const D09A = E.DETECTORS.D09A_DETECT_COORDINATION_NEAR_DUP;
t.ok([D02D, D01D, D07A, D07B, D08A, D09A].every(f => typeof f === 'function'),
  'batch-5 detectors are registered');

// ---- D02D: billing after claimed end ----
const ended = [
  'The lease agreement between the parties terminated on 31 July 2026 by effluxion of time, as pleaded in the particulars.',
  'Filler page of record text. '.repeat(40),
  'Invoice INV98185: Damages October 2026 — R1,133,618.40. Payment due within 7 days of presentation.',
];
const outEnd = D02D(ended);
t.ok(outEnd.length === 1 && outEnd[0].type === 'CT51' && outEnd[0].severity === 4,
  'D02D fires once on a charge for a period after the claimed end');
t.ok(/Page 1 vs Page 3/.test(outEnd[0].location), 'D02D anchors the end claim vs the later charge');
// A charge for a period BEFORE the end is ordinary billing — silent.
t.ok(D02D([
  'The lease agreement terminated on 31 July 2026.',
  'Filler page of record text. '.repeat(40),
  'Invoice INV68800: Rental June 2026 — R199,405.63.',
]).length === 0, 'D02D silent when the charge period precedes the end');
// A full date after "interest from" is not a billing period — silent.
t.ok(D02D([
  'The lease agreement terminated on 31 July 2026.',
  'Filler page of record text. '.repeat(40),
  'Interest shall run from 7 October 2026 at the mora rate on the outstanding balance.',
]).length === 0, 'D02D silent on mora-interest dates (not a period charge)');
// No end claim at all — silent.
t.ok(D02D(['Invoice INV98185: Damages October 2026 — R1,133,618.40.']).length === 0,
  'D02D silent without an end claim');

// ---- D01D: relabelling pair ----
const relabel = [
  'INV68876 — Rental August 2026: R199,405.63 payable to the landlord for the service station premises.',
  'Filler page of record text. '.repeat(40),
  'INV68913 — Damages August 2026: R199,405.63 for occupation of the same premises.',
];
const outRL = D01D(relabel);
t.ok(outRL.length === 1 && outRL[0].type === 'CT01' && outRL[0].severity === 4,
  'D01D fires once when one amount for one period carries two labels');
t.ok(outRL[0].evidence.includes('rent') && outRL[0].evidence.includes('damages'),
  'D01D quotes both labels');
// Same label twice is consistent billing — silent.
t.ok(D01D([
  'INV68876 — Rental August 2026: R199,405.63.',
  'Statement summary: rental for August 2026 remained R199,405.63.',
]).length === 0, 'D01D silent when the label is consistent');
// Different amounts are two charges, not one relabelled — silent.
t.ok(D01D([
  'INV68876 — Rental August 2026: R199,405.63.',
  'INV68913 — Damages August 2026: R150,000.00 for separate repairs.',
]).length === 0, 'D01D silent when the amounts differ');

// ---- D07A: unevidenced authority ----
const affid = [
  'ANSWERING AFFIDAVIT. I, the deponent, state under oath: I am duly authorised to depose to this affidavit on behalf of the respondents.',
  'Filler affidavit text without any instrument. '.repeat(60),
];
const outUA = D07A(affid);
t.ok(outUA.length === 1 && outUA[0].type === 'CT52' && outUA[0].severity === 3,
  'D07A fires once when authority is claimed with no instrument in the record');
// A resolution cited or annexed answers the gap — silent.
t.ok(D07A([
  'ANSWERING AFFIDAVIT. I am duly authorised to depose to this affidavit; a board resolution is annexed marked "A".',
  'Filler affidavit text. '.repeat(40),
]).length === 0, 'D07A silent when a resolution is annexed');
// No affidavit context (ordinary contract) — silent.
t.ok(D07A(['The parties warrant each is duly authorised to sign this supply agreement.']).length === 0,
  'D07A silent outside affidavit/litigation context');
// No claim at all — silent.
t.ok(D07A(['FOUNDING AFFIDAVIT. The deponent sets out the facts below. ' + 'Filler. '.repeat(40)]).length === 0,
  'D07A silent when no authority is claimed');

// ---- D07B: blank execution blocks ----
const blank = [
  'TRIPARTITE AGREEMENT. The parties record the terms below. SIGNED at _________ on this ___ day of __________ 2019.',
  'The plaintiff paid R1,500,000 in terms of the agreement, and the parties acted under the agreement throughout. '.repeat(2),
];
const outBL = D07B(blank);
t.ok(outBL.length === 1 && outBL[0].type === 'CT53' && outBL[0].severity === 3,
  'D07B fires on a blank execution block on an instrument the record treats as operative');
t.ok(/Page 1/.test(outBL[0].location), 'D07B anchors the blank-block page');
// A blank template the record never treats as operative — silent.
t.ok(D07B(['SPECIMEN FORM. SIGNED at _________ on this ___ day of __________. This agreement is a blank precedent.']).length === 0,
  'D07B silent on a blank block with no operative treatment');
// An executed block — silent.
t.ok(D07B([
  'AGREEMENT. SIGNED at Gqeberha on this 11th day of December 2018.',
  'The parties acted in terms of the agreement throughout. '.repeat(2),
]).length === 0, 'D07B silent on an executed block');

// ---- D08A: unreadable pages ----
const bundle = [];
for (let i = 0; i < 3; i++) bundle.push('Substantial page of pleading text with real content. '.repeat(40));
bundle.push('', '   ', '');
for (let i = 0; i < 3; i++) bundle.push('More substantial text of the record continues here. '.repeat(40));
const outScan = D08A(bundle);
t.ok(outScan.length === 1 && outScan[0].type === 'CT54' && outScan[0].severity === 2,
  'D08A fires once per contiguous unreadable run');
t.ok(outScan[0].location === 'Pages 4–6', 'D08A reports the run as a page range');
// Fully text-bearing bundle — silent.
const fullText = [];
for (let i = 0; i < 8; i++) fullText.push('Text-bearing page of the record. '.repeat(40));
t.ok(D08A(fullText).length === 0, 'D08A silent when every page is text-bearing');
// Whole-document image scan — one finding, entire document.
const allScan = ['', '', '', ''];
t.ok(D08A(allScan).length === 1 && D08A(allScan)[0].location === 'Entire document',
  'D08A reports a wholly unreadable document once');
// Short documents: thin pages are not anomalous — silent.
t.ok(D08A(['short', '', 'brief note']).length === 0,
  'D08A silent on short documents');

// ---- D09A: coordinated near-duplicates ----
const letterBody = 'We refer to the above matter and to your recent correspondence. Our client instructs that the application was duly processed by the office and that any suggestion to the contrary is denied. We are instructed to demand that you withdraw the allegations within twenty one days failing which our client will approach the court for relief including an order declaring you a vexatious litigant and seeking punitive costs on the attorney and client scale together with interest and such further relief as the court deems meet and appropriate in the circumstances of this disputed matter.';
const letterA = 'DENYS ATTORNEYS. 7 July 2026. ' + letterBody + ' Yours faithfully, DENYS INC, per: Jan Deneys.';
const letterB = 'FAKROODEEN & ASSOCIATES. 9 July 2026. ' + letterBody + ' Yours sincerely, FAKROODEEN INC, per: Ashraf Fakroodeen.';
const outDup = D09A([letterA, 'Filler page of unrelated record text. '.repeat(30), letterB]);
t.ok(outDup.length === 1 && outDup[0].type === 'CT55' && outDup[0].severity === 3,
  'D09A fires once on near-identical texts under different closing blocks');
t.ok(/Page 1 vs Page 3/.test(outDup[0].location), 'D09A anchors both pages');
t.ok(/not a determination of collusion/i.test(outDup[0].evidence),
  'D09A is worded as an indicator, never a determination');
// The same letter scanned twice (identical closing) — silent.
t.ok(D09A([letterA, 'Filler page. '.repeat(30), letterA]).length === 0,
  'D09A silent on identical duplicates');
// Two genuinely different letters — silent.
t.ok(D09A([letterA, 'An entirely different passage about invoices, banking, transfers and amounts paid in March. '.repeat(8)]).length === 0,
  'D09A silent on distinct texts');

// Robustness: no throw on edge inputs.
for (const bad of [[], [''], ['   '], ['x'.repeat(100000)], null]) {
  t.ok([D02D, D01D, D07A, D07B, D08A, D09A].every(f => Array.isArray(f(bad))),
    'batch-5 detectors robust on edge input');
}

t.done('batch5-detectors');
