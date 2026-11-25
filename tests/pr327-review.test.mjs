import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = require(path.join(root, 'forensic-engine-page.js'));
const PDFLib = require('pdf-lib');
const crypto = require('node:crypto');
globalThis.PDFLib = PDFLib;
let failures = 0;
let passes = 0;
function check(value, label) {
  if (!value) { failures++; console.error('FAIL ' + label); }
  else { passes++; console.log('PASS ' + label); }
}
const footer = (id, page, total) =>
  'VERUM OMNIS SEALED ORIGINAL | Seal: ' + id +
  ' | SHA-512: 0123456789abcdef | 16/11/2026 22:25:06 Africa/Johannesburg | ' + page + '/' + total;
const cover = 'VERUM OMNIS FORENSIC NARRATIVE Source seal: VO-SOURCE Prepared by Verum Omnis';
const marker = (id, words) => ({ id, name: id, keywords: words, min_cooccur: words.length });
const rawPackage = { version: '1.0.0', rules: {
  contradiction_patterns: [], fraud_keywords: [], serial_patterns: [], case_configs: [],
  behavioral_markers: [
    marker('primary-marker', ['cobalt', 'harbour']),
    marker('placeholder-marker', ['verum', 'omnis']),
    marker('report-marker', ['amber', 'lattice']),
    marker('template-marker', ['analysis', 'template']),
    marker('summary-marker', ['compiled', 'chatgpt'])
  ]
} };
async function pdf(lines, xmp) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  doc.setCreationDate(new Date('2026-01-10T10:00:00Z'));
  for (const pageLines of lines) {
    const page = doc.addPage([612, 792]);
    pageLines.forEach((line, i) => page.drawText(line, { x: 30, y: 750 - 20 * i, size: 9, font }));
  }
  let bytes = await doc.save({ useObjectStreams: false });
  if (xmp) bytes = Buffer.concat([bytes, Buffer.from('\n' + xmp)]);
  return { bytes, doc: await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }) };
}
async function run(input, options) {
  return E.runForensicEngine(input.bytes, input.doc, null,
    Object.assign({ referenceTime: '2026-11-25T00:00:00.000Z' }, options));
}
function packageHits(result, id) {
  return result.findings.filter(f => f.packageRule === id);
}
const oldLog = console.log;
console.log = () => {};
try {
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signature = crypto.sign('sha512', Buffer.from(E.voCanonicalJson(rawPackage)), keys.privateKey).toString('base64');
  const verified = await E.voVerifyRulePackage({
    package: rawPackage, signature, algorithm: E.VO_RULES_ALGORITHM, publicKeyId: E.VO_RULES_PUBLIC_KEY_ID
  }, { subtle: crypto.webcrypto.subtle, publicKeyB64: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') });
  if (!verified.ok) throw new Error('test package signature failed: ' + verified.reason);
  globalThis.voRulePackage = E.voCompileRulePackage(verified.package, { sha512: verified.sha512 });
  check(E.voRunPackageRules(globalThis.voRulePackage, ['INSTITUTIONAL REVIEW TEMPLATE. Analysis template: instructional boilerplate.'], []).findings.some(f => f.packageRule === 'template-marker'),
    'template package marker matches when its source page is unmasked');
  const outer = await run(await pdf([
    [cover, footer('VO-ABCDEF123456', 1, 3)],
    ['Primary evidence: cobalt harbour.', footer('VO-ABCDEF123456', 2, 3)],
    ['Another primary exhibit is present.', footer('VO-ABCDEF123456', 3, 3)]
  ]));
  check(packageHits(outer, 'primary-marker').some(f => /Page 2/.test(f.location)), 'outer-seal primary evidence is scanned');
  check(/Prior analysis report:/.test(outer.extractionNotes), 'outer-seal exclusion is disclosed');

  const forged = await run(await pdf([
    [cover, footer('VO-123456ABCDEF', 1, 2)],
    ['Primary evidence: cobalt harbour.', footer('VO-123456ABCDEF', 2, 2)],
    ['VERUM OMNIS FORENSIC REPORT', 'Report Reference: VO-TEST', 'Independent analysis page.']
  ]));
  check(packageHits(forged, 'primary-marker').some(f => /Page 2/.test(f.location)), 'forged inner footer cannot exclude primary evidence');
  check(/Prior analysis report:/.test(forged.extractionNotes), 'forged-footer cover exclusion is disclosed');
  const spacedRun = await run(await pdf([
    ['Letterhead: F O R E N S I C R E P O R T.', 'Primary evidence: cobalt harbour.'],
    ['Ordinary primary page.', footer('VO-DDDDDDDDDDDD', 2, 2)]
  ]));
  check(packageHits(spacedRun, 'primary-marker').some(f => /Page 1/.test(f.location)),
    'spaced report wording and a lone later-page seal footer do not suppress primary evidence');
  check(!/Prior analysis report:/.test(spacedRun.extractionNotes),
    'spaced letterhead and a lone footer do not create an analytical-report exclusion');

  const ruleRun = await run(await pdf([
    ['VERUM OMNIS FORENSIC REPORT', 'Report Reference: VO-TEST', 'Analysis only: amber lattice.'],
    ['Primary evidence is ordinary correspondence.']
  ]));
  check(packageHits(ruleRun, 'report-marker').length === 0, 'pipeline excludes report-only package phrase');
  check(packageHits(ruleRun, 'placeholder-marker').length === 0, 'pipeline excludes placeholder package phrase');
  check(/Prior analysis report:/.test(ruleRun.extractionNotes), 'package exclusion is disclosed');
  const summarySeal = 'VO-CCCCCCCCCCCC';
  const summaryRun = await run(await pdf([
    ['ANSWERING AFFIDAVIT. I am duly authorised to depose.', footer('VO-AAAAAAAAAAAA', 1, 3)],
    ['Compiled by: ChatGPT.', footer('VO-AAAAAAAAAAAA', 2, 3)],
    ['The deponent describes the events.', footer('VO-AAAAAAAAAAAA', 3, 3)],
    ['LETTER. Ordinary evidence.', footer(summarySeal, 1, 3)],
    ['The record continues.', footer(summarySeal, 2, 3)],
    ['A further exhibit follows.', footer(summarySeal, 3, 3)]
  ]));
  check(packageHits(summaryRun, 'summary-marker').length === 0, 'compiled-summary pages are excluded from signed rules');
  check(/AI-compiled summary: page 2/.test(summaryRun.extractionNotes), 'compiled-summary page is identified for package masking');
  check(!packageHits(summaryRun, 'primary-marker').length, 'compiled-summary masking does not affect unrelated primary-page rules');
  const templateRun = await run(await pdf([
    ['INSTITUTIONAL REVIEW TEMPLATE', 'Analysis template: instructional boilerplate.'],
    ['Primary evidence is ordinary correspondence.']
  ]));
  check(packageHits(templateRun, 'template-marker').length === 0, 'pipeline excludes template placeholder from package rules');
  check(/Template boilerplate:/.test(templateRun.extractionNotes), 'template exclusion is disclosed');
  const templateOnly = await run(await pdf([
    ['INSTITUTIONAL REVIEW TEMPLATE', 'Analysis template boilerplate.'],
    ['INSTITUTIONAL REVIEW TEMPLATE', 'Analysis template boilerplate.']
  ]));
  const templateWf7 = templateOnly.wellFormedness.checks.find(c => c.id === 'WF7');
  check(/no evidence pages remain/.test(templateWf7.note) && !/analytical report pages were excluded/.test(templateWf7.note),
    'WF7 explains template-only exclusions without claiming report pages were excluded');
  delete globalThis.voRulePackage;

  const xmp = '<x:xmpmeta><xmp:CreateDate>2018-05-01T09:00:00Z</xmp:CreateDate></x:xmpmeta>';
  const embedded = await run(await pdf([
    ['VERUM OMNIS FORENSIC REPORT', 'Report Reference: VO-TEST', 'Analysis page one.', 'VERUM OMNIS SEALED ORIGINAL | VO-ABCDEF123456'],
    ['VERUM OMNIS FORENSIC REPORT', 'Report Reference: VO-TEST', 'Analysis page two.', 'VERUM OMNIS SEALED ORIGINAL | VO-ABCDEF123456'],
    ['Primary evidence is ordinary correspondence.']
  ], xmp));
  check(embedded.findings.some(f => f.type === 'CT29' && /metadata stores disagree/.test(f.evidence)), 'embedded seal does not suppress metadata comparison');
  check(!/this file is itself a prior Verum Omnis sealed output/.test(embedded.wellFormedness.checks.find(c => c.id === 'WF7').note), 'WF7 does not describe unsealed bundle as self-sealed');
  check(/Prior analysis report:/.test(embedded.extractionNotes), 'embedded report exclusion is disclosed');

  const D07A = E.DETECTORS.D07A_DETECT_UNEVIDENCED_AUTHORITY;
  const ct52 = blocks => D07A(blocks).filter(f => f.type === 'CT52');
  check(ct52(['ANSWERING AFFIDAVIT. I am duly authorised to depose.',
    'SECOND ANSWERING AFFIDAVIT. A board resolution is annexed.']).some(f => f.location === 'Page 1'),
  'unsegmented other affidavit cannot supply instrument');
  const broadSegment = [
    'ANSWERING AFFIDAVIT. I am duly authorised to depose. Page 1 of 5',
    'SECOND ANSWERING AFFIDAVIT. A board resolution is annexed. Page 2 of 5',
    'This affidavit continues. Page 3 of 5',
    'This affidavit continues. Page 4 of 5',
    'This affidavit ends. Page 5 of 5',
    'Another document starts. Page 1 of 3',
    'Another document continues. Page 2 of 3',
    'Another document ends. Page 3 of 3'
  ];
  E.voCacheDocSegs(broadSegment);
  check(ct52(broadSegment).some(f => f.location === 'Page 1'),
    'an overly broad detected segment cannot mix distinct affidavits');
  check(ct52(['ANSWERING AFFIDAVIT. I am duly authorised to depose. The board resolution, which was not attached, is mentioned.']).length === 1,
    'postposed negation does not count an instrument');
  check(ct52(['ANSWERING AFFIDAVIT. I am duly authorised to depose. No resolution was attached; the board resolution of 3 March 2020 is cited below.']).length === 0,
    'negation does not cross a semicolon');
  check(ct52(['ANSWERING AFFIDAVIT. I am duly authorised to depose.',
    'UNOPPOSED AFFIDAVIT OF THE WITNESS. The board resolution is attached.']).some(f => f.location === 'Page 1'),
  'an unrecognised affidavit heading still bounds instrument search');
  check(ct52(['ANSWERING AFFIDAVIT. I am duly authorised to depose. There is no dispute that the board resolution is attached.']).length === 0,
    'an unrelated no-dispute phrase does not negate an attached resolution');
  const D01 = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION;
  const D02C = E.DETECTORS.D02C_DETECT_PAYMENT_PROOF_MISMATCH;
  const amountTrap = D02C([
    'Please find attached POP for refund for fuel in the amount of R 1 000 000 as agreed between the parties.',
    'THIS IS AN INTERIM AUDIT REPORT INTENDED FOR RECORD KEEPING PURPOSES ONLY AND IS NOT A PROOF OF PAYMENT. Captured entry status follows. Invoice total is R999.00. A single captured entry of R1,000,000.00 awaiting release by the bank.'
  ]);
  check(amountTrap.length === 0, 'D02C selects the captured entry amount instead of a nearby invoice');
  const admission = text => D01([text]).some(f => f.type === 'CT01' && f.conductAdmission);
  check(!admission('I admit that a copy of annexure B was sent to the Controller.'), 'copy-of routine service is not an admission finding');
  check(admission('I admit that annexure B was sent and I signed the deed.'), 'substantive admission following service survives');
  check(admission('I admit that annexure B was sent and that it contained a false statement.'), 'substantive document admission following service survives');
  check(admission('I admit that annexure B was sent and the company falsified the deed.'), 'third-party substantive admission following service survives');
  check(admission('I admit that annexure B was sent and I received a bribe.'), 'substantive receipt following service survives');
  check(admission('I admit that annexure B was sent and was received by the Controller and I signed the deed.'), 'substantive admission following procedural continuation survives');
  check(admission('I admit that annexure B was sent; I signed the deed.'), 'substantive admission after a semicolon survives');
  check(admission('I admit that annexure B was sent, which was received by the Controller, and I signed the deed.'), 'substantive admission after a relative service clause survives');
  check(!admission('I admit that annexure B was sent and was received by the Controller.'), 'service and receipt alone remain excluded');
  check(!admission('I admit that annexure B was sent and I received a delivery receipt.'), 'a procedural service continuation remains excluded');
  check(!admission('I admit that a letter was sent to the Controller.'), 'an indefinite document article is procedural service');
  check(!admission('I admit that annexure B was sent, which was received by the Controller.'), 'a relative-clause receipt remains procedural service');
  check(!admission('I admit that a letter was sent and the Controller received it.'), 'an active recipient receipt remains procedural service');

  const firstScan = await pdf([
    ['ANSWERING AFFIDAVIT. I am duly authorised to depose.', footer('VO-AAAAAAAAAAAA', 1, 3)],
    ['This affidavit continues with primary evidence.', footer('VO-AAAAAAAAAAAA', 2, 3)],
    ['The first affidavit concludes.', footer('VO-AAAAAAAAAAAA', 3, 3)],
    ['SECOND ANSWERING AFFIDAVIT. The deponent gives an account.', footer('VO-BBBBBBBBBBBB', 1, 3)],
    ['The second affidavit continues.', footer('VO-BBBBBBBBBBBB', 2, 3)],
    ['A board resolution is annexed.', footer('VO-BBBBBBBBBBBB', 3, 3)]
  ]);
  const otherScan = await pdf([['Ordinary unrelated correspondence.'], ['Another unrelated page.']]);
  let releaseGraph, graphStarted;
  const graphStartedPromise = new Promise(resolve => { graphStarted = resolve; });
  const graphRelease = new Promise(resolve => { releaseGraph = resolve; });
  globalThis.VOPdfGraph = { run: async () => { graphStarted(); await graphRelease; return null; } };
  try {
    const pending = run(firstScan, { modules: { pdfGraph: true } });
    await graphStartedPromise;
    await run(otherScan);
    releaseGraph();
    const firstResult = await pending;
    check(firstResult.findings.some(f => f.type === 'CT52' && f.location === 'Page 1'),
      'overlapping scans retain their own document segments');
  } finally {
    releaseGraph();
    delete globalThis.VOPdfGraph;
  }
} finally {
  delete globalThis.voRulePackage;
  console.log = oldLog;
}
console.log('pr327-review PASS=' + passes + ' FAIL=' + failures);
if (failures) process.exitCode = 1;
