# Engine QA — evidence-bundle-19 run (review assessment)

A durable record of a third-party AI "performance report" on the deterministic
engine, checked against what the engine **actually** produced. Its purpose is not
to grade the review but to let the next engineer (or agent) trust the engine's
*honesty* even where its *precision* is still thin: it separates the one real
defect from the claims that do not survive the sealed record. Not served (`*.md`
is in `.assetsignore`).

## Run under review

| Item | Value |
| --- | --- |
| Source bundle | `evidence-bundle-19-docs-sealed.pdf`, 48 pages |
| Source SHA-512 | `a38d494f6fb3233556960c41…151875ab7cf4` |
| Engine | Verum Omnis Forensic Contradiction Engine **v5.3.5-web**, Constitution v8.0 FINAL, operating instrument v6.1 |
| Report reference | `VO-WEB-20261009-6FB3` |
| Output | 4 findings (1 full weight, 3 OCR/secondary), 1 advisory AI candidate, 0 serial, 0 coercive, 3 unanchored observations |
| Reviewed | 9 October 2026, by Claude Code, against the sealed forensic report, the court-ready narrative, and the source bundle |

## Scope and limitations (read first)

Verified against the PDFs: forensic report pp. 1–13 and 44–46; source bundle
pp. 7–10 and 40–45. **Not** exhaustively read: all 46 report pages, all 48 bundle
pages, or the 25-page narrative in full. Confidence below is scoped to the pages
actually read; anything not opened is marked INSUFFICIENT. This note assesses one
run; it cannot establish the engine's precision/recall across a corpus.

## Headline verdict — HIGH confidence

The engine ran **correctly and honestly**. Provenance, anchoring, verdict
reservation, the anchor discipline (demoting unanchorable signals to
"observations, not findings"), and the explicit Prime-Directive-13 disclosure all
worked. The review found **one genuine defect** (F1, CT11 negation — now fixed).
Its **"severity HIGH" point is correct** (read from the findings JSON; the report
only suppresses *printing* it). Its **F2 "mislabel" claim is unfounded** (the
engine labels F2 correctly). F3 and F4 are **low-harm page-type observations**;
F4's specific "seal page" reading **does not hold on the engine's SHA-verified
input** — p. 45 is an email-tail/attachment page, confirmed from the raw text
below. The review's broad headline ("more false positives than true positives",
"not suitable as a standalone engine") is too harsh for what the sealed record
shows, but it is **not** the inversion the earlier draft of this note implied —
and this note's own first draft got the severity point wrong (said the engine
"does not emit" severity; corrected below).

## The one real defect — CT11 negation false positive (CONFIRMED, now fixed)

- **Engine output** (report p. 5): `Authority Contradiction (CT11) — "signed by or on behalf of" … The record states both positions. They cannot both hold.`
- **Actual source** (bundle p. 8, para 4(b)): *"to show that the respondent's document, on its face, **was never signed by or on behalf of** the respondent."*

The detector matched the phrase inside a **negated** clause and reported an
authority conflict that is not there — the record states one thing (a signature
was absent), not two conflicting things. Confirmed by reading the surrounding
text: there is no opposing authority claim on p. 8 or p. 10.

**Fixed** in `ENGINE.md` §12.23 (9 Oct 2026): a shared `voNegatedBefore` gate now
sits in front of **both** the CT11 authority detector (D08) and the
cross-document owner-direction extractor — one implementation, so the two paths
cannot drift. Pinned in `detector-recall.test.mjs` with the real p. 8 text.

> Independent corroboration: Sourcery's review of PR #224 flagged the **same**
> negation hole in the cross-document path. Two independent reviews, one defect —
> which is why both detectors were wired to one matcher.

## The review's "overstated" claims, re-checked against the sealed files

Each was re-checked against the **exact bytes the engine analysed** — the bundle
whose SHA-512 is `a38d494f6fb3233556960c41900d0d6692905d68b262f5806bf77e4f3b4c2128f154274e000c560d4ace9805bf422148c44d59f209dde665a832151875ab7cf4`,
confirmed by hashing the input file and matching it to the source hash the engine
printed on the report cover and the OpenTimestamps page. **Page numbers below are
to that file, not to any re-sealed copy.**

- **"Severity set to HIGH" — the review was right; the engine DOES emit it.**
  (Correction to this note's first draft, which wrongly said the engine "does not
  emit" severity.) The engine's findings carry a numeric severity internally
  (CT11 = 4 = HIGH) and the findings JSON carries it (F001/F004 = HIGH, F002/F003
  = LOW) — `tests/findings-json.test.mjs` confirms findings carry severity. What is
  true is narrow: the **sealed PDF report does not print** it (§29: "No score,
  band or severity label is printed", Prime Directive 1 §15.2). So the reviewer
  read "HIGH" from the JSON — not a fabrication.
- **"F4 flagged its own seal page" — not supported on the engine's input.**
  **The file this speaks for:** `9a46debf-evidence-bundle-19-docs-sealed.pdf`,
  **SHA-512 `a38d494f6fb3233556960c41900d0d6692905d68b262f5806bf77e4f3b4c2128f154274e000c560d4ace9805bf422148c44d59f209dde665a832151875ab7cf4`**
  — a byte-exact match to the source hash the engine printed. The raw text layer
  of p. 45 from that file (`pdftotext -f 45 -l 45`) is:

  ```
  VERUM OMNIS SEALED ORIGINAL — scan the code or verify at verumglobal.foundation/verify.html

  Yours faithfully

      REFUND FOR FUEL.pdf
      206 KB

  PRIVATE SEAL — FREE TIER                       verumglobal.foundation | OpenTimestamps | Patent Pending
  VERUM OMNIS SEALED ORIGINAL | Seal: VO-85D980AEFA4A | SHA-512: 85d980aefa4a0309... | 09/10/2026 14:17:19 Africa/Johannesburg | 45/48
  ```

  The `VERUM OMNIS SEALED ORIGINAL — scan the code …` line is the **per-page
  header that appears on all 48 pages**; p. 45's own content is *"Yours
  faithfully"* + the *REFUND FOR FUEL.pdf (206 KB)* attachment. So p. 45 is an
  **email-tail / attachment page**, and the engine's F4 flag is a
  **structurally-short-page issue** (the same class as F3), **not a seal
  self-flag**. The seal-exclusion path worked: §29 records seal furniture
  stripped from 42 pages, and the engine's "37 chars" residual matches the
  email-tail text left after the header was stripped (a seal page would strip to
  ~0). A review that read p. 45 as *being* the seal line was reading a
  differently-named copy (`…-sealed-sealed.pdf`) with a different hash — a
  different artefact, whose p. 45 is not this one. All page references in this
  note are to the hash above.
- **"F2 mislabelled as Signature Mismatch" — UNFOUNDED.** The engine labels F2
  *"Unsigned Agreement Stated (CT23)"* (report §3, §5, §11), which is correct, and
  it is the strongest, most central finding in the bundle (the unsigned MOU,
  anchored to 5 pages). The reviewer argued against a label the engine did not use.

## Fair but minor refinements (MODERATE confidence)

- **F3 (bundle p. 40) is genuinely an attachment list** (*"2 attachments /
  DAMAGES.pdf 8 KB / REFUND.pdf 193 KB"*). The flag is already hedged
  (*"…either an image-only page OCR could not read, or a genuinely blank page.
  Establish which from the original"*). Low harm; page-type awareness would cut
  noise. F4 (p. 45) is the same class — a sparse email-tail page — not a seal bug.
- **Exec summary overstates slightly** (report p. 11: *"4 are substantive
  findings"*), while two of the four are document-integrity observations, not
  contradictions. The §5 framing (*"1 at full weight, 3 to verify"*) is good; the
  bare "substantive" line should distinguish **contradiction findings** from
  **document-integrity observations**.
- **Timeline mixes a citation date with event dates** (report p. 11: *"21 July
  1972 … R.1258 of 21 July 1972"* — the date of a cited regulation). Classifying
  citation dates separately from case events is a reasonable, bounded tweak.

## The "big misses" — mostly the narrative's job, and partly a constitutional line

The review's larger list (cross-document licence contradiction, financial
reconciliation, serial/coercive-conduct patterns, fraud-element mapping) is the
**same category point** raised against the earlier bundle-6 review: the
deterministic engine is an anomaly detector that *reserves verdicts*; the
substantive legal case (unsigned/expired MOU, no-compensation, goodwill, the
R2,932,500 fee, the R1,228,424.75 refund vs R250,000 retention — confirmed on
bundle pp. 41–44 — the DMPR/NPA referral) lives in the human narrative and the
affidavits, which carry it well. Two notes:

- **The cross-document feature (#224) does not touch this bundle.** It detects a
  same-transferor / same-vessel / different-new-owner ownership conflict — a
  vessel-ownership shape that does not occur in this franchise/lease/petroleum
  dispute. It is not credited with anything here.
- **Several asks are verdict-adjacent** — "fraud-element mapping",
  "coercive-conduct detection", financial "reconciliation" that declares
  mismatches — and would cross the §15.2 / verdict-reservation line. These should
  not be built as engine findings unless reframed as strictly descriptive.
  "Independent verification / PD13" is already handled by honest disclosure (§4
  states plainly the engine has no independent verifiers and does not call its
  findings verified).

## Follow-up tracker

| Item | Source | Status |
| --- | --- | --- |
| CT11 negation false positive (F1) | AI review + Sourcery #3 | **Fixed** (§12.23, shared `voNegatedBefore`) |
| Transfer date not transfer-local | Sourcery #5 (+ timeline citation-date point) | **Fixed** (§12.23, `ownerDate`/`voTransferDate`) |
| Shared-surname over-merge in `voSameParty` | Sourcery #1 | Held for review |
| Multi-vessel owner-direction attribution | Sourcery #2 | Held for review |
| Title-strip can swallow a one-sentence transfer | Sourcery #4 | Held for review |
| "Quoted verbatim" vs whitespace-collapse + 180-cap | Sourcery #7 | Held — fidelity fix (store byte-faithful; mark excerpts; header "quoted from the page") |
| O(n²) pairwise per vessel | Sourcery #6 | Deferred (note only) |
| Exec-summary "substantive findings" wording | AI review 5.18 | Open (low) |
| Page-type awareness (attachment lists, email tails) | AI review F3/F4, 5.2 | Open (low) |
| Two-copy p. 45 reconciliation (`…-sealed` vs `…-sealed-sealed`) | Founder QA re-check (9–10 Oct 2026) | **Resolved** — the two files differ at p. 45; the hash-matched engine input (`a38d494f…`) has the email-tail page, confirmed from its raw text layer; the seal-exclusion path worked (§29, 42 stripped) |

**Correction log (this note):** the first draft of this note made two mistaken
"corrections" of the review, both fixed above. (1) It said the engine "does not
emit" severity; in fact the engine emits severity in its findings/JSON and only
the printed report suppresses it. (2) It stated the F4 "seal page" claim as a bald
"FALSE" without citing which file; a re-check against a differently-named copy
briefly made the point look contestable. It is now stated as a confirmed fact for
one named, hash-identified file, with that file's raw p. 45 text quoted, so it
cannot be contested again. The lesson: a QA note that goes in front of an opponent
must itself be QA'd — cite the file and its hash, quote the primary source, and
never state a conclusion a re-check of that source can invert.

_Reviewer: Claude Code. This note records one run's assessment; it is evidence of
the review that was done, not a certification of overall engine accuracy._
