/**
 * Deterministic classification fallback (voRuleClassify / voReconcileClassification).
 * The AI classifier returned "Other (confidence: low)" on an obvious legal case
 * file (an MOA + SAPS case number + annexures + named parties) — the external
 * review of the Greensky sealed report called it a failed classification module.
 * The on-device rules must catch that case, and must never override a good AI
 * answer.
 *
 * The code under test is page-native in seal-document.html, so the block is
 * extracted by its VO-RULE-CLASSIFY markers and evaluated directly.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  rule-classify.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const start = html.indexOf('/* VO-RULE-CLASSIFY:START */');
const end = html.indexOf('/* VO-RULE-CLASSIFY:END */');
ok(start !== -1 && end > start, 'VO-RULE-CLASSIFY block located in seal-document.html');
const src = html.slice(start, end);
const { voRuleClassify, voReconcileClassification } = new Function(
  '"use strict";' + src + '\nreturn { voRuleClassify, voReconcileClassification };'
)();

const LEGAL_SAMPLE =
  'MEMORANDUM OF ASSOCIATION of the Company. The Shareholders agreement provides that each ' +
  'shareholder and director owes a fiduciary duty. SAPS CAS 126/04/2025 was opened; see Annexure B ' +
  'and Exhibit A. The respondent and the applicant appeared; their attorney filed the sworn affidavit ' +
  'before the commissioner of oaths. RAKEZ registration and the contract are attached.';

// 1. The Greensky failure case: rules classify an obvious legal case file.
{
  const r = voRuleClassify(LEGAL_SAMPLE);
  ok(r !== null && /legal case file/i.test(r.documentClass), 'rules classify an obvious legal case file');
  ok(r !== null && /rule-based/.test(String(r.confidence)), 'rule-based answer discloses its origin in the confidence field');
}

// 2. Rules stay silent on ordinary non-legal text (no false classification).
ok(voRuleClassify('minutes of the gardening club discussing compost and the spring fete') === null,
  'rules do NOT classify ordinary text');
ok(voRuleClassify('') === null, 'empty sample yields null');

// 3. Reconcile: a weak AI answer ("Other"/low/missing) is replaced by the rules.
{
  const weak = { documentClass: 'Other', confidence: 'low' };
  const r = voReconcileClassification(weak, LEGAL_SAMPLE);
  ok(/legal case file/i.test(String(r && r.documentClass)), '"Other (confidence: low)" is replaced by the rule answer');
}
{
  const r = voReconcileClassification(null, LEGAL_SAMPLE);
  ok(r !== null && /legal case file/i.test(r.documentClass), 'AI unavailable → rule answer stands in');
}

// 4. Reconcile: a GOOD AI answer is never overridden.
{
  const good = { documentClass: 'Court Filing', confidence: 'high' };
  ok(voReconcileClassification(good, LEGAL_SAMPLE) === good, 'a confident AI answer is kept as-is');
}

// 5. Weak AI answer + rules also silent → the weak AI answer survives (never
// worse than before; a low-confidence label beats no label).
{
  const weak = { documentClass: 'Other', confidence: 'low' };
  ok(voReconcileClassification(weak, 'compost and the spring fete') === weak,
    'weak AI answer survives when rules have nothing better');
}

console.log(`\n[rule-classify] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[rule-classify] FAILURES'); process.exit(1); }
console.log('[rule-classify] ALL GREEN');
