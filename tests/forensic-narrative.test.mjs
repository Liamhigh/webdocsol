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
const failedBuild = await globalThis.VerumReport.buildForensicNarrative({
  narrativeParts: [{ index: 1, count: 1, provenance: 'ai', text: 'This is a single sentence.' }]
});
ok(failedBuild.bytes === null && failedBuild.passingParts === 0,
  'a gate-failed part creates no PDF bytes');
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
ok(built.bytes instanceof Uint8Array && built.passingParts === 1 && built.totalParts === 2 && built.droppedParts === 1,
  'only the gated part is included in a standalone PDF');
ok(built.gateStats.droppedSentences === 1 && built.gateStats.workerDroppedSentences === 2,
  'the renderer returns render-time and worker gate statistics');
const renderedText = drawnText.join(' ').replace(/\s+/g, ' ');
ok(pages.length === 3 && drawnText.includes('FORENSIC NARRATIVE') &&
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
