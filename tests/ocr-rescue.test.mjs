/**
 * OCR-rescue hardening: the verified-global retry loader (the "pdf.js
 * unavailable" total-failure was the deployment intermittently serving HTML
 * instead of JS -- onload fired, global never appeared, no retry), the pinned
 * CDN fallback ordering, and the per-page rescued/noText/renderFailed
 * accounting in the extraction note.
 *
 * The code under test is page-native in seal-document.html, so the block is
 * extracted by marker and evaluated with stubbed document/pdfjs/Tesseract.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  ocr-rescue.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const start = html.indexOf('var VO_OCR_MAX_PAGES');
const end = html.indexOf('// ==================== ANONYMOUS PATTERN SHARING');
ok(start !== -1 && end > start, 'OCR block located in seal-document.html');
const src = html.slice(start, end);

// The block must no longer use the old un-verified loader.
ok(!/voLoadScriptOnce/.test(src), 'old un-verified voLoadScriptOnce is gone');
ok(/pdfjs-dist@3\.11\.174/.test(src), 'CDN fallback pinned to the vendored pdf.js version (3.11.174)');

// OCR blackout fix: tesseract must have a version-matched CDN fallback so a
// missing /vendor/ on the Pages deploy no longer means zero OCR. The vendored
// build is 5.1.1; the fallback (main + worker) must pin that exact version so
// the worker/API versions cannot mismatch.
ok(/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js/.test(src), 'tesseract main CDN fallback pinned to vendored 5.1.1');
ok(/tesseract\.js@5\.1\.1\/dist\/worker\.min\.js/.test(src), 'tesseract worker CDN fallback version-matched to 5.1.1');
{
  const flat = src.replace(/\s+/g, ' ');
  ok(/\['\/vendor\/tesseract\.min\.js', 'https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1/.test(flat),
    'tesseract tries vendored first, then the CDN (order preserved)');
  ok(/createWorker.*_tessBases/.test(flat) || /_tessBases/.test(flat),
    'createWorker retries across asset bases (vendored <-> CDN)');
}

function build(env) {
  const fn = new Function(
    'document', 'updateStep', 'pdfjsLib', 'Tesseract', 'window',
    '"use strict";' + src + '\nreturn { voOcrLoadScript, voOcrRescuePages };'
  );
  return fn(env.document, env.updateStep || (() => {}), env.pdfjsLib, env.Tesseract, env.window || {});
}

// Fake DOM whose appendChild simulates one behaviour per URL.
// behaviours[urlPrefix] = 'ok' | 'html' (onload but no global) | 'err'
function fakeDom(behaviours, state) {
  return {
    head: {
      appendChild(s) {
        const kind = Object.keys(behaviours).find((k) => s.src.indexOf(k) === 0);
        const b = behaviours[kind] || 'err';
        state.attempts.push(s.src);
        setTimeout(() => {
          if (b === 'err') return s.onerror && s.onerror();
          if (b === 'ok') state.globalPresent = true; // real JS: defines the global
          s.onload && s.onload();                     // 'html': onload, no global
        }, 0);
      },
    },
    createElement(tag) {
      if (tag === 'script') return { remove() {} };
      throw new Error('unexpected createElement ' + tag);
    },
  };
}

// 1. Loader: vendored serves HTML twice, CDN works -> returns the CDN source.
{
  const state = { attempts: [], globalPresent: false };
  const dom = fakeDom({ '/vendor/pdf.min.js': 'html', 'https://unpkg.com': 'ok' }, state);
  const { voOcrLoadScript } = build({ document: dom });
  const winner = await voOcrLoadScript(
    ['/vendor/pdf.min.js', 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'],
    () => state.globalPresent
  );
  ok(winner.indexOf('unpkg.com') !== -1, 'HTML-instead-of-JS on vendored falls through to CDN');
  ok(state.attempts.filter((u) => u.indexOf('/vendor/') === 0).length === 2 &&
     /vobust=/.test(state.attempts[1]),
     'vendored source got a cache-busted second attempt before falling back');
}

// 2. Loader: global already present -> no script tags appended at all.
{
  const state = { attempts: [], globalPresent: true };
  const dom = fakeDom({}, state);
  const { voOcrLoadScript } = build({ document: dom });
  await voOcrLoadScript(['/vendor/x.js'], () => true);
  ok(state.attempts.length === 0, 'loader short-circuits when the global already exists');
}

// 3. Loader: everything fails -> throws with the reasons joined.
{
  const state = { attempts: [], globalPresent: false };
  const dom = fakeDom({ '/vendor/t.js': 'html' }, state);
  const { voOcrLoadScript } = build({ document: dom });
  let threw = null;
  try { await voOcrLoadScript(['/vendor/t.js'], () => state.globalPresent); }
  catch (e) { threw = e; }
  ok(threw && /global missing/.test(threw.message), 'total failure throws with the HTML-served diagnosis in the message');
}

// 4. voOcrRescuePages: full per-page accounting (rescued / noText / renderFailed).
{
  const pageText = 'y'.repeat(400);
  const blocks = [pageText, pageText, '', '', '', pageText]; // pages 3,4,5 image-only
  const fakePdf = {
    async getPage(n) {
      if (n === 5) throw new Error('render exploded');   // page 5: renderFailed
      return {
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
        _n: n,
      };
    },
    async destroy() {},
  };
  const pdfjsLib = {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
  };
  let lastPage = 0;
  const Tesseract = {
    async createWorker() {
      return {
        async recognize(canvas) {
          // page 3 reads real text; page 4 reads nothing (photo/blank)
          return { data: { text: canvas._page === 3 ? 'recovered scanned affidavit text from the exhibit' : '' } };
        },
        async terminate() {},
      };
    },
  };
  // The canvas records which page is being rendered so recognize() can branch:
  const dom = {
    head: { appendChild() { throw new Error('no script load should happen: globals provided'); } },
    createElement: (tag) => {
      const c = { width: 0, height: 0, getContext: () => ({}), _page: 0 };
      return c;
    },
  };
  // Wire page number onto the canvas via render call order: patch getPage to tag.
  const origGetPage = fakePdf.getPage.bind(fakePdf);
  let currentCanvas = null;
  fakePdf.getPage = async (n) => {
    const p = await origGetPage(n);
    return {
      ...p,
      render: (opts) => { currentCanvas._page = n; return { promise: Promise.resolve() }; },
    };
  };
  const realCreate = dom.createElement;
  dom.createElement = (tag) => { currentCanvas = realCreate(tag); return currentCanvas; };

  const { voOcrRescuePages } = build({ document: dom, pdfjsLib, Tesseract });
  const res = await voOcrRescuePages(new Uint8Array([1, 2, 3]), blocks, () => {});
  ok(!!res && /recovered text on-device/.test(res.note), 'rescue note reports the recovered page');
  ok(/3\b/.test(res.note) && res.textBlocks[2].indexOf('[OCR]') === 0, 'page 3 text was rescued into the blocks');
  ok(/no legible text/.test(res.note) && /\b4\b/.test(res.note), 'page 4 named as rendered-but-no-legible-text');
  ok(/could not be rendered/.test(res.note) && /\b5\b/.test(res.note), 'page 5 named as render-failed');
}

console.log(`\n[ocr-rescue] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[ocr-rescue] FAILURES'); process.exit(1); }
console.log('[ocr-rescue] ALL GREEN');
