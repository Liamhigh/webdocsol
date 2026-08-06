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
- All verification happens at `verify.html` (the Verification Hub). No surface verifies locally.
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
