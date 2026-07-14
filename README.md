# WebDocSol — Verum Omnis Document Sealing & Verification Standard

**Repository:** `Liamhigh/webdocsol`  
**Version:** VO-DSS-1.0 (Verum Omnis Document Sealing Standard v1.0)  
**Constitution:** v6.0 Final  
**Date:** 2026-07-14  
**Classification:** Constitutional / Immutable / Open Source  

---

## Purpose

This repository standardises the Verum Omnis document sealing and verification system across three platforms:

| Platform | Directory | Status |
|----------|-----------|--------|
| **Website** (`verumglobal.foundation`) | `/seal-module/web/` | Live |
| **Android App** | `/seal-module/android/` | Reference spec |
| **Guardian Fraud Firewall** | `/seal-module/firewall/` | Reference spec |

All implementations must produce **interoperable** sealed documents — a document sealed on the website must verify on the Android app and the Firewall, and vice versa.

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
       +---> Optional: [Identity Pipeline] Name, ID, Address, Email
       +---> Optional: [Password Protection] Delivery receipt mode
       +---> Auto: [GPS + Device Fingerprint]
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
       - Seal footer on every page (SHA-512 + timestamp)
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
  "org": "Organisation Name"
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

---

## Password Protection (Delivery Receipt)

When enabled, the sealed PDF:

1. Has AES-256 encryption with user-provided password
2. Shows a **cover page** (page 1) with lock icon and sender contact
3. Recipient must email sender for password → **that email IS the read receipt**
4. No server involvement — works through any email system

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

## File Structure

```
webdocsol/
├── README.md                          # This file
├── seal-module/
│   ├── SPEC.md                        # Full technical specification
│   ├── web/                           # Website implementation
│   │   ├── seal-document.html         # Document sealing page
│   │   ├── verify.html               # Document verification page
│   │   └── watermark-spec.md         # Watermark brand spec
│   ├── android/                       # Android/Kotlin reference
│   │   └── README.md
│   └── firewall/                      # Python/Firewall reference
│       └── README.md
└── website/                           # Website notes
    └── README.md
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

---

## Constitution Compliance

All implementations must adhere to:
- **Article III:** Truth over Probability — never fabricate extraction results
- **Article IV:** Evidence before Narrative — extraction report before analysis
- **Article X:** Non-Weaponization — no brute-force, no unauthorized access

---

## Patent Pending

Verum Omnis — Patent Pending — Article X Non-Weaponization Doctrine
