# webdocsol — Verum Omnis MASTER surface

**System context (read first):** [`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md)
— this repository is one surface of the Verum Omnis system; that document is
identical in every Verum Omnis repository and governs how all surfaces fit
together. Repo-specific architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Quick facts
- Static site + Cloudflare Worker (`worker/verum-rules.js`). No servers, no build step.
- Forensic engine: `forensic-engine-page.js` (CT01–CT46, 40 detectors); report generator: `forensic-report.js`.
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift.
- Tests: `node tests/run-all.js` (must be green before any push).
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
