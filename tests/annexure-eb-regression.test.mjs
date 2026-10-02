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
  ok(/'NOT REVIEWED'/.test(tv) && !/: 'ENGINE-VERIFIED'/.test(tv), 'the Triple Verification review leg reads NOT REVIEWED when the AI review did not run');
  const cover = src.slice(src.indexOf('function drawCover'), src.indexOf('function drawCover') + 9000);
  ok(/INCOMPLETE READ: /.test(cover) && /AI REVIEW NOT RUN/.test(cover), 'the cover carries the incomplete-read and not-reviewed banners');
  const page = require('fs').readFileSync(require('path').join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/async function voPreflightForensicService/.test(page) && /var _pre = await voPreflightForensicService\(\);/.test(page) && /no forensic report was produced and nothing was sealed/.test(page),
    'forensic mode pre-flights the service and refuses to produce an unreviewed forensic report on a host with no API');
  ok(/function voOcrAskToContinue/.test(page) && /candidates = candidates\.concat\(cappedIdx\);/.test(page), 'the OCR cap asks once whether to read the remaining scanned pages');
  ok(/findings_json_version: '1\.3\.0'/.test(page) && /review_status: /.test(page) && /ocr_provenance: /.test(page), 'findings JSON v1.3.0 carries review_status and ocr_provenance');
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
  ok(!/integrity score|confidence rating|input\.score|input\.confidence/.test(tmpl) && /engine-verified finding/.test(tmpl) && /AI-raised candidate/.test(tmpl),
    'the Worker\'s template narrative prints no score and no band, and counts engine-verified findings apart from AI-raised candidates');
  ok(/SWEEP_VERDICT_RE/.test(wsrc) && /Neutral language only/.test(wsrc), 'Brain 9 is told to use neutral language and conclusory items are discarded server-side');
  const rsrc = fs.readFileSync(path.join(process.cwd(), 'forensic-report.js'), 'utf8');
  const gate = rsrc.slice(rsrc.indexOf('var VO_BANNED_SENTENCE_RE'), rsrc.indexOf('var VO_MONTH_MAY_RE'));
  ok(/integrity\|fraud\|risk\|overall\)\\\\s\+score/.test(gate) && /confidence\\\\s\+\(\?:rating\|band\|level\|score\)/.test(gate), 'the §15.2 render gate drops score and confidence-band sentences');
  const narr = rsrc.slice(rsrc.indexOf('function secNarrative'), rsrc.indexOf('function secNarrative') + 14000);
  ok(/f\.source !== 'ai' && f\.type !== 'SERIAL'/.test(narr) && /not counted here/.test(narr), 'the narrative counts engine-verified findings only and tells AI candidates apart');
  ok(/no draft passed the server\\'s anchor and language gate/.test(rsrc), 'the narrator provenance line says when every section was asked for and discarded');
  const page = fs.readFileSync(path.join(process.cwd(), 'seal-document.html'), 'utf8');
  ok(/window\._voNarrateTemplate \? 'local' : 'ai'/.test(page) && /res\.model === 'template-fallback'/.test(page), 'template text from the Worker is labelled local, never as the AI narrator\'s writing');
  ok(/reportFraudResult\.summary = generateSummary\(assessRes\.findings/.test(page), 'the summary sentence is recomputed on the retained engine findings');
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
  ok(/2 page-anchored findings established/.test(summ) && !/severity is|\b(?:moderate|high|critical)\b/i.test(summ), 'the short summary states the count and no severity band (' + summ + ')');

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
    ok(!/DOMAIN_TYPO/.test(slice('Top liabilities', 'Recommended next steps')), 'an AI candidate is never a "top liability"');
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
  const ct20 = (b) => of(DET.D11_DETECT_REGISTRATION_FAKE, b, 'CT20').filter(f => !f.contextOnly);
  const idF = ct20(['ID/Registration number of complainant 510209 5091087']);
  const idT = ct20(['ID/Registration number of complainant 510209 5091 0']);
  ok(idF.length === 1 && idF[0].severity === 2 && /identity number/.test(idF[0].evidence) && idT.length === 1 && idT[0].severity === 2 && /identity number/.test(idT[0].evidence),
    '"ID/Registration number of complainant 510209 5091087" is an identity number (sev 2 note), even when OCR cut it short — never "not a valid format"');
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
  ok(idOcr.some(f => !f.contextOnly && f.severity === 2 && /identity number/.test(f.evidence)) && !idOcr.some(f => f.contextOnly && /reads as/.test(f.evidence)), 'an identity number under an ID/Registration field is never "repaired" into a nearby company number');
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
  ok(badInv.filter(f => !f.contextOnly).length === 0 && badInv.some(f => f.contextOnly && /do not read as one invoice/.test(f.evidence) && /text layer may have separated/.test(f.evidence)), '"subtotal R1161950, VAT R1, total R1.08" is an unreadable invoice (a note), not an amount discrepancy; on a native page the note blames the text layer, not OCR');
  ok(d13(['[OCR] Subtotal: R1161950 VAT: R1 Total: R1.08']).some(f => f.contextOnly && /the OCR may have broken the numbers/.test(f.evidence)), 'the same figures on an OCR page say so (p.397)');
  ok(d13(['Subtotal: R1,000.00 VAT: R150.00 Total: R1,250.00']).filter(f => f.type === 'CT15').length === 1, 'a plausible invoice whose total does not add up still fires');
  ok(d13(['Subtotal: R1,000.00 for the goods', 'VAT: R150.00 Total: R1,250.00']).filter(f => !f.contextOnly).length === 0, 'figures on different pages are never combined into one invoice');
  ok(E.voCapOcrFormatFindings([{ type: 'CT15', severity: 5, location: 'Page 397', evidence: 'Total mismatch' }, { type: 'CT22', severity: 4, location: 'Page 397', evidence: 'VAT mismatch' }], [397]).capped === 2, 'an invoice\'s arithmetic on an OCR page is held at reduced weight like every other figure');
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
    { type: 'CT02', severity: 4, location: 'Page 2', evidence: '"total" is stated as R1 and as R2' }
  ], secPages);
  ok(demo.leads.length === 1 && demo.leads[0].type === 'CT23' && demo.kept.length === 2 && demo.kept[0].type === 'CT45' && demo.kept[0].severity === 2 && /secondary source on p\. 5/.test(demo.kept[0].evidence) && demo.kept[1].severity === 4,
    'a finding wholly on the extract is a lead, a mixed one is held at reduced weight and tagged, an unrelated one is untouched');
  ok(E.voSecondaryPages([{ start: 1, end: 3, title: 'Lease agreement prepared by the Lessor\'s attorneys' }], ['Lease agreement prepared by the Lessor\'s attorneys. 1. Parties.', '', '']).length === 0, 'a primary instrument that says who prepared it is not an extract');

  // 17h. A finding is dated by its own words or by the quote\'s own sentence, never by the rest of the page.
  const blocksD = new Array(10).fill('');
  blocksD[2] = 'The lease commenced on 1 August 2001 and runs for ten years. The goodwill of the business is a quantifiable asset recognised by both parties. Signed at Durban on 12 December 2018 before a commissioner.';
  const fA = [{ type: 'CT45', severity: 5, evidence: 'Goodwill recognised: "The goodwill of the business is a quantifiable asset recognised by both parties" — yet denied elsewhere', location: 'Page 3' }];
  E.voAnchorEnrich(fA, blocksD);
  ok(JSON.stringify(fA[0].anchor.when) === '[]', 'a quote whose own sentence carries no date gets no date from the rest of the page (' + JSON.stringify(fA[0].anchor.when) + ')');
  const fC = [{ type: 'CT04', severity: 4, evidence: 'Billing after expiry: "runs for ten years" — yet invoices continue', location: 'Page 3' }];
  E.voAnchorEnrich(fC, blocksD);
  ok(fC[0].anchor.when.length === 1 && fC[0].anchor.when[0] === '1 August 2001', 'the quote\'s own sentence may date it, once (' + JSON.stringify(fC[0].anchor.when) + ')');

  // 17i. Parties.
  ok(!E.voLooksLikePerson('Supreme Court') && !E.voLooksLikePerson('Service Station') && !E.voLooksLikePerson('Timol de') && !E.voLooksLikePerson('Auditors Name Postal Address') && E.voLooksLikePerson('Zeyd Timol') && E.voLooksLikePerson('E de Waal'),
    '"Supreme Court", "Service Station", "Timol de" and "Auditors Name Postal Address" are not parties; "Zeyd Timol" and "E de Waal" are');

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
  ok(/held at reduced weight/.test(R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x' }, { type: 'CT03', severity: 2, evidence: 'y [OCR page: weight reduced until the quoted characters are verified against the page image]' }], true)) && R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x' }], true) === '1 verified finding',
    'the count phrase tells reduced-weight findings apart and is unchanged when there are none');
  ok(/2 findings: 1 verified at full weight, and 1 anchored on OCR-recovered pages/.test(R._voCountPhrase([{ type: 'CT02', severity: 4, evidence: 'x', location: 'Page 2' }, { type: 'CT20', severity: 2, evidence: 'identity number', location: 'Page 7' }], true, [7])),
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
      findings: { clean: false, overallScore: 40, confidence: 'LOW', totalFindings: 3, findings: findings, summary: '3 page-anchored findings established.', contradictionTypesUsed: 3 },
      aiReview: { applied: true, retained: 3, assessed: 6, dropped: 3, added: 0, narrative: '' },
      extractionNotes: 'Per-page PDF content-stream decoding with ToUnicode CMaps.', ocrPages: [7], images: {}, generatedAt: '2026-09-30T20:59:16.000Z'
    };
    const quiet = console.log; console.log = () => {};
    let T, N;
    try {
      T = await pageText(await R.build(opts));
      N = await pageText(await R.buildHumanReport(Object.assign({}, opts, {
        humanSections: {
          counter_narratives: { provenance: 'ai', text: 'The respondent may have signed the lease under pressure from the franchisor.\nThis account conflicts with the record at p. 7, which states "Commencement Date 1/8/2001". Assessment: contradicted by the record at p. 7.\nThe franchisor states that the lease commenced on 1 August 2001 and ran its full term.\nThis account conflicts with the record at p. 9, which states "commenced 1/8/2003". Assessment: contradicted by the record at p. 9.', gate: { dropped: 1 } },
          // a section the render-time gate rejects whole: its server-gate count still counts (Sourcery, PR #212)
          legal_framework: { provenance: 'ai', text: 'This may constitute fraud. It could indicate dishonesty by the franchisor.', gate: { dropped: 2 } }
        },
        humanProvenance: { sectionsAttempted: 7, model: 'test-narrator' }
      })));
    } finally { console.log = quiet; }
    const slice = (from, to) => { const a = T.lastIndexOf(from); const b = to ? T.indexOf(to, a + 1) : -1; return a < 0 ? '' : T.slice(a, b > a ? b : undefined); };
    ok(/Franchise \/ Lease & Goodwill/.test(slice('FINDINGS & CONTRADICTION MATRIX', 'Finding type summary')), 'the findings matrix carries the Franchise / Lease & Goodwill category (CT44/CT45 were missing from it)');
    ok(/The review dropped 3 engine findings as unsupported/.test(T), 'the Triple Verification table says how many findings the review dropped');
    ok(!/cannot be changed, altered, or deleted/.test(T) && /any change to them is detectable/.test(T), 'the seal is described as tamper-evident, never as preventing change');
    ok(/3 findings: 2 verified at full weight, and 1 anchored on OCR-recovered pages or on a secondary source and held at reduced weight/.test(T), 'the cover count tells the OCR-held finding apart (' + (T.match(/contains [^.]{0,200}/) || [''])[0] + ')');
    ok(!/Organised Crime/.test(slice('Person → Contradiction → Page → Candidate law', 'CANDIDATE OFFENCE MATRIX')) || /CT18/.test(slice('Person → Contradiction → Page → Candidate law', 'CANDIDATE OFFENCE MATRIX')), 'the arithmetic finding\'s row cites no money-laundering provision');
    ok(/lease commenced on 1 August 2001/.test(N) && /p\. 9, which states/.test(N) && !/p\. 7, which states/.test(N), 'a rebuttal whose claim the gate removed is dropped whole; the kept claim keeps its rebuttal');
    ok(/server's anchor and language gate: 3/.test(N) && /render-time §15\.2 gate: 3/.test(N), 'the provenance box prints both gate counters (server 1 + 2 from the section the render gate rejected; render-time 3 = the hedged claim and its two orphaned sentences)');
  };
  await run();
}

console.log(`\n[annexure-eb] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[annexure-eb] FAILURES'); process.exit(1); }
console.log('[annexure-eb] ALL GREEN');
