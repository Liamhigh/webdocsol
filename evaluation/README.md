# Development evaluation harness

This directory contains the common **B9 development/CI evaluation harness**. It measures synthetic or separately licensed evaluation records; it is not part of document sealing, deterministic analysis, report generation, verification, or the independent verifier.

The harness cannot create, remove, suppress, reorder, relabel, or otherwise alter production findings. Benchmark results are developer/QC sidecars only. They are not finding confidence, severity, probability of fraud, or courtroom-reliability claims.

## Running

Use Node.js 22.22.2 from the repository root:

```sh
node evaluation/run-evaluation.mjs path/to/input.json --output evaluation/reports/report.json
node tests/evaluation-metrics.test.mjs
```

Without `--output`, the canonical report is written to standard output. Identical validated input produces byte-identical canonical JSON. The harness reads no wall clock, uses no random sampling, sends no telemetry, and imports no production finding adapter.

## Input and reproducibility

`schema.json` is the JSON Schema draft 2020-12 contract for the input. A run contains:

- `EvaluationManifest`: dataset ID, pinned dataset revision and SHA-512, redistribution/license terms, evaluator revision, engine commit, ruleset, complete deterministic options, caller-supplied reference time, and code version.
- `EvaluationCase` records: stable case/document IDs, preserved original source text, expected contradictions, actual findings, and an optional justified exclusion.
- `ExpectedContradiction` records: stable ID, rule ID, scope label, pair mode, and expected evidence spans.
- `ActualFinding` records: stable ID, rule ID, scope label, and actual evidence anchors.

Expected spans and actual anchors carry exact quotations and UTF-16 code-unit offsets. A quotation must equal its addressed source slice exactly; neither gold nor predicted evidence is implicitly trimmed. Page values are positive integers only when a genuine mapping exists, otherwise `null`.

Downloaded datasets and caches belong under `evaluation/.cache/`, which is ignored and is never a production asset. Generated reports belong under `evaluation/reports/`, also ignored. Do not commit confidential documents, extracted evidence, or non-redistributable datasets. Small synthetic source fixtures may be committed outside those ignored directories.

## Normalization and alignment

Expected offsets address `normalization.normalized_text` when normalization is present; actual offsets always address the original `source_text`. `normalized_to_original` contains one original-source boundary for every normalized UTF-16 boundary, including the final boundary. The table must be monotonic, cover the complete original and normalized strings, and name its transformation.

The evaluator maps expected spans through this explicit table before exact comparison. Original evidence text remains unchanged. Normalization transformations are listed in the developer report.

## Metrics

The report deliberately keeps these tasks separate:

1. **Document detection**: whether a document has any expected or predicted contradiction.
2. **Contradiction detection**: deterministic one-to-one matching within the same `rule_id`.
3. **Pair detection**:
   - strict ordered exact-span matching;
   - unordered exact-span matching;
   - task matching using each expectation's `pair_mode`;
   - partial pair credit, including unmatched expectations in the denominator;
   - structural pair completeness.
4. **Evidence localization**: exact-span TP/FP/FN and separate duplicate-sensitive Unicode token-overlap metrics.
5. **Page localization**: accuracy only over expected spans with genuine integer page mappings; missing mappings are counted separately.
6. **Scope classification**: accuracy plus expected/actual scope-confusion records.

TP/FP/FN, precision, recall, and F1 are reported where defined. Zero denominators produce the literal `not_defined`, never silent zero. Micro counts aggregate raw counts; macro means average only cases where the corresponding denominator is defined.

Pair, evidence, page, and scope localization are conditional on contradictions matched by `rule_id`. This avoids double-counting an unmatched detection failure as several localization failures. Unmatched expectations and predictions remain visible as detection failures.

## Failures and exclusions

The developer report contains per-case metrics, unmatched expectations, unmatched predictions, non-exact matched pairs, exclusions with reasons, coverage totals, normalization transformations, and limitations. Excluded cases remain visible in coverage but do not enter metric aggregation.

The regression suite includes hand-calculated values for every metric family, empty predictions, duplicate predictions, exact/reversed/partial/incomplete pairs, crossing spans, Unicode and combining characters, explicit normalization, token multisets, multi-page evidence, missing page mappings, negative documents, scope confusion, failures, exclusions, schema/isolation guards, and repeated CLI byte equality.
