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
fires(DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY, ['Total R50,000.00', 'Actual R10,000.00'], 'CT02', 'D02 amount variance');
fires(DETECTORS.D03_DETECT_DATE_INCONSISTENCY, ['Signed 31/02/2024 by hand'], 'CT03', 'D03 impossible Feb date');
fires(DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY, ['before the incident and also after the incident'], 'CT04', 'D04 temporal conflict');

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

// ---- 4. Serial-pattern engine ----
t.ok(Array.isArray(detectSerialPatterns([''])), 'detectSerialPatterns returns array on empty');
t.noThrow(() => detectSerialPatterns(['random benign words']), 'detectSerialPatterns on benign text');
const firstSP = SERIAL_PATTERNS[Object.keys(SERIAL_PATTERNS)[0]];
const spInput = firstSP.stages.map(s => s.keywords[0]).join(' ');
t.ok(Array.isArray(detectSerialPatterns([spInput])), 'detectSerialPatterns on crafted multi-stage input');

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

  t.done('forensic-engine');
})();
