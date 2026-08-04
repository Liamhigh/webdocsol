/**
 * The seal page sends engine findings to the worker's /api/v1/ai/assess for AI
 * review. That endpoint rejects any body over 16 KB (MAX_AI_BODY) and accepts
 * at most 40 findings per call (MAX_ASSESS_FINDINGS). Sending every finding in
 * one body is what produced the "AI consensus NOT RUN (HTTP 413)" on the
 * 148-page Ritz bundle. aiAssessFindings now packs findings into batches that
 * stay under both caps and merges the verdicts. This extracts the real
 * batching code from seal-document.html and proves:
 *   - no batch can exceed the worker's body-size or count caps,
 *   - a large finding set that would 413 in one shot now goes through,
 *   - verdicts merge by id and a failing batch keeps (never drops) its findings.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  ai-assess-batch.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
function grab(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('could not extract ' + label + ' from seal-document.html');
  return m[0];
}
const consts = ['AI_ASSESS_BODY_LIMIT', 'AI_ASSESS_MAX_PER_BATCH', 'AI_ASSESS_EVIDENCE_CHARS']
  .map(n => grab(new RegExp('var ' + n + ' = [^\\n]+', ''), n)).join('\n');
const batchesFn = grab(/function aiAssessBatches\(assessed\) \{[\s\S]*?\n\}/, 'aiAssessBatches');
const findingsFn = grab(/async function aiAssessFindings\(findings\) \{[\s\S]*?\n\}/, 'aiAssessFindings');

// Worker's real limits (worker/verum-rules.js) -- the caps the batches must respect.
const WORKER_BODY_CAP = 16 * 1024;
const WORKER_MAX_FINDINGS = 40;

// A mock /assess: records each batch, drops the first finding of each batch, and
// can be told to throw for a chosen batch index (to prove graceful degradation).
let sentBatches = [];
let failBatchIndex = -1;
async function aiApiPost(path, payload) {
  const idx = sentBatches.length;
  sentBatches.push(payload.findings);
  if (idx === failBatchIndex) throw new Error('HTTP 500 (simulated)');
  const verdicts = payload.findings.map((f, i) => ({ id: f.id, keep: i !== 0 }));
  return { verdicts, additionalFindings: [] };
}

const sandbox = { JSON, Object, String, parseInt, isFinite, aiApiPost, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(consts + '\n' + batchesFn + '\n' + findingsFn +
  '\n; this.aiAssessBatches = aiAssessBatches; this.aiAssessFindings = aiAssessFindings;', sandbox);

// Build 120 findings, each with a full 300-char evidence quote -> well over 16 KB
// in one body (this is the shape that used to 413).
function makeFindings(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: 'F' + i, type: 'CT31', severity: 3,
      location: 'Page ' + (i + 1),
      evidence: ('Referenced annexure not found in document; quoted passage ' + i + ' ').repeat(20) });
  }
  return out;
}

const big = makeFindings(120);
const oneShot = JSON.stringify({ findings: big });
ok(oneShot.length > WORKER_BODY_CAP, 'test premise: 120 findings exceed the 16 KB cap in one body (' + oneShot.length + ' bytes)');

// --- batching respects both caps ---
const assessedLike = big.map((f, i) => {
  const c = Object.assign({}, f);
  if (c.evidence.length > 300) c.evidence = c.evidence.slice(0, 300);
  return c;
});
const batches = sandbox.aiAssessBatches(assessedLike);
ok(batches.length > 1, 'a >16 KB finding set is split into multiple batches (' + batches.length + ')');
let allUnderSize = true, allUnderCount = true, total = 0;
for (const b of batches) {
  if (JSON.stringify({ findings: b }).length > WORKER_BODY_CAP) allUnderSize = false;
  if (b.length > WORKER_MAX_FINDINGS) allUnderCount = false;
  total += b.length;
}
ok(allUnderSize, 'every batch body stays under the 16 KB worker cap');
ok(allUnderCount, 'every batch has at most 40 findings');
ok(total === assessedLike.length, 'batching preserves every finding (no loss, no duplication)');

// --- full flow: verdicts merge, all batches run ---
sentBatches = []; failBatchIndex = -1;
const r1 = await sandbox.aiAssessFindings(big);
ok(r1 && r1.ran === true, 'aiAssessFindings runs across batches without a 413');
ok(sentBatches.length === batches.length, 'one POST per batch (' + sentBatches.length + ')');
// The mock drops finding index 0 of each batch -> exactly one drop per batch.
ok(r1.findings.length === big.length - batches.length,
  'kept = total minus one dropped-by-AI per batch (' + r1.findings.length + ')');

// --- a failing batch keeps its findings, the rest still assess ---
sentBatches = []; failBatchIndex = 1;   // second batch throws
const r2 = await sandbox.aiAssessFindings(big);
ok(r2 && r2.ran === true, 'partial failure still yields a review (some batches ran)');
// Only the successful batches drop their index-0 finding; the failed batch keeps all.
ok(r2.findings.length === big.length - (batches.length - 1),
  'a failed batch drops nothing; only successful batches prune (' + r2.findings.length + ')');

// --- if EVERY batch fails, the review honestly reports it did not run ---
const alwaysFail = { };
async function aiApiPostAllFail() { throw new Error('HTTP 413'); }
const sb2 = { JSON, Object, String, parseInt, isFinite, aiApiPost: aiApiPostAllFail, console };
sb2.globalThis = sb2; vm.createContext(sb2);
vm.runInContext(consts + '\n' + batchesFn + '\n' + findingsFn +
  '\n; this.aiAssessFindings = aiAssessFindings;', sb2);
const r3 = await sb2.aiAssessFindings(big);
ok(r3 === null, 'when every batch fails, aiAssessFindings returns null (review did not run)');

console.log(`\n[ai-assess-batch] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[ai-assess-batch] FAILURES'); process.exit(1); }
console.log('[ai-assess-batch] ALL GREEN');
