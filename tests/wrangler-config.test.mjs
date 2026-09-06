/**
 * wrangler.toml drift-lock.
 *
 * The Worker must deploy identically whether Cloudflare Workers Builds runs
 * `wrangler deploy` (no --env, which builds the TOP LEVEL) or someone follows
 * DEPLOYMENT.md's older `wrangler deploy --env production`. Passing --env at a
 * config with no such environment aborts instantly ("No environment found in
 * configuration with name production") — which is why Workers Builds failed on
 * every push while Cloudflare Pages kept serving the site, hiding the breakage.
 *
 * Both now exist, and this asserts they carry the SAME bindings. The original
 * bug that motivated flattening to one environment was the opposite failure:
 * bindings lived under [env.production] ONLY, so an --env-less deploy shipped a
 * Worker with no KV and no AI and every /api/v1/ai/* call returned 500. Either
 * way the danger is divergence, so divergence is what this test forbids.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  wrangler-config.test.mjs');
console.log('======================================================\n');

const toml = readFileSync('wrangler.toml', 'utf8');

// Line-based section reader. Handles both [table] and [[array-of-table]] and
// returns the body lines up to the next header. Comments are ignored.
function section(name) {
  const want = new Set([`[${name}]`, `[[${name}]]`]);
  let found = false, inside = false;
  const out = [];
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[\[?[^\]]+\]\]?$/.test(line)) {
      inside = want.has(line);
      if (inside) found = true;
      continue;
    }
    if (inside && line && !line.startsWith('#')) out.push(line);
  }
  return found ? out.join('\n') : null;
}
function kv(body, key) {
  if (body == null) return null;
  const m = body.match(new RegExp('^\\s*' + key + '\\s*=\\s*(.+?)\\s*$', 'm'));
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}

// The top level must still be complete — an --env-less deploy is the one
// Workers Builds actually runs.
ok(/^name\s*=\s*"webdocsol"/m.test(toml), 'top-level worker name present');
ok(/^main\s*=\s*"worker\/verum-rules\.js"/m.test(toml), 'top-level entrypoint present');

const topKv = section('kv_namespaces');
const envKv = section('env.production.kv_namespaces');
ok(topKv && envKv, 'both top-level and env.production KV sections exist');
ok(kv(topKv, 'binding') === 'RULES_KV', 'top-level KV binding is RULES_KV');
ok(kv(envKv, 'binding') === kv(topKv, 'binding'), 'env.production KV binding matches top level');
ok(kv(envKv, 'id') === kv(topKv, 'id'), 'env.production KV namespace id matches top level (no divergence)');

const topAi = section('ai');
const envAi = section('env.production.ai');
ok(topAi && envAi, 'both top-level and env.production AI sections exist');
ok(kv(envAi, 'binding') === kv(topAi, 'binding') && kv(topAi, 'binding') === 'AI',
  'AI binding identical in both environments');

const topVars = section('vars');
const envVars = section('env.production.vars');
ok(topVars && envVars, 'both vars sections exist');
for (const key of ['ENVIRONMENT', 'SERVICE_VERSION', 'HUMAN_REPORT_MODEL']) {
  ok(kv(envVars, key) === kv(topVars, key), `${key} identical in both environments`);
}

const topObs = section('observability');
const envObs = section('env.production.observability');
ok(kv(envObs, 'enabled') === kv(topObs, 'enabled'), 'observability identical in both environments');

// The site ships with the Worker as static assets — the Pages origin behind
// the proxy went stale (it 200-served its old home page for every missing
// file), so the repo root is the site now. Both environments must carry the
// same assets block, or an --env production deploy ships a Worker with no
// site — the same class of bug the binding drift-lock above exists for.
const topAssets = section('assets');
const envAssets = section('env.production.assets');
ok(topAssets && envAssets, 'both top-level and env.production assets sections exist');
ok(kv(topAssets, 'directory') === './', 'assets directory is the repo root');
ok(kv(envAssets, 'directory') === kv(topAssets, 'directory'), 'assets directory identical in both environments');
ok(kv(topAssets, 'binding') === 'ASSETS', 'assets binding is ASSETS');
ok(kv(envAssets, 'binding') === kv(topAssets, 'binding'), 'assets binding identical in both environments');
ok((kv(topAssets, 'run_worker_first') || '').includes('"/api/*"'), 'the API keeps running the Worker first');
ok(kv(envAssets, 'run_worker_first') === kv(topAssets, 'run_worker_first'), 'run_worker_first identical in both environments');

// The ONE declared route is the site catch-all. History: it began as a
// narrow exception (the transcribe path, then /api/v1/ai/*) to reclaim
// traffic from a stale dashboard route on the retired "verum-rules" Worker.
// On 2026-09-06 the retired Workers (verum-rules, verumglobal-static) were
// deleted in the dashboard and their routes vanished with them, orphaning
// the site; this Worker is the only one left and serves everything (the
// /api/* router plus the Pages static proxy), so the declared catch-all
// became the permanent architecture. The drift this lock now guards against
// is the route quietly narrowing or multiplying — either can orphan part of
// the domain again.
// Two hosts, one Worker (2026-09-07): a route pattern names one host, and
// `verumglobal.foundation/*` never matched www — so www was served by the
// zone's other origin (the Pages custom domain) while the apex ran this
// Worker, and the two phones saw two different sites. Both hosts are declared
// in both environments; nothing else may be.
{
  const routeLines = toml.split(/\r?\n/).filter(l => /^\s*\{\s*pattern\s*=/.test(l));
  ok(routeLines.length === 4, 'exactly two route patterns, declared in both environments (' + routeLines.length + ')');
  const patterns = routeLines.map(l => (l.match(/pattern\s*=\s*"([^"]+)"/) || [])[1]).sort();
  ok(patterns.join(',') === 'verumglobal.foundation/*,verumglobal.foundation/*,www.verumglobal.foundation/*,www.verumglobal.foundation/*',
    'the declared routes are the apex and www catch-alls, nothing narrower or wider (' + patterns.join(' ') + ')');
  for (const l of routeLines) ok(l.includes('zone_name = "verumglobal.foundation"'), 'route carries its zone_name');
}

console.log(`\n[wrangler-config] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[wrangler-config] FAILURES'); process.exit(1); }
console.log('[wrangler-config] ALL GREEN');
