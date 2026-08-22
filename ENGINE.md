# The Verum Omnis Forensic Engine — Definitive Reference

> **This repository's engine is the reference implementation.** Where any other surface
> (Android `1verum`/`cursorfu`, the Fraud Firewall `firebase`) disagrees with it, **this
> engine is correct** and the other surface is the one to fix. Every hard lesson from real
> evidence bundles is encoded here and locked by tests.

**Engine:** `forensic-engine-page.js` — `VO_ENGINE_VERSION = '5.3.5-web'`
**Report:** `forensic-report.js`
**Host page:** `seal-document.html` (both scripts inlined — see [Inlining](#inlining))
**Governing law:** Constitution v6.1 (engine operating instrument, seal `VO-9E51D3F507E6`);
Constitution v8.0 (governance charter, seal `VO-9A4F3C5E825C`)

---

## 0. If you read nothing else

1. **Do not "simplify" a guard.** Most odd-looking conditions in this engine exist because a
   real bundle produced a false finding. §4 lists every one, with the case that caused it.
   Removing one re-introduces a false statement of fact under seal.
2. **Precision beats recall here.** A missed contradiction is a gap; a false contradiction is
   a lie in a court document. The hybrid LLM layer on the apps handles recall.
3. **Every finding must be anchored** to quoted text and a page. Unanchorable content findings
   are dropped, not demoted (`voEnforceAnchorRule`).
4. **No scores, no bands, no hedging** in anything a reader sees (Prime Directive 16, §6).
5. **`node tests/run-all.js` must be green before every push.** 27 suites, 1374 assertions;
   many exist solely to stop the regressions in §4.
6. **The report leads with the human story, not the table of contents** (§7). That order is a
   founder ruling, not a layout preference.
7. **No regex lookbehind in new code** (§4.16). Safari < 16.4 throws at parse time and the
   whole scan dies silently.

---

## 1. Pipeline

```
PDF bytes
  ├─ voParsePages()            text per page (pdf.js), OCR rescue for image-only pages
  ├─ voCropHidesContent()      CropBox smaller than MediaBox = hidden content
  ├─ voDigitalForensicsScan()  raw PDF structure: revisions, saves after signing, embedded files
  ├─ voExcludeTemplatePages()  boilerplate pages repeated across a bundle are not evidence
  ├─ voDetectDocuments()       recovers document boundaries in a consolidated bundle (§8)
  ├─ DETECTORS D01–D40         each returns findings[] (§3)
  ├─ detectSerialPatterns()    multi-stage pattern matches across findings
  ├─ voBackfillPageAnchors()   binds every finding to its page
  ├─ voEnforceAnchorRule()     drops content findings that cannot be anchored (§5)
  ├─ voAnchorEnrich()          WHO / WHERE / WHAT / WHEN per finding
  ├─ voDetectSwornPages()      oath language per page; findings on those pages get swornContext (§4.18)
  └─ generateSummary()         fact-stated summary sentence (no bands)
        ↓
   findings JSON  →  forensic-report.js build()  →  sealed PDF (seal())
```

`runForensicEngine(bytes, pdfDoc, onProgress)` is the single entry point. It is **pure and
deterministic**: no `Date.now()`, no `Math.random()`, no network, no hidden state. Same input →
same findings, on any device, forever. This is Prime Directive 4 and it is what makes a sealed
report reproducible years later.

**This has been validated in the field, not just in tests.** The same three-document bundle was
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
| **IDENTITY** | CT09 Identity Contradiction · CT10 Role Contradiction · CT11 Authority Contradiction · CT12 · CT13 · CT14 Entity Status Contradiction · CT46 Role / Capacity Contradiction |
| **FINANCIAL** | CT15 Amount Discrepancy · CT16 Currency Mismatch · CT17 · CT18 Bank Detail Mismatch · CT19 VAT Number Invalid · CT20 Registration Number Fake · CT21 · CT22 Financial Calculation Error |
| **INTEGRITY** | CT23 Signature Mismatch · CT24 Metadata Contradiction · CT25 Font Inconsistency · CT26 Format Anomaly · CT27 Layout Manipulation · CT28 Image Integrity Failure · CT29 Timestamp Manipulation · CT30 Version Control Anomaly |
| **CROSS_REF** | CT31 Cross-Reference Failure · CT32 Source Attribution Failure · CT33 Legal Reference Invalid · CT34 Precedent Violation · CT35 Procedure Breach |
| **CONTACT** | CT36 Address Contradiction · CT37 Contact Detail Mismatch · CT38 Jurisdictional Impossibility |
| **EVIDENCE** | CT39 Chain of Custody Break · CT40 Witness Statement Conflict · CT41 Evidence Tampering Indicator |
| **DIGITAL** | CT42 Digital Footprint Mismatch · CT43 Document Internal Conflict |
| **FRANCHISE_LEASE** | CT44 Conditional Clause Misinvoked (Lessee/Owner Trap) · CT45 Asset Value Recognised Then Denied (Goodwill) |

**Codes are permanent.** `tests/constitution-lock.test.mjs` pins load-bearing codes by name.
An external contradiction database once numbered its own CT23 as something else; two meanings
for one code in a court-facing document is a credibility attack, so renumbering fails the build.

---

## 3. Detector inventory (D01–D40)

Each detector is a pure function `(textBlocks, …) → findings[]`.

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
| D16 `DETECT_FONT_ANOMALY` | CT25 | Font inconsistency within a page |
| D17 `DETECT_FORMAT_ANOMALY` | CT26 | Near-empty pages among full ones |
| D18 `DETECT_PAGE_MANIPULATION` | CT27 | Layout / page-number manipulation |
| D19 `DETECT_EVIDENCE_TAMPERING` | CT41 | Explicit tampering indicators in text |
| D20 `DETECT_DIGITAL_FOOTPRINT_MISMATCH` | CT42 | Digital traces inconsistent with claimed origin |
| D21 `DETECT_MISSING_APPENDIX` | CT31 | A referenced annexure that is not in the document |
| D22 `DETECT_INVALID_LEGAL_REF` | CT33 | A cited section that does not exist |
| D23 `DETECT_PROCEDURE_BREACH` | CT35 | Stated procedure not followed |
| D24 `DETECT_ADDRESS_CONFLICT` | CT36 | Conflicting addresses |
| D25 `DETECT_CONTACT_MISMATCH` | CT37 | Contact details inconsistent with one entity |
| D26 `DETECT_JURISDICTIONAL_ISSUE` | CT38 | Jurisdictional impossibility (**contextOnly**, unscored — see §4.6) |
| D27 `DETECT_CUSTODY_GAP` | CT39 | Chain-of-custody break |
| D28 `DETECT_WITNESS_CONFLICT` | CT40 | Witness statements in conflict |
| D29 `DETECT_SCOPE_CREEP` | CT07 | Scope expanded beyond the original references |
| D30 `DETECT_TERM_DEFINITION_CONFLICT` | CT08 | A defined term given two **materially different** definitions |
| D31 `DETECT_CAUSAL_IMPOSSIBILITY` | CT05 | Received-before-sent style impossibility **inside one sentence** |
| D32 `DETECT_SIGNATURE_ANOMALY` | CT23 | Non-standard or irregular signature method |
| D33 `DETECT_IMAGE_MANIPULATION` | CT28 | Image integrity failure |
| D34 `DETECT_CURRENCY_FRAUD` | CT16 | Currency mismatch |
| D35 `DETECT_VERSION_ANOMALY` | CT30 | Version-control anomaly |
| D36 `DETECT_SOURCE_FAILURE` | CT32 | Source attribution failure |
| D37 `DETECT_INTERNAL_CONFLICT_CATCHALL` | CT43 + CT24/29/30/41/42 | Clause-numbering discontinuity (a heading numbered N whose first sub-clause is numbered N+1..N+3 — template-surgery fingerprint, §4.17); breadth note; runs last |
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
Four separate false CRITICALs came from this detector:
- `"utilities is to be registered"` (a lease clause) paired with an unrelated case-law mention of liquidation;
- `"registered recorded delivery letters"` (a notices clause);
- `"shall be dissolved by special resolution"` (a dissolution **provision**, not a status);
- `"if the Franchisee is finally liquidated **or** placed under judicial management"` (an insolvency **trigger clause** — evidence-bundle-7 p.72, rated CRITICAL).

**Guard:** a status word counts only when used **about an entity**; delivery-method uses,
provision phrasing (`shall/may/must be …`, `in the event of …`, `upon dissolution`),
conditionals (`if/should/unless/until … is liquidated`) and **or-joined menus of insolvency
events** are all excluded. An asserted status (`was finally liquidated by order of the High
Court`) still fires, quoting both passages with pages.
**Tests:** `detector-recall.test.mjs` CT14 block (6 cases).

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
Compiled bundles repeat page numbers and cross-references. Such findings are tagged
`[bundle context: …]`, grouped at the end of each table, and the plain-language lead states
they are **not, by themselves, signs of tampering**.

### 4.9 `voDateSortKey` — clause numbers are not dates
`clause 1.1.10` was being read as a date ("On 1.1.10 …"). **Guard:** dotted dates require a
4-digit year, plus day ≤ 31 / month ≤ 12 bounds.

### 4.10 AI candidates are never "verified findings"
An AI-raised item is **candidate tier**. It is excluded from the verified count, the fact box,
the severity table and the plain-language lead, and disclosed on its own advisory line.
Mixing the two inflates the count and misdescribes the record.

### 4.11 D01 / conduct admission — a cause is not an admission
An "admission of conduct" detector that fired on causal wording alone flagged ordinary contract
boilerplate. **Guard:** all four conditions must hold in the same passage — a causal marker
(`VO_CAUSE_RE`: because / since / as a result / due to / owing to / given that / seeing that),
a proceed verb (`VO_PROCEED_RE`: proceeded / went ahead / carried on / continued / concluded /
completed / finalised / executed, **within 80 characters** of deal / transaction / sale /
shipment / order / export / contract / agreement / payment / transfer), a first-person subject
(`VO_SELF_RE`: i / we / me / my / our / us), and **not** boilerplate (`VO_BOILER_RE`: shall /
hereby / whereas / herein / the parties agree). The quote starts at the causal marker when the
cut is more than 30 characters in.
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
**Guard:** `VO_BANNED_SENTENCE_RE` drops any sentence containing hedging, "red flag" /
"indicator" / "anomaly", or credibility / guilt / innocence / lied / liar wording. It **drops**
— rewriting a hedge into an assertion would put words in the narrator's mouth that the evidence
may not carry. `voGatePasses` then requires `kept >= 2 && kept >= dropped`; if the narrative
cannot clear that bar the deterministic narrative is used instead. On the real Greensky
narrative, 4 of 5 sentences were dropped and the gate correctly rejected it.
**Tests:** `legal-analysis.test.js`.

### 4.14 `splitSentences` — a period is not always a full stop
The old naive splitter cut `"Mr. Nortje may have signed it."` into a dangling `"Mr."`, and
turned `R3 800 000.00` into `R3 800 000. 00`. **Guard:** non-terminal periods are masked with
a `VO_DOT` sentinel (U+0001) before splitting and restored after — decimals, and the abbreviations in
`VO_ABBREV_RE` (mr, mrs, dr, prof, inc, ltd, pty, no, vs, etc, p, pp, para, s, ss, cl, art,
sec, fig, ch, ex). It deliberately errs toward **under**-splitting: a run-on sentence is
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
(Three pre-existing lookbehinds survive at `forensic-engine-page.js:3011`, `:3086` and
`forensic-report.js:2491` for name/money detection. They are a known, separate debt — do not
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

### 4.18 Oath context — measured, never inferred, and "perjury" never in engine output
A contradiction anchored inside an affidavit is a materially different fact from one in
correspondence. `voDetectSwornPages` tags pages carrying oath language: **strong** execution
formulae (commissioner of oaths, make(s) oath and say, sworn (to) before me, duly sworn,
solemnly declare/affirm, depose(s) and say) tag on their own; **weak** markers (affidavit,
deponent, under oath) require two distinct hits, so an index line ("Supplementary Affidavit,
9pp") or a page merely referring to an affidavit is never tagged. Unmarked body pages of a long
affidavit are not tagged — under-tagging is a gap, mis-tagging is a false statement of fact.
Findings on tagged pages get `swornContext = true`; the report renders one factual line ("oath
language appears on the cited page(s)… reserved to the court") plus a candidate-law bullet.
**The word "perjury" appears nowhere in engine output**, and in the report source only inside
candidate-law lines — both locked by tests. **Tests:** `allfuels-regression.test.js`.

---

## 5. The anchor rule

`voEnforceAnchorRule(findings)` implements Prime Directive 2: *if a sentence cannot cite
anchors, it cannot exist.* Content findings without a resolvable page anchor are **dropped**,
not demoted, and disclosed in the report as *"observations recorded here as unanchored
observations, NOT as findings (no anchor, no sentence)"*. Structural signals (page-count,
document-level integrity) are exempt because their anchor is the document itself.

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
- Opening: `The sealed record of "<doc>" (N pages) contains N verified findings. The following are established.`
- Closing: `These findings are sealed under SHA-512 and anchored to the Bitcoin blockchain: they cannot be changed, altered, or deleted. The verdict on any named person is for the court.`
- Clean result: `No contradictions were detected. Every detector ran; none triggered.`
- Every finding anchored to quoted text and a page.

### The AI layer obeys the same rule — because the evidence is sealed

The Cloudflare Worker's AI endpoints (`/api/v1/ai/narrate`, `/assess`) are given the reason,
not just the rule, because a model that understands *why* complies far more reliably:

> Every finding you receive was produced by a deterministic engine from a document sealed under
> SHA-512 and anchored to the Bitcoin blockchain. It is quoted evidence bound to a page in a
> record that cannot be altered. It is therefore not a suspicion to be hedged — it is a
> measurement to be reported.

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
findings. Do not blur the two words — the distinction is what keeps the verified count honest.

**Two deliberate exceptions, both mandated by the Constitution:**
1. **Per-finding ordinal severity** (Critical / High / Medium / Low / Info) — Prime Directive 1
   requires ordinal severity. It ranks what a finding *is*, not the probability that it is real.
2. **"may constitute" in the candidate-law section only** — PD16 reserves the legal
   characterisation to the court. The contradiction is stated as fact; what it *is* in law is not.

`overallScore` still exists **internally** for the JSON contract and demotion logic. It must
never be displayed. `tests/legal-analysis.test.js` asserts the absence of `/100` and confidence
bands and will fail the build if either returns.

### The prompt is not the enforcement — `scrubNarrative` is

A prompt is a request; a gate is a guarantee. Everything the worker returns is passed through
`scrubNarrative` (§4.13) **before it is drawn on a page**, and the report falls back to the
deterministic narrative if too much was dropped. When you change the narrator prompt in
`worker/verum-rules.js`, change the gate's expectations in `tests/legal-analysis.test.js` too —
never loosen the gate to let a better-sounding prompt through.

The narrator prompt also carries **FORMAT**, **SYNTHESIS** and **WHY IT MATTERS** rules
(founder request: "it mustn't be a text dump"). `narrativeBlocks` then renders the result as
typed heading / bullet / paragraph blocks. `tests/worker.test.mjs` locks the prompt text so a
future edit cannot quietly delete those rules.

---

## 7. Report anatomy (`forensic-report.js`)

`build(opts)` → main report PDF bytes · `buildNarrative(opts)` → the standalone
plain-language narrative PDF · `seal(pdf, sealOpts)` → sealed PDF.

**The report is in two halves, and the order is a founder ruling (AGENTS.md ruling 5): the
human story leads, the institutional evidence follows.** Do not reorder Part 1 behind the
table of contents "because that is how reports are laid out" — that is precisely the layout
the ruling replaced.

### Part 1 — the story (for everyone)

| # | Section | What it is |
|---|---|---|
| — | **Cover** (`drawCover`) | QR to the Verification Hub, provenance lines, and `GOVERNED BY CONSTITUTION V8.0 \| ENGINE INSTRUMENT V6.1` — governance named first, instrument second |
| 1 | **`secExecutiveSummary`** — *front page* | Source line, an **IN ONE PAGE** box, **The findings that matter most** (top 3, with *both* halves of a two-sided contradiction printed in full), **Key dates in the record**, **What to do next**, closing verdict reservation |
| 2 | **`secDocumentsInBundle`** | When `voDetectDocuments` recovered document boundaries: which documents are in the bundle, their page ranges, and which findings cross between them (`crossDocNote`) |
| 3 | **`secShortVersion`** | Each substantive finding as one line, contradictions split into their two sides by `contradictionSides` |
| 4 | **`secNarrative(ctx, data, { label: 'THE STORY IN PLAIN LANGUAGE' })`** | On-device deterministic narrative, or the worker's narrative when enabled — always structured into headings/bullets/paragraphs by `narrativeBlocks`, never a text dump, and always passed through the §15.2 gate (§6) |
| 5 | **`secUnreadPages`** | Every page the engine could not read, named with its reason (`capped` / `noText` / `renderFailed` / `timedOut`), collapsed into ranges by `pageRanges`, with a human-review instruction — plus **PAGES READ THROUGH OCR** (`secOcrProvenance`): pages whose text was machine-recovered are named, and findings anchored on them carry an OCR-provenance line in FINDINGS IN DETAIL. No per-word confidence is printed — that would be PD1's barred probability language; the disclosure is HOW the text was obtained and WHERE to verify it |
| 6 | **`secSealExplainer(… { label: 'WHY THIS RECORD CANNOT BE ALTERED' })`** | SHA-512 + OpenTimestamps in plain words |

Part 1 also carries the **provenance statement** required by ruling 5: the findings are the
output of deterministic forensic software — fixed detection rules, page-anchored quotes — and
**not** the opinion of a generative AI. Any optional AI layer stays labelled and advisory.

### Part 2 — the evidence (for investigators and lawyers)

**Table of contents** (placeholder page, drawn last once real page numbers are known), then
the **Constitution v8.0 §15.4 seven-section template** in order — these headings are
constitutional and are **not** renamed for accessibility:

1. `secCriticalSubjects` — CRITICAL LEGAL SUBJECTS
2. `secDishonestyMatrix` — DISHONESTY DETECTION MATRIX
3. `secNineBrain` — NINE-BRAIN EXTRACTION FINDINGS
4. `secTripleVerification` — TRIPLE VERIFICATION SUMMARY
5. `secSealedFindings` — SEALED FINDINGS
6. `secVerdictReservation` — VERDICT RESERVATION
7. `secDeclaration` — CERTIFICATION

Then `secAnnexDivider` and the annexes, in build order: `secExecSummary` (the legacy fact
box / severity table) · `secAiReview` (no-op when off) · `secPartyAnalysis` ·
`secStatutoryAnchoring` (person → contradiction → page → candidate law) · `secOffenceMatrix`
(with **Elements Evidenced**) · `secActions` (0–14 / 14–90 / 90+ days) · `secMonetaryFigures` ·
`secEvidenceIndex` · `secMatrix` · `secFindingDetails` (each finding with parties, location, verbatim quote and candidate law; a finding with `swornContext` adds one factual oath-context line and a sworn-statement candidate-law bullet — see §4.18) · `secPersonIndex` · `secSerial` ·
`secTimeline` · `secEvidenceAppendix` · `secEvidenceMap` (Annexure A) · `secConstitution` ·
`secMethodology`.

### Report facts the engine derives — never the user

The report **must not** rely on the user to name anything. It derives:

- **Parties** — `documentParties` / `effectiveParties` / `effectivePartiesWithRoles` read the
  names out of `anchor.who` on the findings themselves, deduped by `samePartyName`
  ("L. Highcock" and "Liam Highcock" are one party). A report saying "No parties were supplied"
  above a finding that names someone is a bug.
- **Jurisdiction** — `detectJurisdictions` sets `home` from the sealing GPS fix using
  deterministic bounding boxes (ZA / AE / GB / US — **no geocoding service**, AGENTS.md
  ruling 6); every other jurisdiction named in the record becomes a foreign leg.
  `statutesForSubject` lists `[home].concat(foreign)`, home first.
- **Page anchors** — `pageNumbers` / `fmtLocation` are plural- and list-aware ("Pages 11 and 12",
  "Page 89 vs Page 89") and dedupe before printing. `—` in a location field means the finding
  failed the anchor rule and should not have reached the page.

---

## 8. Public API

### `forensic-engine-page.js`
`VO_ENGINE_VERSION` · `CONTRADICTION_TYPES` · `DETECTORS` · `SERIAL_PATTERNS` ·
`runForensicEngine` · `detectSerialPatterns` · **`voDetectDocuments`** · **`voDetectSwornPages`** ·
`voBackfillPageAnchors` · `voPageForEvidence` ·
`voPagesForEvidence` · `voDigitalForensicsScan` · `voExcludeTemplatePages` ·
`voEnforceAnchorRule` · `voContentMass` · `VO_NEAR_EMPTY_CHARS` · `voCtById` ·
`voCropHidesContent` · `voExtractCitations` · `voExtractParties` ·
`voExtractPersonsFromContext` · `voLooksLikePerson` · `voCleanPersonName` ·
`voBuildNameRoster` · `voExtractDates` · `voExtractQuotes` · `voParsePages` · `voDateSortKey` ·
`voStatement` · `voAnchorEnrich` · `voBuildTimeline` · `voBuildPersonIndex`

`voDetectDocuments(textBlocks)` recovers document boundaries inside a consolidated bundle from
`Page N of M` markers: a new segment starts when the total `M` changes or `N` restarts. It
requires **≥ 2 runs, ≥ 3 pages each, and ≥ 50 % page coverage** before it reports anything —
below that it returns nothing rather than guess. Titles come from each document's *own* first
page (marker stripped, capped at 58 characters). `runForensicEngine` attaches the result to
its output as `documentMap`.

**`voDetectSwornPages(textBlocks)`** returns the 1-based pages carrying oath language (guards in
§4.18). `runForensicEngine` attaches the list to its output as `swornPages` and sets
`swornContext = true` on any finding whose anchor page is in it.

### `forensic-report.js` (`window.VerumReport`)
`build` · **`buildNarrative`** · `seal` — plus test seams: `_sanitize` `_cleanQuote`
`_extractParties` `_extractPartiesWithRoles` `_partyRoleMap` `_legalSubjectOf` `_dishonestyOf`
`_listPhrase` `_narrativeMeaning` `_ctNames` `_narrativeMeaningMap` `_plainLeadLines`
`_narrativeBlocks` `_pageRanges` `_fmtLocation` `_pageNumbers` `_scrubNarrative`
`_contradictionSides` `_establishesOf` `_docsForLocation` `_crossDocNote` `_documentParties`
`_effectiveParties` `_effectivePartiesWithRoles` `_splitSentences` `_detectJurisdictions`
`_statutesForSubject` `_subjectOf` `_attributeParty` `_extractMoney`

`build(opts)` and `buildNarrative(opts)` take the same option bag; the host page must pass
`unreadPages`, `gps`, `aiNarrative` and `aiNarrativeSource` to **both**, or the narrative PDF
silently loses the unread-page disclosure and the home jurisdiction.

---

## 9. Inlining

`forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`, `ots-proof.js` and
`pdf-encrypt.js` are **inlined** into `seal-document.html` between
`/* VO-INLINE:<file>:START */` … `/* VO-INLINE:<file>:END */` markers, because root-level `.js`
fetches are unreliable on this deployment — a dropped script would mean a silent scan failure.

**Workflow: edit the source file, then re-splice.** `tests/inline-scripts.test.mjs` byte-compares
the copies (note: the inline block excludes the source's trailing newline) and fails on drift.

```js
const START = '/* VO-INLINE:' + file + ':START */\n', END = '\n/* VO-INLINE:' + file + ':END */';
const src = fs.readFileSync(file, 'utf8').replace(/\n+$/, '');
const s = html.indexOf(START), e = html.indexOf(END, s);
html = html.slice(0, s + START.length) + src + html.slice(e);
```

**Do not** "de-duplicate" the inline copy into a shared module. The duplication is deliberate
and the test makes drift impossible.

---

## 10. Changing the engine without regressing it

Yesterday's extraction quality is the baseline. To protect it:

1. **Add a regression test first**, using the **exact text from the real document** that
   motivated the change. Every guard in §4 has one; that is why they have survived.
2. **Run the full suite** — `node tests/run-all.js`. Green is the only acceptable state.
3. **Re-splice the inline copies** after every source edit.
4. **Never delete a guard to "increase recall."** If you believe a guard is wrong, prove it
   with the original document text in a test, and say so in the commit message.
5. **Never hardcode a party, name, account number or case fact** into a detector. Detectors
   measure structure; they do not know who anyone is.
6. **New contradiction type?** Update `CONTRADICTION_TYPES`, `CT_NAMES`, `CT_CATEGORY`,
   `NARRATIVE_MEANING`, `CT_DETECTOR`, `LEGAL_SUBJECT_OF` and `worker/rule-format.md` together,
   and bump `CT_COUNT`.
7. **No `Date.now()` / `Math.random()` in analysis paths.** Determinism is constitutional.

### What the tests guard

**27 suites · 1374 assertions.** `tests/run-all.js` is the registry — a new
test file that is not registered there does not run.

| Suite | Checks | Guards |
|---|---|---|
| `forensic-engine.test.js` | 328 | Core engine behaviour, extraction quality and OCR regressions |
| `legal-analysis.test.js` | 207 | Party extraction, legal subjects, **PD16 language**, the §15.2 narrative gate, sentence splitting, page anchors, executive summary and SEALED FINDINGS integrity, OCR provenance (PD6) |
| `page-boot.test.mjs` | 100 | The seal page still boots when a library is missing |
| `detector-recall.test.mjs` | 107 | Recall + the §4 false-positive guards, pinned to real bundle strings |
| `finding-anchors.test.mjs` | 87 | WHO/WHERE/WHAT/WHEN anchoring per finding |
| `worker.test.mjs` | 72 | Worker endpoints, limits, embedded constitution, **narrator prompt locks** (FORMAT / SYNTHESIS / WHY IT MATTERS), pattern-feedback contract, **the §12 institutional-engagement honesty clause** (no court has validated Verum Omnis — seven assertions) |
| `greensky-regression.test.js` | 55 | The Greensky bundle: D01 conduct admission (§4.11) and `voDetectDocuments` (§4.15) |
| `ocr-rescue.test.mjs` | 44 | OCR fallback path and the **deadline helper** — no unbounded `recognize()` promise |
| `constitution-lock.test.mjs` | 41 | Version chain, seal IDs, taxonomy renumber lock, **governance-first cover** |
| `allfuels-regression.test.js` | 59 | The AllFuels bundle end to end, D37 clause-numbering (§4.17), oath context (§4.18) |
| `crop-normalize.test.mjs` | 44 | CropBox normalisation, **seal band geometry** (pages extended, not overlaid), **share ordering**, ZIP validity/determinism, and the **seal-certificate privacy boundary** (§12.6) |
| `inline-scripts.test.mjs` | 21 | Inline copies byte-identical to source |
| `seal-guard.test.mjs` / `ots-proof.test.mjs` | 16 each | "The only genuine Verum output is a sealed output" · OpenTimestamps proof handling |
| `digital-forensics.test.mjs` / `findings-json.test.mjs` / `narrate-excerpt.test.mjs` | 16 each | PDF structure · JSON contract v1.1.0 · AI excerpt building |
| `franchise-lease.test.mjs` | 15 | D38/D39 (CT44/CT45) |
| `wrangler-config.test.mjs` / `role-capacity.test.mjs` | 13 each | Deploy config drift · D40/CT46, no hardcoded parties |
| `ai-assess-batch.test.mjs` | 11 | Client batching under the worker's body limit |
| `encrypt-detect.test.mjs` / `rule-classify.test.mjs` | 9 each | Encryption detection · deterministic classify fallback |
| `find-seal.test.mjs` / `pdf-encrypt.test.mjs` | 8 each | Seal discovery · real password protection |
| `voice-crypto.test.mjs` | 7 | `.voice` cross-page encryption |
| `engine-perf.test.mjs` | 5 | Per-page extraction does not re-parse the whole PDF |

---

## 11. Where the engine deliberately stops

The deterministic engine has a real ceiling on scanned/OCR'd documents (fuzzy party names,
paraphrased clauses). That ceiling is **by design** the boundary where the hybrid LLM layer on
the apps takes over: the model reads difficult documents and raises **candidates**, always
labelled as candidates pending verification, never counted as verified findings (§4.10).

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

The engine is only as good as the page that runs it. Each of the following was a field failure
reported by the founder. None of them is decoration.

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

`shareAnonymousPatterns(fraudResult)` posts **novel contradiction types only** — no document
text, no names — to the worker so the engine's coverage improves as the site is used. The
novel-type filter is `/^CT(0[1-9]|[1-3][0-9]|4[0-6])$/`. **When a new CT is added, widen this
regex**: it once stopped at CT43 while the engine ran to CT46, so three types could never be
reported. `tests/worker.test.mjs` pins the range against the engine's `CT_COUNT`.

### 12.5 Options the host page must pass to the report

`build` **and** `buildNarrative` both need `unreadPages`, `ocrPages`, `gps`, `aiNarrative` and
`aiNarrativeSource`. Passing them to only one produces a narrative PDF that quietly omits the
unread-page disclosure and the GPS home jurisdiction.

### 12.6a Voice notes and audio are sealed AS-IS, individually

WhatsApp voice notes (`.opus`; older exports `.m4a`/`.amr`/`.3gp`) and other audio evidence
cannot be merged into a PDF or stamped, so audio takes its own batch path (`voSealAudioBatch`,
up to 10 files): each file gets SHA-512 + SHA-256, a seal ID, an OpenTimestamps submission, a
QR payload and a shareable Seal Certificate — **the audio bytes are never modified**. The
original file IS the evidence; the certificate and `.ots` receipt carry the seal record.
Mixing audio and PDFs in one seal is refused with an explanation (a PDF bundle merges into ONE
document; audio seals as N individual files). The certificate privacy latch (§12.6) carries
over: identity/GPS/device appear only in PRIVATE certificates, delivered in a separate ZIP
named `-do-not-share`. The UI states the evidentiary rule in terms: *a transcript is not
evidence — the sealed audio is*. Transcription (the audio analogue of OCR, with the same
provenance discipline as §4.18/§12.5's OCR rules) is a future layer, not part of sealing.

A batch may carry companions: **one WhatsApp chat export (.txt)** and up to ten **screenshots**
(.png/.jpg). They feed the **Voice-Note Evidence Report** (`buildVoiceNoteReport`) — one PDF,
sealed through `VerumReport.seal`, recording per note the fingerprint, seal ID, device-reported
file details, best-effort duration ("not determined on this device" when the browser cannot
decode the codec), and the chat-export line referencing the file, **quoted verbatim**
(`voManifestLineFor` / `voParseWaLine` handle Android and iOS export formats). Hard rules the
report states in its own text, all test-pinned: **no transcription; nothing identifies who is
speaking** (voice attribution is for a witness or the court); **sender labels come from the
chat export, never the audio** (an audio file carries no sender identity); a recording the
export never mentions is disclosed as unreferenced, not attributed; screenshots are exhibits
whose pairing with any recording is left to the reader.
**Tests:** `crop-normalize.test.mjs`.

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
**Tests:** `crop-normalize.test.mjs` (nine assertions).
