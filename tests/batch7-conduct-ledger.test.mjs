// Batch 7a — the conduct detectors (engine instrument v6.1 §1, §6):
//  - voExtractConductLedger: the record's dated conduct (invoices, receipts,
//    payments, statements) read out as a sealed ledger. An unsealed ledger
//    cannot found a finding: it travels inside the findings JSON, SHA-512'd
//    as findingsJsonSha512.
//  - D61 / CT59: a pleaded denial of performance against a SUSTAINED ledger
//    (>= 6 dated events, or a span of >= 24 months; CRITICAL when both).
//  - D62 / CT60: a benefit taken under an instrument while the burden of the
//    same instrument is denied (approbate and reprobate — candidate law only).
//  - D63 / CT61: horns-of-dilemma; v6.1 §1 merges CT56 into CT61, so D10A
//    stays exported but no longer runs in the pipeline.
//
// Run: node tests/batch7-conduct-ledger.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const fs = require('node:fs');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

// ---- registration & taxonomy ----
const D61 = E.DETECTORS.D61_DETECT_CONDUCT_VS_PLEADING;
const D62 = E.DETECTORS.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY;
const D63 = E.DETECTORS.D63_DETECT_HORNS_OF_DILEMMA;
t.ok([D61, D62, D63, E.DETECTORS.D10A_DETECT_S12B_LICENCE_PREDICATE_CONFLICT].every(f => typeof f === 'function'),
  'batch-7 detectors registered; D10A retained (exported, directly testable)');
t.ok(typeof E.voExtractConductLedger === 'function' && typeof E.voParseAmountSa === 'function',
  'the conduct-ledger extractor is exported');
t.ok(Object.values(E.CONTRADICTION_TYPES).length === 61, 'the sealed taxonomy now carries 61 types');
t.ok(E.CONTRADICTION_TYPES.CT59_CONDUCT_VS_PLEADING.id === 'CT59' &&
   E.CONTRADICTION_TYPES.CT60_BENEFIT_BURDEN_ASYMMETRY.id === 'CT60' &&
   E.CONTRADICTION_TYPES.CT61_HORNS_OF_DILEMMA.id === 'CT61' &&
   E.CONTRADICTION_TYPES.CT56_S12B_LICENCE_PREDICATE_CONFLICT.id === 'CT56',
  'CT59/60/61 registered; CT56 retained in the taxonomy (old sealed runs cite it)');
t.ok(E.VO_FINDING_CLASS.CT59 === 'CONTRADICTION' && E.VO_FINDING_CLASS.CT60 === 'TENSION' && E.VO_FINDING_CLASS.CT61 === 'TENSION',
  'classes: CT59 a contradiction; CT60/CT61 indicators (TENSION)');

// ---- dispatch: D10A out of the run list, D61/62/63 in, 61 detectors run ----
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'forensic-engine-page.js'), 'utf8');
  const listStart = src.indexOf('var detectors = [');
  const listEnd = src.indexOf('];', listStart);
  const list = src.slice(listStart, listEnd);
  t.ok(!/D10A_DETECT_S12B/.test(list), 'D10A no longer runs in the pipeline (CT56 merges into CT61 — never both)');
  t.ok(/D61_DETECT_CONDUCT_VS_PLEADING/.test(list) && /D62_DETECT_BENEFIT_BURDEN_ASYMMETRY/.test(list) && /D63_DETECT_HORNS_OF_DILEMMA/.test(list),
    'D61/D62/D63 are in the dispatch run list');
  t.ok((list.match(/DETECTORS\.D/g) || []).length === 61, 'the dispatch list runs 61 detectors');
  // The ledger is extracted once, handed to D61, and carried on the result —
  // sealed via buildFindingsJson (functional pin below).
  t.ok(/var _conductLedger = voExtractConductLedger\(textBlocks\)/.test(src),
    'the conduct ledger is extracted once over the final page texts');
  t.ok(/detectors\[d\]\(textBlocks, _conductLedger\)/.test(src),
    'D61 is dispatched with the sealed ledger, never a re-read of the pages');
  t.ok(/conductLedger: _conductLedger/.test(src), 'the engine result carries the conduct ledger');
}

// ---- the ledger: dated conduct events, deduped, sealed ----
const LEDGER_PAGES = [
  'TAX INVOICE date: 1 March 2026 — rental for the premises R173,396.20 payable by the occupant.',
  'Invoice no: INV98185 dated 05/08/2024 monthly rental R199,405.63 for the service station premises.',
  '1 March 2023 — monthly rental received for the premises, R150,000.00.',
  'Invoice date: 31 July 2024 for monthly rental of the premises R199,405.63.',
  'Receipt no 4412 dated 30 April 2025: rental payment received R199,405.63.',
  '15/06/2025 payment received for rental of premises R199,405.63 thank you.',
  'Bank statement entry 31 January 2026: rental payment R199,405.63.',
  'Remittance 28 February 2026 rental for the premises R199,405.63.',
  'A page with no conduct: the parties discussed clause 1.1.10 of the agreement.',
  'Meeting held on 3 October 2026 to discuss the dispute generally.'
];
const L = E.voExtractConductLedger(LEDGER_PAGES);
t.ok(L.summary.event_count === 8, 'ledger reads the eight dated conduct events (got ' + L.summary.event_count + ')');
t.ok(L.summary.span_months === 37 && L.summary.first_date === '2023-03-01' && L.summary.last_date === '2026-03-01',
  'span March 2023 to March 2026 = 37 months, first/last dates exposed');
t.ok(L.summary.total_value === 1519829.98, 'total_value sums the ZA amounts (173,396.20 + 6 x 199,405.63 + 150,000.00)');
t.ok(L.events.every(e => e.source_page >= 1 && e.date && e.date_text && e.snippet),
  'every event carries its page, date and the page text it was read from');
t.ok(L.events.some(e => e.reference === 'INV98185' && e.source_page === 2), 'the invoice number is read when the record labels it');
t.ok(L.events.every(e => e.payer === null && e.payee === null),
  'payer/payee are never guessed from a snippet — null until the document states them');
{
  // The same event on two pages (invoice + covering letter) is one event.
  const d = E.voExtractConductLedger([
    'TAX INVOICE date: 1 March 2026 — rental for the premises R173,396.20.',
    'Covering letter: we enclose the invoice dated 1 March 2026 for rental of the premises, R173,396.20.'
  ]);
  t.ok(d.summary.event_count === 1 && d.events[0].also_on_pages.length === 1 && d.events[0].also_on_pages[0] === 2,
    'one real-world event cited on two pages merges, keeping both pages');
}
{
  // A bare "R120" is an Act number, not money; a clause triple is not a date;
  // a bare date with no conduct word is not an event.
  const n = E.voExtractConductLedger([
    'Section 120 of the Act applies. Clause 1.1.10 provides otherwise. The parties met on 3 October 2026.'
  ]);
  t.ok(n.summary.event_count === 0, 'no ledger events from an Act number, a clause number, or a bare date');
}
{
  // ZA amount forms are one number.
  const ok = E.voParseAmountSa('R173,396.20') === 173396.20 &&
    E.voParseAmountSa('R 173 396,20') === 173396.20 &&
    E.voParseAmountSa('R1,234,567') === 1234567 &&
    E.voParseAmountSa('R12 500.00') === 12500 &&
    E.voParseAmountSa('R396,20') === 396.20;
  t.ok(ok, 'voParseAmountSa reads both separator conventions');
}

// ---- D61 / CT59: conduct vs pleading ----
{
  const blocks = ['The respondent pleads that no rental was ever paid for the premises.'].concat(LEDGER_PAGES.slice(0, 8));
  const out = D61(blocks);
  t.ok(out.length === 1 && out[0].type === 'CT59', 'D61 fires once on the denial against the sustained ledger');
  t.ok(out[0].severity === 5 && out[0].conduct_vs_pleading.confidence === 'HIGH',
    'both thresholds met (8 events, 37 months): CRITICAL severity 5, confidence HIGH');
  const cvp = out[0].conduct_vs_pleading;
  t.ok(cvp.proposition_page === 1 && cvp.conduct_type === 'rental' && cvp.event_count === 8 && cvp.span_months === 37 &&
    Array.isArray(cvp.conduct_pages) && cvp.conduct_pages.length === 8 && cvp.asserting_party === 'respondent',
    'conduct_vs_pleading carries asserting_party, proposition(+page), conduct_type, conduct_pages, span_months, event_count, confidence');
  t.ok(/^Page 1 vs Pages /.test(out[0].location) && out[0].evidence.indexOf('cannot both stand') !== -1,
    'the finding anchors the pleading page against the ledger pages');
  // ascending page order for the bundle reader
  const sorted = cvp.conduct_pages.slice().sort((a, b) => a - b);
  t.ok(JSON.stringify(cvp.conduct_pages) === JSON.stringify(sorted), 'conduct_pages print in page order');
}
{
  // One threshold only: a long span with few events fires HIGH (severity 4).
  const blocks = [
    'No payment was ever made under the agreement.',
    '1 March 2023 — payment received under the agreement, R50,000.00.',
    '28 February 2026 payment received under the agreement R50,000.00.'
  ];
  const out = D61(blocks);
  t.ok(out.length === 1 && out[0].severity === 4 && out[0].conduct_vs_pleading.confidence === 'MODERATE' && out[0].conduct_vs_pleading.span_months >= 24,
    'the 24-month span alone fires (severity 4 / MODERATE)');
}
{
  // Silence: no denial; denial with a thin ledger; denial on the same page as
  // the only conduct (a page is not cross-reference against itself).
  t.ok(D61(LEDGER_PAGES).length === 0, 'silent when the record pleads no denial');
  const thin = ['No rental was ever paid.', 'Invoice 1 March 2026 rental R173,396.20.', 'Receipt 30 April 2025 rental R199,405.63.'];
  t.ok(D61(thin).length === 0, 'silent on a thin ledger (2 events, 11 months)');
}

// ---- D62 / CT60: benefit taken, burden denied ----
{
  const blocks = [
    'The respondent has occupied the premises since March 2023 and trades from the premises under the lease to this day.',
    'Correspondence about neutral matters fills this page.',
    'The respondent denies any obligation to pay rental under the lease and avers it is not bound by the agreement.'
  ];
  const out = D62(blocks);
  t.ok(out.length === 1 && out[0].type === 'CT60' && out[0].severity === 3, 'D62 fires once on the lease asymmetry');
  const bb = out[0].benefit_burden;
  t.ok(bb && bb.indicator === true && bb.instrument_reference === 'lease' &&
    bb.benefit_pages[0] === 1 && bb.burden_denial_pages[0] === 3 && bb.party === 'respondent',
    'benefit_burden carries party, benefit_pages, burden_denial_pages, instrument_reference, indicator:true');
  t.ok(/approbate/i.test(out[0].evidence) && /candidate law only/i.test(out[0].evidence),
    'the doctrine is named as candidate law only');
  t.ok(D62(blocks.slice(0, 2)).length === 0 && D62([blocks[2]]).length === 0,
    'silent with only a benefit or only a denial');
  t.ok(D62(['The respondent retained the deposit paid under the lease.',
            'The respondent denies any liability under the liquor licence conditions.']).length === 0,
    'silent across different instruments (lease benefit vs licence denial)');
  t.ok(D62(['The respondent occupied the premises but denies the rental obligation under the lease.']).length === 0,
    'silent when benefit and denial are one sentence — one position, not an asymmetry');
}

// ---- D63 / CT61: horns of dilemma (subsumes CT56) ----
{
  // The live-run record (F&R letter to G.L. Seethal Attorneys, 29 Sep 2026):
  // three arbitrators nominated "strictly in compliance with the process
  // contemplated in section 12B of the Act"; the licence "terminated and / or
  // expired and / or is otherwise no longer valid or operative".
  const s12bStaffing = [
    'We refer to the Notice issued by the Controller of Petroleum Products pursuant to section 12B of the Petroleum Products Act 120 of 1977. ' +
      'We are instructed to nominate the following Advocates of the KwaZulu-Natal Bar, in no particular order, for consideration by the parties: ' +
      'Advocate Zuanite Ploos van Amstel; Advocate Keshini Govender; and Advocate Mark Tucker. The nomination is made strictly in compliance ' +
      'with the process contemplated in section 12B of the Act and without prejudice to all of our client\'s rights.',
    'Our client has been informed by the Department of Mineral and Petroleum Resources that your client\'s retail licence in respect of ' +
      'trading at the subject premises has terminated and / or expired and / or is otherwise no longer valid or operative. Your client is ' +
      'hereby called upon to immediately cease all retailing of prescribed petroleum products.'
  ];
  const out = D63(s12bStaffing);
  t.ok(out.length === 1 && out[0].type === 'CT61' && out[0].severity === 3,
    'D63 fires once as CT61 on the s 12B staffing plus licence-death assertion');
  const h = out[0].horns;
  t.ok(h && /12B/.test(h.statute) && h.branch_a_pages[0] === 1 && h.branch_b_pages[0] === 2 && h.branch_a && h.branch_b,
    'horns carries the statute and both branches with their pages');
  t.ok(/either horn is adverse/i.test(out[0].evidence) && /never a determination/i.test(out[0].evidence),
    'worded as horns with an indicator caveat, never a determination');
  t.ok(/Page 1 vs Page 2/.test(out[0].location), 'D63 anchors both pages');
  // D10A still answers CT56 on a direct call (old sealed runs cite it) — but
  // it no longer runs in the pipeline (dispatch assertion above).
  t.ok(E.DETECTORS.D10A_DETECT_S12B_LICENCE_PREDICATE_CONFLICT(s12bStaffing)[0].type === 'CT56',
    'D10A direct call still fires CT56 (compatibility for old sealed runs)');
  t.ok(D63(['Any dispute shall be referred to arbitration in terms of clause 14, and the parties shall nominate an arbitrator by agreement.',
            'The lease agreement expired on 31 July 2026 by effluxion of time.']).length === 0,
    'silent on contractual arbitration without the s 12B track');
}

// ---- findings JSON: the ledger is sealed with the bundle ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
  const start = html.indexOf("// contract v1.0.0 — reports and exports speak in ordinals");
  const end = html.indexOf('function buildLocalNarrative');
  t.ok(start !== -1 && end > start, 'findings JSON emitter block located');
  const src = html.slice(start, end);
  const { buildFindingsJson } = new Function(
    'CONTRADICTION_TYPES', 'VO_ENGINE_VERSION',
    '"use strict";' + src + '\nreturn { buildFindingsJson };'
  )(E.CONTRADICTION_TYPES, E.VO_ENGINE_VERSION);
  const finding = { type: 'CT59', severity: 5,
    evidence: 'The record pleads that there was no such performance ("no rental was ever paid", p. 1), yet the record’s own conduct ledger contains 8 dated rental events spanning 37 months.',
    location: 'Page 1 vs Pages 2, 3, 4, 5, 6, 7, 8, 9',
    conduct_vs_pleading: { asserting_party: 'respondent', proposition: 'no rental was ever paid', proposition_page: 1,
      conduct_type: 'rental', conduct_pages: [2, 3, 4, 5, 6, 7, 8, 9], span_months: 37, event_count: 8, confidence: 'HIGH' } };
  const json = buildFindingsJson({ findings: [finding], conductLedger: L, extractionNotes: '' }, 'bundle.pdf', 'a'.repeat(128), 100, {});
  t.ok(json.conduct_ledger && json.conduct_ledger.summary.event_count === 8 && json.conduct_ledger.summary.span_months === 37,
    'the conduct ledger is exported inside the findings JSON — sealed by findingsJsonSha512 (an unsealed ledger cannot found a finding)');
  t.ok(json.contradictions[0].conduct_vs_pleading && json.contradictions[0].conduct_vs_pleading.event_count === 8 &&
    json.contradictions[0].benefit_burden === null && json.contradictions[0].horns === null,
    'the finding carries its conduct_vs_pleading payload; the other payloads stay null');
}

t.done('batch7-conduct-ledger');
