# Guardian Fraud Firewall Implementation Reference

## Overview

This directory contains the reference specification for implementing the Verum Omnis Document Sealing Standard on the Guardian Fraud Firewall (enterprise Python backend).

## Key Differences from Web

| Aspect | Web | Firewall |
|--------|-----|----------|
| PDF library | pdf-lib (JS) | pikepdf / PyPDF2 |
| QR generation | qrcodejs | qrcode (Python) |
| OCR | N/A | Tesseract 5.x / EasyOCR |
| GPS | Browser geolocation | Server location (datacenter) |
| Device info | navigator.* | Server hardware info |
| Hashing | crypto.subtle | hashlib (Python stdlib) |
| Scale | Single user | Batch processing, multiple workers |

## Dependencies

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

Same JSON schema as web and Android. All three platforms must produce identical metadata structures for cross-platform verification.
