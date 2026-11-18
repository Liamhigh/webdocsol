#!/usr/bin/env node
// Development/CI only. Converts the pinned Stanford ContractNLI dataset into the
// Verum Omnis development-evaluation input contract (evaluation/schema.json).
// Never imported by browser or production engine code; reads no wall clock,
// uses no randomness, and sends nothing anywhere.

import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEvaluationRun } from '../lib/metrics.mjs';
import { canonicalJson } from '../lib/report.mjs';
import { EVALUATION_LIMITS } from '../lib/span-alignment.mjs';

export const CONTRACTNLI_ADAPTER_VERSION = '1.0.0';

export const CONTRACTNLI_DATASET = Object.freeze({
  dataset_id: 'contractnli',
  dataset_revision: 'stanfordnlp/contract-nli gh-pages eced6528dd3c1d14d73f9a87df8f7bdbc03126f9 (initial release, 2021-10-05)',
  dataset_license: 'CC BY 4.0 (Hitachi America, Ltd.)',
  scope_label: 'document_vs_hypothesis',
  splits: Object.freeze(['train', 'dev', 'test'])
});

const MAX_DATASET_BYTES = 64 * 1024 * 1024;

function fail(message) {
  throw new Error('[contractnli] ' + message);
}

function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

// ContractNLI span offsets are Python string indices (Unicode code points).
// The evaluation contract addresses UTF-16 code units, so every dataset offset
// is converted through this table. On the pinned corpus (BMP-only) this is the
// identity mapping; the conversion exists so a non-BMP document can never
// silently shift an evidence span.
export function codePointToUtf16Table(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const table = new Int32Array([...text].length + 1);
  let codePointIndex = 0;
  let utf16Index = 0;
  for (const character of text) {
    table[codePointIndex] = utf16Index;
    utf16Index += character.length;
    codePointIndex++;
  }
  table[codePointIndex] = utf16Index;
  return table;
}

export function hypothesisSortKey(key) {
  const match = /^nda-(\d+)$/.exec(key);
  if (!match) fail('malformed hypothesis key: ' + JSON.stringify(key));
  return Number(match[1]);
}

export function validateHypothesisMap(map) {
  if (!isPlainObject(map)) fail('hypothesis map must be a JSON object');
  if (typeof map.mapping_version !== 'string' || !map.mapping_version) fail('hypothesis map needs mapping_version');
  if (map.dataset_id !== CONTRACTNLI_DATASET.dataset_id) fail('hypothesis map dataset_id must be contractnli');
  if (!isPlainObject(map.hypotheses)) fail('hypothesis map needs a hypotheses object');
  const keys = Object.keys(map.hypotheses);
  if (!keys.length) fail('hypothesis map is empty');
  const validated = new Map();
  for (const key of keys) {
    hypothesisSortKey(key);
    const entry = map.hypotheses[key];
    if (!isPlainObject(entry)) fail(key + ': entry must be an object');
    if (typeof entry.hypothesis !== 'string' || !entry.hypothesis.trim()) fail(key + ': hypothesis text is required');
    if (typeof entry.short_description !== 'string' || !entry.short_description.trim()) fail(key + ': short_description is required');
    if (entry.status !== 'not_applicable' && entry.status !== 'mapped') fail(key + ': status must be not_applicable or mapped');
    if (entry.status === 'mapped') {
      if (typeof entry.verum_rule_id !== 'string' || !entry.verum_rule_id.trim()) {
        fail(key + ': a mapped hypothesis needs a verum_rule_id');
      }
    } else if (entry.verum_rule_id !== null) {
      fail(key + ': a not_applicable hypothesis must keep verum_rule_id null');
    }
    if (typeof entry.rationale !== 'string' || !entry.rationale.trim()) fail(key + ': rationale is required');
    validated.set(key, Object.freeze({
      hypothesis_key: key,
      hypothesis: entry.hypothesis,
      short_description: entry.short_description,
      status: entry.status,
      verum_rule_id: entry.verum_rule_id,
      rationale: entry.rationale
    }));
  }
  return validated;
}

export function parseContractNliDataset(jsonText) {
  if (typeof jsonText !== 'string') throw new TypeError('dataset JSON text must be a string');
  let dataset;
  try {
    dataset = JSON.parse(jsonText);
  } catch (error) {
    fail('dataset is not valid JSON: ' + error.message);
  }
  if (!isPlainObject(dataset)) fail('dataset root must be an object');
  if (!Array.isArray(dataset.documents)) fail('dataset.documents must be an array');
  if (!isPlainObject(dataset.labels) || !Object.keys(dataset.labels).length) fail('dataset.labels must be a non-empty object');
  for (const key of Object.keys(dataset.labels)) {
    hypothesisSortKey(key);
    const label = dataset.labels[key];
    if (!isPlainObject(label) || typeof label.hypothesis !== 'string' || !label.hypothesis.trim()) {
      fail('dataset label ' + key + ' needs hypothesis text');
    }
  }
  return dataset;
}

function sortedHypothesisKeys(labels) {
  return Object.keys(labels).sort((a, b) => hypothesisSortKey(a) - hypothesisSortKey(b));
}

// One EvaluationCase per document. Expected contradictions are created only for
// hypotheses the reviewed map marks "mapped" AND the annotator labelled
// Contradiction; Entailment and NotMentioned documents stay negative for
// contradiction retrieval. Hypotheses marked not_applicable are recorded in the
// coverage dispositions, never forced onto a Verum rule. A document with a
// structural annotation problem is excluded with its reason and stays visible.
export function adaptDataset(dataset, hypothesisMap) {
  const labelKeys = sortedHypothesisKeys(dataset.labels);
  for (const key of labelKeys) {
    if (!hypothesisMap.has(key)) fail('dataset hypothesis ' + key + ' is missing from the hypothesis map');
  }
  const cases = [];
  const dispositions = new Map();
  for (const key of labelKeys) {
    dispositions.set(key, {
      status: hypothesisMap.get(key).status,
      Entailment: 0,
      Contradiction: 0,
      NotMentioned: 0
    });
  }
  const documents = dataset.documents.slice().sort((a, b) => {
    const ai = Number.isInteger(a && a.id) ? a.id : Number.MAX_SAFE_INTEGER;
    const bi = Number.isInteger(b && b.id) ? b.id : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  for (const document of documents) {
    const outcome = adaptDocument(document, labelKeys, hypothesisMap, dispositions);
    cases.push(outcome);
  }
  return Object.freeze({ cases: Object.freeze(cases), dispositions });
}

function adaptDocument(document, labelKeys, hypothesisMap, dispositions) {
  const documentId = Number.isInteger(document && document.id) ? 'cnli-doc-' + document.id : null;
  const caseId = documentId || 'cnli-doc-unknown';
  const excluded = (reason) => Object.freeze({
    case_id: caseId,
    document_id: documentId || 'cnli-doc-unknown',
    source_text: typeof (document && document.text) === 'string' ? document.text : '',
    expected_contradictions: [],
    actual_findings: [],
    exclusion: { reason }
  });
  if (!documentId) return excluded('document_id_missing');
  if (typeof document.text !== 'string') return excluded('document_text_missing');
  if (!Array.isArray(document.annotation_sets) || document.annotation_sets.length !== 1) {
    return excluded('unexpected_annotation_sets');
  }
  const annotations = document.annotation_sets[0] && document.annotation_sets[0].annotations;
  if (!isPlainObject(annotations)) return excluded('annotations_missing');
  if (!Array.isArray(document.spans)) return excluded('span_table_missing');
  const codePointLength = [...document.text].length;
  const spanTable = document.spans;
  for (const pair of spanTable) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) ||
        pair[0] < 0 || pair[0] >= pair[1] || pair[1] > codePointLength) {
      return excluded('span_table_invalid');
    }
  }
  const expected = [];
  for (const key of labelKeys) {
    const annotation = annotations[key];
    if (!isPlainObject(annotation)) return excluded('missing_hypothesis_annotation');
    const choice = annotation.choice;
    if (choice !== 'Entailment' && choice !== 'Contradiction' && choice !== 'NotMentioned') {
      return excluded('unknown_choice');
    }
    if (!Array.isArray(annotation.spans)) return excluded('evidence_span_list_missing');
    const disposition = dispositions.get(key);
    disposition[choice]++;
    if (choice === 'NotMentioned' && annotation.spans.length) return excluded('inconsistent_annotation');
    if (choice !== 'Contradiction') continue;
    if (!annotation.spans.length) return excluded('contradiction_without_evidence');
    const mapping = hypothesisMap.get(key);
    if (mapping.status !== 'mapped') continue;
    const seen = new Set();
    const indices = annotation.spans.slice().sort((a, b) => a - b);
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= spanTable.length) return excluded('evidence_span_index_invalid');
      if (seen.has(index)) return excluded('duplicate_evidence_span');
      seen.add(index);
    }
    const utf16 = codePointToUtf16Table(document.text);
    const evidenceSpans = indices.map((index) => {
      const [startCp, endCp] = spanTable[index];
      const start = utf16[startCp];
      const end = utf16[endCp];
      return {
        span_id: 'sp' + index,
        start,
        end,
        quote: document.text.slice(start, end),
        page: null
      };
    });
    expected.push({
      contradiction_id: key,
      rule_id: mapping.verum_rule_id,
      scope: CONTRACTNLI_DATASET.scope_label,
      pair_mode: 'unordered',
      evidence_spans: evidenceSpans
    });
  }
  return Object.freeze({
    case_id: caseId,
    document_id: documentId,
    source_text: document.text,
    expected_contradictions: expected,
    actual_findings: []
  });
}

export function mergeActualFindings(cases, actuals) {
  if (!isPlainObject(actuals)) fail('actual findings merge file must be a JSON object keyed by case_id');
  const byId = new Map(cases.map((evaluationCase) => [evaluationCase.case_id, evaluationCase]));
  for (const caseId of Object.keys(actuals)) {
    if (!byId.has(caseId)) fail('actual findings name an unknown case_id: ' + JSON.stringify(caseId));
    if (!Array.isArray(actuals[caseId])) fail('actual findings for ' + JSON.stringify(caseId) + ' must be an array');
  }
  return cases.map((evaluationCase) => Object.freeze({
    ...evaluationCase,
    actual_findings: actuals[evaluationCase.case_id] || evaluationCase.actual_findings
  }));
}

export function shardCases(cases, budgets = {}) {
  const maxCases = budgets.maxCases || EVALUATION_LIMITS.maxCases;
  const maxCodeUnits = budgets.maxCodeUnits || 3500000;
  const shards = [];
  let current = [];
  let currentCodeUnits = 0;
  for (const evaluationCase of cases) {
    const codeUnits = evaluationCase.source_text.length;
    if (codeUnits > maxCodeUnits) fail('case ' + evaluationCase.case_id + ' alone exceeds the shard code-unit budget');
    if (current.length && (current.length + 1 > maxCases || currentCodeUnits + codeUnits > maxCodeUnits)) {
      shards.push(current);
      current = [];
      currentCodeUnits = 0;
    }
    current.push(evaluationCase);
    currentCodeUnits += codeUnits;
  }
  if (current.length) shards.push(current);
  return shards;
}

export function buildRunInput(manifestFields, cases) {
  const run = {
    schema_version: '1.0.0',
    manifest: {
      dataset_id: CONTRACTNLI_DATASET.dataset_id,
      dataset_revision: CONTRACTNLI_DATASET.dataset_revision,
      dataset_sha512: manifestFields.dataset_sha512,
      dataset_license: CONTRACTNLI_DATASET.dataset_license,
      evaluator_revision: 'contractnli-adapter@' + CONTRACTNLI_ADAPTER_VERSION,
      engine_commit: manifestFields.engine_commit,
      ruleset: manifestFields.ruleset,
      options: manifestFields.options,
      reference_time: manifestFields.reference_time,
      code_version: 'contractnli-adapter ' + CONTRACTNLI_ADAPTER_VERSION
    },
    cases
  };
  const errors = validateEvaluationRun(run);
  if (errors.length) fail('adapter produced an invalid evaluation run:\n- ' + errors.join('\n- '));
  return run;
}

export function buildCoverage(options) {
  const dispositions = {};
  for (const [key, counts] of options.dispositions) {
    dispositions[key] = counts;
  }
  return {
    adapter: 'contractnli-adapter',
    adapter_version: CONTRACTNLI_ADAPTER_VERSION,
    dataset: {
      dataset_id: CONTRACTNLI_DATASET.dataset_id,
      dataset_revision: CONTRACTNLI_DATASET.dataset_revision,
      dataset_license: CONTRACTNLI_DATASET.dataset_license,
      split: options.split,
      source_file_sha512: options.datasetSha512,
      source_file_bytes: options.datasetBytes
    },
    documents_total: options.cases.length,
    documents_excluded: options.cases
      .filter((evaluationCase) => evaluationCase.exclusion)
      .map((evaluationCase) => ({ document_id: evaluationCase.document_id, reason: evaluationCase.exclusion.reason })),
    hypothesis_dispositions: dispositions,
    applicable_hypotheses: [...options.dispositions.keys()].filter((key) => options.dispositions.get(key).status === 'mapped'),
    shards: options.shards,
    limitations: [
      'Task adaptation: contradiction retrieval and evidence localization only; the adapter does not fabricate an entailment classifier.',
      'A ContractNLI contradiction is document-vs-hypothesis; pair metrics here measure unordered evidence-set agreement, not a two-statement contradiction pair.',
      'Evidence spans are source character spans; page is null because no audited text-to-page rendering exists for this corpus.',
      'Hypotheses marked not_applicable in hypothesis-map.json produce no expected contradictions; with the current mapping this corpus is a negative (false-positive) corpus for the engine.',
      'Development evaluation only; no result here is finding confidence, severity, dataset-wide validation of unrelated detectors, or courtroom reliability.'
    ]
  };
}

// --- CLI -----------------------------------------------------------------

function terminalSafe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => '\\x' + character.charCodeAt(0).toString(16).padStart(2, '0'));
}

function usage() {
  console.error('Usage: node evaluation/contractnli/adapter.mjs --split <train|dev|test> --engine-commit <sha> --ruleset <id> --reference-time <iso>');
  console.error('       [--input <dataset.json>] [--output-prefix <path>] [--actuals <case_id-to-findings.json>] [--shard-chars <n>]');
  process.exit(2);
}

async function writeAtomically(outputPath, serialized) {
  const directory = path.dirname(outputPath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, '.' + path.basename(outputPath) + '.' + process.pid + '.tmp');
  let handle;
  try {
    handle = await open(temporaryPath, 'wx');
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (handle) await handle.close();
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function main(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index].startsWith('--') || index + 1 >= argv.length) usage();
    args[argv[index].slice(2)] = argv[index + 1];
  }
  const split = args.split;
  if (!split || !CONTRACTNLI_DATASET.splits.includes(split)) usage();
  for (const required of ['engine-commit', 'ruleset', 'reference-time']) {
    if (!args[required]) usage();
  }
  const inputPath = path.resolve(args.input || path.join('evaluation', '.cache', 'contractnli', split + '.json'));
  const outputPrefix = path.resolve(args['output-prefix'] || path.join('evaluation', 'reports', 'contractnli-' + split));
  const shardChars = args['shard-chars'] ? Number(args['shard-chars']) : 3500000;
  if (!Number.isInteger(shardChars) || shardChars < 1000) fail('--shard-chars must be an integer >= 1000');

  const inputStat = await stat(inputPath).catch(() => fail('dataset file not found: ' + inputPath + ' (run download-or-verify.mjs first)'));
  if (inputStat.size > MAX_DATASET_BYTES) fail('dataset file exceeds the 64 MiB adapter limit');
  const inputBytes = await readFile(inputPath);
  const datasetSha512 = createHash('sha512').update(inputBytes).digest('hex');
  const dataset = parseContractNliDataset(new TextDecoder('utf-8', { fatal: true }).decode(inputBytes));
  const mapText = await readFile(new URL('./hypothesis-map.json', import.meta.url), 'utf8');
  const hypothesisMap = validateHypothesisMap(JSON.parse(mapText));

  let { cases, dispositions } = adaptDataset(dataset, hypothesisMap);
  if (args.actuals) {
    const actuals = JSON.parse(await readFile(path.resolve(args.actuals), 'utf8'));
    cases = mergeActualFindings(cases, actuals);
  }
  const shards = shardCases(cases, { maxCodeUnits: shardChars });
  const shardDescriptions = [];
  for (let index = 0; index < shards.length; index++) {
    const shard = shards[index];
    const run = buildRunInput({
      dataset_sha512: datasetSha512,
      engine_commit: args['engine-commit'],
      ruleset: args.ruleset,
      reference_time: args['reference-time'],
      options: {
        adaptation: 'contradiction_retrieval',
        pair_mode: 'unordered',
        scope_label: CONTRACTNLI_DATASET.scope_label,
        shard_index: index + 1,
        shard_count: shards.length
      }
    }, shard);
    const outputPath = shards.length === 1
      ? outputPrefix + '.json'
      : outputPrefix + '.shard-' + String(index + 1).padStart(2, '0') + '.json';
    await writeAtomically(outputPath, canonicalJson(run));
    shardDescriptions.push({
      file: path.basename(outputPath),
      cases: shard.length,
      code_units: shard.reduce((sum, evaluationCase) => sum + evaluationCase.source_text.length, 0)
    });
  }
  const coverage = buildCoverage({
    split,
    cases,
    dispositions,
    datasetSha512,
    datasetBytes: inputBytes.byteLength,
    shards: shardDescriptions
  });
  const coveragePath = outputPrefix + '.coverage.json';
  await writeAtomically(coveragePath, canonicalJson(coverage));
  const excludedCount = cases.filter((evaluationCase) => evaluationCase.exclusion).length;
  console.log('[contractnli] split=' + split + ' documents=' + cases.length + ' excluded=' + excludedCount +
    ' shards=' + shards.length + ' applicable_hypotheses=' + coverage.applicable_hypotheses.length);
  console.log('[contractnli] coverage=' + terminalSafe(coveragePath));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
