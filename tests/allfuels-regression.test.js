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

console.log('\n[allfuels-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[allfuels-regression] ALL GREEN');
