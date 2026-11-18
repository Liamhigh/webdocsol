// tests/legal-citations.test.mjs — neutral citation occurrence core, pack
// registry, resolution, envelope and engine integration (Phase 2 PR 2.2).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Contracts = require(path.join(root, 'analysis-contracts.js'));
const Config = require(path.join(root, 'analysis-config.js'));
const Packs = require(path.join(root, 'legal-packs.js'));
const Citations = require(path.join(root, 'legal-citations.js'));

// --- pack registry --------------------------------------------------------------

function syntheticRule(ruleId, kind, pattern, extract) {
  return { rule_id: ruleId, kind, pattern, extract };
}
const xxPack = {
  id: 'xx',
  version: '1.0.0',
  rules: [
    syntheticRule('xx-full-case', 'full_case', /\b(\d{3}) (XXR) (\d+)\b/g,
      (m, context) => ({ volume: m[1], reporter: m[2], page: m[3], caption: context.text.slice(0, m.index).trim().split(/\s+/).pop() || null })),
    syntheticRule('xx-id', 'id', /\bId\./g, () => ({})),
    syntheticRule('xx-supra', 'supra', /\b([A-Z][a-z]+), supra\b/g, (m) => ({ name_guess: m[1] }))
  ]
};

ok(Packs.list().indexOf('xx') === -1, 'the synthetic pack starts unregistered');
ok(noThrow(() => Packs.register(xxPack)), 'a well-formed pack registers');
ok(Packs.has('xx') && Packs.get('xx') === xxPack && Packs.list().join(',') === 'xx', 'registration is retrievable and sorted');
throws(() => Packs.register(xxPack));
ok(true, 're-registering the same pack id fails closed');
throws(() => Packs.register({ id: 'yy', version: '1', rules: [] }));
ok(true, 'a pack without rules is rejected');
throws(() => Packs.register({ id: 'yy', version: '1', rules: [syntheticRule('yy-bad', 'id', /x/)] }));
ok(true, 'a non-global pattern is rejected');
throws(() => Packs.register({ id: 'yy', version: '1', rules: [{ rule_id: 'yy-look', kind: 'id', pattern: new RegExp('(?<=x)y', 'g') }] }));
ok(true, 'a lookbehind pattern is rejected at registration');
throws(() => Packs.get('zz'));
ok(true, 'an unknown pack id fails closed');
ok(Packs.resolvePacks(['xx'])[0] === xxPack, 'resolvePacks preserves explicit order');

// --- core: extraction, spans, ordering ---------------------------------------------

{
  const pages = Citations.normalizePages(['First page cites 100 XXR 200. Id. rests.', 'Second page cites 555 XXR 777 and 100 XXR 200 again.']);
  ok(pages.length === 2 && pages[0].page === 1 && pages[0].extraction.kind === 'pdf_text', 'string pages normalize with pdf_text extraction');
  const occurrences = Citations.extractOccurrences(pages, [xxPack]);
  ok(occurrences.length === 4, 'every occurrence is kept, including repeats across pages');
  ok(occurrences[0].span.page === 1 && occurrences[0].raw === '100 XXR 200' &&
     pages[0].text.slice(occurrences[0].span.start, occurrences[0].span.end) === occurrences[0].raw,
    'spans slice the exact verbatim raw text');
  ok(occurrences[1].kind === 'id', 'the id. rule fires on the same page');
  ok(occurrences.map((o) => o.span.page + ':' + o.span.start).join('|') ===
     occurrences.map((o) => o.span.page + ':' + o.span.start).sort().join('|') ||
     occurrences.every((o, i) => i === 0 || o.span.page > occurrences[i - 1].span.page ||
       (o.span.page === occurrences[i - 1].span.page && o.span.start >= occurrences[i - 1].span.start)),
    'occurrences are in deterministic document order');
  ok(occurrences[0].components.volume === '100' && 'caption' in occurrences[0].components,
    'components are extracted with explicit fields, never invented');
  throws(() => Citations.extractOccurrences(pages, [xxPack]).length && Citations.normalizePages([42]));
  ok(true, 'a non-string page is rejected');
}

// --- core: short-form resolution ----------------------------------------------------

{
  const idText = 'Foo 100 XXR 200. Bar 555 XXR 777. Id. applies.';
  const idRun = Citations.runCitationModule([idText], { packs: [xxPack], referenceTime: '2026-11-15T00:00:00Z' });
  const idOcc = idRun.observations.find((o) => o.kind === 'id');
  const nearest = idRun.observations.find((o) => o.kind === 'full_case' && o.components.volume === '555');
  ok(idOcc.resolution.state === 'resolved' && idOcc.resolution.antecedent_occurrence_id === nearest.occurrence_id,
    'id. binds to the nearest preceding case citation');

  const ambiguousText = 'Foo 100 XXR 200. Foo 555 XXR 777. Later Foo, supra governs.';
  const ambiguousRun = Citations.runCitationModule([ambiguousText], { packs: [xxPack] });
  const ambiguousSupra = ambiguousRun.observations.find((o) => o.kind === 'supra');
  ok(ambiguousSupra.resolution.state === 'ambiguous' && ambiguousSupra.resolution.candidates === 2,
    'a supra name guess shared by two cases is ambiguous, never fuzzy-picked');

  const distinctText = 'Foo 100 XXR 200. Bar 555 XXR 777. Later Bar, supra governs.';
  const distinctRun = Citations.runCitationModule([distinctText], { packs: [xxPack] });
  const distinctSupra = distinctRun.observations.find((o) => o.kind === 'supra');
  const barCase = distinctRun.observations.find((o) => o.kind === 'full_case' && o.components.caption === 'Bar');
  ok(distinctSupra.resolution.state === 'resolved' && distinctSupra.resolution.antecedent_occurrence_id === barCase.occurrence_id,
    'a supra with one matching caption resolves to that antecedent');
  ok(ambiguousRun.observations.every((o) => o.resolution === null || ['resolved', 'ambiguous', 'unresolved'].includes(o.resolution.state)),
    'resolution states are explicit');
}

{
  const lonely = Citations.runCitationModule(['Id. stands alone. Foo, supra too.'], { packs: [xxPack] });
  const idOcc = lonely.observations.find((o) => o.kind === 'id');
  const supraOcc = lonely.observations.find((o) => o.kind === 'supra');
  ok(idOcc.resolution.state === 'unresolved' && supraOcc.resolution.state === 'unresolved',
    'short forms without an antecedent are unresolved, never guessed');
}

// --- envelope contract -----------------------------------------------------------------

{
  const envelope = Citations.runCitationModule(['100 XXR 200.', ''], { packs: [xxPack], referenceTime: null });
  ok(Contracts.validateModuleEnvelope(envelope).valid, 'the citations envelope passes the Phase 0 contract validator');
  ok(envelope.status === 'completed' && envelope.findings.length === 0,
    'the module completes with observations and no findings');
  ok(envelope.coverage.units_total === 2 && envelope.coverage.units_processed === 2,
    'every page is accounted for, including the empty one');
  ok(Object.isFrozen(envelope) && Object.isFrozen(envelope.observations),
    'the envelope is frozen');
  const again = Citations.runCitationModule(['100 XXR 200.', ''], { packs: [xxPack], referenceTime: null });
  ok(Contracts.stableStringify(envelope) === Contracts.stableStringify(again),
    'two runs over identical input produce byte-identical canonical envelopes');
  ok(envelope.observations[0].occurrence_id.startsWith('vo1|'),
    'occurrence ids are deterministic vo1 digests');
  throws(() => Citations.runCitationModule(['x'], { packs: [] }));
  ok(true, 'running without explicit packs fails closed');
}

// --- engine integration --------------------------------------------------------------

{
  const Engine = require(path.join(root, 'forensic-engine-page.js'));
  const zaPack = require(path.join(root, 'legal-packs/za.js'));
  const previous = globalThis.extractPdfText;
  globalThis.extractPdfText = async () => ['The court in 2026 (3) SA 112 (SCA) applied CCT 19/20.'];
  const doc = { getPages() { throw new Error('synthetic raw-text fallback'); } };
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
  const off = await Engine.runForensicEngine(bytes, doc, null, {});
  ok(!('moduleResults' in off), 'flag off: no moduleResults in the engine result');
  const on = await Engine.runForensicEngine(bytes, doc, null, { modules: { citations: true }, jurisdictionPacks: ['za'] });
  const envelope = on.moduleResults && on.moduleResults.citations;
  ok(Boolean(envelope) && envelope.module_id === 'legal-citations' && envelope.status === 'completed',
    'flag on: the citations envelope is recorded');
  ok(envelope.observations.length === 2 && envelope.observations[0].kind === 'reported_case' && envelope.observations[1].kind === 'docket',
    'engine-page text produces ZA occurrences in document order');
  ok(Contracts.stableStringify(off.findings) === Contracts.stableStringify(on.findings) &&
     off.totalFindings === on.totalFindings,
    'enabling citations changes no finding or count');
  ok(envelope.configuration.jurisdiction_packs.join(',') === 'za',
    'the selected packs are copied into the envelope configuration');
  const onAgain = await Engine.runForensicEngine(bytes, doc, null, { modules: { citations: true }, jurisdictionPacks: ['za'] });
  ok(Contracts.stableStringify(on.moduleResults) === Contracts.stableStringify(onAgain.moduleResults),
    'the engine-level module output replays byte-identically');
  // Unknown pack code: disclosed failure envelope, detection continues.
  const badPack = await Engine.runForensicEngine(bytes, doc, null, { modules: { citations: true }, jurisdictionPacks: ['zz'] });
  ok(badPack.moduleResults.citations.status === 'failed' &&
     badPack.moduleResults.citations.failure.code === 'citation_module_error',
    'an unregistered pack yields a disclosed module failure, not a crash');
  ok(badPack.findings.length === off.findings.length, 'a module failure never stops or changes detection');
  if (typeof previous === 'undefined') delete globalThis.extractPdfText;
  else globalThis.extractPdfText = previous;
  ok(zaPack.id === 'za', 'the ZA pack module loads for the engine path');
}

// --- static guards over the new production sources --------------------------------------

for (const file of ['legal-citations.js', 'legal-packs.js', 'legal-packs/za.js']) {
  const source = readFileSync(path.join(root, file), 'utf8');
  ok(!source.includes('(?<=') && !source.includes('(?<!'), file + ' contains no regex lookbehind');
  ok(!/Date\.now\s*\(|Math\.random\s*\(|localeCompare\s*\(|new\s+Date\s*\(\s*\)/.test(source),
    file + ' contains no wall clock, randomness, locale collation or empty Date constructor');
}

done('legal-citations');
