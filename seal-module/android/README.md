# Android Implementation Reference

## Overview

This directory contains the reference specification for implementing the Verum Omnis Document Sealing Standard on Android. The app itself is `Liamhigh/1verum` (Kotlin); this file is a reference sketch, not its code. The app depends on two URLs this site serves: `https://verumglobal.foundation/api/v1/rules/manifest` and `verify.html?h=<first 32 hex>&m=<metadata>`. Neither may move (CLAUDE.md non-negotiable 6). The sealing standard is `../SPEC.md`; where this file and `../SPEC.md` differ, `../SPEC.md` (and the root `seal-document.html` it describes) is right.

## Key Differences from Web

| Aspect | Web | Android |
|--------|-----|---------|
| PDF library | pdf-lib (JS) | pdfbox-android (com.tom-roush; last checked 3 Oct 2026) |
| QR generation | qrcodejs | ZXing |
| OCR | tesseract.js on the device, for pages with no text layer (vendored) | ML Kit Text Recognition |
| GPS | navigator.geolocation | FusedLocationProvider |
| Device info | navigator.* | Build.*, ActivityManager |
| Hashing | crypto.subtle | MessageDigest |
| Storage | Memory | Files (scoped storage) |

## Dependencies

```kotlin
// As used by Liamhigh/1verum (gradle/libs.versions.toml at fc613de, checked 3 Oct 2026):
// com.tom-roush:pdfbox-android:2.0.27.0
// com.google.zxing:core:3.5.3
// com.google.mlkit:text-recognition:16.0.1
// com.google.mlkit:barcode-scanning:17.3.0
```

The app's own build files are the authority; these versions can drift. There is no iText.

## Seal format (must match the website)

Seal ID `VO-` + first 12 hex of the original SHA-512, upper case. Subject per `../SPEC.md` §8. OTS digest = SHA-256 of the 128-character lowercase SHA-512 hex text. As last checked (3 Oct 2026, fc613de), the app writes the legacy `VO-SEAL|SHA512|SEAL_ID[|CHAIN:…]` Subject and scales content to 88%; the website writes `VO-SEAL2` and no longer scales. verify.html reads both.

## Chunked Extraction (Memory Management)

Illustrative sketch; not checked against the app's code.

```kotlin
object ChunkConfig {
    fun getChunkSize(): Int {
        val maxMemoryMB = Runtime.getRuntime().maxMemory() / (1024 * 1024)
        return when {
            maxMemoryMB > 512 -> 50
            maxMemoryMB > 256 -> 20
            maxMemoryMB > 128 -> 10
            else -> 5
        }
    }
}
```

## OCR with ML Kit

```kotlin
class PageOcrProcessor {
    private val recognizer = TextRecognition.getClient(
        TextRecognizerOptions.DEFAULT_OPTIONS
    )
    
    suspend fun ocrPage(bitmap: Bitmap): String {
        val inputImage = InputImage.fromBitmap(bitmap, 0)
        val result = recognizer.process(inputImage).await()
        return result.textBlocks.joinToString("\n") { it.text }
    }
}
```

## Metadata Schema

Same payload as the website (`../SPEC.md` §9): `{v:"1.2", t, type, sha512, otsDigest, otsStatus, sealId, chain?}`; identity (`id`), `gps`, `acc` and `dev` only on the sealer's explicit opt-in. URL:
```
https://verumglobal.foundation/verify.html?h=<first 32 hex of the original SHA-512>&m=<encodeURIComponent(base64(UTF-8 JSON))>
```
This URL shape is a contract and never moves.

## Password Protection

Use PDFBox `StandardProtectionPolicy`:

```kotlin
val policy = StandardProtectionPolicy(password, password, permissions)
policy.encryptionKeyLength = 256 // AES-256
```

The website writes the Standard Security Handler with RC4-128, revision 3 (`pdf-encrypt.js`), for reader compatibility. Android may use AES-256 through PDFBox; both open in ordinary readers with a password prompt. Encryption hides the seal Subject, so a protected copy is checked on verify.html only after it is decrypted (verify.html decrypts the website's `.voice` fallback itself, not a password-protected PDF).

## Progress Reporting

Illustrative sketch; not checked against the app's code.

```kotlin
interface ExtractionProgress {
    fun onStage(stage: String)
    fun onProgress(percent: Int)
    fun onPageExtracted(pageNum: Int, total: Int)
    fun onCompleted(report: ExtractionReport)
    fun onError(stage: String, error: String)
}
```
