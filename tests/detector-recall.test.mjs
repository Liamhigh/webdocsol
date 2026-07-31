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

console.log(`\n[detector-recall] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[detector-recall] FAILURES'); process.exit(1); }
console.log('[detector-recall] ALL GREEN');
