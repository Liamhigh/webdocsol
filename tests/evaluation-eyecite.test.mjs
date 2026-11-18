// tests/evaluation-eyecite.test.mjs — PR 2.1 Eyecite conformance spike (B9, development-only).
// Hermetic: corpus integrity, comparator logic, adapter normalization, and the
// no-lookbehind static guard. Running the real ports is the spike CLI's job.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  compareCitations,
  compareClusters,
  loadConformance,
  runComparison
} from '../evaluation/eyecite/compare.mjs';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const eyeciteDir = path.join(root, 'evaluation', 'eyecite');

// --- corpus integrity ----------------------------------------------------------

const corpus = JSON.parse(readFileSync(path.join(eyeciteDir, 'conformance.json'), 'utf8'));
ok(noThrow(() => loadConformance(corpus)), 'the committed conformance corpus validates');
ok(corpus.cases.length === 17, 'the corpus holds 17 pinned cases');
ok(corpus.reference.version === '2.7.8' && corpus.reference.license === 'BSD-2-Clause',
  'the corpus pins eyecite 2.7.8 and its license');
{
  const behaviors = corpus.cases.map((testCase) => testCase.id);
  for (const required of ['full-basic', 'full-pin-cite', 'full-parallel', 'short-id', 'short-supra',
    'ambiguous-supra', 'unicode-text', 'line-break-in-cite', 'hyphenated-caption', 'malformed-no-page',
    'malformed-unknown-reporter', 'law-statute', 'journal', 'neutral-za-sa-negative', 'neutral-za-zacc-negative']) {
    ok(behaviors.includes(required), 'corpus covers ' + required);
  }
}
{
  const saNegative = corpus.cases.find((testCase) => testCase.id === 'neutral-za-sa-negative');
  const zaccNegative = corpus.cases.find((testCase) => testCase.id === 'neutral-za-zacc-negative');
  ok(saNegative.expected.citations.length === 0 && zaccNegative.expected.citations.length === 0,
    'the South African forms are pinned as non-citations for the US reference');
  const ambiguous = corpus.cases.find((testCase) => testCase.id === 'ambiguous-supra');
  const supraIndex = ambiguous.expected.citations.findIndex((citation) => citation.type === 'supra');
  ok(supraIndex >= 0 && ambiguous.expected.clusters.every((cluster) => !cluster.includes(supraIndex)),
    'the ambiguous supra is pinned as unresolved');
}
{
  const broken = JSON.parse(JSON.stringify(corpus));
  broken.cases[0].expected.citations[0].span = [0, 3];
  throws(() => loadConformance(broken));
  ok(true, 'a span that does not slice matched_text is rejected');
  const duplicated = JSON.parse(JSON.stringify(corpus));
  duplicated.cases.push(duplicated.cases[0]);
  throws(() => loadConformance(duplicated));
  ok(true, 'a duplicate case id is rejected');
}

// --- comparator logic ------------------------------------------------------------

const expectedOne = [{
  type: 'full_case',
  span: [12, 24],
  full_span: [0, 40],
  matched_text: '123 F.3d 456',
  groups: { volume: '123', reporter: 'F.3d', page: '456' },
  metadata: { court: 'ca9', year: '2020' }
}];
{
  const exact = compareCitations(expectedOne, [JSON.parse(JSON.stringify(expectedOne[0]))]);
  ok(exact.differences.length === 0, 'identical records match exactly');
  const extra = JSON.parse(JSON.stringify(expectedOne[0]));
  extra.metadata.extra = 'port-only field';
  const withExtra = compareCitations(expectedOne, [extra]);
  ok(withExtra.differences.length === 0 && withExtra.notes.length === 1,
    'extra port metadata is a note, never a failure');
  const wrong = JSON.parse(JSON.stringify(expectedOne[0]));
  wrong.span = [12, 25];
  ok(compareCitations(expectedOne, [wrong]).differences.length === 1, 'a shifted span is a difference');
  const missingMeta = JSON.parse(JSON.stringify(expectedOne[0]));
  delete missingMeta.metadata.court;
  ok(compareCitations(expectedOne, [missingMeta]).differences.length === 1, 'missing reference metadata is a difference');
  ok(compareCitations(expectedOne, []).differences.length === 1, 'a missing citation is a difference');
  ok(compareClusters([[0, 2], [1]], [[1], [0, 2]]) && !compareClusters([[0, 2]], [[0], [2]]),
    'cluster comparison is order-insensitive and exact');
}

// --- runComparison with synthetic adapters ----------------------------------------

{
  const tinyCorpus = {
    corpus_version: '1.0.0',
    reference: { name: 'eyecite', version: '2.7.8', license: 'BSD-2-Clause' },
    cases: [{
      id: 'tiny',
      behavior: 'synthetic',
      text: 'Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).',
      expected: { citations: expectedOne, clusters: [[0]] }
    }]
  };
  const goodAdapter = {
    name: 'good', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    isAvailable: () => true,
    extract: async () => ({ citations: [JSON.parse(JSON.stringify(expectedOne[0]))], clusters: [[0]], resolution_state: 'resolved' })
  };
  const missingAdapter = {
    name: 'missing', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    isAvailable: () => false,
    extract: async () => { throw new Error('never called'); }
  };
  const brokenAdapter = {
    name: 'broken', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    isAvailable: () => true,
    extract: async () => { throw new Error('port exploded'); }
  };
  const unsupportedResolution = {
    name: 'nores', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    isAvailable: () => true,
    extract: async () => ({ citations: [JSON.parse(JSON.stringify(expectedOne[0]))], clusters: [], resolution_state: 'unsupported' })
  };
  const report = await runComparison(tinyCorpus, [goodAdapter, missingAdapter, brokenAdapter, unsupportedResolution]);
  const byName = Object.fromEntries(report.ports.map((port) => [port.name, port]));
  ok(report.report_type === 'eyecite_conformance_spike' && report.production_finding_effect === 'none',
    'the report names itself and its production effect');
  ok(byName.good.summary.matched === 1 && byName.good.status === 'evaluated', 'a conforming port matches');
  ok(byName.missing.status === 'not_installed' && byName.missing.summary.resolution === 'not_evaluated',
    'a missing port is reported not_installed, not failed');
  ok(byName.broken.summary.errored === 1 && byName.broken.cases[0].error.includes('port exploded'),
    'an exploding port is recorded as an errored case');
  ok(byName.nores.cases[0].clusters === 'unsupported' && byName.nores.summary.mismatched === 1,
    'a port without resolution support says so instead of silently failing clusters');
}

// --- real adapters normalize and strip (spike installs only) ------------------------

{
  const besh = await import(pathToFileURL(path.join(eyeciteDir, 'ports', 'beshkenadze-eyecite.mjs')).href);
  const ts = await import(pathToFileURL(path.join(eyeciteDir, 'ports', 'eyecite-ts.mjs')).href);
  ok(besh.name === '@beshkenadze/eyecite' && besh.pinnedVersion === '2.7.6-alpha.28' && besh.license === 'BSD-2-Clause',
    'the beshkenadze adapter pins version and license');
  ok(ts.name === 'eyecite-ts' && ts.pinnedVersion === '0.34.2' && ts.license === 'MIT' &&
     ts.strippedFields.includes('confidence'),
  'the eyecite-ts adapter pins version, license and stripped confidence fields');
  if (besh.isAvailable()) {
    const out = besh.extract('Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).');
    const record = out.citations[0];
    ok(record.type === 'full_case' && String(record.span) === '12,24' && record.groups.reporter === 'F.3d' &&
       record.metadata.court === 'ca9' && out.clusters.length === 1,
      'the beshkenadze adapter normalizes to the comparison record');
  }
  if (ts.isAvailable()) {
    const out = ts.extract('Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).');
    const record = out.citations[0];
    ok(record && !('confidence' in record) && String(record.span) === '12,24',
      'the eyecite-ts adapter strips confidence and normalizes spans');
  }
}

// --- no regex lookbehind in spike parser code (older WebKit cannot parse it) ---------

{
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.mjs')) files.push(full);
    }
  };
  walk(eyeciteDir);
  ok(files.length >= 3, 'the spike directory holds parser sources to scan');
  ok(files.every((file) => {
    const source = readFileSync(file, 'utf8');
    return !source.includes('(?<=') && !source.includes('(?<!');
  }), 'no regex lookbehind in any spike source');
}

// --- spike CLI runs on the committed corpus ------------------------------------------

{
  const result = spawnSync(process.execPath, [path.join(eyeciteDir, 'compare.mjs')], { encoding: 'utf8', cwd: root });
  ok(result.status === 0, 'compare.mjs exits 0 on the committed corpus' + (result.status === 0 ? '' : ': ' + result.stderr));
  const report = JSON.parse(result.stdout);
  ok(report.ports.length === 2 && report.ports.every((port) => ['evaluated', 'not_installed'].includes(port.status)),
    'both candidate ports are reported with an explicit status');
  ok(report.ports.every((port) => port.status !== 'evaluated' || port.summary.matched + port.summary.mismatched + port.summary.errored === 17),
    'every evaluated port accounts for all 17 cases');
}

// --- decision record exists and decides -----------------------------------------------

{
  const decision = readFileSync(path.join(eyeciteDir, 'DECISION.md'), 'utf8');
  ok(decision.includes('Option 2') && decision.includes('narrow neutral parser') && decision.includes('docs/decisions/citation-parser.md'),
    'the decision record selects the narrow parser and notes the docs/decisions convention question');
}

done('evaluation-eyecite');
