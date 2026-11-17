#!/usr/bin/env node
// Development/CI only. This adapter is never imported by browser or production engine code.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { evaluateCases, validateEvaluationRun } from './lib/metrics.mjs';
import { buildEvaluationReport, canonicalJson } from './lib/report.mjs';

function usage() {
  console.error('Usage: node evaluation/run-evaluation.mjs <input.json> [--output <report.json>]');
  process.exitCode = 2;
}

const args = process.argv.slice(2);
const inputPath = args.shift();
const outputIndex = args.indexOf('--output');
let outputPath = null;
if (outputIndex !== -1) {
  outputPath = args[outputIndex + 1];
  args.splice(outputIndex, 2);
}
if (!inputPath || args.length || (outputIndex !== -1 && !outputPath)) {
  usage();
} else {
  try {
    const run = JSON.parse(await readFile(inputPath, 'utf8'));
    const errors = validateEvaluationRun(run);
    if (errors.length) throw new Error('Evaluation input validation failed:\n- ' + errors.join('\n- '));
    const report = buildEvaluationReport(run, evaluateCases(run.cases));
    const serialized = canonicalJson(report);
    if (outputPath) {
      await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
      await writeFile(outputPath, serialized, 'utf8');
    } else {
      process.stdout.write(serialized);
    }
    if (outputPath) {
      console.log('[evaluation] cases=' + report.coverage.cases_included + ' exclusions=' + report.coverage.cases_excluded + ' failures=' + report.failures.length);
      console.log('[evaluation] report=' + path.resolve(outputPath));
    }
  } catch (error) {
    console.error('[evaluation] ' + (error.stack || error.message));
    process.exitCode = 1;
  }
}
