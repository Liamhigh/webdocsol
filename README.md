# WebDocSol -- Verum Omnis Document Sealing & Verification Standard

> **System context (read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first).** This repo is the
> **website hub** of the Verum Omnis system — one of four surfaces (**website + Android `1verum`
> + Android reference `cursorfu` + Guardian firewall `firebase`**) that share one forensic engine,
> of which **this repo holds the reference implementation**. Two hard rules: the system is
> **stateless / serverless — no servers, no central user-data database** (state lives in the sealed
> PDF, the Bitcoin anchor, and the user's device), and **all verification happens at the website**
> (`verify.html`, via SHA-512 + OpenTimestamps/Bitcoin — not a server lookup).
>
> **Working on the engine or the report? Read [`ENGINE.md`](./ENGINE.md) first** — the detector
> reference and the false-positive guards, each recorded with the real evidence bundle that
> produced it. **Looking for a file, page, function or endpoint?** [`REFERENCE.md`](./REFERENCE.md).

**Repository:** `Liamhigh/webdocsol`  
**Version:** VO-DSS-1.2 (Verum Omnis Document Sealing Standard v1.2)  
**Engine:** `VO_ENGINE_VERSION 5.3.5-web` — CT01–CT46, detectors D01–D40  
**Constitution:** v8.0 (governance charter, seal `VO-9A4F3C5E825C`); v6.1 (engine operating instrument, seal `VO-9E51D3F507E6`)  
**Date:** 2026-08-05  
**Classification:** Constitutional / Immutable / Open Source  

> ## DESIGN LOCK IN EFFECT
> 
> The current visual design of `verumglobal.foundation` is **LOCKED** as of 2026-07-16.
> See [`DESIGN_LOCK.md`](DESIGN_LOCK.md) for the full specification and
> [`design-reference/screenshot-v1.2.5.png`](design-reference/screenshot-v1.2.5.png)
> for the canonical visual reference.
>
> **This design may be enhanced but must NEVER regress.** Any PR touching CSS,
> HTML structure, or visual elements must include a side-by-side comparison with
> the reference screenshot proving no regression has occurred.

**What's New in v1.2.5:**
- **Fraud detection fix** -- multi-word keyword phrases ("wire transfer", "forged signature") now properly match against PDF text
- **Samsung Browser compatibility** -- all `const`/`let` in async pipelines converted to `var` to avoid TDZ errors
- **Design lock established** -- visual standard documented and locked

**What's New in v1.2:**
- **Seal Chain of Custody** -- detects previous seals when re-sealing merged documents
- **Per-page error recovery** -- individual pages that fail to embed get error notices instead of crashing the whole seal
- **Proper error messages** -- clear explanations and recovery steps when sealing fails
- **Verify page rewrite** -- uses pdf-lib metadata extraction (no more "No Seal Found" false negatives)

---

## Purpose

This repository standardises the Verum Omnis document sealing and verification system across three platforms:

| Platform | Directory | Status |
|----------|-----------|--------|
| **Website** (`verumglobal.foundation`) | **repository root** — `seal-document.html`, `verify.html`, `index.html` … | Live |
| **Android App** | `/seal-module/android/` | Reference spec |
| **Guardian Fraud Firewall** | `/seal-module/firewall/` | Reference spec |

> **⚠ `seal-module/web/` is NOT the live site.** It holds older snapshots of
> `seal-document.html` and `verify.html` kept alongside the portable sealing spec. The pages
> Cloudflare Pages actually serves are the ones at the **repository root**, and they have moved
> a long way past those snapshots (the live `seal-document.html` is ~748 KB because the engine
> and report generator are inlined into it; the snapshot is ~136 KB). **Edit the root files.**
> A change made only in `seal-module/web/` ships nothing.

All implementations must produce **interoperable** sealed documents -- a document sealed on the website must verify on the Android app and the Firewall, and vice versa.

---

## Architecture Overview

```
User uploads PDF
       |
       v
[SK01] Filename Sanitizer
       |
       v
[SK02] Document Profiler
       |
       +---> Auto: [Fraud Detection] Scan for fraudulent content
       +---> Optional: [Identity Pipeline] Name, ID, Address, Email
       +---> Optional: [Password Protection] Delivery receipt mode
       +---> Auto: [GPS + Device Fingerprint]
       +---> Auto: [Seal Chain Detection] Detect previous seals
       +---> Auto: [Commercial Detection] Detect commercial documents
       |
       v
[Hash] SHA-256 (for OpenTimestamps)
[Hash] SHA-512 (Verum Forensic Fingerprint)
       |
       v
[OTS]  Submit to OpenTimestamps calendar servers
       |
       v
[PDF]  Build sealed PDF:
       - A4 watermark background at 20% opacity
       - Original content scaled to 88%
       - Clean QR code top-right (no border)
       - Seal footer on every page (VERUM OMNIS SEALED ORIGINAL + SHA-512 + timestamp + chain)
       - Pristine Seal Doctrine: the original is sealed pristine (watermark,
         footer + QR only) -- NO fraud/verdict overlays are drawn on it.
         Verdicts and analysis appear only in the separate forensic report.
       - Optional: Password-protected cover page
       |
       v
[Out]  Sealed PDF + .OTS proof file
```

---

## QR Code Format (Standard)

The QR code encodes a verification URL with embedded metadata:

```
https://verumglobal.foundation/verify.html?h=<SHA512_PREFIX_32>&m=<BASE64_METADATA>
```

### Metadata Schema (JSON, base64-encoded)

```json
{
  "v": "1.2",
  "t": 1720934400000,
  "id": {
    "n": "Sender Name",
    "id": "ID/Passport Number",
    "a": "Physical Address",
    "e": "sender@email.com"
  },
  "lock": true,
  "gps": "-26.2041,28.0473",
  "acc": 10,
  "dev": "Win32|8|Africa/Johannesburg",
  "type": "private",
  "org": "Organisation Name",
  "sha512": "full 128-char sha512...",
  "otsDigest": "64-char ots sha256...",
  "otsStatus": true,
  "sealId": "VO-XXXXXXXXXXXX",
  "fraudScore": 45,
  "fraudPages": "1,3",
  "fraudKeywords": "wire transfer,counterfeit",
  "fraudClean": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v` | string | Yes | Seal format version |
| `t` | number | Yes | Unix timestamp (ms) |
| `id.n` | string | No | Sender full name |
| `id.id` | string | No | ID/Passport number |
| `id.a` | string | No | Physical address |
| `id.e` | string | No | Contact email |
| `lock` | boolean | No | Password protected flag |
| `gps` | string | No | Lat,Lng coordinates |
| `acc` | number | No | GPS accuracy in metres |
| `dev` | string | No | Platform\|Cores\|Timezone |
| `type` | string | Yes | `private` or `commercial` |
| `org` | string | No | Organisation name (commercial only) |
| `sha512` | string | Yes | Full SHA-512 fingerprint (128 hex chars) |
| `otsDigest` | string | Yes | OTS SHA-256 digest for blockchain lookup |
| `otsStatus` | boolean | Yes | Whether OTS calendar accepted the digest |
| `sealId` | string | Yes | VO-XXXXXXXXXXXX seal identifier |
| `fraudScore` | number | No | Fraud detection score (0-100) |
| `fraudPages` | string | No | Comma-separated list of flagged page numbers |
| `fraudKeywords` | string | No | Comma-separated list of matched fraud keywords |
| `fraudClean` | boolean | No | True if no fraud indicators detected |

---

## Password Protection (Delivery Receipt)

When enabled, the sealed PDF:

1. Has AES-256 encryption with user-provided password
2. Shows a **cover page** (page 1) with lock icon and sender contact
3. Recipient must email sender for password -> **that email IS the read receipt**
4. No server involvement -- works through any email system

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

## Fraud Detection

The fraud detection engine scans uploaded documents for:

- **Fraud keywords** (50+): "wire transfer", "forged signature", "counterfeit", "nigerian prince", "money laundering", etc.
- **Fraud patterns** (8 regex): advance-fee scams, urgent payment pressure, secret deals, guaranteed returns, bypass legal review, off-record transactions, date manipulation, corporate fraud
- **Metadata anomalies**: Photoshop, GIMP, Canva detection in PDF producer/creator fields
- **Scoring**: 0-100 scale; >=20 flags as fraudulent

If fraud indicators are detected, the document still seals (preserving evidence integrity and time). Under the **Pristine Seal Doctrine** the original is sealed **pristine**: the A4 watermark, per-page seal footer and verification QR only -- **no verdict, fraud or analysis overlays are drawn on the original**. Findings are forensic indicators, not determinations of fraud; they and the score appear only in the **separate sealed forensic report** and on the results page, never on the original document.

---

## Commercial Detection

Commercial documents are detected by keyword matching (66 commercial terms):

| Match Count | Action |
|-------------|--------|
| 0-1 matches | Seal as private (free) |
| 2+ matches | Flag as commercial; show payment gate |

**Pricing (GPS-based):**
| Region | Price |
|--------|-------|
| South Africa | R750 ZAR |
| SADC Region | R500 ZAR |
| International | $50 USD |
| Law Enforcement | FREE (with .gov/.police email) |

---

## Seal Chain of Custody

When investigations evolve and documents are merged, the seal chain preserves the full audit trail:

```
Day 1:  Seal original report        -> VO-A -> Bitcoin Block 890,001
Day 5:  Merge + add evidence         -> VO-B (CHAIN:VO-A) -> Block 890,042
Day 12: Add witness statements       -> VO-C (CHAIN:VO-A,VO-B) -> Block 890,115
```

Each re-seal creates an **independent Bitcoin timestamp**. The verify page shows the complete chain -- every previous seal is independently clickable and verifiable. In court, this proves the document's evolution is tamper-evident and cannot be backdated.

See `seal-module/SPEC.md` Section 8 for full chain format specification.

---

## File Structure

Full map with every page, script and endpoint: [`REFERENCE.md`](./REFERENCE.md).

```
webdocsol/
|-- index.html                         # LIVE homepage
|-- seal-document.html                 # LIVE main app (engine + report inlined)
|-- verify.html                        # LIVE Verification Hub — every seal QR points here
|-- verify-data.html, dashboard.html, constitution.html, documents-resources.html
|-- forensic-engine-page.js            # the deterministic engine (CT01-CT46, D01-D40)
|-- forensic-report.js                 # sealed report generator (build / buildNarrative / seal)
|-- seal-guard.js, ots-proof.js, pdf-encrypt.js
|                                      #   ^ all five are ALSO inlined into seal-document.html
|-- verum-ui.css                       # binding design tokens
|-- Verum-Omnis-Briefing.pdf           # public briefing, linked from index.html
|-- worker/
|   |-- verum-rules.js                 # the Cloudflare Worker (AI + rules endpoints)
|   |-- rule-format.md, public-key.der.b64, seed-rules.json
|-- tests/                             # 27 suites, 1321 assertions
|   |-- run-all.js                     # the registry — an unregistered file does not run
|-- vendor/                            # pinned pdf.js, pdf-lib, qrcode, Tesseract (offline-first)
|-- images/                            # logos + sealed-PDF watermark
|-- AGENTS.md, ENGINE.md, ARCHITECTURE.md, REFERENCE.md, ...   # docs (see REFERENCE.md §5)
|-- DESIGN_LOCK.md                     # permanent visual standard (DO NOT REGRESS)
|-- design-reference/
|   |-- screenshot-v1.2.5.png          # locked design screenshot
|-- seal-module/                       # the PORTABLE SEALING SPEC — not the live site
|   |-- SPEC.md                        # full technical specification
|   |-- web/                           # older snapshots of the web implementation (see warning above)
|   |-- android/                       # Android/Kotlin reference
|   |-- firewall/                      # Python/Firewall reference
|-- website/                           # website notes
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

See `DESIGN_LOCK.md` for the complete locked color palette with exact values and usage rules.

---

## Constitution Compliance

Governed by **Constitution v8.0** (seal `VO-9A4F3C5E825C`, published verbatim at
`constitution.html` and mirrored in [`CONSTITUTION-v8.md`](./CONSTITUTION-v8.md)); the engine's
operating instrument remains v6.1 (seal `VO-9E51D3F507E6`). All implementations must adhere to:

- **§1 PD1 — Ordinal confidence only.** No scores, no percentages, **no confidence bands**.
- **§1 PD2 — No anchor, no sentence.** A finding that cannot cite quoted text and a page is
  dropped, not softened.
- **§1 PD4 — Determinism.** Same input → same findings, on any device, forever.
- **§1 PD15 / §13 — Article X, Non-Weaponization is supreme.** No brute force, no unauthorised
  access, no weapons integration. No authority may override it.
- **§1 PD16 — Truth over probability.** Findings are stated as fact and anchored; never
  fabricate an extraction result.
- **§2 — Nine-Brain architecture.** The 46 contradiction types across 40 detectors *are* that
  architecture (AGENTS.md ruling 3).
- **§15.2 — Prohibited language.** No hedging, no bands, and **no verdict on a named person** —
  that belongs exclusively to the court.
- **§15.3 / §15.4 — The required sentences and the seven-section report template**, which
  `forensic-report.js` implements (ENGINE.md §7).

---

## Patent Pending

Verum Omnis -- Patent Pending -- Article X Non-Weaponization Doctrine
