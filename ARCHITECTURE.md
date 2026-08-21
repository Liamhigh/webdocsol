# Verum Omnis — System Architecture

> **Read this first if you are a code assistant (Claude, Cursor, Codex, …) or an engineer
> working in this repository.** This repo is **one surface of a larger system**. Do not treat
> it as a standalone app, and do not add infrastructure that contradicts the two hard
> constraints below.
>
> **Then read [`ENGINE.md`](./ENGINE.md)** before changing any engine or report code — it is the
> definitive detector reference and it records *why* each false-positive guard exists. Removing
> one re-introduces a false statement of fact under seal. Repo map: [`REFERENCE.md`](./REFERENCE.md).

## The system: one engine, four surfaces

Verum Omnis is a **deterministic forensic contradiction + document-sealing engine**, delivered
across four repositories that share one engine contract:

| Repository | Surface | Role |
|---|---|---|
| **`webdocsol`** (this repo) | Website + Cloudflare Worker | **The hub, and the reference implementation of the engine.** Document sealing and the **canonical public verification endpoint**. |
| **`1verum`** | Android app | On-device **hybrid** engine: deterministic 9-brain **+ Gemma-3 LLM + encrypted vault**. |
| **`cursorfu`** | Android (reference) | Hybrid forensic engine app — the working reference implementation of the Android hybrid design. |
| **`firebase`** | Guardian Fraud Firewall (Windows / on-prem) | Pipeline surface running the same engine + findings contract. Windows Lite is planned from this repo's design system. |

The website is the centre of gravity: **all document verification happens at the website.**

## Two hard constraints — do not violate

### 1. Stateless / serverless — there are **NO servers** and **no central database of user data**

- The forensic engine runs **client-side, in the browser** (`forensic-engine-page.js`, inlined
  into `seal-document.html`) — never on a backend.
- Cloudflare **Workers** (`worker/`) are **stateless edge functions**. Their **KV** store holds
  only **public, signed rule packages** — *never* user documents, findings, or personal data.
- Durable state lives in exactly three places:
  1. **the sealed PDF itself** — self-describing (SHA-512 footer, verification QR, embedded metadata);
  2. **the Bitcoin blockchain** — the OpenTimestamps anchor;
  3. **the user's own device** — the Android encrypted vault.
- **Never** add a database, a user store, a session/login backend, an uploads bucket, or anything
  that persists user documents server-side. If a feature seems to need one, it is the wrong design
  for this system — reach for a client-side / on-device / cryptographic approach instead.

### 2. All verification is done at the website

- The canonical verification surface is **`verumglobal.foundation/verify.html`** (`verify.html`
  in this repo). A seal is proven by **recomputing SHA-512** and **checking the OpenTimestamps /
  Bitcoin anchor** — *not* by a server lookup.
- Every sealed document's QR points there. Seals produced by **Android** and the **firewall**
  verify against the **same** website endpoint and the **same** public blockchain. Verification is
  cryptographic and independent — anyone can do it, no account required.

## How the three surfaces stay one engine

- **Shared contract:** the Findings JSON schema (`FINDINGS_JSON_SCHEMA.json`, mirrored across repos)
  and the signed **rule packages** (`worker/rule-format.md`) — contradiction types **CT01–CT46**,
  their detectors (**D01–D40**), and fraud-keyword pairs.
- **This engine is authoritative.** Where another surface's engine disagrees with this one, this
  one is correct and the other is the one to fix. The guards in [`ENGINE.md`](./ENGINE.md) §4 were
  each earned on a real evidence bundle; a surface without them will report false findings.
- **Engine-improvement distribution ("self-updating engine"):** when a new contradiction pattern
  is learned (e.g. from a case file), it ships as a **signed rule package** served by this repo's
  Worker. Android (`update/RuleUpdateClient.kt`) and the firewall **download and RSA-verify** it and
  additively extend their own detectors. Built-in detectors are never replaced, only extended.
- **Curation is mandatory.** Rule packages are **RSA-signed** (`SHA512withRSA` against a pinned
  key). New detectors must be **human-reviewed and signed** before distribution — they are **never
  auto-ingested from arbitrary user uploads.** A bad detector becomes a false fraud indicator in
  everyone's engine, so an AI worker may *suggest* candidate patterns, but a human signs them.

## Privacy posture

- Documents are analysed **client-side (web) / on-device (Android)**. The document itself is
  **never uploaded**.
- Optional edge steps (Cloudflare Workers AI review; judicial retrieval) send only **anonymised
  finding metadata** (type, severity, short quote) or extracted **entities/keywords** — never the
  document. If you add any egress, it must be **opt-in and metadata-only**.

## Working in this repo (webdocsol)

- Engine logic: `forensic-engine-page.js`. Report generation: `forensic-report.js`. Both are
  **inlined** into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers and are
  **byte-guarded** by `tests/inline-scripts.test.mjs`. **Workflow:** edit the source file, then
  re-sync the inline block. **Do not** "de-duplicate" the inline copy into a shared runtime module —
  root-level `.js` fetches are unreliable on this deployment, which is the entire reason the scripts
  are inlined.
- Contradiction types are **CT01–CT46**, detectors **D01–D40**. When adding one, keep `CT_NAMES`,
  `CT_CATEGORY`, `NARRATIVE_MEANING`, `CT_DETECTOR`, `LEGAL_SUBJECT_OF` (in `forensic-report.js`)
  and `worker/rule-format.md` in sync, and bump `CT_COUNT`.
- Run `node tests/run-all.js` before pushing. Deterministic engine → no `Date.now()`/`Math.random()`
  in analysis paths (Prime Directive 4).
- **Report language is constitutional** (Prime Directive 16): findings stated as fact and anchored;
  **no scores out of 100, no confidence bands, no hedging**, and the verdict on any named person is
  reserved to the court. Tests fail the build if a score or a band returns. Full rules:
  [`ENGINE.md`](./ENGINE.md) §6.
- **Never hardcode a party, name, account number or case fact into a detector.** Detectors measure
  structure; an engine that names a party fabricates evidence instead of measuring it.
- **The report derives its own facts.** Parties come from `anchor.who` on the findings; the home
  jurisdiction comes from the sealing GPS fix via deterministic bounding boxes (no geocoding
  service). The user is never asked to name a party or a jurisdiction — adding a form field for
  either is the wrong fix. `ENGINE.md` §7, AGENTS.md rulings 6–7.
- **The report has a fixed two-part order** — the human story first, the table of contents and the
  Constitution v8.0 §15.4 sections after it. This is a founder ruling, not a layout preference.
  `ENGINE.md` §7, AGENTS.md ruling 5.
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time, which kills the whole
  script — the user sees a scan that silently never starts. `ENGINE.md` §4.16.
- **`seal-document.html` carries its own hard-won behaviours** — OCR deadlines, seal geometry that
  extends pages rather than overlaying them, and a share path that always saves the bundle. Read
  `ENGINE.md` §12 before editing the OCR, sealing or share code.

## Deterministic engine, with a hybrid future

The deterministic engine is precise but has a real ceiling on **scanned / OCR'd** documents (party
names, fuzzy clause matching). That ceiling is **by design** the boundary where the **hybrid
Gemma-3 layer** (in `1verum`) takes over — the LLM reads difficult documents and raises candidate
contradictions the regex engine misses, always labelled as candidates pending verification. When in
doubt on the web engine, prefer **precision over recall** and let the hybrid layer handle recall.

An AI-raised item is **candidate tier and never a verified finding**: it is excluded from the
verified count, the fact box, the severity table and the plain-language lead, and disclosed on its
own advisory line. Mixing the two inflates the count and misdescribes the record.
