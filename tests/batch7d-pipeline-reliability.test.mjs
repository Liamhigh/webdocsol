/** Batch 7d N2–N4: bounded payloads, deterministic lanes and honest failures. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const html = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
let workerSource = fs.readFileSync(path.join(__dirname, '..', 'worker', 'verum-rules.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (condition, name) => { if (condition) pass++; else { fail++; console.log('  ✗ FAIL: ' + name); } };
const slice = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
console.log('======================================================');
console.log('RUN  batch7d-pipeline-reliability.test.mjs');
console.log('======================================================\n');

// N2: only these sections lose the heavy context. The writer stays sequential.
ok(/VO_HUMAN_LIGHT_SECTIONS = \{\s*executive_summary: 1,\s*recommendations: 1,\s*legal_framework: 1\s*\}/.test(html),
  'exactly executive summary, recommendations and legal framework are light');
ok(/var recordChars = VO_HUMAN_LIGHT_SECTIONS\[section\] \? 0 : VO_HUMAN_RECORD_CHARS/.test(html) &&
   /sealedRecord: recordChars \? recordContext : null/.test(html) &&
   /technicalReport: recordChars \? technicalReport : null/.test(html),
  'light calls keep focused excerpts/findings JSON but omit both heavy payloads');
ok(!/VO_HUMAN_LIGHT_SECTIONS[\s\S]*critical_evidence: 1/.test(html), 'critical evidence retains the full record');

// N3: sweep lanes overlap, but recommendations merge in original window order.
{
  const context = {
    console, Promise, Date, setTimeout, clearTimeout,
    AI_SWEEP_MAX_WINDOWS: 16, AI_SWEEP_BUDGET_MS: 180000, AI_SWEEP_CALL_TIMEOUT_MS: 35000,
    VO_SWEEP_LANES: 3, window: {},
    voBuildSweepWindows: () => ({ eligiblePages: 5, windows: [0, 1, 2, 3, 4].map(i => [{ page: i + 1, text: 'page ' + (i + 1) }]) }),
    voSweepPagesOf: () => [], voB9PageRanges: pages => pages.join(','),
    voAnchorAiQuote: quote => ({ found: true, quote, location: 'Page 1' })
  };
  let active = 0, maxActive = 0;
  context.aiApiPost = async (endpoint, payload) => {
    const index = payload.pages[0].page - 1;
    const delays = [45, 5, 25, 1, 10];
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, delays[index]));
    active--;
    return { reviewed: true, unverified: 0, recommendations: [{ type: 'B9_TEST', quote: 'quote ' + index, page: index + 1, severity: 3, rationale: 'r' + index }] };
  };
  vm.createContext(context);
  vm.runInContext(slice('async function aiBrain9Sweep(', '// The results panel states what Brain 9 read') + '\nthis.sweep = aiBrain9Sweep;', context);
  const result = await context.sweep(['1', '2', '3', '4', '5'], []);
  ok(maxActive === 3, 'sweep uses three concurrent lanes (observed ' + maxActive + ')');
  ok(result.recommendations.map(r => r.quote).join('|') === 'quote 0|quote 1|quote 2|quote 3|quote 4',
    'sweep output order is independent of network completion order');
  ok(result.info.windows === 5 && result.info.pagesRead.join(',') === '1,2,3,4,5', 'all sweep windows merge exactly once');
}

// N3: assess batches also overlap and merge notes/candidates in batch order.
{
  const context = {
    console, Promise, Date, setTimeout, clearTimeout,
    AI_ASSESS_BODY_LIMIT: 14000, AI_ASSESS_MAX_PER_BATCH: 1, AI_ASSESS_EVIDENCE_CHARS: 300,
    VO_SWEEP_LANES: 3,
    voAnchorAiQuote: quote => ({ found: true, quote, location: 'Page 9' }),
    voRulePagesOf: () => [9]
  };
  let active = 0, maxActive = 0;
  context.aiApiPost = async (endpoint, payload) => {
    const id = payload.findings[0].id;
    const delays = [35, 2, 18, 1];
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, delays[id]));
    active--;
    return { reviewed: true, verdicts: [{ id, verdict: 'supported' }], additionalFindings: [{ type: 'AI_TEST_' + id, quote: 'candidate quote ' + id, severity: 3, rationale: 'candidate ' + id }] };
  };
  vm.createContext(context);
  vm.runInContext(slice('function aiAssessBatches(', 'function voCaseDetails(') + '\nthis.assess = aiAssessFindings;', context);
  const input = [0, 1, 2, 3].map(id => ({ id, type: 'CT99', evidence: 'engine evidence ' + id, location: 'Page 2', severity: 2 }));
  const result = await context.assess(input);
  ok(maxActive === 3, 'assessment uses three concurrent lanes (observed ' + maxActive + ')');
  ok(result.added.map(f => f.rationale).join('|') === 'candidate 0|candidate 1|candidate 2|candidate 3',
    'assessment candidates preserve original batch order');
  ok(result.findings.every(f => f.aiAssessed === true), 'every successful original batch is marked assessed at merge time');
}

// N4: structured transport timeout, with no invented HTTP status.
{
  const context = { console, Date, setTimeout, clearTimeout, AbortController, window: {}, fetch: (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); });
  }) };
  vm.createContext(context);
  vm.runInContext(slice('async function aiApiPost(', '// Gatekeep advisory:') + '\nthis.post = aiApiPost; this.reason = voAiFailureReason;', context);
  let caught = null;
  try { await context.post('/api/v1/ai/narrate', {}, 5); } catch (e) { caught = e; }
  const error = context.window._voLastAiError;
  ok(caught && error && error.endpoint === '/api/v1/ai/narrate' && error.status === null && error.message === 'timeout after 5 ms' && error.elapsedMs >= 0,
    'timeout records endpoint, null status, elapsed time and exact message');
  ok(context.reason(caught) === 'timeout', 'the caught timeout retains its failure class');
}

// N4: Worker template fallback carries the actual class over HTTP 200.
{
  workerSource = workerSource.replace(/^import .*$/gm, '').replace(/export default verum_rules_default;\s*$/, 'this.workerDefault = verum_rules_default;');
  const context = {
    console, URL, URLSearchParams, Response, Request, Headers, TextEncoder, TextDecoder,
    Uint8Array, ArrayBuffer, Blob, FormData, setTimeout, clearTimeout,
    serveSite: async () => null, serveFromAssets: async () => null, serveFromRepo: async () => null,
    REPO_RAW_ORIGIN: '', ORIGIN: '', LOGO_FULL_PNG_B64: '', WATERMARK_PNG_B64: '', b64ToBytes: () => new Uint8Array()
  };
  vm.createContext(context);
  vm.runInContext(workerSource + '\nthis.narrate = handleAiNarrate;', context);
  context.callAi = async () => { throw new Error('Workers AI call timed out after 30000 ms'); };
  const narrateRequest = () => new Request('https://example.test/api/v1/ai/narrate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentName: 'record.pdf', pageCount: 1, findingsKept: [{ id: 'F1', type: 'CT02', evidence: 'dated one way here and another way there', location: 'Page 1' }], findingsPruned: 0 })
  });
  const response = await context.narrate(narrateRequest(), {});
  const body = await response.json();
  ok(response.status === 200 && body.error === 'timeout' && body.model === 'template-fallback' && /timed out after 30000 ms/.test(body.detail),
    'HTTP-200 template fallback reports timeout and its actual detail');
  context.callAi = async () => { throw new Error('model reply is missing narrative sections'); };
  const emptyBody = await (await context.narrate(narrateRequest(), {})).json();
  ok(emptyBody.error === 'empty' && /missing narrative sections/.test(emptyBody.detail),
    'a missing-sections model reply is classified as empty, not model_error');
}

// N4: banner counts exclude not_applicable and hard failures invent no N/M.
{
  const context = { console };
  vm.createContext(context);
  vm.runInContext(slice('function voNarrativePartReason(', '// B7 triple legal verification') + '\nthis.banner = voNarrativeIncompleteBanner;', context);
  const banner = context.banner([
    { provenance: 'ai', text: 'compliant' },
    { provenance: 'none', reason: 'timeout' },
    { provenance: 'none', reason: 'not_applicable' },
    { provenance: 'none', reason: 'gate_failed', gate: { language: 1, anchor: 0, quote: 0 } }
  ], 3, 2, null);
  ok(banner.headline === 'AI narrative incomplete — 2 of 3 sections written by fixed template. Reasons:' && !/part 3/.test(banner.reasons.join(';')) && /timeout/.test(banner.reasons.join(';')) && /language gate/.test(banner.reasons.join(';')),
    'amber banner has exact N/M wording, residual reasons and no not_applicable failure');
  const backfilled = context.banner([
    { provenance: 'ai', text: 'worker accepted but render rejected' },
    { provenance: 'none', reason: 'timeout' }
  ], 2, 2, null);
  ok(backfilled.reasons.length === 2 && /1 part replaced by the render-time gate after worker acceptance/.test(backfilled.reasons.join(';'))
      && !/part 1: language gate/.test(backfilled.reasons.join(';')),
    'render backfill reports an honest unnumbered reason without inventing a gate class');
  const renderOnly = context.banner([{ provenance: 'ai', reason: 'render_gate', text: 'suppressed' }], 1, 1, null);
  ok(/part 1: render-time gate/.test(renderOnly.reasons.join(';')),
    'narrator suppression is surfaced as a render-time fallback');
  const hard = context.banner(null, 0, 0, { name: 'TypeError', message: 'render failed', stage: 'rendering' });
  ok(hard.headline === 'AI narrative incomplete. Reasons:' && /TypeError during rendering: render failed/.test(hard.reasons.join(';')),
    'hard failure retains its class without inventing a section count');
}

{
  const report = require('../forensic-report.js');
  const passing = { provenance: 'ai', text: 'The record states the first entry (p. 7). The record states the second entry (p. 8).' };
  const failing = { provenance: 'ai', text: 'This probably happened.' };
  const suppression = report._voHumanNarratorSuppression({ executive_summary: passing, chronology: failing, legal_framework: failing });
  ok(suppression.drafted === 3 && suppression.passing === 1 && suppression.suppressed
      && /_voHumanNarratorSuppression\(hr\.sections\)/.test(html) && /part\.reason === 'render_gate'/.test(html),
    'the UI uses the report’s own suppression decision and counts every suppressed AI section as a fallback');
}

ok(/aiNarrativeError: opts\.aiNarrativeError \|\| null/.test(fs.readFileSync(path.join(__dirname, '..', 'forensic-report.js'), 'utf8')) &&
   /data\.aiNarrativeError\.detail/.test(fs.readFileSync(path.join(__dirname, '..', 'forensic-report.js'), 'utf8')),
  'the current-run narrate failure reaches the technical methodology page');

console.log(`\n[batch7d-pipeline-reliability] PASS=${pass} FAIL=${fail}`);
if (fail) process.exit(1);
console.log('[batch7d-pipeline-reliability] ALL GREEN');
