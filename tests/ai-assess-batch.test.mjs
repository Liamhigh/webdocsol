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
 * Founder ruling (5 October 2026): the AI can never delete or change an engine
 * finding. An "unsupported" view is a note on a copy of the ORIGINAL finding;
 * every finding comes back, in order, with the engine's own words (the review
 * once returned its 300-character request copies, and a long quote reached the
 * sealed report cut mid-word: "verify execution agai").
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
// The mock marks finding index 0 of each batch unsupported -> one NOTE per
// batch, and no finding removed.
ok(r1.findings.length === big.length,
  'every engine finding comes back: the AI removes none (' + r1.findings.length + ' of ' + big.length + ')');
ok(r1.noted === batches.length && r1.findings.filter(f => f.aiReviewNote).length === batches.length,
  'an unsupported view is an advisory note, one per batch here (' + r1.noted + ')');
ok(r1.findings.every((f, i) => f.evidence === big[i].evidence && f.id === big[i].id && f.type === big[i].type),
  'every finding keeps the engine\'s own words: the 300-character request copy never reaches the report');
ok(r1.findings.every(f => f.aiAssessed === true) && big.every(f => f.aiAssessed === undefined && f.aiReviewNote === undefined),
  'the review\'s marks travel on copies; the engine\'s own finding objects are untouched');

// --- a failing batch keeps its findings, the rest still assess ---
sentBatches = []; failBatchIndex = 1;   // second batch throws
const r2 = await sandbox.aiAssessFindings(big);
ok(r2 && r2.ran === true, 'partial failure still yields a review (some batches ran)');
// Every finding comes back; only the successful batches carry notes.
ok(r2.findings.length === big.length && r2.noted === batches.length - 1,
  'a failed batch adds no note and nothing is ever removed (' + r2.findings.length + ', notes ' + r2.noted + ')');
ok(r2.findings.filter(f => f.aiAssessed === true).length === big.length - sentBatches[1].length,
  'the failed batch\'s findings are marked not reviewed');

// --- if EVERY batch fails, the review honestly reports it did not run ---
const alwaysFail = { };
async function aiApiPostAllFail() { throw new Error('HTTP 413'); }
const sb2 = { JSON, Object, String, parseInt, isFinite, aiApiPost: aiApiPostAllFail, console };
sb2.globalThis = sb2; vm.createContext(sb2);
vm.runInContext(consts + '\n' + batchesFn + '\n' + findingsFn +
  '\n; this.aiAssessFindings = aiAssessFindings;', sb2);
const r3 = await sb2.aiAssessFindings(big);
ok(r3 === null, 'when every batch fails, aiAssessFindings returns null (review did not run)');

// --- the worker's no-model fallback (reviewed:false) is not a review ---
async function aiApiPostFallback(path, payload) { return { reviewed: false, verdicts: payload.findings.map(f => ({ id: f.id, verdict: 'supported', reason: 'ai unavailable — no note' })), additionalFindings: [] }; }
const sb3 = { JSON, Object, String, parseInt, isFinite, aiApiPost: aiApiPostFallback, console };
sb3.globalThis = sb3; vm.createContext(sb3);
vm.runInContext(consts + '\n' + batchesFn + '\n' + findingsFn + '\n; this.aiAssessFindings = aiAssessFindings;', sb3);
ok(await sb3.aiAssessFindings(big) === null, 'the worker\'s reviewed:false fallback is not counted as a review that ran');

console.log(`\n[ai-assess-batch] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[ai-assess-batch] FAILURES'); process.exit(1); }
console.log('[ai-assess-batch] ALL GREEN');
