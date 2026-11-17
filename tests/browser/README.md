# Browser gates

Run from the repository root after `npm ci`:

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

The configuration starts a loopback-only static server. Every non-loopback request is aborted and recorded. Tests assert that no AI/feedback endpoint is called and that the synthetic source sentence never appears in an attempted external request body. No hosted browser or evidence service is used.

Coverage:

- boot of the root seal, verify, and home pages;
- 375 px, 768 px, and 1200 px horizontal-overflow checks;
- deterministic local analysis of a synthetic PDF with every new module flag off;
- sealed-PDF generation, download, QR output, `VO-SEAL2` Subject/ORIG metadata, and producer;
- verification of that exact downloaded file through root `verify.html`.

All fixtures are generated in the test and contain synthetic text only. Failure screenshots/traces may contain only those fixtures. CI retains them for three days.

## WebKit support matrix

`@playwright/test` is pinned to 1.65.1. Its release line supports Ubuntu 26.04 and ships the WebKit 27.2 line used by CI alongside Chromium and Firefox; this also moves WebKit past the pre-1.65 Ubuntu 26.04 crash line observed in the Phase 0 gate. The project does not claim that this is an older-WebKit job. Compatibility with older WebKit/Safari parsing is separately guarded by the static prohibition on regex lookbehind in new production parser/contract files; expanding to a genuinely older WebKit runtime requires a separately pinned, locally runnable image rather than a hosted evidence service.
