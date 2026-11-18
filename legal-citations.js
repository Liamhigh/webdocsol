/*
 * Verum Omnis neutral legal-citation occurrence core (B7, legal mapping).
 *
 * Owns source spans, occurrence identity, short-form (id./supra) resolution
 * and the module envelope. A jurisdiction pack owns grammar and identifiers;
 * no jurisdiction is inferred from IP, device region or locale — packs are
 * explicit. Every occurrence keeps its own exact anchor (page + UTF-16
 * offsets + verbatim raw text); parallel grouping is added only when a pack
 * supplies pack-specific evidence that two spans name the same authority.
 * Extraction alone is an observation, never a contradiction: findings stays
 * empty here. Deterministic: no clock, no randomness, no locale collation, no
 * regex lookbehind. Classic script; CommonJS export for Node tests.
 */
(function (root) {
  'use strict';

  var Contracts = (root && root.VOAnalysisContracts)
    ? root.VOAnalysisContracts
    : (typeof require === 'function' ? require('./analysis-contracts.js') : null);
  if (!Contracts) throw new Error('legal-citations.js requires analysis-contracts.js to load first');

  var MODULE_ID = 'legal-citations';
  var MODULE_VERSION = '1.0.0';

  var KINDS = Object.freeze([
    'full_case', 'short_case', 'id', 'supra', 'neutral_case', 'reported_case',
    'docket', 'statute', 'regulation', 'constitutional_provision', 'source_url'
  ]);
  var CASE_KINDS = Object.freeze(['full_case', 'short_case', 'neutral_case', 'reported_case']);

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function normalizeExtraction(extraction) {
    if (typeof extraction === 'undefined' || extraction === null) return { kind: 'pdf_text' };
    if (!isPlainRecord(extraction) || Contracts.EXTRACTION_KINDS.indexOf(extraction.kind) === -1) {
      throw new TypeError('page extraction.kind must be one of ' + Contracts.EXTRACTION_KINDS.join(', '));
    }
    return { kind: extraction.kind };
  }

  /* Pages: an array of page texts, or of { text, extraction } records. Page
   * numbers are 1-based positions; OCR pages keep their provenance. */
  function normalizePages(pages) {
    if (!Array.isArray(pages)) throw new TypeError('pages must be an array');
    return pages.map(function (page, index) {
      if (typeof page === 'string') {
        return { page: index + 1, text: page, extraction: { kind: 'pdf_text' } };
      }
      if (!isPlainRecord(page) || typeof page.text !== 'string') {
        throw new TypeError('each page must be a string or a { text, extraction } record');
      }
      return { page: index + 1, text: page.text, extraction: normalizeExtraction(page.extraction) };
    });
  }

  function validatePack(pack) {
    if (root && root.VOLegalPacks) return root.VOLegalPacks.validatePack(pack);
    if (!isPlainRecord(pack) || typeof pack.id !== 'string' || typeof pack.version !== 'string' || !Array.isArray(pack.rules)) {
      throw new TypeError('a jurisdiction pack needs id, version and rules');
    }
    pack.rules.forEach(function (rule) {
      if (KINDS.indexOf(rule.kind) === -1) throw new TypeError(pack.id + '/' + rule.rule_id + ': unsupported citation kind');
      if (!(rule.pattern instanceof RegExp) || !rule.pattern.global || rule.pattern.sticky) {
        throw new TypeError(pack.id + '/' + rule.rule_id + ': non-sticky global RegExp required');
      }
      if (rule.pattern.source.indexOf('(?<' + '=') !== -1 || rule.pattern.source.indexOf('(?<' + '!') !== -1) {
        throw new TypeError(pack.id + '/' + rule.rule_id + ': regex lookbehind is not supported');
      }
    });
    return pack;
  }

  var CAPTION_LEAD_INS = Object.freeze(['In', 'The', 'See', 'Between', 'Re', 'Ex', 'Parte', 'Matter', 'Of', 'And', 'As', 'Held', 'Per', 'in', 'see', 'held']);
  var CAPTION_WINDOW = 160;
  var CAPTION_WORD = "[A-Za-z0-9'&.,()’-]";
  var CAPTION_RE = new RegExp('([A-Z]' + CAPTION_WORD + '*(?:\\s+' + CAPTION_WORD + '+){0,8}\\s+v\\.?\\s+[A-Z]' + CAPTION_WORD + '*(?:\\s+' + CAPTION_WORD + '+){0,8})\\s*[,;]?\\s*$');

  /* Best-effort case-name boundary immediately before a citation span. A
   * descriptive component only — it never extends the citation's own span. */
  function captureCaption(text, start) {
    var windowText = text.slice(Math.max(0, start - CAPTION_WINDOW), start);
    var match = CAPTION_RE.exec(windowText);
    if (!match) return null;
    var tokens = match[1].split(/\s+/);
    while (tokens.length > 1 && CAPTION_LEAD_INS.indexOf(tokens[0]) !== -1) tokens.shift();
    return tokens.join(' ').replace(/[.,;\s]+$/, '') || null;
  }

  function normalizeName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function extractOccurrences(pages, packs) {
    var occurrences = [];
    for (var pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      var page = pages[pageIndex];
      for (var packIndex = 0; packIndex < packs.length; packIndex++) {
        var pack = packs[packIndex];
        for (var ruleIndex = 0; ruleIndex < pack.rules.length; ruleIndex++) {
          var rule = pack.rules[ruleIndex];
          rule.pattern.lastIndex = 0;
          var match;
          while ((match = rule.pattern.exec(page.text)) !== null) {
            if (!match[0].length) throw new Error(pack.id + '/' + rule.rule_id + ' matched empty text; the pattern would loop');
            var start = match.index;
            var end = start + match[0].length;
            var raw = page.text.slice(start, end);
            if (raw !== match[0]) throw new Error(pack.id + '/' + rule.rule_id + ' produced a span that does not slice its raw text');
            var context = {
              page: page.page,
              text: page.text,
              extraction: page.extraction,
              captureCaption: captureCaption
            };
            var components = rule.extract ? rule.extract(match, context) : {};
            if (!isPlainRecord(components)) throw new TypeError(pack.id + '/' + rule.rule_id + ' extract must return a plain object');
            Contracts.stableStringify(components); // canonical-JSON-safe components only
            occurrences.push({
              occurrence_id: '',
              pack_id: pack.id,
              pack_version: pack.version,
              rule_id: rule.rule_id,
              kind: rule.kind,
              raw: raw,
              span: { page: page.page, start: start, end: end },
              extraction: { kind: page.extraction.kind },
              components: components,
              resolution: null
            });
          }
        }
      }
    }
    occurrences.sort(function (a, b) {
      return (a.span.page - b.span.page) || (a.span.start - b.span.start) || (a.span.end - b.span.end) ||
        (a.pack_id < b.pack_id ? -1 : a.pack_id > b.pack_id ? 1 : 0) ||
        (a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0);
    });
    return occurrences;
  }

  function packImplementation(pack) {
    return {
      id: pack.id,
      version: pack.version,
      rules: pack.rules.map(function (rule) {
        return {
          rule_id: rule.rule_id,
          kind: rule.kind,
          pattern: rule.pattern.source,
          flags: rule.pattern.flags,
          extract: typeof rule.extract === 'function' ? String(rule.extract) : null
        };
      })
    };
  }

  function uniquePacks(packs) {
    var byId = Object.create(null);
    var unique = [];
    for (var index = 0; index < packs.length; index++) {
      var pack = validatePack(packs[index]);
      var prior = byId[pack.id];
      if (prior) {
        if (Contracts.stableStringify(packImplementation(prior)) !== Contracts.stableStringify(packImplementation(pack))) {
          throw new TypeError('Conflicting versions or implementations for jurisdiction pack ' + pack.id);
        }
        continue;
      }
      byId[pack.id] = pack;
      unique.push(pack);
    }
    return unique;
  }

  function assignOccurrenceIds(occurrences, inputSha512) {
    for (var index = 0; index < occurrences.length; index++) {
      var occurrence = occurrences[index];
      occurrence.occurrence_id = Contracts.deterministicId(
        MODULE_ID,
        inputSha512,
        occurrence.pack_id + '@' + occurrence.pack_version + '/' + occurrence.rule_id,
        [{
        page: occurrence.span.page,
        char_start: occurrence.span.start,
        char_end: occurrence.span.end,
        quote: occurrence.raw
        }]
      );
    }
  }

  /* id./supra resolution by document order. Never a fuzzy score: id. binds to
   * the nearest preceding case citation; supra binds to the nearest preceding
   * case citation whose caption matches its name guess. More than one
   * remaining antecedent is ambiguous; none is unresolved. */
  function resolveShortForms(occurrences) {
    for (var index = 0; index < occurrences.length; index++) {
      var occurrence = occurrences[index];
      if (occurrence.kind === 'id') {
        var antecedent = null;
        for (var back = index - 1; back >= 0; back--) {
          if (CASE_KINDS.indexOf(occurrences[back].kind) !== -1) { antecedent = occurrences[back]; break; }
        }
        occurrence.resolution = antecedent
          ? { state: 'resolved', antecedent_occurrence_id: antecedent.occurrence_id, candidates: 1 }
          : { state: 'unresolved', antecedent_occurrence_id: null, candidates: 0 };
      } else if (occurrence.kind === 'supra') {
        var guess = normalizeName(occurrence.components && occurrence.components.name_guess);
        var candidates = [];
        if (guess) {
          for (var back2 = index - 1; back2 >= 0; back2--) {
            var candidate = occurrences[back2];
            if (CASE_KINDS.indexOf(candidate.kind) === -1) continue;
            var caption = normalizeName(candidate.components && candidate.components.caption);
            if (caption && caption.indexOf(guess) !== -1) candidates.push(candidate.occurrence_id);
          }
        }
        if (candidates.length === 1) {
          occurrence.resolution = { state: 'resolved', antecedent_occurrence_id: candidates[0], candidates: 1 };
        } else if (candidates.length > 1) {
          occurrence.resolution = { state: 'ambiguous', antecedent_occurrence_id: null, candidates: candidates.length };
        } else {
          occurrence.resolution = { state: 'unresolved', antecedent_occurrence_id: null, candidates: 0 };
        }
      }
    }
  }

  function implementationDigest(packs) {
    return Contracts.sha512Hex(Contracts.stableStringify({
      module: MODULE_ID,
      version: MODULE_VERSION,
      packs: packs.map(packImplementation)
    }));
  }

  /* The module envelope. Runs over the final page texts; every page is a
   * processed unit. findings is always empty: extraction is an observation. */
  function runCitationModule(pages, opts) {
    opts = opts || {};
    var selectedPacks = opts.packs;
    if (!Array.isArray(selectedPacks) || !selectedPacks.length) throw new TypeError('runCitationModule needs explicit jurisdiction pack objects');
    var packs = uniquePacks(selectedPacks);
    var normalized = normalizePages(pages);
    var inputSha512 = Contracts.sha512Hex(Contracts.stableStringify(normalized));
    var occurrences = extractOccurrences(normalized, packs);
    assignOccurrenceIds(occurrences, inputSha512);
    resolveShortForms(occurrences);
    return Contracts.createModuleEnvelope({
      module_id: MODULE_ID,
      module_version: MODULE_VERSION,
      implementation_digest: implementationDigest(packs),
      status: 'completed',
      input_sha512: inputSha512,
      reference_time: opts.referenceTime || null,
      configuration: { jurisdiction_packs: packs.map(function (pack) { return pack.id; }) },
      dependencies: [],
      coverage: {
        units_total: normalized.length,
        units_processed: normalized.length,
        units_skipped: [],
        units_failed: []
      },
      observations: occurrences,
      findings: [],
      warnings: [],
      failure: null
    });
  }

  var api = {
    MODULE_ID: MODULE_ID,
    MODULE_VERSION: MODULE_VERSION,
    KINDS: KINDS,
    CASE_KINDS: CASE_KINDS,
    normalizePages: normalizePages,
    validatePack: validatePack,
    captureCaption: captureCaption,
    extractOccurrences: extractOccurrences,
    resolveShortForms: resolveShortForms,
    runCitationModule: runCitationModule
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VOLegalCitations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
