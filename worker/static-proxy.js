var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, 'name', { value, configurable: true });

export const ORIGIN = "https://verumglobal.pages.dev";
export const PAGES = [
  "constitution",
  "dashboard",
  "documents-resources",
  "preview-documents",
  "preview-index",
  "seal-document",
  "verify",
  "verify-data"
];
export const CHAIN_HEADER = "X-VO-Chain";
export function chainHeaders(request) {
  const h = new Headers(request.headers);
  h.set(CHAIN_HEADER, "worker");
  return h;
}
__name(chainHeaders, "chainHeaders");
export async function serveStatic(request) {
  const url = new URL(request.url);
  let path = url.pathname;
  const slug = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (PAGES.includes(slug)) {
    path = "/" + slug + ".html";
  }
  const isAsset = /\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path);
  const target = isAsset ? ORIGIN + path + url.search : ORIGIN + path + url.search + (url.search ? "&" : "?") + "_cb=" + Date.now();
  let response = await fetch(
    new Request(target, {
      method: request.method,
      headers: chainHeaders(request),
      body: request.body,
      // Cache successful asset responses only. A flat cacheTtl applies to every
      // status code, so one 404 or 5xx during a redeploy was pinned at the edge
      // for the full hour -- which is how forensic-engine-page.js came back
      // missing and the page reported "runForensicEngine is not defined".
      // Failures must always be retried, never cached.
      cf: isAsset ? {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": 3600, "300-399": 0, "400-499": 0, "500-599": 0 }
      } : { cacheTtl: 0 }
    })
  );
  if (isAsset && response.status >= 200 && response.status < 300 && /text\/html/i.test(response.headers.get("content-type") || "")) {
    response = await fetch(
      new Request(ORIGIN + path + (url.search ? url.search + "&" : "?") + "_vb=" + Date.now(), {
        method: request.method,
        headers: chainHeaders(request),
        cf: { cacheTtl: 0 }
      })
    );
    if (response.status >= 200 && response.status < 300 && /text\/html/i.test(response.headers.get("content-type") || "")) {
      return new Response("asset temporarily unavailable (origin returned HTML for " + path + ")", {
        status: 503,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" }
      });
    }
  }
  const headers = new Headers(response.headers);
  if (isAsset && response.status >= 200 && response.status < 300) {
    headers.set("Cache-Control", "public, max-age=300, must-revalidate");
  } else if (isAsset) {
    headers.set("Cache-Control", "no-store");
  } else {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(serveStatic, "serveStatic");
export const REPO_RAW_ORIGIN = "https://raw.githubusercontent.com/Liamhigh/webdocsol/main";
export const SITE_DENY_RE = /^\/(?:\.|worker\/|tests\/|functions\/|node_modules\/|brand\/|seal-module\/|package(?:-lock)?\.json$|wrangler\.toml$|[^/]*\.md$|.*\/[^/]*\.md$|greensky-ocr-verify\.pdf$|forensic_test_document\.pdf$)/i;
export const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  map: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  wasm: "application/wasm",
  gz: "application/gzip",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf"
};
export function repoPathFor(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname || "/");
  } catch {
    return null;
  }
  if (path.includes("..") || path.includes("\\") || /[\x00-\x1f\x7f]/.test(path)) return null;
  path = path.replace(/\/{2,}/g, "/");
  if (path === "/" || path === "") return "/index.html";
  const slug = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (PAGES.includes(slug)) return "/" + slug + ".html";
  if (path.endsWith("/")) return null;
  if (!/\.[a-z0-9]+$/i.test(path)) return null;
  if (SITE_DENY_RE.test(path)) return null;
  return path;
}
__name(repoPathFor, "repoPathFor");
export function contentTypeFor(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path || "");
  return m && CONTENT_TYPES[m[1].toLowerCase()] || "application/octet-stream";
}
__name(contentTypeFor, "contentTypeFor");
export function siteHeaders(contentType, isHtml, source) {
  const h = new Headers({ "Content-Type": contentType, "X-Content-Type-Options": "nosniff", "X-VO-Site-Source": source });
  if (isHtml) {
    h.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    h.set("Pragma", "no-cache");
    h.set("Expires", "0");
  } else {
    h.set("Cache-Control", "public, max-age=300, must-revalidate");
  }
  return h;
}
__name(siteHeaders, "siteHeaders");
export async function serveFromRepo(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const path = repoPathFor(new URL(request.url).pathname);
  if (!path) return null;
  const isHtml = /\.html?$/i.test(path);
  let res;
  try {
    res = await fetch(REPO_RAW_ORIGIN + path, {
      method: "GET",
      headers: { "Accept": "*/*", "User-Agent": "verum-omnis-worker" },
      // HTML must not outlive a merge (the raw host itself caches ~5 minutes);
      // assets may sit at the edge for 5 minutes. Failures are never cached.
      cf: isHtml ? { cacheTtl: 0 } : { cacheEverything: true, cacheTtlByStatus: { "200-299": 300, "300-399": 0, "400-499": 0, "500-599": 0 } }
    });
  } catch {
    return null;
  }
  if (!res || res.status !== 200) return null;
  if (!isHtml && /text\/html/i.test(res.headers.get("content-type") || "")) return null;
  const headers = siteHeaders(contentTypeFor(path), isHtml, "repo");
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(res.body, { status: 200, headers });
}
__name(serveFromRepo, "serveFromRepo");
export async function serveFromAssets(request, env2) {
  if (!env2 || !env2.ASSETS || typeof env2.ASSETS.fetch !== "function") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let res;
  try {
    res = await env2.ASSETS.fetch(request);
  } catch {
    return null;
  }
  if (!res || res.status === 404 || res.status >= 500) return null;
  const headers = new Headers(res.headers);
  headers.set("X-VO-Site-Source", "assets");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
__name(serveFromAssets, "serveFromAssets");
export async function serveSite(request, env2) {
  const path = new URL(request.url).pathname;
  if (SITE_DENY_RE.test(path)) {
    return new Response(JSON.stringify({ ok: false, error: "not_found", message: "Not a site file." }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  const fromAssets = await serveFromAssets(request, env2);
  if (fromAssets) return fromAssets;
  const fromRepo = await serveFromRepo(request);
  if (fromRepo) return fromRepo;
  const res = await serveStatic(request);
  const headers = new Headers(res.headers);
  headers.set("X-VO-Site-Source", "pages");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
__name(serveSite, "serveSite");

