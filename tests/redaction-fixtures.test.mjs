// Redaction fixture corpus integrity and evidence-channel boundaries.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ok, done, throws } = require('./_assert.js');
const Config = require('../analysis-config.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/redaction/cases-v1.json'), 'utf8'));

ok(corpus.schema_version === '1.0.0' && corpus.fixture_set === 'phase3-redaction-boundaries',
  'the fixture corpus has an explicit version and purpose');
ok(corpus.synthetic_only === true && corpus.dataset_license.startsWith('CC0-1.0;') &&
   corpus.offset_unit === 'utf16',
  'the corpus is synthetic, redistributable test data with explicit UTF-16 offsets');
ok(Config.IMPLEMENTED_MODULES.redaction !== true &&
   throws(() => Config.selectedConfiguration({ modules: { redaction: true } })),
  'redaction fixtures do not enable or imply a production module');
ok(corpus.cases.length >= 3, 'the corpus covers multiple boundary shapes');

const kinds = new Set(['email', 'phone', 'identifier']);
const caseIds = new Set();
function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}
function checkSpan(record, span, label) {
  const valid = Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) &&
    span.start >= 0 && span.end > span.start && span.end <= record.source_text.length;
  ok(valid, label + ' has a positive in-bounds UTF-16 range');
  if (valid) {
    ok(record.source_text.slice(span.start, span.end) === span.quote,
      label + ' quote exactly matches the source slice');
  }
}

for (const record of corpus.cases) {
  ok(typeof record.case_id === 'string' && !caseIds.has(record.case_id),
    record.case_id + ' has a unique stable case id');
  caseIds.add(record.case_id);
  ok(typeof record.source_text === 'string', record.case_id + ' preserves its original source text');

  for (const [index, redaction] of record.expected_redactions.entries()) {
    ok(kinds.has(redaction.kind), record.case_id + ' redaction ' + index + ' has a supported fixture label');
    checkSpan(record, redaction, record.case_id + ' redaction ' + index);
    for (const protectedSpan of record.protected_spans) {
      ok(!overlaps(redaction, protectedSpan),
        record.case_id + ' redaction ' + index + ' does not alter a verbatim evidence quote');
    }
    for (const preserved of record.must_preserve) {
      ok(!overlaps(redaction, preserved),
        record.case_id + ' redaction ' + index + ' does not cover an explicitly preserved passage');
    }
    for (const other of record.expected_redactions.slice(index + 1)) {
      ok(!overlaps(redaction, other), record.case_id + ' expected redaction spans do not overlap');
    }
  }
  for (const [index, protectedSpan] of record.protected_spans.entries()) {
    ok(protectedSpan.channel === 'verbatim_evidence_quote',
      record.case_id + ' protected span ' + index + ' names the immutable evidence channel');
    checkSpan(record, protectedSpan, record.case_id + ' protected span ' + index);
  }
  for (const [index, preserved] of record.must_preserve.entries()) {
    checkSpan(record, preserved, record.case_id + ' preserved passage ' + index);
  }
}

const quotedSensitiveContact = corpus.cases[0].protected_spans[0].quote;
const quotedSensitiveIdentifier = corpus.cases[1].protected_spans[0].quote;
ok(quotedSensitiveContact.includes('person@example.invalid') &&
   quotedSensitiveIdentifier.includes('00000000000'),
  'protected evidence examples retain synthetic contact-like and identifier-like text verbatim');
const unicodeCase = corpus.cases.find((record) => record.case_id === 'unicode-context-and-trailing-punctuation');
ok(unicodeCase.source_text.indexOf('person@example.invalid') === 32 &&
   unicodeCase.expected_redactions[0].start === 32,
  'offsets remain UTF-16 code units after a supplementary Unicode character');

done('redaction-fixtures');
