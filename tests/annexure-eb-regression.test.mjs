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
ok(extract(['the agreement', '.', 'I have paid']) === 'the agreement. I have paid' && extract(['Lessee', ',', 'a company']) === 'Lessee, a company' && extract(['Ltd', '.', '5 The lessee']) === 'Ltd. 5 The lessee' && extract(['p', 'a', 'i', 'd', '.', 'No payment']) === 'paid. No payment',
  'a line-end full stop drawn in another font never glues the next line\'s first letter or clause number onto the word');
ok(extract(['Company', '(', 'Pty', ')', 'Ltd']) === 'Company (Pty) Ltd' && extract(['12', '/', '12', '/', '2018']) === '12/12/2018' && extract(['web', '-', 'based']) === 'web-based' && extract(['O', "'", 'N', 'e', 'i', 'l']) === "O'Neil",
  'openers carry forward, joiners pull the next word on: (Pty), 12/12/2018, web-based, O\'Neil');
ok(extract(['\x95Rent', ' ', 'is']) === 'Rent is', 'C1 control bytes (a WinAnsi bullet with no ToUnicode map) are dropped, not sealed');

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
ok(ct01(['The Franchisee made the royalty payment on 30 June 2021 as the statement shows. The Franchisee never made any royalty payment during 2021.']).length === 1,
  'CT01 still fires: "made the royalty payment" vs "never made any royalty payment" (a modifier before the claim word is free)');
ok(ct01(['The Lessor received the notice of termination on 2 May. It is not disputed that the Lessor never received the notice.']).length === 1,
  'CT01 still fires through the negator NEAREST the claim word ("never received"), not the leftmost ("not disputed")');
ok(ct01(['The lease was signed by both parties at Durban on 1 March 2019. The lease was never signed by the Lessee.']).length === 1,
  'CT01 still fires: "signed by both parties" vs "never signed by the Lessee" ("by" names an agent, not an object)');
ok(ct01(['The deposit was paid in full on 5 March 2019. The Lessor says the deposit was not paid timeously.']).length >= 1,
  'CT01 still fires: "paid in full" vs "not paid timeously" (adverbs are not objects)');

// ===== 3. CT09 — rentals are not identities ==================================
const ct09 = (blocks) => of(DET.D06_DETECT_IDENTITY_CONFLICT, blocks, 'CT09');
ok(ct09(['Rental for year 1: R103509 per month; year 2: R129749; year 3: R2489726 in total; year 4: R2653184 in total.']).length === 0,
  'CT09 silent: Rand amounts are money, not identity-shaped numbers (F004)');
ok(ct09(['Client reference 33503223243 0 on the statement.']).length === 0,
  'CT09 silent: a 12-digit reference is not a 13-digit identity number (F004)');
ok(ct09(['Ref AB1234567 noted on the invoice.', 'Ref CD7654321 on the credit note.']).length === 0,
  'CT09 silent: lettered codes without an ID/passport label are references');
ok(ct09(['Applicant Sipho Dlamini, ID 8001015009087, on the form.', 'Sipho Dlamini gives identity number 7502204567089 on the affidavit.']).length === 1,
  'CT09 still fires: the SAME person carries two different 13-digit identity numbers');
ok(ct09(['Holder Jan Botha, ID AB1234567, noted.', 'Jan Botha passport CD7654321 recorded.']).length === 1,
  'CT09 still fires: the same person with two labelled lettered identity codes');
ok(ct09(['LEASE between ABC Properties (Pty) Ltd, represented by Johannes Botha, Identity Number 6503125009087 (the Lessor) and Sipho Dlamini, Identity Number 8801015800083 (the Lessee).']).length === 0,
  'CT09 silent: two people, two identity numbers is the ordinary shape of a lease');
ok(ct09(['TILL SLIP Item 6001069123456 Milk R31.99 Item 6001240012345 Bread R18.99']).length === 0,
  'CT09 silent: barcodes without an identity label');

// ===== 4. CT20 — valid formats, VAT numbers and OCR debris ===================
const ct20 = (blocks) => of(DET.D11_DETECT_REGISTRATION_FAKE, blocks, 'CT20');
ok(ct20(['LESSOR: PALMBILI PROPERTY INVESTMENTS (PTY) LTD REGISTRATION NUMBER: 2013/199336/07 VAT REGISTRATION NUMBER: 4020270288 2. THE LESSEE: RONNIE MOIR TRAVEL CC REGISTRATION NUMBER: 1998/023813/24']).length === 0,
  'CT20 silent: "VAT REGISTRATION NUMBER: 4020270288" is a VAT number (F006)');
ok(ct20(['RONNIE MOIR TRAVEL CC (Registration NO. CK2000/071982/23) t/a Port Edward Garage']).length === 0,
  'CT20 silent: CK2000/071982/23 is a valid close-corporation registration (F009)');
{
  // A person's field ("of complainant") holding an identity number is what the field asks
  // for: an engine note since 5 October 2026 (Combine 06 April 2026); a company's
  // registration label holding an identity-shaped number stays the Low check (F005).
  const f = ct20(['Registration number of complainant 510209 5091 08 (a natural person) under the Consumer Protection Act.']).filter(x => !x.contextOnly);
  const fc = ct20(['Company registration number 8001015009087 of the supplier, as printed on the invoice.']);
  ok(f.length === 0 && fc.length === 1 && fc[0].severity === 2 && /identity number/.test(fc[0].evidence),
    'CT20: an identity number in a person\'s field is a note; an identity-shaped number under a company registration label is the Low check (F005)');
}
{
  const f = ct20(['Registration Number 1911/0001154/07 (Transferor), a company duly incorporated']);
  ok(f.length === 1 && f[0].severity === 2 && /one digit off/.test(f[0].evidence),
    'CT20 reports a middle group of seven digits as a Low "one digit off" check, not a fake (F007)');
}
ok(ct20(['Reg No. 2012/22¢ pu pees = CHL ein sr']).length === 0,
  'CT20 silent on OCR debris around the cue (F008)');
ok(ct20(['ABC Trading (Pty) Ltd  Registration Number 2019/123456/07 12 Rivonia Road, Sandton']).length === 0 && ct20(['Reg No 2019/123456/07 2020 Annual Return filed']).length === 0,
  'CT20 silent: a valid number followed by a street number or a year on the same line');
{
  const f = ct20(['Tel: 011 123 4567 | Fax: 011 123 4568 | Registration No: 2019/1234/7 | VAT No: 4123456789']);
  ok(f.length === 1 && f[0].severity === 4, 'CT20 still fires on a pipe-separated letterhead: typographic separators are not OCR debris');
}
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
{
  // Document A defines "Business" once; document B defines it two different ways: B's own conflict must still be found.
  const A = (n) => 'CALTEX FRANCHISE AGREEMENT  Page ' + n + ' of 4. ', B = (n) => 'LEASE OF PREMISES  Page ' + n + ' of 8. ';
  const blocks = [A(1) + 'Parties.', A(2) + '"Business" means the franchised fuel retail business conducted from the site.', A(3) + 'Term.', A(4) + 'Signed.',
    B(1) + 'Parties.', B(2) + '"Business" means the letting and hiring of the premises for a fuel forecourt.', B(3) + 'Rent.', B(4) + 'Term.',
    B(5) + '"Business" means the supply of lubricants only and nothing else.', B(6) + 'x', B(7) + 'y', B(8) + 'z'];
  const f = ct08(blocks);
  ok(f.length === 1 && /letting and hiring/.test(f[0].evidence) && /lubricants/.test(f[0].evidence), 'CT08 keeps each document\'s own first definition and still finds a conflict inside the second document');
}
ok(ct08(['1.1 "Premises" means the following: • Shop 4 • Shop 5 • the forecourt.', '9.9 "Premises" means only the forecourt and the canopy, nothing else whatsoever.']).length === 1,
  'CT08 still fires on a bulleted definition: bullets are typography, not OCR debris');

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
ok(ct18(['FRANCHISE AGREEMENT. Royalties are payable to the Franchisor. Banking details: Nedbank, Branch 198765, Account Number 1234567890.',
         'LEASE AGREEMENT. Rental is payable to the Lessor. Banking details: Absa, Branch 632005, Account Number 4012345678.']).length === 0,
  'CT18 silent: "Account Number" is a field label, never a party (franchisor and lessor are different parties)');
ok(ct18(['Account holder: ABC Properties (Pty) Ltd, Standard Bank, Account 012345678901. Rental payable monthly.',
         'Kindly note our new banking details with immediate effect. Account holder: ABC Properties Pty Ltd, Nedbank, Account 1987654321.']).length === 1,
  'CT18 still fires on the classic redirection letter: the same party spelt two ways, and a changed-details cue');
ok(ct18(['Account Holder: Kwazulu Fuel Distributors CC\nBank: Standard Bank\nAccount Number: 251068749\n', 'Account Holder: Palmbili Property Investments (Pty) Ltd\nBank: FNB\nAccount Number: 62068673493\n']).length === 0,
  'CT18 silent: two holders on two banking-details blocks (labels and line breaks do not become names)');

// ===== 9. OCR-debris gate ====================================================
ok(E.voLooksGarbled('Reg No. 2012/22¢ pu pees = CHL ein sr') === true, 'voLooksGarbled: symbol debris');
ok(E.voLooksGarbled('the rental, if any, payable by the Franchisee') === false, 'voLooksGarbled: clean legal prose is clean');
ok(E.voLooksGarbled('petrol, diesel, liquefied petroleum gas and any other products') === false, 'voLooksGarbled: technical vocabulary is not debris');
ok(E.voLooksGarbled('the 1st, 2nd and 3rd floors of the building') === false && E.voLooksGarbled('R5 000 per month plus VAT and a deposit of R7 500') === false && E.voLooksGarbled('the following: • the sale of fuel • the sale of lubricants') === false && E.voLooksGarbled('Twelfths of the Rightsholder\'s Nightshift allowance') === false && E.voLooksGarbled('Tel: 011 123 4567 | Fax: 011 123 4568 | Registration No: 2019/1234/7') === false,
  'voLooksGarbled: ordinals, amounts, bullets, consonant clusters and pipe separators are ordinary typed text');

// ===== 10. OCR provenance has a consequence ==================================
{
  const fs = [
    { type: 'CT20', severity: 4, location: 'Page 227', evidence: 'labelled registration in no known format' },
    { type: 'CT20', severity: 4, location: 'Page 360, 370', evidence: 'partly native' },
    { type: 'CT45', severity: 5, location: 'Page 227', evidence: 'goodwill recognised then denied' }
  ];
  const r = E.voCapOcrFormatFindings(fs, [227, 360]);
  ok(r.capped === 1 && r.held === 1 && fs[0].severity === 2 && fs[0].ocrCapped === true && /verified against the page image/.test(fs[0].evidence),
    'a format check anchored only to OCR pages is held at Low with the reason on the finding');
  ok(fs[1].severity === 4, 'a format check with one native page keeps its severity');
  ok(fs[2].severity === 3 && fs[2].ocrHeld === true && /held below serious until the quoted wording is verified/.test(fs[2].evidence), 'a substantive contradiction (CT45) anchored only on OCR pages is held below serious (3) until the page image is read; a format check goes to Low (2)');
  ok(E.voCapOcrFormatFindings(fs, []).capped === 0, 'nothing is capped when no page came through OCR');
}

// ===== 11. A seal footer is not evidence =====================================
ok(E.voIsFooterOnlyPage('[OCR] VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | a59c667afdceee61…6a7e85b4 | 316/528 2026-09-11 13:30:56 UTC | verumglobal.foundation | OpenTimestamps | Patent Pending Clean Bundle Page 316 of 528') === true,
  'a page carrying only seal footers is footer-only');
ok(E.voIsFooterOnlyPage('the lessor may without notice claim immediate payment of all amounts. VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 316/528') === false,
  'a page with lease text under its footer is evidence');
ok(E.voIsFooterOnlyPage('Signed at Durban on 12 December 2018. VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 83/528') === false,
  'a short signature line is evidence (never excluded as a footer)');
ok(E.voIsFooterOnlyPage('1,234.56 2,345.67 3,456.78 VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 84/528') === false && E.voIsFooterOnlyPage('62068673493 251068749 VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 85/528') === false && E.voIsFooterOnlyPage('ANNEXURE A VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 86/528') === false,
  'figures-only pages, account numbers and an "Annexure A" divider are evidence, never footer-only');
ok(E.voIsFooterOnlyPage('Just an ordinary page with no seal footer on it at all') === false, 'a page without a seal footer is never footer-only');
ok(E.voContentMass('seal footer only. ') < E.VO_NEAR_EMPTY_CHARS, 'the footer placeholder stays under the near-empty threshold so CT26 still reports an unread scanned page');
ok(JSON.stringify(E.voRulePagesOf('Page 3, 12-14')) === '[3,12,13,14]', 'voRulePagesOf collects list pages AND ranges');
ok(!/\b(?:CRITICAL|HIGH|MODERATE|LOW)\b/.test(require('fs').readFileSync(require('path').join(process.cwd(), 'forensic-engine-page.js'), 'utf8').match(/VO_OCR_CAP_NOTE = '([^']+)'/)[1]),
  'the OCR cap note carries no severity band word (§15.2)');
{
  const blocks = ['Clause 1. The parties agree.', 'VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 2/3', 'Clause 2. The rental is payable monthly.'];
  const r = E.voExcludeFooterOnlyPages(blocks);
  ok(r.pages.length === 1 && r.pages[0] === 2 && /seal footer only/.test(blocks[1]) && /Seal-footer pages: 1 page/.test(r.note),
    'footer-only pages are replaced by a placeholder and named in the extraction note');
}

// ===== 12. The report tells the truth about review ===========================
{
  const src = require('fs').readFileSync(require('path').join(process.cwd(), 'forensic-report.js'), 'utf8');
  const tv = src.slice(src.indexOf('function secTripleVerification'), src.indexOf('function secSealedFindings'));
  // 5 October 2026: the advisory AI review is not a verification leg (founder
  // ruling: it cannot remove or change a finding); the legs are the
  // Constitution's Thesis / Antithesis / Synthesis, and the table says PD13's
  // three independent verifiers are not met.
  ok(/Thesis/.test(tv) && /Antithesis/.test(tv) && /Synthesis/.test(tv) && !/'RETAINED'|'NOT REVIEWED'|: 'ENGINE-VERIFIED'/.test(tv) && /three independent verifiers/.test(tv), 'the Triple Verification table carries the Constitution\'s three legs, no AI review leg, and says PD13\'s independence is not met');
  const cover = src.slice(src.indexOf('function drawCover'), src.indexOf('function drawCover') + 9000);
  ok(/INCOMPLETE READ: /.test(cover) && !/AI REVIEW NOT RUN/.test(cover) && /Jurisdiction\(s\): /.test(cover) && /Report Type: /.test(cover) && /Case Reference: /.test(cover) && /Timestamp: /.test(cover), 'the cover carries the §15.4 header and the incomplete-read banner; the AI review, which touches no finding, is not a cover warning');
  const page = require('fs').readFileSync(require('path').join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/async function voPreflightForensicService/.test(page) && /var _pre = await voPreflightForensicService\(\);/.test(page) && /no forensic report was produced and nothing was sealed/.test(page),
    'forensic mode pre-flights the service and refuses to produce an unreviewed forensic report on a host with no API');
  ok(/function voOcrAskToContinue/.test(page) && /candidates = candidates\.concat\(cappedIdx\);/.test(page), 'the OCR cap asks once whether to read the remaining scanned pages');
  ok(/findings_json_version: '1\.9\.0'/.test(page) && /candidate_law: candidateLawOf\(f\)/.test(page) && /review_status: /.test(page) && /ocr_provenance: /.test(page) && /secondary_capped: /.test(page) && /ocr_anchored: /.test(page) && /ocr_held: /.test(page) && /triple_verification: /.test(page) && /ai_review_note: /.test(page) && /brain: /.test(page) && /display_name: /.test(page) && /cross_document_observations: /.test(page), 'findings JSON v1.9.0 carries review_status, ocr_provenance, secondary_capped, ocr_anchored, ocr_held, brain, display_name, triple_verification, ai_review_note, and (new) cross_document_observations');
  // Behavioural: the pre-flight against stubbed answers.
  const preSrc = page.slice(page.indexOf('var VO_PREFLIGHT_TIMEOUT_MS'), page.indexOf('function voShowPreflightBlock'));
  const mk = new Function('AbortController', 'setTimeout', 'clearTimeout', preSrc + '\nreturn { voPreflightForensicService, voPreflightMessage };');
  const P = mk(undefined, setTimeout, clearTimeout);
  const resp = (status, ct, body) => ({ status, headers: { get: (k) => (k === 'content-type' ? ct : null) }, json: async () => JSON.parse(body) });
  const run = async () => {
    const html = await P.voPreflightForensicService(async () => resp(200, 'text/html; charset=utf-8', '<html>'));
    const m405 = await P.voPreflightForensicService(async () => resp(405, 'text/plain', 'x'));
    const bad = await P.voPreflightForensicService(async () => resp(200, 'application/json', '{"ok":false}'));
    const good = await P.voPreflightForensicService(async () => resp(200, 'application/json; charset=utf-8', '{"ok":true}'));
    let calls = 0; const down = await P.voPreflightForensicService(async () => { calls++; throw new Error('net'); });
    ok(!html.ok && html.reason === 'no_api_at_this_address' && !m405.ok && m405.reason === 'no_api_at_this_address' && !bad.ok && bad.reason === 'service_unhealthy' && good.ok === true,
      'pre-flight: HTML, 405 and {ok:false} block; JSON {ok:true} clears');
    ok(!down.ok && down.reason === 'unreachable' && calls === 2, 'pre-flight: a dropped connection is retried once, then reported as unreachable (not as "no API")');
    ok(/could not be reached/.test(P.voPreflightMessage(down, 'x')) && /answered with a web page/.test(P.voPreflightMessage(html, 'x')), 'pre-flight wording names the real reason');
  };
  await run();
}

// ===== 13. The re-run (13 September 2026): what the second review found =====
// The precision release was re-run on the Worker (319 pages OCR'd, 15 engine
// findings retained). A second outside review found the engine had read the
// Verum Omnis supplementary report bound into the front of the bundle as
// evidence, matched a lessee clause about one party against an ownership
// line about another, treated distinct quoted terms as one word, linked an
// expiry to an invoice from another exhibit, and that the report's lead had
// been written by the Worker's template ("integrity score of 41 with a
// confidence rating of MODERATE") while labelled as the AI narrator's.
{
  // 13a. A prior Verum Omnis report bound into the bundle is analysis, not evidence.
  const masthead = 'URGENT - NATIONAL PRIORITY V E R U M O M N I S S E A L E D D O C U M E N T VERUM OMNIS FORENSIC REPORT Bright Idea Projects 66 (Pty) Ltd t/a AllFuels Supplementary Report: Goodwill Theft, Unsigned Agreements & The Petroleum Products Act Confirmed Losses: R231.3 Million Report Reference: VO-AF-2026-0523-SUPP Date: 23 May 2026';
  const header = 'Bright Idea Projects 66 (Pty) Ltd t/a AllFuels Supplementary Report: Goodwill Theft, Unsigned Agreements &The Petroleum Products Act Confirmed Losses: R231.3 Milli ';
  const blocks = [masthead, header + '4. THE GARY HIGHCOCK GOODWILL FORFEITURE CONTRADICTION 4.1 The Uncountersigned Goodwill Forfeiture Clause', header + 'operators possess no compensable goodwill interest in those businesses. This proposition', 'ocr noise page with nothing recognisable', header + '10. COURT-READY DECLARATION', 'FRANCHISE AGREEMENT between All Fuels Equipment (Pty) Ltd and Wayne Nel Motors CC. 1. Definitions.', 'Signed at Durban on 12 December 2018 by the Franchisee.'];
  ok(E.voIsSecondaryReportPage(masthead) === true && E.voIsSecondaryReportPage(blocks[5]) === false && E.voIsSecondaryReportPage('VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 316/528 Clean Bundle Page 316 of 528') === false,
    'a Verum Omnis report masthead is recognised; an exhibit page and a seal footer are not');
  ok(E.voIsSecondaryReportPage('AFFIDAVIT. I attach the forensic report as annexure C. VERIFY SEAL VERUM OMNIS SEALED ORIGINAL | VO-A59C667AFDCE | 40/528') === false
    && E.voIsSecondaryReportPage('Verum Omnis Forensic Report Source: annexure EB.PDF 1. Executive summary') === true
    && E.voIsSecondaryReportPage('V E R U M O M N I S S E A L E D D O C U M E N T VERUM OMNIS FORENSIC REPORT') === true,
    'an exhibit that mentions "the forensic report" beside a seal footer is evidence; the brand and the kind must sit together');
  const r = E.voExcludeSecondaryReportPages(blocks);
  ok(r && JSON.stringify(r.pages) === '[1,2,3,4,5]' && /Prior Verum Omnis report: 5 page/.test(r.note) && /analysis, not evidence/.test(r.note),
    'the report pages (masthead, running-title pages, a one-page OCR gap inside the run) are excluded and disclosed; the exhibits stay (' + (r && r.pages) + ')');
  ok(/prior verum omnis report page excluded/.test(blocks[1]) && /FRANCHISE AGREEMENT/.test(blocks[5]) && blocks.length === 7, 'excluded pages are replaced in place; page numbering survives');
  ok(of(DET.D39_DETECT_ASSET_VALUE_DENIAL, blocks, 'CT45').length === 0 && of(DET.D32_DETECT_SIGNATURE_ANOMALY, blocks, 'CT23').length === 0,
    'the report\'s "goodwill forfeiture contradiction" and its "Unsigned Agreements" title no longer become CT45/CT23 findings');
  ok(E.voExcludeSecondaryReportPages(['Lease agreement page one.', 'Lease agreement page two.']) === null, 'a bundle with no Verum Omnis report is untouched');
  const all = E.voExcludeSecondaryReportPages([masthead, header + 'section 1', header + 'section 2']);
  ok(all && all.pages.length === 3 && /nothing in this file was examined as evidence/.test(all.note), 'sealing a Verum Omnis report itself says nothing was examined as evidence');
  // A far page carrying the title (an index entry) is excluded on its own; it does not bridge to the pages between.
  const far = ['ordinary exhibit page 1', masthead, header + 'p2', 'exhibit A', 'exhibit B', 'exhibit C', 'exhibit D', 'Index: ' + header];
  const rf = E.voExcludeSecondaryReportPages(far);
  ok(rf && JSON.stringify(rf.pages) === '[2,3,8]', 'a gap wider than two pages is never bridged (' + (rf && rf.pages) + ')');

  // 13b. CT44: the party denied ownership must be the party shown to have become owner.
  const d38 = (b) => of(DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED, b, 'CT44');
  ok(d38(['3.2.3 in the event that the Franchisee is not the owner of the Premises, but is the lessee in terms of a Lease with Palmbili Properties, this agreement expires when the lease terminates.', 'All Fuels Equipment (Pty) Ltd, the supplier of fuel and the Owner/Lessor of the site from which the Operator trades.']).length === 0,
    'CT44 stays silent when the franchisee is the lessee and the FRANCHISOR is the owner/lessor (p.28 vs p.112 of the re-run)');
  ok(d38(['in the event that the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired.', 'x', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 1,
    'CT44 still fires when the record shows the clause party itself became owner (franchise-lease fixture)');
  const same = d38(['if the Franchisee is not the owner of the Premises but is the lessee under a head lease and that lease terminates, this agreement expires.', 'The Franchisee became the registered owner of the premises on 1 March 2019.']);
  ok(same.length === 1 && same[0].location === 'Page 1 vs Page 2', 'CT44 fires when the same side is denied ownership and later shown as owner');

  // 13c. CT08: a quoted multi-word term is one term; two different terms are not two definitions of one word.
  const ct08b = (b) => of(DET.D30_DETECT_TERM_DEFINITION_CONFLICT, b, 'CT08');
  ok(ct08b(["1.1 'Accommodation Rental' means the monthly rental for the residential unit.", "1.2 'All Fuels Computer System Rental' means the fee for the point-of-sale system."]).length === 0,
    "'Accommodation Rental' and 'All Fuels Computer System Rental' are two terms, not two definitions of \"rental\"");
  ok(ct08b(['Equipment Rental means the monthly charge for pumps and tanks supplied.', 'Fuel Rental means the deposit held against fuel stock supplied.']).length === 0, 'Capitalised multi-word terms are read whole');
  ok(ct08b(["1.1 'Accommodation Rental' means the monthly rental for the residential unit payable in advance.", "9.4 'Accommodation Rental' means the annual amount payable for the office premises in arrears."]).length === 1, 'the same quoted term defined differently still fires');
  ok(ct08b(['1.1 “Premises” means Shop 4 and Shop 5 and the forecourt at Durban.', '9.9 “Premises” means only the forecourt and the canopy, nothing else at all.']).length === 1, 'curly double quotes are read');
  ok(ct08b(["the Lessee's obligations means nothing here", "the Lessee's duties means nothing else here either"]).length === 0, "an apostrophe inside a word is not an opening quote");

  // 13d. CT04: the invoice must be billing under the expired instrument.
  const d04 = (b) => DET.D04_DETECT_TEMPORAL_IMPOSSIBILITY(b).filter(f => /Billing after the stated expiry/.test(f.evidence));
  const pages = Array(30).fill('page text.');
  pages[5] = 'The lease agreement expired on 28 February 2018 between Chevron South Africa (Pty) Ltd and Highcock Fuels CC.';
  pages[25] = 'TAX INVOICE date: 19 December 2025 All Fuels Equipment (Pty) Ltd to Wayne Nel Motors CC rental R12,000.';
  ok(d04(pages).length === 0, 'an invoice between other companies is not billing under the expired lease (p.326 vs p.412 of the re-run)');
  const shared = pages.slice(); shared[25] = 'TAX INVOICE date: 19 December 2025 Chevron South Africa (Pty) Ltd to Highcock Fuels CC rental R12,000.';
  ok(d04(shared).length === 1, 'an invoice between the same companies after the expiry still fires');
  const anon = pages.slice(); anon[25] = 'TAX INVOICE date: 19 December 2025 rental for the premises R12,000 due on presentation.';
  ok(d04(anon).length === 1, 'a page that names no company cannot be excluded on that ground');
  const docs = Array.from({ length: 12 }, (_, i) => 'Clean Bundle Page ' + (i + 1) + ' of 12 ' + (i < 6 ? 'Lease Page ' + (i + 1) + ' of 6' : 'Invoice Page ' + (i - 5) + ' of 6'));
  const segs = E.voDetectDocuments(docs);
  ok(segs.length === 2 && segs[0].start === 1 && segs[0].end === 6 && segs[1].start === 7, 'a bundle\'s own running numbering ("Clean Bundle Page N of 528") no longer hides the exhibits\' boundaries');
  const two = docs.slice(); two[2] += ' lease agreement expired on 28 February 2018.'; two[9] += ' TAX INVOICE date: 19 December 2025 rental R12,000.';
  ok(d04(two).length === 0, 'an invoice in another stated document is not billing under this one');

  // 13e. '&' is a word, not a joiner.
  ok(extract(['Agreements', ' ', '&', ' ', 'The', ' ', 'Act']) === 'Agreements & The Act' && extract(['12', '/', '12']) === '12/12', '"Agreements & The" keeps its spaces (was "Agreements &The"); "/" still joins');
}

// ===== 14. Narrator honesty and one count =====================================
{
  const fs = require('fs'), path = require('path');
  const wsrc = fs.readFileSync(path.join(process.cwd(), 'worker/verum-rules.js'), 'utf8');
  const tmpl = wsrc.slice(wsrc.indexOf('function narrateTemplate'), wsrc.indexOf('async function handleAiNarrate'));
  ok(!/integrity score|confidence rating|input\.score|input\.confidence/.test(tmpl) && /' engine finding'/.test(tmpl) && !/engine-verified/.test(tmpl) && /AI-raised candidate/.test(tmpl),
    'the Worker\'s template narrative prints no score and no band, and counts engine findings apart from AI-raised candidates');
  ok(/SWEEP_VERDICT_RE/.test(wsrc) && /Neutral language only/.test(wsrc), 'Brain 9 is told to use neutral language and conclusory items are discarded server-side');
  const rsrc = fs.readFileSync(path.join(process.cwd(), 'forensic-report.js'), 'utf8');
  const gate = rsrc.slice(rsrc.indexOf('var VO_BANNED_SENTENCE_RE'), rsrc.indexOf('var VO_MONTH_MAY_RE'));
  ok(/integrity\|fraud\|risk\|overall\)\\\\s\+score/.test(gate) && /confidence\\\\s\+\(\?:rating\|band\|level\|score\)/.test(gate), 'the §15.2 render gate drops score and confidence-band sentences');
  const narr = rsrc.slice(rsrc.indexOf('function secNarrative'), rsrc.indexOf('function secNarrative') + 14000);
  ok(/f\.source !== 'ai' && f\.type !== 'SERIAL'/.test(narr) && /not counted here/.test(narr), 'the narrative counts engine-verified findings only and tells AI candidates apart');
  ok(/no draft passed the server\\'s anchor and language gate/.test(rsrc), 'the narrator provenance line says when every section was asked for and discarded');
  const page = fs.readFileSync(path.join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/window\._voNarrateTemplate \? 'local' : 'ai'/.test(page) && /res\.model === 'template-fallback'/.test(page), 'template text from the Worker is labelled local, never as the AI narrator\'s writing');
  // Since the founder ruling of 5 October 2026 the review removes nothing, so
  // the engine's own summary and counts stand unchanged.
  ok(!/reportFraudResult\.summary = generateSummary\(assessRes\.findings/.test(page) && /var mergedFindings = assessRes\.findings\.concat\(assessRes\.added\);/.test(page), 'nothing is recomputed after the review: it removed no finding');
  ok(/sectionsAttempted: hr\.calls/.test(page), 'the human-report provenance carries how many sections were asked for');
  ok(/id="sizeRow"/.test(page) && /for the watermark, QR and footer on every page/.test(page), 'the results panel states the original and sealed sizes');
  // The inlined scripts each run inside their own closure: a helper defined
  // there (fmtBytes in forensic-report.js) is invisible to the page script.
  // The size line called it and every seal's results panel died with
  // "fmtBytes is not defined" on 13 September. Page-level code may only
  // call page-level helpers.
  const pageLevel = page.split(/\/\* VO-INLINE:[^*]*:START \*\/[\s\S]*?\/\* VO-INLINE:[^*]*:END \*\//g).join('\n');
  ok(!/(^|[^A-Za-z0-9_$.])fmtBytes\(/.test(pageLevel) && /function voFmtBytes\(/.test(pageLevel) && /voFmtBytes\(sealedSize\)/.test(pageLevel),
    'page-level code formats sizes with its own voFmtBytes, never the report closure\'s fmtBytes');
  const closurePrivate = ['fmtBytes', 'truncHash', 'quoteEvidence', 'fmtLocation', 'narrativeBlocks', 'scrubNarrative', 'voGatePasses'];
  const leaks = closurePrivate.filter(fn => new RegExp('(^|[^A-Za-z0-9_$.])' + fn + '\\(').test(pageLevel));
  ok(leaks.length === 0, 'page-level code calls no helper that lives only inside an inlined closure (' + leaks.join(', ') + ')');
  ok(/try \{\s*var sizeRow = document\.getElementById\('sizeRow'\);/.test(page), 'the size line can never stop the results panel (wrapped in try/catch)');
}

// ===== 15. A PDF printed from Chrome reads as empty (13 September 2026) ======
// "AllFuels_Timeline_Report_Des_to_Current.PDF": 17 native-text pages printed
// by Chromium (Skia), every font a Type3 font with ONE-BYTE codes and a
// ToUnicode map. The decoder assumed two-byte codes for any mapped font, read
// <39> as nothing, and the whole document reached the engine as empty pages
// (then went to OCR). Also on that file: line ends glued words ("side ofthe
// same"), a SAPS case number "CAS 96/6/2026" was sealed as an impossible
// date, and a valid registration number was cut by a 40-character window.
{
  const oneByte = E._voParseToUnicode('1 begincodespacerange\n<00> <FF>\nendcodespacerange\n2 beginbfchar\n<05> <0020>\n<3E> <0059>\nendbfchar\n1 beginbfrange\n<26> <2F> <0041>\nendbfrange');
  const twoByte = E._voParseToUnicode('1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0024> <003D> <0041>\nendbfrange');
  const noSpace = E._voParseToUnicode('2 beginbfchar\n<41> <0041>\n<42> <0042>\nendbfchar');
  ok(E._voCmapCodeBytes(oneByte) === 1 && E._voCmapCodeBytes(twoByte) === 2 && E._voCmapCodeBytes(noSpace) === 1, 'the code width comes from the codespacerange, or from the keys when there is none');
  ok(E._voDecodeHexString('26052A', oneByte) === 'A E' && E._voDecodeHexString('00240025', twoByte) === 'AB' && E._voDecodeHexString('4142', noSpace) === 'AB', 'one-byte codes decode as one byte, two-byte as two (Chromium <39> Tj was read as nothing)');
  ok(E._voMapLiteral(String.fromCharCode(0x26, 0x05, 0x2A), oneByte) === 'A E' && E._voMapLiteral('Hello', twoByte) === 'Hello' && E._voMapLiteral('Hi', null) === 'Hi', 'a literal string under a one-byte map is a run of codes; two-byte maps and no map leave it alone');
  ok(Object.keys(oneByte).indexOf('__codeBytes') < 0, 'the width is not a mapped code (key counts stay honest)');

  // End to end on a real PDF built here: a one-byte ToUnicode map on a standard
  // font, hex-string glyphs positioned one by one, and a line move between
  // "of" and "the" with no space glyph — the Chromium shape.
  const fs = require('fs'), path = require('path');
  const g = globalThis; g.window = g; g.self = g;
  new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
  const PDFLib = g.PDFLib;
  const run = async () => {
    // pdf-lib writes the font dictionary on save, so build, save, and edit the
    // loaded copy (the ToUnicode map and the content stream go on that).
    const draft = await PDFLib.PDFDocument.create();
    const draftPage = draft.addPage([595, 842]);
    draftPage.setFont(await draft.embedFont(PDFLib.StandardFonts.Helvetica));
    const doc = await PDFLib.PDFDocument.load(await draft.save({ useObjectStreams: false }), { ignoreEncryption: true });
    const page = doc.getPages()[0];
    const fontsDict = doc.context.lookup(page.node.Resources().get(PDFLib.PDFName.of('Font')));
    const fname = fontsDict.keys()[0].asString().replace(/^\//, '');
    const fontDict = doc.context.lookup(fontsDict.get(fontsDict.keys()[0]));
    // Codes 0x01..: 01=s 02=i 03=d 04=e 05=space 06=o 07=f 08=t 09=h 0A=CAS-digits not needed
    const cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n9 beginbfchar\n<01> <0073>\n<02> <0069>\n<03> <0064>\n<04> <0065>\n<05> <0020>\n<06> <006F>\n<07> <0066>\n<08> <0074>\n<09> <0068>\nendbfchar\nendcmap\nend\nend';
    const cmapStream = doc.context.stream(cmap);
    fontDict.set(PDFLib.PDFName.of('ToUnicode'), doc.context.register(cmapStream));
    // "side of" on one line (glyph by glyph, Td moves along x), then a Tm to the next line and "the".
    const ops = 'BT /' + fname + ' 12 Tf 1 0 0 -1 40 100 Tm <01> Tj 6 0 Td <02> Tj 3 0 Td <03> Tj 6 0 Td <04> Tj 6 0 Td <05> Tj 3 0 Td <06> Tj 6 0 Td <07> Tj ET\n' +
      'BT /' + fname + ' 12 Tf 1 0 0 -1 40 116 Tm <08> Tj 4 0 Td <09> Tj 6 0 Td <04> Tj ET';
    const stream = doc.context.stream(ops);
    page.node.set(PDFLib.PDFName.of('Contents'), doc.context.register(stream));
    const bytes = await doc.save({ useObjectStreams: false });
    const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const text = (await E.extractPageText(bytes, 0, loaded)).join(' ');
    ok(text === 'side of the', 'a Chromium-shaped page (one-byte codes, per-glyph hex strings, a line move with no space glyph) reads "side of the" (got ' + JSON.stringify(text) + ')');
    ok(/-/.test(fname), 'the fixture font name carries a hyphen (' + fname + '): a font select with a hyphen, underscore or plus in its name is honoured');
  };
  await run();

  // A case number shaped like a date is not a date.
  const d03 = (b) => DET.D03_DETECT_DATE_INCONSISTENCY(b).filter(f => /Impossible date/.test(f.evidence));
  ok(d03(['forensic evidence submitted to SAPS (CAS 96/6/2026), attention the investigating officer.']).length === 0 && d03(['Our ref: 13/4/3/5/2026 refers.']).length === 0, '"CAS 96/6/2026" and "Our ref: 13/4/3/5/2026" are not impossible dates');
  ok(d03(['The lease was signed on 31/02/2021 at Durban.']).length === 1, 'a genuinely impossible date still fires');

  // An AI-compiled summary is disclosed, never excluded.
  const note = E.voNoteAiCompiledSummary(['Compiled: 13 September 2026 | Compiled by: Claude, from documents in the Drive', 'page two']);
  ok(note && /AI-compiled summary: page 1 states "Compiled by: Claude"/.test(note) && /verified against the primary documents it cites/.test(note), 'a file that says it was compiled by an AI assistant is disclosed as secondary');
  ok(E.voNoteAiCompiledSummary(['Franchise agreement between the parties.', 'Clause 1.']) === null && E.voNoteAiCompiledSummary(['x', 'y', 'Compiled by: Claude']) === null, 'no note without the statement on the first two pages');

  // A valid registration number after a cue is read whole, not cut at 40 characters.
  const ct20b = (b) => of(DET.D11_DETECT_REGISTRATION_FAKE, b, 'CT20');
  ok(ct20b(['a CIPC company-history search on 2002/059909/23 would settle this.']).length === 0, '"CIPC company-history search on 2002/059909/23" is a valid number, not cut to 2002/059909/2');
  const bad20 = ct20b(['Registration No: 2002/05990/2 as stated on the letterhead.']);
  ok(bad20.length === 1 && /2002\/05990\/2/.test(bad20[0].evidence), 'a malformed number after the cue still fires and the quote includes the whole number');
}

// ---- §16 The evidence-bundle-2-docs run (2026-09-27) --------------------------
// A 68-page bundle of previously sealed exhibits (a customer's email chain,
// statements, an affidavit, two banks' outcome letters). An outside review
// found three false findings and a narrative that repeated them; the engine
// had also excluded the first 38 pages as a "prior Verum Omnis report" on the
// strength of the platform's own sealed-document footer, and read every seal
// footer as a run of CJK characters. Each item below is pinned with the
// bundle's own text.
{
  const foot = (id, n, tot, extra) => ' PRIVATE SEAL -- FREE TIER VERUM OMNIS SEALED ORIGINAL | Seal: ' + id + ' | SHA-512: 65c44f59360eb272... | 04/08/2026 12:41:58 Africa/Johannesburg | ' + n + '/' + tot + (extra || '') + ' verumglobal.foundation | OpenTimestamps | Patent Pending VERUM OMNIS SEALED ORIGINAL scan the code or verify at verumglobal.foundation/verify.html';

  // 16a. Sealed EVIDENCE is not a report: only a report masthead excludes a page.
  const sealedEvidence = 'Dear Standard Bank Fraud Department, I refer to my ongoing fraud claim and my previous correspondence. Verum Omnis Sealed Document Source: Fwd_ Urgent request re_ case number 16686059.PDF Page 1 of 4 VERIFY SEAL VERUM OMNIS SEAL | seal-66b31b35d0acfb7ea04e0d61 | 66b31b35...498ed789 | v5.2.7 | Verum Omnis | AI Forensics | Constitution | 1' + foot('VO-65C44F59360E', 1, 61);
  ok(E.voIsSecondaryReportPage(sealedEvidence) === false, 'a previously sealed exhibit ("Verum Omnis Sealed Document", "VERUM OMNIS SEAL |") is evidence, never a report page');
  ok(E.voIsSecondaryReportPage('Verum Omnis Court-Ready Narrative Source: evidence-bundle-2-docs.pdf 1. EXECUTIVE SUMMARY') === true
    && E.voIsSecondaryReportPage('CONFIDENTIAL — LAW ENFORCEMENT SENSITIVE FORENSIC EVIDENCE REPORT evidence-bundle-2-docs Report Reference: VO-WEB-20260927-7AC6') === true
    && E.voIsSecondaryReportPage('Verum Omnis Forensic Report Source: evidence-bundle-2-docs.pdf EXECUTIVE SUMMARY') === true,
    'the court-ready narrative, the forensic evidence report cover and the technical report\'s running header are still recognised as report pages');
  const sealedBundle = [sealedEvidence, 'page two of the letter.' + foot('VO-65C44F59360E', 2, 61), 'page three.' + foot('VO-65C44F59360E', 3, 61)];
  ok(E.voExcludeSecondaryReportPages(sealedBundle) === null && /Dear Standard Bank/.test(sealedBundle[0]), 'a bundle of sealed exhibits loses no page');

  // 16b. The platform's own seal footer states each exhibit's page count, so a bundle of
  // sealed exhibits states its boundaries; the smallest stated total on a page is the
  // exhibit; the footer's date ("04/08/2026") is never read as a page marker.
  const nested = [];
  for (let p = 1; p <= 5; p++) nested.push('exhibit A page ' + p + '.' + foot('VO-AAAAAAAAAAAA', p, 5) + (p >= 2 ? foot('VO-CCCCCCCCCCCC', p - 1, 7, ' | Chain: 1 prev') : ''));
  for (let p = 1; p <= 3; p++) nested.push('exhibit B page ' + p + '.' + foot('VO-BBBBBBBBBBBB', p, 3) + foot('VO-CCCCCCCCCCCC', p + 4, 7, ' | Chain: 1 prev'));
  const segs = E.voDetectDocuments(nested);
  ok(segs.length === 2 && segs[0].start === 1 && segs[0].end === 5 && segs[0].statedTotal === 5 && segs[1].start === 6 && segs[1].end === 8 && segs[1].statedTotal === 3,
    'seal footers state the boundaries (exhibit A 1-5, exhibit B 6-8); the seven-page chain seal and the footer date are not documents (' + JSON.stringify(segs.map(x => [x.start, x.end, x.statedTotal])) + ')');

  // 16c. CT02: "R116 124.00" is R116 124, not R116; a column header is not a stated amount;
  // two exhibits never restate one figure.
  const d02 = (b) => of(DET.D02_DETECT_NUMERICAL_DISCREPANCY, b, 'CT02');
  const barnard = 'From the reported transactions, an amount of R116 124.00 has been secured and should be reimbursed to you by Hollywoodbets within 15 working days from the date of this letter.';
  const liebenberg = 'Summary of Disputed Transactions Transaction date Posting date Time Amount Merchant 2026/06/25 2026/06/27 R 8000.00 Makro Riversands 2026/06/25 2026/06/27 R 9850.60 Makro Riversands';
  ok(d02([barnard, liebenberg]).length === 0, 'the Barnard letter\'s "amount of R116 124.00" and the Liebenberg table\'s "Amount Merchant … R 8000.00" are not one figure stated twice');
  const sp = d02(['an amount of R116 124.00 was secured.', 'an amount of R118 000.00 was secured.']);
  ok(sp.length === 1 && /R116 124\.00/.test(sp[0].evidence) && /R118 000\.00/.test(sp[0].evidence) && /variance: 2%/.test(sp[0].evidence),
    'a space-grouped figure is read whole and quoted whole (' + (sp[0] && sp[0].evidence) + ')');
  ok(d02(['Total: R450,000 is payable.', 'schedule.', 'Total: R470,000 is payable.']).length === 1, 'the same label restated inside one document still fires');
  const twoDocs = [];
  for (let p = 1; p <= 3; p++) twoDocs.push((p === 1 ? 'Total: R450,000 is payable.' : 'schedule page ' + p + '.') + foot('VO-AAAAAAAAAAAA', p, 3));
  for (let p = 1; p <= 3; p++) twoDocs.push((p === 1 ? 'Total: R470,000 is payable.' : 'schedule page ' + p + '.') + foot('VO-BBBBBBBBBBBB', p, 3));
  ok(d02(twoDocs).length === 0, 'the same label in two stated documents is two subjects, never compared');

  // 16d. CT18: a bank's case reference and a mobile number are not accounts; every
  // number counted is listed.
  ok(ct18(['The Standard Bank of South Africa Limited - Outcome of your fraud claim investigation, Case Ref: 2026-1099145183. Subject: Standard Bank Fraud Case: 2026-1099145183',
    'Universal Banker Modimolle Branch Tel +27(014)7179088/ Mobile +27 638230461/ Esther.moloatsi@standardbank.co.za Team Leader Branch Modimolle Branch Tel +27(014) 7361411/ Mobile +27 649761561/']).length === 0,
    '"Case Ref: 2026-1099145183" and "Mobile +27 638230461" are not bank accounts');
  const four = ct18(['Please pay into bank account 1111111111 or bank account 2222222222 or bank account 3333333333 or bank account 4444444444 for this payment.']);
  ok(four.length === 1 && /^4 different/.test(four[0].evidence) && (four[0].evidence.match(/\b\d{10}\b/g) || []).length === 4,
    'the count equals the numbers listed (' + (four[0] && four[0].evidence) + ')');
  ok(ct18(['Please pay into our bank account number 1234567890 (Nedbank).', 'Kindly note our new banking details: account 0987654321, FNB.']).length === 1, 'a changed-details instruction still fires');

  // 16e. CT37: a lookalike domain is the finding; many domains are not.
  const d25 = (b) => of(DET.D25_DETECT_CONTACT_MISMATCH, b, 'CT37');
  ok(d25(['From: Nicky Liebenberg <nix.liebenberg@gmail.com> To: cardfraudinvestigations@standardbank.co.za', 'To: nicky@harmonyclinic.co.za Cc: liam@verumglobal.foundation From: rediscoveryounl@gmail.com', 'Esther.moloatsi@mweb.co.za']).length === 0,
    'a correspondence bundle\'s many email domains are not a contradiction');
  const look = d25(['E-mail: Kerusha.moonsamy@standandbank.co.za Escalations 1st level', 'E-mail: Aabidah.Khan@standardbank.co.za www.standardbank.com']);
  ok(look.length === 1 && /"standandbank\.co\.za" \(p\. 1\)/.test(look[0].evidence) && /"standardbank\.co\.za" \(p\. 2\)/.test(look[0].evidence) && /1 character apart/.test(look[0].evidence) && look[0].location === 'Page 1, 2',
    'standandbank.co.za beside standardbank.co.za is a lookalike, anchored to both pages (' + (look[0] && look[0].evidence) + ')');
  ok(d25(['[OCR] E-mail: Esther.moloatsi@standardoankco.za', 'E-mail: Aabidah.Khan@standardbank.co.za']).length === 0, 'a domain read by OCR never forms a lookalike');
  ok(d25(['write to x@standardbank.co for help', 'y@standardbank.co.za']).length === 0, 'a truncated domain that prefixes another is the same domain');
  ok(d25(['VERUM OMNIS SEALED ORIGINAL scan the code or verify at verumglobal.foundation/verify.html a@verumglobal.foundation', 'b@verumglobal.foundatlon']).length === 0, 'the seal footer\'s own domain is boilerplate, never a contact');

  // 16f. Parties: OCR garbage and a statement line are not parties.
  ok(!E.voLooksLikePerson('HOLL YWoODBETS') && !E.voLooksLikePerson('Hot YooDRETS') && !E.voLooksLikePerson('Banas TT JT ETE') && !E.voLooksLikePerson('PAYMENT TO HOLLYWOODBETS'),
    '"HOLL YWoODBETS", "Hot YooDRETS", "Banas TT JT ETE" and "PAYMENT TO HOLLYWOODBETS" are not parties');
  ok(E.voLooksLikePerson('Barnie Barnard') && E.voLooksLikePerson('NMC Nyembezi') && E.voLooksLikePerson('E de Waal') && E.voLooksLikePerson('Ronald McDonald') && E.voLooksLikePerson('Nicola NJ Liebenberg'),
    'real names, initials groups and case-flipped surnames still pass');
  const textPage = 'Dear Mr Gerhardus Barnard, we write about your matter. Gerhardus Barnard reported the incident and Gerhardus Barnard was contacted on the number given, which is a page of ordinary text.';
  const ocrStatement = '[OCR] 27 jun debit Holl Widogrets 12.00 debit Holl Widogrets 15.00 debit Holl Widogrets 9.00';
  const rosterMixed = E.voBuildNameRoster([ocrStatement, '[OCR] debit Holl Widogrets 4.00 again on a scanned statement', textPage]).map(x => x.name);
  ok(rosterMixed.indexOf('Gerhardus Barnard') >= 0 && rosterMixed.indexOf('Holl Widogrets') < 0, 'a name seen only on OCR pages is not a roster party when the bundle has text pages (' + rosterMixed.join('; ') + ')');
  const rosterOcr = E.voBuildNameRoster([ocrStatement, '[OCR] debit Holl Widogrets 4.00 again']).map(x => x.name);
  ok(rosterOcr.indexOf('Holl Widogrets') >= 0, 'a wholly scanned bundle keeps its OCR-read names');

  // 16g. The summary prints no band word.
  const summ = E.generateSummary([{ type: 'CT02' }, { type: 'CT18' }], 66);
  ok(/^2 findings established/.test(summ) && !/severity is|\b(?:moderate|high|critical|minor|serious)\b|largely consistent|systematic fraud/i.test(summ), 'the short summary states the count and no severity band (' + summ + ')');
  // ... whatever the internal score: it once chose "4 minor contradictions
  // established. The document is largely consistent" (evidence-bundle-7-docs).
  const fourKinds = [{ type: 'CT20' }, { type: 'CT37' }, { type: 'CT39' }, { type: 'CT23' }];
  ok([5, 25, 45, 65, 85].every(sc => E.generateSummary(fourKinds, sc) === '4 findings established, each set out with its page or file-level location. Read each finding against the original at the cited page.'), 'the summary is the same sentence at every internal score (no band chosen by a score)');

  // 16h. Footer-only: the newer footer (slash date and time, a chain line, the verify line).
  ok(E.voIsFooterOnlyPage('PRIVATE SEAL -- FREE TIER VERUM OMNIS SEALED ORIGINAL | Seal: VO-12A18F7CF129 | SHA-512: 12a18f7cf1296317... | 27/07/2026 12:57:50 Africa/Johannesburg | 1/2 verumglobal.foundation | OpenTimestamps | Patent Pending PRIVATE SEAL -- FREE TIER | Chain: 1 prev VERUM OMNIS SEALED ORIGINAL | Seal: VO-DD6E103B29EA | SHA-512: dd6e103b29eabfa6... | 04/08/2026 12:40:55 Africa/Johannesburg | 1/7 | Chain: 1 prev verumglobal.foundation | OpenTimestamps | Patent Pending VERUM OMNIS SEALED ORIGINAL scan the code or verify at verumglobal.foundation/verify.html PRIVATE SEAL — FREE TIER verumglobal.foundation | OpenTimestamps | Patent Pending VERUM OMNIS SEALED ORIGINAL | Seal: VO-52DEE57A7AC6 | SHA-512: 52dee57a7ac66fdd... | 27/09/2026 08:23:04 Africa/Johannesburg | 62/68') === true,
    'a page carrying only nested seal footers is a footer-only page');
  ok(E.voIsFooterOnlyPage('Signed at Durban on 12 December 2018 by the Franchisee.' + foot('VO-65C44F59360E', 9, 61)) === false, 'a signature line beside a footer is evidence');

  // 16i–j. Extraction and the report, end to end, on PDFs built here with pdf-lib's
  // standard fonts (Type1, WinAnsi, no ToUnicode — the shape of every seal footer).
  const fs = require('fs'), path = require('path');
  const g = globalThis; g.window = g; g.self = g;
  if (!g.PDFLib) new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
  const PDFLib = g.PDFLib;
  const pageText = async (bytes) => {
    const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const parts = [];
    for (let i = 0; i < loaded.getPageCount(); i++) parts.push((await E.extractPageText(bytes, i, loaded)).join(' '));
    return parts.join(' \n ').replace(/[ \t]+/g, ' ');
  };
  const run = async () => {
    const d = await PDFLib.PDFDocument.create();
    const pg = d.addPage([595, 842]);
    const helv = await d.embedFont(PDFLib.StandardFonts.Helvetica);
    const line = 'VERUM OMNIS SEALED ORIGINAL | Seal: VO-65C44F59360E | SHA-512: 65c44f59360eb272... | 39/61';
    pg.drawText(line, { x: 20, y: 800, size: 8, font: helv });
    pg.drawText('PRIVATE SEAL — FREE TIER “quoted” 04/08/2026', { x: 20, y: 780, size: 8, font: helv });
    const t = await pageText(await d.save({ useObjectStreams: false }));
    ok(t.indexOf(line) >= 0 && !/[　-鿿]/.test(t), 'a standard-font footer of even length decodes as text, never as CJK (' + JSON.stringify(t.slice(0, 80)) + ')');
    ok(/PRIVATE SEAL — FREE TIER “quoted”/.test(t), 'WinAnsi dashes and curly quotes survive the one-byte decode');

    // The report: two engine findings and one AI candidate; a prior report excluded; OCR pages.
    const R = require('../forensic-report.js');
    const findings = [
      { type: 'CT02', severity: 4, evidence: '"total" is stated as R450,000 and as R470,000 (variance: 4%)', location: 'Page 2 vs Page 5', anchor: { where: [2, 5], who: [], when: [] } },
      { type: 'CT18', severity: 4, evidence: '2 different bank account numbers found near banking references in the same payment context: 1234567890, 0987654321 — confirm which account the record authorises', location: 'Page 3, 6', anchor: { where: [3, 6], who: [], when: [] } },
      { type: 'DOMAIN_TYPO', severity: 3, source: 'ai', evidence: 'standandbank', rationale: 'Typo in domain name', location: 'Page 48', anchor: { where: [48], who: [], when: [] } }
    ];
    const opts = {
      documents: [{ name: 'evidence-bundle-2-docs.pdf', pageCount: 68, sha512: 'ab'.repeat(64), sealId: 'VO-52DEE57A7AC6' }],
      findings: { clean: false, overallScore: 30, confidence: 'LOW', totalFindings: 3, findings: findings, summary: '2 page-anchored findings established.', contradictionTypesUsed: 2 },
      aiReview: { applied: true, retained: 2, assessed: 2, added: 1, narrative: '' },
      extractionNotes: 'Per-page PDF content-stream decoding with ToUnicode CMaps. Prior Verum Omnis report: 5 page(s) (1, 2, 3, 4, 5) carry a Verum Omnis report masthead or that report\'s running title. A Verum Omnis report bound into a bundle is analysis, not evidence, and was excluded from contradiction scanning; the exhibits that follow it were scanned.',
      ocrPages: [7, 8], images: {}, generatedAt: '2026-09-27T06:23:53.572Z'
    };
    const quiet = console.log; console.log = () => {};
    let T, N;
    try {
      T = await pageText(await R.build(opts));
      N = await pageText(await R.buildHumanReport(Object.assign({}, opts, { humanSections: {}, humanProvenance: { sectionsAttempted: 7 } })));
    } finally { console.log = quiet; }
    // Headings also appear in the table of contents: read from the LAST occurrence (the section itself).
    const slice = (from, to) => { const a = T.lastIndexOf(from); const b = to ? T.indexOf(to, a + 1) : -1; return a < 0 ? '' : T.slice(a, b > a ? b : undefined); };
    ok(/TRIPLE VERIFICATION SUMMARY/.test(T) && !/DOMAIN_TYPO/.test(slice('TRIPLE VERIFICATION SUMMARY', 'SEALED FINDINGS')) && /Numerical Discrepancy/.test(slice('TRIPLE VERIFICATION SUMMARY', 'SEALED FINDINGS')),
      'the Triple Verification table carries engine findings only — an AI candidate never reads "Detected: PASS"');
    ok(!/DOMAIN_TYPO/.test(slice('Most serious findings:', 'Recommended next steps')), 'an AI candidate is never among the most serious findings');
    ok(!/DOMAIN_TYPO/.test(slice('NINE-BRAIN EXTRACTION FINDINGS', 'TRIPLE VERIFICATION SUMMARY')), 'an AI candidate is never a brain\'s finding');
    ok(/AI candidate, advisory — DOMAIN_TYPO/.test(T) && /AI candidate:\s+DOMAIN_TYPO/.test(T), 'where a candidate is listed beside findings it is labelled as one (type summary, evidence appendix)');
    ok(/matched by at least one anchored finding of a type that can evidence it/.test(T) && !/is evidenced in the record/.test(T) && !/: EVIDENCED/.test(T),
      'the offence-elements block says a matching finding is on the record, never that the element is evidenced');
    ok(/set aside before contradiction scanning/.test(T) && !/Every page of this bundle was read\./.test(T) && /Prior Verum Omnis report: 5 page/.test(T),
      'excluded pages are disclosed on the unread-pages page; "every page was read" is never printed beside an exclusion');
    ok(!/[　-鿿]/.test(T), 'the report\'s own text reads back through the extractor without CJK');
    ok(/COURT-READY NARRATIVE REPORT/.test(N) && (N.match(/PAGES READ THROUGH OCR/g) || []).length === 1, 'the court-ready narrative prints the OCR-provenance block once (' + (N.match(/PAGES READ THROUGH OCR/g) || []).length + ')');
    const nAnchor = N.slice(N.lastIndexOf('STATUTORY ANCHORING'), N.lastIndexOf('CANDIDATE OFFENCE MATRIX'));
    ok(nAnchor.length > 0 && !/DOMAIN_TYPO/.test(nAnchor) && /Numerical Discrepancy/.test(nAnchor) && /AI candidate:\s+DOMAIN_TYPO/.test(N),
      'the narrative maps engine findings to candidate law and labels the AI candidate in its appendix');
    // 16k. A dot glued to a letter is inside a token, whatever the quote pairing around it.
    const joined = R._splitSentences('Finding F1 (CT02, severity 4), recorded at Page 45 vs Page 64, states: ""amount" is stated as R116 and as R 8000 (variance: 194%)" [F1]. Finding F3 (CT37, severity 2), recorded at Pages 39, 44, states: "Multiple email domains: standardbank.co.za, gmail.com, verumglobal.foundation" [F3].').join(' | ');
    ok(/standardbank\.co\.za, gmail\.com, verumglobal\.foundation/.test(joined), 'domain names survive the sentence split beside a nested straight quote (' + joined.slice(-120) + ')');
  };
  await run();
}

// ---- §17 The evidence-bundle-4-docs run (2026-10-01) ----------------------------
// A 651-page bundle of previously sealed exhibits (franchise agreements, an
// MOU, affidavits, a consumer complaint, extracts prepared on the seal date).
// The sealed report carried 44 findings; an outside review could support one.
// Underneath: the platform's own seal footer read as a stated date on every
// page, OCR variants of clean registration numbers, a typeset quote pair the
// definition detector could not read, an "owner of certain Intellectual
// Property" paired with a lessee clause, pleading-form admissions, an OCR'd
// invoice's arithmetic, and an extract prepared after the fact read as the
// record. Each item below is pinned with the bundle's own text.
{
  const d03 = (b) => DET.D03_DETECT_DATE_INCONSISTENCY(b).filter(f => /Impossible date/.test(f.evidence));
  const foot = (id, n, tot, extra) => ' PRIVATE SEAL -- FREE TIER VERUM OMNIS SEALED ORIGINAL | Seal: ' + id + ' | SHA-512: 65c44f59360eb272... | 30/09/2026 15:41:47 Africa/Johannesburg | ' + n + '/' + tot + (extra || '') + ' verumglobal.foundation | OpenTimestamps | Patent Pending VERUM OMNIS SEALED ORIGINAL scan the code or verify at verumglobal.foundation/verify.html';

  // 17a. Seal furniture is not evidence.
  const footer = 'VERUM OMNIS SEALED ORIGINAL — scan the code or verify at verumglobal.foundation/verify.html PRIVATE SEAL — FREE TIER verumglobal.foundation | OpenTimestamps | Patent Pending VERUM OMNIS SEALED ORIGINAL | Seal: VO-BDAC81AC7522 | SHA-512: bdac81ac75228843... | 30/09/2026 15:41:47 Africa/Johannesburg | 36/388';
  const stripped = E.voStripSealFurniture('Clause 3 applies. ' + footer + ' Clause 4 applies.');
  ok(!/30\/09\/2026|VO-BDAC|Johannesburg|VERIFY|PRIVATE SEAL|verify\.html|OpenTimestamps|Patent Pending/.test(stripped) && /Clause 3 applies\.\s+Clause 4 applies\./.test(stripped),
    'the seal footer (seal id, hash, date and time, page count, verify line, tier line) is removed and the record\'s own words stay (' + JSON.stringify(stripped) + ')');
  const so = E.voStripSealFurniture('[OCR] VERUM OMNIS SEALED ORIGINAL I Seal: VO-BDAC81AC7522 I SHA-512: bdac81ac75228843... I 0/09/2026 15:41:47 Africa/Johannesburg I 36/388 Dear Sir, the lease commenced on 1/8/2001.');
  ok(/^\[OCR\]/.test(so) && !/0\/09\/2026|Johannesburg/.test(so) && /commenced on 1\/8\/2001/.test(so), 'an OCR-mangled stamp ("0/09/2026 15:41:47", pipes read as I) goes too; the [OCR] prefix and the record\'s own date stay');
  ok(d03(['[OCR] printed 0/09/2026 15:41:47 by the seal']).length === 0 && d03(['[OCR] VO-BDAC81AC7522 I SHA-512: bdac81ac75228843... I 30/0/2026 l5:41:47 Africa/Johanne5burg']).length === 0 && d03(['Signed on 31/02/2021 at Durban.']).length === 1,
    'a date with a zero day or month is OCR damage, not an impossible date, whatever OCR did to the clock time; a real impossible date still fires');
  ok(d03(['From: fraud@bank.co.za Sent: 31/02/2024 14:32 To: client Subject: Your account']).length === 1, 'an impossible date in the record\'s own timestamped line (a forged email header) is still a finding — only a seal stamp is skipped');
  const bankLine = E.voStripSealFurniture('15/03/2024 10:30 POS purchase R1 250.00 Makro; sealed VERUM OMNIS SEALED ORIGINAL | Seal: VO-BDAC81AC7522 | SHA-512: bdac81ac75228843... | 30/09/2026 15:41:47 Africa/Johannesburg | 36/388');
  ok(/15\/03\/2024 10:30 POS purchase/.test(bankLine) && !/30\/09\/2026/.test(bankLine), 'stripping takes the seal stamp and leaves the record\'s own timestamped line');
  ok(E.voIsStampContext('x | SHA-512: bdac81ac75228843... | 30/09/2026 15:41:47 Africa/Johannesburg', 44, 10) === true && E.voIsStampContext('Sent: 31/02/2024 14:32 To: client', 6, 10) === false, 'stamp context is the footer\'s own words, not any clock time');
  const nested = [];
  for (let p = 1; p <= 5; p++) nested.push('exhibit A page ' + p + '.' + foot('VO-AAAAAAAAAAAA', p, 5));
  for (let p = 1; p <= 3; p++) nested.push('exhibit B page ' + p + '.' + foot('VO-BBBBBBBBBBBB', p, 3));
  const segsBefore = E.voCacheDocSegs(nested);
  const changed = E.voStripSealFurnitureBlocks(nested);
  ok(segsBefore.length === 2 && changed === 8 && E.voDetectDocuments(nested) === segsBefore && !/VO-AAAA|30\/09\/2026/.test(nested[0]) && /exhibit A page 1\./.test(nested[0]),
    'the boundaries are read from the footers before the footers go, and the same array returns them from the cache afterwards');
  ok(E.voExtractDates('Seal: VO-BDAC81AC7522 | SHA-512: bdac81ac75228843... | 30/09/2026 15:41:47 Africa/Johannesburg and signed on 12/08/2024').join('|') === '12/08/2024' && E.voExtractDates('Sent: 12/03/2024 09:15 and signed on 12/08/2024').join('|') === '12/03/2024|12/08/2024',
    'the date extractor skips a seal stamp and keeps the record\'s own timestamped dates');

  // 17b. CT20: an identity field, and OCR variants of a clean number.
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['Registration number CK 91/25755/23 of the close corporation.'], 'CT20').length === 0, 'the close-corporation short form CK YY/NNNNN/NN is a valid registration number');
  const ckTwin = DET.D11_DETECT_REGISTRATION_FAKE(['Caltex Oil (SA) (Pty) Ltd, registration number CK 91/25755/23, trading as Wallers Garage.', '[OCR] Registration number 1991 1 G25755/ as printed on the invoice.']);
  ok(ckTwin.filter(f => !f.contextOnly).length === 0 && ckTwin.some(f => f.contextOnly && /variants of a number printed cleanly elsewhere/.test(f.evidence)), 'an OCR reading of a CK number is repaired against its long-form twin (' + ckTwin.map(f => (f.contextOnly ? 'NOTE ' : 'FIND ') + f.evidence.slice(0, 60)).join(' | ') + ')');
  const ct20 = (b) => of(DET.D11_DETECT_REGISTRATION_FAKE, b, 'CT20').filter(f => !f.contextOnly);
  const idF = ct20(['ID/Registration number of complainant 510209 5091087']);
  const idT = ct20(['ID/Registration number of complainant 510209 5091 0']);
  // Since 5 October 2026 (Combine 06 April 2026) an identity number in a person's
  // ID/registration field is an engine note, not a Low finding: it is what the field asks for.
  const idNote = (b) => DET.D11_DETECT_REGISTRATION_FAKE(b).filter(f => f.contextOnly && /identity number/.test(f.evidence));
  ok(idF.length === 0 && idT.length === 0 && idNote(['ID/Registration number of complainant 510209 5091087']).length === 1 && idNote(['ID/Registration number of complainant 510209 5091 0']).length === 1,
    '"ID/Registration number of complainant 510209 5091087" is an identity number (an engine note, not a finding), even when OCR cut it short — never "not a valid format"');
  const twins = ['MEMORANDUM OF UNDERSTANDING BRIGHT IDEA PROJECTS 66 PTY (LTD) t/a ALL FUELS Registration Number 2012/226353/07 (Represented herein by Zeyd Timol duly authorised)', '[OCR] Registration number 20121226353/07 as per the letterhead; CIPC 200205930923; Reg. No. 1811100115407', 'Registration Number 2002/059909/23 and Registration Number 1911/001154/07'];
  ok(ct20(twins).length === 0, 'OCR variants of numbers printed cleanly elsewhere in the bundle are not findings');
  const repairs = DET.D11_DETECT_REGISTRATION_FAKE(twins).filter(f => f.contextOnly);
  ok(repairs.length === 1 && /20121226353\/07 \(p\.2\) reads as 2012\/226353\/07/.test(repairs[0].evidence) && /1811100115407 \(p\.2\) reads as 1911\/001154\/07/.test(repairs[0].evidence), 'the repairs are disclosed as a note (' + (repairs[0] && repairs[0].evidence) + ')');
  const nearText = ct20(['Chevron South Africa (Proprietary) Limited Registration Number 1911/001154/07.', 'SUBJECT to the following condition, imposed by and in favour of Chevron South Africa (Proprietary) Limited Registration Number 1911/0001154/07 (Transferor)']);
  ok(nearText.length === 1 && nearText[0].severity === 2 && /one digit off/.test(nearText[0].evidence), 'on native-text pages a one-digit discrepancy beside the clean number is still the Low "one digit off" check — the record printed those characters');
  const garbled = DET.D11_DETECT_REGISTRATION_FAKE(['[OCR] Registration number 1991 1 G25755/ as read from the scan', '[OCR] Registration number 1991/ 025755 (Pty) Ltd', 'Registration Number 2002/059909/23']);
  ok(garbled.filter(f => !f.contextOnly).length === 0 && garbled.some(f => f.contextOnly && /could not be read reliably/.test(f.evidence) && /1991 1 G25755/.test(f.evidence)), 'a garbled number on an OCR page with no clean twin is an unreadable note, never a finding');
  ok(ct20(['Registration No: 2002/05990/2 as stated on the letterhead.']).length === 1, 'a malformed number on a native-text page with no clean twin still fires');
  const idOcr = DET.D11_DETECT_REGISTRATION_FAKE(['[OCR] ID/Registration number of complainant 2012226353071', 'Registration Number 2012/226353/07']);
  ok(idOcr.some(f => f.contextOnly && /identity number/.test(f.evidence)) && !idOcr.some(f => !f.contextOnly) && !idOcr.some(f => f.contextOnly && /reads as/.test(f.evidence)), 'an identity number under an ID/Registration field is never "repaired" into a nearby company number');
  const nearest = DET.D11_DETECT_REGISTRATION_FAKE(['[OCR] Registration Number 2012/226353/01', '[OCR] Reg No. 20121226353/07 and again Reg No. 20121226353/07', 'Registration Number 2012/226353/07']).filter(f => f.contextOnly);
  ok(nearest.length === 1 && /20121226353\/07 \(p\.2\) reads as 2012\/226353\/07/.test(nearest[0].evidence) && (nearest[0].evidence.match(/reads as/g) || []).length === 1, 'the twin is the nearest clean number from a text page, listed once (' + (nearest[0] && nearest[0].evidence) + ')');

  // 17c. CT08: a typeset quote pair, and the inside of a quoted term.
  ok(ct08(['1.1.24 "Astron Motor Fuel\' means each Motor Fuel supplied by the Franchisor to the Franchisee, or made available for supply to the Franchisee, from time to time under this Agreement;', '1.1.58 " Motor Fuel\' means petrol, diesel, liquefied petroleum gas and any other products which are or may be used in propelling road vehicles;']).length === 0,
    '"Astron Motor Fuel\' and " Motor Fuel\' (opening " closing \') are two terms, not two definitions of "motor fuel\'"');
  ok(ct08(['1.1.47 "Franchised Business" means the conduct of a Astron Motor Fuel Franchise for the sale and/or provision of Motor Fuel and Lubricants', '"Market Value of the Franchised Business\' means the price a willing independent arm\'s-length purchaser is prepared to pay for the Franchised Business']).length === 0,
    'the inside of a longer quoted term ("Market Value of the Franchised Business") is not the term "franchised business"');
  const exp = ct08(['"Expiration Date\' means 31 December 2024, the day on which the lease ends and the premises are vacated', '"Expiration Date" means 30 June 2025 or such later date as the parties agree in writing']);
  ok(exp.length === 1 && /expiration date/.test(exp[0].evidence), 'a term defined twice with different wording still fires through a mismatched quote pair');
  const poss = ct08(['"Franchisee\'s Equipment" means the pumps, tanks and dispensers installed by the Franchisee at its own cost', '"Franchisee\'s Equipment" means only the signage supplied by the Franchisor under schedule B of the agreement']);
  ok(poss.length === 1 && /franchisee's equipment/.test(poss[0].evidence), 'a possessive apostrophe inside a quoted term does not close it (' + (poss[0] && poss[0].evidence.slice(0, 60)) + ')');
  const plural = ct08(['1.1 "Shareholders\' Agreement" means the agreement between the shareholders dated 1 March 2019 governing voting and transfers.', '9.4 "Shareholders\' Agreement" means only the memorandum of incorporation and nothing signed between the shareholders.']);
  const curly = ct08(['1.1 \u201CLessees\u2019 Improvements\u201D means every structure the lessees erected on the premises at their own cost.', '9.4 \u201CLessees\u2019 Improvements\u201D means only the signage the lessor approved in writing under annexure B.']);
  ok(plural.length === 1 && /shareholders' agreement/.test(plural[0].evidence) && curly.length === 1 && /lessees\u2019 improvements/.test(curly[0].evidence), 'a plural possessive inside a matched quote pair is not a closing quote (straight and curly)');
  ok(ct08(['1.1.24 "Astron Motor Fuel means each Motor Fuel supplied by the Franchisor to the Franchisee from time to time;', '1.1.58 "Motor Fuel\' means petrol, diesel, liquefied petroleum gas and any other products used in propelling road vehicles;']).length === 0, 'a dropped closing quote does not turn the inside of a term into a term of its own');
  const fb = '1.1.47 "Franchised Business" means the conduct of a Astron Motor Fuel Franchise for the sale and/or provision of Motor Fuel and Lubricants from the Premises';
  const mv = 'means the price a willing independent arm\'s-length purchaser is prepared to pay for the Franchised Business as a going concern';
  ok(ct08([fb, '1.1.53 "Market Value of the Franchised Business ' + mv]).length === 0 && ct08([fb, '1.1.53 "Market Value of the Franchised\nBusiness ' + mv]).length === 0 && ct08([fb, "1.1.53 ''Market Value of the Franchised Business " + mv]).length === 0 && ct08([fb, "1.1.53 ' Market Value of the Franchised Business " + mv]).length === 0 && ct08([fb, '1.1.53 `Market Value of the Franchised Business ' + mv]).length === 0,
    'the p.300 shape — a closer OCR dropped, the term wrapped, an opener drawn as two apostrophes, an apostrophe and a space, or a backtick — never reads "franchised business" as a term');
  ok(ct08(['In terms of clause 1.36 of the Franchise Agreement, "Goodwill" means the goodwill arising out of the use of the Franchised Business by the Franchisor and all Caltex outlets.', '1.1.50 "Goodwill\' means the established reputation of a business regarded as a quantifiable asset and calculated as part of its value when it is sold.']).length === 0, 'a definition a pleading cites from another instrument is not the document\'s own definition');
  ok(ct08(['In terms of clause 1.36 of the Franchise Agreement,\n"Goodwill" means - The goodwill arising out of the use of the Franchised Business, the Business System and Intellectual Property by the Franchisor and all Caltex outlets.', '1.1.50 "Goodwill\' means the established reputation of a business regarded as a quantifiable asset and calculated as part of its value when it is sold.']).length === 0, 'the citation guard reads across a line break (the real p.81 wording)');

  // 17d. CT44: the ownership half is about the premises, the same side, the same document.
  const ct44 = (b) => of(DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED, b, 'CT44');
  const headLease = 'in the event that the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired.';
  ok(ct44([headLease, 'Astron carries on business in the Area, and is the owner of certain Intellectual Property used in the Franchised Business.']).length === 0, '"is the owner of certain Intellectual Property" is not ownership of the premises');
  ok(ct44([headLease, 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 1, 'the franchise-lease control still fires');
  ok(ct44(['3.5 The Franchisee is not the owner of the Premises, but is the lessee in terms of a Lease with Palmbili Properties Investments (Pty) Ltd. Accordingly, should the Lease terminate for any reason, then this Agreement shall terminate.', 'BRIGHT IDEA PROJECTS 66 (PTY) LTD t/a ALL FUELS (hereinafter referred to as THE FRANCHISOR/OWNER) is: a duly appointed Branded Marketer of Astron and a wholesaler and distributor of petroleum products carrying the Astron Energy/Caltex brand and logo, AND the owner of the immovable property described as Erf 123 Port Edward']).length === 0,
    'a franchisee\'s lessee clause and a recital that the franchisor owns a property are two sides, not a trap');
  const twoDocs = [];
  for (let p = 1; p <= 3; p++) twoDocs.push((p === 1 ? headLease : 'schedule page ' + p + '.') + foot('VO-AAAAAAAAAAAA', p, 3));
  for (let p = 1; p <= 3; p++) twoDocs.push((p === 1 ? 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.' : 'annexure page ' + p + '.') + foot('VO-BBBBBBBBBBBB', p, 3));
  ok(ct44(twoDocs).length === 0, 'a lessee clause in one stated document and a side-less ownership line in another are never paired');
  // The first object the clause names decides; OCR shapes; deeds; the p.78 line; a same-side recital pairs across documents.
  ok(ct44([headLease, 'Astron carries on business in the Area, and is the owner of certain Intellectual | Property used in the Franchised Business.']).length === 0, 'an OCR column rule inside "Intellectual | Property" does not make it premises');
  ok(ct44([headLease, 'Astron carries on business in the Area, and is the owner of certain lntellectual Property used in the Franchised Business.']).length === 0, 'OCR\'s "lntellectual Property" is still intellectual property');
  ok(ct44([headLease, 'The Franchisor is the owner of all right, title and interest in and to the Intellectual Property and the Business System.']).length === 0, '"owner of all right, title and interest in and to the Intellectual Property" is not ownership of premises however far out the words sit');
  ok(ct44([headLease, 'The Franchisor owns the premises, the equipment and the stock in trade, and has let the premises to the Franchisee.']).length === 1, '"owns the premises, the equipment and the stock" is ownership of the premises (the first object decides)');
  ok(ct44([headLease, 'At the time, the Complainant entered into a Franchise Agreement with Caltex Oil (SA) (Pty) Ltd, along with a Lease Agreement, as Caltex Oil (SA) (pty) Ltd was also the owner of property on which the business was operated.']).length === 1, '"the owner of property on which the business was operated" (p.78) is ownership of the premises');
  ok(ct44([headLease, 'The Franchisor took transfer on 14 May 2014 under Deed of Transfer T12345/2014 registered in the Pietermaritzburg Deeds Registry.']).length === 1, 'a deed of transfer names immovable property by itself');
  ok(ct44([headLease, 'The Franchisor took transfer of the business and its goodwill on 14 May 2014.']).length === 0, '"took transfer of the business" is not a transfer of premises');
  ok(ct44([headLease, 'The Franchisor became the owner of the business premises in 2014.']).length === 1 && ct44([headLease, 'The Franchisor became the owner of the business in 2014.']).length === 0, '"business premises" are premises; "the business" is not');
  const pref = ct44([headLease, 'Caltex Oil (SA) (Pty) Ltd was also the owner of property on which the business was operated.', 'All Fuels is a supplier of fuel and the Owner/Lessor of the site from which the Operator trades.']);
  ok(pref.length === 1 && pref[0].location === 'Page 1 vs Page 3', 'an ownership half on the clause\'s own side is preferred over a side-less one (' + (pref[0] && pref[0].location) + ')');
  const twoDocsSide = [];
  for (let p = 1; p <= 3; p++) twoDocsSide.push((p === 1 ? headLease : 'schedule page ' + p + '.') + foot('VO-AAAAAAAAAAAA', p, 3));
  for (let p = 1; p <= 3; p++) twoDocsSide.push((p === 1 ? 'BRIGHT IDEA PROJECTS 66 (PTY) LTD t/a ALL FUELS (hereinafter referred to as THE FRANCHISOR/OWNER) is: a duly appointed Branded Marketer of Astron, AND the owner of the immovable property described as LOT 967 Port Edward and has leased the said property to Palmbili Property Investments (Pty) Ltd under a Head Lease.' : 'annexure page ' + p + '.') + foot('VO-BBBBBBBBBBBB', p, 3));
  const xd = ct44(twoDocsSide);
  ok(xd.length === 1 && xd[0].severity === 4 && xd[0].location === 'Page 1 vs Page 4' && /different documents of the record: verify that they concern the same party/.test(xd[0].evidence), 'a recital in another document that the clause\'s own side (THE FRANCHISOR/OWNER) owns the premises pairs across documents, one step down and tagged to verify');
  ok(ct44([headLease, 'x', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.'])[0].severity === 5 && !/different documents/.test(ct44([headLease, 'x', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.'])[0].evidence), 'a pair within one document keeps its severity and carries no tag');
  ok(ct44([headLease, 'The Franchisee is the owner of the goodwill attaching to the premises.']).length === 0 && ct44([headLease, 'The Franchisee is the owner. The premises are let to it by the landlord.']).length === 0, 'goodwill is not premises, and the object must sit in the ownership sentence itself');
  // The termination language must sit on the clause's own page.
  const recitalOnly = 'the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party.';
  ok(ct44([recitalOnly, 'x', 'The agreement terminates on 31 July 2016.', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 0 && ct44([headLease, 'x', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 1, 'a head-lease recital with no termination consequence on its page or the next is not the trap, even when a later page says "terminates"');
  ok(ct44([recitalOnly, headLease, 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 1 && ct44(['3.2 the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease', 'terminates, then this Contract shall be deemed to have terminated or expired. 2. Rent.', 'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.']).length === 1, 'a recital before the clause never shadows it, and a clause split by a page break still fires');
  ok(E.voSnapWindow('The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement with', 6, 60) === 'FRANCHISOR is not the owner of the Premises, but is the Lessee', 'a quote window never starts or ends mid-word (' + E.voSnapWindow('The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement with', 6, 60) + ')');
  // No document boundaries: a side-less ownership line pairs only within twenty pages; further away it is a note.
  const farSideless = [headLease]; for (let p = 2; p <= 30; p++) farSideless.push('page ' + p + ' text.'); farSideless.push('Caltex Oil (SA) (Pty) Ltd was also the owner of property on which the business was operated.');
  const fs1 = DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED(farSideless);
  ok(fs1.length === 1 && fs1[0].contextOnly && /names no party role; whose ownership it records is not stated, so the two were not paired/.test(fs1[0].evidence) && fs1[0].location === 'Page 1 vs Page 31', 'without document boundaries, a side-less ownership line thirty pages from the clause is a note, not a finding (' + (fs1[0] && fs1[0].location) + ')');
  const farSide = [headLease]; for (let p = 2; p <= 30; p++) farSide.push('page ' + p + ' text.'); farSide.push('All Fuels is a supplier of fuel and the Owner/Lessor of the site from which the Operator trades.');
  const fs2 = ct44(farSide);
  ok(fs2.length === 1 && fs2[0].severity === 4 && /document boundaries could not be read and the two halves sit 30 pages apart/.test(fs2[0].evidence), 'without document boundaries, a same-side ownership line far from the clause pairs one step down and tagged to verify');

  // 17e. CT01: a pleading admits paragraphs, not facts.
  ok(ct01(['AD PARAGRAPH 13 190. I admit the contents of this paragraph. AD PARAGRAPH 14 191. The Respondent admits the opening sentence of this paragraph. On the remainder I have no knowledge.']).length === 0, '"I admit the contents of this paragraph" is the form of an answering affidavit, not an admission of fact');
  ok(ct01(['In my affidavit I admit that I signed the second agreement on 3 March 2019 without reading it, and I was wrong to do so.']).length === 1, 'a first-person admission of fact still fires');
  ok(ct01(['AD PARAGRAPH 7 7.1 I admit that I signed the Deed of Suretyship on 3 March 2019 and that I received the sum of R1 200 000 from the Plaintiff.']).length === 1, 'an admission of fact under an AD PARAGRAPH heading still fires (the heading alone is not the form)');
  const mixedAdm = ct01(['AD PARAGRAPH 13 190. I admit the contents of this paragraph. 191. I admit that I signed the acknowledgment of debt on 3 March 2019 and that the amount of R1 200 000 was never repaid.']);
  ok(mixedAdm.length === 1 && /signed the acknowledgment of debt/.test(mixedAdm[0].evidence), 'a form sentence does not hide a later admission of fact on the same page, and the sentence of fact is the one quoted');
  for (const form of ['I admit the allegations contained in this paragraph.', 'I admit the contents of paragraph 13.2 only.', 'I admit the contents of sub-paragraph 13.1.', 'I admit the contents hereof.', 'I admit paragraph 13.', 'I admit the correctness of the contents of this paragraph.', 'I admit the contents of paragraphs 13 to 15 insofar as they relate to the lease.', 'I admit the averments in paragraph 7 of the particulars of claim.', 'We admit the contents of the said paragraph.', 'I admit only the first sentence of this paragraph.'])
    ok(ct01([form]).length === 0, 'pleading form is skipped without a heading: "' + form + '"');
  ok(ct01(['I admit the contents of the letter dated 3 March 2019 and that I did not reply to it.']).length === 1, '"admit the contents of the letter" is an admission of fact, not of a paragraph');

  // 17f. CT15/CT22: one page, plausible figures, OCR cap.
  const d13 = (b) => DET.D13_DETECT_CALCULATION_ERROR(b);
  const badInv = d13(['Subtotal: R1161950 VAT: R1 Total: R1.08']);
  ok(badInv.filter(f => !f.contextOnly).length === 0 && badInv.some(f => f.contextOnly && /^Figures on page 1 do not read as one invoice \(subtotal R1161950, VAT R1, total R1\.08\): read the page before relying on any of them$/.test(f.evidence)), '"subtotal R1161950, VAT R1, total R1.08" is an unreadable invoice (a note stating the recognised figures, no guess about why), not an amount discrepancy');
  ok(d13(['[OCR] Subtotal: R1161950 VAT: R1 Total: R1.08']).some(f => f.contextOnly && /^Figures recognised on page 1 do not read as one invoice .*: read the page image before relying on any of them$/.test(f.evidence)), 'on an OCR page the note says the figures were recognised and sends the reader to the page image (p.397)');
  ok(d13(['Subtotal: R1,000.00 VAT: R150.00 Total: R1,250.00']).filter(f => f.type === 'CT15').length === 1, 'a plausible invoice whose total does not add up still fires');
  ok(d13(['Subtotal: R1,000.00 for the goods', 'VAT: R150.00 Total: R1,250.00']).filter(f => !f.contextOnly).length === 0, 'figures on different pages are never combined into one invoice');
  ok(E.voCapOcrFormatFindings([{ type: 'CT15', severity: 5, location: 'Page 397', evidence: 'Total mismatch' }, { type: 'CT22', severity: 4, location: 'Page 397', evidence: 'VAT mismatch' }], [397]).capped === 2, 'an invoice\'s arithmetic on an OCR page is held at reduced weight like every other figure');
  // Any contradiction anchored only on OCR-recovered pages is held below serious.
  const ocrOnly = [{ type: 'CT44', severity: 5, location: 'Page 9 vs Page 16', evidence: 'lessee vs owner' }, { type: 'CT01', severity: 4, location: 'Page 453, 462', evidence: 'admission' }, { type: 'CT37', severity: 3, location: 'Page 9', evidence: 'lookalike domain' }];
  const ocrOnlyRes = E.voCapOcrFormatFindings(ocrOnly, [9, 16, 453, 462]);
  ok(ocrOnlyRes.held === 2 && ocrOnlyRes.capped === 0 && ocrOnly[0].severity === 3 && ocrOnly[0].ocrCapped === true && /held below serious until the quoted wording is verified/.test(ocrOnly[0].evidence) && ocrOnly[1].severity === 3 && ocrOnly[2].severity === 3 && !ocrOnly[2].ocrCapped && ocrOnly[2].ocrAnchored === true, 'a CT44 or CT01 anchored only on OCR pages is held at severity 3 and tagged; a severity-3 finding is only counted apart');
  ok(E.voCapOcrFormatFindings([{ type: 'CT44', severity: 5, location: 'Page 9 vs Page 204', evidence: 'x' }], [9]).capped === 0, 'a contradiction with one half on a text page keeps its severity');
  // The VAT bound: a VAT line is zero or within a tenth to a quarter of the subtotal, whatever the total reads.
  ok(d13(['Subtotal R1161950.00 VAT R1 Total R1,336,242.50']).every(f => f.contextOnly) && d13(['Subtotal R1161950.00 VAT R1 Amount due R1,336,242.50']).every(f => f.contextOnly), '"VAT R1" against a subtotal of R1 161 950 is a note whether the total was read intact or not at all');
  // Figures as this country's documents print them.
  ok(d13(['Subtotal R 12 500.00\nVAT R 1 875.00\nTotal R 14 375.00']).length === 0, 'space-grouped thousands are read whole: a correct invoice is silent');
  const commaDec = d13(['Subtotal: R1 161 950,00 VAT: R174 292,50 Total: R1 336 242,60']);
  ok(commaDec.length === 1 && commaDec[0].type === 'CT15' && /R1336242\.5 but stated R1336242\.6/.test(commaDec[0].evidence), 'a comma decimal is read as a decimal and a ten-cent error in the total still fires (' + (commaDec[0] && commaDec[0].evidence) + ')');
  ok(d13(['Subtotal R1,000.00\nVAT 15% R150.00\nTotal R1,150.00']).length === 0 && d13(['Subtotal R1,000.00\nVAT 15 % R150.00\nTotal R1,150.00']).length === 0 && d13(['Subtotal R1,000.00\nVAT (@15%) : R150.00\nTotal R1,150.00']).length === 0, 'a rate written before the amount is a rate, not the VAT amount');
  ok(d13(['Tax Invoice No. 1234\nSubtotal R1,000.00\nVAT R150.00\nTotal R1,150.00']).length === 0, '"Tax Invoice No. 1234" is not a tax amount');
  ok(d13(['Subtotal R1,000.00\nVAT R140.00\nTotal R1,140.00']).length === 0 && d13(['Subtotal R1,000.00\nVAT R0.00\nTotal R1,000.00']).length === 0, 'the rate in force before April 2018 and a zero-rated supply are not VAT mismatches');
  ok(d13(['Subtotal R100.00\nDiscount R10.00\nVAT R13.50\nTotal R103.50']).length === 0, 'a discount line between the subtotal and the total changes the sum: the page is not checked');
  const vatOff = d13(['Subtotal: R1,000.00 VAT: R120.00 Total: R1,120.00']);
  ok(vatOff.length === 1 && vatOff[0].type === 'CT22' && /calculated R150\.00 at the standard rate \(R140\.00 at the rate in force before April 2018\) but stated R120\.00/.test(vatOff[0].evidence) && !/%/.test(vatOff[0].evidence), 'a VAT line at neither rate still fires, and the printed words carry no percentage');
  const pkgCap = [{ type: 'CT22', severity: 3, packageRule: 'FK13', location: 'Page 2', evidence: 'invoice splitting' }];
  ok(E.voCapOcrFormatFindings(pkgCap, [2]).capped === 0 && pkgCap[0].severity === 3 && pkgCap[0].ocrAnchored === true, 'a signed-package phrase rule on an OCR page is counted apart but never capped: it matched words, not characters');

  // 17g. A secondary source is an account of the record, not the record.
  const segs2 = [{ start: 1, end: 3, title: 'Franchise Agreement between Bright Idea Projects and Wayne Nel Motors' }, { start: 4, end: 6, title: 'Extract prepared 30 Sept 2026 - pages reproduced from the MOU' }];
  const secPages = E.voSecondaryPages(segs2, ['', '', '', 'Extract prepared 30 Sept 2026 - pages reproduced', '', '']);
  ok(JSON.stringify(secPages) === '[4,5,6]', 'a document titled as an extract prepared after the fact is secondary (' + JSON.stringify(secPages) + ')');
  const demo = E.voDemoteSecondarySource([
    { type: 'CT23', severity: 4, location: 'Page 5', evidence: 'The record states a signature is missing ("uncountersigned")' },
    { type: 'CT45', severity: 5, location: 'Page 2 vs Page 5', evidence: 'Goodwill recognised — yet denied' },
    { type: 'CT01', severity: 4, location: 'Page 2, 5', evidence: 'admission language appears on 2 pages' },
    { type: 'CT02', severity: 4, location: 'Page 2', evidence: '"total" is stated as R1 and as R2' }
  ], secPages);
  ok(demo.leads.length === 2 && demo.leads[0].type === 'CT23' && demo.leads[1].type === 'CT45' && demo.kept.length === 2 && demo.kept[0].type === 'CT01' && demo.kept[0].severity === 2 && /secondary source on p\. 5/.test(demo.kept[0].evidence) && demo.kept[1].severity === 4,
    'a finding wholly on the extract is a lead, a two-half finding with its denial on the extract is a lead (p.12 vs p.557), a list finding with one page there is held at reduced weight and tagged, an unrelated one is untouched');
  ok(E.voSecondaryPages([{ start: 1, end: 3, title: 'Lease agreement prepared by the Lessor\'s attorneys' }], ['Lease agreement prepared by the Lessor\'s attorneys. 1. Parties.', '', '']).length === 0, 'a primary instrument that says who prepared it is not an extract');
  // The primary record describes itself in the same words and is never secondary.
  const secOf = (title, head) => E.voSecondaryPages([{ start: 1, end: 3, title }], [head, '', '']).length;
  ok(secOf('TAX INVOICE No. 4471', 'TAX INVOICE No. 4471 Prepared for ABC Motors (Pty) Ltd on 12 March 2024. Subtotal: R1,000.00 VAT: R150.00 Total: R1,250.00') === 0, 'a tax invoice "prepared for … on 12 March 2024" is the record, not an extract');
  ok(secOf('QUOTATION Q-2024-118 prepared for Mr W Nel, 3 June 2024', 'QUOTATION Q-2024-118 prepared for Mr W Nel, 3 June 2024. Item 1 …') === 0, 'a quotation "prepared for" a customer is the record');
  ok(secOf('WAYNE NEL MOTORS (PTY) LTD ACCOUNTING POLICIES AND NOTES', 'WAYNE NEL MOTORS (PTY) LTD ACCOUNTING POLICIES AND NOTES The annual financial statements have been prepared on the historical cost basis.') === 0, '"accounting policies and notes … prepared on the historical cost basis" is the record');
  ok(secOf('SUMMARY OF SIGNIFICANT ACCOUNTING POLICIES', 'ANNUAL FINANCIAL STATEMENTS 2024. SUMMARY OF SIGNIFICANT ACCOUNTING POLICIES The financial statements have been prepared in accordance with IFRS') === 0, 'a "summary of significant accounting policies" inside financial statements is a heading of the record');
  ok(secOf('Notes on the record prepared by counsel, 30 September 2026', 'Notes on the record prepared by counsel, 30 September 2026. 1. The MOU …') === 3, '"notes on the record prepared by counsel" is secondary');
  ok(secOf('Chronology compiled by the complainant', 'Chronology compiled by the complainant. 2014: …') === 3 && secOf('Extract prepared 30 Sept 2026 - pages reproduced from the Deed of Lease', 'Extract prepared 30 Sept 2026 - pages reproduced from the Deed of Lease') === 3, 'a chronology compiled by a party and an extract reproducing pages of a deed are secondary (the deed named after the extract does not make it primary)');
  ok(secOf('Valuation report prepared by XYZ Valuers on 3 March 2024', 'Valuation report prepared by XYZ Valuers on 3 March 2024 for the premises at Erf 123') === 0, 'a valuation report prepared on a date is the record');
  // Variants of the sealed title; a primary noun before the extract names its source.
  for (const v of ['Franchise Agreement — Extract prepared 30 Sept 2026 - pages reproduced', 'Annexure FA7 to the Founding Affidavit: Extract prepared 30 Sept 2026 - pages reproduced from the MOU', 'Extract from Mr. Bentz\'s affidavit, prepared 30 Sept 2026', 'Extract of pp. 12-15 reproduced from the Deed of Lease', 'Commentary on the MOU, 30 September 2026', 'Extracted pages, prepared 30 Sept 2026', 'Summarised by counsel on 30 September 2026'])
    ok(secOf(v, v + '. 1. …') === 3, 'secondary: "' + v + '"');
  ok(secOf('Account summary', 'STANDARD BANK Account summary prepared on 2024-01-01 for account 123') === 0 && secOf('Basis of preparation', 'SUMMARY OF ACCOUNTING POLICIES Summary prepared on the historical cost basis') === 0, 'an account summary on a bank statement and a policies summary "prepared on the historical cost basis" are the record');
  // A quotation note and an AI-compiled page are accounts of the record (Document 5, p.444-449).
  ok(secOf('Here is the exact wording of the relevant portions of the Franchise Agreement', 'Here is the exact wording of the relevant portions of the Franchise Agreement: 3.5 The Franchisee …') === 3, '"Here is the exact wording of the relevant portions of …" is a quotation note, not the record');
  ok(secOf('Compiled by: Claude', 'Compiled by: Claude — the MOU in short. 1. …') === 3, 'a page compiled by an AI assistant is secondary wherever it sits in the bundle');
  // No stated documents: the file is tested from its first page; uncovered pages by their own head.
  const solo = E.voSecondarySegments([], ['Extract prepared 30 Sept 2026 - pages reproduced from the MOU', 'clause 7 … uncountersigned', 'clause 9']);
  ok(solo.length === 1 && solo[0].start === 1 && solo[0].end === 3, 'an extract sealed on its own is secondary from its first page to its last (' + JSON.stringify(solo) + ')');
  const orphan = E.voSecondarySegments([{ start: 1, end: 3, title: 'Deed of Lease' }, { start: 5, end: 7, title: 'MOU' }], ['Deed of Lease', '', '', 'Extract prepared 30 Sept 2026 - pages reproduced', 'MOU', '', '']);
  ok(orphan.length === 1 && orphan[0].start === 4 && orphan[0].end === 4, 'an orphan page between two documents is tested by its own head (' + JSON.stringify(orphan) + ')');
  ok(E.voSecondarySegments([], ['Lease agreement. 1. Parties', 'p2', 'Extract prepared 30 Sept 2026 - pages reproduced', 'Extract prepared 30 Sept 2026 - pages reproduced | 2', 'p5']).map(g => g.start + '-' + g.end).join(',') === '3-4', 'in a one-document file whose first page is primary, pages that announce themselves as an extract are secondary one by one');
  // A finding of two halves with either half on a secondary page is a lead; a list finding is capped.
  const twoHalf = E.voDemoteSecondarySource([{ type: 'CT45', severity: 4, location: 'Page 12 vs Page 557', evidence: 'recognised vs denied' }], [557]);
  ok(twoHalf.leads.length === 1 && twoHalf.kept.length === 0, '"Page 12 vs Page 557" with the denial on the extract is a lead, not a reduced-weight finding');
  const listed = E.voDemoteSecondarySource([{ type: 'CT01', severity: 4, location: 'Page 453, 462, 557', evidence: 'admission' }], [557]);
  ok(listed.kept.length === 1 && listed.kept[0].severity === 2 && listed.leads.length === 0, 'a list finding with one page on the extract is held at reduced weight');
  ok(JSON.stringify(E.voRulePagesOf('Page 451, 455 and 3 more')) === '[451,455]' && JSON.stringify(E.voRulePagesOf('Page 557 (clause 7)')) === '[557]', '"and 3 more" and "(clause 7)" are not pages');
  // A finding that lists more than eight pages carries them all in f.pages; every page test reads them.
  const tenPages = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const trunc = (pages) => ({ type: 'CT01', severity: 4, location: 'Page 4, 5, 6, 7, 8, 9, 10, 11 and 2 more', pages, evidence: 'admission language appears on 10 pages' });
  ok(JSON.stringify(E.voFindingPages(trunc(tenPages))) === JSON.stringify(tenPages) && JSON.stringify(E.voFindingPages({ location: 'Page 4, 5 and 2 more' })) === '[4,5]', 'voFindingPages reads the full page array when the location is truncated');
  ok(E.voDemoteSecondarySource([trunc(tenPages)], tenPages).leads.length === 1, 'a ten-page finding wholly on the extract is a lead although its location prints only eight pages');
  const mixedTrunc = E.voDemoteSecondarySource([trunc([2].concat(tenPages.slice(0, 9)))], tenPages);
  ok(mixedTrunc.kept.length === 1 && mixedTrunc.kept[0].severity === 2, 'a hidden primary page among the ten keeps it a reduced-weight finding, not a lead');
  const ocrTrunc = [trunc(tenPages)];
  E.voCapOcrFormatFindings(ocrTrunc, tenPages);
  ok(ocrTrunc[0].ocrAnchored === true, 'the OCR anchor test reads the full page array too');
  const RP = require('../forensic-report.js');
  ok(JSON.stringify(RP._pageNumbers('Page 453, 462 and 2 more')) === '[453,462]' && RP._isReducedWeight({ type: 'CT01', location: 'Page 453, 462 and 2 more', pages: [453, 462, 621, 637], evidence: 'x' }, [453, 462, 621, 637]) === true && RP._isReducedWeight({ type: 'CT01', location: 'Page 453, 462 and 2 more', pages: [453, 462, 621, 637], evidence: 'x' }, [453, 462, 621]) === false, 'the report\'s page parser drops "and 2 more" and prefers the full page array');
  // The reach on the sealed bundle: three consecutive stated documents headed "Extract prepared …" are secondary; F8 → lead, F2/F3 → leads, F5 → reduced weight.
  const reach = [];
  const seals = ['VO-AAAAAAAAAAAA', 'VO-BBBBBBBBBBBB', 'VO-CCCCCCCCCCCC', 'VO-DDDDDDDDDDDD'];
  for (let d = 0; d < 4; d++) for (let p = 1; p <= 3; p++) reach.push((p === 1 ? (d === 0 ? 'Deed of Lease between Bright Idea Projects and Wayne Nel Motors.' : 'Extract prepared 30 Sept 2026 - pages reproduced from the MOU.') : 'page ' + p + ' text, Goodwill: N/A, uncountersigned.') + foot(seals[d], p, 3));
  const reachSegs = E.voCacheDocSegs(reach);
  const reachSec = E.voSecondarySegments(reachSegs, reach);
  ok(reachSegs.length === 4 && reachSec.length === 3 && reachSec[0].start === 4 && reachSec[2].end === 12, 'three consecutive extract documents behind one deed are secondary from p.4 to p.12 (' + JSON.stringify(reachSec.map(g => g.start + '-' + g.end)) + ')');
  const reachDemo = E.voDemoteSecondarySource([
    { type: 'CT23', severity: 4, location: 'Page 8', evidence: 'uncountersigned' },
    { type: 'CT45', severity: 5, location: 'Page 2 vs Page 8', evidence: 'recognised vs denied' },
    { type: 'CT01', severity: 4, location: 'Page 2, 8', evidence: 'admission on 2 pages' }
  ], E.voSecondaryPages(reachSegs, reach));
  ok(reachDemo.leads.length === 2 && reachDemo.kept.length === 1 && reachDemo.kept[0].type === 'CT01' && reachDemo.kept[0].severity === 2, 'on that reach the signature lead and the goodwill pair are leads and the two-page admission is held at reduced weight');
  const secSegs = E.voSecondarySegments(segs2, ['', '', '', 'Extract prepared 30 Sept 2026 - pages reproduced', '', '']);
  ok(secSegs.length === 1 && secSegs[0].start === 4 && secSegs[0].end === 6 && /^Extract prepared 30 Sept 2026/.test(secSegs[0].title) && E.voSecondaryWhere(secSegs) === ' (p. 4-6: "Extract prepared 30 Sept 2026 - pages reproduced from the MOU")', 'the engine note names the secondary document and its page range (' + E.voSecondaryWhere(secSegs) + ')');

  // 17h. A finding is dated by its own words or by the quote\'s own sentence, never by the rest of the page.
  const blocksD = new Array(10).fill('');
  blocksD[2] = 'The lease commenced on 1 August 2001 and runs for ten years. The goodwill of the business is a quantifiable asset recognised by both parties. Signed at Durban on 12 December 2018 before a commissioner.';
  const fA = [{ type: 'CT45', severity: 5, evidence: 'Goodwill recognised: "The goodwill of the business is a quantifiable asset recognised by both parties" — yet denied elsewhere', location: 'Page 3' }];
  E.voAnchorEnrich(fA, blocksD);
  ok(JSON.stringify(fA[0].anchor.when) === '[]', 'a quote whose own sentence carries no date gets no date from the rest of the page (' + JSON.stringify(fA[0].anchor.when) + ')');
  const fC = [{ type: 'CT04', severity: 4, evidence: 'Billing after expiry: "runs for ten years" — yet invoices continue', location: 'Page 3' }];
  E.voAnchorEnrich(fC, blocksD);
  ok(fC[0].anchor.when.length === 1 && fC[0].anchor.when[0] === '1 August 2001', 'the quote\'s own sentence may date it, once (' + JSON.stringify(fC[0].anchor.when) + ')');
  const blocksE = ['', '', 'The agreement concluded between the parties at Durban on 12 March 2018, after lengthy negotiation between their respective attorneys, provides that goodwill of R3,800,000 is recognised as payable to the Lessee. No goodwill shall be payable to the Lessee per clause 4.5.2.'];
  const fE = [{ type: 'CT01', severity: 4, evidence: 'The document both affirms and negates "goodwill": "\u2026tive attorneys, provides that goodwill of R3,800,000 is recognised as payab\u2026" vs "\u2026see. No goodwill shall be payable to the Lessee per clause 4.5.2.\u2026"', location: 'Page 3' }];
  E.voAnchorEnrich(fE, blocksE);
  ok(fE[0].anchor.when.length === 1 && fE[0].anchor.when[0] === '12 March 2018', 'a quote wrapped in ellipses (the D01/D09/D27 shape) still keys on its own sentence for the date (' + JSON.stringify(fE[0].anchor.when) + ')');
  // Clause numbers are not dates, and a clause number never blocks the sentence fallback.
  ok(JSON.stringify(E.voExtractDates('see clause 7.2.19 and clause 12.3.2017 and C 1.1.50 and item 3.4.2019')) === '[]' && JSON.stringify(E.voExtractDates('The payment of 12.3.2017 was late')) === '["12.3.2017"]', '"clause 12.3.2017" and "C 1.1.50" are references; a bare dotted date with a four-digit year stands');
  const blocksF = ['', 'C 1.1.50 Goodwill means the goodwill of the business as valued on 3 August 2018 by the parties. Nothing else.'];
  const fF = [{ type: 'CT45', severity: 5, evidence: 'Goodwill recognised: "C 1.1.50 Goodwill means the goodwill of the business as valued" — yet denied', location: 'Page 2' }];
  E.voAnchorEnrich(fF, blocksF);
  ok(JSON.stringify(fF[0].anchor.when) === '["3 August 2018"]', 'a clause number in the evidence is not the finding\'s date and does not block the sentence fallback (' + JSON.stringify(fF[0].anchor.when) + ')');
  // A form page with no sentence boundary: the window closes to 160 characters each side.
  const form = 'Annexure E Regulation 35 National Consumer Commission Form ' + 'field value '.repeat(8) + 'ID/Registration number of complainant 510209 5091087 5 BEREA ROAD ' + 'field value '.repeat(40) + 'Date 25 JANUARY 2017 ' + 'field value '.repeat(10);
  const win = E.voSentenceAround(form, 'Registration number of complainant 510209');
  ok(win && win.length <= 380 && !/25 JANUARY 2017/.test(win), 'on a form page with no sentence boundary the quote\'s window is bounded and a far-off form date is not in it (' + (win && win.length) + ')');
  // The stamp's clock as OCR leaves it.
  for (const st of ['… | 30/09/2026 1S:41:47 Africa/Johannesburg | 12/388', '… | 30/09/2026 15 41 47 Africa/Johannesburg | 12/388', '… | 30/09/2026 l5.41.47 Africa/Johannesburg | 12/388', 'SHA-512: abcdef123456… | 30/09/2026 | 15:41:47 | 12/388', 'Seal: VO-BDAC81AC7522 30/09/2026 Africa/Johannesburg 12/388'])
    ok(JSON.stringify(E.voExtractDates(st)) === '[]', 'a stamp date is never a date however OCR left its clock: "' + st + '"');
  ok(JSON.stringify(E.voExtractDates('Sent: 12/03/2024 09:15 From: x@y.co')) === '["12/03/2024"]', 'a timestamped email header outside the footer keeps its date');
  // Single-quoted evidence can be dated by its sentence; the anchor reads the full page array.
  ok(JSON.stringify(E.voExtractQuotes("Term 'Franchised Business' defined twice: 'Astron Motor Fuel' means")) === '["Franchised Business","Astron Motor Fuel"]', 'single-quoted terms are quotes too (' + JSON.stringify(E.voExtractQuotes("Term 'Franchised Business' defined twice: 'Astron Motor Fuel' means")) + ')');
  const blocksG = ['', "The term 'Astron Motor Fuel' means fuel supplied under the agreement commencing on 1 August 2001. Another sentence."];
  const fG = [{ type: 'CT08', severity: 3, evidence: "Term defined twice: 'Astron Motor Fuel' means fuel supplied under the agreement", location: 'Page 2' }];
  E.voAnchorEnrich(fG, blocksG);
  ok(JSON.stringify(fG[0].anchor.when) === '["1 August 2001"]', 'a single-quoted term is dated by its sentence (' + JSON.stringify(fG[0].anchor.when) + ')');
  const fH = [{ type: 'CT01', severity: 4, evidence: 'admission on ten pages', location: 'Page 4, 5, 6, 7, 8, 9, 10, 11 and 2 more', pages: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }];
  E.voAnchorEnrich(fH, Array(14).fill('page text.'));
  ok(JSON.stringify(fH[0].anchor.where) === '[4,5,6,7,8,9,10,11,12,13]', 'the anchor reads the full page array of a truncated location (' + JSON.stringify(fH[0].anchor.where) + ')');
  ok(of(DET.D03_DETECT_DATE_INCONSISTENCY, ['[OCR] clause text. Seal: VO-BDAC81AC7522 | SHA-512: ab12cd34ef567890… | 31/02/2026 1S:41:47 Africa/Johannesburg | 7/388'], 'CT03').length === 0 && of(DET.D03_DETECT_DATE_INCONSISTENCY, ['Signed 31/02/2024 by hand.'], 'CT03').length === 1, 'D03 skips a stamp whose clock OCR garbled ("1S:41:47") and still reads an impossible date in the body');

  // 17i. Parties.
  ok(!E.voLooksLikePerson('Supreme Court') && !E.voLooksLikePerson('Service Station') && !E.voLooksLikePerson('Timol de') && !E.voLooksLikePerson('Auditors Name Postal Address') && E.voLooksLikePerson('Zeyd Timol') && E.voLooksLikePerson('E de Waal'),
    '"Supreme Court", "Service Station", "Timol de" and "Auditors Name Postal Address" are not parties; "Zeyd Timol" and "E de Waal" are');
  ok(E.voLooksLikePerson('Margaret Court') && E.voLooksLikePerson('Thanh Le') && E.voLooksLikePerson('Li Bin') && E.voLooksLikePerson('Johan Van Der Merwe') && !E.voLooksLikePerson('Johan Van Der') && !E.voLooksLikePerson('Robert De') && !E.voLooksLikePerson('High Court') && !E.voLooksLikePerson('Court Order') && !E.voLooksLikePerson('Constitutional Court'),
    '"Margaret Court", "Thanh Le", "Li Bin" and "Johan Van Der Merwe" are people; "Johan Van Der", "Robert De", "High Court", "Court Order" and "Constitutional Court" are not');
  // The sealed report's other false parties: labels, OCR variants, case titles, addresses, headings, defined terms.
  for (const bad of ['Registration Number', 'VAT REGISTRATION NUMBER', 'Limited Registration Number', 'Audifors Name Posts', 'Audifors Posts', 'Service Statlon', 'ADD DISBURSEMENTS I R', 'V BRIGHT IDEA PROJECTS', 'CENTURY CITY', 'Crompton Street', 'Franchise Interest', 'AD PARAGRAPH', 'Associates Tel', 'AS WITNESSES', 'Protection Act', 'Trade Secrets', 'Accounting Period', 'Approved Supplier', 'Branded Marketer', 'RAS Retail Margin', 'Operating Expenses Margin', 'BEREA ROAD', 'Derby Place', 'Lakeside Office Park', 'Zulu Natal', 'All Fuel'])
    ok(!E.voLooksLikePerson(bad), 'not a party: "' + bad + '"');
  for (const bad2 of ['First Respondent', 'Second Applicant', 'ASTRON MANUAL', 'Mls Eanes Rear']) ok(!E.voLooksLikePerson(bad2), 'not a party: "' + bad2 + '"');
  ok(E.voLooksLikePerson('Mrs Smith') && E.voLooksLikePerson('Dr Nel'), 'courtesy titles are not OCR debris');
  for (const good of ['J. P. Smith', 'Linda Park', 'Barnie Barnard', 'E de Waal', 'Sipho Dlamini'])
    ok(E.voLooksLikePerson(good), 'still a party: "' + good + '"');
  ok(E.voExtractParties('Seton Smith & Associates\n\nTel 021 556 2322').every(p => p.name !== 'Associates Tel') && E.voExtractParties('1.1.59 "New to All Fue/s/Caltex" means an All Fuel outlet').every(p => !/^All Fue/.test(p.name)), 'a name never spans a line break, and one cut by a slash is a fragment');
  // A run with a stop word is trimmed to the name, never dropped whole.
  const trimA = E.voExtractParties('Name: Zeyd Timol Postal Address: 12 Main Road');
  ok(trimA.some(p => p.name === 'Zeyd Timol') && !trimA.some(p => /Main Road|Postal/.test(p.name)), '"Name: Zeyd Timol Postal Address: 12 Main Road" binds "Zeyd Timol" and nothing else (' + JSON.stringify(trimA.map(p => p.name)) + ')');
  ok(E.voExtractParties('Zeyd Timol Supreme Court application').some(p => p.name === 'Zeyd Timol') && E.voExtractParties('Name: Zeyd Timol Postal Code 4001').some(p => p.name === 'Zeyd Timol'), '"Zeyd Timol Supreme Court" and "Zeyd Timol Postal Code" bind "Zeyd Timol"');
  ok(E.voTrimPersonName('Zeyd Timol de') === 'Zeyd Timol' && E.voTrimPersonName('Timol de') === '' && E.voTrimPersonName('Johan Van Der Merwe') === 'Johan Van Der Merwe' && E.voTrimPersonName('Zeyd Timol Service Station') === 'Zeyd Timol', 'a particle cut at a line end is trimmed, a stop phrase is cut, a lone surname is not a party');
  ok(E.voExtractPersonsFromContext('From: Zeyd Timol de\nVilliers <z@x.com>', 6).some(p => p.name === 'Zeyd Timol'), 'a line-wrapped particle name still binds its first two tokens from an email header');
  ok(E.voLooksLikePerson('Jennifer High') && E.voLooksLikePerson('Peter Station') && !E.voLooksLikePerson('Service Station') && !E.voLooksLikePerson('Police Station') && !E.voLooksLikePerson('High Court'), '"high" and "station" are stop phrases, not tokens: "Jennifer High" and "Peter Station" are people');
  const ptys = E.voExtractParties('Johan Van Der Merwe signed for the Lessee and Margaret Court for the Lessor.');
  ok(ptys.some(p => p.name === 'Johan Van Der Merwe') && ptys.some(p => p.name === 'Margaret Court'), 'a four-token particle name and a surname that is also a word are bound from the evidence (' + JSON.stringify(ptys) + ')');

  // 17j. The report and the narrative, rendered and read back.
  const fs = require('fs'), path = require('path');
  const g = globalThis; g.window = g; g.self = g;
  if (!g.PDFLib) new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
  const PDFLib = g.PDFLib;
  const R = require('../forensic-report.js');
  const pageText = async (bytes) => {
    const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const parts = [];
    for (let i = 0; i < loaded.getPageCount(); i++) parts.push((await E.extractPageText(bytes, i, loaded)).join(' '));
    return parts.join(' \n ').replace(/[ \t]+/g, ' ');
  };
  const jur0 = { home: 'ZA', foreign: [], isCrossBorder: false };
  const ct22Law = R._statutesForFinding({ type: 'CT22' }, jur0).map(x => x.provisions.join('; ')).join(' ');
  const ct18Law = R._statutesForFinding({ type: 'CT18' }, jur0).map(x => x.provisions.join('; ')).join(' ');
  const ct44Law = R._statutesForFinding({ type: 'CT44' }, jur0).map(x => x.provisions.join('; ')).join(' ');
  ok(/theft/.test(ct22Law) && !/Organised Crime|Financial Intelligence|Corrupt/.test(ct22Law) && /Organised Crime/.test(ct18Law), 'an arithmetic finding is not money laundering; a bank-detail finding keeps the diversion statutes');
  ok(/Common law of contract/.test(ct44Law) && /Petroleum Products Act/.test(ct44Law) && !/Rental Housing|racketeering/.test(ct44Law), 'a contract finding names no residential-tenancy statute and no racketeering provision');
  ok(/held at reduced weight/.test(R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x' }, { type: 'CT03', severity: 2, evidence: 'y [OCR page: weight reduced until the quoted characters are verified against the page image]' }], true)) && R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x' }], true) === '1 finding' && R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x' }], false) === '1 finding',
    'the count phrase tells reduced-weight findings apart and is unchanged when there are none');
  const uncapped = R._voCountPhrase([{ type: 'CT44', severity: 5, evidence: 'lessee clause vs owner', location: 'Page 7' }], true, [7]);
  ok(/^1 finding: 0 at full weight, and 1 anchored only on OCR-recovered pages or on a secondary source, whose quoted wording is to be verified/.test(uncapped) && !/held at reduced weight/.test(uncapped), 'an uncapped finding on a scanned page is counted apart without any claim that its weight was reduced (' + uncapped + ')');
  const mixedCap = R._voCountPhrase([{ type: 'CT44', severity: 5, evidence: 'x', location: 'Page 7' }, { type: 'CT20', severity: 2, ocrCapped: true, evidence: 'y', location: 'Page 7' }, { type: 'CT02', severity: 4, evidence: 'z', location: 'Page 2' }], true, [7]);
  ok(/3 findings: 1 at full weight, and 2 anchored only on OCR-recovered pages[^(]*\(1 of them held at reduced weight by the engine\)/.test(mixedCap), '"held at reduced weight" is said only of the finding the engine capped (' + mixedCap + ')');
  ok(/2 findings: 1 at full weight, and 1 anchored only on OCR-recovered pages/.test(R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x', location: 'Page 2' }, { type: 'CT20', severity: 2, evidence: 'identity number', location: 'Page 7' }], true, [7])),
    'a severity-2 finding anchored only on an OCR page is counted apart even without the cap tag');
  ok(E.voCapOcrFormatFindings([{ type: 'CT20', severity: 2, location: 'Page 7', evidence: 'identity number' }], [7]).capped === 0, 'the cap leaves a severity-2 finding alone');
  const run = async () => {
    const findings = [
      { type: 'CT44', severity: 5, evidence: 'Termination/expiry rests on a lessee-only clause (party not the owner): "the FRANCHISOR is not the owner of the Premises but is the Lessee" — yet the record shows the party had become the owner of the premises: "became the registered owner of the premises"', location: 'Page 2 vs Page 5', anchor: { where: [2, 5], who: [], when: [] } },
      { type: 'CT20', severity: 2, ocrCapped: true, evidence: 'A number labelled as a registration is not a valid SA registration format (expected YYYY/NNNNNN/NN or CK…): "Registration number 12AB" [OCR page: weight reduced until the quoted characters are verified against the page image]', location: 'Page 7', anchor: { where: [7], who: [], when: [] } },
      { type: 'CT22', severity: 4, evidence: 'VAT mismatch: calculated R150.00 but stated R120.00', location: 'Page 9', anchor: { where: [9], who: [], when: [] } }
    ];
    const opts = {
      documents: [{ name: 'evidence-bundle-4-docs.pdf', pageCount: 651, sha512: 'cd'.repeat(64), sealId: 'VO-A301D0F8A06F' }],
      findings: { clean: false, overallScore: 40, confidence: 'LOW', totalFindings: 3, findings: findings, summary: '3 page-anchored findings established.', contradictionTypesUsed: 3, footerOnlyPages: [43, 45] },
      aiReview: { applied: true, retained: 3, assessed: 6, dropped: 3, added: 0, narrative: '' },
      extractionNotes: 'Per-page PDF content-stream decoding with ToUnicode CMaps. Anchor rule: 1 observation(s) could not be pinned to a page and are recorded here as unanchored observations, NOT as findings (no anchor, no sentence): [CT15] 5 of 6 amounts are suspiciously round (multiples of 1000) Engine notes (1): Page 397: Figures recognised on page 397 do not read as one invoice (subtotal R1161950, VAT R1, total R1.08): read the page image before relying on any of them Score calibration: confidence-weighted.',
      contextNotes: [{ type: 'CT22', location: 'Page 397', text: 'Figures recognised on page 397 do not read as one invoice (subtotal R1161950, VAT R1, total R1.08): read the page image before relying on any of them' }],
      ocrPages: [7], images: {}, generatedAt: '2026-09-30T20:59:16.000Z'
    };
    const quiet = console.log; console.log = () => {};
    let T, N;
    try {
      T = await pageText(await R.build(opts));
      N = await pageText(await R.buildHumanReport(Object.assign({}, opts, {
        humanSections: {
          counter_narratives: { provenance: 'ai', text: 'The respondent may have signed the lease under pressure from the franchisor.\n\nThis account conflicts with the record at p. 7, which states "Commencement Date 1/8/2001". Assessment: contradicted by the record at p. 7.\n\nThe franchisor states that the lease commenced on 1 August 2001 and ran its full term.\n\nRecord:\n\nThis account conflicts with the record at p. 9, which states "commenced 1/8/2003". Assessment: contradicted by the record at p. 9.\n\nThe respondent may have paid the deposit in cash. (p. 20)\n\nThe record at p. 11 states "no deposit received". Assessment: contradicted by the record at p. 11.', gate: { dropped: 1 } },
          // a section the render-time gate rejects whole: its server-gate count still counts (Sourcery, PR #212)
          legal_framework: { provenance: 'ai', text: 'This may constitute fraud. It could indicate dishonesty by the franchisor.', gate: { dropped: 2 } }
        },
        humanProvenance: { sectionsAttempted: 7, model: 'test-narrator' }
      })));
    } finally { console.log = quiet; }
    const slice = (from, to) => { const a = T.lastIndexOf(from); const b = to ? T.indexOf(to, a + 1) : -1; return a < 0 ? '' : T.slice(a, b > a ? b : undefined); };
    ok(/Franchise \/ Lease & Goodwill/.test(slice('FINDINGS & CONTRADICTION MATRIX', 'Finding type summary')), 'the findings matrix carries the Franchise / Lease & Goodwill category (CT44/CT45 were missing from it)');
    // Founder ruling (5 October 2026): the review removes nothing, and the
    // report never says it dropped or retained a finding.
    ok(!/review dropped|dropped as unsupported|engine findings retained/.test(T + N) && /it removed and changed none/.test(T), 'no report says the AI review dropped or retained a finding; the trailer says it removed and changed none');
    // Engine page notes: their own heading in both reports, never "could not pin to a page", never dropped from the narrative.
    const pinPara = slice('could not pin to a specific page', 'Engine notes');
    ok(/suspiciously round/.test(pinPara) && !/Figures recognised/.test(pinPara) && !/Engine notes/.test(pinPara), 'the "could not pin to a specific page" paragraph carries the anchor-rule items only, not a note about page 397 (' + pinPara.slice(0, 160).replace(/\s+/g, ' ') + ')');
    ok(/Engine notes\s+—\s+pages the engine read but could not turn into a finding/.test(T) && /Page 397:\s+Figures\s+recognised\s+on\s+page\s+397\s+do\s+not\s+read\s+as\s+one\s+invoice/.test(T), 'the technical report prints the engine note under its own heading with its page');
    ok(/could not turn what it found there into a finding/.test(N) && /Page 397:\s+Figures\s+recognised\s+on\s+page\s+397/.test(N), 'the court-ready narrative prints the engine note with its page (it was dropped before)');
    const enS = R._engineNotes({ extractionNotes: 'x. Anchor rule: 1 observation(s) … Engine notes (2): Page 74: Registration numbers read by OCR as variants \u2022 Page 80: A number one digit off Score calibration: y' });
    ok(enS.length === 2 && enS[0].location === 'Page 74' && /^Registration numbers/.test(enS[0].text) && enS[1].location === 'Page 80', 'engine notes are parsed from the labelled segment when no structure is present (' + JSON.stringify(enS) + ')');
    const enC = R._engineNotes({ findings: { contextNotes: [{ type: 'CT38', location: '', text: 'Context: multiple jurisdictions are referenced' }, { type: 'CT20', location: 'Page 74', text: 'ID/Registration number' }] } });
    ok(enC.length === 1 && enC[0].type === 'CT20', 'structured notes win, and a cross-border Context note is not a page note');
    ok(!/cannot be changed, altered, or deleted/.test(T) && /any change to them is detectable/.test(T), 'the seal is described as tamper-evident, never as preventing change');
    ok(/3 findings: 2 at full weight, and 1 anchored only on OCR-recovered pages or on a secondary source, whose quoted wording is to be verified/.test(T) && /\(1 of them held at reduced weight by the engine\)/.test(T), 'the cover count tells the OCR-held finding apart and says the engine lowered its weight (' + (T.match(/contains [^.]{0,200}/) || [''])[0] + ')');
    ok(/Corrupt Activities/.test(R._statutesForFinding({ type: 'CT14' }, jur0).map(x => x.provisions.join('; ')).join(' ')) && !/Corrupt Activities|Money Laundering/.test(R._statutesForFinding({ type: 'CT15' }, jur0).map(x => x.provisions.join('; ')).join(' ')), 'an entity-status contradiction (CT14) keeps the Corrupt Activities Act; an invoice total (CT15) does not');
    ok(!/Organised Crime/.test(slice('Person → Contradiction → Page → Candidate law', 'CANDIDATE OFFENCE MATRIX')) || /CT18/.test(slice('Person → Contradiction → Page → Candidate law', 'CANDIDATE OFFENCE MATRIX')), 'the arithmetic finding\'s row cites no money-laundering provision');
    ok(/lease commenced on 1 August 2001/.test(N) && /p\. 9, which states/.test(N) && !/p\. 7, which states/.test(N) && !/p\. 11 states/.test(N), 'a rebuttal whose claim the gate removed is dropped whole, in the narrator\'s own wording too ("The record at p. 11 states …"); a heading between a kept claim and its rebuttal keeps the rebuttal');
    ok(/server's anchor and language gate: 3/.test(N) && /render-time §15\.2 gate: 2/.test(N) && /rebuttal sentences dropped with a removed claim: 4/.test(N), 'the provenance box prints both gate counters and the orphaned sentences apart (server 1 + 2; render-time 2 hedged claims; 4 orphaned rebuttal sentences the gate itself passed)');
    ok(!/can alter it afterwards|preserves, forever|CANNOT BE ALTERED|immutable instrument/.test(T + N) && !/HOW ANY CHANGE TO THIS RECORD IS DETECTED/.test(T + N) && /Any change to it is detectable/.test(T), 'no page says the record cannot be altered or is immutable; the user-manual explainer is gone and Section 7 says a change is detectable');
    ok(!/\bverified findings?\b/.test(T + N) && /Recorded below:\s+3 findings:\s+2 at full weight/.test(T) && /On the record above:\s+3 findings:\s+2 at full weight/.test(T), 'every count of findings tells the OCR-anchored one apart: the executive summary and the summary trailer too, and no undivided "N verified findings" sentence remains (' + JSON.stringify([(T.match(/Recorded below[^.]{0,80}/) || [''])[0], ((T + N).match(/\b\d+ verified findings? (?:are|is|stands?)\b[^.]{0,60}/) || [''])[0]]) + ')');
    ok(/Contract, Lease & Franchise/.test(T) && !/Legal subject: CONTRACT\b/.test(T), 'the CONTRACT subject prints its label, never the raw key');
    ok(!/\(p\. 20\)/.test(N), 'a removed claim leaves no stray page cite behind, and the cite does not keep its rebuttal alive');
    const srFx = 'Mr X states: "I signed the lease on 3 May 2020." (p. 12)\n\nThis account conflicts with the record at p. 7. Assessment: contradicted by the record at p. 7.\n\nRecord:\n\nMs Z states that the rent was paid in full. (p. 14)\n\nThis account conflicts with the record at p. 9. Assessment: contradicted by the record at p. 9.';
    const sr = R._scrubRebuttals(srFx);
    const srBlocks = R._narrativeBlocks(sr.text);
    ok(sr.text.split('\n\n').length === 5 && /\(p\. 12\)$/m.test(sr.text) && srBlocks.some(b => b.kind === 'heading' && b.text === 'Record') && srBlocks.filter(b => b.kind === 'para').length === 4, 'the rebuttal scrub keeps the server\'s paragraphs and headings: five blocks, "Record" a heading, each claim and rebuttal its own paragraph, the page cite kept with its claim (' + JSON.stringify(srBlocks.map(b => b.kind)) + ')');
    // The gaps pass: the blockchain is never "anchored" before it is; the verbatim columns print the record's words, never the engine's; counts and tables.
    ok(R._anchorPhrase({ ots: { submitted: true } }).indexOf('pending') !== -1 && /^recorded without a blockchain anchor/.test(R._anchorPhrase({})) && /^anchored to the Bitcoin blockchain/.test(R._anchorPhrase({ ots: { confirmed: true } })), 'the anchor phrase says what the seal can truthfully say at the moment of writing');
    ok(!/anchored (?:via|through|to) (?:the Bitcoin|OpenTimestamps)/.test(T + N) && /recorded without a blockchain anchor/.test(T), 'a report sealed without an OpenTimestamps record never claims a Bitcoin anchor, in any sentence of either report');
    ok(R._anchorQuote({ evidence: 'The document both affirms and negates "goodwill": "\u2026tive attorneys, provides that goodwill of R3,800,000 is recognised as payab\u2026" vs "\u2026see. No goodwill shall be payable"' }) === '\u2026tive attorneys, provides that goodwill of R3,800,000 is recognised as payab\u2026 \u2026 \u2026see. No goodwill shall be payable' && R._anchorQuote({ evidence: 'VAT mismatch: calculated R150.00 but stated R120.00' }) === null, 'the anchor quote carries every passage the record states, both halves of a contradiction, and a computation has none');
    ok(R._anchorQuote({ type: 'CT02', evidence: '"purchase price" is stated as R1,250,000.00 and as R1,520,000.00 (variance: 19%)' }) === '"purchase price" is stated as R1,250,000.00 and as R1,520,000.00' && R._anchorQuote({ type: 'CT01', evidence: 'The record carries an explicit admission ("i acknowledge that"): "Affidavit. 4. I acknowledge that the deposit of R50 000 was never paid" — read the full passage' }) === 'Affidavit. 4. I acknowledge that the deposit of R50 000 was never paid', 'a label ("purchase price" is stated as …) and the engine\'s cue ("i acknowledge that") are never the record; the stated figures and the admission passage are');
    ok(R._docTitle('MEMORANDUM OF AGREEMENT OF LEASE', false) === 'MEMORANDUM OF AGREEMENT OF LEASE' && R._docTitle('Deed of Sale of Business', false) === 'Deed of Sale of Business' && R._docTitle('CALTEX OIL (SA) (PTY) LTD FRANCHISE AGREEMENT', true) === 'CALTEX OIL (SA) (PTY) LTD FRANCHISE AGREEMENT' && R._docTitle('Bright Idea Projects 66 (Pty) Ltd v Wayne Nel Motors CC', false) === 'Bright Idea Projects 66 (Pty) Ltd v Wayne Nel Motors CC' && R._docTitle('Tax Invoice 2014/03/17 No 4471', false) === 'Tax Invoice 2014/03/17 No 4471' && R._docTitle('OCR BEE & x)', false) === '(title unreadable)' && R._docTitle('Mls Eanes Rear Frey', true) === '(title unreadable in the OCR text)', 'ordinary titles are printed as the record names them; debris is called unreadable, and "in the OCR text" only on an OCR page (' + JSON.stringify([R._docTitle('MEMORANDUM OF AGREEMENT OF LEASE', false), R._docTitle('Deed of Sale of Business', false), R._docTitle('CALTEX OIL (SA) (PTY) LTD FRANCHISE AGREEMENT', true), R._docTitle('Bright Idea Projects 66 (Pty) Ltd v Wayne Nel Motors CC', false), R._docTitle('Tax Invoice 2014/03/17 No 4471', false), R._docTitle('OCR BEE & x)', false), R._docTitle('Mls Eanes Rear Frey', true)]) + ')');
    ok(R._sameNameVariant('John Smith', 'Jane Smith') === false && R._sameNameVariant('Acme Ltd', 'Apex Ltd') === false && R._sameNameVariant('CAL TEX', 'Caltex') === true && R._sameNameVariant('Bright Idea', 'Bright Idea Projects 66 (Pty) Ltd') === true, 'the person index merges spelling, spacing and suffix variants only, never two different people');
    const mergedDup = R._mergePersonIndex([{ name: 'Crompton Street Motors', kind: 'name', mentionCount: 1, pages: [29], mentions: [{ type: 'CT02', location: 'Page 29', evidence: 'x' }] }, { name: 'CROMPTON STREET MOTORS CC', kind: 'name', mentionCount: 1, pages: [29], mentions: [{ type: 'CT02', location: 'Page 29', evidence: 'x' }] }]);
    ok(mergedDup.length === 1 && mergedDup[0].mentionCount === 1 && mergedDup[0].mentions.length === 1, 'one finding naming two spellings of a party counts once');
    ok(/engine observation, no verbatim passage/.test(T) && T.indexOf('MONETARY FIGURES REFERENCED') === -1, 'the evidence appendix marks an engine computation as such, and no computed amount is listed as a figure appearing in the record');
    ok(/Pages 43, 45[^.]{0,80}carry only a seal footer/.test(N) || /Page 43[^.]{0,120}carry only a seal footer/.test(N), 'the court-ready narrative lists footer-only pages among the pages the engine could not read (' + ((N.match(/[^.]{0,60}carry only a seal footer[^.]{0,40}/) || [''])[0]) + ')');
    const tocText = T.slice(T.indexOf('TABLE OF CONTENTS')).replace(/(?:\.\s){3,}/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
    ok(/EVIDENCE APPENDIX[^\d]{0,30}\d+/.test(tocText) && /METHODOLOGY[^\d]{0,40}\d+/.test(tocText) && /7\. CERTIFICATION \d+ 8\. ANNEXES/.test(tocText), 'the table of contents reaches the last sections and the numbering continues after the constitutional block (' + tocText.slice(0, 400) + ')');
    ok(R._docTitle('OCR BEE & x)', true) === '(title unreadable in the OCR text)' && R._docTitle('Franchise Agreement between Bright Idea Projects and Wayne Nel Motors', true) === 'Franchise Agreement between Bright Idea Projects and Wayne Nel Motors' && R._docTitle('', false) === '(untitled in the record)', 'OCR debris is never printed as a document\'s own name');
    const merged = R._mergePersonIndex([{ name: 'Crompton Street Motors', kind: 'name', mentionCount: 7, pages: [29], mentions: [1] }, { name: 'CROMPTON STREET MOTORS CC', kind: 'name', mentionCount: 6, pages: [59], mentions: [2] }, { name: 'Bright Idea', kind: 'name', mentionCount: 7, pages: [3], mentions: [3] }, { name: 'Bright Idea Projects', kind: 'name', mentionCount: 5, pages: [4], mentions: [4] }]);
    ok(merged.length === 2 && merged[0].mentionCount === 13 && merged[0].name === 'CROMPTON STREET MOTORS CC' && merged[1].mentionCount === 12 && merged[1].name === 'Bright Idea Projects', 'the person index merges name variants the way the scorecard does (' + JSON.stringify(merged.map(m => m.name + ':' + m.mentionCount)) + ')');
    const pageSrc = require('fs').readFileSync(require('path').join(process.cwd(), 'seal-document.html'), 'utf8');
    ok(!/retainedEngine/.test(pageSrc) && /all\.push\(Object\.assign\(\{\}, findings\[j\], extra\)\)/.test(pageSrc), 'the review returns every engine finding, so the timeline, the person index and the type count are the engine\'s own');
    const ct20Law = R._statutesForFinding({ type: 'CT20', severity: 2 }, jur0).map(x => x.provisions.join('; ')).join(' ');
    ok(/Common-law fraud/.test(ct20Law) && !/Corrupt Activities|Consumer Protection/.test(ct20Law) && !/Corrupt Activities/.test(R._statutesForFinding({ type: 'CT02', severity: 2 }, jur0).map(x => x.provisions.join('; ')).join(' ')), 'a registration-number note and any Low finding carry no corruption or consumer statute');
  };
  await run();
}

// ---- §18 The Public Protector submission run (2026-10-02) -------------------
// The founder sealed his own 20-page submission ("Response to Public Protector
// Referral & Recommendations for Industry Reform", addressed to the DMPR's
// Director-General and the NDPP). It is advocacy about other sealed records,
// not an evidence bundle. The sealed report carried three findings and all
// three were false: "compliant" read inside "non-compliant" and paired with
// itself (CT14), two genuine government domains of one renamed department
// read as a lookalike (CT37), and the plural "unsigned agreements" in the
// author's own allegation read as a statement about one instrument (CT23).
// The reports then attributed the author's words to a company named on the
// page, filed the unsigned-agreement sentence under tampering and forgery law,
// and the anchor certificate claimed a permanent blockchain record while its
// own header said PENDING. Each item below is pinned with the submission's own
// text; beside each false case, a genuine case of the same type still fires.
{
  const fs = require('fs'), path = require('path');
  const g = globalThis; g.window = g; g.self = g;
  if (!g.PDFLib) new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
  const PDFLib = g.PDFLib;
  const R = require('../forensic-report.js');
  const p4 = '2.1 Acknowledgment of Referral The complainant acknowledges receipt of the Public Protector\'s Notice dated 30 September 2026 (Reference: CMS-88490/2026), issued in terms of Section 6(4)(c)(ii) of the Public Protector Act, 1994. The complainant notes that the matter has been referred to: Mr Jacob Mbele Director-General Department of Mineral and Petroleum Resources 71 Trevenna Campus, Corner Francis Baard and Meintjies Streets Pretoria, 0001 Personal Assistant: Ms Mamabefu Modipa Telephone: 012 444 3880 Email: Mamabefu.Modipa@dmre.gov.za; Mamabefu.Modipa@dmpr.gov.za The complainant notes that the closure of the Public Protector\'s file (paragraph 3.3 of the Notice) raises concerns.';
  const p6 = 'Racketeering: A pattern of systematic deprivation of goodwill from multiple operators (Gary Highcock, Wayne Nel, Desmond Smith, Clayton Bester) through a common scheme involving unsigned agreements, omitted protective clauses, and licence manipulation. Theft: The seizure of business goodwill without payment.';
  const p8 = 'Practice Description Victims Goodwill forfeiture clauses in unsigned agreements Imposing terms that operators never agreed to in writing Gary Highcock, Wayne Nel';
  const p13 = 'The DMPR\'s position — as recorded in the Fakroodeen and Randeree letter of 29 September 2026 — that the old operator\'s licence "has terminated and/or expired" is therefore questionable and requires independent verification. The contradiction is stark: AllFuels\' position: The operator is "errant" and non-compliant. The facts: AllFuels obtained a new licence for a related entity while the original licence remains active. This means the new retail licence issued to Sanarth Fuels (Pty) Ltd at the Port Edward and Thongasi sites may not be validly operative.';

  // 18a. CT14: a status word inside its own negation is not a second claim.
  const ct14 = (b) => of(DET.D09_DETECT_ENTITY_STATUS_FAKE, b, 'CT14');
  ok(ct14([p13]).length === 0, 'D09: "non-compliant" is one claim, never "compliant" paired with itself (' + JSON.stringify(ct14([p13]).map(f => f.evidence.slice(0, 80))) + ')');
  ok(ct14(['The company is non compliant with the licence conditions of the Department.']).length === 0, 'D09: "non compliant" (no hyphen) is the negation too');
  const ct14g = ct14(['The company is compliant with all licence conditions of the Department.', 'The company is non-compliant with its licence conditions, and the business is under review.']);
  ok(ct14g.length === 1 && /page 1/.test(ct14g[0].evidence) && /page 2/.test(ct14g[0].evidence), 'D09: a company called compliant on one page and non-compliant on another still fires (' + JSON.stringify(ct14g.map(f => f.evidence.slice(0, 120))) + ')');
  // Pages long enough that the ±90-character window must cut: each passage starts and ends on a whole word of the page.
  const longA = 'The regulator wrote at length about the matter and the history of the site and its operators over many years. The company XYZ Fuels (Pty) Ltd is compliant with all licence conditions of the Department, the letter says, and the inspection in March found nothing amiss at the forecourt or the tanks.';
  const longB = 'The second letter, written by the same office some months later after a further inspection of the premises, reverses that. The company XYZ Fuels (Pty) Ltd is non-compliant with its licence conditions, and the business is under review by the Controller of Petroleum Products until further notice.';
  const ct14w = ct14([longA, longB]);
  const passages = ct14w.length ? E.voExtractQuotes(ct14w[0].evidence) : [];
  const wholeWord = (p, page) => { const core = p.replace(/^…|…$/g, ''); const at = page.indexOf(core); return at >= 0 && (at === 0 || /\s/.test(page.charAt(at - 1))) && (at + core.length === page.length || /[\s.,;:]/.test(page.charAt(at + core.length))); };
  ok(ct14w.length === 1 && passages.length === 2 && wholeWord(passages[0], longA) && wholeWord(passages[1], longB), 'D09: each quoted passage is snapped to whole words of its page (' + JSON.stringify(passages) + ')');

  // 18b. CT37: two government domains are never a lookalike; a commercial lookalike still is.
  const ct37 = (b) => of(DET.D25_DETECT_CONTACT_MISMATCH, b, 'CT37');
  ok(ct37([p4]).length === 0, 'D25: dmre.gov.za beside dmpr.gov.za (one renamed department, one mailbox) is not a lookalike domain');
  ok(ct37(['Reply to accounts@astronenergy.co.za for statements.', 'Send payment advice to accounts@astron-energy.co.za today.']).length === 1, 'D25: a commercial lookalike (astronenergy.co.za / astron-energy.co.za) still fires');
  ok(ct37(['Queries: refunds@sars.gov.za', 'Your refund: refunds@sars.gev.za']).length === 1, 'D25: a lookalike OF a government domain ("sars.gev.za") still fires — only two government suffixes are exempt');
  ok(ct37(['Contact info@justice.gov.za', 'or info@justice.gov.uk']).length === 0 && ct37(['Mail ops@army.mil', 'or ops@navy.mil']).length === 0, 'D25: gov.za / gov.uk and .mil pairs are exempt');

  // 18c. CT23: the plural names a category, not one instrument; the quote is whole words and says its page.
  const ct23 = (b) => of(DET.D32_DETECT_SIGNATURE_ANOMALY, b, 'CT23');
  ok(ct23([p6, p8]).length === 0, 'D32: "a common scheme involving unsigned agreements" (the author\'s allegation, plural) is not a statement about one instrument');
  const ct23g = ct23(['The schedule lists the operators (Gary Highcock, Wayne Nel, Desmond Smith, Clayton Bester) and the Respondent relies on an unsigned agreement to claim payment of the goodwill.', 'The Respondent relies on an unsigned agreement for the rental.']);
  ok(ct23g.length === 1 && /^The record states a signature is missing \("unsigned agreement"\)/.test(ct23g[0].evidence) && ct23g[0].severity === 4, 'D32: a specific unsigned agreement relied on for payment still fires, at the enforcement severity (' + JSON.stringify(ct23g.map(f => [f.severity, f.evidence.slice(0, 90)])) + ')');
  ok(ct23g.length === 1 && !/"[a-z]{1,4} Smith/.test(ct23g[0].evidence) && /\(quoted from p\. 1\) — stated on 2 pages \(1, 2\)/.test(ct23g[0].evidence), 'D32: the quote starts on a word ("nd Smith" was printed for "Desmond Smith") and names the page it is quoted from (' + (ct23g[0] && ct23g[0].evidence) + ')');

  // 18d. Parties: titles, addresses and headings are not names.
  ok(E.voCleanPersonName('Mr Jacob Mbele') === 'Jacob Mbele' && E.voCleanPersonName('Ms Mamabefu Modipa') === 'Mamabefu Modipa' && E.voCleanPersonName('Mrs Smith') === 'Mrs Smith' && E.voCleanPersonName('Justice Thabo Mokoena') === 'Justice Thabo Mokoena',
    'a courtesy title before a full name is dropped ("Mr Jacob Mbele" is "Jacob Mbele"); "Mrs Smith" keeps it; "Justice" (also a first name) is never stripped');
  ok(E.voTrimPersonName('Corner Francis Baard') === '' && E.voTrimPersonName('James Corner') === 'James Corner' && E.voTrimPersonName('Jacob Mbele Director-General Department') === 'Jacob Mbele' && !E.voLooksLikePerson('Corner Francis Baard') && E.voLooksLikePerson('James Corner'),
    'an address opening "Corner …" is not a party; "Corner" as a surname is; a title after a name is cut');
  const lead = (t) => E.voExtractParties(t).filter(x => x.kind === 'name').map(x => x.name);
  ok(JSON.stringify(lead('Director Andy Mothibi signed.')) === '["Andy Mothibi"]' && JSON.stringify(lead('Personal Assistant Sipho Dlamini called.')) === '["Sipho Dlamini"]' && JSON.stringify(lead('First Respondent Wayne Nel admits it.')) === '["Wayne Nel"]' && lead('First Respondent admits it.').length === 0,
    'a role or title before a name is skipped, never cutting the name away with it; a role with no name binds no name (' + JSON.stringify([lead('Director Andy Mothibi signed.'), lead('First Respondent Wayne Nel admits it.')]) + ')');
  for (const bad of ['Systemic Unfair Practices', 'Petroleum Resources', 'Trevenna Campus', 'Personal Assistant', 'Concerns Regarding', 'Critical Point', 'Instrument Does', 'Forensic Platform'])
    ok(!E.voLooksLikePerson(bad), 'not a party: "' + bad + '"');
  const p4names = E.voExtractParties(p4).filter(x => x.kind === 'name').map(x => x.name);
  ok(p4names.filter(n => /Mbele/.test(n)).length === 1 && p4names.indexOf('Jacob Mbele') !== -1 && !p4names.some(n => /Corner|Campus|Assistant|Resources|Director/.test(n)), 'page 4 binds "Jacob Mbele" once and no address, heading or title (' + JSON.stringify(p4names) + ')');
  const roster = E.voBuildNameRoster(['Systemic Unfair Practices. Verum Omnis Forensic Platform. Wayne Nel.', 'Systemic Unfair Practices. Verum Omnis Forensic Platform. Wayne Nel.', 'Systemic Unfair Practices. Verum Omnis Forensic Platform. Wayne Nel.']).map(x => x.name);
  ok(roster.indexOf('Wayne Nel') !== -1 && !roster.some(n => /Systemic|Forensic Platform/.test(n)), 'a running page header and the product\'s own heading never enter the name roster (' + JSON.stringify(roster) + ')');
  const ctxP = E.voExtractPersonsFromContext('the new retail licence issued to Sanarth Fuels (Pty) Ltd, and the Timol email to Astron Energy.', 6).map(x => x.name);
  const ctxH = E.voExtractPersonsFromContext('From: Zeyd Timol\nTo: Wayne Nel\nDear Gary Highcock', 6).map(x => x.name);
  ok(ctxP.length === 0 && ['Zeyd Timol', 'Wayne Nel', 'Gary Highcock'].every(n => ctxH.indexOf(n) !== -1), '"to" and "from" in prose are prepositions, not header markers; a "To:" header and a salutation still bind (' + JSON.stringify([ctxP, ctxH]) + ')');

  // 18e. Quotes, sentences, dates and provisions read the record as written.
  const qs = E.voExtractQuotes('Conflicting entity-status claims: "…The operator is "errant" and non-compliant. The facts…" (compliant, page 13) vs "…The operator is "errant" and non-compliant. The facts…" (non-compliant, page 13)');
  ok(qs.length === 1 && qs[0] === '…The operator is "errant" and non-compliant. The facts…', 'the record\'s own quotation marks stay inside the passage, and a passage quoted twice is listed once (' + JSON.stringify(qs) + ')');
  const sent = E.voSentenceAround(p13, 'ication. The contradiction is stark: AllFuels\' position');
  ok(sent && /^The contradiction is stark/.test(sent) && !/29 September/.test(sent), 'a quote that starts mid-word is keyed on its own sentence, never the one before (' + sent + ')');
  const f14 = [{ type: 'CT14', severity: 5, location: 'Page 1', evidence: 'Conflicting entity-status claims: "…ication. The contradiction is stark: AllFuels\' position: The operator is "errant" and non-compliant. The facts…" (compliant, page 1) vs "…The operator is "errant" and non-compliant. The facts: AllFuels obtained a new licence…" (non-compliant, page 1)' }];
  E.voAnchorEnrich(f14, [p13]);
  ok(f14[0].anchor && f14[0].anchor.when.length === 0, 'the finding is not dated by the attorneys\' letter in the sentence before it (' + JSON.stringify(f14[0].anchor && f14[0].anchor.when) + ')');
  ok(f14[0].anchor && f14[0].anchor.quote.length === 2 && f14[0].anchor.quote.every(q => /"errant"/.test(q)), 'the anchor quote keeps "errant" and lists each passage once (' + JSON.stringify(f14[0].anchor && f14[0].anchor.quote) + ')');
  const f37 = [{ type: 'CT37', severity: 3, location: 'Page 1', evidence: 'Lookalike email domain: "dmre.gov.za" (p. 1) beside "dmpr.gov.za" (p. 1) — 1 character apart; confirm which is genuine before relying on messages from either' }];
  E.voAnchorEnrich(f37, [p4]);
  ok(f37[0].anchor && f37[0].anchor.law.length === 0, 'an email-domain finding carries no provision from elsewhere on its page ("paragraph 3.3", "Section 6(4)(c)(ii)" were printed under "Provision cited in the document") (' + JSON.stringify(f37[0].anchor && f37[0].anchor.law) + ')');
  const fLaw = [{ type: 'CT02', severity: 4, location: 'Page 1', evidence: '"purchase price" is stated twice: "the price payable in terms of clause 4.2 is R1,250,000" and "R1,520,000"' }];
  E.voAnchorEnrich(fLaw, ['The parties agree that the price payable in terms of clause 4.2 is R1,250,000. Section 12 of the Act applies elsewhere.']);
  ok(fLaw[0].anchor && fLaw[0].anchor.law.indexOf('clause 4.2') !== -1 && !fLaw[0].anchor.law.some(l => /Section 12/.test(l)), 'a provision in the finding\'s own words is still cited, and one elsewhere on the page is not (' + JSON.stringify(fLaw[0].anchor && fLaw[0].anchor.law) + ')');
  const p1 = 'Response to Public Protector Referral & Recommendations for Industry Reform References: CMS-88490/2026 Date: 3 October 2026 Prepared by: Liam Highcock';
  const da = E.voDatedAfterReference([p1], '2026-10-02T20:11:36.233Z');
  ok(da.length === 1 && da[0].type === 'CT03' && da[0].location === 'Page 1' && /dated "3 October 2026" \(p\. 1\), later than the day it was analysed for sealing \(2 October 2026, Africa\/Johannesburg\)/.test(da[0].text) && /Recorded, not scored/.test(da[0].text),
    'a document dated the day after its analysis is recorded as an engine note (' + JSON.stringify(da) + ')');
  ok(E.voDatedAfterReference([p1], '2026-10-02T22:30:00Z').length === 0 && E.voDatedAfterReference([p1]).length === 0 && E.voDatedAfterReference(['The letter dated 5 October 2026 is attached.'], '2026-10-02T20:00:00Z').length === 0,
    'no note once the Johannesburg day has turned, none without a reference instant (the engine never reads the clock), and none for an unlabelled date in prose');
  const engSrc = fs.readFileSync(path.join(process.cwd(), 'forensic-engine-page.js'), 'utf8');
  const fnBody = engSrc.slice(engSrc.indexOf('function voDatedAfterReference('), engSrc.indexOf('function voDateSortKey('));
  ok(!/Date\.now\(\)|new Date\(\)|Math\.random\(\)/.test(fnBody) && /async function runForensicEngine\(pdfBytes, pdfDoc, onProgress, opts\)/.test(engSrc), 'the dated-after note reads no clock: the instant is the caller\'s input');
  const pageSrc = fs.readFileSync(path.join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/\{ referenceTime: new Date\(\)\.toISOString\(\) \}\);/.test(pageSrc), 'the seal page passes the analysis instant into the engine');

  // 18f. A submission about other sealed records is an account of them, not the record.
  const sub = [p1, 'This is documented in the sealed Thongasi-AllFuels contract (Seal ID: VO- 210B029F1A0B) and the Timol email.', p13];
  const ss = E.voSecondarySegments([], sub);
  ok(ss.length === 1 && ss[0].start === 1 && ss[0].end === 3, 'a "Response to …" that cites another Verum seal is secondary from its first page to its last (' + JSON.stringify(ss) + ')');
  ok(E.voSecondarySegments([], [p1, p13]).length === 0, 'a submission title alone is not enough: the body must cite another seal');
  ok(E.voSecondarySegments([], ['MEMORANDUM OF AGREEMENT OF LEASE between the parties', 'The lease annexure was sealed as VO-210B029F1A0B by the lessor.']).length === 0, 'a primary record that mentions a seal is not secondary without a submission title');
  const demoted = E.voDemoteSecondarySource([{ type: 'CT14', severity: 5, location: 'Page 3', evidence: 'x' }], E.voSecondaryPages([], sub));
  ok(demoted.kept.length === 0 && demoted.leads.length === 1, 'a finding on the submission becomes a lead in the engine notes, never a finding');

  // 18g. The report: what each finding is, who it concerns, its law, its next step.
  const jur0 = { home: 'ZA', foreign: [], isCrossBorder: false };
  const unsigned2 = { type: 'CT23', severity: 2, location: 'Page 6', evidence: 'The record states a signature is missing ("unsigned agreement"): "the Respondent relies on an unsigned agreement for the rental" — verify execution against the signature pages of the original' };
  const unsigned4 = Object.assign({}, unsigned2, { severity: 4 });
  const slashS = { type: 'CT23', severity: 3, location: 'Page 2', evidence: 'Non-standard signature method "/s/": "Signed /s/ J Smith for the Lessor"' };
  const lawOf = (f) => R._statutesForFinding(f, jur0).map(x => x.provisions.join('; ')).join(' ');
  ok(R._isUnsignedStatement(unsigned2) && !R._isUnsignedStatement(slashS), 'D32\'s two CT23 shapes are told apart');
  ok(/^Common law of contract/.test(lawOf(unsigned2)) && !/Cybercrimes|forgery|Electronic Communications/.test(lawOf(unsigned2)) && /Cybercrimes/.test(lawOf(slashS)), 'an unsigned agreement is a contract question (no Cybercrimes Act, no forgery); a surrogate signature keeps the forgery provisions (' + lawOf(unsigned2) + ')');
  ok(R._narrativeMeaning(unsigned2) === 'the record states that an agreement it refers to is unsigned' && !/unusual way/.test(R._narrativeMeaning(unsigned2)), 'the plain meaning says what the record states, not "signed in an unusual way"');
  ok(/signed original/.test(R._hintFor(unsigned2)) && !/native|metadata/i.test(R._hintFor(unsigned2)), 'the next step is the signed original, never a request for native files and metadata');
  ok(/Whether, and when, it was executed/.test(R._establishesOf(unsigned2)) && !/being used to enforce/.test(R._establishesOf(unsigned2)) && /cannot carry the obligation it is being used to enforce/.test(R._establishesOf(unsigned4)) && /conformed or surrogate signature/.test(R._establishesOf(slashS)) && /cannot carry the obligation/.test(R._establishesOf({ type: 'CT23' })),
    'what it establishes: no enforcement claimed without enforcement language; enforcement wording where the record bills under it; the surrogate-signature shape has its own');
  ok(/CIPC companies register/.test(R._hintFor({ type: 'CT14' })) && !/impersonation/.test(R._hintFor({ type: 'CT14' })), 'an entity-status finding is checked at the companies register');
  ok(R._declaredPartyFor({ type: 'CT14', severity: 5, evidence: 'Sanarth Fuels is stated as active vs dissolved', anchor: { who: [{ name: 'Sanarth Fuels' }] } }, { identity: { parties: '' } }) === null
    && R._declaredPartyFor({ type: 'CT14', severity: 5, evidence: 'Sanarth Fuels is stated as active vs dissolved', anchor: { who: [{ name: 'Sanarth Fuels' }] } }, { identity: { parties: 'Sanarth Fuels (Respondent)' } }) === 'Sanarth Fuels',
    'a finding concerns a party only when the case details declare it');
  ok(JSON.stringify(R._namedOnPages({ anchor: { who: [{ name: 'Sanarth Fuels' }, { name: 'SANARTH FUELS' }, 'Wayne Nel'] } })) === '["Sanarth Fuels","Wayne Nel"]', 'the names on the cited pages are listed once each');
  const longSides = R._contradictionSides('Conflicting entity-status claims: "' + 'word '.repeat(60) + 'end" (compliant, page 13) — yet "the company is compliant with its licence" (non-compliant, page 2)');
  ok(longSides && longSides.b === 'the company is compliant with its licence' && longSides.bQuoted === true && !/^"|"$/.test(longSides.a), 'a long first side no longer cuts off the second (the length cap applies per side), and an unquoted side keeps no stray quote mark (' + JSON.stringify(longSides) + ')');
  ok(JSON.stringify(R._narrativeBlocks('**Misrepresentation**: the record states x [F1].\n\n__Loss__: INSUFFICIENT.').map(b => b.text)) === '["Misrepresentation: the record states x [F1].","Loss: INSUFFICIENT."]', 'a narrator\'s markdown emphasis is not printed');
  ok(JSON.stringify(R._anchorQuotes({ type: 'CT14', evidence: f14[0].evidence })) === JSON.stringify(['…ication. The contradiction is stark: AllFuels\' position: The operator is "errant" and non-compliant. The facts…', '…The operator is "errant" and non-compliant. The facts: AllFuels obtained a new licence…']), 'the verbatim columns print the record\'s quoted word ("errant"), not "The operator is … and non-compliant"');

  // 18h. Rendered and read back: the technical report, the court-ready narrative, the worker template, the certificate.
  const pageText = async (bytes) => {
    const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const parts = [];
    for (let i = 0; i < loaded.getPageCount(); i++) parts.push((await E.extractPageText(bytes, i, loaded)).join(' '));
    return parts.join(' \n ').replace(/[ \t]+/g, ' ');
  };
  const sanarth = [{ name: 'Sanarth Fuels', kind: 'name' }, { name: 'Gary Highcock', kind: 'name' }];
  const findings = [
    Object.assign({}, f14[0], { location: 'Page 13', anchor: { where: [13], who: sanarth, when: [], quote: [] } }),
    Object.assign({}, unsigned4, { anchor: { where: [6], who: sanarth, when: [], quote: [] } }),
    { type: 'CT37', severity: 3, location: 'Page 4', evidence: 'Lookalike email domain: "accounts.example.co.za" (p. 4) beside "acc0unts.example.co.za" (p. 4) — 1 character apart; confirm which is genuine before relying on messages from either', anchor: { where: [4], who: [], when: [], quote: [] } },
    { type: 'LICENCE_INCONSISTENCY', severity: 4, source: 'ai', rationale: 'Inconsistent licence status', location: '', anchor: { where: [], who: [], when: [] } }
  ];
  const opts = {
    documents: [{ name: 'response-to-public-protector.pdf', pageCount: 20, sha512: 'ab'.repeat(64), sealId: 'VO-807F1D932D9A' }],
    findings: { clean: false, overallScore: 40, confidence: 'LOW', totalFindings: 3, findings: findings, summary: '3 findings.', contradictionTypesUsed: 3,
      timeline: { events: [{ date: '29 September 2026', who: ['Sanarth Fuels'], evidence: 'The operator is "errant"', page: 13, type: 'CT14' }] } },
    classification: { documentClass: 'Other', confidence: 'low' },
    aiReview: { applied: true, retained: 3, assessed: 3, dropped: 0, added: 0, narrative: '' },
    identity: { parties: '' },
    ots: { submitted: true },
    ocrPages: [], images: {}, generatedAt: '2026-10-02T20:12:00.000Z'
  };
  const run18 = async () => {
    const quiet = console.log; console.log = () => {};
    let T, N, D, L;
    try {
      T = await pageText(await R.build(opts));
      N = await pageText(await R.buildHumanReport(Object.assign({}, opts, {
        humanSections: {
          counter_narratives: { provenance: 'none', reason: 'not_generated' },
          critical_evidence: { provenance: 'none', reason: 'gate_failed', gate: { kept: 1, dropped: 3 } },
          legal_framework: { provenance: 'none', reason: 'gate_failed', gate: { kept: 0, dropped: 2 } }
        },
        humanProvenance: { sectionsAttempted: 3, model: 'test-narrator' }
      })));
      // Declared, and named in the finding's own words: the party it concerns.
      D = await pageText(await R.build(Object.assign({}, opts, { identity: { parties: 'Sanarth Fuels (Respondent)' },
        findings: Object.assign({}, opts.findings, { findings: opts.findings.findings.concat([{ type: 'CT14', severity: 5, location: 'Page 19', evidence: 'Conflicting entity-status claims: "Sanarth Fuels (Pty) Ltd is registered and active" (registered, page 19) vs "Sanarth Fuels (Pty) Ltd is deregistered" (deregistered, page 20)', anchor: { where: [19, 20], who: sanarth, when: [], quote: [] } }]) }) })));
      L = await pageText(await R.build(Object.assign({}, opts, { aiNarrative: 'Finding F1 (CT14), recorded at Page 13, states the status twice [F1]. The findings quoted above are the highest-ranked of the findings supplied for narrative reporting [F1].', aiNarrativeSource: 'local' })));
    } finally { console.log = quiet; }
    const TN = T + N;
    ok(!/It concerns Sanarth/.test(TN) && /Named on the cited page[s]? \(descriptive, not an attribution\):[^.]{0,80}Sanarth Fuels/.test(T), 'a company the engine found on the page is named descriptively, never as the party a finding concerns (' + ((T.match(/Named on the cited page[^.]{0,120}/) || [''])[0]) + ')');
    ok(/It concerns Sanarth Fuels/.test(D) && (D.match(/It concerns Sanarth Fuels/g) || []).length === 1, 'a party the case details declare is the party a finding concerns only when the finding\'s own words name it (once here: the CT14 naming Sanarth Fuels, not the findings that only share its page)');
    ok(!/Sanarth Fuels — the record states/.test(N), 'the counter-narratives never quote the author\'s words as a named company\'s own statement');
    // 5 October 2026: every finding renders under the brain that produced it
    // (§2); a kind no template block describes prints as FINDING RECORDED
    // under its brain — never under "TAMPER FOUND" or "COMMUNICATION GAP FOUND".
    const nb = T.slice(T.lastIndexOf('3. NINE-BRAIN EXTRACTION FINDINGS'), T.lastIndexOf('4. TRIPLE VERIFICATION SUMMARY')).replace(/\s+/g, ' ');
    ok(!/TAMPER FOUND/.test(nb) && !/COMMUNICATION GAP FOUND/.test(nb) && !/Not rendered under a brain/.test(T) && /B2 — Document Brain FINDING RECORDED: - Type: Unsigned Agreement Stated/.test(nb) && /B3 — Communications Brain FINDING RECORDED: - Type: (?:Contact Detail Mismatch|Lookalike Email Domain)/.test(nb) && !/INTEGRITY SIGNAL FOUND|CONTACT CONFLICT FOUND/.test(T),
      'every finding renders under its brain (§2): an unsigned-agreement statement under B2 and a contact detail under B3, each as FINDING RECORDED, never under "TAMPER FOUND" or "COMMUNICATION GAP FOUND" (' + nb.slice(380, 1400) + ')');
    ok(!/Behavioural Scorecard|Top liabilities|top liabilities/.test(TN) && /Parties named on the pages carrying findings/.test(T) && /Leading findings:/.test(T) && !/Most serious findings/.test(T), 'no "scorecard" over the people a record names, no "liabilities", and no severity word in the actionable output');
    ok(!/\(confidence:/.test(TN) && /Document classification \(AI, advisory\): Other/.test(T), 'the classification prints no confidence band');
    ok(!/Highest severity/.test(T) && !/\bSev\.\s/.test(T), 'no severity column in the matrix, for engine findings or AI candidates');
    ok(/A candidate marked "unanchored" has no quote in the sealed text/.test(T), 'an unanchored AI candidate is called a question, not a lead to a page');
    ok(/The operator is "errant" and non-compliant/.test(T), 'the evidence prints the record\'s own word in its quotation marks');
    const dish = T.slice(T.lastIndexOf('2. DISHONESTY DETECTION MATRIX'), T.indexOf('3. NINE-BRAIN', T.lastIndexOf('2. DISHONESTY DETECTION MATRIX')));
    ok(dish.length > 50 && !/Evasion \/ Deflection/.test(dish) && dish.indexOf('Contradictions') !== -1 && (dish.indexOf('Selective Omissions') === -1 || dish.indexOf('Contradictions') < dish.indexOf('Selective Omissions')), 'a contact conflict is a contradiction, not evasion, and rows are ordered by their most serious finding (' + dish.slice(0, 300).replace(/\s+/g, ' ') + ')');
    ok(!/Cybercrimes/.test(T.slice(T.lastIndexOf('STATUTORY ANCHORING'), T.lastIndexOf('CANDIDATE OFFENCE MATRIX'))) && /Common law of contract/.test(T), 'the unsigned-agreement finding carries contract law, never the Cybercrimes Act');
    ok(!/native\/original files/.test(T), 'no "request native files and metadata" step for a sentence about an unsigned agreement');
    ok(/the names on the cited page \(descriptive, not an attribution\)/.test(T) && /Named on the page/.test(N), 'the timeline and the chronology say whose names they print');
    ok(!/again\.\.\./.test(TN) && !/\b[a-z]{1,4}\.\.\. — Anchor/.test(TN), 'no list entry is cut mid-word');
    ok(/see the AI REVIEW section/.test(T) && !/see AI REVIEW section/.test(T), 'the methodology names the AI section that is printed');
    ok(/ENGINE SUMMARY/.test(L) && /The AI narrator did not answer: this summary is built from the findings by a fixed template/.test(L) && /see the ENGINE SUMMARY section/.test(L), 'the worker\'s template fallback is headed and described as a fixed template, and every reference names that heading');
    ok(!/investigator.s assessment/.test(T) && /Findings are produced by the deterministic engine from the sealed text/.test(T), 'the methodology says who produces the findings');
    ok(!/LAW ENFORCEMENT SENSITIVE/.test(TN) && /CONFIDENTIAL/.test(T), 'the cover implies no law-enforcement origin');
    ok(!/SHA-512 anchored/.test(TN) && !/permanent, tamper-evident/.test(TN) && /SHA-512 fingerprinted and submitted for anchoring/.test(TN), 'no "SHA-512 anchored" and no "permanent" record while the Bitcoin confirmation is pending');
    ok(!/fix when (?:they|it) existed|fixes the moment/.test(TN) && /the latest time by which/.test(TN), 'OpenTimestamps fixes the latest time by which the files existed, never "when"');
    ok(!/the only place a Verum seal is verified/.test(N) && /an OpenTimestamps client can check the Bitcoin block independently/.test(N), 'the provenance record says what verify.html checks and how to check Bitcoin independently');
    ok(/drafts the server's gate discarded whole: 2/.test(N) && /server's anchor and language gate: 5/.test(N) && !/removed and counted\./.test(N), 'the provenance record counts drafts the server\'s gate discarded whole and their dropped sentences (' + ((N.match(/Sections written by the AI narrator[^\n]{0,260}/) || [''])[0]) + ')');
    ok(/No language-model verification of the findings is claimed; the advisory AI review recorded in the technical report read the findings, removed and changed none/.test(N), 'with the AI review applied, the narrative says what the review is and that it removed and changed no finding');
    const one = await pageText(await (async () => { const q = console.log; console.log = () => {}; try { return await R.build(Object.assign({}, opts, { findings: Object.assign({}, opts.findings, { findings: [findings[1], findings[2]], totalFindings: 2 }) })); } finally { console.log = q; } })());
    ok(!/cannot all be true at the same time/.test(one) && /cannot all be true at the same time/.test(T), '"the documents cannot all be true at once" is printed only when a finding has two sides');
  };
  await run18();
  const wsrc = fs.readFileSync(path.join(process.cwd(), 'worker/verum-rules.js'), 'utf8');
  const tmpl = wsrc.slice(wsrc.indexOf('function narrateTemplate('), wsrc.indexOf('function narrateTemplate(') + 3000);
  ok(!/severity ' \+ f\.severity/.test(tmpl) && !/critical-evidence narrative/.test(tmpl) && /highest-ranked/.test(tmpl), 'the worker\'s template prints no severity number and refers to no section that does not exist');
  ok(/var hl = voHumanFindingList\(list\)/.test(pageSrc) && /ordered\.push\(\{ id: 'P' \+ \(ri \+ 1\), f: rest\[ri\] \}\)/.test(pageSrc), 'the narrator\'s [F#] numbering is the court-ready narrative\'s (engine findings by severity), so F2 is the same finding in every section');
  ok(/merged\.discarded = \(merged\.discarded \|\| 0\) \+ 1/.test(pageSrc), 'a critical-evidence batch the server\'s gate discarded is counted');
  const certSrc = pageSrc.slice(pageSrc.indexOf('async function buildAnchorCertificate('), pageSrc.indexOf('async function buildAnchorCertificate(') + 12000);
  ok(!/no one can edit or delete|not even Verum Omnis|is anchored to the Bitcoin blockchain|cannot be forged|unique signature|investigator’s assessment|no need to trust Verum Omnis/.test(certSrc), 'the anchor certificate claims no permanent record, no forgery-proof signature and no trust-free check while its header says PENDING');
  ok(/ORIGINAL UPLOAD SHA-512 \(BEFORE THE SEAL WAS APPLIED\)/.test(certSrc) && /DELIVERED FILE SHA-512 \(THE SEALED FILE AS DELIVERED\)/.test(certSrc) && /DELIVERED FILE SHA-512 \(THE PASSWORD-PROTECTED COPY SENT\)/.test(certSrc) && /OTS DIGEST \(SHA-256 OF THE ORIGINAL SHA-512 HEX TEXT\)/.test(certSrc)
    && /sealedSha512: \(password && encryptedBytes\) \? await computeSHA512\(encryptedBytes\) : \(sealedBytes \? await computeSHA512\(sealedBytes\) : null\)/.test(pageSrc) && !/sealedSha512: window\._voSealedFileHash/.test(pageSrc),
    'the certificate says which bytes each fingerprint belongs to, and prints the delivered file\'s real SHA-512 (as sha512sum computes it; the password-protected copy when one was sent), never the VO-SEAL2 self-check value');
  ok(/existed no later than that block\\'s time/.test(certSrc) && /the sealing device\\'s clock; the anchor does not prove it/.test(certSrc) && /Upload this certificate there to check the anchor status of its digest/.test(certSrc) && /the password-protected copy must be opened with its password first/.test(certSrc) && /hs \? ' The delivered file/.test(certSrc), 'the certificate says what the Bitcoin block proves (an upper bound, not the device clock), which file to upload for which check, and mentions the delivered fingerprint only when it prints one');
  const vsrc = fs.readFileSync(path.join(process.cwd(), 'verify.html'), 'utf8');
  ok(!/court-ready and admissible|OpenTimestamps verified'|\(OTS-anchored\)|'ANCHORED — Bitcoin confirmation pending'|Seal Verified — Genuine|blockchain-anchored, timestamped read-receipt/.test(vsrc), 'verify.html claims no admissibility, no "OTS-anchored" hash and no "anchored" custody event before Bitcoin confirms');
  ok(/cannot tell a deliberately altered copy that was re-sealed from the original/.test(vsrc), 'verify.html says what the self-integrity check cannot show');
  ok(/function parseAnchorCertSubject/.test(vsrc) && /seal\.scheme === 'anchorcert'/.test(vsrc) && /meta\.otsDigest = seal\.otsDigest/.test(vsrc), 'verify.html recognises the anchor certificate and checks its digest instead of showing "No Seal Found"');
}

// ---- §18i The verification pass over §18 (2026-10-02) ----------------------
// Five adversarial lenses re-ran the §18 change set against counterexamples;
// each confirmed defect is pinned here with the reviewer's own reproduction.
{
  const fs = require('fs'), path = require('path');
  const R = require('../forensic-report.js');
  // Engine.
  const cover = ['Submission to the Public Protector on the AllFuels matter. The lease was earlier sealed (Seal ID: VO-210B029F1A0B).', 'Annexure A From: accounts@standardbank.co.za The company XYZ Fuels (Pty) Ltd is registered and active.', 'From: payments@standandbank.co.za Please pay.', 'Tax Invoice 12 XYZ Fuels (Pty) Ltd is deregistered according to CIPC.'];
  const cs = E.voSecondarySegments([], cover);
  ok(cs.length === 1 && cs[0].start === 1 && cs[0].end === 1 && cs[0].submission === true, 'a cover submission in front of its annexures is secondary on its own pages only; the annexures stay the record (' + JSON.stringify(cs) + ')');
  ok(E.voSecondarySegments([], ['Response to Plea IN THE HIGH COURT OF SOUTH AFRICA CASE NO 123/2026', 'the sealed lease (Seal ID: VO-210B029F1A0B).']).length === 0 && E.voSecondarySegments([], ['Reply to the plea of the defendant', 'the sealed lease (Seal ID: VO-210B029F1A0B).']).length === 0, 'a pleading (a court caption, a "Reply") is a primary record');
  const dq = (t) => E.voDatedAfterReference([t], '2026-10-02T20:11:36Z');
  ok(dq('Lease. Date: 14 August 2026 Commencement Date: 1 March 2027 Expiry Date: 28 February 2032').length === 0 && dq('Invoice Date: 25 September 2026 Due Date: 25 October 2026').length === 0 && dq('Notice of set down. Hearing Date: 9 November 2026').length === 0 && dq('Referred to: DG Date: 3 October 2026').length === 1,
    'a commencement, expiry, due or hearing date is a date the document names, not its date; the plain "Date:" still notes');
  ok(E.voDatedAfterReference(['Covering letter. Date: 1 October 2026', 'Minutes. Date: 3 October 2026'], '2026-10-02T20:11:36Z').length === 0 && E.voDatedAfterReference(['Covering letter. Date: 1 October 2026', 'Minutes. Date: 3 October 2026'], '2026-10-02T20:11:36Z', [1, 2]).length === 1, 'only a document\'s first page is read for its date (page 1, and each stated document\'s start)');
  const csPage = 'The original MOU was countersigned by both parties on 1 March 2018 at the head office in Durban. The 2020 addendum that raised the rental was never countersigned by the operator, yet the lessor relied on it and demanded payment.';
  ok(/^The 2020 addendum/.test(E.voSentenceAround(csPage, 'never countersigned') || '') && /^The 2020 addendum/.test(E.voSentenceAround(csPage, 'never countersigned by the operator') || ''), 'a whole-word lowercase cue is keyed as it stands: "never countersigned" is never shortened to "countersigned" and dated by the sentence that says the MOU WAS countersigned');
  ok(/^On 4 May 2021/.test(E.voSentenceAround('On 4 May 2021 the lessor wrote to the tenant through Mr. Smith and stated that i was wrong to bill under section 12B.', 'ugh Mr. Smith and stated that i was wrong') || '') && E.voFragmentCut('ugh Mr. Smith and stated') === -1 && E.voFragmentCut('ication. The contradiction') === 7, 'an abbreviation ("Mr.", "no.", "s.") is not a sentence end; a real boundary inside a fragment still is');
  const c23 = (b) => (DET.D32_DETECT_SIGNATURE_ANOMALY(b) || []).filter(f => f.type === 'CT23');
  ok(c23(['Sanarth Fuels invoiced Mr Smith R45 000 under the unsigned agreements dated 1 March 2019 and 1 March 2020.']).length === 1 && c23(['The franchisor demands payment of rental under both unsigned leases for the sites.']).length === 1 && c23(['a common scheme involving unsigned agreements', 'Goodwill forfeiture clauses in unsigned agreements']).length === 0,
    'a plural that names specific instruments ("the unsigned agreements dated …", "both unsigned leases") still fires; a category of documents does not');
  const c37 = (a, b) => (DET.D25_DETECT_CONTACT_MISMATCH(['x@' + a + ' here', 'y@' + b + ' there']) || []).filter(f => f.type === 'CT37').length;
  ok(c37('dmre.gov.za', 'dmpr.gov.za') === 0 && c37('justice.gov.za', 'justice.gov.uk') === 0 && c37('sars.gov.za', 'sars.go.za') === 1 && c37('sars.gov.za', 'sars.gov.io') === 1 && c37('nta.go.jp', 'nta.go.to') === 1 && c37('hmrc.gov.uk', 'hmrc.gov.us') === 1 && c37('canada.gc.ca', 'canada.go.ca') === 1 && c37('abcd.gov.io', 'abce.gov.io') === 1,
    'only two domains under listed restricted government suffixes are exempt: a lookalike under an unrestricted or non-existent suffix ("go.za", "gov.io", "go.to", "gov.us") still fires');
  const nm = (t) => E.voExtractParties(t).filter(x => x.kind === 'name').map(x => x.name);
  ok(JSON.stringify(nm('Maria Campos signed.')) === '["Maria Campos"]' && JSON.stringify(nm('Texas Instruments')) === '["Texas Instruments"]' && JSON.stringify(nm('Pan African Resources plc')) === '["Pan African Resources"]' && nm('Trevenna Campus').length === 0 && nm('Petroleum Resources department').length === 0 && nm('Critical Point').length === 0,
    'the submission\'s headings are stopped as phrases, so "Campos", "Instruments" and "… Resources" names survive');
  ok(JSON.stringify(nm('Director General Jacob Mbele')) === '["Jacob Mbele"]' && nm('The Director General Jacob Mbele wrote.').every(n => !/^General/.test(n)) && JSON.stringify(nm('Assistant Commissioner Thabo Nkosi said')) === '["Thabo Nkosi"]' && JSON.stringify(nm('General Motors South Africa')) === '["General Motors"]',
    '"Director General" is a role before a name; a cut window never binds "General Jacob"; "General" on its own is a word');
  const hdr = E.voExtractPersonsFromContext('From Gary Highcock <gary@allfuels.co.za> Sent Monday To Rabia Seedat Cc Amrit Singh, Mohamed Ally Subject Lease', 8).map(x => x.name);
  ok(['Gary Highcock', 'Rabia Seedat', 'Amrit Singh', 'Mohamed Ally'].every(n => hdr.indexOf(n) !== -1) && hdr.length === 4 && JSON.stringify(E.voExtractPersonsFromContext('Yours faithfully SMITH & PARTNERS INC Per J Smith', 8).map(x => x.name)) === '["J Smith"]',
    'a colon-free email header (with an address or a header word close after it) and an attorney\'s "Per J Smith" sign-off still bind their names (' + JSON.stringify(hdr) + ')');
  ok(of(DET.D09_DETECT_ENTITY_STATUS_FAKE, ['XYZ Fuels (Pty) Ltd is non‑compliant with the licence.', 'XYZ Fuels (Pty) Ltd is non-compliant with its returns.'], 'CT14').length === 0 && of(DET.D09_DETECT_ENTITY_STATUS_FAKE, ['XYZ Fuels (Pty) Ltd is compliant with the licence.', 'XYZ Fuels (Pty) Ltd is non‑compliant with its returns.'], 'CT14').length === 1, 'a Word-made "non‑compliant" (U+2011) is the negation too, and still pairs with a genuine "compliant"');
  const qp = E.voExtractQuotes('Conflicting entity-status claims: "…Bright Idea Projects 66 (Pty) Ltd ("the Lessor") is compliant with the lease of Erf 12 ("the Premises") to Sanarth Fuels…" (compliant, page 3) vs "…is non-compliant…" (non-compliant, page 4)');
  ok(qp.length === 2 && /\("the Lessor"\) is compliant/.test(qp[0]) && /\("the Premises"\) to Sanarth Fuels/.test(qp[0]), 'a parenthesised defined term ("the Lessor") stays inside the passage');
  const leakEv = ['Conflicting entity-status claims: "…the franchisee that “Bright Fuels (Pty) Ltd is registered as an active company and remains…" (registered, page 1) vs "…Bright Fuels (Pty) Ltd is deregistered…" (deregistered, page 2)',
    'Direct contradiction: "…spondent wrote: "The deed was signed by both parties at the office in durba…" vs "the deed was never signed by the seller"'];
  for (const ev of leakEv) {
    const eq = E.voExtractQuotes(ev), rq = R._anchorQuotes({ type: 'CT01', evidence: ev });
    ok(eq.length === 2 && rq.length === 2 && !eq.concat(rq).some(q => /\(page|\(registered| vs |— yet|beside/.test(q)), 'a record quotation the window cut open never swallows the engine\'s own words, in the engine or the report (' + JSON.stringify(rq) + ')');
  }
  // Report.
  ok(R._speakerOf('The applicant states that Sanarth Fuels is deregistered', { identity: { parties: 'Respondent: Sanarth Fuels' } }) === null && R._speakerOf('Sanarth Fuels states that the lease ended in 2020', { identity: { parties: 'Respondent: Sanarth Fuels' } }) === 'Sanarth Fuels' && R._speakerOf('Sanarth Fuels\' position: the operator is errant', { identity: { parties: 'Respondent: Sanarth Fuels' } }) === 'Sanarth Fuels',
    'a statement is quoted as a party\'s own words only when the party is its speaker, never when another person states something about the party');
  ok(R._partyStronglyNamed('Standard Bank', 'the bank confirmed that the deposit was paid') === false && R._partyStronglyNamed('Standard Bank', 'Standard Bank confirmed it') === true && R._partyStronglyNamed('Sanarth Fuels', 'the licence of Sanarth was cancelled') === true && R._partyStronglyNamed('Sanarth Fuels', 'the fuels were delivered') === false,
    'a generic company word ("bank", "fuels") never on its own shows that a passage names the party');
  ok(R._humanNumberable({ type: 'CT41', severity: 4, location: 'PDF structure', evidence: 'incremental update after signing' }) === false && R._humanNumberable({ type: 'CT01', severity: 3, location: 'Page 2', evidence: 'x said "a" vs "b"' }) === true, 'a page-less engine finding is not numbered F#: the narrator, the court-ready narrative and Findings in Detail share one numbering');
  ok(/^"abc .*\.\.\.$/.test(R._capText('"abc def ghi jkl mno pqr stu vwx yz', 25)) && R._capText('"abc def ghi jkl mno pqr stu vwx yz', 25).length <= 26 && /"$/.test(R._capText('"abc def ghi jkl mno pqr stu vwx yz"', 25)), 'a display cap closes only a mark the cut opened, never the record\'s own unbalanced one');
  ok(R._aiSectionName({ aiNarrative: 'The record states x [F1]. The record states y [F1]. It may be fraud. It could indicate a crime. It seems so. It appears likely. It suggests dishonesty.', aiNarrativeSource: 'ai' }) === 'AI REVIEW', 'a draft that is mostly prohibited language is not printed under FORENSIC NARRATIVE, and no reference points to that heading');
  ok(R._findingName({ type: 'CT23', evidence: 'The record states a signature is missing ("unsigned agreement"): "x"' }) === 'Unsigned Agreement Stated' && R._findingName({ type: 'CT23', evidence: 'Non-standard signature method "/s/": "x"' }) === 'Signature Mismatch', 'the unsigned-agreement shape has its own name, never "Signature Mismatch"');
  ok(R._hasTwoSidedFinding({ findings: { findings: [{ type: 'CT02', severity: 4, location: 'Page 2', evidence: '"purchase price" is stated as R450,000 and as R470,000' }] } }) === true && R._hasTwoSidedFinding({ findings: { findings: [{ type: 'CT37', severity: 3, location: 'Page 4', evidence: 'Lookalike email domain: "a.co.za" (p. 4) beside "b.co.za" (p. 4)' }] } }) === false, 'a restated figure is two statements by its type; a lookalike domain is one observation');
  const page = fs.readFileSync(path.join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/window\.VerumReport\._humanNumberable/.test(page) && /if \(!anyAi && merged\.reason !== 'gate_failed'\) merged\.reason = 'time_budget'/.test(page), 'the page numbers with the report\'s predicate, and a discarded batch is not relabelled "time budget"');
  ok(!/anchored to the Bitcoin blockchain, so it cannot be altered|permanent public record that it existed at the sealed date and time/.test(page) && /submitted to OpenTimestamps for anchoring to the Bitcoin blockchain/.test(page), 'the share texts sent at sealing say "submitted", never "anchored" or "permanent"');
  ok(/return await certDoc\.save\(\{ useObjectStreams: false \}\)/.test(page.slice(page.indexOf('async function buildAnchorCertificate('), page.indexOf('async function buildAnchorCertificate(') + 14000)), 'the anchor certificate keeps its Info dictionary readable to verify.html\'s raw scan');
  const vs = fs.readFileSync(path.join(process.cwd(), 'verify.html'), 'utf8');
  ok(/window\.requestPasswordFromSender = requestPasswordFromSender/.test(vs) && /could not be reached, so it was not submitted for anchoring/.test(vs), 'the password request is reachable from its button, and says when the receipt was not submitted');
  ok(/'Seal Present — OTS Format'/.test(vs) && !/'Seal Verified — OTS Format'/.test(vs) && !/Pending confirmation \(1-2 hours typical\)/.test(vs) && /seal\.scheme === 'OTS' && \/\^\[0-9a-fA-F\]\{128\}\$\/\.test/.test(vs), 'an OTS-format footer is a seal present, never verified, and its digest is resolved for the anchor check');
  ok(/pdfSeal\.scheme === 'anchorcert' \|\| pdfSeal\.scheme === 'sealcert'\) && seal && \(seal\.scheme === 'v2' \|\| seal\.scheme === 'legacy'\)/.test(vs), 'a certificate Subject added to a sealed file never replaces the seal the raw scan found');
  ok(/\.custody-badge\.anchor_certificate/.test(vs) && /lastSeal\.scheme === 'anchorcert' \? '' : '; the seal/.test(vs) && /the sealing device's clock; once Bitcoin confirms/.test(vs), 'the certificate verdict is styled and claims no integrity verdict, and the custody caption says what the seal time is');
}

// ---- §18j The last verification items (2026-10-03) --------------------------
{
  const fs = require('fs'), path = require('path');
  const g = globalThis; const PDFLib = g.PDFLib;
  const R = require('../forensic-report.js');
  const pageText = async (bytes) => {
    const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const parts = [];
    for (let i = 0; i < loaded.getPageCount(); i++) parts.push((await E.extractPageText(bytes, i, loaded)).join(' '));
    return parts.join(' \n ').replace(/[ \t]+/g, ' ');
  };
  ok(R._partyStronglyNamed('Liam Highcock', 'Gary Highcock signed the lease') === false && R._partyStronglyNamed('Liam Highcock', 'L. Highcock signed the lease') === true && R._partyStronglyNamed('Liam Highcock', 'Liam Highcock signed the lease') === true,
    'a declared person is named by the whole name or an initial and surname; another person sharing the surname is not that party');
  const one = E.voExtractPersonsFromContext('From: Zeyd Timol To: Wayne Nel Dear Gary Highcock Sent Monday Subject Lease', 8).map(x => x.name);
  ok(JSON.stringify(one) === '["Zeyd Timol","Wayne Nel","Gary Highcock"]', 'on one-line page text (production text carries no line breaks) a header value ends at the next header word (' + JSON.stringify(one) + ')');
  const engSrc = fs.readFileSync(path.join(process.cwd(), 'forensic-engine-page.js'), 'utf8');
  ok(/a party\\'s submission that cites other sealed records \(its characterisations of those records are not the records themselves\)/.test(engSrc), 'the secondary-source disclosure says which cue fired: a submission does not describe itself as an extract');
  const fx = [
    { type: 'CT05', severity: 5, location: 'Page 2', evidence: 'Causal impossibility: "the goods were delivered before they were ordered" (p. 2)', anchor: { where: [2], who: [], when: [], quote: [] } },
    { type: 'CT01', severity: 3, location: 'Page 3 vs Page 4', evidence: 'Direct contradiction: "the lease was renewed in 2019" vs "the lease was never renewed"', anchor: { where: [3, 4], who: [], when: [], quote: [] } },
    { type: 'CT23', severity: 2, location: 'Page 6', evidence: 'The record states a signature is missing ("unsigned agreement"): "the Respondent relies on an unsigned agreement for the rental" — verify execution against the signature pages of the original', anchor: { where: [6], who: [{ name: 'Gary Highcock', kind: 'name' }], when: [], quote: [] } },
    { type: 'CT14', severity: 4, location: 'Page 7', evidence: 'Conflicting entity-status claims: "The applicant states that Sanarth Fuels is deregistered and closed" (deregistered, page 7) vs "Sanarth Fuels is registered" (registered, page 8)', anchor: { where: [7, 8], who: [{ name: 'Sanarth Fuels', kind: 'name' }], when: [], quote: [] } }
  ];
  const opts = { documents: [{ name: 'x.pdf', pageCount: 9, sha512: 'cd'.repeat(64), sealId: 'VO-ABCDEF123456' }],
    findings: { clean: false, overallScore: 40, confidence: 'LOW', totalFindings: fx.length, findings: fx, summary: 'x', contradictionTypesUsed: 4 },
    identity: { parties: 'Respondent: Sanarth Fuels' }, aiReview: { applied: true, retained: 4, assessed: 4, dropped: 0, added: 0, narrative: '' }, ots: { submitted: true }, ocrPages: [], images: {}, generatedAt: '2026-10-03T08:00:00.000Z' };
  const run18j = async () => {
    const quiet = console.log; console.log = () => {};
    let T, N;
    try {
      T = await pageText(await R.build(opts));
      N = await pageText(await R.buildHumanReport(Object.assign({}, opts, { humanSections: { counter_narratives: { provenance: 'ai', text: 'This may be fraud [F1]. It could be.' } }, humanProvenance: { sectionsAttempted: 1 } })));
    } finally { console.log = quiet; }
    const tf = T.replace(/\s+/g, ' ');
    const dish = tf.slice(tf.lastIndexOf('2. DISHONESTY DETECTION MATRIX'), tf.indexOf('3. NINE-BRAIN', tf.lastIndexOf('2. DISHONESTY DETECTION MATRIX')));
    ok(dish.indexOf('Evasion / Deflection') !== -1 && dish.indexOf('Contradictions') !== -1 && dish.indexOf('Evasion / Deflection') < dish.indexOf('Contradictions') && /Selective Omissions[^]*unsigned agreement/.test(dish), 'the dishonesty rows are ordered by their most serious finding (an Evasion row at severity 5 above Contradictions), and an unsigned-agreement statement is a Selective Omission (' + dish.slice(0, 260) + ')');
    ok(/- Finding: /.test(tf) && /CONTRADICTION FOUND/.test(tf), 'each Nine-Brain block carries the template\'s Finding line');
    ok(/A declared party is listed where the finding's own words name it; otherwise the names on its cited pages are listed, marked "\(named on the cited pages\)"/.test(tf) && !/Attribution records that the party is named in the flagged text/.test(tf), 'the Statutory Anchoring footnote says what each row kind is');
    ok(/The seal check alone cannot show that a copy was not altered and re-sealed with its own hash; to rule that out, compare the delivered file's SHA-512/.test(tf) && !/verification would fail/.test(tf + N), 'Section 7 says what the seal check shows and how to rule out a re-seal, as verify.html does (the explainer page is gone, its one substantive line kept)');
    ok(/It concerns Sanarth Fuels/.test(tf) && !/Sanarth Fuels — the record states/.test(N), 'a declared party named in a finding is the party it concerns, but another person\'s statement about it is never quoted as its own words');
    const nf = N.replace(/\s+/g, ' ');
    ok(/No AI-written section passed the gates, so this narrative is the deterministic record/.test(nf) && /No AI-written section passed the gates; it is the deterministic record built/.test(nf) && /No section of this document is machine-written prose/.test(nf) && !/the prose is machine-written, gated, and advisory/.test(nf), 'when no AI-written section passed the gates, the cover, the certification and the provenance paragraph say the narrative is the deterministic record');
  };
  await run18j();
}

console.log(`\n[annexure-eb] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[annexure-eb] FAILURES'); process.exit(1); }
console.log('[annexure-eb] ALL GREEN');
