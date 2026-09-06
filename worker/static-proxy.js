/**
 * Static-site proxy: forwards a request to the Cloudflare Pages project that
 * holds the website, and returns its response uncached.
 *
 * Used by worker/verum-rules.js as the LAST tier of the site-serving chain
 * below (serveSite). It was once shared with a separate "verumglobal-static"
 * Worker; that Worker was deleted from the dashboard on 2026-09-06 and its
 * source removed from the repo — this one Worker serves everything.
 *
 * That fallback exists because Cloudflare Workers Builds deploys this repo
 * automatically, and the Worker it deploys onto owns the `verumglobal.foundation`
 * routes. Without it, an API-only script landing on that Worker answers the
 * site root with `{"error":"not_found"}` and the entire site goes dark.
 * Every Worker built from this repo must therefore be able to serve the site.
 */

export const ORIGIN = 'https://verumglobal.pages.dev';

// Extensionless URLs map onto the matching .html file in the Pages project.
// Derived from the .html files at the repository root.
export const PAGES = [
  'constitution',
  'dashboard',
  'documents-resources',
  'preview-documents',
  'preview-index',
  'seal-document',
  'verify',
  'verify-data',
];

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function serveStatic(request) {
  const url = new URL(request.url);
  let path = url.pathname;

  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (PAGES.includes(slug)) {
    path = '/' + slug + '.html';
  }

  // Only HTML is cache-busted. Applying it to everything meant each page load
  // re-fetched every asset from the origin uncached -- including the 525 KB
  // pdf-lib bundle. On a phone that request intermittently failed, leaving
  // window.PDFLib undefined and the sealing pipeline dead with
  // "Cannot read properties of undefined (reading 'load')". Scripts and images
  // are safe to cache; only the HTML must never outlive a redeploy.
  const isAsset = /\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path);

  const target = isAsset
    ? ORIGIN + path + url.search
    : ORIGIN + path + url.search + (url.search ? '&' : '?') + '_cb=' + Date.now();

  let response = await fetch(
    new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // Cache successful asset responses only. A flat cacheTtl applies to every
      // status code, so one 404 or 5xx during a redeploy was pinned at the edge
      // for the full hour -- which is how forensic-engine-page.js came back
      // missing and the page reported "runForensicEngine is not defined".
      // Failures must always be retried, never cached.
      cf: isAsset
        ? {
            cacheEverything: true,
            cacheTtlByStatus: { '200-299': 3600, '300-399': 0, '400-499': 0, '500-599': 0 },
          }
        : { cacheTtl: 0 },
    })
  );

  // HTML-as-asset guard. During a Pages redeploy the origin can briefly answer
  // an asset path with the home page as a 200 -- and a 200 is cached at the
  // edge for the full hour, poisoning every later request. That is exactly how
  // /vendor/tesseract.min.js was served as HTML during the Greensky rerun: the
  // OCR loader's global check failed and 32 image-only pages went unread. A
  // non-HTML asset that comes back text/html is retried once cache-busted; if
  // it is STILL HTML, answer 503 no-store -- the page loaders treat that as an
  // honest failure and retry/fall back, instead of executing a web page as JS.
  if (isAsset && response.status >= 200 && response.status < 300 &&
      /text\/html/i.test(response.headers.get('content-type') || '')) {
    response = await fetch(
      new Request(ORIGIN + path + (url.search ? url.search + '&' : '?') + '_vb=' + Date.now(), {
        method: request.method,
        headers: request.headers,
        cf: { cacheTtl: 0 },
      })
    );
    if (response.status >= 200 && response.status < 300 &&
        /text\/html/i.test(response.headers.get('content-type') || '')) {
      return new Response('asset temporarily unavailable (origin returned HTML for ' + path + ')', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
      });
    }
  }

  const headers = new Headers(response.headers);
  if (isAsset && response.status >= 200 && response.status < 300) {
    // Short enough that a redeploy propagates quickly, long enough that the
    // bundle is not re-downloaded on every page view.
    headers.set('Cache-Control', 'public, max-age=300, must-revalidate');
  } else if (isAsset) {
    // A failed asset must not stick in the browser cache either.
    headers.set('Cache-Control', 'no-store');
  } else {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// The site-serving chain (since 2026-09-06).
//
// Workers Static Assets is the intended origin: every file in the repo root
// (minus .assetsignore) ships with the Worker and is served before the Worker
// runs. Two things can still put a site request in front of this code: the
// platform hands the Worker any path with no matching asset, and a deploy that
// did not carry its assets (the 6 September logo outage: the pages loaded, the
// KV-served logo 404'd, and nothing said why). So the Worker serves the site
// itself, in a fixed order, and labels every answer with X-VO-Site-Source:
//
//   1. assets   env.ASSETS - the bundled files, if the binding exists
//   2. repo     raw.githubusercontent.com/<owner>/<repo>/main - the same files,
//               straight from version control; what is merged IS the site
//   3. pages    the Cloudflare Pages project (serveStatic above) - legacy origin,
//               known to answer missing files with its home page
//   4. embedded the two site images only (worker/site-assets.js), so a broken
//               logo cannot ship whatever happened upstream
//
// /api/v1/site/health reports which tier answers, so the next outage is a
// one-URL diagnosis instead of a guess.
// ---------------------------------------------------------------------------

export const REPO_RAW_ORIGIN = 'https://raw.githubusercontent.com/Liamhigh/webdocsol/main';

// Mirror of .assetsignore: what is never a site file, whichever tier answers.
// tests/site-serving.test.mjs locks the two lists to each other.
export const SITE_DENY_RE = /^\/(?:\.|worker\/|tests\/|node_modules\/|brand\/|seal-module\/|package(?:-lock)?\.json$|wrangler\.toml$|[^/]*\.md$|.*\/[^/]*\.md$|greensky-ocr-verify\.pdf$|forensic_test_document\.pdf$)/i;

const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8', map: 'application/json; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon',
  pdf: 'application/pdf', wasm: 'application/wasm', gz: 'application/gzip',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf'
};

// Map a request path onto the repository file that answers it, or null when
// nothing in the repo may answer it (denied, traversal, no such shape).
export function repoPathFor(pathname) {
  let path;
  try { path = decodeURIComponent(pathname || '/'); } catch { return null; }
  if (path.includes('..') || path.includes('\\') || /[\x00-\x1f\x7f]/.test(path)) return null;
  path = path.replace(/\/{2,}/g, '/');
  if (path === '/' || path === '') return '/index.html';
  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (PAGES.includes(slug)) return '/' + slug + '.html';
  if (path.endsWith('/')) return null;
  if (!/\.[a-z0-9]+$/i.test(path)) return null;
  if (SITE_DENY_RE.test(path)) return null;
  return path;
}

export function contentTypeFor(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path || '');
  return (m && CONTENT_TYPES[m[1].toLowerCase()]) || 'application/octet-stream';
}

function siteHeaders(contentType, isHtml, source) {
  const h = new Headers({ 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'X-VO-Site-Source': source });
  if (isHtml) {
    h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    h.set('Pragma', 'no-cache');
    h.set('Expires', '0');
  } else {
    h.set('Cache-Control', 'public, max-age=300, must-revalidate');
  }
  return h;
}

/**
 * Tier 2: the file as it is on the main branch. Returns null on anything
 * other than a clean hit, so the caller moves on to the next tier.
 * @param {Request} request
 * @returns {Promise<Response|null>}
 */
export async function serveFromRepo(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const path = repoPathFor(new URL(request.url).pathname);
  if (!path) return null;
  const isHtml = /\.html?$/i.test(path);
  let res;
  try {
    res = await fetch(REPO_RAW_ORIGIN + path, {
      method: 'GET',
      headers: { 'Accept': '*/*', 'User-Agent': 'verum-omnis-worker' },
      // HTML must not outlive a merge (the raw host itself caches ~5 minutes);
      // assets may sit at the edge for 5 minutes. Failures are never cached.
      cf: isHtml
        ? { cacheTtl: 0 }
        : { cacheEverything: true, cacheTtlByStatus: { '200-299': 300, '300-399': 0, '400-499': 0, '500-599': 0 } }
    });
  } catch {
    return null;
  }
  if (!res || res.status !== 200) return null;
  // The raw host answers a file as text/plain (or the right image type); an
  // HTML answer for a non-HTML path is an interstitial, never the file.
  if (!isHtml && /text\/html/i.test(res.headers.get('content-type') || '')) return null;
  const headers = siteHeaders(contentTypeFor(path), isHtml, 'repo');
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(res.body, { status: 200, headers });
}

/**
 * Tier 1: the bundled static assets, when the Worker was deployed with them.
 * A 404 from the binding is a miss (the platform already tried assets first
 * when it routed here); anything else is the answer.
 */
export async function serveFromAssets(request, env) {
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  let res;
  try { res = await env.ASSETS.fetch(request); } catch { return null; }
  if (!res || res.status === 404 || res.status >= 500) return null;
  const headers = new Headers(res.headers);
  headers.set('X-VO-Site-Source', 'assets');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * The whole chain for an ordinary site path.
 * @param {Request} request
 * @param {object} env
 */
export async function serveSite(request, env) {
  const path = new URL(request.url).pathname;
  if (SITE_DENY_RE.test(path)) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found', message: 'Not a site file.' }), {
      status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  const fromAssets = await serveFromAssets(request, env);
  if (fromAssets) return fromAssets;
  const fromRepo = await serveFromRepo(request);
  if (fromRepo) return fromRepo;
  const res = await serveStatic(request);
  const headers = new Headers(res.headers);
  headers.set('X-VO-Site-Source', 'pages');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
