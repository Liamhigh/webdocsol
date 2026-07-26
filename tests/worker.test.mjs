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
    findingsKept: [{ id: 'F1', type: 'CT02', severity: 4, location: 'Page 2', evidence: 'signature mismatch' }]
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

  // The documented {summary, findings, ...} reply passes through as format:plain.
  const AIenv = { ...env, AI: { run: async () => ({ response: JSON.stringify({
    summary: 'Acme Ltd moved R2m to a shell account.',
    findings: 'The document shows a transfer flagged as a signature mismatch [F1].',
    contradictions: '', impact: '', legalContext: '', evidence: '', seal: '', limits: ''
  }) }) } };
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST', JSON.stringify(good)), AIenv, {});
  const pb = await r.json().catch(() => null);
  ok(pb && pb.format === 'plain', 'documented reply shape flows through as format:plain');
  ok(pb && /Acme Ltd/.test(pb.summary || ''), 'narrate passes the model summary through');
  ok(pb && /investigative indicators/.test(pb.limits || ''), 'narrate appends the closing disclaimer to limits');
}

console.log('\n[worker] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[worker] ALL GREEN');
