import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  binaryMetrics,
  evaluateCases,
  validateEvaluationRun,
  matchContradictions,
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
  evaluationCase('positive-hit', pairText, [expected('e', 'D01', pairExpected.evidence_spans)], [actual('a', 'D01', pairExpected.evidence_spans.map((span, index) => ({ ...span, anchor_id: 'a' + index })))]),
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
const crossing = one(evaluationCase('crossing-spans', crossingText, [expected('crossing', 'D02', crossingSpans)], [actual('crossing-pred', 'D02', crossingSpans.map((span, index) => ({ ...span, anchor_id: 'cross-pred-' + index })))]));
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
ok(validateEvaluationRun(run([excludedCase])).length === 0, 'an explicit, justified exclusion is valid');
ok(validateEvaluationRun(run([{ ...excludedCase, exclusion: {} }])).some((error) => error.includes('exclusion requires a reason')), 'silent or unexplained exclusion is rejected');

done('evaluation-metrics');
