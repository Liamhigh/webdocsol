#!/usr/bin/env node
// Development/CI only. Deterministic reproduction of the official ContraDoc
// eval_metric.py arithmetic (ddhruvkr/CONTRADOC, pinned revision
// d1c42d1e433595dd6e98fab7b669722cdc050b1d). BERTScore is never computed here:
// externally produced precision/recall arrays are accepted as DATA with their
// provenance recorded, and this runner applies the published 0.98 threshold,
// direct-find, top-k truncation and Judge-then-Find rules. Results are labelled
// published_comparable, never deterministic anchor truth (that is
// verum-exact-metrics.mjs). No Python or neural package is required or used.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NOT_DEFINED } from '../lib/metrics.mjs';
import { canonicalJson } from '../lib/report.mjs';

export const PUBLISHED_THRESHOLD = 0.98;
export const PUBLISHED_TOP_K = 5;
export const DIRECT_FIND_MIN_LENGTH = 20;

function fail(message) {
  throw new Error('[contradoc-official] ' + message);
}

export function trimString(value) {
  if (typeof value !== 'string') fail('evidence strings must be strings');
  const characters = Array.from(value);
  let start = 0;
  let end = characters.length;
  while (start < end && (characters[start] === ' ' || characters[start] === '\n')) start++;
  while (end > start && (characters[end - 1] === ' ' || characters[end - 1] === '\n')) end--;
  return characters.slice(start, end).join('');
}

function codePointLength(value) {
  return Array.from(value).length;
}

function validateBertScore(scores, candidateCount) {
  if (!scores || !Array.isArray(scores.precision) || !Array.isArray(scores.recall) ||
      scores.precision.length !== candidateCount || scores.recall.length !== candidateCount) {
    fail('bertscore precision/recall arrays must align with the candidate list');
  }
  for (const values of [scores.precision, scores.recall]) {
    for (const value of values) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        fail('bertscore values must be finite numbers in the range [0, 1]');
      }
    }
  }
}

function maxValue(values) {
  let maximum = -Infinity;
  for (const value of values) if (value > maximum) maximum = value;
  return maximum;
}

// Official rule: a query shorter than 20 characters never matches; candidate
// sentences shorter than 20 are skipped; a match is a substring relation in
// either direction.
export function directFind(candidates, query) {
  if (codePointLength(query) < DIRECT_FIND_MIN_LENGTH) return null;
  for (let index = 0; index < candidates.length; index++) {
    if (codePointLength(candidates[index]) < DIRECT_FIND_MIN_LENGTH) continue;
    if (query.includes(candidates[index]) || candidates[index].includes(query)) return index;
  }
  return null;
}

// Official yes_verify: lowercase, optional top-3 trim, direct find, else the
// published BERTScore precision/recall threshold over externally supplied
// scores aligned with the candidate list. trim_string is used on the raw
// response before evidence-list parsing, not on these parsed evidence strings.
export function yesVerify(candidates, goldEvidence, options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  if (typeof goldEvidence !== 'string' || !goldEvidence) fail('gold evidence is required for verification');
  let lowered = candidates.map((candidate) => {
    if (typeof candidate !== 'string') fail('candidate evidence must be strings');
    return candidate.toLowerCase();
  });
  const gold = goldEvidence.toLowerCase();
  let scores = options.bertscore || null;
  if (scores) validateBertScore(scores, lowered.length);
  if (options.onlyTop3 && lowered.length > 3) {
    lowered = lowered.slice(0, 3);
    if (scores) {
      scores = {
        precision: scores.precision.slice(0, 3),
        recall: scores.recall.slice(0, 3)
      };
    }
  }
  if (directFind(lowered, gold) !== null) return true;
  if (!scores) return false;
  const maxPrecision = maxValue(scores.precision);
  const maxRecall = maxValue(scores.recall);
  return maxPrecision > PUBLISHED_THRESHOLD || maxRecall > PUBLISHED_THRESHOLD;
}

// Official calculate_metrics, including its zero-denominator behaviour
// (precision/recall/F1 fall back to 0), reproduced key for key.
export function calculateMetrics(goldLabels, predictedLabels) {
  if (goldLabels.length !== predictedLabels.length) fail('gold and predicted label counts differ');
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let index = 0; index < goldLabels.length; index++) {
    const gold = goldLabels[index];
    const predicted = predictedLabels[index];
    if (typeof gold !== 'boolean' || typeof predicted !== 'boolean') fail('labels must be booleans');
    if (gold && predicted) tp++;
    else if (!gold && !predicted) tn++;
    else if (gold && !predicted) fn++;
    else fp++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return {
    'Precision': precision,
    'Recall': recall,
    'F1 Score': precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0,
    'Accuracy': tp + tn + fn + fp > 0 ? (tp + tn) / (tp + tn + fn + fp) : NOT_DEFINED,
    'True Positive': tp,
    'False Positive': fp,
    'True Negative': tn,
    'False Negative': fn
  };
}

// Official Judge-then-Find: evidence is evaluated only when the model answered
// "yes" AND the document is gold-positive; every other prediction stands as
// judged. Top_k candidate and score arrays are truncated together at five.
export function judgeThenFind(responses, options = {}) {
  if (!Array.isArray(responses)) fail('responses must be an array');
  const taskSetting = options.taskSetting || 'judge_then_find';
  if (taskSetting !== 'judge_then_find' && taskSetting !== 'top_k') fail('unknown task setting ' + taskSetting);
  let scoresUsed = false;
  let topKCandidatesTruncated = 0;
  const verified = responses.map((response, index) => {
    if (!response || typeof response !== 'object') fail('response ' + index + ' must be an object');
    if (typeof response.gold !== 'boolean') fail('response ' + index + ' needs a boolean gold label');
    if (response.judgment !== 'yes' && response.judgment !== 'no') fail('response ' + index + ' judgment must be yes or no');
    if (!Array.isArray(response.evidence)) fail('response ' + index + ' evidence must be an array');
    let evidence = response.evidence;
    let bertscore = response.bertscore;
    if (taskSetting === 'top_k') {
      if (bertscore) validateBertScore(bertscore, evidence.length);
      if (evidence.length > PUBLISHED_TOP_K) {
        topKCandidatesTruncated += evidence.length - PUBLISHED_TOP_K;
        evidence = evidence.slice(0, PUBLISHED_TOP_K);
        if (bertscore) {
          bertscore = {
            precision: bertscore.precision.slice(0, PUBLISHED_TOP_K),
            recall: bertscore.recall.slice(0, PUBLISHED_TOP_K)
          };
        }
      }
    }
    const answeredYes = response.judgment === 'yes';
    if (!answeredYes || !response.gold) return answeredYes;
    if (bertscore) scoresUsed = true;
    return yesVerify(evidence, response.evidenceGold, {
      onlyTop3: options.onlyTop3,
      bertscore
    });
  });
  return {
    verifiedPredictions: verified,
    rawPredictions: responses.map((response) => response.judgment === 'yes'),
    goldLabels: responses.map((response) => response.gold),
    scoresUsed,
    top_k_candidates_truncated: topKCandidatesTruncated
  };
}

export function runOfficialMetrics(input, options = {}) {
  if (!input || !Array.isArray(input.responses)) fail('input needs a responses array');
  for (const response of input.responses) {
    if (response.judgment === 'yes' && response.gold && typeof response.evidenceGold !== 'string') {
      fail('every gold-positive yes response needs evidenceGold (the dataset evidence sentence)');
    }
  }
  const outcome = judgeThenFind(input.responses, options);
  if (outcome.scoresUsed && (!input.provenance || !input.provenance.scores_source || !input.provenance.score_model)) {
    fail('bertscore values require provenance.scores_source and provenance.score_model');
  }
  return {
    result_label: 'published_comparable',
    task_settings: {
      task_setting: options.taskSetting || 'judge_then_find',
      top_k: PUBLISHED_TOP_K,
      only_top3: Boolean(options.onlyTop3),
      bertscore_threshold: PUBLISHED_THRESHOLD,
      direct_find_min_length: DIRECT_FIND_MIN_LENGTH,
      note: 'Judge-then-Find evaluates evidence only when the model answers yes and the document is gold-positive; top-k settings truncate candidates and aligned BERTScore arrays after the first five.'
    },
    top_k_candidates_truncated: outcome.top_k_candidates_truncated,
    provenance: input.provenance || null,
    without_verify: calculateMetrics(outcome.goldLabels, outcome.rawPredictions),
    verify: calculateMetrics(outcome.goldLabels, outcome.verifiedPredictions),
    limitations: [
      'published_comparable: reproduces the official task settings and threshold arithmetic; BERTScore values are externally supplied data with recorded provenance, not recomputed here.',
      'Never conflate these results with verum_exact deterministic anchor metrics.',
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
    console.error('Usage: node evaluation/contradoc/official-metric-runner.mjs <responses.json> [--top-k] [--only-top3]');
    process.exit(2);
  }
  const options = {};
  if (argv.includes('--top-k')) options.taskSetting = 'top_k';
  if (argv.includes('--only-top3')) options.onlyTop3 = true;
  const input = JSON.parse(await readFile(path.resolve(inputPath), 'utf8'));
  process.stdout.write(canonicalJson(runOfficialMetrics(input, options)));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
