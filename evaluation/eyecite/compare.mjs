#!/usr/bin/env node
// Development-only spike: runs the pinned Eyecite conformance corpus against
// each candidate port adapter in evaluation/eyecite/ports/ and reports exact
// agreement with the official eyecite reference. Deterministic; no network.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { canonicalJson } from '../lib/report.mjs';

export const COMPARE_VERSION = '1.0.0';
export const CORPUS_LIMITS = Object.freeze({
  bytes: 1024 * 1024,
  cases: 64,
  caseText: 32 * 1024,
  totalText: 256 * 1024
});

const ADAPTER_FILES = Object.freeze([
  'beshkenadze-eyecite.mjs',
  'eyecite-ts.mjs'
]);
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  throw new Error('[eyecite-compare] ' + message);
}

export function loadConformance(document) {
  if (!document || typeof document !== 'object') fail('conformance corpus must be an object');
  if (document.corpus_version !== '1.0.0') fail('unsupported corpus_version');
  if (!document.reference || document.reference.name !== 'eyecite' || !document.reference.version) {
    fail('corpus must name its pinned eyecite reference version');
  }
  if (!Array.isArray(document.cases) || !document.cases.length) fail('corpus holds no cases');
  if (document.cases.length > CORPUS_LIMITS.cases) fail('corpus exceeds the case limit');
  const ids = new Set();
  let totalText = 0;
  for (const testCase of document.cases) {
    if (typeof testCase.id !== 'string' || !testCase.id) fail('every case needs an id');
    if (ids.has(testCase.id)) fail('duplicate case id ' + testCase.id);
    ids.add(testCase.id);
    if (typeof testCase.text !== 'string') fail(testCase.id + ': text must be a string');
    if (testCase.text.length > CORPUS_LIMITS.caseText) fail(testCase.id + ': text exceeds the case limit');
    totalText += testCase.text.length;
    if (totalText > CORPUS_LIMITS.totalText) fail('corpus text exceeds the total limit');
    if (!testCase.expected || !Array.isArray(testCase.expected.citations) || !Array.isArray(testCase.expected.clusters)) {
      fail(testCase.id + ': expected citations and clusters are required');
    }
    if (!validCitations(testCase.expected.citations, testCase.text)) fail(testCase.id + ': invalid citation record or span');
    for (const citation of testCase.expected.citations) {
      if (testCase.text.slice(...citation.span) !== citation.matched_text && citation.type !== 'id' && citation.type !== 'supra') {
        fail(testCase.id + ': span does not slice matched_text');
      }
    }
    if (!validClusters(testCase.expected.clusters, testCase.expected.citations.length)) {
      fail(testCase.id + ': invalid resolution clusters');
    }
  }
  return document;
}

export function parseConformance(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(String(source), 'utf8');
  if (bytes.length > CORPUS_LIMITS.bytes) fail('corpus exceeds the byte limit');
  let document;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('corpus is not valid JSON');
  }
  return loadConformance(document);
}

function isSpan(span, textLength) {
  return Array.isArray(span) && span.length === 2 &&
    Number.isInteger(span[0]) && Number.isInteger(span[1]) &&
    span[0] >= 0 && span[0] < span[1] && span[1] <= textLength;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validCitations(citations, text) {
  return Array.isArray(citations) && citations.every((citation) =>
    isRecord(citation) &&
    typeof citation.type === 'string' &&
    isSpan(citation.span, text.length) &&
    isSpan(citation.full_span, text.length) &&
    citation.full_span[0] <= citation.span[0] &&
    citation.full_span[1] >= citation.span[1] &&
    typeof citation.matched_text === 'string' &&
    isRecord(citation.groups) &&
    isRecord(citation.metadata));
}

function validClusters(clusters, citationCount) {
  if (!Array.isArray(clusters)) return false;
  const seen = new Set();
  for (const cluster of clusters) {
    if (!Array.isArray(cluster) || cluster.length === 0) return false;
    for (const index of cluster) {
      if (!Number.isInteger(index) || index < 0 || index >= citationCount || seen.has(index)) return false;
      seen.add(index);
    }
  }
  return true;
}

function difference(path, expected, actual) {
  return { path, expected, actual };
}

// Exact comparison: citation count and order, then per-citation type, spans,
// matched text, groups, and every metadata/antecedent key the reference sets.
// Extra port metadata is listed as a note, never treated as a match failure;
// missing or different reference values are differences.
export function compareCitations(expected, actual, text = '') {
  const differences = [];
  const notes = [];
  if (!validCitations(expected, text) || !validCitations(actual, text)) {
    differences.push(difference('citations.shape', 'valid citation records and in-bounds spans', 'invalid citation record or span'));
    return { differences, notes };
  }
  if (expected.length !== actual.length) {
    differences.push(difference('citations.length', expected.length, actual.length));
  }
  const shared = Math.min(expected.length, actual.length);
  for (let index = 0; index < shared; index++) {
    const e = expected[index];
    const a = actual[index];
    const label = 'citations[' + index + ']';
    if (e.type !== a.type) differences.push(difference(label + '.type', e.type, a.type));
    if (e.span[0] !== a.span[0] || e.span[1] !== a.span[1]) differences.push(difference(label + '.span', e.span, a.span));
    if (e.full_span[0] !== a.full_span[0] || e.full_span[1] !== a.full_span[1]) differences.push(difference(label + '.full_span', e.full_span, a.full_span));
    if (e.matched_text !== a.matched_text) differences.push(difference(label + '.matched_text', e.matched_text, a.matched_text));
    for (const key of new Set([...Object.keys(e.groups), ...Object.keys(a.groups)])) {
      if (e.groups[key] !== a.groups[key]) differences.push(difference(label + '.groups.' + key, e.groups[key], a.groups[key]));
    }
    for (const key of Object.keys(e.metadata || {})) {
      if (e.metadata[key] !== (a.metadata || {})[key]) differences.push(difference(label + '.metadata.' + key, e.metadata[key], (a.metadata || {})[key]));
    }
    if (e.antecedent_guess !== undefined && e.antecedent_guess !== a.antecedent_guess) {
      differences.push(difference(label + '.antecedent_guess', e.antecedent_guess, a.antecedent_guess));
    }
    for (const key of Object.keys(a.metadata || {})) {
      if (!Object.hasOwn(e.metadata || {}, key)) notes.push(label + '.metadata.' + key + ' present only in port output');
    }
  }
  return { differences, notes };
}

export function compareClusters(expected, actual) {
  if (!validClusters(expected, Number.MAX_SAFE_INTEGER) || !validClusters(actual, Number.MAX_SAFE_INTEGER)) return false;
  const normalize = (clusters) => clusters
    .map((cluster) => cluster.slice().sort((a, b) => a - b))
    .sort((a, b) => {
      const length = Math.min(a.length, b.length);
      for (let index = 0; index < length; index++) {
        if (a[index] !== b[index]) return a[index] - b[index];
      }
      return a.length - b.length;
    });
  return JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual));
}

export async function loadAdapters(portsDirectory) {
  const entries = await readdir(portsDirectory, { withFileTypes: true });
  const available = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const missing = ADAPTER_FILES.filter((file) => !available.has(file));
  if (missing.length) fail('required adapter files are missing: ' + missing.join(', '));
  if (!ADAPTER_FILES.length) fail('required adapter set is empty');
  const adapters = [];
  for (const file of ADAPTER_FILES) {
    const adapter = await import(pathToFileURL(path.join(portsDirectory, file)).href);
    for (const field of ['name', 'pinnedVersion', 'license', 'upstream', 'extract', 'checkInstallation']) {
      if (adapter[field] === undefined) fail(file + ' does not export ' + field);
    }
    adapters.push(adapter);
  }
  if (!adapters.length) fail('required adapter set is empty');
  return adapters;
}

export async function runComparison(corpus, adapters) {
  const ports = [];
  for (const adapter of adapters) {
    const port = {
      name: adapter.name,
      pinned_version: adapter.pinnedVersion,
      license: adapter.license,
      upstream: adapter.upstream,
      stripped_fields: adapter.strippedFields || [],
      status: 'evaluated',
      comparison_status: 'evaluated',
      cases: [],
      summary: { matched: 0, mismatched: 0, errored: 0, total: corpus.cases.length, resolution: 'resolved' }
    };
    const installation = adapter.checkInstallation();
    port.installed_version = installation.version || null;
    const installationStatus = installation.status === 'available' &&
      installation.version !== adapter.pinnedVersion ? 'version_mismatch' : installation.status;
    if (installationStatus !== 'available') {
      port.status = installationStatus;
      port.comparison_status = installationStatus === 'not_installed' ? 'not_evaluated' : 'not_comparable';
      port.installation_error = installation.error || undefined;
      port.summary.resolution = 'not_evaluated';
      ports.push(port);
      continue;
    }
    const resolutionStates = new Set();
    for (const testCase of corpus.cases) {
      let actual;
      try {
        actual = await adapter.extract(testCase.text);
        if (!isRecord(actual) || !Array.isArray(actual.citations) || !Array.isArray(actual.clusters) ||
            typeof actual.resolution_state !== 'string') {
          throw new Error('adapter returned an invalid comparison record');
        }
      } catch (error) {
        port.cases.push({ id: testCase.id, result: 'error', error: String(error && error.message).slice(0, 200) });
        port.summary.errored++;
        continue;
      }
      const { differences, notes } = compareCitations(testCase.expected.citations, actual.citations, testCase.text);
      resolutionStates.add(actual.resolution_state);
      let clustersResult;
      if (actual.resolution_state === 'resolved') {
        clustersResult = compareClusters(testCase.expected.clusters, actual.clusters) &&
          validClusters(actual.clusters, actual.citations.length) ? 'match' : 'mismatch';
      } else {
        clustersResult = actual.resolution_state;
      }
      const matched = differences.length === 0 && clustersResult === 'match';
      port.cases.push({
        id: testCase.id,
        result: matched ? 'match' : 'mismatch',
        differences,
        clusters: clustersResult,
        notes
      });
      if (matched) port.summary.matched++;
      else port.summary.mismatched++;
    }
    port.summary.resolution = [...resolutionStates].sort().join(' & ') || 'not_evaluated';
    ports.push(port);
  }
  return {
    report_type: 'eyecite_conformance_spike',
    report_version: COMPARE_VERSION,
    architectural_owner: 'B9',
    production_finding_effect: 'none',
    corpus_version: corpus.corpus_version,
    reference: corpus.reference,
    ports
  };
}

async function main(argv) {
  const corpusPath = path.resolve(argv[0] || path.join(SCRIPT_DIRECTORY, 'conformance.json'));
  const corpus = parseConformance(await readFile(corpusPath));
  const adapters = await loadAdapters(path.join(SCRIPT_DIRECTORY, 'ports'));
  const report = await runComparison(corpus, adapters);
  process.stdout.write(canonicalJson(report));
  for (const port of report.ports) {
    console.error('[eyecite-compare] ' + port.name + ': ' + port.status +
      (port.comparison_status === 'evaluated' ? ' matched=' + port.summary.matched + '/' + port.summary.total +
       ' resolution=' + port.summary.resolution : ''));
  }
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(String(error.stack || error.message).replace(/[\x00-\x1f\x7f-\x9f]/g, '?'));
    process.exitCode = 1;
  });
}
