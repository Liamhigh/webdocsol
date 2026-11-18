import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EVALUATION_LIMITS,
  createAlignmentTable,
  mapNormalizedSpan,
  sameSpan,
  tokenOverlapCounts
} from './span-alignment.mjs';

export const NOT_DEFINED = 'not_defined';
const TOKEN_SCALE = 1000000n;
const evaluationSchema = JSON.parse(readFileSync(fileURLToPath(new URL('../schema.json', import.meta.url)), 'utf8'));

function ratio(numerator, denominator) {
  return denominator === 0 ? NOT_DEFINED : numerator / denominator;
}

function meanDefined(values) {
  const defined = values.filter((value) => typeof value === 'number');
  return defined.length ? defined.reduce((sum, value) => sum + value, 0) / defined.length : NOT_DEFINED;
}

export function binaryMetrics(counts) {
  const tp = counts.tp || 0;
  const fp = counts.fp || 0;
  const fn = counts.fn || 0;
  const result = { tp, fp, fn };
  if (counts.tn !== undefined) result.tn = counts.tn;
  result.precision = ratio(tp, tp + fp);
  result.recall = ratio(tp, tp + fn);
  result.f1 = ratio(2 * tp, 2 * tp + fp + fn);
  return result;
}

function addCounts(target, source) {
  for (const key of ['tp', 'fp', 'fn', 'tn']) {
    if (source[key] !== undefined) target[key] = (target[key] || 0) + source[key];
  }
  return target;
}

function aggregateMetrics(perItem) {
  const counts = {};
  for (const metrics of perItem) addCounts(counts, metrics);
  return {
    micro: binaryMetrics(counts),
    macro: {
      precision: meanDefined(perItem.map((metrics) => metrics.precision)),
      recall: meanDefined(perItem.map((metrics) => metrics.recall)),
      f1: meanDefined(perItem.map((metrics) => metrics.f1))
    }
  };
}

function aggregateBinary(caseResults, key) {
  return aggregateMetrics(caseResults.map((result) => result[key]));
}

function ratioMetrics(numerator, denominator) {
  return { numerator, denominator, value: ratio(numerator, denominator) };
}

function aggregateRatio(caseResults, key) {
  const perCase = caseResults.map((result) => result[key]);
  const numerator = perCase.reduce((sum, metrics) => sum + metrics.numerator, 0);
  const denominator = perCase.reduce((sum, metrics) => sum + metrics.denominator, 0);
  return {
    micro: ratioMetrics(numerator, denominator),
    macro: { value: meanDefined(perCase.map((metrics) => metrics.value)) }
  };
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaTypeMatches(value, type) {
  if (type === 'object') return isObject(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'null') return value === null;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  return false;
}

function resolveSchemaReference(reference, rootSchema) {
  if (!reference.startsWith('#/')) throw new TypeError('Only local evaluation schema references are supported');
  return reference.slice(2).split('/').reduce((value, token) => value[token.replace(/~1/g, '/').replace(/~0/g, '~')], rootSchema);
}

function validateSchemaValue(value, schema, rootSchema, label, errors) {
  if (schema.$ref) return validateSchemaValue(value, resolveSchemaReference(schema.$ref, rootSchema), rootSchema, label, errors);
  if (schema.anyOf) {
    const accepted = schema.anyOf.some((alternative) => {
      const alternativeErrors = [];
      validateSchemaValue(value, alternative, rootSchema, label, alternativeErrors);
      return alternativeErrors.length === 0;
    });
    if (!accepted) errors.push(label + ' does not match any permitted schema');
    return errors;
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(label + ' must equal ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.includes(value)) errors.push(label + ' is not a permitted enum value');
  if (schema.type && !schemaTypeMatches(value, schema.type)) {
    errors.push(label + ' must be ' + schema.type);
    return errors;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(label + ' is shorter than minLength');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(label + ' is longer than maxLength');
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(label + ' does not match the required pattern');
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(label + ' is below minimum');
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(label + ' has too few items');
    if (schema.items) value.forEach((item, index) => validateSchemaValue(item, schema.items, rootSchema, label + '[' + index + ']', errors));
  }
  if (isObject(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(label + '.' + key + ' is required');
    }
    for (const key of Object.keys(value)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateSchemaValue(value[key], properties[key], rootSchema, label + '.' + key, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(label + ' has unsupported property ' + JSON.stringify(key));
      }
    }
  }
  return errors;
}

export function validateEvaluationSchema(run) {
  return validateSchemaValue(run, evaluationSchema, evaluationSchema, '$', []);
}

function validatePage(page, label, errors) {
  if (page !== null && (!Number.isInteger(page) || page < 1)) errors.push(label + ' must be null or a positive integer');
}

function validateSpan(span, text, label, errors) {
  if (!isObject(span)) {
    errors.push(label + ' must be an object');
    return;
  }
  if (!nonemptyString(span.span_id || span.anchor_id)) errors.push(label + ' requires a stable id');
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.start >= span.end || span.end > text.length) {
    errors.push(label + ' has invalid UTF-16 boundaries');
  } else if (text.slice(span.start, span.end) !== span.quote) {
    errors.push(label + ' quote must be the exact, untrimmed source slice');
  }
  validatePage(span.page, label + '.page', errors);
}

function uniqueIds(records, kind, caseId, errors) {
  const seen = new Set();
  for (const record of records) {
    if (!isObject(record)) {
      errors.push(caseId + ': ' + kind + ' record must be an object');
      continue;
    }
    const id = record[kind];
    if (!nonemptyString(id)) errors.push(caseId + ': missing ' + kind);
    if (seen.has(id)) errors.push(caseId + ': duplicate ' + kind + ' ' + JSON.stringify(id));
    seen.add(id);
  }
}

export function alignmentForCase(evaluationCase) {
  const normalization = evaluationCase.normalization;
  if (!normalization) return createAlignmentTable(evaluationCase.source_text, evaluationCase.source_text);
  return createAlignmentTable(
    evaluationCase.source_text,
    normalization.normalized_text,
    normalization.normalized_to_original,
    normalization.name
  );
}

function resourceErrors(run) {
  const errors = [];
  let totalSource = 0;
  let totalCandidates = 0;
  let totalComparisons = 0;
  if (run.cases.length > EVALUATION_LIMITS.maxCases) {
    errors.push('evaluation exceeds the corpus case limit');
    return errors;
  }
  for (const evaluationCase of run.cases) {
    if (!isObject(evaluationCase)) continue;
    const caseId = nonemptyString(evaluationCase.case_id) ? evaluationCase.case_id : '<missing case_id>';
    const sourceLength = typeof evaluationCase.source_text === 'string' ? evaluationCase.source_text.length : 0;
    const normalizedLength = typeof evaluationCase.normalization?.normalized_text === 'string' ? evaluationCase.normalization.normalized_text.length : 0;
    totalSource += sourceLength + normalizedLength;
    if (sourceLength > EVALUATION_LIMITS.maxSourceCodeUnitsPerCase || normalizedLength > EVALUATION_LIMITS.maxSourceCodeUnitsPerCase) errors.push(caseId + ': text exceeds the per-case UTF-16 code-unit limit');
    const expected = Array.isArray(evaluationCase.expected_contradictions) ? evaluationCase.expected_contradictions : [];
    const actual = Array.isArray(evaluationCase.actual_findings) ? evaluationCase.actual_findings : [];
    let oversized = false;
    if (expected.length > EVALUATION_LIMITS.maxExpectedContradictionsPerCase) {
      errors.push(caseId + ': too many expected contradictions');
      oversized = true;
    }
    if (actual.length > EVALUATION_LIMITS.maxActualFindingsPerCase) {
      errors.push(caseId + ': too many actual findings');
      oversized = true;
    }
    for (const actualRecord of actual) {
      if (isObject(actualRecord) && Array.isArray(actualRecord.anchors) && actualRecord.anchors.length > EVALUATION_LIMITS.maxAnchorsPerFinding) {
        errors.push(caseId + ': too many actual anchors');
        oversized = true;
      }
    }
    if (oversized) continue;
    let candidatePairs = 0;
    let comparisons = 0;
    for (const expectedRecord of expected) {
      if (!isObject(expectedRecord)) continue;
      const spans = Array.isArray(expectedRecord.evidence_spans) ? expectedRecord.evidence_spans : [];
      if (spans.length > EVALUATION_LIMITS.maxEvidenceSpansPerContradiction) {
        errors.push(caseId + ': too many expected evidence spans');
        continue;
      }
      for (const actualRecord of actual) {
        if (!isObject(actualRecord) || actualRecord.rule_id !== expectedRecord.rule_id) continue;
        const anchors = Array.isArray(actualRecord.anchors) ? actualRecord.anchors : [];
        candidatePairs++;
        comparisons += spans.length * anchors.length;
      }
    }
    if (candidatePairs > EVALUATION_LIMITS.maxCandidatePairsPerCase) errors.push(caseId + ': too many same-rule candidate pairs');
    if (comparisons > EVALUATION_LIMITS.maxLocalizationComparisonsPerCase) errors.push(caseId + ': too many evidence localization comparisons');
    totalCandidates += candidatePairs;
    totalComparisons += comparisons;
  }
  if (totalSource > EVALUATION_LIMITS.maxTotalSourceCodeUnits) errors.push('evaluation exceeds the corpus UTF-16 code-unit limit');
  if (totalCandidates > EVALUATION_LIMITS.maxCandidatePairsPerRun) errors.push('evaluation exceeds the corpus candidate-pair limit');
  if (totalComparisons > EVALUATION_LIMITS.maxLocalizationComparisonsPerRun) errors.push('evaluation exceeds the corpus localization-comparison limit');
  return errors;
}

function validateCases(cases) {
  const errors = [];
  const caseIds = new Set();
  for (const evaluationCase of cases) {
    if (!isObject(evaluationCase)) continue;
    const caseId = nonemptyString(evaluationCase.case_id) ? evaluationCase.case_id : '<missing case_id>';
    if (caseIds.has(caseId)) errors.push('duplicate case_id ' + JSON.stringify(caseId));
    caseIds.add(caseId);
    if (!nonemptyString(evaluationCase.case_id) || !nonemptyString(evaluationCase.document_id)) errors.push(caseId + ': case_id and document_id are required');
    if (typeof evaluationCase.source_text !== 'string') errors.push(caseId + ': source_text must be a string');
    if (!Array.isArray(evaluationCase.expected_contradictions) || !Array.isArray(evaluationCase.actual_findings)) {
      errors.push(caseId + ': expected_contradictions and actual_findings must be arrays');
      continue;
    }
    let table;
    try { table = alignmentForCase(evaluationCase); } catch (error) { errors.push(caseId + ': ' + error.message); continue; }
    uniqueIds(evaluationCase.expected_contradictions, 'contradiction_id', caseId, errors);
    uniqueIds(evaluationCase.actual_findings, 'finding_id', caseId, errors);
    for (const expected of evaluationCase.expected_contradictions) {
      if (!isObject(expected)) continue;
      if (!nonemptyString(expected.rule_id) || !nonemptyString(expected.scope)) errors.push(caseId + ': every expected contradiction requires rule_id and scope');
      if (expected.pair_mode !== undefined && !['ordered', 'unordered'].includes(expected.pair_mode)) errors.push(caseId + ': invalid pair_mode');
      if (!Array.isArray(expected.evidence_spans) || !expected.evidence_spans.length) {
        errors.push(caseId + ': ' + expected.contradiction_id + ' requires evidence spans');
        continue;
      }
      uniqueIds(expected.evidence_spans, 'span_id', caseId + ':' + expected.contradiction_id, errors);
      expected.evidence_spans.forEach((span, index) => validateSpan(span, table.normalizedText, caseId + ':' + expected.contradiction_id + ':span[' + index + ']', errors));
      if (expected.evidence_spans.every((span) => isObject(span) && Number.isInteger(span.start) && Number.isInteger(span.end) && span.start < span.end)) {
        try {
          const locations = new Set();
          for (const span of expected.evidence_spans) {
            const mapped = mapNormalizedSpan(span, table);
            const location = mapped.start + ':' + mapped.end;
            if (locations.has(location)) errors.push(caseId + ': ' + expected.contradiction_id + ' has duplicate expected evidence locations');
            locations.add(location);
          }
        } catch (error) { errors.push(caseId + ': ' + error.message); }
      }
    }
    for (const actual of evaluationCase.actual_findings) {
      if (!isObject(actual)) continue;
      if (!nonemptyString(actual.rule_id) || !nonemptyString(actual.scope)) errors.push(caseId + ': every actual finding requires rule_id and scope');
      if (!Array.isArray(actual.anchors)) {
        errors.push(caseId + ': ' + actual.finding_id + ' anchors must be an array');
        continue;
      }
      uniqueIds(actual.anchors, 'anchor_id', caseId + ':' + actual.finding_id, errors);
      actual.anchors.forEach((anchor, index) => validateSpan(anchor, evaluationCase.source_text, caseId + ':' + actual.finding_id + ':anchor[' + index + ']', errors));
    }
    if (evaluationCase.exclusion !== undefined && (!isObject(evaluationCase.exclusion) || !nonemptyString(evaluationCase.exclusion.reason))) errors.push(caseId + ': exclusion requires a reason');
  }
  return errors;
}

export function validateEvaluationRun(run) {
  if (!isObject(run) || !Array.isArray(run.cases)) {
    const errors = validateEvaluationSchema(run);
    if (!errors.length) errors.push('Evaluation input requires a cases array');
    return errors;
  }
  const limitErrors = resourceErrors(run);
  if (limitErrors.length) return limitErrors;
  const errors = validateEvaluationSchema(run);
  if (!isObject(run.manifest)) errors.push('Evaluation input requires a machine-readable manifest');
  const requiredManifest = ['dataset_id', 'dataset_revision', 'dataset_sha512', 'dataset_license', 'evaluator_revision', 'engine_commit', 'ruleset', 'reference_time', 'code_version'];
  for (const key of requiredManifest) {
    if (!nonemptyString(run.manifest?.[key])) errors.push('manifest.' + key + ' is required');
  }
  if (run.manifest && !/^[0-9a-f]{128}$/.test(run.manifest.dataset_sha512 || '')) errors.push('manifest.dataset_sha512 must be lowercase SHA-512');
  if (!isObject(run.manifest?.options)) errors.push('manifest.options must be an object');
  errors.push(...validateCases(run.cases));
  return errors;
}

function exactSpanMatches(expectedSpans, actualAnchors) {
  const actualToExpected = new Map();
  function assign(expectedIndex, seen) {
    for (let actualIndex = 0; actualIndex < actualAnchors.length; actualIndex++) {
      if (seen.has(actualIndex) || !sameSpan(expectedSpans[expectedIndex], actualAnchors[actualIndex])) continue;
      seen.add(actualIndex);
      if (!actualToExpected.has(actualIndex) || assign(actualToExpected.get(actualIndex), seen)) {
        actualToExpected.set(actualIndex, expectedIndex);
        return true;
      }
    }
    return false;
  }
  for (let index = 0; index < expectedSpans.length; index++) assign(index, new Set());
  return actualToExpected.size;
}

function exactOrdered(expected, actual) {
  return expected.length === actual.length && expected.every((span, index) => sameSpan(span, actual[index]));
}

function exactUnordered(expected, actual) {
  return expected.length === actual.length && exactSpanMatches(expected, actual) === expected.length;
}

function tokenF1(expectedText, actualText) {
  return binaryMetrics(tokenOverlapCounts(expectedText, actualText)).f1;
}

function scaledTokenF1(expectedText, actualText) {
  const value = tokenF1(expectedText, actualText);
  return typeof value === 'number' ? BigInt(Math.round(value * Number(TOKEN_SCALE))) : 0n;
}

// Successive shortest augmenting paths give a maximum-cardinality, minimum-cost
// assignment. Non-negative forward costs plus potentials keep every Dijkstra
// reduced cost non-negative; BigInt avoids quality-weight rounding.
export function optimalAssignment(left, right, edgeCost) {
  if (!left.length || !right.length) return [];
  const source = 0;
  const leftOffset = 1;
  const rightOffset = leftOffset + left.length;
  const sink = rightOffset + right.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  function addEdge(from, to, cost, metadata = null) {
    const forward = { to, capacity: 1, cost, reverse: graph[to].length, metadata };
    const reverse = { to: from, capacity: 0, cost: -cost, reverse: graph[from].length, metadata: null };
    graph[from].push(forward);
    graph[to].push(reverse);
  }
  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) addEdge(source, leftOffset + leftIndex, 0n);
  for (let rightIndex = 0; rightIndex < right.length; rightIndex++) addEdge(rightOffset + rightIndex, sink, 0n);
  const candidateEdges = [];
  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
      const from = leftOffset + leftIndex;
      const edgeIndex = graph[from].length;
      addEdge(from, rightOffset + rightIndex, edgeCost(leftIndex, rightIndex), { leftIndex, rightIndex });
      candidateEdges.push({ from, edgeIndex });
    }
  }
  const potential = Array(graph.length).fill(0n);
  while (true) {
    const distance = Array(graph.length).fill(null);
    const parent = Array(graph.length).fill(null);
    const visited = Array(graph.length).fill(false);
    distance[source] = 0n;
    for (let iteration = 0; iteration < graph.length; iteration++) {
      let current = -1;
      for (let node = 0; node < graph.length; node++) {
        if (visited[node] || distance[node] === null) continue;
        if (current === -1 || distance[node] < distance[current]) current = node;
      }
      if (current === -1) break;
      visited[current] = true;
      for (let edgeIndex = 0; edgeIndex < graph[current].length; edgeIndex++) {
        const edge = graph[current][edgeIndex];
        if (!edge.capacity) continue;
        const nextDistance = distance[current] + edge.cost + potential[current] - potential[edge.to];
        if (distance[edge.to] === null || nextDistance < distance[edge.to]) {
          distance[edge.to] = nextDistance;
          parent[edge.to] = { from: current, edgeIndex };
        }
      }
    }
    if (distance[sink] === null) break;
    for (let node = 0; node < graph.length; node++) {
      if (distance[node] !== null) potential[node] += distance[node];
    }
    let node = sink;
    while (node !== source) {
      const step = parent[node];
      const edge = graph[step.from][step.edgeIndex];
      edge.capacity = 0;
      graph[node][edge.reverse].capacity = 1;
      node = step.from;
    }
  }
  const pairs = [];
  for (const candidate of candidateEdges) {
    const edge = graph[candidate.from][candidate.edgeIndex];
    if (!edge.capacity && edge.metadata) pairs.push(edge.metadata);
  }
  return pairs;
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function matchEvidenceSpans(expectedSpans, actualAnchors) {
  const expected = expectedSpans.map((span, originalIndex) => ({ span, originalIndex })).sort((a, b) => compareStrings(a.span.span_id, b.span.span_id) || a.originalIndex - b.originalIndex);
  const actual = actualAnchors.map((anchor, originalIndex) => ({ anchor, originalIndex })).sort((a, b) => compareStrings(a.anchor.anchor_id, b.anchor.anchor_id) || a.originalIndex - b.originalIndex);
  const maxMatches = Math.min(expected.length, actual.length);
  let maxDistance = 0;
  for (const left of expected) {
    for (const right of actual) {
      maxDistance = Math.max(maxDistance, Math.abs(left.span.start - right.anchor.start) + Math.abs(left.span.end - right.anchor.end));
    }
  }
  const tieBase = BigInt(maxMatches * expected.length * actual.length + 1);
  const distanceWeight = tieBase;
  const tokenWeight = distanceWeight * BigInt(maxMatches * maxDistance + 1);
  const exactWeight = tokenWeight * BigInt(maxMatches * Number(TOKEN_SCALE) + 1);
  const pairs = optimalAssignment(expected, actual, (leftIndex, rightIndex) => {
    const span = expected[leftIndex].span;
    const anchor = actual[rightIndex].anchor;
    const exact = sameSpan(span, anchor);
    const token = scaledTokenF1(span.quote, anchor.quote);
    const distance = Math.abs(span.start - anchor.start) + Math.abs(span.end - anchor.end);
    const tie = BigInt(leftIndex * actual.length + rightIndex);
    return (exact ? 0n : exactWeight) + (TOKEN_SCALE - token) * tokenWeight + BigInt(distance) * distanceWeight + tie;
  });
  return pairs.map((pair) => ({
    expected: expected[pair.leftIndex].span,
    actual: actual[pair.rightIndex].anchor,
    expectedIndex: expected[pair.leftIndex].originalIndex,
    actualIndex: actual[pair.rightIndex].originalIndex
  })).sort((a, b) => a.expectedIndex - b.expectedIndex);
}

function candidateScore(expected, actual) {
  const intersection = exactSpanMatches(expected.aligned_spans, actual.anchors);
  const tokenAssignment = matchEvidenceSpans(expected.aligned_spans, actual.anchors);
  const tokenTotalScaled = tokenAssignment.reduce((sum, pair) => sum + scaledTokenF1(pair.expected.quote, pair.actual.quote), 0n);
  return {
    task: (expected.pair_mode || 'ordered') === 'unordered' ? exactUnordered(expected.aligned_spans, actual.anchors) : exactOrdered(expected.aligned_spans, actual.anchors),
    ordered: exactOrdered(expected.aligned_spans, actual.anchors),
    unordered: exactUnordered(expected.aligned_spans, actual.anchors),
    intersection,
    tokenTotalScaled
  };
}

function matchRuleGroup(expectedEntries, actualEntries) {
  const expected = expectedEntries.slice().sort((a, b) => compareStrings(a.record.contradiction_id, b.record.contradiction_id) || a.index - b.index);
  const actual = actualEntries.slice().sort((a, b) => compareStrings(a.record.finding_id, b.record.finding_id) || a.index - b.index);
  const maxMatches = Math.min(expected.length, actual.length);
  const maxSpans = expected.reduce((maximum, entry) => Math.max(maximum, entry.record.aligned_spans.length), 0);
  const scores = expected.map((left) => actual.map((right) => candidateScore(left.record, right.record)));
  const tokenWeight = 1n;
  const intersectionWeight = tokenWeight * BigInt(maxMatches * maxSpans * Number(TOKEN_SCALE) + 1);
  const unorderedWeight = intersectionWeight * BigInt(maxMatches * maxSpans + 1);
  const orderedWeight = unorderedWeight * BigInt(maxMatches + 1);
  const taskWeight = orderedWeight * BigInt(maxMatches + 1);
  const tieBase = BigInt(maxMatches * expected.length * actual.length + 1);
  return optimalAssignment(expected, actual, (leftIndex, rightIndex) => {
    const score = scores[leftIndex][rightIndex];
    const qualityCost = (score.task ? 0n : taskWeight)
      + (score.ordered ? 0n : orderedWeight)
      + (score.unordered ? 0n : unorderedWeight)
      + BigInt(maxSpans - score.intersection) * intersectionWeight
      + (BigInt(maxSpans) * TOKEN_SCALE - score.tokenTotalScaled) * tokenWeight;
    const scopeCost = expected[leftIndex].record.scope === actual[rightIndex].record.scope ? 0n : 1n;
    const tie = BigInt(leftIndex * actual.length + rightIndex);
    return (qualityCost * BigInt(maxMatches + 1) + scopeCost) * tieBase + tie;
  }).map((pair) => ({
    expected: expected[pair.leftIndex].record,
    actual: actual[pair.rightIndex].record,
    expectedIndex: expected[pair.leftIndex].index,
    actualIndex: actual[pair.rightIndex].index
  }));
}

export function matchContradictions(expectedRecords, actualRecords) {
  const limitErrors = resourceErrors({ cases: [{ case_id: '<direct matching>', source_text: '', expected_contradictions: expectedRecords, actual_findings: actualRecords }] });
  if (limitErrors.length) throw new RangeError(limitErrors.join('; '));
  const expected = expectedRecords.map((record) => ({ ...record, aligned_spans: record.aligned_spans || record.evidence_spans }));
  const ruleIds = [...new Set(expected.map((record) => record.rule_id))].sort(compareStrings);
  const matches = [];
  for (const ruleId of ruleIds) {
    const expectedEntries = expected.map((record, index) => ({ record, index })).filter((entry) => entry.record.rule_id === ruleId);
    const actualEntries = actualRecords.map((record, index) => ({ record, index })).filter((entry) => entry.record.rule_id === ruleId);
    matches.push(...matchRuleGroup(expectedEntries, actualEntries));
  }
  matches.sort((a, b) => a.expectedIndex - b.expectedIndex);
  const matchedExpected = new Set(matches.map((match) => match.expectedIndex));
  const matchedActual = new Set(matches.map((match) => match.actualIndex));
  return {
    matches,
    unmatchedExpected: expected.filter((record, index) => !matchedExpected.has(index)),
    unmatchedActual: actualRecords.filter((record, index) => !matchedActual.has(index))
  };
}

function pairCounts(matching, mode) {
  let tp = 0;
  for (const match of matching.matches) {
    const expected = match.expected.aligned_spans;
    const actual = match.actual.anchors;
    const exact = mode === 'ordered' ? exactOrdered(expected, actual)
      : mode === 'unordered' ? exactUnordered(expected, actual)
        : (match.expected.pair_mode || 'ordered') === 'unordered' ? exactUnordered(expected, actual) : exactOrdered(expected, actual);
    if (exact) tp++;
  }
  const incorrect = matching.matches.length - tp;
  return binaryMetrics({ tp, fp: matching.unmatchedActual.length + incorrect, fn: matching.unmatchedExpected.length + incorrect });
}

function documentCounts(expectedCount, actualCount) {
  return binaryMetrics({
    tp: expectedCount > 0 && actualCount > 0 ? 1 : 0,
    fp: expectedCount === 0 && actualCount > 0 ? 1 : 0,
    fn: expectedCount > 0 && actualCount === 0 ? 1 : 0,
    tn: expectedCount === 0 && actualCount === 0 ? 1 : 0
  });
}

function evaluateCase(evaluationCase) {
  const table = alignmentForCase(evaluationCase);
  const expected = evaluationCase.expected_contradictions.map((record) => ({
    ...record,
    aligned_spans: record.evidence_spans.map((span) => ({ ...span, ...mapNormalizedSpan(span, table), normalized_quote: span.quote }))
  }));
  const actual = evaluationCase.actual_findings;
  const matching = matchContradictions(expected, actual);
  const detection = binaryMetrics({ tp: matching.matches.length, fp: matching.unmatchedActual.length, fn: matching.unmatchedExpected.length });
  let matchedSpans = 0;
  let expectedSpans = 0;
  let completePairs = 0;
  let completenessEligible = 0;
  const evidenceCounts = {};
  const tokenCounts = {};
  const tokenF1Values = [];
  const page = { correct: 0, total: 0, excluded_no_mapping: 0 };
  const scope = { correct: 0, total: 0 };
  const pairFailures = [];
  for (const match of matching.matches) {
    const expectedForPair = match.expected.aligned_spans;
    const actualForPair = match.actual.anchors;
    const intersections = exactSpanMatches(expectedForPair, actualForPair);
    matchedSpans += intersections;
    expectedSpans += expectedForPair.length;
    if (expectedForPair.length >= 2) {
      completenessEligible++;
      if (actualForPair.length === expectedForPair.length) completePairs++;
    }
    addCounts(evidenceCounts, { tp: intersections, fp: actualForPair.length - intersections, fn: expectedForPair.length - intersections });
    scope.total++;
    if (match.expected.scope === match.actual.scope) scope.correct++;
    const taskExact = (match.expected.pair_mode || 'ordered') === 'unordered' ? exactUnordered(expectedForPair, actualForPair) : exactOrdered(expectedForPair, actualForPair);
    if (!taskExact) pairFailures.push({ case_id: evaluationCase.case_id, contradiction_id: match.expected.contradiction_id, finding_id: match.actual.finding_id, reason: 'detected contradiction has non-exact evidence pair' });
    const evidenceAssignment = matchEvidenceSpans(expectedForPair, actualForPair);
    const matchedActualAnchors = new Set(evidenceAssignment.map((pair) => pair.actualIndex));
    for (const pair of evidenceAssignment) {
      addCounts(tokenCounts, tokenOverlapCounts(pair.expected.quote, pair.actual.quote));
      tokenF1Values.push(tokenF1(pair.expected.quote, pair.actual.quote));
    }
    expectedForPair.forEach((span, index) => {
      const pair = evidenceAssignment.find((candidate) => candidate.expectedIndex === index);
      if (!pair) {
        addCounts(tokenCounts, tokenOverlapCounts(span.quote, ''));
        tokenF1Values.push(tokenF1(span.quote, ''));
      }
      if (!Number.isInteger(span.page)) {
        page.excluded_no_mapping++;
      } else {
        page.total++;
        if (pair && pair.actual.page === span.page) page.correct++;
      }
    });
    actualForPair.forEach((anchor, index) => {
      if (!matchedActualAnchors.has(index)) addCounts(tokenCounts, tokenOverlapCounts('', anchor.quote));
    });
  }
  const confusionMap = new Map();
  for (const match of matching.matches) {
    const key = JSON.stringify([match.expected.scope, match.actual.scope]);
    confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
  }
  const confusion = [...confusionMap.entries()].map(([key, count]) => {
    const [expectedScope, actualScope] = JSON.parse(key);
    return { expected: expectedScope, actual: actualScope, count };
  }).sort((a, b) => compareStrings(a.expected, b.expected) || compareStrings(a.actual, b.actual));
  const unmatchedFailures = [
    ...matching.unmatchedExpected.map((record) => ({ case_id: evaluationCase.case_id, contradiction_id: record.contradiction_id, reason: 'expected contradiction was not detected' })),
    ...matching.unmatchedActual.map((record) => ({ case_id: evaluationCase.case_id, finding_id: record.finding_id, reason: 'prediction has no expected contradiction with the same rule_id' }))
  ];
  return {
    case_id: evaluationCase.case_id,
    detection,
    exact_pairs: pairCounts(matching, 'ordered'),
    unordered_pairs: pairCounts(matching, 'unordered'),
    task_pairs: pairCounts(matching, 'task'),
    partial: ratioMetrics(matchedSpans, expectedSpans + matching.unmatchedExpected.reduce((sum, record) => sum + record.aligned_spans.length, 0)),
    completeness: ratioMetrics(completePairs, completenessEligible),
    evidence: binaryMetrics(evidenceCounts),
    token: binaryMetrics(tokenCounts),
    token_f1_macro: meanDefined(tokenF1Values),
    page: ratioMetrics(page.correct, page.total),
    page_excluded_no_mapping: page.excluded_no_mapping,
    scope: ratioMetrics(scope.correct, scope.total),
    scope_confusion: confusion,
    normalization_transformations: [evaluationCase.normalization?.name || 'identity'],
    matching,
    failures: [...unmatchedFailures, ...pairFailures]
  };
}

function aggregateDocuments(included) {
  const documents = new Map();
  for (const evaluationCase of included) {
    if (!documents.has(evaluationCase.document_id)) documents.set(evaluationCase.document_id, { expected: 0, actual: 0 });
    const document = documents.get(evaluationCase.document_id);
    document.expected += evaluationCase.expected_contradictions.length;
    document.actual += evaluationCase.actual_findings.length;
  }
  return aggregateMetrics([...documents.entries()].sort((a, b) => compareStrings(a[0], b[0])).map(([, counts]) => documentCounts(counts.expected, counts.actual)));
}

export function evaluateCases(cases) {
  if (!Array.isArray(cases)) throw new TypeError('Evaluation cases must be an array');
  const limitErrors = resourceErrors({ cases });
  if (limitErrors.length) throw new RangeError(limitErrors.join('; '));
  const validationErrors = validateSchemaValue(cases, {
    type: 'array',
    items: { $ref: '#/$defs/EvaluationCase' }
  }, evaluationSchema, '$.cases', []);
  validationErrors.push(...validateCases(cases));
  if (validationErrors.length) throw new TypeError('Evaluation case validation failed: ' + validationErrors.join('; '));
  const included = cases.filter((evaluationCase) => !evaluationCase.exclusion);
  const caseResults = included.map(evaluateCase);
  const scopeConfusion = caseResults.flatMap((result) => result.scope_confusion.map((entry) => ({ case_id: result.case_id, ...entry })));
  return {
    metrics: {
      document_detection: aggregateDocuments(included),
      contradiction_detection: aggregateBinary(caseResults, 'detection'),
      pair_detection: {
        exact: aggregateBinary(caseResults, 'exact_pairs'),
        unordered: aggregateBinary(caseResults, 'unordered_pairs'),
        task: aggregateBinary(caseResults, 'task_pairs'),
        partial_pair_credit: aggregateRatio(caseResults, 'partial'),
        pair_completeness: aggregateRatio(caseResults, 'completeness')
      },
      evidence_localization: {
        exact_span: aggregateBinary(caseResults, 'evidence'),
        token_overlap: {
          ...aggregateBinary(caseResults, 'token'),
          macro_expected_span_f1: meanDefined(caseResults.map((result) => result.token_f1_macro))
        }
      },
      page_localization: {
        ...aggregateRatio(caseResults, 'page'),
        excluded_no_genuine_page_mapping: caseResults.reduce((sum, result) => sum + result.page_excluded_no_mapping, 0)
      },
      scope_classification: {
        ...aggregateRatio(caseResults, 'scope'),
        confusion: scopeConfusion
      }
    },
    caseResults,
    exclusions: cases.filter((evaluationCase) => evaluationCase.exclusion).map((evaluationCase) => ({ case_id: evaluationCase.case_id, reason: evaluationCase.exclusion.reason })),
    failures: caseResults.flatMap((result) => result.failures)
  };
}
