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
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift.
- Tests: `node tests/run-all.js` — 25 suites, 954 assertions, **must be green before any push**. Many exist only to stop specific regressions; see `ENGINE.md` §10.
- Report language is constitutional (PD16): findings stated as fact and anchored — no scores, no confidence bands, no hedging; the verdict on any named person is for the court.
- Deterministic: no `Date.now()` / `Math.random()` in analysis paths.

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
- All verification happens at `verify.html` (the Verification Hub). No surface verifies locally.
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
