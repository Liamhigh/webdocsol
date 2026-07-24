/**
 * verumglobal-static — the Worker that actually serves the public website.
 *
 * It is a reverse proxy: every request to verumglobal.foundation that is not
 * claimed by the API worker is forwarded to the Cloudflare Pages project at
 * https://verumglobal.pages.dev, and that response is returned to the visitor.
 *
 * This means the HTML the public sees comes from the Pages project, NOT from
 * `wrangler deploy` of this repository. See DEPLOYMENT.md.
 *
 * This file was recovered from the deployed Worker, which had no source in
 * version control. It is the source of truth from now on.
 */

const ORIGIN = 'https://verumglobal.pages.dev';

// Extensionless URLs map to the matching .html file in the Pages project.
// Derived from the .html files at the repository root.
const PAGES = [
  'constitution',
  'dashboard',
  'documents-resources',
  'preview-documents',
  'preview-index',
  'seal-document',
  'verify',
  'verify-data',
];

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let path = url.pathname;

  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (PAGES.includes(slug)) {
    path = '/' + slug + '.html';
  }

  // Cache-busting param forces a fresh fetch from the Pages origin, so an
  // edge-cached copy never outlives a redeploy.
  const cacheBust = '_cb=' + Date.now();
  const target =
    ORIGIN + path + url.search + (url.search ? '&' : '?') + cacheBust;

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
