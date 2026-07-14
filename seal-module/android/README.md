# Android Implementation Reference

## Overview

This directory contains the reference specification for implementing the Verum Omnis Document Sealing Standard on Android.

## Key Differences from Web

| Aspect | Web | Android |
|--------|-----|---------|
| PDF library | pdf-lib (JS) | iText or PDFBox (Kotlin/Java) |
| QR generation | qrcodejs | ZXing |
| OCR | N/A (browser) | ML Kit Text Recognition v2 |
| GPS | navigator.geolocation | FusedLocationProvider |
| Device info | navigator.* | Build.*, ActivityManager |
| Hashing | crypto.subtle | MessageDigest |
| Storage | Memory | Files (scoped storage) |

## Dependencies

```kotlin
// build.gradle.kts
implementation("com.google.mlkit:text-recognition:16.0.0")
implementation("com.google.zxing:core:3.5.2")
implementation("com.itextpdf:itext7-core:8.0.2")
// or: implementation("org.apache.pdfbox:pdfbox:3.0.0")
```

## Chunked Extraction (Memory Management)

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

Same JSON schema as web. Encode to base64, embed in QR code URL:
```
https://verumglobal.foundation/verify.html?h=<SHA512_PREFIX>&m=<BASE64_METADATA>
```

## Password Protection

Use iText `PdfEncryptor` or PDFBox `StandardProtectionPolicy`:

```kotlin
val policy = StandardProtectionPolicy(password, password, permissions)
policy.encryptionKeyLength = 256 // AES-256
```

## Progress Reporting

```kotlin
interface ExtractionProgress {
    fun onStage(stage: String)
    fun onProgress(percent: Int)
    fun onPageExtracted(pageNum: Int, total: Int)
    fun onCompleted(report: ExtractionReport)
    fun onError(stage: String, error: String)
}
```
