#!/usr/bin/env node
// Development/CI only. This adapter is never imported by browser or production engine code.

import { readFile, mkdir, open, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { EVALUATION_LIMITS } from './lib/span-alignment.mjs';
import { evaluateCases, validateEvaluationRun } from './lib/metrics.mjs';
import { buildEvaluationReport, canonicalJson } from './lib/report.mjs';

function terminalSafe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => '\\x' + character.charCodeAt(0).toString(16).padStart(2, '0'));
}

function usage() {
  console.error('Usage: node evaluation/run-evaluation.mjs <input.json> [--output <report.json>]');
  process.exitCode = 2;
}

async function prepareOutput(outputPath) {
  const directory = path.dirname(outputPath);
  await mkdir(directory, { recursive: true });
  // Resolve the parent once, then use that canonical directory for both the
  // temporary file and rename. Retargeting a symlink in the original parent
  // path after this check cannot redirect the write. Keep the original basename
  // so an existing output symlink is replaced, rather than its target.
  const canonicalDirectory = await realpath(directory);
  const writePath = path.join(canonicalDirectory, path.basename(outputPath));
  try {
    return { canonicalPath: await realpath(writePath), writePath };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { canonicalPath: writePath, writePath };
  }
}

async function writeAtomically(outputPath, serialized) {
  const directory = path.dirname(outputPath);
  let handle;
  let temporaryPath;
  for (let attempt = 0; attempt < 100; attempt++) {
    temporaryPath = path.join(directory, '.' + path.basename(outputPath) + '.' + process.pid + '.' + attempt + '.tmp');
    try {
      handle = await open(temporaryPath, 'wx');
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  if (!handle) throw new Error('Could not allocate a temporary evaluation report file');
  try {
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
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = outputPath ? path.resolve(outputPath) : null;
    if (resolvedOutput === resolvedInput) throw new Error('Evaluation output must not overwrite the input dataset');
    const inputStat = await stat(resolvedInput);
    if (inputStat.size > EVALUATION_LIMITS.maxInputBytes) throw new Error('Evaluation input exceeds the 16 MiB corpus limit');
    const canonicalInput = await realpath(resolvedInput);
    const output = resolvedOutput ? await prepareOutput(resolvedOutput) : null;
    if (output?.canonicalPath === canonicalInput) throw new Error('Evaluation output must not overwrite the input dataset');
    const inputBytes = await readFile(canonicalInput);
    if (inputBytes.byteLength > EVALUATION_LIMITS.maxInputBytes) throw new Error('Evaluation input exceeds the 16 MiB corpus limit');
    let inputText;
    try {
      inputText = new TextDecoder('utf-8', { fatal: true }).decode(inputBytes);
    } catch {
      throw new Error('Evaluation input must be valid UTF-8');
    }
    const run = JSON.parse(inputText);
    const errors = validateEvaluationRun(run);
    if (errors.length) throw new Error('Evaluation input validation failed:\n- ' + errors.join('\n- '));
    const report = buildEvaluationReport(run, evaluateCases(run.cases));
    const serialized = canonicalJson(report);
    if (output) {
      await writeAtomically(output.writePath, serialized);
    } else {
      process.stdout.write(serialized);
    }
    if (resolvedOutput) {
      console.log('[evaluation] cases=' + report.coverage.cases_included + ' exclusions=' + report.coverage.cases_excluded + ' failures=' + report.failures.length);
      console.log('[evaluation] report=' + terminalSafe(resolvedOutput));
    }
  } catch (error) {
    console.error(terminalSafe('[evaluation] ' + (error.stack || error.message)));
    process.exitCode = 1;
  }
}
