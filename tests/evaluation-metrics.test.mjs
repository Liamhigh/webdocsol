import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import {
  binaryMetrics,
  evaluateCases,
  validateEvaluationRun,
  matchContradictions,
  optimalAssignment,
  NOT_DEFINED
} from '../evaluation/lib/metrics.mjs';
import {
  createAlignmentTable,
  mapNormalizedSpan,
  spansOverlap,
  tokenOverlapCounts,
  unicodeTokens
} from '../evaluation/lib/span-alignment.mjs';
import { buildEvaluationReport, canonicalJson } from '../evaluation/lib/report.mjs';
import { serveSite } from '../worker/static-proxy.js';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

console.log('======================================================');
console.log('RUN  evaluation-metrics.test.mjs');
console.log('======================================================\n');

function manifest() {
  return {
    dataset_id: 'synthetic-hand-calculated',
    dataset_revision: 'synthetic-v1',
    dataset_sha512: createHash('sha512').update('synthetic-hand-calculated-v1').digest('hex'),
    dataset_license: 'synthetic; redistribute freely',
    evaluator_revision: 'evaluation-v1',
    engine_commit: 'synthetic-engine-commit',
    ruleset: 'synthetic-rules-v1',
    options: { modules: { citations: false }, referenceTime: 'supplied-only' },
    reference_time: '2026-01-02T00:00:00Z',
    code_version: '1.0.0'
  };
}

function expectedSpan(source, id, quote, page = null, startOverride = null) {
  const start = startOverride === null ? source.indexOf(quote) : startOverride;
  return { span_id: id, start, end: start + quote.length, quote, page };
}

function actualAnchor(source, id, quote, page = null, startOverride = null) {
  const start = startOverride === null ? source.indexOf(quote) : startOverride;
  return { anchor_id: id, start, end: start + quote.length, quote, page };
}

function predictedAnchors(source, spans, prefix) {
  return spans.map((span, index) => actualAnchor(source, prefix + index, span.quote, span.page, span.start));
}

function expected(id, ruleId, spans, scope = 'global', pairMode = 'ordered') {
  return { contradiction_id: id, rule_id: ruleId, scope, pair_mode: pairMode, evidence_spans: spans };
}

function actual(id, ruleId, anchors, scope = 'global') {
  return { finding_id: id, rule_id: ruleId, scope, anchors };
}

function evaluationCase(id, sourceText, expectedRecords = [], actualRecords = []) {
  return { case_id: id, document_id: 'doc-' + id, source_text: sourceText, expected_contradictions: expectedRecords, actual_findings: actualRecords };
}

function run(cases) {
  return { schema_version: '1.0.0', manifest: manifest(), cases };
}

function one(evaluationCaseRecord) {
  return evaluateCases([evaluationCaseRecord]);
}

const zero = binaryMetrics({});
ok(zero.precision === NOT_DEFINED && zero.recall === NOT_DEFINED && zero.f1 === NOT_DEFINED, 'empty binary denominators are explicitly not_defined');
ok(binaryMetrics({ tp: 1, fp: 1, fn: 1 }).precision === 0.5 && binaryMetrics({ tp: 1, fp: 1, fn: 1 }).recall === 0.5 && binaryMetrics({ tp: 1, fp: 1, fn: 1 }).f1 === 0.5, 'hand-calculated precision, recall and F1 equal one half');

const pairText = 'Alpha claim. Beta claim.';
const pairExpected = expected('expected-pair', 'D01', [
  expectedSpan(pairText, 'gold-a', 'Alpha', 1),
  expectedSpan(pairText, 'gold-b', 'Beta', 2)
]);
const exactPair = one(evaluationCase('exact-pair', pairText, [pairExpected], [actual('actual-pair', 'D01', [
  actualAnchor(pairText, 'pred-a', 'Alpha', 1),
  actualAnchor(pairText, 'pred-b', 'Beta', 2)
])]));
ok(exactPair.metrics.document_detection.micro.tp === 1 && exactPair.metrics.document_detection.micro.tn === 0, 'positive document detection records one true positive');
ok(exactPair.metrics.contradiction_detection.micro.tp === 1 && exactPair.metrics.contradiction_detection.micro.fp === 0 && exactPair.metrics.contradiction_detection.micro.fn === 0, 'rule matching gives one contradiction TP and no FP/FN');
ok(exactPair.metrics.pair_detection.exact.micro.tp === 1 && exactPair.metrics.pair_detection.task.micro.tp === 1, 'ordered exact pair and task pair match');
ok(exactPair.metrics.evidence_localization.exact_span.micro.tp === 2 && exactPair.metrics.evidence_localization.exact_span.micro.fp === 0, 'both evidence spans localize exactly');
ok(exactPair.metrics.page_localization.micro.value === 1 && exactPair.metrics.page_localization.micro.denominator === 2, 'multi-page evidence page accuracy is two of two');
ok(exactPair.metrics.scope_classification.micro.value === 1, 'scope classification is measured independently');
ok(exactPair.metrics.pair_detection.partial_pair_credit.micro.value === 1 && exactPair.metrics.pair_detection.pair_completeness.micro.value === 1, 'complete exact pair receives full partial credit and completeness');

const reversedPair = one(evaluationCase('reversed-pair', pairText, [{ ...pairExpected, contradiction_id: 'expected-reverse', pair_mode: 'unordered' }], [actual('actual-reverse', 'D01', [
  actualAnchor(pairText, 'pred-b', 'Beta', 2),
  actualAnchor(pairText, 'pred-a', 'Alpha', 1)
])]));
ok(reversedPair.metrics.pair_detection.exact.micro.tp === 0 && reversedPair.metrics.pair_detection.exact.micro.fp === 1 && reversedPair.metrics.pair_detection.exact.micro.fn === 1, 'strict ordered diagnostic rejects reversed anchors');
ok(reversedPair.metrics.pair_detection.unordered.micro.tp === 1 && reversedPair.metrics.pair_detection.task.micro.tp === 1, 'unordered task matching accepts reversed anchors only when appropriate');

const partialPair = one(evaluationCase('partial-pair', pairText, [expected('expected-partial', 'D01', pairExpected.evidence_spans)], [actual('actual-partial', 'D01', [
  actualAnchor(pairText, 'pred-a', 'Alpha', 1),
  actualAnchor(pairText, 'pred-wrong', 'claim', 2, 6)
])]));
ok(partialPair.metrics.pair_detection.task.micro.tp === 0 && partialPair.metrics.pair_detection.task.micro.fp === 1 && partialPair.metrics.pair_detection.task.micro.fn === 1, 'partial evidence is not promoted to an exact pair');
ok(partialPair.metrics.pair_detection.partial_pair_credit.micro.value === 0.5, 'one of two expected spans gives separate partial pair credit of one half');
ok(partialPair.metrics.pair_detection.pair_completeness.micro.value === 1, 'two supplied anchors are structurally complete even when one is wrong');
ok(partialPair.metrics.evidence_localization.exact_span.micro.tp === 1 && partialPair.metrics.evidence_localization.exact_span.micro.fp === 1 && partialPair.metrics.evidence_localization.exact_span.micro.fn === 1, 'partial pair evidence has one TP, one FP and one FN');

const incompletePair = one(evaluationCase('incomplete-pair', pairText, [expected('expected-incomplete', 'D01', pairExpected.evidence_spans)], [actual('actual-incomplete', 'D01', [actualAnchor(pairText, 'pred-a', 'Alpha', 1)])]));
ok(incompletePair.metrics.pair_detection.pair_completeness.micro.value === 0 && incompletePair.metrics.pair_detection.partial_pair_credit.micro.value === 0.5, 'one-anchor prediction is incomplete but retains separate half credit');

const incompleteExpectedPair = one(evaluationCase('incomplete-expected-pair', pairText,
  [expected('expected-one-anchor', 'D01', [pairExpected.evidence_spans[0]])],
  [actual('actual-one-anchor', 'D01', [actualAnchor(pairText, 'pred-a', 'Alpha', 1)])]));
ok(incompleteExpectedPair.metrics.contradiction_detection.micro.tp === 1 &&
  incompleteExpectedPair.metrics.pair_detection.exact.micro.tp === 0 &&
  incompleteExpectedPair.metrics.pair_detection.exact.excluded_incomplete_expected_pairs === 1 &&
  incompleteExpectedPair.metrics.pair_detection.exact.micro.precision === NOT_DEFINED &&
  incompleteExpectedPair.caseResults[0].pair_metric_exclusions[0].reason.includes('fewer than two'),
'one-anchor gold remains a detection match but is visibly excluded from exact-pair credit');
ok(buildEvaluationReport(run([evaluationCase('incomplete-expected-pair', pairText,
  [expected('expected-one-anchor', 'D01', [pairExpected.evidence_spans[0]])],
  [actual('actual-one-anchor', 'D01', [actualAnchor(pairText, 'pred-a', 'Alpha', 1)])])]),
incompleteExpectedPair).pair_metric_exclusions.length === 1,
'the evaluation report exposes incomplete expected pairs');

const duplicate = one(evaluationCase('duplicate-prediction', pairText, [expected('expected-duplicate', 'D01', pairExpected.evidence_spans)], [
  actual('actual-exact', 'D01', [actualAnchor(pairText, 'pred-a', 'Alpha', 1), actualAnchor(pairText, 'pred-b', 'Beta', 2)]),
  actual('actual-duplicate', 'D01', [actualAnchor(pairText, 'pred-a2', 'Alpha', 1), actualAnchor(pairText, 'pred-b2', 'Beta', 2)])
]));
ok(duplicate.metrics.contradiction_detection.micro.tp === 1 && duplicate.metrics.contradiction_detection.micro.fp === 1, 'duplicate prediction remains a false positive');
ok(duplicate.metrics.pair_detection.task.micro.tp === 1 && duplicate.metrics.pair_detection.task.micro.fp === 1, 'duplicate pair is not silently deduplicated');

const emptyPrediction = one(evaluationCase('empty-prediction', pairText, [expected('expected-empty', 'D01', pairExpected.evidence_spans)], []));
ok(emptyPrediction.metrics.document_detection.micro.fn === 1 && emptyPrediction.metrics.contradiction_detection.micro.fn === 1, 'empty prediction on a positive document is a document and contradiction FN');
ok(emptyPrediction.metrics.evidence_localization.exact_span.micro.tp === 0 && emptyPrediction.metrics.evidence_localization.exact_span.micro.fn === 0, 'conditional evidence metrics do not double-count an unmatched contradiction');
ok(emptyPrediction.metrics.page_localization.micro.value === NOT_DEFINED && emptyPrediction.metrics.scope_classification.micro.value === NOT_DEFINED, 'page and scope are not_defined without matched pairs');

const negativeClean = evaluationCase('negative-clean', 'No contradiction here.');
const negativeNoisy = evaluationCase('negative-noisy', 'No contradiction here.', [], [actual('false-alarm', 'D01', [], 'local')]);
const documentSet = evaluateCases([
  evaluationCase('positive-hit', pairText, [expected('e', 'D01', pairExpected.evidence_spans)], [actual('a', 'D01', predictedAnchors(pairText, pairExpected.evidence_spans, 'a'))]),
  negativeClean,
  negativeNoisy,
  evaluationCase('positive-miss', pairText, [expected('miss', 'D01', pairExpected.evidence_spans)], [])
]);
ok(documentSet.metrics.document_detection.micro.tp === 1 && documentSet.metrics.document_detection.micro.fp === 1 && documentSet.metrics.document_detection.micro.fn === 1 && documentSet.metrics.document_detection.micro.tn === 1, 'negative and positive documents yield hand-calculated TP/FP/FN/TN');
ok(documentSet.metrics.document_detection.micro.precision === 0.5 && documentSet.metrics.document_detection.macro.precision === 0.5 && documentSet.metrics.document_detection.macro.recall === 0.5, 'document micro and macro views are independently calculated');

const crossingText = 'abcdefghij';
const crossingSpans = [
  expectedSpan(crossingText, 'cross-a', 'abcde', null, 0),
  expectedSpan(crossingText, 'cross-b', 'defgh', null, 3)
];
ok(spansOverlap(crossingSpans[0], crossingSpans[1]), 'crossing-span fixture genuinely overlaps');
const crossing = one(evaluationCase('crossing-spans', crossingText, [expected('crossing', 'D02', crossingSpans)], [actual('crossing-pred', 'D02', predictedAnchors(crossingText, crossingSpans, 'cross-pred-'))]));
ok(crossing.metrics.evidence_localization.exact_span.micro.tp === 2 && crossing.metrics.pair_detection.task.micro.tp === 1, 'crossing spans match without clipping or rejection');


const unicodeText = 'A😀e\u0301 Z';
const unicodeExpected = expected('unicode-pair', 'D03', [
  expectedSpan(unicodeText, 'surrogate', '😀', 1),
  expectedSpan(unicodeText, 'combining', 'e\u0301', 2)
]);
ok(unicodeExpected.evidence_spans[0].start === 1 && unicodeExpected.evidence_spans[0].end === 3, 'astral symbol uses two UTF-16 code units');
ok(unicodeExpected.evidence_spans[1].start === 3 && unicodeExpected.evidence_spans[1].end === 5, 'combining sequence preserves separate UTF-16 boundaries');
const unicodeResult = one(evaluationCase('unicode', unicodeText, [unicodeExpected], [actual('unicode-prediction', 'D03', [
  actualAnchor(unicodeText, 'surrogate-prediction', '😀', 1),
  actualAnchor(unicodeText, 'combining-prediction', 'e\u0301', 2)
])]));
ok(unicodeResult.metrics.pair_detection.task.micro.tp === 1 && unicodeResult.metrics.evidence_localization.exact_span.micro.tp === 2, 'Unicode evidence matches at exact UTF-16 boundaries without code-point conversion');
ok(unicodeTokens('café 東京 _x 42').join('|') === 'café|東京|_x|42', 'tokenization retains Unicode letters, numbers and underscores');

const multiset = tokenOverlapCounts('one one two', 'one two two');
ok(multiset.tp === 2 && multiset.fp === 1 && multiset.fn === 1, 'token overlap uses duplicate-sensitive multiset counts');
ok(binaryMetrics(multiset).f1 === 2 / 3, 'hand-calculated multiset token F1 is two thirds');
ok(tokenOverlapCounts('café café', 'café').tp === 1 && tokenOverlapCounts('café café', 'café').fn === 1, 'Unicode duplicate tokens are counted independently');

const originalText = 'Alpha  Beta';
const normalizedText = 'Alpha Beta';
const boundaryMap = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
const alignment = createAlignmentTable(originalText, normalizedText, boundaryMap, 'collapse-internal-whitespace');
ok(mapNormalizedSpan({ start: 6, end: 10 }, alignment).start === 7 && mapNormalizedSpan({ start: 6, end: 10 }, alignment).quote === 'Beta', 'explicit boundary table maps normalized evidence to original source text');
const normalizedCase = evaluationCase('normalized', originalText, [
  expected('normalized-pair', 'D04', [
    expectedSpan(normalizedText, 'normalized-a', 'Alpha', 1),
    expectedSpan(normalizedText, 'normalized-b', 'Beta', 2)
  ])
], [
  actual('normalized-prediction', 'D04', [
    actualAnchor(originalText, 'original-a', 'Alpha', 1),
    actualAnchor(originalText, 'original-b', 'Beta', 2)
  ])
]);
normalizedCase.normalization = { name: 'collapse-internal-whitespace', normalized_text: normalizedText, normalized_to_original: boundaryMap };
const normalizedResult = one(normalizedCase);
ok(normalizedResult.metrics.pair_detection.task.micro.tp === 1 && normalizedResult.metrics.evidence_localization.exact_span.micro.tp === 2, 'normalized dataset spans align exactly to preserved original evidence');
ok(validateEvaluationRun(run([normalizedCase])).length === 0, 'valid normalization and exact source quotations pass validation');

const trimmedQuoteCase = evaluationCase('untrimmed-quote', ' Alpha ', [expected('bad-quote', 'D01', [
  { span_id: 'bad', start: 0, end: 5, quote: 'Alpha', page: null }
])], []);
ok(validateEvaluationRun(run([trimmedQuoteCase])).some((error) => error.includes('exact, untrimmed source slice')), 'implicitly trimmed or offset-shifted expected quotations fail closed');
ok(throws(() => one(trimmedQuoteCase)), 'direct library evaluation enforces the same semantic validation as the CLI');
const trimmedActualCase = evaluationCase('untrimmed-actual', ' Alpha ', [], [actual('bad-anchor', 'D01', [
  { anchor_id: 'bad', start: 0, end: 5, quote: 'Alpha', page: null }
])]);
ok(validateEvaluationRun(run([trimmedActualCase])).some((error) => error.includes('exact, untrimmed source slice')), 'actual anchors cannot silently trim original source text');
ok(throws(() => createAlignmentTable(originalText, normalizedText, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 10], 'bad-map')), 'normalization maps must include the complete original end boundary');
ok(throws(() => createAlignmentTable('abc', 'abc', [0, 2, 1, 3], 'non-monotonic')), 'normalization boundary maps must be monotonic');
ok(throws(() => mapNormalizedSpan({ start: 0, end: 1 }, createAlignmentTable('ab', 'a', [0, 0, 2], 'collapsing'))), 'a normalized span cannot collapse to an empty original range');

const missingPage = one(evaluationCase('missing-page', pairText, [expected('page-case', 'D05', pairExpected.evidence_spans.map((span, index) => ({ ...span, page: index === 0 ? 1 : null })))], [actual('page-prediction', 'D05', [
  actualAnchor(pairText, 'page-a', 'Alpha', 2),
  actualAnchor(pairText, 'page-b', 'Beta', 99)
])]));
ok(missingPage.metrics.page_localization.micro.value === 0 && missingPage.metrics.page_localization.micro.denominator === 1, 'only genuine expected integer page mappings enter page accuracy');
ok(missingPage.metrics.page_localization.excluded_no_genuine_page_mapping === 1, 'missing page mappings remain visible as exclusions');

const wrongScope = one(evaluationCase('wrong-scope', pairText, [expected('scope-case', 'D06', pairExpected.evidence_spans, 'global')], [actual('scope-prediction', 'D06', [
  actualAnchor(pairText, 'scope-a', 'Alpha', 1),
  actualAnchor(pairText, 'scope-b', 'Beta', 2)
], 'local')]));
ok(wrongScope.metrics.pair_detection.task.micro.tp === 1 && wrongScope.metrics.scope_classification.micro.value === 0, 'scope mismatch does not erase an otherwise exact pair');
ok(wrongScope.metrics.scope_classification.confusion.length === 1 && wrongScope.metrics.scope_classification.confusion[0].expected === 'global' && wrongScope.metrics.scope_classification.confusion[0].actual === 'local', 'scope confusion retains expected and predicted labels');

const scopeTieExpected = [
  expected('scope-tie-e-a', 'D06', pairExpected.evidence_spans, 'global'),
  expected('scope-tie-e-b', 'D06', pairExpected.evidence_spans, 'local')
];
const scopeTieActual = [
  actual('scope-tie-a-a', 'D06', predictedAnchors(pairText, pairExpected.evidence_spans, 'scope-tie-a-a-'), 'local'),
  actual('scope-tie-a-b', 'D06', predictedAnchors(pairText, pairExpected.evidence_spans, 'scope-tie-a-b-'), 'global')
];
const scopeTie = one(evaluationCase('scope-tie', pairText, scopeTieExpected, scopeTieActual));
ok(scopeTie.metrics.scope_classification.micro.numerator === 2 && scopeTie.metrics.scope_classification.micro.value === 1, 'equally supported contradiction assignments prefer matching scope before stable IDs');
const scopeTieReordered = one(evaluationCase('scope-tie-reordered', pairText, scopeTieExpected.slice().reverse(), scopeTieActual.slice().reverse()));
ok(scopeTieReordered.metrics.scope_classification.micro.value === 1, 'scope-aware tie-breaking remains independent of input order');

const missedCase = evaluationCase('report-miss', pairText, [expected('missed', 'D01', pairExpected.evidence_spans)], []);
const falseAlarmCase = evaluationCase('report-false-alarm', 'Clean negative.', [], [actual('orphan', 'D99', [])]);
const excludedCase = evaluationCase('report-excluded', 'Synthetic excluded document.', [], []);
excludedCase.exclusion = { reason: 'synthetic schema demonstration; not scored' };
const reportRun = run([falseAlarmCase, missedCase, excludedCase]);
const reportEvaluation = evaluateCases(reportRun.cases);
ok(reportEvaluation.failures.length === 2 && reportEvaluation.caseResults.length === 2, 'developer evaluation retains included detection failures');
ok(reportEvaluation.exclusions.length === 1 && reportEvaluation.exclusions[0].reason.includes('not scored'), 'excluded cases retain an explicit reason');
const report = buildEvaluationReport(reportRun, reportEvaluation);
ok(report.coverage.cases_total === 3 && report.coverage.cases_included === 2 && report.coverage.cases_excluded === 1, 'report coverage reconciles included and excluded cases');
ok(report.failures.some((failure) => failure.reason === 'expected contradiction was not detected') && report.failures.some((failure) => failure.reason === 'prediction has no expected contradiction with the same rule_id'), 'developer report includes both false-negative and false-positive explanations');
ok(report.architectural_owner === 'B9' && report.production_finding_effect === 'none', 'report is explicitly owned by advisory evaluation and has no production finding effect');
ok(report.limitations.some((line) => line.includes('not finding confidence')), 'report forbids confidence, severity and courtroom-reliability interpretation');
const normalizedReport = buildEvaluationReport(run([normalizedCase]), evaluateCases([normalizedCase]));
ok(normalizedReport.cases[0].normalization_transformations.join(',') === 'collapse-internal-whitespace', 'developer report records each normalization transformation');

const canonicalA = canonicalJson({ z: 1, a: { d: 2, b: [3, { c: 4 }] } });
const canonicalB = canonicalJson({ a: { b: [3, { c: 4 }], d: 2 }, z: 1 });
ok(canonicalA === canonicalB && canonicalA.indexOf('"a"') < canonicalA.indexOf('"z"'), 'canonical JSON is recursively key-sorted and deterministic');
ok(canonicalJson({ value: undefined }) === '{}\n', 'undefined optional report fields are omitted deterministically');
ok(throws(() => canonicalJson({ value: Number.NaN })) && throws(() => canonicalJson({ value: new Date(0) })), 'canonical report JSON rejects non-finite numbers and non-plain objects');
ok(!Object.keys(report).some((key) => /generated|timestamp|created/i.test(key)), 'deterministic report contains no wall-clock generation field');
ok(report.report_version === '1.1.0', 'the evaluation report version identifies the revised per-case output contract without changing production findings JSON');

const reorderedExpected = [
  expected('rule-a', 'D07', [expectedSpan(pairText, 'rule-a-span', 'Alpha')]),
  expected('rule-b', 'D08', [expectedSpan(pairText, 'rule-b-span', 'Beta')])
];
const reorderedActual = [
  actual('prediction-b', 'D08', [actualAnchor(pairText, 'prediction-b-anchor', 'Beta')]),
  actual('prediction-a', 'D07', [actualAnchor(pairText, 'prediction-a-anchor', 'Alpha')])
];
const matched = matchContradictions(reorderedExpected, reorderedActual);
ok(matched.matches.length === 2 && matched.matches.every((match) => match.expected.rule_id === match.actual.rule_id), 'deterministic bipartite matching respects rule IDs independently of input order');

const schema = JSON.parse(readFileSync(path.join(root, 'evaluation/schema.json'), 'utf8'));
ok(schema.$schema === 'https://json-schema.org/draft/2020-12/schema' && schema.$defs.EvaluationCase && schema.$defs.EvaluationManifest, 'machine-readable schema exposes dataset and case contracts');
ok(schema.$defs.ExpectedEvidenceSpan.properties.page.anyOf.some((entry) => entry.type === 'null'), 'schema distinguishes missing page mappings from page numbers');
ok(schema.$defs.EvaluationCase.properties.exclusion.required.includes('reason'), 'schema requires an explicit exclusion reason');
ok(schema.$defs.StableIdentifier.maxLength === 256 && validateEvaluationRun(run([evaluationCase('x'.repeat(257), 'A')])).some((error) => error.includes('longer than maxLength')), 'bounded identifiers prevent failure-report amplification');
const duplicateLocationCase = evaluationCase('duplicate-locations', pairText, [expected('duplicate-location-pair', 'D01', [
  expectedSpan(pairText, 'duplicate-location-a', 'Alpha', 1),
  expectedSpan(pairText, 'duplicate-location-b', 'Alpha', 1)
])], []);
ok(validateEvaluationRun(run([duplicateLocationCase])).some((error) => error.includes('duplicate expected evidence locations')) && throws(() => one(duplicateLocationCase)), 'different IDs cannot reuse the same expected source location for pair credit');

const temp = mkdtempSync(path.join(tmpdir(), 'verum-evaluation-'));
try {
  const inputPath = path.join(temp, 'input.json');
  const outputA = path.join(temp, 'nested', 'report-a.json');
  const outputB = path.join(temp, 'nested', 'report-b.json');
  writeFileSync(inputPath, JSON.stringify(reportRun));
  const cli = path.join(root, 'evaluation/run-evaluation.mjs');
  const first = spawnSync(process.execPath, [cli, inputPath, '--output', outputA], { encoding: 'utf8' });
  const second = spawnSync(process.execPath, [cli, inputPath, '--output', outputB], { encoding: 'utf8' });
  ok(first.status === 0 && second.status === 0, 'evaluation CLI accepts a validated synthetic run');
  ok(readFileSync(outputA, 'utf8') === readFileSync(outputB, 'utf8'), 'repeated CLI runs produce byte-identical reports');
  ok(readFileSync(outputA, 'utf8') === canonicalJson(report), 'file output is the same canonical developer report as the library result');
  const stdoutRun = spawnSync(process.execPath, [cli, inputPath], { encoding: 'utf8' });
  ok(stdoutRun.status === 0 && stdoutRun.stdout === readFileSync(outputA, 'utf8'), 'stdout and file CLI modes emit identical bytes');
  const invalidPath = path.join(temp, 'invalid.json');
  writeFileSync(invalidPath, JSON.stringify(run([trimmedQuoteCase])));
  const invalid = spawnSync(process.execPath, [cli, invalidPath], { encoding: 'utf8' });
  ok(invalid.status === 1 && invalid.stderr.includes('exact, untrimmed source slice'), 'invalid evidence exits nonzero with actionable validation details');
  const usage = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  ok(usage.status === 2 && usage.stderr.includes('Usage:'), 'missing CLI arguments fail with usage guidance');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

for (const productionFile of ['seal-document.html', 'forensic-engine-page.js', 'forensic-report.js', 'analysis-config.js', 'analysis-contracts.js']) {
  const source = readFileSync(path.join(root, productionFile), 'utf8');
  ok(!source.includes('evaluation/run-evaluation') && !source.includes('evaluation/lib/metrics'), productionFile + ' remains isolated from development evaluation');
}
const originalFetch = globalThis.fetch;
let evaluationFallbackFetches = 0;
globalThis.fetch = async () => {
  evaluationFallbackFetches++;
  return new Response('must not be served', { status: 200 });
};
try {
  const encodedEvaluationResponse = await serveSite(new Request('https://example.test/%65valuation/schema.json'), {
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) }
  });
  ok(encodedEvaluationResponse.status === 404 && evaluationFallbackFetches === 0, 'percent-encoded evaluation paths are denied before repository or Pages fallback');
  const deniedResponses = [];
  for (const deniedPath of ['/%2565valuation/schema.json', '/%2Fevaluation/schema.json', '/safe/%2E%2E/evaluation/schema.json', '/%E0%A4%A']) {
    deniedResponses.push(await serveSite(new Request('https://example.test' + deniedPath), {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) }
    }));
  }
  ok(deniedResponses.every((response) => response.status === 404) && evaluationFallbackFetches === 0, 'multiply encoded, encoded-slash, dot-segment, and malformed paths fail closed before every fallback');
  let checkedAssetPath = null;
  const normalizedAssetResponse = await serveSite(new Request('https://example.test/%69ndex.html'), {
    ASSETS: { fetch: async (request) => {
      checkedAssetPath = new URL(request.url).pathname;
      return new Response('ok', { status: 200 });
    } }
  });
  ok(normalizedAssetResponse.status === 200 && checkedAssetPath === '/index.html', 'assets receive the exact normalized path that passed the deny check');
} finally {
  globalThis.fetch = originalFetch;
}
ok(validateEvaluationRun(run([excludedCase])).length === 0, 'an explicit, justified exclusion is valid');
ok(validateEvaluationRun(run([{ ...excludedCase, exclusion: {} }])).some((error) => error.includes('exclusion requires a reason')), 'silent or unexplained exclusion is rejected');

const noSchemaVersion = run([]);
delete noSchemaVersion.schema_version;
ok(validateEvaluationRun(noSchemaVersion).some((error) => error.includes('$.schema_version is required')), 'the CLI contract requires schema_version');
ok(validateEvaluationRun({ ...run([]), schema_version: '2.0.0' }).some((error) => error.includes('$.schema_version must equal')), 'an unsupported schema version fails closed');
ok(validateEvaluationRun({ ...run([]), unexpected: true }).some((error) => error.includes('unsupported property "unexpected"')), 'properties forbidden by the published schema are rejected');

const globalExpected = [
  expected('global-e1', 'D20', pairExpected.evidence_spans, 'global', 'unordered'),
  expected('global-e2', 'D20', pairExpected.evidence_spans, 'global', 'ordered')
];
const globalActual = [
  actual('global-a1', 'D20', [actualAnchor(pairText, 'global-a1-alpha', 'Alpha'), actualAnchor(pairText, 'global-a1-beta', 'Beta')]),
  actual('global-a2', 'D20', [actualAnchor(pairText, 'global-a2-beta', 'Beta'), actualAnchor(pairText, 'global-a2-alpha', 'Alpha')])
];
const globalAssignment = one(evaluationCase('global-assignment', pairText, globalExpected, globalActual));
ok(globalAssignment.metrics.pair_detection.task.micro.tp === 2, 'global assignment maximizes task-exact matches instead of accepting a greedy local choice');
const globalReordered = one(evaluationCase('global-assignment-reordered', pairText, globalExpected, globalActual.slice().reverse()));
ok(globalReordered.metrics.pair_detection.task.micro.tp === 2, 'globally optimal assignment is independent of prediction input order');

const potentialMatrix = [[19, 15, 8], [4, 4, 17], [16, 18, 12]];
const potentialAssignment = optimalAssignment([0, 1, 2], [0, 1, 2], (left, right) => BigInt(potentialMatrix[left][right]));
const potentialCost = potentialAssignment.reduce((sum, pair) => sum + potentialMatrix[pair.leftIndex][pair.rightIndex], 0);
ok(potentialAssignment.length === 3 && potentialCost === 28, 'shortest augmenting paths settle all reachable nodes before updating potentials');

const repeatedText = 'Alpha Alpha';
const repeatedExpected = [
  expectedSpan(repeatedText, 'repeat-e0', 'Alpha', 1, 0),
  expectedSpan(repeatedText, 'repeat-e1', 'Alpha', 2, 6)
];
const oneAnchor = one(evaluationCase('one-anchor-no-reuse', repeatedText, [expected('repeat-pair', 'D21', repeatedExpected)], [actual('repeat-prediction', 'D21', [actualAnchor(repeatedText, 'repeat-a0', 'Alpha', 1, 0)])]));
ok(oneAnchor.metrics.evidence_localization.token_overlap.micro.tp === 1 && oneAnchor.metrics.evidence_localization.token_overlap.micro.fn === 1, 'one actual anchor cannot receive token credit for two expected spans');
ok(oneAnchor.metrics.page_localization.micro.numerator === 1 && oneAnchor.metrics.page_localization.micro.denominator === 2, 'an unmatched expected span remains a page-localization failure');
const surplusAnchors = one(evaluationCase('surplus-anchors', repeatedText, [expected('surplus-pair', 'D21', [repeatedExpected[0]])], [actual('surplus-prediction', 'D21', [actualAnchor(repeatedText, 'surplus-a0', 'Alpha', 1, 0), actualAnchor(repeatedText, 'surplus-a1', 'Alpha', 2, 6)])]));
ok(surplusAnchors.metrics.evidence_localization.token_overlap.micro.fp === 1, 'unmatched actual anchors contribute token false positives');

const sharedPositive = evaluationCase('shared-positive', pairText, [pairExpected], [actual('shared-prediction', 'D01', predictedAnchors(pairText, pairExpected.evidence_spans, 'shared-a'))]);
const sharedNegative = evaluationCase('shared-negative', 'No additional contradiction.');
sharedPositive.document_id = 'shared-document';
sharedNegative.document_id = 'shared-document';
const sharedDocuments = evaluateCases([sharedPositive, sharedNegative]);
ok(sharedDocuments.metrics.document_detection.micro.tp === 1 && sharedDocuments.metrics.document_detection.micro.tn === 0, 'document detection counts a shared document_id only once');
const sharedDocumentReport = buildEvaluationReport(run([sharedPositive, sharedNegative]), sharedDocuments);
ok(sharedDocumentReport.cases.every((entry) => !Object.hasOwn(entry, 'document_detection')), 'per-case reports omit misleading document-level metrics for shared document IDs');

const singleSpan = one(evaluationCase('single-span-completeness', pairText, [expected('single-e', 'D22', [expectedSpan(pairText, 'single-span', 'Alpha', 1)])], [actual('single-a', 'D22', [actualAnchor(pairText, 'single-anchor', 'Alpha', 1)])]));
ok(singleSpan.metrics.pair_detection.pair_completeness.micro.value === NOT_DEFINED && singleSpan.metrics.pair_detection.pair_completeness.micro.denominator === 0, 'single-span expectations do not enter pair-completeness denominators');

const nulScope = one(evaluationCase('nul-scope', pairText, [expected('nul-e', 'D23', pairExpected.evidence_spans, 'local\u0000gold')], [actual('nul-a', 'D23', predictedAnchors(pairText, pairExpected.evidence_spans, 'nul-a'), 'local\u0000actual')]));
ok(nulScope.metrics.scope_classification.confusion[0].expected === 'local\u0000gold' && nulScope.metrics.scope_classification.confusion[0].actual === 'local\u0000actual', 'scope confusion preserves labels containing NUL characters');

const prototypeInput = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
const prototypeCanonical = canonicalJson(prototypeInput);
ok(prototypeCanonical.includes('"__proto__"') && !({}).polluted, 'canonical JSON preserves an own __proto__ key without prototype mutation');
const normalizedMiss = evaluationCase('normalized-miss', normalizedCase.source_text, normalizedCase.expected_contradictions, []);
normalizedMiss.normalization = normalizedCase.normalization;
const normalizedMissReport = buildEvaluationReport(run([normalizedMiss]), evaluateCases([normalizedMiss]));
ok(normalizedMissReport.cases[0].normalization_transformations[0] === 'collapse-internal-whitespace', 'normalization provenance survives when every contradiction is missed');

const tokenlessText = '!!!';
const tokenlessExpected = [expected('tokenless-e', 'D24', [expectedSpan(tokenlessText, 'tokenless-span', '!!!')])];
const tokenlessActual = [
  actual('tokenless-z', 'D24', [actualAnchor(tokenlessText, 'tokenless-anchor-z', '!!!')], 'z'),
  actual('tokenless-a', 'D24', [actualAnchor(tokenlessText, 'tokenless-anchor-a', '!!!')], 'a')
];
ok(matchContradictions(tokenlessExpected, tokenlessActual).matches[0].actual.finding_id === 'tokenless-a' && matchContradictions(tokenlessExpected, tokenlessActual.slice().reverse()).matches[0].actual.finding_id === 'tokenless-a', 'tokenless candidate ties reach stable finding-ID ordering');
ok(unicodeTokens('cafe\u0301').join('|') === 'cafe\u0301' && tokenOverlapCounts('cafe\u0301', 'cafe').tp === 0, 'combining marks remain attached to tokens and affect overlap');

const overlapText = ('word'.padEnd(20) + 'word' + ' '.repeat(6) + 'word').padEnd(10000) + 'word';
const overlappingExpected = [
  expectedSpan(overlapText, 'overlap-e0', 'word', 1, 0),
  expectedSpan(overlapText, 'overlap-e1', 'word', 2, 20)
];
const overlappingActual = [
  actualAnchor(overlapText, 'overlap-a0', 'word', 1, 0),
  actualAnchor(overlapText, 'overlap-a1', 'word', 1, 30),
  actualAnchor(overlapText, 'overlap-a2', 'word', 2, 10000)
];
const overlapAssignment = one(evaluationCase('overlap-priority', overlapText, [expected('overlap-e', 'D26', overlappingExpected)], [actual('overlap-a', 'D26', overlappingActual)]));
ok(overlapAssignment.metrics.evidence_localization.exact_span.micro.tp === 1 && overlapAssignment.metrics.page_localization.micro.numerator === 1, 'global evidence assignment retains the exact match and then minimizes remaining distance');
ok(overlapAssignment.metrics.evidence_localization.token_overlap.micro.tp === 2 && overlapAssignment.metrics.evidence_localization.token_overlap.micro.fp === 1 && overlapAssignment.metrics.evidence_localization.token_overlap.micro.fn === 0, 'exact-match priority and distance ordering remain deterministic for overlapping candidates');

const crowdedExpected = Array.from({ length: 129 }, (_, index) => expected('crowded-e' + index, 'D25', [expectedSpan('A', 'crowded-span' + index, 'A')]));
const crowdedActual = Array.from({ length: 129 }, (_, index) => actual('crowded-a' + index, 'D25', [actualAnchor('A', 'crowded-anchor' + index, 'A')]));
let crowdedRuleReads = 0;
for (const record of crowdedActual) Object.defineProperty(record, 'rule_id', { get() { crowdedRuleReads++; return 'D25'; } });
const crowdedErrors = validateEvaluationRun(run([evaluationCase('crowded', 'A', crowdedExpected, crowdedActual)]));
ok(crowdedErrors.some((error) => error.includes('too many expected contradictions')) && crowdedErrors.some((error) => error.includes('too many actual findings')), 'oversized case arrays are rejected before matching');
ok(crowdedRuleReads === 0, 'resource rejection avoids nested same-rule candidate enumeration');
const actualOnlyOversized = Array.from({ length: 129 }, (_, index) => actual('actual-overflow-' + index, 'D25', []));
let nestedAnchorReads = 0;
for (const record of actualOnlyOversized) Object.defineProperty(record, 'anchors', { get() { nestedAnchorReads++; return []; } });
const actualOnlyErrors = validateEvaluationRun(run([evaluationCase('actual-overflow', 'A', [], actualOnlyOversized)]));
const repeatedAnchorOverflow = Array.from({ length: 128 }, (_, index) => actual('anchor-overflow-' + index, 'D25', Array.from({ length: 129 }, (_, anchorIndex) => actualAnchor('A', 'overflow-anchor-' + anchorIndex, 'A'))));
const repeatedAnchorErrors = validateEvaluationRun(run([evaluationCase('anchor-overflow', 'A', [], repeatedAnchorOverflow)]));
ok(actualOnlyErrors.length === 1 && nestedAnchorReads === 0 && repeatedAnchorErrors.length === 1, 'oversized actual findings skip nested inspection and resource diagnostics remain bounded per case');
ok(throws(() => createAlignmentTable('a'.repeat(1000001), 'a'.repeat(1000001))), 'alignment allocation rejects text beyond the per-case limit');

const reviewTemp = mkdtempSync(path.join(tmpdir(), 'verum-evaluation-review-'));
try {
  const cli = path.join(root, 'evaluation/run-evaluation.mjs');
  const collisionInput = path.join(reviewTemp, 'collision.json');
  const originalInput = JSON.stringify(reportRun);
  writeFileSync(collisionInput, originalInput);
  const collision = spawnSync(process.execPath, [cli, collisionInput, '--output', collisionInput], { encoding: 'utf8' });
  ok(collision.status === 1 && collision.stderr.includes('must not overwrite the input dataset'), 'an output/input path collision is rejected');
  ok(readFileSync(collisionInput, 'utf8') === originalInput, 'a rejected output collision preserves the source dataset byte-for-byte');
  const inputAlias = path.join(reviewTemp, 'input-alias.json');
  symlinkSync(collisionInput, inputAlias);
  const symlinkCollision = spawnSync(process.execPath, [cli, inputAlias, '--output', collisionInput], { encoding: 'utf8' });
  ok(symlinkCollision.status === 1 && symlinkCollision.stderr.includes('must not overwrite the input dataset'), 'canonical input/output paths reject symlink aliases');
  ok(readFileSync(collisionInput, 'utf8') === originalInput, 'a rejected symlink collision preserves the source dataset byte-for-byte');
  const outputTarget = path.join(reviewTemp, 'unrelated-output-target.json');
  const outputAlias = path.join(reviewTemp, 'output-alias.json');
  writeFileSync(outputTarget, 'preserve unrelated target');
  symlinkSync(outputTarget, outputAlias);
  const symlinkOutput = spawnSync(process.execPath, [cli, collisionInput, '--output', outputAlias], { encoding: 'utf8' });
  ok(symlinkOutput.status === 0 && JSON.parse(readFileSync(outputAlias, 'utf8')).report_version === '1.1.0' && readFileSync(outputTarget, 'utf8') === 'preserve unrelated target', 'atomic output replacement preserves an unrelated existing symlink target');

  const terminalInput = path.join(reviewTemp, 'terminal.json');
  const terminalCase = evaluationCase('bad\u001b[2J-id', 'Synthetic.');
  writeFileSync(terminalInput, JSON.stringify(run([terminalCase, terminalCase])));
  const terminal = spawnSync(process.execPath, [cli, terminalInput], { encoding: 'utf8' });
  ok(terminal.status === 1 && !terminal.stderr.includes('\u001b'), 'CLI errors escape terminal control characters from untrusted identifiers');

  const oversizedInput = path.join(reviewTemp, 'oversized.json');
  writeFileSync(oversizedInput, Buffer.alloc(16 * 1024 * 1024 + 1, 32));
  const oversized = spawnSync(process.execPath, [cli, oversizedInput], { encoding: 'utf8' });
  ok(oversized.status === 1 && oversized.stderr.includes('16 MiB corpus limit'), 'oversized input is rejected before JSON parsing');

  const malformedInput = path.join(reviewTemp, 'malformed-utf8.json');
  const malformedBytes = Buffer.from(JSON.stringify(run([evaluationCase('malformed-marker', 'Synthetic.')])));
  malformedBytes[malformedBytes.indexOf(Buffer.from('malformed-marker'))] = 0xff;
  writeFileSync(malformedInput, malformedBytes);
  const malformed = spawnSync(process.execPath, [cli, malformedInput], { encoding: 'utf8' });
  ok(malformed.status === 1 && malformed.stderr.includes('valid UTF-8'), 'malformed UTF-8 is rejected instead of being replaced and scored');

  const concurrentOutput = path.join(reviewTemp, 'concurrent.json');
  function runConcurrent() {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [cli, collisionInput, '--output', concurrentOutput], { stdio: 'ignore' });
      child.on('close', resolve);
    });
  }
  const concurrentStatuses = await Promise.all([runConcurrent(), runConcurrent()]);
  const concurrentReport = JSON.parse(readFileSync(concurrentOutput, 'utf8'));
  ok(concurrentStatuses.every((status) => status === 0) && concurrentReport.report_type === 'verum_omnis_developer_evaluation', 'concurrent CLI writers leave one complete canonical report');
  ok(!readdirSync(reviewTemp).some((name) => name.endsWith('.tmp')), 'atomic report writes leave no temporary files after success');
} finally {
  rmSync(reviewTemp, { recursive: true, force: true });
}

done('evaluation-metrics');
