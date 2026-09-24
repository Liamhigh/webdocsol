// THE BRIDGE — www.verumglobal.foundation is still answered by this Cloudflare
// Pages project (its custom domain, a CNAME from before the Worker took the
// site). The site and the API now live in the "webdocsol" Worker, and the
// two Custom Domains declared in wrangler.toml cannot attach while this CNAME
// exists (see DEPLOYMENT.md "The domain"). Until the domain is moved, every
// request that reaches Pages is handed to the Worker unchanged and the
// Worker's answer is returned unchanged, so www serves the same site, the
// same API and the same forensic service as the Worker's own address.
//
// Once the Custom Domains attach, Pages stops answering www and this file is
// inert. It never runs on the Worker: `functions/` is in .assetsignore and in
// the Worker's SITE_DENY_RE.
//
// Loop guard: the Worker's own serving chain asks this project for a file it
// does not carry (its last tier, worker/static-proxy.js serveStatic) and marks
// that request with X-VO-Chain. Such a request is answered from the static
// files here, never by proxying back to the Worker.
//
// Tests: tests/pages-bridge.test.mjs.
export const WORKER_ORIGIN = 'https://webdocsol.liamhigh78.workers.dev';
export const CHAIN_HEADER = 'x-vo-chain';
const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'host', 'content-length'];

/** The same path and query on the Worker. */
export function bridgeTarget(url, origin) {
  const u = new URL(url);
  return (origin || WORKER_ORIGIN).replace(/\/+$/, '') + u.pathname + u.search;
}

/**
 * Hand one request to the Worker and return its answer.
 * @param {Request} request
 * @param {{ASSETS?: {fetch: Function}, VO_WORKER_ORIGIN?: string}} env
 * @param {Function} [fetchImpl] test seam
 */
export async function bridge(request, env, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const assets = env && env.ASSETS;
  if (request.headers.get(CHAIN_HEADER)) {
    // The Worker asking Pages for a file: static files only, no proxy (loop).
    return assets ? assets.fetch(request) : new Response('not found', { status: 404 });
  }
  const origin = (env && env.VO_WORKER_ORIGIN) || WORKER_ORIGIN;
  const headers = new Headers(request.headers);
  for (const h of HOP_BY_HOP) headers.delete(h);
  const incoming = new URL(request.url);
  headers.set('x-forwarded-host', incoming.host);
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  const init = { method: request.method, headers, redirect: 'manual' };
  // The body is read whole: a streamed body needs the `duplex` option on some
  // runtimes and none of the API's bodies are large (JSON, page excerpts, a
  // voice note); whole is the portable choice.
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();
  let res;
  try {
    res = await doFetch(new Request(bridgeTarget(request.url, origin), init));
  } catch (e) {
    // The Worker could not be reached: the static site still answers, and the
    // header says why the API is missing.
    if (!assets) return new Response('service unavailable', { status: 503, headers: { 'x-vo-bridge': 'worker-unreachable' } });
    const fallback = await assets.fetch(request);
    const fh = new Headers(fallback.headers);
    fh.set('x-vo-bridge', 'worker-unreachable');
    return new Response(fallback.body, { status: fallback.status, statusText: fallback.statusText, headers: fh });
  }
  const out = new Headers(res.headers);
  out.set('x-vo-bridge', 'pages-to-worker');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export function onRequest(context) {
  return bridge(context.request, context.env);
}
