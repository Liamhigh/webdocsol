# ContractNLI evaluation adapter (B9, development/CI only)

Converts the pinned official **Stanford ContractNLI** release, or explicitly
labels caller-supplied unverified inputs, in the Verum Omnis development-
evaluation input contract (`../schema.json`). This directory is never part of
document sealing, deterministic analysis, report generation, verification, or
the independent verifier, and nothing here can create, remove, or alter a
production finding.

## Dataset provenance

- **Source**: Koreeda & Manning, *ContractNLI: A Dataset for Document-level
  Natural Language Inference for Contracts*, Findings of EMNLP 2021
  (2021.findings-emnlp.164), distributed by Hitachi America, Ltd. at
  <https://stanfordnlp.github.io/contract-nli/>.
- **Pinned revision**: `stanfordnlp/contract-nli` gh-pages commit
  `eced6528dd3c1d14d73f9a87df8f7bdbc03126f9` (initial release, 2021-10-05).
- **License**: CC BY 4.0, with the additional Terms and Conditions of Use
  reproduced in the release (`LICENSE`, `TERMS`; both are fetched into the
  cache by the download tool).
- **Contents**: 607 non-disclosure agreements (train 423, dev 61, test 123),
  17 fixed hypotheses per document, labels `Entailment` / `Contradiction` /
  `NotMentioned`, and evidence span annotations for entailed and contradicted
  hypotheses.

## Fetching the dataset

```sh
node evaluation/contractnli/download-or-verify.mjs
```

Downloads `contract-nli.zip` from the pinned official URL (with the
`raw.githubusercontent.com` copy of the same file as mirror) into
`evaluation/.cache/contractnli/`, which is gitignored and never deployed. The
zip's size and SHA-256 are checked before extraction; every extracted member is
checked against its pinned size and SHA-256. If the cache is already present
and valid, no network is used. A cached file that fails its pinned hash is
**not** overwritten — the tool fails closed and asks you to remove it manually.

## Producing an evaluation run

```sh
node evaluation/contractnli/adapter.mjs --split train \
  --engine-commit "$(git rev-parse HEAD)" --ruleset vo-engine-5.7.2-web \
  --reference-time 2026-11-15T00:00:00Z
```

The adapter reads `evaluation/.cache/contractnli/<split>.json`, converts every
document and every hypothesis (no sampling), shards the output so each shard
stays inside every harness resource and serialized-size limit, validates each
shard before writing it, and writes generation-addressed shard files followed
by a `<prefix>.coverage.json` sidecar. The coverage file is the commit pointer
for one complete generation; it names the exact shard files to evaluate. Older
generations are left untouched, so a failed run cannot invalidate the previous
coverage pointer or delete files another process may be using. Run
`node evaluation/run-evaluation.mjs <shard-file-from-coverage> --output <report.json>`
for each listed shard.

The coverage sidecar contains per-hypothesis dispositions, exclusions, and
limitations. An input is attributed to the pinned release only when its bytes
match the split's pinned member size and SHA-256; any other `--input` is marked
caller-supplied/unverified and receives no detector mappings. Engine findings
enter through `--actuals <file.json>` (a JSON object mapping `case_id` to an
array of `ActualFinding` records, as produced by an engine runner); unknown
case IDs, findings for excluded cases, and findings without a reviewed
hypothesis-to-rule mapping are rejected. Dataset and actuals reads are bounded,
and output paths may not alias either input (including through symlinks).

## Task adaptation — read before quoting any number

- **Contradiction retrieval and evidence localization only.** The engine
  detects contradictions; the adapter does not fabricate an entailment
  classifier. `Entailment` and `NotMentioned` documents are negative documents
  for this task; a contradiction finding on them is a false positive.
- **Hypothesis mapping is conservative by rule.** `hypothesis-map.json` maps a
  hypothesis to a Verum detector only when the detector's rule semantics
  genuinely decide the hypothesis. Verum detectors measure contradictions
  between anchored statements inside the sealed record; none compares a
  contract against an external NDA-review hypothesis, so **all 17 hypotheses
  are currently `not_applicable`**. With this mapping the corpus is a negative
  (false-positive) corpus for the engine; contradiction-retrieval metrics
  become defined only when a genuine mapping is reviewed into the map. Changing
  a mapping is a reviewed change to `hypothesis-map.json`, never an adapter
  flag.
- **Spans are source character spans, not page anchors.** ContractNLI span
  offsets are Python string indices (Unicode code points); the adapter converts
  them to UTF-16 code-unit offsets and every evidence quote is verified
  byte-exact against the slice it addresses. `page` is `null` because no
  audited text-to-page rendering of this corpus exists; page accuracy is not
  reported.
- **Pair metrics measure evidence-set agreement.** A ContractNLI contradiction
  is document-vs-hypothesis, not a pair of contradictory statements, so
  expected contradictions use `pair_mode: "unordered"` and pair metrics read as
  unordered evidence-set matching.
- **Coverage is complete.** Parser failures, annotation anomalies, and excluded
  documents are enumerated with reasons in the coverage sidecar and in the
  evaluation report; nothing is silently dropped. Documents that cannot fit a
  single evaluator run are represented by bounded exclusion records. Their
  source is not rewritten or truncated into a finding quote.

No result from this adapter is a finding confidence, a severity, dataset-wide
validation of unrelated detectors, or a courtroom-reliability claim.
