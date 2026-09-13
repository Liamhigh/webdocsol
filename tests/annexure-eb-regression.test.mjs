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

console.log(`\n[annexure-eb] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[annexure-eb] FAILURES'); process.exit(1); }
console.log('[annexure-eb] ALL GREEN');
