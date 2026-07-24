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

| Suite | File under test | Checks |
|-------|-----------------|--------|
| `forensic-engine` | `forensic-engine-page.js` | All 37 detectors survive edge inputs without throwing; known contradictions are detected (positive tests); clean text yields no false positives; serial-pattern engine; full `runForensicEngine` pipeline via the raw-text fallback path. |
| `ots-proof` | `ots-proof.js` | Hex round-trips; digest/URL validation; `.ots` header-magic + digest-offset conformance to the OpenTimestamps spec; `buildPendingReceipt` → `parseSummary` round-trip; graceful handling of garbage/empty input. |
| `worker` | `worker/verum-rules.js` | CORS preflight, 404 for unknown paths, 405 for wrong method, `/api/v1/status`, graceful handling of empty POST bodies, and no stack-trace leakage in error responses. |

## Notes

- The pages load `forensic-engine-page.js` (self-contained, exported for Node),
  **not** `forensic-engine.js`. The tests target the file that actually ships.
- `runForensicEngine`'s raw-text fallback calls `extractPdfText`, a global
  defined in the page HTML at runtime; the pipeline test stubs it.
- Browser rendering of the pages (blank-screen regression, CDN-load handling)
  was verified separately with a headless-Chromium smoke test; that check needs
  `playwright-core` and a browser binary, so it is not part of this
  dependency-free suite.
