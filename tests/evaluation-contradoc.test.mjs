// tests/evaluation-contradoc.test.mjs — PR 1.3 ContraDoc adapter + dual metrics (B9, development-only).
// Synthetic fixtures only; the real dataset is never committed or required here.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONTRADOC_ADAPTER_VERSION,
  CONTRADOC_DATASET,
  CONTRADOC_SCOPE_MAP,
  adaptDataset,
  buildRunInput,
  locateSentence,
  mergeActualFindings,
  parseContraDocDataset
} from '../evaluation/contradoc/adapter.mjs';
import { buildVerumExactSummary } from '../evaluation/contradoc/verum-exact-metrics.mjs';
import {
  PUBLISHED_THRESHOLD,
  calculateMetrics,
  directFind,
  judgeThenFind,
  runOfficialMetrics,
  trimString,
  yesVerify
} from '../evaluation/contradoc/official-metric-runner.mjs';
import { CONTRADOC_RELEASE, planCacheAction, verifyMemberBytes } from '../evaluation/contradoc/download-or-verify.mjs';
import { validateEvaluationRun } from '../evaluation/lib/metrics.mjs';
import { canonicalJson } from '../evaluation/lib/report.mjs';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// --- adapter: synthetic positive and negative documents -----------------------

const posText = 'The river bank was quiet that year. ' +
  'In March the mill employed forty people, records show. ' +
  'Later the report states the mill employed no staff in March. ' +
  'Everyone agreed the water was cold.';
const EVIDENCE = 'Later the report states the mill employed no staff in March.';
const REF = 'In March the mill employed forty people, records show.';

function posRecord(overrides = {}) {
  return {
    text: posText,
    evidence: EVIDENCE,
    'unique id': 'p1',
    doc_type: 'news',
    contra_plug: 'Insert',
    contra_type: ['Numeric', 'Content'],
    scope: 'local',
    'ref sentences': [REF],
    ...overrides
  };
}

const adapted = adaptDataset({
  pos: { p1: posRecord() },
  neg: { n1: { text: 'A calm document with nothing contradictory at all.', doc_type: 'story', 'unique id': 'n1' } }
});

ok(adapted.cases.length === 2 && adapted.cases[0].case_id === 'cdoc-pos-p1' && adapted.cases[1].case_id === 'cdoc-neg-n1',
  'pos cases precede neg cases under deterministic block ordering');
{
  const pos = adapted.cases[0];
  ok(pos.expected_contradictions.length === 1, 'a positive document yields one expected contradiction');
  const contradiction = pos.expected_contradictions[0];
  ok(contradiction.rule_id === 'contradoc:self_contradiction' && contradiction.scope === 'contradoc:local',
    'rule id is the dataset task and the published scope label is preserved');
  ok(contradiction.pair_mode === 'unordered', 'the contradiction pair is unordered');
  const spans = contradiction.evidence_spans;
  ok(spans.length === 2 && spans[0].span_id === 'ref0' && spans[1].span_id === 'evidence',
    'ref sentences precede the evidence sentence in the span list');
  ok(spans[0].quote === REF && spans[1].quote === EVIDENCE, 'spans quote the record exactly');
  ok(posText.slice(spans[0].start, spans[0].end) === REF && posText.slice(spans[1].start, spans[1].end) === EVIDENCE,
    'span offsets address the source text exactly');
  ok(spans.every((span) => span.page === null), 'no page mapping is fabricated');
  ok(adapted.cases[1].expected_contradictions.length === 0 && !adapted.cases[1].exclusion,
    'a negative document is a clean negative case');
  ok(adapted.coverage.pos_documents === 1 && adapted.coverage.neg_documents === 1 &&
     adapted.coverage.scope_labels.local === 1 && adapted.coverage.contra_types.Numeric === 1 &&
     adapted.coverage.contra_plugs.Insert === 1 && adapted.coverage.doc_types.story === 1,
  'coverage preserves the published label distributions');
  ok(adapted.coverage.ref_sentences_total === 1 && adapted.coverage.ref_sentences_located === 1,
    'located ref sentences are counted');
}

{
  const hybrid = adaptDataset({ pos: { h1: posRecord({ scope: 'global, intra' }) }, neg: {} });
  ok(hybrid.cases[0].expected_contradictions[0].scope === 'contradoc:global, intra',
    'the hybrid published scope label is preserved verbatim');
  ok(CONTRADOC_SCOPE_MAP.intra === 'within_sentence' && CONTRADOC_SCOPE_MAP.local === 'within_document_nearby' &&
     CONTRADOC_SCOPE_MAP.global === 'within_document_distant' && !('global, intra' in CONTRADOC_SCOPE_MAP),
  'the scope mapping is explicit and the hybrid label has no entry');
}

{
  const missingRef = 'A sentence that appears nowhere in the document text.';
  const result = adaptDataset({ pos: { p2: posRecord({ 'ref sentences': [missingRef] }) }, neg: {} });
  const spans = result.cases[0].expected_contradictions[0].evidence_spans;
  ok(spans.length === 1 && spans[0].span_id === 'evidence', 'an unlocatable ref sentence is omitted, not force-fit');
  ok(result.coverage.ref_sentences_omitted.length === 1 &&
     result.coverage.ref_sentences_omitted[0].document_id === 'cdoc-pos-p2' &&
     result.coverage.ref_sentences_omitted[0].reason === 'not_found_verbatim',
  'the omission is disclosed per document with its reason');
  const dup = adaptDataset({ pos: { p3: posRecord({ 'ref sentences': [REF, REF] }) }, neg: {} });
  ok(dup.coverage.ref_sentences_omitted.length === 1 && dup.coverage.ref_sentences_omitted[0].reason === 'duplicate_location',
    'a duplicated ref location is omitted and disclosed');
  const noRefs = adaptDataset({ pos: { p4: posRecord({ 'ref sentences': undefined }) }, neg: {} });
  ok(noRefs.cases[0].expected_contradictions[0].evidence_spans.length === 1,
    'a positive document without ref sentences keeps its evidence span');
}

{
  const sameAsEvidence = adaptDataset({ pos: { p5: posRecord({ 'ref sentences': [EVIDENCE] }) }, neg: {} });
  ok(!sameAsEvidence.cases[0].exclusion && sameAsEvidence.cases[0].expected_contradictions[0].evidence_spans.length === 1,
    'a ref equal to the evidence keeps the document with the evidence span');
  ok(sameAsEvidence.coverage.ref_sentences_omitted[0].reason === 'same_location_as_evidence',
    'the redundant ref omission is disclosed');
  const arrayScope = adaptDataset({ pos: { p6: posRecord({ scope: ['global'] }) }, neg: {} });
  ok(!arrayScope.cases[0].exclusion && arrayScope.cases[0].expected_contradictions[0].scope === 'contradoc:global' &&
     arrayScope.coverage.scope_array_normalized === 1,
  'a single-element scope array is normalized to the published label and recorded');
  ok(posExclusion(posRecord({ scope: ['global', 'intra'] })) === 'scope_missing',
    'a multi-element scope array excludes the document');
}

function posExclusion(record) {
  const result = adaptDataset({ pos: { x: record }, neg: {} });
  return result.cases[0].exclusion ? result.cases[0].exclusion.reason : null;
}
ok(posExclusion(posRecord({ evidence: 'Not in the text at all, sorry.' })) === 'evidence_not_located_verbatim',
  'unlocatable evidence excludes the document');
ok(posExclusion(posRecord({ evidence: '' })) === 'evidence_missing', 'missing evidence excludes the document');
ok(posExclusion(posRecord({ text: '' })) === 'document_text_missing', 'missing text excludes the document');
ok(posExclusion(posRecord({ scope: '' })) === 'scope_missing', 'missing scope excludes the document');
ok(posExclusion(posRecord({ contra_type: 'Numeric' })) === 'contra_type_invalid', 'a non-array contra_type excludes the document');
{
  const negBad = adaptDataset({ pos: {}, neg: { n9: { text: '', doc_type: 'news', 'unique id': 'n9' } } });
  ok(negBad.cases[0].exclusion && negBad.cases[0].exclusion.reason === 'document_text_missing',
    'a negative document without text is excluded and visible');
}

ok(locateSentence(posText, EVIDENCE) === posText.indexOf(EVIDENCE), 'locateSentence finds a unique verbatim sentence');
ok(locateSentence(posText, 'absent sentence entirely') === 'missing', 'locateSentence reports a missing sentence');
ok(locateSentence('the mill. the mill.', 'the mill.') === 'ambiguous', 'locateSentence refuses an ambiguous location');
ok(locateSentence(posText, '') === 'missing', 'locateSentence refuses an empty sentence');

{
  const run = buildRunInput({
    dataset_sha512: 'c'.repeat(128), engine_commit: 'commit', ruleset: 'rules',
    reference_time: '2026-11-15T00:00:00Z', options: { adaptation: 'self_contradiction_detection' }
  }, adapted.cases);
  ok(validateEvaluationRun(run).length === 0, 'adapted ContraDoc output passes the evaluation schema validator');
  ok(canonicalJson(run) === canonicalJson(buildRunInput({
    dataset_sha512: 'c'.repeat(128), engine_commit: 'commit', ruleset: 'rules',
    reference_time: '2026-11-15T00:00:00Z', options: { adaptation: 'self_contradiction_detection' }
  }, adaptDataset({ pos: { p1: posRecord() }, neg: { n1: { text: 'A calm document with nothing contradictory at all.', doc_type: 'story', 'unique id': 'n1' } } }).cases)),
  'adaptation is byte-identical across runs');
  const merged = mergeActualFindings(adapted.cases, {
    'cdoc-pos-p1': [{
      finding_id: 'f1', rule_id: 'contradoc:self_contradiction', scope: 'contradoc:local',
      anchors: [
        { anchor_id: 'a0', start: posText.indexOf(REF), end: posText.indexOf(REF) + REF.length, quote: REF, page: null },
        { anchor_id: 'a1', start: posText.indexOf(EVIDENCE), end: posText.indexOf(EVIDENCE) + EVIDENCE.length, quote: EVIDENCE, page: null }
      ]
    }]
  });
  ok(merged[0].actual_findings.length === 1, 'actual findings merge onto the named case');
  throws(() => mergeActualFindings(adapted.cases, { 'cdoc-pos-unknown': [] }));
  ok(true, 'actual findings for an unknown case id are rejected');
}

// --- verum-exact metrics -------------------------------------------------------

{
  const falsePositiveAnchor = { anchor_id: 'fp0', start: 0, end: 6, quote: 'A calm', page: null };
  const run = buildRunInput({
    dataset_sha512: 'c'.repeat(128), engine_commit: 'commit', ruleset: 'rules',
    reference_time: '2026-11-15T00:00:00Z', options: {}
  }, mergeActualFindings(adapted.cases, {
    'cdoc-pos-p1': [{
      finding_id: 'f1', rule_id: 'contradoc:self_contradiction', scope: 'contradoc:local',
      anchors: [
        { anchor_id: 'a0', start: posText.indexOf(REF), end: posText.indexOf(REF) + REF.length, quote: REF, page: null },
        { anchor_id: 'a1', start: posText.indexOf(EVIDENCE), end: posText.indexOf(EVIDENCE) + EVIDENCE.length, quote: EVIDENCE, page: null }
      ]
    }],
    'cdoc-neg-n1': [{ finding_id: 'f2', rule_id: 'contradoc:self_contradiction', scope: 'contradoc:local', anchors: [falsePositiveAnchor] }]
  }));
  const summary = buildVerumExactSummary(run);
  ok(summary.result_label === 'verum_exact', 'the summary is labelled verum_exact');
  ok(summary.documents.positive === 1 && summary.documents.negative === 1 && summary.documents.excluded === 0,
    'document counts separate positive, negative and excluded');
  ok(summary.contradoc_neg_false_positives.documents_with_findings === 1 &&
     summary.contradoc_neg_false_positives.case_ids.length === 1 &&
     summary.contradoc_neg_false_positives.case_ids[0] === 'cdoc-neg-n1',
  'a ContraDoc-Neg false positive is listed per document, never hidden');
  ok(summary.positive_subset_metrics.contradiction_detection.micro.tp === 1,
    'the positive subset records the matched contradiction');
  ok(summary.overall_metrics.evidence_localization.exact_span.micro.tp === 2,
    'both exact evidence spans localize');
  ok(summary.limitations.some((line) => line.includes('never conflated')), 'the summary states the two families are never conflated');
}

// --- official metric runner -----------------------------------------------------

ok(trimString('  padded \n') === 'padded', 'trimString trims spaces and newlines only');
ok(directFind(['short', 'a candidate sentence long enough'], 'a candidate sentence long enough') === 1,
  'directFind matches a full candidate inside the query');
ok(directFind(['a candidate sentence long enough'], 'x a candidate sentence long enough y') === 0,
  'directFind matches the query inside a candidate');
ok(directFind(['a candidate sentence long enough'], 'too short') === null,
  'directFind never matches a query under 20 characters');
ok(directFind(['tiny', 'also tiny'], 'a query sentence that is long enough') === null,
  'directFind skips candidates under 20 characters');

ok(yesVerify([], 'gold evidence sentence long enough') === false, 'no candidates never verifies');
ok(yesVerify(['The gold evidence sentence.'], 'the GOLD evidence sentence.') === true,
  'direct find verifies case-insensitively');
ok(yesVerify(['a candidate with no overlap at all here'], 'gold evidence sentence long enough') === false,
  'no direct find and no scores never verifies');
ok(yesVerify(['a candidate with no overlap at all here'], 'gold evidence sentence long enough',
  { bertscore: { precision: [0.99], recall: [0.5] } }) === true,
  'a precision above the published 0.98 threshold verifies');
ok(yesVerify(['a candidate with no overlap at all here'], 'gold evidence sentence long enough',
  { bertscore: { precision: [PUBLISHED_THRESHOLD], recall: [0.97] } }) === false,
  'a score exactly at 0.98 does not verify (strict threshold)');
ok(yesVerify(['a candidate with no overlap at all here'], 'gold evidence sentence long enough',
  { bertscore: { precision: [0.5], recall: [0.99] } }) === true,
  'a recall above the published threshold verifies');
{
  const four = ['c1 long enough candidate a', 'c2 long enough candidate b', 'c3 long enough candidate c', 'the gold evidence sentence'];
  ok(yesVerify(four, 'the gold evidence sentence', { onlyTop3: true }) === false,
    'onlyTop3 drops the fourth candidate before matching');
  ok(yesVerify(four, 'the gold evidence sentence') === true, 'without onlyTop3 the fourth candidate matches');
}
throws(() => yesVerify(['a candidate with no overlap at all here'], 'gold evidence sentence long enough',
  { bertscore: { precision: [0.99, 0.1], recall: [0.5] } }));
ok(true, 'misaligned bertscore arrays are rejected');

{
  const metrics = calculateMetrics([true, true, false, false], [true, false, true, false]);
  ok(metrics['True Positive'] === 1 && metrics['False Positive'] === 1 && metrics['True Negative'] === 1 && metrics['False Negative'] === 1,
    'official counts are reproduced');
  ok(metrics['Precision'] === 0.5 && metrics['Recall'] === 0.5 && metrics['F1 Score'] === 0.5 && metrics['Accuracy'] === 0.5,
    'official precision/recall/F1/accuracy are reproduced');
  const zeros = calculateMetrics([false], [false]);
  ok(zeros['Precision'] === 0 && zeros['Recall'] === 0 && zeros['F1 Score'] === 0 && zeros['Accuracy'] === 1,
    'official zero-denominator behaviour is reproduced exactly');
  throws(() => calculateMetrics([true], [true, false]));
  ok(true, 'mismatched label lengths are rejected');
}

{
  const responses = [
    { gold: true, judgment: 'yes', evidence: ['the gold evidence sentence'], evidenceGold: 'the gold evidence sentence' },
    { gold: true, judgment: 'yes', evidence: ['no overlap candidate sentence'], evidenceGold: 'the gold evidence sentence' },
    { gold: false, judgment: 'yes', evidence: [] },
    { gold: true, judgment: 'no', evidence: [] }
  ];
  const outcome = judgeThenFind(responses);
  ok(outcome.verifiedPredictions.join(',') === 'true,false,true,false',
    'Judge-then-Find verifies evidence only for a yes on a gold-positive document');
  const result = runOfficialMetrics({ responses });
  ok(result.result_label === 'published_comparable', 'official results are labelled published_comparable');
  ok(result.verify['True Positive'] === 1 && result.without_verify['True Positive'] === 2,
    'verification drops the yes whose evidence does not verify');
  ok(result.task_settings.top_k === 5 && result.task_settings.bertscore_threshold === 0.98,
    'the published top-k and threshold settings are recorded');
  throws(() => judgeThenFind([{ gold: true, judgment: 'yes', evidence: ['e'], evidenceGold: 'g', bertscore: { precision: [0.9], recall: [0.9] } }], {})
    && runOfficialMetrics({ responses: [{ gold: true, judgment: 'yes', evidence: ['e'], evidenceGold: 'g', bertscore: { precision: [0.9], recall: [0.9] } }] }));
  ok(true, 'bertscore values without provenance are rejected');
  const withProvenance = runOfficialMetrics({
    provenance: { scores_source: 'external run 2026-11', score_model: 'bertscore-roberta-large' },
    responses: [{ gold: true, judgment: 'yes', evidence: ['no overlap candidate sentence'], evidenceGold: 'the gold evidence sentence', bertscore: { precision: [0.99], recall: [0.1] } }]
  });
  ok(withProvenance.verify['True Positive'] === 1 && withProvenance.provenance.score_model === 'bertscore-roberta-large',
    'externally scored evidence verifies with recorded provenance');
  throws(() => judgeThenFind([{ gold: true, judgment: 'yes', evidence: ['1', '2', '3', '4', '5', '6'], evidenceGold: 'g' }], { taskSetting: 'top_k' }));
  ok(true, 'top_k rejects more than the published five candidates');
}

// --- download-or-verify ----------------------------------------------------------

{
  ok(planCacheAction({}).action === 'download', 'an empty cache plans a download');
  const allValid = Object.fromEntries(Object.keys(CONTRADOC_RELEASE.members).map((key) => [key, 'valid']));
  ok(planCacheAction(allValid).action === 'verify-only', 'a fully valid cache uses no network');
  const oneInvalid = { ...allValid, 'ContraDoc.json': 'invalid' };
  const plan = planCacheAction(oneInvalid);
  ok(plan.action === 'error' && plan.reason.includes('ContraDoc.json'), 'a mismatched cached file fails closed and names the file');
  const member = CONTRADOC_RELEASE.members['ContraDoc.json'];
  throws(() => verifyMemberBytes('ContraDoc.json', Buffer.alloc(member.bytes, 0)));
  ok(true, 'a wrong dataset body fails the pinned SHA-256 check');
  ok(member.bytes === 4420050 && /^[0-9a-f]{64}$/.test(member.sha256) &&
     CONTRADOC_RELEASE.revision === 'd1c42d1e433595dd6e98fab7b669722cdc050b1d',
  'the pinned release carries revision, size and SHA-256');
}

// --- CLI end to end (synthetic input, temp directory, no network) -----------------

{
  const scratch = mkdtempSync(path.join(tmpdir(), 'contradoc-'));
  try {
    const datasetPath = path.join(scratch, 'ContraDoc.json');
    writeFileSync(datasetPath, JSON.stringify({
      pos: { p1: posRecord() },
      neg: { n1: { text: 'A calm document with nothing contradictory at all.', doc_type: 'story', 'unique id': 'n1' } }
    }));
    const outputPrefix = path.join(scratch, 'out', 'run');
    const adapterCli = path.join(root, 'evaluation/contradoc/adapter.mjs');
    const args = ['--engine-commit', 'test-commit', '--ruleset', 'test-ruleset',
      '--reference-time', '2026-11-15T00:00:00Z', '--input', datasetPath, '--output-prefix', outputPrefix];
    const first = spawnSync(process.execPath, [adapterCli, ...args], { encoding: 'utf8' });
    ok(first.status === 0, 'adapter CLI exits 0 on a clean synthetic dataset' + (first.status === 0 ? '' : ': ' + first.stderr));
    ok(existsSync(outputPrefix + '.json') && existsSync(outputPrefix + '.coverage.json'), 'adapter CLI writes the run and the coverage sidecar');
    const coverage = JSON.parse(readFileSync(outputPrefix + '.coverage.json', 'utf8'));
    ok(coverage.pos_documents === 1 && coverage.neg_documents === 1 && coverage.adapter_version === CONTRADOC_ADAPTER_VERSION,
      'coverage reports the document totals');

    const runOutput = path.join(scratch, 'report.json');
    const evaluation = spawnSync(process.execPath, [path.join(root, 'evaluation/run-evaluation.mjs'), outputPrefix + '.json', '--output', runOutput], { encoding: 'utf8' });
    ok(evaluation.status === 0 && existsSync(runOutput), 'run-evaluation consumes the adapted run' + (evaluation.status === 0 ? '' : ': ' + evaluation.stderr));

    const summaryCli = spawnSync(process.execPath, [path.join(root, 'evaluation/contradoc/verum-exact-metrics.mjs'), outputPrefix + '.json'], { encoding: 'utf8' });
    ok(summaryCli.status === 0 && JSON.parse(summaryCli.stdout).result_label === 'verum_exact',
      'verum-exact-metrics CLI summarizes the run');
    const responsesPath = path.join(scratch, 'responses.json');
    writeFileSync(responsesPath, JSON.stringify({ responses: [{ gold: true, judgment: 'yes', evidence: ['the gold evidence sentence'], evidenceGold: 'the gold evidence sentence' }] }));
    const officialCli = spawnSync(process.execPath, [path.join(root, 'evaluation/contradoc/official-metric-runner.mjs'), responsesPath], { encoding: 'utf8' });
    ok(officialCli.status === 0 && JSON.parse(officialCli.stdout).result_label === 'published_comparable',
      'official-metric-runner CLI reproduces the published task settings');

    const missing = spawnSync(process.execPath, [adapterCli, '--engine-commit', 'c'], { encoding: 'utf8' });
    ok(missing.status === 2, 'adapter CLI rejects missing required arguments');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

ok(CONTRADOC_DATASET.dataset_license === 'Apache-2.0' && CONTRADOC_DATASET.dataset_revision.includes('d1c42d1'),
  'the dataset identity records its pinned revision and license');

done('evaluation-contradoc');
