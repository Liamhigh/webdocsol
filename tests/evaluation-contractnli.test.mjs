// tests/evaluation-contractnli.test.mjs — PR 1.2 ContractNLI adapter (B9, development-only).
// Synthetic fixtures only; the real dataset is never committed or required here.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import {
  CONTRACTNLI_ADAPTER_VERSION,
  CONTRACTNLI_DATASET,
  adaptDataset,
  buildCoverage,
  buildRunInput,
  codePointToUtf16Table,
  mergeActualFindings,
  parseContractNliDataset,
  shardCases,
  validateHypothesisMap
} from '../evaluation/contractnli/adapter.mjs';
import {
  CONTRACTNLI_RELEASE,
  crc32,
  planCacheAction,
  readZipEntries,
  sha256Hex,
  verifyMemberBytes
} from '../evaluation/contractnli/download-or-verify.mjs';
import { validateEvaluationRun, evaluateCases } from '../evaluation/lib/metrics.mjs';
import { canonicalJson } from '../evaluation/lib/report.mjs';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// --- hypothesis-map.json (the reviewed production mapping) ------------------

const hypothesisMapJson = JSON.parse(readFileSync(path.join(root, 'evaluation/contractnli/hypothesis-map.json'), 'utf8'));
const OFFICIAL_KEYS = ['nda-1', 'nda-2', 'nda-3', 'nda-4', 'nda-5', 'nda-7', 'nda-8', 'nda-10',
  'nda-11', 'nda-12', 'nda-13', 'nda-15', 'nda-16', 'nda-17', 'nda-18', 'nda-19', 'nda-20'];

const productionMap = noThrow(() => validateHypothesisMap(hypothesisMapJson), 'production hypothesis map validates');
ok(productionMap && productionMap.size === 17, 'production map covers exactly 17 hypotheses');
ok(OFFICIAL_KEYS.every((key) => productionMap && productionMap.has(key)), 'production map covers exactly the official nda keys');
ok(Object.keys(hypothesisMapJson.hypotheses).length === 17 &&
   Object.keys(hypothesisMapJson.hypotheses).every((key) => OFFICIAL_KEYS.includes(key)), 'map file names no unknown hypothesis');
// Pin the current honest state: no hypothesis has a genuine Verum detector
// match. A future mapping is a deliberate, reviewed edit to this assertion.
ok([...productionMap.values()].every((entry) => entry.status === 'not_applicable' && entry.verum_rule_id === null),
  'all 17 hypotheses are currently not_applicable with a null rule id');
ok([...productionMap.values()].every((entry) => entry.rationale.length > 40 && entry.hypothesis.length > 20),
  'every hypothesis carries real text and a real rationale');
ok(hypothesisMapJson.mapping_rule.includes('genuinely'), 'map file states the genuine-semantics mapping rule');

throws(() => validateHypothesisMap({ mapping_version: '1', dataset_id: 'contractnli', hypotheses: {
  'nda-1': { short_description: 'x', hypothesis: 'h', status: 'mapped', verum_rule_id: null, rationale: 'r' } } }));
ok(true, 'a mapped hypothesis without a rule id is rejected');
throws(() => validateHypothesisMap({ mapping_version: '1', dataset_id: 'contractnli', hypotheses: {
  'nda-1': { short_description: 'x', hypothesis: 'h', status: 'sometimes', verum_rule_id: null, rationale: 'r' } } }));
ok(true, 'an unknown hypothesis status is rejected');
throws(() => validateHypothesisMap({ mapping_version: '1', dataset_id: 'contractnli', hypotheses: {
  'nda-1': { short_description: 'x', hypothesis: 'h', status: 'not_applicable', verum_rule_id: 'D01', rationale: 'r' } } }));
ok(true, 'a not_applicable hypothesis carrying a rule id is rejected');
throws(() => validateHypothesisMap({ mapping_version: '1', dataset_id: 'contractnli', hypotheses: {} }));
ok(true, 'an empty hypothesis map is rejected');

// --- offset conversion -------------------------------------------------------

{
  const text = 'A\u{1F680}B xy C'; // one non-BMP code point (2 UTF-16 units)
  const table = codePointToUtf16Table(text);
  const codePoints = [...text];
  ok(table.length === codePoints.length + 1, 'alignment table has one boundary per code point plus the end');
  ok(table[2] === 3, 'a code point after a surrogate pair maps two UTF-16 units further');
  // Dataset span [2, 6) in code points = "B xy"
  ok(text.slice(table[2], table[6]) === 'B xy', 'converted span slices the exact intended text');
  ok(table[codePoints.length] === text.length, 'the final boundary covers the whole string');
}

// --- synthetic dataset -------------------------------------------------------

function syntheticMap(mapping) {
  return validateHypothesisMap({
    mapping_version: 'test',
    dataset_id: 'contractnli',
    hypotheses: {
      'nda-1': { short_description: 'H1', hypothesis: 'Hypothesis one text.', rationale: 'test rationale one', status: 'not_applicable', verum_rule_id: null, ...mapping['nda-1'] },
      'nda-2': { short_description: 'H2', hypothesis: 'Hypothesis two text.', rationale: 'test rationale two', status: 'not_applicable', verum_rule_id: null, ...mapping['nda-2'] }
    }
  });
}
const MAPPED = syntheticMap({ 'nda-1': { status: 'mapped', verum_rule_id: 'D01' } });
const NONE_APPLICABLE = syntheticMap({});

function datasetWith(documents) {
  return {
    labels: {
      'nda-1': { short_description: 'H1', hypothesis: 'Hypothesis one text.' },
      'nda-2': { short_description: 'H2', hypothesis: 'Hypothesis two text.' }
    },
    documents
  };
}
function annotation(choice, spans) {
  return { choice, spans };
}
function document(id, text, spans, annotations) {
  return { id, file_name: 'doc-' + id + '.pdf', text, spans, annotation_sets: [{ annotations }] };
}

const plainText = 'Alpha beta. Gamma delta.';
const plainDoc = document(2, plainText, [[0, 11], [12, 24]], {
  'nda-1': annotation('Contradiction', [0, 1]),
  'nda-2': annotation('NotMentioned', [])
});
const emojiText = 'A\u{1F680}B xy C';
const emojiDoc = document(1, emojiText, [[2, 6]], {
  'nda-1': annotation('Contradiction', [0]),
  'nda-2': annotation('Entailment', [0])
});
// Input order deliberately reversed; output must sort by document id.
const adapted = adaptDataset(datasetWith([plainDoc, emojiDoc]), MAPPED);

ok(adapted.cases.length === 2 && adapted.cases[0].document_id === 'cnli-doc-1' && adapted.cases[1].document_id === 'cnli-doc-2',
  'documents adapt in deterministic id order');

{
  const first = adapted.cases[0]; // emojiDoc
  ok(first.expected_contradictions.length === 1, 'a contradicted mapped hypothesis yields one expected contradiction');
  const contradiction = first.expected_contradictions[0];
  ok(contradiction.contradiction_id === 'nda-1' && contradiction.rule_id === 'D01', 'expected contradiction carries the mapped rule id');
  ok(contradiction.scope === 'document_vs_hypothesis' && contradiction.pair_mode === 'unordered',
    'scope labels the document-vs-hypothesis adaptation and evidence is unordered');
  ok(contradiction.evidence_spans.length === 1 && contradiction.evidence_spans[0].quote === 'B xy',
    'non-BMP evidence span keeps an exact UTF-16 quote');
  ok(contradiction.evidence_spans[0].page === null, 'no page mapping is fabricated');
  ok(first.expected_contradictions.every((entry) => entry.contradiction_id !== 'nda-2'),
    'an Entailment label stays negative for contradiction retrieval');
}
{
  const second = adapted.cases[1]; // plainDoc
  const spans = second.expected_contradictions[0].evidence_spans;
  ok(spans.length === 2 && spans[0].quote === 'Alpha beta.' && spans[1].quote === 'Gamma delta.',
    'multi-span evidence maps every annotated span exactly');
  ok(spans[0].span_id === 'sp0' && spans[1].span_id === 'sp1', 'span ids name the dataset span index');
}
{
  const negative = adaptDataset(datasetWith([document(9, plainText, [[0, 11]], {
    'nda-1': annotation('NotMentioned', []),
    'nda-2': annotation('Entailment', [0])
  })]), MAPPED);
  ok(negative.cases[0].expected_contradictions.length === 0 && !negative.cases[0].exclusion,
    'NotMentioned and Entailment annotations build a clean negative case');
}
{
  const notApplicable = adaptDataset(datasetWith([plainDoc]), NONE_APPLICABLE);
  ok(notApplicable.cases[0].expected_contradictions.length === 0 && !notApplicable.cases[0].exclusion,
    'a not_applicable hypothesis produces no expected contradiction');
  ok(notApplicable.dispositions.get('nda-1').Contradiction === 1 && notApplicable.dispositions.get('nda-1').status === 'not_applicable',
    'not_applicable annotations are still counted in the coverage dispositions');
}

// --- exclusion paths (failures stay visible, never crash) ---------------------

function exclusionReason(doc) {
  const result = adaptDataset(datasetWith([doc]), MAPPED);
  return result.cases[0].exclusion ? result.cases[0].exclusion.reason : null;
}
ok(exclusionReason({ ...plainDoc, id: undefined }) === 'document_id_missing', 'a missing document id excludes the case');
ok(exclusionReason({ ...plainDoc, text: 42 }) === 'document_text_missing', 'a non-string text excludes the case');
ok(exclusionReason({ ...plainDoc, annotation_sets: [{ annotations: {} }, { annotations: {} }] }) === 'unexpected_annotation_sets',
  'multiple annotation sets exclude the case');
ok(exclusionReason(document(3, plainText, [[0, 11]], { 'nda-1': annotation('Contradiction', [0]) })) === 'missing_hypothesis_annotation',
  'a missing hypothesis annotation excludes the case');
ok(exclusionReason(document(4, plainText, [[0, 11]], {
  'nda-1': annotation('Contradicted', [0]), 'nda-2': annotation('NotMentioned', [])
})) === 'unknown_choice', 'an unknown label excludes the case');
ok(exclusionReason(document(5, plainText, [[0, 11]], {
  'nda-1': annotation('NotMentioned', [0]), 'nda-2': annotation('NotMentioned', [])
})) === 'inconsistent_annotation', 'NotMentioned with evidence spans excludes the case');
ok(exclusionReason(document(6, plainText, [[0, 11]], {
  'nda-1': annotation('Contradiction', []), 'nda-2': annotation('NotMentioned', [])
})) === 'contradiction_without_evidence', 'a Contradiction without evidence excludes the case');
ok(exclusionReason(document(7, plainText, [[0, 11]], {
  'nda-1': annotation('Contradiction', [5]), 'nda-2': annotation('NotMentioned', [])
})) === 'evidence_span_index_invalid', 'an out-of-range span index excludes the case');
ok(exclusionReason(document(8, plainText, [[0, 11]], {
  'nda-1': annotation('Contradiction', [0, 0]), 'nda-2': annotation('NotMentioned', [])
})) === 'duplicate_evidence_span', 'a duplicated span index excludes the case');
ok(exclusionReason({ ...plainDoc, spans: [[5, 5]] }) === 'span_table_invalid', 'a malformed span table excludes the case');
ok(exclusionReason(plainDoc) === null, 'a clean document is not excluded');

// --- merge, shard, validate, evaluate ---------------------------------------

{
  const merged = mergeActualFindings(adapted.cases, {
    'cnli-doc-1': [{
      finding_id: 'f1',
      rule_id: 'D01',
      scope: 'document_vs_hypothesis',
      anchors: [{ anchor_id: 'a1', start: 3, end: 7, quote: 'B xy', page: null }]
    }]
  });
  ok(merged[0].actual_findings.length === 1 && merged[1].actual_findings.length === 0, 'actual findings merge onto the named case only');
  throws(() => mergeActualFindings(adapted.cases, { 'cnli-doc-999': [] }));
  ok(true, 'actual findings for an unknown case id are rejected');

  const run = buildRunInput({
    dataset_sha512: 'a'.repeat(128),
    engine_commit: 'test-commit',
    ruleset: 'test-ruleset',
    reference_time: '2026-11-15T00:00:00Z',
    options: { adaptation: 'contradiction_retrieval', pair_mode: 'unordered', scope_label: 'document_vs_hypothesis', shard_index: 1, shard_count: 1 }
  }, merged);
  ok(validateEvaluationRun(run).length === 0, 'adapted output passes the evaluation schema validator');
  const evaluation = evaluateCases(run.cases);
  const metrics = evaluation.metrics;
  ok(metrics.contradiction_detection.micro.tp === 1 && metrics.contradiction_detection.micro.fn === 1,
    'one matched and one unmatched expected contradiction are counted separately');
  ok(metrics.evidence_localization.exact_span.micro.tp === 1, 'the exact evidence span localizes');

  ok(canonicalJson(buildRunInput({
    dataset_sha512: 'a'.repeat(128), engine_commit: 'c', ruleset: 'r', reference_time: 't', options: {}
  }, adapted.cases)) === canonicalJson(buildRunInput({
    dataset_sha512: 'a'.repeat(128), engine_commit: 'c', ruleset: 'r', reference_time: 't', options: {}
  }, adaptDataset(datasetWith([plainDoc, emojiDoc]), MAPPED).cases)),
  'two adaptation runs over the same dataset are byte-identical');
}

{
  const shards = shardCases(adapted.cases, { maxCases: 10, maxCodeUnits: plainText.length + 1 });
  ok(shards.length === 2 && shards[0].length === 1 && shards[1].length === 1, 'the code-unit budget forces a deterministic shard split');
  ok(shardCases(adapted.cases).length === 1, 'default budgets keep small corpora in one shard');
  throws(() => shardCases(adapted.cases, { maxCodeUnits: 10 }));
  ok(true, 'a case larger than the shard budget fails closed');
}

{
  const coverage = buildCoverage({
    split: 'train',
    cases: adapted.cases,
    dispositions: adapted.dispositions,
    datasetSha512: 'b'.repeat(128),
    datasetBytes: 1234,
    shards: [{ file: 'x.json', cases: 2, code_units: 100 }]
  });
  ok(coverage.adapter_version === CONTRACTNLI_ADAPTER_VERSION && coverage.documents_total === 2 && coverage.documents_excluded.length === 0,
    'coverage counts every document');
  ok(coverage.applicable_hypotheses.length === 1 && coverage.applicable_hypotheses[0] === 'nda-1',
    'coverage names the applicable subset');
  ok(coverage.limitations.some((line) => line.includes('does not fabricate an entailment classifier')), 'coverage states the task adaptation');
}

// --- download-or-verify internals (no network) --------------------------------

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.method === 8 ? deflateRawSync(Buffer.from(entry.data)) : Buffer.from(entry.data);
    const raw = Buffer.from(entry.data);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(Buffer.concat([local, name, data]));
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += locals[locals.length - 1].length;
  }
  const centralBlock = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBlock, eocd]);
}

{
  const zip = makeZip([
    { name: 'contract-nli/a.json', data: '{"a":1}', method: 0 },
    { name: 'contract-nli/b.json', data: '{"b":"deflated"}', method: 8 }
  ]);
  const entries = readZipEntries(zip, ['contract-nli/a.json', 'contract-nli/b.json']);
  ok(entries.get('contract-nli/a.json').toString() === '{"a":1}', 'stored zip members extract');
  ok(entries.get('contract-nli/b.json').toString() === '{"b":"deflated"}', 'deflated zip members extract');

  const tampered = Buffer.from(zip);
  tampered[35] ^= 0xff;
  throws(() => readZipEntries(tampered, ['contract-nli/a.json', 'contract-nli/b.json']));
  ok(true, 'a tampered member fails its CRC check');
  throws(() => readZipEntries(zip, ['contract-nli/missing.json']));
  ok(true, 'a missing member fails closed');
  throws(() => readZipEntries(Buffer.from('not a zip'), ['x']));
  ok(true, 'a non-zip buffer fails closed');
}

{
  const name = 'contract-nli/train.json';
  const expected = CONTRACTNLI_RELEASE.members[name];
  const good = Buffer.alloc(expected.bytes, 0);
  ok(sha256Hex(good) !== expected.sha256, 'zero bytes do not accidentally match the pin');
  throws(() => verifyMemberBytes(name, good));
  ok(true, 'a wrong member body fails the pinned SHA-256 check');
  throws(() => verifyMemberBytes(name, Buffer.alloc(expected.bytes + 1, 0)));
  ok(true, 'a wrong member size fails before hashing');

  ok(planCacheAction({}).action === 'download', 'an empty cache plans a download');
  const allValid = Object.fromEntries(Object.keys(CONTRACTNLI_RELEASE.members).map((key) => [key, 'valid']));
  ok(planCacheAction(allValid).action === 'verify-only', 'a fully valid cache uses no network');
  const oneInvalid = { ...allValid, 'contract-nli/dev.json': 'invalid' };
  const plan = planCacheAction(oneInvalid);
  ok(plan.action === 'error' && plan.reason.includes('dev.json'), 'a mismatched cached file fails closed and names the file');
  ok(CONTRACTNLI_RELEASE.zip.bytes === 65362913 && /^[0-9a-f]{64}$/.test(CONTRACTNLI_RELEASE.zip.sha256),
    'the pinned release carries its size and SHA-256');
}

// --- CLI end to end (synthetic input, temp directory, no network) -------------

{
  const scratch = mkdtempSync(path.join(tmpdir(), 'cnli-adapter-'));
  try {
    const datasetPath = path.join(scratch, 'train.json');
    writeFileSync(datasetPath, JSON.stringify(datasetWith([plainDoc, emojiDoc])));
    const outputPrefix = path.join(scratch, 'out', 'run');
    const adapterCli = path.join(root, 'evaluation/contractnli/adapter.mjs');
    const args = ['--split', 'train', '--engine-commit', 'test-commit', '--ruleset', 'test-ruleset',
      '--reference-time', '2026-11-15T00:00:00Z', '--input', datasetPath, '--output-prefix', outputPrefix];
    const first = spawnSync(process.execPath, [adapterCli, ...args], { encoding: 'utf8' });
    ok(first.status === 0, 'adapter CLI exits 0 on a clean synthetic dataset' + (first.status === 0 ? '' : ': ' + first.stderr));
    const second = spawnSync(process.execPath, [adapterCli, ...args], { encoding: 'utf8' });
    ok(second.status === 0 && readFileSync(outputPrefix + '.json', 'utf8').length > 0, 'adapter CLI is repeatable');
    ok(existsSync(outputPrefix + '.coverage.json'), 'adapter CLI writes the coverage sidecar');
    const coverage = JSON.parse(readFileSync(outputPrefix + '.coverage.json', 'utf8'));
    ok(coverage.applicable_hypotheses.length === 0 && coverage.dataset.split === 'train',
      'coverage reports the empty applicable subset under the production map');

    const runOutput = path.join(scratch, 'report.json');
    const evaluation = spawnSync(process.execPath, [path.join(root, 'evaluation/run-evaluation.mjs'), outputPrefix + '.json', '--output', runOutput], { encoding: 'utf8' });
    ok(evaluation.status === 0 && existsSync(runOutput), 'run-evaluation consumes the adapted shard' + (evaluation.status === 0 ? '' : ': ' + evaluation.stderr));
    const report = JSON.parse(readFileSync(runOutput, 'utf8'));
    ok(report.coverage.cases_included === 2 && report.coverage.expected_contradictions === 0,
      'the report reflects the negative corpus produced by the production map');

    const missing = spawnSync(process.execPath, [adapterCli, '--split', 'train'], { encoding: 'utf8' });
    ok(missing.status === 2, 'adapter CLI rejects missing required arguments');
    const badSplit = spawnSync(process.execPath, [adapterCli, '--split', 'nope', '--engine-commit', 'c', '--ruleset', 'r', '--reference-time', 't'], { encoding: 'utf8' });
    ok(badSplit.status === 2, 'adapter CLI rejects an unknown split');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

ok(CONTRACTNLI_DATASET.dataset_license.includes('CC BY 4.0') && CONTRACTNLI_DATASET.dataset_revision.includes('eced6528'),
  'the dataset identity records its pinned revision and license');

done('evaluation-contractnli');
