/**
 * Recall + noise regression guard for the core detectors that were previously
 * either brittle (D01 fixed word-pairs, D02 10% gate) or effectively silent
 * (D03 numeric/label gaps), or that fabricated allegations from keyword absence
 * (D23/CT35). These tests pin the improved recall AND the hard requirement that
 * a clean document produces ZERO findings — the whole point of the earlier
 * noise work was that a report must not invent contradictions.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DET = require('../forensic-engine-page.js').DETECTORS;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const fires = (fn, blocks) => (fn(blocks) || []).length > 0;

console.log('======================================================');
console.log('RUN  detector-recall.test.mjs');
console.log('======================================================\n');

// D01 — same-token assertion vs negation (beyond the fixed pairs)
ok(fires(DET.D01_DETECT_DIRECT_CONTRADICTION, ['The payment was made in full. He later stated no payment was ever made.']),
  'D01 catches "payment ... no payment" (not in the fixed pair list)');
ok(fires(DET.D01_DETECT_DIRECT_CONTRADICTION, ['The company acknowledged the debt is owed. In its plea it denied that any debt is owed.']),
  'D01 catches "debt owed ... denied ... debt"');
// D01 must quote BOTH the affirming and negating passage (not a one-sided word)
{
  const f = DET.D01_DETECT_DIRECT_CONTRADICTION(['The deed was signed by both parties. The respondent says it was never signed.']);
  ok(f.length > 0 && /vs/.test(f[0].evidence), 'D01 finding quotes both sides (affirm vs negate), not a bare word');
}
// D01 must NOT fire on incidental words or on PDF-extraction fragments. The real
// 341-page scan produced "asserts and negates \"alue\"" because "V alue" was
// split across a line break; keying on curated whole claim words prevents this.
ok(!fires(DET.D01_DETECT_DIRECT_CONTRADICTION, ['There is no V alue in the goodwill clause. The value was recorded elsewhere.']),
  'D01 does NOT fire on a PDF-split fragment ("alue") or the incidental word "value"');
ok(!fires(DET.D01_DETECT_DIRECT_CONTRADICTION, ['AllFuels did not attend. AllFuels later confirmed the position of AllFuels.']),
  'D01 does NOT fire on an incidental proper noun near a negator ("allfuels")');

// D02 — same-label restatement below the old 10% gate
ok(fires(DET.D02_DETECT_NUMERICAL_DISCREPANCY, ['Invoice total: R450,000 shown here. Invoice total: R470,000 shown there.']),
  'D02 catches a same-label total restated at 450k vs 470k (4.3%, under the old 10% gate)');

// D03 — ISO dates + broader labels
ok(fires(DET.D03_DETECT_DATE_INCONSISTENCY, ['The contract was signed on 2019-01-10. The same contract was signed on 2019-03-22.']),
  'D03 catches an ISO date restated under the same label ("signed on")');
ok(fires(DET.D03_DETECT_DATE_INCONSISTENCY, ['Effective Date: January 15, 2023. Effective Date: March 1, 2023.']),
  'D03 still catches month-name labelled-date restatement');

// D23 / CT35 — explicit breach only, never keyword-absence
ok(fires(DET.D23_DETECT_PROCEDURE_BREACH, ['The forfeiture clause was never countersigned by the franchisor.']),
  'D23 flags an EXPLICIT breach ("never countersigned")');
ok(!fires(DET.D23_DETECT_PROCEDURE_BREACH, ['The parties entered a valid agreement and contract, duly signed.']),
  'D23 does NOT fabricate a breach from the mere absence of "witness"/"resolution"');

// Real-bundle false positives surfaced by the Greensky scan (all must be quiet
// on the benign case and still fire on the genuine one).
// CT28 image manipulation must not fire on the ubiquitous word "compressed"
// (users compress files just to upload them) or on "cropped" with no image.
ok(!fires(DET.D33_DETECT_IMAGE_MANIPULATION, ['greensky_compressed_compressed(1)-sealed.pdf — the timeline was compressed and the section cropped.']),
  'D33 does NOT flag "compressed"/"cropped" without an image (was a false tampering allegation)');
ok(fires(DET.D33_DETECT_IMAGE_MANIPULATION, ['The photograph exhibit was clearly cropped to hide the date stamp.']),
  'D33 still flags a manipulation verb next to an actual image');
// CT30 version must require the full word, not bare "v9"/"v3".
ok(!fires(DET.D35_DETECT_VERSION_ANOMALY, ['file v9 and later v3 appear in the name']),
  'D35 does NOT read bare "v9"/"v3" as a version going backwards');
ok(fires(DET.D35_DETECT_VERSION_ANOMALY, ['Version 9 of the deed. Later filed as Version 3.']),
  'D35 still flags a real labelled version decrease');
// CT10 role must require an explicit authority challenge, not mere absence.
ok(!fires(DET.D07_DETECT_ROLE_CONTRADICTION, ['The trustee signed and the authorized signatory approved it.']),
  'D07 does NOT flag a role merely because a supporting document is not mentioned');
ok(fires(DET.D07_DETECT_ROLE_CONTRADICTION, ['The purported trustee acted without the authority to bind the trust.']),
  'D07 flags a role only when its authority is expressly challenged');
// CT03 must report a repeated date value once, not once per repeat.
{
  const f = DET.D03_DETECT_DATE_INCONSISTENCY(['termination date: 7 March 2025', 'termination date: 13 March 2025', 'termination date: 13 March 2025']);
  ok(f.length === 1, 'D03 reports a repeated conflicting date once, not duplicated (got ' + f.length + ')');
}

// A generic label carrying MANY distinct values is a line-item list (a bill of
// costs, or a bundle of separately-dated letters), NOT one figure/date restated.
// The Louw v Moolla full-OCR scan produced 19 false CT02 + 10 false CT03 from
// exactly this. Lists must be skipped; genuine 2-value restatements still fire.
ok(!fires(DET.D02_DETECT_NUMERICAL_DISCREPANCY, ['amount R225.00 amount R15,000 amount R50,000 amount R225,000 amount R275,000 amount R550,000']),
  'D02 skips a many-valued "amount" line-item list (no false restatement)');
ok(fires(DET.D02_DETECT_NUMERICAL_DISCREPANCY, ['Invoice total: R450,000 here. Invoice total: R470,000 there.']),
  'D02 still flags a genuine two-value total restatement');
ok(!fires(DET.D03_DETECT_DATE_INCONSISTENCY, ['dated 8 February 2015 dated 10 February 2015 dated 16 March 2015 dated 29 May 2016 dated 4 November 2016']),
  'D03 skips a many-valued "dated" list (index of separately-dated letters)');
ok(fires(DET.D03_DETECT_DATE_INCONSISTENCY, ['Effective Date: January 15, 2023.', 'Effective Date: March 1, 2023.']),
  'D03 still flags a genuine two-value labelled-date restatement');
// CT36 must not report an implausible OCR-noise address count.
ok(!fires(DET.D24_DETECT_ADDRESS_CONFLICT, [Array.from({length: 60}, (_, i) => (i + 1) + ' Fake Street').join(' ')]),
  'D24 suppresses an implausibly high (OCR-noise) address count');

// ===== CT03 date-format false positive (Geraldine run) =====
// 10/18/2024 is a valid US date (18 Oct); flagging it "invalid month" was a
// false positive. 31/02/2021 is impossible read EITHER way and must still fire.
{
  const f = DET.D03_DETECT_DATE_INCONSISTENCY(['Payment received on 10/18/2024 for the account.']);
  ok(!f.some(x => /Impossible date|Invalid month/i.test(x.evidence)),
    'D03 does NOT flag 10/18/2024 as impossible/invalid — it is a valid US-format date');
}
ok(DET.D03_DETECT_DATE_INCONSISTENCY(['The affidavit was signed 31/02/2021 before me.'])
   .some(x => /Impossible date/i.test(x.evidence)),
  'D03 still flags 31/02/2021 — impossible read as day/month OR month/day');
{
  // A bundle mixing conventions gets ONE anchored, non-overclaiming note.
  const f = DET.D03_DETECT_DATE_INCONSISTENCY(['Dated 18/10/2024 by the lessor.', 'Countersigned 10/18/2024 by the lessee.']);
  const mix = f.filter(x => /mixes date formats/i.test(x.evidence));
  ok(mix.length === 1 && /Page 1 vs Page 2/.test(mix[0].location),
    'D03 emits exactly one anchored "mixes date formats" note for a mixed bundle');
}

// ===== CT23 signature-method false positive (Geraldine run) =====
// "power of attorney" is a legal instrument, not a signing method.
ok(!fires(DET.D32_DETECT_SIGNATURE_ANOMALY, ['A power of attorney was granted to the authorized representative.']),
  'D32 does NOT flag "power of attorney" as a non-standard signature method');
{
  const f = DET.D32_DETECT_SIGNATURE_ANOMALY(['ok', 'The lease was signed per pro by the agent.']);
  ok(f.length === 1 && f[0].type === 'CT23' && /^Page 2$/.test(f[0].location) && /signed per pro/i.test(f[0].evidence),
    'D32 flags a real surrogate signing ("signed per pro") anchored to its actual page with a quote');
}

// ===== CT09 identity numbers must be distinct + cited (Geraldine run) =====
{
  // The same reference code repeated is ONE value, not "3 different ID numbers".
  const f = DET.D06_DETECT_IDENTITY_CONFLICT(['Ref AB1234567 on this line. Ref AB1234567 again. Ref AB1234567 once more.']);
  ok(!f.some(x => x.type === 'CT09'),
    'D06 does NOT report a single repeated reference code as multiple ID numbers');
}
{
  const f = DET.D06_DETECT_IDENTITY_CONFLICT(['Holder AB1234567 noted.', 'Other CD7654321 recorded.']);
  const ct09 = f.find(x => x.type === 'CT09');
  ok(ct09 && /AB1234567/.test(ct09.evidence) && /CD7654321/.test(ct09.evidence),
    'D06 CT09 cites the actual identity-shaped values (cite-or-stay-silent)');
}

// ===== CT20 registration false positive (Geraldine run) =====
// A 14-digit bank reference with NO "registration" label must not be called a
// fake company registration, and a VALID reg number that recurs must not fire.
ok(!fires(DET.D11_DETECT_REGISTRATION_FAKE, ['Self Service Terminal 33348381876106 DebiCheck Debit Order 33348381876106']),
  'D11 does NOT flag a bare 14-digit bank reference (no "registration" label)');
ok(!fires(DET.D11_DETECT_REGISTRATION_FAKE, ['Registration number 2013/199336/07 on page one.', 'Registration number 2013/199336/07 again on page two.']),
  'D11 does NOT flag a VALID SA registration number just because it recurs');
{
  const f = DET.D11_DETECT_REGISTRATION_FAKE(['The entity gives its registration number 33348381876106 in the letter.']);
  ok(f.length === 1 && f[0].type === 'CT20' && /33348381876106/.test(f[0].evidence),
    'D11 flags a number LABELLED as a registration that is not a valid SA format, and quotes it');
}

// Repeated internal page numbers in a compiled bundle must collapse to ONE
// summary, not 25 near-identical findings that drown the substantive ones
// (the Louw v Moolla scan produced 25). One or two duplicates still list individually.
{
  const bundle = [];
  for (let i = 1; i <= 23; i++) bundle.push('page ' + i + ' of 23');
  for (let i = 1; i <= 23; i++) bundle.push('page ' + i + ' of 23');
  const f = DET.D18_DETECT_PAGE_MANIPULATION(bundle);
  ok(f.length === 1 && /internal page numbers repeat/.test(f[0].evidence),
    'D18 collapses many repeated page numbers into one bundle summary (got ' + f.length + ')');
}
ok(DET.D18_DETECT_PAGE_MANIPULATION(['page 5 of 10', 'page 5 of 10']).length === 1,
  'D18 still reports a single genuine duplicate individually');

// The load-bearing guarantee: a clean document produces ZERO findings across
// all text detectors (this is what regressed into 2 false CT35 findings before).
const skip = new Set(['D15_DETECT_METADATA_FRAUD','D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH','D16_DETECT_FONT_ANOMALY','D37_DETECT_INTERNAL_CONFLICT_CATCHALL']);
const clean = ['The franchisee operated the Port Edward service station under a valid licence. Rent was paid monthly, statements reconciled, and the agreement was renewed on schedule with the consent of both parties.'];
let cf = [];
for (const [k, fn] of Object.entries(DET)) { if (typeof fn !== 'function' || skip.has(k)) continue; try { cf = cf.concat(fn(clean) || []); } catch (e) {} }
ok(cf.length === 0, 'a clean document yields ZERO findings across all text detectors (was 2 false CT35): got ' + cf.map(x => x.type).join(','));

// ===== Precision fixes: the false positives the AllFuels v2.0 run exposed =====
const SERIAL = require('../forensic-engine-page.js').detectSerialPatterns;

// CT08 (D30) must NOT treat function words as defined terms. The run reported
// terms "this", "by" and "agreement" from "this means that", "by means of",
// "agreement means the ...".
{
  const f = DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    'payment shall be made by means of electronic transfer.',
    'this means that the parties agree to proceed.',
    'the agreement means the entire contract between them.'
  ]);
  ok(!f.some(x => /"(by|this|agreement)"/.test(x.evidence)),
    'CT08 does not flag function words ("by"/"this"/"agreement") as defined terms');
}
// CT08 still catches a genuine quoted term redefined in two places.
ok(DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Goodwill" means the going-concern value of the business.',
    'Elsewhere it says "Goodwill" means nothing of compensable value.'
  ]).length > 0,
  'CT08 still catches a real quoted term defined in two places');
// CT08 glossary regression (evidence-bundle-7): a definitions chapter restated
// in an index defines every term twice, IDENTICALLY — 25 such non-findings in
// one run. Identical definitions are NOT a contradiction and must stay silent;
// a real conflict must quote BOTH versions.
ok(DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Caltex Facilities" means the facilities listed in Schedule 2.',
    'Index of terms: "Caltex Facilities" means the facilities listed in Schedule 2.'
  ]).length === 0,
  'CT08 stays silent when a term is re-defined with IDENTICAL wording (glossary/index)');
{
  const d30diff = DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Goodwill" means the going-concern value of the business.',
    'Later: "Goodwill" means nothing of compensable value.'
  ]);
  ok(d30diff.length === 1 && /defined differently/.test(d30diff[0].evidence) && /going-concern/.test(d30diff[0].evidence) && /compensable/.test(d30diff[0].evidence),
    'CT08 conflict evidence quotes BOTH conflicting definitions');
}
// CT08 OCR-noise regression (evidence-bundle-7, 330pp): the SAME agreement
// bound twice into one bundle re-reads "CALTEX" as "CAL TEX", "than" as
// "thari", "portion" as "portions", or cuts the second copy a letter short —
// 8 identical definitions were reported as "defined differently" and, under
// PD16, stated as established fact. OCR jitter is not a conflict; only a
// MATERIAL rewrite of the wording is.
ok(DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Caltex Lubricants" means those Lubricants and CALTEX Petroleum Products (other than Motor Fuel) supplied.',
    'Copy: "Caltex Lubricants" means those Lubricants and CAL TEX Petroleum Products (other thari Motor Fuel) supplied.'
  ]).length === 0,
  'CT08 stays silent on OCR jitter between two copies of the same definition (CAL TEX / thari)');
ok(DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Layout" means any CALTEX customised layout drawings for the Premises or any portion thereof.',
    'Copy: "Layout" means any CAL TEX customised layout drawings for the Premises or any portions thereof.'
  ]).length === 0,
  'CT08 stays silent on singular/plural and spacing OCR noise');
// A one-word rewrite of the defined meaning IS material and must still fire
// (evidence-bundle-7 "Term": Expiration Date vs Termination Date — kept).
{
  const d30term = DET.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '"Term" means the period from the Commencement Date to the Expiration Date, subject to clause 5.',
    'Copy: "Term" means the period from the Commencement Date to the Termination Date; 1.56 "Termination" follows.'
  ]);
  ok(d30term.length === 1 && /Expiration/.test(d30term[0].evidence) && /Termination/.test(d30term[0].evidence),
    'CT08 still fires when the definition wording is materially rewritten (Expiration vs Termination)');
}

// Serial patterns must NOT fire on isolated generic single words in legal text
// (the run raised Digital Signature Forgery on "pdf", Witness Tampering on
// "signed", Loan Fraud on "income/security/obligation").
ok(!SERIAL([
    'the signed pdf template was placed on file',
    'amended and advised as per the record',
    'income and security obligation noted'
  ]).some(f => /Digital Signature Forgery|Witness Statement Tampering|Loan Application Fraud/.test(f.serialName || '')),
  'serial patterns do NOT fire on generic single words (pdf/signed/template/income) in legal text');
// Serial patterns still fire on distinctive multi-word phrases.
ok(SERIAL([
    'dear beneficiary, you have unclaimed funds waiting',
    'a processing fee is required and this is time sensitive',
    'do not disclose this; keep secret this private matter'
  ]).length > 0,
  'serial patterns still fire on distinctive multi-word phrases (advance-fee 419)');

// CT26 (D17): a RUN of blank pages collapses to ONE image-only/OCR note
// (the run produced 7 "possibly inserted/removed" findings on OCR-blank pages).
{
  const pages = ['x'.repeat(1200), 'y'.repeat(1200), '', '', '', '', 'z'.repeat(1200)];
  const f = DET.D17_DETECT_FORMAT_ANOMALY(pages);
  ok(f.length === 1 && /image-only|OCR/i.test(f[0].evidence),
    'CT26 collapses a run of blank pages to one OCR-gap note (not N insertions)');
}
// CT26: a single isolated blank between full pages keeps the insertion reading.
{
  const pages = ['x'.repeat(1200), '', 'y'.repeat(1200), 'z'.repeat(1200), 'w'.repeat(1200)];
  const f = DET.D17_DETECT_FORMAT_ANOMALY(pages);
  ok(f.length === 1 && /inserted or removed/.test(f[0].evidence),
    'CT26 still flags a single isolated blank as possible insertion');
}

// CT11 (D08): bounded match — a local "signed by X on behalf of" fires, but a
// far-apart pair does not sprawl into a seal-debris blob.
ok(DET.D08_DETECT_AUTHORITY_EXCEEDED(['this was signed by john on behalf of acme ltd']).length > 0,
  'CT11 fires on a local "signed by ... on behalf of"');
ok(DET.D08_DETECT_AUTHORITY_EXCEEDED(['signed by john. ' + 'filler '.repeat(60) + 'on behalf of acme']).length === 0,
  'CT11 does not stretch across a large gap (no sprawling seal-debris blob)');

// CT43 (D37): breadth note is neutral, contextOnly (never a counted finding),
// and only at >=8 types. An external reviewer flagged that a meta-observation
// about the engine's own output was being counted as finding #12.
{
  const many = Array.from({ length: 8 }, (_, i) => ({ type: 'CT' + (10 + i) }));
  const f = DET.D37_DETECT_INTERNAL_CONFLICT_CATCHALL([''], many);
  ok(f.length === 1 && f[0].contextOnly === true && (f[0].severity | 0) === 0 && !/fraud/i.test(f[0].evidence),
    'CT43 breadth note is neutral, unscored and contextOnly (routed to notes, not findings)');
  ok(DET.D37_DETECT_INTERNAL_CONFLICT_CATCHALL([''], Array.from({ length: 5 }, (_, i) => ({ type: 'CT' + i }))).length === 0,
    'CT43 does not fire at only 5 indicator types');
}

// ===== Page-anchor back-fill (findings that used to report page 0) =====
const BF = require('../forensic-engine-page.js').voBackfillPageAnchors;
{
  const blocks = ['cover page, nothing here', 'the operator signed the documents; all fuels never signed back then', 'unrelated page text'];
  const f = [{ type: 'CT01', evidence: 'affirms and negates "signed": "the operator signed the documents all fuels never signed back" vs "later text"', location: 'Full document' }];
  BF(f, blocks);
  ok(f[0].location === 'Page 2', 'back-fill pins a quoted passage to its single page (got ' + f[0].location + ')');
}
{
  const blocks = ['introduction', 'the company was registered in 2011 and later liquidated in 2020', 'other'];
  const f = [{ type: 'CT14', evidence: 'Conflicting status claims: registered, liquidated', location: 'Full document' }];
  BF(f, blocks);
  ok(f[0].location === 'Page 2', 'back-fill pins co-occurring colon-tokens to their single page (got ' + f[0].location + ')');
}
{
  // A genuine CROSS-PAGE conflict must never be pinned to a SINGLE page — that
  // was the original guard here, and it still holds. What changed (v5.4
  // multi-page anchoring) is the alternative: instead of falling back to the
  // pseudo-location "Full document" — which fails the anchor rule and drops the
  // finding out of the report entirely — the conflict is now anchored to the
  // real SET of pages its terms occupy. "Pages 1, 2" is not false precision; it
  // is where the two halves actually sit, and a reader can check both. The
  // precision guards live in voPagesForEvidence: probes under 4 normalised
  // chars, and page sets larger than the cap, still anchor nothing.
  const blocks = ['registered appears on this page only', 'liquidated appears on a different page only', 'more'];
  const f = [{ type: 'CT14', evidence: 'Conflicting status claims: registered, liquidated', location: 'Full document' }];
  BF(f, blocks);
  ok(f[0].location !== 'Page 1' && f[0].location !== 'Page 2',
    'back-fill never pins a cross-page conflict to a single page (got ' + f[0].location + ')');
  ok(f[0].location === 'Pages 1, 2',
    'back-fill anchors a cross-page conflict to the real page set instead of "Full document" (got ' + f[0].location + ')');
}
{
  const f = [{ type: 'CT02', evidence: '"total" is stated as 1 and 2', location: 'Page 3' }];
  BF(f, ['a', 'b', 'c']);
  ok(f[0].location === 'Page 3', 'back-fill never overrides a page the detector already set');
}
{
  const f = [{ type: 'CT01', evidence: '"the operator signed everything"', location: 'Full document' }];
  BF(f, ['the operator signed everything here']);
  ok(f[0].location === 'Full document', 'back-fill does nothing with a single text block');
}

// back-fill keeps accented / non-Latin letters (normalization is not lossy).
{
  const blocks = ['nothing here', 'the respondent Nortjé confirmed the amended clause was never signed back', 'other page'];
  const f = [{ type: 'CT01', evidence: '"the respondent Nortjé confirmed the amended clause was never signed back"', location: 'Full document' }];
  BF(f, blocks);
  ok(f[0].location === 'Page 2', 'back-fill anchors an accented-name passage ("Nortjé" preserved): got ' + f[0].location);
}

// back-fill matches across NFC/NFD accent forms (precomposed vs decomposed).
{
  const precomposed = 'Nortj\u00e9';    // é as one codepoint (NFC)
  const decomposed = 'Nortje\u0301';    // e + combining acute (NFD)
  const blocks = ['nothing here', 'the respondent ' + precomposed + ' confirmed the clause was never signed back', 'x'];
  const f = [{ type: 'CT01', evidence: '"the respondent ' + decomposed + ' confirmed the clause was never signed back"', location: 'Full document' }];
  BF(f, blocks);
  ok(f[0].location === 'Page 2', 'back-fill matches across NFC/NFD accent forms: got ' + f[0].location);
}

// ===== CT14 (D09): entity-status words must be used ABOUT AN ENTITY =====
// The AllFuels 320-page run paired "utilities is to be registered" (a lease
// clause) with a case-law mention of liquidation into a CRITICAL "conflicting
// status" with no quotes — read by an external reviewer as a fabrication.
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'All charges shall be borne by the Lessee, in whose name ALL utilities is to be registered.',
    'the estate was finally liquidated after the sequestration hearing concluded years later'
  ]);
  ok(f.length === 0, 'CT14 does NOT pair "utilities to be registered" with an unrelated liquidation mention');
}
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'Palmbili Property Investments is a duly registered company with registration number 2013/199336/07.',
    'The same company was liquidated in 2019 and remains in liquidation.'
  ]);
  ok(f.length === 1 && /registered/.test(f[0].evidence) && /liquidated/.test(f[0].evidence),
    'CT14 still fires when BOTH statuses are used about an entity');
  ok(f.length === 1 && /vs/.test(f[0].evidence) && /page 1/i.test(f[0].evidence) && /page 2/i.test(f[0].evidence),
    'CT14 evidence quotes both passages with their pages (verifiable)');
  ok(f.length === 1 && /Page 1 and Page 2/.test(f[0].location), 'CT14 location names both pages');
}
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'sent by registered mail to the registered office at the registered address'
  ]);
  ok(f.length === 0, 'CT14 ignores registered mail/office/address entirely');
}

// ===== External review of the Greensky sealed report (1 Aug 2026) =====
// CT14: "registered RECORDED DELIVERY letters" (the MOA notices clause) slipped
// the strict mail/letter list via the intervening word and became a CRITICAL
// false positive paired with the MOA's dissolution PROVISION.
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'NOTICES 41. Notices sent by the Company to the Shareholders shall be in the form of registered recorded delivery letters to the address of each Shareholder.',
    'In the event that the Company is dissolved, each Shareholder holds in the Capital a proportionate share.'
  ]);
  ok(f.length === 0, 'CT14 ignores "registered recorded delivery letters" (delivery-method, not status)');
}
// CT14: a status word inside a PROVISION ("shall be dissolved", "in the event
// of liquidation") is hypothetical, not a claim about current status.
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'Palmbili Property Investments is a duly registered company with number 2013/199336/07.',
    'The company shall be dissolved by special resolution should the members so resolve.'
  ]);
  ok(f.length === 0, 'CT14 does not read a dissolution PROVISION ("shall be dissolved") as current status');
}
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'The trust deed provides that upon dissolution of the entity the assets vest; the company is registered.',
    'in the event of liquidation of the company, creditors rank first'
  ]);
  ok(f.length === 0, 'CT14 does not pair a status with "in the event of liquidation" boilerplate');
}
// CT14 regression (evidence-bundle-7 p.72, rated CRITICAL): a franchise
// agreement's insolvency-trigger clause — "if the Franchisee is finally
// liquidated or placed under judicial management" — is a CONDITION, and an
// ENUMERATION of insolvency events is a clause listing the menu, not a
// statement that the entity IS liquidated. Under PD16 a false status "fact"
// is the worst possible output, so both shapes must stay silent.
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'a company, close corporation, trust, partnership, corporate or other business/trading name registered by the Franchisee that incorporates a reference to the Trade Marks without the prior written consent.',
    'This agreement terminates if the Franchisee, being a company or close corporation, is finally liquidated or placed under judicial management, whether provisionally or finally.'
  ]);
  ok(f.length === 0, 'CT14 does not read an insolvency-trigger clause ("if ... finally liquidated or placed under judicial management") as entity status');
}
// A genuine status contradiction must still fire: the record ASSERTS both.
{
  const f = DET.D09_DETECT_ENTITY_STATUS_FAKE([
    'Bright Idea Projects 66 (Pty) Ltd is a duly registered company in good standing.',
    'The company was finally liquidated by order of the High Court on 12 March 2019.'
  ]);
  ok(f.length === 1, 'CT14 still fires when the record asserts an entity is both registered and liquidated');
}

// CT38 (D26): naming two jurisdictions is cross-border reality, not an
// impossibility — emitted as an UNSCORED contextOnly note, never a finding.
{
  const f = DET.D26_DETECT_JURISDICTIONAL_ISSUE(['the parties operate in south africa and the uae under one agreement']);
  ok(f.length === 1 && f[0].contextOnly === true && (f[0].severity | 0) === 0,
    'CT38 multi-jurisdiction reference is contextOnly and unscored');
  ok(/expected in a cross-border matter/i.test(f[0].evidence),
    'CT38 note says plainly that cross-border references are expected');
}

// CT39 (D27): silent unless the document itself claims chain-of-custody
// procedures; a compiled bundle of emails/screenshots gets no custody finding.
ok(DET.D27_DETECT_CUSTODY_GAP(['the parcel was received by the clerk and handed to the manager']).length === 0,
  'CT39 stays silent when no custody documentation is claimed (bundle false positive)');
{
  const f = DET.D27_DETECT_CUSTODY_GAP([
    'intro page',
    'the chain of custody register for exhibit A was maintained; the item was received by Sgt Dlamini'
  ]);
  ok(f.length === 1 && /Page 2/.test(f[0].location) && /chain of custody/i.test(f[0].evidence),
    'CT39 fires with a quoted custody claim and its page when steps are missing');
}
ok(DET.D27_DETECT_CUSTODY_GAP([
    'the chain of custody log: received by A, handed to B, transferred to C, logged by D'
  ]).length === 0,
  'CT39 stays silent when custody documentation is claimed AND the steps are present');

// CT05 (D31): the impossible ordering must sit INSIDE ONE SENTENCE and the
// finding must quote it with a page — no more unanchored "possible causal
// impossibility" from three words scattered across 353 pages.
ok(DET.D31_DETECT_CAUSAL_IMPOSSIBILITY([
    'the notice was served before the hearing.',
    'the reply was received by the clerk.',
    'the letter was sent to the respondent.'
  ]).length === 0,
  'CT05 does NOT fire on before/received/sent scattered across separate sentences/pages');
{
  const f = DET.D31_DETECT_CAUSAL_IMPOSSIBILITY([
    'cover page',
    'The reply was received on 3 March, two days before the original letter was sent on 5 March.'
  ]);
  ok(f.length === 1 && /Page 2/.test(f[0].location) && /"/.test(f[0].evidence),
    'CT05 fires on a single-sentence impossibility, quoting the sentence with its page');
}

// Template boilerplate placeholder: the neutral text the engine substitutes
// for analysis-template pages must trigger ZERO findings in any text detector.
{
  const placeholder = new Array(11).join('analysis template boilerplate excluded. ');
  let tf = [];
  for (const [k, fn] of Object.entries(DET)) {
    if (typeof fn !== 'function' || skip.has(k)) continue;
    try { tf = tf.concat(fn([placeholder, placeholder, placeholder]) || []); } catch (e) {}
  }
  ok(tf.length === 0, 'template-page placeholder text triggers zero findings: got ' + tf.map(x => x.type).join(','));
}

// ===== Subject alignment (v5.2.9 lineage): opposing statements must be =====
// ===== about the SAME THING, and requirement clauses are not negations =====
// The Greensky CT01 false positive: "shall not be valid unless it is approved
// by ras al khaimah" paired with "unless it is approved by 75% majority" —
// two requirement clauses from the same MOA, neither affirming nor denying
// that anything WAS approved.
ok(!fires(DET.D01_DETECT_DIRECT_CONTRADICTION, [
    'no amendment shall be made in the company unless it is approved by 75% majority nor shall it be permitted.',
    'a reduction of capital shall not be valid unless it is approved by ras al khaimah economic zone authority.'
  ]),
  'D01 does NOT read two "not valid unless approved by X" requirement clauses as a contradiction');
ok(fires(DET.D01_DETECT_DIRECT_CONTRADICTION, [
    'the resolution was approved by the board on 3 May. the directors later denied that the resolution was approved.'
  ]),
  'D01 still fires when an actual approval is both affirmed and denied');
// Fixed-pair path: different subjects are two facts, not one contradiction.
ok(!fires(DET.D01_DETECT_DIRECT_CONTRADICTION, [
    'the invoice was paid on monday and the deposit was not paid'
  ]),
  'D01 fixed pairs do NOT pair different subjects (invoice paid / deposit unpaid)');
ok(fires(DET.D01_DETECT_DIRECT_CONTRADICTION, [
    'the invoice was paid on monday yet the invoice was not paid according to the ledger'
  ]),
  'D01 fixed pairs still fire on the SAME subject affirmed and negated');

// ===== D02 subject alignment: differently-qualified labels never compare =====
ok(!fires(DET.D02_DETECT_NUMERICAL_DISCREPANCY, [
    'Invoice INV-001 Total: R450,000 for the first shipment. Invoice INV-002 Total: R470,000 for the second.'
  ]),
  'D02 does NOT compare totals of two different invoices (INV-001 vs INV-002)');
ok(fires(DET.D02_DETECT_NUMERICAL_DISCREPANCY, [
    'Invoice INV-001 Total: R450,000 as issued. Invoice INV-001 Total: R470,000 as re-issued.'
  ]),
  'D02 still flags the SAME invoice restated at two values');

// ===== Template-page exclusion helper (voExcludeTemplatePages) =====
const XT = require('../forensic-engine-page.js').voExcludeTemplatePages;
{
  const blocks = [
    'real evidence page one with an email',
    'DEEPSEEK VERUM OMNIS: INSTITUTIONAL REVIEW TEMPLATE Gold Standard for Forensic Chat Log Analysis — cropped WhatsApp logs, forged messages, jurisdictional compliance UAE/SA/EU',
    'real evidence page three'
  ];
  const note = XT(blocks);
  ok(note !== null && /Template boilerplate: 1 page/.test(note) && /\(2\)/.test(note),
    'template masthead page is excluded and disclosed with its page number');
  ok(!/cropped|forged|uae/i.test(blocks[1]), 'template page text is replaced by the neutral placeholder');
  ok(blocks[0].indexOf('email') !== -1 && blocks[2].indexOf('three') !== -1, 'evidence pages are untouched');
  ok(XT(['normal page', 'another normal page']) === null, 'no note when no template pages exist');
  ok(XT(['INSTITUTIONAL REVIEW TEMPLATE alone']) === null, 'single-block fallback documents are never template-filtered');
}

// ===== The anchor rule in full (voEnforceAnchorRule) =====
// v5.3.2-web only demoted unanchorable findings; the Greensky rerun still
// sealed a report with source_page 0 findings ("by proxy" at MODERATE via the
// old "Signature block" exemption, the currency note at LOW). Constitution
// v6.0: "If a sentence cannot cite anchors, it cannot exist" — so an
// unanchorable CONTENT finding now leaves the findings entirely and is
// disclosed in the engine notes instead.
const AR = require('../forensic-engine-page.js').voEnforceAnchorRule;
{
  const fs2 = [
    { type: 'CT28', severity: 3, evidence: 'Possible image manipulation: "cropped" referenced next to an image', location: '' },
    { type: 'CT03', severity: 5, evidence: 'date conflict', location: 'Page 16' },
    { type: 'CT24', severity: 4, evidence: 'image tool', location: 'PDF metadata' },
    { type: 'CT23', severity: 3, evidence: 'Non-standard signature method: "by proxy"', location: 'Signature block' },
    { type: 'CT16', severity: 2, evidence: 'Multiple currencies without conversion: $, R', location: 'Full document' },
    { type: 'SERIAL', severity: 5, evidence: 'pattern', location: 'Pages 12-18' },
    { type: 'CT26', severity: 1, evidence: 'blank run', location: 'Pages 18-353' }
  ];
  const r = AR(fs2);
  ok(r.kept.length === 4 && r.unanchored.length === 3,
    'unanchorable content findings leave the findings list (got kept=' + r.kept.length + ' unanchored=' + r.unanchored.length + ')');
  ok(r.unanchored.every(f => f.unanchored === true) &&
     r.unanchored.some(f => f.type === 'CT23') && r.unanchored.some(f => f.type === 'CT16') && r.unanchored.some(f => f.type === 'CT28'),
    '"Signature block" and "Full document" are pseudo-locations, not anchors — those findings move to notes');
  ok(r.kept.some(f => f.type === 'CT03') && r.kept.some(f => f.type === 'CT24') &&
     r.kept.some(f => f.type === 'SERIAL') && r.kept.some(f => f.type === 'CT26'),
    'page-anchored, metadata and page-span findings stay');
}

// ===== Content mass: seal-footer layers must not disguise image pages =====
// The 8x-sealed Greensky bundle carried ~1,000 chars of stacked seal footers
// on every page, so image-only pages sailed past raw-length thresholds: OCR
// never triggered and the "unread pages" disclosure vanished silently.
const MASS = require('../forensic-engine-page.js').voContentMass;
{
  const footer = 'VERUM OMNIS SEALED ORIGINAL | VO-E88F2FD522BF | e88f2fd522bf7fcb1234567890abcdef | 2026-08-01 09:27:28 UTC | verumglobal.foundation | OpenTimestamps | Patent Pending | 12/451 PRIVATE SEAL -- FREE TIER Liam Highcock | liamhigh78@gmail.com | +27 82 445 4787 | Founder, Verum Omnis ';
  const eightSealedImagePage = footer.repeat(8);
  ok(MASS(eightSealedImagePage) < 40,
    '8 stacked seal-footer layers collapse to near-zero content mass (got ' + MASS(eightSealedImagePage) + ')');
  const prose = 'The parties concluded the agreement on the fifth day and the shipment was delivered to the harbour, where the consignee inspected every container before payment was released under protest.';
  ok(MASS(prose) > 120, 'real prose keeps its content mass (got ' + MASS(prose) + ')');
  // D17 must now flag the sealed image pages as near-empty among sealed text pages.
  const sealedText = prose + ' Further correspondence between the shareholders addressed outstanding invoices, registry filings, board minutes, director resolutions, audit queries, banking mandates, customs declarations, freight manifests and the disputed termination schedule across numerous consecutive paragraphs, together with annexed exhibits, sworn statements, courier receipts, valuation certificates and reconciliations prepared by independent accountants. ' + footer;
  const f = DET.D17_DETECT_FORMAT_ANOMALY([sealedText, sealedText, sealedText, eightSealedImagePage, eightSealedImagePage, eightSealedImagePage, eightSealedImagePage, sealedText, sealedText]);
  ok(f.length === 1 && /image-only|OCR/i.test(f[0].evidence),
    'D17 detects a run of 8x-sealed image-only pages as an OCR gap (got ' + f.length + ')');
}

console.log(`\n[detector-recall] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[detector-recall] FAILURES'); process.exit(1); }
console.log('[detector-recall] ALL GREEN');
