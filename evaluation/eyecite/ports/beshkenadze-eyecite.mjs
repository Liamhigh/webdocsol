// Spike adapter for @beshkenadze/eyecite (beshkenadze/eyecite-js), pinned.
// Development-only: imports the gitignored install under evaluation/.cache/.
// Normalizes to the comparison record and strips nothing (this port emits no
// confidence scores or telemetry fields).

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = '@beshkenadze/eyecite';
export const pinnedVersion = '2.7.6-alpha.28';
export const license = 'BSD-2-Clause';
export const upstream = 'beshkenadze/eyecite-js';
export const strippedFields = [];

const cacheDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../evaluation/.cache/eyecite-ports');
const require = createRequire(path.join(cacheDirectory, 'package.json'));

const TYPE_NAMES = {
  FullCaseCitation: 'full_case',
  ShortCaseCitation: 'short_case',
  IdCitation: 'id',
  SupraCitation: 'supra',
  FullLawCitation: 'full_law',
  IdLawCitation: 'id_law',
  FullJournalCitation: 'full_journal',
  ReferenceCitation: 'reference',
  UnknownCitation: 'unknown'
};

const METADATA_KEYS = ['court', 'year', 'pinCite', 'plaintiff', 'defendant', 'parenthetical', 'extra'];

export function checkInstallation() {
  try {
    const resolved = require.resolve('@beshkenadze/eyecite');
    const relative = path.relative(cacheDirectory, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { status: 'installation_error', error: 'package resolved outside the ignored cache' };
    }
    let directory = path.dirname(resolved);
    while (directory !== path.dirname(directory)) {
      const packagePath = path.join(directory, 'package.json');
      try {
        const metadata = JSON.parse(readFileSync(packagePath, 'utf8'));
        if (metadata.name === '@beshkenadze/eyecite') {
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
  return require('@beshkenadze/eyecite');
}

function spanPair(citation, method) {
  if (typeof citation[method] !== 'function') return null;
  const span = citation[method]();
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end)) return null;
  return [span.start, span.end];
}

export function extract(text) {
  const eyecite = load();
  const citations = eyecite.getCitations(text);
  const records = citations.map((citation) => {
    const metadata = {};
    const raw = citation.metadata || {};
    for (const key of METADATA_KEYS) {
      if (raw[key]) metadata[key === 'pinCite' ? 'pin_cite' : key] = String(raw[key]);
    }
    const record = {
      type: TYPE_NAMES[citation.constructor.name] || citation.constructor.name,
      span: spanPair(citation, 'span'),
      full_span: spanPair(citation, 'fullSpan'),
      matched_text: typeof citation.matchedText === 'function' ? citation.matchedText() : String(citation.matchedText || ''),
      groups: Object.fromEntries(Object.entries(citation.groups || {}).map(([key, value]) => [key, String(value)])),
      metadata
    };
    const antecedent = raw.antecedentGuess || citation.antecedentGuess;
    if (antecedent) record.antecedent_guess = String(antecedent);
    return record;
  });
  const clusters = [];
  const indexOf = new Map(citations.map((citation, index) => [citation, index]));
  for (const members of eyecite.resolveCitations(citations).values()) {
    clusters.push(members.map((member) => indexOf.get(member)).filter((index) => index !== undefined).sort((a, b) => a - b));
  }
  clusters.sort((a, b) => a[0] - b[0]);
  return { citations: records, clusters, resolution_state: 'resolved' };
}
