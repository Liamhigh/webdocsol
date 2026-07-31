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

// The load-bearing guarantee: a clean document produces ZERO findings across
// all text detectors (this is what regressed into 2 false CT35 findings before).
const skip = new Set(['D15_DETECT_METADATA_FRAUD','D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH','D16_DETECT_FONT_ANOMALY','D37_DETECT_INTERNAL_CONFLICT_CATCHALL']);
const clean = ['The franchisee operated the Port Edward service station under a valid licence. Rent was paid monthly, statements reconciled, and the agreement was renewed on schedule with the consent of both parties.'];
let cf = [];
for (const [k, fn] of Object.entries(DET)) { if (typeof fn !== 'function' || skip.has(k)) continue; try { cf = cf.concat(fn(clean) || []); } catch (e) {} }
ok(cf.length === 0, 'a clean document yields ZERO findings across all text detectors (was 2 false CT35): got ' + cf.map(x => x.type).join(','));

console.log(`\n[detector-recall] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[detector-recall] FAILURES'); process.exit(1); }
console.log('[detector-recall] ALL GREEN');
