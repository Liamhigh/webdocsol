/**
 * Regression tests from the AllFuels sealed run of 14 Aug 2026
 * (MAIN EVIDENCE BUNDLE, 339 pages). An external review of that report
 * identified two load-bearing facts the engine read past, and party-index
 * garbage. Each block reproduces the gap and asserts the fix:
 *
 *  1. The record SAID an instrument was uncountersigned ("HIGHCOCK GOODWILL
 *     FORFEITURE ... The Uncountersigned MOU ...") and the engine did not
 *     surface it — yet money was demanded under that instrument. D32 now
 *     fires on the document's own missing-signature statements (never on an
 *     inferred blank line).
 *  2. Rent was invoiced 1 March 2026 under a lease the record says expired
 *     31 July 2024. The engine reported the amounts (CT02) but missed the
 *     sequence. D04 now compares stated expiry/termination dates against
 *     later-dated invoices, both quoted and anchored.
 *  3. "Cnr R…" (address furniture), "Port Edward" (a town) and "Desmond
 *     Smith's Dispossession" (heading language) were bound as parties.
 */
'use strict';
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  allfuels-regression.test.js');
console.log('======================================================\n');

const E = require('../forensic-engine-page.js');

// ---- 1. countersignature-absence statements ----
{
  const f = E.DETECTORS.D32_DETECT_SIGNATURE_ANOMALY([
    'The MOU was signed by Gary Highcock on 11 December 2018 but remains uncountersigned by All Fuels, which nonetheless demanded payment under it.'
  ]);
  ok(f.some(x => x.type === 'CT23' && x.severity === 4 && /uncountersigned/i.test(x.evidence)),
    'D32 fires on a stated missing countersignature (severity 4)');
  ok(f.filter(x => x.severity === 4).length === 1, 'one page, one missing-signature finding');

  const clean = E.DETECTORS.D32_DETECT_SIGNATURE_ANOMALY([
    'The agreement was duly signed by both parties and witnessed at Durban.'
  ]);
  ok(clean.length === 0, 'no false-positive on a fully executed agreement');

  // A discussion of signing procedure without an absence statement stays silent.
  const proc = E.DETECTORS.D32_DETECT_SIGNATURE_ANOMALY([
    'Each party shall sign two counterparts and exchange them by courier.'
  ]);
  ok(proc.length === 0, 'no false-positive on ordinary execution-procedure language');

  // Codex P1 (#133): an unsigned DRAFT with no enforcement context must not
  // be a severity-4 "relied on" finding — the evidence text asserts only what
  // the record states, and without nearby enforcement/billing language the
  // severity stays low.
  const draft = E.DETECTORS.D32_DETECT_SIGNATURE_ANOMALY([
    'This unsigned agreement is a draft for discussion only and shall not be construed as binding.'
  ]);
  const dHit = draft.find(x => /signature is missing/.test(x.evidence));
  ok(!!dHit && dHit.severity === 2, 'unsigned draft without enforcement context is severity 2 (got ' + (dHit && dHit.severity) + ')');
  ok(!draft.some(x => /relied/i.test(x.evidence)), 'evidence text never asserts reliance as a fact');
}

// ---- 2. billing after the stated expiry ----
{
  const pages = [];
  pages[0] = 'The lease expires on 31 July 2024 and the franchisee shall vacate.';
  for (let i = 1; i < 20; i++) pages[i] = 'ordinary body text page ' + i;
  pages[20] = 'TAX INVOICE date: 1 March 2026 — rental for the premises R173,396.20 due on presentation.';
  const f = E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(pages);
  const hit = f.find(x => /Billing after the stated expiry/.test(x.evidence));
  ok(!!hit, 'D04 flags an invoice dated after the stated lease expiry');
  ok(hit && hit.severity === 4, 'post-expiry billing is severity 4 (got ' + (hit && hit.severity) + ')');
  ok(hit && /31 July 2024/.test(hit.evidence) && /1 March 2026/.test(hit.evidence),
    'both the expiry and the offending invoice date are quoted');
  ok(hit && /p\.21/.test(hit.evidence.replace(/\s/g, '')) || (hit && /21/.test(hit.location)),
    'invoice page is anchored');

  // Renewed lease whose expiry postdates all invoices -> silent.
  const renewed = [
    'The lease expires on 31 July 2024.',
    'The renewed agreement: lease expires on 31 December 2027.',
    'TAX INVOICE date: 1 March 2026 — monthly rental.'
  ];
  ok(!E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(renewed).some(x => /Billing after/.test(x.evidence)),
    'no finding when a later stated expiry covers the invoice dates');

  // Invoice before expiry -> silent.
  const normal = [
    'The lease expires on 31 July 2024.',
    'TAX INVOICE date: 1 March 2023 — monthly rental.'
  ];
  ok(!E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(normal).some(x => /Billing after/.test(x.evidence)),
    'no finding for ordinary in-term invoicing');

  // Codex P1 (#133): an expiry label with NO date of its own must not borrow
  // the next field's date. "Lease expiry date: see schedule. Invoice date:
  // 31 July 2024" would otherwise manufacture an expiry the record never
  // states, and a later invoice would become a false post-expiry finding.
  const borrowed = [
    'Lease expiry date: see schedule attached. Invoice date: 31 July 2024 for monthly rental.',
    'TAX INVOICE date: 1 March 2026 — rental due.'
  ];
  ok(!E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(borrowed).some(x => /Billing after/.test(x.evidence)),
    'an undated expiry label cannot borrow the next label\'s date (no manufactured expiry)');
}

// ---- 3. party-index garbage from this run ----
{
  // 'Particular Terms' — a contract heading listed as a party on the 4-doc
  // bundle report's front page (22 Aug 2026).
  const no = ['Port Edward', 'Cnr R', 'Desmond Smith’s Dispossession', 'Particular Terms'];
  for (const n of no) ok(!E.voLooksLikePerson(n), 'voLooksLikePerson rejects "' + n + '"');
  const yes = ['Gary Highcock', 'Bright Idea Projects', 'Palmbili Properties'];
  for (const n of yes) ok(E.voLooksLikePerson(n), 'voLooksLikePerson accepts "' + n + '"');
}

// ---- 4. rerun round 2 (39-finding report): flooding and blind spots ----
{
  // 4a. One aggregated missing-signature finding, not one per page. The
  // resealed bundle's own commentary repeats "uncountersigned" across many
  // pages; 25 scattered CT23 rows buried the fact.
  const pages = [];
  for (let i = 0; i < 12; i++) {
    pages[i] = (i % 2 === 0)
      ? 'The uncountersigned MOU under which payment was demanded remains in dispute.'
      : 'Ordinary narrative page ' + i + '.';
  }
  const sig = E.DETECTORS.D32_DETECT_SIGNATURE_ANOMALY(pages);
  const missing = sig.filter(x => /signature is missing/.test(x.evidence));
  ok(missing.length === 1, 'repeated unsigned statements collapse to ONE finding (got ' + missing.length + ')');
  ok(missing.length && missing[0].severity === 4, 'aggregated finding keeps enforcement severity 4');
  ok(missing.length && /6 pages/.test(missing[0].evidence), 'aggregated finding counts every stating page (' + (missing[0] && missing[0].evidence.match(/\d+ pages/)) + ')');

  // 4b. Numeric invoice date fires when BOTH readings are past expiry
  // (01/03/2026 is after 31 July 2024 whichever way it is read).
  const num = [];
  num[0] = 'The lease expires on 31 July 2024.';
  num[10] = 'TAX INVOICE date: 01/03/2026 Rental March 2026 R173,396.20 due.';
  for (let i = 1; i < 10; i++) num[i] = 'body';
  const late = E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(num);
  ok(late.some(x => /Billing after the stated expiry/.test(x.evidence) && /01\/03\/2026/.test(x.evidence)),
    'numeric invoice date past expiry under both readings fires');

  // ...but an ambiguous numeric date that is only late under ONE reading
  // stays silent (05/08/2024 could be 5 Aug or 8 May against a 31 July 2024
  // expiry).
  const amb = [
    'The lease expires on 31 July 2024.',
    'TAX INVOICE date: 05/08/2024 monthly rental.'
  ];
  ok(!E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(amb).some(x => /Billing after/.test(x.evidence)),
    'ambiguous numeric date late under only one reading stays silent');

  // 4c. "Goodwill: N/A" beside a quantifiable-asset definition is CT45.
  const gw = E.DETECTORS.D39_DETECT_ASSET_VALUE_DENIAL([
    'Schedule Part 1 — 12. Goodwill: N/A as recorded.',
    'Goodwill means the established reputation of a business regarded as a quantifiable asset.'
  ]);
  ok(gw.some(x => x.type === 'CT45'), '"Goodwill: N/A" vs quantifiable-asset definition fires CT45');

  // 4d. Magnitude words survive amount parsing: "Total R1.2 million" vs
  // "Total R900,000.00" is a genuine restatement comparison; and the D02
  // value for R231.3 million is 231,300,000 — not 231 or 2313.
  const mag = E.DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY([
    'Grand total R1.2 million for the works.',
    'Grand total R900,000.00 as invoiced.'
  ]);
  ok(mag.some(x => x.type === 'CT02' && /1\.2 million/i.test(x.evidence)),
    'magnitude amounts compare against plain amounts (' + mag.length + ' findings)');

  // 4e. CT08 term-definition conflicts are Low severity now.
  const term = E.DETECTORS.D30_DETECT_TERM_DEFINITION_CONFLICT([
    '1.1 "Rental" means the monthly rental payable to the Lessor under this agreement for the premises.',
    '9.4 "Rental" means the amount, if any, payable by the Franchisee to the Franchisor from time to time.'
  ]);
  const t8 = term.find(x => x.type === 'CT08');
  ok(!t8 || t8.severity === 2, 'CT08 term-definition conflicts report at severity 2 (got ' + (t8 && t8.severity) + ')');
}

// ---- 5. rerun round 3 (16-finding report) + Greensky master review ----
{
  // 5a. Real invoice layout: "TAX INVOICE" heading with "Date:" lower down.
  const inv = [];
  inv[0] = 'The lease expires on 31 July 2024 and the franchisee shall vacate.';
  inv[20] = 'TAX INVOICE\nAll Fuels (Pty) Ltd\nVAT No 4123456789\nDate: 01/03/2026\nRental March 2026 R173,396.20';
  for (let i = 1; i < 20; i++) inv[i] = 'body page';
  const hit = E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(inv).find(x => /Billing after the stated expiry/.test(x.evidence));
  ok(!!hit, 'invoice heading + separated Date: line is bridged and fires');

  // ...but a "tax invoice" mention in prose with an unrelated later date label
  // must not bridge (no explicit Date: within reach).
  const prose = [
    'The lease expires on 31 July 2024.',
    'The tax invoice was disputed at the hearing. Judgment was reserved for a later date to be arranged in 2026.'
  ];
  ok(!E.DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(prose).some(x => /Billing after/.test(x.evidence)),
    'prose mention of a tax invoice without a Date: label does not bridge');

  // 5b. "Goodwill: N/A" pair fires EVEN WHEN another recognition/denial pair
  // exists earlier in the bundle (the 16-finding run reported only p.2/3).
  const gw2 = E.DETECTORS.D39_DETECT_ASSET_VALUE_DENIAL([
    'GOODWILL FORFEITURE CONTRADICTION: goodwill forfeiture is recognised here yet held to possess no compensable goodwill value.',
    'Schedule Part 1 — 12. Goodwill: N/A.',
    'Goodwill means the established reputation of a business regarded as a quantifiable asset.'
  ]);
  ok(gw2.filter(x => x.type === 'CT45').length >= 2,
    'both the commentary pair and the schedule N/A pair are reported (' + gw2.length + ')');

  // 5c. Explicit admission language fires, aggregated and quoted.
  const adm = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION([
    'In his reply Marius wrote: I admit that the consignment was routed through Kevin\'s Export while the agreement was in force.',
    'plain page',
    'Later he repeated: I admit the routing occurred.'
  ]);
  const admHit = adm.find(x => /explicit admission/.test(x.evidence));
  ok(!!admHit, 'explicit first-person admission language fires');
  ok(admHit && admHit.severity === 4 && /I admit that the consignment/.test(admHit.evidence),
    'admission is quoted verbatim at severity 4');
  ok(admHit && /2 pages/.test(admHit.evidence), 'admission pages aggregate into one finding');
  ok(!E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION([
    'The tenant admits no liability and denies each allegation.'
  ]).some(x => /explicit admission/.test(x.evidence)),
    'no false-positive on "admits no liability" boilerplate');
}

// ---- 5b. voDetectSwornPages — oath context is measured, never inferred ----
// A contradiction anchored inside an affidavit is a materially different fact
// from one in correspondence. The engine records only the measurement (oath
// language on the page); classifying a statement as sworn testimony, or naming
// the offence a false one would constitute, stays with the court. Strings are
// drawn from the real declarations in this matter (sworn 6 Aug 2026 before a
// Commissioner of Oaths, SAPS Margate).
{
  const sworn = E.voDetectSwornPages([
    'I, the undersigned, LIAM ANTHONY HIGHCOCK, do hereby make oath and say that the facts herein are true and correct.',
    'The fee payable to All Fuels by the Operator in respect of the site shall be the sum of Three Million Eight Hundred Thousand Rand.',
    'SIGNED and SWORN to before me at MARGATE on this 6th day of August 2026, COMMISSIONER OF OATHS, South African Police Service.',
    'The deponent states under oath that the invoice was issued on 8 March.',
    'Please see the affidavit of Clayton Bester for the history of the Hammarsdale site.',
    'SKM_C550i26071813441 — Supplementary Affidavit, CCT, 9pp'
  ]);
  ok(sworn.includes(1), 'a first-person oath formula ("make oath and say") tags the page');
  ok(sworn.includes(3), 'a commissioner-of-oaths execution block tags the page');
  ok(sworn.includes(4), 'two distinct weak markers (deponent + under oath) tag the page');
  ok(!sworn.includes(2), 'contract prose is never tagged');
  ok(!sworn.includes(5), 'a page merely REFERRING to an affidavit is not tagged (one weak marker)');
  ok(!sworn.includes(6), 'an index line naming an affidavit is not tagged');
  ok(E.voDetectSwornPages([]).length === 0 && E.voDetectSwornPages(null).length === 0,
    'empty and null inputs return no pages');
}

// ---- 5c. Oath context stays factual in both source files ----
// The word "perjury" may appear ONLY as candidate law in the report (PD16's
// sanctioned exception) and never in engine output at all.
{
  const fs2 = require('fs'), path2 = require('path');
  const engSrc = fs2.readFileSync(path2.join(__dirname, '..', 'forensic-engine-page.js'), 'utf8');
  const repSrc = fs2.readFileSync(path2.join(__dirname, '..', 'forensic-report.js'), 'utf8');
  const engEvidence = engSrc.split('\n').filter(l => /evidence:\s*'/.test(l) && !/^\s*\/\//.test(l));
  ok(!engEvidence.some(l => /perjur/i.test(l)), 'no engine evidence string contains "perjury"');
  ok(/swornContext/.test(engSrc) && /voDetectSwornPages/.test(engSrc),
    'the engine tags findings with swornContext from measured oath pages');
  ok(/Oath context: oath language/.test(repSrc),
    'the report states the oath-language fact, not a testimony classification');
  ok(/Oath context: oath language[^']*reserved to the court/.test(repSrc),
    'the oath-context line reserves the characterisation to the court');
  const perjuryLines = repSrc.split('\n').filter(l => /perjur/i.test(l) && !/^\s*\/\//.test(l.trim()));
  ok(perjuryLines.length > 0 && perjuryLines.every(l =>
      /sworn-statement context|Common-law perjury|perjury \/ false testimony/.test(l)),
    '"perjury" appears in the report only as candidate law (statute tables and the sworn-context bullet)');
}

// ---- 6. Constitution v8.0 §15.2 language lock (evidence strings) ----
// Prohibited hedging ("may," "possibly," "appears to," "consistent with")
// must not ship inside any evidence template the engine renders as a
// finding. Source-level grep so a hedge cannot quietly return.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-engine-page.js'), 'utf8');
  const evidenceLines = src.split('\n').filter(l => /evidence:\s*'/.test(l) && !/^\s*\/\//.test(l));
  const banned = /(evidence:\s*'[^']*\b(?:Possible|possibly|appears to|consistent with editing|may have been|may be recoverable|may have expanded)\b)/;
  const bad = evidenceLines.filter(l => banned.test(l));
  ok(bad.length === 0, 'no prohibited hedging in shipped evidence strings (' + bad.length + ' found)');
  ok(!/may be void/.test(src), 'CT44 definition reserves voidness for the court');
}

// ---- 7. D37 clause-numbering discontinuity (template surgery fingerprint) ----
// Two AllFuels MOUs of the same year and template lineage: the Thongasi MOU
// (Wayne Nell) carries a heading "9. VARIATIONS" whose sub-clauses are
// numbered 10.1 / 10.2 — numbering from an instrument in which VARIATIONS was
// clause 10. The Port Edward MOU (Gary Highcock) numbers the same clause
// 9 / 9.1 correctly, which is what rules out a house drafting habit. Strings
// below are the real extracted text from both documents.
{
  const D37 = E.DETECTORS.D37_DETECT_INTERNAL_CONFLICT_CATCHALL;

  const thongasi = D37([
    'Agreementbetweentheparties asatthedate hereof.\n9.\nVARIATIONS\n10.1 ThisMemorandumofUnderstanding shallnotbealtered,amendedvaried or\nsubstituted unless such alterations.\n10.2 Thedocumentshallbethe sole recordofthe consensusoftheParties.'
  ], []);
  ok(thongasi.some(x => x.type === 'CT43' && /numbered 9/.test(x.evidence) && /10\.1/.test(x.evidence)),
    'D37 reports a heading numbered 9 whose first sub-clause is numbered 10.1');
  ok(thongasi.length === 1, 'one numbering note per page, not one per sub-clause');
  ok(!/cut from|lifted|deliberate|intent|tamper/i.test(thongasi[0].evidence),
    'the numbering finding states the fact and never reaches for intent (s15.2)');
  ok(/Page 1/.test(thongasi[0].location), 'the numbering finding is page-anchored');

  const portEdward = D37([
    '9.\nVARIATIONS\n.9.1This Memorandum of Understanding shall not be altered, amended varied or substituted unless such alterations are reduced to writing and signed by the Parties hereto.'
  ], []);
  ok(portEdward.length === 0, 'correctly numbered 9 / 9.1 stays silent');

  // False positives that would each put a fabricated tampering signal in a
  // sealed report. Every one of these must stay silent.
  ok(D37(['9.\nVARIATIONS\nThe parties agree.\n10.\nNOTICES\n10.1 Notices shall be in writing.'], []).length === 0,
    'an intervening numbered heading is ordinary drafting, not a discontinuity');
  ok(D37(['9.\nVARIATIONS\n9.1 Subject to clause 10.1 hereof, no variation applies.'], []).length === 0,
    'a cross-reference to another clause is not a numbering break');
  ok(D37(['3.\nFEES\n91.2 The fee is payable.'], []).length === 0,
    'an OCR digit swap (91.2) is outside the 1-3 jump bound');
  ok(D37(['The fee payable to All Fuels shall be R3 800 000.00 and excludes VAT.'], []).length === 0,
    'plain prose with money in it raises nothing');
  ok(D37(['9.\nVARIATIONS\n8.1 An earlier clause number.'], []).length === 0,
    'a backwards jump is not reported (only forward gaps of 1-3)');
}

console.log('\n[allfuels-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[allfuels-regression] ALL GREEN');
