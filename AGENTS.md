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
- Tests: `node tests/run-all.js` — **27 suites, 1268 assertions**, **must be green before any push**. Many exist only to stop specific regressions; see `ENGINE.md` §10.
- Report language is constitutional (PD16): findings stated as fact and anchored — no scores, no confidence bands, no hedging; the verdict on any named person is for the court.
- Deterministic: no `Date.now()` / `Math.random()` in analysis paths. (`setTimeout` for an OCR deadline is a deadline, not a clock reading — permitted and disclosed.)
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time and the whole scan dies silently. See `ENGINE.md` §4.16.

## The five things most likely to be regressed

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
- All verification happens at `verify.html` (the Verification Hub). No surface verifies locally.
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
- Published documents must never mention any particular attorney's access
  arrangements. Check before publishing anything reader-facing.
