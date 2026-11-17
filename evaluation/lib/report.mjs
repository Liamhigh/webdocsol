// Canonical, deterministic developer reporting. No wall clock or production finding adapter.

export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Evaluation JSON cannot contain non-finite numbers');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Evaluation JSON supports plain objects only');
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) output[key] = canonicalize(value[key]);
  }
  return output;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value), null, 2) + '\n';
}

function publicCaseResult(result) {
  return {
    case_id: result.case_id,
    document_detection: result.document,
    contradiction_detection: result.detection,
    pair_detection: {
      exact: result.exact_pairs,
      unordered: result.unordered_pairs,
      task: result.task_pairs,
      partial_pair_credit: result.partial,
      pair_completeness: result.completeness
    },
    evidence_localization: {
      exact_span: result.evidence,
      token_overlap: result.token,
      expected_span_f1: result.token_f1_macro
    },
    page_localization: {
      ...result.page,
      excluded_no_genuine_page_mapping: result.page_excluded_no_mapping
    },
    scope_classification: {
      ...result.scope,
      confusion: result.scope_confusion
    },
    normalization_transformations: [...new Set(result.matching.matches.flatMap((match) => match.expected.aligned_spans.map((span) => span.transformation)))].sort()
  };
}

export function buildEvaluationReport(run, evaluation) {
  const included = run.cases.filter((evaluationCase) => !evaluationCase.exclusion);
  const expected = included.reduce((sum, evaluationCase) => sum + evaluationCase.expected_contradictions.length, 0);
  const actual = included.reduce((sum, evaluationCase) => sum + evaluationCase.actual_findings.length, 0);
  return {
    report_type: 'verum_omnis_developer_evaluation',
    report_version: '1.0.0',
    architectural_owner: 'B9',
    production_finding_effect: 'none',
    manifest: run.manifest,
    coverage: {
      cases_total: run.cases.length,
      cases_included: included.length,
      cases_excluded: run.cases.length - included.length,
      expected_contradictions: expected,
      actual_findings: actual
    },
    metrics: evaluation.metrics,
    cases: evaluation.caseResults.map(publicCaseResult),
    failures: evaluation.failures.slice().sort((a, b) => {
      const left = JSON.stringify([a.case_id, a.contradiction_id || '', a.finding_id || '', a.reason]);
      const right = JSON.stringify([b.case_id, b.contradiction_id || '', b.finding_id || '', b.reason]);
      return left < right ? -1 : left > right ? 1 : 0;
    }),
    exclusions: evaluation.exclusions.slice().sort((a, b) => a.case_id < b.case_id ? -1 : a.case_id > b.case_id ? 1 : 0),
    limitations: [
      'Development evaluation only; these values are not finding confidence, severity, or courtroom reliability.',
      'Document detection, contradiction retrieval, pair matching, evidence localization, page localization, and scope classification are separate tasks.',
      'Pair, evidence, page, and scope localization are conditional on rule_id-matched contradictions; unmatched predictions and expectations remain visible as detection failures.',
      'Page accuracy uses only expected spans with genuine integer page mappings.',
      'Macro means average only cases where the denominator is defined; not_defined is never silently converted to zero.'
    ]
  };
}
