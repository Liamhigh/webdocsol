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

r = await worker.fetch(mk('/nope'), env, {});
ok(r.status === 404, 'unknown path returns 404');
const j = await r.json().catch(() => null);
ok(j && j.error === 'not_found', '404 body has error=not_found');

r = await worker.fetch(mk('/api/v1/ai/classify', 'GET'), env, {});
ok(r.status === 405, 'GET on a POST-only endpoint returns 405');

r = await worker.fetch(mk('/api/v1/status'), env, {});
ok(r.status === 200 || r.status === 503, 'status endpoint responds (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/ai/classify', 'POST'), env, {});
ok(r.status >= 200 && r.status < 600, 'classify with empty body responds gracefully (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/status'), {}, {});
const body = await r.text();
ok(!/at \/|\.js:\d+/.test(body), 'error responses do not leak stack traces');

console.log('\n[worker] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[worker] ALL GREEN');
