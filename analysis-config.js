/* Explicit, deterministic analysis options. No rollout, IP inference or clock. */
(function (root) {
  'use strict';

  var MODULE_NAMES = Object.freeze([
    'citations',
    'redaction',
    'revisions',
    'temporalAlgebra',
    'imageMetadata',
    'c2pa',
    'spatialOcr'
  ]);
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

  function compareStrings(a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object') return value;
    seen = seen || [];
    if (seen.indexOf(value) !== -1) return value;
    seen.push(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], seen); });
    return Object.freeze(value);
  }

  var DEFAULT_MODULES = deepFreeze(MODULE_NAMES.reduce(function (modules, name) {
    modules[name] = false;
    return modules;
  }, {}));

  function normalizeModules(input) {
    if (typeof input === 'undefined' || input === null) input = {};
    if (!isRecord(input)) throw new TypeError('opts.modules must be an object');
    var prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('opts.modules must be a plain object');
    Object.keys(input).forEach(function (name) {
      if (MODULE_NAMES.indexOf(name) === -1) throw new TypeError('Unknown analysis module flag: ' + name);
      if (typeof input[name] !== 'boolean') throw new TypeError('Analysis module flags must be boolean: ' + name);
      if (input[name]) throw new Error('Analysis module is not implemented; keep its Phase 0 flag false: ' + name);
    });
    var normalized = {};
    MODULE_NAMES.forEach(function (name) { normalized[name] = Object.prototype.hasOwnProperty.call(input, name) && input[name] === true; });
    return deepFreeze(normalized);
  }

  function normalizeJurisdictionPacks(input) {
    if (typeof input === 'undefined' || input === null) input = ['za'];
    if (!Array.isArray(input)) throw new TypeError('opts.jurisdictionPacks must be an array');
    var seen = {};
    var packs = [];
    input.forEach(function (pack) {
      if (typeof pack !== 'string' || !/^[a-z]{2}$/.test(pack)) {
        throw new TypeError('Jurisdiction packs must be explicit lowercase ISO-style codes');
      }
      if (!seen[pack]) { seen[pack] = true; packs.push(pack); }
    });
    packs.sort(compareStrings);
    return Object.freeze(packs);
  }

  function normalizeReferenceTime(input) {
    if (input === null || typeof input === 'undefined' || input === '') return null;
    if (!isValidIsoInstant(input)) {
      throw new TypeError('opts.referenceTime must be a valid caller-supplied ISO instant with an offset');
    }
    return input;
  }

  function selectedConfiguration(opts) {
    opts = opts || {};
    if (!isRecord(opts)) throw new TypeError('opts must be an object');
    return deepFreeze({
      modules: normalizeModules(opts.modules),
      jurisdictionPacks: normalizeJurisdictionPacks(opts.jurisdictionPacks),
      referenceTime: normalizeReferenceTime(opts.referenceTime)
    });
  }

  function withAnalysisDefaults(opts) {
    opts = opts || {};
    var configuration = selectedConfiguration(opts);
    var normalized = {};
    Object.keys(opts).forEach(function (key) { normalized[key] = opts[key]; });
    normalized.modules = configuration.modules;
    normalized.jurisdictionPacks = configuration.jurisdictionPacks;
    normalized.referenceTime = configuration.referenceTime;
    return normalized;
  }

  var api = {
    MODULE_NAMES: MODULE_NAMES,
    DEFAULT_MODULES: DEFAULT_MODULES,
    normalizeModules: normalizeModules,
    normalizeJurisdictionPacks: normalizeJurisdictionPacks,
    isValidIsoInstant: isValidIsoInstant,
    selectedConfiguration: selectedConfiguration,
    withAnalysisDefaults: withAnalysisDefaults
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VOAnalysisConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
