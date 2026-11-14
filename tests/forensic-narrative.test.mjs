import fs from 'node:fs';
import vm from 'node:vm';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('seal-document.html');
const report = read('forensic-report.js');
let pass = 0, fail = 0;
const ok = (condition, message) => {
  if (condition) pass++;
  else { fail++; console.error('  FAIL: ' + message); }
};

console.log('======================================================');
console.log('RUN  forensic-narrative.test.mjs');
console.log('======================================================\n');

const buildStart = report.indexOf('async function buildForensicNarrative(');
const exportStart = report.indexOf('// ================= exports', buildStart);
const builder = report.slice(buildStart, exportStart);
ok(buildStart > report.indexOf('async function buildHumanReport(') && exportStart > buildStart,
  'the standalone builder follows the court-ready narrative renderer');
ok(/buildForensicNarrative:\s*buildForensicNarrative/.test(report), 'the standalone renderer is exported');
ok(/scrubNarrative\(prose\.join\('\\n\\n'\), voSectionPageContradictions\(part\)\)/.test(builder) &&
  /voGatePasses\(scrub\)/.test(builder), 'each standalone part passes the existing render-time language and anchor gate');
ok(/if \(!passing\.length\) return \{ bytes: null/.test(builder), 'no PDF is returned when no part passes the gate');
ok(/\/images\/logo-full\.png/.test(builder) && /doc\.embedPng\(logoBytes\)/.test(builder),
  'the title page embeds the existing Verum Omnis PNG logo');
ok(/FORENSIC NARRATIVE/.test(builder) && /PART '\s*\+ roman/.test(builder) &&
  /From '\s*\+ first\.startDate/.test(builder), 'the title page and chronological PART headings are rendered');
ok(/Source document: '\s*\+ String\(sourceDoc\.name/.test(builder) &&
  /Source SHA-512: '\s*\+ truncHash\(sourceDoc\.sha512, 24, 12\)/.test(builder) &&
  /Advisory — the findings and their anchors are the evidence; the verdict belongs to the court\./.test(builder),
  'the cover carries the source anchor, preparation, and advisory lines');
ok(/PROVENANCE & CERTIFICATION/.test(builder) && /human-v1; section: forensic_narrative/.test(builder) &&
  /droppedSentences/.test(builder) && /Findings JSON SHA-512:/.test(builder) &&
  /Verify free at https:\/\/verumglobal\.foundation\/verify\.html/.test(builder),
  'the final page records narrator provenance, gate counts, hashes, and the verification pointer');
ok(!/ctx\.table|overallScore|confidence|ENGINE_VERSION|function (?:build|seal)\(/i.test(builder),
  'the standalone narrative body has no tables, score, bands, or technical-report builder machinery');

const dateStart = html.indexOf('function voForensicNarrativeDate(');
const plannerEnd = html.indexOf('function voHumanFirstPage(', dateStart);
const datePlanSource = html.slice(dateStart, plannerEnd);
const sandbox = { Date, String, Array, Object, Math, isFinite, parseInt };
vm.createContext(sandbox);
vm.runInContext(datePlanSource + '\nthis.plan = voForensicNarrativePartPlan;', sandbox);
const short = sandbox.plan({ timeline: { events: [
  { date: '1 January 2020', page: 1, evidence: 'opening' },
  { date: '20 December 2020', page: 4, evidence: 'later' }
] }, findings: [] });
ok(short.length === 1 && short[0].count === 1 && short[0].startDate === '1 January 2020',
  'a short dated span is one part');
const long = sandbox.plan({ timeline: { events: [
  { date: '1 January 2018', page: 1, evidence: 'opening' },
  { date: '1 January 2019', page: 2, evidence: 'event one' },
  { date: '1 January 2020', page: 3, evidence: 'event two' },
  { date: '1 January 2021', page: 4, evidence: 'event three' }
] }, findings: [] });
ok(long.length === 3 && long.every((part, i) => part.index === i + 1 && part.count === 3),
  'a long dated span is divided chronologically into no more than three parts');
const fromFindings = sandbox.plan({ timeline: { events: [] }, findings: [
  { page: 2, evidence: 'dated finding', anchor: { when: ['4 March 2024'], where: [2] } }
] });
ok(fromFindings.length === 1 && fromFindings[0].startDate === '4 March 2024',
  'the plan falls back to dates anchored on findings');
ok(sandbox.plan({ timeline: { events: [{ date: '31 February 2024' }] }, findings: [] }).length === 0,
  'impossible dates do not enter the narrative plan');
ok(sandbox.plan({ timeline: { events: [] }, findings: [
  { source: 'ai', type: 'CT02', evidence: 'candidate only', page: 3, anchor: { when: ['3 January 2020'], where: [3] } }
] }).length === 0,
  'an AI candidate date cannot create or bound a narrative part');

// Greensky, 7 November 2026: dated events and 22 eligible findings existed,
// but no compliant standalone AI part was emitted; the companion court-ready
// report recorded every narrator draft gated out. The standalone product was
// the only narrative without the deterministic fallback required by DEPLOYMENT.
const fallbackStart = html.indexOf('function voDeterministicForensicNarrativeParts(');
const fallbackEnd = fallbackStart >= 0 ? html.indexOf('\nfunction ', fallbackStart + 10) : -1;
const fallbackSource = fallbackStart >= 0 && fallbackEnd > fallbackStart ? html.slice(fallbackStart, fallbackEnd) : '';
ok(fallbackStart >= 0 && /provenance:\s*'engine'/.test(fallbackSource),
  'an AI gate failure has a deterministic standalone-narrative fallback');
ok(/voDeterministicForensicNarrativeParts\(reportFraudResult/.test(html) &&
  /deterministic, page-anchored engine chronology/.test(html),
  'the pipeline uses and plainly discloses the deterministic fallback');
ok(/no valid dated events were anchored/.test(html) && /gate_failed/.test(html),
  'empty-date and narrator-gate failures receive distinct visible diagnoses');
ok(/droppedPartIndexes/.test(builder) && /renderDropped\.indexOf\(index\)/.test(html),
  'a render-gate failure is backfilled per part, not only when the whole build fails');
ok(/narrativeDocument\.gateStats\.deterministicParts/.test(html) &&
  /where the AI narrator did not supply a compliant draft/.test(html),
  'the UI counts printed deterministic parts and describes mixed output precisely');

const callStart = html.indexOf('async function aiHumanForensicNarrative(');
const callEnd = html.indexOf('// B7 triple legal verification', callStart);
const caller = html.slice(callStart, callEnd);
ok(/section:\s*'forensic_narrative'/.test(caller) && /narrativePart:\s*\{\s*index:\s*part\.index,\s*count:\s*part\.count,\s*focus:\s*part\.focus/.test(caller),
  'each worker request names the standalone section and its date-focused part');
ok(/priorSummary:\s*priorSummary/.test(caller) && /priorSummary = res\.text\.slice\(0, 1500\)/.test(caller),
  'successful parts feed their bounded text into the next part');
ok(/ctxIn\.runInput/.test(caller) && /runPacks\.forensicNarrativeInput = forensicNarrativeInput/.test(html) &&
  !/_pipelineTextBlocks|_pipelineTextSample|_pipelinePageCount|selectedFile/.test(caller),
  'narrative calls use the current run snapshot rather than shared pipeline globals');
const inputStart = html.indexOf('var forensicNarrativeInput =');
const narrativeFlowStart = html.indexOf('runPacks.forensicNarrativePack = null;', inputStart);
const inputDelete = html.indexOf('delete runPacks.forensicNarrativeInput;', narrativeFlowStart);
const narrativeFlow = html.slice(narrativeFlowStart, inputDelete);
ok(/unreadPages: voHumanUnreadList\(_voUnreadPages\)/.test(html.slice(inputStart, html.indexOf('// This run\'s private output slot', inputStart))) &&
  /unreadPages: forensicNarrativeInput\.unreadPages/.test(narrativeFlow) &&
  /sourceName: runPacks\.forensicNarrativeInput\.documentName/.test(narrativeFlow) &&
  /sha512: sha512, sealId: sealId/.test(narrativeFlow) &&
  /generatedAt: new Date\(\)\.toISOString\(\)/.test(narrativeFlow) &&
  /technicalSealId: runPacks\.reportPack\.sealId/.test(narrativeFlow) &&
  /technicalSha512: runPacks\.reportPack\.sha512/.test(narrativeFlow) &&
  /findingsJsonSha512: forensicFindingsJsonSha512/.test(narrativeFlow) &&
  /model: forensicDraft\.model/.test(narrativeFlow) &&
  /gateStats: forensicDraft\.parts\.map/.test(narrativeFlow),
  'the run snapshot supplies unread-page data and source metadata through sealing');
ok(/runPacks\.forensicNarrativePack/.test(html) && /window\._voShareFiles\.push\(\{ bytes: runPacks\.forensicNarrativePack\.bytes/.test(html),
  'the standalone sealed output is run-isolated and included in the share bundle');
ok(/The forensic narrative could not be written within the Constitution\\?'s rules this run/.test(html),
  'the results flow states plainly when no compliant narrative is available');

const drawnText = [], pages = [];
const font = { widthOfTextAtSize: (text, size) => String(text).length * size * 0.52 };
const fakePdf = {
  embedFont: async () => font,
  embedPng: async () => ({ width: 400, height: 400 }),
  addPage: () => {
    const page = {
      drawRectangle: () => {},
      drawImage: () => {},
      drawText: (text, options) => { drawnText.push(String(text)); if (options) drawnY.push(options.y); },
      drawLine: () => {}
    };
    pages.push(page);
    return page;
  },
  setTitle: () => {},
  setAuthor: () => {},
  setProducer: () => {},
  setCreationDate: () => {},
  save: async () => new Uint8Array([1, 2, 3])
};
const drawnY = [];
globalThis.PDFLib = {
  rgb: (r, g, b) => ({ r, g, b }),
  StandardFonts: { TimesRoman: 'times', TimesRomanBold: 'times-bold', TimesRomanItalic: 'times-italic' },
  PDFDocument: { create: async () => fakePdf }
};
await import(new URL('../forensic-report.js', import.meta.url));

const helperStart = html.indexOf('function voHumanFirstPage(');
const helperEnd = html.indexOf('function voHumanPayloadFinding(', helperStart);
const fallbackSandbox = { window: { VerumReport: globalThis.VerumReport }, Date, String, Array, Object, Math, isFinite, parseInt };
vm.createContext(fallbackSandbox);
vm.runInContext(datePlanSource + '\n' + html.slice(helperStart, helperEnd) + '\n' + fallbackSource +
  '\nthis.makeFallback = voDeterministicForensicNarrativeParts;', fallbackSandbox);
const fallbackInput = {
  findings: [
    { type: 'CT02', evidence: 'The agreement carries two different dates', location: 'Page 2', page: 2,
      anchor: { when: ['2 January 2020'], where: [2] } },
    { type: 'CT02', source: 'ai', evidence: 'AI-ONLY CANDIDATE TEXT', location: 'Page 3', page: 3,
      anchor: { when: ['3 January 2020'], where: [3] } }
  ],
  timeline: { events: [
    { source: 'document', date: '1 January 2020', page: 1, evidence: 'Agreement signed on 1 January 2020 by Acme.' },
    { source: 'finding', type: 'CT02', date: '2 January 2020', page: 2, evidence: 'The agreement carries two different dates' },
    { source: 'finding', type: 'CT02', date: '3 January 2020', page: 3, evidence: 'AI-ONLY CANDIDATE TEXT' }
  ] }
};
const fallbackRun = { runInput: { textBlocks: [
  'Agreement signed on 1 January 2020 by Acme.',
  'The second agreement date is recorded here.',
  'AI-ONLY CANDIDATE TEXT'
] } };
const fallbackPlan = [{ index: 1, count: 1, startDate: '1 January 2020', endDate: '3 January 2020' }];
const fallbackParts = fallbackSandbox.makeFallback(fallbackInput, fallbackRun, fallbackPlan);
ok(fallbackParts.length === 1 && fallbackParts[0].provenance === 'engine' &&
  fallbackParts[0].text.includes('Agreement signed on 1 January 2020 by Acme.') &&
  fallbackParts[0].text.includes('[F1]') && !fallbackParts[0].text.includes('AI-ONLY'),
  'the fallback uses verified page text and engine findings, never AI candidates');
const tamperedFallback = fallbackSandbox.makeFallback(fallbackInput, {
  runInput: { textBlocks: ['A different page', 'The second agreement date is recorded here.', 'AI-ONLY CANDIDATE TEXT'] }
}, fallbackPlan);
ok(!tamperedFallback[0].text.includes('Agreement signed'),
  'a document quotation that no longer verifies against the sealed page is omitted');
const anchorPageFallback = fallbackSandbox.makeFallback({
  findings: [{ type: 'CT02', evidence: 'The dates differ', location: 'Pages 8-9',
    anchor: { when: ['2 January 2020'], where: [9] } }], timeline: { events: [] }
}, fallbackRun, [{ index: 1, count: 1, startDate: '2 January 2020', endDate: '2 January 2020' }]);
ok(anchorPageFallback[0].text.includes('2 January 2020 on p. 9') &&
  !anchorPageFallback[0].text.includes('2 January 2020 on p. 8'),
  'a multi-page finding uses its own date anchor rather than the first display-location page');
const timelineAnchorFallback = fallbackSandbox.makeFallback({
  findings: [{ type: 'CT02', evidence: 'The dates differ', location: 'Page 8', page: 8,
    anchor: { when: [], where: [9] } }],
  timeline: { events: [{ source: 'finding', type: 'CT02', evidence: 'The dates differ', date: '2 January 2020', page: 9 }] }
}, fallbackRun, [{ index: 1, count: 1, startDate: '2 January 2020', endDate: '2 January 2020' }]);
ok(timelineAnchorFallback[0] && timelineAnchorFallback[0].text.includes('2 January 2020 on p. 9'),
  'timeline matching and direct finding output use the same anchor-page key');
ok(fallbackSandbox.makeFallback({ findings: [{ source: 'ai', type: 'CT02', evidence: 'candidate', page: 1 }],
  timeline: fallbackInput.timeline }, fallbackRun, fallbackPlan).length === 0,
  'AI-only material cannot manufacture a deterministic standalone report');
const deterministicBuild = await globalThis.VerumReport.buildForensicNarrative({
  images: { logo: new Uint8Array([1]) },
  documents: [{ name: 'record.pdf', pageCount: 3, sha512: 'd'.repeat(128), sealId: 'VO-SOURCE' }],
  narrativeParts: fallbackParts,
  gateStats: [{ kept: 1, dropped: 8 }]
});
const deterministicText = drawnText.join(' ').replace(/\s+/g, ' ');
ok(deterministicBuild.bytes instanceof Uint8Array && deterministicBuild.gateStats.deterministicParts === 1 &&
  deterministicText.includes('Prepared by Verum Omnis — deterministic forensic chronology over the sealed record') &&
  deterministicText.includes('no AI-generated prose is printed'),
  'the Greensky failure shape now renders a standalone PDF with honest deterministic provenance');
const failedEngineBuild = await globalThis.VerumReport.buildForensicNarrative({
  narrativeParts: [{ index: 1, count: 1, provenance: 'engine', text: 'This proves the respondent committed fraud.' }]
});
ok(failedEngineBuild.bytes === null && failedEngineBuild.passingParts === 0,
  'deterministic provenance does not bypass the existing render-time language gate');

const failedBuild = await globalThis.VerumReport.buildForensicNarrative({
  narrativeParts: [{ index: 1, count: 1, provenance: 'ai', text: 'This is a single sentence.' }]
});
ok(failedBuild.bytes === null && failedBuild.passingParts === 0,
  'a gate-failed part creates no PDF bytes');
const pageCountBeforeBuilt = pages.length;
const built = await globalThis.VerumReport.buildForensicNarrative({
  images: { logo: new Uint8Array([1]) },
  documents: [{ name: 'record.pdf', pageCount: 12, sha512: 'a'.repeat(128), sealId: 'VO-SOURCE' }],
  generatedAt: '2026-10-17T06:25:14.548Z',
  technicalSealId: 'VO-TECHNICAL',
  technicalSha512: 'b'.repeat(128),
  findingsJsonSha512: 'c'.repeat(128),
  model: 'test-narrator',
  gateStats: [{ dropped: 2 }],
  narrativeParts: [
    { index: 1, count: 2, startDate: '1 January 2020', endDate: '2 January 2020', provenance: 'ai',
      text: 'PART I — WHAT THE DOCUMENTS SHOWED\n\nThe document records a payment on 1 January 2020 on p. 1. The letter records a second payment on 2 January 2020 on p. 2. The directors committed fraud.' },
    { index: 2, count: 2, provenance: 'none', reason: 'gate_failed' }
  ]
});
ok(built.bytes instanceof Uint8Array && built.passingParts === 1 && built.totalParts === 2 && built.droppedParts === 1 &&
  built.droppedPartIndexes.length === 1 && built.droppedPartIndexes[0] === 1,
  'only the gated part is included and its exact index is returned for fallback substitution');
ok(built.gateStats.droppedSentences === 1 && built.gateStats.workerDroppedSentences === 2,
  'the renderer returns render-time and worker gate statistics');
const renderedText = drawnText.join(' ').replace(/\s+/g, ' ');
ok(pages.length - pageCountBeforeBuilt === 3 && drawnText.includes('FORENSIC NARRATIVE') &&
  drawnText.some((text) => text.indexOf('PART I — WHAT THE DOCUMENTS SHOWED') === 0) &&
  drawnText.some((text) => text.indexOf('The document records a payment') === 0) &&
  renderedText.includes('Source document: record.pdf (12 pages)') &&
  renderedText.includes('Source SHA-512: ' + 'a'.repeat(24) + '…' + 'a'.repeat(12)) &&
  renderedText.includes('Source seal: VO-SOURCE') &&
  renderedText.includes('Generated: 2026-10-17T06:25:14.548Z') &&
  renderedText.includes('Prepared by Verum Omnis — AI forensic narrator over the sealed record') &&
  renderedText.includes('Advisory — the findings and their anchors are the evidence; the verdict belongs to the court.') &&
  renderedText.includes('PROVENANCE & CERTIFICATION') &&
  renderedText.includes('Narrator model: test-narrator. Contract: human-v1; section: forensic_narrative.') &&
  renderedText.includes('1 sentence was removed by those gates.') &&
  renderedText.includes('Sealed technical report SHA-512: ' + 'b'.repeat(24) + '…' + 'b'.repeat(12) + '; seal id: VO-TECHNICAL.') &&
  renderedText.includes('Findings JSON SHA-512: ' + 'c'.repeat(24) + '…' + 'c'.repeat(12) + '.') &&
  renderedText.includes("This narrative's own seal id and SHA-512 appear in the seal footer of every page.") &&
  renderedText.includes('Verify free at https://verumglobal.foundation/verify.html'),
  'the renderer draws the anchored cover and final provenance page as flowing prose');
// Sourcery finding on Liamhigh/webdocsol#252: a gate-failing part with AI provenance must be
// dropped even when a sibling passes — the 'none' fixture above is rejected
// before the gate and cannot catch a gate-bypass regression.
const mixedBuild = await globalThis.VerumReport.buildForensicNarrative({
  images: { logo: new Uint8Array([1]) },
  documents: [{ name: 'record.pdf' }],
  narrativeParts: [
    { index: 1, count: 2, startDate: '1 January 2020', endDate: '2 January 2020', provenance: 'ai',
      text: 'The document records a payment on 1 January 2020 on p. 1. The letter records a second payment on 2 January 2020 on p. 2.' },
    { index: 2, count: 2, startDate: '3 January 2020', endDate: '4 January 2020', provenance: 'ai',
      text: 'The affidavit clearly proves the respondents fraudulent intentions beyond any doubt.' }
  ]
});
ok(mixedBuild.bytes instanceof Uint8Array && mixedBuild.passingParts === 1 && mixedBuild.droppedParts === 1,
  'a gate-failing AI part is omitted even when a sibling part passes');
// Sourcery finding on Liamhigh/webdocsol#252: the planner must accept every engine date format.
{
  const htmlSrc = await import('node:fs').then((fs) => fs.readFileSync(new URL('../seal-document.html', import.meta.url), 'utf8'));
  const fnMatch = htmlSrc.match(/function voForensicNarrativeDate\([\s\S]*?\n\}/);
  const voForensicNarrativeDate = new Function('value', 'return (function(value){' + fnMatch[0].replace(/^function voForensicNarrativeDate\(value\) \{/, '').replace(/\n\}$/, '') + '})(value)');
  const formats = ['2020-01-05', '5 January 2020', '5 jan 2020', 'January 5, 2020', 'jan 5 2020', '05/01/2020', '5-1-2020', '05.01.2020', '5.1.20'];
  ok(formats.every((f) => { const v = voForensicNarrativeDate(f); return v && v.key === 20200105; }),
    'the narrative planner accepts every date format the forensic engine tokenizes');
}
const pageCountBeforeLong = pages.length, textCountBeforeLong = drawnY.length;
await globalThis.VerumReport.buildForensicNarrative({
  images: { logo: new Uint8Array([1]) },
  narrativeParts: [{ index: 1, count: 1, startDate: '1 January 2020', endDate: '2 January 2020', provenance: 'ai',
    text: 'The record states a dated event on p. 1. ' + 'The record states another dated event on p. 2. '.repeat(1200) }]
});
ok(pages.length - pageCountBeforeLong > 2 && drawnY.slice(textCountBeforeLong).every((y) => y >= 62),
  'long narrative paragraphs continue across pages without drawing below the bottom margin');

console.log(`\n[forensic-narrative] PASS=${pass} FAIL=${fail}`);
if (fail > 0) process.exit(1);
console.log('[forensic-narrative] ALL GREEN');
