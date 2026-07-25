/**
 * Static-site proxy: forwards a request to the Cloudflare Pages project that
 * holds the website, and returns its response uncached.
 *
 * Shared by worker/verumglobal-static.js (the Worker dedicated to this job)
 * and by worker/verum-rules.js, which falls back to it for any non-API path.
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

  const response = await fetch(
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
