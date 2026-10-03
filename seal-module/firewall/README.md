# Guardian Fraud Firewall Implementation Reference

## Overview

This directory is a reference sketch for the Guardian Fraud Firewall (`Liamhigh/firebase`), not its code. As last checked (3 Oct 2026, b2aff38), its sealer is TypeScript, `fraud-firewall/src/seal/` (`documentSealer.ts`, `sealMetadata.ts`, `openTimestamps.ts`), using pdf-lib and the `qrcode` npm package. The firewall depends on this site's `/api/v1/rules/manifest` and `verify.html?h=&m=`, which never move (CLAUDE.md non-negotiable 6). The sealing standard is `../SPEC.md`; where this file and `../SPEC.md` differ, `../SPEC.md` is right.

## Key Differences from Web

| Aspect | Web | Firewall |
|--------|-----|----------|
| PDF library | pdf-lib (JS) | pdf-lib (TypeScript) |
| QR generation | qrcodejs | qrcode (npm) |
| OCR | tesseract.js on the device, for pages with no text layer | Tesseract 5.x / EasyOCR |
| GPS | Browser geolocation | Server location (datacenter) |
| Device info | navigator.* | Server hardware info |
| Hashing | crypto.subtle | hashlib (Python stdlib) |
| Scale | Single user | Batch processing, multiple workers |

## Dependencies

Earlier Python design; not what `fraud-firewall/src/seal/` uses (that is TypeScript, above). Kept for reference only.

```bash
pip install pikepdf qrcode[pil] pytesseract pdf2image pillow
# Optional GPU OCR:
pip install easyocr
```

## Enterprise Chunk Configuration

```python
CHUNK_CONFIG = {
    "standard_server": {"chunk_size": 100, "workers": 4},
    "high_performance": {"chunk_size": 200, "workers": 8},
    "gpu_enabled": {"chunk_size": 500, "workers": 16, "ocr": "easyocr"}
}
```

## Triple AI Verification

Firewall design as written; not implemented in this repository and not checked against `Liamhigh/firebase`. The website's AI review is a single advisory model call (Llama 3.3 70B) through the Worker (`/api/v1/ai/assess`), never a multi-model consensus.

Before extracted text reaches the Contradiction Engine:

1. **Gemma 3** — verifies text coherence, flags garbled output
2. **Phi-3** — checks legal document structure preserved
3. **9-Brain Engine** — validates forensic markers (dates, amounts, names)

If any model flags issues → re-trigger SK04 (OCR) and SK06 (Encoding Repair) with stricter params.

## Watermark Asset

The watermark PNG must be available at:
```
/static/images/watermark_portrait.png
```

(Firewall path. On the website the same file is `images/watermark_portrait.png`, served at `/images/watermark_portrait.png`.)

Same specifications as web: 927x1200px, RGBA, 20% opacity when drawn.

## Batch Processing

```python
from concurrent.futures import ProcessPoolExecutor

def batch_seal_documents(file_list, config):
    with ProcessPoolExecutor(max_workers=config["workers"]) as executor:
        futures = {
            executor.submit(seal_single_document, f, config): f
            for f in file_list
        }
        for future in futures:
            result = future.result()
            yield result
```

## Metadata Schema

Same payload and URL as the website (`../SPEC.md` §9): `{v, t, type, sha512, otsDigest, otsStatus, sealId, chain?}`, with identity, GPS and device only on explicit opt-in. Parsers must accept any field being absent. As last checked (3 Oct 2026, b2aff38), the firewall writes the legacy `VO-SEAL` Subject and scales content to 88%; the website writes `VO-SEAL2` (`../SPEC.md` §8). verify.html reads both. The firewall fetches this site's rule manifest (`fraud-firewall/src/core/ruleUpdate.ts`) and builds the QR in `fraud-firewall/src/seal/sealMetadata.ts` (AGENTS.md, "Other repositories that depend on this one").
