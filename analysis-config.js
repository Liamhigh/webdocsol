/* Verum Omnis forensic analysis — Phase 0 replay configuration (fail-closed).
 * All module flags remain false until a contracted implementation and fixtures land.
 * This file is also inlined byte-exactly into seal-document.html.
 */
(function (root) {
  'use strict';

  var MODULE_NAMES = [
    'citations', 'redaction', 'revisions', 'temporalAlgebra',
    'imageMetadata', 'c2pa', 'spatialOcr'
  ];

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isPlainRecord(value) {
    if (!isRecord(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function deepFreeze(value) {
    if (!isRecord(value) || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function normalizeReferenceTime(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new TypeError('referenceTime must be an ISO instant string or null');
    var parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value)) {
      throw new TypeError('referenceTime must be a valid ISO instant with an explicit offset');
    }
    return parsed.toISOString();
  }

  function normalizeModules(input) {
    if (input === undefined) input = {};
    if (!isPlainRecord(input)) throw new TypeError('modules must be a plain record');
    Object.keys(input).forEach(function (name) {
      if (MODULE_NAMES.indexOf(name) === -1) throw new TypeError('Unknown analysis module flag: ' + name);
      if (typeof input[name] !== 'boolean') throw new TypeError('Module flag must be boolean: ' + name);
      if (input[name]) throw new Error('Analysis module is not implemented; keep its Phase 0 flag false: ' + name);
    });
    var normalized = {};
    MODULE_NAMES.forEach(function (name) {
      normalized[name] = Object.prototype.hasOwnProperty.call(input, name) && input[name] === true;
    });
    return deepFreeze(normalized);
  }

  function normalizeConfig(options) {
    var opts = options === undefined ? {} : options;
    if (!isPlainRecord(opts)) throw new TypeError('Analysis configuration must be a plain record');
    var allowed = { modules: true, referenceTime: true, budgets: true };
    Object.keys(opts).forEach(function (key) {
      if (!allowed[key]) throw new TypeError('Unknown analysis configuration key: ' + key);
    });
    var budgets = opts.budgets === undefined ? {} : opts.budgets;
    if (!isPlainRecord(budgets)) throw new TypeError('budgets must be a plain record');
    var normalizedBudgets = {};
    Object.keys(budgets).forEach(function (name) {
      if (MODULE_NAMES.indexOf(name) === -1) throw new TypeError('Unknown module budget: ' + name);
      var budget = budgets[name];
      if (!isPlainRecord(budget)) throw new TypeError('Module budget must be a plain record: ' + name);
      var allowedBudget = { maxUnits: true, maxMilliseconds: true };
      Object.keys(budget).forEach(function (key) {
        if (!allowedBudget[key]) throw new TypeError('Unknown module budget key: ' + key);
        if (!Number.isSafeInteger(budget[key]) || budget[key] < 0) {
          throw new TypeError('Module budget values must be non-negative safe integers');
        }
      });
      normalizedBudgets[name] = deepFreeze({
        maxUnits: budget.maxUnits === undefined ? null : budget.maxUnits,
        maxMilliseconds: budget.maxMilliseconds === undefined ? null : budget.maxMilliseconds
      });
    });
    return deepFreeze({
      modules: normalizeModules(opts.modules),
      referenceTime: normalizeReferenceTime(opts.referenceTime),
      budgets: normalizedBudgets
    });
  }

  var api = { MODULE_NAMES: MODULE_NAMES.slice(), normalizeConfig: normalizeConfig };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VOAnalysisConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
