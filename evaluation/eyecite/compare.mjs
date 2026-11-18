#!/usr/bin/env node
// Development-only spike: runs the pinned Eyecite conformance corpus against
// each candidate port adapter in evaluation/eyecite/ports/ and reports exact
// agreement with the official eyecite reference. Deterministic; no network.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson } from '../lib/report.mjs';

export const COMPARE_VERSION = '1.0.0';

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
  const ids = new Set();
  for (const testCase of document.cases) {
    if (typeof testCase.id !== 'string' || !testCase.id) fail('every case needs an id');
    if (ids.has(testCase.id)) fail('duplicate case id ' + testCase.id);
    ids.add(testCase.id);
    if (typeof testCase.text !== 'string') fail(testCase.id + ': text must be a string');
    if (!testCase.expected || !Array.isArray(testCase.expected.citations) || !Array.isArray(testCase.expected.clusters)) {
      fail(testCase.id + ': expected citations and clusters are required');
    }
    for (const citation of testCase.expected.citations) {
      const [start, end] = citation.span || [];
      if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) fail(testCase.id + ': bad span');
      if (testCase.text.slice(start, end) !== citation.matched_text && citation.type !== 'id' && citation.type !== 'supra') {
        fail(testCase.id + ': span does not slice matched_text');
      }
    }
  }
  return document;
}

function difference(path, expected, actual) {
  return { path, expected, actual };
}

// Exact comparison: citation count and order, then per-citation type, spans,
// matched text, groups, and every metadata/antecedent key the reference sets.
// Extra port metadata is listed as a note, never treated as a match failure;
// missing or different reference values are differences.
export function compareCitations(expected, actual) {
  const differences = [];
  const notes = [];
  if (expected.length !== actual.length) {
    differences.push(difference('citations.length', expected.length, actual.length));
  }
  const shared = Math.min(expected.length, actual.length);
  for (let index = 0; index < shared; index++) {
    const e = expected[index];
    const a = actual[index];
    const label = 'citations[' + index + ']';
    if (e.type !== a.type) differences.push(difference(label + '.type', e.type, a.type));
    if (String(e.span) !== String(a.span)) differences.push(difference(label + '.span', e.span, a.span));
    if (String(e.full_span) !== String(a.full_span)) differences.push(difference(label + '.full_span', e.full_span, a.full_span));
    if (e.matched_text !== a.matched_text) differences.push(difference(label + '.matched_text', e.matched_text, a.matched_text));
    for (const key of Object.keys(e.groups)) {
      if (e.groups[key] !== (a.groups || {})[key]) differences.push(difference(label + '.groups.' + key, e.groups[key], (a.groups || {})[key]));
    }
    for (const key of Object.keys(e.metadata || {})) {
      if (e.metadata[key] !== (a.metadata || {})[key]) differences.push(difference(label + '.metadata.' + key, e.metadata[key], (a.metadata || {})[key]));
    }
    if (e.antecedent_guess !== undefined && e.antecedent_guess !== a.antecedent_guess) {
      differences.push(difference(label + '.antecedent_guess', e.antecedent_guess, a.antecedent_guess));
    }
    for (const key of Object.keys(a.metadata || {})) {
      if (!(e.metadata || {})[key]) notes.push(label + '.metadata.' + key + ' present only in port output');
    }
  }
  return { differences, notes };
}

export function compareClusters(expected, actual) {
  const normalize = (clusters) => clusters.map((cluster) => cluster.join(',')).sort().join('|');
  return normalize(expected) === normalize(actual);
}

export async function loadAdapters(portsDirectory) {
  const entries = await readdir(portsDirectory).catch(() => []);
  const adapters = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.mjs')) continue;
    const adapter = await import(pathToFileURL(path.join(portsDirectory, entry)).href);
    for (const field of ['name', 'pinnedVersion', 'license', 'upstream', 'extract', 'isAvailable']) {
      if (adapter[field] === undefined) fail(entry + ' does not export ' + field);
    }
    adapters.push(adapter);
  }
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
      cases: [],
      summary: { matched: 0, mismatched: 0, errored: 0, total: corpus.cases.length, resolution: 'resolved' }
    };
    if (!adapter.isAvailable()) {
      port.status = 'not_installed';
      port.summary.resolution = 'not_evaluated';
      ports.push(port);
      continue;
    }
    const resolutionStates = new Set();
    for (const testCase of corpus.cases) {
      let actual;
      try {
        actual = await adapter.extract(testCase.text);
      } catch (error) {
        port.cases.push({ id: testCase.id, result: 'error', error: String(error && error.message).slice(0, 200) });
        port.summary.errored++;
        continue;
      }
      const { differences, notes } = compareCitations(testCase.expected.citations, actual.citations);
      resolutionStates.add(actual.resolution_state);
      let clustersResult;
      if (actual.resolution_state === 'resolved') {
        clustersResult = compareClusters(testCase.expected.clusters, actual.clusters) ? 'match' : 'mismatch';
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
  const corpusPath = path.resolve(argv[0] || path.join('evaluation', 'eyecite', 'conformance.json'));
  const corpus = loadConformance(JSON.parse(await readFile(corpusPath, 'utf8')));
  const adapters = await loadAdapters(path.join(path.dirname(corpusPath), 'ports'));
  const report = await runComparison(corpus, adapters);
  process.stdout.write(canonicalJson(report));
  for (const port of report.ports) {
    console.error('[eyecite-compare] ' + port.name + ': ' + port.status +
      (port.status === 'evaluated' ? ' matched=' + port.summary.matched + '/' + port.summary.total +
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
