# WebDocSol -- Verum Omnis Document Sealing & Verification Standard

**Repository:** `Liamhigh/webdocsol`  
**Version:** VO-DSS-1.2 (Verum Omnis Document Sealing Standard v1.2)  
**Constitution:** v6.0 Final  
**Date:** 2026-07-16  
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
| **Website** (`verumglobal.foundation`) | `/seal-module/web/` | Live |
| **Android App** | `/seal-module/android/` | Reference spec |
| **Guardian Fraud Firewall** | `/seal-module/firewall/` | Reference spec |

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

```
webdocsol/
|-- README.md                          # This file
|-- DESIGN_LOCK.md                     # Permanent visual standard (DO NOT REGRESS)
|-- design-reference/                  # Canonical visual reference
|   |-- screenshot-v1.2.5.png         # Locked design screenshot
|-- seal-module/
|   |-- SPEC.md                        # Full technical specification
|   |-- web/                           # Website implementation
|   |   |-- seal-document.html         # Document sealing page
|   |   |-- verify.html               # Document verification page
|   |   |-- watermark-spec.md         # Watermark brand spec
|   |-- android/                       # Android/Kotlin reference
|   |   |-- README.md
|   |-- firewall/                      # Python/Firewall reference
|       |-- README.md
|-- website/                           # Website notes
    |-- README.md
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

All implementations must adhere to:
- **Article III:** Truth over Probability -- never fabricate extraction results
- **Article IV:** Evidence before Narrative -- extraction report before analysis
- **Article X:** Non-Weaponization -- no brute-force, no unauthorized access

---

## Patent Pending

Verum Omnis -- Patent Pending -- Article X Non-Weaponization Doctrine
