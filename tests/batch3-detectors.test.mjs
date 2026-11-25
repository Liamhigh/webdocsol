// Batch 3 — the deterministic shapes from the "High court submission
// Marius" folder schedule (23 Oct 2026):
//  - item 9:  Annexure L dated 13 April 2025 records "Structural Repair
//             Date: 21 April 2025" — a document cannot predate its own
//             contents (D04B).
//  - item 16: the same "Damages October 2026" charge of R199,405.63 cited
//             as INV98185 in FA8 and INV69816 in FA11 (D02B).
//  - items 14-15: an email attaches "POP for refund ... R 2 000 000" while
//             the attachment records an unreleased R1,000,000 capture and
//             states it "IS NOT A PROOF OF PAYMENT" (D02C).
//
// Run: node tests/batch3-detectors.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

const D04B = E.DETECTORS.D04B_DETECT_DOCUMENT_PREDATES_CONTENT;
const D02B = E.DETECTORS.D02B_DETECT_INVOICE_IDENTITY_CONFLICT;
const D02C = E.DETECTORS.D02C_DETECT_PAYMENT_PROOF_MISMATCH;
const D07A = E.DETECTORS.D07A_DETECT_UNEVIDENCED_AUTHORITY;
const D01 = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION;
t.ok(typeof D04B === 'function' && typeof D02B === 'function' && typeof D02C === 'function' && typeof D07A === 'function' && typeof D01 === 'function',
  'batch-3 and repaired statement/authority detectors are registered');

// ---- D04B: document predates its contents ----
const annexL = [
  'GREENSKY FORENSIC REPORT. Report Reference: VO-GS-2025-0413-FOR. Date: 13 April 2025. Prepared by Verum Omnis for the record.',
  'Filler analysis pages. '.repeat(40),
  '13.1 Structural Repair Date: 21 April 2025. The repairs recorded here were verified against the sealing log for the bundle in question.',
];
const out4 = D04B(annexL);
t.ok(out4.some(f => f.type === 'CT04' && f.severity === 5),
  'D04B catches a report predating its own repair date');
t.ok(out4.some(f => f.evidence.includes('13 April 2025') && f.evidence.includes('21 April 2025') && /Page 1 vs Page 3/.test(f.location)),
  'D04B quotes both dates and anchors both pages');
// A report referencing a FUTURE hearing is ordinary — silent.
t.ok(D04B([
  'FORENSIC REPORT. Date: 13 April 2025. Prepared for the record and sealed.',
  'The hearing is set down for 21 May 2025 and the parties will attend on that date as directed by the court.',
]).length === 0, 'D04B silent on ordinary future references (no completion label)');
// A completion date BEFORE the document date is consistent — silent.
t.ok(D04B([
  'FORENSIC REPORT. Date: 13 April 2025. Prepared for the record and sealed.',
  'Completion date: 10 April 2025. The underlying work was done before the report was finalised and sealed.',
]).length === 0, 'D04B silent when the completion date precedes the document date');
// No labelled cover date → no finding (no anchor, no sentence).
t.ok(D04B(['Some document without any date on it at all.', 'Structural Repair Date: 21 April 2025, recorded here.']).length === 0,
  'D04B needs a labelled document date on an early page');

// ---- D02B: one charge, two invoice numbers ----
const invBlocks = [
  'Filler page. '.repeat(40),
  'The respondent issued an invoice styled "Damages October 2026" (invoice INV98185; sealed bundles VO-9AD256186B9F and VO-7E29344E9EDB) for R199,405.63, being the October occupation charge.',
  'Filler page. '.repeat(40),
  'All Fuels tax invoice INV69816, dated 01/10/2026, bills "Damages October 2026" at R173,396.20 plus VAT, being R199,405.63 in total for the same month.',
];
const outB = D02B(invBlocks);
t.ok(outB.some(f => f.type === 'CT02' && f.evidence.includes('INV98185') && f.evidence.includes('INV69816')),
  'D02B catches the same amount under two invoice numbers');
t.ok(outB.some(f => /Page 2 vs Page 4/.test(f.location)), 'D02B anchors both pages');
// Same invoice number restated is corroboration — silent.
t.ok(D02B([
  'Invoice INV69816 for damages of R199,405.63 was rendered on 1 October 2026 as recorded in the bundle here.',
  'The damages invoice INV69816 of R199,405.63 remains unpaid, as the record of the account shows clearly.',
]).length === 0, 'D02B silent when the invoice number agrees');
// Different charges with different numbers are ordinary — silent.
t.ok(D02B([
  'Invoice INV10001 for rental of R50,000.00 was issued in September as the account reflects in the bundle.',
  'Invoice INV10002 for damages of R75,000.00 was issued in October as the account reflects in the bundle.',
]).length === 0, 'D02B silent on different amounts under different numbers');

// ---- D02C: paid vs its own disclaimer ----
const popBlocks = [
  'Filler page. '.repeat(40),
  'Please find attached POP for refund for fuel in the amount of R 2 000 000. Please also be advised that we are holding an amount of R552 365.80 for damages.',
  'THIS IS AN INTERIM AUDIT REPORT INTENDED FOR RECORD KEEPING PURPOSES ONLY AND IS NOT A PROOF OF PAYMENT. Each records a single captured entry of R1,000,000.00 in status "VALIDATED - CHANGE", with no releasing operators and zero RTGS amounts processed.',
];
const outC = D02C(popBlocks);
t.ok(outC.some(f => f.type === 'CT02' && /2 000 000/.test(f.evidence) && /1,000,000/.test(f.evidence)),
  'D02C catches the R2m POP claim against the R1m disclaimed capture');
// A matching amount is consistent — silent.
t.ok(D02C([
  'Please find attached POP for refund for fuel in the amount of R 1 000 000 as agreed between the parties.',
  'INTERIM REPORT. THIS IS NOT A PROOF OF PAYMENT. It records a captured entry of R1,000,000.00 awaiting release by the bank.',
]).length === 0, 'D02C silent when the claimed amount matches the capture');
// A road designation is not a payment amount, and an unrelated amount earlier
// on a compiled page is not the capture qualified by the disclaimer.
t.ok(D02C([
  'Please find attached POP for refund for fuel in the amount of R 2 000 000 as agreed between the parties.',
  'The R61 corridor lost supply. INTERIM REPORT. THIS IS NOT A PROOF OF PAYMENT. No captured entry is reproduced here.',
]).length === 0, 'D02C never reads the R61 road as a disclaimed payment amount');
const unrelated = D02C([
  'Please find attached POP for refund for fuel in the amount of R 2 000 000 as agreed between the parties.',
  'An unrelated historic invoice was R750,000.00. '.repeat(8) + 'INTERIM REPORT. THIS IS NOT A PROOF OF PAYMENT. It records a single captured entry of R1,000,000.00 awaiting release by the bank.',
]);
t.ok(unrelated.length === 1 && /R1,000,000\.00/.test(unrelated[0].evidence) && !/proof itself records R750,000/.test(unrelated[0].evidence),
  'D02C compares against the captured entry, not an unrelated amount elsewhere on the page');

// ---- D07A: the authority instrument must belong to THIS affidavit ----
const authorityBlocks = [
  'ANSWERING AFFIDAVIT. I am the chief executive and am duly authorised to depose to this affidavit on behalf of the respondent. Page 1 of 3',
  'No board resolution has been produced, and no power of attorney is attached to this affidavit. Page 2 of 3',
  'The deponent continues with the factual allegations. Page 3 of 3',
  'ANSWERING AFFIDAVIT. I am duly authorised to depose for the second respondent. Page 1 of 3',
  'The second deponent continues with a separate factual account. Page 2 of 3',
  'I annex the board resolution authorising these proceedings as Annexure A. Page 3 of 3',
];
const authorityOut = D07A(authorityBlocks);
t.ok(authorityOut.length === 1 && authorityOut[0].type === 'CT52' && authorityOut[0].location === 'Page 1' && /same affidavit segment, pages 1-3/.test(authorityOut[0].evidence),
  'D07A neither counts an express absence as an instrument nor lets another affidavit\'s resolution suppress this affidavit\'s gap');
t.ok(D07A([
  'ANSWERING AFFIDAVIT. I am duly authorised to depose for the respondent. Page 1 of 2',
  'A board resolution authorising the deponent is annexed as Annexure A. Page 2 of 2',
]).length === 0, 'D07A stays silent when the same affidavit carries a positive instrument');
t.ok(D07A([
  'Ordinary supply contract. The signatory is authorised to institute changes to delivery dates.',
]).length === 0, 'D07A retains its litigation gate outside affidavits');

// ---- D01: routine service is not a conduct admission ----
t.ok(D01(['ANSWERING AFFIDAVIT. AD PARAGRAPH 18. I admit that annexure “B” was sent to the Controller, in response to the applicant\'s request.']).length === 0,
  'D01 does not seal a routine admission that a quoted annexure label was sent as a contradiction');
t.ok(D01(['I admit that I signed the deed of suretyship and accepted personal liability for the debt.']).some(f => f.type === 'CT01' && f.conductAdmission),
  'D01 preserves a substantive first-person admission of fact');

// Robustness: no throw on edge inputs.
for (const bad of [[], [''], ['   '], ['x'.repeat(100000)]]) {
  t.ok(Array.isArray(D04B(bad)) && Array.isArray(D02B(bad)) && Array.isArray(D02C(bad)) && Array.isArray(D07A(bad)) && Array.isArray(D01(bad)),
    'batch-3 and repaired detectors robust on edge input');
}

t.done('batch3-detectors');
