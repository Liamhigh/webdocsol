/*
 * Verum Omnis deterministic analysis contracts.
 *
 * Canonical records contain caller-supplied times and stable identifiers only.
 * This file deliberately has no clock, randomness, network, locale collation,
 * telemetry, or browser-only dependency. page-text-v1 offsets are UTF-16 code
 * units (JavaScript string offsets), not Unicode code points or UTF-8 bytes.
 */
(function (root) {
  'use strict';

  var MODULE_STATUSES = Object.freeze([
    'completed',
    'completed_with_failures',
    'not_applicable',
    'unsupported',
    'failed',
    'budget_exceeded'
  ]);
  var EXTRACTION_KINDS = Object.freeze([
    'pdf_text', 'ocr', 'native_vision', 'native_mlkit', 'manual_transcription'
  ]);
  var SHA512_RE = /^[0-9a-f]{128}$/;
  var ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isPlainRecord(value) {
    if (!isRecord(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isNonNegativeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  }

  function compareStrings(a, b) {
    a = String(a);
    b = String(b);
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  /* JSON.stringify-compatible canonical JSON with recursively sorted keys. */
  function stableStringify(value) {
    var seen = [];
    function visit(item, inArray) {
      if (item === null || typeof item === 'string' || typeof item === 'boolean') {
        return JSON.stringify(item);
      }
      if (typeof item === 'number') {
        if (!Number.isFinite(item)) throw new TypeError('Canonical JSON requires finite numbers');
        return JSON.stringify(item);
      }
      if (typeof item === 'undefined' || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
        throw new TypeError('Canonical JSON contains a non-JSON value' + (inArray ? ' in an array' : ''));
      }
      if (seen.indexOf(item) !== -1) throw new TypeError('Canonical JSON cannot contain cycles');
      seen.push(item);
      var out;
      if (Array.isArray(item)) {
        var elements = [];
        for (var i = 0; i < item.length; i++) elements.push(visit(item[i], true));
        out = '[' + elements.join(',') + ']';
      } else if (isPlainRecord(item)) {
        var keys = Object.keys(item).sort(compareStrings);
        var properties = [];
        for (var k = 0; k < keys.length; k++) {
          properties.push(JSON.stringify(keys[k]) + ':' + visit(item[keys[k]], false));
        }
        out = '{' + properties.join(',') + '}';
      } else {
        throw new TypeError('Canonical JSON requires plain objects and arrays');
      }
      seen.pop();
      return out;
    }
    return visit(value, false);
  }

  function canonicalClone(value) {
    return JSON.parse(stableStringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) deepFreeze(value[keys[i]]);
    return Object.freeze(value);
  }

  /* Length-prefixed canonical concatenation avoids delimiter ambiguity. */
  function deterministicId(moduleId, inputSha512, ruleId, anchors) {
    var parts = [moduleId, inputSha512, ruleId, stableStringify(anchors || [])];
    for (var i = 0; i < parts.length; i++) {
      if (typeof parts[i] !== 'string' || !parts[i]) throw new TypeError('Deterministic ID parts must be non-empty strings');
    }
    var encoded = [];
    for (var p = 0; p < parts.length; p++) encoded.push(parts[p].length + ':' + parts[p]);
    return 'vo1|' + encoded.join('|');
  }

  function firstAnchor(finding) {
    return finding && Array.isArray(finding.anchors) && finding.anchors.length ? finding.anchors[0] :
      (finding && finding.anchor ? finding.anchor : {});
  }

  function firstOffset(anchor) {
    if (isNonNegativeInteger(anchor.char_start)) return anchor.char_start;
    if (isNonNegativeInteger(anchor.byte_start)) return anchor.byte_start;
    if (anchor.structure && isNonNegativeInteger(anchor.structure.byte_start)) return anchor.structure.byte_start;
    return null;
  }

  function compareNullableNumbers(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  }

  /* Duplicates are retained; original position breaks only exact key ties. */
  function compareFindings(a, b) {
    var aa = firstAnchor(a), bb = firstAnchor(b);
    var order = compareStrings(aa.artifact_sha512 || '', bb.artifact_sha512 || '');
    if (order) return order;
    order = compareNullableNumbers(
      isNonNegativeInteger(aa.page) ? aa.page : null,
      isNonNegativeInteger(bb.page) ? bb.page : null
    );
    if (order) return order;
    order = compareNullableNumbers(firstOffset(aa), firstOffset(bb));
    if (order) return order;
    order = compareStrings(a && (a.rule_id || a.ruleId) || '', b && (b.rule_id || b.ruleId) || '');
    if (order) return order;
    return compareStrings(a && (a.finding_id || a.id) || '', b && (b.finding_id || b.id) || '');
  }

  function sortFindings(findings) {
    if (!Array.isArray(findings)) throw new TypeError('findings must be an array');
    return findings.map(function (finding, index) {
      return { finding: finding, index: index };
    }).sort(function (a, b) {
      return compareFindings(a.finding, b.finding) || a.index - b.index;
    }).map(function (entry) { return entry.finding; });
  }

  function createFailure(code, message, details) {
    if (typeof code !== 'string' || !code || typeof message !== 'string' || !message) {
      throw new TypeError('A failure requires a stable code and message');
    }
    var failure = { code: code, message: message };
    if (typeof details !== 'undefined') failure.details = canonicalClone(details);
    return deepFreeze(failure);
  }

  function createModuleEnvelope(spec) {
    if (!isRecord(spec)) throw new TypeError('Module envelope specification is required');
    var envelope = {
      module_id: spec.module_id,
      module_version: spec.module_version,
      implementation_digest: spec.implementation_digest,
      status: spec.status,
      input_sha512: spec.input_sha512,
      reference_time: spec.reference_time == null ? null : spec.reference_time,
      configuration: canonicalClone(typeof spec.configuration === 'undefined' ? {} : spec.configuration),
      dependencies: canonicalClone(typeof spec.dependencies === 'undefined' ? [] : spec.dependencies),
      coverage: canonicalClone(typeof spec.coverage === 'undefined' ? {
        units_total: 0, units_processed: 0, units_skipped: [], units_failed: []
      } : spec.coverage),
      observations: canonicalClone(typeof spec.observations === 'undefined' ? [] : spec.observations),
      findings: canonicalClone(typeof spec.findings === 'undefined' ? [] : spec.findings),
      warnings: canonicalClone(typeof spec.warnings === 'undefined' ? [] : spec.warnings),
      failure: spec.failure == null ? null : canonicalClone(spec.failure)
    };
    var validation = validateModuleEnvelope(envelope);
    if (!validation.valid) throw new TypeError('Invalid module envelope: ' + validation.errors.join('; '));
    return deepFreeze(envelope);
  }

  function createFailureEnvelope(spec, failure) {
    var copy = canonicalClone(spec);
    copy.failure = canonicalClone(failure);
    if (!copy.status || copy.status === 'completed') copy.status = 'failed';
    return createModuleEnvelope(copy);
  }

  function validateCoverage(coverage, errors) {
    if (!isRecord(coverage)) { errors.push('coverage must be an object'); return; }
    if (!isNonNegativeInteger(coverage.units_total)) errors.push('coverage.units_total must be a non-negative integer');
    if (!isNonNegativeInteger(coverage.units_processed)) errors.push('coverage.units_processed must be a non-negative integer');
    if (!Array.isArray(coverage.units_skipped)) errors.push('coverage.units_skipped must be an array');
    if (!Array.isArray(coverage.units_failed)) errors.push('coverage.units_failed must be an array');
    if (isNonNegativeInteger(coverage.units_total) && isNonNegativeInteger(coverage.units_processed) && coverage.units_processed > coverage.units_total) {
      errors.push('coverage.units_processed cannot exceed units_total');
    }
  }

  function validateModuleEnvelope(envelope) {
    var errors = [];
    if (!isRecord(envelope)) return { valid: false, errors: ['envelope must be an object'] };
    ['module_id', 'module_version', 'implementation_digest', 'input_sha512'].forEach(function (key) {
      if (typeof envelope[key] !== 'string' || !envelope[key]) errors.push(key + ' must be a non-empty string');
    });
    if (typeof envelope.input_sha512 === 'string' && !SHA512_RE.test(envelope.input_sha512)) {
      errors.push('input_sha512 must be 128 lowercase hexadecimal characters');
    }
    if (MODULE_STATUSES.indexOf(envelope.status) === -1) errors.push('status is not contracted');
    if (envelope.reference_time !== null && (typeof envelope.reference_time !== 'string' || !ISO_INSTANT_RE.test(envelope.reference_time))) {
      errors.push('reference_time must be null or an ISO instant with an offset');
    }
    if (!isRecord(envelope.configuration)) errors.push('configuration must be an object');
    if (!Array.isArray(envelope.dependencies)) errors.push('dependencies must be an array');
    validateCoverage(envelope.coverage, errors);
    ['observations', 'findings', 'warnings'].forEach(function (key) {
      if (!Array.isArray(envelope[key])) errors.push(key + ' must be an array');
    });
    if (envelope.failure !== null && !isRecord(envelope.failure)) errors.push('failure must be null or an object');
    if (isRecord(envelope.failure) && (typeof envelope.failure.code !== 'string' || !envelope.failure.code || typeof envelope.failure.message !== 'string' || !envelope.failure.message)) {
      errors.push('failure requires a stable code and message');
    }
    if ((envelope.status === 'failed' || envelope.status === 'budget_exceeded') && envelope.failure === null) {
      errors.push('failed and budget_exceeded envelopes require a failure');
    }
    if (envelope.status === 'completed_with_failures' && (!envelope.coverage || !Array.isArray(envelope.coverage.units_failed) || !envelope.coverage.units_failed.length)) {
      errors.push('completed_with_failures requires every failed unit to be enumerated');
    }
    if (envelope.status === 'completed' && envelope.coverage && Array.isArray(envelope.coverage.units_failed) && envelope.coverage.units_failed.length) {
      errors.push('completed cannot conceal failed units');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function hasCompleteStructure(structure) {
    if (!isRecord(structure)) return false;
    var byteRange = isNonNegativeInteger(structure.byte_start) && isNonNegativeInteger(structure.byte_end) && structure.byte_end >= structure.byte_start;
    var objectId = typeof structure.object === 'string' && structure.object.length > 0 && isNonNegativeInteger(structure.generation);
    var operator = isNonNegativeInteger(structure.revision_index) || isNonNegativeInteger(structure.operator_index);
    return byteRange || objectId || operator;
  }

  function validateEvidenceAnchor(anchor) {
    var errors = [];
    if (!isRecord(anchor)) return { valid: false, errors: ['anchor must be an object'] };
    if (typeof anchor.artifact_sha512 !== 'string' || !SHA512_RE.test(anchor.artifact_sha512)) {
      errors.push('artifact_sha512 must be 128 lowercase hexadecimal characters');
    }
    if (typeof anchor.document_id !== 'string' || !anchor.document_id) errors.push('document_id is required');
    if (anchor.page !== null && !isNonNegativeInteger(anchor.page)) errors.push('page must be null or a non-negative integer');
    if (typeof anchor.page === 'number' && anchor.page < 1) errors.push('page is 1-based');
    if (anchor.text_space !== 'page-text-v1') errors.push('text_space must be page-text-v1');
    if (EXTRACTION_KINDS.indexOf(anchor.extraction && anchor.extraction.kind) === -1) errors.push('extraction.kind is not contracted');
    if (typeof anchor.quote !== 'string' && anchor.quote !== null) errors.push('quote must be exact text or null for structural evidence');
    if (typeof anchor.quote === 'string') {
      if (!isNonNegativeInteger(anchor.char_start) || !isNonNegativeInteger(anchor.char_end)) {
        errors.push('text anchors require UTF-16 char_start and char_end');
      } else {
        if (anchor.char_end < anchor.char_start) errors.push('char_end cannot precede char_start');
        if (anchor.char_end - anchor.char_start !== anchor.quote.length) errors.push('UTF-16 offsets must equal quote.length');
      }
      if (anchor.page === null) errors.push('text anchors require a page');
    } else if (!hasCompleteStructure(anchor.structure)) {
      errors.push('a null quote requires complete non-text structural evidence');
    }
    if (anchor.page === null && !hasCompleteStructure(anchor.structure)) errors.push('file-level anchors require structural evidence');
    if (typeof anchor.context_before !== 'string' || typeof anchor.context_after !== 'string') errors.push('verbatim context_before and context_after are required');
    if (anchor.geometry !== null && !isRecord(anchor.geometry)) errors.push('geometry must be null or an object');
    if (anchor.structure !== null && !isRecord(anchor.structure)) errors.push('structure must be null or an object');
    return { valid: errors.length === 0, errors: errors };
  }

  function validatePairFinding(finding) {
    var errors = [];
    if (!isRecord(finding)) return { valid: false, errors: ['pair finding must be an object'] };
    if (!Array.isArray(finding.anchors) || finding.anchors.length !== 2) {
      errors.push('pair findings require exactly two anchors');
    } else {
      for (var i = 0; i < finding.anchors.length; i++) {
        var result = validateEvidenceAnchor(finding.anchors[i]);
        for (var e = 0; e < result.errors.length; e++) errors.push('anchors[' + i + ']: ' + result.errors[e]);
      }
    }
    if (typeof finding.incompatibility_explanation !== 'string' || !finding.incompatibility_explanation.trim()) {
      errors.push('pair findings require a rule-specific incompatibility_explanation');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  var api = {
    MODULE_STATUSES: MODULE_STATUSES,
    EXTRACTION_KINDS: EXTRACTION_KINDS,
    compareStrings: compareStrings,
    compareFindings: compareFindings,
    sortFindings: sortFindings,
    stableStringify: stableStringify,
    canonicalClone: canonicalClone,
    deepFreeze: deepFreeze,
    deterministicId: deterministicId,
    createFailure: createFailure,
    createModuleEnvelope: createModuleEnvelope,
    createFailureEnvelope: createFailureEnvelope,
    validateModuleEnvelope: validateModuleEnvelope,
    validateEvidenceAnchor: validateEvidenceAnchor,
    validatePairFinding: validatePairFinding
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VOAnalysisContracts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
