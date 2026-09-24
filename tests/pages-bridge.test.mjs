/**
 * The Pages bridge (functions/[[path]].js): while www.verumglobal.foundation is
 * still answered by the legacy Cloudflare Pages project, every request Pages
 * receives is handed to the webdocsol Worker and the Worker's answer returned
 * unchanged — site, API and forensic service alike. Locks: the target keeps
 * path and query; method, headers and body pass through; redirects pass
 * through untouched; a request marked by the Worker's own serving chain is
 * answered from the static files (never bridged back — a loop); an
 * unreachable Worker falls back to the static files with an honest header;
 * the bridge never ships as a Worker asset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ok, done } = require('./_assert.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = await import(pathToFileURL(path.join(root, 'functions', '[[path]].js')).href);
const sp = await import(pathToFileURL(path.join(root, 'worker', 'static-proxy.js')).href);

console.log('======================================================');
console.log('RUN  pages-bridge.test.mjs');
console.log('======================================================\n');

ok(B.bridgeTarget('https://www.verumglobal.foundation/api/v1/site/health?x=1') === 'https://webdocsol.liamhigh78.workers.dev/api/v1/site/health?x=1', 'the target is the same path and query on the Worker');
ok(B.bridgeTarget('https://www.verumglobal.foundation/seal-document.html', 'https://other.example/') === 'https://other.example/seal-document.html', 'VO_WORKER_ORIGIN overrides the Worker address');

const assetsCalls = [];
const env = { ASSETS: { fetch: async (req) => { assetsCalls.push(new URL(req.url).pathname); return new Response('static ' + new URL(req.url).pathname, { status: 200, headers: { 'content-type': 'text/html' } }); } } };

// 1. An ordinary request is handed to the Worker with method, headers and body.
{
  let seen = null;
  const fake = async (req) => { seen = { url: req.url, method: req.method, headers: Object.fromEntries(req.headers), body: await req.text() }; return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'x-vo-site-source': 'assets' } }); };
  const req = new Request('https://www.verumglobal.foundation/api/v1/ai/narrate?v=2', { method: 'POST', headers: { 'content-type': 'application/json', 'host': 'www.verumglobal.foundation', 'cf-connecting-ip': '203.0.113.9', 'x-admin-token': 't' }, body: '{"findingsKept":[]}' });
  const res = await B.bridge(req, env, fake);
  ok(seen && seen.url === 'https://webdocsol.liamhigh78.workers.dev/api/v1/ai/narrate?v=2', 'the request reaches the Worker at the same path and query (' + (seen && seen.url) + ')');
  ok(seen && seen.method === 'POST' && seen.body === '{"findingsKept":[]}', 'method and body pass through');
  ok(seen && seen.headers['content-type'] === 'application/json' && seen.headers['x-admin-token'] === 't', 'request headers pass through');
  ok(seen && seen.headers['x-forwarded-host'] === 'www.verumglobal.foundation' && seen.headers['x-forwarded-for'] === '203.0.113.9', 'the original host and client address travel as X-Forwarded-*');
  ok(res.status === 200 && res.headers.get('content-type') === 'application/json; charset=utf-8' && res.headers.get('x-vo-site-source') === 'assets' && res.headers.get('x-vo-bridge') === 'pages-to-worker' && (await res.text()) === '{"ok":true}',
    'the Worker\'s answer returns unchanged, with the bridge named in a header');
  ok(assetsCalls.length === 0, 'the static files are not consulted when the Worker answers');
}

// 2. A redirect from the Worker passes through as a redirect (the seal page is /seal-document).
{
  const fake = async () => new Response(null, { status: 307, headers: { location: '/seal-document' } });
  const res = await B.bridge(new Request('https://www.verumglobal.foundation/seal-document.html'), env, fake);
  ok(res.status === 307 && res.headers.get('location') === '/seal-document', 'a 307 with a relative Location is returned as-is (' + res.status + ')');
}

// 3. The Worker's own chain request is answered from the static files, never bridged back.
{
  let workerCalled = false;
  const fake = async () => { workerCalled = true; return new Response('x'); };
  const res = await B.bridge(new Request('https://verumglobal.pages.dev/images/logo-full.png', { headers: { 'x-vo-chain': 'worker' } }), env, fake);
  ok(!workerCalled && assetsCalls[assetsCalls.length - 1] === '/images/logo-full.png' && (await res.text()) === 'static /images/logo-full.png', 'a request marked X-VO-Chain is served from the static files (no loop)');
}

// 4. An unreachable Worker falls back to the static site with an honest header.
{
  const fake = async () => { throw new Error('connect failed'); };
  const res = await B.bridge(new Request('https://www.verumglobal.foundation/'), env, fake);
  ok(res.status === 200 && res.headers.get('x-vo-bridge') === 'worker-unreachable' && (await res.text()) === 'static /', 'the static home page answers when the Worker cannot be reached, and says so');
}

// 5. The Worker marks its own Pages-tier requests, and never ships the bridge as an asset.
{
  const h = sp.chainHeaders(new Request('https://x/y', { headers: { accept: '*/*' } }));
  ok(h.get('x-vo-chain') === 'worker' && h.get('accept') === '*/*', 'serveStatic marks its requests to the Pages origin with X-VO-Chain: worker');
  const src = fs.readFileSync(path.join(root, 'worker', 'static-proxy.js'), 'utf8');
  const body = src.slice(src.indexOf('export async function serveStatic'), src.indexOf('export async function serveStatic') + 4000);
  ok(!/headers: request\.headers,/.test(body) && (body.match(/chainHeaders\(request\)/g) || []).length === 2, 'both Pages-tier fetches in serveStatic use the marked headers');
  ok(sp.SITE_DENY_RE.test('/functions/[[path]].js') && sp.SITE_DENY_RE.test('/functions/x.js'), 'the Worker never serves /functions/');
  const ignore = fs.readFileSync(path.join(root, '.assetsignore'), 'utf8');
  ok(/^functions\/$/m.test(ignore), '.assetsignore excludes functions/ from the Worker\'s assets');
  ok(typeof B.onRequest === 'function', 'the Pages entry point is exported');
}

done('pages-bridge');
