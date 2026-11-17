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
  var ISO_INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/;

  function isValidIsoInstant(value) {
    if (typeof value !== 'string') return false;
    var match = ISO_INSTANT_RE.exec(value);
    if (!match) return false;
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    var hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
    var days = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return false;
    if (match[7] !== 'Z') {
      var offsetHour = Number(match[9]), offsetMinute = Number(match[10]);
      if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
    }
    return Number.isFinite(Date.parse(value));
  }

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
        for (var i = 0; i < item.length; i++) {
          var elementDescriptor = Object.getOwnPropertyDescriptor(item, String(i));
          if (!elementDescriptor) throw new TypeError('Canonical JSON contains a non-JSON value in an array');
          if (elementDescriptor.get || elementDescriptor.set) {
            throw new TypeError('Canonical JSON requires data properties, not accessors');
          }
          elements.push(visit(elementDescriptor.value, true));
        }
        out = '[' + elements.join(',') + ']';
      } else if (isPlainRecord(item)) {
        var keys = Object.keys(item).sort(compareStrings);
        var properties = [];
        for (var k = 0; k < keys.length; k++) {
          var descriptor = Object.getOwnPropertyDescriptor(item, keys[k]);
          if (!descriptor || descriptor.get || descriptor.set) {
            throw new TypeError('Canonical JSON requires data properties, not accessors');
          }
          properties.push(JSON.stringify(keys[k]) + ':' + visit(descriptor.value, false));
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

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object') return value;
    seen = seen || [];
    if (seen.indexOf(value) !== -1) return value;
    seen.push(value);
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) deepFreeze(value[keys[i]], seen);
    return Object.freeze(value);
  }

  var SHA512_MASK = (1n << 64n) - 1n;
  var SHA512_INITIAL = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];
  var SHA512_K = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ];

  function utf8Bytes(value) {
    var bytes = [];
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
        var low = value.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          i++;
        }
      }
      if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
      if (code <= 0x7f) bytes.push(code);
      else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return bytes;
  }

  function rotateRight64(value, bits) {
    return ((value >> bits) | (value << (64n - bits))) & SHA512_MASK;
  }

  /* Synchronous, dependency-free SHA-512 keeps IDs opaque in Node and browsers. */
  function sha512Hex(value) {
    var bytes = utf8Bytes(value);
    var paddedLength = Math.ceil((bytes.length + 17) / 128) * 128;
    var padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    var bitLength = BigInt(bytes.length) * 8n;
    for (var n = 0; n < 8; n++) {
      padded[paddedLength - 1 - n] = Number((bitLength >> BigInt(n * 8)) & 0xffn);
    }
    var hash = SHA512_INITIAL.slice();
    var words = new Array(80);
    for (var offset = 0; offset < paddedLength; offset += 128) {
      for (var w = 0; w < 16; w++) {
        var word = 0n;
        for (var b = 0; b < 8; b++) word = (word << 8n) | BigInt(padded[offset + w * 8 + b]);
        words[w] = word;
      }
      for (var t = 16; t < 80; t++) {
        var x = words[t - 15], y = words[t - 2];
        var s0 = rotateRight64(x, 1n) ^ rotateRight64(x, 8n) ^ (x >> 7n);
        var s1 = rotateRight64(y, 19n) ^ rotateRight64(y, 61n) ^ (y >> 6n);
        words[t] = (words[t - 16] + s0 + words[t - 7] + s1) & SHA512_MASK;
      }
      var a = hash[0], bb = hash[1], c = hash[2], d = hash[3];
      var e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      for (var round = 0; round < 80; round++) {
        var sum1 = rotateRight64(e, 14n) ^ rotateRight64(e, 18n) ^ rotateRight64(e, 41n);
        var choose = (e & f) ^ (~e & g);
        var temp1 = (h + sum1 + choose + SHA512_K[round] + words[round]) & SHA512_MASK;
        var sum0 = rotateRight64(a, 28n) ^ rotateRight64(a, 34n) ^ rotateRight64(a, 39n);
        var majority = (a & bb) ^ (a & c) ^ (bb & c);
        var temp2 = (sum0 + majority) & SHA512_MASK;
        h = g; g = f; f = e; e = (d + temp1) & SHA512_MASK;
        d = c; c = bb; bb = a; a = (temp1 + temp2) & SHA512_MASK;
      }
      hash[0] = (hash[0] + a) & SHA512_MASK; hash[1] = (hash[1] + bb) & SHA512_MASK;
      hash[2] = (hash[2] + c) & SHA512_MASK; hash[3] = (hash[3] + d) & SHA512_MASK;
      hash[4] = (hash[4] + e) & SHA512_MASK; hash[5] = (hash[5] + f) & SHA512_MASK;
      hash[6] = (hash[6] + g) & SHA512_MASK; hash[7] = (hash[7] + h) & SHA512_MASK;
    }
    return hash.map(function (word) { return word.toString(16).padStart(16, '0'); }).join('');
  }

  /* Hash length-prefixed canonical parts: unambiguous without exposing quotes. */
  function deterministicId(moduleId, inputSha512, ruleId, anchors) {
    if (typeof inputSha512 !== 'string' || !SHA512_RE.test(inputSha512)) {
      throw new TypeError('Deterministic ID inputSha512 must be 128 lowercase hexadecimal characters');
    }
    var parts = [moduleId, inputSha512, ruleId, stableStringify(anchors || [])];
    for (var i = 0; i < parts.length; i++) {
      if (typeof parts[i] !== 'string' || !parts[i]) throw new TypeError('Deterministic ID parts must be non-empty strings');
    }
    var encoded = [];
    for (var p = 0; p < parts.length; p++) encoded.push(parts[p].length + ':' + parts[p]);
    return 'vo1|' + sha512Hex(encoded.join('|'));
  }

  function firstAnchor(finding) {
    return finding && Array.isArray(finding.anchors) && finding.anchors.length ? finding.anchors[0] :
      (finding && finding.anchor ? finding.anchor : {});
  }

  function firstOffset(anchor) {
    if (isNonNegativeInteger(anchor.char_start)) return { system: 'utf16', value: anchor.char_start };
    if (isNonNegativeInteger(anchor.byte_start)) return { system: 'bytes', value: anchor.byte_start };
    if (anchor.structure && isNonNegativeInteger(anchor.structure.byte_start)) {
      return { system: 'bytes', value: anchor.structure.byte_start };
    }
    return { system: 'none', value: null };
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
    var aOffset = firstOffset(aa), bOffset = firstOffset(bb);
    order = compareStrings(aOffset.system, bOffset.system);
    if (order) return order;
    order = compareNullableNumbers(aOffset.value, bOffset.value);
    if (order) return order;
    order = compareStrings(a && (a.rule_id || a.ruleId) || '', b && (b.rule_id || b.ruleId) || '');
    if (order) return order;
    order = compareStrings(a && (a.finding_id || a.id) || '', b && (b.finding_id || b.id) || '');
    if (order) return order;
    order = compareStrings(stableStringify(aa), stableStringify(bb));
    if (order) return order;
    order = compareStrings(
      stableStringify(a && Array.isArray(a.anchors) ? a.anchors.slice(1) : []),
      stableStringify(b && Array.isArray(b.anchors) ? b.anchors.slice(1) : [])
    );
    if (order) return order;
    return compareStrings(stableStringify(a), stableStringify(b));
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
    if (Array.isArray(coverage.units_skipped) && Array.isArray(coverage.units_failed)) {
      var seenUnits = [];
      var unitLists = [coverage.units_skipped, coverage.units_failed];
      for (var listIndex = 0; listIndex < unitLists.length; listIndex++) {
        for (var unitIndex = 0; unitIndex < unitLists[listIndex].length; unitIndex++) {
          var unit = unitLists[listIndex][unitIndex];
          if ((!isNonNegativeInteger(unit)) && (typeof unit !== 'string' || !unit)) {
            errors.push('coverage unit identifiers must be non-negative integers or non-empty strings');
            continue;
          }
          var key = typeof unit + ':' + String(unit);
          if (seenUnits.indexOf(key) !== -1) errors.push('coverage unit identifiers must be unique across skipped and failed units');
          else seenUnits.push(key);
        }
      }
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
    if (envelope.reference_time !== null && !isValidIsoInstant(envelope.reference_time)) {
      errors.push('reference_time must be null or a valid ISO instant with an offset');
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
    if (envelope.status === 'completed' && envelope.failure !== null) {
      errors.push('completed cannot carry a failure object');
    }
    if (envelope.status === 'completed' && envelope.coverage && Array.isArray(envelope.coverage.units_failed) && envelope.coverage.units_failed.length) {
      errors.push('completed cannot conceal failed units');
    }
    if ((envelope.status === 'completed' || envelope.status === 'completed_with_failures') && isRecord(envelope.coverage) &&
      isNonNegativeInteger(envelope.coverage.units_total) && isNonNegativeInteger(envelope.coverage.units_processed) &&
      Array.isArray(envelope.coverage.units_skipped) && Array.isArray(envelope.coverage.units_failed) &&
      envelope.coverage.units_total !== envelope.coverage.units_processed + envelope.coverage.units_skipped.length + envelope.coverage.units_failed.length) {
      errors.push(envelope.status + ' must account for every unit as processed, skipped or failed');
    }
    if (envelope.status === 'unsupported' || envelope.status === 'not_applicable') {
      if (isRecord(envelope.coverage) && envelope.coverage.units_processed !== 0) {
        errors.push(envelope.status + ' cannot report processed units');
      }
      if (Array.isArray(envelope.findings) && envelope.findings.length) {
        errors.push(envelope.status + ' cannot report findings');
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function hasCompleteStructure(structure) {
    if (!isRecord(structure)) return false;
    var byteRange = isNonNegativeInteger(structure.byte_start) && isNonNegativeInteger(structure.byte_end) && structure.byte_end > structure.byte_start;
    var objectId = typeof structure.object === 'string' && structure.object.length > 0 && isNonNegativeInteger(structure.generation);
    /* An operator/revision index supplements a non-empty range or PDF object. */
    return byteRange || objectId;
  }

  function validateEvidenceAnchor(anchor, sourceText) {
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
      if (!anchor.quote.length) errors.push('text anchors require non-empty exact source text');
      if (typeof sourceText !== 'string') {
        errors.push('text anchors require the complete source page text for verification');
      }
      if (!isNonNegativeInteger(anchor.char_start) || !isNonNegativeInteger(anchor.char_end)) {
        errors.push('text anchors require UTF-16 char_start and char_end');
      } else {
        if (anchor.char_end <= anchor.char_start) errors.push('char_end must follow char_start');
        if (anchor.char_end - anchor.char_start !== anchor.quote.length) errors.push('UTF-16 offsets must equal quote.length');
        if (typeof sourceText === 'string') {
          if (sourceText.slice(anchor.char_start, anchor.char_end) !== anchor.quote) errors.push('quote does not match source text at the stated UTF-16 offsets');
          if (sourceText.slice(0, anchor.char_start) !== anchor.context_before) errors.push('context_before does not match the complete preceding source text');
          if (sourceText.slice(anchor.char_end) !== anchor.context_after) errors.push('context_after does not match the complete following source text');
        }
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

  function evidenceLocation(anchor) {
    if (typeof anchor.quote === 'string') {
      return ['text', anchor.artifact_sha512, anchor.page, anchor.char_start, anchor.char_end];
    }
    var structure = anchor.structure || {};
    return ['structure', anchor.artifact_sha512, anchor.page, structure.object || null,
      typeof structure.generation === 'undefined' ? null : structure.generation,
      typeof structure.byte_start === 'undefined' ? null : structure.byte_start,
      typeof structure.byte_end === 'undefined' ? null : structure.byte_end];
  }

  function validatePairFinding(finding, sourceTexts) {
    var errors = [];
    if (!isRecord(finding)) return { valid: false, errors: ['pair finding must be an object'] };
    if (!Array.isArray(finding.anchors) || finding.anchors.length !== 2) {
      errors.push('pair findings require exactly two anchors');
    } else {
      if (!Array.isArray(sourceTexts) || sourceTexts.length !== 2) {
        errors.push('pair findings require the two complete source page texts');
      }
      var anchorsValid = true;
      for (var i = 0; i < finding.anchors.length; i++) {
        var result = validateEvidenceAnchor(finding.anchors[i], Array.isArray(sourceTexts) ? sourceTexts[i] : undefined);
        if (!result.valid) anchorsValid = false;
        for (var e = 0; e < result.errors.length; e++) errors.push('anchors[' + i + ']: ' + result.errors[e]);
      }
      if (anchorsValid && stableStringify(evidenceLocation(finding.anchors[0])) === stableStringify(evidenceLocation(finding.anchors[1]))) {
        errors.push('pair findings require two distinct source locations');
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
    isValidIsoInstant: isValidIsoInstant,
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
