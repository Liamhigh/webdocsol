/**
 * The site-serving chain (worker/static-proxy.js serveSite) and the two site
 * images. Locks: the deny list mirrors .assetsignore; every local reference
 * in every page resolves to a file the site will serve; the embedded fallback
 * images are real PNGs of the right size; each tier answers in order and
 * names itself; /api/v1/site/health tells the truth about the tiers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worker = (await import(path.join(root, 'worker', 'verum-rules.js'))).default;
const sp = await import(path.join(root, 'worker', 'static-proxy.js'));
const sa = await import(path.join(root, 'worker', 'site-assets.js'));

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };
console.log('======================================================');
console.log('RUN  site-serving.test.mjs');
console.log('======================================================\n');

const env = { RULES_KV: { get: async () => null, list: async () => ({ keys: [] }) }, AI: {}, ENVIRONMENT: 'test', SERVICE_VERSION: 'test' };
const mk = (p, method = 'GET') => new Request('https://verumglobal.foundation' + p, { method });

// ---- .assetsignore <-> SITE_DENY_RE drift lock ------------------------------
{
  const lines = fs.readFileSync(path.join(root, '.assetsignore'), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  ok(lines.length >= 10, '.assetsignore has its patterns (' + lines.length + ')');
  for (const pat of lines) {
    const samples = pat.endsWith('/') ? ['/' + pat + 'sample.js']
      : pat.startsWith('*.') ? ['/sample' + pat.slice(1), '/seal-module/sample' + pat.slice(1)]
      : ['/' + pat];
    for (const smp of samples) {
      ok(sp.SITE_DENY_RE.test(smp) && sp.repoPathFor(smp) === null, '.assetsignore pattern "' + pat + '" is also denied by the Worker: ' + smp);
    }
  }
  for (const allowed of ['/index.html', '/seal-document.html', '/verify.html', '/images/logo-full.png', '/images/favicon.png', '/vendor/pdf-lib.min.js', '/verum-ui.css', '/robots.txt', '/llms.txt', '/sitemap.xml', '/constitution.json', '/seal-guard.js']) {
    ok(!sp.SITE_DENY_RE.test(allowed) && sp.repoPathFor(allowed) === allowed && fs.existsSync(path.join(root, allowed)), 'site file allowed and present: ' + allowed);
  }
  ok(sp.repoPathFor('/') === '/index.html' && sp.repoPathFor('/seal-document') === '/seal-document.html', 'root and extensionless pages map to their files');
  ok(sp.repoPathFor('/../wrangler.toml') === null && sp.repoPathFor('/%2e%2e/x.js') === null && sp.repoPathFor('/a//b.js') === '/a/b.js', 'traversal is refused; doubled slashes collapse');
  ok(sp.contentTypeFor('/x.html').startsWith('text/html') && sp.contentTypeFor('/x.js').startsWith('application/javascript') && sp.contentTypeFor('/x.png') === 'image/png' && sp.contentTypeFor('/vendor/eng.traineddata.gz') === 'application/gzip', 'content types come from the extension');
}

// ---- every local reference in every page resolves to a served file ---------
{
  const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  const known = new Set(['/constitution.pdf', '/docs/constitution.pdf']); // KV-served by the Worker
  let refs = 0, broken = [];
  for (const pg of pages) {
    const html = fs.readFileSync(path.join(root, pg), 'utf8');
    const re = /(?:src|href)="(\/[^"?#\s]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const ref = m[1];
      if (ref.startsWith('/api/') || known.has(ref) || ref.startsWith('//')) continue;
      refs++;
      const mapped = sp.repoPathFor(ref);
      if (!mapped || !fs.existsSync(path.join(root, mapped))) broken.push(pg + ' -> ' + ref);
    }
  }
  ok(refs > 30, 'pages carry local references to check (' + refs + ')');
  ok(broken.length === 0, 'every local reference in every page resolves to a file the site serves' + (broken.length ? ': ' + broken.join(', ') : ''));
}

// ---- embedded fallback images are real PNGs ---------------------------------
function pngDims(bytes) {
  const sig = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return sig ? { w: dv.getUint32(16), h: dv.getUint32(20) } : null;
}
{
  const logo = pngDims(sa.b64ToBytes(sa.LOGO_FULL_PNG_B64));
  const wm = pngDims(sa.b64ToBytes(sa.WATERMARK_PNG_B64));
  ok(logo && logo.w === 512 && logo.h === 512, 'embedded logo is a 512x512 PNG (' + JSON.stringify(logo) + ')');
  ok(wm && wm.w === 927 && wm.h === 1200, 'embedded watermark keeps the original 927x1200 (' + JSON.stringify(wm) + ')');
  ok(sa.LOGO_FULL_PNG_B64.length < 20000 && sa.WATERMARK_PNG_B64.length < 60000, 'embedded copies stay small (' + sa.LOGO_FULL_PNG_B64.length + ' + ' + sa.WATERMARK_PNG_B64.length + ' base64 chars)');
  const orig = pngDims(new Uint8Array(fs.readFileSync(path.join(root, 'images', 'logo-full.png'))));
  ok(orig && orig.w === 1024, 'the original logo in images/ is untouched (' + JSON.stringify(orig) + ')');
}

// ---- the image tiers, in order ----------------------------------------------
{
  const realFetch = globalThis.fetch;
  const byHost = { raw: null, pages: null };
  const seen = [];
  globalThis.fetch = async (req) => {
    const u = typeof req === 'string' ? req : req.url;
    seen.push(u);
    const h = /raw\.githubusercontent\.com/.test(u) ? byHost.raw : byHost.pages;
    return h ? h(u) : new Response('not found', { status: 404 });
  };
  try {
    // nothing upstream -> embedded copy, never a 404, never HTML
    let r = await worker.fetch(mk('/images/logo-full.png'), env, {});
    let bytes = new Uint8Array(await r.arrayBuffer());
    ok(r.status === 200 && r.headers.get('content-type') === 'image/png' && pngDims(bytes) && pngDims(bytes).w === 512 && r.headers.get('x-vo-site-source') === 'embedded',
      'with no assets, no repo and no KV the logo is still a PNG (embedded, ' + r.status + ', ' + r.headers.get('x-vo-site-source') + ')');
    ok(/max-age=300/.test(r.headers.get('cache-control') || '') && r.headers.get('x-content-type-options') === 'nosniff', 'embedded image is cacheable and nosniff');
    ok(!seen.some(u => u.includes('verumglobal.pages.dev')), 'the Pages origin is never asked for a site image');
    r = await worker.fetch(mk('/images/watermark_portrait.png'), env, {});
    bytes = new Uint8Array(await r.arrayBuffer());
    ok(r.status === 200 && pngDims(bytes) && pngDims(bytes).h === 1200, 'the watermark has an embedded copy too');

    // KV (legacy) answers before the embedded copy
    const envKv = { ...env, RULES_KV: { get: async (k) => k === 'img:logo-full:b64' ? sa.LOGO_FULL_PNG_B64 : null, list: async () => ({ keys: [] }) } };
    r = await worker.fetch(mk('/images/logo-full.png'), envKv, {});
    ok(r.status === 200 && r.headers.get('x-vo-site-source') === 'kv', 'a KV copy answers before the embedded copy');

    // the repo answers before KV
    byHost.raw = () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { status: 200, headers: { 'content-type': 'image/png' } });
    r = await worker.fetch(mk('/images/logo-full.png'), envKv, {});
    ok(r.status === 200 && r.headers.get('x-vo-site-source') === 'repo' && r.headers.get('content-type') === 'image/png', 'the main branch answers before KV');

    // bundled assets answer before everything
    const envA = { ...envKv, ASSETS: { fetch: async () => new Response('png', { status: 200, headers: { 'content-type': 'image/png', 'etag': '"x"' } }) } };
    seen.length = 0;
    r = await worker.fetch(mk('/images/logo-full.png'), envA, {});
    ok(r.status === 200 && r.headers.get('x-vo-site-source') === 'assets' && seen.length === 0, 'bundled assets answer first, no network');

    // method discipline
    r = await worker.fetch(mk('/images/logo-full.png', 'POST'), env, {});
    ok(r.status === 405, 'POST on a site image is 405');
    r = await worker.fetch(mk('/images/logo-full.png', 'HEAD'), envA, {});
    ok(r.status === 200, 'HEAD on a site image is answered');

    // ---- health: names the tier that answers ----
    byHost.raw = () => new Response('nf', { status: 404 });
    r = await worker.fetch(mk('/api/v1/site/health'), env, {});
    let h = await r.json();
    ok(r.status === 200 && h.ok === true && h.assetsBinding === false, 'health answers without an assets binding');
    ok(h.logo && h.logo.source === 'embedded' && h.watermark && h.watermark.source === 'embedded', 'health says the logo would come from the embedded copy');
    ok(h.home && h.home.source === 'pages' && h.sealPage && h.sealPage.source === 'pages', 'health says pages fall to the legacy origin when the repo is unreachable');
    ok(h.origins && /raw\.githubusercontent\.com\/Liamhigh\/webdocsol\/main/.test(h.origins.repo) && /pages\.dev/.test(h.origins.pages), 'health names both origins');
    ok(/no-store/.test(r.headers.get('cache-control') || ''), 'health is never cached');
    r = await worker.fetch(mk('/api/v1/site/health'), envA, {});
    h = await r.json();
    ok(h.assetsBinding === true && h.logo.source === 'assets' && h.home.source === 'assets', 'with the binding, health reports assets for pages and images');
    byHost.raw = () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain' } });
    r = await worker.fetch(mk('/api/v1/site/health'), env, {});
    h = await r.json();
    ok(h.home.source === 'repo' && h.logo.source === 'repo', 'with the repo reachable, health reports repo');
    r = await worker.fetch(mk('/api/v1/site/health', 'POST'), env, {});
    ok(r.status === 405, 'health is GET-only');
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n[site-serving] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[site-serving] FAILURES'); process.exit(1); }
console.log('[site-serving] ALL GREEN');
