// Tests for worker/verum-rules.js — the Cloudflare Worker API.
// Exercises routing, CORS, error handling and stack-trace safety against a
// mocked env (no live KV / AI bindings required).
//
// Run:  node tests/worker.test.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worker = (await import(path.join(__dirname, '..', 'worker', 'verum-rules.js'))).default;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };

const env = { RULES_KV: { get: async () => null, list: async () => ({ keys: [] }) }, AI: {}, ENVIRONMENT: 'test', SERVICE_VERSION: 'test' };
const mk = (p, method = 'GET', body) =>
  new Request('https://verumglobal.foundation' + p, { method, body, headers: body ? { 'content-type': 'application/json' } : {} });

let r = await worker.fetch(mk('/api/v1/status', 'OPTIONS'), env, {});
ok(r.status === 204, 'OPTIONS preflight returns 204');
ok(r.headers.get('access-control-allow-origin') !== null, 'OPTIONS response carries CORS header');

r = await worker.fetch(mk('/api/v1/nope'), env, {});
ok(r.status === 404, 'unknown API path returns 404');
const j = await r.json().catch(() => null);
ok(j && j.error === 'not_found', '404 body has error=not_found');

// A non-API path must be served as the website, NOT answered with a JSON 404.
// This Worker gets deployed by CI onto a Worker owning the site's routes, so
// 404ing `/` here takes the entire site down -- it did, on 2026-07-25.
// Since 2026-09-06 the site is served in tiers: bundled assets (env.ASSETS),
// then the main branch on raw.githubusercontent.com, then the legacy Pages
// origin. Every answer names its tier in X-VO-Site-Source.
{
  const realFetch = globalThis.fetch;
  const seen = [];
  const byHost = { raw: null, pages: null };
  globalThis.fetch = async (req) => {
    const u = typeof req === 'string' ? req : req.url;
    seen.push(u);
    const h = /raw\.githubusercontent\.com/.test(u) ? byHost.raw : byHost.pages;
    return h ? h(u) : new Response('not found', { status: 404 });
  };
  try {
    byHost.raw = () => new Response('<!DOCTYPE html><title>site</title>', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    r = await worker.fetch(mk('/'), env, {});
    ok(r.status === 200, 'site root is served, not 404 (' + r.status + ')');
    ok((r.headers.get('content-type') || '').includes('text/html'), 'site root returns HTML (typed by extension, not the raw host\'s text/plain)');
    ok(seen.some(u => u === 'https://raw.githubusercontent.com/Liamhigh/webdocsol/main/index.html'), 'site root is served from the main branch');
    ok(!seen.some(u => u.includes('verumglobal.pages.dev')), 'the Pages origin is not consulted when the repo answers');
    ok(r.headers.get('x-vo-site-source') === 'repo', 'the answer names its tier (repo)');

    seen.length = 0;
    r = await worker.fetch(mk('/dashboard'), env, {});
    ok(seen.some(u => u.endsWith('/main/dashboard.html')), 'extensionless page maps to its .html file');

    // repo miss -> the legacy Pages origin still answers
    byHost.raw = () => new Response('404: Not Found', { status: 404 });
    byHost.pages = () => new Response('<!DOCTYPE html><title>site</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    seen.length = 0;
    r = await worker.fetch(mk('/'), env, {});
    ok(r.status === 200 && seen.some(u => u.includes('verumglobal.pages.dev')) && r.headers.get('x-vo-site-source') === 'pages',
      'when the repo has no such file the Pages origin answers (' + r.headers.get('x-vo-site-source') + ')');

    // bundled assets answer first, with no network at all
    seen.length = 0;
    const envA = { ...env, ASSETS: { fetch: async () => new Response('<!DOCTYPE html><title>bundled</title>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }) } };
    r = await worker.fetch(mk('/seal-document.html'), envA, {});
    ok(r.status === 200 && seen.length === 0 && r.headers.get('x-vo-site-source') === 'assets', 'bundled assets answer before any origin is asked');
    const envA404 = { ...env, ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } };
    byHost.raw = () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain' } });
    r = await worker.fetch(mk('/verify.html'), envA404, {});
    ok(r.headers.get('x-vo-site-source') === 'repo', 'an assets miss falls through to the repo');

    // source, config, docs and fixtures are never site files, on any tier
    for (const p of ['/wrangler.toml', '/worker/verum-rules.js', '/tests/worker.test.mjs', '/.assetsignore', '/AGENTS.md', '/seal-module/SPEC.md', '/seal-module/web/seal-document.html', '/brand/banner_dark.png', '/greensky-ocr-verify.pdf', '/package.json']) {
      seen.length = 0;
      r = await worker.fetch(mk(p), envA, {});
      ok(r.status === 404 && seen.length === 0, 'never served: ' + p + ' (' + r.status + ')');
    }
  } finally {
    globalThis.fetch = realFetch;
  }
}

r = await worker.fetch(mk('/api/v1/ai/classify', 'GET'), env, {});
ok(r.status === 405, 'GET on a POST-only endpoint returns 405');

r = await worker.fetch(mk('/api/v1/status'), env, {});
ok(r.status === 200 || r.status === 503, 'status endpoint responds (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/ai/classify', 'POST'), env, {});
ok(r.status >= 200 && r.status < 600, 'classify with empty body responds gracefully (' + r.status + ')');

r = await worker.fetch(mk('/api/v1/status'), {}, {});
const body = await r.text();
ok(!/at \/|\.js:\d+/.test(body), 'error responses do not leak stack traces');

// Assets must be cacheable. The proxy previously appended a cache-buster and
// no-store to EVERY response, so the 525 KB pdf-lib bundle was re-fetched from
// origin on every page view and uncached anywhere. A dropped request then left
// window.PDFLib undefined and killed the sealing pipeline.
{
  const realFetch = globalThis.fetch;
  const seen = [];
  const byHost = { raw: null, pages: null };
  globalThis.fetch = async (req) => {
    const u = typeof req === 'string' ? req : req.url;
    seen.push(u);
    const h = /raw\.githubusercontent\.com/.test(u) ? byHost.raw : byHost.pages;
    return h ? h(u) : new Response('not found', { status: 404 });
  };
  try {
    byHost.raw = () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    let r = await worker.fetch(mk('/vendor/pdf-lib.min.js'), env, {});
    const cc = r.headers.get('cache-control') || '';
    ok(!/no-store/.test(cc) && /max-age=300/.test(cc), 'asset response is cacheable (' + cc + ')');
    ok((r.headers.get('content-type') || '').includes('javascript'), 'a script from the repo is typed as JavaScript');
    ok(!seen.some(u => u.includes('_cb=')), 'asset request carries no cache-buster');

    // A failed asset must never be cached. Caching every status code for an
    // hour pinned a transient 404 at the edge, so forensic-engine-page.js came
    // back missing and the page reported "runForensicEngine is not defined".
    byHost.raw = () => new Response('nf', { status: 404 });
    byHost.pages = () => new Response('not found', { status: 404 });
    r = await worker.fetch(mk('/forensic-engine-page.js'), env, {});
    ok(r.status === 404 && /no-store/.test(r.headers.get('cache-control') || ''),
      'failed asset is not cached (' + (r.headers.get('cache-control') || '') + ')');

    // HTML is never cached by the browser, whichever tier answers
    byHost.raw = () => new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    r = await worker.fetch(mk('/seal-document'), env, {});
    ok(/no-store/.test(r.headers.get('cache-control') || ''), 'HTML from the repo stays uncached');
    byHost.raw = () => new Response('nf', { status: 404 });
    byHost.pages = () => new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/html' } });
    seen.length = 0;
    r = await worker.fetch(mk('/seal-document'), env, {});
    ok(/no-store/.test(r.headers.get('cache-control') || ''), 'HTML from Pages stays uncached');
    ok(seen.some(u => u.includes('verumglobal.pages.dev') && u.includes('_cb=')), 'the Pages tier still cache-busts HTML');

    // HTML-as-asset guard on the Pages tier. During a Pages redeploy the origin
    // briefly answered /vendor/tesseract.min.js with the home page as a 200 --
    // which the edge then cached for an hour. The OCR loader's global check
    // failed and 32 image-only pages of the Greensky bundle went unread. A .js
    // asset that comes back text/html must be retried cache-busted, and if
    // still HTML, answered 503 no-store -- never served as if it were the script.
    let calls = 0;
    byHost.pages = (u) => {
      calls++;
      if (calls === 1) return new Response('<!DOCTYPE html><title>home</title>', { status: 200, headers: { 'content-type': 'text/html' } });
      ok(u.includes('_vb='), 'HTML-as-asset retry is cache-busted');
      return new Response('var Tesseract={};', { status: 200, headers: { 'content-type': 'application/javascript' } });
    };
    r = await worker.fetch(mk('/vendor/tesseract.min.js'), env, {});
    ok(calls === 2 && (r.headers.get('content-type') || '').includes('javascript'),
      'asset served as JS after one cache-busted retry (calls=' + calls + ')');

    byHost.pages = () => new Response('<!DOCTYPE html><title>home</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    r = await worker.fetch(mk('/vendor/tesseract.min.js'), env, {});
    ok(r.status === 503 && /no-store/.test(r.headers.get('cache-control') || ''),
      'persistent HTML-for-asset answers 503 no-store, never HTML-as-JS (' + r.status + ')');

    // The repo tier applies the same guard: an HTML interstitial for a .js
    // path is a miss, never a script.
    byHost.raw = () => new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/html' } });
    r = await worker.fetch(mk('/vendor/tesseract.min.js'), env, {});
    ok(r.status === 503, 'an HTML answer from the raw host for a script is a miss, not a script (' + r.status + ')');

    // An HTML page returning text/html is of course NOT the guard's business.
    byHost.raw = () => new Response('nf', { status: 404 });
    byHost.pages = () => new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/html' } });
    r = await worker.fetch(mk('/seal-document'), env, {});
    ok(r.status === 200, 'HTML pages still serve HTML normally');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- narrate contract: the client/worker field names must agree, and the
// documented {summary, findings, ...} reply shape must flow through untouched.
// A mismatch here (findings vs findingsKept) silently 400'd every narrate call,
// which is why reports showed no AI narrative.
{
  // Correct client payload shape -> accepted (200). Uses the template because
  // env.AI here has no run(), so callAi throws and the deterministic template
  // answers -- but the request itself must validate.
  const good = {
    documentName: 'demo.pdf', pageCount: 3, score: 62, confidence: 'HIGH',
    findingsPruned: 0, generatedUtc: '2026-07-26T00:00:00Z',
    documentExcerpt: 'On 3 March 2026 Acme Ltd transferred R2,000,000 to a shell account.',
    findingsKept: [{ id: 'F1', type: 'CT02', severity: 4, severityOrdinal: 'HIGH', status: 'ENGINE-VERIFIED', location: 'Page 2', evidence: 'signature mismatch' }],
    caseContext: { caseName: 'Acme v Shell', caseRefs: 'CAS 1/2/2026', parties: 'Acme Ltd vs Shell Co', jurisdiction: 'South Africa' }
  };
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST', JSON.stringify(good)), env, {});
  ok(r.status === 200, 'narrate accepts the documented payload shape (' + r.status + ')');
  const nb = await r.json().catch(() => null);
  ok(nb && nb.ok === true, 'narrate returns ok:true');

  // The OLD client payload {findings, score, verdict} is the wrong shape and
  // must be rejected -- documents the contract the client now satisfies.
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST',
    JSON.stringify({ findings: [{ type: 'CT02' }], score: 50, verdict: 'HIGH' })), env, {});
  ok(r.status === 400, 'narrate rejects the legacy {findings} shape (' + r.status + ')');

  // The documented {summary, findings, ...} reply passes through as format:plain,
  // and the model MUST receive the Constitution + the sealed case file text.
  let capturedUser = '', capturedSystem = '';
  const AIenv = { ...env, AI: { run: async (_model, opts) => {
    capturedUser = (opts.messages.find(m => m.role === 'user') || {}).content || '';
    capturedSystem = (opts.messages.find(m => m.role === 'system') || {}).content || '';
    return { response: JSON.stringify({
      summary: 'Acme Ltd moved R2m to a shell account. Constitutional confidence: HIGH.',
      findings: 'The document shows a transfer flagged as a signature mismatch [F1].',
      contradictions: '', impact: '', legalContext: '', evidence: '', seal: '', limits: ''
    }) };
  } } };
  r = await worker.fetch(mk('/api/v1/ai/narrate', 'POST', JSON.stringify(good)), AIenv, {});
  const pb = await r.json().catch(() => null);
  ok(pb && pb.format === 'plain', 'documented reply shape flows through as format:plain');
  ok(pb && /Acme Ltd/.test(pb.summary || ''), 'narrate passes the model summary through');
  ok(pb && /verdict on any named person is for the court/.test(pb.limits || ''), 'narrate appends the PD16 closing disclaimer to limits');
  ok(/CONSTITUTION/.test(capturedUser) && /Truth over probability/.test(capturedUser),
    'the Constitution is loaded into the narrator context');
  // Constitution v8.0 s12 opens: "Every entry below is stated so that it
  // survives being checked against the primary record. Judicial endorsement is
  // not." The engagement record is the single easiest thing on this platform to
  // overstate, and overstating it is the one claim an opponent can disprove in
  // a sentence. Filing is not validation; not being challenged on admissibility
  // is not a finding on the merits. These asserts are the lock: without them
  // the honesty clause is one careless edit from disappearing.
  {
    const cons = fs.readFileSync(path.join(__dirname, '..', 'worker', 'verum-rules.js'), 'utf8');
    ok(/NO court has validated Verum Omnis/.test(cons),
      's12: the constitution states plainly that no court has validated Verum Omnis');
    ok(/never describe any court as having adopted, endorsed, validated or ruled on the merits/.test(cons),
      's12: the model is told never to claim judicial adoption or endorsement');
    ok(/acknowledgment of receipt only, NOT a ruling on the merits/i.test(cons),
      's12: the Constitutional Court filing is described as receipt, not validation');
    ok(/not excluded or challenged on admissibility/.test(cons) &&
       /the Court made NO finding on Verum Omnis/.test(cons),
      's12: Port Shepstone is stated as non-exclusion, not as a finding for Verum Omnis');
    // NB: read from raw source, so the apostrophe is backslash-escaped there.
    ok(/RESPONDENT\\?'S OWN affidavit, not a finding by the Court/.test(cons),
      's12: the "good faith" phrase is attributed to the affidavit, not the judgment');
    ok(/no tribunal has found them met/.test(cons),
      's12: the standards report is not described as a tribunal finding');
    ok(!/High Court/i.test(cons),
      's12: no High Court is claimed — the courts of record are the ConCourt and Port Shepstone Magistrate\'s Court');
  }
  ok(/Acme Ltd transferred R2,000,000/.test(capturedUser),
    'the sealed case file text reaches the narrator');
  // 1verum GHRP alignment: the per-finding verification tier + ordinal severity
  // and the user's case context must all reach the model, and the system prompt
  // must carry the two-tier rule so candidates are never presented as verified.
  ok(/ENGINE-VERIFIED/.test(capturedUser) && /"severityOrdinal":"HIGH"/.test(capturedUser),
    'finding tier and ordinal severity reach the narrator');
  ok(/Acme v Shell/.test(capturedUser) && /CAS 1\/2\/2026/.test(capturedUser),
    'the user\'s case context reaches the narrator');
  ok(/TWO-TIER RULE/.test(capturedSystem) && /CONTRADICTION SHAPE/.test(capturedSystem),
    'the system prompt carries the two-tier rule and the contradiction shape');
  ok(/FORMAT: short paragraphs/.test(capturedSystem) && /separated by a BLANK line/.test(capturedSystem)
    && /Never one unbroken block/.test(capturedSystem),
    'the narrator prompt demands structured paragraphs and bullets, never one block');
  ok(/SYNTHESIS: you are a narrative synthesizer, not a form-filler/.test(capturedSystem)
    && /never repeat a sentence template/.test(capturedSystem)
    && /Connect findings that share a pattern into one theme/.test(capturedSystem),
    'the narrator is a synthesizer: themes, varied language, no template repetition');
  ok(/WHY IT MATTERS/.test(capturedSystem)
    && /Never speculate about intent, motive, or anyone's credibility/.test(capturedSystem),
    'the narrator explains consequence as fact and never judges intent or credibility');
  ok(/DECLARATIVE FINDINGS RULE/.test(capturedSystem) && /hallmarks of fraud/.test(capturedSystem),
    'the system prompt makes anchored facts declarative (forensic-instrument voice)');
  ok(/constitutional forensic investigator/.test(capturedSystem)
    && /AI-raised candidate - pending engine verification/.test(capturedSystem)
    && /Never print CT\/SP codes unexplained/.test(capturedSystem),
    'narrator is an investigator: translates codes, raises missed contradictions as labelled candidates');
  ok(/EVENT-LEVEL DETERMINATION/.test(capturedSystem) && /the documents evidence fraud/.test(capturedSystem)
    && /Person-level guilt is never declared/.test(capturedSystem),
    'the system prompt certifies corroborated events (pathologist standard) but never person-level guilt');
  ok(capturedUser.indexOf('SEALED CASE FILE') >= 0,
    'the case file is clearly labelled for the narrator');

  // PD16 language lock (the "constitutional certainty" order). The AI layer
  // works on SEALED evidence — quoted text bound to a page in a record that
  // cannot be altered — so it reports measurements, it does not hedge them.
  // These assertions exist so a future edit cannot quietly reintroduce
  // probabilistic language into the narrator's instructions.
  ok(/WHY YOU STATE FACTS/.test(capturedSystem) && /sealed under SHA-512/.test(capturedSystem)
    && /measurement to be reported/.test(capturedSystem),
    'the narrator is told WHY it states facts: the evidence is sealed and page-anchored');
  ok(/BANNED for anchored facts/.test(capturedSystem)
    && /appears, might, possibly, seems, could, potentially/.test(capturedSystem),
    'the narrator prompt bans hedging verbs for anchored facts');
  ok(/Never an "indicator", "red flag", "concern" or "anomaly"/.test(capturedSystem),
    'an established finding is called a finding, never an "indicator"');
  ok(/No scores, no percentages, no confidence bands, ever/.test(capturedSystem),
    'the narrator prompt forbids scores, percentages and confidence bands');
  ok(!/Confidence is ordinal only\. Never percentages\./.test(capturedSystem),
    'the superseded "confidence is ordinal only" instruction is gone');
  // The embedded constitution the model reads must carry the same rule.
  ok(/No scores, no percentages, no confidence bands/.test(capturedUser)
    && /stated as fact or it is not stated at all/.test(capturedUser),
    'the constitution loaded into the model states PD1 in its v8.0 form (no bands)');
  ok(/internal weighting only/.test(capturedUser) && /never shown to a reader/.test(capturedUser),
    'severity weights are marked internal-only in the constitution the model reads');
  ok(!/Report the ordinal confidence band/.test(capturedUser),
    'the constitution no longer instructs the model to report a confidence band');
}

// --- /api/v1/ai/transcribe: OPT-IN voice-note transcription (Whisper).
// The wire contract is the evidence rule: machineGenerated:true on every
// success, a disclaimer naming the sealed audio as the evidence, and every
// failure a clean JSON error that tells the user the sealed audio is
// unaffected. The audio is transcribed and discarded — nothing is stored.
{
  const tPost = (body, e) => worker.fetch(
    mk('/api/v1/ai/transcribe', 'POST', typeof body === 'string' ? body : JSON.stringify(body)), e || env, {});

  r = await worker.fetch(mk('/api/v1/ai/transcribe', 'GET'), env, {});
  ok(r.status === 405, 'transcribe is POST-only (' + r.status + ')');

  r = await tPost('not json');
  let tj = await r.json().catch(() => null);
  ok(r.status === 400 && tj && tj.error === 'invalid_json', 'invalid JSON body is a clean 400');

  r = await tPost({ name: 'x.opus' });
  tj = await r.json().catch(() => null);
  ok(r.status === 400 && tj && tj.error === 'invalid_shape', 'a body without audio is a clean 400');

  // env.AI has no run() here — the endpoint must degrade to a clean 503, and
  // the message must carry the reassurance the client passes to the report.
  r = await tPost({ audio: Buffer.from('x').toString('base64'), name: 'x.opus' });
  tj = await r.json().catch(() => null);
  ok(r.status === 503 && tj && tj.error === 'transcription_unavailable',
    'missing AI binding degrades to 503 transcription_unavailable (' + r.status + ')');
  ok(tj && /sealed audio is unaffected/.test(tj.message || ''),
    'the 503 tells the user the sealed audio is unaffected');

  const aiEnv = (run) => ({ ...env, AI: { run } });

  r = await tPost({ audio: '!!!not-base64!!!', name: 'x.opus' }, aiEnv(async () => ({ text: 'hi' })));
  tj = await r.json().catch(() => null);
  ok(r.status === 400 && tj && tj.error === 'invalid_base64', 'malformed base64 is a clean 400');

  // Success path: the model gets the DECODED bytes; the response carries the
  // machine-provenance contract so no surface can present it as a human record.
  let gotModel = '', gotAudio = null;
  const audioBytes = [86, 79, 33, 7, 200];
  r = await tPost(
    { audio: Buffer.from(audioBytes).toString('base64'), name: 'PTT-20250406-WA0012.opus' },
    aiEnv(async (model, opts) => { gotModel = model; gotAudio = opts.audio; return { text: '  I paid the rent on Friday.  ', word_count: 6 }; }));
  tj = await r.json().catch(() => null);
  ok(r.status === 200 && tj && tj.ok === true, 'a valid recording transcribes (' + r.status + ')');
  ok(gotModel === '@cf/openai/whisper', 'the Whisper model is invoked');
  ok(Array.isArray(gotAudio) && gotAudio.join(',') === audioBytes.join(','),
    'the model receives the exact decoded audio bytes');
  ok(tj && tj.machineGenerated === true && tj.model === '@cf/openai/whisper',
    'machineGenerated:true and the model name are part of the wire contract');
  ok(tj && tj.text === 'I paid the rent on Friday.' && tj.wordCount === 6,
    'text is trimmed and word count passed through');
  ok(tj && /reading aid, not evidence/.test(tj.disclaimer || '')
    && /verify every quoted word against the sealed audio/.test(tj.disclaimer || ''),
    'every success carries the reading-aid disclaimer naming the sealed audio as the evidence');
  ok(tj && tj.name === 'PTT-20250406-WA0012.opus', 'the file name is echoed for client-side pairing');

  // A very long name is truncated, a very long transcript is capped.
  r = await tPost(
    { audio: Buffer.from('x').toString('base64'), name: 'n'.repeat(500) },
    aiEnv(async () => ({ text: 'w '.repeat(30000) })));
  tj = await r.json().catch(() => null);
  ok(tj && tj.name.length === 120 && tj.text.length === 20000, 'name is capped at 120 chars, text at 20000');

  // Model failures are clean 502s with no stack trace and the reassurance line.
  r = await tPost({ audio: Buffer.from('x').toString('base64') },
    aiEnv(async () => { throw new Error('boom at /internal/whisper.js:42'); }));
  const raw = await r.text();
  tj = JSON.parse(raw);
  ok(r.status === 502 && tj.error === 'transcription_failed', 'a model crash is a clean 502');
  ok(!/whisper\.js:42|boom/.test(raw), 'the 502 leaks no stack trace or internal message');
  ok(/sealed audio is unaffected/.test(tj.message || ''), 'the 502 tells the user the sealed audio is unaffected');

  r = await tPost({ audio: Buffer.from('x').toString('base64') }, aiEnv(async () => ({ text: '   ' })));
  tj = await r.json().catch(() => null);
  ok(r.status === 502 && tj && tj.error === 'empty_transcript', 'an empty model reply is a clean 502, never ok:true');

  // Client-side lock: transcription is OPT-IN, runs after sealing, and the
  // consent copy must say the audio leaves the device — the one honest
  // difference from every other sealing operation.
  const page2 = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
  // Two modes, no switches (2026-09-07): transcription follows the sealing mode.
  ok(!/id="voTranscribeOptIn"/.test(page2), 'no transcription tick box exists');
  ok(/the audio leaves this device for that step/.test(page2),
    'the consent copy states that the audio leaves the device');
  ok(/voice-note audio leave this device to Cloudflare Workers AI/.test(page2) || /voice-note audio for transcription/.test(page2),
    'the mode card and the disclosure name voice-note audio among what leaves the device');
  ok(/var tcOn = \(typeof sealMode !== 'undefined' && sealMode === 'forensic'\);\s*if \(tcOn\) \{/.test(page2), 'the transcription pass is gated on the forensic mode');
}

// --- feedback loop: the opt-in "Help improve the forensic engine" checkbox.
// End-to-end contract between shareAnonymousPatterns (seal-document.html) and
// handleFeedback (worker). The page promises users "no document content,
// names, or quotes ever leave this device" — these tests hold both sides to it.
{
  const puts = [];
  const kvEnv = { ...env, RULES_KV: {
    get: async () => null,
    list: async () => ({ keys: [] }),
    put: async (key, value, opts) => { puts.push({ key, value, opts }); }
  } };
  const post = (payload) => worker.fetch(
    mk('/api/v1/feedback/patterns', 'POST', JSON.stringify(payload)), kvEnv, {});

  // 1. The exact shape the page sends for engine findings -> stored.
  r = await post({ patterns: [
    { detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 187 },
    { detectorId: 'SERIAL', type: 'SP01', severity: 3, pageCount: 187 },
    { detectorId: 'AI_IDENTIFIED', type: 'UNDISCLOSED_RELATED_PARTY', severity: 2, pageCount: 187 }
  ] });
  let fb = await r.json().catch(() => null);
  ok(r.status === 200 && fb && fb.ok === true && fb.stored === 3,
    'feedback accepts the exact client payload shape (' + r.status + ')');
  ok(puts.length === 1 && /^feedback:\d{4}-\d{2}-\d{2}$/.test(puts[0].key),
    'feedback is stored in a day bucket (' + (puts[0] && puts[0].key) + ')');
  ok(puts[0] && puts[0].opts && puts[0].opts.expirationTtl === 90 * 24 * 60 * 60,
    'feedback auto-deletes after 90 days');
  {
    const rec = JSON.parse(puts[0].value)[0];
    const storedKeys = Object.keys(rec.patterns[0]).sort().join(',');
    ok(storedKeys === 'detectorId,pageCount,severity,type',
      'ONLY the four anonymous fields are stored (' + storedKeys + ')');
  }

  // 2. The clean-scan marker the page sends when nothing was found -> stored.
  puts.length = 0;
  r = await post({ patterns: [{ detectorId: 'CLEAN_SCAN', type: 'CLEAN_SCAN', severity: 1, pageCount: 12 }] });
  fb = await r.json().catch(() => null);
  ok(r.status === 200 && fb && fb.stored === 1, 'clean-scan marker is accepted');

  // 3. Privacy guardrail: any content-bearing field is rejected AND not stored.
  puts.length = 0;
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1, quote: 'Mr X admitted the debt' }] });
  fb = await r.json().catch(() => null);
  ok(r.status === 422 && fb && fb.error === 'privacy_violation',
    'a quote field is refused as a privacy violation (' + r.status + ')');
  ok(puts.length === 0, 'nothing is stored when the guardrail fires');
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1, name: 'K. Lappeman' }] });
  ok(r.status === 422, 'a name field is refused as a privacy violation');

  // 4. Shape violations: unknown fields, bad severity, empty/oversized arrays.
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 4, pageCount: 1 }], sessionId: 'abc' });
  ok(r.status === 400, 'unknown top-level field is rejected');
  r = await post({ patterns: [{ detectorId: 'CT02', type: 'CT02', severity: 9, pageCount: 1 }] });
  ok(r.status === 400, 'severity outside 1-5 is rejected');
  r = await post({ patterns: [] });
  ok(r.status === 400, 'empty patterns array is rejected');
  r = await post({ patterns: Array.from({ length: 201 }, () => ({ detectorId: 'CT02', type: 'CT02', severity: 1, pageCount: 1 })) });
  ok(r.status === 400, 'more than 200 patterns is rejected');

  // 5. Client-side lock: the page's sender must keep its privacy promise.
  const fs = await import('node:fs');
  const page = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
  const fnStart = page.indexOf('function shareAnonymousPatterns');
  const fnEnd = page.indexOf('\n}', fnStart);
  const fn = page.slice(fnStart, fnEnd);
  ok(fnStart > 0, 'shareAnonymousPatterns exists in the page');
  ok(/if \(sealMode !== 'forensic'\) return;/.test(fn) && !/optIn\.checked/.test(fn), 'sender runs only in "Seal document with forensic report" (automatic there, never in Seal document)');
  ok(/fraudResult\.scanFailed/.test(fn), 'a failed scan is never fed back as a result');
  ok(/\/api\/v1\/feedback\/patterns/.test(fn), 'sender posts to the feedback endpoint');
  ok(/\{\s*detectorId:\s*detectorId,\s*type:\s*type,\s*severity:\s*sev,\s*pageCount:\s*pageCount\s*\}/.test(fn)
    && !/evidence|quote|location|filename|sha\d|caseDetails/.test(fn.replace(/\/\/[^\n]*/g, '')),
    'sender builds ONLY the four anonymous fields — no content, names, or quotes');
  // Reversed on 2026-09-07 (ENGINE.md §12.7): the loop's most useful signal is
  // "the engine missed a CT01 here". An AI candidate typed with an engine code
  // now travels as detectorId AI_IDENTIFIED (or AI_IDENTIFIED_UNANCHORED),
  // distinguishable from an engine finding by its detectorId, never by its
  // type; the old CT01-CT46 exclusion threw that signal away. Only SERIAL
  // stays excluded (a serial label is the engine's own pattern name).
  ok(fn.indexOf('/^CT(0[1-9]|[1-3][0-9]|4[0-6])$/') === -1 && /aType === 'SERIAL'\) continue;/.test(fn) &&
    /af\.anchored \? 'AI_IDENTIFIED' : 'AI_IDENTIFIED_UNANCHORED'/.test(fn),
    'CT-typed AI candidates reach the loop as AI_IDENTIFIED; only SERIAL is excluded');
}

// --- /api/v1/ai/human-report: the court-ready narrative, one section per call.
// The gate is the guarantee: sentences that cite findings, pages or quotes not
// in the inputs are dropped, §15.2 language is dropped, and a section that
// loses the gate is reported generated:false — never a template dressed as AI.
{
  const hPost = (body, e) => worker.fetch(mk('/api/v1/ai/human-report', 'POST', typeof body === 'string' ? body : JSON.stringify(body)), e || env, {});
  r = await worker.fetch(mk('/api/v1/ai/human-report', 'GET'), env, {});
  ok(r.status === 405, 'human-report is POST-only (' + r.status + ')');
  r = await hPost('nope'); let hj = await r.json().catch(() => null);
  ok(r.status === 400 && hj && hj.error === 'invalid_json', 'human-report: invalid JSON body is a clean 400');
  r = await hPost({ section: 'evidence_index', findings: [] }); hj = await r.json().catch(() => null);
  ok(r.status === 400 && hj && hj.error === 'invalid_section', 'an engine-rendered section is not a writer section');
  const hFindings = [
    { id: 'F1', type: 'CT02', name: 'Date inconsistency', severity: 4, location: 'Page 2 vs Page 5', page: 2, pages: [2, 5], evidence: 'dated 3 March 2026 — yet dated 9 March 2026', quote: 'dated 3 March 2026', who: ['Acme Ltd'], sworn: false },
    { id: 'F2', type: 'CT03', name: 'Signature missing', severity: 5, location: 'Page 7', page: 7, pages: [7], evidence: 'signature block left blank on the counterpart', quote: 'signature block left blank', who: [], law: [], sworn: true }
  ];
  const hGood = { section: 'executive_summary', documentName: 'demo.pdf', pageCount: 9, findings: hFindings,
    candidates: [{ id: 'C1', type: 'CT09', name: 'Candidate', severity: 3, page: 3, pages: [3], evidence: 'an AI-raised item' }],
    excerpt: '[Page 2] The agreement is dated 3 March 2026.\n[Page 5] The same agreement is dated 9 March 2026.',
    caseContext: { caseName: 'Acme v Shell', jurisdiction: 'South Africa' }, gps: '-33.9,18.4', device: 'phone' };
  // env.AI has no run() -> honest generated:false, never a template.
  r = await hPost(hGood); hj = await r.json().catch(() => null);
  ok(r.status === 200 && hj && hj.ok === true && hj.generated === false && hj.machineGenerated === false && hj.reason === 'ai_unavailable',
    'no AI binding -> generated:false ai_unavailable (' + (hj && hj.reason) + ')');
  ok(hj && hj.contract === 'human-v1' && hj.section === 'executive_summary', 'the reply names the contract and the section');
  r = await hPost({ section: 'executive_summary', findings: [] }); hj = await r.json().catch(() => null);
  ok(hj && hj.generated === false && hj.reason === 'no_findings', 'no findings -> no_findings, no model call');
  // A draft flows through the gate: compliant, anchored sentences survive; the rest are dropped and counted.
  let capUser = '', capSystem = '', capOpts = null;
  const hDraft = 'The counterpart carries no signature on the page where one is required [F2] (p. 7). ' +
    'The agreement is dated twice: "dated 3 March 2026" and "dated 9 March 2026" [F1] (p. 2, p. 5). ' +
    'Acme Ltd is named on the cited pages [F1] (p. 2). ' +
    'The two dates cannot both be the date of one agreement [F1]. ' +
    'The record establishes both findings on the pages cited [F1] [F2]. ' +
    'The verdict on any named person is for the court. ' +
    'This might suggest carelessness [F1]. ' +
    'The court accepted the report as evidence [F2] (p. 7). ' +
    'A witness stated "the funds were routed through an offshore vehicle" [F9] (p. 12). ' +
    'The record states "the counterpart was never countersigned by the seller" (p. 7). ' +
    'Confidence: HIGH (85%).';
  const AIenvH = { ...env, AI: { run: async (model, opts) => {
    capOpts = opts;
    capUser = (opts.messages.find(m => m.role === 'user') || {}).content || '';
    capSystem = (opts.messages.find(m => m.role === 'system') || {}).content || '';
    return { response: JSON.stringify({ text: hDraft }) };
  } } };
  r = await hPost(hGood, AIenvH); hj = await r.json().catch(() => null);
  ok(hj && hj.generated === true && hj.machineGenerated === true && hj.model === '@cf/meta/llama-4-scout-17b-16e-instruct',
    'a compliant draft is generated:true on the default keyless model (' + (hj && hj.model) + ')');
  ok(hj && /no signature on the page/.test(hj.text) && /dated twice/.test(hj.text), 'anchored, compliant sentences survive');
  ok(hj && !/might suggest/.test(hj.text), 'a hedged sentence is dropped (§15.2)');
  ok(hj && !/court accepted/.test(hj.text), 'an overstated court-history sentence is dropped');
  ok(hj && !/\[F9\]/.test(hj.text), 'a sentence citing a finding not in the inputs is dropped (PD2)');
  ok(hj && !/never countersigned/.test(hj.text), 'a quotation not present in the inputs is dropped (PD2)');
  ok(hj && !/85%/.test(hj.text), 'a score/percentage sentence is dropped (PD1)');
  ok(hj && hj.gate && hj.gate.kept === 6 && hj.gate.dropped === 5, 'the gate counts kept and dropped honestly (' + JSON.stringify(hj && hj.gate) + ')');
  ok(hj && /verdict on any named person is for the court/.test(hj.text), 'the executive summary closes with the verdict reservation');
  ok(capOpts && capOpts.temperature === 0, 'the narrator runs at temperature 0 (PD4)');
  ok(/CONSTITUTION/.test(capUser) && /Truth over probability/.test(capUser), 'the Constitution precedes every section');
  ok(/Section: EXECUTIVE SUMMARY/.test(capUser), 'the section rules reach the model');
  ok(!/18\.4|phone/.test(capUser) && !/gps|device/i.test(JSON.stringify(hj)), 'GPS and device data never reach the narrator or the reply');
  ok(/never say a court adopted/i.test(capSystem) && /No scores, no percentages/.test(capSystem), 'the system prompt carries the honesty rules');
  ok(/You originate nothing/.test(capSystem), 'the writer is told it originates nothing');
  // A majority-prohibited draft loses the gate -> generated:false, no prose leaks.
  const badEnv = { ...env, AI: { run: async () => ({ response: JSON.stringify({ text: 'This may be fraud [F1] (p. 2). It seems likely [F2] (p. 7). Confidence 90%.' }) }) } };
  r = await hPost(hGood, badEnv); hj = await r.json().catch(() => null);
  ok(hj && hj.generated === false && hj.reason === 'gate_failed' && !hj.text, 'a draft that fails the gate is generated:false with no text');
  // plainTerms: one gated sentence per finding id; unknown or hedged ones vanish.
  const ceEnv = { ...env, AI: { run: async () => ({ response: JSON.stringify({ text: 'The counterpart is unsigned [F2] (p. 7). The dates differ [F1] (p. 2).', plainTerms: { F1: 'The same agreement carries two different dates. Second sentence ignored.', F2: 'It might be unsigned.', F7: 'nope' } }) }) } };
  r = await hPost({ ...hGood, section: 'critical_evidence' }, ceEnv); hj = await r.json().catch(() => null);
  ok(hj && hj.generated === true && hj.plainTerms && hj.plainTerms.F1 === 'The same agreement carries two different dates.' && !hj.plainTerms.F2 && !hj.plainTerms.F7,
    'plainTerms keeps one compliant sentence per known finding and drops hedged or unknown ones');
  // External OpenAI-compatible provider: used when the three secrets exist.
  const realFetchH = globalThis.fetch;
  let extReq = null;
  globalThis.fetch = async (url, init) => { extReq = { url: String(url), init }; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: hDraft }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const extEnv = { ...env, LLM_API_BASE: 'https://llm.example.test/v1/', LLM_API_KEY: 'sk-test', LLM_MODEL: 'narrator-1' };
    r = await hPost(hGood, extEnv); hj = await r.json().catch(() => null);
    ok(extReq && extReq.url === 'https://llm.example.test/v1/chat/completions', 'the external provider is called at its chat-completions endpoint');
    ok(extReq && /Bearer sk-test/.test((extReq.init.headers && (extReq.init.headers.authorization || extReq.init.headers.Authorization)) || ''), 'the external call carries the bearer secret');
    ok(hj && hj.generated === true && hj.model === 'external:narrator-1', 'the reply names the external model (' + (hj && hj.model) + ')');
    ok(!/sk-test/.test(JSON.stringify(hj)), 'the secret never appears in the reply');
  } finally { globalThis.fetch = realFetchH; }
}

// --- human-report gate hardening: the guarantees the adversarial review found
// missing. No anchor, no sentence (PD2); headings are gated; the prompt's
// BANNED list is enforced; every anchor spelling is checked; sanctioned
// one-line answers pass; the fallback model fits inside the client's wait.
{
  const hPost = (body, e) => worker.fetch(mk('/api/v1/ai/human-report', 'POST', JSON.stringify(body)), e || env, {});
  const gFindings = [
    { id: 'F1', type: 'CT02', name: 'Date inconsistency', severity: 4, page: 2, pages: [2, 5], evidence: 'dated 3 March 2026 — yet dated 9 March 2026', quote: 'dated 3 March 2026' },
    { id: 'F2', type: 'CT03', name: 'Signature missing', severity: 5, page: 7, pages: [7], evidence: 'signature block left blank on the counterpart', quote: 'signature block left blank', sworn: true }
  ];
  const gBase = { section: 'chronology', pageCount: 9, findings: gFindings,
    excerpt: '[Page 2] The agreement is dated 3 March 2026.\n[Page 5] The seller wrote: "the funds were routed through the trust account on 3 May 2026. Nothing else moved."' };
  const PAD = 'The record states the first finding [F1] (p. 2). The record states the second finding [F2] (p. 7). ';
  const mockAI = (text) => ({ ...env, AI: { run: async () => ({ response: JSON.stringify({ text }) }) } });
  const gate = async (text, body) => (await hPost(body || gBase, mockAI(text))).json();
  const kept = async (sentence, body) => { const j = await gate(PAD + sentence, body); return !!(j.text && j.text.indexOf(sentence.slice(0, 18)) >= 0); };
  // PD2: no anchor, no sentence
  ok(!(await kept('The respondent transferred R4,000,000 to a Panama account on 3 March 2026.')), 'an invented sentence with no anchor is dropped (PD2)');
  ok(await kept('The verdict on any named person is for the court.'), 'the verdict reservation needs no anchor');
  ok(await kept('Inducement: INSUFFICIENT on the record.'), 'a stated gap (INSUFFICIENT) needs no anchor (PD6)');
  ok(!(await kept('The seller had insufficient funds for the deposit.')), 'the lower-case adjective is not the gap token');
  ok(await kept('The seller wrote: "the funds were routed through the trust account on 3 May 2026. Nothing else moved."'), 'a verified quotation is an anchor, and its inner full stop does not split it');
  // headings
  let g = await gate('GUILTY OF FRAUD AND PERJURY\n\n' + PAD);
  ok(g.generated === true && !/GUILTY/.test(g.text) && g.gate.dropped === 1, 'a verdict in capitals is not a heading: dropped and counted');
  g = await gate('The respondent is guilty of fraud and perjury:\n\n' + PAD);
  ok(!/guilty/.test(g.text) && g.gate.dropped === 1, 'a colon heading carrying a verdict is dropped');
  g = await gate('RESPONDENT LIED UNDER OATH (SEE F9, P 99)\n\n' + PAD);
  ok(!/LIED/.test(g.text), 'a heading with invented anchors is dropped');
  g = await gate('PATTERN OF CONDUCT\r\n\r\n' + PAD);
  ok(/PATTERN OF CONDUCT/.test(g.text) && g.gate.dropped === 0, 'a clean heading passes (CRLF paragraphs too)');
  // the BANNED list, enforced
  for (const t of ['The respondent could have signed it [F2] (p. 7).', 'The seller would have known the date [F1] (p. 2).', 'It appears that the date was altered [F1] (p. 2).',
    'The dates are consistent with alteration [F1] (p. 2).', 'The blank block indicates non-execution [F2] (p. 7).', 'I believe the seller altered the date [F1] (p. 2).',
    'The seller defrauded the buyer [F1] (p. 2).', 'The seller is dishonest and acted fraudulently [F1] (p. 2).', 'The respondent is a perjurer, per candidate law [F2] (p. 7).',
    'The court found the report reliable [F2] (p. 7).', 'The report was accepted by the court [F2] (p. 7).', 'Fraud score 9/10 on this item [F1] (p. 2).',
    'This scores nine out of ten [F1] (p. 2).', 'The confidence is high for this item [F1] (p. 2).', 'This is a CRITICAL severity item [F1] (p. 2).',
    'A 90% certainty applies to this [F1] (p. 2).', 'The match is 90% [F1] (p. 2).', 'The seller may have signed the counterpart [F2] (p. 7).']) {
    ok(!(await kept(t)), 'banned language dropped: ' + t);
  }
  for (const t of ['The signature block appears on the counterpart [F2] (p. 7).', 'The finding named Fraudulent application is anchored [F1] (p. 2).',
    'The blank signature block may constitute non-execution [F2] (p. 7).', 'The letter is dated 2/10/2026 [F1] (p. 2).',
    'In May 2026 the seller signed the counterpart [F2] (p. 7).', 'On 3 May 2026 the seller signed the counterpart [F2] (p. 7).', 'On May 3, 2026 the seller signed the counterpart [F2] (p. 7).',
    'The office at Mayfair Street is named [F2] (p. 7).']) {
    ok(await kept(t), 'compliant language kept: ' + t);
  }
  // every anchor spelling is checked
  for (const t of ['The seller signed there [F2] (p 12).', 'The seller signed there [F2] (pg. 12).', 'The seller signed there [F2] (p12).', 'The seller signed there [F2] (p.99).',
    'The seller signed at page twelve [F2].', 'The dates run across pp. 2-5 [F1].', 'The routing is established (F9) (p. 2).', 'Finding F9 establishes the routing (p. 2).',
    'The seller signed there [F2] (p. 9999).']) {
    ok(!(await kept(t)), 'unverifiable anchor dropped: ' + t);
  }
  for (const t of ['The seller signed there [F2] (p.7).', 'The dates appear at pp. 2, 5 [F1].', 'The dates appear at pp. 2 and 5 [F1].',
    'The letter at p. 2, 3 March 2026, names the seller [F1].', 'The dates are established (F1) (p. 2).']) {
    ok(await kept(t), 'valid anchor kept: ' + t);
  }
  // every quotation form is checked
  for (const t of ['The seller wrote \u2018the money went to Panama on Monday\u2019 [F1] (p. 2).', "The seller wrote 'the money went to Panama on Monday' [F1] (p. 2).",
    'The deed is "void ab initio" [F1] (p. 2).', 'The seller wrote "the money went to Panama. Nothing else moved." [F1] (p. 2).']) {
    ok(!(await kept(t)), 'invented quotation dropped: ' + t);
  }
  ok(await kept("The seller's counterpart and the buyer's copy both carry the date [F1] (p. 2)."), 'apostrophes are not quotation marks');
  // sanctioned one-line answers are complete
  for (const t of ['None identified.', 'No account on record.', 'No oath language was found on the cited pages.', 'No systematic pattern is established in the record.']) {
    g = await gate(t);
    ok(g.generated === true && g.text.trim() === t && g.gate.exact === 1, 'sanctioned one-line answer passes: ' + t);
  }
  g = await gate('None identified. The respondent is guilty [F1] (p. 2).');
  ok(g.generated === false && g.reason === 'gate_failed', 'a one-line answer plus a dropped sentence does not pass');
  // timeouts: the fallback runs inside the client's wait, on a trimmed prompt
  {
    const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'verum-rules.js'), 'utf8');
    ok(/HUMAN_TIMEOUT_MS = 30000/.test(src) && /HUMAN_FALLBACK_TIMEOUT_MS = 15000/.test(src) && /HUMAN_EXTERNAL_TIMEOUT_MS = 45000/.test(src),
      'primary 30 s + fallback 15 s < the client\'s 52 s; the external provider keeps 45 s');
    ok(/timeoutMs: HUMAN_FALLBACK_TIMEOUT_MS/.test(src) && /o\.fallbackUser \|\| user/.test(src), 'the fallback call uses the short timeout and the trimmed prompt');
    const seen = [];
    const big = { ...gBase, excerpt: ('[Page 2] ' + 'x'.repeat(200) + '\n').repeat(120) };
    const e = { ...env, AI: { run: async (m, o) => { seen.push([m, o.messages[1].content.length]); if (m !== '@cf/meta/llama-3.1-8b-instruct-fp8') throw new Error('No such model'); return { response: JSON.stringify({ text: PAD }) }; } } };
    g = await (await hPost(big, e)).json();
    ok(g.generated === true && g.model === '@cf/meta/llama-3.1-8b-instruct-fp8' && seen.length === 2 && seen[1][1] < seen[0][1] - 10000,
      'a failed primary falls back to the 8B model with a shorter excerpt (' + JSON.stringify(seen) + ')');
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { const err = new Error('This operation was aborted'); err.name = 'AbortError'; throw err; };
    try { g = await (await hPost(gBase, { ...env, LLM_API_BASE: 'https://llm.example.test/v1', LLM_API_KEY: 'sk-test', LLM_MODEL: 'narrator-1' })).json(); }
    finally { globalThis.fetch = origFetch; }
    ok(g.generated === false && g.reason === 'timeout', 'an aborted external provider call reports timeout, not ai_unavailable');
  }
}

// --- the signed rule-package loop: publish -> manifest -> the website verifies.
// The Worker signs canonical JSON with RULE_PRIVATE_KEY (PKCS#8 DER, base64);
// the website engine (forensic-engine-page.js, voVerifyRulePackage) verifies
// the manifest with the matching public key. A throwaway RSA-2048 pair stands
// in for vo-master-1 here; the pinned key itself is locked by rule-package.test.mjs.
{
  const nodeCrypto = await import('node:crypto');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privB64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const pubB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const store = {};
  const kvEnv = { ...env, ADMIN_TOKEN: 'test-admin-token', RULE_PRIVATE_KEY: privB64, RULES_KV: {
    get: async (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    list: async () => ({ keys: [] }),
    put: async (k, v) => { store[k] = v; }
  } };
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'worker', 'seed-rules.json'), 'utf8'));
  const publish = (pkg, token) => worker.fetch(new Request('https://verumglobal.foundation/api/v1/admin/publish', {
    method: 'POST', body: JSON.stringify(pkg), headers: { 'content-type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }
  }), kvEnv, {});

  r = await worker.fetch(mk('/api/v1/rules/manifest'), kvEnv, {});
  ok(r.status === 503 && (await r.json()).error === 'no_rule_package', 'manifest answers 503 no_rule_package before any publish');
  r = await publish(seed);
  ok(r.status === 401, 'publish without the admin token is 401');
  r = await publish(seed, 'wrong');
  ok(r.status === 403, 'publish with a wrong admin token is 403');
  r = await publish({ ...seed, version: '01.0.0' }, 'test-admin-token');
  ok(r.status === 400 && (await r.json()).error === 'invalid_version', 'a leading-zero version is refused (the Android client would reject it)');
  r = await publish({ ...seed, version: '1.0' }, 'test-admin-token');
  ok(r.status === 400, 'a two-part version is refused');
  r = await publish(seed, 'test-admin-token');
  let pub = await r.json();
  ok(r.status === 200 && pub.ok === true && pub.version === '1.0.0' && pub.rule_counts.fraud_keywords === 12, 'the seed package publishes (' + r.status + ')');
  r = await worker.fetch(mk('/api/v1/status'), kvEnv, {});
  ok(r.status === 200 && (await r.json()).version === '1.0.0', 'status reports the published version');
  r = await publish(seed, 'test-admin-token');
  let again = await r.json();
  ok(r.status === 409 && again.error === 'version_not_newer' && again.current === '1.0.0', 'republishing the same version is refused: 409 version_not_newer');
  r = await publish({ ...seed, version: '0.9.9' }, 'test-admin-token');
  ok(r.status === 409, 'a lower version is refused');
  r = await publish({ ...seed, version: '1.1.0' }, 'test-admin-token');
  ok(r.status === 200 && (await r.json()).version === '1.1.0', 'a strictly newer version publishes');

  r = await worker.fetch(mk('/api/v1/rules/manifest'), kvEnv, {});
  const manifest = await r.json();
  ok(r.status === 200 && manifest.algorithm === 'RSASSA-PKCS1-v1_5-SHA512' && manifest.publicKeyId === 'vo-master-1' && manifest.package.version === '1.1.0' && typeof manifest.signature === 'string', 'manifest carries package, signature, algorithm and key id');
  ok(typeof manifest.package.published_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(manifest.package.published_at), 'the server stamps published_at into the signed package');
  const v = await E.voVerifyRulePackage(manifest, { subtle: nodeCrypto.webcrypto.subtle, publicKeyB64: pubB64 });
  ok(v.ok === true, 'THE CONTRACT: what the Worker signs, the website engine verifies (' + v.reason + ')');
  const tampered = JSON.parse(JSON.stringify(manifest)); tampered.package.rules.fraud_keywords[0].pairs[0][1] = 'was paid';
  ok((await E.voVerifyRulePackage(tampered, { subtle: nodeCrypto.webcrypto.subtle, publicKeyB64: pubB64 })).reason === 'signature_invalid', 'one changed phrase breaks the signature');
  const compiled = E.voCompileRulePackage(v.package, { sha512: v.sha512, keyId: manifest.publicKeyId, fetchedFrom: 'live' });
  ok(compiled.version === '1.1.0' && compiled.pairs.length === 0 && compiled.builtInGroupsSkipped.length === 12, 'the seed package compiles on the website to its own vocabulary, skipped (nothing to add)');
}

// --- Brain 9 (R&D) sweep of the sealed text: /api/v1/ai/sweep. Constitution v8
// §2.10: recommendations, never findings; anchored; the quote must exist in
// the very text the model was given, or the item is discarded and counted.
{
  const sweepPost = (payload, run) => worker.fetch(mk('/api/v1/ai/sweep', 'POST', JSON.stringify(payload)), { ...env, AI: { run } }, {});
  const pages = [
    { page: 4, text: 'INVOICE #2023-001 Business Services Engagement. Payment Received: Wire Transfer received January 18, 2023 - Amount: $125,000.00. * Note: M. Wellington revoked signature authority Dec 1, 2022.' },
    { page: 5, text: 'Nothing of note on this page.' }
  ];
  const modelSays = (recommendations) => async (model, opts) => ({ response: JSON.stringify({ recommendations }) });
  let calls = [];
  r = await sweepPost({ pages, known: [{ type: 'CT15', page: 4 }] }, async (model, opts) => { calls.push({ model, opts }); return { response: JSON.stringify({ recommendations: [
    { type: 'CT11', severity: 4, rationale: 'An authoriser whose authority was revoked before the invoice still authorised it.', quote: 'M. Wellington   revoked signature authority', page: 5 },
    { type: 'CT02', severity: 3, rationale: 'made up', quote: 'this sentence is not in the text', page: 4 },
    { type: 'x', severity: 2, rationale: 'too short a quote', quote: 'Wire', page: 4 },
    { type: 'ct11', severity: 9, rationale: 'duplicate of the first', quote: 'M. Wellington revoked signature authority', page: 4 }
  ] }) }; });
  let sw = await r.json();
  ok(r.status === 200 && sw.ok === true && sw.reviewed === true && sw.brain === 'B9', 'sweep answers (' + r.status + ')');
  ok(sw.recommendations.length === 1 && sw.recommendations[0].type === 'CT11' && sw.recommendations[0].page === 4 && sw.recommendations[0].verified === true, 'a verbatim quote (whitespace forgiven) is kept and its page corrected to where it actually is (' + JSON.stringify(sw.recommendations[0] && sw.recommendations[0].page) + ')');
  ok(sw.unverified === 2, 'an invented quote and a quote under 12 characters are discarded and counted (' + sw.unverified + ')');
  ok(sw.recommendations.length === 1, 'the same quote reported twice (case/severity differing) is one recommendation');
  ok(JSON.stringify(sw.pagesRead) === '[4,5]', 'the reply names the pages read');
  ok(/Constitution v8 §2\.10/.test(sw.note) && /not findings/.test(sw.note), 'the reply says recommendations are not findings');
  const sys = calls[0].opts.messages[0].content;
  ok(/You are Brain 9, the research-and-development brain/.test(sys) && /cannot issue findings, verdicts or conclusions/.test(sys) && /copied EXACTLY, character for character/.test(sys), 'the prompt is Brain 9: no verdicts, verbatim quotes only');
  const userMsg = JSON.parse(calls[0].opts.messages[1].content);
  ok(userMsg.known.length === 1 && userMsg.known[0].type === 'CT15' && userMsg.pages.length === 2 && !('norm' in userMsg.pages[0]), 'the model receives the pages and the known types, nothing else');
  ok(calls[0].model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast' && calls[0].opts.temperature === 0, 'strong model, temperature 0');

  r = await sweepPost({ pages, known: [] }, async () => { throw new Error('model down'); });
  sw = await r.json();
  ok(r.status === 200 && sw.ok === true && sw.reviewed === false && sw.recommendations.length === 0 && /model down/.test(sw.reason), 'a failing model degrades to reviewed:false with the reason, never a 5xx');
  r = await sweepPost({ pages: [] }, modelSays([]));
  ok(r.status === 400, 'no pages -> 400');
  r = await sweepPost({ pages: Array.from({ length: 9 }, (_, i) => ({ page: i + 1, text: 'x' })) }, modelSays([]));
  ok(r.status === 400 && (await r.json()).error === 'too_many_pages', 'more than 8 pages -> 400 too_many_pages');
  r = await sweepPost({ pages: [{ page: 1, text: 'y'.repeat(12600) }] }, modelSays([]));
  ok(r.status === 400 && (await r.json()).error === 'too_much_text', 'more than 12,500 characters -> 400 too_much_text');
  r = await sweepPost({ pages: [{ page: '4', text: 'x' }] }, modelSays([]));
  ok(r.status === 400 && (await r.json()).error === 'invalid_page', 'a non-integer page -> 400 invalid_page');
  r = await worker.fetch(mk('/api/v1/ai/sweep'), env, {});
  ok(r.status === 405, 'GET on the sweep endpoint -> 405 (the path is known)');
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'verum-rules.js'), 'utf8');
  ok(/Constitution v8 §2\.10: B9 trains and calibrates/.test(src), 'the endpoint cites the constitutional rule it implements');
}

// --- the trainer run: anonymous signals -> a validated, signed, additive rule
// the website engine executes (founder direction item 13; ENGINE.md §12.9).
{
  const nodeCrypto = await import('node:crypto');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privB64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const pubB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'worker', 'seed-rules.json'), 'utf8'));
  const store = {};
  const days = ['2026-09-01', '2026-09-03', '2026-09-05'].map(d => { // inside the 7-day window relative to the fake clock below
    return d;
  });
  // Freeze "now" so the window and the buckets line up deterministically.
  const RealDate = Date;
  const NOW = new RealDate('2026-09-07T03:00:00.000Z').getTime();
  global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } };
  try {
    const mkEnv = (aiRun, extra) => ({ ...env, ADMIN_TOKEN: 'test-admin-token', RULE_PRIVATE_KEY: privB64, AI: { run: aiRun }, RULES_KV: {
      get: async (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      list: async (opts) => ({ keys: Object.keys(store).filter(k => !opts || !opts.prefix || k.startsWith(opts.prefix)).map(name => ({ name })) }),
      put: async (k, v) => { store[k] = v; }
    }, ...(extra || {}) });
    const admin = (p, body, e) => worker.fetch(new Request('https://verumglobal.foundation' + p, { method: 'POST', body: body === undefined ? '' : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-admin-token': 'test-admin-token' } }), e, {});
    // 1. a current package (the seed) published by hand
    r = await admin('/api/v1/admin/publish', seed, mkEnv(async () => ({ response: '{}' })));
    ok(r.status === 200, 'seed published for the trainer test (' + r.status + ')');
    // 2. anonymous feedback: one tactic recurring over three days, one below the bar, and noise
    const rec = (patterns) => ({ received_at: '2026-09-01T00:00:00Z', count: patterns.length, patterns });
    store['feedback:2026-09-01'] = JSON.stringify([rec([{ detectorId: 'AI_IDENTIFIED', type: 'INVOICE_SPLITTING', severity: 4, pageCount: 12 }, { detectorId: 'B9_RECOMMENDATION', type: 'INVOICE_SPLITTING', severity: 3, pageCount: 12 }, { detectorId: 'CT01', type: 'CT01', severity: 5, pageCount: 12 }])]);
    store['feedback:2026-09-03'] = JSON.stringify([rec([{ detectorId: 'AI_IDENTIFIED', type: 'INVOICE_SPLITTING', severity: 4, pageCount: 40 }, { detectorId: 'AI_IDENTIFIED', type: 'CT11', severity: 3, pageCount: 40 }, { detectorId: 'AI_IDENTIFIED', type: 'CT11', severity: 3, pageCount: 41 }, { detectorId: 'AI_IDENTIFIED', type: 'SERIAL', severity: 3, pageCount: 40 }])]);
    store['feedback:2026-09-05'] = JSON.stringify([rec([{ detectorId: 'B9_RECOMMENDATION', type: 'INVOICE_SPLITTING', severity: 3, pageCount: 8 }, { detectorId: 'AI_IDENTIFIED', type: 'CT11', severity: 3, pageCount: 8 }, { detectorId: 'CLEAN_SCAN', type: 'CLEAN_SCAN', severity: 1, pageCount: 3 }])]);
    let promptSeen = null;
    const modelDrafts = async (model, opts) => {
      promptSeen = opts.messages;
      return { response: JSON.stringify({ rules: [
        { type: 'INVOICE_SPLITTING', group: 'invoice_splitting', produces: 'CT22', phrases: ['split invoice', 'below approval limit', 'separate purchase orders', 'same supplier', 'Same Day', 'R 5,000', 'invoice'], min_cooccur: 2, rationale: 'Several small invoices from one supplier just under an approval threshold.' },
        { type: 'CT11', group: 'authority_after_revocation', phrases: ['authority revoked', 'signed after', 'no longer authorised', 'continued to approve'], min_cooccur: 2, rationale: 'An approver keeps signing after the mandate ended.' },
        { type: 'MADE_UP_TYPE', group: 'x', phrases: ['a b', 'c d', 'e f', 'g h'], min_cooccur: 2, rationale: 'not a selected signal' }
      ] }) };
    };
    // 3. the run (admin, on demand)
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(modelDrafts));
    let out = await r.json();
    ok(r.status === 200 && out.ok === true && out.run && out.run.status === 'published', 'the trainer published (' + r.status + ' ' + (out.run && out.run.status) + ': ' + (out.run && out.run.reason) + ')');
    ok(out.run.signals === 2, 'two learning signals reached the bar: INVOICE_SPLITTING (support 4 over 3 days, both detector ids merged) and CT11 (support 3 over 2 days); CT01 engine findings, SERIAL and CLEAN_SCAN are not signals (' + out.run.signals + ')');
    const sigMsg = promptSeen ? JSON.parse(promptSeen[1].content) : { signals: [] };
    ok(sigMsg.signals.length === 2 && sigMsg.signals[0].type === 'INVOICE_SPLITTING' && sigMsg.signals[0].support === 4 && sigMsg.signals[0].days === 3 && sigMsg.signals[0].detectorId === 'AI_IDENTIFIED+B9_RECOMMENDATION' && sigMsg.signals[1].type === 'CT11' && sigMsg.signals[1].support === 3 && sigMsg.signals[1].name === 'Authority Contradiction', 'the model sees types, support, days and the CT name only — never content (' + JSON.stringify(sigMsg.signals).slice(0, 160) + ')');
    ok(/You are Brain 9/.test(promptSeen[0].content) && /never names, numbers, dates, places/.test(promptSeen[0].content), 'the trainer prompt is Brain 9 and forbids identifying data');
    ok(out.run.accepted === 2 && out.run.published && out.run.published.version === '1.0.1' && out.run.published.previous === '1.0.0', 'two rules accepted, version 1.0.0 -> 1.0.1 (' + JSON.stringify(out.run.published && out.run.published.version) + '; rejected: ' + JSON.stringify(out.run.rejected) + ')');
    const added = out.run.published.added;
    const inv = added.find(a => a.type === 'INVOICE_SPLITTING'), ct11 = added.find(a => a.type === 'CT11');
    ok(inv && inv.id === 'FK13' && JSON.stringify(inv.phrases) === JSON.stringify(['split invoice', 'below approval limit', 'separate purchase orders', 'same supplier', 'same day']) && inv.min_cooccur === 2 && inv.produces === 'CT22', 'INVOICE_SPLITTING: name-like/digit/stop phrases dropped, the rest kept lower-cased, produces the model\'s valid CT (' + JSON.stringify(inv) + ')');
    ok(ct11 && ct11.id === 'FK14' && ct11.produces === 'CT11' && ct11.phrases.length === 4, 'CT11: a CT-typed signal produces its own CT');
    ok(out.run.rejected.length === 1 && out.run.rejected[0].type === 'MADE_UP_TYPE', 'a draft for a type that was not a signal is rejected');
    // 4. the package: additive, signed, verifiable, executable
    r = await worker.fetch(mk('/api/v1/rules/manifest'), mkEnv(modelDrafts), {});
    const manifest = await r.json();
    ok(manifest.package.version === '1.0.1' && manifest.package.rules.fraud_keywords.length === 14, 'the manifest serves 1.0.1 with two groups appended (' + manifest.package.rules.fraud_keywords.length + ')');
    ok(JSON.stringify(manifest.package.rules.fraud_keywords.slice(0, 12)) === JSON.stringify(seed.rules.fraud_keywords) && JSON.stringify(manifest.package.rules.contradiction_patterns) === JSON.stringify(seed.rules.contradiction_patterns), 'every existing rule is byte-identical: the trainer only appends');
    const fk13 = manifest.package.rules.fraud_keywords[12];
    ok(fk13.source_detector === 'B9' && fk13.curated_from.type === 'INVOICE_SPLITTING' && fk13.curated_from.support === 4 && /Auto-curated 2026-09-07 from 4 anonymous reports over 3 days/.test(fk13.description) && /recommendation tier, not a determination/.test(fk13.description), 'the appended rule says where it came from and that it is recommendation tier');
    const v = await E.voVerifyRulePackage(manifest, { subtle: nodeCrypto.webcrypto.subtle, publicKeyB64: pubB64 });
    ok(v.ok === true, 'the trainer\'s package verifies on the website engine (' + v.reason + ')');
    const compiled = E.voCompileRulePackage(v.package, { sha512: v.sha512 });
    ok(compiled.groups.length === 2 && compiled.groups[0].ruleId === 'FK13' && compiled.groups[0].min === 2 && compiled.groups[0].produces === 'CT22' && compiled.builtInGroupsSkipped.length === 12, 'the website compiles the two trainer rules as co-occurrence groups and still skips the seed (' + compiled.groups.length + ')');
    const fired = E.voRunPackageRules(compiled, ['cover', 'Three separate purchase orders were raised, each a split invoice kept below approval limit.'], []);
    ok(fired.findings.length === 1 && fired.findings[0].type === 'CT22' && fired.findings[0].packageRule === 'FK13' && fired.findings[0].location === 'Page 2', 'THE LOOP CLOSES: a tactic the AI review kept finding is now a deterministic rule that fires on the website (' + JSON.stringify(fired.findings[0] && fired.findings[0].evidence).slice(0, 120) + ')');
    // 5. history, changelog, last run
    ok(typeof store['rules:history:1.0.0'] === 'string' && JSON.parse(store['rules:history:1.0.0']).package.version === '1.0.0', 'the previous package is kept under rules:history:1.0.0');
    r = await worker.fetch(mk('/api/v1/rules/changelog'), mkEnv(modelDrafts), {});
    const log = await r.json();
    ok(r.status === 200 && log.current.version === '1.0.1' && log.current.published_by === 'trainer:admin' && log.entries.length === 1 && log.entries[0].added.length === 2 && log.entries[0].trigger === 'admin' && log.lastRun.status === 'published' && log.trainer.enabled === true, 'the public changelog names the version, the trigger, the rules added and the last run');
    // 6. a second run finds nothing new (both types are now covered)
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(modelDrafts));
    out = await r.json();
    ok(out.run.status === 'no_change' && out.run.signals === 0 && /no learning signal/.test(out.run.reason), 'a second run changes nothing: the signals are covered (' + out.run.status + ')');
    ok((await (await worker.fetch(mk('/api/v1/rules/manifest'), mkEnv(modelDrafts), {})).json()).package.version === '1.0.1', 'the package version is unchanged after a no-change run');
    // 7. safety valves
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(modelDrafts, { AUTO_CURATE: 'off' }));
    ok((await r.json()).run.status === 'disabled', 'AUTO_CURATE=off disables the run');
    const noKey = mkEnv(modelDrafts); delete noKey.RULE_PRIVATE_KEY;
    r = await admin('/api/v1/admin/curate-publish', undefined, noKey);
    ok((await r.json()).run.status === 'skipped' && /no signing key/.test((await admin('/api/v1/admin/curate-publish', undefined, noKey).then(x => x.json())).run.reason), 'no signing key -> skipped, reason recorded');
    r = await worker.fetch(new Request('https://verumglobal.foundation/api/v1/admin/curate-publish', { method: 'POST', body: '' }), mkEnv(modelDrafts), {});
    ok(r.status === 401, 'the admin trigger needs the admin token');
    r = await worker.fetch(mk('/api/v1/admin/curate-publish'), mkEnv(modelDrafts), {});
    ok(r.status === 405, 'GET on the admin trigger -> 405 (known path)');
    // 8. a model failure changes nothing
    delete store['rules:changelog']; // reset for a clean read
    store['feedback:2026-09-06'] = JSON.stringify([rec([{ detectorId: 'AI_IDENTIFIED', type: 'NEW_TACTIC', severity: 3, pageCount: 5 }, { detectorId: 'AI_IDENTIFIED', type: 'NEW_TACTIC', severity: 3, pageCount: 5 }])]);
    store['feedback:2026-09-04'] = JSON.stringify([rec([{ detectorId: 'AI_IDENTIFIED', type: 'NEW_TACTIC', severity: 3, pageCount: 5 }])]);
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(async () => { throw new Error('model down'); }));
    out = await r.json();
    ok(out.run.status === 'failed' && /model unavailable: model down/.test(out.run.reason) && out.run.signals === 1, 'a failing model records its reason and publishes nothing');
    // 9. the scheduled handler runs the same job
    const waited = [];
    const sched = await worker.scheduled({ cron: '0 3 * * 1' }, mkEnv(async () => ({ response: JSON.stringify({ rules: [] }) })), { waitUntil: (p) => waited.push(p) });
    ok(waited.length === 1 && sched && sched.trigger === 'cron' && sched.status === 'no_change' && /no draft passed validation/.test(sched.reason), 'scheduled() runs the trainer as cron and records the outcome (' + (sched && sched.status) + ': ' + (sched && sched.reason) + ')');
    // 10. the changelog is part of the publish transaction (Sourcery finding on PR #201):
    //     read before anything is stored, written after with a retry, never able to turn a
    //     published run into a reported failure or to overwrite the log with one entry.
    const kvFailing = (mode) => ({
      get: async (k) => { if (mode === 'get' && k === 'rules:changelog') throw new Error('kv read down'); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      list: async (opts) => ({ keys: Object.keys(store).filter(k => !opts || !opts.prefix || k.startsWith(opts.prefix)).map(name => ({ name })) }),
      put: async (k, v) => { if (mode === 'put' && k === 'rules:changelog') throw new Error('kv write down'); store[k] = v; }
    });
    const modelNewTactic = async () => ({ response: JSON.stringify({ rules: [
      { type: 'NEW_TACTIC', group: 'backdated_approval', phrases: ['backdated approval', 'signed retrospectively', 'approval after payment', 'retroactive authorisation'], min_cooccur: 2, rationale: 'An approval is recorded after the payment it authorises.' }
    ] }) });
    store['rules:changelog'] = JSON.stringify([{ version: '1.0.1', previous: '1.0.0', trigger: 'admin', added: [] }]); // an existing log that must survive
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(modelNewTactic, { RULES_KV: kvFailing('get') }));
    out = await r.json();
    ok(r.status === 200 && out.run.status === 'failed' && /could not read the changelog; nothing published/.test(out.run.reason) && out.run.published === null, 'a changelog READ failure aborts the run before anything is stored (' + out.run.status + ': ' + out.run.reason + ')');
    ok((await (await worker.fetch(mk('/api/v1/rules/manifest'), mkEnv(modelNewTactic), {})).json()).package.version === '1.0.1' && JSON.parse(store['rules:changelog']).length === 1, 'the package and the existing changelog are untouched after a read failure');
    r = await admin('/api/v1/admin/curate-publish', undefined, mkEnv(modelNewTactic, { RULES_KV: kvFailing('put') }));
    out = await r.json();
    ok(r.status === 200 && out.run.status === 'published' && out.run.changelog === 'not_written' && out.run.published && out.run.published.version === '1.0.2' && /changelog entry could not be written/.test(out.run.reason), 'a changelog WRITE failure never turns a published run into a reported failure: status published, changelog not_written, the reason says so (' + out.run.status + ': ' + out.run.reason + ')');
    ok((await (await worker.fetch(mk('/api/v1/rules/manifest'), mkEnv(modelNewTactic), {})).json()).package.version === '1.0.2' && JSON.parse(store['rules:auto-curate:last-run']).changelog === 'not_written' && JSON.parse(store['rules:auto-curate:last-run']).status === 'published', 'the manifest serves 1.0.2 and the last-run record carries the published version with changelog not_written');
    ok(JSON.parse(store['rules:changelog']).length === 1 && JSON.parse(store['rules:changelog'])[0].version === '1.0.1', 'the existing changelog is left as it was, never overwritten with a partial log');
    // 11. an unexpected throw anywhere else is a recorded outcome, never an escaped exception
    const kvBroken = { get: async (k) => { if (k === 'rules:current') throw new Error('kv down'); return null; }, list: async () => ({ keys: [] }), put: async () => {} };
    const brokenRun = await worker.scheduled({ cron: '0 3 * * 1' }, mkEnv(modelNewTactic, { RULES_KV: kvBroken }), { waitUntil: () => {} });
    ok(brokenRun && brokenRun.status === 'failed' && /unexpected: kv down/.test(brokenRun.reason), 'a KV outage during the cron is a recorded failed run with its reason, not a swallowed exception (' + (brokenRun && brokenRun.status) + ': ' + (brokenRun && brokenRun.reason) + ')');
  } finally {
    global.Date = RealDate;
  }
}

console.log('\n[worker] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[worker] ALL GREEN');
