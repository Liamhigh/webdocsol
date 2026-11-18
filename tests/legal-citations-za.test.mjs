// tests/legal-citations-za.test.mjs — South African jurisdiction pack fixtures
// (Phase 2 PR 2.2). Synthetic fixture texts only.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
require(path.join(root, 'legal-packs.js'));
const zaPack = require(path.join(root, 'legal-packs/za.js'));
const Citations = require(path.join(root, 'legal-citations.js'));
const Contracts = require(path.join(root, 'analysis-contracts.js'));

const positives = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/citations/za-positive.json'), 'utf8'));
const negatives = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/citations/za-negative.json'), 'utf8'));

// --- registry and pack shape -----------------------------------------------------------

ok(zaPack.id === 'za' && zaPack.version === '1.0.0', 'the ZA pack carries its id and version');
ok(zaPack.rules.map((rule) => rule.rule_id).join(',') === 'za-neutral-court,za-reported-sa,za-docket-cct,za-saflii-url',
  'the ZA pack ships exactly its four narrow rules');
ok(zaPack.rules.every((rule) => rule.pattern.global && !rule.pattern.source.includes('(?<')),
  'every ZA rule is global and lookbehind-free');
ok(noThrow(() => Citations.validatePack(zaPack)), 'the ZA pack passes core pack validation');

// --- positive fixtures: exact spans, components, verbatim raw ---------------------------

for (const fixture of positives) {
  const occurrences = Citations.extractOccurrences(Citations.normalizePages([fixture.text]), [zaPack]);
  ok(occurrences.length === fixture.expect.length, fixture.id + ': occurrence count matches');
  const shared = Math.min(occurrences.length, fixture.expect.length);
  for (let index = 0; index < shared; index++) {
    const occurrence = occurrences[index];
    const expected = fixture.expect[index];
    ok(occurrence.rule_id === expected.rule_id && occurrence.kind === expected.kind &&
       occurrence.raw === expected.raw,
      fixture.id + ': occurrence ' + index + ' matches rule, kind and raw text');
    ok(fixture.text.slice(occurrence.span.start, occurrence.span.end) === occurrence.raw,
      fixture.id + ': occurrence ' + index + ' span round-trips to the source text');
    for (const key of Object.keys(expected.components)) {
      ok(occurrence.components[key] === expected.components[key],
        fixture.id + ': occurrence ' + index + ' component ' + key + ' is ' + JSON.stringify(expected.components[key]));
    }
  }
}

// --- negative fixtures: the pack stays silent -------------------------------------------

for (const fixture of negatives) {
  const occurrences = Citations.extractOccurrences(Citations.normalizePages([fixture.text]), [zaPack]);
  ok(occurrences.length === 0, fixture.id + ': no ZA occurrence (' + occurrences.map((o) => o.raw).join('; ') + ')');
}

// --- module envelope over a combined ZA text ----------------------------------------------

{
  const combined = positives.map((fixture) => fixture.text).join('\n');
  const envelope = Citations.runCitationModule([combined], { packs: [zaPack], referenceTime: '2026-11-15T00:00:00Z' });
  const expectedCount = positives.reduce((sum, fixture) => sum + fixture.expect.length, 0);
  ok(envelope.observations.length === expectedCount, 'the combined text yields every expected occurrence (' + envelope.observations.length + ' of ' + expectedCount + ')');
  ok(envelope.configuration.jurisdiction_packs.join(',') === 'za' && envelope.status === 'completed',
    'the envelope names the za pack and completes');
  ok(Contracts.validateModuleEnvelope(envelope).valid, 'the ZA envelope passes the contract validator');
  ok(envelope.observations.every((o) => o.pack_id === 'za' && o.pack_version === '1.0.0'),
    'every occurrence carries the pack identity');
  ok(envelope.observations.every((o) => combined.slice(o.span.start, o.span.end) === o.raw),
    'every occurrence anchor round-trips in the combined text');
  const replay = Citations.runCitationModule([combined], { packs: [zaPack], referenceTime: '2026-11-15T00:00:00Z' });
  ok(Contracts.stableStringify(envelope) === Contracts.stableStringify(replay), 'ZA extraction replays byte-identically');
}

// --- SALR display name never replaces the SA token ----------------------------------------

{
  const text = 'Reported in the SALR as 2026 (3) SA 112 (SCA).';
  const occurrences = Citations.extractOccurrences(Citations.normalizePages([text]), [zaPack]);
  ok(occurrences.length === 1 && occurrences[0].raw === '2026 (3) SA 112 (SCA)' && occurrences[0].components.reporter === 'SA',
    'SALR stays a display name; the SA token is the citation');
}

// --- whitespace and punctuation tolerance without touching raw text -------------------------

{
  const text = 'See 2026  (3)  SA  112  (SCA).';
  const occurrences = Citations.extractOccurrences(Citations.normalizePages([text]), [zaPack]);
  ok(occurrences.length === 1 && occurrences[0].raw === '2026  (3)  SA  112  (SCA)',
    'wide whitespace matches and the raw quote is preserved byte-for-byte');
}

done('legal-citations-za');
