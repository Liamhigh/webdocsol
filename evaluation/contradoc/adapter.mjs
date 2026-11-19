#!/usr/bin/env node
// Development/CI only. Converts the pinned official ContraDoc dataset into the
// Verum Omnis development-evaluation input contract (evaluation/schema.json).
// Never imported by browser or production engine code; output content depends
// only on the supplied data and options, with no sampling or external writes.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEvaluationRun } from '../lib/metrics.mjs';
import { canonicalJson } from '../lib/report.mjs';
import { shardCases } from '../contractnli/adapter.mjs';

export const CONTRADOC_ADAPTER_VERSION = '1.0.0';

export const CONTRADOC_DATASET = Object.freeze({
  dataset_id: 'contradoc',
  dataset_revision: 'ddhruvkr/CONTRADOC d1c42d1e433595dd6e98fab7b669722cdc050b1d (arXiv 2311.09182)',
  dataset_license: 'Apache-2.0',
  rule_id: 'contradoc:self_contradiction'
});

// Explicit scope mapping from published ContraDoc labels to Verum labels.
// Published labels and their distributions remain in the coverage sidecar;
// this bridge does not claim the taxonomies are identical.
export const CONTRADOC_SCOPE_MAP = Object.freeze({
  'intra': 'within_sentence',
  'local': 'within_document_nearby',
  'global': 'within_document_distant'
});

const MAX_DATASET_BYTES = 64 * 1024 * 1024;
const MAX_ACTUALS_BYTES = 16 * 1024 * 1024;

function fail(message) {
  throw new Error('[contradoc] ' + message);
}

export function mapContraDocScope(scope) {
  if (typeof scope !== 'string') return scope;
  const label = scope.startsWith('contradoc:') ? scope.slice('contradoc:'.length) : scope;
  if (Object.prototype.hasOwnProperty.call(CONTRADOC_SCOPE_MAP, label)) return CONTRADOC_SCOPE_MAP[label];
  if (Object.values(CONTRADOC_SCOPE_MAP).includes(scope)) return scope;
  return scope.startsWith('contradoc:') ? scope : 'contradoc:' + scope;
}

export async function readBoundedHandle(handle, maxBytes, label) {
  const info = await handle.stat();
  if (!info.isFile()) fail(label + ' must be a regular file');
  if (info.size > maxBytes) fail(label + ' exceeds the ' + maxBytes + '-byte limit');
  const chunks = [];
  let total = 0;
  while (true) {
    const length = Math.min(64 * 1024, maxBytes - total + 1);
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(buffer, 0, length, total);
    if (!bytesRead) break;
    total += bytesRead;
    if (total > maxBytes) fail(label + ' exceeds the ' + maxBytes + '-byte limit');
    chunks.push(buffer.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, total);
}

export async function readBoundedFile(filePath, maxBytes, label) {
  const handle = await open(filePath, 'r');
  try {
    return await readBoundedHandle(handle, maxBytes, label);
  } finally {
    await handle.close();
  }
}

async function canonicalFuturePath(target) {
  let current = path.resolve(target);
  const suffix = [];
  while (true) {
    try {
      return path.join(await realpath(current), ...suffix);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function parseContraDocDataset(jsonText) {
  if (typeof jsonText !== 'string') throw new TypeError('dataset JSON text must be a string');
  let dataset;
  try {
    dataset = JSON.parse(jsonText);
  } catch (error) {
    fail('dataset is not valid JSON: ' + error.message);
  }
  if (!isPlainObject(dataset) || !isPlainObject(dataset.pos) || !isPlainObject(dataset.neg)) {
    fail('dataset root must hold pos and neg objects');
  }
  return dataset;
}

// Exact substring location only. Gold text is never trimmed or normalized to
// force a match; a sentence that does not occur verbatim exactly once is
// reported in coverage instead of being anchored approximately.
export function locateSentence(text, sentence) {
  if (typeof sentence !== 'string' || !sentence) return 'missing';
  let first = -1;
  let count = 0;
  let index = -1;
  while ((index = text.indexOf(sentence, index + 1)) !== -1) {
    if (first === -1) first = index;
    count++;
    if (count > 1) return 'ambiguous';
  }
  return count === 1 ? first : 'missing';
}

export function adaptDataset(dataset) {
  const cases = [];
  const coverage = {
    pos_documents: 0,
    neg_documents: 0,
    scope_labels: {},
    contra_types: {},
    contra_plugs: {},
    doc_types: {},
    ref_sentences_total: 0,
    ref_sentences_located: 0,
    ref_sentences_omitted: [],
    incomplete_pairs: []
  };
  const bump = (table, key) => { table[key] = (table[key] || 0) + 1; };
  const sortedKeys = (object) => Object.keys(object).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const key of sortedKeys(dataset.pos)) {
    const record = dataset.pos[key];
    coverage.pos_documents++;
    const caseId = 'cdoc-pos-' + key;
    const excluded = (reason) => {
      cases.push(Object.freeze({
        case_id: caseId,
        document_id: caseId,
        source_text: typeof (record && record.text) === 'string' ? record.text : '',
        expected_contradictions: [],
        actual_findings: [],
        exclusion: { reason }
      }));
    };
    if (!isPlainObject(record) || typeof record.text !== 'string' || !record.text) {
      excluded('document_text_missing');
      continue;
    }
    if (typeof record.evidence !== 'string' || !record.evidence.trim()) {
      excluded('evidence_missing');
      continue;
    }
    // 82 published records carry scope as a single-element array (["global"]);
    // that label is normalized to the string and the transformation recorded.
    const scope = Array.isArray(record.scope) && record.scope.length === 1 &&
      typeof record.scope[0] === 'string' && record.scope[0].trim()
      ? record.scope[0]
      : (typeof record.scope === 'string' ? record.scope : null);
    if (scope === null || !scope.trim()) {
      excluded('scope_missing');
      continue;
    }
    if (Array.isArray(record.scope)) coverage.scope_array_normalized = (coverage.scope_array_normalized || 0) + 1;
    if (!Array.isArray(record.contra_type) || !record.contra_type.every((type) => typeof type === 'string' && type)) {
      excluded('contra_type_invalid');
      continue;
    }
    bump(coverage.scope_labels, scope);
    bump(coverage.doc_types, String(record.doc_type));
    bump(coverage.contra_plugs, String(record.contra_plug));
    for (const type of record.contra_type) bump(coverage.contra_types, type);
    const evidenceStart = locateSentence(record.text, record.evidence);
    if (evidenceStart === 'missing' || evidenceStart === 'ambiguous') {
      excluded('evidence_not_located_verbatim');
      continue;
    }
    const evidenceEnd = evidenceStart + record.evidence.length;
    const spans = [];
    const usedLocations = new Set();
    const refs = Array.isArray(record['ref sentences']) ? record['ref sentences'] : [];
    refs.forEach((reference, referenceIndex) => {
      coverage.ref_sentences_total++;
      if (typeof reference !== 'string' || !reference) {
        coverage.ref_sentences_omitted.push({ document_id: caseId, ref_index: referenceIndex, reason: 'not_a_string' });
        return;
      }
      const start = locateSentence(record.text, reference);
      if (start === 'missing' || start === 'ambiguous') {
        coverage.ref_sentences_omitted.push({ document_id: caseId, ref_index: referenceIndex, reason: start === 'missing' ? 'not_found_verbatim' : 'ambiguous_location' });
        return;
      }
      const location = start + ':' + (start + reference.length);
      if (location === evidenceStart + ':' + evidenceEnd) {
        // 48 published records list the evidence sentence itself as a ref;
        // the redundant ref is omitted and disclosed, the document stays.
        coverage.ref_sentences_omitted.push({ document_id: caseId, ref_index: referenceIndex, reason: 'same_location_as_evidence' });
        return;
      }
      if (usedLocations.has(location)) {
        coverage.ref_sentences_omitted.push({ document_id: caseId, ref_index: referenceIndex, reason: 'duplicate_location' });
        return;
      }
      coverage.ref_sentences_located++;
      usedLocations.add(location);
      spans.push({
        span_id: 'ref' + referenceIndex,
        start,
        end: start + reference.length,
        quote: record.text.slice(start, start + reference.length),
        page: null
      });
    });
    if (spans.length === 0) {
      coverage.incomplete_pairs.push({
        case_id: caseId,
        reason: 'no_locatable_distinct_reference_span'
      });
    }
    spans.push({
      span_id: 'evidence',
      start: evidenceStart,
      end: evidenceEnd,
      quote: record.text.slice(evidenceStart, evidenceEnd),
      page: null
    });
    cases.push(Object.freeze({
      case_id: caseId,
      document_id: caseId,
      source_text: record.text,
      expected_contradictions: [{
        contradiction_id: 'self',
        rule_id: CONTRADOC_DATASET.rule_id,
        scope: mapContraDocScope('contradoc:' + scope),
        pair_mode: 'unordered',
        evidence_spans: spans
      }],
      actual_findings: []
    }));
  }

  for (const key of sortedKeys(dataset.neg)) {
    const record = dataset.neg[key];
    coverage.neg_documents++;
    const caseId = 'cdoc-neg-' + key;
    if (!isPlainObject(record) || typeof record.text !== 'string' || !record.text) {
      cases.push(Object.freeze({
        case_id: caseId,
        document_id: caseId,
        source_text: '',
        expected_contradictions: [],
        actual_findings: [],
        exclusion: { reason: 'document_text_missing' }
      }));
      continue;
    }
    bump(coverage.doc_types, String(record.doc_type));
    cases.push(Object.freeze({
      case_id: caseId,
      document_id: caseId,
      source_text: record.text,
      expected_contradictions: [],
      actual_findings: []
    }));
  }
  return Object.freeze({ cases: Object.freeze(cases), coverage });
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
    actual_findings: (actuals[evaluationCase.case_id] || evaluationCase.actual_findings).map((finding) => ({
      ...finding,
      scope: mapContraDocScope(finding.scope)
    }))
  }));
}

export function buildRunInput(manifestFields, cases) {
  const run = {
    schema_version: '1.0.0',
    manifest: {
      dataset_id: CONTRADOC_DATASET.dataset_id,
      dataset_revision: CONTRADOC_DATASET.dataset_revision,
      dataset_sha512: manifestFields.dataset_sha512,
      dataset_license: CONTRADOC_DATASET.dataset_license,
      evaluator_revision: 'contradoc-adapter@' + CONTRADOC_ADAPTER_VERSION,
      engine_commit: manifestFields.engine_commit,
      ruleset: manifestFields.ruleset,
      options: manifestFields.options,
      reference_time: manifestFields.reference_time,
      code_version: 'contradoc-adapter ' + CONTRADOC_ADAPTER_VERSION
    },
    cases
  };
  const errors = validateEvaluationRun(run);
  if (errors.length) fail('adapter produced an invalid evaluation run:\n- ' + errors.join('\n- '));
  return run;
}

export { shardCases };

// --- CLI -----------------------------------------------------------------

function terminalSafe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => '\\x' + character.charCodeAt(0).toString(16).padStart(2, '0'));
}

function usage() {
  console.error('Usage: node evaluation/contradoc/adapter.mjs --engine-commit <sha> --ruleset <id> --reference-time <iso>');
  console.error('       [--input <ContraDoc.json>] [--output-prefix <path>] [--actuals <case_id-to-findings.json>] [--shard-chars <n>]');
  process.exit(2);
}

async function writeAtomically(outputPath, serialized) {
  const directory = path.dirname(outputPath);
  await mkdir(directory, { recursive: true });
  let handle;
  let temporaryPath;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      temporaryPath = path.join(directory, '.' + path.basename(outputPath) + '.' + process.pid + '.' + attempt + '.tmp');
      try {
        handle = await open(temporaryPath, 'wx');
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
    if (!handle) throw new Error('Could not allocate a temporary ContraDoc pointer file');
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

async function assertNoOutputAliases(outputPrefix, inputPath, actualsPath, shardCount) {
  const protectedInputs = new Set([await canonicalFuturePath(inputPath)]);
  if (actualsPath) protectedInputs.add(await canonicalFuturePath(actualsPath));
  const prefixName = path.basename(outputPrefix);
  const outputPaths = [
    outputPrefix,
    outputPrefix + '.current.json',
    outputPrefix + '.lock',
    outputPrefix + '.generations',
    outputPrefix + '.json',
    outputPrefix + '.coverage.json',
    ...Array.from({ length: shardCount }, (_, index) =>
      outputPrefix + '.shard-' + String(index + 1).padStart(2, '0') + '.json')
  ];
  for (const outputPath of outputPaths) {
    if (protectedInputs.has(await canonicalFuturePath(outputPath))) {
      fail('output prefix would overwrite an input file: ' + prefixName);
    }
  }
}

async function publishGeneration(outputPrefix, outputFiles) {
  const generationRoot = outputPrefix + '.generations';
  const currentPath = outputPrefix + '.current.json';
  const lockPath = outputPrefix + '.lock';
  await mkdir(path.dirname(outputPrefix), { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') fail('output prefix is locked by another adapter process: ' + path.basename(outputPrefix));
    throw error;
  }
  let stageDirectory;
  try {
    await lock.writeFile(String(process.pid));
    await lock.sync();
    await lock.close();
    lock = null;
    await mkdir(generationRoot, { recursive: true });
    stageDirectory = await mkdtemp(path.join(generationRoot, '.stage-'));
    const hash = createHash('sha256');
    for (const output of outputFiles) {
      hash.update(output.file).update('\0').update(output.serialized);
      await writeFile(path.join(stageDirectory, output.file), output.serialized, 'utf8');
    }
    const generationId = hash.digest('hex');
    const generationDirectory = path.join(generationRoot, generationId);
    let existingGeneration = false;
    try {
      const info = await stat(generationDirectory);
      if (!info.isDirectory()) fail('generation path exists but is not a directory');
      existingGeneration = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (existingGeneration) {
      for (const output of outputFiles) {
        const existing = await readFile(path.join(generationDirectory, output.file), 'utf8');
        if (existing !== output.serialized) fail('existing generation does not match its content identifier');
      }
      await rm(stageDirectory, { recursive: true, force: true });
      stageDirectory = null;
    } else {
      await rename(stageDirectory, generationDirectory);
      stageDirectory = null;
    }
    const pointer = {
      adapter: 'contradoc-adapter',
      generation_id: generationId,
      generation_directory: path.relative(path.dirname(currentPath), generationDirectory),
      run_files: outputFiles.filter((output) => output.kind === 'run').map((output) => output.file),
      coverage_file: outputFiles.find((output) => output.kind === 'coverage').file
    };
    await writeAtomically(currentPath, canonicalJson(pointer));
    return { pointer, currentPath };
  } finally {
    if (lock) await lock.close().catch(() => {});
    if (stageDirectory) await rm(stageDirectory, { recursive: true, force: true });
    await unlink(lockPath).catch(() => {});
  }
}

async function main(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index].startsWith('--') || index + 1 >= argv.length) usage();
    args[argv[index].slice(2)] = argv[index + 1];
  }
  for (const required of ['engine-commit', 'ruleset', 'reference-time']) {
    if (!args[required]) usage();
  }
  const inputPath = path.resolve(args.input || path.join('evaluation', '.cache', 'contradoc', 'ContraDoc.json'));
  const outputPrefix = path.resolve(args['output-prefix'] || path.join('evaluation', 'reports', 'contradoc'));
  const actualsPath = args.actuals ? path.resolve(args.actuals) : null;
  const shardChars = args['shard-chars'] ? Number(args['shard-chars']) : 3500000;
  if (!Number.isInteger(shardChars) || shardChars < 1000) fail('--shard-chars must be an integer >= 1000');

  const inputBytes = await readBoundedFile(inputPath, MAX_DATASET_BYTES, 'dataset file')
    .catch((error) => {
      if (error.code === 'ENOENT') fail('dataset file not found: ' + inputPath + ' (run download-or-verify.mjs first)');
      throw error;
    });
  const datasetSha512 = createHash('sha512').update(inputBytes).digest('hex');
  const dataset = parseContraDocDataset(new TextDecoder('utf-8', { fatal: true }).decode(inputBytes));

  let { cases, coverage } = adaptDataset(dataset);
  if (actualsPath) {
    const actualsBytes = await readBoundedFile(actualsPath, MAX_ACTUALS_BYTES, 'actual findings file');
    const actualsText = new TextDecoder('utf-8', { fatal: true }).decode(actualsBytes);
    const actuals = JSON.parse(actualsText);
    cases = mergeActualFindings(cases, actuals);
  }
  const shards = shardCases(cases, { maxCodeUnits: shardChars });
  await assertNoOutputAliases(outputPrefix, inputPath, actualsPath, shards.length);
  const shardDescriptions = [];
  const outputFiles = [];
  for (let index = 0; index < shards.length; index++) {
    const run = buildRunInput({
      dataset_sha512: datasetSha512,
      engine_commit: args['engine-commit'],
      ruleset: args.ruleset,
      reference_time: args['reference-time'],
      options: {
        adaptation: 'self_contradiction_detection',
        pair_mode: 'unordered',
        scope_labels: 'mapped_to_verum_granularity',
        scope_mapping: CONTRADOC_SCOPE_MAP,
        shard_index: index + 1,
        shard_count: shards.length
      }
    }, shards[index]);
    const outputName = path.basename(outputPrefix) + '.shard-' + String(index + 1).padStart(2, '0') + '.json';
    const serialized = canonicalJson(run);
    outputFiles.push({ file: outputName, serialized, kind: 'run' });
    shardDescriptions.push({
      file: outputName,
      cases: shards[index].length,
      code_units: shards[index].reduce((sum, evaluationCase) => sum + evaluationCase.source_text.length, 0)
    });
  }
  const coverageDocument = {
    adapter: 'contradoc-adapter',
    adapter_version: CONTRADOC_ADAPTER_VERSION,
    dataset: {
      dataset_id: CONTRADOC_DATASET.dataset_id,
      dataset_revision: CONTRADOC_DATASET.dataset_revision,
      dataset_license: CONTRADOC_DATASET.dataset_license,
      source_file_sha512: datasetSha512,
      source_file_bytes: inputBytes.byteLength
    },
    ...coverage,
    scope_mapping: CONTRADOC_SCOPE_MAP,
    published_scope_labels: coverage.scope_labels,
    cases_excluded: cases.filter((evaluationCase) => evaluationCase.exclusion)
      .map((evaluationCase) => ({ case_id: evaluationCase.case_id, reason: evaluationCase.exclusion.reason })),
    shards: shardDescriptions,
    limitations: [
      'Expected and actual scope aliases use the explicit ContraDoc-to-Verum bridge; published labels and their distributions remain in this sidecar, and the mapping does not claim identical taxonomies.',
      'Evidence and ref sentences are located by exact verbatim match only; omitted ref sentences are listed per document above.',
      'Positive documents without a locatable distinct ref sentence are listed as incomplete_pairs and excluded from exact-pair credit; other document and detection metrics remain visible.',
      'Source character spans only; page is null because the dataset has no audited page mapping.',
      'Development evaluation only; no result here is finding confidence, severity, or courtroom reliability.'
    ]
  };
  const coverageName = path.basename(outputPrefix) + '.coverage.json';
  outputFiles.push({ file: coverageName, serialized: canonicalJson(coverageDocument), kind: 'coverage' });
  await assertNoOutputAliases(outputPrefix, inputPath, actualsPath, shards.length);
  const { pointer, currentPath } = await publishGeneration(outputPrefix, outputFiles);
  console.log('[contradoc] documents=' + cases.length + ' excluded=' + coverageDocument.cases_excluded.length +
    ' pos=' + coverage.pos_documents + ' neg=' + coverage.neg_documents + ' shards=' + shards.length);
  console.log('[contradoc] generation=' + pointer.generation_id + ' runs=' + pointer.run_files.length);
  console.log('[contradoc] current=' + terminalSafe(currentPath));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
