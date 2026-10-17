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
ok(!/ctx\.table|overallScore|confidence|ENGINE_VERSION|technical report/i.test(builder),
  'the standalone narrative body has no tables, score, bands, or technical report machinery');

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
      drawText: (text) => drawnText.push(String(text)),
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
  documents: [{ name: 'record.pdf' }],
  narrativeParts: [
    { index: 1, count: 2, startDate: '1 January 2020', endDate: '2 January 2020', provenance: 'ai',
      text: 'PART I — WHAT THE DOCUMENTS SHOWED\n\nThe document records a payment on 1 January 2020 on p. 1. The letter records a second payment on 2 January 2020 on p. 2.' },
    { index: 2, count: 2, provenance: 'none', reason: 'gate_failed' }
  ]
});
ok(built.bytes instanceof Uint8Array && built.passingParts === 1 && built.totalParts === 2 && built.droppedParts === 1,
  'only the gated part is included in a standalone PDF');
ok(pages.length === 2 && drawnText.includes('FORENSIC NARRATIVE') &&
  drawnText.some((text) => text.indexOf('PART I — WHAT THE DOCUMENTS SHOWED') === 0) &&
  drawnText.some((text) => text.indexOf('The document records a payment') === 0),
  'the renderer draws the title page, a PART heading, and flowing prose without a table layout');

console.log(`\n[forensic-narrative] PASS=${pass} FAIL=${fail}`);
if (fail > 0) process.exit(1);
console.log('[forensic-narrative] ALL GREEN');
