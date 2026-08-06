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
5. **`node tests/run-all.js` must be green before every push.** 954 assertions; many exist
   solely to stop the regressions in §4.

---

## 1. Pipeline

```
PDF bytes
  ├─ voParsePages()            text per page (pdf.js), OCR rescue for image-only pages
  ├─ voCropHidesContent()      CropBox smaller than MediaBox = hidden content
  ├─ voDigitalForensicsScan()  raw PDF structure: revisions, saves after signing, embedded files
  ├─ voExcludeTemplatePages()  boilerplate pages repeated across a bundle are not evidence
  ├─ DETECTORS D01–D40         each returns findings[] (§3)
  ├─ detectSerialPatterns()    multi-stage pattern matches across findings
  ├─ voBackfillPageAnchors()   binds every finding to its page
  ├─ voEnforceAnchorRule()     drops content findings that cannot be anchored (§5)
  ├─ voAnchorEnrich()          WHO / WHERE / WHAT / WHEN per finding
  └─ generateSummary()         fact-stated summary sentence (no bands)
        ↓
   findings JSON  →  forensic-report.js build()  →  sealed PDF (seal())
```

`runForensicEngine(bytes, pdfDoc, onProgress)` is the single entry point. It is **pure and
deterministic**: no `Date.now()`, no `Math.random()`, no network, no hidden state. Same input →
same findings, on any device, forever. This is Prime Directive 4 and it is what makes a sealed
report reproducible years later.

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
| D02 `DETECT_NUMERICAL_DISCREPANCY` | CT02 | The same labelled quantity is given two different numbers |
| D03 `DETECT_DATE_INCONSISTENCY` | CT03 | Impossible or conflicting dates |
| D04 `DETECT_TEMPORAL_IMPOSSIBILITY` | CT04 | Event ordering that cannot have happened |
| D05 `DETECT_LOGICAL_IMPOSSIBILITY` | CT06 | Mutually exclusive statements |
| D06 `DETECT_IDENTITY_CONFLICT` | CT09 | Identity details that do not line up |
| D07 `DETECT_ROLE_CONTRADICTION` | CT10 | One party in incompatible roles |
| D08 `DETECT_AUTHORITY_EXCEEDED` | CT11 | Acts beyond stated authority |
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
| D37 `DETECT_INTERNAL_CONFLICT_CATCHALL` | CT43 + CT24/29/30/41/42 | Structural catch-all; runs last |
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

---

## 7. Report anatomy (`forensic-report.js`)

`build(opts)` → PDF bytes; `seal(pdf, sha512, sealId)` → sealed PDF.

1. Cover (QR to the Verification Hub) · 2. Table of contents · 3. **Executive Summary** —
plain-language lead, fact box (verified findings, severity counts, types triggered /46),
severity table · 4. **Plain-Language Narrative** — "the story the dates tell", each serious
finding in ordinary words with its page and a "what to check next" · 5. **Forensic Narrative** —
on-device deterministic narrative (or AI-assisted, marked advisory) · 6. **Legal Analysis** —
critical legal subjects, dishonesty matrix, behavioural scorecard · 7. **Statutory Anchoring** —
person → contradiction → page → candidate law · 8. **Candidate Offence Matrix** — includes
**Elements Evidenced** (per offence, which elements the record evidences) · 9. Recommended
actions (0–14 / 14–90 / 90+ days) · 10. Document & evidence index · 11. **Findings &
Contradiction Matrix** by category · 12. **Findings in Detail** — one entry per finding with
parties, location, verbatim quote, candidate law · 13. Person-mention index · 14. Serial
pattern analysis · 15. Timeline analysis (with date arithmetic: span and longest gap) ·
16. Evidence appendix (verbatim quotes) · 17. Annexure A — evidence map by page · 18. Declaration.

Jurisdiction is auto-detected from the document text (ZA home, plus AE/US/EU/UN legs) and
drives the candidate-law tables.

---

## 8. Public API

### `forensic-engine-page.js`
`VO_ENGINE_VERSION` · `CONTRADICTION_TYPES` · `DETECTORS` · `SERIAL_PATTERNS` ·
`runForensicEngine` · `detectSerialPatterns` · `voBackfillPageAnchors` · `voPageForEvidence` ·
`voPagesForEvidence` · `voDigitalForensicsScan` · `voExcludeTemplatePages` ·
`voEnforceAnchorRule` · `voContentMass` · `VO_NEAR_EMPTY_CHARS` · `voCtById` ·
`voCropHidesContent` · `voExtractCitations` · `voExtractParties` ·
`voExtractPersonsFromContext` · `voLooksLikePerson` · `voCleanPersonName` ·
`voBuildNameRoster` · `voExtractDates` · `voExtractQuotes` · `voParsePages` · `voDateSortKey` ·
`voStatement` · `voAnchorEnrich` · `voBuildTimeline` · `voBuildPersonIndex`

### `forensic-report.js` (`window.VerumReport`)
`build` · `seal` — plus test seams: `_sanitize` `_cleanQuote` `_extractParties`
`_legalSubjectOf` `_dishonestyOf` `_listPhrase` `_narrativeMeaning` `_ctNames`
`_narrativeMeaningMap` `_plainLeadLines` `_detectJurisdictions` `_statutesForSubject`
`_subjectOf` `_attributeParty` `_extractMoney`

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

| Suite | Checks | Guards |
|---|---|---|
| `detector-recall.test.mjs` | 93 | Recall + the §4 false-positive guards, pinned to real bundle strings |
| `finding-anchors.test.mjs` | 87 | WHO/WHERE/WHAT/WHEN anchoring per finding |
| `page-boot.test.mjs` | 76 | The seal page still boots when a library is missing |
| `legal-analysis.test.js` | 63 | Party extraction, legal subjects, **PD16 language** |
| `forensic-engine.test.js` | 45 | Core engine behaviour and OCR regressions |
| `worker.test.mjs` | 36 | Worker endpoints, limits, embedded constitution |
| `constitution-lock.test.mjs` | 21 | Version chain, seal IDs, taxonomy renumber lock |
| `ocr-rescue.test.mjs` | 18 | OCR fallback path |
| `digital-forensics.test.mjs` / `findings-json.test.mjs` / `narrate-excerpt.test.mjs` | 16 each | PDF structure · JSON contract v1.1.0 · AI excerpt building |
| `franchise-lease.test.mjs` | 15 | D38/D39 (CT44/CT45) |
| `seal-guard.test.mjs` | 14 | "The only genuine Verum output is a sealed output" |
| `role-capacity.test.mjs` | 13 | D40/CT46, no hardcoded parties |
| `crop-normalize.test.mjs` / `wrangler-config.test.mjs` | 12 each | CropBox normalisation · deploy config drift |
| `ai-assess-batch.test.mjs` | 11 | Client batching under the worker's body limit |
| `encrypt-detect.test.mjs` / `rule-classify.test.mjs` | 9 each | Encryption detection · deterministic classify fallback |
| `find-seal.test.mjs` / `pdf-encrypt.test.mjs` | 8 each | Seal discovery · real password protection |
| `voice-crypto.test.mjs` | 7 | `.voice` cross-page encryption |
| `inline-scripts.test.mjs` | 6 | Inline copies byte-identical to source |
| `engine-perf.test.mjs` | 5 | Per-page extraction does not re-parse the whole PDF |

---

## 11. Where the engine deliberately stops

The deterministic engine has a real ceiling on scanned/OCR'd documents (fuzzy party names,
paraphrased clauses). That ceiling is **by design** the boundary where the hybrid LLM layer on
the apps takes over: the model reads difficult documents and raises **candidates**, always
labelled as candidates pending verification, never counted as verified findings (§4.10).

When in doubt on this engine: **prefer precision.** Let the hybrid layer chase recall.
