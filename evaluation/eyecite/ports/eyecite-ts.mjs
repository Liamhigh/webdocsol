// Spike adapter for eyecite-ts (medelman17/eyecite-ts), pinned. Development-only:
// imports the gitignored install under evaluation/.cache/. Confidence scores and
// telemetry fields this port emits are stripped during normalization and listed
// in strippedFields; Verum occurrence records carry parsed facts, not scores.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'eyecite-ts';
export const pinnedVersion = '0.34.2';
export const license = 'MIT';
export const upstream = 'medelman17/eyecite-ts';
export const strippedFields = ['confidence', 'processTimeMs', 'patternsChecked', 'inferredCourt.confidence', 'resolution.confidence'];

const cacheDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../evaluation/.cache/eyecite-ports');
const require = createRequire(path.join(cacheDirectory, 'package.json'));

const TYPE_NAMES = {
  case: 'full_case',
  short_case: 'short_case',
  id: 'id',
  supra: 'supra',
  statute: 'full_law',
  journal: 'full_journal'
};

export function checkInstallation() {
  try {
    const resolvedPath = require.resolve('eyecite-ts');
    const relative = path.relative(cacheDirectory, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { status: 'installation_error', error: 'package resolved outside the ignored cache' };
    }
    let directory = path.dirname(resolvedPath);
    while (directory !== path.dirname(directory)) {
      const packagePath = path.join(directory, 'package.json');
      try {
        const metadata = JSON.parse(readFileSync(packagePath, 'utf8'));
        if (metadata.name === 'eyecite-ts') {
          return {
            status: metadata.version === pinnedVersion ? 'available' : 'version_mismatch',
            version: metadata.version
          };
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      directory = path.dirname(directory);
    }
    return { status: 'installation_error', error: 'package metadata was not found' };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return { status: 'not_installed' };
    return { status: 'installation_error', error: String(error && error.message).slice(0, 200) };
  }
}

function load() {
  return require('eyecite-ts');
}

function spanPair(span) {
  if (!span || !Number.isInteger(span.originalStart) || !Number.isInteger(span.originalEnd)) return null;
  return [span.originalStart, span.originalEnd];
}

export function clustersFromResolutions(citations, resolved) {
  const targets = citations.map((citation, index) => {
    const resolution = resolved[index] && resolved[index].resolution;
    return resolution && Number.isInteger(resolution.resolvedTo) &&
      resolution.resolvedTo >= 0 && resolution.resolvedTo < citations.length
      ? resolution.resolvedTo
      : null;
  });
  const byRoot = new Map();
  citations.forEach((citation, index) => {
    if (targets[index] === null) return;
    let current = index;
    const seen = new Set();
    while (targets[current] !== current && targets[current] !== null && !seen.has(current)) {
      seen.add(current);
      current = targets[current];
    }
    if (targets[current] === null || seen.has(current)) return;
    if (!byRoot.has(current)) byRoot.set(current, []);
    byRoot.get(current).push(index);
  });
  return [...byRoot.values()]
    .map((cluster) => cluster.sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

export function extract(text) {
  const eyeciteTs = load();
  const citations = eyeciteTs.extractCitations(text);
  const records = citations.map((citation) => {
    const groups = {};
    if (citation.volume !== undefined) groups.volume = String(citation.volume);
    if (citation.reporter !== undefined) groups.reporter = String(citation.reporter);
    if (citation.page !== undefined) groups.page = String(citation.page);
    const metadata = {};
    // This port reports raw court text (e.g. "9th Cir."), not eyecite's
    // normalized identifiers ("ca9"); the difference is recorded, not patched.
    if (citation.court) metadata.court = String(citation.court);
    if (citation.year !== undefined) metadata.year = String(citation.year);
    if (citation.pinciteInfo && citation.pinciteInfo.raw) metadata.pin_cite = String(citation.pinciteInfo.raw);
    if (citation.plaintiff) metadata.plaintiff = String(citation.plaintiff);
    if (citation.defendant) metadata.defendant = String(citation.defendant);
    return {
      type: TYPE_NAMES[citation.type] || citation.type,
      span: spanPair(citation.span),
      full_span: spanPair(citation.fullSpan),
      matched_text: String(citation.matchedText || citation.text || ''),
      groups,
      metadata
    };
  });
  let clusters = [];
  let resolutionState = 'resolved';
  try {
    const resolved = eyeciteTs.resolveCitations(citations, text);
    clusters = clustersFromResolutions(citations, resolved);
  } catch (error) {
    clusters = [];
    resolutionState = 'error: ' + String(error && error.message).slice(0, 120);
  }
  return { citations: records, clusters, resolution_state: resolutionState };
}
