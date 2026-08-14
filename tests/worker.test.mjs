// Tests for worker/verum-rules.js — the Cloudflare Worker API.
// Exercises routing, CORS, error handling and stack-trace safety against a
// mocked env (no live KV / AI bindings required).
//
// Run:  node tests/worker.test.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worker = (await import(path.join(__dirname, '..', 'worker', 'verum-rules.js'))).default;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };

const env = { RULES_KV: { get: async () => null, list: async () => ({ keys: [] }) }, AI: {}, ENVIRONMENT: 'test', SERVICE_VERSION: 'test' };
const mk = (p, method = 'GET', body) =>
  new Request('https://verumglobal.foundation' + p, { method, body, headers: body ? { 'content-type': 'application/json' } : {} });

let r = await worker.fetch(mk('/api/v1/status', 'OPTIONS'), env, {});
ok(r.status === 204, 'OPTIONS preflight returns 204');
ok(r.headers.get('access-control-allow-origin') !== null, 'OPTIONS response carries CORS header');

r = await worker.fetch(mk('/api/v1/nope'), env, {});
ok(r.status === 404, 'unknown API path returns 404');
const j = await r.json().catch(() => null);
ok(j && j.error === 'not_found', '404 body has error=not_found');

// A non-API path must be served as the website, NOT answered with a JSON 404.
// This Worker gets deployed by CI onto a Worker owning the site's routes, so
// 404ing `/` here takes the entire site down -- it did, on 2026-07-25.
{
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (req) => {
    seen.push(typeof req === 'string' ? req : req.url);
    return new Response('<!DOCTYPE html><title>site</title>', {
      status: 200, headers: { 'content-type': 'text/html' }
    });
  };
  try {
    r = await worker.fetch(mk('/'), env, {});
    ok(r.status === 200, 'site root is served, not 404 (' + r.status + ')');
    ok((r.headers.get('content-type') || '').includes('text/html'), 'site root returns HTML');
    ok(seen.some(u => u.includes('verumglobal.pages.dev')), 'site root proxies to the Pages origin');

    seen.length = 0;
    r = await worker.fetch(mk('/dashboard'), env, {});
    ok(seen.some(u => u.includes('/dashboard.html')), 'extensionless page maps to its .html file');
  } finally {
    globalThis.fetch = realFetch;
  }
}

r = await worker.fetch(mk('/api/v1/ai/classify', 'GET'), env, {});
ok(r.status === 405, 'GET on a POST-only endpoint returns 405');

r = await worker.fetch(mk('/api/v1/status'), env, {});
ok(r.status === 200 || r.status === 503, 'status endpoint responds (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/ai/classify', 'POST'), env, {});
ok(r.status >= 200 && r.status < 600, 'classify with empty body responds gracefully (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/status'), {}, {});
const body = await r.text();
ok(!/at \/|\.js:\d+/.test(body), 'error responses do not leak stack traces');

// Assets must be cacheable. The proxy previously appended a cache-buster and
// no-store to EVERY response, so the 525 KB pdf-lib bundle was re-fetched from
// origin on every page view and uncached anywhere. A dropped request then left
// window.PDFLib undefined and killed the sealing pipeline.
{
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (req) => {
    seen.push(typeof req === 'string' ? req : req.url);
    return new Response('x', { status: 200, headers: { 'content-type': 'application/javascript' } });
  };
  try {
    let r = await worker.fetch(mk('/vendor/pdf-lib.min.js'), env, {});
    const cc = r.headers.get('cache-control') || '';
    ok(!/no-store/.test(cc), 'asset response is cacheable (' + cc + ')');
    ok(!seen.some(u => u.includes('_cb=')), 'asset request carries no cache-buster');

    // A failed asset must never be cached. Caching every status code for an
    // hour pinned a transient 404 at the edge, so forensic-engine-page.js came
    // back missing and the page reported "runForensicEngine is not defined".
    globalThis.fetch = async () => new Response('not found', { status: 404 });
    r = await worker.fetch(mk('/forensic-engine-page.js'), env, {});
    ok(/no-store/.test(r.headers.get('cache-control') || ''),
      'failed asset is not cached (' + (r.headers.get('cache-control') || '') + ')');

    globalThis.fetch = async (req) => {
      seen.push(typeof req === 'string' ? req : req.url);
      return new Response('x', { status: 200, headers: { 'content-type': 'application/javascript' } });
    };
    seen.length = 0;
    r = await worker.fetch(mk('/seal-document'), env, {});
    ok(/no-store/.test(r.headers.get('cache-control') || ''), 'HTML stays uncached');
    ok(seen.some(u => u.includes('_cb=')), 'HTML request is still cache-busted');

    // HTML-as-asset guard. During a Pages redeploy the origin briefly answered
    // /vendor/tesseract.min.js with the home page as a 200 -- which the edge
    // then cached for an hour. The OCR loader's global check failed and 32
    // image-only pages of the Greensky bundle went unread. A .js asset that
    // comes back text/html must be retried cache-busted, and if still HTML,
    // answered 503 no-store -- never served as if it were the script.
    let calls = 0;
    globalThis.fetch = async (req) => {
      const u = typeof req === 'string' ? req : req.url;
      calls++;
      if (calls === 1) return new Response('<!DOCTYPE html><title>home</title>', { status: 200, headers: { 'content-type': 'text/html' } });
      ok(u.includes('_vb='), 'HTML-as-asset retry is cache-busted');
      return new Response('var Tesseract={};', { status: 200, headers: { 'content-type': 'application/javascript' } });
    };
    r = await worker.fetch(mk('/vendor/tesseract.min.js'), env, {});
    ok(calls === 2 && (r.headers.get('content-type') || '').includes('javascript'),
      'asset served as JS after one cache-busted retry (calls=' + calls + ')');

    globalThis.fetch = async () => new Response('<!DOCTYPE html><title>home</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    r = await worker.fetch(mk('/vendor/tesseract.min.js'), env, {});
    ok(r.status === 503 && /no-store/.test(r.headers.get('cache-control') || ''),
      'persistent HTML-for-asset answers 503 no-store, never HTML-as-JS (' + r.status + ')');

    // An HTML page returning text/html is of course NOT the guard's business.
    globalThis.fetch = async () => new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/html' } });
    r = await worker.fetch(mk('/seal-document'), env, {});
    ok(r.status === 200, 'HTML pages still serve HTML normally');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- narrate contract: the client/worker field names must agree, and the
// documented {summary, findings, ...} reply shape must flow through untouched.
// A mismatch here (findings vs findingsKept) silently 400'd every narrate call,
// which is why reports showed no AI narrative.
{
  // Correct client payload shape -> accepted (200). Uses the template because
  // env.AI here has no run(), so callAi throws and the deterministic template
  // answers -- but the request itself must validate.
  const good = {
    documentName: 'demo.pdf', pageCount: 3, score: 62, confidence: 'HIGH',
    findingsPruned: 0, generatedUtc: '2026-07-26T00:00:00Z',
    documentExcerpt: 'On 3 March 2026 Acme Ltd transferred R2,000,000 to a shell account.',
    findingsKept: [{ id: 'F1', type: 'CT02', severity: 4, severityOrdinal: 'HIGH', status: 'ENGINE-VERIFIED', location: 'Page 2', evidence: 'signature mismatch' }],
    caseContext: { caseName: 'Acme v Shell', caseRefs: 'CAS 1/2/2026', parties: 'Acme Ltd vs Shell Co', jurisdiction: 'South Africa' }
  };
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST', JSON.stringify(good)), env, {});
  ok(r.status === 200, 'narrate accepts the documented payload shape (' + r.status + ')');
  const nb = await r.json().catch(() => null);
  ok(nb && nb.ok === true, 'narrate returns ok:true');

  // The OLD client payload {findings, score, verdict} is the wrong shape and
  // must be rejected -- documents the contract the client now satisfies.
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST',
    JSON.stringify({ findings: [{ type: 'CT02' }], score: 50, verdict: 'HIGH' })), env, {});
  ok(r.status === 400, 'narrate rejects the legacy {findings} shape (' + r.status + ')');

  // The documented {summary, findings, ...} reply passes through as format:plain,
  // and the model MUST receive the Constitution + the sealed case file text.
  let capturedUser = '', capturedSystem = '';
  const AIenv = { ...env, AI: { run: async (_model, opts) => {
    capturedUser = (opts.messages.find(m => m.role === 'user') || {}).content || '';
    capturedSystem = (opts.messages.find(m => m.role === 'system') || {}).content || '';
    return { response: JSON.stringify({
      summary: 'Acme Ltd moved R2m to a shell account. Constitutional confidence: HIGH.',
      findings: 'The document shows a transfer flagged as a signature mismatch [F1].',
      contradictions: '', impact: '', legalContext: '', evidence: '', seal: '', limits: ''
    }) };
  } } };
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST', JSON.stringify(good)), AIenv, {});
  const pb = await r.json().catch(() => null);
  ok(pb && pb.format === 'plain', 'documented reply shape flows through as format:plain');
  ok(pb && /Acme Ltd/.test(pb.summary || ''), 'narrate passes the model summary through');
  ok(pb && /verdict on any named person is for the court/.test(pb.limits || ''), 'narrate appends the PD16 closing disclaimer to limits');
  ok(/CONSTITUTION/.test(capturedUser) && /Truth over probability/.test(capturedUser),
    'the Constitution is loaded into the narrator context');
  ok(/Acme Ltd transferred R2,000,000/.test(capturedUser),
    'the sealed case file text reaches the narrator');
  // 1verum GHRP alignment: the per-finding verification tier + ordinal severity
  // and the user's case context must all reach the model, and the system prompt
  // must carry the two-tier rule so candidates are never presented as verified.
  ok(/ENGINE-VERIFIED/.test(capturedUser) && /"severityOrdinal":"HIGH"/.test(capturedUser),
    'finding tier and ordinal severity reach the narrator');
  ok(/Acme v Shell/.test(capturedUser) && /CAS 1\/2\/2026/.test(capturedUser),
    'the user\'s case context reaches the narrator');
  ok(/TWO-TIER RULE/.test(capturedSystem) && /CONTRADICTION SHAPE/.test(capturedSystem),
    'the system prompt carries the two-tier rule and the contradiction shape');
  ok(/FORMAT: short paragraphs/.test(capturedSystem) && /separated by a BLANK line/.test(capturedSystem)
    && /Never one unbroken block/.test(capturedSystem),
    'the narrator prompt demands structured paragraphs and bullets, never one block');
  ok(/DECLARATIVE FINDINGS RULE/.test(capturedSystem) && /hallmarks of fraud/.test(capturedSystem),
    'the system prompt makes anchored facts declarative (forensic-instrument voice)');
  ok(/constitutional forensic investigator/.test(capturedSystem)
    && /AI-raised candidate - pending engine verification/.test(capturedSystem)
    && /Never print CT\/SP codes unexplained/.test(capturedSystem),
    'narrator is an investigator: translates codes, raises missed contradictions as labelled candidates');
  ok(/EVENT-LEVEL DETERMINATION/.test(capturedSystem) && /the documents evidence fraud/.test(capturedSystem)
    && /Person-level guilt is never declared/.test(capturedSystem),
    'the system prompt certifies corroborated events (pathologist standard) but never person-level guilt');
  ok(capturedUser.indexOf('SEALED CASE FILE') >= 0,
    'the case file is clearly labelled for the narrator');

  // PD16 language lock (the "constitutional certainty" order). The AI layer
  // works on SEALED evidence — quoted text bound to a page in a record that
  // cannot be altered — so it reports measurements, it does not hedge them.
  // These assertions exist so a future edit cannot quietly reintroduce
  // probabilistic language into the narrator's instructions.
  ok(/WHY YOU STATE FACTS/.test(capturedSystem) && /sealed under SHA-512/.test(capturedSystem)
    && /measurement to be reported/.test(capturedSystem),
    'the narrator is told WHY it states facts: the evidence is sealed and page-anchored');
  ok(/BANNED for anchored facts/.test(capturedSystem)
    && /appears, might, possibly, seems, could, potentially/.test(capturedSystem),
    'the narrator prompt bans hedging verbs for anchored facts');
  ok(/Never an "indicator", "red flag", "concern" or "anomaly"/.test(capturedSystem),
    'an established finding is called a finding, never an "indicator"');
  ok(/No scores, no percentages, no confidence bands, ever/.test(capturedSystem),
    'the narrator prompt forbids scores, percentages and confidence bands');
  ok(!/Confidence is ordinal only\. Never percentages\./.test(capturedSystem),
    'the superseded "confidence is ordinal only" instruction is gone');
  // The embedded constitution the model reads must carry the same rule.
  ok(/No scores, no percentages, no confidence bands/.test(capturedUser)
    && /stated as fact or it is not stated at all/.test(capturedUser),
    'the constitution loaded into the model states PD1 in its v8.0 form (no bands)');
  ok(/internal weighting only/.test(capturedUser) && /never shown to a reader/.test(capturedUser),
    'severity weights are marked internal-only in the constitution the model reads');
  ok(!/Report the ordinal confidence band/.test(capturedUser),
    'the constitution no longer instructs the model to report a confidence band');
}

// --- feedback loop: the opt-in "Help improve the forensic engine" checkbox.
// End-to-end contract between shareAnonymousPatterns (seal-document.html) and
// handleFeedback (worker). The page promises users "no document content,
// names, or quotes ever leave this device" — these tests hold both sides to it.
{
  const puts = [];
  const kvEnv = { ...env, RULES_KV: {
    get: async () => null,
    list: async () => ({ keys: [] }),
    put: async (key, value, opts) => { puts.push({ key, value, opts }); }
  } };
  const post = (payload) => worker.fetch(
    mk('/api/v1/feedback/patterns', 'POST', JSON.stringify(payload)), kvEnv, {});

  // 1. The exact shape the page sends for engine findings -> stored.
  r = await post({ patterns: [
    { detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 187 },
    { detectorId: 'SERIAL', type: 'SP01', severity: 3, pageCount: 187 },
    { detectorId: 'AI_IDENTIFIED', type: 'UNDISCLOSED_RELATED_PARTY', severity: 2, pageCount: 187 }
  ] });
  let fb = await r.json().catch(() => null);
  ok(r.status === 200 && fb && fb.ok === true && fb.stored === 3,
    'feedback accepts the exact client payload shape (' + r.status + ')');
  ok(puts.length === 1 && /^feedback:\d{4}-\d{2}-\d{2}$/.test(puts[0].key),
    'feedback is stored in a day bucket (' + (puts[0] && puts[0].key) + ')');
  ok(puts[0] && puts[0].opts && puts[0].opts.expirationTtl === 90 * 24 * 60 * 60,
    'feedback auto-deletes after 90 days');
  {
    const rec = JSON.parse(puts[0].value)[0];
    const storedKeys = Object.keys(rec.patterns[0]).sort().join(',');
    ok(storedKeys === 'detectorId,pageCount,severity,type',
      'ONLY the four anonymous fields are stored (' + storedKeys + ')');
  }

  // 2. The clean-scan marker the page sends when nothing was found -> stored.
  puts.length = 0;
  r = await post({ patterns: [{ detectorId: 'CLEAN_SCAN', type: 'CLEAN_SCAN', severity: 1, pageCount: 12 }] });
  fb = await r.json().catch(() => null);
  ok(r.status === 200 && fb && fb.stored === 1, 'clean-scan marker is accepted');

  // 3. Privacy guardrail: any content-bearing field is rejected AND not stored.
  puts.length = 0;
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1, quote: 'Mr X admitted the debt' }] });
  fb = await r.json().catch(() => null);
  ok(r.status === 422 && fb && fb.error === 'privacy_violation',
    'a quote field is refused as a privacy violation (' + r.status + ')');
  ok(puts.length === 0, 'nothing is stored when the guardrail fires');
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1, name: 'K. Lappeman' }] });
  ok(r.status === 422, 'a name field is refused as a privacy violation');

  // 4. Shape violations: unknown fields, bad severity, empty/oversized arrays.
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1 }], sessionId: 'abc' });
  ok(r.status === 400, 'unknown top-level field is rejected');
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 9, pageCount: 1 }] });
  ok(r.status === 400, 'severity outside 1-5 is rejected');
  r = await post({ patterns: [] });
  ok(r.status === 400, 'empty patterns array is rejected');
  r = await post({ patterns: Array.from({ length: 201 }, () => ({ detectorId: 'CT02', type: 'CT02', severity: 1, pageCount: 1 })) });
  ok(r.status === 400, 'more than 200 patterns is rejected');

  // 5. Client-side lock: the page's sender must keep its privacy promise.
  const fs = await import('node:fs');
  const page = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
  const fnStart = page.indexOf('function shareAnonymousPatterns');
  const fnEnd = page.indexOf('\n}', fnStart);
  const fn = page.slice(fnStart, fnEnd);
  ok(fnStart > 0, 'shareAnonymousPatterns exists in the page');
  ok(/optIn\.checked/.test(fn), 'sender is opt-in: it checks the checkbox first');
  ok(/fraudResult\.scanFailed/.test(fn), 'a failed scan is never fed back as a result');
  ok(/\/api\/v1\/feedback\/patterns/.test(fn), 'sender posts to the feedback endpoint');
  ok(/\{\s*detectorId:\s*detectorId,\s*type:\s*type,\s*severity:\s*sev,\s*pageCount:\s*pageCount\s*\}/.test(fn)
    && !/evidence|quote|location|filename|sha\d|caseDetails/.test(fn.replace(/\/\/[^\n]*/g, '')),
    'sender builds ONLY the four anonymous fields — no content, names, or quotes');
  // The novel-type filter must cover the engine's full CT range (CT01-CT46):
  // an AI finding labelled with an ENGINE type is not a novel pattern, and
  // before this lock CT44-CT46 leaked through as "AI-identified novelties".
  ok(fn.indexOf('/^CT(0[1-9]|[1-3][0-9]|4[0-6])$/') !== -1,
    'novel-type filter covers the full engine range CT01-CT46');
}

console.log('\n[worker] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[worker] ALL GREEN');
