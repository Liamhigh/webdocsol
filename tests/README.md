# Tests

Zero-dependency test suite for the WebDocSol production code. Everything runs on
plain Node (built-ins only) — no `npm install` required.

```bash
npm test              # run every suite (tests/run-all.js)
npm run check         # syntax-check all shipped JS with `node --check`

npm run test:forensic # forensic contradiction engine (forensic-engine-page.js)
npm run test:ots      # OpenTimestamps proof implementation (ots-proof.js)
npm run test:worker   # Cloudflare Worker API routing (worker/verum-rules.js)
```

## What is covered

**27 suites, 1310 assertions.** `run-all.js` is the registry — **a test file that is not listed
in it does not run**, so register every new file there. The full suite-by-suite table, with what
each one guards and the real evidence bundle behind it, lives in
[`../ENGINE.md`](../ENGINE.md) §10; the guards themselves are §4.

The three largest:

| Suite | File under test | Checks |
|-------|-----------------|--------|
| `forensic-engine` (328) | `forensic-engine-page.js` | Every detector survives edge inputs without throwing; known contradictions are detected (positive tests); clean text yields no false positives; serial-pattern engine; full `runForensicEngine` pipeline via the raw-text fallback path. |
| `legal-analysis` (189) | `forensic-report.js` | Party and jurisdiction derivation, legal subjects, **PD16 language** (no scores, no bands, no hedging), the §15.2 narrative gate, sentence splitting, page anchors, and SEALED FINDINGS integrity. |
| `page-boot` (100) | `seal-document.html` | The seal page still boots when a library fails to load. |

**Writing a regression test:** use the **exact text from the real document** that caused the
failure, not a paraphrase. Every guard in `ENGINE.md` §4 has one, and that is why they have
survived reviewers asking for them to be "simplified".

## Notes

- The pages load `forensic-engine-page.js` (self-contained, exported for Node),
  **not** `forensic-engine.js`. The tests target the file that actually ships.
- `runForensicEngine`'s raw-text fallback calls `extractPdfText`, a global
  defined in the page HTML at runtime; the pipeline test stubs it.
- Browser rendering of the pages (blank-screen regression, CDN-load handling)
  was verified separately with a headless-Chromium smoke test; that check needs
  `playwright-core` and a browser binary, so it is not part of this
  dependency-free suite.
