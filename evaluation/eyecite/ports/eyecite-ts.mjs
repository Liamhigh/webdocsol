// Spike adapter for eyecite-ts (medelman17/eyecite-ts), pinned. Development-only:
// imports the gitignored install under evaluation/.cache/. Confidence scores and
// telemetry fields this port emits are stripped during normalization and listed
// in strippedFields; Verum occurrence records carry parsed facts, not scores.

import { createRequire } from 'node:module';
import path from 'node:path';

export const name = 'eyecite-ts';
export const pinnedVersion = '0.34.2';
export const license = 'MIT';
export const upstream = 'medelman17/eyecite-ts';
export const strippedFields = ['confidence', 'processTimeMs', 'patternsChecked', 'inferredCourt.confidence', 'resolution.confidence'];

const require = createRequire(path.join(process.cwd(), 'evaluation/.cache/eyecite-ports/package.json'));

const TYPE_NAMES = {
  case: 'full_case',
  short_case: 'short_case',
  id: 'id',
  supra: 'supra',
  statute: 'full_law',
  journal: 'full_journal'
};

function load() {
  return require('eyecite-ts');
}

export function isAvailable() {
  try {
    require.resolve('eyecite-ts');
    return true;
  } catch {
    return false;
  }
}

function spanPair(span) {
  if (!span || !Number.isInteger(span.originalStart) || !Number.isInteger(span.originalEnd)) return null;
  return [span.originalStart, span.originalEnd];
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
    const parent = citations.map((citation, index) => {
      const resolution = resolved[index] && resolved[index].resolution;
      return resolution && Number.isInteger(resolution.resolvedTo) ? resolution.resolvedTo : index;
    });
    const rootOf = (index) => {
      let current = index;
      const seen = new Set();
      while (parent[current] !== current && !seen.has(current)) {
        seen.add(current);
        current = parent[current];
      }
      return current;
    };
    const byRoot = new Map();
    citations.forEach((citation, index) => {
      const root = rootOf(index);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(index);
    });
    clusters = [...byRoot.values()].map((cluster) => cluster.sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  } catch (error) {
    clusters = [];
    resolutionState = 'error: ' + String(error && error.message).slice(0, 120);
  }
  return { citations: records, clusters, resolution_state: resolutionState };
}
