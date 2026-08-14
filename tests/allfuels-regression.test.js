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
  const no = ['Port Edward', 'Cnr R', 'Desmond Smith’s Dispossession'];
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

console.log('\n[allfuels-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[allfuels-regression] ALL GREEN');
