// tests/legal-citations.test.mjs — neutral citation occurrence core, pack
// registry, resolution, envelope and engine integration (Phase 2 PR 2.2).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ok, noThrow, throws, done } = require('./_assert.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Contracts = require(path.join(root, 'analysis-contracts.js'));
const Config = require(path.join(root, 'analysis-config.js'));
const Packs = require(path.join(root, 'legal-packs.js'));
const Citations = require(path.join(root, 'legal-citations.js'));

ok(Packs.SUPPORTED_KINDS.join(',') === Citations.KINDS.join(','),
  'the pack registry and citation core share one supported-kind contract');

// --- pack registry --------------------------------------------------------------

function syntheticRule(ruleId, kind, pattern, extract) {
  return { rule_id: ruleId, kind, pattern, extract };
}
const xxPack = {
  id: 'xx',
  version: '1.0.0',
  rules: [
    syntheticRule('xx-full-case', 'full_case', /\b(\d{3}) (XXR) (\d+)\b/g,
      (m, context) => ({ volume: m[1], reporter: m[2], page: m[3], caption: context.captureCaption(context.text, m.index) })),
    syntheticRule('xx-id', 'id', /\bId\./g, () => ({})),
    syntheticRule('xx-supra', 'supra', /\b([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,7}), supra\b/g, (m) => ({ name_guess: m[1] })),
    syntheticRule('xx-docket', 'docket', /\bCCT\s?\d{1,3}\s?\/\s?\d{2,4}\b/g, () => ({}))
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
throws(() => Packs.register({ id: 'yy', version: '1', rules: [syntheticRule('yy-sticky', 'id', /x/gy)] }));
ok(true, 'a sticky pattern is rejected at registration');
throws(() => Packs.register({ id: 'yy', version: '1', rules: [syntheticRule('yy-kind', 'unsupported', /x/g)] }));
ok(true, 'an unsupported citation kind is rejected at registration');
throws(() => Packs.validatePack({
  id: 'yy', version: '1',
  rules: [syntheticRule('constructor', 'id', /x/g), syntheticRule('constructor', 'id', /y/g)]
}));
ok(true, 'duplicate rule id constructor is rejected without a prototype collision');
ok(noThrow(() => Packs.validatePack({
  id: 'yy', version: '1', helpers: [() => null],
  rules: [syntheticRule('yy-helper', 'id', /x/g)]
})), 'an optional helper array of functions is accepted');
throws(() => Packs.validatePack({
  id: 'yy', version: '1', helpers: {},
  rules: [syntheticRule('yy-helper', 'id', /x/g)]
}));
throws(() => Packs.validatePack({
  id: 'yy', version: '1', helpers: [null],
  rules: [syntheticRule('yy-helper', 'id', /x/g)]
}));
ok(true, 'non-array and non-function pack helpers are rejected');
ok(noThrow(() => Packs.validatePack({
  id: 'yy', version: '1',
  rules: [syntheticRule('yy-named', 'id', /(?<number>\d+)/g)]
})), 'a named-capture group is accepted as distinct from lookbehind');
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
  const idText = 'Foo v Alpha, 100 XXR 200. Bar v Beta, 555 XXR 777. Id. applies.';
  const idRun = Citations.runCitationModule([idText], { packs: [xxPack], referenceTime: '2026-11-15T00:00:00Z' });
  const idOcc = idRun.observations.find((o) => o.kind === 'id');
  const nearest = idRun.observations.find((o) => o.kind === 'full_case' && o.components.volume === '555');
  ok(idOcc.resolution.state === 'resolved' && idOcc.resolution.antecedent_occurrence_id === nearest.occurrence_id,
    'id. binds to the nearest preceding case citation');

  const ambiguousText = 'Foo v One, 100 XXR 200. Foo v Two, 555 XXR 777. Foo, supra governs.';
  const ambiguousRun = Citations.runCitationModule([ambiguousText], { packs: [xxPack] });
  const ambiguousSupra = ambiguousRun.observations.find((o) => o.kind === 'supra');
  ok(ambiguousSupra.resolution.state === 'ambiguous' && ambiguousSupra.resolution.candidates === 2,
    'a supra name guess shared by two cases is ambiguous, never fuzzy-picked');

  const distinctText = ['Foo v Alpha, 100 XXR 200.', 'Bar v Beta, 555 XXR 777. Bar, supra governs.'];
  const distinctRun = Citations.runCitationModule(distinctText, { packs: [xxPack] });
  const distinctSupra = distinctRun.observations.find((o) => o.kind === 'supra');
  const barCase = distinctRun.observations.find((o) => o.kind === 'full_case' && o.components.volume === '555');
  ok(distinctSupra.resolution.state === 'resolved' && distinctSupra.resolution.antecedent_occurrence_id === barCase.occurrence_id,
    'a supra with one matching caption resolves to that antecedent');
  ok(ambiguousRun.observations.every((o) => o.resolution === null || ['resolved', 'ambiguous', 'unresolved'].includes(o.resolution.state)),
    'resolution states are explicit');

  const multiword = Citations.runCitationModule([
    'North Shore Holdings v Coastal Group, 100 XXR 200. North Shore Holdings, supra applies.'
  ], { packs: [xxPack] });
  const multiwordSupra = multiword.observations.find((o) => o.kind === 'supra');
  const multiwordCase = multiword.observations.find((o) => o.kind === 'full_case');
  ok(multiwordSupra.resolution.state === 'resolved' &&
     multiwordSupra.resolution.antecedent_occurrence_id === multiwordCase.occurrence_id,
    'a supra resolves by exact normalized multiword first-party caption');

  const interveningDocket = Citations.runCitationModule([
    'Foo v Bar, 100 XXR 200. CCT 12/24. Id. follows.'
  ], { packs: [xxPack] });
  ok(interveningDocket.observations.find((o) => o.kind === 'id').resolution.state === 'unresolved',
    'id. does not skip an intervening docket to bind an older case');
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
  const emptySelection = Citations.runCitationModule(['100 XXR 200.', ''], { packs: [] });
  ok(emptySelection.status === 'completed' && emptySelection.observations.length === 0 &&
     emptySelection.coverage.units_total === 2 && emptySelection.coverage.units_processed === 2 &&
     Contracts.validateModuleEnvelope(emptySelection).valid,
    'an explicit empty pack selection completes with valid zero-observation coverage');
  throws(() => Citations.runCitationModule(['x'], {}));
  throws(() => Citations.runCitationModule(['x'], { packs: null }));
  ok(true, 'missing or non-array pack selection fails closed');
  const repeatedPack = Citations.runCitationModule(['100 XXR 200.'], { packs: [xxPack, xxPack] });
  const singlePack = Citations.runCitationModule(['100 XXR 200.'], { packs: [xxPack] });
  ok(repeatedPack.observations.length === 1 &&
     repeatedPack.observations[0].occurrence_id === singlePack.observations[0].occurrence_id,
    'repeating the same selected pack does not duplicate its occurrences or IDs');
  throws(() => Citations.runCitationModule(['100 XXR 200.'], { packs: [xxPack, { ...xxPack }] }));
  ok(true, 'a distinct object with an identical same-id implementation is rejected');
  const secondPack = {
    id: 'xy',
    version: '1.0.0',
    rules: [syntheticRule('xx-full-case', 'full_case', /\b(\d{3}) (XXR) (\d+)\b/g)]
  };
  const distinctPackRun = Citations.runCitationModule(['100 XXR 200.'], { packs: [xxPack, secondPack] });
  ok(distinctPackRun.observations.length === 2 &&
     distinctPackRun.observations[0].occurrence_id !== distinctPackRun.observations[1].occurrence_id,
    'pack identity keeps same-rule, same-span observations addressable');
  const changedPatternPack = {
    id: 'xx',
    version: '1.0.0',
    rules: xxPack.rules.map((rule) => ({
      ...rule,
      pattern: new RegExp(rule.pattern.source + '|999 XXR 888', rule.pattern.flags)
    }))
  };
  const changedImplementation = Citations.runCitationModule(['100 XXR 200.'], { packs: [changedPatternPack] });
  ok(changedImplementation.implementation_digest !== singlePack.implementation_digest,
    'the implementation digest changes when a rule pattern changes');
  const changedExtractorPack = {
    id: 'xx',
    version: '1.0.0',
    rules: xxPack.rules.map((rule, index) => index === 0 ? { ...rule, extract: () => ({}) } : rule)
  };
  const changedExtractor = Citations.runCitationModule(['100 XXR 200.'], { packs: [changedExtractorPack] });
  ok(changedExtractor.implementation_digest !== singlePack.implementation_digest,
    'the implementation digest changes when an extraction function changes');
  const changedHelperPack = {
    ...xxPack,
    helpers: [function optionalHelper() { return null; }]
  };
  ok(Citations.implementationDigest([changedHelperPack]) !== Citations.implementationDigest([xxPack]),
    'the implementation digest includes declared pack helper source');
  const anotherHelperPack = {
    ...xxPack,
    helpers: [function optionalHelper() { return true; }]
  };
  ok(Citations.implementationDigest([changedHelperPack]) !== Citations.implementationDigest([anotherHelperPack]),
    'different declared helper implementations produce different digests');
  const repeatedCitations = Citations.runCitationModule(['100 XXR 200. 100 XXR 200.'], { packs: [xxPack] });
  const repeatedCitationsAgain = Citations.runCitationModule(['100 XXR 200. 100 XXR 200.'], { packs: [xxPack] });
  ok(repeatedCitations.observations[0].occurrence_id !== repeatedCitations.observations[1].occurrence_id &&
     repeatedCitations.observations.map((o) => o.occurrence_id).join(',') ===
       repeatedCitationsAgain.observations.map((o) => o.occurrence_id).join(','),
    'same-pack occurrences at distinct spans have distinct stable IDs');
}

// --- engine integration --------------------------------------------------------------

{
  const Engine = require(path.join(root, 'forensic-engine-page.js'));
  const zaPack = require(path.join(root, 'legal-packs/za.js'));
  const previous = globalThis.extractPdfText;
  const previousOcr = globalThis.voOcrRescuePages;
  const previousPdfLib = globalThis.PDFLib;
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
  ok(envelope.observations.every((o) => o.extraction.kind === 'pdf_text'),
    'whole-document raw-text fallback is not mislabeled as OCR');
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
  globalThis.PDFLib = {
    PDFName: { of: () => ({}) },
    PDFArray: function PDFArray() {},
    PDFRawStream: function PDFRawStream() {}
  };
  globalThis.voOcrRescuePages = async (_bytes, blocks) => ({
    textBlocks: blocks.map((text, index) => index === 1 ? '[OCR] [2026] ZACC 1 was cited in the judgment.' : text),
    ocrPages: [2],
    note: 'synthetic OCR provenance'
  });
  const twoPageDoc = {
    getPages() {
      return [
        { node: { get: () => null } },
        { node: { get: () => null } }
      ];
    },
    context: { lookup: () => null }
  };
  const ocrRun = await Engine.runForensicEngine(bytes, twoPageDoc, null, {
    modules: { citations: true }, jurisdictionPacks: ['za']
  });
  ok(ocrRun.moduleResults.citations.observations.length === 1 &&
     ocrRun.moduleResults.citations.observations[0].extraction.kind === 'ocr',
    'OCR-rescued citation text carries its actual extraction provenance');
  class FakePDFRawStream {
    constructor(content) { this.content = content; }
  }
  globalThis.PDFLib.PDFName.of = (name) => name;
  globalThis.PDFLib.PDFRawStream = FakePDFRawStream;
  globalThis.PDFLib.decodePDFRawStream = (stream) => ({
    decode: () => new TextEncoder().encode(stream.content)
  });
  globalThis.voOcrRescuePages = async (_bytes, blocks) => ({
    textBlocks: blocks,
    ocrPages: [],
    noTextPages: [1],
    note: 'synthetic OCR with no recovered text'
  });
  const nativeTextDoc = {
    getPages() {
      return [
        { node: { get: (name) => name === 'Contents' ? new FakePDFRawStream('(CCT 19/20) Tj') : null } },
        { node: { get: (name) => name === 'Contents' ? new FakePDFRawStream('(A sufficiently long native text page for a deterministic OCR rescue test.) Tj') : null } }
      ];
    },
    context: { lookup: (value) => value }
  };
  const noTextRun = await Engine.runForensicEngine(bytes, nativeTextDoc, null, {
    modules: { citations: true }, jurisdictionPacks: ['za']
  });
  const nativeDocket = noTextRun.moduleResults.citations.observations.find((o) => o.kind === 'docket');
  ok(nativeDocket && nativeDocket.span.page === 1 && nativeDocket.extraction.kind === 'pdf_text',
    'a native citation on a page where OCR recovered no text retains pdf_text provenance');
  if (typeof previous === 'undefined') delete globalThis.extractPdfText;
  else globalThis.extractPdfText = previous;
  if (typeof previousOcr === 'undefined') delete globalThis.voOcrRescuePages;
  else globalThis.voOcrRescuePages = previousOcr;
  if (typeof previousPdfLib === 'undefined') delete globalThis.PDFLib;
  else globalThis.PDFLib = previousPdfLib;
  ok(zaPack.id === 'za', 'the ZA pack module loads for the engine path');
}

// --- engine dependency failures -----------------------------------------------------

{
  const Engine = require(path.join(root, 'forensic-engine-page.js'));
  const Module = require('node:module');
  const originalLoad = Module._load;
  const savedGlobals = {
    contracts: globalThis.VOAnalysisContracts,
    packs: globalThis.VOLegalPacks,
    citations: globalThis.VOLegalCitations,
    pdfLib: globalThis.PDFLib
  };
  class TestPDFRawStream {
    constructor(content) { this.content = content; }
  }
  globalThis.PDFLib = {
    PDFName: { of: (name) => name },
    PDFArray: function PDFArray() {},
    PDFRawStream: TestPDFRawStream,
    decodePDFRawStream: (stream) => ({ decode: () => new TextEncoder().encode(stream.content) })
  };
  const failurePages = [
    'Page one synthetic citation module text has enough words for a stable failure hash.',
    'Page two synthetic citation module text has enough words for a stable failure hash.'
  ];
  const doc = {
    getPages() {
      return failurePages.map((text) => ({
        node: { get: (name) => name === 'Contents' ? new TestPDFRawStream('(' + text + ') Tj') : null }
      }));
    },
    context: { lookup: (value) => value }
  };
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
  try {
    for (const failedRequest of ['./legal-citations.js', './analysis-contracts.js']) {
      delete globalThis.VOAnalysisContracts;
      delete globalThis.VOLegalPacks;
      delete globalThis.VOLegalCitations;
      Module._load = function (request, parent, isMain) {
        if (request === failedRequest) throw new Error('synthetic load failure for ' + request);
        return originalLoad.call(this, request, parent, isMain);
      };
      const result = await Engine.runForensicEngine(bytes, doc, null, {
        modules: { citations: true }, jurisdictionPacks: ['za']
      });
      const failure = result.moduleResults && result.moduleResults.citations;
      ok(failure && failure.status === 'failed' && failure.failure.code === 'citation_module_error',
        failedRequest + ' load failure is disclosed without aborting the scan');
      ok(/^[0-9a-f]{128}$/.test(failure.input_sha512) && failure.input_sha512 !== '0'.repeat(128),
        failedRequest + ' failure envelope identifies the analyzed page text');
      ok(failure.input_sha512 === Contracts.sha512Hex(Contracts.stableStringify(Citations.normalizePages(failurePages))),
        failedRequest + ' failure digest hashes the exact normalized per-page text');
      ok(failure.coverage.units_total === 2 && failure.coverage.units_failed.join(',') === '1,2',
        failedRequest + ' failure coverage enumerates every 1-based page before dependency loading');
      ok(Contracts.validateModuleEnvelope(failure).valid,
        failedRequest + ' failure result still satisfies the module-envelope contract');
      ok(Object.isFrozen(failure) && Object.isFrozen(failure.coverage.units_failed),
        failedRequest + ' fallback failure envelope remains immutable without the contract dependency');
    }
  } finally {
    Module._load = originalLoad;
    if (typeof savedGlobals.contracts === 'undefined') delete globalThis.VOAnalysisContracts;
    else globalThis.VOAnalysisContracts = savedGlobals.contracts;
    if (typeof savedGlobals.packs === 'undefined') delete globalThis.VOLegalPacks;
    else globalThis.VOLegalPacks = savedGlobals.packs;
    if (typeof savedGlobals.citations === 'undefined') delete globalThis.VOLegalCitations;
    else globalThis.VOLegalCitations = savedGlobals.citations;
    if (typeof savedGlobals.pdfLib === 'undefined') delete globalThis.PDFLib;
    else globalThis.PDFLib = savedGlobals.pdfLib;
  }
}

{
  const engineSource = readFileSync(path.join(root, 'forensic-engine-page.js'), 'utf8');
  const functionSource = engineSource.match(/async function voCitationInputSha512\(pages\) \{[\s\S]*?\n\}/);
  ok(Boolean(functionSource), 'the engine exposes its page-input digest helper for the browser fallback check');
  let receivedSerialization = null;
  const serialized = JSON.stringify([{
    extraction: { kind: 'pdf_text' },
    page: 1,
    text: 'Browser-context citation hash fallback.'
  }]);
  const browserContext = {
    TextEncoder,
    crypto: undefined,
    require: undefined,
    VOAnalysisContracts: {
      sha512Hex(value) {
        receivedSerialization = value;
        return Contracts.sha512Hex(value);
      }
    }
  };
  const hash = await vm.runInNewContext(
    functionSource[0] + '\nvoCitationInputSha512([{ text: "Browser-context citation hash fallback.", extraction: { kind: "pdf_text" } }])',
    browserContext
  );
  ok(hash === Contracts.sha512Hex(serialized) && receivedSerialization === serialized,
    'without Web Crypto or CommonJS, the browser fallback hashes the exact serialized normalized pages');
}

// --- static guards over the new production sources --------------------------------------

for (const file of ['legal-citations.js', 'legal-packs.js', 'legal-packs/za.js']) {
  const source = readFileSync(path.join(root, file), 'utf8');
  ok(!source.includes('(?<=') && !source.includes('(?<!'), file + ' contains no regex lookbehind');
  ok(!/Date\.now\s*\(|Math\.random\s*\(|localeCompare\s*\(|new\s+Date\s*\(\s*\)/.test(source),
    file + ' contains no wall clock, randomness, locale collation or empty Date constructor');
}

done('legal-citations');
