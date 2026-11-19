/*
 * Verum Omnis legal-citation jurisdiction pack registry.
 *
 * The neutral core (legal-citations.js) owns spans, occurrence identity and
 * resolution; a jurisdiction pack owns grammar, reporter/court identifiers and
 * its rules. Packs are explicit (never inferred from IP, device region or
 * locale), versioned, and registered here. Classic script, no build step:
 * CommonJS export for Node tests, browser global otherwise. No clock, no
 * randomness, no network, no regex lookbehind.
 */
(function (root) {
  'use strict';

  var REGISTRY_VERSION = '1.0.0';
  var SUPPORTED_KINDS = Object.freeze([
    'full_case', 'short_case', 'id', 'supra', 'neutral_case', 'reported_case',
    'docket', 'statute', 'regulation', 'constitutional_provision', 'source_url'
  ]);

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  var packs = Object.create(null);

  function validateRule(packId, rule) {
    if (!isPlainRecord(rule)) throw new TypeError(packId + ': every rule must be a plain object');
    if (typeof rule.rule_id !== 'string' || !/^[a-z0-9-]+$/.test(rule.rule_id)) {
      throw new TypeError(packId + ': rule_id must be a lowercase kebab-case string');
    }
    if (SUPPORTED_KINDS.indexOf(rule.kind) === -1) {
      throw new TypeError(packId + '/' + rule.rule_id + ': unsupported citation kind');
    }
    if (!(rule.pattern instanceof RegExp)) throw new TypeError(packId + '/' + rule.rule_id + ': pattern must be a RegExp');
    if (!rule.pattern.global || rule.pattern.sticky) throw new TypeError(packId + '/' + rule.rule_id + ': pattern must be global and not sticky');
    if (rule.pattern.source.indexOf('(?<' + '=') !== -1 || rule.pattern.source.indexOf('(?<' + '!') !== -1) {
      throw new TypeError(packId + '/' + rule.rule_id + ': regex lookbehind is not supported (Safari < 16.4 cannot parse it)');
    }
    if (typeof rule.extract !== 'undefined' && typeof rule.extract !== 'function') {
      throw new TypeError(packId + '/' + rule.rule_id + ': extract must be a function');
    }
  }

  function validatePack(pack) {
    if (!isPlainRecord(pack)) throw new TypeError('A jurisdiction pack must be a plain object');
    if (typeof pack.id !== 'string' || !/^[a-z]{2}$/.test(pack.id)) {
      throw new TypeError('A pack id must be an explicit lowercase ISO-style code');
    }
    if (typeof pack.version !== 'string' || !pack.version) throw new TypeError(pack.id + ': version is required');
    if (!Array.isArray(pack.rules) || !pack.rules.length) throw new TypeError(pack.id + ': rules must be a non-empty array');
    if (typeof pack.helpers !== 'undefined' &&
      (!Array.isArray(pack.helpers) || pack.helpers.some(function (helper) { return typeof helper !== 'function'; }))) {
      throw new TypeError(pack.id + ': helpers must be an array of functions');
    }
    var seen = Object.create(null);
    pack.rules.forEach(function (rule) {
      validateRule(pack.id, rule);
      if (Object.prototype.hasOwnProperty.call(seen, rule.rule_id)) {
        throw new TypeError(pack.id + ': duplicate rule_id ' + rule.rule_id);
      }
      seen[rule.rule_id] = true;
    });
    return pack;
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object') return value;
    seen = seen || [];
    if (seen.indexOf(value) !== -1) return value;
    seen.push(value);
    if (value instanceof RegExp) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], seen); });
    return Object.freeze(value);
  }

  function register(pack) {
    validatePack(pack);
    if (Object.prototype.hasOwnProperty.call(packs, pack.id)) {
      throw new Error('Jurisdiction pack already registered: ' + pack.id);
    }
    packs[pack.id] = deepFreeze(pack);
    return packs[pack.id];
  }

  function has(id) { return Object.prototype.hasOwnProperty.call(packs, id); }

  function get(id) {
    if (!has(id)) throw new Error('Unknown jurisdiction pack: ' + id + ' (registered: ' + list().join(', ') + ')');
    return packs[id];
  }

  function list() {
    return Object.keys(packs).sort();
  }

  /* Resolve explicit pack codes to registered pack objects, preserving order. */
  function resolvePacks(ids) {
    if (!Array.isArray(ids)) throw new TypeError('jurisdiction pack codes must be an array');
    return ids.map(function (id) { return get(id); });
  }

  var api = {
    REGISTRY_VERSION: REGISTRY_VERSION,
    SUPPORTED_KINDS: SUPPORTED_KINDS,
    validatePack: validatePack,
    register: register,
    has: has,
    get: get,
    list: list,
    resolvePacks: resolvePacks
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VOLegalPacks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
