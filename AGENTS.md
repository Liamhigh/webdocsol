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

## Quick facts
- Static site + Cloudflare Worker (`worker/verum-rules.js`). No servers, no build step.
- Forensic engine: `forensic-engine-page.js` (CT01–CT46, 40 detectors); report generator: `forensic-report.js`.
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift.
- Tests: `node tests/run-all.js` (must be green before any push).
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
