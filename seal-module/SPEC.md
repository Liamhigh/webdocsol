# VO-DSS-1.0 Technical Specification

## Document Sealing Standard v1.0

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

SHA-512 is computed early (step 2, needed for footer/QR) but **displayed as step 8** — the last thing the user sees. This emphasises the Verum fingerprint as the seal of trust.

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
Sender checks "Password protect" → enters password (min 8 chars) → confirms
                                    ↓
PDF encrypted with AES-256 + cover page inserted as page 1
                                    ↓
Recipient opens PDF → sees lock screen with sender contact
                                    ↓
Recipient emails sender asking for password
                                    ↓
Sender receives email = DELIVERY RECEIPT
                                    ↓
Sender replies with password
                                    ↓
Recipient enters password → document opens
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

Identity data is encoded in QR metadata only — never stored server-side.

## 8. Interoperability Requirements

Any implementation (web, Android, Firewall) must produce PDFs that:
1. Contain a SHA-512 hash in the seal footer
2. Have a scannable QR code linking to the verify page
3. Include the watermark at 20% opacity (or platform-equivalent)
4. Use the same metadata JSON schema in QR codes
5. Produce compatible .OTS proof files
