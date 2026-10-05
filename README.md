# WebDocSol -- Verum Omnis Document Sealing & Verification Standard

> **AI agents and engineers: read [`AGENTS.md`](./AGENTS.md) "Start here" first** ([`CLAUDE.md`](./CLAUDE.md)
> points there), then [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system context. This repo is the
> **website hub** of the Verum Omnis system — one of four surfaces (**website + Android `1verum`
> + Android reference `cursorfu` + Guardian firewall `firebase`**) that share one forensic engine,
> of which **this repo holds the reference implementation**. Two hard rules: the system is
> **stateless / serverless — no servers, no central user-data database** (durable state lives in
> the sealed PDF, the Bitcoin anchor and the user's device; the one stateless Cloudflare Worker,
> `webdocsol`, serves the site and `/api/v1/*`; its KV namespace `RULES_KV` holds platform data
> only — the signed rule package and its predecessors, the trainer's changelog and last run,
> anonymous pattern feedback (detector id, type, severity, page count; deleted after 90 days),
> the sealed Constitution v6 PDF and two legacy site images — never a document, its text or
> personal data; in "Seal document with forensic report" finding metadata, excerpts, the sealed
> page text and voice-note audio go to the Worker's AI endpoints for the review, which run on
> Cloudflare Workers AI, and are not stored), and
> **all verification happens at the website** (`verify.html`, via SHA-512 +
> OpenTimestamps/Bitcoin — not a server lookup).
>
> **Working on the engine or the report? Read [`ENGINE.md`](./ENGINE.md) first** — the detector
> reference and the false-positive guards, each recorded with the real evidence bundle that
> produced it. **Looking for a file, page, function or endpoint?** [`REFERENCE.md`](./REFERENCE.md).
>
> **Shipping, routing or the serving chain?** [`DEPLOYMENT.md`](./DEPLOYMENT.md). **A failed seal or a
> missing narrative?** [`FORENSIC-DEBUG.md`](./FORENSIC-DEBUG.md).

**Repository:** `Liamhigh/webdocsol`  
**Sealing standard:** VO-DSS-1.2 ([`seal-module/SPEC.md`](./seal-module/SPEC.md)); QR payload `v: "1.2"`; sealed PDFs carry a `VO-SEAL2|…` Subject (Producer `Verum Omnis Document Sealing Service v1.3.0`); site package version 1.2.5 (`package.json`)  
**Engine:** `VO_ENGINE_VERSION 5.3.5-web` (report `ENGINE_VERSION` the same) — CT01–CT46, detectors D01–D40; findings JSON 1.8.0  
**Constitution:** v8.0 (governance charter, seal `VO-9A4F3C5E825C`); v6.1 (engine operating instrument, seal `VO-9E51D3F507E6`)  
**Updated:** 2026-10-03 — describes `main` once the Public Protector submission run and the Greensky re-run (`ENGINE.md` §12.14–§12.15) are merged as one pull request (expected #214; until then `main` is at #213). Constitution v8.0 was sealed on 2026-08-05.  
**Integrity model:** tamper-evident (SHA-512 + OpenTimestamps) — never "immutable". **Licence:** none in the repository (open with the founder).  

> ## DESIGN LOCK IN EFFECT
> 
> The current visual design of `verumglobal.foundation` is **LOCKED** as of 2026-07-16.
> See [`DESIGN_LOCK.md`](DESIGN_LOCK.md) for the full specification. Its canonical reference is
> the repository-root `seal-document.html` (its inline `<style>` block); the binding tokens are
> [`VERUM_UI_TOKENS.md`](VERUM_UI_TOKENS.md) and [`verum-ui.css`](verum-ui.css). No reference
> screenshot is in the repository: `design-reference/screenshot-v1.2.5.png`, which older text
> named, has never been in the available history (checked 2026-10-03).
>
> **This design may be enhanced but must NEVER regress.** Any PR touching CSS,
> HTML structure, or visual elements must include a side-by-side comparison with
> the live seal page proving no regression has occurred.

**What the site does today:**
- **Two choices only** (since #200, 2026-09-07). **Seal document** (the default) seals integrity and time: SHA-512 fingerprint, OpenTimestamps submission, the sealed PDF, the shareable Seal Certificate, the PRIVATE certificate (see below) and, when a calendar accepted the digest, the anchor certificate; the engine does not run and no document content leaves the device. **Seal document with forensic report** also runs the deterministic engine on the device and the AI review on Cloudflare Workers AI, and seals a technical report, a court-ready narrative and findings JSON beside the original, plus the anchor certificate; it does not produce the Seal Certificate (see Architecture Overview and Forensic analysis below).
- **Voice notes and WhatsApp chat exports** -- a voice note seals exactly as it is (the original bytes, never altered); a whole chat export (`.zip`, Export chat → Include media) is unpacked on the device and its recordings, images and chat text seal together, with a Voice-Note Evidence Report tying each note to its sender and time in WhatsApp's own words (voice notes since 2026-08-22, #178, then up to ten per batch; the chat-export `.zip` and up to 25 per batch since 2026-09-06, #190). Transcription runs only in "Seal document with forensic report", after every recording is sealed.
- **Seal Chain of Custody** -- detects previous seals when re-sealing merged documents (see below)

---

## Purpose

This repository holds the website and the sealing standard that all four surfaces follow:

| Platform | Where | Status |
|----------|-------|--------|
| **Website** (`verumglobal.foundation`) | this repository, **root** — `seal-document.html`, `verify.html`, `index.html` … | Live — both hostnames served by the `webdocsol` Worker (zone routes in `wrangler.toml`); last confirmed from outside 2026-09-27 (#210). Re-check with the `live-site-probe` workflow. |
| **Android App** | `Liamhigh/1verum` (reference notes: `seal-module/android/`) | separate repository |
| **Android reference** | `cursorfu` | separate repository |
| **Guardian Fraud Firewall** | `Liamhigh/firebase`, a Node.js + TypeScript service (reference notes: `seal-module/firewall/`, partly an earlier Python design) | separate repository |

> **⚠ `seal-module/web/` is NOT the live site.** It holds older snapshots of
> `seal-document.html` and `verify.html` kept alongside the portable sealing spec. The pages
> the Worker actually serves are the ones at the **repository root**, and they have moved
> a long way past those snapshots (the live `seal-document.html` is about 1.1 MB — 1,138,885
> bytes at 179e45c, 3 October 2026 — because the five forensic scripts are inlined into it; the
> snapshot is ~136 KB). **Edit the root files.**
> A change made only in `seal-module/web/` ships nothing.

All implementations must produce **interoperable** sealed documents: a document sealed on any surface is verified at the Verification Hub (`verify.html`). The Android app and the firewall write the same QR URL (`verify.html?h=&m=`; their source paths, checked through the GitHub API on 3 October 2026, are in `AGENTS.md` "Other repositories that depend on this one"). The hard rule (`ARCHITECTURE.md`) is that all document verification happens at the website.

---

## Architecture Overview

```
User chooses a PDF (or voice notes / a WhatsApp chat export .zip)
       |
       v
[Read] file bytes; GPS (if the browser allows) + device facts; optional identity
       |
       +--> "Seal document with forensic report" only: pre-flight of the
       |    forensic service (refuses, nothing sealed, if absent), then the
       |    deterministic engine on this device (CT01-CT46, D01-D40, signed rule package),
       |    with the AI classification running beside it
       v
[Hash] SHA-512 of the file (Verum fingerprint); seal ID = VO- + first 12 hex
       OTS digest = SHA-256 of the SHA-512 hex string (a voice note: SHA-256 of its bytes)
       |
       +--> previous-seal detection (Subject VO-SEAL2|... / VO-SEAL|... -> CHAIN)
       +--> commercial keyword check (payment gate, see below)
       v
[OTS]  submit the digest to OpenTimestamps calendars (pending until a Bitcoin block confirms)
       |
       v
[PDF]  QR -> verify.html?h=<first 32 hex of SHA-512>&m=<base64 JSON>
       each page extended: navy header band (QR top right, verify hint) and footer band
       (VERUM OMNIS SEALED ORIGINAL | Seal | SHA-512 prefix | device time | n/total | Chain)
       watermark over the page at 20% opacity; original content keeps its coordinates
       Pristine Seal Doctrine: no verdict, fraud or analysis overlays on the original
       optional password: cover page + standard PDF encryption
       |
       +--> forensic mode only: AI review through the Worker (assess, Brain 9 sweep,
       |    court-ready narrative), then the sealed technical report, the sealed
       |    court-ready narrative and findings JSON 1.8.0
       v
[Out]  both modes: sealed PDF, .ots receipt, anchor certificate (if a calendar accepted)
       Seal document only: Seal Certificate (+ PRIVATE certificate)
```

The shareable Seal Certificate (`-seal-certificate.pdf`) carries no identity. The PRIVATE
certificate (`-seal-certificate-PRIVATE-do-not-share.pdf`) is produced whenever identity, GPS or
device facts were captured; `captureDevice` always records the platform, cores and time zone, so
in practice every PDF sealed in "Seal document" gets one. Both are built in "Seal document" only. The anchor certificate
(`-anchor-certificate.pdf`) is built in both modes whenever a calendar accepted the digest. The
AI layers run on Cloudflare Workers AI; the court-ready narrative can instead use an external
OpenAI-compatible provider if the optional `LLM_*` secrets are set on the Worker (dashboard
state, not visible in this repository).

---

## QR Code Format (Standard)

The QR code encodes a verification URL with embedded metadata:

```
https://verumglobal.foundation/verify.html?h=<SHA512_PREFIX_32>&m=<BASE64_METADATA>
```

`h` is the first 32 hex characters of the SHA-512 of the file as uploaded; `m` is the URL-encoded
base64 of the UTF-8 JSON payload below. **This URL and `/api/v1/rules/manifest` are contracts with
the Android app (`Liamhigh/1verum`) and the fraud firewall (`Liamhigh/firebase`); they never move**
(CLAUDE.md rule 6).

### Metadata Schema (JSON, base64-encoded)

```json
{
  "v": "1.2",
  "t": 1720934400000,
  "type": "private",
  "sha512": "128-char SHA-512 of the file as uploaded",
  "otsDigest": "64-char SHA-256 of that SHA-512 hex",
  "otsStatus": true,
  "sealId": "VO-XXXXXXXXXXXX",
  "chain": ["VO-PREVIOUS1"]
}
```

This is the public payload (`buildQrPayload`), unchanged since the available history begins
(2026-08-21): anyone holding the sealed document can read it. Only with the opt-in `Include
identity + GPS in the public QR code` (default off) are `id` {n, id, a, e}, `gps`, `acc` and
`dev` added. Otherwise they appear only on the PRIVATE Seal Certificate (since #171, 2026-08-22,
which took them off the shareable certificate). `lock`, `org` and the old `fraud*` fields are never in the QR. Parsers must tolerate
missing and unknown keys.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v` | string | Yes | Seal format version |
| `t` | number | Yes | Seal time from the device clock, Unix ms — what the device said, not a proof; once a Bitcoin block confirms the OpenTimestamps submission, that block proves the file existed no later than its time |
| `type` | string | Yes | `private` or `commercial` |
| `sha512` | string | When available | SHA-512 of the file as uploaded (128 hex) |
| `otsDigest` | string | When available | SHA-256 of the `sha512` hex string — the digest submitted to OpenTimestamps (a voice note's is the SHA-256 of its bytes) |
| `otsStatus` | boolean | When available | Whether an OpenTimestamps calendar accepted the digest |
| `sealId` | string | When available | `VO-` + first 12 hex of `sha512`, upper case |
| `chain` | string[] | No | Previous seal IDs, when the input was already sealed |
| `id.n` | string | No — opt-in only (default off) | Sender full name |
| `id.id` | string | No — opt-in only (default off) | ID/Passport number |
| `id.a` | string | No — opt-in only (default off) | Physical address |
| `id.e` | string | No — opt-in only (default off) | Contact email |
| `gps` | string | No — opt-in only (default off) | Lat,Lng coordinates |
| `acc` | number | No — opt-in only (default off) | GPS accuracy in metres |
| `dev` | string | No — opt-in only (default off) | Platform\|Cores\|Timezone |

There is no fraud score in any field (PD1). The sealed file's own SHA-512 is not in the QR: it is in
the PDF's `VO-SEAL2` Subject (see Seal Chain of Custody).

---

## Password Protection (Delivery Receipt)

When enabled, the sealed PDF:

1. Is encrypted with standard PDF password protection (RC4-128, revision 3 — `pdf-encrypt.js`), so any reader opens it after a password prompt. Only if that fails is the legacy `.voice` container used (AES-256-GCM, PBKDF2-SHA-256 with 100,000 iterations), which `verify.html` decrypts on the device; ordinary readers cannot open a `.voice` file.
2. Gains a **cover page** (page 1) with a lock icon, the text below and the sender's email when one was given. Readers show it only once the password is entered.
3. Recipient must email sender for password -> **that email IS the read receipt**
4. No server involvement -- works through any email system

A PDF that already carries its own password is sealed as-is: the new password is not applied, and the page says so.

### Cover Page Text

```
DOCUMENT PROTECTED

This document has been password-protected by the sender.

To open this document:
1. Contact the sender to request the password
2. The sender will know you received this document
3. This serves as your delivery receipt

Sender contact: [sender email from identity pipeline]
```

---

## Forensic analysis (Seal document with forensic report only)

The default **Seal document** seals integrity and time only; the engine does not run. In **Seal document with forensic report**, the deterministic engine (`forensic-engine-page.js`, inlined into the seal page) runs on the device: 46 contradiction types (CT01–CT46) from 40 detectors (D01–D40), 17 serial fraud patterns (SP01–SP17), PDF-metadata checks (D15: an image tool such as Photoshop, GIMP or Canva as producer or creator; a modification date before the creation date), and the signed rule package, applied additively (`ENGINE.md` §12.7). Every finding is anchored to quoted text and a page or dropped (PD2). Findings are ranked by an internal ordinal severity; no score, percentage or confidence band is printed (PD1, §15.2). Before it starts, the page checks that the forensic service answers, and refuses to run if it does not. The AI review runs through the Worker on Cloudflare Workers AI — classification (started beside the engine run), assessment of the findings, the Brain 9 sweep of the sealed text (recommendations only, offered as a separate unsealed file, never sealed findings) and the court-ready narrative behind two gates: the Worker's anchor and language gate (`humanGate`, which includes the four-pillars rule and the court-language ban) and the render-time §15.2 gate in `forensic-report.js` (`ENGINE.md` §13). Detector reference and every false-positive guard: `ENGINE.md` §2–§4.

If findings are recorded, the document still seals (preserving evidence integrity and time). Under the **Pristine Seal Doctrine** the original is sealed **pristine**: the watermark, the seal header and footer bands and the verification QR only -- **no verdict, fraud or analysis overlays are drawn on the original**. Findings are forensic indicators, not determinations of fraud. They appear only in the separate sealed forensic report, the sealed court-ready narrative, the findings JSON and the results page — never on the original document, and never as a score.

---

## Commercial Detection

Commercial documents are detected by a weighted keyword score, computed on the device in both modes (`detectCommercialDocument`): a company-type word scores 3 (e.g. `ltd`, `llc`), a transaction word 2 (e.g. `invoice`, `tender`, `contract`), a registration, banking or officer word 1 (e.g. `vat`, `iban`, `director`), a regulatory phrase 2. The words are read from the first 500,000 bytes of the PDF and up to 50 of its compressed streams (`extractPdfText`), as single tokens of three or more letters or digits, and a keyword counts only when it equals a whole token — so multi-word keywords (`pty ltd`, `purchase order`, every regulatory phrase) and two-letter ones (`cc`) never match today.

| Score | Action |
|-------|--------|
| Score below 6 | Seal as private (free) |
| Score 6 or more | Flag as commercial; show payment gate |

**Pricing (GPS-based):**
| Region | Price |
|--------|-------|
| South Africa | R750 ZAR |
| SADC Region | R500 ZAR |
| International | $50 USD |
| Law Enforcement | FREE (with .gov/.police email) |

Region comes from the sealing GPS fix (bounding boxes); with GPS declined the price is International. Law enforcement is free for a sender email ending in `.gov.za`, `.gov`, `.police`, `.hawks`, `.npa`, `.justice`, `.saps`, `.fbi.gov`, `.doj.gov`, `.interpol.int` or `.europol.europa.eu`, or a sender name or identifier containing a law-enforcement word (`police`, `saps`, `officer`, `prosecutor`, `magistrate`, `judge` and others). **Payment is not live:** `STRIPE_LINKS` holds placeholders, and the gate says so and lets the user proceed with sealing ("payment will be collected later") or seal as private.

---

## Seal Chain of Custody

When investigations evolve and documents are merged, the seal chain preserves the full audit trail:

```
Day 1:  Seal original report        -> VO-A
Day 5:  Merge + add evidence         -> VO-B (CHAIN:VO-A)
Day 12: Add witness statements       -> VO-C (CHAIN:VO-A,VO-B)
```

Each seal makes its own OpenTimestamps submission, which stays pending until a Bitcoin block confirms it; once confirmed, that anchor proves the version existed no later than the block. The new seal records the earlier seal IDs in its Subject (`VO-SEAL2|<sealed-file SHA-512>|<seal ID>|ORIG:<original SHA-512>|CHAIN:VO-A,VO-B`), its footer (`Chain: n prev`) and its QR (`chain`), and the verify page names them as text (they are not links). Each earlier version is verified by opening its own file there. The chain is tamper-evident, not immutable; what weight it carries is for the court.

`seal-module/SPEC.md` §8 has the full chain format: the current `VO-SEAL2|<sealed-file SHA-512>|<seal ID>|ORIG:<original SHA-512>[|CHAIN:…]` Subject and the legacy `VO-SEAL|<original SHA-512>|<seal ID>[|CHAIN:…]`, now written only when the VO-SEAL2 hash cannot be patched in (`verify.html` `parseSealSubject` reads both).

---

## File Structure

Full map with every page, script and endpoint: [`REFERENCE.md`](./REFERENCE.md).

```
webdocsol/
|-- wrangler.toml                      # the Worker: zone routes for both hostnames, assets (/api/* runs the Worker first), RULES_KV, AI, weekly trainer cron
|-- .assetsignore                      # never served: worker/, tests/, functions/, *.md, brand/, seal-module/, fixtures
|-- functions/[[path]].js              # the Pages bridge — runs on the legacy Pages project only
|-- .github/workflows/live-site-probe.yml  # run by hand; sees both hostnames and workers.dev from outside
|-- package.json                       # npm test, npm run check (version 1.2.5)
|-- index.html                         # LIVE homepage
|-- seal-document.html                 # LIVE main app (engine + report inlined)
|-- verify.html                        # LIVE Verification Hub — every seal QR points here
|-- verify-data.html, dashboard.html, constitution.html, documents-resources.html
|                                      #   dashboard.html and verify-data.html read a separate Worker not in this repo
|-- preview-documents.html             # the Documents page the home navigation links (its logo and navigation link preview-index.html, an alternative home page that index.html does not link)
|-- forensic-engine-page.js            # the deterministic engine (CT01-CT46, D01-D40)
|-- forensic-report.js                 # sealed report generator (build / buildNarrative / buildHumanReport / seal)
|-- seal-guard.js, ots-proof.js, pdf-encrypt.js
|                                      #   ^ all five are ALSO inlined into seal-document.html
|-- verum-ui.css                       # the binding design tokens (VERUM_UI_TOKENS.md) as CSS; no page links it
|-- Verum-Omnis-Briefing.pdf           # public briefing, linked from index.html
|-- constitution.json, constitution-v8.pdf, llms.txt, robots.txt, sitemap.xml
|-- greensky-ocr-verify.pdf, forensic_test_document.pdf  # test fixtures, not served
|-- worker/
|   |-- verum-rules.js                 # the Cloudflare Worker: router, AI + rules endpoints, site health
|   |-- static-proxy.js                # the site-serving chain (assets -> main branch on GitHub -> legacy Pages -> embedded images)
|   |-- site-assets.js                 # embedded last-resort copies of the logo and watermark
|   |-- rule-format.md, public-key.der.b64, seed-rules.json
|-- tests/                             # 34 suites, 2658 assertions (counted 2026-10-05 on the PR #216 branch; per suite: ENGINE.md §10) — node tests/run-all.js
|   |-- run-all.js                     # the registry — an unregistered file does not run
|   |-- README.md                      # the short guide to the suites
|-- vendor/                            # pinned pdf.js, pdf-lib, qrcode, Tesseract (offline-first)
|-- images/                            # logo, favicon, sealed-PDF watermark, the home page's two photos (the only images the site serves)
|-- brand/                             # app icon and banner artwork — repository material, never served
|-- CLAUDE.md, AGENTS.md, ARCHITECTURE.md, ENGINE.md, DEPLOYMENT.md, REFERENCE.md, FORENSIC-DEBUG.md, VERUM_UI_TOKENS.md, ...   # docs (see REFERENCE.md §5); never served
|-- DESIGN_LOCK.md                     # permanent visual standard (DO NOT REGRESS)
|-- seal-module/                       # the PORTABLE SEALING SPEC — not the live site
|   |-- SPEC.md                        # full technical specification
|   |-- web/                           # older snapshots of the web implementation (see warning above)
|   |-- android/                       # Android/Kotlin reference notes (the app itself is Liamhigh/1verum)
|   |-- firewall/                      # Firewall reference notes (written for Python; the firewall, Liamhigh/firebase, is Node.js + TypeScript)
```

---

## Brand Colours

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#040D1B` | Page background |
| Gold | `#D4A843` | CTAs, accents, seal type |
| Blue | `#4A7EC7` | Links, secondary elements |
| Text | `#F8F9FA` | Headings |
| Body | `#D5D8DD` | Body text |
| Footer | `#4A7EC7` | Labels, monospace text |
| Green | `#22c55e` | Verified, hash displays |
| Red | `#ef4444` | Fraud, tamper, errors |

The binding token set is [`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md), also written as CSS custom properties in [`verum-ui.css`](./verum-ui.css). The site's pages do not link `verum-ui.css`: each carries the same values in its own inline `<style>`, so a token change is made in the pages, in `VERUM_UI_TOKENS.md` and in `verum-ui.css`. `DESIGN_LOCK.md` records the locked colour palette and the no-regression rule.

---

## Constitution Compliance

Governed by **Constitution v8.0** (seal `VO-9A4F3C5E825C`, published verbatim at
`constitution.html` and mirrored in [`CONSTITUTION-v8.md`](./CONSTITUTION-v8.md)); the engine's
operating instrument remains v6.1 (seal `VO-9E51D3F507E6`). All implementations must adhere to:

- **§1 PD1 — Truth over probability.** No scores, no percentages, **no confidence bands**; a finding
  is stated as fact or not stated. Severity stays an internal ordinal weight that orders findings
  (founder ruling 2, 2026-08-14).
- **§1 PD2 — No anchor, no sentence.** A finding that cannot cite quoted text and a page is
  dropped, not softened.
- **§1 PD4 — Determinism.** No randomness, no hidden server calls, no nondeterministic ordering:
  the same file and the same analysis instant give the same findings on any device. The engine
  never reads the clock; the instant is passed in and recorded as `analysis_reference_utc`
  (findings JSON 1.6.0 and later). The optional AI layers are labelled and advisory; the AI review
  never removes or changes an engine finding (founder ruling, 5 October 2026).
- **§1 PD15 / §13 — Article X, Non-Weaponization is supreme.** No lethal targeting, no battlefield
  intelligence for offensive operations, no military surveillance for coercion, no weapons-systems
  integration, no conflict optimisation, no material contribution to physical harm (§13.2). No
  authority may override it.
- **§1 PD16 — Findings are stated as fact; verdicts belong to the court.** Never softened to
  "might" or "appears to". **PD6:** a failed or partial extraction is stated — what failed, where
  and why — never filled in.
- **§2 — Nine-Brain architecture.** The 46 contradiction types across 40 detectors *are* that
  architecture (AGENTS.md ruling 3).
- **§15.2 — Prohibited language.** No hedging, no bands, and **no verdict on a named person** —
  that belongs exclusively to the court.
- **§15.3 / §15.4 — The required sentences and the seven-section report template**, which
  `forensic-report.js` implements (ENGINE.md §7).

---

## Working on this repository

```
node tests/run-all.js   # or npm test — 34 suites, 2658 assertions (2026-10-05); every suite green
npm run check          # node --check on the five inlined scripts and the three worker files
```

- The five scripts inlined into `seal-document.html` sit between `/* VO-INLINE:<file>:START/END */`
  markers: edit the source file, then re-splice (`ENGINE.md` §9); `tests/inline-scripts.test.mjs`
  byte-compares them.
- `tests/run-all.js` is the registry — a test file not listed there does not run. No GitHub
  workflow runs the tests; run them before every push.
- Merge to `main` is the deploy (Cloudflare Workers Builds ships the Worker and the site together).
  The Workers Builds check on a PR branch uploads a version but does not deploy; it has passed on
  every PR head since #210 (27 September 2026), so a red check is a real signal. Confirm a deploy
  through the Cloudflare connector and `GET /api/v1/site/health`, read from outside by the
  `live-site-probe` workflow (`DEPLOYMENT.md`, `AGENTS.md` "How a change ships").
- Never commit a secret: `ADMIN_TOKEN`, `RULE_PRIVATE_KEY` and `LLM_*` live in the Cloudflare
  dashboard.

---

## Current state and open questions

The two-minute state of the platform, and what is known-broken today: [`AGENTS.md`](./AGENTS.md)
"Start here" ("Known state right now"). The latest change sets and what stays open with the
founder: [`ENGINE.md`](./ENGINE.md) §12.14 ("Open, with the founder") and §12.15. History:
`git log main` (each recent merge is one squashed pull request, numbered in its title).

---

## Patent Pending

Verum Omnis -- Patent Pending -- Article X Non-Weaponization Doctrine

(The repository records no application number; the patent status is the founder's statement —
open with the founder.)

---

## History — release notes to v1.2.5 (superseded)

Kept as history. They predate the deterministic engine and the two seal modes; for what changed
since, read `git log main` and AGENTS.md "Start here". The available git history starts on
2026-08-21, so what v1.2 and v1.2.5 shipped cannot be checked against it.

**What's New in v1.2.5:**
- **Fraud detection fix** (superseded) -- multi-word keyword phrases ("wire transfer", "forged signature") now properly match against PDF text. The keyword scanner has since been replaced by the deterministic engine (see Forensic analysis).
- **Samsung Browser compatibility** (superseded) -- all `const`/`let` in async pipelines converted to `var` to avoid TDZ errors. Today `buildSealedPDF` uses `const`/`let` again; only the main pipeline keeps `var` declarations in outer scope.
- **Design lock established** -- visual standard documented and locked

**What's New in v1.2:**
- **Seal Chain of Custody** -- detects previous seals when re-sealing merged documents
- **Per-page error recovery** -- individual pages that fail to embed get error notices instead of crashing the whole seal
- **Proper error messages** -- clear explanations and recovery steps when sealing fails
- **Verify page rewrite** (superseded) -- uses pdf-lib metadata extraction (no more "No Seal Found" false negatives). Today `verify.html` loads pdf.js (not pdf-lib) and scans the file's raw bytes for the `VO-SEAL2` / `VO-SEAL` / `SEAL-CERT` / `ANCHOR-CERT` markers.

(The voice-note line that used to sit in the v1.2 list moved to "What the site does today": voice
notes arrived on 2026-08-22, #178.)
