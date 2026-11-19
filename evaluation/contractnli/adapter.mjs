#!/usr/bin/env node
// Development/CI only. Converts the pinned Stanford ContractNLI dataset into the
// Verum Omnis development-evaluation input contract (evaluation/schema.json).
// Never imported by browser or production engine code; reads no wall clock,
// uses no randomness, and sends nothing anywhere.

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEvaluationRun } from '../lib/metrics.mjs';
import { canonicalJson } from '../lib/report.mjs';
import { EVALUATION_LIMITS } from '../lib/span-alignment.mjs';
import { CONTRACTNLI_RELEASE, verifyMemberBytes } from './download-or-verify.mjs';

export const CONTRACTNLI_ADAPTER_VERSION = '1.0.0';

export const CONTRACTNLI_DATASET = Object.freeze({
  dataset_id: 'contractnli',
  dataset_revision: 'stanfordnlp/contract-nli gh-pages eced6528dd3c1d14d73f9a87df8f7bdbc03126f9 (initial release, 2021-10-05)',
  dataset_license: 'CC BY 4.0 (Hitachi America, Ltd.)',
  scope_label: 'document_vs_hypothesis',
  splits: Object.freeze(['train', 'dev', 'test'])
});

const MAX_DATASET_BYTES = 64 * 1024 * 1024;
const MAX_ACTUALS_BYTES = EVALUATION_LIMITS.maxInputBytes;

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
  let codePointLength = 0;
  for (const _character of text) codePointLength++;
  const table = new Int32Array(codePointLength + 1);
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
  if (!Array.isArray(dataset.documents) || !dataset.documents.length) fail('dataset.documents must be a non-empty array');
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
  if (!isPlainObject(dataset) || !isPlainObject(dataset.labels)) fail('dataset.labels must be an object');
  if (!Array.isArray(dataset.documents) || !dataset.documents.length) {
    fail('dataset.documents must be a non-empty array');
  }
  const labelKeys = sortedHypothesisKeys(dataset.labels);
  for (const key of labelKeys) {
    if (!hypothesisMap.has(key)) fail('dataset hypothesis ' + key + ' is missing from the hypothesis map');
    if (dataset.labels[key].hypothesis !== hypothesisMap.get(key).hypothesis) {
      fail('dataset hypothesis text does not match the reviewed map for ' + key);
    }
  }
  const indexedDocuments = dataset.documents.map((document, index) => ({ document, index }));
  const idCounts = new Map();
  for (const { document } of indexedDocuments) {
    if (Number.isSafeInteger(document && document.id)) idCounts.set(document.id, (idCounts.get(document.id) || 0) + 1);
  }
  const idOccurrences = new Map();
  const cases = [];
  const choicesByCase = new Map();
  const dispositions = new Map();
  for (const key of labelKeys) {
    dispositions.set(key, {
      status: hypothesisMap.get(key).status,
      Entailment: 0,
      Contradiction: 0,
      NotMentioned: 0
    });
  }
  const documents = indexedDocuments.slice().sort((a, b) => {
    const ai = Number.isSafeInteger(a.document && a.document.id) ? a.document.id : Number.MAX_SAFE_INTEGER;
    const bi = Number.isSafeInteger(b.document && b.document.id) ? b.document.id : Number.MAX_SAFE_INTEGER;
    return ai - bi || a.index - b.index;
  });
  for (const { document, index } of documents) {
    let documentId;
    if (Number.isSafeInteger(document && document.id)) {
      const occurrence = (idOccurrences.get(document.id) || 0) + 1;
      idOccurrences.set(document.id, occurrence);
      documentId = idCounts.get(document.id) === 1
        ? 'cnli-doc-' + document.id
        : 'cnli-doc-' + document.id + '-duplicate-' + occurrence;
    } else {
      documentId = 'cnli-doc-invalid-' + (index + 1);
    }
    const outcome = adaptDocument(document, documentId, labelKeys, hypothesisMap);
    cases.push(outcome.evaluationCase);
    if (!outcome.evaluationCase.exclusion) {
      choicesByCase.set(outcome.evaluationCase.case_id, outcome.choices);
      for (const key of labelKeys) dispositions.get(key)[outcome.choices[key]]++;
    }
  }
  return Object.freeze({ cases: Object.freeze(cases), dispositions, choicesByCase });
}

function adaptDocument(document, documentId, labelKeys, hypothesisMap) {
  const caseId = documentId;
  const excluded = (reason, sourceText = typeof (document && document.text) === 'string' ? document.text : '') => ({
    evaluationCase: Object.freeze({
      case_id: caseId,
      document_id: documentId,
      source_text: sourceText,
      expected_contradictions: [],
      actual_findings: [],
      exclusion: { reason }
    }),
    choices: null
  });
  if (!Number.isSafeInteger(document && document.id)) return excluded('document_id_missing');
  if (typeof document.text !== 'string') return excluded('document_text_missing');
  if (document.text.length > EVALUATION_LIMITS.maxSourceCodeUnitsPerCase) return excluded('source_text_exceeds_per_case_limit', '');
  if (!Array.isArray(document.annotation_sets) || document.annotation_sets.length !== 1) {
    return excluded('unexpected_annotation_sets');
  }
  const annotations = document.annotation_sets[0] && document.annotation_sets[0].annotations;
  if (!isPlainObject(annotations)) return excluded('annotations_missing');
  if (!Array.isArray(document.spans)) return excluded('span_table_missing');
  let codePointLength = 0;
  for (const _character of document.text) codePointLength++;
  const spanTable = document.spans;
  for (const pair of spanTable) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) ||
        pair[0] < 0 || pair[0] >= pair[1] || pair[1] > codePointLength) {
      return excluded('span_table_invalid');
    }
  }
  for (const annotation of Object.values(annotations)) {
    if (!isPlainObject(annotation) || !Array.isArray(annotation.spans)) return excluded('evidence_span_list_missing');
    const seen = new Set();
    for (const index of annotation.spans) {
      if (!Number.isInteger(index) || index < 0 || index >= spanTable.length) return excluded('evidence_span_index_invalid');
      if (seen.has(index)) return excluded('duplicate_evidence_span');
      seen.add(index);
    }
  }
  const expected = [];
  const choices = {};
  const utf16 = codePointToUtf16Table(document.text);
  for (const key of labelKeys) {
    const annotation = annotations[key];
    if (!isPlainObject(annotation)) return excluded('missing_hypothesis_annotation');
    const choice = annotation.choice;
    if (choice !== 'Entailment' && choice !== 'Contradiction' && choice !== 'NotMentioned') {
      return excluded('unknown_choice');
    }
    const indices = annotation.spans.slice().sort((a, b) => a - b);
    if (choice === 'NotMentioned' && annotation.spans.length) return excluded('inconsistent_annotation');
    if (choice === 'Contradiction' && !annotation.spans.length) return excluded('contradiction_without_evidence');
    choices[key] = choice;
    if (choice !== 'Contradiction') continue;
    const mapping = hypothesisMap.get(key);
    if (mapping.status !== 'mapped') continue;
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
  return {
    evaluationCase: Object.freeze({
      case_id: caseId,
      document_id: documentId,
      source_text: document.text,
      expected_contradictions: expected,
      actual_findings: []
    }),
    choices
  };
}

export function mergeActualFindings(cases, actuals, allowedRuleIds = []) {
  if (!isPlainObject(actuals)) fail('actual findings merge file must be a JSON object keyed by case_id');
  const byId = new Map(cases.map((evaluationCase) => [evaluationCase.case_id, evaluationCase]));
  const allowed = new Set(allowedRuleIds);
  for (const caseId of Object.keys(actuals)) {
    if (!byId.has(caseId)) fail('actual findings name an unknown case_id: ' + JSON.stringify(caseId));
    if (!Array.isArray(actuals[caseId])) fail('actual findings for ' + JSON.stringify(caseId) + ' must be an array');
    if (byId.get(caseId).exclusion && actuals[caseId].length) {
      fail('actual findings cannot be assigned to an excluded case: ' + JSON.stringify(caseId));
    }
    for (const finding of actuals[caseId]) {
      if (!isPlainObject(finding) || typeof finding.rule_id !== 'string' || !allowed.has(finding.rule_id)) {
        fail('actual finding rule_id is not grounded by a mapped ContractNLI hypothesis for ' + JSON.stringify(caseId));
      }
    }
  }
  return cases.map((evaluationCase) => Object.freeze({
    ...evaluationCase,
    actual_findings: actuals[evaluationCase.case_id] || evaluationCase.actual_findings
  }));
}

export function shardCases(cases, budgets = {}) {
  const maxCases = Math.min(budgets.maxCases || EVALUATION_LIMITS.maxCases, EVALUATION_LIMITS.maxCases);
  const maxCodeUnits = Math.min(budgets.maxCodeUnits || EVALUATION_LIMITS.maxTotalSourceCodeUnits, EVALUATION_LIMITS.maxTotalSourceCodeUnits);
  const maxSerializedBytes = Math.min(budgets.maxSerializedBytes || EVALUATION_LIMITS.maxInputBytes, EVALUATION_LIMITS.maxInputBytes);
  const measure = budgets.measure || ((candidate) => Buffer.byteLength(canonicalJson({ cases: candidate }), 'utf8'));
  const shards = [];
  const includedCases = [];
  const excludedCases = [];
  let current = [];
  const fits = (candidate) => {
    const totalCodeUnits = candidate.reduce((sum, item) => sum + item.source_text.length, 0);
    if (candidate.length > maxCases || totalCodeUnits > maxCodeUnits) return false;
    try {
      const errors = budgets.validate ? budgets.validate(candidate) : [];
      return errors.length === 0 && measure(candidate) <= maxSerializedBytes;
    } catch {
      return false;
    }
  };
  for (const evaluationCase of cases) {
    let candidate = evaluationCase;
    if (!fits([evaluationCase])) {
      candidate = Object.freeze({
        ...evaluationCase,
        source_text: '',
        expected_contradictions: [],
        actual_findings: [],
        exclusion: {
          reason: evaluationCase.exclusion
            ? evaluationCase.exclusion.reason + '; source removed to satisfy shard limits'
            : 'case_exceeds_evaluator_or_serialized_limit'
        }
      });
      excludedCases.push(candidate);
    }
    if (current.length && !fits([...current, candidate])) {
      shards.push(current);
      current = [];
    }
    current.push(candidate);
    includedCases.push(candidate);
  }
  if (current.length) shards.push(current);
  Object.defineProperties(shards, {
    cases: { value: Object.freeze(includedCases) },
    excludedCases: { value: Object.freeze(excludedCases) }
  });
  return shards;
}

export function buildRunInput(manifestFields, cases) {
  const run = {
    schema_version: '1.0.0',
    manifest: {
      dataset_id: manifestFields.dataset_id || CONTRACTNLI_DATASET.dataset_id,
      dataset_revision: manifestFields.dataset_revision || CONTRACTNLI_DATASET.dataset_revision,
      dataset_sha512: manifestFields.dataset_sha512,
      dataset_license: manifestFields.dataset_license || CONTRACTNLI_DATASET.dataset_license,
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
      dataset_id: (options.identity || CONTRACTNLI_DATASET).dataset_id,
      dataset_revision: (options.identity || CONTRACTNLI_DATASET).dataset_revision,
      dataset_license: (options.identity || CONTRACTNLI_DATASET).dataset_license,
      split: options.split,
      source_file_sha512: options.datasetSha512,
      source_file_bytes: options.datasetBytes,
      provenance: options.identity ? (options.identity.dataset_id === CONTRACTNLI_DATASET.dataset_id ? 'pinned_official_release' : 'caller_supplied_unverified') : 'pinned_official_release'
    },
    generation: options.generation,
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
      'Hypotheses marked not_applicable in hypothesis-map.json produce no expected contradictions; the pinned official corpus is a negative (false-positive) corpus with the current mapping.',
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
  let handle;
  let temporaryPath;
  let created = false;
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      temporaryPath = path.join(directory, '.' + path.basename(outputPath) + '.' + randomBytes(16).toString('hex') + '.tmp');
      try {
        handle = await open(temporaryPath, 'wx');
        created = true;
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
    if (!handle) throw new Error('Could not allocate a temporary ContractNLI output file');
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, outputPath);
    created = false;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (created) await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function boundedRead(filePath, maxBytes, label) {
  const handle = await open(filePath, 'r').catch(() => fail(label + ' file not found: ' + filePath));
  try {
    const fileStat = await handle.stat();
    if (fileStat.size > maxBytes) fail(label + ' exceeds the ' + maxBytes + '-byte limit');
    const chunks = [];
    const chunkSize = 64 * 1024;
    let total = 0;
    while (total <= maxBytes) {
      const buffer = Buffer.alloc(Math.min(chunkSize, maxBytes - total + 1));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, total);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > maxBytes) fail(label + ' exceeds the ' + maxBytes + '-byte limit');
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}

async function canonicalTarget(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    return await realpath(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await realpath(path.dirname(filePath)), path.basename(filePath));
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail(label + ' must be valid UTF-8');
  }
}

function officialDataset(split, bytes) {
  const memberName = 'contract-nli/' + split + '.json';
  try {
    verifyMemberBytes(memberName, bytes);
    return true;
  } catch {
    return false;
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
  const actualsPath = args.actuals ? path.resolve(args.actuals) : null;
  const inputCanonical = await realpath(inputPath).catch(() => fail('dataset file not found: ' + inputPath + ' (run download-or-verify.mjs first)'));
  const actualsCanonical = actualsPath ? await realpath(actualsPath).catch(() => fail('actual findings file not found: ' + actualsPath)) : null;
  const outputCanonical = await canonicalTarget(outputPrefix + '.coverage.json');
  if (outputCanonical === inputCanonical || (actualsCanonical && outputCanonical === actualsCanonical)) {
    fail('output path must not alias the dataset or actual findings file');
  }
  const inputBytes = await boundedRead(inputCanonical, MAX_DATASET_BYTES, 'dataset');
  const datasetSha512 = createHash('sha512').update(inputBytes).digest('hex');
  const isOfficial = officialDataset(split, inputBytes);
  const dataset = parseContractNliDataset(decodeUtf8(inputBytes, 'dataset'));
  const mapText = await readFile(new URL('./hypothesis-map.json', import.meta.url), 'utf8');
  const hypothesisMap = validateHypothesisMap(JSON.parse(mapText));
  const effectiveMap = isOfficial ? hypothesisMap : validateHypothesisMap({
    mapping_version: 'caller-supplied-unverified',
    dataset_id: CONTRACTNLI_DATASET.dataset_id,
    hypotheses: Object.fromEntries(Object.entries(dataset.labels).map(([key, label]) => [key, {
      hypothesis: label.hypothesis,
      short_description: label.short_description || key,
      status: 'not_applicable',
      verum_rule_id: null,
      rationale: 'Caller-supplied dataset content is unverified and is not mapped to a Verum detector.'
    }]))
  });

  const adapted = adaptDataset(dataset, effectiveMap);
  let cases = adapted.cases;
  const dispositions = new Map([...adapted.dispositions].map(([key, counts]) => [key, { ...counts }]));
  if (actualsCanonical) {
    const actualsBytes = await boundedRead(actualsCanonical, MAX_ACTUALS_BYTES, 'actual findings');
    let actuals;
    try {
      actuals = JSON.parse(decodeUtf8(actualsBytes, 'actual findings'));
    } catch (error) {
      if (error.message.includes('[contractnli]')) throw error;
      fail('actual findings are not valid JSON: ' + error.message);
    }
    const allowedRuleIds = [...effectiveMap.values()]
      .filter((entry) => entry.status === 'mapped')
      .map((entry) => entry.verum_rule_id);
    cases = mergeActualFindings(cases, actuals, allowedRuleIds);
  }
  const identity = isOfficial
    ? CONTRACTNLI_DATASET
    : {
      dataset_id: 'contractnli-custom',
      dataset_revision: 'caller-supplied-unverified',
      dataset_license: 'Caller-supplied data; provenance and license not verified',
      scope_label: CONTRACTNLI_DATASET.scope_label
    };
  const makeManifest = (shardIndex, shardCount) => ({
    dataset_sha512: datasetSha512,
    dataset_id: identity.dataset_id,
    dataset_revision: identity.dataset_revision,
    dataset_license: identity.dataset_license,
    engine_commit: args['engine-commit'],
    ruleset: args.ruleset,
    reference_time: args['reference-time'],
    options: {
      adaptation: 'contradiction_retrieval',
      pair_mode: 'unordered',
      scope_label: CONTRACTNLI_DATASET.scope_label,
      shard_index: shardIndex,
      shard_count: shardCount
    }
  });
  const shards = shardCases(cases, {
    maxCases: EVALUATION_LIMITS.maxCases,
    maxCodeUnits: Math.min(shardChars, EVALUATION_LIMITS.maxTotalSourceCodeUnits),
    maxSerializedBytes: EVALUATION_LIMITS.maxInputBytes,
    validate: (candidate) => validateEvaluationRun(buildRunInput(makeManifest(cases.length, cases.length), candidate)),
    measure: (candidate) => Buffer.byteLength(canonicalJson(buildRunInput(makeManifest(cases.length, cases.length), candidate)), 'utf8')
  });
  cases = shards.cases;
  for (const evaluationCase of shards.excludedCases) {
    const choices = adapted.choicesByCase.get(evaluationCase.case_id);
    if (!choices) continue;
    for (const key of Object.keys(choices)) dispositions.get(key)[choices[key]]--;
  }

  const runRecords = [];
  for (let index = 0; index < shards.length; index++) {
    const shard = shards[index];
    const run = buildRunInput(makeManifest(index + 1, shards.length), shard);
    const serialized = canonicalJson(run);
    if (Buffer.byteLength(serialized, 'utf8') > EVALUATION_LIMITS.maxInputBytes) {
      fail('serialized shard exceeds the 16 MiB evaluator input limit');
    }
    runRecords.push({ run, serialized });
  }
  const generation = createHash('sha256')
    .update(canonicalJson(runRecords.map((record) => record.serialized)))
    .digest('hex');
  const shardDescriptions = [];
  const outputPaths = runRecords.map((record, index) => outputPrefix + '.' + generation + '.shard-' + String(index + 1).padStart(2, '0') + '.json');
  const canonicalOutputs = await Promise.all([...outputPaths, outputPrefix + '.coverage.json'].map(canonicalTarget));
  if (canonicalOutputs.some((output) => output === inputCanonical || (actualsCanonical && output === actualsCanonical)) ||
      new Set(canonicalOutputs).size !== canonicalOutputs.length) {
    fail('an output path aliases the dataset, actual findings file, or another output');
  }
  for (let index = 0; index < runRecords.length; index++) {
    const shard = shards[index];
    await writeAtomically(outputPaths[index], runRecords[index].serialized);
    shardDescriptions.push({
      file: path.basename(outputPaths[index]),
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
    shards: shardDescriptions,
    identity,
    generation
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
