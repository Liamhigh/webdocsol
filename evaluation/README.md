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

`schema.json` is the JSON Schema draft 2020-12 contract for the input. The CLI enforces `schema_version`, required fields, types, and forbidden additional properties before evaluation; the exported evaluation API applies the same case-level schema and semantic checks to direct callers. Semantic checks additionally verify stable IDs, exact quotations, boundaries, normalization, distinct expected evidence locations, and exclusions. A run contains:

- `EvaluationManifest`: dataset ID, pinned dataset revision and SHA-512, redistribution/license terms, evaluator revision, engine commit, ruleset, complete deterministic options, caller-supplied reference time, and code version.
- `EvaluationCase` records: stable case/document IDs, preserved original source text, expected contradictions, actual findings, and an optional justified exclusion.
- `ExpectedContradiction` records: stable ID, rule ID, scope label, pair mode, and expected evidence spans.
- `ActualFinding` records: stable ID, rule ID, scope label, and actual evidence anchors.

Expected spans and actual anchors carry exact quotations and UTF-16 code-unit offsets. A quotation must equal its addressed source slice exactly; neither gold nor predicted evidence is implicitly trimmed. Different expected span IDs may not identify the same mapped source location. Page values are positive integers only when a genuine mapping exists, otherwise `null`.

Downloaded datasets and caches belong under `evaluation/.cache/`, which is ignored and is never a production asset. Generated reports belong under `evaluation/reports/`, also ignored. Do not commit confidential documents, extracted evidence, or non-redistributable datasets. Small synthetic source fixtures may be committed outside those ignored directories.

## Dataset adapters

`contractnli/` converts the pinned official Stanford ContractNLI release (607 NDAs, 17 fixed hypotheses, CC BY 4.0) into the input contract: `download-or-verify.mjs` fetches and hash-verifies the release into the cache, `adapter.mjs` builds schema-valid sharded runs plus a coverage sidecar, and `hypothesis-map.json` is the reviewed hypothesis-to-detector mapping (currently all 17 hypotheses `not_applicable`, so the corpus measures false positives only). See `contractnli/README.md` for the task adaptation and its limits.

`contradoc/` converts the pinned ContraDoc dataset (449 self-contradictory and 442 clean documents, Apache-2.0) into the input contract with exact verbatim evidence anchoring and published scope labels preserved. `verum-exact-metrics.mjs` reports deterministic anchor metrics with per-document ContraDoc-Neg false positives; `official-metric-runner.mjs` reproduces the published BERTScore-threshold task settings from externally supplied scores, labelled `published_comparable`. The two families are never conflated. See `contradoc/README.md`.

`eyecite/` is the read-only citation-parser conformance spike (PR 2.1): a pinned corpus generated from official eyecite 2.7.8, per-port adapters that strip confidence scores, and `compare.mjs` reporting exact agreement per candidate port. `eyecite/DECISION.md` records the outcome: build the narrow neutral parser; no port is vendored. See `eyecite/README.md`.

Evaluation is deliberately bounded: at most 16 MiB of input JSON, 2,048 cases, 4,000,000 total original/normalized UTF-16 code units, 1,000,000 code units per original or normalized case text, 128 expected contradictions and 128 actual findings per case, 128 spans per contradiction or anchors per finding, 16,384 same-rule candidate pairs and 131,072 evidence comparisons per case, with corpus-wide candidate and comparison ceilings of 65,536 and 1,048,576. Identifiers, rule IDs, and scope labels are limited to 256 UTF-16 code units. Oversized arrays are rejected before nested candidate enumeration. Inputs exceeding these limits fail closed before metric calculation. Input must be well-formed UTF-8; malformed byte sequences are rejected rather than replaced. Canonical input and output paths may not resolve to the same dataset, including through symbolic links. Report files are written to a same-directory temporary file and atomically renamed, so concurrent or interrupted writes do not expose a partial report. This is atomic last-writer-wins replacement of the requested output path, not retention of every concurrent run. Untrusted terminal control characters are escaped in CLI diagnostics.

## Normalization and alignment

Expected offsets address `normalization.normalized_text` when normalization is present; actual offsets always address the original `source_text`. `normalized_to_original` contains one original-source boundary for every normalized UTF-16 boundary, including the final boundary. The table must be monotonic, cover the complete original and normalized strings, and name its transformation.

The evaluator maps expected spans through this explicit table before exact comparison. Original evidence text remains unchanged. Normalization transformations are listed in the developer report.

## Metrics

The report deliberately keeps these tasks separate:

1. **Document detection**: whether a document has any expected or predicted contradiction, counted once per distinct included `document_id`.
2. **Contradiction detection**: deterministic one-to-one matching within the same `rule_id`, globally optimized for task-exact and localization quality rather than greedy local pairing. Scope agreement breaks otherwise equal evidence-quality ties before stable IDs.
3. **Pair detection**:
   - strict ordered exact-span matching;
   - unordered exact-span matching;
   - task matching using each expectation's `pair_mode`;
   - partial pair credit, including unmatched expectations in the denominator;
   - structural pair completeness.
4. **Evidence localization**: exact-span TP/FP/FN and separate duplicate-sensitive Unicode token-overlap metrics. Expected spans and actual anchors are assigned one-to-one; unmatched anchors remain token false positives, and combining marks stay attached to their tokens.
5. **Page localization**: accuracy only over expected spans with genuine integer page mappings; missing mappings are counted separately.
6. **Scope classification**: accuracy plus expected/actual scope-confusion records.

TP/FP/FN, precision, recall, and F1 are reported where defined. Zero denominators produce the literal `not_defined`, never silent zero. Micro counts aggregate raw counts; macro means average only cases where the corresponding denominator is defined.

Pair, evidence, page, and scope localization are conditional on contradictions matched by `rule_id`. This avoids double-counting an unmatched detection failure as several localization failures. Unmatched expectations and predictions remain visible as detection failures.

## Failures and exclusions

The developer report contains per-case contradiction/localization metrics, aggregate document-detection metrics, unmatched expectations, unmatched predictions, non-exact matched pairs, exclusions with reasons, coverage totals, normalization transformations, and limitations. Document detection is intentionally omitted from per-case rows because several cases can share a `document_id`. Excluded cases remain visible in coverage but do not enter metric aggregation.

The regression suite includes hand-calculated values for every metric family, empty predictions, duplicate predictions, exact/reversed/partial/incomplete pairs, crossing spans, Unicode and combining characters, explicit normalization, token multisets, multi-page evidence, missing page mappings, negative documents, scope confusion, failures, exclusions, schema/isolation guards, and repeated CLI byte equality.
