#!/usr/bin/env node
// Development/CI only. Converts the pinned official ContraDoc dataset into the
// Verum Omnis development-evaluation input contract (evaluation/schema.json).
// Never imported by browser or production engine code; reads no wall clock,
// uses no randomness, and sends nothing anywhere.

import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
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

// Explicit scope mapping. The published labels (intra / local / global, and
// one hybrid "global, intra" record) are preserved verbatim on every expected
// contradiction as "contradoc:<label>"; this table is the only bridge to
// Verum granularity and it does not claim the taxonomies are identical.
export const CONTRADOC_SCOPE_MAP = Object.freeze({
  'intra': 'within_sentence',
  'local': 'within_document_nearby',
  'global': 'within_document_distant'
});

const MAX_DATASET_BYTES = 64 * 1024 * 1024;

function fail(message) {
  throw new Error('[contradoc] ' + message);
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
    ref_sentences_omitted: []
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
        scope: 'contradoc:' + scope,
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
    actual_findings: actuals[evaluationCase.case_id] || evaluationCase.actual_findings
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
  for (const required of ['engine-commit', 'ruleset', 'reference-time']) {
    if (!args[required]) usage();
  }
  const inputPath = path.resolve(args.input || path.join('evaluation', '.cache', 'contradoc', 'ContraDoc.json'));
  const outputPrefix = path.resolve(args['output-prefix'] || path.join('evaluation', 'reports', 'contradoc'));
  const shardChars = args['shard-chars'] ? Number(args['shard-chars']) : 3500000;
  if (!Number.isInteger(shardChars) || shardChars < 1000) fail('--shard-chars must be an integer >= 1000');

  const inputStat = await stat(inputPath).catch(() => fail('dataset file not found: ' + inputPath + ' (run download-or-verify.mjs first)'));
  if (inputStat.size > MAX_DATASET_BYTES) fail('dataset file exceeds the 64 MiB adapter limit');
  const inputBytes = await readFile(inputPath);
  const datasetSha512 = createHash('sha512').update(inputBytes).digest('hex');
  const dataset = parseContraDocDataset(new TextDecoder('utf-8', { fatal: true }).decode(inputBytes));

  let { cases, coverage } = adaptDataset(dataset);
  if (args.actuals) {
    const actuals = JSON.parse(await readFile(path.resolve(args.actuals), 'utf8'));
    cases = mergeActualFindings(cases, actuals);
  }
  const shards = shardCases(cases, { maxCodeUnits: shardChars });
  const shardDescriptions = [];
  for (let index = 0; index < shards.length; index++) {
    const run = buildRunInput({
      dataset_sha512: datasetSha512,
      engine_commit: args['engine-commit'],
      ruleset: args.ruleset,
      reference_time: args['reference-time'],
      options: {
        adaptation: 'self_contradiction_detection',
        pair_mode: 'unordered',
        scope_labels: 'preserved_verbatim',
        shard_index: index + 1,
        shard_count: shards.length
      }
    }, shards[index]);
    const outputPath = shards.length === 1
      ? outputPrefix + '.json'
      : outputPrefix + '.shard-' + String(index + 1).padStart(2, '0') + '.json';
    await writeAtomically(outputPath, canonicalJson(run));
    shardDescriptions.push({
      file: path.basename(outputPath),
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
    cases_excluded: cases.filter((evaluationCase) => evaluationCase.exclusion)
      .map((evaluationCase) => ({ case_id: evaluationCase.case_id, reason: evaluationCase.exclusion.reason })),
    shards: shardDescriptions,
    limitations: [
      'Scope labels are the published ContraDoc labels preserved verbatim; the scope mapping is an explicit bridge, not a claim of identical taxonomies.',
      'Evidence and ref sentences are located by exact verbatim match only; omitted ref sentences are listed per document above.',
      'ref sentences absent from a positive document leave the pair structurally incomplete; the harness reports that rather than hiding it.',
      'Source character spans only; page is null because the dataset has no audited page mapping.',
      'Development evaluation only; no result here is finding confidence, severity, or courtroom reliability.'
    ]
  };
  const coveragePath = outputPrefix + '.coverage.json';
  await writeAtomically(coveragePath, canonicalJson(coverageDocument));
  console.log('[contradoc] documents=' + cases.length + ' excluded=' + coverageDocument.cases_excluded.length +
    ' pos=' + coverage.pos_documents + ' neg=' + coverage.neg_documents + ' shards=' + shards.length);
  console.log('[contradoc] coverage=' + terminalSafe(coveragePath));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
