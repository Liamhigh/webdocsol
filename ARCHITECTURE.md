# Verum Omnis — System Architecture

> **Orientation comes first: [`AGENTS.md`](./AGENTS.md) "Start here" (see `CLAUDE.md`).** Read
> this next if you are a code assistant (Claude, Cursor, Codex, …) or an engineer changing how
> the pieces fit together. This repo is **one surface of a larger system**. Do not treat it as a
> standalone app, and do not add infrastructure that contradicts the two hard constraints below.
>
> **Then read [`ENGINE.md`](./ENGINE.md)** before changing any engine or report code — it is the
> definitive detector reference and it records *why* each false-positive guard exists. Removing
> one re-introduces a false statement of fact under seal. Repo map: [`REFERENCE.md`](./REFERENCE.md).
>
> *State described: `main` after the Public Protector submission run (`ENGINE.md` §12.14,
> October 2026; draft pull request #214). Before this revision the file was last updated on
> 2026-08-21 (#164), before the site moved into the Worker (#186), the court-ready narrative
> (#188), rule packages on the website (#197), the Brain 9 sweep (#199), the two modes (#200)
> and the trainer run (#201).*

## The system: one engine, four surfaces

Verum Omnis is a **deterministic forensic contradiction + document-sealing engine**, delivered
across four repositories that share one engine contract:

| Repository | Surface | Role |
|---|---|---|
| **`webdocsol`** (this repo) | Website + one Cloudflare Worker (`webdocsol`) | **The hub, and the reference implementation of the engine.** Document sealing, the on-device deterministic engine and its reports, the **canonical public verification page** (`verify.html`), the signed rule-package service and an advisory AI layer (Cloudflare Workers AI). |
| **`1verum`** | Android app | On-device **hybrid** engine: deterministic 9-brain **+ Gemma-3 LLM + encrypted vault**. |
| **`cursorfu`** | Android (reference) | Hybrid forensic engine app — the working reference implementation of the Android hybrid design. |
| **`firebase`** | Guardian Fraud Firewall (Windows / on-prem; a Node.js + TypeScript service in `fraud-firewall/`) | Transaction-monitoring surface with its own TypeScript engine (`fraud-firewall/src/engine/`). It fetches and verifies this Worker's signed rule package and applies its fraud-keyword phrases and pairs and its behavioural markers as low-confidence signals (`worker/rule-format.md` "How clients apply a package"). |
| *(planned)* Windows Lite | Windows desktop | A personal edition that mirrors the Android app, not the firewall (`VERUM_OMNIS_SYSTEM_PROMPT.md` §9-Lite). Its look comes from `VERUM_UI_TOKENS.md`. |

Two of these repositories call this one directly, and their URLs are contracts that never move
(`CLAUDE.md` non-negotiable 6). `Liamhigh/1verum`: `core/Constitution.kt` hard-codes
`https://verumglobal.foundation/api/v1/rules/manifest` and pins key id `vo-master-1`, and its QR
codes open `verify.html?h=&m=`. `Liamhigh/firebase`: `fraud-firewall/src/core/ruleUpdate.ts`
uses the same URL and key id, and `fraud-firewall/src/seal/sealMetadata.ts` the same verify URL
(paths checked through the GitHub API on 3 October 2026). Never move either URL, and never change
the manifest shape (`worker/rule-format.md`) without changing both clients. No dependency of
`cursorfu` on this repository is recorded (AGENTS.md "Other repositories that depend on this
one"); whether it has one is open with the founder.

The website is the centre of gravity: **all document verification happens at the website.**

## Two hard constraints — do not violate

### 1. Stateless / serverless — there are **NO servers** and **no central database of user data**

- The forensic engine runs **client-side, in the browser** (`forensic-engine-page.js`, inlined
  into `seal-document.html`) — never on a backend.
- One Cloudflare Worker, `webdocsol` (`worker/verum-rules.js`, with `static-proxy.js` and
  `site-assets.js`), serves the website and a small API. It keeps no session and no user record.
  Its **KV** namespace (`RULES_KV`) holds platform data only: the current signed rule package
  (`rules:current`) and its predecessors (`rules:history:<version>`), the trainer's log
  (`rules:changelog`, `rules:auto-curate:last-run`), daily buckets of anonymous pattern feedback
  (`feedback:<day>`: detector id, type, severity and page count only, deleted after 90 days), the
  sealed Constitution v6 PDF (`pdf:constitution-v6:*`) and two legacy site images
  (`img:*:b64`). It never holds a document, its text, a quote, a name or any personal data; the
  feedback endpoint refuses every other field (`BANNED_FEEDBACK_FIELDS`, `validPattern`).
- **User** state is durable in exactly three places:
  1. **the sealed PDF itself**: self-describing (SHA-512 footer, verification QR, embedded metadata);
  2. **the Bitcoin blockchain**, through the OpenTimestamps anchor. Once a block confirms, it
     proves the fingerprint of the original upload existed no later than that block's time.
     Until then the public calendars hold a pending commitment and the sealer holds a pending
     receipt;
  3. **the user's own device**: the Android encrypted vault (`1verum`). On the website the
     browser keeps only the last verified rule package (public data, `localStorage`).
- **Never** add a database, a user store, a session/login backend, an uploads bucket, or anything
  that persists user documents server-side. If a feature seems to need one, it is the wrong design
  for this system — reach for a client-side / on-device / cryptographic approach instead.

### 2. All verification is done at the website

- The canonical verification page is **`verumglobal.foundation/verify.html`** (`verify.html` in
  this repo). It runs in the reader's browser, and no Verum Omnis server holds a record of any seal.
- It makes two checks. **Integrity:** for a VO-SEAL2 seal it restores the hash placeholder and
  recomputes SHA-512 over the sealed file. A match means the file has not changed since that seal
  was written. **Time:** it takes the OpenTimestamps digest of the original upload (the SHA-256 of
  its SHA-512 hex text) and asks the three public calendars, which are third-party servers, for
  the upgraded proof. It shows "confirmed" only on a parsed Bitcoin block attestation, which
  proves the fingerprint existed no later than that block's time. A check that relies on no
  calendar needs an OpenTimestamps client run against a Bitcoin node.
- **The limit, open with the founder** (`ENGINE.md` §12.14, "Open, with the founder" (a)): the
  VO-SEAL2 hash is self-referential, so an altered copy re-sealed with its own hash also matches.
  The page says so. Compare the sealed-file SHA-512 with the one the sender recorded (the anchor
  certificate prints it). The fix is architectural and touches the verify contract.
- Every sealed document's QR opens `verify.html?h=<first 32 hex of the SHA-512>&m=<metadata>`.
  `1verum` and `firebase` build the same link, so their seals are checked on the same page. No
  account is needed.

## What runs where (state after the Public Protector submission run, October 2026)

- **The visitor's browser** does everything that touches a document. `seal-document.html`
  carries five inlined scripts (engine, reports, seal guard, OpenTimestamps, PDF encryption) and
  makes the hashes, the forensic scan, the reports and the seal on the device. `verify.html`
  checks seals on the device.
- **OpenTimestamps.** The seal page posts the digest (the SHA-256 of the original upload's
  SHA-512 hex; for a voice note, the SHA-256 of its bytes) straight to three public calendars:
  `a.pool.opentimestamps.org`, `b.pool.opentimestamps.org` and `a.pool.eternitywall.com`. The
  Worker is not in that path. `verify.html` later asks the same calendars for the
  Bitcoin-upgraded proof.
- **The Worker `webdocsol`** (`wrangler.toml`: `main = "worker/verum-rules.js"`) serves the
  website from Workers Static Assets. If an asset is missing, it falls back to the `main` branch
  on `raw.githubusercontent.com` and then to the legacy Pages origin (`worker/static-proxy.js`);
  an answer the Worker's own code serves names its tier in `X-VO-Site-Source`, and
  `GET /api/v1/site/health` reports which tier answers. It also answers `/api/v1/*` (15 paths):
  status, site health, the signed rule manifest and the trainer's changelog, anonymous pattern
  feedback, admin publish and curate-publish, and the AI endpoints (classify, assess, narrate,
  human-report, sweep, transcribe, gatekeep, curate). The full list is in `REFERENCE.md` §3.
  Bindings: `RULES_KV`, `AI`, `ASSETS`. Secrets are set only in the dashboard: `ADMIN_TOKEN`,
  `RULE_PRIVATE_KEY`, and optionally `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL`. A weekly cron
  (`[triggers] crons = ["0 3 * * 1"]`) runs the trainer. On Cloudflare 1 is Sunday: the run of
  Sunday 27 September 2026 started 03:01 UTC (AGENTS.md); comments and docs that say Monday are
  wrong.
- **Hosts.** `wrangler.toml` declares the zone routes `verumglobal.foundation/*` and
  `www.verumglobal.foundation/*`, and keeps `webdocsol.liamhigh78.workers.dev` on
  (`workers_dev = true`). The last record that both hostnames reach this Worker is from
  27 September 2026 (#210, and the outside probe that day). The AI sandbox cannot see the live
  site; run the `live-site-probe` workflow.
- **Shipping.** Merge to `main` is the deploy (Cloudflare Workers Builds). See `DEPLOYMENT.md`.
- **Outside this repository.** `dashboard.html` reads `verum-forensic-hub.liamhigh78.workers.dev`,
  a separate Worker whose code is not here.

## How the surfaces stay one engine

- **Shared contract, and where it lives.** (1) **The signed rule package.** Its format and
  endpoints are in `worker/rule-format.md`. It is signed with RSASSA-PKCS1-v1_5 / SHA-512 over
  canonical JSON, under key id `vo-master-1` (public key `worker/public-key.der.b64`), and served
  at `GET /api/v1/rules/manifest`. It carries the engine's exported vocabulary: the seed
  (`worker/seed-rules.json`, v1.0.0) has 43 contradiction patterns (CT01–CT43) with detectors
  D01–D37, 12 fraud-keyword groups (FK01–FK12), 10 behavioural markers and 17 serial patterns,
  and v1.1.0 adds two curated co-occurrence groups (FK13, FK14). The package lags the web engine,
  which defines CT01–CT46 and D01–D40, and is never merged over the engine's taxonomy.
  (2) **The findings JSON.** `FINDINGS_JSON_SCHEMA.json` is kept in `1verum` and `firebase` at
  v1.0.0 (`findings_json_version` fixed at "1.0.0"); this repository has no copy. The website
  builds its file in `seal-document.html` (`buildFindingsJson`) and is at v1.6.0, extended
  additively: `review_status` (1.3.0), `secondary_capped` and `ocr_anchored` (1.4.0), `ocr_held`
  (1.5.0), `analysis_reference_utc` (1.6.0). A validator that enforces the schema's version
  constant would refuse the website's file. That drift is open with the founder.
- **This engine is authoritative.** Where another surface's engine disagrees with this one, this
  one is correct and the other is the one to fix. The guards in [`ENGINE.md`](./ENGINE.md) §4 were
  each earned on a real evidence bundle; a surface without them will report false findings.
- **Engine-improvement distribution.** A rule learned after release ships as a signed rule
  package served by this repo's Worker. Three clients verify its signature (`SHA512withRSA`)
  against the pinned key and apply it additively; built-in detectors are never replaced or
  loosened. The **website** (since 2026-09-07, #197 and #198): the seal page's
  `voLoadRulePackage` → `voCompileRulePackage` → `voRunPackageRules` applies pairs and
  co-occurrence groups, except the seed's own twelve groups, at severity ≤ 3 and weight 0.5
  (`ENGINE.md` §12.7). **Android** (`1verum`, `update/RuleUpdateClient.kt`, `RuleProvider.kt`)
  applies pairs only; a `groups` rule is counted, not run. **The firewall** (`firebase`,
  `src/core/ruleUpdate.ts`, `pipeline/rules.ts`) applies phrases, pairs and behavioural markers
  as low-confidence signals on transaction text. So one package gives different results on
  different clients, by design (`worker/rule-format.md` "How clients apply a package"). A change
  to the built-in engine itself (for example the Public Protector submission run, `ENGINE.md`
  §12.14) ships only by merge to `main`, and reaches the other surfaces only when ported. The
  Worker never sees a case file: a rule comes from a human publish or from the trainer's
  anonymous signals.
- **Who writes a rule.** There are two ways, and both sign with the master key on the Worker
  (`RULE_PRIVATE_KEY`, a dashboard secret). (1) An **admin publish** (`POST /api/v1/admin/publish`,
  `ADMIN_TOKEN`). `POST /api/v1/ai/curate` drafts candidates for that human, as drafts only.
  (2) Since 2026-09-07 (#201, founder direction AGENTS.md item 13), **the trainer run**: the
  Worker itself, weekly (`wrangler.toml [triggers]`) or on `POST /api/v1/admin/curate-publish`.
  The trainer turns recurring anonymous `AI_IDENTIFIED` / `B9_RECOMMENDATION` signals (support
  ≥ 3 over ≥ 2 days) into co-occurrence groups and validates them deterministically
  (`validateAutoRule`). It appends at most three to the current package, leaving existing rules
  byte-untouched, then signs and publishes with no human step, and logs every run at
  `GET /api/v1/rules/changelog` (`ENGINE.md` §12.9). It can never write detector code, change or
  remove an existing rule, or learn from document content, because it sees only the four
  anonymous feedback fields. Its rules apply at candidate tier. `AUTO_CURATE = "off"` stops it,
  and a higher admin-published version supersedes it. Whether `RULE_PRIVATE_KEY` is set on the
  Worker is dashboard state: last recorded missing on 27 September 2026 (the trainer's run that
  day was "skipped — no signing key on this service"; AGENTS.md "Open today"), so the package
  stayed at v1.1.0. Open with the founder.

## Privacy posture

- **Two modes, no switches** (AGENTS.md founder direction item 12, #200). **"Seal document"**
  analyses nothing. The document, its text and any identity stay on the device; only the
  OpenTimestamps digest goes to the public calendars. This is the mode for privileged or
  sensitive matters.
- **"Seal document with forensic report"** runs the engine on the device. Choosing it also runs
  the AI steps on the Worker (Cloudflare Workers AI). The document file itself is never
  uploaded, but for those steps the page sends: up to 4,000 characters for classification;
  finding metadata and short quotes for the review; an excerpt of up to 12,000 characters for
  the report narrative, and up to 24,000 per court-ready-narrative section; the sealed page text
  in up to 16 windows of about 11,000 characters for the Brain 9 sweep; voice-note audio (up to
  6 MB each) for transcription; the optional case details the user typed; the declared sealing
  tier; and the four anonymous feedback fields (detector id, type, severity, page count). GPS,
  device and sealer identity are never sent. Of all this, only the anonymous feedback is stored.
- If the operator sets `LLM_API_BASE`, `LLM_API_KEY` and `LLM_MODEL`, the court-ready
  narrative's excerpts go to that provider instead of Workers AI.
- Any new egress belongs to the forensic mode only and must be named on its mode card.
  "Seal document" stays local. (An earlier revision of this file named a "judicial retrieval"
  step; no such feature exists in the code.)

## Working in this repo (webdocsol)

- The five forensic scripts are **inlined** into `seal-document.html` between
  `/* VO-INLINE:<file>:START/END */` markers and **byte-guarded** by
  `tests/inline-scripts.test.mjs`: `forensic-engine-page.js` (engine), `forensic-report.js`
  (reports), `seal-guard.js`, `ots-proof.js` and `pdf-encrypt.js`. **Workflow:** edit the source
  file, then re-splice the inline block (`ENGINE.md` §9). **Do not** "de-duplicate" the inline
  copy into a shared runtime module. Root-level `.js` requests once came back as the home page
  HTML (the old Pages origin answered missing files with its home page), and a dropped script
  means a scan that silently never runs. The site now ships as Workers Static Assets (#186), and
  the rule still stands.
- Contradiction types are **CT01–CT46**, detectors **D01–D40** (`forensic-report.js`:
  `CT_COUNT = 46`, `DETECTOR_COUNT = 40`). A new type changes these together:
  `CONTRADICTION_TYPES` in `forensic-engine-page.js` (the source of truth); `CT_NAMES`,
  `CT_CATEGORY`, `NARRATIVE_MEANING`, `CT_DETECTOR` and `LEGAL_SUBJECT_OF` in
  `forensic-report.js`; the seal page's hand-kept copies `CTNAME` / `CTCAT` in
  `seal-document.html` (and, for a new category, `CATEGORY_LABEL` / `CATEGORY_ORDER` with their
  page copies `CATLAB` / `CATORD`), which `tests/inline-scripts.test.mjs` compares; and
  `worker/rule-format.md`. Bump `CT_COUNT`, and `DETECTOR_COUNT` for a new detector. Codes are
  permanent: `tests/constitution-lock.test.mjs` fails a renumbering.
- Run `node tests/run-all.js` (every suite green) and `npm run check` (clean) before any push.
  Nothing runs them for you: the only GitHub workflow is the hand-run `live-site-probe`, and
  merge to `main` is the deploy. The engine is deterministic, so there is no
  `Date.now()`/`Math.random()` in analysis paths (Prime Directive 4). The analysis instant is
  passed in as `opts.referenceTime` and never read from the clock.
- **Report language is constitutional** (Prime Directive 16): findings stated as fact and anchored;
  **no scores out of 100, no confidence bands, no hedging**, and the verdict on any named person is
  reserved to the court. `node tests/run-all.js` fails if a score or a band returns (for example
  `tests/legal-analysis.test.js`, `tests/annexure-eb-regression.test.mjs`). Full rules:
  [`ENGINE.md`](./ENGINE.md) §6.
- **Never hardcode a party, name, account number or case fact into a detector.** Detectors measure
  structure; an engine that names a party fabricates evidence instead of measuring it.
- **The report derives its own facts.** The names on a finding's pages come from `anchor.who`.
  A finding is said to *concern* a party only when that party is declared in the optional Case
  details (the Parties field, forensic mode only) **and** the finding's own words name it
  (`declaredPartyFor`, `partyStronglyNamed`; a person is matched by the whole name or by initial
  and surname). Otherwise the names are stated descriptively, never as an attribution
  (`ENGINE.md` §12.14). The home jurisdiction comes from the sealing GPS fix via deterministic
  bounding boxes (ZA / AE / GB / US, ZA when there is no fix; no geocoding service). The cross-border legs come from the
  record and from the optional Jurisdiction field. Case details are optional and must stay
  optional: do not make them required, and do not add a field to "fix" a report that names no
  party. `ENGINE.md` §7, AGENTS.md rulings 6–7.
- **The report has a fixed two-part order** — the human story first, the table of contents and the
  Constitution v8.0 §15.4 sections after it. This is a founder ruling, not a layout preference.
  `ENGINE.md` §7, AGENTS.md ruling 5. In "Seal document with forensic report" the page seals two
  reports beside the document: the technical forensic report and the court-ready narrative
  (`ENGINE.md` §13). It also gives the findings JSON and an unsealed Brain 9 recommendations
  file, which is never part of a sealed report. "Seal document" gives the sealed PDF and a
  one-page Seal Certificate. In both modes an anchor certificate is added when a calendar
  accepted the digest.
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time, which kills the whole
  script — the user sees a scan that silently never starts. `ENGINE.md` §4.16.
- **`seal-document.html` carries its own hard-won behaviours** — OCR deadlines, seal geometry that
  extends pages rather than overlaying them, and a share path that always saves the bundle. Read
  `ENGINE.md` §12 before editing the OCR, sealing or share code.
- **Not the live site:** `seal-module/` is the portable sealing spec (`SPEC.md`) with per-surface
  references (`web`, `android`, `firewall`). Its copies of `seal-document.html` and `verify.html`
  (last changed 2026-08-21) are not served, so a change made only there ships nothing
  (`DEPLOYMENT.md`). Edit the root files.

## Deterministic engine, with a hybrid future

The deterministic engine is precise but has a real ceiling on **scanned / OCR'd** documents (party
names, fuzzy clause matching). That ceiling is **by design** the boundary where the **hybrid
Gemma-3 layer** (in `1verum`) takes over — the LLM reads difficult documents and raises candidate
contradictions the regex engine misses, always labelled as candidates pending verification. When in
doubt on the web engine, prefer **precision over recall** and let the hybrid layer handle recall.

The website has its own AI layer, and it is advisory. In "Seal document with forensic report"
the Worker's Workers AI endpoints do the following. They classify an excerpt. They review the
engine's findings. They run the Brain 9 sweep of the sealed page text, whose recommendations are
verified verbatim twice and are never findings (`ENGINE.md` §12.8). They write the technical
report's narrative and, one section at a time, the court-ready narrative (`HUMAN_REPORT_MODEL`,
default Llama 4 Scout; `ENGINE.md` §13). They transcribe voice notes (Whisper). Every AI sentence
passes the §15.2 language gate and the anchor gate, and none adds a sealed finding. When no AI
section passes, the narrative's cover and certification say it is the deterministic record. The
on-device hybrid models belong to `1verum`, not to this repository.

An AI-raised item is **candidate tier and never a verified finding**: it is excluded from the
verified count, the fact box, the severity table and the plain-language lead, and disclosed on its
own advisory line. Mixing the two inflates the count and misdescribes the record. (Whether the
reports should call an engine finding "verified" when only the single-model advisory review has
retained it is open with the founder: `ENGINE.md` §12.14, "Open, with the founder" (b). Do not
widen the word's use.)
