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

  // Cache-busting param forces a fresh fetch from the Pages origin, so an
  // edge-cached copy never outlives a redeploy.
  const cacheBust = '_cb=' + Date.now();
  const target = ORIGIN + path + url.search + (url.search ? '&' : '?') + cacheBust;

  const response = await fetch(
    new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      cf: { cacheTtl: 0 },
    })
  );

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
