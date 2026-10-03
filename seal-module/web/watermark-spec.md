# Watermark Specification

Describes the live root `seal-document.html` (`buildSealedPDF`; checked 3 October 2026). The
HTML files in this folder are older, unserved snapshots and draw the seal differently
(`../SPEC.md` §10). Where this file and the root code disagree, the code is right.

## Image
- File: `images/watermark_portrait.png` (repository root; served at `/images/watermark_portrait.png`)
- Dimensions: 927 x 1200 pixels
- Format: PNG with transparency (RGBA)
- Aspect ratio: 0.7725 (portrait)

## Application
- Drawn on every page over the original content (an overlay; pdf-lib appends it to the page), centred on the original page area. The added header and footer bands are opaque.
- Opacity: 20% (0.20)
- Scale: cover entire page (max of width/height ratios)
- If the image cannot be fetched after a retry, the seal proceeds without it

## Page geometry
- The original content is not scaled or moved (88% scaling was removed in v1.2.6; it corrupted content streams)
- A page whose CropBox hides part of its MediaBox is first reset to the full MediaBox
- Each page is extended: a footer band (2% of page height + 3 × 1.8% of the shorter side) below, and a header band (QR panel + 10 pt) above. The seal furniture owns only the added space.

## QR Code Position
- Panel side: max(5.1% of min(page width, page height), 26 pt), in the header band, 8 pt from the right edge, centred vertically
- White panel (opacity 0.95) behind the QR; QR inset 2 pt; no border
- QR generated at 400 px, error correction H
- Left of the band, gold: "VERUM OMNIS SEALED ORIGINAL — scan the code or verify at verumglobal.foundation/verify.html"

## Footer
- Navy band added below the page, opacity 1
- Top row, gold bold: `PRIVATE SEAL — FREE TIER` or `COMMERCIAL SEAL — <CLIENT>`, then `  |  Chain: N prev` when there are earlier seals
- Top row, grey, right-aligned: `verumglobal.foundation  |  OpenTimestamps  |  Patent Pending`
- Bottom row, blue-grey: `VERUM OMNIS SEALED ORIGINAL  |  Seal: VO-…  |  SHA-512: <first 16 hex>...  |  dd/mm/yyyy HH:MM:SS <IANA zone>  |  p/n` (+ chain label). The time is the sealing device's local clock
- The grey site text and the bottom row shrink to fit (minimum 3.5 pt); the site text never starts before the end of the gold label

## Other layouts
- Password cover page (page 1 of a protected file): navy page, watermark at 15% opacity, "DOCUMENT PROTECTED", sender email if given
- Sealed forensic report and court-ready narrative (`VerumReport.seal`): 64 pt QR panel top-right, over the report's own header, labelled "VERIFY SEAL"; 34 pt navy footer (opacity 0.97): `VERUM OMNIS SEALED ORIGINAL  |  <seal ID>  |  <first 16 hex>…<last 8 hex>  |  p/n`, then a second row with the time (UTC), the site line and a tag (e.g. `FORENSIC REPORT`)
