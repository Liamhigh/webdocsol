# The Verum Omnis Forensic Engine — Definitive Reference

> **This repository's engine is the reference implementation.** Where any other surface
> (Android `1verum`/`cursorfu`, the Fraud Firewall `firebase`) disagrees with it, **this
> engine is correct** and the other surface is the one to fix. Every hard lesson from real
> evidence bundles is encoded here and locked by tests.

**Engine:** `forensic-engine-page.js` — `VO_ENGINE_VERSION = '5.3.5-web'`
**Report:** `forensic-report.js` — `ENGINE_VERSION = '5.3.5-web'`, report builder v1.3.1.
**Findings JSON:** v1.7.0, built by `buildFindingsJson` in `seal-document.html`, not by either
script (1.7.0 adds `display_name`, `brain`, `triple_verification` and `ai_review_note`; 1.6.0
added `analysis_reference_utc`)
**Host page:** `seal-document.html` (the engine, the report and three helper scripts are
inlined — see [§9 Inlining](#9-inlining))
**Governing law:** Constitution v6.1 (engine operating instrument, seal `VO-9E51D3F507E6`);
Constitution v8.0 (governance charter, seal `VO-9A4F3C5E825C`)

---

## 0. If you read nothing else

1. **Do not "simplify" a guard.** Most odd-looking conditions in this engine exist because a
   real bundle produced a false finding. §4 lists the founding guards, each with the case that
   caused it; the guards each later real-bundle run added are recorded in that run's section
   (§12.10–§12.16) and pinned in `tests/annexure-eb-regression.test.mjs` (the Greensky
   re-run's in `tests/greensky-regression.test.js`, the evidence-bundle-7 run's in
   `tests/evidence-bundle-7-regression.test.mjs`).
   Removing one re-introduces a false statement of fact under seal.
2. **Precision beats recall here.** A missed contradiction is a gap; a false contradiction is
   a lie in a court document. Recall is the AI layer's job: on the website the advisory review
   (`/api/v1/ai/assess`) raises AI candidates and Brain 9 (`/api/v1/ai/sweep`) feeds misses to
   the signed-rule loop (§12.7–§12.9); neither ever becomes a sealed finding, and neither ever
   removes or changes one (founder ruling, 5 October 2026, §12.16).
3. **Every finding must be anchored** to quoted text and a page. Unanchorable content findings
   are dropped, not demoted (`voEnforceAnchorRule`).
4. **No scores, no bands, no hedging** in anything a reader sees (Prime Directive 16, §6).
5. **`node tests/run-all.js` must be green and `npm run check` clean before every push.**
   33 suites, 2535 assertions (§10); many exist solely to stop the regressions in §4 and §12.
6. **The report leads with the Constitution's §15.4 template** (§7): cover, contents, sections
   1–7, then the annexes with the plain-language pages first. That order is a founder ruling of
   5 October 2026, not a layout preference. No report calls a finding "verified" (§12.16).
7. **No regex lookbehind in new code** (§4.16). Safari < 16.4 throws at parse time and the
   whole scan dies silently.
8. **Tamper-evident, never immutable.** A SHA-512 fingerprint makes a change detectable; it
   does not prevent one. OpenTimestamps proves a file existed no later than the confirming
   Bitcoin block, never the device clock. No report, certificate or prompt may say a record
   "cannot be altered".
9. **The engine never reads the clock.** The seal page passes the analysis instant as
   `opts.referenceTime` (§8).

---

## 1. Pipeline

```
PDF bytes + pdf-lib PDFDocument (+ opts.referenceTime from the seal page)
  ├─ extractPageText()               text per page: pdf-lib content-stream decoding with ToUnicode CMaps
  ├─ window.voOcrRescuePages()       seal-page hook: on-device OCR (pdf.js render + tesseract.js) for image-only pages
  │                                  (whole-document raw scan, extractPdfText, if per-page text fails)
  ├─ voExcludeTemplatePages()        pages carrying the Verum Omnis analysis-template masthead, excluded in place
  ├─ voExcludeSecondaryReportPages() a prior Verum Omnis report bound into the bundle, excluded in place
  ├─ voNoteAiCompiledSummary()       an AI-compiled summary is scanned but disclosed as secondary
  ├─ voExcludeFooterOnlyPages()      pages whose only text is a seal footer
  ├─ voCacheDocSegs()                document boundaries (voDetectDocuments, §8) read before the furniture goes
  ├─ voStripSealFurnitureBlocks()    this platform's own seal footers removed before detection
  ├─ voSecondaryPages()              pages of extracts, commentaries and a party's submission about other sealed records
  ├─ voMarkdownAnalysisPages()       pages carrying chat-style markdown (bold runs, ## headings): a rendered AI or chat analysis (§12.15)
  ├─ DETECTORS D01–D36, D38–D40      each returns findings[] (§3)
  ├─ contextOnly split               CT38 / CT43 breadth notes go to the engine notes, never the findings
  ├─ voDatedAfterReference()         a first-page "Date:" later than opts.referenceTime's day becomes an engine note
  ├─ D37 catch-all                   reads the other detectors' findings
  ├─ detectSerialPatterns()          17 multi-stage patterns, 3-page window
  ├─ voDemoteSecondarySource()       findings wholly on secondary pages become leads in the engine notes
  ├─ voRunPackageRules()             signed rule package from globalThis.voRulePackage, additive (§12.7); inert when absent
  ├─ voDigitalForensicsScan()        raw PDF structure: revisions, saves after signing, embedded files
  ├─ dedupe + MAX_PER_TYPE = 25      verbatim repeats and over-cap findings withheld, and disclosed
  ├─ voBackfillPageAnchors()         pins each finding to the page(s) its evidence resolves to
  ├─ OCR consequences                CT15/CT22 read below OCR confidence 60 become notes; voCapOcrFormatFindings holds OCR-only findings
  ├─ voEnforceAnchorRule()           unanchorable content findings move to the notes (§5)
  ├─ voAnchorEnrich()                WHO / WHERE / WHAT / WHEN / provision per finding
  ├─ voDetectSwornPages()            oath language per page; findings on those pages get swornContext (§4.18)
  ├─ internal weighting              per-type confidence, overallScore and band: internal only, never printed (§6)
  ├─ false-clean guard               zero findings at < 200 characters a page over >= 3 pages is UNREADABLE, never clean
  └─ generateSummary()               the count and a read-against-the-page instruction, or the clean sentence (never the score, §12.16)
        ↓
   result → seal page: applyBundleMode (§4.8) → AI review / Brain 9 → buildFindingsJson (v1.7.0)
          → forensic-report.js build() → seal()
```

The seal page, not the engine, restores a CropBox that hides part of a page
(`voCropHidesContent`, called by `voNormalizeSealPageBoxes` before stamping).

`runForensicEngine(bytes, pdfDoc, onProgress, opts)` is the single entry point (`opts.referenceTime`, an ISO instant the caller passes, dates the "document dated after its analysis" note; the engine never reads the clock). It is **pure and
deterministic**: no `Date.now()`, no `Math.random()`, no network, no hidden state. Its only
other inputs are two hooks the seal page sets: `window.voOcrRescuePages` (on-device OCR) and
`globalThis.voRulePackage` (a verified signed rule package). Determinism therefore means: the
same text layer, the same OCR text and the same rule package give the same findings. OCR itself
can differ by device (the per-page time limit and the page cap), and the report and findings
JSON name the package applied. With neither hook set (the Node test harness), the results are
the built-in engine's. Same input → same findings, on any device, forever. This is Prime
Directive 4 and it is what makes a sealed report reproducible years later.

**Observed in the field (recorded 2026-08-21, #164, on the engine of that date; the two sealed
reports are not in this repository).** The same three-document bundle was
sealed twice as two separate sealing events and analysed independently; the two sealed reports
carried the same findings at the same page anchors (CT44 at pp. 8 vs 15; CT45 at pp. 11 vs 75
and p. 2; CT09 at pp. 134, 470, 473). Determinism is the property that lets a reader distinguish
a measurement from an opinion — treat any change that could make two runs differ as a
constitutional breach, not a bug.

---

## 2. Contradiction types (CT01–CT46)

46 types, grouped by engine category. `CONTRADICTION_TYPES` in the engine is the source of
truth; `CT_NAMES` / `CT_CATEGORY` / `NARRATIVE_MEANING` in `forensic-report.js` must stay in
step, and `worker/rule-format.md` documents the wire format.

| Category | Types |
|---|---|
| **STATEMENTAL** | CT01 Direct Statement Contradiction · CT02 Numerical Discrepancy · CT03 Date Inconsistency · CT04 Temporal Sequence Break · CT05 Causal Impossibility · CT06 Logical Impossibility · CT07 Scope Creep Indicator · CT08 Term Definition Contradiction |
| **IDENTITY** | CT09 Identity Contradiction · CT10 Role Contradiction · CT11 Authority Contradiction · CT12 Name Spelling Variation · CT13 Title Inconsistency · CT14 Entity Status Contradiction · CT46 Role / Capacity Contradiction |
| **FINANCIAL** | CT15 Amount Discrepancy · CT16 Currency Mismatch · CT17 Account Number Invalidity · CT18 Bank Detail Mismatch · CT19 VAT Number Invalid · CT20 Registration Number Fake · CT21 Quotation Mismatch · CT22 Financial Calculation Error |
| **INTEGRITY** | CT23 Signature Mismatch · CT24 Metadata Contradiction · CT25 Font Inconsistency · CT26 Format Anomaly · CT27 Layout Manipulation · CT28 Image Integrity Failure · CT29 Timestamp Manipulation · CT30 Version Control Anomaly |
| **CROSS_REF** | CT31 Cross-Reference Failure · CT32 Source Attribution Failure · CT33 Legal Reference Invalid · CT34 Precedent Violation · CT35 Procedure Breach |
| **CONTACT** | CT36 Address Contradiction · CT37 Contact Detail Mismatch · CT38 Jurisdictional Impossibility |
| **EVIDENCE** | CT39 Chain of Custody Break · CT40 Witness Statement Conflict · CT41 Evidence Tampering Indicator |
| **DIGITAL** | CT42 Digital Footprint Mismatch · CT43 Document Internal Conflict |
| **FRANCHISE_LEASE** | CT44 Conditional Clause Misinvoked (Lessee/Owner Trap) · CT45 Asset Value Recognised Then Denied (Goodwill) |

No built-in detector emits CT12, CT13, CT17, CT21 or CT34; they are in the taxonomy for signed
rule packages and AI candidates.

**Codes are permanent.** `tests/constitution-lock.test.mjs` pins load-bearing codes by name.
An external contradiction database once numbered its own CT23 as something else; two meanings
for one code in a court-facing document is a credibility attack, so renumbering fails the build.

---

## 3. Detector inventory (D01–D40)

Each detector is a pure function returning findings[]. Most take `textBlocks` (one string per
page); D15 and D20 take the pdf-lib document, D16 takes `(textBlocks, pdfDoc)`, and D37 takes
`(textBlocks, otherFindings)` and runs after the other 39.

| Detector | Emits | What it establishes |
|---|---|---|
| D01 `DETECT_DIRECT_CONTRADICTION` | CT01 | The document both affirms and negates the same term |
| D02 `DETECT_NUMERICAL_DISCREPANCY` | CT02 | The same labelled quantity is given two different numbers; the same invoice number totalled at two amounts |
| D03 `DETECT_DATE_INCONSISTENCY` | CT03 | Impossible or conflicting dates |
| D04 `DETECT_TEMPORAL_IMPOSSIBILITY` | CT04 | Event ordering that cannot have happened |
| D05 `DETECT_LOGICAL_IMPOSSIBILITY` | CT06 | Mutually exclusive statements |
| D06 `DETECT_IDENTITY_CONFLICT` | CT09 | Identity details that do not line up |
| D07 `DETECT_ROLE_CONTRADICTION` | CT10 | One party in incompatible roles |
| D08 `DETECT_AUTHORITY_EXCEEDED` | CT11 | Acts beyond stated authority; a signatory whose stated revocation is followed by a later dated act |
| D09 `DETECT_ENTITY_STATUS_FAKE` | CT14 | An entity asserted both active and liquidated/dissolved |
| D10 `DETECT_VAT_INVALID` | CT19 | VAT number not in a valid format |
| D11 `DETECT_REGISTRATION_FAKE` | CT20 | Company registration number not in a valid format |
| D12 `DETECT_BANK_DETAIL_MISMATCH` | CT18 | Conflicting account numbers |
| D13 `DETECT_CALCULATION_ERROR` | CT22, CT15 | Arithmetic that does not add up |
| D14 `DETECT_AMOUNT_ROUNDING_ANOMALY` | CT15 | Amount discrepancies |
| D15 `DETECT_METADATA_FRAUD` | CT24, CT29 | Metadata / timestamp manipulation |
| D16 `DETECT_FONT_ANOMALY` | CT25 | Line-length variance on a page (unsound, and unreachable on production blocks, which carry no line breaks; open with the founder, §12.14 (d): do not revive it by restoring newlines) |
| D17 `DETECT_FORMAT_ANOMALY` | CT26 | Near-empty pages among full ones |
| D18 `DETECT_PAGE_MANIPULATION` | CT27 | Layout / page-number manipulation |
| D19 `DETECT_EVIDENCE_TAMPERING` | CT41 | Explicit tampering indicators in text |
| D20 `DETECT_DIGITAL_FOOTPRINT_MISMATCH` | CT42 | Digital traces inconsistent with claimed origin |
| D21 `DETECT_MISSING_APPENDIX` | CT31 | A referenced annexure that is not in the document |
| D22 `DETECT_INVALID_LEGAL_REF` | CT33 | A cited section that does not exist |
| D23 `DETECT_PROCEDURE_BREACH` | CT35 | Stated procedure not followed |
| D24 `DETECT_ADDRESS_CONFLICT` | CT36 | Conflicting addresses |
| D25 `DETECT_CONTACT_MISMATCH` | CT37 | A lookalike email domain: two domains one or two characters apart, both on native-text pages; two domains under listed restricted government suffixes (gov.za, .gov, .mil, gouv.fr …) are exempt (§12.12 item 5, §12.14) |
| D26 `DETECT_JURISDICTIONAL_ISSUE` | CT38 | Jurisdictional impossibility (**contextOnly**, unscored — see §4.6) |
| D27 `DETECT_CUSTODY_GAP` | CT39 | Chain-of-custody break |
| D28 `DETECT_WITNESS_CONFLICT` | CT40 | Witness statements in conflict |
| D29 `DETECT_SCOPE_CREEP` | CT07 | Scope expanded beyond the original references |
| D30 `DETECT_TERM_DEFINITION_CONFLICT` | CT08 | A defined term given two **materially different** definitions |
| D31 `DETECT_CAUSAL_IMPOSSIBILITY` | CT05 | Received-before-sent style impossibility **inside one sentence** |
| D32 `DETECT_SIGNATURE_ANOMALY` | CT23 | A non-standard signature method (`/s/`, per pro, by proxy), or the record's own words that an agreement was never signed or countersigned (reported as "Unsigned Agreement Stated", a contract question; a category plural is skipped, §12.14) |
| D33 `DETECT_IMAGE_MANIPULATION` | CT28 | Image integrity failure |
| D34 `DETECT_CURRENCY_FRAUD` | CT16 | Currency mismatch |
| D35 `DETECT_VERSION_ANOMALY` | CT30 | Version-control anomaly |
| D36 `DETECT_SOURCE_FAILURE` | CT32 | Source attribution failure |
| D37 `DETECT_INTERNAL_CONFLICT_CATCHALL` | CT43 | Clause-numbering discontinuity (a heading numbered N whose first sub-clause is numbered N+1..N+3 — template-surgery fingerprint, §4.17); plus a breadth note (8 or more finding types) routed to the engine notes, never counted; runs after the other detectors, before the serial patterns, the rule package and the digital-forensics scan |
| D38 `DETECT_CONDITIONAL_CLAUSE_MISINVOKED` | CT44 | A right exercised on a condition the record itself contradicts (the "Lessee/Owner trap") |
| D39 `DETECT_ASSET_VALUE_DENIAL` | CT45 | Value/goodwill recognised in one place and denied in another |
| D40 `DETECT_ROLE_CAPACITY_CONFLICT` | CT46 | A party acting in a corporate capacity while the instrument is personal, or a stated restriction breached |

**D38/D39/D40 are generic.** They were derived from the AllFuels/Caltex franchise matter but
contain **no hardcoded parties, names or account numbers**. Never add any — an engine that
names a party in its own code fabricates evidence rather than measuring it.

---

## 4. False-positive guards — DO NOT REMOVE

Each guard exists because a real bundle produced a false finding that a reviewer read as
fabrication. Each is pinned by a regression test using the **exact string from the real
document**. If a guard looks over-complicated, that is the scar tissue; read the case first.

### 4.1 D30 / CT08 — glossary repetition and OCR noise
A definitions chapter restated in an index defines every term twice, **identically** — one run
produced 25 such non-findings. A bundle containing the **same agreement bound twice** then
produced 8 more, because OCR re-read `CALTEX` as `CAL TEX`, `than` as `thari`, `portion` as
`portions`.

**Guard:** definitions fire only when the wording **materially differs** — letters-and-digits
compared over the shared length, requiring **>10% edit distance**. Identical text stays silent;
OCR jitter stays silent; a real rewrite (`Expiration Date` vs `Termination Date`) still fires,
quoting both versions.
**Tests:** `detector-recall.test.mjs` — identical-definition silence, CAL TEX/thari silence,
singular/plural silence, Expiration-vs-Termination still fires.

### 4.2 D09 / CT14 — status words that are not status claims
Five separate false CRITICALs came from this detector:
- `"utilities is to be registered"` (a lease clause) paired with an unrelated case-law mention of liquidation;
- `"registered recorded delivery letters"` (a notices clause);
- `"shall be dissolved by special resolution"` (a dissolution **provision**, not a status);
- `"if the Franchisee is finally liquidated **or** placed under judicial management"` (an insolvency **trigger clause** — evidence-bundle-7 p.72, rated CRITICAL);
- `"AllFuels' position: The operator is "errant" and non-compliant"` (the Public Protector submission, p.13): `\bcompliant\b` matched at the hyphen of "non-compliant" and paired one passage with itself.

**Guard:** a status word counts only when used **about an entity**; delivery-method uses,
provision phrasing (`shall/may/must be …`, `in the event of …`, `upon dissolution`),
conditionals (`if/should/unless/until … is liquidated`) and **or-joined menus of insolvency
events** are all excluded. A status word preceded by "non" and a hyphen, a dash from U+2010 to U+2013, a soft hyphen or
a space is the negation; two status words within 24 characters on one page are one claim; each
passage is snapped to whole words. An asserted status (`was finally liquidated by order of the
High Court`) still fires, quoting both passages with pages, and a company called compliant on
one page and non-compliant on another still fires.
**Tests:** `detector-recall.test.mjs` CT14 block (6 cases) · `annexure-eb-regression.test.mjs` §18.

### 4.3 D12 / CT18 — OCR-shortened account numbers
An 8-digit OCR fragment of a longer account number was reported as a bank-detail mismatch.
**Guard:** `VO_ACCOUNT_MIN_DIGITS = 9`, `VO_ACCOUNT_MAX_DIGITS = 12` (SA accounts run 9–11).

### 4.4 D31 / CT05 — corpus-wide causal matching
The old check ran `before.*received.*sent` across the **entire document as one string**; on a
353-page file those words appear in that order by chance. **Guard:** the impossible ordering
must occur **inside one sentence**, and the finding quotes that sentence with its page.

### 4.5 D21 / CT31 — the "annex ure" split
OCR splits words across lines. A cross-reference check matched fragments like `annex ure` and
reported a missing annexure that was present. **Guard:** the label must be an uppercase or
numeric annexure label; lowercase OCR word-splits are rejected.

### 4.6 D26 / CT38 — cross-border reality is not an impossibility
Naming two jurisdictions in a cross-border matter is normal. **Guard:** emitted as an
**unscored `contextOnly` note**, never a scored finding.

### 4.7 D17 / CT26 — near-empty pages are a question, not a verdict
A page with no machine-readable text is most often an **image-only page OCR did not capture**,
not a removed page. **Guard:** the finding says exactly that and tells the reader to establish
which from the original; it never asserts insertion or removal.

### 4.8 Bundle context — structural notes are demoted, not counted as wrongdoing
Compiled bundles repeat page numbers and cross-references. The seal page applies this, not the
engine (`applyBundleMode`, run after `runForensicEngine`): when the case details mark a legal
case file, or the bundle is recognised from its own findings (50 or more pages and at least three
CT27 "appears on multiple pages" findings), CT04, CT08, CT27, CT31 and CT36 findings above
severity 2 are lowered to 2 and tagged `[bundle context: …]`. They are grouped at the end of each table, and the plain-language lead states
they are **not, by themselves, signs of tampering**.

### 4.9 `voDateSortKey` — clause numbers are not dates
`clause 1.1.10` was being read as a date ("On 1.1.10 …"). **Guard:** dotted dates require a
4-digit year, plus day ≤ 31 / month ≤ 12 bounds.

### 4.10 AI candidates are never findings, and the AI review never removes one
An AI-raised item is **candidate tier**. It is excluded from the engine count, the fact box,
SEALED FINDINGS, the court-ready narrative's [F#] numbering and the plain-language lead, and is
disclosed on its own advisory line (AI-Identified Candidates).
Mixing the two inflates the count and misdescribes the record.

The other direction holds too (founder ruling, 5 October 2026, §12.16): the advisory review
**never removes, changes, truncates or reorders an engine finding**. `aiAssessFindings` returns
copies of the original findings with the model's note attached (`aiAssessed`, `aiReviewNote`);
an UNSUPPORTED verdict is printed as an advisory note in the Findings & Contradiction Matrix
("AI Review Notes on Engine Findings", after the AI-Identified Candidates) and goes to the feedback
loop as `AI_REVIEW_UNSUPPORTED`, so the engine can be improved by a signed rule
or a code change, never by the model's say-so. A candidate that quotes an engine finding on the
same page is a duplicate and is counted, not listed.

### 4.11 D01 / conduct admission — a cause is not an admission
An "admission of conduct" detector that fired on causal wording alone flagged ordinary contract
boilerplate. **Guard:** all four conditions must hold in the same sentence (30–600 characters) — a causal marker
(`VO_CAUSE_RE`: because / since / as a result / due to / owing to / given that / seeing that),
a proceed verb (`VO_PROCEED_RE`: proceeded / went ahead / carried on / continued / concluded /
completed / finalised / finalized / executed, **within 80 characters, with no full stop between**, of deal / transaction / sale /
shipment / order / export / contract / agreement / payment / transfer), a first-person subject
(`VO_SELF_RE`: i / we / me / my / our / us), and **not** boilerplate (`VO_BOILER_RE`: shall /
hereby / whereas / herein / the parties agree). The quote starts at the causal marker when the
cut is more than 30 characters in. One count per page; the same account on several pages is one
finding listing them.
**Tests:** `greensky-regression.test.js`.

### 4.12 `secSealedFindings` — SEALED FINDINGS lists only what is established AND anchored
Section 5 once printed 21 findings while the executive summary counted 20, and one entry
rendered as `4. "" — Anchor: —.` — an AI candidate with no quote and no page, printed under
seal as a sealed finding. **Guard:** the section filters out demoted findings, `SERIAL`
aggregates, anything with `source === 'ai'`, anything whose `fmtLocation` is empty or `—`, and
anything whose quoted evidence is empty once punctuation and whitespace are stripped. A count
mismatch between the executive summary and Section 5 is a bug, not a rounding difference.
**Tests:** `legal-analysis.test.js`.

### 4.13 `scrubNarrative` — the §15.2 gate DROPS sentences, it never rewrites them
A worker-written narrative arrived on page 3 carrying `may have`, `appears to` and "red flag" —
§15.2-prohibited language, under seal, in the plain-language section a lay reader reads first.
**Guard:** `VO_BANNED_SENTENCE_RE` drops any sentence containing hedging (may, could, would,
appears to, suggests, indicates, consistent with …), "red flag" / "indicator" / "anomaly", a
score or confidence band in any dress, or person-level judgment (credibility, guilt, innocence,
lied, liar, perjurer, fraudster, defraud…, dishonest…, fraudulently). Headings are gated too;
"May" the month is not a hedge. In counter-narratives, `scrubRebuttals` also removes a rebuttal
whose claim was dropped, and counts it apart. It **drops**
— rewriting a hedge into an assertion would put words in the narrator's mouth that the evidence
may not carry. `voGatePasses` then requires `kept >= 2 && kept >= dropped`; if the narrative
cannot clear that bar the deterministic narrative is used instead. On the real Greensky
narrative, 4 of 5 sentences were dropped and the gate correctly rejected it.
**Tests:** `legal-analysis.test.js`.

### 4.14 `splitSentences` — a period is not always a full stop
The old naive splitter cut `"Mr. Nortje may have signed it."` into a dangling `"Mr."`, and
turned `R3 800 000.00` into `R3 800 000. 00`. **Guard:** non-terminal periods are masked with
a `VO_DOT` sentinel (U+0001) before splitting and restored after — ellipses, a dot inside a token (a domain, a URL, a file
name), dots inside a quotation, decimals and clause numbers, "p. 99"-style citations, initials,
and the abbreviations in `VO_ABBREV_RE` (titles, company forms, no./nos., v/vs, e.g./i.e./et
al., street words, month abbreviations except May, and citation words: p, pp, para, paras, s,
ss, cl, art, sec, fig, ch, ex). It deliberately errs toward **under**-splitting: a run-on sentence is
ugly, a truncated quote under seal is a misquote.
**Tests:** `legal-analysis.test.js`.

### 4.15 `voDetectDocuments` — a bundle is one document until proven otherwise
Splitting a consolidated bundle on weak signals mislabels which document a finding came from,
which is worse than not splitting at all. **Guard:** ≥ 2 runs, ≥ 3 pages per run, ≥ 50 % page
coverage; below that it returns nothing. See §8.
**Tests:** `greensky-regression.test.js`.

### 4.16 No regex lookbehind in new code
Safari < 16.4 throws on `(?<=…)` / `(?<!…)` at **parse** time, which kills the entire script —
the user sees a scan that silently never starts, not a failed detector. Do not add lookbehind
anywhere in `forensic-engine-page.js`, `forensic-report.js` or `seal-document.html`.
(Three pre-existing lookbehinds survive for name and money detection: `nameRe` in
`voExtractParties` and `VO_ROSTER_NAME_RE` in `forensic-engine-page.js`, and `VO_MONEY_RE` in
`forensic-report.js` (each with its inline copy in `seal-document.html`); find them with
`grep -n '(?<[=!]'`. They are a known, separate debt — do not
copy the pattern, and do not "fix" them as a drive-by.)

### 4.17 D37 clause-numbering discontinuity — heavily guarded, states only the numbering
Two real MOUs from the same drafter, same year: one numbers VARIATIONS as clause 9 with
sub-clauses 9.1; the other numbers the same heading 9 with sub-clauses **10.1 / 10.2** —
numbering left behind when a clause was carried over from a longer instrument. D37 reports the
discontinuity as CT43. **Guards:** an intervening numbered heading ends the search window
(`9. VARIATIONS … 10. NOTICES 10.1` is ordinary drafting); only the FIRST sub-clause after a
heading is tested (a genuine 9.1 followed by a cross-reference to 10.1 stays silent); the jump
must be forward and between 1 and 3 (an OCR digit swap like `91.2` is excluded); one note per
page. The finding quotes the numbering and **never** says the clause was "cut from" anything,
names a source instrument, or reaches for intent — a test asserts those words are absent.
**Tests:** `allfuels-regression.test.js`.

### 4.18 Oath context — measured, never inferred, and "perjury" never in a detector's evidence
A contradiction anchored inside an affidavit is a materially different fact from one in
correspondence. `voDetectSwornPages` tags pages carrying oath language: **strong** execution
formulae (commissioner of oaths, make(s) oath and say/state, sworn (to) before me, duly sworn,
solemnly (and sincerely) declare/affirm, depose(s) and say/state) tag on their own; **weak**
markers (affidavit, deponent, under oath, I make oath) require two distinct hits, so an index line ("Supplementary Affidavit,
9pp") or a page merely referring to an affidavit is never tagged. Unmarked body pages of a long
affidavit are not tagged — under-tagging is a gap, mis-tagging is a false statement of fact.
Findings on tagged pages get `swornContext = true`; the report renders one factual line ("oath
language appears on the cited page(s)… reserved to the court") plus a candidate-law bullet.
**No detector's evidence string carries the word "perjury"**, and the report source carries it
only inside candidate-law lines; both are locked by tests on the AllFuels fixture. One known
exception is open: the serial pattern SP16 is named "Perjury Documentation Chain", and a
corroborated match prints that name in the engine's evidence and the report's serial sections.
**Tests:** `allfuels-regression.test.js`.

---

## 5. The anchor rule

`voEnforceAnchorRule(findings)` implements Prime Directive 2: *if a sentence cannot cite
anchors, it cannot exist.* Content findings without a resolvable page anchor are **dropped**,
not demoted, and disclosed in the report as *"observations recorded here as unanchored
observations, NOT as findings (no anchor, no sentence)"*. The test is the finding's location: a
page ("Page 12", "Pages 3, 7") or a document-structure anchor ("PDF metadata", "PDF structure")
keeps it; anything else, "Full document" included, moves to the extraction notes. The rule is
skipped when the document is a single text block: a one-page document, or the raw
whole-document fallback after per-page extraction failed (that fallback is disclosed). SEALED FINDINGS and the court-ready narrative filter again (§4.12).

---

## 6. Report language — Prime Directive 16 (the Breathalyzer standard)

The report states measurements as fact and leaves the verdict to the court, exactly as a
breathalyzer prints a reading without pronouncing a conviction.

**Prohibited anywhere a reader can see it:**

| Prohibited | Why |
|---|---|
| Scores or percentages (`48/100`) | Ordinal Confidence is *"never expressed as percentages… no false precision"* |
| Confidence bands (`MODERATE`, `HIGH` as confidence) | A finding is established or it is not stated |
| Hedging (`some`, `appears to`, `may`, `possibly`, `likely`, `suggests`) | A measurement does not hedge |
| "How to read this report" | The report must not need a manual |
| A verdict on a named person | Belongs exclusively to the court |

**Required:**
- Opening: `The sealed record of "<doc>" (N pages) contains <count>. The following are established.` — the count
  is `voCountPhrase`'s: `N findings`, whether or not the advisory AI review ran. A finding is never called
  "verified": Prime Directive 13 asks for three independent verifiers, and the platform has one deterministic
  engine and at most one advisory model (founder ruling, 5 October 2026, §12.16). Where some findings are
  anchored only on OCR-recovered pages or on a secondary source: `N findings: K at full weight, and M anchored
  only on OCR-recovered pages or on a secondary source, whose quoted wording is to be verified against the page
  image or the primary document before it is relied on (C of them held at reduced weight by the engine)`.
- Closing: `These findings are sealed under SHA-512 and <anchorPhrase>: any change to them is detectable, because
  the fingerprint would no longer match<timestampClause>. The verdict on any named person is for the court.` At
  sealing the proof is only submitted, so the seal page prints: `…sealed under SHA-512 and submitted for
  anchoring to the Bitcoin blockchain via OpenTimestamps (the Bitcoin confirmation was pending when this report
  was sealed; the OpenTimestamps proof completes it later): any change to them is detectable, because the
  fingerprint would no longer match, and the OpenTimestamps proof will fix the latest time by which they existed
  once the Bitcoin confirmation completes.` (Never "cannot be changed, altered, or deleted", and never "fixes
  when they existed": a hash makes tampering detectable, it does not prevent it, and OpenTimestamps proves
  existence no later than the confirming block.)
- Clean result: `No contradictions were detected. Every detector ran; none triggered.`
- Every finding anchored to quoted text and a page.

### The AI layer obeys the same rule — because the evidence is sealed

The narrator (`/api/v1/ai/narrate`) is given the reason in full; the advisory reviewer (`/assess`) and Brain 9
(`/sweep`) a one-line version; the court-ready narrator (`/human-report`) the rule alone ("Never hedge sealed
evidence"). The reason is given, not just the rule, because a model that understands *why* complies far more
reliably:

> WHY YOU STATE FACTS: every finding you receive was produced by a deterministic engine from a
> document sealed under SHA-512 (tamper-evident: any change to it is detectable). It is quoted
> evidence bound to a page of that sealed record. It is therefore not a suspicion to be hedged —
> it is a measurement to be reported.

(Until 5 October 2026 the prompts said "anchored to the Bitcoin blockchain" and "a record that
cannot be altered", which overstated the seal: the record is tamper-evident, and at sealing the
anchor is only submitted. `NARRATE_SYSTEM`, `ASSESS_SYSTEM` and `SWEEP_SYSTEM` now say any change
is detectable, and `tests/worker.test.mjs` fails if any of them calls the record unalterable,
immutable or anchored to Bitcoin.)

Concretely, the narrator prompt **bans** `appears`, `might`, `possibly`, `seems`, `could`,
`potentially`, `apparently`, `allegedly`, `suggests`, `indicates`, `may indicate`,
`is consistent with` for anchored facts, and forbids calling an established finding an
"indicator", "red flag", "concern" or "anomaly". The embedded constitution the model reads
carries PD1 in its v8.0 form (no scores, no percentages, **no confidence bands**), and the
severity weights are marked *internal weighting only — never shown to a reader*.
`tests/worker.test.mjs` asserts all of this, so a future edit cannot quietly reintroduce
probabilistic language into the AI layer.

**Two-tier naming.** An engine finding is a **finding**; an AI-raised item is a **candidate**.
The report's AI section is headed *AI-Identified Candidates* and counts candidates, never
findings. Do not blur the two words — the distinction is what keeps the engine count honest.

**Two deliberate exceptions, both mandated by the Constitution:**
1. **Ordinal severity, internal only** — each finding carries a severity of 1–5 (Prime
   Directive 1's ordinal ranking). It ranks what a finding *is*, not the probability that it is
   real. It fixes the engine's order of findings and travels in the findings JSON; no severity
   word (Critical / High / …), no severity column and, since 5 October 2026, no "most serious",
   "by severity", "serious" or "minor" prints either: the report says only that the findings are
   in the engine's fixed order (`VO_ORDER_NOTE`; AGENTS.md ruling 2, §12.16).
2. **Candidate law** — PD16 reserves the legal characterisation to the court, so the reports
   name provisions only as "Candidate law (for counsel to confirm)" (the court-ready narrative
   adds "not a legal conclusion"); the worker's court-ready-narrative gate also admits "may
   constitute" in a candidate-law sentence (§13). The technical report never prints "may
   constitute". The contradiction is stated as fact; what it *is* in law is not.

`overallScore` (and its internal band, `confidence`) still exist **internally** in the engine's
result: they set the `clean` flag and are sent to the narrator as context. Since 5 October 2026
the engine's summary sentence (`generateSummary`) no longer varies with them: it states the
count and the instruction to read each finding against the original page. Neither is in the findings JSON, and neither may ever be
displayed. `tests/legal-analysis.test.js` asserts the absence of `/100` and confidence
bands and will fail the build if either returns.

### The prompt is not the enforcement — `scrubNarrative` is

A prompt is a request; a gate is a guarantee. Everything the worker returns is passed through
`scrubNarrative` (§4.13) **before it is drawn on a page**, and the report falls back to the
deterministic narrative if too much was dropped. When you change the narrator prompt in
`worker/verum-rules.js`, change the gate's expectations in `tests/legal-analysis.test.js` too —
never loosen the gate to let a better-sounding prompt through.

**Overclaim (5 October 2026, §12.16 item 6).** Beside the §15.2 words, `scrubNarrative` (through
`voSentenceBanned` → `voSentenceOverclaims`) and the Worker's court-ready gate (`humanOverclaim`,
counted as `gate.overclaim`) hold three rules: only an [F#] finding is established, proved,
revealed, demonstrated, shown or confirmed (a sentence citing only a page reports what that page
states); a contradiction is stated only with its [F#] (a rebuttal frame excepted); and conduct is
never said to constitute fraud, coercion or any offence outside "may constitute" candidate law. A
negated verb ("Nothing on page 5 establishes …"), reported speech ("The bank confirmed receipt …")
and a founding date ("established in 2001") are kept.

The narrator prompt also carries **FORMAT**, **SYNTHESIS** and **WHY IT MATTERS** rules
(founder request: "it mustn't be a text dump"). `narrativeBlocks` then renders the result as
typed heading / bullet / paragraph blocks. `tests/worker.test.mjs` locks the prompt text so a
future edit cannot quietly delete those rules.

---

## 7. Report anatomy (`forensic-report.js`)

`build(opts)` → main report PDF bytes · `buildNarrative(opts)` → the standalone
plain-language narrative PDF (kept and tested, but **no longer produced by the seal page** since
2026-09-07 — founder: not necessary; the forensic report's Part 1 is the plain-language telling and
the court-ready narrative is the covering document) · `buildHumanReport(opts)` → the court-ready narrative PDF (§13) ·
`seal(pdf, sealOpts)` → sealed PDF: a QR panel ("VERIFY SEAL", top right) and the navy seal footer
on every page, cover included, and the VO-SEAL2 Subject (legacy VO-SEAL when the patch is
impossible); `sealOpts.tag` labels the footer ("FORENSIC REPORT" by default, "NARRATIVE REPORT"
for the court-ready narrative). The QR opens `verify.html?h=<first 32 hex characters of the
SHA-512>&m=<metadata>`. The court-ready narrative's section order is in §13 (cover, contents
page, fifteen contract sections).

**The report leads with the Constitution's template (founder ruling of 5 October 2026, §12.16,
which replaces the story-first order of AGENTS.md ruling 5).** Cover → table of contents → the
§15.4 sections 1–7 → `secAnnexDivider` → the annexes, the plain-language pages first. Prime
Directive 19 asks for the template exactly; do not move the plain-language pages back in front of
section 1 without a founder decision. The plain-language pages are unchanged in content; they are
annexes now, numbered like the rest.

### The cover and the §15.4 template

| # | Section | What it is |
|---|---|---|
| — | **Cover** (`drawCover`) | `CONFIDENTIAL` banner, title FORENSIC EVIDENCE REPORT, subtitle `Findings by Forensic Software — Constitution v8.0 §15.4 Template`, the template's header fields (Timestamp, ISO (UTC); Jurisdiction(s) detected; Case Reference, or "none entered"; Report Type, `opts.coverReportType`), case or document name, reference, date, source and source SHA-512, the case rows the sealer entered, the `INCOMPLETE READ` warning when pages went unread (§12.10 item 4; the `AI REVIEW NOT RUN` banner was removed on 5 October 2026: no finding depends on the AI), the three provenance lines (forensic software, not a generative AI), and `GOVERNED BY CONSTITUTION V8.0 \| ENGINE INSTRUMENT V6.1`. The verification QR is stamped by `seal()` |
| — | **Table of contents** | Placeholder page, drawn last once real page numbers are known |
| 1 | `secCriticalSubjects` | CRITICAL LEGAL SUBJECTS |
| 2 | `secDishonestyMatrix` | DISHONESTY DETECTION MATRIX |
| 3 | `secNineBrain` | NINE-BRAIN EXTRACTION FINDINGS: every engine finding under exactly one of B1–B7 (`brainOf`, `VO_BRAIN_OF_CT`; v8.0 §2 puts each detector in one brain). The block keeps the template's header ("TAMPER FOUND", "COMMUNICATION GAP FOUND", …) with a Finding line stating the measured fact; a kind no header describes prints as FINDING RECORDED under its brain (`VO_NEUTRAL_BLOCK_CT`: CT23 and CT39 in B2, CT37 in B3, CT33 and CT35 in B7). No finding is set apart "not rendered under a brain" |
| 4 | `secTripleVerification` | TRIPLE VERIFICATION SUMMARY: one row per finding (the first 16), Thesis / Antithesis / Synthesis / Status (`tripleVerificationOf`: the Thesis passes on the anchored quote; the Antithesis is INSUFFICIENT when the finding rests on a secondary source or an OCR-recovered page, PASS otherwise; the Synthesis says what survives; the Status is ACCEPTED under the v8.0 §3 consensus rule and REJECTED on any FAIL, each leg with its reason), and the statement that Prime Directive 13's three independent verifiers are not met, so the report does not call its findings verified |
| 5 | `secSealedFindings` | SEALED FINDINGS: "The record contains N findings… The following are established" (§6), file-level findings counted beside the page-anchored list |
| 6 | `secVerdictReservation` | VERDICT RESERVATION |
| 7 | `secDeclaration` | CERTIFICATION, with what the AI review did (it read N engine findings, removed and changed none, noted K as unsupported, raised C candidates) and what the seal check alone cannot show (a copy altered and re-sealed with its own hash; compare the delivered file's SHA-512 with the one the sender recorded) |

These headings are constitutional and are **not** renamed for accessibility.

### The annexes, plain language first

`secAnnexDivider`, then in build order:

| Annex | Section | What it is |
|---|---|---|
| plain | **`secExecutiveSummary`** | Source line, an **IN ONE PAGE** box, **The leading findings** (the first three in the engine's order, with *both* halves of a two-sided contradiction printed in full), **Key dates in the record**, **What to do next**, closing verdict reservation. "Key dates" prints with two or more dated events; "What to do next" adds an unread-pages step when pages went unread; the closing says "the documents cannot all be true at the same time" only when a finding has two sides |
| plain | **`secDocumentsInBundle`** | When `voDetectDocuments` recovered document boundaries: which documents are in the bundle, their page ranges, and which findings cross between them (`crossDocNote`) |
| plain | **`secShortVersion`** | Each finding as one line, contradictions split into their two sides by `contradictionSides`, identical lines collapsed into one naming every page |
| plain | **`secNarrative(ctx, data, { title: 'THE STORY IN PLAIN LANGUAGE' })`** | When the worker narrator ran (not the local template) and its draft clears the §15.2 and overclaim gates, it leads as "The analyst's telling", labelled advisory, with the count of sentences removed; the deterministic backbone ("The verifiable backbone: each pattern, anchored") follows, word-for-word repeatable, then "The story the dates tell" when two or more dated findings exist — always structured into headings/bullets/paragraphs by `narrativeBlocks`, never a text dump. It opens with the provenance statement: the findings are the output of deterministic forensic software, not the opinion of a generative AI |
| plain | **`secUnreadPages`** | Every page the engine could not read, named with its reason (`capped` / `noText` / `renderFailed` / `timedOut`), collapsed into ranges by `pageRanges`, with a human-review instruction — plus **PAGES READ THROUGH OCR** (`secOcrProvenance`), pages carrying only a seal footer, the pages set aside before scanning (a prior Verum Omnis report or the analysis template), and the engine notes (`secEngineNotes`). With nothing unread and only notes, the heading is PAGES THE ENGINE COULD NOT USE. No per-word OCR confidence is printed (PD1) |
| detail | `secExecSummary(ctx, data, { noLead: true })` | FINDINGS AT A GLANCE: the IN PLAIN LANGUAGE box ("In plain words, in the engine's order:"), the fact box ("Kinds of finding recorded: N (the engine checks for 46 kinds)" — never "N / 46"), the leading findings and evidence statistics; no severity table and no summary sentence |
| detail | `secAiReview` … `secMethodology` | `secAiReview` (headed FORENSIC NARRATIVE, ENGINE SUMMARY or AI REVIEW; nothing when neither ran) · `secPartyAnalysis` ("Parties named on the pages carrying findings", not a scorecard) · `secStatutoryAnchoring` (person → contradiction → page → candidate law) · `secOffenceMatrix` (with **Elements Evidenced**; the provisions are the union of each finding's own candidate law) · `secActions` (0–14 / 14–90 / 90+ days) · `secMonetaryFigures` · `secEvidenceIndex` · `secMatrix` (with AI-Identified Candidates and "AI Review Notes on Engine Findings" when the review ran) · `secFindingDetails` (F# for anchored engine findings, then P#, the same numbering as the narrator and the court-ready narrative; "Party implicated" only for a declared party named in the finding's own words, otherwise the names on the cited page are stated descriptively; location, legal subject, oath context (§4.18), OCR provenance, the provision the document cites, what it means, the verbatim quote and candidate law) · `secPersonIndex` · `secSerial` (no severity column) · `secTimeline` · `secEvidenceAppendix` · `secEvidenceMap` (Annexure A) · `secConstitution` · `secMethodology` ("Order of findings") |

The "HOW ANY CHANGE TO THIS RECORD IS DETECTED" page (`secSealExplainer`) was removed on 5
October 2026: PD20 bars manuals, and section 7 and the closing sentence of SEALED FINDINGS
already say what the seal shows and what it cannot. Display names come from `findingName` /
`ctLabel`: the taxonomy keeps its names in the findings JSON, and two print in measured words
(`VO_DISPLAY_NAME`: CT20 "Registration Number Format Invalid", CT39 "Chain-of-Custody Steps Not
Documented").

### Report facts the engine derives — never the user

The report **must not** rely on the user to name anything. It derives:

- **Parties** — `documentParties` / `effectiveParties` / `effectivePartiesWithRoles` read the
  names out of `anchor.who` on the findings themselves, deduped by `samePartyName`
  ("L. Highcock" and "Liam Highcock" are one party). A report saying "No parties were supplied"
  above a finding that names someone is a bug. The names describe; they do not attribute. A
  finding concerns a party only when the case details declare it and the finding's own words
  name it (`declaredPartyFor`, `partyStronglyNamed`: the whole name, or an initial and the
  surname), a counter-narrative quotes a party only when it is the speaker (`speakerOf`), and
  every other name is printed as "Named on the cited page (descriptive, not an attribution)"
  (§12.14).
- **Jurisdiction** — `detectJurisdictions` sets `home` from the sealing GPS fix using
  deterministic bounding boxes (ZA / AE / GB / US — **no geocoding service**, AGENTS.md
  ruling 6); without a fix, or outside those boxes, home is ZA; every other jurisdiction named in the record becomes a foreign leg.
  `statutesForSubject` lists `[home].concat(foreign)`, home first.
- **Page anchors** — `pageNumbers` / `fmtLocation` are plural- and list-aware ("Pages 11 and 12",
  "Page 89 vs Page 89") and dedupe before printing. `—` in a location field means the finding
  failed the anchor rule and should not have reached the page.

---

## 8. Public API

### `forensic-engine-page.js`
This is `module.exports` (the Node test seam, 80 names). In the browser the engine is not
wrapped in a closure, so every top-level function is a page global; the report, seal-guard,
ots-proof and pdf-encrypt scripts are closures and expose only `window.VerumReport`,
`window.VoSealGuard`, `window.VoOts` and `window.VOEncryptPDF`.

- **Core:** `VO_ENGINE_VERSION` · `CONTRADICTION_TYPES` · `DETECTORS` · `SERIAL_PATTERNS` ·
  `runForensicEngine` · `detectSerialPatterns` · `generateSummary`
- **Extraction:** `extractPageText` · `voParsePages` (page numbers out of a location string) ·
  `_voParseToUnicode` · `_voDecodeHexString` · `_voMapLiteral` · `_voCmapCodeBytes` ·
  `_voGlyphTokens` · `_voMergeGlyphRuns` · `voLooksGarbled`
- **Exclusions and secondary sources:** `voExcludeTemplatePages` · `voExcludeSecondaryReportPages` ·
  `voIsSecondaryReportPage` · `voNoteAiCompiledSummary` · `voIsFooterOnlyPage` ·
  `voExcludeFooterOnlyPages` · `voStripSealFurniture` · `voStripSealFurnitureBlocks` ·
  `voCacheDocSegs` · `voSecondaryPages` · `voSecondarySegments` · `voMarkdownAnalysisPages` ·
  `voSecondaryWhere` · `voIsSecondaryHead` · `voIsSubmissionOnSealed` · `voSubmissionSpan` ·
  `voDemoteSecondarySource` · `voIsStampContext`
- **Anchoring:** `voBackfillPageAnchors` · `voPageForEvidence` · `voPagesForEvidence` ·
  `voFindingPages` · `voEnforceAnchorRule` · `voAnchorEnrich` · `voSentenceAround` ·
  `voSnapWindow` · `voFragmentCut` · `voExtractQuotes` · `voExtractCitations` · `voExtractDates` ·
  `voDateSortKey` · `voDatedAfterReference` · `voStatement` · `voBuildTimeline` ·
  `voBuildPersonIndex`
- **Parties:** `voExtractParties` · `voExtractPersonsFromContext` · `voLooksLikePerson` ·
  `voCleanPersonName` · `voTrimPersonName` · `voBuildNameRoster` · `voEditDistance`
- **Structure:** **`voDetectDocuments`** · **`voDetectSwornPages`** · `voDigitalForensicsScan` ·
  `voCropHidesContent` · `voContentMass` · `VO_NEAR_EMPTY_CHARS` · `voCtById` ·
  `voCapOcrFormatFindings`
- **Rule packages (§12.7):** `VO_RULES_PUBLIC_KEY_ID` · `VO_RULES_ALGORITHM` ·
  `VO_RULES_PUBLIC_KEY_DER_B64` · `VO_PACKAGE_RULE_CONFIDENCE` · `VO_PACKAGE_RULE_MAX_SEVERITY` ·
  `VO_ENGINE_OWN_RULE_GROUPS` · `VO_PACKAGE_GROUP_WINDOW_PAGES` · `voCanonicalJson` ·
  `voSemverNewer` · `voRulePackageShape` · `voVerifyRulePackage` · `voCompileRulePackage` ·
  `voRunPackageRules` · `voRulePagesOf`

**`runForensicEngine(pdfBytes, pdfDoc, onProgress, opts)`** (async). `pdfDoc` is a pdf-lib
`PDFDocument`; `onProgress(done, total)` fires every eight pages (and from the OCR hook);
`opts.referenceTime` is an ISO instant the caller passes (the seal page:
`new Date().toISOString()`). Its Africa/Johannesburg calendar day dates the "document dated after
its analysis" note; without it no such note is made, and the engine never reads the clock. The
result: `engineVersion`, `rulePackage`, `clean`, `unreadable`, `overallScore` /
`maxPossibleScore` / `confidence` (internal only, §6), `totalFindings`, `findings`, `pageTexts`
(never in the findings JSON), `documentMap`, `swornPages`, `timeline`, `personIndex`,
`findingsByType`, `findingsByCategory`, `contradictionTypesUsed`, `serialPatternsDetected`,
`extractionNotes`, `contextNotes`, `referenceTime` (null when none; recorded in findings JSON
v1.6.0 as `analysis_reference_utc`), `ocrPages`, `ocrConfidence`, `footerOnlyPages`, `summary`.

`voDetectDocuments(textBlocks)` recovers document boundaries inside a consolidated bundle from
each document's own numbering: `Page N of M` markers and this platform's own seal footers
(`VO-… | n/N`). A new segment starts when the total changes or the number restarts; the
bundle's own running numbering is ignored, and on a page with nested numberings the smallest
total wins. It needs at least six pages, and is computed once on the unstripped pages
(`voCacheDocSegs`), before the seal furniture is removed. It
requires **≥ 2 runs, ≥ 3 pages each, and ≥ 50 % page coverage** before it reports anything —
below that it returns nothing rather than guess. Titles come from each document's *own* first
page (marker and seal furniture stripped, capped at 58 characters; a title shorter than four
characters is dropped). `runForensicEngine` attaches the result to its output as
`documentMap`.

**`voDetectSwornPages(textBlocks)`** returns the 1-based pages carrying oath language (guards in
§4.18). `runForensicEngine` attaches the list to its output as `swornPages` and sets
`swornContext = true` on any finding whose anchor page is in it.

### `forensic-report.js` (`window.VerumReport`)
`build` · **`buildNarrative`** · **`buildHumanReport`** · `seal` — plus test seams: `_sanitize` `_cleanQuote`
`_extractParties` `_extractPartiesWithRoles` `_partyRoleMap` `_legalSubjectOf` `_dishonestyOf`
`_listPhrase` `_narrativeMeaning` `_ctNames` `_narrativeMeaningMap` `_plainLeadLines`
`_narrativeBlocks` `_pageRanges` `_fmtLocation` `_pageNumbers` `_scrubNarrative`
`_contradictionSides` `_establishesOf` `_docsForLocation` `_crossDocNote` `_documentParties`
`_effectiveParties` `_effectivePartiesWithRoles` `_splitSentences` `_detectJurisdictions`
`_statutesForSubject` `_subjectOf` `_attributeParty` `_extractMoney` `_rulePackageLine`
`_brain9SweepLine` `_scrubRebuttals` `_isUnsignedStatement` `_declaredPartyFor` `_namedOnPages`
`_hintFor` `_anchorQuote` `_anchorQuotes` `_sameNameVariant` `_anchorPhrase` `_docTitle`
`_mergePersonIndex` `_ocrTouched` `_samePartyName` `_isEngineFinding` `_humanNumberable`
`_speakerOf` `_partyStronglyNamed` `_capText` `_aiSectionName` `_findingName`
`_hasTwoSidedFinding` `_isReducedWeight` `_isCappedWeight` `_voCountPhrase` `_statutesForFinding`
`_engineNotes` `_brainOfCt`

The report is a closure; page code reaches it only through `window.VerumReport`. A
closure-private helper called from the page fails at runtime ("fmtBytes is not defined", #205),
and `tests/annexure-eb-regression.test.mjs` scans the page for such names.

`build(opts)`, `buildNarrative(opts)` and `buildHumanReport(opts)` read the same option bag; the
human report adds `humanSections`, `humanFindings` and `humanProvenance` (§13) and ignores
`aiNarrative` / `aiNarrativeSource` (its prose arrives per section). The seal page calls `build`
and `buildHumanReport` (never `buildNarrative`, retired from the seal page on 2026-09-07) and must
pass `unreadPages`, `ocrPages`, `ocrConfidence` and `gps` to both, or the narrative silently
loses the unread-page and OCR disclosure and the home jurisdiction; `aiNarrative` and
`aiNarrativeSource` go to `build` only (§12.5).

---

## 9. Inlining

`forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`, `ots-proof.js` and
`pdf-encrypt.js` are **inlined** into `seal-document.html` between
`/* VO-INLINE:<file>:START */` … `/* VO-INLINE:<file>:END */` markers, because root-level `.js`
fetches once intermittently returned the home page's HTML (recorded in
`tests/inline-scripts.test.mjs`; the rule stands since the move to Worker static assets, #186) —
a dropped script would mean a silent scan failure.

**Workflow: edit the source file, then re-splice.** `tests/inline-scripts.test.mjs` byte-compares
the copies (note: the inline block excludes the source's trailing newline) and fails on drift.

```js
// node resplice.cjs  (from the repo root; keep the script outside the repo or delete it after)
const fs = require('fs');
let html = fs.readFileSync('seal-document.html', 'utf8');
for (const file of ['seal-guard.js', 'forensic-report.js', 'forensic-engine-page.js', 'ots-proof.js', 'pdf-encrypt.js']) {
  const START = '/* VO-INLINE:' + file + ':START */\n', END = '\n/* VO-INLINE:' + file + ':END */';
  const src = fs.readFileSync(file, 'utf8').replace(/\n+$/, '');
  const s = html.indexOf(START), e = html.indexOf(END, s);
  if (s < 0 || e < 0) throw new Error('markers missing for ' + file);
  html = html.slice(0, s + START.length) + src + html.slice(e);
}
fs.writeFileSync('seal-document.html', html);
```
Then run `node tests/inline-scripts.test.mjs`. On an unchanged tree the script is idempotent.

The same test also forbids a `<script src="/<file>">` tag for any of the five, and requires the
seal page's own CT maps (`CTNAME`, `CTCAT`, `CATLAB`, `CATORD` in `buildLocalNarrative`, outside
the inline blocks) to equal `CT_NAMES`, `CT_CATEGORY`, `CATEGORY_LABEL` and `CATEGORY_ORDER`.
Edit those by hand; re-splicing does not touch them.

**Do not** "de-duplicate" the inline copy into a shared module. The duplication is deliberate
and the test makes drift impossible.

---

## 10. Changing the engine without regressing it

Yesterday's extraction quality is the baseline. To protect it:

1. **Add a regression test first**, using the **exact text from the real document** that
   motivated the change. Every guard in §4 has one; that is why they have survived.
2. **Run the full suite and the syntax check** — `node tests/run-all.js` green and `npm run check`
   clean (`node --check` over the eight shipped scripts). Nothing else is acceptable before a push.
3. **Re-splice the inline copies** after every source edit.
4. **Never delete a guard to "increase recall."** If you believe a guard is wrong, prove it
   with the original document text in a test, and say so in the commit message.
5. **Never hardcode a party, name, account number or case fact** into a detector. Detectors
   measure structure; they do not know who anyone is.
6. **New contradiction type?** Add it to `CONTRADICTION_TYPES` (`forensic-engine-page.js`) and,
   in `forensic-report.js`, to `CT_NAMES`, `CT_CATEGORY`, `CT_DETECTOR`, `NARRATIVE_MEANING`
   (test-locked), `LEGAL_SUBJECT_OF`, `DISHONESTY_OF` and `VO_BRAIN_OF_CT`; the last three default
   silently (`CONTRADICTION`, `CONTRADICTIONS`, `B1`), so a missing key mis-files the type rather than
   failing. For a new category, add `CATEGORY_ORDER` / `CATEGORY_LABEL` too (a missing category
   once dropped CT44/CT45 from the matrix, §12.13 item 10). Mirror the names in the seal page's
   hand-kept `CTNAME` / `CTCAT` (and `CATORD` / `CATLAB`) in `buildLocalNarrative`, outside the
   inline blocks (`tests/inline-scripts.test.mjs` pins them). Add it to `OFFENCE_ELEMENTS`,
   `VO_ESTABLISHES` and `VO_TWO_STATEMENT_TYPES` where it fits, mirror any `OFFENCE_ELEMENTS`
   change in the Worker's `HUMAN_PILLAR_TYPES` (`tests/human-report.test.mjs` pins them equal),
   and widen the "CT01-CT46" ranges in the Worker's prompts. Update `worker/rule-format.md` and
   the taxonomy lock in `tests/constitution-lock.test.mjs`, bump `CT_COUNT` (`forensic-report.js`,
   beside `DETECTOR_COUNT` and `SP_COUNT`; `DETECTOR_COUNT` too for a new detector), and
   re-splice the inline copies (§9).
7. **No `Date.now()` / `Math.random()` in analysis paths.** Determinism is constitutional.

### What the tests guard

**33 suites · 2535 assertions** (counted 2026-10-03 on commit 179e45c; recount after any test change).
`tests/run-all.js` is the registry — a new test file that is not registered there does not run.

| Suite | Checks | Guards |
|---|---|---|
| `forensic-engine.test.js` | 328 | Core engine behaviour, extraction quality and OCR regressions |
| `legal-analysis.test.js` | 216 | Party extraction, legal subjects, **PD16 language**, the §15.2 narrative gate, sentence splitting, page anchors, executive summary and SEALED FINDINGS integrity, OCR provenance (PD6) |
| `page-boot.test.mjs` | 101 | The seal page still boots when a library is missing |
| `detector-recall.test.mjs` | 107 | Recall + the §4 false-positive guards, pinned to real bundle strings |
| `finding-anchors.test.mjs` | 87 | WHO/WHERE/WHAT/WHEN anchoring per finding |
| `worker.test.mjs` | 311 | Worker endpoints, limits, embedded constitution, **narrator prompt locks** (FORMAT / SYNTHESIS / WHY IT MATTERS), pattern-feedback contract, **the §12 institutional-engagement honesty clause** (no court has validated Verum Omnis — seven assertions), **the transcribe contract** (`machineGenerated:true`, clean failures, consent follows the sealing mode — no tick box, and the copy says the audio leaves the device), **the human-report endpoint** (anchor + §15.2 gate counts, temperature 0, no GPS/device, external-provider adapter) and **its gate hardening** (no anchor no sentence, headings gated, the BANNED list enforced, every anchor and quotation spelling checked, sanctioned one-line answers, the fallback budget), **the four-pillars gate** (a pillar claim is held to the elements-table types in every section; knowledge and inducement only as INSUFFICIENT; pillar headings recognised in any dress; findings held at reduced weight evidence no pillar), **the court-recognition ban** (paraphrases of court acceptance dropped, a statute's "admissible" kept), **the template quoting engine findings only**, **the overclaim rule** in the Worker gate and at render time (only an [F#] establishes; a contradiction only with its [F#]; no offence outside candidate law; reported speech and founding dates kept) and **the tamper-evident wording of every AI prompt** (§12.16) |
| `human-report.test.mjs` | 81 | **The court-ready narrative** (§13): one section contract in three artefacts, part of "Seal document with forensic report" with no separate switch (since 2026-09-07) and a disclosure that says what leaves the device, the render-time §15.2 gate on every AI section, deterministic fallbacks labelled as not machine-written, seal-guarded delivery, and **the four-pillars map** pinned equal to the elements table (`HUMAN_PILLAR_TYPES` in the Worker = `OFFENCE_ELEMENTS` in the report; knowledge and inducement have no types) |
| `site-serving.test.mjs` | 56 | **The site-serving chain** (DEPLOYMENT.md): the Worker's deny list mirrors `.assetsignore`; every local reference in every page resolves to a served file; the embedded fallback logo and watermark are real PNGs; the image tiers answer in order (assets → repo → KV → embedded) and name themselves; `/api/v1/site/health` reports the tier truthfully |
| `pages-bridge.test.mjs` | 16 | **The www bridge** (DEPLOYMENT.md "The bridge"), a dormant fallback since 2026-09-27 when the www zone route took over: the Pages Function hands every request to the Worker at the same path and query with method, headers and body; redirects pass through; a request marked `X-VO-Chain` is served from static files (no loop); an unreachable Worker falls back to static with an honest header; `functions/` never ships as a Worker asset |
| `zip-intake.test.mjs` | 25 | **WhatsApp chat exports unpacked on-device** (§12.6a): the page's ZIP reader against real archives (stored, deflated, data-descriptor, folder, macOS cruft, encrypted, garbage), expansion into typed Files, only evidence types admitted, documents inside a voice-note export named for a separate seal, the panel note, the .zip picker entry, the 25-note batch, the home-page copy and locally served photos |
| `greensky-regression.test.js` | 98 | The Greensky bundle: D01 conduct admission (§4.11) and `voDetectDocuments` (§4.15); §9 the 3 October 2026 re-run (§12.15): commodity codes are not dates, a commentator's label is not an admission, markdown analysis pages are secondary, this platform's own seal is not tampering |
| `ocr-rescue.test.mjs` | 44 | OCR fallback path and the **deadline helper** — no unbounded `recognize()` promise |
| `constitution-lock.test.mjs` | 41 | Version chain, seal IDs, taxonomy renumber lock, **governance-first cover** |
| `allfuels-regression.test.js` | 59 | The AllFuels bundle end to end, D37 clause-numbering (§4.17), oath context (§4.18) |
| `annexure-eb-regression.test.mjs` | 496 | **The annexure EB run, its re-run, the evidence-bundle-2-docs run, the evidence-bundle-4-docs run and the Public Protector submission run** (§12.10–§12.14): verbatim glyph extraction (R231.3, t/a, (Pty), slashes, `&`), every false CT01/CT09/CT20/CT23/CT33/CT08/CT18 finding silent beside a positive control, the OCR severity cap, footer-only pages, the honest review labels, the pre-flight and the OCR continue prompt; the embedded-report exclusion, CT44 party alignment, CT08 whole quoted terms, CT04 same-instrument link, no score/band in the template, one count, narrator provenance; the page-level closure lock; one-byte CMaps (a Chrome-printed PDF), font names with hyphens, line-end word boundaries, case numbers are not dates, the AI-compiled-summary note; sealed exhibits are never excluded, seal footers as document boundaries and as text (not CJK), CT02/CT18/CT37 precision, OCR-garbage parties, and the technical report and court-ready narrative rendered and read back: no AI candidate counted as a finding, exclusions disclosed, matched-by wording, the OCR block once; seal furniture stripped with boundaries cached, stamps are not dates, CT20 OCR variants and identity fields, CT08 quote pairs, CT44 object/side/document, CT01 pleadings, CT15/CT22 plausibility, secondary sources, finding dates from the quote's sentence, party stops, and the report read back: matrix category, dropped count, tamper-evidence wording, split counts, trimmed candidate law, rebuttals without orphans; and the Public Protector submission (§18, §18i, §18j): a status word inside its own negation (CT14), two government-suffix domains never a lookalike (CT37), a category plural is not one instrument and quotes are whole words (CT23), titles/addresses/headings are not parties, nesting-aware quotes with WHEN and LAW from the quote's own sentence, a party's submission citing other Verum seals read as secondary up to the first page that opens a new record, the dated-after-analysis note, attribution only to declared parties named whole or by initial and surname, the unsigned-agreement contract shape, the template's own Nine-Brain headers with a Finding line, and the technical report, court-ready narrative, Worker template, anchor certificate and verify.html read back, each confirmed defect of the verification pass pinned with the reviewer's reproduction |
| `evidence-bundle-7-regression.test.mjs` | 31 | **The evidence-bundle-7-docs run** (§12.16), on a synthetic bundle of the same shape built from the bundle's own strings: the CIPC K-form and a bare "CIPC" cue (CT20), a reference to a document that records the custody (CT39), set-aside pages are not near-empty (CT26), a document ends at its stated last page, header words and possessives are not names, the count-only summary sentence, a Verum Omnis analysis's running title is secondary, the lookalike domain still fires end to end, and the technical report read back: template first, no explainer page, no "verified", severity or score words, the Thesis / Antithesis / Synthesis table, every finding under a brain |
| `rule-package.test.mjs` | 129 | **Signed rule packages on the website** (§12.7): canonical JSON byte-equal to the Worker's, the pinned key equals `worker/public-key.der.b64`, sign/verify with every refusal reason, compilation skips the engine's own vocabulary, additive page-local application with withholding and caps, the engine inert without a package, the page's fetch/cache/await/report wiring, and the hybrid fixes (verdict shape, anchored AI candidates, feedback). |
| `crop-normalize.test.mjs` | 115 | CropBox normalisation, **seal band geometry** (pages extended, not overlaid), **share ordering**, ZIP validity/determinism, the **seal-certificate privacy boundary** (§12.6), and the **voice-note path** (§12.6a): as-is sealing, manifest parsing, report hard rules, transcription consent (follows the sealing mode since 2026-09-07), ordering and honesty |
| `inline-scripts.test.mjs` | 25 | Inline copies byte-identical to source |
| `seal-guard.test.mjs` / `ots-proof.test.js` | 16 each | "The only genuine Verum output is a sealed output" · OpenTimestamps proof handling |
| `digital-forensics.test.mjs` / `narrate-excerpt.test.mjs` | 16 each | PDF structure · AI excerpt building |
| `findings-json.test.mjs` | 23 | JSON contract v1.7.0: `display_name`, `brain`, `triple_verification`, `ai_review_note`; an AI candidate carries `INSUFFICIENT`, never a band |
| `franchise-lease.test.mjs` | 15 | D38/D39 (CT44/CT45) |
| `wrangler-config.test.mjs` | 34 | **Deploy config drift**: the top level and `[env.production]` carry the same KV, AI, vars, observability, assets block (`./`, `ASSETS`, `/api/*` Worker-first) and trainer cron (weekly, Monday 03:00 UTC, `AUTO_CURATE = "on"`); exactly two zone routes, `verumglobal.foundation/*` and `www.verumglobal.foundation/*`, in both environments, zone named, no `custom_domain` |
| `role-capacity.test.mjs` | 13 | D40/CT46, no hardcoded parties |
| `ai-assess-batch.test.mjs` | 16 | Client batching under the worker's body limit; **the AI review never removes or changes a finding** (notes only, original evidence returned, an unreviewed batch adds nothing; §12.16) |
| `encrypt-detect.test.mjs` / `rule-classify.test.mjs` | 9 each | Encryption detection · deterministic classify fallback |
| `find-seal.test.mjs` / `pdf-encrypt.test.mjs` | 8 each | Seal discovery · real password protection |
| `voice-crypto.test.mjs` | 7 | `.voice` cross-page encryption |
| `engine-perf.test.mjs` | 5 | Per-page extraction does not re-parse the whole PDF |

---

## 11. Where the engine deliberately stops

The deterministic engine has a real ceiling on scanned/OCR'd documents (fuzzy party names,
paraphrased clauses). That ceiling is **by design** the boundary where the hybrid LLM layer
takes over — on the apps, and on the website through the advisory AI review's candidates (§4.10)
and Brain 9's recommendations (§12.8): the model reads difficult documents and raises **candidates**, always
labelled as candidates pending verification, never counted as findings (§4.10).

**Rejected detector requests, recorded so they are not re-litigated:**
- **"Executed before effective date" (CT03/CT04).** Signing before the effective date is the
  ordinary order of commercial practice; a detector firing on it floods real documents with
  false statements of fact. A recall test PINS the silence.
- **A deliverable completed before an "as of" status date.** Status lists report past work;
  nothing is contradicted.
- **Parsing the document's own "(CONTRADICTION)" annotations as findings.** Real evidence does
  not annotate its own contradictions — that pattern exists only in test fixtures, and matching
  it would overfit the engine to its own test data.

When in doubt on this engine: **prefer precision.** Let the hybrid layer chase recall.

---

## 12. The host page (`seal-document.html`) — hard-won behaviours

The engine is only as good as the page that runs it. Most of the following were field failures
reported by the founder; §12.7–§12.9 record his directions of 2026-09-07 (§12.9 runs in the
Worker); §12.10–§12.16 record sealed runs and what their reviews found (§12.16 also the founder's rulings of 5 October 2026). None of them is
decoration.

### 12.1 OCR must never hang

Symptom: "it gets to page three, page four, and it's just staying there forever." Cause: a
Tesseract worker killed by the OS OOM killer leaves `recognize()` as a promise that **never
settles**, so the progress bar stops and nothing times out.

| Guard | Value / behaviour |
|---|---|
| `voOcrDeadline(work, ms, label)` | `Promise.race` against a timer that is **cleared on settle** (an uncleared timer keeps the tab awake) |
| `VO_OCR_WORKER_INIT_MS` | 45 000 |
| `VO_OCR_RENDER_MS` | 30 000 |
| `VO_OCR_RECOGNIZE_MS` | 60 000 |
| Worker retirement | a worker that misses a deadline goes into `deadWorkers`, is terminated and removed from the pool |
| Empty-pool exit | when every worker has been retired, OCR stops cleanly instead of looping |
| Raster cap | `Math.min(2.0, 2200 / max(vp.width, vp.height))`, floored at 0.5 — a full-scale bitmap of an A0 page kills the tab before OCR starts |
| Low-memory pool | `navigator.deviceMemory <= 4` → `POOL = min(POOL, 2)` |

Timed-out pages land in the `timedOut` bucket of `_voUnreadPages` (alongside `capped`,
`noText`, `renderFailed`) and are **named in the report** by `secUnreadPages`. A page the
engine could not read is disclosed, never silently dropped.

`setTimeout` here is a deadline, not a clock reading, and does not breach the determinism rule
(AGENTS.md). It is disclosed in the methodology section.

### 12.2 The seal extends pages — it does not overlay them

Symptom: the seal footer and QR panel were printing **over signatures**. Fix: each page is
grown rather than stamped —

```js
pg.setMediaBox(mbox.x, mbox.y - footH, mbox.width, mbox.height + footH + headH);
```

plus a matching `setCropBox`; the footer draws at `footY` and the QR panel at `headY`, both in
the new margin. Never move seal furniture back inside the original media box: that is evidence
under the ink.

### 12.3 Share always saves, and saves exactly once

Two separate field failures, two separate fixes — both easy to undo by accident:

1. **Saves are queued BEFORE `navigator.share(data)`.** Calling them after raced the native
   sheet; on Samsung Internet the download UI dismissed the sheet entirely ("downloads but no
   share sheet"). The share sheet hands copies to another app and some browsers attach only
   part of a multi-file bundle after `canShare()` approved it — with no way to detect what the
   target actually received — so **every share also saves the full bundle for the user's
   record**.
2. **Multiple files save as ONE store-only ZIP** (`voZipBundle` + `voCrc32`, fixed DOS date
   0/33 so the bytes are deterministic). Several simultaneous downloads trip the browser's
   multiple-download prompt, which never persists in incognito ("it asks do you want to
   download").

`fileObj.voBytes` carries the raw bytes synchronously so the ZIP can be built inside the tap
handler — an `await` there loses the user-gesture context.
**Tests:** `crop-normalize.test.mjs` covers the seal bands, the share ordering, and ZIP
validity and determinism.

### 12.4 Anonymous pattern sharing

`shareAnonymousPatterns(fraudResult)` posts pattern metadata — detector ids, contradiction
types, severities and page counts; never document text, names or quotes — to the worker so
the engine's coverage improves as the site is used. Since 2026-09-07 it runs **automatically
in "Seal document with forensic report"** and never in "Seal document" (founder direction:
contradictions, offences and criminals' tactics are not personal information; the disclosure
box says so), to `POST /api/v1/feedback/patterns`. Engine findings travel as their type; a signed-package hit as
`SIGNED_RULE_<id>`; an AI candidate as `AI_IDENTIFIED` (or `_UNANCHORED`) with its type — CT
codes included, because "the engine missed a CT01 here" is the loop's most useful signal (the
old CT01–CT46 exclusion is gone); a Brain 9 recommendation as `B9_RECOMMENDATION`. A clean scan
sends one `CLEAN_SCAN` marker, a failed scan sends nothing, a SERIAL finding travels under its
serial-pattern name, and one submission carries at most 200 patterns, engine findings first.
`tests/worker.test.mjs` holds both ends of the contract to the four anonymous fields.

### 12.5 Options the host page must pass to the report

`build` and `buildHumanReport` both need `unreadPages`, `ocrPages`, `ocrConfidence` and `gps`
(with `extractionNotes`, `rulePackage`, `rulePackageStatus`, `aiReview`, `classification`,
`serialLabels` and `ots`). `build` also takes `aiNarrative` and `aiNarrativeSource`.
`buildHumanReport` sets both to null itself, because its prose arrives per section
(`humanSections`). Passing them to only one produces a sealed PDF that quietly omits the
unread-page disclosure and the GPS home jurisdiction. `buildNarrative` takes the same options but
has not been called by the seal page since 2026-09-07; it stays in `forensic-report.js` for the
annex path and its tests.

### 12.6 The Seal Certificate never carries identity by default

The one-page Seal Certificate once printed the sealer's name, ID number, residential address,
email, device fingerprint and a GPS fix to six decimal places. It was designed as the user's
private copy — but **certificates travel**: they get filed in shared evidence folders next to
the sealed document, and in a live matter every recipient of a distributed folder could read
the block while the sealer was in hiding from some of them.

Now two variants exist. The **default (shareable) certificate carries no identity, no GPS, no
device** — in their place a note that sender identity was recorded and is held privately by the
sealer. A **PRIVATE variant** carries the full block and downloads as
`*-seal-certificate-PRIVATE-do-not-share.pdf`. Two independent latches enforce it: the
shareable build passes no identity options at all, **and** `buildSealCertificate` renders the
block only when `opts.includePrivate` is true — so one future call-site mistake cannot leak an
address into a distributed certificate. The share bundle (`_voShareFiles`) never includes either
certificate. The QR payload was always identity-free by default; the forensic report reduces GPS
to a country-level jurisdiction and never prints coordinates.

A failed PRIVATE build is retried once; if it still fails, the pipeline step reads "private
record failed, see downloads" and the download area shows a visible warning — the private
certificate is the sealer's only custody record of the identity block (#174). The anchor
certificate (`buildAnchorCertificate`, §12.14) takes no identity, GPS or device options at all.
**Tests:** `crop-normalize.test.mjs` (thirteen assertions).

### 12.6a Voice notes and audio are sealed AS-IS, individually

WhatsApp voice notes (`.opus`; older exports `.m4a`/`.amr`/`.3gp`) and other audio evidence
cannot be merged into a PDF or stamped, so audio takes its own batch path (`voSealAudioBatch`,
up to 25 files — raised from 10 on 2026-09-06 when whole chat exports became an input): each file gets SHA-512 + SHA-256, a seal ID, an OpenTimestamps submission, a
QR payload and a shareable Seal Certificate — **the audio bytes are never modified**. The
original file IS the evidence; the certificate and `.ots` receipt carry the seal record.
Mixing audio and PDFs in one seal is refused with an explanation (a PDF bundle merges into ONE
document; audio seals as N individual files). The certificate privacy latch (§12.6) carries
over: identity/GPS/device appear only in PRIVATE certificates, delivered in a separate ZIP
named `-do-not-share`. The UI states the evidentiary rule in terms: *a transcript is not
evidence — the sealed audio is*.

A batch may carry companions: **one WhatsApp chat export (.txt)** and up to twenty-five **images**
(.png/.jpg — screen grabs of the notes, or the export's own photos).

**Chat exports arrive as a .zip and are unpacked on the device (2026-09-06).** Saving voice
notes one by one from WhatsApp defeated most users; *Export chat → Include media* is two taps
and produces a `.zip` holding the chat `.txt` plus every attachment (`PTT-*.opus`, `IMG-*.jpg`,
`VID-*.mp4`, `DOC-*.pdf`, `STK-*.webp`). `voAddFiles` now expands any archive first
(`voExpandZips` → `voUnzip`: central-directory reader, stored and deflated entries, deflate
through the browser's `DecompressionStream('deflate-raw')`; folders, `__MACOSX` and dotfiles
skipped silently; encrypted, over-200-MB, damaged, truncated and unsupported-compression entries
skipped with the reason named in the panel note; a ZIP64 archive or one of more than 2,000
entries refused whole) and hands the resulting `File` objects to the
unchanged intake (`voAddFilesNow`), so a note unpacked from an export is sealed exactly like a
note picked by hand and the single-note path — one recording plus a screen grab of it, the
recording's date verified from its own name and the chat line — is untouched. Only evidence
types are admitted (`VO_ZIP_KEEP_RE`; stickers and contact cards are named in the panel note,
never added); documents inside an export that also holds recordings are listed for a separate
seal rather than silently mixed. Nothing leaves the device: unpacking is local, and the panel
note says so. `tests/zip-intake.test.mjs` builds real archives (stored, deflated, data-descriptor,
folder, macOS cruft, encrypted) and runs the reader headless. They feed the **Voice-Note Evidence Report** (`buildVoiceNoteReport`) — one PDF,
sealed through `VerumReport.seal`, recording per note the fingerprint, seal ID, device-reported
file details, best-effort duration ("not determined on this device" when the browser cannot
decode the codec), and the chat-export line referencing the file, **quoted verbatim**
(`voManifestLineFor` / `voParseWaLine` handle Android and iOS export formats). Hard rules the
report states in its own text, all test-pinned: **no transcription unless the sealer chose
"Seal document with forensic report" (below); nothing identifies who is speaking** (voice attribution is for a witness or the
court); **sender labels come from the chat export, never the audio** (an audio file carries no
sender identity); a recording the export never mentions is disclosed as unreferenced, not
attributed; screenshots are exhibits whose pairing with any recording is left to the reader.

**Transcription is the audio analogue of OCR** (the PD6 provenance discipline that OCR pages
follow, §12.10 item 3) and is the
ONE step where audio leaves the device. Since 2026-09-07 it follows the sealing mode — on in
"Seal document with forensic report", never in "Seal document" — and the voice-note panel says
which, with the words "the audio leaves this device for that step" (the earlier opt-in checkbox is
gone; founder direction item 12). The pass runs **after every recording is
sealed** and indexes `reportItems[ti].file` — never the raw selection, because `reportItems`
only holds files that sealed, and indexing the selection shifts every transcript after a
failed seal onto the wrong recording. The Worker endpoint `/api/v1/ai/transcribe`
(`handleAiTranscribe`, Workers AI Whisper, 8 MB base64 cap, nothing stored) answers with
`machineGenerated:true`, the model name and a reading-aid disclaimer on every success — the
client accepts a transcript **only** when `machineGenerated === true`. In the report each
transcript renders under a **"MACHINE TRANSCRIPT — reading aid, not evidence"** banner with
the verify-against-the-sealed-audio disclaimer; the intro is conditional and honest: with
transcripts it **discloses** them ("At the sealer's explicit request…"), without them the
no-transcription sentence stands. Every failure (oversize, service down, model error) writes a
per-note "the sealed audio is unaffected" line and **never blocks sealing or the report**.

Layout rules (founder spec): within each recording's block the transcript renders FIRST and
the **sending metadata closes the block** — the verbatim chat-export line plus the labelled
sent-by/sent-at. When no export references a file, `voNameDate` reads the WhatsApp naming
pattern (`PTT-YYYYMMDD-WAnnnn`) and the report states the date **as a device-assigned file
name, never as proof of sending time**, and points the reader to the chat export. The
uploader's `accept` list must keep `.txt`, `.png`, `.jpg`, `.jpeg` — mobile pickers filter on
it, and before this a phone user could not select the chat export or screenshots at all.

**Video evidence** (`VO_VIDEO_RE`: .mp4/.mov/.m4v/.webm/.mkv/.avi, or a `video/*` MIME type)
joins the same as-is batch: hashed, sealed, certified and fingerprinted into the report like
audio, never modified — and **never sent for transcription** (the per-note line says so). A
file over 200 MB is refused with an explanation (the ZIP bundle is built in phone memory).
Every report page draws the **globe watermark** at 0.15 opacity via `voEnsureWatermark`
(its absence reads as an unofficial document; a failed fetch never blocks the report). All
report times print **device-local with the IANA zone name plus UTC** (`voDualStamp`) — the
zone is country-level, so it serves court admissibility without disclosing the sealer's
position; GPS coordinates never appear in the report.
**Tests:** `crop-normalize.test.mjs`, `zip-intake.test.mjs`, `worker.test.mjs`.

**Production routing note (2026-08-23, widened 2026-08-30, re-declared 2026-09-07, resolved
2026-09-27):** the
transcribe endpoint once returned `not_found` in production while the code was live in the
`webdocsol` Worker, because a stale dashboard-managed route still pointed API traffic at
the old `verum-rules` Worker (last deployed 2026-07-20). `wrangler.toml` reclaimed first
the transcribe path, then the AI subtree `/api/v1/ai/*`, via the most-specific-route rule.
On 2026-09-06 the retired `verum-rules` and `verumglobal-static` Workers were deleted in
the dashboard and their routes — including the site's — vanished with them, briefly
orphaning the domain. The zone routes declared after that did not take effect at the time
(the probe then read the apex as a mock-up Worker's Custom Domain and www as a Pages custom
domain), so on 2026-09-07 `wrangler.toml` declared the two hostnames as Custom Domains; that
declaration never bound (every deploy's triggers step failed on the existing DNS records).
*Superseded 2026-09-27 (#210):* the outside probe showed the apex was held by the zone route
`verumglobal.foundation/*` on the July Worker `verum-omnis-verify-production`, never a Custom
Domain. The founder re-pointed it to `webdocsol` and added `www.verumglobal.foundation/*` in the
zone's Workers Routes page, with no DNS change. `wrangler.toml` now declares exactly those two
zone routes (zone `verumglobal.foundation`) in both environments, `workers_dev = true` keeps the
workers.dev address on, and `wrangler-config.test.mjs` pins the routes and forbids
`custom_domain`. `webdocsol` serves everything on both hosts (the `/api/*` router plus the
serving chain); the Pages bridge is a dormant fallback (DEPLOYMENT.md "Resolved (2026-09-27)").
Routing was last confirmed from outside on 2026-09-27 (commit 5dfa007); the live dashboard
cannot be checked from the repository. The standing check after any routing change:
confirm `/api/v1/rules/manifest` still answers — the Android app and the fraud-firewall
rule updater hard-code it.

### 12.7 Signed rule packages — the engine-update loop closes on the website too (2026-09-07)

The platform's "self-learning" is a supervised, signed loop, not an engine that rewrites
itself: the seal and verify pages send **anonymised pattern metadata** (§12.4) →
`POST /api/v1/ai/curate` (admin) drafts rule candidates from the aggregate, *draft only* →
a human publishes a package with `POST /api/v1/admin/publish`, which the Worker signs
(RSASSA-PKCS1-v1_5 / SHA-512 over canonical JSON, key `vo-master-1`) and serves at
`GET /api/v1/rules/manifest` → every client verifies the signature against the pinned
public key and applies the package **additively**. The Android app (`RuleUpdateClient`,
`detectDownloadedFraudPairs`) and the fraud-firewall (`ruleUpdate.ts`) did this; the website
sent feedback but never fetched a package. It now does, and what it applies is deliberately
the same thing the app applies:

- **Fetch, verify, cache** (`seal-document.html`, `voLoadRulePackage`): the manifest is fetched
  from the relative path (works on the domain and on the Worker's `workers.dev` address),
  verified with WebCrypto against `VO_RULES_PUBLIC_KEY_DER_B64` (= `worker/public-key.der.b64`,
  test-locked, the same bytes the Android app and the firewall pin), compiled, and the last
  **verified** manifest is kept in `localStorage` and re-verified on every load, so a phone
  that is offline or on a host without the API still applies the newest package it has seen.
  A newer verified package on the device is never downgraded (the Android version gate).
  The scan awaits the decision (bounded, 8.5 s) so the report names exactly what applied.
- **Compile** (`voCompileRulePackage`, mirrors `RuleProvider.kt`): opposing-phrase pairs from
  `fraud_keywords[].pairs`; flat strings from `[].terms`; `behavioral_markers[].keywords`;
  everything else counted. The seed's twelve groups (`VO_ENGINE_OWN_RULE_GROUPS`, FK01–FK12,
  each with a built-in `source_detector`) are **skipped**: the seed package is the engine's
  vocabulary exported for the apps, and applying it again would be a looser second copy of D01
  without its subject alignment (§4.12). Every other group is applied — including a curated
  group that merely labels a built-in detector (v1.1.0's FK13/FK14 say `D37` because they
  *produce* CT43, not because they came from it). The package adds what the engine does not
  know.
- **Apply** (`voRunPackageRules`, after every built-in detector and the serial patterns): a pair
  fires once per page where both phrases sit inside one 80-character passage (D01's window;
  a phrase that only occurs inside its opposite, "paid" in "not paid", does not count) and no
  built-in finding of the same type already reports that page (withheld, and counted). Type =
  the rule's `produces` when it is a known CT id, else CT43; severity ≤ 3 and weight 0.5
  (Android: MODERATE); at most 25 per scan; then the normal dedupe, page anchoring, anchor
  rule and scoring apply. **Co-occurrence groups** (`fraud_keywords[].groups`, the shape the
  curated v1.1.0 rules use): a set of phrases, each benign alone, fires once when at least
  `min` distinct phrases co-occur inside the serial detector's 3-page window — `min` from an
  explicit `min_cooccur`, else the description's ">= N", else half the phrases and never
  below 2 — anchored to the pages the phrases sit on ("Page 3" / "Pages 1-3") with every
  matched phrase and its page quoted; hyphenated spellings meet the phrase ("risk-free" =
  "risk free"). Terms and markers are never executed: a single keyword is not a
  contradiction.
- **Provenance**: the engine result carries `rulePackage` (version, key id, canonical SHA-512,
  counts, applied/withheld) or `null`; the extraction note says what applied; the report
  prints one line on the cover, in Methodology and in the court-ready narrative's provenance
  record ("Signed rule package: v1.1.0 (key vo-master-1, …) — N rules applied…" or "none
  applied — built-in rules only (reason)"); the findings JSON carries `rule_package` and names
  the rule on each package finding; feedback sends a package hit as `SIGNED_RULE_<id>`, never
  as the detector whose type it borrows.
- **Determinism**: the engine reads only `globalThis.voRulePackage`; the Node harness never
  sets it, so every regression suite runs the built-in engine byte for byte. No
  `Date.now`, no `Math.random`, no lookbehind in the package code (`tests/rule-package`).

Last verified on 2026-09-07 (the trainer may have published patch versions since; read
`GET /api/v1/status` or `GET /api/v1/rules/changelog` for the current one): the Worker served
package **v1.1.0** (published 2026-07-19; 43/14/10/17/0 rules). Its first twelve `fraud_keywords` groups are the engine's own (skipped); the two
curated groups — FK13 `ml_staging_cooccurrence` (five terms, threshold 3) and FK14
`guaranteed_return_language` (five phrases, threshold 2), both producing CT43 — are
co-occurrence groups, and the website is the first client that executes them: the Android
app applies `pairs` only, so v1.1.0 changes nothing on the app until it learns `groups`. The Worker now refuses a version that is not
strictly newer than the published one (`409 version_not_newer`) and rejects leading-zero
versions, because every client applies only a strictly newer semver.

### 12.8 Brain 9 reads the sealed text: recommendations, verified verbatim, never sealed findings (2026-09-07)

Founder direction: the AI must read the sealed files so nothing is missed, state what it
finds, and the self-learning loop must let the engine catch it next time; Brain 9, the
research-and-development brain, verifies that what the model says is real and in the text.
Constitution v8 §2.10 fixes the shape of that: B9 "cannot issue findings, verdicts, or
conclusions"; when it detects that another brain missed evidence it "logs a recommendation —
not a finding"; recommendations "must be anchored"; "all B9 output is internal, not part of
sealed reports". The website has no chat: this runs inside the seal pipeline.

- **What is read.** The sealed page text — the text layer the engine analysed, OCR rescues
  included — never a raw evidence file. Pages under `VO_NEAR_EMPTY_CHARS` of content are not
  read (there is nothing to read; they are already disclosed as unread pages).
- **How** (`seal-document.html`, `aiBrain9Sweep`): after the eight deterministic brains and the
  assess step, pages the engine flagged nothing on come first (a miss can only be there), then
  flagged pages; consecutive pages are grouped into windows under 11,000 characters and 8
  pages; at most 16 windows and three minutes; each window goes to `POST /api/v1/ai/sweep`
  with the engine's `known` types for those pages. The model (Llama 3.3 70B, 8B fallback,
  temperature 0) is told it is Brain 9, cannot issue verdicts, and must quote every item
  verbatim.
- **The anti-hallucination gate, twice.** The Worker (`verifySweepItem`) accepts an item only if
  its quote (≥ 12 characters; case, whitespace, non-breaking spaces and curly quotes
  normalised, nothing else) is a substring of the page text it was given — the page is corrected to where
  the quote actually is — and discards and counts the rest. The seal page repeats the check
  against its own copy of the sealed text (`voAnchorAiQuote`), drops a recommendation that
  duplicates an engine finding of the same type on the same page, and deduplicates.
- **What happens to a recommendation.** It is stated on the results panel (type, severity,
  page, the verbatim quote, the rationale) and offered as a separate, unsealed
  `…-brain9-recommendations.json`; in "Seal document with forensic report" it goes to the loop
  automatically (§12.4) as
  `B9_RECOMMENDATION` / its type (the four anonymous fields only), so a recurring miss can be
  curated into a signed rule the deterministic engine then applies (§12.7). It never enters a
  sealed report's findings, the findings JSON or the court-ready narrative. The sealed reports
  state only coverage and counts (`brain9SweepLine`: pages read of total, windows, budget,
  recommendations logged, suggestions discarded) on the technical report's Methodology page
  and in the narrative's provenance record.
- **Consent.** Part of "Seal document with forensic report" (no switch since 2026-09-07); the
  disclosure box says the sealed page text is sent in windows and that every suggestion must
  quote the text or is discarded. Privileged matters use "Seal document": nothing leaves the
  device.

### 12.9 The trainer run — the engine improves itself on a schedule (2026-09-07)

Founder direction: improving the engine is automated (there are no servers), and contradictions,
offences and criminals' tactics are not personal information. The Worker runs Brain 9's trainer
role (Constitution v8 §2.10: "train and calibrate all other 8 brains… suggest additional
checks") on a schedule (`wrangler.toml [triggers]`, weekly, Monday 03:00 UTC) or on demand
(`POST /api/v1/admin/curate-publish`, admin token). `runAutoCuration`:

1. **Aggregate** the anonymous feedback of the last 7 days per `(detectorId, type)` with support
   and distinct days (`aggregateFeedback`; the four fields only, never content).
2. **Select learning signals** (`selectLearningSignals`): types reported under the detector ids
   `AI_IDENTIFIED` and `B9_RECOMMENDATION`, merged per type across both reporters
   (`AI_IDENTIFIED_UNANCHORED` is not a signal) — "the AI review found this and the engine missed it" — with
   support ≥ 3 over ≥ 2 distinct days, not already covered by a curated rule
   (`curated_from.type`), never SERIAL / CLEAN_SCAN / verification outcomes; at most 6.
3. **Draft**: the model (Llama 3.3 70B, temperature 0) drafts ONE co-occurrence group per
   signal — 4–8 generic lowercase phrases, benign alone, plus `min_cooccur` — from the type
   and its support only; no document content exists to draw on.
4. **Validate deterministically** (`validateAutoRule`): each phrase `^[a-z][a-z' -]{1,38}[a-z]$`,
   1–4 words, not a stop phrase, not already in the package (`packagePhraseSet`); 4–8 phrases;
   `min_cooccur` clamped to 2…n−1; `produces` the signal's CT id, else a known CT id, else CT43
   at apply time; rationale ≤ 200 characters with no digits, no `@`, no name-like pair.
5. **Publish additively**: at most 3 rules appended to the current package as `fraud_keywords`
   entries (`source_detector: "B9"`, `curated_from`, `min_cooccur`, `groups`), existing rules
   byte-untouched, constitution check, patch version bumped, signed with the master key, stored
   as current; the previous record kept under `rules:history:<version>`; an entry written to
   `rules:changelog`, public at `GET /api/v1/rules/changelog` (current version, trainer
   settings, last run with its reason, entries with the phrases added and the signal behind each).
   The changelog is part of the publish transaction: it is read **before** anything is stored
   (a KV read failure aborts the run with nothing published, and a transient read failure can
   never overwrite the log with a single entry) and written **after** the package is current,
   with one retry. If that write still fails the run is still recorded as `published` with
   `changelog: "not_written"` and the reason — the manifest is the truth, the changelog the log
   — never as a failure that claims nothing changed. Any unexpected throw anywhere in the run
   is a recorded outcome (`failed`, `unexpected: …`), never an exception the cron swallows.

Every client then applies the new rule at candidate tier (§12.7: severity ≤ 3, weight 0.5 on
the website) — Brain 9 recommends, it never issues verdicts. Safety valves: `AUTO_CURATE =
"off"` disables the run; an admin publish of a higher version supersedes anything the trainer
did; a run that cannot sign, read feedback or validate a draft records its reason under
`rules:auto-curate:last-run` and changes nothing.

### 12.10 The annexure EB run — precision, provenance and honesty (2026-09-11)

The founder sealed the 528-page "annexure EB" bundle with a forensic report and had the three
outputs (technical report, court-ready narrative, findings JSON) reviewed by an outside model.
The review's headline held — the goodwill, lessee/owner and countersignature findings are real;
most of the rest was noise — and two defects it did not name were the worst. Everything below
is pinned by `tests/annexure-eb-regression.test.mjs`, built from that run's findings JSON.

1. **The engine misquoted the record.** `extractPageText` dropped every token with no letter
   or digit before re-joining letter-spaced glyphs, so a PDF that draws each glyph with its own
   operator lost its full stops, slashes, brackets and ampersands: the cover's "Confirmed
   Losses: R231.3 Million" was sealed as "R2313 Million" on 28 pages, "t/a" became "ta",
   "(Pty)" became "Pty", and a registration number lost its slashes and was then called fake.
   `_voGlyphTokens` now keeps every visible glyph and `_voMergeGlyphRuns` merges glyph runs
   (single characters with nothing between them; a punctuation glyph attaches to the word
   before it; a run ending in punctuation attaches to the word after it) while two kerned
   words drawn as separate strings keep their space. A quote is the record's own characters.
2. **Context-blind detectors, made context-aware** (none of these loosens a gate; each keeps
   a positive control in the suite):
   - CT01 (D01): the negator must attach to the claim phrase — up to five words between them
     of which at most one may be a content word ("denied that the resolution was approved"
     still fires; "without notice claim immediate payment" no longer negates "payment") —
     and the affirmed and negated occurrences must share their object when both name one
     ("entitled to effect repairs" vs "not entitled to any compensation" is two propositions).
   - CT09 (D06): the 13-digit identity pattern is 13 digits (it was 12) led by a plausible
     YYMMDD; a currency prefix (R103509 is a rental) never counts; a lettered code counts only
     when the record labels it (ID, identity, passport) in the same passage.
   - CT20 (D11): "VAT REGISTRATION NUMBER" is a VAT number (D10's job); `CKYYYY/NNNNNN/NN` is
     a valid close corporation; a 13-digit YYMMDD-led value under a registration label is a
     natural person's identity number (Low, "confirm which the record means"); a middle group
     of 5 or 7 digits is "one digit off" (Low, verify against CIPC); OCR debris around the cue
     is skipped (`voLooksGarbled`). Only a labelled number in no known format stays High.
   - CT23 (D32): "signed on behalf of" is how every company executes a contract and is gone;
     "/s/" must stand alone (it matched inside "All Fue/s/Caltex"). (Later, §12.14 item 3: the
     plural "unsigned agreements" names a category and is skipped, and the quote is snapped to
     whole words.)
   - CT33 (D22): a year (1900–2100) after "Section … of" is a date, not a section
     ("Section 1987 of Illinois" is the Franchise Disclosure Act of 1987).
   - CT08 (D30): definitions are compared within ONE document only (`voDetectDocuments`);
     a defined term must be Capitalised where it is defined ("by other means" defines
     nothing); OCR debris is never a definition.
   - CT18 (D12): accounts conflict only when the record attributes both to the same party
     (nearest capitalised name or holder cue, bank names excluded) or, holder unknown, when
     they sit in the same document / page / payment instruction. Three parties' three
     accounts are not a mismatch; a changed-payment-details instruction still is.
3. **OCR provenance has a consequence.** `voCapOcrFormatFindings`: a character-sensitive
   finding (CT02, CT03, CT08, CT09, CT13, CT18, CT19, CT20, CT23, CT33) whose every cited
   page was OCR-recovered is held at severity 2 with the reason on the finding (`ocrCapped`;
   the printed words are "weight reduced", never a band name).
   `voOcrRescuePages` now returns `ocrPages` and per-page recogniser `ocrConfidence`; the
   engine result carries both; the confidence travels in the findings JSON only (PD1: no
   percentages in anything a reader sees). `voExcludeFooterOnlyPages`: a page whose only text is a seal footer is
   replaced by a placeholder before scanning (like template pages), so no finding can be
   anchored to a footer; a page counts as footer-only only when it carries the seal-footer
   signature (`VO_SEAL_FOOTER_SIGNATURE`) and nothing of three letters or three digits remains
   once the footer is stripped (`voIsFooterOnlyPage`, placeholder `VO_FOOTER_PLACEHOLDER`), so a
   short signature line is never treated as a footer. (Later state, §12.13: CT15 and CT22 joined
   the cap list (`VO_OCR_FORMAT_TYPES`); a finding of any other type anchored only on OCR pages
   is held at severity 3 (`ocrHeld`, findings JSON 1.5.0 `ocr_held`); a signed-package phrase
   rule is marked `ocrAnchored` and never capped.)
4. **The report tells the truth about review.** The Triple Verification review leg reads
   `NOT REVIEWED` (never `ENGINE-VERIFIED`) when the advisory AI review did not run; the
   plain lead and section 5 say "N engine findings (deterministic rules; AI review not run on
   this report)" and reserve "verified findings" for a reviewed report; the cover carries
   `INCOMPLETE READ: N pages not read` when any page went unread, and `AI REVIEW NOT RUN` when
   the report has findings and the advisory review did not run.
   Findings JSON v1.3.0 adds `review_status` (`unreviewed` / `ai_reviewed` /
   `ai_raised_candidate`), `ocr_provenance` (true / 'partial' / false), `ocr_confidence` and
   `severity_capped_for_ocr` — additive; `verification_status` is unchanged for the contract.
   Findings JSON v1.4.0 (evidence-bundle-4 critique) adds `secondary_capped` and `ocr_anchored`, so
   the reduced-weight flags travel with the finding and a consumer need not depend on the
   evidence-string tags.
5. **Forensic mode pre-flights the service.** `voPreflightForensicService` fetches
   `/api/v1/site/health`; anything but JSON `{ok:true}` means the address has no forensic
   service (the annexure EB run was made on the old Pages host, which answers every POST
   with 405), and "Seal document with forensic report" stops before sealing with the reason and
   the Worker address. Seal document never pre-flights. The pre-flight is run headless in
   `tests/annexure-eb-regression.test.mjs` §12: an HTML answer, a 405 and `{ok:false}` block;
   JSON `{ok:true}` clears; a dropped connection is retried once, then reported as unreachable.
   (The session's one-off check script was never committed.)
6. **The OCR cap asks.** When a bundle has more scanned pages than `VO_OCR_MAX_PAGES`, the
   person sealing is asked once (with a time estimate) whether to read them all;
   `window.voOcrContinueAll` overrides the prompt for headless runs. Anything still unread is
   named on the cover and in "Pages the engine could not read".

An adversarial review of the release (four lenses, each finding refuted or reproduced with a
runnable check) added, before merge: TJ-array kerning spaces (`VO_TJ_SPACE_KERN`: a word space
drawn as a large negative adjustment between two multi-character chunks, the pdfTeX pattern,
is a space; letter-spaced single-glyph headings stay one word); C0/C1 control bytes dropped;
the merge rules refined so a line-end full stop drawn in another font never glues the next
line's first letter or clause number onto the word, openers carry forward and joiners pull the
next word on; `voLooksGarbled` treats bullets, pipes, dashes, ordinals, amounts and consonant
clusters as ordinary typed text; CT20 validates the first whitespace-delimited token (a valid
number followed by a street number or a year stays valid); CT09 fires only when the SAME
person carries two identity numbers (a lease naming two people with theirs is ordinary) and
every pattern needs an identity label; CT18 reads "payable to the Franchisor" as the party,
never a field label, normalises spellings (`ABC Properties (Pty) Ltd` = `ABC Properties Pty
Ltd`) and always reports a changed-banking-details instruction; CT08 keeps each document's
own first definition; CT01 uses the negator nearest the claim word and frees its modifier
("never made any royalty payment"); footer-only pages are gated on the actual seal-footer
signature and keep any three-letter word or three-digit run as evidence, and the placeholder's
mass stays under `VO_NEAR_EMPTY_CHARS` so CT26 still names an unread scanned page; the cap
note and the report print no band word and no percentage (§15.2, PD1); the pre-flight runs
before the pipeline starts, times out at eight seconds, retries a dropped connection once,
names the real reason (no service / unreachable / unhealthy), also guards voice-note batches,
and shows an on-page notice as well as the alert; `review_status` is `ai_reviewed` only for a
finding a batch actually answered (a failed batch and anything past the 200-finding cap stay
`unreviewed`); one range-aware page parser serves the cap, the JSON and the report.

Not adopted from the outside review, and why: a bounding-box `PageMap`, per-word OCR
confidence gating, CLI flags (`--strict-anchor`, `--trace`, `--resume`) and a module refactor
— the engine is one browser file by design (§12, inlined into the seal page), the anchor
rule already moves unanchorable findings out (`voEnforceAnchorRule`), and per-page confidence
is recorded rather than gated until a run shows the threshold. Page anchors themselves
(316, 249 vs 386) could not be checked from the sealed outputs alone: the bundle prints
"Clean Bundle Page N of 528" on every page and the engine's numbers are that series, and
documents 7 and 9 of the bundle are two scanned copies of the same sealed material, so a
clause found on one page can exist on the other. If a finding is ever cited to a footer-only
page again, item 3 above is the guard that failed.

### 12.11 The re-run — the engine must not read its own report; one count; no template in AI's clothes (2026-09-13)

The founder re-ran annexure EB on the Worker address (319 pages OCR'd, 15 engine findings
retained by the AI review, 3 AI candidates, 23 Brain 9 recommendations, the cover quote now
"Confirmed Losses: R231.3 Milli…") and had the outputs reviewed again. What that review found,
and what changed — every item pinned by `tests/annexure-eb-regression.test.mjs` §13–14:

1. **The engine read its own earlier report as evidence.** The bundle opens with a 26-page
   Verum Omnis supplementary report (masthead "VERUM OMNIS FORENSIC REPORT … Report Reference:
   VO-AF-2026-0523-SUPP"), and the engine sealed that report's own heading "GOODWILL
   FORFEITURE CONTRADICTION" as a CT45 finding (p.2 vs 3) and its running title "…Unsigned
   Agreements…" on 40 pages as a CT23 signature finding. `voExcludeSecondaryReportPages` now
   replaces, in place, every page carrying a Verum Omnis report masthead (`Report Reference:
   VO-`, or the brand with FORENSIC REPORT / SEALED DOCUMENT / the seal line) and every page
   carrying that report's own running title, closing one- or two-page gaps inside the run
   (an OCR miss on the title) and never a wider one. The exclusion is disclosed in the
   extraction notes like template pages (§12.10 item 3, PD6). A Verum Omnis report is
   analysis, never evidence; sealing one with a forensic report says "nothing in this file
   was examined as evidence".
2. **CT44 aligned the wrong parties.** "The Franchisee is not the owner of the Premises"
   (p.28) was set against "All Fuels … the Owner/Lessor of the site" (p.112): two parties.
   D38 now reads the side each phrase is about from the nearest role word (grantee: lessee,
   tenant, franchisee, licensee; grantor: lessor, landlord, franchisor, licensor,
   owner/lessor) and pairs a lessee clause only with an ownership line about the same side
   or one that names no side; "is not the owner" is never itself an ownership line. The
   franchise-lease fixture ("the FRANCHISOR is not the owner …" vs "Bright Idea Projects …
   became the registered owner") still fires.
3. **CT08 read 'Accommodation Rental' and 'All Fuels Computer System Rental' as two
   definitions of "rental"** (five such rows). `definitionRe` now captures the whole quoted
   phrase — straight and curly, double and single, an apostrophe inside a word is not a
   quote — and a run of Capitalised words as one term.
4. **CT04 linked an expiry to an invoice from another exhibit** (p.326 vs p.412). The
   invoice must be billing under the expired instrument: the two pages must lie in the same
   stated document where the bundle states its own boundaries, and the company names printed
   on the two pages must overlap when both print any. `voDetectDocuments` now ignores the
   bundle's own running numbering ("Clean Bundle Page 326 of 528" on every page), which had
   made the whole bundle one document. A page that names no company cannot be excluded on
   that ground, and the finding still tells the reader to verify the instrument.
5. **"Agreements &The"**: `&` was a joiner glyph. It is a word of its own.
6. **The report's lead was the Worker's template, labelled as the AI narrator's.** When the
   model fails, `/api/v1/ai/narrate` answers with a deterministic template (`model:
   'template-fallback'`); the template wrote "an integrity score of 41 with a confidence
   rating of MODERATE" and the client marked any returned text `'ai'`, so the sentence led
   the report under "Written by the AI narrator". Now: the template prints no score and no
   band and counts engine-verified findings apart from AI-raised candidates; the client
   labels template text `'local'` (it goes to the annex, never the lead); the render-time
   §15.2 gate (`VO_BANNED_SENTENCE_RE`) drops any sentence carrying "integrity/fraud/risk/
   overall score", "score of N", "confidence rating/band/level" or "high/moderate/low
   confidence" whoever wrote it.
7. **One count.** The narrative said "18 substantive contradictions, 7 serious" (it counted
   the 3 AI candidates), the lead said "16 contradictions established" (the summary was
   computed on the pre-review list) and the cover said 15. `secNarrative` counts
   engine-verified findings only and tells AI candidates apart in a separate sentence; the
   host recomputes `summary` on the retained engine findings after the review.
8. **Narrator provenance.** Every court-ready section was asked for and every draft was
   discarded by the server gate, yet the provenance line read "AI narrator: not run". The
   host passes `sectionsAttempted`; the line now reads "asked for N sections; no draft
   passed the server's anchor and language gate, so nothing AI-written is printed".
9. **Brain 9 language.** Recommendations such as "Criminal contradiction" are verdicts, not
   pointers. `SWEEP_SYSTEM` states the neutral-language rule and `verifySweepItem` discards
   any item whose type or rationale carries a verdict word (`SWEEP_VERDICT_RE`).
10. **File size, stated.** The results panel prints "Original N → Sealed M (+Δ for the
    watermark, QR and footer on every page)". The seal adds 1–4 % to a native PDF and about
    1 % to a scanned one (measured on the pdf-lib path); an 88 MB output from annexure EB is
    the size of its OCR-rendered input, not the seal's doing.

**The same night, from the first document sealed after the deploy** (`AllFuels_Timeline_
Report_Des_to_Current.PDF`, 17 native-text pages printed from Chrome; pinned by §15 of the
same suite):

11. **A PDF printed from Chrome or Edge read as seventeen empty pages.** Chromium/Skia draws
    text with Type3 fonts, ONE-BYTE character codes (`<39> Tj`) and a ToUnicode map whose
    codespacerange is `<00> <FF>`. `_voDecodeHexString` assumed two-byte codes for every
    mapped font, read `<39>` as nothing, and the whole file fell to OCR. `_voParseToUnicode`
    now records the code width from the codespacerange (or from the mapped keys' length),
    `_voDecodeHexString` decodes at that width, and `_voMapLiteral` passes literal strings
    drawn with a one-byte-mapped font through the map (pdfTeX ligatures, custom encodings)
    keeping any byte the map does not name. Two-byte (Identity-H) fonts are unchanged.
12. **A font name with a hyphen, underscore or plus was never selected.** The font-select
    pattern accepted `[A-Za-z0-9]+` only, so `/C2_0 12 Tf` (Acrobat) or `/Helvetica-7098 Tf`
    (pdf-lib) left the previous font's map in force. Any PDF name is now accepted.
13. **A line end glued words** ("side ofthe same document"): a producer that positions every
    glyph itself draws no space at a line end. A text matrix whose vertical position changes,
    a `Td`/`TD` with a vertical component, `T*`, `'` and `"` now yield a word boundary, as
    pdf.js does. Hyphenated words split across lines read "Kwa- Zulu"; accepted.
14. **"CAS 96/6/2026" is a SAPS case number, not an impossible date** (it was sealed at
    severity 5). D03 skips a date-shaped value whose preceding words are a case, docket,
    reference, file or matter cue.
15. **A valid registration number was cut by a 40-character window** ("CIPC company-history
    search on 2002/059909/23" became `2002/059909/2`, "not a valid SA format"). D11 requires
    the number to START within 40 characters of the cue but reads it whole, and quotes it
    whole.
16. **An AI-compiled summary is disclosed, never excluded.** A file whose first two pages say
    "Compiled by: Claude" (or another assistant, or "I'm Claude") is analysis of other
    documents. `voNoteAiCompiledSummary` adds one sentence to the extraction notes: every
    finding on it describes what the summary says and must be verified against the primary
    documents it cites. Only Verum Omnis's own reports and the analysis template are excluded.

Not adopted, with reasons: a bundle-wide page/quote resolver ("AnchorResolver") — every
finding already carries the page the quote was read from, and `voRulePagesOf` reads ranges;
excluding every page more than N pages from a finding's partner — distance is not evidence;
dropping CT45 p.73 vs 249 — the two clauses are on the record and the finding says what
each states.

### 12.12 The evidence-bundle-2-docs run — sealed exhibits are evidence; the engine reads its own footers (2026-09-27)

The founder sealed a 68-page bundle of previously sealed exhibits (a customer's email chain
to a bank's fraud department, card-statement screenshots, voice-note transcripts, an
affidavit, two banks' outcome letters) with the forensic report and the court-ready
narrative, and had the three PDFs reviewed. The review found three false findings and a
narrative that repeated them; the engine run in Node on the same file found the causes
underneath. Every item is pinned by `tests/annexure-eb-regression.test.mjs` §16 with the
bundle's own text.

1. **The engine excluded the first 38 pages as a "prior Verum Omnis report".** §12.11 item 1
   taught `voExcludeSecondaryReportPages` to recognise the brand beside FORENSIC REPORT — and
   also beside "SEALED DOCUMENT" and "SEAL |". Those two are the footers this platform prints
   on the EVIDENCE it seals ("Verum Omnis Sealed Document | Source: … | Page 1 of 4", "VERUM
   OMNIS SEAL | seal-…"), so every previously sealed exhibit was excluded, the report said
   "Every page of this bundle was read", and the reviewer noted that the engine "missed the
   actual fraud evidence" — it had never scanned it. Only a report masthead excludes now:
   the brand beside FORENSIC (EVIDENCE) REPORT, COURT-READY NARRATIVE or NARRATIVE REPORT, or
   `Report Reference: VO-`. When pages ARE excluded, the unread-pages section prints the
   exclusion sentence and never "every page was read".
2. **Every seal footer read as CJK.** pdf-lib's standard Helvetica (Type1, WinAnsi, no
   ToUnicode) draws hex strings, and `_voDecodeHexString` guessed UTF-16 for any even-length
   one, so "VERUM OMNIS SEALED ORIGINAL | Seal: VO-… | … | 39/61" became 噅剕䴠位义匠… on
   every sealed page (the odd-length "PRIVATE SEAL -- FREE TIER" decoded). The extractor now
   passes each font's Subtype: a simple font (Type1, TrueType, Type3, MMType1) draws ONE byte
   per glyph, read as WinAnsi (curly quotes, dashes and the ellipsis included); only Type0
   fonts take the CMap's width. `voIsFooterOnlyPage` and `VO_SEAL_BOILERPLATE_RE` strip the
   footer's slash date and time, "Chain: N prev" and the "scan the code or verify at …" line,
   so a footer-only page is still one.
3. **CT02 "amount is stated as R116 and as R 8000 (variance: 194%)".** Two defects: "R116
   124.00" (space-grouped thousands) was read as R116, and "an amount of R116 124.00" in one
   customer's outcome letter (p.45) was paired with the column header "Amount Merchant" above
   another customer's disputed-transaction table (p.64). D02 now reads space-grouped
   thousands (currency symbol required), pairs a label only with an amount joined to it by a
   short connector ("of", ":", "(excl. VAT)"), and never compares entries from different
   stated documents. `voDetectDocuments` now reads this platform's own seal footer ("Seal:
   VO-… | … | 45/61") as a document boundary — a bundle of sealed exhibits states its
   boundaries even when the exhibits print no "Page x of y" — and, where one page carries
   nested numberings, takes the smallest stated total as the exhibit.
4. **CT18 "4 different bank account numbers … 022355359, 1099145183, 638230461".** The first
   was an OCR fragment, the second the tail of "Case Ref: 2026-1099145183", the third a
   "Mobile +27 638230461"; the count said four and the list three. D12 skips a run joined by
   `-`, `/` or `.` to other characters and a run preceded by a telephone cue or a country
   code, and lists every number it counts.
5. **CT37 "Multiple email domains: standardbank.co.za, gmail.com, verumglobal.foundation…".**
   A correspondence bundle always carries many domains, and the seal footer's own was among
   them. D25 now reports one thing: a LOOKALIKE domain — one or two characters from another
   in the record ("standandbank.co.za" beside "standardbank.co.za", the shape of an
   impersonation address) — with both domains' pages. Both must be read from text pages (OCR
   manufactures lookalikes), a domain that prefixes another is a truncated read of it, and
   seal boilerplate is stripped first. On this bundle that is the one finding that survives,
   and it is real: p.48 prints `Kerusha.moonsamy@standandbank.co.za`. (Later, §12.14 item 2: two
   domains both under a listed restricted government suffix — "dmre.gov.za" and "dmpr.gov.za" —
   are never a lookalike; a commercial lookalike, and a lookalike of a government domain, still
   fire.)
6. **One count, again.** The one AI candidate (DOMAIN_TYPO) was a Triple Verification row
   ("Detected: PASS", "ACCEPTED"), a "top liability", a B1 Contradiction Brain finding, a row
   in Statutory Anchoring and Findings in Detail, and a count in the offence and dishonesty
   matrices, while the cover said three verified findings. `isEngineFinding` (not demoted,
   not SERIAL, not `source === 'ai'`) filters every table that counts, ranks or maps findings
   to law; where a candidate is listed beside findings (the type summary, the evidence
   appendix, the evidence map) it is labelled "AI candidate".
7. **"Every documentary element of common-law fraud is evidenced in the record."** The
   offence-elements block maps finding TYPES to elements; that a finding of a matching type
   exists is a fact, that it evidences the element is an assessment. The block now says
   "matched by at least one anchored finding of a type that can evidence it. Whether those
   findings establish the element is for counsel to assess".
8. **Parties: "HOLL YWoODBETS", "Hot YooDRETS", "Banas TT JT ETE", "PAYMENT TO
   HOLLYWOODBETS".** OCR garbage from a scanned statement, bound as parties by recurrence.
   `voLooksLikePerson` rejects a case flip inside a word, a vowel-less word of four or more
   letters and more than one bare initials group; "payment", "debit", "credit", "fee" and
   "to" are not name tokens; and `voBuildNameRoster` requires a roster name to be printed on
   at least one text page when the bundle has any (a wholly scanned bundle keeps its
   OCR-read names).
9. **The narrative printed "standardbank. co. za".** The Worker's template wraps a finding's
   evidence in quotes, and a CT02 evidence begins with a quoted word (`"amount" is stated
   as …`), so the nested straight quotes desynchronised `splitSentences`' quote masking and
   every dot in the next finding's domain list became a sentence end. A dot followed directly
   by a letter, digit, `@`, `_` or `-` is now inside a token whatever the quote pairing, and
   the template wraps evidence in typographic quotes.
10. **"Per-finding severity is moderate"** in the annex summary is a band word in a
    sentence; `generateSummary` states the count and no band.
11. **The narrative's last page carried "PAGES READ THROUGH OCR" twice** (the unread-pages
    section prints the block and the annex called it again). `secOcrProvenance` prints once
    per document.

What the deterministic engine still does not do, stated plainly for the founder: it does not
read that "we will not be in a position to reimburse you" and a later goodwill settlement
offer are in tension, that an OTP was used to provision Apple Pay, or that a customer's
R632,000 claim sits against the bank's "authorised eCommerce" position. Those are semantic
readings across documents; Brain 9 may raise them as recommendations, and the rule loop can
turn a recurring one into a phrase-pair rule. The engine's contribution on this bundle is
the lookalike domain and a clean, disclosed read of all 68 pages — not the three findings it
sealed on 27 September.

Not adopted: a "same local part at two domains" finding (people keep several addresses);
excluding OCR pages from every detector (the OCR cap, §12.10, already holds format findings
on them at severity 2); a semantic "settlement offer contradicts refusal" detector (a phrase
pair the rule loop can carry once it recurs, not a built-in).

### 12.13 The evidence-bundle-4-docs run — the engine's own seal is not evidence; precision on a 651-page bundle (2026-10-01)

The founder sealed a 651-page bundle of previously sealed exhibits (franchise agreements, an
MOU, affidavits, a consumer complaint, extracts prepared on the seal date) with the forensic
report and the court-ready narrative, and an outside review could support one of the 44
findings. The bundle's text layer (284 pages) and the report's own quotes gave the causes;
`tests/annexure-eb-regression.test.mjs` §17 pins each with the bundle's text. The run was
sealed four days after §12.12 shipped, so everything there held; what follows is new.

1. **The seal stamp read as a stated date, 25 times.** Every page of a previously sealed
   exhibit prints this platform's footer with the seal's date and time ("30/09/2026 15:41:47
   Africa/Johannesburg"); OCR read the stamp as "0/09/2026" on 25 scanned pages and D03
   sealed each as an impossible date, while the timeline pinned other findings to the seal
   date. `voStripSealFurniture` now removes the platform's own footers from every block (text
   layer and OCR, the `[OCR]` prefix kept) before any detector runs — AFTER the document
   boundaries have been read from those footers (`voCacheDocSegs`, returned from a cache for
   the same array) and after footer-only pages are recognised. Backstops for a mangled footer:
   the brand line as OCR renders it (E as 3, I as 1 or l) is stripped through to the page
   marker; a date followed by a clock time is a stamp only in the company of the footer's other
   words (hash, seal id, zone name, page marker — `voIsStampContext`), so a bank line, an email
   header or a till slip keeps its own timestamp and D03/D04 still read it; and a date with a
   zero day or month ("0/09/2026") is a digit OCR lost, never an impossible date — not a claim
   of the record.
2. **Nine registration numbers were OCR readings of three clean ones** ("20121226353/07" for
   2012/226353/07, "1811100115407" for 1911/001154/07, "200205930923" for 2002/059909/23),
   plus "ID/Registration number of complainant 510209 5091087" — a person's identity number
   in a form field that takes either, cut short by OCR. On an OCR page D11 now compares a
   malformed token with every clean SA number printed anywhere in the bundle and treats one
   within two edits (digits only) as a reading of it, and any other malformed token as
   unreadable — both disclosed in notes, never findings (founder direction 14). On a
   native-text page the record printed exactly those characters, so "1911/0001154/07" beside
   "1911/001154/07" in the same pleading remains the Low "one digit off" check of §12.10. A
   value under an "ID/Registration" cue that starts with a plausible date of birth is an
   identity number at any length OCR left it, and is never "repaired" into a company number;
   clean twins are harvested from text pages first and the nearest wins. Every finding
   anchored only on OCR pages is marked `ocrAnchored`, whatever its type or severity, so the
   report's split count sees it.
3. **Two definitions of "motor fuel'".** The agreement opens a term with `"` and closes it
   with `'` (`"Astron Motor Fuel' means …`, `" Motor Fuel' means …`); the quoted branch of D30
   could not read the pair, the unquoted branch read the inner words, and two different terms
   became one term defined twice (likewise "franchised business" from inside "Market Value of
   the Franchised Business'"). The quoted branch now reads a matched double-quote pair first,
   whatever it holds ("Shareholders' Agreement" — a plural possessive is not a closer), then any
   opener with any closer; the key drops quotes and inner spaces; an unquoted run inside a
   quoted phrase whose closer OCR dropped is never a term of its own (`voInsideOpenQuote`);
   and a definition a page cites from another instrument ("In terms of clause 1.36 of the
   Franchise Agreement, "Goodwill" means …" in a pleading) is not the document's own
   (`CITED_DEFINITION_RE`).
4. **"Owner of certain Intellectual Property" paired with a lessee clause.** D38's ownership
   half must concern immovable property, and the FIRST object the ownership sentence names
   decides, read to the end of the sentence: premises, property, site, land, erf, building, a
   deed of transfer or title deed; never intellectual property (OCR's "lntellectual |
   Property" included), trade marks, goodwill, shares, equipment or "the business" ("business
   premises" are premises). "Owns the premises, the equipment and the stock" and "the owner of
   property on which the business was operated" (p.78) are ownership of premises; "the owner
   of all right, title and interest in and to the Intellectual Property" is not, however far
   out the words sit. The side is read from the phrase's whole sentence (a recital names "THE
   FRANCHISOR/OWNER" 120 characters before "the owner of the immovable property"). Pairing:
   a half on the clause's own side pairs wherever it sits in the record — the proof that the
   clause's party owns the premises lives in another instrument — one step down and tagged
   "verify" when the halves sit in different stated documents; a half naming no side pairs
   only within the same stated document and within twenty pages, otherwise it is an engine
   note naming both pages. Where no document boundaries could be read, a far same-side pair
   is tagged and a far side-less half is a note (`VO_D38_NEAR`).
5. **"I admit the contents of this paragraph" as a contradiction.** A pleading admits
   paragraphs, not facts: D01's admission branch skips a cue whose own sentence is in the
   answering-affidavit grammar ("admit the contents/allegations/averments/correctness … of
   this/the said/sub-paragraph 13.2", "admit the contents hereof", "admit paragraph 13",
   "admit only the first sentence of this paragraph"). An "AD PARAGRAPH" heading on its own
   suppresses nothing — "AD PARAGRAPH 7: I admit that I signed the deed of suretyship" is an
   admission of fact — and every occurrence of a cue on a page is read, so a form sentence
   never hides a later sentence of fact (the sentence of fact is the one quoted).
6. **"subtotal R1161950 + VAT R1 = R1161951 but stated R1.08" led the report.** D13 combined
   the first subtotal, VAT and total found ANYWHERE in the bundle; it now works one page at a
   time, reads figures as this country's documents print them (space- or comma-grouped
   thousands, comma decimals, a rate written before the amount is a rate, "Tax Invoice No.
   1234" is no amount), and only on figures that could be an invoice (VAT zero or within a
   tenth to a quarter of the subtotal, a total within half to twice it) — otherwise a note
   that the page's figures do not read as one invoice, which blames OCR only on an OCR page.
   Both standard rates since 2018 are accepted, a zero VAT line is zero-rated, and a
   discount, delivery or credit line between the subtotal and the total leaves the page
   unchecked. The trade-off is stated: a VAT line below a tenth of the subtotal is a note,
   not a finding. The printed words carry no percentage (PD1), and the note states the
   recognised figures as a fact ("Figures recognised on page 397 do not read as one invoice
   (…): read the page image before relying on any of them"), never a guess about why.
   CT15/CT22 join the OCR cap (§12.10); a signed-package phrase rule is never capped — it
   matched words, not characters — but is still counted apart (`ocrAnchored`).
7. **An extract prepared on the seal date read as the record.** A stated document whose title
   or first page says it is an extract, summary, synopsis, commentary, chronology or digest
   prepared, compiled, drafted, reproduced or annotated after the fact, or "pages reproduced"
   (`VO_SECONDARY_TITLE_RE`), is secondary: a finding whose every cited page sits in it moves
   to the engine notes as a lead to verify against the primary record; one with some pages
   there is held at severity 2 and tagged. The "uncountersigned" line and the "Goodwill: N/A"
   half on p.557 were such leads. The primary record describes itself in the same words and
   is never secondary: a tax invoice or quotation "prepared for … on 12 March 2024", financial
   statements "prepared on the historical cost basis", a valuation report "prepared by";
   "prepared by/on/for + a date" on its own is not a title, "notes" and "analysis" count only
   as "notes on" and "analysis of", and a secondary noun that follows the name of a primary
   record ("Summary of significant accounting policies … prepared") is a heading inside that
   record (`VO_PRIMARY_RECORD_RE`, read from the secondary noun to a little past the verb — a
   primary noun BEFORE the noun names the extract's source: "Franchise Agreement — Extract
   prepared …" is secondary; an auxiliary before the verb, "the financial statements have been
   prepared", is the record; `voIsSecondaryHead`). The gap between noun and verb tolerates an
   abbreviation period ("Extract from Mr. Bentz's affidavit, prepared"); a participle needs no
   verb ("Extracted pages", "Summarised by counsel", "Commentary on the MOU"). A quotation note
   ("Here is the exact wording of the relevant portions of the Franchise Agreement", p.444) and a
   page compiled by an AI assistant are accounts of the record too (`VO_QUOTATION_NOTE_RE`,
   `VO_AI_COMPILED_RE` on every document head). Pages no stated document covers — a
   one-document file, a run shorter than three pages, an orphan page between two documents —
   are tested by their own head, so an extract sealed on its own is secondary from its first
   page to its last. A finding of two halves ("Page 12 vs Page 557") with either half on a
   secondary page is a contradiction between the record and an account of the record, not of
   the record: a lead, never a reduced-weight finding; only a list finding with some pages
   there is held at severity 2. "… and 3 more" and "(clause 7)" in a location are not pages
   (`voRulePagesOf`); a finding that lists more than eight pages carries them all in `f.pages`
   and every page test reads it (`voFindingPages`), so a ten-page finding wholly on an extract
   is a lead and never counts as native text. The reach on the sealed bundle is stated and
   pinned: three consecutive stated documents headed "Extract prepared 30 Sept 2026 - pages
   reproduced…" (p.450–575) are secondary — the signature lead on p.557 and the two goodwill
   pairs are leads, the eight-page admission is held at reduced weight. The demotion runs before
   the signed rule package and the per-type cap, so a lead neither blocks a package rule nor
   consumes a type's budget, and before the OCR cap, so a lead carries no cap tag; each lead goes
   to the engine notes with its page, where both reports print it (§12.13 item 11). The engine
   note names each secondary document and its page range (`voSecondaryWhere`), so a reader can
   see which pages the leads sit on.
8. **Findings dated from unrelated lines.** `voAnchorEnrich` took up to two dates from
   anywhere on the cited page, so a registration-number finding was dated "1 October 2005".
   WHEN now comes from the finding's own words or, failing that, one date from the sentence on
   the page that holds the quote (`voSentenceAround`).
   A quote that D01, D09 or D27 wrap in ellipses ("…tive attorneys, provides that…") is keyed
   on its own words, so its sentence still dates it. A dotted triple is a date only with a
   four-digit year ("1.1.50" is a clause), a numeric token after a clause, paragraph, section or
   item cue is a reference, and only a date the timeline can order reaches `anchor.when`, so a
   clause number never blocks the sentence fallback. On a form or OCR page with no sentence
   boundary the window closes to 160 characters each side, so a letterhead date never dates
   the quote. The stamp's clock is read as OCR leaves it ("1S:41:47", "15 41 47", "| 15:41:47",
   `VO_CLOCK_AFTER_RE`) and a date within forty characters before the footer's "Johannesburg"
   is the stamp whatever the clock looks like. A term in single quotes ('Astron Motor Fuel'
   means …) is a quote too, so a definition finding is dated by its sentence; the anchor reads
   the full page array of a finding whose location prints "… and N more".
9. **Parties "Supreme Court", "Service Station", "Timol de", "Auditors Name Postal
   Address".** Court, trade and form-label tokens join `VO_NON_PERSON_TOK`; a name ending on a
   surname particle is cut short and rejected.
   A final particle rejects a name only when written lowercase ("Timol de") or when it never
   stands alone (Van, Der, Den, Von, De, Al): "Thanh Le", "Li Bin" and "Margaret Court" are
   people, so "court" is a stop phrase ("Supreme Court", "High Court", "Court Order"), never a
   stop token; a Title-Case four-token name ("Johan Van Der Merwe") is read whole. The sealed
   report's other false parties are stopped too: the detector's own label ("Registration
   Number"), form and address words (tel, street, road, city, office), headings ("AD
   PARAGRAPH", "AS WITNESSES"), the franchise agreement's defined terms ("Franchise Interest",
   "Approved Supplier", "RAS Retail Margin"), a case title's "v" and an invoice column ("ADD
   DISBURSEMENTS I R": a single letter after the first token, unless an initial with its
   period), an OCR variant of a stop word ("Audifors", "Statlon": six letters or more within
   one edit), a name spanning a line break ("Associates Tel") and one cut by a slash ("All
   Fue/s"). A run that carries a stop word is trimmed to the name before it, never dropped
   whole (`voTrimPersonName`): "Name: Zeyd Timol Postal Address" binds "Zeyd Timol", "Zeyd
   Timol de" at a line end binds "Zeyd Timol", a lone surname binds nothing; "high" and
   "station" are phrases ("High Court", "Service Station"), since "Jennifer High" is a person.
10. **The report.** `FRANCHISE_LEASE` was missing from `CATEGORY_ORDER`, so CT44/CT45 were
    absent from the findings matrix (41 of 44 listed); the CONTRACT subject now has a label
    ("Contract, Lease & Franchise") and key points, and the dishonesty matrix reads the subject
    through `subjectOf`, so a CT44 sits under one subject in every table. Candidate law: the
    Rental Housing Act (residential tenancies) and the POCA "pattern of racketeering" entry
    leave the CONTRACT list; an arithmetic finding (CT15/CT22, the D13/D14 output — never CT13
    or CT14, which are title and entity-status findings) carries no money-laundering, FICA or
    corruption provision; a registration-number finding (CT20) and any Low finding carry no
    corruption, consumer or commercial-fraud statute, common-law misrepresentation at most
    (`statutesForFinding`). "They cannot be changed, altered, or deleted" became "any change
    to them is detectable" — a hash proves tampering, it does not prevent it — and so did the
    legal-elements seal paragraph ("no party can alter it afterwards", "forever"), the section
    title ("HOW ANY CHANGE TO THIS RECORD IS DETECTED") and the Constitution line ("a sealed
    instrument whose fingerprint is anchored"). Every count of findings goes through
    `voCountPhrase` — the cover, the executive summary, the summary trailer and the narrative
    opener — which tells apart findings anchored only on OCR-recovered pages or on a secondary
    source and says what the engine did: their quoted wording is to be verified, and only
    those whose severity the engine lowered are "held at reduced weight" (an uncapped CT01 or
    CT44 on a scanned page keeps its severity, and the report never says otherwise). The
    Triple Verification table says how many findings the review dropped. The narrative's
    provenance prints both gate counters and, apart from them, the rebuttal sentences dropped
    with a claim the gate removed; a rebuttal is recognised in the narrator's own vocabulary
    ("The record at p. N states …", "Assessment: contradicted …", with a bullet or emphasis
    marker), and a heading-shaped line between a claim and its rebuttal keeps the claim's
    standing; the scrub keeps the server's paragraphing (blank lines between blocks, which the
    renderer splits on), and a trailing page cite "(p. 20)" is not a sentence of its own, so a
    removed claim leaves no stray cite that would keep its rebuttal alive (`scrubRebuttals`,
    module-level, exported as `_scrubRebuttals`). The on-device fallback narrative
    (`buildLocalNarrative` in `seal-document.html`) carries `FRANCHISE_LEASE` in its own
    category tables, and `tests/inline-scripts.test.mjs` now compares `CATLAB`/`CATORD` with
    `CATEGORY_LABEL`/`CATEGORY_ORDER` so a category added to the renderer cannot be missed again.

11. **Engine notes misfiled.** A detector's `contextOnly` note (figures that do not read as one
    invoice, registration numbers OCR could not read, an ownership line not paired) was
    appended to the extraction notes as unlabelled text, so the technical report filed it
    under "items it could not pin to a specific page" and the court-ready narrative dropped
    it. The engine now returns them structurally (`contextNotes: [{type, location, text}]`)
    and under a labelled "Engine notes (n):" segment; both reports print them under their own
    heading with their page (`engineNotes`, `secEngineNotes`), never as a finding.
12. **The gaps pass.** The critique's last agent read the whole sealed output against the plan and
    found what no rule covered. Adopted: review-dropped findings no longer feed the timeline, the
    person index or the type count (the page recomputes them on the retained findings, so
    "Contradiction types triggered" and "distinct patterns" agree); every contradiction anchored
    only on OCR-recovered pages is held below serious (severity 3, `ocrHeld`) until a person has
    read the page image, with the format checks still at Low; an invoice's figures read by OCR
    below a recogniser confidence of 60 are a note (`VO_OCR_FIGURE_MIN_CONFIDENCE`); the report
    says "anchored to the Bitcoin blockchain" only when the OpenTimestamps proof is confirmed —
    at sealing it is submitted and the confirmation pending, and the report says so
    (`anchorPhrase`, `timestampClause`); the "verbatim" columns ("Quoted record", "What the
    document says", the evidence appendix, the monetary figures) print the passage the finding
    quotes (`anchorQuote`) and mark an engine computation as the engine's observation, never as
    the record's words; "Party implicated" is said only of a party the case declared and never on
    a format check, a name the engine found on the page is stated descriptively; a finding held at
    reduced weight satisfies no offence element; an AI candidate with no page stays out of the
    evidence appendix, the evidence map and the type summary; the CT15/CT22 plain-language lines
    describe arithmetic, not two statements of one amount; CT45 has its own next step; the
    "pages the engine could not read" section lists footer-only pages; the document map names
    pages no stated document covers and never prints OCR debris as a title; the person index
    counts findings and merges name variants (narrowed by the second pass below to spelling,
    spacing and suffix variants); the contents page scales to
    fit and the section counter continues after the constitutional block; the narrative edition
    is not printed piecemeal when fewer than half the narrator's sections pass the gates; D38's
    termination language must sit on the clause's own page; quote windows snap to word
    boundaries; the close-corporation short form CK YY/NNNNN/NN is valid and its OCR readings
    are repaired through the window's digits; pleading roles, "manual" and a Title-case
    three-letter token with no vowel are not names; the breadth note states its basis; the
    methodology no longer claims per-severity totals it does not print, and the review is a
    single model. Deferred, with reasons: collapsing identical findings into one row (each page
    is a separate anchor by design, and the engine's dedup already collapses exact duplicates);
    the narrator's selection of the findings it quotes (server-side); a dictionary for OCR-debris
    names; a context-keyed redesign of the statute lists; tuning the advisory review leg.
    A second verification pass (three adversarial lenses over the commit) then corrected it:
    `anchorQuotes` returns every passage the record states (both halves of a contradiction)
    and never a label ('"purchase price" is stated as …') or the engine's cue
    ('("i acknowledge that")'); a numerical, currency or banking discrepancy returns its stated
    figures minus the computed variance, and the two-sided executive-summary lines say "the
    engine observed" when a side carries no quote; D38 tests the termination language per lessee
    hit on its page or the next, so a recital before the clause never shadows it and a clause
    split by a page break still fires; `docTitle` scores debris (a vowel-less token that is not
    an acronym or a company suffix, a letterless token, a stray symbol) rather than grammar, and
    says "in the OCR text" only of an OCR page; the party line decides "declared" on the
    normalised party list and lists each name once; the person index merges spelling, spacing
    and suffix variants only (`sameNameVariant`), never two different people, and counts a
    finding once however many spellings name the party; two further "anchored via
    OpenTimestamps" sentences go through `anchorPhrase`; footer-only pages are listed once; a
    sanctioned one-line narrator answer counts as passing and the suppression note prints once;
    the OCR-provenance note counts format checks held at Low apart from contradictions held
    below serious; findings JSON v1.5.0 adds `ocr_held`.

Not adopted, with reasons: renaming CT20 "Registration Number Fake" — the name is the
Constitution's taxonomy (v8.0 FINAL, test-locked) and the "What it means" line is already
neutral; reserving "verified" for human-confirmed items — the Constitution states findings as
fact, and the split count now says which ones rest on OCR or a secondary source; a build that
fails when the advisory review retains a known artefact — the suites pin the artefacts at the
detector level, where they are removed, and the review is advisory.

### 12.14 The Public Protector submission run — a party's own submission is not the record; what the seal and its certificate can say (2026-10-02)

The founder sealed his own 20-page submission, "Response to Public Protector Referral &
Recommendations for Industry Reform" (Public Protector reference CMS-88490/2026, to the DMPR's Director-General and the NDPP; an
earlier draft of this section also gave CMS-88494/2026, which appears nowhere else in the
repository and is open with the founder), with the forensic report, the court-ready narrative and the
anchor certificate. It is advocacy about other sealed records, not an evidence bundle. The
sealed report carried three findings and all three were false; a three-lens review of the run
(engine, reports, certificate and honesty contracts) found the rest.
`tests/annexure-eb-regression.test.mjs` §18 pins each item with the submission's own text,
`tests/worker.test.mjs` the narrator gate and `tests/human-report.test.mjs` the pillar map.
On the fixed engine the submission yields no finding; were any detector to fire on it, the
finding would be a secondary-source lead (item 6).

1. **CT14 paired "non-compliant" with itself.** D09's `\bcompliant\b` matches at the hyphen of
   "non-compliant", so one passage on p.13 ("AllFuels' position: The operator is "errant" and
   non-compliant") was read as two status claims. A status word preceded by "non-"/"non " is the
   negation, and two status words at one place in the text are one claim; each passage is
   snapped to whole words. A company called compliant on one page and non-compliant on another
   still fires.
2. **CT37 read one renamed department as a lookalike.** "dmre.gov.za" and "dmpr.gov.za" are two
   genuine domains listed for one mailbox. Two domains that both sit under a listed restricted
   government suffix (the bare `.gov` and `.mil` top-level domains and 28 country suffixes such as
   gov.za, mil.za, gov.uk, gc.ca, govt.nz, gouv.fr, gob.mx and go.ke — `VO_GOV_SUFFIX` in D25; not
   any "gov.xx") are never a fraudster's lookalike, because registration
   there is restricted; a commercial lookalike, and a lookalike OF a government domain
   ("sars.gev.za"), still fire.
3. **CT23 fired on a category.** "a common scheme involving unsigned agreements" is the author's
   allegation about documents in general; the "unsigned agreement / MOU / lease / contract" cues now skip a category plural (a plural
   with a determiner or count before it, or a date, annexure or "signed on" after it, still
   counts; see the verification pass). The
   quote is snapped to whole words ("nd Smith" was printed for "Desmond Smith") and names the page
   it is quoted from when the location lists several. In the report, D32's two CT23 shapes are told
   apart (`isUnsignedStatement`): an unsigned agreement is a contract question (common law of
   contract only, no Cybercrimes Act, no forgery), filed under Selective Omissions, with "establish
   whether a signed original exists and, if so, obtain it" as its next step (worded so on
   2026-10-03; the record may hold none) and no claim of enforcement unless the record bills under
   it; the "/s/" shape keeps the forgery provisions and its own "what this establishes".
4. **The author's words were attributed to a company named on the page.** "It concerns Sanarth
   Fuels", the Statutory Anchoring party column and the counter-narrative fallback ("Sanarth Fuels
   — the record states:") all took a name the engine found on the page as the party a finding
   concerns. A finding now concerns a party only when the case details declare it
   (`declaredPartyFor`) and the finding's own words name it (`partyStronglyNamed`; see the
   verification pass); otherwise the names on its cited pages are stated descriptively ("Named on
   the cited page (descriptive, not an attribution)"); a counter-narrative quotes a party's own
   statement only when that party is declared and named in the quoted side. Two engine paths fed
   the name: `VO_PERSON_MARKER_RE` read prose prepositions as headers ("issued to Sanarth Fuels")
   — from/to/cc/bcc without a colon now bind only when an email header follows (an address,
   "Sent", "Subject": `VO_HEADER_COMPANY_RE`), and "per" only with its colon or after a
   valediction or firm word ("Yours faithfully … Per J Smith") — and the name roster.
5. **False parties.** A courtesy title before a full name is dropped ("Mr Jacob Mbele" is "Jacob
   Mbele"; "Mrs Smith" keeps it; "Justice", also a first name, is never stripped); an address
   opening "Corner …" is not a party; titles, a running page header ("Systemic Unfair Practices"),
   headings bound as names ("Trevenna Campus", "Personal Assistant", "Critical Point") and the
   product's own heading ("Forensic Platform") are stopped.
6. **A submission about other sealed records is secondary.** A first page titled as a party's
   submission ("Response to …", "Submission on …", "Representations …", "Heads of argument …") AND
   a body that cites another Verum seal ("Seal ID: VO-…", "sealed as VO-…", "Quote from Sealed
   Evidence") make the document secondary from its first page to its last
   (`voSubmissionSpan`): its author's characterisations go to the engine notes as leads, never
   to the findings (the §12.13 item 7 rule: a finding wholly on its pages, or with one half of a
   two-sided finding there, is a lead; a list finding with only some pages there is held at
   severity 2 and tagged). (The span ends before the first page that opens a new record; see the
   verification pass below.) Both cues are required; the document's own seal footer is stripped first and
   reads "Seal:", never "Seal ID:".
7. **Quotes, dates and provisions read the record as written.** The record's own quotation marks
   inside a quoted passage ('The operator is "errant" and non-compliant') closed the engine's quote
   at the inner mark, so every verbatim column printed "The operator is … and non-compliant";
   `voExtractQuotes` (engine) and `voQuoteSpans` (report) now read quotes nesting-aware, and the
   anchor quote lists each passage once. A quote that starts mid-word ("…ication. The
   contradiction…") was keyed in the previous sentence, which dated the finding by an attorneys'
   letter: `voSentenceAround` keys it on its own sentence. "Provision cited in the document" took
   every provision on the cited page (the Public Protector Notice's "paragraph 3.3" on an
   email-domain finding): provisions now come from the finding's own words or the quote's own
   sentence, the same discipline as WHEN.
8. **A document dated after its analysis.** The submission is dated 3 October and was sealed at
   22:11 on 2 October. `runForensicEngine(pdfBytes, pdfDoc, onProgress, opts)` takes
   `opts.referenceTime` from the seal page (the engine never reads the clock); a labelled
   "Date: …" later than that instant's Africa/Johannesburg day is an engine note, recorded and not
   scored (a letter dated for its delivery day is ordinary); the instant is returned as
   `referenceTime` and recorded in findings JSON v1.6.0 as `analysis_reference_utc`, so a re-run
   reproduces the note. The timeline's "no date
   inconsistencies were detected" no longer reads as an assurance.
9. **The reports.** A per-side length cap in `contradictionSides` (the whole-evidence cap cut the
   second side off); every display cap cuts at a word and closes a quote it cut (`capText`); no
   classification confidence band; no severity column for AI candidates and no empty "Highest
   severity" column; a narrator's `**markdown**` is not printed; the Nine-Brain blocks keep the §15.4 template's
   own headers ("TAMPER FOUND", "COMMUNICATION GAP FOUND"; PD19, no deviation — the "INTEGRITY
   SIGNAL FOUND" / "CONTACT CONFLICT FOUND" headers first written in this run were reverted on
   2026-10-03, §18j), but B2 takes only the file and page measurements (CT24–CT28, CT30, CT41,
   CT42) and every block entry carries a "Finding:" line stating what the record establishes
   (`establishesOf`), so "TAMPER FOUND" never asserts alteration the file structure does not
   prove (§2.3); a text cue (CT23), a legal-reference check (CT33), a procedure check (CT35) and a
   lookalike domain (CT37) have no block in the template and are listed by name under "Not
   rendered under a brain" (`VO_BRAIN_OF_CT` 'NONE'; CT39 joined them in the Greensky re-run,
   §12.15), and conflicting addresses or a party in two places (CT36, CT38) sit under B1, since
   §2.4's gap block is a message thread's; in the dishonesty matrix a contact conflict is a
   contradiction, not evasion, an unsigned-agreement statement is a Selective Omission, and the
   rows are ordered by their most serious finding; "Parties named on the pages carrying findings" and "Most serious
   findings" replace "Behavioural Scorecard" and "Top liabilities"; the methodology names the
   section actually printed, and the worker's template fallback is headed "ENGINE SUMMARY" and
   described as a fixed template; the platform role says the engine produces the findings; the
   cover banner is "CONFIDENTIAL" (no law-enforcement origin implied); "SHA-512 anchored",
   "permanent" and "fixes the moment it existed" are gone (OpenTimestamps fixes the latest time by
   which a file existed); "the documents cannot all be true at once" prints only when a finding has
   two sides; the provenance record counts drafts the server's gate discarded whole, and "no
   language-model verification" says what the advisory review is when it ran. The narrator's [F#]
   numbering is the court-ready narrative's (engine findings by severity), so F2 is one finding in
   every section; the worker template prints no severity number and names no section that does not
   exist.
10. **The narrator gate.** Four pillars: a sentence may cite under a pillar only a finding whose
    type evidences it — misrepresentation and loss take exactly the elements table's types
    (`OFFENCE_ELEMENTS`, pinned equal), knowledge and inducement or reliance take none — so "The
    record evidences inducement or reliance [F2]" for an unsigned-agreement finding is dropped and
    counted (`gate.pillar`). Court-recognition paraphrases are banned language ("court-accepted",
    "recognised by the … Court", "the Court has already recognised", "admissible" said of the
    seal, the platform, a report, the bundle or the sealed record, and "admissible … in court";
    statutory "admissible" and "court-appointed" stay); tightened, never loosened.
11. **The anchor certificate and verify.html.** The certificate said the fingerprint "is anchored
    to the Bitcoin blockchain … a public ledger that no one can edit or delete … not even Verum
    Omnis" under its own "PENDING CONFIRMATION" header, called the hash a signature that "cannot be
    forged", labelled the original upload's hash "DOCUMENT SHA-512" and said it was "computed from
    these exact bytes", and sent the reader to a trust-free check against the blockchain. It now
    labels each fingerprint by the bytes it belongs to (original upload; the sealed file as
    delivered, newly printed; the OTS digest as SHA-256 of the original SHA-512 hex text), says the
    Bitcoin block proves existence no later than its time and not the device clock, and says which
    file to upload for which check — the sealed PDF (the unprotected copy, opened with its password
    first, when a protected copy was sent) for the integrity check, the certificate itself for the
    anchor status of its digest (verify.html asks the OpenTimestamps calendars for the confirmed
    proof) — and to run an OpenTimestamps client (`ots verify`) against a Bitcoin node to check the
    block independently. verify.html recognises the
    certificate (`ANCHOR-CERT|`) and checks its digest instead of showing "No Seal Found"; it no
    longer says "court-ready and admissible", "OpenTimestamps verified" or "OTS-anchored" before
    Bitcoin confirms, and its VO-SEAL2 match says what the self-integrity check cannot show.

**The verification pass.** Five adversarial lenses (engine recall, report rendering, the
worker gate, verify page and certificate, honesty and completeness) re-ran the change set
against counterexamples; §18i pins each confirmed defect with the reviewer's reproduction.
Engine: a submission is secondary only up to the first page that opens a new record (an
annexure, an email header, a tax invoice, a fresh "Page 1 of"), so a cover submission no longer
demotes its annexures, and a pleading (a court caption, a "Reply") is never a submission; the
dated-after note reads only a document's first page and skips a qualified label
("Commencement Date", "Due Date", "Hearing Date"); a whole-word lowercase cue ("never
countersigned") is keyed as it stands, and an abbreviation ("Mr.", "no.") is not a sentence
end; a plural that names specific instruments ("the unsigned agreements dated …") still fires;
only two domains under listed restricted government suffixes are exempt, so "sars.go.za",
"sars.gov.io" or "nta.go.to" beside a real one still fires; the submission's headings are
stopped as phrases ("Maria Campos", "Texas Instruments", "Pan African Resources" survive);
"Director General" is a role and a cut window binds nothing; colon-free email headers and an
attorney's "Per J Smith" still bind; a Word-made "non‑compliant" is the negation; a quotation
the window cut open never swallows the engine's own words, and a parenthesised defined term
("the Lessor") stays inside its passage (engine and report share `voQuoteClose`). Report: a
counter-narrative quotes a party's words only when the party is the speaker (`speakerOf`), and
a declared party is the party a finding concerns only when the finding's own words name it,
never by a generic word such as "bank" (`partyStronglyNamed`); one numbering predicate
(`humanNumberable`, used by the seal page too) gives F# to engine findings with a page and P#
to the rest; every discarded draft is counted whatever the section's final reason; the CONTRACT
row describes an unsigned agreement as such; the unsigned shape is named "Unsigned Agreement
Stated"; every display cap uses `capText`, which closes only a mark the cut opened; a restated
figure counts as two statements; the AI annex uses the story's pass rule. Worker: in four
pillars, knowledge and inducement or reliance are never evidenced (only INSUFFICIENT is
written), misrepresentation and loss need a cited engine finding of a matching type (a page or
a quotation alone is not enough), a held finding evidences nothing, headings are recognised in
any dress, an inline label opens its pillar for its paragraph only, and outside four pillars a
sentence claiming a pillar is evidenced is held to the same types; the court-language ban
covers "the court noted / held / found / never questioned / is currently considering",
"admitted into evidence", "court-approved", "judicially recognised" and Word dashes, while
statutory "admissible" and "court-appointed" stay; the template quotes engine findings only,
prints no engine code and no candidate. Verify page and certificate: the certificate prints the
delivered file's real SHA-512 (as `sha512sum` computes it; the password-protected copy when one
was sent), never the VO-SEAL2 self-check value, says which file to upload for which check, and
keeps its Info dictionary readable; a certificate Subject never overrides a seal the raw scan
found; an OTS-format footer is "Seal Present", never verified, and its digest is resolved; the
password request is reachable from its button and says when the receipt was not submitted; the
share texts say "submitted", never "anchored" or "permanent".

**The last verification items (2026-10-03).** `tests/annexure-eb-regression.test.mjs` §18j pins
each. The Nine-Brain headers of item 9 went back to the template's own. A declared person is the
party a finding concerns only by the whole name or an initial and the surname ("L. Highcock");
another person who shares the surname ("Gary Highcock" for a declared "Liam Highcock") is not
(`partyStronglyNamed`). Header words (dear, to, from, date, regards, sincerely, cc, bcc,
subject, sent) are stop tokens, so on one-line page text (production text carries no line
breaks) a header value ends at the next header word. The extraction note says which cue made a
document secondary: a party's submission "cites other sealed records (its characterisations of
those records are not the records themselves)", never that it calls itself an extract. The
unsigned-agreement next step reads "Establish whether a signed original … exists and, if so,
obtain it", and its plain meaning is "the record states that an agreement it refers to is
unsigned". The Statutory Anchoring footnote says a declared party is listed where the finding's
own words name it, and otherwise the names on its pages are listed and marked "(named on the
cited pages)". The seal explainer says an altered word means "the file would no longer match
its seal hash"; to rule out a deliberate re-seal, it says to compare the delivered file's
SHA-512 with the one printed on the anchor certificate (open item (a)). When no AI-written
section passes the gates, the narrative's cover lines, Certification and provenance paragraph
say it is the deterministic record. The chronology's event text is cut with `capText`.
verify.html's confirmed badge reads "ANCHORED — Bitcoin attestation reported by the
OpenTimestamps calendar", because the page does not check the block itself.

**Open, with the founder (not fixed here):** (a) the VO-SEAL2 hash is self-referential — anyone
can alter a sealed copy and re-seal it with its own hash, keeping the seal ID and ORIG, and
verify.html shows a match; the fix is architectural (anchor the sealed-file hash too, or sign it)
and touches the verify contract, so verify.html and the report (its seal explainer until 5
October 2026, section 7 CERTIFICATION since, §12.16) now say what the check cannot show and tell the reader to compare the delivered file's SHA-512 with the one
the sender recorded (the reports add that it is printed on the anchor certificate) — a check
that is only as good as the sender's own record; (b) the reports
called engine findings "verified" when the single-model advisory review retained them — a
vocabulary decision for the founder, **resolved on 5 October 2026: the word is dropped (§12.16)**; (c) the repository
disagrees with itself on "in good faith and in the interest of justice" in H208/25: AGENTS.md says
it records the respondent's own affidavit, `constitution.json` and `llms.txt` say the Court found
the conduct good-faith — the founder holds the judgment; (d) D16 (font anomaly) measures
line-length variance and never fires on production blocks, which carry no line breaks — it must
not be revived by restoring newlines; (e) a single-token trading name ("AllFuels", "Bright Idea
Projects 66 (Pty) Ltd t/a AllFuels") can never be a party, and one person tied to two different
sites (Wayne Nel at Thongasi throughout, "Southbroom Service Station" in Recommendation 1) has no
detector; both are candidate rules, not shipped on one example.

### 12.15 The Greensky re-run — a commodity code is not a date; a commentator's label is not an admission; this platform's own seal is not tampering (2026-10-03)

The founder sealed the 451-page Greensky bundle again on the live site (report
VO-WEB-20261003-0222): 19 findings, of which at least 17 were wrong. Each item below is pinned
by `tests/greensky-regression.test.js` §9 (9.1–9.9) with the bundle's own text; the fix ships in
the same pull request as §12.14 (commits cd23c26 and 179e45c).

1. **Fourteen "Impossible date: 15.20.9094" findings** were commodity-code tokens on the
   transport invoice pages. D03 now reads a date-shaped token as a date only when its year field
   lies within 1200–2200; an impossible day or month with a plausible year (31/02/2021) still
   fires, and identical impossible tokens are one finding naming every page.
2. **An AI case summary bound into the bundle was sealed as the record's own admission**
   ("Forensic Finding:** This is an explicit admission of guilt…"). D01's admission branch skips
   the noun cue "admission of guilt" when the words just before it call something an admission
   (an equative verb reaching the cue: "is an explicit…", "constitutes a clear…", "treated as
   an…"; `VO_ADM_CHARACTERISATION_RE`); a first-person "I admit…" is never skipped. Pages carrying
   chat-style markdown read as a rendered AI or chat analysis and are secondary wherever they sit
   (`voMarkdownAnalysisPages`: two or more signals among bold runs that wrap words, `**…**`, and
   `##` headings, or a `Label:**` followed by text), so findings resting only on them become
   leads; the extraction notes name the pages.
3. **The bundle's own Verum seal read as tampering.** A file wearing this platform's seal
   footers has been through this sealer even when the producer is pdf-lib's default. When the
   branded footer (`VERUM OMNIS SEALED ORIGINAL` / `DOCUMENT` or a `VO-…` seal id) is on more
   than half the pages, judged before the furniture is stripped, `voDigitalForensicsScan` is told
   so (`sealedByThisPlatform`) and suppresses the XMP-against-Info comparisons, and the
   suppression is disclosed. One embedded sealed exhibit, or brand-free furniture such as a bare
   timestamp, does not set it.
4. **Parties.** "Forensic Finding" (the stop tokens finding, findings, forensic) and role
   phrases such as "General Manager", "Managing Director" and "Chief Executive" are never
   parties. A name the roster finds only on secondary pages (like one found only on OCR pages)
   does not clear the recurrence bar by itself (`voBuildNameRoster`).
5. **The report.** An impossible date has its own "what this establishes" line; CT39, CT29 and
   CT24 no longer fall through to "The record states both positions", and CT39 is listed under
   "Not rendered under a brain", never as a B1 contradiction. SEALED FINDINGS (technical report
   and court-ready narrative) states the engine findings that are not in its page-anchored list
   — those with no page to cite (file level: PDF metadata or structure) and those with no
   renderable passage — so its count agrees with the cover, and a record whose only findings are
   file-level no longer prints "none triggered". The one-page summary and THE SHORT VERSION
   collapse identical plain-words lines into one bullet naming every page, with the count.
6. **The second round (179e45c, §9.8a).** An adversarial review of the first fix set confirmed
   fourteen defects, each fixed and pinned: among them, a grouped location's "and 2 more" was
   read as page 2 (`pageAnchor` now strips the count), and OCR provenance is judged on a
   finding's full `pages` list, not its truncated location string (`ocrTouched`). Items 2–5
   above describe the state after this round.

### 12.16 The evidence-bundle-7-docs run — the AI review never removes a finding; the template leads; no "verified" (2026-10-05)

The founder sealed a 65-page bundle with the forensic report and the court-ready narrative: his
email to the Public Protector, the Protector's referral letters, a 49-page sealed exhibit of his
own Verum Omnis analysis (VO-553451FF1282, pp. 9–57: a "Verum Omnis Forensic Narrative", a
30-page report and a Google Drive index), printed emails and a sealed timeline. He had DeepSeek
review the three PDFs against Constitution v8.0 ("Constitutional Compliance Review — Verum Omnis
Forensic Engine v5.3.5-web"). Pinned by `tests/evidence-bundle-7-regression.test.mjs` (31
assertions: the real engine on a synthetic bundle of the same shape built from the bundle's own
strings, and the technical report rendered and read back; no real matter document is committed)
and by updated assertions in the existing suites.

**What was sealed.** Four engine findings, one of them real: the lookalike domain (CT37) —
the founder's email went to `protect.org` (p. 1) while the Protector's investigator writes from
`pprotect.org` (pp. 5, 7), one character apart. The other three rested on the founder's own
analysis pages: a CIPC enterprise number in the portal's own form (K2016392549) sealed as "not a
valid SA registration format" (CT20); a reference to his affidavit "recording … the chain of
custody (VO-0D93BB2C1B46)" sealed as a custody gap (CT39); and his sentence "The MOU was never
countersigned" sealed as a signature finding (CT23). The advisory AI review had removed two more
engine findings from the report, and the report's wording still called findings "verified" and
described their order in severity words.

**The founder's rulings (5 October 2026), binding:**
1. The AI review never deletes or changes an engine finding. In his words: "The ai cannot delete
   findings from the engine it can read the json the sealed evidence and the sealed forensic
   report it cannot alter this. The ai must do a forensic report based on the findings of the
   engine and it must report missed contradictions and improve the engine".
2. The word "verified" is dropped from the reports (PD13's three independent verifiers do not
   exist on this platform).
3. Template first: the §15.4 sections 1–7 lead; the plain-language pages become annexes; the
   "How any change is detected" page goes.

**What changed.**
1. **The AI review notes, it never removes (§4.10).** `aiAssessFindings` returns copies of the
   original findings, never the model's 300-character excerpt (the excerpt had truncated an
   evidence string to "verify execution agai"); an UNSUPPORTED verdict becomes `aiReviewNote`;
   a batch the Worker did not review (`reviewed: false`) adds nothing; a candidate that quotes an
   engine finding on the same page is a counted duplicate. UNSUPPORTED notes go to the feedback
   loop as `AI_REVIEW_UNSUPPORTED`. The Worker's `ASSESS_SYSTEM` asks for SUPPORTED or UNSUPPORTED
   and says the reviewer cannot remove, change or overrule a finding; legacy keep/drop verdicts are
   mapped onto it. The report prints the notes in the matrix ("AI Review Notes on Engine Findings"),
   section 7 says the review removed and changed nothing, and the AI section's trailer counts what
   it did ("AI review read N engine findings; it removed and changed none …"); the narrate template no
   longer prints a pruned count.
2. **No "verified".** `voCountPhrase` says "N findings" (§6); the Triple Verification Summary is
   a Thesis / Antithesis / Synthesis / Status table that states PD13 is not met (§7). The findings
   JSON keeps `verification_status: "ENGINE-VERIFIED"` because the shared 1verum schema's enum
   requires it (open, cross-repository, below).
3. **Template first (§7).** Cover, contents, sections 1–7, the annex divider, then the
   plain-language pages as numbered annexes. `secSealExplainer` is deleted (from `build`,
   `buildNarrative` and `buildHumanReport`); what the seal shows and cannot show is in section 7
   and in the closing sentence of SEALED FINDINGS. The cover carries the template's header fields
   (Timestamp ISO, Jurisdiction(s), Case Reference, Report Type) and no "AI REVIEW NOT RUN" banner.
4. **No severity, score or band words in print (PD1).** Gone: "most serious first", "by
   severity", "serious"/"minor", "scoring weight", "N / 46", "ordinal confidence", the severity
   column of the serial table, and the engine's score-dependent summary sentence: it had printed
   "4 minor contradictions established. The document is largely consistent" on this bundle, could
   print "The documents evidence systematic fraud" above a score of 80, and printed "No
   contradictions were detected" over more than three low-ranked findings (`generateSummary` now
   states the count and says to read each finding against the page). The
   order note (`VO_ORDER_NOTE`) says only that findings are in the engine's fixed order.
5. **Every finding under one brain.** `VO_BRAIN_OF_CT` places CT23 and CT39 in B2, CT37 in B3,
   CT33 and CT35 in B7; kinds no template header describes print as FINDING RECORDED. CT39's
   candidate law excludes perjury and obstruction (a missing custody step is not false
   testimony), its dishonesty category is OMISSIONS, and the offence matrix lists the union of
   each finding's own provisions. Two display names are measured (`VO_DISPLAY_NAME`, §7).
6. **The overclaim gate (§6).** The narrative had sealed "The core pattern the record
   establishes is …" over the author's own email, "… constitute coercion" and "… contradicting the
   company's own documents" without an [F#]. `voSentenceOverclaims` (render time) and
   `humanOverclaim` (Worker) now drop them; `HUMAN_SYSTEM` states the rule.
7. **Engine precision.** D11: the CIPC K-form (`K2016392549`, `K2016/392549/07`) is valid; a bare
   "CIPC" cue checks only a number that follows within 12 characters; tokens inside a VO seal id
   and YYYYMMDD dates are skipped. D27: a mention of another document that records or sets out the
   custody (an affidavit, certificate, annexure … before it; a seal id, annexure or exhibit
   reference after it) is not a custody gap. D17: pages the engine set aside (prior report,
   template) are neither near-empty nor in the average (the run would have sealed "35 near-empty
   pages" over the report pages it excluded). `voDetectDocuments`: an unmarked page inherits a
   document only while that document has not reached its stated last page (three emails after
   "49/49" were counted into the exhibit); a set-aside first page is titled "Verum Omnis analysis
   (set aside from scanning)", never by its placeholder. `voSecondarySegments`: (a) the pages of
   a stated document whose first page was set aside as a Verum Omnis report are secondary up to
   the first page that opens a new record; (b) a page whose running title names a Verum Omnis
   analysis document ("Verum Omnis — … Index • Page N of M", `voIsVerumAnalysisPage`) is
   secondary wherever it sits; the extraction note names the kind. Names: header labels, defined
   terms and headings ("E-mail", "MOU", "National", "Part") no longer join a name, and a possessive
   is stripped. On the real bundle the engine now seals one finding, the CT37 lookalike, and
   records CT23 as a secondary-source lead.
8. **The prompts say tamper-evident (§6).** `NARRATE_SYSTEM`, `ASSESS_SYSTEM` and `SWEEP_SYSTEM`
   no longer call the record unalterable or anchored to Bitcoin.
9. **Findings JSON 1.7.0 (additive).** `display_name`, `brain`, `triple_verification` and
   `ai_review_note` per finding; an AI candidate's severity and confidence are the schema's
   `INSUFFICIENT`, never a band word.

**The DeepSeek review, point by point** (for the record; the founder's rulings decide where it
asked for a choice). Confirmed and fixed: band, score and severity language (2.1), the AI
review's removals (2.2), "verified" without three verifiers (2.3), findings outside the brains
(2.4), the narrative's overreach (2.7), and the template order and explainer page (2.10).
Partly adopted: measured display names, with the taxonomy names kept in the JSON (2.6); candidate
band words removed, while candidates stay in the JSON's `contradictions` array because the shared
schema puts them there (2.8). Not adopted: that single-source signals are not contradictions (2.5
— v8.0 §0 defines a contradiction to include integrity and custody signals; the false CT20, CT39
and CT23 findings it cites were fixed in the engine instead, item 7), and the OpenTimestamps
wording (2.9 — the reports already say "submitted for anchoring" while the proof is pending and
"anchored" only once it is confirmed, `anchorPhrase`). On 2.11 (several reports that disagree):
the "Verum Omnis Forensic Report — CCT 19/20 Rescission Application (Ninth Edition)" with
findings F1–F11 is an analysis bound into the bundle as part of the founder's exhibit, not engine
output; advice recorded for the founder: an analysis written by a person or an
AI about a sealed record should not be titled "Verum Omnis Forensic Report", which names the
engine's sealed output. The review missed that the one real finding, the lookalike domain, is
actionable: the email may not have reached the Protector's investigator.

**Open, cross-repository (founder):** the shared findings-JSON schema (1verum
`FINDINGS_JSON_SCHEMA` v1.0.0) requires `verification_status: "ENGINE-VERIFIED"`, band-word
severity and confidence enums, and AI candidates inside `contradictions`. A schema v2 (a
neutral status such as `ENGINE-FINDING`, a separate `ai_candidates` array) must change in this
repository, `Liamhigh/1verum` and `Liamhigh/firebase` together; this repository does not change
the contract alone.

## 13. The court-ready narrative (the "human report")

**What it is.** A sealed companion PDF written by an AI narrator *from* the sealed technical
report and its findings JSON — the Statement-of-Case-class covering document that AGENTS.md
founder ruling 9 sanctions (the "Founder rulings" list; recorded in #164). It adds no findings, it is advisory, it is never titled "Forensic Report",
and the sealed technical report remains the evidentiary record.

**One contract, three copies.** Fifteen sections in a fixed order — `HUMAN_SECTIONS` in
`worker/verum-rules.js` = `HUMAN_REPORT_SECTIONS` in `forensic-report.js` = `VO_HUMAN_SECTIONS`
in `seal-document.html`; `tests/human-report.test.mjs` pins all three: Executive Summary ·
Evidence Index · Chronology & Pattern of Conduct · Four Pillars of Fraud · Contradictions
Matrix · Critical Evidence Analysis · Counter-Narratives & Rebuttals · Sworn Statements &
Candidate Law · Coercive Conduct · Legal Framework · Offence Matrix · Recommendations ·
Court-Ready Declaration · Authentication & Provenance · Annexures. The list reconciles the
founder's Greensky reference and the platform's 19-section GHRP specification
(`REPORT_FORMAT_SPECIFICATION.md` in the separate `Liamhigh/firebase` repository — not in this
one) against Constitution v8: "How to Use This Report"
is prohibited by §15.2 and absent; "Perjury Analysis" became *Sworn Statements & Candidate Law*
(the word "perjury" only inside candidate-law lines, AGENTS.md); Counter-Narratives & Rebuttals (GHRP section 10) was kept
for fairness; an empty section states its emptiness ("No account on record", "None
identified") instead of disappearing (PD6).

**Division of labour (the GHRP rule: the writer originates nothing).** The engine renders
every table, page, quotation and number — Evidence Index, Contradictions Matrix, Offence
Matrix, Statutory Anchoring, Recommended Actions, the Sealed Findings list, Annexures. The
model writes prose only, for the nine writer sections, **one section per call** to
`POST /api/v1/ai/human-report` (Critical Evidence in batches of eight findings):
`{section, documentName, pageCount, findings[F#], candidates[C#], caseContext, excerpt,
timeline, unreadPages, priorSummary}` → `{ok, contract:'human-v1', section, generated,
machineGenerated, model, temperature, text, plainTerms, gate, disclaimer}` (or
`generated:false` with a `reason`). F# goes to the findings `humanNumberable` admits — an engine
finding with a quotable passage and a page, most serious first, the predicate Findings in Detail
uses; page-less engine findings are P# in the technical report and are not sent; AI candidates
are C#. Each finding carries an explicit `page`/`pages`, its evidence text (up to 800
characters), its quoted passage (up to 400) and the engine's own plain-terms sentence; GPS, device and sealer identity are not fields, so they
cannot reach the model.

**The gate is the guarantee; the prompt is a request.** Server side (`humanGate`): every
sentence must **carry** an anchor — a `[F#]`/`(F#)`/"finding F#" id in the inputs, a page in
the inputs (`p. 7`, `pp. 2-5` with the range expanded, `page 7`, `pg 7`, `p7`; a page spelled
in words is refused; no page beyond `pageCount`), or a quotation of twelve characters or more
(`"…"`, `“…”`, `‘…’`, `'…'`) found in the inputs word for word (compared after `humanNorm`:
case, quote style and punctuation folded) — and a sentence with none is dropped
(PD2 — "if a sentence cannot cite anchors, it cannot exist"). The only anchor-free lines are
the sanctioned ones: the four exact answers the section rules dictate ("None identified.",
"No account on record.", …), the verdict reservation, and a stated gap (`INSUFFICIENT`).
§15.2 language is dropped (hedges including could/would/appears that/indicates/consistent
with, indicator/red flag/anomaly, credibility/guilt/defrauded/dishonest, scores and
percentages in any dress, severity labels, "how to read this report", person-level offence
findings, overstated court history — any court adopted, endorsed, validated, accepted,
recognised, found, held, ruled or determined; any mention of a "High Court"; and, since
2026-10-02, the paraphrases ("court-accepted", "court-approved", "judicially recognised",
"admitted into evidence", "recognised by the … Court", "the Court has already recognised /
noted / never questioned / is currently considering", "admissible" said of the seal, platform,
report or record; Word dashes read as hyphens), while statutory "admissible" and
"court-appointed" stay — and "perjury" outside candidate law; "3 May 2026" is a date, not a
hedge). The four-pillars rule is part of the gate (§12.14 item 10 and the verification pass):
knowledge and inducement or reliance are only ever written as INSUFFICIENT; a sentence under a
misrepresentation or loss pillar (a heading in any dress, or an inline label for its paragraph)
must cite an engine finding [F#] of a type in `HUMAN_PILLAR_TYPES` — the misrepresentation and
prejudice rows of the report's `OFFENCE_ELEMENTS`, pinned equal by
`tests/human-report.test.mjs` — a page or a quotation alone is not enough, and a finding held at
reduced weight (OCR-only or secondary source) evidences nothing; outside four pillars a sentence
that claims a pillar is evidenced is held to the same types. Dropped pillar sentences are counted
in `gate.pillar`. The overclaim rule is part of the gate too (since 5 October 2026, §6 and §12.16
item 6; `humanOverclaim`, counted in `gate.overclaim`): a sentence that does not cite an [F#] may
not say the record establishes, proves, reveals, shows or confirms anything, may not call two
things contradictory (a rebuttal frame excepted), and no sentence may say conduct constitutes
fraud, coercion or an offence outside "may constitute" candidate law. Headings are gated too:
"GUILTY OF FRAUD" in capitals is a verdict, not a section name. A section keeps at least two sentences
and at least as many as it lost — or is exactly one sanctioned answer — or it answers
`generated:false, reason:'gate_failed'` with **no text** — never a template dressed as AI.
Client side, `buildHumanReport` re-runs the render-time §15.2 language gate (`scrubNarrative`,
or `scrubRebuttals` for Counter-Narratives, which also drops a rebuttal orphaned by a removed
claim; then `voGatePasses`) on every AI section, headings included — hedges, characterisation
nouns, scores and bands, person-level judgment, and the overclaim rule; the anchor, quotation,
pillar and court-language checks run on the server only — prints the removed-sentence count under it, prints no AI section
at all when fewer than half of two or more drafted sections pass, and renders the deterministic
twin — labelled "nothing here is machine-written" — for any section that did
not survive. Never loosen either gate.

**Shape (2026-09-07).** The narrative opens with a contents page drawn last with real page
numbers, like the forensic report; a section the narrator could not write names the reason in
plain words (the address had no API, the service could not be reached, it timed out, the server
gate discarded the draft, the five-minute budget passed) — never a bare code. Section budgets
follow the reference document's depth: the executive summary (350–650 words) opens with the
core pattern, then KEY FINDINGS one paragraph per finding, then WHAT THE RECORD ESTABLISHES;
Critical Evidence gives each finding a heading line and three to six anchored sentences.

**Model.** Keyless Workers AI: `HUMAN_REPORT_MODEL` (default
`@cf/meta/llama-4-scout-17b-16e-instruct`, 131k-token context) with the fast 8B model as
fallback; temperature 0 (PD4); 30 s per section on the primary and 15 s on the fallback,
which also gets a shorter excerpt for its smaller window (the client waits 52 s per call and
stops asking after five minutes in total, marking the rest `time_budget`); Constitution v6.1
prepended server-side to every call. Sections nothing in the record engages (no sworn
finding, no coercive statement) are not requested at all (`not_applicable`). An operator may instead point the narrator at any
OpenAI-compatible chat-completions provider with three secrets — `LLM_API_BASE`,
`LLM_API_KEY`, `LLM_MODEL` (`wrangler secret put`, never in the repo); the reply then names the
model as `external:<model>`; that provider gets the whole 45 s (`HUMAN_EXTERNAL_TIMEOUT_MS`) and
no fallback. The seal page's mode card and disclosure box name only Cloudflare Workers AI as the
destination (the "or the AI provider configured for this site" clause left with the tick boxes
in #200), so setting the `LLM_*` secrets without changing that copy would make the disclosure
untrue. Nothing is stored server-side.

**Consent (2026-09-07, two modes).** There is no separate switch: the narrative is part of
"Seal document with forensic report" and is produced with the technical report whenever that
mode is chosen (founder direction item 12, reversing the earlier default-OFF opt-in). The mode
card and the disclosure box name what leaves the device — findings, the page excerpts the
sections cite, never GPS, device or sealer identity — and point privileged matters to "Seal
document", where nothing leaves the device. Reports still say the prose is machine-written
and advisory.

**Provenance and seal.** Cover title COURT-READY NARRATIVE REPORT, every body page headed
"Verum Omnis Court-Ready Narrative" (`makeCtx` takes a `headerTitle`; the forensic report
keeps its default), exactly the fifteen numbered contract sections (engine sub-sections such
as Recommended Actions render under their contract heading through `engineUnder`), with
inverted provenance lines (this document *is* machine-written; the findings it narrates are
not) whenever at least one AI-written section prints — otherwise the cover, the Certification
box and the provenance paragraph say it is the deterministic record and that nothing in it is
machine-written prose (2026-10-03); Authentication & Provenance prints the narrative reference,
the source document's SHA-512, the technical report's seal id and SHA-512, the findings JSON
version and SHA-512, the narrator model (or why none printed), contract and temperature 0,
sections written by the narrator and printed out of all, sentences removed by the server gate
and by the render-time gate, drafts the server's gate discarded whole and rebuttal sentences
dropped with a removed claim (each when non-zero), the engine version, the rule-package and
Brain 9 lines and how to verify, then "No language-model verification of the findings is
claimed" — followed, when the advisory AI review ran, by "beyond the advisory AI review recorded
in the technical report, which retains or drops engine findings and adds no facts"
(`aiReviewQualifier`). Sealed through `VerumReport.seal`
with `tag: 'NARRATIVE REPORT'` in the footer and the VO-SEAL2 subject; offered only behind
`VoSealGuard.isSealed`; added to the share bundle (the share sheet's files, or `<name>-verum-omnis-bundle.zip` when the
bundle is saved) and offered as its own download, as `<name>-court-ready-narrative-sealed.pdf`.
