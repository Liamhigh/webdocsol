'use strict';

/*
 * RES-7 / B5: Allen's thirteen interval relations and exact relational
 * composition. Composition is derived by exhaustive finite witnesses rather
 * than copied from a handwritten table. Path consistency is deliberately not
 * described as proof that a complete schedule exists.
 */
const { C, plain, text, freeze } = require('./util.js');

const RELATIONS = Object.freeze(['<', '>', 'm', 'mi', 'o', 'oi', 'd', 'di', 's', 'si', 'f', 'fi', '=']);
const CONVERSE = Object.freeze({ '<': '>', '>': '<', m: 'mi', mi: 'm', o: 'oi', oi: 'o', d: 'di', di: 'd', s: 'si', si: 's', f: 'fi', fi: 'f', '=': '=' });

function interval(start, end) {
  return { start, end };
}

const WITNESS_INTERVALS = [];
for (let start = 0; start <= 5; start++) {
  for (let end = start + 1; end <= 5; end++) WITNESS_INTERVALS.push(interval(start, end));
}

function relation(a, b) {
  if (!a || !b || !Number.isFinite(a.start) || !Number.isFinite(a.end) ||
      !Number.isFinite(b.start) || !Number.isFinite(b.end) || a.end <= a.start || b.end <= b.start) {
    throw new TypeError('Allen relations require finite non-empty intervals');
  }
  if (a.end < b.start) return '<';
  if (a.end === b.start) return 'm';
  if (a.start === b.end) return 'mi';
  if (a.start > b.end) return '>';
  if (a.start === b.start && a.end === b.end) return '=';
  if (a.start === b.start) return a.end < b.end ? 's' : 'si';
  if (a.end === b.end) return a.start > b.start ? 'f' : 'fi';
  if (a.start < b.start && a.end > b.start && a.end < b.end) return 'o';
  if (a.start > b.start && a.start < b.end && a.end > b.end) return 'oi';
  if (a.start > b.start && a.end < b.end) return 'd';
  if (a.start < b.start && a.end > b.end) return 'di';
  throw new Error('Unclassified interval relation');
}

function composePair(left, right) {
  if (RELATIONS.indexOf(left) === -1 || RELATIONS.indexOf(right) === -1) {
    throw new TypeError('Unknown Allen relation in composition');
  }
  const output = new Set();
  for (const a of WITNESS_INTERVALS) {
    for (const b of WITNESS_INTERVALS) {
      if (relation(a, b) !== left) continue;
      for (const c of WITNESS_INTERVALS) {
        if (relation(b, c) === right) output.add(relation(a, c));
      }
    }
  }
  return RELATIONS.filter((item) => output.has(item));
}

const COMPOSITION = Object.create(null);
for (const left of RELATIONS) {
  COMPOSITION[left] = Object.create(null);
  for (const right of RELATIONS) {
    const values = composePair(left, right);
    if (!values.length) throw new Error('Empty Allen composition ' + left + right);
    COMPOSITION[left][right] = Object.freeze(values);
  }
}
freeze(COMPOSITION);

function composeSets(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) return [];
  if (left.some((item) => RELATIONS.indexOf(item) === -1) || right.some((item) => RELATIONS.indexOf(item) === -1)) throw new TypeError('Unknown Allen relation in set composition');
  const output = new Set();
  for (const a of left) {
    for (const b of right) for (const value of COMPOSITION[a][b]) output.add(value);
  }
  return RELATIONS.filter((item) => output.has(item));
}

function intersect(left, right) {
  return RELATIONS.filter((item) => left.indexOf(item) !== -1 && right.indexOf(item) !== -1);
}

function normaliseConstraints(constraints, variableCount) {
  if (!Number.isSafeInteger(variableCount) || variableCount < 1 || variableCount > 64) {
    throw new TypeError('Temporal network requires 1–64 variables');
  }
  if (!Array.isArray(constraints)) throw new TypeError('Temporal constraints must be an array');
  const matrix = Array.from({ length: variableCount }, () => Array(variableCount).fill(null));
  for (let i = 0; i < variableCount; i++) matrix[i][i] = ['='];
  for (const constraint of constraints) {
    if (!plain(constraint) || !Number.isSafeInteger(constraint.from) || !Number.isSafeInteger(constraint.to) ||
        constraint.from < 0 || constraint.to < 0 || constraint.from >= variableCount || constraint.to >= variableCount ||
        constraint.from === constraint.to || !Array.isArray(constraint.allowed) || !constraint.allowed.length ||
        constraint.allowed.some((item) => RELATIONS.indexOf(item) === -1)) {
      throw new TypeError('Malformed temporal constraint');
    }
    const allowed = RELATIONS.filter((item) => constraint.allowed.indexOf(item) !== -1);
    matrix[constraint.from][constraint.to] = matrix[constraint.from][constraint.to]
      ? intersect(matrix[constraint.from][constraint.to], allowed)
      : allowed;
    matrix[constraint.to][constraint.from] = matrix[constraint.to][constraint.from]
      ? intersect(matrix[constraint.to][constraint.from], allowed.map((item) => CONVERSE[item]))
      : allowed.map((item) => CONVERSE[item]);
  }
  for (let i = 0; i < variableCount; i++) {
    for (let j = 0; j < variableCount; j++) {
      if (!matrix[i][j]) matrix[i][j] = RELATIONS.slice();
      if (!matrix[i][j].length) return { matrix, empty: { from: i, to: j } };
    }
  }
  return { matrix, empty: null };
}

function checkPathConsistency(constraints, variableCount, budget) {
  const limit = budget === undefined ? 100000 : budget;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('Temporal budget must be a positive safe integer');
  const normalised = normaliseConstraints(constraints, variableCount);
  if (normalised.empty) {
    return freeze({ status: 'INCONSISTENT', reason: 'EMPTY_DIRECT_CONSTRAINT', empty: normalised.empty, comparisons: 0 });
  }
  const matrix = normalised.matrix;
  let comparisons = 0;
  let changed = true;
  let passes = 0;
  while (changed) {
    changed = false;
    passes++;
    for (let k = 0; k < variableCount; k++) {
      for (let i = 0; i < variableCount; i++) {
        for (let j = 0; j < variableCount; j++) {
          if (++comparisons > limit) {
            return freeze({ status: 'BUDGET_EXCEEDED', reason: 'NO_GLOBAL_CONSISTENCY_CLAIM', comparisons });
          }
          const narrowed = intersect(matrix[i][j], composeSets(matrix[i][k], matrix[k][j]));
          if (!narrowed.length) {
            return freeze({ status: 'INCONSISTENT', reason: 'EMPTY_PATH_CONSTRAINT', empty: { from: i, to: j, via: k }, comparisons });
          }
          if (C.stableStringify(narrowed) !== C.stableStringify(matrix[i][j])) {
            matrix[i][j] = narrowed;
            matrix[j][i] = narrowed.map((item) => CONVERSE[item]);
            changed = true;
          }
        }
      }
    }
  }
  return freeze({
    status: 'PATH_CONSISTENT_NOT_SCHEDULE_PROOF',
    reason: 'No empty relation was derived within the budget; a separate concrete witness is required to prove satisfiability.',
    comparisons,
    passes,
    constraints: constraints.map((constraint) => ({
      from: constraint.from, to: constraint.to, allowed: matrix[constraint.from][constraint.to].slice()
    }))
  });
}

function validateWitness(constraints, intervals) {
  if (!Array.isArray(intervals)) return { valid: false, errors: ['Witness intervals must be an array'] };
  if (!Array.isArray(constraints)) return { valid: false, errors: ['Witness constraints must be an array'] };
  const errors = [];
  const invalidIntervals = new Set();
  intervals.forEach((item, index) => {
    try { relation(item, item); } catch (error) { invalidIntervals.add(index); errors.push('interval ' + index + ': ' + error.message); }
  });
  for (const constraint of constraints) {
    if (!plain(constraint) || !intervals[constraint.from] || !intervals[constraint.to]) {
      errors.push('Constraint references a missing witness interval');
      continue;
    }
    if (invalidIntervals.has(constraint.from) || invalidIntervals.has(constraint.to)) continue;
    try {
      const actual = relation(intervals[constraint.from], intervals[constraint.to]);
      if (!Array.isArray(constraint.allowed) || constraint.allowed.indexOf(actual) === -1) {
        errors.push('Witness violates ' + constraint.from + '→' + constraint.to + ': actual ' + actual);
      }
    } catch (error) {
      errors.push('Constraint ' + constraint.from + '→' + constraint.to + ': ' + error.message);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  RELATIONS, CONVERSE, COMPOSITION,
  relation, composePair, composeSets, checkPathConsistency, validateWitness
};
