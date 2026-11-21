'use strict';

/*
 * Development-only helpers. Nothing in this directory is imported by the
 * production engine, report renderer, Worker or sealing page.
 */
const C = require('../../analysis-contracts.js');
const R = require('../../nine-brain-contracts.js');

const VERSION = '0.2.0-development';
const SHA512_RE = /^[0-9a-f]{128}$/;

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function own(value, key) {
  return plain(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hash(value) {
  return R.hashRecordPayload(value);
}

function id(schema, namespace, value) {
  return C.deterministicId(schema, hash(value), namespace, [value]);
}

function clone(value) {
  return C.canonicalClone(value);
}

function freeze(value) {
  return C.deepFreeze(value);
}

function unique(values) {
  if (!Array.isArray(values)) return false;
  const seen = Object.create(null);
  for (const value of values) {
    if (!text(value) || own(seen, value)) return false;
    seen[value] = true;
  }
  return true;
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort(C.compareStrings);
}

function emptyCoverage() {
  return { units_total: 0, units_processed: 0, units_skipped: [], units_failed: [] };
}

function completeCoverage(units) {
  return {
    units_total: units.length,
    units_processed: units.length,
    units_skipped: [],
    units_failed: []
  };
}

function result(status, reasons) {
  return { status, reasons: status === 'NOT_EVALUATED' ? [] : reasons };
}

function safeValidate(validator, value, ...args) {
  try {
    const validation = validator(value, ...args);
    return validation && validation.valid === true
      ? { valid: true, errors: [] }
      : { valid: false, errors: validation && Array.isArray(validation.errors) ? validation.errors : ['validator returned no result'] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

module.exports = {
  C, R, VERSION, SHA512_RE,
  plain, own, text, hash, id, clone, freeze, unique, sortedUnique,
  emptyCoverage, completeCoverage, result, safeValidate
};
