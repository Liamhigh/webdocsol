/**
 * The court-ready narrative ("human report") — the wiring locks.
 *
 * Three artefacts share one section contract: the worker endpoint
 * (worker/verum-rules.js HUMAN_SECTIONS), the PDF builder
 * (forensic-report.js HUMAN_REPORT_SECTIONS / buildHumanReport) and the host
 * page (seal-document.html VO_HUMAN_SECTIONS). If the ids drift, a section the
 * writer drafts has no home in the PDF, or the PDF expects prose nobody asked
 * for. This suite pins the three lists to each other and locks the
 * constitutional plumbing around the feature: opt-in default OFF with honest
 * consent copy, the render-time §15.2 gate on every AI section, provenance
 * that never presents deterministic text as AI-written, and delivery only
 * through the seal guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  human-report.test.mjs');
console.log('======================================================\n');

const worker = read('worker/verum-rules.js');
const report = read('forensic-report.js');
const html = read('seal-document.html');

// ---- one contract, three copies -------------------------------------------
function idsFromArrayLiteral(src, name) {
  const m = src.match(new RegExp('(?:const|var)\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  if (!m) return null;
  return (m[1].match(/['"]([a-z_]+)['"]/g) || []).map(s => s.slice(1, -1));
}
const workerIds = (worker.match(/\{\s*id:\s*['"]([a-z_]+)['"]/g) || []).map(s => s.replace(/.*['"]([a-z_]+)['"]/, '$1'));
const reportIds = idsFromArrayLiteral(report, 'HUMAN_REPORT_SECTIONS');
const pageIds = idsFromArrayLiteral(html, 'VO_HUMAN_SECTIONS');
ok(workerIds.length === 16, 'worker declares the 16-section contract (' + workerIds.length + ')');
ok(reportIds && reportIds.join(',') === workerIds.join(','), 'forensic-report.js section ids equal the worker contract, in order');
ok(pageIds && pageIds.join(',') === workerIds.join(','), 'seal-document.html section ids equal the worker contract, in order');
const writerIds = idsFromArrayLiteral(html, 'VO_HUMAN_WRITER_SECTIONS') || [];
const workerWriter = (worker.match(/\{\s*id:\s*['"]([a-z_]+)['"][^}]*writer:\s*true/g) || []).map(s => s.replace(/.*id:\s*['"]([a-z_]+)['"].*/, '$1'));
ok(writerIds.length === 9 && writerIds.join(',') === workerWriter.join(','), 'the page asks the worker for exactly the writer sections (' + writerIds.join(',') + ')');
for (const id of workerIds) ok(new RegExp("'" + id + "'").test(report), 'builder references section ' + id);

// ---- the builder sits after buildNarrative and is exported ------------------
const iBN = report.indexOf('async function buildNarrative(');
const iBH = report.indexOf('async function buildHumanReport(');
const iEx = report.indexOf('// ================= exports');
ok(iBN > 0 && iBH > iBN && iEx > iBH, 'buildHumanReport is defined after buildNarrative and before the exports block');
ok(/buildHumanReport:\s*buildHumanReport/.test(report), 'buildHumanReport is exported on VerumReport');
const bodyBH = report.slice(iBH, iEx);
ok(/scrubNarrative\(sec\.text,/.test(bodyBH) && /voGatePasses\(scrub\)/.test(bodyBH),
  'every AI section passes the render-time §15.2 gate (scrubNarrative + voGatePasses)');
ok(/sec\.provenance === 'ai'/.test(bodyBH), 'only a genuine AI telling (provenance ai) can print as AI-written');
ok(/nothing here is machine-written/.test(bodyBH), 'a deterministic fallback is labelled as NOT machine-written');
ok(/COURT-READY NARRATIVE REPORT/.test(bodyBH) && !/VERUM OMNIS FORENSIC REPORT/.test(bodyBH),
  'the document is titled as a narrative report, never as the constitutional forensic report');
ok(/The verdict on any named person is reserved for the court\./.test(bodyBH), 'verdict reservation sentence is printed');
ok(/sealed under SHA-512 and ' \+ anchorPhrase\(data\) \+ '/.test(bodyBH) && /function anchorPhrase/.test(report), 'certification sentence is printed');
ok(/independent model assessments recorded in the technical report are advisory only; they do not determine whether a finding is correct, true or legally established/.test(bodyBH),
  'provenance states that model assessments are advisory and do not determine findings');
ok(/f\.source === 'ai'\) return false/.test(bodyBH), 'AI candidates never enter the sealed findings list');
ok(/No account on record/.test(bodyBH) && /No oath language was found/.test(bodyBH) && /None identified/.test(bodyBH),
  'empty sections state their emptiness instead of being omitted (PD6)');
for (const fn of ['secEvidenceIndex', 'secMatrix', 'secOffenceMatrix']) {
  ok(new RegExp(fn + '\\(ctx, data\\)').test(bodyBH), 'engine section ' + fn + ' renders as a contract section');
}
// Engine sections that live UNDER a contract heading render through
// engineUnder, so the PDF carries exactly fifteen numbered sections.
// (The seal explainer, "How any change to this record is detected", is gone
// from both reports since 5 October 2026: a user manual, PD20 and §15.2.)
for (const fn of ['secStatutoryAnchoring', 'secActions', 'secEvidenceAppendix', 'secUnreadPages', 'secOcrProvenance']) {
  ok(new RegExp('engineUnder\\(' + fn + '\\)').test(bodyBH) && !new RegExp(fn + '\\(ctx, data\\)').test(bodyBH),
    'engine section ' + fn + ' renders under its contract heading (engineUnder)');
}
ok(!/secSealExplainer|HOW ANY CHANGE TO THIS RECORD IS DETECTED/.test(bodyBH), 'the court-ready narrative carries no "how any change is detected" explainer (a user manual, PD20)');
ok(/function engineUnder\(fn, o\)/.test(bodyBH) && /ctx\.subHeading\(t, \{ keepWith: [^}]*toc: true \}\)/.test(bodyBH),
  'engineUnder demotes the engine heading to a sub-heading and restores ctx.heading');
ok(/headerTitle: 'Verum Omnis Court-Ready Narrative'/.test(bodyBH), 'every body page is headed as the narrative, never "Forensic Report"');
ok(/headerTitle: \(ctxOpts && ctxOpts\.headerTitle\) \|\| 'Verum Omnis Forensic Report'/.test(report) && /san\(ctx\.headerTitle\)/.test(report),
  'makeCtx keeps the forensic header by default and draws the title it is given');
ok(/sec\.reason === 'not_applicable'/.test(bodyBH) && /the AI narrator was not asked to write it/.test(bodyBH),
  'a section nothing in the record engages says so instead of "not generated"');
ok(!/\(ptOk \? '' : ''\)/.test(bodyBH), 'no dead no-op in the plain-terms line');
ok(/page-anchored and cited as \[F#\] in this narrative/.test(bodyBH), 'the findings count distinguishes the sealed total from the page-anchored subset');
// cover/seal hooks: options with the old defaults intact
ok(/data\.coverTitle \|\| 'FORENSIC EVIDENCE REPORT'/.test(report), 'drawCover keeps its default title when no coverTitle is given');
ok(/sealOpts\.tag \|\| 'FORENSIC REPORT'/.test(report), 'seal() keeps its default footer tag when no tag is given');
ok((report.match(/not the opinion of a generative AI|not by a generative AI/g) || []).length >= 3,
  'the deterministic-provenance statement still appears at least three times');

// ---- the host page: consent, wiring, guard --------------------------------
// Two modes, no switches (founder direction item 12, 2026-09-07): the narrative
// is part of "Seal document with forensic report"; the mode card and the
// disclosure box carry the consent.
ok(!/id="humanReportOptIn"/.test(html) && !/id="aiReviewEnabled"/.test(html), 'no narrative or AI-review tick box exists');
ok(/Seal document with forensic report/.test(html) && /the court-ready narrative is written section by section beside the technical report/i.test(html), 'the disclosure says the narrative comes with the technical report');
ok(/leave this device/.test(html) && /court-ready narrative/i.test(html), 'the disclosure says what leaves the device for this step');
ok(/For privileged or sensitive matters choose <strong[^>]*>Seal document<\/strong> instead: nothing leaves the device/.test(html), 'the disclosure points privileged matters to Seal document');
ok(!/maximum 4,000 characters from the document's first pages, sent for classification\) leave this device/.test(html),
  'the stale "4,000 characters" disclosure was rewritten');
ok(/async function aiHumanReport\(/.test(html), 'aiHumanReport orchestrator is present');
ok(/endpoint = '\/api\/v1\/ai\/human-report'/.test(html) && /aiApiPost\(endpoint, payload, VO_HUMAN_CALL_TIMEOUT_MS, diagnostic\)/.test(html),
  'the page posts to the human-report endpoint (same-origin, relative)');
ok(/res\.machineGenerated === true/.test(html), 'the page accepts a section only when the worker marks it machine-generated');
ok(/VerumReport\.buildHumanReport\(/.test(html), 'the seal flow calls buildHumanReport');
ok(/window\._voHumanReportPack = null/.test(html), 'the human-report pack is reset');
ok(/VoSealGuard\.isSealed\(window\._voHumanReportPack\.bytes\)/.test(html), 'the human-report download is seal-guarded');
ok(/downloadHumanReport/.test(html), 'the human-report download button is wired');
ok(/-court-ready-narrative-sealed\.pdf/.test(html), 'the human report is named as a sealed narrative');
ok(!/hrOpt && hrOpt\.checked/.test(html) && /if \(isAiReviewEnabled\(\) && reportFraudResult && !reportFraudResult\.scanFailed &&/.test(html), 'the step runs in forensic mode with no separate switch');
ok(/function isAiReviewEnabled\(\) \{\s*return sealMode === 'forensic';\s*\}/.test(html), 'isAiReviewEnabled is the sealing mode itself');
ok(!/gps/i.test(html.slice(html.indexOf('async function aiHumanReport('), html.indexOf('async function aiClassifyDocument('))),
  'the human-report payload never carries GPS or device data');
// (was 2 while the page also built the plain-language narrative; that PDF was retired 2026-09-07)
ok((html.match(/ocrPages: _voOcrRescuedPages,/g) || []).length === 1 && /ocrPages: _voOcrRescuedPages \|\| null/.test(html),
  'ocrPages reaches the forensic report and the court-ready narrative');
ok(/unreadPages: _voUnreadPages,/.test(html) && /var unread = voHumanUnreadList\(ctxIn && ctxIn\.unreadPages\)/.test(html),
  'the unread-page record reaches the narrator through the flattener (it is an object, not an array)');
ok(/VO_HUMAN_TOTAL_BUDGET_MS = 5 \* 60 \* 1000/.test(html) && /reason: 'time_budget'/.test(html), 'the whole narrative has a five-minute ceiling');
ok(/return sw\.length \? sw : null;/.test(html) && /return co\.length \? co : null;/.test(html) && /reason: 'not_applicable'/.test(html),
  'sworn/coercive sections are not requested when no finding engages them');
{
  const iLoop = html.indexOf("for (var b = 0; b < fp.length; b += VO_HUMAN_CRITICAL_BATCH)");
  const iEnd = html.indexOf("if (anyAi) { merged.provenance = 'ai';", iLoop);
  ok(iLoop > 0 && iEnd > iLoop && /try \{ r = await callSection\(section, batch\); \}/.test(html.slice(iLoop, iEnd)),
    'a failed critical-evidence batch never discards the batches already written');
}
ok(/VO_HUMAN_CALL_TIMEOUT_MS = 52000/.test(html) && /HUMAN_TIMEOUT_MS = (?:28000|28e3)/.test(worker) && /HUMAN_FALLBACK_TIMEOUT_MS = (?:15000|15e3)/.test(worker) && /HUMAN_EXTERNAL_TIMEOUT_MS = 14e3/.test(worker) && /const externalMs = boundedTimeout\(HUMAN_EXTERNAL_TIMEOUT_MS\)/.test(worker),
  'every external call keeps a 14-second slice; primary and fallback timeouts fit the client wait');
ok(/const deadlineAt = startedAt \+ HUMAN_ENDPOINT_BUDGET_MS/.test(worker) && /if \(fallbackMs < 8e3\) throw e/.test(worker),
  'the endpoint passes one deadline through primary, fallback and repair');

// ---- one external provider slice; no repair inside a dying time envelope ----
{
  const workerApp = (await import(path.join(__dirname, '..', 'worker', 'verum-rules.js'))).default;
  const request = new Request('https://example.test/api/v1/ai/human-report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      section: 'executive_summary', documentName: 'scan.pdf', pageCount: 2,
      findings: [{ id: 'F1', type: 'CT02', name: 'Date inconsistency', severity: 4, page: 2, pages: [2], evidence: 'dated 3 March 2026', quote: 'dated 3 March 2026' }],
      excerpt: '[Page 2] The agreement is dated 3 March 2026.'
    })
  });
  const realNow = Date.now;
  let calls = 0;
  Date.now = () => 1000 + (calls ? 41001 : 0); // 6,999 ms remains: below the repair floor
  try {
    const env = { AI: { run: async () => {
      calls++;
      return { response: JSON.stringify({ text: 'This may be fraud [F1] (p. 2).' }) };
    } } };
    const response = await workerApp.fetch(request, env, {});
    const body = await response.json();
    ok(calls === 1 && body.generated === false && body.reason === 'gate_failed' && body.attempts === 1 && body.repair === 'repair_skipped_time_budget',
      'no repair call is made when less than eight seconds remain');
  } finally { Date.now = realNow; }
}
// A primary failure after the external slice must not launch a fallback that
// the 52-second client abort will kill before its response can be read.
{
  const workerApp = (await import(path.join(__dirname, '..', 'worker', 'verum-rules.js'))).default;
  const request = new Request('https://example.test/api/v1/ai/human-report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      section: 'executive_summary', pageCount: 2,
      findings: [{ id: 'F1', type: 'CT02', name: 'Date inconsistency', severity: 4, page: 2, pages: [2], evidence: 'dated 3 March 2026', quote: 'dated 3 March 2026' }],
      excerpt: '[Page 2] The agreement is dated 3 March 2026.'
    })
  });
  const realNow = Date.now;
  let calls = 0;
  Date.now = () => 5000 + (calls ? 41001 : 0); // 6,999 ms remains for fallback
  try {
    const env = { AI: { run: async () => { calls++; throw new Error('primary unavailable'); } } };
    const response = await workerApp.fetch(request, env, {});
    const body = await response.json();
    ok(calls === 1 && body.generated === false && body.reason === 'ai_unavailable',
      'no fallback call starts with less than eight seconds left in the endpoint envelope');
  } finally { Date.now = realNow; }
}

// ---- the render-time gate: headings are gated, dates are not hedges --------
ok(/function voHeadingBanned\(s\) \{\s*return VO_BANNED_SENTENCE_RE\.test\(/.test(report) && /if \(voHeadingBanned\(trimmed\)\) \{ dropped\+\+; continue; \}/.test(report),
  'scrubNarrative gates headings with the same language rule (and the offence-word rule; a heading asserts nothing else)');
ok(/VO_MONTH_MAY_RE/.test(report) && /could\|would/.test(report) && /consistent\\\\s\+with/.test(report),
  'the render-time gate masks the month of May and bans could/would/consistent with');
ok(report.indexOf('.replace(/\\b(?:pp?|pgs?)\\.(?=\\s*\\d)/gi') >= 0, 'the shared splitter keeps "(p.99)" in one sentence');

// ---- the client finding list runs headless and keeps candidates separate --
{
  const start = html.indexOf('function voHumanFirstPage(');
  const end = html.indexOf('function voHumanPayloadFinding(');
  const src = html.slice(start, end);
  const sandbox = { window: { VerumReport: null }, String, Array, Object, Number, Math, parseInt, isFinite, RegExp };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.voHumanFindingList = voHumanFindingList;', sandbox);
  const out = sandbox.voHumanFindingList([
    { type: 'CT02', severity: 2, evidence: 'dated 3 March vs dated 9 March', location: 'Page 2 vs Page 5' },
    { type: 'CT03', severity: 5, evidence: 'signature block empty', location: 'Page 7' },
    { type: 'CT09', severity: 4, evidence: 'ai raised', location: 'Page 3', source: 'ai' },
    { type: 'SERIAL', severity: 3, evidence: 'pattern', location: 'Full document' },
    { type: 'CT31', severity: 3, evidence: 'annexure missing [bundle context: repeated page]', location: 'Page 4' },
    { type: 'CT11', severity: 1, evidence: 'no page', location: 'Metadata' }
  ]);
  ok(out.findings.length === 2 && out.findings[0].id === 'F1' && out.findings[0].f.type === 'CT03' && out.findings[1].f.type === 'CT02',
    'verified findings are id-stamped most-serious-first; serial, demoted and unanchored items excluded');
  ok(out.candidates.length === 1 && out.candidates[0].id === 'C1', 'AI-raised items become C# candidates, never F# findings');
  vm.runInContext('this.voHumanUnreadList = voHumanUnreadList;', sandbox);
  const ul = sandbox.voHumanUnreadList({ capped: [9], noText: [3, 1], renderFailed: [], timedOut: [5] });
  ok(ul.length === 4 && ul[0].page === 1 && ul[3].page === 9 && /OCR timed out/.test(ul[2].reason),
    'the unread-page object flattens to [{page, reason}] in page order');
  ok(sandbox.voHumanUnreadList(null).length === 0 && sandbox.voHumanUnreadList([{ page: 2, reason: 'x' }]).length === 1,
    'the flattener accepts nothing and an already-flat list');
}

// ---- the four-pillars gate and the deterministic elements table agree ------
// The worker refuses a pillar sentence citing a finding whose type cannot
// evidence that pillar; the report's elements table (OFFENCE_ELEMENTS) maps the
// same types to the same elements. Two copies of one rule: pinned equal.
{
  const listOf = (src, re) => { const m = src.match(re); return m ? (m[1].match(/CT\d{2}/g) || []).join(',') : null; };
  const wMis = listOf(worker, /misrepresentation:\s*\[([^\]]*)\]/), wLoss = listOf(worker, /loss:\s*\[([^\]]*)\]/);
  const rMis = listOf(report, /el: 'A misrepresentation[^']*', types: \[([^\]]*)\]/), rLoss = listOf(report, /el: 'Actual or potential prejudice[^']*', types: \[([^\]]*)\]/);
  ok(wMis && wMis === rMis, 'the misrepresentation pillar takes exactly the elements table\'s misrepresentation types (' + wMis + ' | ' + rMis + ')');
  ok(wLoss && wLoss === rLoss, 'the loss pillar takes exactly the elements table\'s prejudice types (' + wLoss + ' | ' + rLoss + ')');
  ok(/knowledge: \[\]/.test(worker) && /inducement: \[\]/.test(worker), 'no finding type evidences knowledge or inducement: those pillars are INSUFFICIENT');
  ok(/humanGate\(d\.raw, ids, pages, corpusNorm, idType, section === ["']four_pillars["']/.test(worker) && /HUMAN_PILLAR_CLAIM_RE/.test(worker), 'the full pillar test runs on four pillars; elsewhere a sentence that claims a pillar is evidenced is held to the same types');
}

// ---- the sealed-record budget feeds a large bundle whole (Greensky rerun fix 1)
{
  ok(/VO_HUMAN_RECORD_CHARS = 196000/.test(html), 'the page supplies up to 196k chars of sealed-record text (was 64k: 100 of 332 pages, 56 truncated)');
  ok(/MAX_HUMAN_RECORD = 200e3/.test(worker), 'the worker accepts the raised record budget');
  const mRec = html.match(/function voBuildSealedRecordContext\(([\s\S]*?)\n\}\n/);
  ok(Boolean(mRec), 'voBuildSealedRecordContext found in the page');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('var VO_HUMAN_RECORD_CHARS = 196000;\n' + mRec[0] + '\nthis.build = voBuildSealedRecordContext;', sandbox);
  // A 332-page Greensky-shaped bundle: ~1,000 chars per page (whole bundle
  // ~340k, over budget), findings anchored on 20 pages across the record.
  const blocks = [];
  for (let p = 1; p <= 332; p++) blocks.push('Bundle page ' + p + ' states its own facts. ' + 'x'.repeat(980));
  const findings = [];
  for (let fp = 10; fp <= 330; fp += 4) findings.push({ page: fp, pages: [fp], evidence: 'q' });
  const ctx = sandbox.build(blocks, findings, [], 196000);
  const coreSupplied = findings.every(f => ctx.coverage.suppliedPages.includes(f.page));
  const coreUntruncated = findings.every(f => !ctx.coverage.truncatedPages.includes(f.page));
  ok(coreSupplied && coreUntruncated, 'every finding page is supplied WHOLE — a finding page is never the one truncated');
  ok(ctx.coverage.suppliedPageCount > 150, 'a 332-page bundle supplies most of the record, not 100 pages (' + ctx.coverage.suppliedPageCount + ')');
  ok(ctx.coverage.truncatedPages.every(p => !findings.some(f => f.page === p)), 'truncation only ever touches neighbour/timeline/capacity pages');
  ok(ctx.coverage.charCount <= 196000 + 400, 'the budget is honoured (' + ctx.coverage.charCount + ')');
  // Small bundles still go across whole.
  const small = sandbox.build(['page one text', 'page two text'], [], [], 196000);
  ok(small.coverage.fullTextSupplied === true && small.coverage.suppliedPageCount === 2, 'a small bundle goes across whole');
}

// Exercise the actual PDF cover, including the coordinates used to draw it.
{
  const require = createRequire(import.meta.url);
  const g = globalThis;
  g.window = g;
  g.self = g;
  new Function('window', 'self', 'globalThis', read('vendor/pdf-lib.min.js'))(g, g, g);
  const R = require('../forensic-report.js');
  const E = require('../forensic-engine-page.js');
  const originalDrawText = g.PDFLib.PDFPage.prototype.drawText;
  let drawn = [];
  g.PDFLib.PDFPage.prototype.drawText = function (text, options) {
    drawn.push({ page: this, text, options });
    return originalDrawText.call(this, text, options);
  };
  const valid = 'The document records a payment on p. 1. The letter records a second payment on p. 2.';
  const opts = {
    documents: [{ name: 'record.pdf', pageCount: 2 }],
    findings: { findings: [], totalFindings: 0 },
    images: { logo: new Uint8Array([0]), watermark: new Uint8Array([0]) },
    generatedAt: '2026-01-01T00:00:00Z'
  };
  try {
    for (const [label, sections, count] of [
      ['zero', {}, 0],
      ['one', { executive_summary: { provenance: 'ai', text: valid } }, 1],
      ['two', { executive_summary: { provenance: 'ai', text: valid }, chronology: { provenance: 'ai', text: valid } }, 2],
      ['unprinted conditional section', { executive_summary: { provenance: 'ai', text: valid }, sworn_statements: { provenance: 'ai', text: valid } }, 1],
      ['suppressed drafts', { executive_summary: { provenance: 'ai', text: valid }, chronology: { provenance: 'ai', text: 'This proves fraud.' }, recommendations: { provenance: 'ai', text: 'This proves fraud.' } }, 0]
    ]) {
      drawn = [];
      const bytes = await R.buildHumanReport({ ...opts, humanSections: sections });
      const pdf = await g.PDFLib.PDFDocument.load(bytes);
      const cover = (await E.extractPageText(bytes, 0, pdf)).join(' ').replace(/\s+/g, ' ');
      const sentence = count + ' of 9 narrative sections were drafted by an AI narrator and passed the §15.2 gates; the remaining sections print the deterministic record of the sealed technical report and its findings JSON.';
      ok(cover.includes(sentence) && !/\b(?:undefined|NaN|null) of 9 narrative sections/.test(cover),
        label + ': the built cover states the exact printed section count and deterministic remainder');
      const coverPage = drawn[0].page;
      const provenance = drawn.filter(x => x.page === coverPage && x.options.y >= 74 && x.options.y <= 150);
      ok(provenance.some(x => x.text.startsWith(count + ' of 9 narrative sections')) &&
        provenance.every(x => x.options.x >= 40 && x.options.x + x.options.font.widthOfTextAtSize(x.text, x.options.size) <= coverPage.getWidth() - 40),
        label + ': the cover provenance including the count fits within the page');
    }
  } finally {
    g.PDFLib.PDFPage.prototype.drawText = originalDrawText;
  }
}

console.log(`\n[human-report] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[human-report] FAILURES'); process.exit(1); }
console.log('[human-report] ALL GREEN');
