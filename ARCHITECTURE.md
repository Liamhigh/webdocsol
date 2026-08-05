# Verum Omnis — System Architecture

> **Read this first if you are a code assistant (Claude, Cursor, Codex, …) or an engineer
> working in this repository.** This repo is **one surface of a larger system**. Do not treat
> it as a standalone app, and do not add infrastructure that contradicts the two hard
> constraints below.

## The system: one engine, three surfaces

Verum Omnis is a **deterministic forensic contradiction + document-sealing engine**, delivered
across three repositories that share one engine contract:

| Repository | Surface | Role |
|---|---|---|
| **`webdocsol`** (this repo) | Website + Cloudflare Worker | **The hub.** Document sealing and the **canonical public verification endpoint**. |
| **`1verum`** | Android app | On-device **hybrid** engine: deterministic 9-brain **+ Gemma-3 LLM + encrypted vault**. |
| **`firebase`** | Guardian Fraud Firewall | Pipeline surface running the same engine + findings contract. |

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
  their detectors (D01–D39), and fraud-keyword pairs.
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
- Contradiction types are **CT01–CT46**. When adding one, keep `CT_NAMES`, `CT_CATEGORY`,
  `NARRATIVE_MEANING` (in `forensic-report.js`) and `worker/rule-format.md` in sync.
- Run `node tests/run-all.js` before pushing. Deterministic engine → no `Date.now()`/`Math.random()`
  in analysis paths (Prime Directive 4).

## Deterministic engine, with a hybrid future

The deterministic engine is precise but has a real ceiling on **scanned / OCR'd** documents (party
names, fuzzy clause matching). That ceiling is **by design** the boundary where the **hybrid
Gemma-3 layer** (in `1verum`) takes over — the LLM reads difficult documents and raises candidate
contradictions the regex engine misses, always labelled as candidates pending verification. When in
doubt on the web engine, prefer **precision over recall** and let the hybrid layer handle recall.
