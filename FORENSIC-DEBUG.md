# Forensic Report Generation Debug Guide

## Pipeline Overview
The forensic report generation happens in **5 critical stages**:

### Stage 1: Forensic Engine Execution (forensic-engine-page.js:1582)
- **Location**: `runForensicEngine(pdfBytes, pdfDoc)` 
- **Input**: PDF bytes and PDFDocument object
- **Output**: `{ clean, overallScore, findings[], extractionNotes, ... }`
- **Failure modes**:
  - Text extraction fails (image-only PDF)
  - Detectors crash silently (try-catch at line 1658)
  - No findings found (legitimate clean result)

### Stage 2: AI Review (Optional) (seal-document.html:2089-2128)
- **Location**: `aiAssessFindings()` → `/api/v1/ai/assess`
- **Purpose**: Prune false positives, add AI-identified indicators
- **Failure modes**:
  - Endpoint timeout (10s limit)
  - Malformed response
  - Service unavailable
- **Recovery**: Falls back to engine findings silently

### Stage 3: AI Narrative Generation (Optional) (seal-document.html:1810-1853)
- **Location**: `aiNarrateReport()` → `/api/v1/ai/narrate`
- **Purpose**: Generate AI Narrative Summary section
- **Failure modes**:
  - Endpoint unreachable
  - Invalid response format
  - Returns null/empty
- **Recovery**: `aiNarrativeText` stays null; report still builds without it

### Stage 4: Report PDF Construction (forensic-report.js:1042)
- **Location**: `window.VerumReport.build(opts)`
- **Input**: `{ findings, documents[], identity, ... }`
- **Output**: Uint8Array (PDF bytes)
- **Failure modes**:
  - `opts.findings` is null/undefined (uses default `{ clean: true, findings: [] }`)
  - `opts.findings` is passed but malformed
  - PDF-lib crashes on image embedding
  - Font embedding fails
- **Critical check** (line 1044-1045): 
  ```javascript
  var fr = opts.findings || { clean: true, overallScore: 0, confidence: 'CLEAN', 
                               totalFindings: 0, findings: [], summary: '' };
  ```

### Stage 5: Report Sealing (forensic-report.js:1191)
- **Location**: `window.VerumReport.seal(reportBytes, sealOpts)`
- **Purpose**: Add QR code, navy footer, VO-SEAL2 hash
- **Failure modes**:
  - QR data URL is invalid
  - PDF loading fails
  - Hash patching fails (VO-SEAL2 fallback to legacy)

---

## Debug Checklist: Why No Forensic Report on Greensky File

### ✓ Check #1: Is the forensic engine running?
**Console output**: Look for:
```
Building forensic report...
```
in the step update logs.

**Expected in DevTools Console**:
- No `Detector X failed:` warnings (unless detectors are throwing)
- No `VerumReport: pdf-lib is required` error

### ✓ Check #2: Are findings being passed to VerumReport.build()?
**At line 2191**, add inline logging:
```javascript
console.log('reportFraudResult before VerumReport.build:', reportFraudResult);
console.log('Findings count:', reportFraudResult?.findings?.length || 0);
```

**Expected**: 
- `reportFraudResult` is an object with `{ findings: [...], overallScore, etc. }`
- Even if findings array is empty, it should be present

### ✓ Check #3: Is VerumReport.build() throwing an error?
**Wrap at line 2191** (already has try-catch, but add logging):
```javascript
console.log('Calling VerumReport.build with:', {
  findings_count: reportFraudResult?.findings?.length,
  documents_count: 1,
  sealMode: sealMode
});
```

**Expected**: Build completes and `reportBytes` is a Uint8Array

### ✓ Check #4: Is the report getting sealed?
**At line 2229**, check:
```javascript
console.log('VerumReport.seal called, reportBytes size:', reportBytes?.length);
console.log('Seal returned:', rSealedBytes?.length, 'bytes');
```

**Expected**: Sealed report is larger than original (added header/footer/QR)

### ✓ Check #5: Is reportPack being set correctly?
**At line 2235**:
```javascript
console.log('reportPack set:', reportPack !== null);
if (reportPack) {
  console.log('reportPack:', { 
    size: reportPack.bytes?.length, 
    sealId: reportPack.sealId,
    sha512: reportPack.sha512?.substring(0,16) + '...'
  });
}
```

**Expected**: `reportPack` is not null and contains valid data

---

## Specific Greensky Issue Analysis

### Theory #1: Empty Findings = No Report Display
**Status**: Ruled out (code shows report builds even with 0 findings)

Even if detectors find nothing, `VerumReport.build()` will:
- Create a 15+ page report
- Show "No contradictions were detected"
- Still get sealed and downloaded

### Theory #2: VerumReport Not Loaded
**Check**: Browser DevTools → Sources → forensic-report.js
- Verify the file loaded (Ctrl+F "VerumReport")
- Check for 404 on script load (Network tab)

**Fix**: Ensure line 529 in seal-document.html:
```html
<script src="/forensic-report.js?v=1.4.1-20260720"></script>
```
is not returning 404.

### Theory #3: Findings Object Malformed
**Problem**: If `reportFraudResult.findings` is not an array:
```javascript
// This would silently fail:
var all = (data.findings && data.findings.findings) || [];
```

**Fix**: Ensure `runForensicEngine()` returns:
```javascript
{
  findings: [],  // Array, not object or null
  clean: boolean,
  overallScore: number,
  ...
}
```

### Theory #4: aiNarrateReport Timeout Blocks Report Build
**Problem**: If `/api/v1/ai/narrate` hangs for >10s:
```javascript
var res = await aiApiPost('/api/v1/ai/narrate', metadata, 10000);
```

The entire try-catch block (2183-2242) is in a try-catch, so it should still recover. But if the error throw is unhandled...

**Fix**: Check seal-document.html line 2238:
```javascript
} catch (repErr) {
  console.warn('Forensic report generation failed (document seal unaffected):', repErr);
  reportPack = null;
  updateStep(7, 'complete');
}
```

If this is firing, `repErr` will tell us what failed.

---

## Instrumentation: Add Detailed Logging

### Step 1: Inject logging into forensic-report.js
**At line 1042**, before `async function build(opts)`:
```javascript
// DEBUG: log all calls to build
var _BUILD_CALL_COUNT = 0;
var _originalBuild = build;
build = async function(opts) {
  _BUILD_CALL_COUNT++;
  console.log('[VO-REPORT] build() call #' + _BUILD_CALL_COUNT, {
    findings_provided: !!opts.findings,
    findings_is_array: Array.isArray(opts.findings?.findings),
    findings_length: opts.findings?.findings?.length || 0,
    documents_count: opts.documents?.length
  });
  try {
    var result = await _originalBuild.call(this, opts);
    console.log('[VO-REPORT] build() succeeded, bytes:', result?.length);
    return result;
  } catch(e) {
    console.error('[VO-REPORT] build() failed:', e.message);
    throw e;
  }
};
```

### Step 2: Inject logging into seal-document.html
**At line 2184**, add:
```javascript
console.log('[SEAL-FLOW] Stage 7: Forensic report generation');
console.log('[SEAL-FLOW] sealMode:', sealMode);
console.log('[SEAL-FLOW] VerumReport available:', !!window.VerumReport);
console.log('[SEAL-FLOW] reportFraudResult:', {
  clean: reportFraudResult?.clean,
  score: reportFraudResult?.overallScore,
  findings_count: reportFraudResult?.findings?.length,
  scanFailed: reportFraudResult?.scanFailed
});
```

**At line 2238**, add:
```javascript
console.error('[SEAL-FLOW] Report generation error:', {
  message: repErr?.message,
  stack: repErr?.stack?.substring(0, 200)
});
```

---

## Browser DevTools Console Checks

**NEW (v1.4.1-20260720+)**: Instrumentation added to seal-document.html and forensic-report.js

### Automatic Logging
When sealing with "Forensic Analysis + Report" mode, check DevTools Console for messages prefixed with:
- `[VO-REPORT-DEBUG]` — Report build pipeline status
- `[VO-AI-NARRATE]` — AI narrative endpoint response
- `[VerumReport.build]` — PDF construction
- `[VerumReport.seal]` — Seal application

### Manual Console Checks

Run these in console after sealing a Greensky document:

```javascript
// Check automatic logging output
console.log('Search DevTools Console for: [VO-REPORT-DEBUG], [VO-AI-NARRATE], [VerumReport]');

// Check if VerumReport loaded
console.log('VerumReport:', typeof window.VerumReport);
console.log('VerumReport.build:', typeof window.VerumReport?.build);

// Check if reportPack was created
console.log('Report pack:', window._voReportPack);
if (window._voReportPack) {
  console.log('Report successfully created:', {
    size_kb: (window._voReportPack.bytes?.length / 1024).toFixed(2),
    seal_id: window._voReportPack.sealId,
    ots_submitted: window._voReportPack.ots?.success
  });
}

// Check the raw fraud result
console.log('Fraud result:', {
  clean: window._voFraudResult?.clean,
  score: window._voFraudResult?.overallScore,
  findings: window._voFraudResult?.findings?.length
});

// If no report, check for errors
if (!window._voReportPack) {
  console.log('No report created. Debugging:');
  console.log('1. sealMode was "forensic":', window._voSealMode);
  console.log('2. Fraud analysis ran:', !!window._voFraudResult);
  console.log('3. VerumReport loaded:', !!window.VerumReport);
  console.log('4. Filter console for ERROR or WARN messages');
}
```

---

## Recovery Steps: If Report Doesn't Generate

### Scenario A: VerumReport Not Loaded
**Fix**: Check file exists:
```bash
ls -lh /home/user/webdocsol/forensic-report.js
```

If 404: ensure web server serves the file at `/forensic-report.js`.

### Scenario B: Findings Array Malformed
**Fix**: Add validation in seal-document.html at line 2191:
```javascript
if (!Array.isArray(reportFraudResult.findings)) {
  console.warn('Findings not an array, converting...');
  reportFraudResult.findings = [];
}
```

### Scenario C: PDF-lib Crashes During Build
**Fix**: Wrap image fetch in better error handling (forensic-report.js:1070-1073):
```javascript
if (!logoBytes) logoBytes = await fetchPng('/images/logo-full.png').catch(e => null);
if (!wmBytes) wmBytes = await fetchPng('/images/watermark_portrait.png').catch(e => null);
```

### Scenario D: VO-SEAL2 Hash Patching Fails
**Fix**: Check forensic-report.js:1180-1189 for fallback to legacy VO-SEAL.

---

## Next Steps

1. **Open browser DevTools** while sealing Greensky file
2. **Run the console checks** above
3. **Look for errors** in Console tab
4. **Check Network tab** for failed requests (especially `/api/v1/ai/narrate`)
5. **Share the console output** + Network waterfall
6. I can then pinpoint the exact failure point

