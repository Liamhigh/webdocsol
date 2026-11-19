// tests/evaluation-eyecite.test.mjs — PR 2.1 Eyecite conformance spike (B9, development-only).
// Hermetic core checks; real extraction runs only for exact pinned installs.
import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  CORPUS_LIMITS,
  compareCitations,
  compareClusters,
  loadConformance,
  loadAdapters,
  parseConformance,
  runComparison
} from '../evaluation/eyecite/compare.mjs';
import { clustersFromResolutions } from '../evaluation/eyecite/ports/eyecite-ts.mjs';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

async function rejects(promise) {
  try {
    await promise;
    return false;
  } catch {
    return true;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eyeciteDir = path.join(root, 'evaluation', 'eyecite');
const sampleText = 'Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).';

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
  ok(throws(() => loadConformance(broken)), 'a span that does not slice matched_text is rejected');
  const badFullSpan = JSON.parse(JSON.stringify(corpus));
  badFullSpan.cases[0].expected.citations[0].full_span = [0, 999];
  ok(throws(() => loadConformance(badFullSpan)), 'an out-of-bounds full span is rejected');
  const reversedSpan = JSON.parse(JSON.stringify(corpus));
  reversedSpan.cases[0].expected.citations[0].span = [24, 12];
  ok(throws(() => loadConformance(reversedSpan)), 'a reversed citation span is rejected');
  const duplicated = JSON.parse(JSON.stringify(corpus));
  duplicated.cases.push(duplicated.cases[0]);
  ok(throws(() => loadConformance(duplicated)), 'a duplicate case id is rejected');
  const tooManyCases = JSON.parse(JSON.stringify(corpus));
  tooManyCases.cases = Array.from({ length: CORPUS_LIMITS.cases + 1 }, (_, index) =>
    ({ ...corpus.cases[0], id: 'case-' + index }));
  ok(throws(() => loadConformance(tooManyCases)), 'a corpus exceeding the case limit is rejected');
  const longText = JSON.parse(JSON.stringify(corpus));
  longText.cases[0].text = 'x'.repeat(CORPUS_LIMITS.caseText + 1);
  ok(throws(() => loadConformance(longText)), 'a corpus case exceeding the text limit is rejected');
  const tooMuchText = JSON.parse(JSON.stringify(corpus));
  tooMuchText.cases = tooMuchText.cases.slice(0, 9).map((testCase, index) => ({
    ...testCase,
    id: 'large-text-' + index,
    text: 'x'.repeat(30 * 1024),
    expected: { citations: [], clusters: [] }
  }));
  ok(throws(() => loadConformance(tooMuchText)), 'a corpus exceeding the total text limit is rejected');
  ok(throws(() => parseConformance(Buffer.alloc(CORPUS_LIMITS.bytes + 1))),
    'a corpus exceeding the byte limit is rejected before JSON parsing');
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
  const exact = compareCitations(expectedOne, [JSON.parse(JSON.stringify(expectedOne[0]))], sampleText);
  ok(exact.differences.length === 0, 'identical records match exactly');
  const extra = JSON.parse(JSON.stringify(expectedOne[0]));
  extra.metadata.extra = 'port-only field';
  const withExtra = compareCitations(expectedOne, [extra], sampleText);
  ok(withExtra.differences.length === 0 && withExtra.notes.length === 1,
    'extra port metadata is a note, never a failure');
  const missingGroup = JSON.parse(JSON.stringify(expectedOne[0]));
  delete missingGroup.groups.page;
  ok(compareCitations(expectedOne, [missingGroup], sampleText).differences.some((item) => item.path === 'citations[0].groups.page'),
    'a missing port group key is a difference');
  const extraGroup = JSON.parse(JSON.stringify(expectedOne[0]));
  extraGroup.groups.extra = 'value';
  ok(compareCitations(expectedOne, [extraGroup], sampleText).differences.some((item) => item.path === 'citations[0].groups.extra'),
    'an extra port group key is a difference');
  const wrong = JSON.parse(JSON.stringify(expectedOne[0]));
  wrong.span = [12, 25];
  ok(compareCitations(expectedOne, [wrong], sampleText).differences.some((item) => item.path === 'citations.shape' || item.path === 'citations[0].span'),
    'a shifted span is a difference');
  const stringSpan = JSON.parse(JSON.stringify(expectedOne[0]));
  stringSpan.span = ['12', '24'];
  ok(compareCitations(expectedOne, [stringSpan], sampleText).differences.some((item) => item.path === 'citations.shape'),
    'numeric-looking string spans are rejected');
  const stringFullSpan = JSON.parse(JSON.stringify(expectedOne[0]));
  stringFullSpan.full_span = ['0', '40'];
  ok(compareCitations(expectedOne, [stringFullSpan], sampleText).differences.some((item) => item.path === 'citations.shape'),
    'numeric-looking string full spans are rejected');
  const missingMeta = JSON.parse(JSON.stringify(expectedOne[0]));
  delete missingMeta.metadata.court;
  ok(compareCitations(expectedOne, [missingMeta], sampleText).differences.length === 1, 'missing reference metadata is a difference');
  ok(compareCitations(expectedOne, [], sampleText).differences.length === 1, 'a missing citation is a difference');
  ok(compareClusters([[0, 2], [1]], [[1], [2, 0]]) &&
     !compareClusters([[0, 2]], [[0], [2]]) &&
     !compareClusters([[0]], [['0']]) &&
     !compareClusters([[0]], [[0], [0]]),
    'cluster comparison is numeric, order-insensitive, and rejects malformed or duplicated members');
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
  const unsupportedResolution = {
    name: 'nores', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    checkInstallation: () => ({ status: 'available', version: '1' }),
    extract: async () => ({ citations: [JSON.parse(JSON.stringify(expectedOne[0]))], clusters: [], resolution_state: 'unsupported' })
  };
  const mismatchedVersion = {
    name: 'wrong-version', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    checkInstallation: () => ({ status: 'available', version: '2' }),
    extract: async () => { throw new Error('must not extract a mismatched package'); }
  };
  const goodAdapter = {
    name: 'good', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    checkInstallation: () => ({ status: 'available', version: '1' }),
    extract: async () => ({ citations: [JSON.parse(JSON.stringify(expectedOne[0]))], clusters: [[0]], resolution_state: 'resolved' })
  };
  const missingAdapter = {
    name: 'missing', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    checkInstallation: () => ({ status: 'not_installed' }),
    extract: async () => { throw new Error('never called'); }
  };
  const brokenAdapter = {
    name: 'broken', pinnedVersion: '1', license: 'MIT', upstream: 'test/test', strippedFields: [],
    checkInstallation: () => ({ status: 'available', version: '1' }),
    extract: async () => { throw new Error('port exploded'); }
  };
  const report = await runComparison(tinyCorpus, [goodAdapter, missingAdapter, brokenAdapter, unsupportedResolution]);
  const byName = Object.fromEntries(report.ports.map((port) => [port.name, port]));
  ok(report.report_type === 'eyecite_conformance_spike' && report.production_finding_effect === 'none',
    'the report names itself and its production effect');
  ok(byName.good.summary.matched === 1 && byName.good.status === 'evaluated' && byName.good.comparison_status === 'evaluated',
    'a conforming port matches');
  ok(byName.missing.status === 'not_installed' && byName.missing.comparison_status === 'not_evaluated' &&
     byName.missing.summary.resolution === 'not_evaluated',
    'a missing port is reported not_installed, not failed');
  ok(byName.broken.summary.errored === 1 && byName.broken.cases[0].error.includes('port exploded'),
    'an exploding port is recorded as an errored case');
  ok(byName.nores.cases[0].clusters === 'unsupported' && byName.nores.summary.mismatched === 1,
    'a port without resolution support says so instead of silently failing clusters');
  const mismatchReport = await runComparison(tinyCorpus, [mismatchedVersion]);
  ok(mismatchReport.ports[0].status === 'version_mismatch' &&
     mismatchReport.ports[0].comparison_status === 'not_comparable' &&
     mismatchReport.ports[0].summary.matched === 0,
    'a package with a different installed version is not evaluated or comparable');
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
  const beshInstallation = besh.checkInstallation();
  const tsInstallation = ts.checkInstallation();
  ok(['available', 'not_installed', 'version_mismatch', 'installation_error'].includes(beshInstallation.status) &&
     ['available', 'not_installed', 'version_mismatch', 'installation_error'].includes(tsInstallation.status),
  'candidate installation states are explicit');
  ok((beshInstallation.status !== 'available' || beshInstallation.version === besh.pinnedVersion) &&
     (tsInstallation.status !== 'available' || tsInstallation.version === ts.pinnedVersion),
  'an evaluated real adapter is installed at its exact declared version');
  if (beshInstallation.status === 'available') {
    const out = besh.extract('Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).');
    const record = out.citations[0];
    ok(record.type === 'full_case' && record.span[0] === 12 && record.span[1] === 24 && record.groups.reporter === 'F.3d' &&
       record.metadata.court === 'ca9' && out.clusters.length === 1,
      'the beshkenadze adapter normalizes to the comparison record');
  }
  if (tsInstallation.status === 'available') {
    const out = ts.extract('Foo v. Bar, 123 F.3d 456 (9th Cir. 2020).');
    const record = out.citations[0];
    ok(record && !('confidence' in record) && record.span[0] === 12 && record.span[1] === 24,
      'the eyecite-ts adapter strips confidence and normalizes spans');
  }
  const unresolved = clustersFromResolutions([{}, {}], [{}, {}]);
  const resolvedShortForm = clustersFromResolutions([{}, {}], [
    { resolution: { resolvedTo: 0 } },
    { resolution: { resolvedTo: 0 } }
  ]);
  ok(unresolved.length === 0 && resolvedShortForm.length === 1 &&
     resolvedShortForm[0][0] === 0 && resolvedShortForm[0][1] === 1,
  'unresolved citations are omitted instead of becoming singleton resolved clusters');
  console.log('[evaluation-eyecite] real adapter extraction: ' +
    [besh, ts].map((adapter) => adapter.name + '=' + adapter.checkInstallation().status).join(', '));
}

// --- fixed adapter allowlist and explicit directory failures -------------------------

{
  const temp = mkdtempSync(path.join(os.tmpdir(), 'eyecite-adapters-'));
  try {
    ok(await rejects(loadAdapters(path.join(temp, 'missing'))), 'an adapter-directory read error is not hidden');
    ok(await rejects(loadAdapters(temp)), 'an empty required adapter set is rejected');
    copyFileSync(path.join(eyeciteDir, 'ports', 'beshkenadze-eyecite.mjs'), path.join(temp, 'beshkenadze-eyecite.mjs'));
    copyFileSync(path.join(eyeciteDir, 'ports', 'eyecite-ts.mjs'), path.join(temp, 'eyecite-ts.mjs'));
    const rogue = path.join(temp, 'not-allowlisted.mjs');
    writeFileSync(rogue, 'throw new Error("untrusted adapter loaded");\n');
    const adapters = await loadAdapters(temp);
    ok(adapters.length === 2 && adapters.map((adapter) => adapter.name).join(',') === '@beshkenadze/eyecite,eyecite-ts',
      'only the fixed repository-owned adapter allowlist is loaded');
  } finally {
    rmSync(temp, { recursive: true, force: true });
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
  const generator = readFileSync(path.join(eyeciteDir, 'generate-conformance.py'), 'utf8');
  ok(generator.includes('Path(__file__).resolve().with_name("conformance.json")') &&
     generator.includes('tempfile.NamedTemporaryFile') && generator.includes('os.replace('),
  'the generator uses pathlib and same-directory atomic replacement');
}

// --- spike CLI runs on the committed corpus ------------------------------------------

{
  const externalCwd = mkdtempSync(path.join(os.tmpdir(), 'eyecite-cli-'));
  const result = spawnSync(process.execPath, [path.join(eyeciteDir, 'compare.mjs')], { encoding: 'utf8', cwd: externalCwd });
  rmSync(externalCwd, { recursive: true, force: true });
  ok(result.status === 0, 'compare.mjs exits 0 on the committed corpus' + (result.status === 0 ? '' : ': ' + result.stderr));
  const report = JSON.parse(result.stdout);
  ok(report.ports.length === 2 && report.ports.every((port) =>
    ['evaluated', 'not_installed', 'version_mismatch', 'installation_error'].includes(port.status)),
  'both candidate ports are reported with an explicit installation status');
  ok(report.ports.every((port) => port.status !== 'evaluated' || port.summary.matched + port.summary.mismatched + port.summary.errored === 17),
    'every evaluated port accounts for all 17 cases');
  ok(report.ports.every((port) => port.comparison_status === 'evaluated' ||
     port.summary.resolution === 'not_evaluated'),
    'unavailable or mismatched ports are explicitly not evaluated');
}

// --- decision record exists and decides -----------------------------------------------

{
  const decision = readFileSync(path.join(eyeciteDir, 'DECISION.md'), 'utf8');
  ok(decision.includes('Option 2') && decision.includes('narrow neutral parser') && decision.includes('docs/decisions/citation-parser.md'),
    'the decision record selects the narrow parser and notes the docs/decisions convention question');
}

done('evaluation-eyecite');
