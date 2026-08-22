# webdocsol — Repository Reference

> **What this repo is:** the master surface of Verum Omnis — a static website plus a Cloudflare
> Worker. It seals documents, runs the deterministic forensic engine **in the browser**, produces
> sealed forensic reports, and hosts the **canonical verification endpoint** that every other
> surface points at. There is **no server, no database, no build step.**

**Read alongside:** [`ENGINE.md`](./ENGINE.md) (the forensic engine — the important one) ·
[`ARCHITECTURE.md`](./ARCHITECTURE.md) (system constraints) ·
[`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md) (the whole platform) ·
[`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md) (design law) ·
[`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`DESIGN_LOCK.md`](./DESIGN_LOCK.md) ·
[`FORENSIC-DEBUG.md`](./FORENSIC-DEBUG.md)

---

## 1. Pages — what each one does

| Page | Purpose | Notes |
|---|---|---|
| **`index.html`** | Public homepage: what Verum Omnis is, the case record, the **Get the Apps** download hub (Android · Windows Lite · Fraud Firewall). | Institutions self-serve; free, subject to the commercial terms in Constitution §7. |
| **`seal-document.html`** | **The main application.** Upload → deterministic scan → sealed PDF + sealed forensic report. Runs the engine, the report generator, OTS anchoring, optional password protection. | ~740 KB because the engine and report generator are **inlined** (see ENGINE.md §9). |
| **`verify.html`** | **The Verification Hub.** Recomputes SHA-512, finds the seal marker, checks the OpenTimestamps/Bitcoin anchor. **Every seal QR on every surface points here.** | No account, no upload to a server — verification is local and cryptographic. |
| **`verify-data.html`** | Report verification data — inspect a sealed report's findings JSON. | |
| **`dashboard.html`** | Law-enforcement dashboard. | |
| **`constitution.html`** | Publishes the sealed Constitution **v8.0** verbatim, with the version chain (v6.0 ConCourt filing → v6.1 engine instrument → v8.0 charter). | Machine-readable twin: `constitution.json`. Pinned by `constitution-lock.test.mjs`. |
| **`documents-resources.html`** | Public document library (constitution PDFs, sealing standard). | |
| **`preview-index.html`, `preview-documents.html`** | Staging previews. Not linked from production nav. | |

## 2. Scripts

| File | Role |
|---|---|
| **`forensic-engine-page.js`** | The deterministic engine: CT01–CT46, detectors D01–D40, 17 serial patterns, anchoring, OCR rescue. **See [`ENGINE.md`](./ENGINE.md).** |
| **`forensic-report.js`** | Sealed forensic report generator (`window.VerumReport.build` / `.buildNarrative` / `.seal`). Two halves: **Part 1 — the story** (executive summary, documents in this bundle, the short version, the plain-language story, unread pages, seal explainer) then **Part 2 — the evidence** (table of contents, Constitution v8.0 §15.4 sections 1–7, annexes). Auto-derives parties and jurisdiction; PD16 language throughout. **Anatomy: [`ENGINE.md`](./ENGINE.md) §7.** |
| **`seal-guard.js`** | Enforces *"the only genuine Verum output is a sealed output"* — blocks unsealed exports. |
| **`ots-proof.js`** | OpenTimestamps proof handling: submit, parse, upgrade, verify the Bitcoin anchor. |
| **`pdf-encrypt.js`** | Standard password protection for sealed PDFs (verified against an independent PDF engine). |

All five are inlined into `seal-document.html`; `verify.html` inlines what it needs. **Edit the
source file, then re-splice** — `tests/inline-scripts.test.mjs` byte-compares and fails on drift.

## 3. Worker (`worker/`)

`verum-rules.js` — stateless Cloudflare Worker. Deploys automatically on push to `main`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/status` | GET | Health/status |
| `/api/v1/rules/manifest` | GET | Signed rule-package manifest for app self-update |
| `/api/v1/admin/publish` | POST | Publish a signed rule package (authenticated) |
| `/api/v1/feedback/patterns` | POST | Anonymised candidate-pattern feedback |
| `/api/v1/ai/classify` | POST | Document classification (advisory) |
| `/api/v1/ai/assess` | POST | AI review of engine findings (advisory, candidate tier) |
| `/api/v1/ai/narrate` | POST | Narrative generation from findings + document excerpt |
| `/api/v1/ai/gatekeep` | POST | Licensing gatekeeper |
| `/api/v1/ai/curate` | POST | Conservative rules curation |
| `/constitution.pdf`, `/docs/constitution.pdf` | GET | Sealed constitution PDF from KV |

**Hard limits** (exceeding them is why AI narratives silently disappeared once — the client must
batch): `MAX_AI_BODY` 16 KB · `MAX_AI_NARRATE_BODY` 96 KB · `MAX_NARRATE_EXCERPT` 12 000 chars ·
`MAX_ASSESS_FINDINGS` 40 · `MAX_NARRATE_FINDINGS` 25 · `MAX_CURATE_CANDIDATES` 10.

**KV holds only public, signed rule packages** — never user documents, findings or personal data.
The Worker also carries an embedded copy of the constitution that governs the AI prompts; it must
state institutional engagement honestly (**no court has validated Verum Omnis**).

Other worker files: `rule-format.md` (wire format for rule packages) · `public-key.der.b64`
(pinned RSA key, `SHA512withRSA`) · `seed-rules.json` · `static-proxy.js` /
`verumglobal-static.js` (static origin proxying).

## 4. Other directories

| Path | Contents |
|---|---|
| `vendor/` | Pinned third-party libraries: `pdf.min.js` + worker (pdf.js), `pdf-lib.min.js`, `qrcode.min.js`, Tesseract OCR core/worker + `eng.traineddata.gz`. **Vendored deliberately** — the app must work offline and must not depend on a CDN. |
| `seal-module/` | The portable sealing spec (`SPEC.md`) and per-surface implementations (`web`, `android`, `firewall`) so a seal produced anywhere verifies everywhere. |
| `images/` | Logos and the watermark used in sealed PDFs. |
| `tests/` | **27 suites, 1306 assertions** — run with `node tests/run-all.js`. That file is the registry: a test file not listed in it does not run. See ENGINE.md §10. |

**Root PDFs:** `Verum-Omnis-Briefing.pdf` is the public briefing for law enforcement and
attorneys (what the platform does, how the sealing service is used, why the record cannot be
altered) — it is linked from `index.html`, so **any edit to it is a publication**.
`constitution-v8.pdf` is the sealed charter. `greensky-ocr-verify.pdf`, `vanessa.pdf` and
`forensic_test_document.pdf` are fixtures kept for manual reproduction of real bundles.

## 5. Documentation map

| Document | What it covers |
|---|---|
| **`ENGINE.md`** | **The forensic engine.** Detector inventory, false-positive guards, PD16 language rules, regression protocol. **Read before touching engine or report code.** |
| `ARCHITECTURE.md` | System constraints: stateless/serverless, verification-at-the-website, how the surfaces stay one engine. |
| `REFERENCE.md` | This file — repo map, pages, scripts, endpoints. |
| `VERUM_OMNIS_SYSTEM_PROMPT.md` | The whole platform (identical in all four repos): nine brains, triple verification, constitutional compliance, per-surface requirements, §12-UI design law. |
| `VERUM_UI_TOKENS.md` + `verum-ui.css` | Binding design system for every surface. |
| `CONSTITUTION-v8.md` | The sealed governance charter (v8.0, `VO-9A4F3C5E825C`). |
| `DEPLOYMENT.md` | Cloudflare Pages + Workers Builds deployment. |
| `DESIGN_LOCK.md` | Locked visual decisions on the public site. |
| `FORENSIC-DEBUG.md` | Debugging a scan: what to inspect when findings look wrong. |
| `AGENTS.md` | **Entry point for code assistants** — the stakes (platform output is evidence in live court proceedings), the seven things most likely to be regressed, the founder rulings that must not be re-litigated, and the never-write list for public claims. |
| `README.md` | Project overview. |

## 6. Working here — the short version

```bash
node tests/run-all.js      # must be GREEN before every push
```

1. **Read [`ENGINE.md`](./ENGINE.md) before changing engine or report code.** The guards in §4
   are load-bearing; each one exists because a real bundle produced a false finding.
2. **Edit source, then re-splice the inline copies** into `seal-document.html`.
3. **Never add a server, database, login backend or uploads bucket.** If a feature seems to need
   one, it is the wrong design — reach for client-side, on-device or cryptographic instead.
4. **All verification happens at `verify.html`.** No other surface verifies locally.
5. **Deterministic:** no `Date.now()` / `Math.random()` in analysis paths.
6. **PD16 language** in everything a reader sees: no scores, no confidence bands, no hedging,
   verdict reserved to the court.
7. **No regex lookbehind in new code** — Safari < 16.4 throws at parse time and the whole scan
   dies silently (ENGINE.md §4.16).
8. **Read the founder rulings in [`AGENTS.md`](./AGENTS.md) before redesigning anything.** The
   report order, the absence of verdicts, and the auto-derivation of parties and jurisdiction
   are settled decisions, not open questions.
9. Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
