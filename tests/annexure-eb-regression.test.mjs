/**
 * annexure EB regression guard (11 September 2026).
 *
 * The 528-page "annexure EB" bundle was sealed with a forensic report on the
 * address that had no API, and an outside review of the sealed output found
 * the engine's precision wanting: 26 findings, of which the registration,
 * identity, signature, term-definition, bank-detail and two of three direct
 * contradiction rows were artefacts of extraction, OCR or context-blind
 * rules — and the report's own quote of the record's first page read
 * "Confirmed Losses R2313 Million" where the record says "R231.3 Million".
 *
 * Every case below is built from the sealed findings JSON of that run: the
 * false finding must stay silent, and beside it a genuine case of the same
 * type must still fire. This suite pins the fix; the AllFuels and Greensky
 * suites pin that nothing already caught was lost.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');
const DET = E.DETECTORS;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const of = (fn, blocks, type) => (fn(blocks) || []).filter(f => f.type === type);

console.log('======================================================');
console.log('RUN  annexure-eb-regression.test.mjs');
console.log('======================================================\n');

// ===== 1. Extraction keeps the record's own characters =====================
// A PDF that draws each glyph with its own operator used to lose every
// punctuation-only token before the letters were re-joined.
const extract = (strs) => { const t = []; for (const s of strs) E._voGlyphTokens(s, t); return E._voMergeGlyphRuns(t).join(' '); };
ok(extract(['R', '2', '3', '1', '.', '3', ' ', 'M', 'i', 'l', 'l', 'i', 'o', 'n']) === 'R231.3 Million',
  'per-glyph "R231.3 Million" keeps its decimal point (was sealed as "R2313 Million")');
ok(extract(['Bright', ' ', 'Idea', ' ', 'Projects', ' ', '6', '6', ' ', '(', 'P', 't', 'y', ')', ' ', 'Ltd', ' ', 't', '/', 'a', ' ', 'AllFuels']) === 'Bright Idea Projects 66 (Pty) Ltd t/a AllFuels',
  'brackets and the slash in "(Pty) Ltd t/a" survive (were "Pty Ltd ta")');
ok(extract(['Reg', ' ', 'No', '.', ' ', '2', '0', '1', '2', '/', '1', '2', '2', '6', '3', '6', '/', '0', '7']) === 'Reg No. 2012/122636/07',
  'a per-glyph registration number keeps its slashes (was reported as a 13-digit fake)');
ok(extract(['R231', '.', '3', ' ', 'Million']) === 'R231.3 Million', 'a punctuation glyph after a word attaches and the word continues');
ok(extract(['(', 'Pty', ')', ' ', 'Ltd']) === '(Pty) Ltd', 'a glyph run ending in punctuation attaches to the word drawn after it');
ok(extract(['N', 'F', 'O', ' ', 'Ltd']) === 'NFO Ltd', 'letter-spaced runs still merge ("N F O" -> "NFO")');
ok(extract(['a', 'lease', 'agreement', '.', 'The']) === 'a lease agreement. The', 'a single-letter word beside a kerned word keeps its space');
ok(extract(['V', ' ', 'alue']) === 'V alue', 'a real space in the stream is never closed up (the "V alue" fragment stays a fragment)');

// ===== 2. CT01 — a shared word is not a shared proposition ==================
const ct01 = (blocks) => of(DET.D01_DETECT_DIRECT_CONTRADICTION, blocks, 'CT01');
ok(ct01(['the lessor may, at its election to claim immediate payment in terms of this sub-clause, claim the balance; the lessor may without notice claim immediate payment of all amounts whether due for payment or not.']).length === 0,
  'CT01 silent: "without notice claim immediate payment" is not a negation of "payment" (finding F001)');
ok(ct01(['the lessor shall, without prejudice to any other rights under this agreement, be entitled to effect any necessary repairs and the lessee acknowledges that it shall not be entitled to any compensation or repayment of any kind.']).length === 0,
  'CT01 silent: "entitled to effect repairs" vs "not entitled to any compensation" are different objects (F003)');
ok(ct01(['november 2018 mou clause 7 yes he signed signed under pressure allfuels never countersigned; goodwill taken without any signed waiver wayne nel no his mou contained the clause.']).length === 0,
  'CT01 silent: "he signed" vs "without any signed waiver" are different objects (F002)');
ok(ct01(['The payment was made in full on 3 May. He later stated no payment was ever made.']).length === 1,
  'CT01 still fires: "payment was made" vs "no payment was ever made"');
ok(ct01(['The MOU was signed by both parties on 12 December. The franchisor now says the MOU was never signed.']).length === 1,
  'CT01 still fires: "the MOU was signed" vs "the MOU was never signed"');
ok(ct01(['the resolution was approved by the board on 3 May. the directors later denied that the resolution was approved.']).length === 1,
  'CT01 still fires through "denied that the resolution was approved" (one subject word between negator and claim)');

// ===== 3. CT09 — rentals are not identities ==================================
const ct09 = (blocks) => of(DET.D06_DETECT_IDENTITY_CONFLICT, blocks, 'CT09');
ok(ct09(['Rental for year 1: R103509 per month; year 2: R129749; year 3: R2489726 in total; year 4: R2653184 in total.']).length === 0,
  'CT09 silent: Rand amounts are money, not identity-shaped numbers (F004)');
ok(ct09(['Client reference 33503223243 0 on the statement.']).length === 0,
  'CT09 silent: a 12-digit reference is not a 13-digit identity number (F004)');
ok(ct09(['Ref AB1234567 noted on the invoice.', 'Ref CD7654321 on the credit note.']).length === 0,
  'CT09 silent: lettered codes without an ID/passport label are references');
ok(ct09(['Applicant ID 8001015009087 on the form.', 'Identity number 7502204567089 given by the same applicant on the affidavit.']).length === 1,
  'CT09 still fires: two different 13-digit identity numbers led by plausible dates of birth');
ok(ct09(['Holder ID AB1234567 noted.', 'Other passport CD7654321 recorded.']).length === 1,
  'CT09 still fires: two labelled lettered identity codes');

// ===== 4. CT20 — valid formats, VAT numbers and OCR debris ===================
const ct20 = (blocks) => of(DET.D11_DETECT_REGISTRATION_FAKE, blocks, 'CT20');
ok(ct20(['LESSOR: PALMBILI PROPERTY INVESTMENTS (PTY) LTD REGISTRATION NUMBER: 2013/199336/07 VAT REGISTRATION NUMBER: 4020270288 2. THE LESSEE: RONNIE MOIR TRAVEL CC REGISTRATION NUMBER: 1998/023813/24']).length === 0,
  'CT20 silent: "VAT REGISTRATION NUMBER: 4020270288" is a VAT number (F006)');
ok(ct20(['RONNIE MOIR TRAVEL CC (Registration NO. CK2000/071982/23) t/a Port Edward Garage']).length === 0,
  'CT20 silent: CK2000/071982/23 is a valid close-corporation registration (F009)');
{
  const f = ct20(['Registration number of complainant 510209 5091 08 (a natural person) under the Consumer Protection Act.']);
  ok(f.length === 1 && f[0].severity === 2 && /identity number/.test(f[0].evidence),
    'CT20 demotes an identity-number-shaped value under a registration label to a Low check (F005)');
}
{
  const f = ct20(['Registration Number 1911/0001154/07 (Transferor), a company duly incorporated']);
  ok(f.length === 1 && f[0].severity === 2 && /one digit off/.test(f[0].evidence),
    'CT20 reports a middle group of seven digits as a Low "one digit off" check, not a fake (F007)');
}
ok(ct20(['Reg No. 2012/22¢ pu pees = CHL ein sr']).length === 0,
  'CT20 silent on OCR debris around the cue (F008)');
ok(ct20(['The entity gives its registration number 33348381876106 in the letter.']).length === 1,
  'CT20 still fires on a labelled number in no known format');
{
  const f = ct20(['GREENSKY ORNAMENTALS FZ-LLC, Ras Al Khaimah Economic Zone (RAKEZ). REGISTRATION NO.: 4490279355 COMPANY REGISTRATION CERTIFICATE']);
  ok(f.length === 1 && f[0].severity === 2, 'CT20 still notes a foreign-registry number at Low (a 10-digit number is not a VAT number unless VAT is named)');
}

// ===== 5. CT23 — boilerplate execution language ===============================
const ct23 = (blocks) => of(DET.D32_DETECT_SIGNATURE_ANOMALY, blocks, 'CT23');
ok(ct23(['1.59 "New to All Fue/s/Caltex" means an All Fuels/Caltex site opened after the Commencement Date.']).length === 0,
  'CT23 silent: "/s/" inside "Fue/s/Caltex" is not a conformed signature (F021)');
ok(ct23(['Any variation must be recorded in writing and signed on behalf of both the Creditor and the Debtor.']).length === 0,
  'CT23 silent: "signed on behalf of" is ordinary execution language (F022)');
{
  const f = ct23(['Executed by conformed signature: /s/ John Smith, Director']);
  ok(f.length === 1 && /\/s\//.test(f[0].evidence), 'CT23 still fires on a standalone conformed "/s/" mark');
}
ok(ct23(['The lease was signed per pro by the agent.']).length === 1, 'CT23 still fires on "signed per pro"');

// ===== 6. CT33 — a year is not a section ====================================
const ct33 = (blocks) => of(DET.D22_DETECT_INVALID_LEGAL_REF, blocks, 'CT33');
ok(ct33(['Section 1987 of lilinois provides that it shall Sn be a violation of the Act to terminate a franchise.']).length === 0,
  'CT33 silent: "Section 1987 of Illinois" is the Franchise Disclosure Act of 1987 (F013)');
ok(ct33(['Section 999 of the Companies Act applies.']).length === 1, 'CT33 still fires on an implausible section number');

// ===== 7. CT08 — definitions within one document, never OCR debris ===========
const ct08 = (blocks) => of(DET.D30_DETECT_TERM_DEFINITION_CONFLICT, blocks, 'CT08');
ok(ct08(['Notice may be given by other means (including telefacsimile) for the purposes of this clause.',
         'Service may be effected by other means of communication as the parties agree.']).length === 0,
  'CT08 silent: "by other means" is the noun "means", not a definition of "other" (F020)');
ok(ct08(['"Rental" means the rental payable by the Franchisee pursuant to the Lease.',
         '"Rental" means ¢ pu pees = CHL ein sr the rental'], 'CT08').length === 0,
  'CT08 silent when either definition is OCR debris');
{
  // Two documents (their own "Page N of M" numbering), each defining "Business".
  const docA = ['Page 1 of 3. "Business" means the price a willing independent purchaser would pay for the franchise.', 'Page 2 of 3. text', 'Page 3 of 3. text'];
  const docB = ['Page 1 of 3. "Business" means the retail fuel operation conducted from the premises by the operator.', 'Page 2 of 3. text', 'Page 3 of 3. text'];
  ok(ct08(docA.concat(docB)).length === 0, 'CT08 silent across two documents that define one term differently (F019)');
  const oneDoc = ['Page 1 of 6. "Business" means the price a willing independent purchaser would pay for the franchise.', 'Page 2 of 6. text', 'Page 3 of 6. text',
                  'Page 4 of 6. "Business" means the retail fuel operation conducted from the premises by the operator.', 'Page 5 of 6. text', 'Page 6 of 6. text'];
  ok(ct08(oneDoc).length === 1, 'CT08 still fires when ONE document defines the same term two ways');
}
ok(ct08(['the agreement means the entire contract between them.', 'later: the agreement means only the schedule.']).length === 0,
  'CT08 silent on an uncapitalised word: a defined term is Capitalised where it is defined');

// ===== 8. CT18 — whose account? ==============================================
const ct18 = (blocks) => of(DET.D12_DETECT_BANK_DETAIL_MISMATCH, blocks, 'CT18');
ok(ct18(['Bright Idea Projects (Pty) Ltd banking details: Standard Bank account 251068749.',
         'Palmbili Property Investments (Pty) Ltd banking details: account 333201728 for the rental.',
         'Gary Highcock personal FNB account 62068673493 for the refund.']).length === 0,
  'CT18 silent: three parties, three accounts, no mismatch (F011)');
{
  const f = ct18(['Palmbili Property Investments (Pty) Ltd: pay rental to account 1111111111.',
                  'Palmbili Property Investments (Pty) Ltd: pay rental to account 2222222222.']);
  ok(f.length === 1 && /same party/.test(f[0].evidence) && /Palmbili/.test(f[0].evidence),
    'CT18 still fires when the SAME party is given two accounts, and names the party');
}
ok(ct18(['Bank account 62834571902 for payment', 'Please use account no 40190283746 instead']).length === 1,
  'CT18 still fires on a changed-payment-details instruction with no holder named');

// ===== 9. OCR-debris gate ====================================================
ok(E.voLooksGarbled('Reg No. 2012/22¢ pu pees = CHL ein sr') === true, 'voLooksGarbled: symbol debris');
ok(E.voLooksGarbled('the rental, if any, payable by the Franchisee') === false, 'voLooksGarbled: clean legal prose is clean');
ok(E.voLooksGarbled('petrol, diesel, liquefied petroleum gas and any other products') === false, 'voLooksGarbled: technical vocabulary is not debris');

// ===== 10. OCR provenance has a consequence ==================================
{
  const fs = [
    { type: 'CT20', severity: 4, location: 'Page 227', evidence: 'labelled registration in no known format' },
    { type: 'CT20', severity: 4, location: 'Page 360, 370', evidence: 'partly native' },
    { type: 'CT45', severity: 5, location: 'Page 227', evidence: 'goodwill recognised then denied' }
  ];
  const r = E.voCapOcrFormatFindings(fs, [227, 360]);
  ok(r.capped === 1 && fs[0].severity === 2 && fs[0].ocrCapped === true && /verified against the page image/.test(fs[0].evidence),
    'a format check anchored only to OCR pages is held at Low with the reason on the finding');
  ok(fs[1].severity === 4, 'a format check with one native page keeps its severity');
  ok(fs[2].severity === 5, 'a substantive contradiction (CT45) on an OCR page keeps its severity: only character-sensitive checks are capped');
  ok(E.voCapOcrFormatFindings(fs, []).capped === 0, 'nothing is capped when no page came through OCR');
}

// ===== 11. A seal footer is not evidence =====================================
ok(E.voIsFooterOnlyPage('[OCR] VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | a59c667afdceee61…6a7e85b4 | 316/528 2026-09-11 13:30:56 UTC | verumglobal.foundation | OpenTimestamps | Patent Pending Clean Bundle Page 316 of 528') === true,
  'a page carrying only seal footers is footer-only');
ok(E.voIsFooterOnlyPage('the lessor may without notice claim immediate payment of all amounts. VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 316/528') === false,
  'a page with lease text under its footer is evidence');
ok(E.voIsFooterOnlyPage('Signed at Durban on 12 December 2018. VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 83/528') === false,
  'a short signature line is evidence (never excluded as a footer)');
{
  const blocks = ['Clause 1. The parties agree.', 'VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 2/3', 'Clause 2. The rental is payable monthly.'];
  const r = E.voExcludeFooterOnlyPages(blocks);
  ok(r.pages.length === 1 && r.pages[0] === 2 && /no evidential text/.test(blocks[1]) && /Seal-footer pages: 1 page/.test(r.note),
    'footer-only pages are replaced by a placeholder and named in the extraction note');
}

// ===== 12. The report tells the truth about review ===========================
{
  const src = require('fs').readFileSync(require('path').join(process.cwd(), 'forensic-report.js'), 'utf8');
  const tv = src.slice(src.indexOf('function secTripleVerification'), src.indexOf('function secSealedFindings'));
  ok(/'NOT REVIEWED'/.test(tv) && !/: 'ENGINE-VERIFIED'/.test(tv), 'the Triple Verification review leg reads NOT REVIEWED when the AI review did not run');
  const cover = src.slice(src.indexOf('function drawCover'), src.indexOf('function drawCover') + 9000);
  ok(/INCOMPLETE READ: /.test(cover) && /AI REVIEW NOT RUN/.test(cover), 'the cover carries the incomplete-read and not-reviewed banners');
  const page = require('fs').readFileSync(require('path').join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/async function voPreflightForensicService/.test(page) && /var _pre = await voPreflightForensicService\(\);/.test(page) && /no forensic report was produced and nothing was sealed/.test(page),
    'forensic mode pre-flights the service and refuses to produce an unreviewed forensic report on a host with no API');
  ok(/function voOcrAskToContinue/.test(page) && /candidates = candidates\.concat\(cappedIdx\);/.test(page), 'the OCR cap asks once whether to read the remaining scanned pages');
  ok(/findings_json_version: '1\.3\.0'/.test(page) && /review_status: /.test(page) && /ocr_provenance: /.test(page), 'findings JSON v1.3.0 carries review_status and ocr_provenance');
}

console.log(`\n[annexure-eb] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[annexure-eb] FAILURES'); process.exit(1); }
console.log('[annexure-eb] ALL GREEN');
