import {
  createAlignmentTable,
  mapNormalizedSpan,
  sameSpan,
  tokenOverlapCounts
} from './span-alignment.mjs';

export const NOT_DEFINED = 'not_defined';

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

function aggregateBinary(caseResults, key) {
  const counts = {};
  const perCase = caseResults.map((result) => result[key]);
  for (const metrics of perCase) addCounts(counts, metrics);
  return {
    micro: binaryMetrics(counts),
    macro: {
      precision: meanDefined(perCase.map((metrics) => metrics.precision)),
      recall: meanDefined(perCase.map((metrics) => metrics.recall)),
      f1: meanDefined(perCase.map((metrics) => metrics.f1))
    }
  };
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

function validatePage(page, label, errors) {
  if (page !== null && (!Number.isInteger(page) || page < 1)) errors.push(label + ' must be null or a positive integer');
}

function validateSpan(span, text, label, errors) {
  if (!span || typeof span !== 'object') {
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
    const id = record[kind];
    if (!nonemptyString(id)) errors.push(caseId + ': missing ' + kind);
    if (seen.has(id)) errors.push(caseId + ': duplicate ' + kind + ' ' + id);
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

export function validateEvaluationRun(run) {
  const errors = [];
  if (!run || typeof run !== 'object' || !Array.isArray(run.cases)) return ['Evaluation input requires a cases array'];
  if (!run.manifest || typeof run.manifest !== 'object') errors.push('Evaluation input requires a machine-readable manifest');
  const requiredManifest = ['dataset_id', 'dataset_revision', 'dataset_sha512', 'dataset_license', 'evaluator_revision', 'engine_commit', 'ruleset', 'reference_time', 'code_version'];
  for (const key of requiredManifest) {
    if (!nonemptyString(run.manifest?.[key])) errors.push('manifest.' + key + ' is required');
  }
  if (run.manifest && !/^[0-9a-f]{128}$/.test(run.manifest.dataset_sha512 || '')) errors.push('manifest.dataset_sha512 must be lowercase SHA-512');
  if (!run.manifest || run.manifest.options === null || typeof run.manifest.options !== 'object' || Array.isArray(run.manifest.options)) errors.push('manifest.options must be an object');
  const caseIds = new Set();
  for (const evaluationCase of run.cases) {
    const caseId = nonemptyString(evaluationCase.case_id) ? evaluationCase.case_id : '<missing case_id>';
    if (caseIds.has(caseId)) errors.push('duplicate case_id ' + caseId);
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
      if (!nonemptyString(expected.rule_id) || !nonemptyString(expected.scope)) errors.push(caseId + ': every expected contradiction requires rule_id and scope');
      if (expected.pair_mode !== undefined && !['ordered', 'unordered'].includes(expected.pair_mode)) errors.push(caseId + ': invalid pair_mode');
      if (!Array.isArray(expected.evidence_spans) || !expected.evidence_spans.length) {
        errors.push(caseId + ': ' + expected.contradiction_id + ' requires evidence spans');
        continue;
      }
      uniqueIds(expected.evidence_spans, 'span_id', caseId + ':' + expected.contradiction_id, errors);
      expected.evidence_spans.forEach((span, index) => validateSpan(span, table.normalizedText, caseId + ':' + expected.contradiction_id + ':span[' + index + ']', errors));
      if (expected.evidence_spans.every((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.start < span.end)) {
        try { expected.evidence_spans.forEach((span) => mapNormalizedSpan(span, table)); } catch (error) { errors.push(caseId + ': ' + error.message); }
      }
    }
    for (const actual of evaluationCase.actual_findings) {
      if (!nonemptyString(actual.rule_id) || !nonemptyString(actual.scope)) errors.push(caseId + ': every actual finding requires rule_id and scope');
      if (!Array.isArray(actual.anchors)) {
        errors.push(caseId + ': ' + actual.finding_id + ' anchors must be an array');
        continue;
      }
      uniqueIds(actual.anchors, 'anchor_id', caseId + ':' + actual.finding_id, errors);
      actual.anchors.forEach((anchor, index) => validateSpan(anchor, evaluationCase.source_text, caseId + ':' + actual.finding_id + ':anchor[' + index + ']', errors));
    }
    if (evaluationCase.exclusion !== undefined && (!evaluationCase.exclusion || !nonemptyString(evaluationCase.exclusion.reason))) errors.push(caseId + ': exclusion requires a reason');
  }
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

function candidateScore(expected, actual) {
  const intersection = exactSpanMatches(expected.aligned_spans, actual.anchors);
  let tokenTotal = 0;
  for (const span of expected.aligned_spans) {
    const scores = actual.anchors.map((anchor) => tokenF1(span.quote, anchor.quote));
    tokenTotal += Math.max(0, ...scores);
  }
  return {
    task: (expected.pair_mode || 'ordered') === 'unordered' ? exactUnordered(expected.aligned_spans, actual.anchors) : exactOrdered(expected.aligned_spans, actual.anchors),
    ordered: exactOrdered(expected.aligned_spans, actual.anchors),
    unordered: exactUnordered(expected.aligned_spans, actual.anchors),
    intersection,
    tokenTotal
  };
}

function compareCandidates(a, b) {
  for (const key of ['task', 'ordered', 'unordered']) {
    if (a.score[key] !== b.score[key]) return a.score[key] ? -1 : 1;
  }
  if (a.score.intersection !== b.score.intersection) return b.score.intersection - a.score.intersection;
  if (a.score.tokenTotal !== b.score.tokenTotal) return b.score.tokenTotal - a.score.tokenTotal;
  return a.actual.finding_id < b.actual.finding_id ? -1 : a.actual.finding_id > b.actual.finding_id ? 1 : 0;
}

export function matchContradictions(expectedRecords, actualRecords) {
  const expected = expectedRecords.map((record) => ({ ...record, aligned_spans: record.aligned_spans || record.evidence_spans }));
  const adjacency = expected.map((expectedRecord) => actualRecords
    .map((actual, actualIndex) => ({ actual, actualIndex, score: candidateScore(expectedRecord, actual) }))
    .filter((candidate) => candidate.actual.rule_id === expectedRecord.rule_id)
    .sort(compareCandidates));
  const order = expected.map((record, index) => index).sort((a, b) => adjacency[a].length - adjacency[b].length || (expected[a].contradiction_id < expected[b].contradiction_id ? -1 : expected[a].contradiction_id > expected[b].contradiction_id ? 1 : 0));
  const actualToExpected = new Map();
  function assign(expectedIndex, seen) {
    for (const candidate of adjacency[expectedIndex]) {
      if (seen.has(candidate.actualIndex)) continue;
      seen.add(candidate.actualIndex);
      if (!actualToExpected.has(candidate.actualIndex) || assign(actualToExpected.get(candidate.actualIndex), seen)) {
        actualToExpected.set(candidate.actualIndex, expectedIndex);
        return true;
      }
    }
    return false;
  }
  for (const index of order) assign(index, new Set());
  const matches = [...actualToExpected.entries()].map(([actualIndex, expectedIndex]) => ({ expected: expected[expectedIndex], actual: actualRecords[actualIndex], expectedIndex, actualIndex }));
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

function bestAnchor(span, anchors) {
  if (!anchors.length) return null;
  const ranked = anchors.map((anchor, index) => {
    const f1 = tokenF1(span.quote, anchor.quote);
    return { anchor, index, exact: sameSpan(span, anchor), f1: f1 === NOT_DEFINED ? 0 : f1, distance: Math.abs(span.start - anchor.start) + Math.abs(span.end - anchor.end) };
  });
  ranked.sort((a, b) => Number(b.exact) - Number(a.exact) || b.f1 - a.f1 || a.distance - b.distance || a.index - b.index);
  return ranked[0].anchor;
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
    if (expectedForPair.length >= 2 && actualForPair.length === expectedForPair.length) completePairs++;
    addCounts(evidenceCounts, { tp: intersections, fp: actualForPair.length - intersections, fn: expectedForPair.length - intersections });
    scope.total++;
    if (match.expected.scope === match.actual.scope) scope.correct++;
    const taskExact = (match.expected.pair_mode || 'ordered') === 'unordered' ? exactUnordered(expectedForPair, actualForPair) : exactOrdered(expectedForPair, actualForPair);
    if (!taskExact) pairFailures.push({ case_id: evaluationCase.case_id, contradiction_id: match.expected.contradiction_id, finding_id: match.actual.finding_id, reason: 'detected contradiction has non-exact evidence pair' });
    for (const span of expectedForPair) {
      const anchor = bestAnchor(span, actualForPair);
      if (anchor) {
        addCounts(tokenCounts, tokenOverlapCounts(span.quote, anchor.quote));
        tokenF1Values.push(tokenF1(span.quote, anchor.quote));
      } else {
        addCounts(tokenCounts, tokenOverlapCounts(span.quote, ''));
        tokenF1Values.push(span.quote.length ? 0 : NOT_DEFINED);
      }
      if (!Number.isInteger(span.page)) {
        page.excluded_no_mapping++;
      } else {
        page.total++;
        if (anchor && anchor.page === span.page) page.correct++;
      }
    }
  }
  const confusionMap = new Map();
  for (const match of matching.matches) {
    const key = match.expected.scope + '\u0000' + match.actual.scope;
    confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
  }
  const confusion = [...confusionMap.entries()].map(([key, count]) => {
    const [expectedScope, actualScope] = key.split('\u0000');
    return { expected: expectedScope, actual: actualScope, count };
  }).sort((a, b) => a.expected < b.expected ? -1 : a.expected > b.expected ? 1 : a.actual < b.actual ? -1 : a.actual > b.actual ? 1 : 0);
  const unmatchedFailures = [
    ...matching.unmatchedExpected.map((record) => ({ case_id: evaluationCase.case_id, contradiction_id: record.contradiction_id, reason: 'expected contradiction was not detected' })),
    ...matching.unmatchedActual.map((record) => ({ case_id: evaluationCase.case_id, finding_id: record.finding_id, reason: 'prediction has no expected contradiction with the same rule_id' }))
  ];
  return {
    case_id: evaluationCase.case_id,
    document: documentCounts(expected.length, actual.length),
    detection,
    exact_pairs: pairCounts(matching, 'ordered'),
    unordered_pairs: pairCounts(matching, 'unordered'),
    task_pairs: pairCounts(matching, 'task'),
    partial: ratioMetrics(matchedSpans, expectedSpans + matching.unmatchedExpected.reduce((sum, record) => sum + record.aligned_spans.length, 0)),
    completeness: ratioMetrics(completePairs, matching.matches.length),
    evidence: binaryMetrics(evidenceCounts),
    token: binaryMetrics(tokenCounts),
    token_f1_macro: meanDefined(tokenF1Values),
    page: ratioMetrics(page.correct, page.total),
    page_excluded_no_mapping: page.excluded_no_mapping,
    scope: ratioMetrics(scope.correct, scope.total),
    scope_confusion: confusion,
    matching,
    failures: [...unmatchedFailures, ...pairFailures]
  };
}

export function evaluateCases(cases) {
  const included = cases.filter((evaluationCase) => !evaluationCase.exclusion);
  const caseResults = included.map(evaluateCase);
  const scopeConfusion = caseResults.flatMap((result) => result.scope_confusion.map((entry) => ({ case_id: result.case_id, ...entry })));
  return {
    metrics: {
      document_detection: aggregateBinary(caseResults, 'document'),
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
