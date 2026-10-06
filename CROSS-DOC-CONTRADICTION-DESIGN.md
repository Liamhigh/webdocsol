# Design note — cross-document contradiction detection (DRAFT, awaiting founder steer)

Status: **approved; building in three sequenced PRs.** Stage A (document classification + descriptive fact index) is built — `voClassifyPage`/`voExtractPageFacts`/`voBuildFactIndex`, the `factIndex` result and the report's "DOCUMENT FACT INDEX" section, `tests/doc-fact-index.test.mjs` (ENGINE.md §12.21). Stage B (conflict detection) is now BUILT (`voCrossDocConflicts`/`voSameParty`, `crossDocConflicts`, a held "CROSS-DOCUMENT OBSERVATIONS" section, `tests/cross-doc-conflicts.test.mjs`, ENGINE.md §12.22) and its PR is HELD at the stage-C wording sign-off — the exact statements are before the founder and nothing merges until the language is approved. The original design follows.

Original note: **design only, no code.** Prepared 6 October 2026 after the Louw v Naidoo
run (`evidence-bundle-6-docs`, Case 341/2025). This note sits near the
verdict-reservation line, so nothing here ships until the founder approves the
approach. It is not served (`*.md` is in `.assetsignore`).

## 1. The gap this would close

The deterministic engine's contradiction detectors (the D-series / CT types)
compare values **within a passage or a contiguous run**. They do not read a
bundle as a set of *documents with roles* and compare a fact asserted in one
document against the same fact in another. So on the Louw v Naidoo bundle the
engine missed two contradictions that the human forensic narrative caught:

- **Duplicate ownership notices.** SAMSA's own email records that *two* "Notice
  of Change of Ownership of a Vessel" forms, both dated 21/06/2024, exist for one
  vessel (DTD782C) — naming different incoming owners.
- **Swap-then-sale.** A written swap (15/07/2024, confirmed 04/10/2024) passed
  the vessel from Hardouin to Louw; a later "sale" (13/09/2024) purported to pass
  the *same* vessel from Hardouin to Naidoo. One instrument contradicts the other
  on who could transfer the vessel.

These are **factual contradictions across documents**, not legal conclusions. The
engine should be able to anchor them and leave the verdict to the court — exactly
as it already does for within-passage contradictions.

## 2. Hard constraints (non-negotiable)

Whatever is built must obey the Constitution and the Prime Directives:

1. **No verdict.** The output states that two documents assert conflicting facts,
   anchored to page and quote. It never says who owns the vessel, whether a sale
   is valid, or that fraud occurred. "Findings of truth remain for the court."
2. **No severity/score** labels (Prime Directive 1, §15.2).
3. **Deterministic.** No clock, no randomness, no regex lookbehind; the analysis
   instant is passed in. Advisory AI may *assist* a human narrative but must never
   produce a sealed finding.
4. **Anchored or silent.** Every emitted contradiction cites the two documents,
   their pages, and the quoted text on each side. If either side cannot be quoted
   and paged, it is not a finding.
5. **No inference of missing facts.** If a document does not state an owner, the
   engine does not guess one.

## 3. Proposed pipeline (three stages)

### Stage A — document segmentation + classification
The engine already splits a bundle into documents by internal page numbering
(`voDetectDocuments`, the "DOCUMENTS IN THIS BUNDLE" table). Add a **type label**
per document, from deterministic cues in its first page(s):

| Type | Cue (illustrative, deterministic) |
| --- | --- |
| ownership-notice | "notice of change of ownership", "change of ownership of a vessel" |
| sale-agreement | "deed of sale", "sale agreement", "purchase price", "sells to" |
| swap/exchange | "swap", "exchange", "in exchange for", "no money" |
| lease/rental | "lease", "rental", "monthly rental", "lessee" |
| permit/certificate | "permit", "licence", "certificate", "right number" |
| correspondence | email headers, "Dear", "regards" |

Classification is a *hint* for pairing, never asserted as fact in the report.

### Stage B — entity/attribute extraction (per document)
Extract a small, typed fact record from each document, each field carrying its
page + quote:

- `vessel` — registration shape (`DTD\s?\d+\s?[A-Z]`), name in quotes.
- `parties` — names with roles (seller/buyer, lessor/lessee, transferor/transferee),
  reusing the identity-classifier from D06 (an `LF…` right is not a party ID).
- `date` — the instrument's own date (reuse `voExtractDates`, normalised).
- `price` — currency amounts near "purchase price"/"consideration".
- `owner-direction` — "from X to Y" on an ownership/transfer instrument.

No field is invented; a missing field stays null.

### Stage C — same-subject conflicting-attribute detection
Group document fact-records by **shared subject** (same `vessel` registration, or
same contract reference). Within a group, flag a contradiction when the **same
attribute** disagrees across two documents:

- two ownership instruments for one vessel naming **different incoming owners**;
- a swap and a later sale of the **same vessel** by the **same transferor**;
- two instruments dated the **same day** that cannot both be the operative one.

Each flag is emitted as a new CT type (e.g. a cross-document ownership/transfer
conflict) with:

- `evidence`: "Document A (p.X) states <quote>; Document B (p.Y) states <quote> —
  the two cannot both be the operative record; which governs is for the court."
- `anchor`: both documents, both pages, both quotes.
- **no** severity, **no** offence word, **no** owner determination.

## 4. Risks / open questions for the founder

1. **False pairing.** Two genuinely different vessels with similar registrations
   must not be grouped. Mitigation: require an exact normalised vessel key.
2. **Classification drift.** Cue lists are brittle; a mislabel must only *suppress*
   a pairing, never *create* a finding. Fail safe = silent.
3. **Where it renders.** A new "cross-document contradictions" sub-section, or
   folded into the existing contradiction matrix? It must read as descriptive.
4. **Boundary check.** Does "two ownership notices for one vessel" read as a
   neutral factual contradiction, or does naming it edge toward a forgery
   conclusion? The wording must stay at "both cannot be the operative record."
5. **Overlap with the human narrative.** The human forensic report already does
   this analysis well. Is the goal to *surface the pointer* deterministically
   (so a human knows to look), rather than to reproduce the full analysis? That
   framing keeps the engine firmly on the anomaly-detection side of the line.

## 5. Recommendation

Build Stage A + B as a **descriptive document/fact index first** (no contradiction
claims) — it is low-risk, useful on its own, and lets us see extraction quality on
real bundles before Stage C asserts any contradiction. Hold Stage C until the
founder signs off on the wording and the boundary (question 4 above).

_Prepared by Claude Code for founder review. No code has been written for this
feature._
