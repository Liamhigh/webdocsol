# VO-DSS-1.2 Technical Specification

## Document Sealing Standard v1.2

---

## 1. Pipeline Steps (8 Steps)

| Step | Name | Description |
|------|------|-------------|
| 1 | GPS + Device | Capture geolocation & device fingerprint |
| 2 | SHA-256 | Compute hash for OpenTimestamps |
| 3 | OpenTimestamps | Submit to calendar servers (a.pool, b.pool) |
| 4 | A4 Watermark | Full-page background at 20% opacity |
| 5 | Clean QR Code | Encode hash + identity + GPS + device |
| 6 | Seal Footer | Hash + timestamp on every page |
| 7 | Finalize | Prepare sealed PDF package |
| 8 | SHA-512 | Verum Forensic Fingerprint (displayed LAST) |

## 2. SHA-512 as Final Verification

SHA-512 is computed early (step 2, needed for footer/QR) but **displayed as step 8** -- the last thing the user sees. This emphasises the Verum fingerprint as the seal of trust.

## 3. Watermark Application

- Watermark image: 927x1200px transparent PNG
- Applied as full-page background at 20% opacity
- Original content scaled to 88% (centred)
- Content never overlaps watermark elements

## 4. QR Code Rules

- **NO border** around QR code
- **NO white rectangle** drawn behind QR
- QR PNG already has white quiet zone built-in
- Position: top-right corner, 2.5% margin from edges
- Size: 10% of page dimension
- Encodes: verify URL + SHA-512 prefix + base64 metadata

## 5. Password Protection Flow

```
Sender checks "Password protect" -> enters password (min 8 chars) -> confirms
                                    |
                                    v
PDF encrypted with AES-256 + cover page inserted as page 1
                                    |
                                    v
Recipient opens PDF -> sees lock screen with sender contact
                                    |
                                    v
Recipient emails sender asking for password
                                    |
                                    v
Sender receives email = DELIVERY RECEIPT
                                    |
                                    v
Sender replies with password
                                    |
                                    v
Recipient enters password -> document opens
```

## 6. File Size Note

Sealed PDFs are larger than originals because they contain:
- Embedded original pages (at 88% scale)
- Watermark image (drawn on every page)
- QR code image (drawn on every page)
- Seal footer text (on every page)
- Optional: Password cover page

This is expected and correct. The watermark provides forensic-grade branding.

## 7. Identity Pipeline (Optional)

All identity fields are optional. User clicks "+ Add Sender Identity" to expand.

| Field | Use Case |
|-------|----------|
| Full Name | Affidavit pre-fill, chain of custody |
| ID/Passport | Legal identity verification |
| Address | Affidavit address block |
| Email | Password delivery contact |

Identity data is encoded in QR metadata only -- never stored server-side.

## 8. Seal Chain of Custody (v1.2)

When a previously sealed PDF is re-sealed (e.g., after merging with other documents), the system **preserves the chain of custody**:

### Chain Detection
- Before sealing, the system reads the uploaded PDF's Subject metadata
- If a `VO-SEAL|...` entry is found, the previous Seal ID(s) are extracted

### Chain Storage Format
```
Subject: VO-SEAL|SHA512|NEW_SEAL_ID|CHAIN:VO-OLD1,VO-OLD2
```

| Field | Description |
|-------|-------------|
| `VO-SEAL` | Magic prefix -- identifies this as a Verum Omnis seal |
| `SHA512` | Full 128-character SHA-512 of the original document |
| `NEW_SEAL_ID` | Seal ID of the current (new) seal |
| `CHAIN:VO-OLD1,VO-OLD2` | Comma-separated list of previous seal IDs |

### Footer Display
If previous seals exist, the footer shows:
```
PRIVATE SEAL -- FREE TIER | Chain: 2 prev
Seal: VO-NEW | SHA-512: a1c825e8... | 2026-07-14 06:05:01 UTC | 1/15
```

### Investigation Timeline
Each re-seal creates a **new independent Bitcoin timestamp** via OpenTimestamps. This produces an immutable audit trail:

| Day | Action | Bitcoin Block |
|-----|--------|---------------|
| Day 1 | Seal initial report | Block 890,001 |
| Day 5 | Merge + add evidence | Block 890,042 |
| Day 12 | Add witness statements | Block 890,115 |

The verify page displays the full chain: "Previous seals: VO-OLD1, VO-OLD2" -- each independently clickable and verifiable.

## 9. Interoperability Requirements

Any implementation (web, Android, Firewall) must produce PDFs that:
1. Contain a SHA-512 hash in the seal footer
2. Have a scannable QR code linking to the verify page
3. Include the watermark at 20% opacity (or platform-equivalent)
4. Use the same metadata JSON schema in QR codes
5. Produce compatible .OTS proof files
6. Detect and preserve seal chains when re-sealing (v1.2+)
