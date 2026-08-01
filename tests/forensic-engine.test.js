// Tests for forensic-engine-page.js — the forensic contradiction engine that
// actually ships in the pages (index.html / seal-document.html load
// forensic-engine-page.js, not forensic-engine.js).
//
// Run:  node tests/forensic-engine.test.js
// No external dependencies — Node built-ins only.

const path = require('path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const { DETECTORS, SERIAL_PATTERNS, detectSerialPatterns, runForensicEngine } = E;
const t = require('./_assert');

// ---- 1. Robustness sweep: no detector may throw on realistic edge inputs ----
const mockPdfDoc = {
  getProducer: () => '', getCreator: () => '',
  getCreationDate: () => null, getModificationDate: () => null,
  getPages: () => [{}],
};
const edgeInputs = [
  [],
  [''],
  ['   '],
  ['normal text with nothing special'],
  ['a'.repeat(100000)],
  ['R1,000.00 total', 'R50,000.00 subtotal'],
  ['\n\n\t\t weird   chars'],
];
for (const dn of Object.keys(DETECTORS)) {
  const fn = DETECTORS[dn];
  for (const input of edgeInputs) {
    let out;
    if (dn === 'D15_DETECT_METADATA_FRAUD' || dn === 'D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH') {
      out = t.noThrow(() => fn(mockPdfDoc), dn + ' (pdfDoc)');
    } else if (dn === 'D16_DETECT_FONT_ANOMALY') {
      out = t.noThrow(() => fn(input, mockPdfDoc), dn + ' (textBlocks,pdfDoc)');
    } else if (dn === 'D37_DETECT_INTERNAL_CONFLICT_CATCHALL') {
      out = t.noThrow(() => fn(input, []), dn + ' (textBlocks,findings)');
    } else {
      out = t.noThrow(() => fn(input), dn);
    }
    t.ok(Array.isArray(out), dn + ' returns an array');
  }
}

// ---- 2. Positive-trigger tests: known contradictions must be detected ----
const fires = (fn, input, type, name) => {
  const out = fn(input);
  t.ok(out.length > 0 && out.some(f => f.type === type), name + ' fires (' + out.length + ' findings)');
};
fires(DETECTORS.D01_DETECT_DIRECT_CONTRADICTION, ['payment was paid', 'it was not paid'], 'CT01', 'D01 paid/not-paid');
// D02 compares a labelled quantity against itself across the document. The
// same "Total" stated at two different values is the contradiction; two
// different line items that merely differ in size are not.
fires(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY, ['Total R50,000.00', 'Total R10,000.00'], 'CT02', 'D02 amount variance');
fires(DETECTORS.D03_DETECT_DATE_INCONSISTENCY, ['Signed 31/02/2024 by hand'], 'CT03', 'D03 impossible Feb date');
fires(DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY, ['before the incident and also after the incident'], 'CT04', 'D04 temporal conflict');

// D12 bank-detail: fires only for numbers next to banking context, and NEVER
// for dates/years/reference numbers (the annexure-EB false positive:
// "11 different account numbers found: 11122018, 16689375, 20162017").
fires(DETECTORS.D12_DETECT_BANK_DETAIL_MISMATCH,
  ['Bank account 62834571902 for payment', 'Please use account no 40190283746 instead'],
  'CT18', 'D12 fires for two real account numbers near banking context');
t.ok(DETECTORS.D12_DETECT_BANK_DETAIL_MISMATCH(
  ['Signed 11122018 and dated 20162017', 'Case reference 16689375 filed', 'meeting on 15032024']
).length === 0, 'D12 no false-positive on dates / years / case numbers (annexure-EB regression)');
t.ok(DETECTORS.D12_DETECT_BANK_DETAIL_MISMATCH(
  ['the account number 62834571902 appears once only']
).length === 0, 'D12 no finding when only one account number is present');

t.ok(DETECTORS.D15_DETECT_METADATA_FRAUD({
  getProducer: () => 'Adobe Photoshop 2024', getCreator: () => '',
  getCreationDate: () => null, getModificationDate: () => null,
}).length > 0, 'D15 detects image-editor producer');

t.ok(DETECTORS.D15_DETECT_METADATA_FRAUD({
  getProducer: () => '', getCreator: () => '',
  getCreationDate: () => new Date('2024-06-01'),
  getModificationDate: () => new Date('2024-01-01'),
}).length > 0, 'D15 detects modification-before-creation');

t.ok(DETECTORS.D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH({
  getProducer: () => 'Scan to PDF', getCreator: () => 'Microsoft Word',
}).length > 0, 'D20 detects "scanned" claim with word-processor metadata');

// ---- 3. Clean document: no false positives on benign content ----
const clean = ['This is a normal letter. Everything is consistent. Thank you for your business.'];
t.ok(DETECTORS.D01_DETECT_DIRECT_CONTRADICTION(clean).length === 0, 'D01 no false-positive on clean text');
t.ok(DETECTORS.D03_DETECT_DATE_INCONSISTENCY(['Dated 15 March 2024']).length === 0, 'D03 no false-positive on valid date');
t.ok(DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY(clean).length === 0, 'D04 no false-positive on clean text');

// D01 must not fire on opposing words that merely both appear somewhere. It
// used to flag any document containing both "true" and "false" (or paid/not
// paid pages apart) -- garbage on ordinary legal prose.
t.ok(DETECTORS.D01_DETECT_DIRECT_CONTRADICTION(
  ['We value the truth. Falsehood is condemned.']).length === 0,
  'D01 no false-positive on unrelated true/false wording');
t.ok(DETECTORS.D01_DETECT_DIRECT_CONTRADICTION(
  ['The deposit was paid on time.', 'x'.repeat(300), 'The final invoice was not paid.']).length === 0,
  'D01 does not flag paid / not paid that are far apart');
t.ok(DETECTORS.D01_DETECT_DIRECT_CONTRADICTION(
  ['The invoice was paid, yet the ledger says it was not paid.']).some(f => f.type === 'CT01'),
  'D01 still fires when paid and not paid are in the same passage');

// D17 must not flag normal page-length variation (title page vs dense page).
// Only a near-blank page among full ones is a real signal.
t.ok(DETECTORS.D17_DETECT_FORMAT_ANOMALY(
  ['A sparse cover page with a title and a few lines of text.'.repeat(5), 'x'.repeat(2000), 'y'.repeat(1500), 'z'.repeat(2500)]).length === 0,
  'D17 no false-positive on ordinary page-length variation');
t.ok(DETECTORS.D17_DETECT_FORMAT_ANOMALY(
  ['x'.repeat(2000), 'y'.repeat(1800), '', 'z'.repeat(2200)]).some(f => f.type === 'CT26'),
  'D17 flags a near-blank page among full ones');

// An itemised invoice is not a contradiction. D02 used to compare every amount
// against every other, so ordinary line items produced a finding per pair --
// 739 of 742 findings on the repo's test document came from this one detector.
t.ok(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY(
  ['Consulting R120,000.00', 'Travel R8,500.00', 'Licence fee R64,000.00']
).length === 0, 'D02 no false-positive across unrelated line items');
// One statement of a quantity cannot contradict anything.
t.ok(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY(['Total R50,000.00']).length === 0,
  'D02 quiet when a label appears once');
// A label that states no amount must not reach past the next label and adopt
// its figure. Scanning a fixed distance forward read the Deposit below as a
// second Total and manufactured a 179% discrepancy that is not in the text --
// a fabricated allegation, the worst failure available to a forensic detector.
t.ok(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY(
  ['Total R50,000.00 for the works. Total: refer to annexure. Deposit R900,000.00 held in trust.']
).length === 0, 'D02 does not borrow a neighbouring label\'s amount');
// Amounts still bind to their own label when labels sit close together.
t.ok(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY(
  ['Total R50,000.00 Subtotal R44,000.00 Total R70,000.00']
).some(f => /R50,000\.00.*R70,000\.00/.test(f.evidence)),
  'D02 binds each amount to its own adjacent label');

// D03: a labelled date restated at a different value is a contradiction; a
// consistent date, a different label's date, or an ambiguous numeric date is
// not. Numeric forms are skipped deliberately -- day/month order is ambiguous
// and a false "restated date" would be a fabricated allegation.
const d03restate = (input) => DETECTORS.D03_DETECT_DATE_INCONSISTENCY(input).filter(f => f.evidence.includes('is stated as'));
t.ok(d03restate(['Effective Date: January 15, 2023', 'Effective Date: March 1, 2023']).length === 1,
  'D03 fires when a labelled date is restated differently');
t.ok(d03restate(['Effective Date: January 15, 2023', 'Effective Date: January 15, 2023']).length === 0,
  'D03 quiet when the labelled date is consistent');
t.ok(d03restate(['Effective Date: January 15, 2023 Execution Date: January 10, 2023']).length === 0,
  'D03 does not compare different labels');
t.ok(d03restate(['Due date: 01/02/2023 and due date: 02/01/2023']).length === 0,
  'D03 skips ambiguous numeric dates');

// ---- 4. Serial-pattern engine ----
t.ok(Array.isArray(detectSerialPatterns([''])), 'detectSerialPatterns returns array on empty');
t.noThrow(() => detectSerialPatterns(['random benign words']), 'detectSerialPatterns on benign text');
const firstSP = SERIAL_PATTERNS[Object.keys(SERIAL_PATTERNS)[0]];
const spInput = firstSP.stages.map(s => s.keywords[0]).join(' ');
t.ok(Array.isArray(detectSerialPatterns([spInput])), 'detectSerialPatterns on crafted multi-stage input');

// Co-location: all of a pattern's stage keywords packed into ONE page must
// still be detected (a real scam document has its stages together).
const coLocated = detectSerialPatterns([spInput]);
t.ok(coLocated.some(f => f.serialPattern === Object.keys(SERIAL_PATTERNS)[0]),
  'serial pattern detected when its stages are co-located on one page');

// Scatter guard (the annexure-EB regression): the SAME keywords spread one per
// page across a large bundle, each surrounded by filler, must NOT trigger the
// pattern — that was the false "419 Scam / Money Laundering detected" bug.
const filler = 'lorem ipsum dolor sit amet consectetur '.repeat(20);
const scattered = [];
for (let i = 0; i < firstSP.stages.length; i++) {
  scattered.push(filler + ' ' + firstSP.stages[i].keywords[0] + ' ' + filler);
  scattered.push(filler); scattered.push(filler); scattered.push(filler); // spacer pages > window
}
const scatterFindings = detectSerialPatterns(scattered).filter(f => f.serialPattern === Object.keys(SERIAL_PATTERNS)[0]);
t.ok(scatterFindings.length === 0,
  'serial pattern NOT detected when stage keywords are scattered across a large bundle');

// ---- 5. Full pipeline (runForensicEngine) via the raw-text fallback path ----
// In the browser, extractPdfText is a global defined in the page HTML; stub it
// here so the fallback branch of runForensicEngine can be exercised in Node.
global.extractPdfText = async () => ([
  'payment was paid', 'it was not paid',
  'Total R50,000.00', 'Actual R10,000.00', 'Signed 31/02/2024',
]);
(async () => {
  const mockDoc = {
    getPages: () => { throw new Error('force fallback'); },
    getProducer: () => 'Adobe Photoshop', getCreator: () => '',
    getCreationDate: () => null, getModificationDate: () => null,
  };
  const res = await runForensicEngine(new Uint8Array([1, 2, 3]), mockDoc);
  t.ok(res && typeof res === 'object', 'runForensicEngine returns a result object');
  t.ok(Array.isArray(res.findings), 'result has findings array');
  t.ok(typeof res.overallScore === 'number', 'result has numeric overallScore');
  t.ok(res.findings.length > 0, 'crafted contradictions produce findings (' + res.findings.length + ')');
  t.ok(/^5\.\d+\.\d+-web$/.test(res.engineVersion || ''),
    'result stamps the lineage engine version (got "' + res.engineVersion + '")');
  t.ok(res.findings.every(f => typeof f.confidence === 'number' && f.confidence > 0 && f.confidence <= 1),
    'every finding carries a per-detector confidence weight');

  // contextOnly routing: a multi-jurisdiction reference must land in the
  // extraction notes as context, never in the findings (it is cross-border
  // reality, not a contradiction — external-review fix, 1 Aug 2026).
  global.extractPdfText = async () => ([
    'the parties operate in south africa and the uae under the same agreement',
  ]);
  const res2 = await runForensicEngine(new Uint8Array([1, 2, 3]), mockDoc);
  t.ok(!res2.findings.some(f => f.type === 'CT38'),
    'CT38 multi-jurisdiction note is NOT a scored finding');
  t.ok(/multiple jurisdictions/i.test(res2.extractionNotes || '') && /cross-border/i.test(res2.extractionNotes || ''),
    'CT38 context is disclosed in the extraction notes instead');

  // Low-count summary: two strong findings must read as "FOCUSED: check these
  // pages", not "HIGH ... suggests fraud or tampering" — the density score
  // rose ABOVE the old 12-finding report's precisely because noise was removed.
  global.extractPdfText = async () => ([
    'Effective Date: January 15, 2023.', 'Effective Date: March 1, 2023.',
  ]);
  const res3 = await runForensicEngine(new Uint8Array([1, 2, 3]), mockDoc);
  t.ok(res3.findings.length >= 1 && res3.findings.length <= 3,
    'low-count fixture yields 1-3 findings (' + res3.findings.length + ')');
  t.ok(/^FOCUSED:/.test(res3.summary || '') && /COUNT is low/.test(res3.summary || ''),
    'summary for a tiny finding set is FOCUSED, not a sweeping fraud verdict (got "' + String(res3.summary).slice(0, 60) + '...")');

  t.done('forensic-engine');
})();
