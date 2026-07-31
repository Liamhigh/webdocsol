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

console.log(`\n[franchise-lease] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[franchise-lease] FAILURES'); process.exit(1); }
console.log('[franchise-lease] ALL GREEN');
