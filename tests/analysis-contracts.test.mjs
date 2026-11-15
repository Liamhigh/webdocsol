import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const C = require('../analysis-contracts.js');
const Config = require('../analysis-config.js');
const Engine = require('../forensic-engine-page.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const fixture = (name) => JSON.parse(readFileSync(path.join(here, 'contracts', name), 'utf8'));

console.log('======================================================');
console.log('RUN  analysis-contracts.test.mjs');
console.log('======================================================\n');

for (const name of ['text-anchor-v1.json', 'structural-anchor-v1.json', 'ocr-anchor-v1.json']) {
  const record = fixture(name);
  const result = C.validateEvidenceAnchor(record.anchor);
  ok(result.valid, name + ' validates: ' + result.errors.join('; '));
  ok(JSON.parse(C.stableStringify(record)).anchor.quote === record.anchor.quote, name + ' round-trips exact quotation');
  if (record.page_text) {
    const a = record.anchor;
    ok(record.page_text.slice(a.char_start, a.char_end) === a.quote, name + ' offsets resolve to exact source text');
    ok(record.page_text.slice(0, a.char_start) === a.context_before, name + ' preceding context is verbatim');
    ok(record.page_text.slice(a.char_end) === a.context_after, name + ' following context is verbatim');
  }
}

const text = fixture('text-anchor-v1.json');
ok(text.anchor.char_end - text.anchor.char_start === text.anchor.quote.length, 'surrogate pair and combining character use JavaScript UTF-16 lengths');
ok(text.anchor.quote.codePointAt(0) === 0x1f600 && text.anchor.quote.charAt(0) !== text.anchor.quote.charAt(1), 'fixture genuinely contains a surrogate pair');
ok(text.anchor.quote.includes('e\u0301'), 'fixture genuinely contains a combining character');
const badText = C.canonicalClone(text.anchor);
badText.char_end--;
ok(!C.validateEvidenceAnchor(badText).valid, 'offset/quote length mismatch is rejected');
const badStructural = C.canonicalClone(fixture('structural-anchor-v1.json').anchor);
badStructural.structure = null;
ok(!C.validateEvidenceAnchor(badStructural).valid, 'null quote without structural evidence is rejected');

const pair = fixture('pair-finding-v1.json').finding;
ok(C.validatePairFinding(pair).valid, 'pair fixture validates with both anchors and incompatibility explanation');
const orphan = C.canonicalClone(pair);
orphan.anchors.pop();
ok(!C.validatePairFinding(orphan).valid, 'orphan pair member is rejected');
const unexplained = C.canonicalClone(pair);
delete unexplained.incompatibility_explanation;
ok(!C.validatePairFinding(unexplained).valid, 'pair without incompatibility explanation is rejected');

const sha = 'a'.repeat(128);
const envelopeSpec = {
  module_id: 'pdf.redaction',
  module_version: '1.0.0',
  implementation_digest: 'synthetic-release-manifest-v1',
  status: 'completed',
  input_sha512: sha,
  reference_time: '2026-11-15T00:00:00.000Z',
  configuration: { flag: 'redaction', ruleset_version: 'synthetic-rules-v1' },
  dependencies: [{ name: 'pdf.js', version: '3.11.174' }],
  coverage: { units_total: 1, units_processed: 1, units_skipped: [], units_failed: [] },
  observations: [], findings: [], warnings: [], failure: null
};
const envelope = C.createModuleEnvelope(envelopeSpec);
ok(C.validateModuleEnvelope(envelope).valid, 'completed module envelope validates');
ok(Object.isFrozen(envelope) && Object.isFrozen(envelope.coverage), 'module envelope is deeply immutable');
ok(C.stableStringify(envelope) === C.stableStringify(C.canonicalClone(envelope)), 'module envelope canonical round-trip is byte-identical');
const failure = C.createFailure('BUDGET_OBJECTS', 'Synthetic object budget exhausted', { limit: 10 });
const failed = C.createFailureEnvelope({ ...envelopeSpec, status: 'budget_exceeded', coverage: { units_total: 12, units_processed: 10, units_skipped: [], units_failed: [11, 12] } }, failure);
ok(failed.status === 'budget_exceeded' && failed.failure.code === 'BUDGET_OBJECTS', 'failure constructor preserves explicit budget state');
ok(!C.createModuleEnvelope({ ...envelopeSpec, status: 'not_applicable', reference_time: null }).reference_time, 'not-applicable envelope supports null reference time');
ok(throws(() => C.createModuleEnvelope({ ...envelopeSpec, status: 'unknown' })), 'unknown module status is rejected');
ok(throws(() => C.createModuleEnvelope({ ...envelopeSpec, status: 'failed' })), 'failed status without failure is rejected');
ok(throws(() => C.createModuleEnvelope({ ...envelopeSpec, status: 'completed_with_failures' })), 'partial completion without enumerated failed units is rejected');

const unsorted = [
  { rule_id: 'B', finding_id: '2', anchors: [{ ...text.anchor, page: 8 }] },
  { rule_id: 'A', finding_id: '1', anchors: [{ ...text.anchor, page: 2 }] },
  { rule_id: 'A', finding_id: '1', anchors: [{ ...text.anchor, page: 2 }] }
];
const sorted = C.sortFindings(unsorted);
ok(sorted[0] === unsorted[1] && sorted[1] === unsorted[2] && sorted[2] === unsorted[0], 'finding comparator sorts artifact/page/offset/rule/id without locale collation');
ok(sorted.length === 3 && sorted[0] !== sorted[1] && C.stableStringify(sorted[0]) === C.stableStringify(sorted[1]), 'canonical sorting retains duplicate records deterministically');
const id1 = C.deterministicId('pdf.redaction', sha, 'R1', [text.anchor]);
const id2 = C.deterministicId('pdf.redaction', sha, 'R1', [C.canonicalClone(text.anchor)]);
ok(id1 === id2 && id1.startsWith('vo1|'), 'deterministic ID is independent of object key insertion order');
ok(id1 !== C.deterministicId('pdf.redaction', sha, 'R2', [text.anchor]), 'rule ID changes deterministic finding ID');
ok(throws(() => C.stableStringify({ bad: undefined })), 'canonical JSON rejects undefined instead of silently dropping evidence');
ok(throws(() => C.stableStringify({ bad: new Date('2026-11-15T00:00:00Z') })) && throws(() => C.stableStringify({ bad: new Map() })), 'canonical JSON rejects non-plain objects instead of serializing them as empty evidence');
ok(throws(() => C.createModuleEnvelope({ ...envelopeSpec, findings: false })), 'module envelope rejects invalid falsy fields instead of replacing them with defaults');
ok(C.stableStringify({ z: 1, a: { z: 2, a: 3 } }) === '{"a":{"a":3,"z":2},"z":1}', 'canonical JSON recursively sorts keys');

const defaults = Config.selectedConfiguration();
ok(Config.MODULE_NAMES.every((name) => defaults.modules[name] === false), 'every new module flag defaults to false');
ok(defaults.jurisdictionPacks.join(',') === 'za' && defaults.reference_time === undefined, 'default replay configuration is explicit');
ok(defaults.referenceTime === null && Object.isFrozen(defaults.modules), 'reference time defaults to null and configuration is frozen');
ok(throws(() => Config.selectedConfiguration({ modules: { unknown: true } })), 'unknown module flag fails closed');
ok(throws(() => Config.selectedConfiguration({ modules: { redaction: 1 } })), 'non-boolean module flag fails closed');
ok(throws(() => Config.selectedConfiguration({ referenceTime: undefined, jurisdictionPacks: ['ZA'] })), 'non-normalized jurisdiction pack fails closed');
const normalized = Config.withAnalysisDefaults({ modules: { redaction: false }, jurisdictionPacks: ['us', 'za', 'us'], referenceTime: '2026-11-15T00:00:00Z', other: 7 });
ok(normalized.other === 7 && normalized.jurisdictionPacks.join(',') === 'us,za', 'option normalization preserves unrelated options and deterministically deduplicates packs');

const proposal = fixture('findings-extension-proposal.json');
ok(proposal.base_findings_json_version === '1.11.0' && proposal.next_production_version === null, 'schema proposal does not presume a next production version');
const oldPackage = { findings_json_version: '1.11.0', contradictions: [{ contradiction_id: 'synthetic-1' }] };
const extension = { 'future.unknown': { module_version: '9.0.0', observations: [{ synthetic: true }] } };
const newPackage = { ...oldPackage, analysis_extensions: extension };
const oldReader = { findings_json_version: newPackage.findings_json_version, contradictions: newPackage.contradictions };
ok(C.stableStringify(oldReader) === C.stableStringify(oldPackage), 'new producer/old reader ignores optional extension without rejecting base findings');
const roundTrip = JSON.parse(C.stableStringify(newPackage));
ok(C.stableStringify(roundTrip.analysis_extensions) === C.stableStringify(extension), 'unknown extension survives canonical reader/writer round-trip');
const newReader = { base: roundTrip, knownExtension: roundTrip.analysis_extensions['future.unknown'] };
ok(newReader.knownExtension.observations[0].synthetic === true, 'old producer/new reader and unknown-module behavior remain additive');
ok(!('analysis_extensions' in oldPackage), 'old producer package has no extension dependency');

async function runSynthetic(options) {
  const previous = globalThis.extractPdfText;
  globalThis.extractPdfText = async () => ['Synthetic agreement. The total is R100.00. The parties performed on 1 January 2026.'];
  try {
    return await Engine.runForensicEngine(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]), {
      getPages() { throw new Error('synthetic raw-text fallback'); }
    }, null, options);
  } finally {
    if (typeof previous === 'undefined') delete globalThis.extractPdfText;
    else globalThis.extractPdfText = previous;
  }
}

const replayOptions = { referenceTime: '2026-11-15T00:00:00.000Z', modules: Config.DEFAULT_MODULES, jurisdictionPacks: ['za'] };
const first = await runSynthetic(replayOptions);
const second = await runSynthetic(replayOptions);
ok(C.stableStringify(first) === C.stableStringify(second), 'repeated engine calls produce byte-identical canonical JSON for identical bytes/options/reference time');
const explicitOff = await runSynthetic({ referenceTime: replayOptions.referenceTime, modules: Object.fromEntries(Config.MODULE_NAMES.map((name) => [name, false])), jurisdictionPacks: ['za'] });
ok(C.stableStringify(first.findings) === C.stableStringify(explicitOff.findings), 'all existing findings remain unchanged with every new flag explicitly off');
ok(Config.MODULE_NAMES.every((name) => first.analysisConfiguration.modules[name] === false), 'complete disabled module selection is copied into engine results');
ok(first.analysisConfiguration.referenceTime === replayOptions.referenceTime, 'caller-supplied reference time is copied into replay configuration');

const replayProgram = `
const Engine=require(${JSON.stringify(path.join(root, 'forensic-engine-page.js'))});
const C=require(${JSON.stringify(path.join(root, 'analysis-contracts.js'))});
globalThis.extractPdfText=async()=>['Synthetic agreement. The total is R100.00. The parties performed on 1 January 2026.'];
Engine.runForensicEngine(new Uint8Array([37,80,68,70,45,49,46,52]),{getPages(){throw new Error('synthetic raw-text fallback');}},null,${JSON.stringify(replayOptions)})
.then(r=>process.stdout.write(C.stableStringify(r))).catch(e=>{console.error(e);process.exit(1);});
`;
const replayUtc = spawnSync(process.execPath, ['-e', replayProgram], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
const replayPacific = spawnSync(process.execPath, ['-e', replayProgram], { encoding: 'utf8', env: { ...process.env, TZ: 'Pacific/Honolulu' } });
ok(replayUtc.status === 0 && replayPacific.status === 0, 'fresh-process replay runs complete: ' + replayUtc.stderr + replayPacific.stderr);
ok(replayUtc.stdout === replayPacific.stdout && replayUtc.stdout === C.stableStringify(first), 'fresh processes and time zones produce byte-identical canonical results');

for (const file of ['analysis-contracts.js', 'analysis-config.js']) {
  const source = readFileSync(path.join(root, file), 'utf8');
  ok(!/Date\.now\s*\(|Math\.random\s*\(|localeCompare\s*\(|new\s+Date\s*\(\s*\)/.test(source), file + ' contains no wall clock, random ID, locale collation or empty Date constructor');
  ok(!/\(\?<[=!]/.test(source), file + ' contains no regex lookbehind');
}
const html = readFileSync(path.join(root, 'seal-document.html'), 'utf8');
ok(/findings_json_version:\s*'1\.11\.0'/.test(html) && !/findings_json_version:\s*'1\.12\.0'/.test(html), 'production findings JSON remains at 1.11.0');
ok(!html.includes('analysis_extensions:'), 'unapproved analysis_extensions field is absent from production findings builder');

done('analysis-contracts');
