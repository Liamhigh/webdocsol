#!/usr/bin/env node
// Development/CI only. Verum-exact metrics for ContraDoc: exact/token evidence
// spans, complete contradictory pairs, and scope classification through the
// common harness, with ContraDoc-Neg false positives listed document by
// document — a clean document with a finding is never hidden by aggregates.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateCases, validateEvaluationRun } from '../lib/metrics.mjs';
import { canonicalJson } from '../lib/report.mjs';

export function buildVerumExactSummary(run) {
  const errors = validateEvaluationRun(run);
  if (errors.length) throw new Error('[contradoc-verum-exact] invalid run input:\n- ' + errors.join('\n- '));
  const included = run.cases.filter((evaluationCase) => !evaluationCase.exclusion);
  const positive = included.filter((evaluationCase) => evaluationCase.expected_contradictions.length > 0);
  const negative = included.filter((evaluationCase) => evaluationCase.expected_contradictions.length === 0);
  const overall = evaluateCases(included);
  const positiveMetrics = positive.length ? evaluateCases(positive).metrics : null;
  const negativeWithFindings = negative
    .filter((evaluationCase) => evaluationCase.actual_findings.length > 0)
    .map((evaluationCase) => evaluationCase.case_id)
    .sort();
  return {
    result_label: 'verum_exact',
    dataset_id: run.manifest.dataset_id,
    manifest: run.manifest,
    documents: {
      positive: positive.length,
      negative: negative.length,
      excluded: run.cases.length - included.length
    },
    overall_metrics: overall.metrics,
    positive_subset_metrics: positiveMetrics,
    contradoc_neg_false_positives: {
      negative_documents: negative.length,
      documents_with_findings: negativeWithFindings.length,
      case_ids: negativeWithFindings
    },
    limitations: [
      'Exact/token evidence spans, pair completeness and scope classification are deterministic anchor metrics; they are never conflated with the published BERTScore-threshold settings (see official-metric-runner.mjs, result_label published_comparable).',
      'ContraDoc-Neg false positives are listed per document above; aggregate recall never hides a clean document with a finding.',
      'Development evaluation only; not finding confidence, severity, or courtroom reliability.'
    ]
  };
}

function terminalSafe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => '\\x' + character.charCodeAt(0).toString(16).padStart(2, '0'));
}

async function main(argv) {
  const inputPath = argv[0];
  if (!inputPath) {
    console.error('Usage: node evaluation/contradoc/verum-exact-metrics.mjs <run.json>');
    process.exit(2);
  }
  const run = JSON.parse(await readFile(path.resolve(inputPath), 'utf8'));
  process.stdout.write(canonicalJson(buildVerumExactSummary(run)));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
