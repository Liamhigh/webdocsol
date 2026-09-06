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
  return (m[1].match(/'([a-z_]+)'/g) || []).map(s => s.slice(1, -1));
}
const workerIds = (worker.match(/\{\s*id:\s*'([a-z_]+)'/g) || []).map(s => s.replace(/.*'([a-z_]+)'/, '$1'));
const reportIds = idsFromArrayLiteral(report, 'HUMAN_REPORT_SECTIONS');
const pageIds = idsFromArrayLiteral(html, 'VO_HUMAN_SECTIONS');
ok(workerIds.length === 15, 'worker declares the 15-section contract (' + workerIds.length + ')');
ok(reportIds && reportIds.join(',') === workerIds.join(','), 'forensic-report.js section ids equal the worker contract, in order');
ok(pageIds && pageIds.join(',') === workerIds.join(','), 'seal-document.html section ids equal the worker contract, in order');
const writerIds = idsFromArrayLiteral(html, 'VO_HUMAN_WRITER_SECTIONS') || [];
const workerWriter = (worker.match(/\{\s*id:\s*'([a-z_]+)'[^}]*writer:\s*true/g) || []).map(s => s.replace(/.*id:\s*'([a-z_]+)'.*/, '$1'));
ok(writerIds.length === 9 && writerIds.join(',') === workerWriter.join(','), 'the page asks the worker for exactly the writer sections (' + writerIds.join(',') + ')');
for (const id of workerIds) ok(new RegExp("'" + id + "'").test(report), 'builder references section ' + id);

// ---- the builder sits after buildNarrative and is exported ------------------
const iBN = report.indexOf('async function buildNarrative(');
const iBH = report.indexOf('async function buildHumanReport(');
const iEx = report.indexOf('// ================= exports');
ok(iBN > 0 && iBH > iBN && iEx > iBH, 'buildHumanReport is defined after buildNarrative and before the exports block');
ok(/buildHumanReport:\s*buildHumanReport/.test(report), 'buildHumanReport is exported on VerumReport');
const bodyBH = report.slice(iBH, iEx);
ok(/scrubNarrative\(sec\.text\)/.test(bodyBH) && /voGatePasses\(scrub\)/.test(bodyBH),
  'every AI section passes the render-time §15.2 gate (scrubNarrative + voGatePasses)');
ok(/sec\.provenance === 'ai'/.test(bodyBH), 'only a genuine AI telling (provenance ai) can print as AI-written');
ok(/nothing here is machine-written/.test(bodyBH), 'a deterministic fallback is labelled as NOT machine-written');
ok(/COURT-READY NARRATIVE REPORT/.test(bodyBH) && !/VERUM OMNIS FORENSIC REPORT/.test(bodyBH),
  'the document is titled as a narrative report, never as the constitutional forensic report');
ok(/The verdict on any named person is reserved for the court\./.test(bodyBH), 'verdict reservation sentence is printed');
ok(/sealed under SHA-512 and anchored to the Bitcoin blockchain via OpenTimestamps/.test(bodyBH), 'certification sentence is printed');
ok(/No language-model verification of the findings is claimed/.test(bodyBH), 'provenance disclaims model verification of findings');
ok(/f\.source === 'ai'\) return false/.test(bodyBH), 'AI candidates never enter the sealed findings list');
ok(/No account on record/.test(bodyBH) && /No oath language was found/.test(bodyBH) && /None identified/.test(bodyBH),
  'empty sections state their emptiness instead of being omitted (PD6)');
for (const fn of ['secEvidenceIndex', 'secMatrix', 'secOffenceMatrix']) {
  ok(new RegExp(fn + '\\(ctx, data\\)').test(bodyBH), 'engine section ' + fn + ' renders as a contract section');
}
// Engine sections that live UNDER a contract heading render through
// engineUnder, so the PDF carries exactly fifteen numbered sections.
for (const fn of ['secStatutoryAnchoring', 'secActions', 'secEvidenceAppendix', 'secUnreadPages', 'secOcrProvenance', 'secSealExplainer']) {
  ok(new RegExp('engineUnder\\(' + fn + '\\)').test(bodyBH) && !new RegExp(fn + '\\(ctx, data\\)').test(bodyBH),
    'engine section ' + fn + ' renders under its contract heading (engineUnder)');
}
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
const optIn = html.match(/<input[^>]*id="humanReportOptIn"[^>]*>/);
ok(Boolean(optIn), 'the human-report opt-in checkbox exists');
ok(optIn && !/\bchecked\b/.test(optIn[0]), 'the human-report opt-in is OFF by default');
ok(/leave this device for that step/.test(html) && /court-ready narrative/i.test(html), 'consent copy says the excerpt leaves the device for this step');
ok(/Leave unticked for privileged or sensitive matters/.test(html), 'consent copy tells privileged users to leave it off');
ok(!/maximum 4,000 characters from the document's first pages, sent for classification\) leave this device/.test(html),
  'the stale "4,000 characters" disclosure was rewritten');
ok(/async function aiHumanReport\(/.test(html), 'aiHumanReport orchestrator is present');
ok(/aiApiPost\('\/api\/v1\/ai\/human-report'/.test(html), 'the page posts to the human-report endpoint (same-origin, relative)');
ok(/res\.machineGenerated === true/.test(html), 'the page accepts a section only when the worker marks it machine-generated');
ok(/VerumReport\.buildHumanReport\(/.test(html), 'the seal flow calls buildHumanReport');
ok(/window\._voHumanReportPack = null/.test(html), 'the human-report pack is reset');
ok(/VoSealGuard\.isSealed\(window\._voHumanReportPack\.bytes\)/.test(html), 'the human-report download is seal-guarded');
ok(/downloadHumanReport/.test(html), 'the human-report download button is wired');
ok(/-court-ready-narrative-sealed\.pdf/.test(html), 'the human report is named as a sealed narrative');
ok(/hrOpt && hrOpt\.checked && isAiReviewEnabled\(\)/.test(html), 'the step runs only behind opt-in AND AI review');
ok(!/gps/i.test(html.slice(html.indexOf('async function aiHumanReport('), html.indexOf('async function aiClassifyDocument('))),
  'the human-report payload never carries GPS or device data');
ok((html.match(/ocrPages: _voOcrRescuedPages,/g) || []).length === 2, 'the legal-analysis ocrPages lock is undisturbed');
ok(/unreadPages: _voUnreadPages,\n\s*onProgress/.test(html) && /var unread = voHumanUnreadList\(ctxIn && ctxIn\.unreadPages\)/.test(html),
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
ok(/VO_HUMAN_CALL_TIMEOUT_MS = 52000/.test(html) && /HUMAN_TIMEOUT_MS = 30000/.test(worker) && /HUMAN_FALLBACK_TIMEOUT_MS = 15000/.test(worker),
  'primary + fallback model timeouts fit inside the client wait');

// ---- the render-time gate: headings are gated, dates are not hedges --------
ok(/function voSentenceBanned\(s\)/.test(report) && /if \(voSentenceBanned\(trimmed\)\) \{ dropped\+\+; continue; \}/.test(report),
  'scrubNarrative gates headings with the same language rule');
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

console.log(`\n[human-report] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[human-report] FAILURES'); process.exit(1); }
console.log('[human-report] ALL GREEN');
