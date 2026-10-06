# webdocsol — Repository Reference

> **What this repo is:** the master surface of Verum Omnis — a static website plus a Cloudflare
> Worker. It seals documents, runs the deterministic forensic engine **in the browser**, produces
> sealed forensic reports, and hosts the **canonical verification endpoint** that every other
> surface points at. There is no origin server, no database of user documents and no build
> step: one Cloudflare Worker (`webdocsol`) serves both the site and the API, its only storage
> is the `RULES_KV` namespace (§3), and the repository root ships as it stands as that Worker's
> static assets. The engine runs on the device; only the "Seal document with forensic report"
> choice sends finding metadata, text excerpts, the sealed page text and voice-note audio to
> Cloudflare Workers AI, and nothing is stored there.

**Read alongside:** [`AGENTS.md`](./AGENTS.md) (start here: the state of the platform, the
stakes, the founder rulings) · [`CLAUDE.md`](./CLAUDE.md) (the non-negotiables) ·
[`ENGINE.md`](./ENGINE.md) (the forensic engine — the important one) ·
[`ARCHITECTURE.md`](./ARCHITECTURE.md) (system constraints) ·
[`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md) (the whole platform) ·
[`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md) (design law) ·
[`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`DESIGN_LOCK.md`](./DESIGN_LOCK.md) ·
[`FORENSIC-DEBUG.md`](./FORENSIC-DEBUG.md)

---

## 1. Pages — what each one does

| Page | Purpose | Notes |
|---|---|---|
| **`index.html`** | Public homepage: what Verum Omnis is, the case record, and **Get the Apps** (Android, Windows Lite, Fraud Firewall — each marked *Coming Soon* with a *Notify Me* button; the page says they will be released there when the Constitutional Court matter concludes). Links the briefing PDF; its "Documents" button opens `preview-documents.html`. | Institutions self-serve; free, subject to the commercial terms in Constitution §7. |
| **`seal-document.html`** | **The main application.** Two choices only (#200, 2026-09-07). **Seal document** (the default): SHA-512 seal and OpenTimestamps submission; the sealed PDF, the `.ots` receipt and a one-page Seal Certificate (plus a PRIVATE certificate when the sealer adds identity, ENGINE.md §12.6); no content is analysed and no document content leaves the device (the OpenTimestamps calendars receive only the digest). **Seal document with forensic report**: adds the on-device engine scan, the AI review on Cloudflare Workers AI (classify, assess, the Brain 9 sweep), voice-note transcription, the Sealed Forensic Report, the Court-Ready Narrative, the Findings JSON (version 1.8.0) and the Brain 9 recommendations (JSON, unsealed). In both modes an Anchor Certificate is offered when an OpenTimestamps calendar accepted the digest. Voice notes seal as-is, singly or from a WhatsApp chat-export `.zip` unpacked on the device (ENGINE.md §12.6a), each with its certificate and `.ots` receipt, plus a sealed Voice-Note Evidence Report. Optional password protection (`pdf-encrypt.js`). | About 1.1 MB because the five scripts are **inlined** (see ENGINE.md §9). |
| **`verify.html`** | **The Verification Hub.** Recomputes SHA-512 and finds the seal marker: VO-SEAL2, legacy VO-SEAL, the Seal Certificate and the Anchor Certificate. A sealed file's own seal always wins over a certificate subject (ENGINE.md §12.14). Checks the OpenTimestamps/Bitcoin anchor and can find a sealed original among several files ("Lost the original?"). Accepts the seal QR link `verify.html?h=<first 32 hex of the SHA-512>&m=<base64 JSON>` on load or pasted. **Every seal QR on every surface points here**; that link is a contract with the Android app and the fraud-firewall and never moves. | No account. The file never leaves the device. The page asks public OpenTimestamps calendars about the seal's OTS digest; on each verification it also submits to them the SHA-256 digest of a custody record of that verification (never the document; the password request reuses it as a read-receipt); and, unless the visitor unticks the box (ticked by default), sends an anonymous outcome record to `/api/v1/feedback/patterns`. |
| **`verify-data.html`** | **Report Verification Data**: an anonymous form to fill in after a verification — optional seal ID, a crime-type category, contradiction types, the outcome, optional notes, GPS rounded to two decimals (about 1 km), device category and a timestamp. It POSTs to `https://verum-forensic-hub.liamhigh78.workers.dev/api/report`, a **separate Worker that is not in this repository**; nothing goes to this repository's Worker. | It does not read findings JSON. |
| **`dashboard.html`** | Law Enforcement Dashboard. Reads aggregate figures from `https://verum-forensic-hub.liamhigh78.workers.dev/api/dashboard?days=N`, the same separate Worker as `verify-data.html`. When it does not answer, or answers with no reports, the page says "No live data to show"; illustrative figures appear only behind `?demo=1`, labelled on screen. | No figure on it comes from this repository. |
| **`constitution.html`** | Publishes the sealed Constitution **v8.0** verbatim, with the version chain (v6.0 ConCourt filing → v6.1 engine instrument → v8.0 charter). | Machine-readable twin: `constitution.json`. Pinned by `constitution-lock.test.mjs`. |
| **`documents-resources.html`** | Short document list: Constitution v8.0 (`/constitution-v8.pdf`), the v6.0 sealed PDF (`/constitution.pdf`, served from KV, §3), the Sealing Standard VO-DSS-1.2, and the sealing and verification pages. Linked from the top navigation of the constitution, dashboard, seal, verify and verify-data pages; the home page's "Documents" button opens `preview-documents.html` instead. | |
| **`preview-documents.html`** | The fuller documents page. **It is live:** the home page's "Documents" button opens it (`index.html:372`, `:397`) and `sitemap.xml` lists it. Its text still presents Constitution v6.0 Final as the governing document, and its section links lead to `preview-index.html`. | Wording predates v8.0; open with the founder. |
| **`preview-index.html`** | An older copy of the home page, reached only from `preview-documents.html`'s navigation. Not in `sitemap.xml`. | |

## 2. Scripts

| File | Role |
|---|---|
| **`forensic-engine-page.js`** | The deterministic engine: CT01–CT46, detectors D01–D40, 17 serial patterns (SP01–SP17), anchoring, OCR rescue. **See [`ENGINE.md`](./ENGINE.md).** `VO_ENGINE_VERSION = '5.3.5-web'` (line 29); `forensic-report.js` `ENGINE_VERSION` (line 70) carries the same value. |
| **`forensic-report.js`** | Sealed forensic report generator (`window.VerumReport.build` / `.buildHumanReport` / `.seal`; `.buildNarrative` is still exported and its source is read by tests, but nothing calls it — the seal page stopped producing that PDF on 2026-09-07, #193, and `tests/page-boot.test.mjs` pins that). Two halves: **Part 1 — the story** (executive summary, documents in this bundle, the short version, the plain-language story, unread pages, seal explainer) then **Part 2 — the evidence** (table of contents, Constitution v8.0 §15.4 sections 1–7, annexes). Auto-derives parties and jurisdiction; PD16 language throughout. **Anatomy: [`ENGINE.md`](./ENGINE.md) §7.** |
| **`seal-guard.js`** | Enforces *"the only genuine Verum output is a sealed output"* — blocks unsealed exports. |
| **`ots-proof.js`** | OpenTimestamps proof handling: submit, parse, upgrade, verify the Bitcoin anchor. |
| **`pdf-encrypt.js`** | Standard PDF password protection for sealed PDFs: RC4-128, revision 3, chosen so every reader opens it. A read-receipt gate (the recipient must ask for the password), not protection for high-value secrets. Exposed as `window.VOEncryptPDF`; verified by opening the output with pdf.js (`tests/pdf-encrypt.test.mjs`). |

All five are inlined into `seal-document.html` between `/* VO-INLINE:<file>:START */` and
`/* VO-INLINE:<file>:END */` markers. **Edit the source file, then re-splice** —
`tests/inline-scripts.test.mjs` byte-compares each copy and fails on drift; it also checks that
the seal page's own copies of the report's name and category maps (`CTNAME`, `CTCAT`, `CATLAB`,
`CATORD`) match `forensic-report.js`. `verify.html` inlines only the QR library; it loads
`/vendor/pdf.min.js` and `/ots-proof.js?v=1.5.0-20260721` with `<script src>`, and every use of
`VoOts` there is guarded so a missing module cannot break verification.

## 3. Worker (`worker/`)

`worker/verum-rules.js` is the entry point of the one Cloudflare Worker, named `webdocsol`
(`wrangler.toml`). It keeps no user documents; its only storage is `RULES_KV` (below), and it
also runs the weekly trainer (`scheduled`). Its JSON names the service `verum-rules` (the
`SERVICE` constant, kept from a retired Worker of that name, deleted on 2026-09-06). It deploys
automatically when a change merges to `main`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/status` | GET | The published rule package's version and date (`{ok, service: "verum-rules", version, published_at}`); 503 `no_rule_package` when none is published. Site health is `/api/v1/site/health`. |
| `/api/v1/site/health` | GET | Which tier serves the site right now (`assets` / `repo` / `kv` / `embedded` / `pages`) for the home page, the seal page and both site images — open it first when a page or a logo is wrong |
| `/api/v1/rules/manifest` | GET | The signed rule package: `{package, signature, algorithm: "RSASSA-PKCS1-v1_5-SHA512", publicKeyId: "vo-master-1"}`; 503 when none is published. Applied by the Android app, the fraud-firewall **and the seal page** (ENGINE.md §12.7). A contract with those repositories: the URL never moves. |
| `/api/v1/admin/publish` | POST | Publish a signed rule package (authenticated: `x-admin-token`; at most 1 MB; strict semver; 409 `version_not_newer` unless newer than the published version; 422 when the constitution check fails) |
| `/api/v1/admin/curate-publish` | POST | Run the trainer now (authenticated): aggregate anonymous signals → draft → validate → append ≤ 3 rules → sign → publish (ENGINE.md §12.9) |
| `/api/v1/rules/changelog` | GET | What the trainer published, when, from which signals; the last run and its reason; trainer settings |
| `/api/v1/feedback/patterns` | POST | Anonymous pattern metadata only — `{"patterns":[{detectorId, type, severity, pageCount}]}`, at most 200 patterns and 16 KB; any content-bearing field anywhere in the body is refused with 422 `privacy_violation`. Stored in a daily KV bucket for 90 days. Sent by the seal page in forensic mode and by `verify.html` (outcome and seal format, behind a checkbox ticked by default). |
| `/api/v1/ai/classify` | POST | Document classification (advisory) |
| `/api/v1/ai/assess` | POST | AI review of engine findings (advisory, candidate tier): a `supported` / `unsupported` verdict per finding (legacy `keep` / `drop` mapped onto them), which the seal page prints as a note and never uses to remove or change a finding (founder ruling, 5 October 2026; ENGINE.md §12.16); additional findings carry a verbatim `quote` + `page` the seal page anchors in the sealed text |
| `/api/v1/ai/narrate` | POST | Narrative from findings + a document excerpt (fast 8B model). When the model fails: a deterministic template that quotes engine findings only, labelled `model: "template-fallback"` |
| `/api/v1/ai/human-report` | POST | Court-ready narrative: one writer section per call. Every sentence is anchor- and §15.2-gated server-side, and the four-pillars gate holds every pillar claim to the elements table. Answers `machineGenerated:true`, or `generated:false` with a reason — never a template. Runs only in "Seal document with forensic report". Model: `HUMAN_REPORT_MODEL` (8B fallback), or an external OpenAI-compatible provider when the `LLM_*` secrets are set |
| `/api/v1/ai/sweep` | POST | Brain 9 (R&D) reads a window of sealed page text and returns anchored **recommendations, never findings** (Constitution v8 §2.10); every quote is verified verbatim against the text supplied, unverifiable items are discarded and counted (ENGINE.md §12.8) |
| `/api/v1/ai/gatekeep` | POST | Advisory commercial-use check (8B model; a deterministic fallback when the model fails): compares the declared tier with entity signals. The seal page sends only `{declaredTier}`, and only when the sealer picks a tier in the "I am sealing as (optional)" selector, which is shown in "Seal document with forensic report" only; it shows a banner when the answer is `high`. Blocks nothing. |
| `/api/v1/ai/curate` | POST | Conservative rules curation (authenticated: `x-admin-token`) |
| `/api/v1/ai/transcribe` | POST | Voice-note transcription (`@cf/openai/whisper`) in "Seal document with forensic report" — `machineGenerated:true` reading aid, never evidence; nothing stored |
| `/constitution.pdf`, `/docs/constitution.pdf` | GET | The sealed Constitution **v6** PDF, read from KV chunks (`pdf:constitution-v6:*`); JSON 404 when KV does not hold it. The v8.0 PDF is the static file `/constitution-v8.pdf`. |
| `/images/logo-full.png`, `/images/watermark_portrait.png` | GET, HEAD | The two site images: bundled assets → main branch → KV → embedded copy (`worker/site-assets.js`); never a 404 |
| anything else | GET, HEAD | The website, served in tiers: bundled assets → `raw.githubusercontent.com/Liamhigh/webdocsol/main` → the legacy Pages origin `verumglobal.pages.dev`; `X-VO-Site-Source` names the tier (other methods skip the first two tiers and go to the Pages origin). A repository-only path (`SITE_DENY_RE`: dot-files, `worker/`, `tests/`, `functions/`, `node_modules/`, `brand/`, `seal-module/`, `*.md`, config, the fixture PDFs) answers JSON 404 first. |
| any path | OPTIONS | 204 with CORS headers (`Access-Control-Allow-Origin: *`) |
| a listed path, wrong method | any | JSON 405 `method_not_allowed` with an `allow` value |
| any other `/api` or `/api/…` path | any | JSON 404 `not_found` — never the site |
| `scheduled` (cron `0 3 * * 1`: on Cloudflare day 1 is Sunday, so Sunday 03:00 UTC; the `wrangler.toml` comment's "Monday" is wrong) | — | The trainer run: the same pipeline as `/api/v1/admin/curate-publish` (ENGINE.md §12.9). `AUTO_CURATE = "off"` disables it; it needs `RULE_PRIVATE_KEY`, which the trainer's last run recorded as absent on 27 September 2026 (open with the founder, AGENTS.md "Open today") |

**Hard limits** (exceeding them is why AI narratives silently disappeared once — the client must
batch): `MAX_AI_BODY` 16 KB (gatekeep, classify, assess, sweep, curate) · `MAX_AI_NARRATE_BODY`
96 KB · `MAX_NARRATE_EXCERPT` 12 000 chars · `MAX_HUMAN_BODY` 160 KB · `MAX_HUMAN_EXCERPT`
24 000 chars per section · `MAX_HUMAN_FINDINGS` 40 · `MAX_HUMAN_EVIDENCE_CHARS` 800 ·
`MAX_ASSESS_FINDINGS` 40 · `MAX_NARRATE_FINDINGS` 25 · `MAX_SWEEP_PAGES` 8 ·
`MAX_SWEEP_TEXT_CHARS` 12 500 · `MAX_SWEEP_RECS` 10 · `MAX_CLASSIFY_SAMPLE` 4 000 chars ·
`MAX_CURATE_CANDIDATES` 10 · `MAX_FEEDBACK_BODY` 16 KB (200 patterns) · `MAX_PUBLISH_BODY` 1 MB ·
`MAX_TRANSCRIBE_BODY` 8 MB base64 (≈6 MB audio; the client skips larger recordings).

**Configuration (`wrangler.toml`).** Worker `webdocsol`, entry `worker/verum-rules.js`,
`compatibility_date = "2024-11-07"`, `nodejs_compat`. Routes: the zone routes
`verumglobal.foundation/*` and `www.verumglobal.foundation/*` (declared since 2026-09-27, #210,
the day the founder re-pointed them to this Worker in the dashboard);
`workers_dev = true` keeps `webdocsol.liamhigh78.workers.dev` on as a second door. `[assets]`:
directory `./`, binding `ASSETS`, `run_worker_first = ["/api/*"]` — a path that is an existing
site file is answered from the assets, `/api/*` always runs the Worker. Bindings: `RULES_KV`
(namespace `verum-rules-kv`) and `AI` (Workers AI). Vars: `ENVIRONMENT`, `SERVICE_VERSION`
(`1.5.1-20260721-mistral-enhanced`), `HUMAN_REPORT_MODEL`
(`@cf/meta/llama-4-scout-17b-16e-instruct`), `AUTO_CURATE` (`on`). Cron: `0 3 * * 1`. Secrets
live in the Cloudflare dashboard and are never committed: `ADMIN_TOKEN`, `RULE_PRIVATE_KEY`, and
optionally `LLM_API_BASE`, `LLM_API_KEY`, `LLM_MODEL`. `[env.production]` mirrors the top level;
`tests/wrangler-config.test.mjs` keeps them equal and pins the two routes. Models:
`@cf/meta/llama-3.1-8b-instruct-fp8` (gatekeep, classify, narrate, and the fallback for assess,
sweep, the trainer and human-report), `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (assess, sweep,
curate, the trainer), `HUMAN_REPORT_MODEL` (human-report), `@cf/openai/whisper` (transcribe).

**What `RULES_KV` holds:** the current signed rule package (`rules:current`) and, for each trainer
run that published, the package it replaced (`rules:history:<version>`); the trainer's changelog
(`rules:changelog`, at most 200 entries) and last run (`rules:auto-curate:last-run`); anonymous
pattern feedback in daily buckets (`feedback:<YYYY-MM-DD>`: `detectorId`, `type`, `severity`,
`pageCount` only, deleted after 90 days); the sealed Constitution v6 PDF in base64 chunks
(`pdf:constitution-v6:*`); and legacy base64 copies of the two site images (`img:logo-full:b64`,
`img:watermark-portrait:b64`). Never user documents, quotes, names or other personal data: the
feedback endpoint refuses any content-bearing field with 422 `privacy_violation`.
The Worker also carries an embedded copy of Constitution v6.1, the engine's operating instrument
(`VO_CONSTITUTION_V6`, `worker/verum-rules.js:569`), placed in the narrate and
court-ready-narrative prompts. It must state institutional engagement honestly: **no court has
adopted, endorsed, accepted, validated or recognised Verum Omnis**, its platform or its
methodology, or ruled on their merits.

Other worker files: `rule-format.md` (wire format for rule packages) · `public-key.der.b64`
(pinned RSA public key, `RSASSA-PKCS1-v1_5` with SHA-512, key id `vo-master-1`) ·
`seed-rules.json` (the seed rule package v1.0.0 — the engine's own rules; the tests read it) ·
`static-proxy.js` (the site-serving chain: `serveSite`, `serveFromAssets`, `serveFromRepo`,
`serveStatic`, `SITE_DENY_RE` mirroring `.assetsignore`, the `X-VO-Chain` loop guard) ·
`site-assets.js` (embedded fallback copies of the two site images) · `package.json`
(`{"type": "module"}`: the Worker files are ES modules). The old `verumglobal-static.js` (a second
Worker's entry point) was removed on 2026-09-06 with the Worker it served; this one Worker serves
everything.

## 4. Other directories

| Path | Contents |
|---|---|
| `vendor/` | Pinned third-party libraries: `pdf.min.js` + `pdf.worker.min.js` (pdf.js 3.11.174), `pdf-lib.min.js`, `qrcode.min.js`, Tesseract 5.1.1 (`tesseract.min.js`, `tesseract-worker.min.js`, `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`) and `eng.traineddata.gz`. **Vendored deliberately** so the pages do not depend on a CDN: every library loads from `/vendor/` first. The seal page falls back to a CDN copy of the same version (unpkg, cdnjs, jsdelivr, tessdata.projectnaptha.com) only when a vendored file fails to arrive; a library download carries nothing about the document. |
| `seal-module/` | The portable sealing specification, `SPEC.md` (VO-DSS-1.2). `android/` and `firewall/` each hold one reference `README.md`, not code. `web/` holds old snapshots of `seal-document.html` (136 KB) and `verify.html` (146 KB) plus `watermark-spec.md`; they are not the live pages, and a change made only there ships nothing. No commit since 2026-08-21 (the oldest one this shallow clone holds) has changed them. Never served (`.assetsignore`, `SITE_DENY_RE`). |
| `images/` | `logo-full.png` (page headers, the reports and certificates), `watermark_portrait.png` (the sealed-PDF watermark), `favicon.png`, and the home page's two photos `court-exterior.jpg` and `mission-hands.jpg`. The Worker can also serve the logo and the watermark from KV or embedded copies (§3). |
| `tests/` | **36 suites, 2720 assertions** (counted 2026-10-05 on the PR #218 branch; ENGINE.md §10 has the per-suite numbers) — run with `node tests/run-all.js` (or `npm test`). That file is the registry: a test file not listed in it does not run. `_assert.js` is a shared helper; `tests/README.md` is the short guide. Plain Node, no dependencies. No GitHub workflow runs them, so run them before every push. |
| `functions/` | `[[path]].js`, **the www bridge** (#207, 2026-09-24): a Cloudflare Pages Function that hands every request the legacy Pages project receives to the `webdocsol` Worker and returns its answer with `x-vo-bridge: pages-to-worker`; a request marked `X-VO-Chain` (the Worker's own last-tier fetch) is answered from the Pages project's static files instead, so the two never loop. Dormant since 2026-09-27 (#210): the zone route `www.verumglobal.foundation/*` reaches the Worker before DNS, so Pages no longer sees `www`. Kept as a fallback. Never a Worker asset. Tests: `tests/pages-bridge.test.mjs`. |
| `brand/` | App icon, banners and a logo variant; referenced by no page; never served. |
| `.github/workflows/` | `live-site-probe.yml`, the only workflow: run by hand (`workflow_dispatch`), it prints DNS answers and probes nine paths on the apex, `www` and `webdocsol.liamhigh78.workers.dev`. No workflow runs the tests. |

**Root files that are not pages or scripts:**

| File | What it is |
|---|---|
| `wrangler.toml` | The Worker's config (§3). Never served. |
| `.assetsignore` | What the static-assets upload leaves out (`.git`, `.github/`, `.gitignore`, `.assetsignore`, `worker/`, `tests/`, `functions/`, `node_modules/`, `brand/`, `seal-module/`, `*.md`, `package*.json`, `wrangler.toml`, the two fixture PDFs); `SITE_DENY_RE` mirrors it. Every other file in the repository is published on the site. |
| `package.json`, `package-lock.json` | No dependencies. `npm test` runs `tests/run-all.js`; `npm run check` runs `node --check` on the five root scripts and the three Worker files. Never served. |
| `.gitignore` | Ignores `deployment.log`. |
| `CLAUDE.md` | Pointer to `AGENTS.md` and the eight non-negotiables. Never served. |
| `constitution.json` | Machine-readable twin of `constitution.html` (v8.0). Served; pinned by `tests/constitution-lock.test.mjs`. |
| `llms.txt` | Public guidance for AI crawlers. Served. It still names Constitution v6.0 FINAL as the canonical text; open with the founder. |
| `robots.txt`, `sitemap.xml` | Crawler rules (every agent allowed; its header comment, like `llms.txt`, still names Constitution v6.0 FINAL) and the sitemap (nine URLs, including `preview-documents.html`). Served. |
| `verum-ui.css` | The portable stylesheet for the other surfaces. Served, but no page here links it. |

**Root PDFs:** `Verum-Omnis-Briefing.pdf` is the public briefing for law enforcement and
attorneys (five pages: what the sealing service does, how investigators and legal practitioners
use it, the security architecture behind it, and what a seal does not prove — `index.html:971`)
— it is linked from `index.html`, so **any edit to it is a publication**.
`constitution-v8.pdf` is the sealed charter. `forensic_test_document.pdf` is a synthetic fixture
(ReportLab-generated) that `tests/engine-perf.test.mjs` loads and `tests/detector-recall.test.mjs`
quotes. `greensky-ocr-verify.pdf` is a ReportLab-generated PDF with image pages; no suite reads
it (`tests/worker.test.mjs` only checks that the Worker refuses to serve it), and the repository
does not record what it is for. Neither is served: `.assetsignore` and the Worker's deny list both
exclude them. The confidential real-matter report `vanessa.pdf` was removed from the tree on
2026-09-06 (#189); it is still in the history of this public repository. Whether to purge the
history or make the repository private is open with the founder (AGENTS.md "Open today").

## 5. Documentation map

| Document | What it covers |
|---|---|
| **`ENGINE.md`** | **The forensic engine.** Detector inventory, false-positive guards, PD16 language rules, regression protocol, and the dated history of each run in §12 (newest last: §12.14, the Public Protector submission run, and §12.15, the Greensky re-run, both in PR #214). **Read before touching engine or report code.** |
| `ARCHITECTURE.md` | System constraints: stateless/serverless, verification-at-the-website, how the surfaces stay one engine. |
| `REFERENCE.md` | This file — repo map, pages, scripts, endpoints. |
| `VERUM_OMNIS_SYSTEM_PROMPT.md` | The AI code-assistant system prompt for the whole platform (v8.0): nine brains, triple verification, constitutional compliance, per-surface requirements, §12-UI design law. Meant to be identical here, in `Liamhigh/1verum` and in `Liamhigh/firebase`; as of 3 October 2026 this copy differs from the other two in two passages added by #189 and #199 (open with the founder, AGENTS.md "Open today"). Never edited here without mirroring the change in both. |
| `VERUM_UI_TOKENS.md` + `verum-ui.css` | Binding design system for every surface. `verum-ui.css` is the portable stylesheet for the other surfaces; no page in this repository links it. |
| `CONSTITUTION-v8.md` | The repository copy of the source text of the sealed charter v8.0 (`VO-9A4F3C5E825C`); the sealed PDF `constitution-v8.pdf` is the authoritative instrument. Never edited. |
| `DEPLOYMENT.md` | Workers Builds deployment, the static-assets bundle, the site-serving chain, `/api/v1/site/health` and the www bridge. |
| `DESIGN_LOCK.md` | Locked visual decisions on the public site. |
| `FORENSIC-DEBUG.md` | Diagnosing a failed seal, a missing report or narrative, or a wrong finding: a symptom → cause → guard table, the pipeline stages and console checks. |
| `AGENTS.md` | **Entry point for code assistants.** "Start here" is the two-minute state of the platform (what runs where, how a change ships, which repositories depend on this one, what is known-broken, what must never be done); then the stakes, the seven things most likely to be regressed, the founder rulings that must not be re-litigated, and how the Constitution's standing may be described. |
| `CLAUDE.md` | The short pointer for AI agents: read `AGENTS.md` first, which document covers which area, and the eight non-negotiables. |
| `README.md` | Project overview. |
| `tests/README.md` | How to run the suite, the `npm` aliases, and notes on which files the tests target. |
| `worker/rule-format.md` | Wire format of signed rule packages and the manifest. |
| `seal-module/SPEC.md` | The VO-DSS-1.2 sealing specification. |

## 6. Working here — the short version

```bash
node tests/run-all.js      # must be GREEN before every push
npm run check              # node --check on the shipped scripts; must be clean
```

1. **Read [`ENGINE.md`](./ENGINE.md) before changing engine or report code.** The guards in §4
   are load-bearing; each one exists because a real bundle produced a false finding.
2. **Edit source, then re-splice the inline copies** into `seal-document.html`.
3. **Never add a server, database, login backend or uploads bucket.** If a feature seems to need
   one, it is the wrong design — reach for client-side, on-device or cryptographic instead.
4. **All verification happens at `verify.html`.** No other surface verifies locally.
5. **Deterministic:** no `Date.now()`, argument-less `new Date()` or `Math.random()` in analysis
   paths; the analysis instant is passed in (`referenceTime`, recorded in the Findings JSON as
   `analysis_reference_utc`).
6. **PD16 language** in everything a reader sees: no scores, no confidence bands, no hedging,
   verdict reserved to the court.
7. **No regex lookbehind in new code** — Safari < 16.4 throws at parse time and the whole scan
   dies silently (ENGINE.md §4.16, which also lists the three older ones kept as known debt).
8. **Read the founder rulings in [`AGENTS.md`](./AGENTS.md) before redesigning anything.** The
   report order, the absence of verdicts, and the auto-derivation of parties and jurisdiction
   are settled decisions, not open questions.
9. **Merge to `main` is the deploy.** Cloudflare Workers Builds deploys the Worker and the site
   together: the repository root is the Worker's static assets (`wrangler.toml` `[assets]`,
   since #186, 2026-09-06). The legacy Pages project still builds the repository (#207) but
   carries only the dormant `www` bridge; since 2026-09-27 (#210) it no longer answers `www`, and
   `verumglobal.pages.dev` is only the Worker's last-resort tier. Confirm a deploy with the
   Workers Builds check on the merge commit and with `/api/v1/site/health`, read from outside by
   the `live-site-probe` workflow (CLAUDE.md rule 7).
10. **Never commit a secret.** `ADMIN_TOKEN`, `RULE_PRIVATE_KEY` and `LLM_*` live in the
    Cloudflare dashboard.
11. **Two contracts never move:** `/api/v1/rules/manifest` and `verify.html?h=&m=` (the Android
    app and the fraud-firewall depend on them).
12. **Never loosen a gate** (the §15.2 language gate, PD2 anchoring, the seal guard, the
    four-pillars gate, the court-language ban) to get better prose.
13. **Write standing honestly:** no court has adopted, endorsed, accepted, validated or
    recognised anything; a seal is tamper-evident, never immutable; OpenTimestamps proves
    existence no later than the confirming Bitcoin block (AGENTS.md "How the Constitution's
    standing may be described").
