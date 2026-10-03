# VO-DSS-1.2 Technical Specification

## Document Sealing Standard v1.2

> **Status.** Checked against the root `seal-document.html` (`detectExistingSeal`,
> `buildQrPayload`, `buildSealedPDF`, `buildSealCertificate`, `buildAnchorCertificate`,
> `VerumReport.seal`) and the root `verify.html` as of the Public Protector submission run
> (ENGINE.md §12.14, 2 October 2026), re-checked 3 October 2026. Where this file and that code
> disagree, the code is right; correct this file. This folder is not served (`.assetsignore`
> lists `seal-module/`). `seal-module/web/` holds older snapshots that do not match the live
> pages (see the end of §10). Version strings in the code do not agree with each other: QR
> metadata `v: "1.2"`; sealed PDF and sealed report Producer `Verum Omnis Document Sealing
> Service v1.3.0`; Seal Certificate Producer `v1.2.9`; Anchor Certificate Producer `v1.3.0`;
> verify page footer `VO-DSS v1.2.7`.

---

## 1. Pipeline Steps (8 Steps)

The page lists eight numbered steps plus a Forensic Scan step, which runs only in the
"Seal document with forensic report" mode.

| Step | UI label | What the code does |
|------|----------|--------------------|
| 1 | GPS + Device | Reads the file; captures GPS (if the browser allows it) and device info |
| — | Forensic Scan | Forensic-report mode only: runs the engine on the original bytes, before step 2 |
| 2 | SHA-256 | Computes the SHA-256 and SHA-512 of the original upload, the seal ID (`VO-` + first 12 hex of the SHA-512, upper case) and the OTS digest (SHA-256 of the 128-character lowercase SHA-512 hex text) |
| 3 | OpenTimestamps | Commercial-content check, then submits the OTS digest to a.pool.opentimestamps.org, b.pool.opentimestamps.org and a.pool.eternitywall.com in turn (15 s each); the first calendar that accepts is the only one used |
| 4 | A4 Watermark | Reports the seal-chain check (previous seals read from the Subject); the watermark itself is drawn in step 6 |
| 5 | Clean QR Code | Builds the verify URL and the QR; identity, GPS and device stay out unless the sealer opts in |
| 6 | Seal Footer | Restores cropped pages, extends each page with a header band (QR) and a footer band, draws the watermark, writes the Subject, applies any password |
| 7 | Finalize | Marks the sealed PDF ready. After step 8 the same step reports the optional AI review (forensic mode) and the Seal Certificate (Seal document mode); the Anchor Certificate (when a calendar accepted), the forensic report and the narrative (forensic mode) follow |
| 8 | SHA-512 | Shows the first 16 hex of the original upload's SHA-512 |

## 2. SHA-512 as Final Verification

SHA-512 of the original upload, before the seal is applied, is computed in step 2. The footer prefix, the QR payload, the seal ID, the Subject's `ORIG:` field and the OTS digest all derive from it. Step 8 shows it again. It is not the hash of the sealed file: see §8 for the sealed-file hash, and §10 for the delivered file's real SHA-512.

## 3. Watermark Application

- Image: `images/watermark_portrait.png`, 927x1200 px, RGBA PNG
- Drawn on every page over the original content at opacity 0.20, scaled to cover the original page (larger of the width and height ratios) and centred on it
- The original content is not scaled or moved (scaling was removed in v1.2.6; it corrupted content streams)
- If the image cannot be fetched after a retry (`/images/watermark_portrait.png`, then `/watermark_portrait.png`), the seal proceeds without the watermark layer

## 4. QR Code Rules

- Each page is extended upward by a navy header band (height = panel + 10 pt); the original content is never covered
- The QR sits on a white panel (opacity 0.95) at the right of the band, 8 pt from the edge, centred vertically; panel side = max(5.1% of the shorter page side, 26 pt); QR inset 2 pt; no border; generated at 400 px, error correction H
- The band's left side reads, in gold, "VERUM OMNIS SEALED ORIGINAL — scan the code or verify at verumglobal.foundation/verify.html"
- If QR generation fails the seal proceeds without it; the panel shows the seal ID prefix and the UI says so
- Encodes `https://verumglobal.foundation/verify.html?h=<first 32 hex of the original SHA-512>&m=<encodeURIComponent(base64(UTF-8 JSON))>`. This URL shape is a contract with the Android app and the fraud-firewall; it never moves (CLAUDE.md non-negotiable 6)

## 5. Password Protection Flow

```
Sender switches on password protection -> types a password (min 8 chars) twice
        |
        v
Cover page ("DOCUMENT PROTECTED", sender email if given) inserted as page 1;
the sealed PDF is encrypted with the PDF Standard Security Handler (RC4-128, revision 3)
        |
        v
Recipient opens <name>-sealed-protected.pdf -> the reader asks for a password
        |
        v
Recipient asks the sender for it -> the request is the sender's receipt that it arrived
        |
        v
Recipient enters the password -> cover page, then the sealed pages
```

The password is checked before any analysis: an empty box, fewer than 8 characters or two boxes
that differ stop the run with a reason. RC4-128 is chosen for reader compatibility; it is a
read-receipt gate, not protection for high-value secrets (`pdf-encrypt.js`). If standard
encryption throws, the page falls back to an AES-GCM `.voice` container. A PDF that is already
password-protected is sealed as-is (no overlay, no Subject), and the new password is not
applied; the page says so. The unprotected sealed PDF is kept as the sender's copy.

## 6. File Size Note

Sealed PDFs are larger than originals because they add:
- a header band (QR panel) and a footer band on every page
- the watermark and QR images, each embedded once and drawn on every page
- the footer text on every page
- an uncompressed Info dictionary (saved without object streams so the VO-SEAL2 hash can be patched and checked)
- optionally, the password cover page

The original pages are not re-embedded or scaled.

## 7. Identity Pipeline (Optional)

All identity fields are optional. The sealer clicks "+ Add Sender Identity (optional — for affidavit pre-fill, chain of custody)" to expand them.

| Field | Use Case |
|-------|----------|
| Full Name | Affidavit pre-fill, chain of custody |
| ID / Passport Number | Legal identity verification |
| Physical Address | Affidavit address block |
| Contact Email | Password delivery contact |

Identity, GPS and device data never enter the public QR by default (since #171). In Seal document mode they are written only to a separate PRIVATE Seal Certificate (`<name>-seal-certificate-PRIVATE-do-not-share.pdf`); the shareable certificate omits them and says they were recorded privately. The private build is retried once, and a failure is shown in the downloads. The checkbox "Include identity + GPS in the public QR code" (default off, with a warning) adds them to the QR. The contact email is also printed on the password cover page. The page sends none of these fields to the Worker. In forensic-report mode no seal certificate is built, so these fields are recorded only if the QR opt-in is ticked.

## 8. Seal Chain of Custody (v1.2)

When a previously sealed PDF is re-sealed (e.g., after merging with other documents), the system **preserves the chain of custody**:

### Chain Detection
- Before sealing, the system reads the uploaded PDF's Subject metadata
- If the Subject starts with `VO-SEAL2|` or `VO-SEAL|`, its seal ID (third field) and any `CHAIN:` list are taken as previous seals. Only the uploaded file's own Subject is read; a file merged in another PDF tool that drops or replaces the Subject carries no chain.

### Chain Storage Format
```
Subject: VO-SEAL2|<SEALED_FILE_SHA512>|<SEAL_ID>|ORIG:<ORIGINAL_SHA512>[|CHAIN:VO-OLD1,VO-OLD2]
Legacy fallback: VO-SEAL|<ORIGINAL_SHA512>|<SEAL_ID>[|CHAIN:VO-OLD1,VO-OLD2]
```

| Field | Description |
|-------|-------------|
| `VO-SEAL2` | Current scheme (sealed-file self-integrity). `VO-SEAL` is the legacy fallback |
| `SEALED_FILE_SHA512` | SHA-512 of the sealed file computed with this field set to 128 zeros. It never equals `sha512sum` of the delivered file |
| `SEAL_ID` | `VO-` + first 12 hex of the original SHA-512, upper case |
| `ORIG:` | Full SHA-512 of the original upload (the value the footer, QR and OTS digest use) |
| `CHAIN:` | Comma-separated earlier seal IDs, omitted when there are none |

How VO-SEAL2 is made: the Subject is written with a 128-zero placeholder (pdf-lib stores it as UTF-16BE hex), the file is saved with `useObjectStreams: false`, the saved bytes are hashed, and the placeholder is patched in place (same length, so every xref offset stays valid). If the placeholder is not found exactly once, the legacy `VO-SEAL` Subject is written instead. verify.html patches the zeros back and recomputes: a match means the file is byte-identical to what the sealer produced; a file re-saved by another tool gets "Seal Present — Check Not Applicable" (the hash cannot be recomputed), not a tamper verdict. Open with the founder (ENGINE.md §12.14, "Open, with the founder" (a)): the check is self-referential, so an altered copy re-sealed with its own hash also matches; the fix touches the verify contract. The real SHA-512 of the delivered file is printed on the Anchor Certificate (§10).

### Footer Display
Every page, in a navy band (opacity 1) added below the page:
```
PRIVATE SEAL — FREE TIER  |  Chain: 2 prev                 verumglobal.foundation  |  OpenTimestamps  |  Patent Pending
VERUM OMNIS SEALED ORIGINAL  |  Seal: VO-A1C825E8F00D  |  SHA-512: a1c825e8f00d3b21...  |  14/07/2026 08:05:01 Africa/Johannesburg  |  1/15  |  Chain: 2 prev
```
The label reads `COMMERCIAL SEAL — <CLIENT>` for a commercial seal. `Chain: N prev` appears only when there are earlier seals. The time is the sealing device's local clock with its IANA zone, not UTC. The hash is the first 16 hex of the original upload's SHA-512. The values above are illustrative.

### Investigation Timeline
Each re-seal submits its own OTS digest (SHA-256 of that run's input SHA-512 hex) to OpenTimestamps. Each is pending until a Bitcoin block confirms it; once confirmed, it proves that fingerprint existed no later than that block's time (not the sealing device's clock). Together they form a tamper-evident sequence (illustrative block numbers):

| Day | Action | Bitcoin block (illustrative) |
|-----|--------|---------------|
| Day 1 | Seal initial report | Block 890,001 |
| Day 5 | Merge + add evidence | Block 890,042 |
| Day 12 | Add witness statements | Block 890,115 |

verify.html shows a "Chain" row ("Chained seal — chains to previous seal VO-OLD1,VO-OLD2") and says so in the match message. The IDs are plain text, not links; each earlier seal is checked by uploading that earlier sealed file.

## 9. Interoperability Requirements

Any implementation (web, Android, Firewall) must produce PDFs with:
1. Seal ID = `VO-` + first 12 hex of the original upload's SHA-512, upper case
2. Subject `VO-SEAL2|…|ORIG:…[|CHAIN:…]` (or legacy `VO-SEAL|<original SHA-512>|<seal ID>[|CHAIN:…]`) as in §8
3. A footer on every page with the seal ID and the first 16 hex of the original SHA-512 (the full hash is in the Subject and the QR payload)
4. A QR linking to `https://verumglobal.foundation/verify.html?h=<first 32 hex>&m=<encodeURIComponent(base64(UTF-8 JSON))>`, payload `{v:"1.2", t:<ms since epoch>, type:"private"|"commercial", sha512, otsDigest, otsStatus, sealId, chain?:[ids]}`. `id{n,id,a,e}`, `gps`, `acc` and `dev` appear only on the sealer's opt-in, and parsers must accept any field being absent
5. OTS digest = SHA-256 of the 128-character lowercase SHA-512 hex text (not of the file). The `.ots` receipt is a detached proof over that digest; to run `ots verify` yourself, use a file whose bytes are exactly that hex text, with no newline
6. The watermark at 20% opacity (or platform-equivalent)
7. Seal chains detected and kept when re-sealing (v1.2+)

Last checked through the GitHub API on 3 October 2026: the Android app (`Liamhigh/1verum` at fc613de, `DocumentSealer.kt`) and the fraud-firewall (`Liamhigh/firebase` at b2aff38, `fraud-firewall/src/seal/documentSealer.ts`) still write the legacy `VO-SEAL` Subject and scale content to 88%; verify.html accepts both schemes. Whether each platform hashes the SHA-512 hex text or its raw bytes for the OTS digest is not confirmed here; open.

## 10. What else a seal produces, and what verify.html reads

- **Seal Certificate** (Seal document mode only): one page, Subject `SEAL-CERT|<original SHA-512>|<seal ID>`, file `<name>-seal-certificate.pdf`; it carries no personal details. The PRIVATE variant (`<name>-seal-certificate-PRIVATE-do-not-share.pdf`) adds identity, address, GPS and device. It is built whenever any of them was recorded; the page always records device data, so in practice it is built on every Seal document run.
- **Anchor Certificate** (both modes, only when a calendar accepted the digest): Subject `ANCHOR-CERT|<OTS digest>|<seal ID>`, saved without object streams, file `<name>-<seal ID>-anchor-certificate.pdf`. It labels the original upload SHA-512 ("BEFORE THE SEAL WAS APPLIED"), the delivered file's real SHA-512 (the protected copy when one was sent) and the OTS digest ("SHA-256 OF THE ORIGINAL SHA-512 HEX TEXT"). It says the Bitcoin confirmation was pending, and that a confirmed block proves existence no later than that block's time.
- **.ots receipt** (`<name>-<seal ID>.ots`): offered only when the submission succeeded; it is the calendar's pending proof over the OTS digest (`ots-proof.js`, `buildFileFromFragment`).
- **Sealed forensic report and court-ready narrative** (forensic mode): `VO-SEAL2|…|<seal ID>|ORIG:<pre-seal report SHA-512>`, with their own QR panel and footer layout (`VerumReport.seal`; `web/watermark-spec.md`, "Other layouts").
- **Protected input**: a PDF that is already encrypted is sealed as-is (no overlay, no Subject); the certificates carry the seal record.
- **verify.html** recognises `VO-SEAL2`, `VO-SEAL`, `SEAL-CERT`, `ANCHOR-CERT`, the older appended-comment block (`%%VO_SEAL_START`) and an OTS-format footer (shown as "Seal Present", never "verified"). A certificate Subject never overrides a seal the raw scan found in the same bytes.
- **Seal Guard** (`seal-guard.js`) refuses to release any PDF without a seal marker. No forensic overlay is ever drawn on the original (the pristine seal doctrine in `buildSealedPDF`).

`seal-module/web/seal-document.html` and `seal-module/web/verify.html` are snapshots kept beside this spec, unchanged since at least 21 August 2026 (fde9fb2, the oldest commit in this shallow history). They are not served (`.assetsignore`; `tests/worker.test.mjs` checks it), and they differ from the live root pages. They draw the QR in a 6% page margin and the footer as an 85%-opacity overlay instead of extending the page. Their anchor certificate lacks the delivered-file SHA-512 and labels the digest "OTS DIGEST (SHA-256 SUBMITTED)", and their verify page does not recognise `ANCHOR-CERT`. Never use them as a reference or edit them to change the site.
