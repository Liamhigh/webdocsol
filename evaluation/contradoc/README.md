# ContraDoc evaluation adapter (B9, development/CI only)

Converts the pinned official **ContraDoc** dataset into the Verum Omnis
development-evaluation input contract (`../schema.json`), and carries the two
deliberately separate metric families. Nothing here is part of document
sealing, deterministic analysis, report generation, verification, or the
independent verifier, and nothing here can create, remove, or alter a
production finding.

## Dataset provenance

- **Source**: *ContraDoc: Understanding Self-Contradictions in Documents with
  Large Language Models* (arXiv 2311.09182), `ddhruvkr/CONTRADOC`.
- **Pinned revision**: commit `d1c42d1e433595dd6e98fab7b669722cdc050b1d`.
- **License**: Apache-2.0 (fetched into the cache by the download tool).
- **Contents**: 449 self-contradictory (positive) and 442 non-contradictory
  (negative) English documents across CNN/DailyMail news, Wikipedia, and story
  summaries, built by GPT-4-Modify insertion/replacement followed by human
  annotation and verification. Positive records carry the evidence sentence
  introducing the contradiction, an optional `ref sentences` list it
  contradicts, a scope label (`intra` / `local` / `global`; one record carries
  the hybrid label `global, intra`, preserved verbatim), a plug type
  (`Insert` / `Replace`), and multi-label contradiction types.

## Fetching the dataset

```sh
node evaluation/contradoc/download-or-verify.mjs
```

Downloads the two pinned files into `evaluation/.cache/contradoc/`
(gitignored, never deployed), checking each against its pinned size and
SHA-256. A valid cache means zero network; a mismatched cached file fails
closed and is never overwritten.

## Producing an evaluation run

```sh
node evaluation/contradoc/adapter.mjs \
  --engine-commit "$(git rev-parse HEAD)" --ruleset vo-engine-5.7.2-web \
  --reference-time 2026-11-15T00:00:00Z
node evaluation/run-evaluation.mjs evaluation/reports/contradoc.json
node evaluation/contradoc/verum-exact-metrics.mjs evaluation/reports/contradoc.json
```

The adapter converts all 891 documents (no sampling), shards the output inside
the harness resource limits, and validates each shard against
`../schema.json` before writing. Engine findings merge through `--actuals
<file.json>` (`case_id` → array of `ActualFinding` records, rule id
`contradoc:self_contradiction`); unknown case IDs are rejected.

## Anchoring and scope rules

- **Exact verbatim location only.** Evidence and `ref sentences` are anchored
  by exact substring match against the preserved document text. A sentence
  that does not occur verbatim exactly once is not force-fit: evidence that
  cannot be located excludes the document with reason
  `evidence_not_located_verbatim`; a `ref sentences` entry that cannot be
  located is omitted and listed per document in the coverage sidecar. Gold
  text is never trimmed or normalized to make a match.
- **Published scope labels are preserved verbatim** as
  `contradoc:<label>`. `CONTRADOC_SCOPE_MAP` in the adapter is the only bridge
  to Verum granularity (`intra` → within-sentence, `local` → nearby,
  `global` → distant); it is an explicit, tested mapping and does not claim
  the taxonomies are identical. The hybrid `global, intra` label stays as
  published and has no mapping entry.
- **Pairs are the contradiction pair.** Expected evidence spans are the
  located `ref sentences` plus the evidence sentence (`pair_mode:
  "unordered"`). The 80 positive documents without `ref sentences` are
  structurally incomplete pairs; the harness reports that rather than hiding
  it. `page` is `null` throughout: the dataset has no audited page mapping.

## Two metric families, never conflated

1. **`verum-exact-metrics.mjs`** (`result_label: "verum_exact"`) —
   deterministic anchor truth through the common harness: exact/token evidence
   spans, complete contradictory pairs, scope classification, document
   detection. ContraDoc-Neg false positives are listed **per document**; a
   clean document with a finding is never hidden by aggregate recall.
2. **`official-metric-runner.mjs`** (`result_label: "published_comparable"`) —
   a deterministic reproduction of the official `eval_metric.py` arithmetic:
   the 20-character direct-find rules, the published BERTScore
   precision/recall threshold of 0.98, top-k capped at five candidates, and
   Judge-then-Find (evidence is evaluated only when the model answers "yes"
   and the document is gold-positive). BERTScore values are **externally
   supplied data** with mandatory provenance (`scores_source`, `score_model`);
   no Python or neural package is required or used here, and none is an
   application runtime dependency.

No result from either family is a finding confidence, a severity, or a
courtroom-reliability claim.
