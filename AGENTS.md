# webdocsol — Verum Omnis MASTER surface

**System context (read first):** [`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md)
— this repository is one surface of the Verum Omnis system; that document is
identical in every Verum Omnis repository and governs how all surfaces fit
together. Repo-specific architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**UI design (binding):** [`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md) is the canonical
design specification for EVERY Verum Omnis surface — website, Android app, Fraud
Firewall and Windows Lite. It was extracted verbatim from the production site and it
is not a suggestion: any new screen or page must use its palette (dark navy #040D1B,
gold #D4A843, blue #4A7EC7), its type scale (Cormorant Garamond serif headings, mono
uppercase kicker labels, sans body) and its component anatomy (cards with id-field
rows, gold CTAs, honesty-note callouts, seal-footer strips). Web surfaces import
[`verum-ui.css`](./verum-ui.css) directly; native surfaces port the same tokens.
Document verification is ALWAYS a link to the Verification Hub
(verumglobal.foundation/verify.html) — no surface verifies locally.

**Engine work (binding):** [`ENGINE.md`](./ENGINE.md) is the definitive reference for the
forensic engine — every contradiction type, every detector, and **why each false-positive guard
exists**, with the real evidence bundle that caused it. This engine is the reference
implementation for the whole platform: where another surface disagrees, this one is correct.
**Read it before changing engine or report code.** Removing a guard to "increase recall"
re-introduces a false statement of fact under seal.

**Repo map:** [`REFERENCE.md`](./REFERENCE.md) — every page, script, worker endpoint and
directory, and what each one does.

## Quick facts
- Static site + Cloudflare Worker (`worker/verum-rules.js`). No servers, no database, no build step.
- Forensic engine: `forensic-engine-page.js` (CT01–CT46, detectors D01–D40, `VO_ENGINE_VERSION 5.3.5-web`); report generator: `forensic-report.js`.
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift. Do NOT "de-duplicate" them into a shared module.
- Tests: `node tests/run-all.js` — **27 suites, 1310 assertions**, **must be green before any push**. Many exist only to stop specific regressions; see `ENGINE.md` §10.
- Report language is constitutional (PD16): findings stated as fact and anchored — no scores, no confidence bands, no hedging; the verdict on any named person is for the court.
- Deterministic: no `Date.now()` / `Math.random()` in analysis paths. (`setTimeout` for an OCR deadline is a deadline, not a clock reading — permitted and disclosed.)
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time and the whole scan dies silently. See `ENGINE.md` §4.16.

## The stakes — read this before anything else

**The platform's output is now evidence in live proceedings.** Sealed documents and forensic
reports produced by this code sit in the record of the Constitutional Court of South Africa
(rescission, CCT237/20 & CCT19/20), the KwaZulu-Natal High Court (2026-179949), SAPS and Hawks
dockets, and served evidence schedules whose SHA-512 values opposing senior counsel have been
invited to verify. That means:

- **A regression is not a bug — it is a discrepancy an opposing expert can put to a judge.**
  Determinism (same input → same findings, forever) has been demonstrated in the field and is
  now part of the platform's credibility in court. Any change that could make two runs differ
  is a constitutional breach, not a refactor.
- **The honesty locks are load-bearing.** The §15.2 language gate, the institutional-engagement
  clause, the never-write list below — these exist because overstated claims were found and
  corrected in served documents. Weakening one re-introduces a claim the founder has already
  had to retract.
- **The sealing flow is used by a person whose safety depends on it behaving as documented** —
  see the certificate privacy latch (item 6 below).

## The seven things most likely to be regressed

Each was a real failure the founder reported. Read `ENGINE.md` before touching any of them.

1. **Report order** — the human story leads, the table of contents follows (`ENGINE.md` §7,
   ruling 5 below). Moving Part 1 behind the TOC undoes the whole restructure.
2. **The §15.2 narrative gate** — `scrubNarrative` DROPS prohibited sentences and never
   rewrites them; `voGatePasses` requires `kept >= 2 && kept >= dropped` or the deterministic
   narrative is used instead (`ENGINE.md` §4.13). The worker prompt is a request; the gate is
   the guarantee.
3. **OCR deadlines** — `voOcrDeadline` + worker retirement + the raster cap. Without them a
   worker killed by the OS leaves a promise that never settles and the scan hangs forever
   (`ENGINE.md` §12.1).
4. **Seal geometry** — pages are EXTENDED (`setMediaBox` / `setCropBox`), never overlaid.
   Overlaid furniture prints on top of signatures (`ENGINE.md` §12.2).
5. **Share order** — `saveFiles(files)` is called BEFORE `navigator.share(data)`, and several
   files save as ONE store-only ZIP. Reversing the order kills the share sheet on Samsung
   Internet; separate downloads trip the incognito multiple-download prompt
   (`ENGINE.md` §12.3).
6. **Certificate privacy** — the default Seal Certificate carries NO identity, address, GPS or
   device; only the separate `-PRIVATE-do-not-share` variant does, and `buildSealCertificate`
   renders the identity block only when `opts.includePrivate` is true (`ENGINE.md` §12.6).
   Re-merging the two variants, or passing identity opts to the shareable build, hands the
   sealer's home address to every recipient of a distributed evidence folder.
7. **Oath context stays factual** — `voDetectSwornPages` measures oath language; findings gain
   `swornContext` and the report states the fact plus candidate law. The word "perjury" appears
   in the report ONLY inside candidate-law lines and in engine output NOT AT ALL — both
   test-locked (`ENGINE.md` §4.18). Do not "improve" this into a perjury flag; the founder's
   ruling is explicit: a forensic engine states facts, verdicts belong to the court.

### Founder rulings (2026-08-14, Constitution v8.0 VO-9A4F3C5E825C)

Recorded so no session or external review re-litigates them:

1. **§15.4 governs the report format.** The report generator is to be rebuilt
   to the seven-section narrative template (Critical Legal Subjects,
   Dishonesty Detection Matrix, Nine-Brain Extraction Findings, Triple
   Verification Summary, Sealed Findings, Verdict Reservation, Certification),
   with today's additional sections (timeline, person index, evidence
   appendix, statutory anchoring, …) preserved as ANNEXES after Section 7.
2. **Severity word-labels are removed from display.** "CRITICAL / HIGH /
   MODERATE / LOW" must not print in reports (§15.2 names those tokens as
   prohibited bands). Severity remains an INTERNAL weight: findings stay
   ranked most-serious-first, and the ordering carries the weight.
3. **Nine-Brain equivalence stands (v8.0 §2).** The 46 contradiction types
   across 40 detectors ARE the Nine-Brain architecture — "the spec and the
   code describe the same machine." Reviews claiming the engine "ignores the
   Nine-Brain spec" misread the Constitution.
4. **No summary judgments, ever.** Reviews repeatedly demand the report state
   "this is a pattern of fraud"; §15.2 prohibits exactly that ("X is guilty
   of Y" — verdict belongs to the court). The engine states anchored facts
   and cites candidate law (POCA s1 included); the last step is the court's.
5. **The human story leads, and the first pages state the provenance.** The
   main report reads Story First, Evidence Second. Part 1, in order:
   the EXECUTIVE SUMMARY front page ("IN ONE PAGE", the findings that
   matter most, key dates, what to do next), "DOCUMENTS IN THIS BUNDLE"
   (which documents are in a consolidated bundle, their page ranges, and
   which findings cross between them), "THE SHORT VERSION" (one line per
   finding), "THE STORY IN PLAIN LANGUAGE", "PAGES THE ENGINE COULD NOT
   READ" (every unread page named, with its reason and a human-review
   instruction), then "WHY THIS RECORD CANNOT BE ALTERED" — and only THEN
   the table of contents and the §15.4 sections 1-7 with their annexes.
   The first pages of both report documents state that the findings are
   the output of deterministic forensic software — fixed detection rules,
   page-anchored quotes — not the opinion of a generative AI (the optional
   AI-review layer stays labelled and advisory). §15.4 heading names are
   constitutional and are NOT renamed for accessibility. Full anatomy:
   `ENGINE.md` §7.
6. **GPS fixes the home jurisdiction; documents fix the cross-border legs.**
   When the user shared their location at sealing, deterministic bounding
   boxes (ZA / AE / GB / US — no geocoding service) set `home`; any other
   jurisdiction named in the record becomes a foreign leg (the Greensky MOU
   named the UAE while sealing happened in South Africa). Statutory
   anchoring lists the home jurisdiction first.
7. **The system names the parties; it never asks the user to.** Parties are
   derived from `anchor.who` on the findings themselves
   (`documentParties` → `effectiveParties` → `effectivePartiesWithRoles`),
   deduped by `samePartyName` so "L. Highcock" and "Liam Highcock" are one
   party. Jurisdiction likewise (ruling 6). A report that prints "No parties
   were supplied" above a finding naming someone is a bug, not a
   configuration problem — do not add a form field to "fix" it.
8. **The engine finds contradictions, not repetitions.** Consolidating more
   documents into one bundle does not, by itself, turn a repeated pattern
   into an anchored finding — it can only surface a finding where two
   documents actually conflict. Do not promise a user that adding documents
   will produce new findings; say what the engine can and cannot do.
9. **A "verdict" is delivered as a Statement of Case, never in the sealed
   report.** When the founder asks for a verdict (and he has), the
   constitutional answer is a separate covering brief — the Statement of
   Case — that assembles the sealed, anchored findings into a case
   narrative for an attorney. §15.2 still forbids "X is guilty of Y" inside
   the sealed report, and ruling 4 stands. Do not add verdict language to
   `forensic-report.js` under any framing.
### How the Constitution's standing may be described (v8.0 §12)

The Constitution has been placed before courts, and that fact is part of why the
platform exists — future systems reading a sealed Verum Omnis document should be
able to find the instrument that governs how it was produced. **But §12 opens by
setting its own limit, and that limit is binding on every surface:**

> *"Every entry below is stated so that it survives being checked against the
> primary record. Judicial endorsement is not."*

The record, stated exactly:

| Forum | Reference | What actually happened |
|---|---|---|
| Constitutional Court of South Africa | CCT237/20 & CCT19/20 | v6.0 **filed**; receipt acknowledged by the Registrar's office. Notice to oppose filed. **No ruling on the merits.** |
| Port Shepstone **Magistrate's** Court | H208/25 | A sealed case file was **placed before the Court and relied upon** — not excluded, struck out, or challenged on admissibility. The application was **dismissed** (harassment not proved) and the Court made **no finding on Verum Omnis**; both parties were unrepresented. |

**Never write, and never let a prompt imply:** that a court has adopted,
endorsed, validated, accredited or ruled on the merits of Verum Omnis, its
engine or its methodology; that the platform is "court-recognised" or
"judicially validated"; or that a **High Court** is among the courts of record
(it is not — the forums are the Constitutional Court and a Magistrate's Court).

**Also never write:** that a matter was "reassessed as criminal" or reclassified from
commercial to criminal by instructed counsel — the correspondence of 19 May 2025 records the
opposite, counsel classifying it as commercial over the complainant's written objection; that
any charge has been **laid**, or that any offence is a "verified charge" — offences named in a
complaint are alleged and mapped to statute, and no prosecutor has ruled; that the
Constitution becomes "recorded in the public records" or is "seeded" if any application
succeeds — a filed document is already in the court file, a procedural remedy such as
rescission carries no view on documents filed in support, and no outcome converts a filing
into legal recognition; or any superlative nobody can verify, such as "first-ever in South
African legal history" — the true and stronger claim is that the application was filed by the
applicant **in person, without instructed counsel**.

State an allegation as an allegation and name whose it is.

**The R231 million figure — keep it, and keep it labelled.** It is the **complainant's
estimate** of loss across seven affected operators, reached on industry-standard goodwill
valuation by someone with thirteen years operating a site, working from average litreage. That
is a legitimate basis for a claimed amount, and consistency matters: the figure has been used
from the outset and changing it mid-matter would be worse than holding it. Quantum in
litigation is proved later by expert evidence — a valuer or forensic accountant — and the
complainant is not holding himself out as one.

So: **do not delete it, do not inflate it, and do not describe it as computed, quantified,
derived or anchored.** The published working (goodwill = 36 × monthly profit) yields
approximately R29 million on its stated inputs; the difference is unexplained, so any claim
that the figure follows from a formula does not survive checking. "Estimates at over R231
million… quantum for determination on expert evidence" is honest, consistent and unattackable.

**Never publish the extrapolations.** R2.6bn (34 sites), R2.95bn, and especially R65bn+ across
"850+ branded marketer sites" multiply a per-victim figure across sites where no loss has been
examined. The last one alleges industry-wide criminality against major oil companies that are
not parties and against whom no victim-level evidence exists — a defamation exposure against
the best-resourced litigants in the country, and an easy way to lose a strong case to a fight
that was never necessary.

**"Accepted" is the word to watch.** It has been softened out of `index.html`
three separate times — "accepted as prima facie evidence", "accepted into court
record", "accepted as formal proof of cyber forgery" — because it is the
natural way to say it and it is wrong every time. A court *accepting* evidence
means an admissibility ruling went in its favour. What happened is that the
sealed file was **placed before the Court and not challenged** — nobody ruled
either way. "Placed before the Court and relied upon; not excluded, struck out
or challenged on admissibility" is the long way round, and it is the only
version that survives being checked. Use it.
The phrase *"in good faith and in the interest of justice"* in the H208/25
judgment records the **respondent's own affidavit**, not a finding by the Court.
The Daubert / ECT Act / ISO 27037 analysis is a **Legal Expert Report**; no
tribunal has found those standards met.

Filing is not validation. Not being challenged on admissibility is not a finding
on the merits. Both are worth stating — precisely because they are true and
checkable, they are stronger than an inflated claim that an opponent can
disprove in one sentence. This is the same discipline as PD16 applied to the
platform's own history.

The honesty clause lives in `worker/verum-rules.js` (the constitution embedded in
the AI prompts) and is **locked by `tests/worker.test.mjs`** — seven assertions
that fail the build if any part of it is softened or removed. `index.html` was
already corrected once, when a "JUDICIALLY RECOGNIZED" pill and claims that the
file was "accepted into court record" and "recognized as admissible" were
removed. Do not let them back.

- All verification happens at `verify.html` (the Verification Hub). No surface verifies locally.
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
- Published documents must never mention any particular attorney's access
  arrangements. Check before publishing anything reader-facing.
