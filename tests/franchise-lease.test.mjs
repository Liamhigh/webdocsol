/**
 * v6.0 franchise/lease detectors (D38 CT44, D39 CT45) — grounded in the
 * AllFuels / Caltex Franchise Agreement facts the engine previously missed
 * because the lease clause was never read against the ownership record.
 * Extracts the shipped detector functions from forensic-engine-page.js and
 * exercises them directly, and asserts a clean franchise document is quiet.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  franchise-lease.test.mjs');
console.log('======================================================\n');

const DET = require('../forensic-engine-page.js').DETECTORS;
ok(Boolean(DET && DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED), 'D38 detector is exported');
ok(Boolean(DET && DET.D39_DETECT_ASSET_VALUE_DENIAL), 'D39 detector is exported');

// --- CT44: Lessee/Owner conditional-clause trap ---
const bundle = [
  'in the event that the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired.',
  'This Franchise Agreement expires by the effluxion of time on 31 July 2016.',
  'By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.',
];
let f = DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED(bundle);
ok(f.length > 0 && f[0].type === 'CT44', 'D38 flags CT44 on the lessee-clause-vs-owner bundle');
// ANCHORING: CT44 must now name real pages (was a pseudo-location that the
// anchor rule demoted to an unanchored note — so the AllFuels report never
// headlined the lessee/owner trap).
ok(f[0] && /Page \d/.test(f[0].location) && f[0].location.indexOf('agreement vs ownership') === -1,
  'CT44 anchors to a real page (Page 1 vs Page 3), not a pseudo-location');
ok(f[0] && f[0].evidence.indexOf('lessee') !== -1 && f[0].evidence.indexOf('owner') !== -1 && /"/.test(f[0].evidence),
  'CT44 evidence quotes both the lessee clause and the ownership record');

// A clean franchise doc (defines lessee/owner generically, no acquisition, no misinvoked termination) stays quiet.
const clean = [
  'The FRANCHISEE or lessee, as the case may be, shall maintain the premises.',
  'CALTEX, in the case where CALTEX is lessee, and the FRANCHISEE where the FRANCHISEE is the lessee, shall insure the premises.',
];
ok(DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED(clean).length === 0, 'D38 stays quiet on a clean franchise agreement');

// --- CT45: goodwill recognised then denied ---
const gw = [
  'The clawback shall apply in respect of the Value of the Business; the goodwill shall inure to the benefit of the FRANCHISEE.',
  'The respondent submitted that goodwill has no compensable value.',
];
let g = DET.D39_DETECT_ASSET_VALUE_DENIAL(gw);
ok(g.length > 0 && g[0].type === 'CT45', 'D39 flags CT45 when goodwill is recognised then denied');

const gwClean = [
  'The clawback shall apply in respect of the Value of the Business; the goodwill shall inure to the FRANCHISEE.',
  'The franchisee retained the goodwill on renewal.',
];
ok(DET.D39_DETECT_ASSET_VALUE_DENIAL(gwClean).length === 0, 'D39 stays quiet when goodwill is never denied');

// ===== AllFuels rerun regression (1 Aug 2026): the detector built FROM the
// Goodwill Paradox was silent on the case's own courtroom phrasing — counsel
// said "held NO COMPENSABLE GOODWILL" (negation before the word), and only
// negation-after patterns were known. A goodwill FORFEITURE clause also now
// counts as recognition (nothing to forfeit unless the asset exists).
ok(DET.D39_DETECT_ASSET_VALUE_DENIAL([
  'the agreement contained a goodwill forfeiture clause required as a condition of operating the garage.',
  'counsel submitted that the operators held no compensable goodwill in their franchise sites.'
]).some(f => f.type === 'CT45'),
  'CT45 fires on the AllFuels courtroom phrasing ("held no compensable goodwill" + forfeiture clause)');
ok(DET.D39_DETECT_ASSET_VALUE_DENIAL([
  'on termination no compensation for improvements shall be payable to the lessee.'
]).length === 0,
  'CT45 stays silent on an ordinary no-compensation-for-improvements clause');

// ANCHORING: the goodwill CT45 must now name a real page too.
ok(g[0] && /Page \d/.test(g[0].location) && g[0].location.indexOf('later submission') === -1,
  'CT45 anchors to a real page (Page 1 vs Page 2), not a pseudo-location');

// ===== The Des / Caltex clause-11 trap the engine was missing =====
// Clause 11.1.3 (franchisee "shall not be entitled to any compensation or
// repayment ... in respect of any structural additions, alterations or
// improvements") sits with clause 11.2 (franchisor "entitled to purchase the
// property itself at fair market value"). Value denied to the party who built
// it, realised by the other — caught only when BOTH halves are present.
const clause11 = [
  'The FRANCHISEE acknowledges that it shall not be entitled to any compensation or repayment of any manner in respect of any structural additions, alterations or improvements to the Premises, whether necessary, luxurious or otherwise.',
  'The FRANCHISOR shall be entitled to purchase the property itself at fair market value and the products at cost.',
];
const c11 = DET.D39_DETECT_ASSET_VALUE_DENIAL(clause11);
ok(c11.some(x => x.type === 'CT45'), 'CT45 now catches the Caltex clause-11 trap (no compensation for improvements + franchisor buys the property at value)');
ok(c11.some(x => x.type === 'CT45' && /Page 1 vs Page 2/.test(x.location)), 'the clause-11 CT45 anchors to the two clause pages');
ok(c11.some(x => x.type === 'CT45' && /improvements/.test(x.evidence) && /fair market value/.test(x.evidence)), 'the clause-11 CT45 quotes both halves of the trap');
// The franchisor-buys-at-value clause ALONE is not a contradiction — needs the paired denial.
ok(DET.D39_DETECT_ASSET_VALUE_DENIAL([
  'The FRANCHISOR shall be entitled to purchase the property itself at fair market value.'
]).length === 0,
  'CT45 stays silent on a lone purchase-at-value clause (needs the paired no-compensation clause)');

console.log(`\n[franchise-lease] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[franchise-lease] FAILURES'); process.exit(1); }
console.log('[franchise-lease] ALL GREEN');
