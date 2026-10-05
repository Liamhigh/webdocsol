# Forensic Report Generation Debug Guide

> **This guide names functions, not line numbers.** The files move every release; find a
> function with `grep -n 'function voPreflightForensicService' seal-document.html`. The five
> forensic scripts (`forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`,
> `ots-proof.js`, `pdf-encrypt.js`) run from their inlined copies in `seal-document.html`,
> between `/* VO-INLINE:<file>:START/END */` markers (ENGINE.md §9), so a line in the source
> file is not the line that runs. The live page is `seal-document.html` at the repository root;
> `seal-module/web/seal-document.html` is a snapshot in the portable sealing spec and is never
> served (`.assetsignore`). The current engine and report contract is [`ENGINE.md`](./ENGINE.md).

---

## Start here: a failed seal or a missing report

1. Open `/api/v1/site/health` on the same host the seal page came from. JSON with `ok: true`
   means the forensic service is there; a web page means it is not (first row below).
2. Read the step detail lines. The engine's result is on "Forensic Scan". The AI review, the
   Brain 9 sweep, the report narrative, both reports and the certificates run under step 7,
   "Finalize", which reopens after step 8 (SHA-512) has ticked.
3. In DevTools: `window._voReportDebug` (mode, findings count, stage), `window._voReportPack`
   (technical report), `window._voHumanReportPack` (court-ready narrative),
   `window._voFindingsJson`, `window._voLastAiError` (the last AI call that failed, and why),
   `window._voRulePackageStatus`. `sealMode` and `_pipelineFraudResult` are page-level `let`
   bindings: type them bare, not as `window.…`.
4. Filter the console for `[VO-REPORT-DEBUG]`, `[VO-AI]`, `[VO-AI-NARRATE]`, `[VO-HUMAN]`,
   `[VerumReport.build]`, `[VerumReport.seal]`, `[SEAL-GUARD]`, `Forensic engine error:` and
   `SEALING ERROR:`.
5. The AI steps (review, Brain 9 sweep, report narrative, court-ready narrative) run only in
   "Seal document with forensic report", and only when the scan did not fail and the engine
   recorded at least one finding. A clean scan gets the technical report and the findings JSON,
   and no court-ready narrative.
6. To reproduce the engine in Node, load `vendor/pdf-lib.min.js` with `new Function` and call
   `require('./forensic-engine-page.js').runForensicEngine(bytes, pdfDoc, onProgress, opts)`, as
   `tests/engine-perf.test.mjs` does (`tests/annexure-eb-regression.test.mjs` §15 does the same
   for `extractPageText` alone).

---

## Symptom → cause → guard

Field failures reported by the founder, each with the guard that now prevents it. If one of
these reappears, the guard was weakened — find out how before changing anything else.

| Symptom the user sees | Cause | Guard (do not remove) |
|---|---|---|
| "Seal document with forensic report" stops before anything is read: an alert and an on-page notice say "Seal document with forensic report needs the forensic service, and <host> has none: it answered with a web page instead of the service…" (or "…could not be reached from <host>", or "…reports itself unhealthy") | The address the page was opened from has no forensic API. In the annexure EB run (the guard shipped on 2026-09-11, #203) that was the old Pages host, which answered every POST with 405. From 2026-09-24 the Pages project handed every request to the Worker (the bridge, `functions/[[path]].js`), and since 2026-09-27 both public hostnames reach the Worker through two zone routes, so the bridge is dormant except on `verumglobal.pages.dev` itself (DEPLOYMENT.md "Resolved (2026-09-27)", confirmed from outside that day). Today it means a copy of the page served from elsewhere, the bridge on `verumglobal.pages.dev` failing to reach the Worker, or a routing regression. Forensic mode pre-flights `/api/v1/site/health` (8 s, one retry on a dropped connection or a timeout) and refuses to seal an unreviewed forensic report. | `voPreflightForensicService` and `voPreflightMessage` (ENGINE.md §12.10 item 5); open the Worker address the notice names, or choose Seal document |
| A finding's evidence ends "[OCR page: weight reduced until the quoted characters are verified against the page image]" | Every page the finding cites was OCR-recovered and the finding is a character-sensitive check (registration, VAT, identity or account number, section number, definition, figure, date, signature mark). | `voCapOcrFormatFindings` (§12.10); read the page image, then judge |
| The browser asks "This bundle has N more scanned pages beyond the standard on-device OCR limit of 200 … OK = read them all now. Cancel = keep the limit" | The bundle has more image-only pages than `VO_OCR_MAX_PAGES`; the person sealing decides once. Cancel keeps the limit and the report names the unread pages on its cover. | `voOcrAskToContinue` (§12.10) |
| The cover says "INCOMPLETE READ: N pages not read" (or, on a report sealed before 5 October 2026, "AI REVIEW NOT RUN" with NOT REVIEWED in section 4) | True statements: pages were left unread, or the advisory AI review did not run. Not a bug — the report is honest about its own limits. Since 5 October 2026 the AI review's absence is stated in section 7, not on the cover: no finding depends on it. | §12.10 item 4, §12.16; do not relabel |
| The Findings & Contradiction Matrix has "AI Review Notes on Engine Findings", or the AI section says the review noted K findings as unsupported | The advisory model judged the quoted text not to show what the finding says. The finding stands as the engine produced it (founder ruling, 5 October 2026); the note is advice to the reader and a signal to the feedback loop. If the model is right, the fix is a detector guard with a regression test, never a removal by the model. | `aiAssessFindings` (seal page), `ENGINE.md` §4.10 and §12.16 |
| A sealed quote differs from the record by a missing full stop, slash or bracket ("R2313 Million" for "R231.3 Million") | Fixed 2026-09-11: the extractor dropped punctuation-only glyphs on per-glyph PDFs. A report sealed before that date carries the defect; re-seal on current code. | `_voGlyphTokens` / `_voMergeGlyphRuns` (§12.10 item 1) |
| The report says "Signed rule package: none applied — built-in rules only (this address answered with a web page instead of the rules service)" | The page was served by a host that has no API (on 2026-09-07 both public hostnames, DEPLOYMENT.md "Superseded — the 2026-09-07 diagnosis"; resolved 2026-09-27, so today a copy served from somewhere other than the Worker) — the manifest fetch got HTML. The scan still ran every built-in detector; only the additive package rules were absent. On a phone that had verified a package before, the cached copy applies instead. | `voLoadRulePackage` names the reason; `tests/rule-package.test.mjs` locks the reasons and the cache |
| The report's Methodology says "Brain 9 (R&D) sweep of the sealed text: NOT RUN (…)" or "…: not run.", or the results panel shows no Brain 9 box | "NOT RUN (reason)": the sweep was attempted and read no window. The endpoint was unreachable or failed (the reason is `window._voLastAiError`), or no page carried enough text. "not run." with no reason: the sweep was never attempted, because of Seal document mode, a failed scan, an engine result with no findings (the AI step runs only when the engine recorded at least one), or no page text at all. There has been no review switch to untick since 2026-09-07. The engine findings stand; nothing was hidden. | `aiBrain9Sweep` never throws into the seal; `brain9SweepLine` prints the reason; `tests/rule-package.test.mjs` §9 pins both lines. ENGINE.md §12.8 |
| The rule-package status names a version nobody published by hand (e.g. v1.1.1) | The trainer run published it: anonymous signals reached the support threshold and a validated co-occurrence rule was appended. `GET /api/v1/rules/changelog` shows the version, the signal and the phrases. To undo, publish a higher version by hand. | ENGINE.md §12.9; the trainer is additive only and candidate tier |
| A Brain 9 recommendation is "missing" from the sealed PDF | By design: Constitution v8 §2.10 keeps B9 output outside sealed reports. It is on the results panel and in `…-brain9-recommendations.json`; the PDF states only pages read and counts. | ENGINE.md §12.8; `tests/rule-package.test.mjs` §9 locks that recommendations never enter `reportFraudResult` |
| The report says the package applied but a curated rule "did not fire" | A phrase pair fires only where both phrases sit in one 80-character passage on one page (a phrase found only inside its opposite, "paid" in "not paid", does not count) and no built-in finding of the same type already reports that page (withheld, and counted in the same line). A co-occurrence group fires only when at least `min` distinct phrases sit inside the 3-page window. Only the seed's twelve groups (FK01–FK12, `VO_ENGINE_OWN_RULE_GROUPS`) are skipped as the engine's own vocabulary; since 2026-09-07 a curated group whose `source_detector` names a built-in detector (v1.1.0's FK13/FK14 say D37) is applied. Terms and markers are never executed. | `voCompileRulePackage`, `voRunPackageRules`; ENGINE.md §12.7 |
| **OCR stops at page 3–4 and stays there forever** | a Tesseract worker killed by the OS OOM killer leaves `recognize()` as a promise that never settles | `voOcrDeadline` + worker retirement (`deadWorkers`) + empty-pool exit + raster cap + `deviceMemory <= 4 → POOL 2`. `ENGINE.md` §12.1 |
| **Seal footer or QR prints over a signature** | seal furniture drawn inside the original media box | pages are EXTENDED: `setMediaBox` / `setCropBox` grow the page, furniture draws in the new margin. `ENGINE.md` §12.2 |
| **"Downloads but no share sheet"** (Samsung Internet) | `saveFiles()` fired after `navigator.share()` and the download UI dismissed the sheet | `saveFiles(files)` is called **before** `navigator.share(data)`. `ENGINE.md` §12.3 |
| **"It asks do you want to download"** (incognito) | several simultaneous downloads trip the browser's multiple-download prompt, which never persists in a private window | multiple files save as ONE store-only ZIP (`voZipBundle`). `ENGINE.md` §12.3 |
| **Report says "No parties were supplied" above a finding that names someone** | parties read from user input instead of the record | `documentParties` → `effectiveParties`, from `anchor.who`, deduped by `samePartyName`. AGENTS.md ruling 7 |
| **A location prints as `—`, or "Page 89 vs Page 89"** | `pageAnchor` matched only singular "Page N" and did not dedupe | `pageNumbers` is plural/list-aware and dedupes; `—` now means the finding failed the anchor rule and should not be on the page at all |
| **A quote is cut mid-number (`R3 800 000. 00`) or ends at `"Mr."`** | naive sentence splitting on `.` | `splitSentences` masks non-terminal periods before splitting. `ENGINE.md` §4.14 |
| **Hedging or "red flag" wording in the plain-language section** | worker narrative rendered without gating | `scrubNarrative` drops prohibited sentences; `voGatePasses` falls back to the deterministic narrative. `ENGINE.md` §4.13 |
| **Section 5 count disagrees with the executive summary, or an entry reads `4. "" — Anchor: —.`** | AI candidates and unanchored items reaching SEALED FINDINGS | `secSealedFindings` excludes `source === 'ai'`, empty locations and empty quotes. `ENGINE.md` §4.12 |
| **The scan never starts, no error in the UI** | a regex lookbehind on Safari < 16.4 — it throws at **parse** time and kills the whole script | no lookbehind in new code. `ENGINE.md` §4.16 |
| **An AI candidate typed with a CT code, or a Brain 9 recommendation, never reaches the feedback loop** | someone restored the old CT01–CT46 exclusion (`/^CT(0[1-9]\|[1-3][0-9]\|4[0-6])$/`) in `shareAnonymousPatterns`; it was removed on 2026-09-07 because "the engine missed a CT01 here" is the loop's most useful signal | only SERIAL and empty types are skipped; candidates travel as `AI_IDENTIFIED` / `AI_IDENTIFIED_UNANCHORED` with their type, recommendations as `B9_RECOMMENDATION`, the four anonymous fields only. Do not add a CT range filter when a CT is added: `tests/worker.test.mjs` and `tests/rule-package.test.mjs` fail if it returns. `ENGINE.md` §12.4 |
| **The court-ready narrative omits unread pages, OCR provenance or the home jurisdiction** | `unreadPages` / `ocrPages` / `gps` passed to `build` but not to `buildHumanReport` | pass the same option bag to both. The plain-language PDF (`buildNarrative`) left the seal page on 2026-09-07; it stays in forensic-report.js for its tests and needs the same options if it is ever called again. `ENGINE.md` §12.5 |
| **A distributed Seal Certificate shows an ID number, address or GPS** | identity options reached the shareable certificate build | shareable cert passes no identity opts AND `buildSealCertificate` gates the block on `includePrivate` — two latches, both required. `ENGINE.md` §12.6 |
| **A heading numbered 9 has sub-clauses numbered 10.1** goes unreported | D37's clause-numbering check weakened | forward jump of 1–3, no intervening heading, first sub-clause only. `ENGINE.md` §4.17 |
| **"Perjury" appears in a sealed report as a finding** | someone "improved" oath context into a flag | the word is allowed only in candidate-law lines; engine output never contains it. Test-locked. `ENGINE.md` §4.18 |
| **An index line "Supplementary Affidavit, 9pp" is tagged as sworn** | weak oath markers accepted singly | one weak marker never tags; two distinct weak markers or one strong execution formula required. `ENGINE.md` §4.18 |
| **A finding quotes an OCR-recovered page with no provenance note** | `ocrPages` not passed, or the `ocrTouched` check removed | the host records `_voOcrRescuedPages` and passes it as `ocrPages` to `build` and `buildHumanReport`; FINDINGS IN DETAIL marks affected findings through `ocrTouched` (exported for tests as `_ocrTouched`). PD6; `ENGINE.md` §12.5, §12.10 item 3 |
| **The seal never leaves step 1 ("GPS + Device — processing")** | the Geolocation `timeout` option does not cover the permission prompt; an ignored or never-shown prompt leaves `getCurrentPosition` silent forever | `captureGPS` races the prompt against `VO_GPS_HARD_DEADLINE_MS` (15 s) and continues; step 1 completes with "GPS declined". Reproduced headless 2026-09-06 (526 s stall). |
| **Logos broken, or every page opens as the home page** | the request reached the Worker and an upstream that does not have the file answered (KV without the image key; the stale Pages origin, which 200-serves its home page for anything) | the site-serving chain (`serveSite` in `worker/static-proxy.js` for pages: assets → main branch on GitHub → Pages; `serveSiteImage` in `worker/verum-rules.js` for the two images: assets → main branch → KV → embedded copies) and `GET /api/v1/site/health`, which names the tier. DEPLOYMENT.md "The serving chain" (under "Static Assets"). |
| **Every section of the court-ready narrative says "AI narrative not generated"** | the AI service was not reachable from the page — since 2026-09-07 the note names the case: a web page came back instead of the API (a host with no API; on 2026-09-07 that was the public domain, resolved 2026-09-27), the service could not be reached, it timed out, the model was unavailable, or the server gate discarded the draft; also the five-minute budget passed, an unexpected answer shape, or an empty draft | `failReason` in `aiHumanReport` and the `reasonText` map in `buildHumanReport`; open `/api/v1/site/health` on the same host the page came from. `ENGINE.md` §13 |
| **A WhatsApp chat export (.zip) adds nothing, or the panel says the browser "cannot unpack compressed archives"** | the archive is unpacked on the device by `voUnzip`; deflated entries need `DecompressionStream('deflate-raw')` (Chrome 80+, Samsung Internet 13+, Safari 16.4+); an encrypted or ZIP64 archive is refused by name | `voExpandZips` runs before the intake on every selection and writes a plain-language note (`#zipNote`) saying what was unpacked and what was not used; the single-note path is untouched. `ENGINE.md` §12.6a; `tests/zip-intake.test.mjs` |
| **A finding quotes a Verum Omnis report's own words** (a "goodwill forfeiture contradiction" heading, an "…Unsigned Agreements…" title on 40 pages) | a prior Verum Omnis report is bound into the bundle and its pages were scanned as evidence | `voExcludeSecondaryReportPages` replaces masthead and running-title pages in place and the extraction note says "Prior Verum Omnis report: N page(s) … excluded". If the note is absent, the masthead was not recognised: check the page text for `Report Reference: VO-` or the brand beside FORENSIC (EVIDENCE) REPORT, COURT-READY NARRATIVE or NARRATIVE REPORT. `ENGINE.md` §12.11 item 1, §12.12 item 1 |
| **CT44 pairs "the Franchisee is not the owner" with "All Fuels, the Owner/Lessor"** | side alignment in D38 removed, or the side read from a fixed character window instead of the phrase's own sentence | `sideNear` takes the role word nearest the phrase, read back to the start of its own sentence (at most 300 characters); a lessee clause pairs only with an ownership line about the same side or none. `ENGINE.md` §12.11 item 2, §12.13 item 4 |
| **The report's lead says "integrity score of N" or "confidence rating of X"** | the Worker's template narrative reached the reader, or the render gate was loosened | the template prints neither; `VO_BANNED_SENTENCE_RE` drops such sentences whoever wrote them; template text is labelled `local` and never leads. `ENGINE.md` §12.11 |
| **Three different finding counts in one report** (cover, lead sentence, narrative) | the summary was computed before the AI review, or the narrative counted AI candidates | `reportFraudResult.summary` is recomputed on the retained engine findings; `secNarrative` counts `source !== 'ai'` only and tells candidates apart. `ENGINE.md` §12.11 |
| **"AI narrator: not run" although the sections were asked for** | `sectionsAttempted` not passed to `humanProvenance` | the provenance line reads "asked for N sections; no draft passed the server's anchor and language gate". `ENGINE.md` §12.11 |
| **Every seal ends "Sealing Failed — Error: X is not defined" after the pipeline completed** | page-level code called a helper that lives inside one of the five inlined scripts' closures (13 September: `fmtBytes` from forensic-report.js, called by the results panel's size line) | the inlined scripts are closures; the page has its own helpers (`voFmtBytes`). `tests/annexure-eb-regression.test.mjs` §14 scans the page-level script for closure-private names; the results-panel extras are wrapped in try/catch so no decoration can stop the downloads. |
| **A native-text PDF (printed from Chrome/Edge, a markdown export, a saved web page) reads as empty pages, goes to OCR, or its findings quote gibberish** | one-byte character codes decoded as two-byte (`_voDecodeHexString`), or a font name with `_`/`-`/`+` never selected | `_voParseToUnicode` records the code width from the codespacerange; the font-select pattern accepts any PDF name. Test with `extractPageText` from `require('./forensic-engine-page.js')` on the file in Node (`vendor/pdf-lib.min.js` loads via `new Function`, as `tests/annexure-eb-regression.test.mjs` §15 does). `ENGINE.md` §12.11 items 11–12 |
| **The report says every page was read, but the extraction notes say "Prior Verum Omnis report: N page(s) … excluded", and the findings cite only later pages** | before 2026-09-27 the embedded-report rule also matched the platform's own sealed-document footers, so previously sealed exhibits were excluded as "a report" | only a report masthead (the brand beside FORENSIC (EVIDENCE) REPORT, COURT-READY NARRATIVE or NARRATIVE REPORT, or `Report Reference: VO-`) excludes; an exclusion is printed on the unread-pages page, never beside "every page was read". `ENGINE.md` §12.12 item 1 |
| **Page text (Brain 9 windows, the findings JSON) carries runs of CJK characters on sealed pages** | a simple font (pdf-lib's Helvetica: Type1, WinAnsi, no ToUnicode) decoded as UTF-16 when its hex string had even length | the extractor passes the font Subtype; simple fonts decode one byte per glyph. A report sealed before 2026-09-27 carries the garbage in its JSON, not in its findings. `ENGINE.md` §12.12 item 2 |
| **CT02 pairs an amount in one letter with a table header in another** ("amount" is stated as R116 and as R 8000) | space-grouped thousands cut at the space; a label followed by other words read as stating the next number; two exhibits compared as one document | `AMOUNT_RE` reads "R116 124.00"; `CONNECTOR_RE` demands a short join; `voDetectDocuments` reads seal footers as boundaries and D02 never crosses one. `ENGINE.md` §12.12 item 3 |
| **CT18 counts a case reference or a mobile number as a bank account, or names four and lists three** | a 9–12 digit run after "Case Ref: 2026-" or "Mobile +27" | a run joined by `-`/`/`/`.` to other characters, or after a telephone cue or country code, is skipped; every number counted is listed. `ENGINE.md` §12.12 item 4 |
| **CT37 "Multiple email domains: …" on a correspondence bundle** | the old detector listed every domain; the seal footer's own domain was among them | D25 reports lookalike domains only (edit distance 1–2, both from text pages); the platform's domain is boilerplate. `ENGINE.md` §12.12 item 5 |
| **An AI candidate appears as a Triple Verification row, a "top liability" (that table is now "Most serious findings") or a brain finding** | a section filtered on `!isDemoted && type !== 'SERIAL'` without `source !== 'ai'` | `isEngineFinding` in every counting, ranking or law-mapping section; candidates are labelled "AI candidate" where they are listed beside findings. `ENGINE.md` §12.12 item 6 |
| **Parties such as "HOLL YWoODBETS" or "PAYMENT TO HOLLYWOODBETS"** | OCR garbage recurring on a scanned statement | `voLooksLikePerson` rejects case flips, vowel-less words and multiple initials groups; roster names need a text-page mention when the bundle has text pages. `ENGINE.md` §12.12 item 8 |
| **A domain or URL in the narrative reads "standardbank. co. za"** | nested straight quotes broke the sentence splitter's quote masking | a dot followed directly by a letter or digit is inside a token; the Worker template wraps evidence in typographic quotes. `ENGINE.md` §12.12 item 9 |
| **"Impossible date: 0/09/2026" on page after page, or timeline rows dated the seal date** | the platform's own seal footer (date and time on every sealed page) was read as a stated date; OCR drops the leading digit | `voStripSealFurniture` removes the footers before detection (boundaries are cached first, `voCacheDocSegs`); D03 and `voExtractDates` skip a date + clock time only in footer context (`voIsStampContext`); a zero day or month is OCR damage, never an impossible date. `ENGINE.md` §12.13 item 1 |
| **CT20 on an OCR variant of a number printed cleanly elsewhere, or on an "ID/Registration number"** | a slash read as "1", a dropped slash, a misread digit; a form field that takes either number | on an OCR page D11 compares a malformed token with every clean SA number in the bundle (two edits, digits only) and notes the reading, and notes any other malformed token as unreadable; on a text page the Low "one digit off" check stands; an identity-shaped value under an ID/Registration cue is an identity number at any length. `ENGINE.md` §12.13 item 2 |
| **CT08 "term X is defined differently" where the two quotes are plainly two different terms** | a typeset quote pair the detector could not read (`"Astron Motor Fuel'`), so the inner words became the term | D30 accepts any opener with any closer, cleans the key, and never starts an unquoted term after an opening quote. `ENGINE.md` §12.13 item 3 |
| **CT44 pairs a lessee clause with "the owner of certain Intellectual Property", with a far-off ownership line naming no party, or with another document's recital** | the ownership half had no object check, the side window was 90 characters, and documents were not separated | the first object of the ownership sentence decides (premises, deeds; never intellectual property, goodwill, "the business"); the side is read from the whole sentence; a same-side half pairs across the record (tagged across documents), a side-less half only within one document and twenty pages, otherwise a note. `ENGINE.md` §12.13 item 4 |
| **CT01 "explicit admission" on "I admit the contents of this paragraph"** — or silent on "AD PARAGRAPH 7: I admit that I signed" | pleading form read as an admission of fact; then a heading alone suppressed the sentence | D01 skips a cue whose own sentence is in the pleading grammar (admit the contents/allegations/correctness of this/sub-paragraph 13.2, hereof, paragraph 13); a heading suppresses nothing; every cue on the page is read. `ENGINE.md` §12.13 item 5 |
| **"subtotal R1161950 + VAT R1 = … but stated R1.08" as the lead finding** — or a VAT mismatch on "VAT 15% R150.00" or "R 1 875.00" | D13 combined the first subtotal, VAT and total found anywhere in the bundle, with no plausibility check, and read a space-grouped figure or a rate as the amount | one page at a time; figures read as printed; VAT zero or a tenth to a quarter of the subtotal and a total within half to twice it, else a note (OCR blamed only on an OCR page); both rates since 2018; discount lines leave the page unchecked; CT15/CT22 under the OCR cap, package phrase rules never. `ENGINE.md` §12.13 item 6 |
| **A finding quotes an "Extract prepared <date> - pages reproduced" document as the record** — or an invoice "prepared for … 12 March 2024" is demoted to a lead | a secondary document (an extract or commentary prepared after the fact) was scanned as primary | `voSecondaryPages` + `voDemoteSecondarySource`: wholly secondary → a lead in the notes; partly → severity 2 and tagged. The primary record describing itself in the same words (an invoice or quotation "prepared for … on a date", financial statements "prepared on the historical cost basis") is never secondary: `VO_PRIMARY_RECORD_RE`; a primary noun before the extract names its source; a quotation note and an AI-compiled page are secondary; an extract sealed on its own is tested from its first page; a two-half finding with either half on a secondary page is a lead. `ENGINE.md` §12.13 item 7 |
| **A page note ("Figures on page 397 do not read as one invoice") appears under "items it could not pin to a specific page", or is missing from the court-ready narrative** | contextOnly notes were appended to the extraction notes as unlabelled text | the engine returns `contextNotes` structurally and labels the segment "Engine notes (n):"; both reports print them under their own heading with their page. `ENGINE.md` §12.13 item 11 |
| **A finding on more than eight pages ("… and 2 more") is held at reduced weight instead of becoming a lead, or counted as native text** | the page parsers read "2 more" as page 2 and never saw the hidden pages | the full page array travels on the finding (`f.pages`, `voFindingPages`); both parsers drop "and N more" and "(clause 7)" (`pageAnchor` only since the Greensky re-run's second round, which also judges OCR provenance on `f.pages`). `ENGINE.md` §12.13 item 7, §12.15 item 6 |
| **"Registration Number", "Audifors Name Posts", "ADD DISBURSEMENTS I R", "Franchise Interest", "Associates Tel" or "CENTURY CITY" listed as a party** | labels, OCR variants of stop words, case titles, defined terms, line-spanning runs and address words passed the person test | stop tokens and phrases extended; a six-letter token within one edit of a stop word is that word; a single letter after the first token (no period) or before an all-caps word rejects the run; a name never spans a line break or ends at a slash; a run with a stop word is trimmed to the name before it ("Zeyd Timol Postal Address" → "Zeyd Timol"), never dropped. `ENGINE.md` §12.13 item 9 |
| **A finding dated "1.1.50" or "12.3.2017" from a clause number, or dated from a letterhead on a form page** | a dotted clause reference read as a date; the quote's window on a page with no sentence boundary ran 800 characters | the dotted form needs a four-digit year, a token after a clause cue is a reference, only an orderable date reaches the anchor; the window closes to 160 characters each side without a boundary. `ENGINE.md` §12.13 item 8 |
| **"44 verified findings are recorded below" beside 25 OCR-held rows; or an uncapped finding on a scanned page announced as "held at reduced weight"** | three count sentences bypassed `voCountPhrase`; the phrase claimed a weight reduction for every OCR-only anchor | every count goes through `voCountPhrase`, which says the quoted wording is to be verified and reserves "held at reduced weight" for findings the engine capped. `ENGINE.md` §12.13 item 10 |
| **"No party can alter it afterwards", "preserves, forever", "WHY THIS RECORD CANNOT BE ALTERED", "immutable instrument", "a public ledger that no one can edit or delete", "permanent", "SHA-512 anchored"** | the immutability claim survived in other words | tamper-evidence wording everywhere: any change is detectable, the fingerprint would no longer match, the timestamp fixes the latest time by which it existed, once Bitcoin confirms. `ENGINE.md` §12.13 item 10, §12.14 items 9 and 11 |
| **A registration-number note or a Low finding cites the Corrupt Activities Act; the CT44 row prints "CONTRACT"** | the candidate-law trim covered arithmetic types only; the CONTRACT subject had no label | `statutesForFinding`: CT20 and severity ≤ 2 carry common-law misrepresentation at most; an unsigned-agreement statement carries the common law of contract only; `LEGAL_SUBJECT_LABEL.CONTRACT`. `ENGINE.md` §12.13 item 10, §12.14 item 3 |
| **An orphaned rebuttal survives when written "The record at p. 7 states … Assessment: contradicted"** | the orphan test knew one opener | `isRebuttal` reads the narrator's own vocabulary, bullets and emphasis; orphans are counted apart from the gate's removals. `ENGINE.md` §12.13 item 10 |
| **The COUNTER-NARRATIVES section prints as one running paragraph, headings swallowed; or a stray "(p. 20)" precedes a rebuttal whose claim was removed** | the scrub joined lines with a single newline while the renderer splits paragraphs on blank lines; a trailing page cite survived as a kept "sentence" | the scrub keeps blank lines between blocks; a trailing cite is stripped before the gate and re-attached to a kept claim only. `ENGINE.md` §12.13 item 10 |
| **The on-device fallback narrative never counts CT44/CT45 ("The concerns cluster in …")** | `buildLocalNarrative` kept its own category tables without FRANCHISE_LEASE | `CATLAB`/`CATORD` carry it; the inline drift guard compares them with the renderer's tables. `ENGINE.md` §12.13 item 10 |
| **A finding the review dropped still appears in Key dates, the timeline or the person index; "Contradiction types triggered: 11" beside "10 distinct patterns"** | the page merged only the findings list after the review | the page recomputes the timeline, the person index, the type counts on the retained findings. `ENGINE.md` §12.13 item 12 |
| **"Anchored to the Bitcoin blockchain" on a report whose OpenTimestamps status reads "confirmation pending"** | the sentence was unconditional | `anchorPhrase(data)`: submitted and pending at sealing, anchored only when confirmed, no anchor when none was recorded. `ENGINE.md` §12.13 item 12 |
| **"Quoted record" or the evidence appendix prints the engine's sentence ("VAT mismatch: calculated …") as the record's words; a computed amount in MONETARY FIGURES** | the verbatim columns printed the whole evidence string | `anchorQuote(f)`: the passage the finding quotes, or the observation marked as the engine's. `ENGINE.md` §12.13 item 12 |
| **An OCR-only CT44 or CT01 at severity 5 heads the serious list** | the OCR cap covered format checks only | every OCR-only finding above 3 is held at 3 (`ocrHeld`) until the page image is read. `ENGINE.md` §12.13 item 12 |
| **"Party implicated: Caltex Oil" on a date stamp; "7. CERTIFICATION" followed by "14. ANNEXES"; the contents page stops at section 20** | attribution did not distinguish declared parties or format checks; the counter advanced behind self-numbered sections; the TOC was one page at fixed spacing | descriptive label unless declared and not a format check; the counter continues after the constitutional block; the TOC scales to fit. `ENGINE.md` §12.13 item 12 |
| **"Quoted record" prints a label ("purchase price") or the engine's cue ("i acknowledge that"); a two-sided finding loses its second half; "Deed of Sale of Business" printed as "(title unreadable in the OCR text)"; two different people merged in the person index** | the first quoted span was taken as the record; the debris test scored grammar; the merge used the surname-and-initial rule | `anchorQuotes` skips labels and cues and keeps every passage; `docTitle` scores debris only and says OCR only of an OCR page; `sameNameVariant` merges variants only. `ENGINE.md` §12.13 item 12 |
| **A finding dated from an unrelated line on its page ("On 1 October 2005: a registration number…")** | WHEN fell back to any date on the cited page | the finding's own words, or one date from the quote's own sentence (`voSentenceAround`). `ENGINE.md` §12.13 item 8 |
| **The findings matrix lists fewer findings than the cover (41 of 44)** | `FRANCHISE_LEASE` (CT44/CT45) was not in `CATEGORY_ORDER` | it is; `tests/annexure-eb-regression.test.mjs` §17 renders the report and reads the category back. `ENGINE.md` §12.13 item 10 |
| **The narrative's rebuttal section opens "This account conflicts with the record…" with no claim above it** | the claim sentence failed the §15.2 gate and its rebuttal was printed alone | `scrubRebuttals` drops the rebuttal with its claim and counts the sentences; the provenance box prints both gate counters. `ENGINE.md` §12.13 item 10 |
| **Words glued across a line end in a quote** ("side ofthe same") | the producer drew no space glyph at the line end and the line move was ignored | `Tm` with a changed y, `Td`/`TD` with a vertical component, `T*`, `'`, `"` are word boundaries. `ENGINE.md` §12.11 item 13 |
| **"Impossible date: 96/6/2026" on a page that says "CAS 96/6/2026"** | the case-number cue guard in D03 removed | a case, docket, reference, file or matter cue before a date-shaped value means it is not a date. `ENGINE.md` §12.11 item 14 |
| **"Conflicting entity-status claims" quoting one passage twice ("compliant" and "non-compliant" on the same page)** | `\bcompliant\b` matched inside "non-compliant" | a status word after "non-" is the negation; two status words at one place are one claim. `ENGINE.md` §12.14 item 1 |
| **A lookalike-domain finding on two gov.za addresses** | a renamed department lists both domains for one mailbox | two government-suffix domains are exempt; a lookalike of one still fires. `ENGINE.md` §12.14 item 2 |
| **"It concerns <company>" or "<company> — the record states:" for the author's own words** | a name found on the page was treated as the party | only a declared party is the party a finding concerns; others are "named on the cited page (descriptive)". `ENGINE.md` §12.14 item 4 |
| **"The operator is … and non-compliant" in a verbatim column** | the record's own quotation marks closed the engine's quote | nesting-aware quote reading (`voExtractQuotes`, `voQuoteSpans`). `ENGINE.md` §12.14 item 7 |
| **A party's submission sealed with findings about its own allegations** | the submission read as the primary record | a submission title plus a citation of another Verum seal makes it secondary: leads, not findings. `ENGINE.md` §12.14 item 6 |
| **verify.html shows "No Seal Found" for an anchor certificate** | the `ANCHOR-CERT\|` subject was not recognised | it is, and its digest's anchor is checked; upload the sealed PDF for an integrity verdict. `ENGINE.md` §12.14 item 11 |
| **An annexure behind a cover submission recorded as a secondary-source lead** | the submission cue ran to the last page | the submission ends before the first page that opens a new record (annexure, email header, invoice, "Page 1 of"); a captioned pleading is never a submission. `ENGINE.md` §12.14, verification pass |
| **"The document is dated <a commencement / due / hearing date>" in the engine notes** | a qualified "… Date:" label read as the document's date | qualified labels are skipped and only a document's first page is read. `ENGINE.md` §12.14, verification pass |
| **The certificate's "sealed file SHA-512" differs from `sha512sum` of the delivered file** | the VO-SEAL2 self-check value was printed | the certificate prints the delivered file's real SHA-512 (the protected copy when a password was set). `ENGINE.md` §12.14, verification pass |
| **"TAMPER FOUND" printed over a sentence about unsigned agreements, or a lookalike domain under "COMMUNICATION GAP FOUND"** | the Nine-Brain section filed text cues and contact checks under B2/B3, whose §15.4 template headers state tampering or a gap | the headers stay the template's own (PD19); B2 takes only the file and page measurements; CT23, CT33, CT35, CT37 and (since the Greensky re-run) CT39 map to no brain block (`VO_BRAIN_OF_CT` → `NONE`) and are listed under "Not rendered under a brain"; CT36/CT38 sit under B1; every entry except a serial pattern prints a "- Finding:" line (`establishesOf`). `ENGINE.md` §12.14 item 9, §12.15 item 5; `tests/annexure-eb-regression.test.mjs` §18j |
| **An unsigned-agreement sentence filed under forgery or Cybercrimes Act law** | D32's two CT23 shapes were treated alike | `isUnsignedStatement`: an unsigned agreement is a contract question ("Unsigned Agreement Stated"), common law of contract only, filed under Selective Omissions, next step "Establish whether a signed original … exists" (`hintFor`); the "/s/" shape keeps the forgery provisions. `ENGINE.md` §12.14 item 3 and the verification pass |
| **CT23 on an author's general allegation ("a common scheme involving unsigned agreements")** | the cue matched a category plural | D32 skips a plural that names a category and still fires on one that names specific instruments ("the unsigned agreements dated …"); the quote is snapped to whole words. `ENGINE.md` §12.14 item 3 and the verification pass |
| **"The record evidences inducement or reliance [F2]" (or knowledge) in FOUR PILLARS** | the narrator claimed a pillar from a finding whose type cannot evidence it | the Worker's `humanGate` drops it through `humanPillarBad` and counts it (`gate.pillar`): knowledge and inducement or reliance are written only as INSUFFICIENT; misrepresentation and loss need a cited engine finding of a matching type (`HUMAN_PILLAR_TYPES`, pinned equal to the report's `OFFENCE_ELEMENTS`); a held finding evidences nothing; a pillar claim in any other section meets the same rule. `ENGINE.md` §12.14 item 10 and the verification pass; `tests/worker.test.mjs`, `tests/human-report.test.mjs` |
| **"court-accepted", "recognised by the … Court", "admitted into evidence" or "the court noted" in a narrative** | court-recognition paraphrases the ban did not name | `HUMAN_BANNED_RES` (`humanSentenceBanned`, `worker/verum-rules.js`) drops them; statutory "admissible" and "court-appointed" stay. Tightened, never loosened (CLAUDE.md non-negotiables 3 and 8). `ENGINE.md` §12.14 item 10 |
| **"F2" names one finding in the narrative and another in Findings in Detail** | the narrator and the reports numbered findings separately | one predicate, `humanNumberable` (the seal page reads it as `VerumReport._humanNumberable`): F# for engine findings with a quotable passage and a page, P# for the rest. `ENGINE.md` §12.14 item 9 and the verification pass |
| **"Mr Jacob Mbele", "Trevenna Campus", "Personal Assistant" or "Forensic Platform" listed as a party; a company bound from "issued to Sanarth Fuels"** | courtesy titles, headings and the product's own heading passed the person test; prose prepositions were read as header markers | a courtesy title before a full name is dropped ("Justice" never is); headings are stopped as phrases; a colon-free from/to/cc/bcc (`VO_PERSON_MARKER_RE`) binds only in header company, an email address or another header label close after it (`VO_HEADER_COMPANY_RE`), and a colon-free "per" only after a sign-off or firm word (an attorney's "Yours faithfully … Per J Smith" still binds); a run is trimmed to the name, never dropped (`voTrimPersonName`). `ENGINE.md` §12.14 items 4–5 and the verification pass |
| **A finding said to concern a declared person ("Liam Highcock") because the page names someone with the same surname ("Gary Highcock")** | a declared party matched on any long token of its name | `partyStronglyNamed`: a person is named by the whole name or an initial and the surname; a company by its distinctive tokens, never a generic word such as "bank". `ENGINE.md` §12.14 verification pass and "The last verification items"; `tests/annexure-eb-regression.test.mjs` §18j |
| **The anchor certificate says the fingerprint is anchored in "a public ledger that no one can edit or delete" under its own "PENDING CONFIRMATION"** | the certificate's wording ran ahead of the proof | `buildAnchorCertificate` labels each fingerprint by the bytes it belongs to and says that, once confirmed, the Bitcoin block proves existence no later than its time, not the device clock. `ENGINE.md` §12.14 item 11 |
| **verify.html says "Verified" or "OTS-anchored" for an OTS-format footer before Bitcoin confirms** | the OTS-format branch claimed verification | it reads "Seal Present — OTS Format" and resolves the digest. `ENGINE.md` §12.14, verification pass |
| **"Impossible date: 15.20.9094" on page after page of an invoice bundle** | commodity codes read as dates | D03 reads a date-shaped token as a date only when its year field lies within 1200–2200 (31/02/2021 still fires); identical impossible tokens are one finding naming every page. `ENGINE.md` §12.15 item 1; `tests/greensky-regression.test.js` §9 |
| **An AI case summary bound into the bundle sealed as the record's own "explicit admission"** | D01 read a sentence that calls another statement an admission | `VO_ADM_CHARACTERISATION_RE` skips a characterisation (first-person admissions still fire); pages carrying chat-style markdown are secondary wherever they sit (`voMarkdownAnalysisPages`), so their claims become leads and the extraction notes name the pages. `ENGINE.md` §12.15 item 2 |
| **SEALED FINDINGS lists 17 where the cover says 19, or prints "none triggered" over a record whose only findings are file-level** | engine findings with no page to cite (PDF metadata or structure) or no renderable passage left the anchored list without a word | `voSealedCountIntro` states them beside the anchored list; `voNoAnchoredLine` discloses a file-level-only record. `ENGINE.md` §12.15 item 5 |
| **The one-page summary or THE SHORT VERSION prints one sentence fourteen times** | one bullet per finding, identical lines unmerged | identical plain-words lines collapse into one bullet naming every page, with the count. `ENGINE.md` §12.15 item 5 |
| **A bundle that wears this platform's seal footers reads as tampered (XMP against Info)** | the earlier seal's pdf-lib producer was read as an edit | `voDigitalForensicsScan` is told `sealedByThisPlatform` and suppresses the XMP-against-Info comparisons, and the suppression is disclosed. `ENGINE.md` §12.15 item 3 |
| **The sealed-PDF download reads "Sealing failed — download blocked (unsealed)"** | the sealed bytes carry no seal marker: `buildSealedPDF` hit a fallback and produced an unmarked file | `VoSealGuard.assertSealed` (`seal-guard.js`, inlined) refuses to release it and logs `[SEAL-GUARD] Refused to release an unsealed document:`. Never bypass the guard (CLAUDE.md non-negotiable 3); find why the seal step fell back. `ENGINE.md` §8 (`window.VoSealGuard`), §9 (inlining); `tests/seal-guard.test.mjs` |
| **Forensic Scan reads "Scan could NOT complete (…) - this is not a clean result" or "No machine-readable text - document NOT analysed"** | the engine threw (console `Forensic engine error:`), or the file has no usable text layer and OCR recovered too little | the page records `scanFailed`, or the engine returns `unreadable`; neither is shown as clean. The report says the scan could not complete, or "DOCUMENT NOT ANALYSED — NOT A CLEAN RESULT"; a failed scan runs no AI step. `ENGINE.md` §1 |
| **"Sealing Failed" with "The PDF could not be fully processed"** | an exception escaped `startSealing` or `runSealingPipeline`: the file could not be read, pdf-lib could not load it for the seal, the password boxes failed their check (the error says which), or page-level code threw (see the closure-helper row above). A selection that cannot be merged into one bundle shows an alert instead and nothing starts. | the results panel prints the error and the console logs `SEALING ERROR:` with it; read that first. `ENGINE.md` §12 |
| **No court-ready narrative in the bundle at all, not even its deterministic twin** | it is built only in "Seal document with forensic report", after a technical report that built, on a scan that did not fail and recorded at least one engine finding | `window._voHumanReportPack` is null; when the build threw, the console says `Court-ready narrative generation failed (seal, report and JSON unaffected):`. A clean scan gets the technical report and findings JSON only. `ENGINE.md` §13 |
| **verify.html shows a VO-SEAL2 match on a copy someone altered and then re-sealed** | not a regression: the VO-SEAL2 hash is self-referential, so a re-sealed copy matches itself | open with the founder (the fix is architectural). verify.html and the report's seal explainer say what the check cannot show; compare the delivered file's SHA-512 with the one on the anchor certificate, a check only as good as the sender's own record. `ENGINE.md` §12.14, "Open, with the founder" (a) |

---

## Pipeline overview

`startSealing` (seal-document.html) runs these stages in order. The page's nine step labels are
older than the pipeline, so the fourth column says which step's detail line carries each stage.
Stages 5 to 11 each catch their own failures, so none of them can stop the sealed document
from being delivered; an exception in stage 12's page code still can (the "Sealing Failed"
rows above).

| # | Stage | Functions | Step that shows it | Skipped or failed when |
|---|---|---|---|---|
| 0 | Pre-flight | `voPreflightForensicService` → `GET /api/v1/site/health` | alert and on-page notice | forensic mode only; anything but JSON `{ok:true}` stops before any file is read |
| 1 | Read the file, GPS, device | `voReadFileBytes`, `captureGPS` (15 s hard deadline), `captureDevice` | GPS + Device | GPS never blocks ("GPS declined") |
| 2 | Engine | `voEnsureForensicScripts`, `voLoadRulePackage` (bounded wait), `runForensicEngine(bytes, pdfDoc, onProgress, { referenceTime })` with on-device OCR through `window.voOcrRescuePages`, then `applyBundleMode`; `aiClassifyDocument` → `/api/v1/ai/classify` runs beside it | Forensic Scan | forensic mode only; a throw becomes `scanFailed`, no text layer `unreadable` |
| 3 | Hashes, previous seals, commercial check | `computeSHA256` / `computeSHA512`, `detectExistingSeal`, `detectCommercialDocument` | SHA-256, then passing lines on "OpenTimestamps" and "A4 Watermark" | a commercial document stops at the payment gate |
| 4 | Seal the document | `runSealingPipeline`: `submitToOTS`, QR, `buildSealedPDF` (pages extended, footer), optional password | OpenTimestamps, Clean QR Code, Seal Footer, Finalize, SHA-512 | a calendar failure is recorded; the seal still completes |
| 5 | AI review | `aiAssessFindings` → `/api/v1/ai/assess` | Finalize (reopens after SHA-512) | forensic mode, scan not failed, at least one engine finding |
| 6 | Brain 9 sweep | `aiBrain9Sweep` → `/api/v1/ai/sweep` | Finalize | as 5, and page text exists; output stays out of `reportFraudResult` |
| 7 | Report narrative | `aiNarrateReport` → `/api/v1/ai/narrate`, else `buildLocalNarrative` | Finalize | as 5 |
| 8 | Certificates | `buildSealCertificate` (Seal document only), `buildAnchorCertificate` (both modes, when a calendar accepted the digest) | Finalize | a failure is logged; the seal is unaffected |
| 9 | Technical report | `VerumReport.build` → `submitToOTS` → `VerumReport.seal` → `window._voReportPack` | Finalize: "Building forensic report..." | forensic mode only; a throw logs `[VO-REPORT-DEBUG] Report generation failed:` |
| 10 | Findings JSON | `buildFindingsJson` → `window._voFindingsJson` | none | inside stage 9's `try`: no technical report, no JSON |
| 11 | Court-ready narrative | `aiHumanReport` → `/api/v1/ai/human-report`, `VerumReport.buildHumanReport`, `VerumReport.seal` (tag NARRATIVE REPORT) → `window._voHumanReportPack` | Finalize: "Court-ready narrative: section i of n" | as 5, and stage 9 built |
| 12 | Results and feedback | `showResults`, `voRenderBrain9Recommendations`, `shareAnonymousPatterns` | results panel | feedback is forensic mode only and carries no text |

### Stage 2 in detail: the engine — `runForensicEngine` (forensic-engine-page.js; the inlined copy runs)
- **Call**: `runForensicEngine(pdfBytes, pdfDoc, onProgress, opts)`; `opts.referenceTime` is the
  analysis instant the page passes (the engine never reads the clock).
- **Output**: `{ engineVersion, rulePackage, clean, unreadable, overallScore, maxPossibleScore,
  confidence, totalFindings, findings[], pageTexts, documentMap, swornPages, timeline,
  personIndex, findingsByType, findingsByCategory, contradictionTypesUsed,
  serialPatternsDetected, extractionNotes, contextNotes, referenceTime, ocrPages, ocrConfidence,
  footerOnlyPages, summary }`. `overallScore` and `confidence` are internal; no score or band is
  printed (PD1).
- **Failure modes**: a detector that throws is skipped with `Detector N failed:` in the console
  (N is its position in the run list, not its D number) and the rest still run; a throw from the
  engine itself is caught in `startSealing` and recorded as `scanFailed`; a file with no usable
  text returns `unreadable: true`; zero findings on a readable file is a legitimate result.

### Stage 5 in detail: AI review — `aiAssessFindings` → `/api/v1/ai/assess`
- **Runs when**: forensic mode (`isAiReviewEnabled()`), the scan did not fail, and the engine
  recorded at least one finding.
- **What it does**: sends up to 200 findings in batches (35 s per batch). Since 5 October 2026
  (founder ruling, ENGINE.md §12.16) it **never removes or changes an engine finding**: an
  UNSUPPORTED verdict (legacy `drop` / `keep: false`) becomes a note on that finding
  (`aiReviewNote`, printed under "AI Review Notes on Engine Findings" and sent to the feedback
  loop as `AI_REVIEW_UNSUPPORTED`), and the findings returned are copies of the originals with
  their full evidence. A batch the Worker answers with `reviewed: false` adds nothing. Up to 20
  additional AI candidates are kept, each anchored by `voAnchorAiQuote` or labelled unanchored; a
  candidate quoting an engine finding on the same page is counted as a duplicate, not listed.
  Nothing is recomputed: the engine's summary, timeline, person index and counts stand.
- **Failure**: never silent. `aiReviewInfo.applied` is false with `window._voLastAiError` as the
  reason; step 7 reads "AI review unavailable — the engine findings stand as produced", and
  section 7 of the report says the AI review did not run. No finding depends on it, so the cover
  carries no AI banner (removed 5 October 2026).

### Stage 7 in detail: report narrative — `aiNarrateReport` → `/api/v1/ai/narrate`
- **Runs when**: as stage 5; it runs whether or not the assess step succeeded.
- **What it does**: a 38 s call; a draft that passes the §15.2 gate (`scrubNarrative` /
  `voGatePasses`) leads THE STORY IN PLAIN LANGUAGE; otherwise the annex section (FORENSIC
  NARRATIVE, ENGINE SUMMARY or AI REVIEW, from `aiSectionName`) carries it.
- **Recovery**: a Worker template answer (`model: 'template-fallback'`, flagged by
  `window._voNarrateTemplate`) and the on-device `buildLocalNarrative` text are labelled `local`:
  they go to the annex as ENGINE SUMMARY and never lead the story (ENGINE.md §12.11 item 6).

### Stage 9 in detail: report PDF — `VerumReport.build(opts)` (forensic-report.js; the inlined copy runs)
- **Location**: `window.VerumReport.build(opts)`
- **Input**: `{ findings, documents[], identity, ... }` (the option bag in ENGINE.md §12.5)
- **Output**: Uint8Array (PDF bytes)
- **Failure modes**:
  - `opts.findings` is null/undefined (uses default `{ clean: true, findings: [] }` and still builds)
  - pdf-lib was absent when the inlined script ran: `build` is a stub that rejects with
    "pdf-lib not loaded", and `window.VerumReport._error` says so
  - pdf-lib throws on image or font embedding
- **Critical check** (the first lines of `build`):
  ```javascript
  var fr = opts.findings || { clean: true, overallScore: 0, confidence: 'CLEAN',
                               totalFindings: 0, findings: [], summary: '' };
  ```

### Stage 9, sealing — `VerumReport.seal(reportBytes, sealOpts)` (also seals the court-ready narrative, with `tag: 'NARRATIVE REPORT'`)
- **Purpose**: Add QR code, navy footer, VO-SEAL2 hash
- **Failure modes**:
  - QR data URL is invalid
  - PDF loading fails
  - Hash patching fails (VO-SEAL2 fallback to legacy): the console says `VerumReport.seal: VO-SEAL2 placeholder patch infeasible; falling back to legacy VO-SEAL subject.`

### Stage 11 in detail: court-ready narrative (automatic in "Seal document with forensic report")
- **Location**: `aiHumanReport()` → `/api/v1/ai/human-report` (one call per writer section;
  critical evidence in batches of eight findings; 52 s per call; five-minute budget), then
  `VerumReport.buildHumanReport()` → `VerumReport.seal()` with the NARRATIVE REPORT tag.
- **Purpose**: the sealed AI-drafted companion report (ENGINE.md §13).
- **Runs when**: forensic mode (there has been no separate switch since 2026-09-07), the scan did
  not fail, the engine recorded at least one finding, and the technical report built (stage 11
  runs inside stage 9's `try`, after the report is sealed).
- **Failure modes**: the Worker answers `generated:false` with a `reason` (`ai_unavailable`,
  `timeout`, `no_json`, `empty`, `gate_failed`, `no_findings`); the client records
  `no_api_at_this_address` (a web page came back), `network`, `timeout`, `invalid_response`,
  `not_generated`, `not_applicable` (nothing in the record engages the section, so it was not
  asked) or `time_budget`. Each prints as plain words above that section's deterministic twin,
  labelled as not machine-written: `not_applicable` and `gate_failed` have their own sentences,
  the rest come from the `reasonText` map in `buildHumanReport`.
- **Recovery**: never blocks the seal, the forensic report or the findings JSON.
- **Diagnose**: the Authentication & Provenance page states sections written vs printed, both
  gate counters and the drafts discarded; `window._voHumanReportPack` carries `generated` /
  `writerSections` / `model`. When no AI section passes, the cover and the certification say the
  narrative is the deterministic record.

---

## No forensic report, or no court-ready narrative: the checks

1. **Mode.** `sealMode` (bare, in the console) must be `'forensic'`. The results panel's red
   "⚠ Forensic Report Not Generated" box prints `window._voReportDebug` whenever no report pack
   exists; in Seal document mode it also appears and reads `sealMode="seal-only"`, which is not a
   failure.
2. **Pre-flight.** If an alert said the address has no forensic service, nothing was sealed: open
   `/api/v1/site/health` on that host.
3. **Report builder.** `typeof window.VerumReport.build` must be `'function'`.
   `window.VerumReport._error` set means pdf-lib was missing when the inlined report script ran
   (`[VerumReport] FATAL: pdf-lib not available`). `window.VerumReport` undefined means that
   inlined block threw while parsing (it shares one `<script>` element with the inlined
   `seal-guard.js`): a regex lookbehind on Safari before 16.4 is the known cause (ENGINE.md
   §4.16). `voEnsureForensicScripts` then tries `/forensic-report.js` as a fallback.
4. **Engine result.** `_pipelineFraudResult` holds the engine result before the review:
   `scanFailed`, `unreadable`, `findings.length`, `extractionNotes`.
5. **Build and seal.** The console prints, in order: `[VO-REPORT-DEBUG] Starting forensic report
   build`, `Build options prepared`, `[VerumReport.build] Starting build`, `Report PDF built
   successfully`, `About to seal report`, `[VerumReport.seal] Starting seal process`, `Report
   sealed successfully`, `Report pack created and stored`. The last line printed is where it
   stopped; `[VO-REPORT-DEBUG] Report generation failed:` carries `error_message`, `error_name`
   and `stack_preview`. `[VO-REPORT-DEBUG] Report build skipped` names which precondition failed.
6. **Court-ready narrative.** See its rows in the table and stage 11.
7. **AI service.** `window._voLastAiError` names the last AI call that failed and why (for
   example `/api/v1/ai/assess: timed out after 35000ms`, `… returned HTTP 405`). The Network tab
   shows each POST to `/api/v1/ai/*`.

---

## Instrumentation without editing code

The page calls `window.VerumReport.build` and `.seal`, so a wrapper typed in the console before
sealing is used:

```js
const _build = VerumReport.build;
VerumReport.build = async function (opts) {
  console.log('[TRACE] build', { findings: opts.findings && opts.findings.findings && opts.findings.findings.length, documents: opts.documents && opts.documents.length });
  try { const r = await _build.call(this, opts); console.log('[TRACE] built', r && r.length); return r; }
  catch (e) { console.error('[TRACE] build failed', e); throw e; }
};
```

Do not add logging to `forensic-report.js` or `forensic-engine-page.js` to debug the live page.
The page runs the inlined copies, so a source edit does nothing until it is re-spliced, and
`tests/inline-scripts.test.mjs` fails on any drift. Debug edits are never committed.

---

## Browser DevTools Console Checks

The page logs these on every forensic seal. `[VO-REPORT-DEBUG]`, `[VO-AI-NARRATE]` and the two
`[VerumReport.*]` tags were added during the Greensky investigation (history below); the others
came later.

### Automatic Logging
When sealing with "Seal document with forensic report", check DevTools Console for messages
prefixed with:
- `[VO-REPORT-DEBUG]` — Report build pipeline status
- `[VO-AI]` — assess, Brain 9 sweep and narrate failures
- `[VO-AI-NARRATE]` — AI narrative endpoint response
- `[VO-HUMAN]` — court-ready narrative batches and sections that failed
- `[VerumReport.build]` — PDF construction
- `[VerumReport.seal]` — Seal application
- `[SEAL-GUARD]` — an unsealed file refused

### Manual Console Checks

Run these in the console after sealing:

```javascript
// Check automatic logging output
console.log('Search DevTools Console for: [VO-REPORT-DEBUG], [VO-AI], [VO-HUMAN], [VerumReport], [SEAL-GUARD]');

// Check if VerumReport loaded
console.log('VerumReport:', typeof window.VerumReport);
console.log('VerumReport.build:', typeof window.VerumReport?.build);
console.log('VerumReport error:', window.VerumReport?._error);

// Check if reportPack was created
console.log('Report pack:', window._voReportPack);
if (window._voReportPack) {
  console.log('Report successfully created:', {
    size_kb: (window._voReportPack.bytes?.length / 1024).toFixed(2),
    seal_id: window._voReportPack.sealId,
    ots_submitted: window._voReportPack.ots?.success
  });
}
console.log('Report debug:', window._voReportDebug);
console.log('Last AI error:', window._voLastAiError);

// Check the engine result (a page-level let binding: type it bare)
console.log('Engine result:', {
  clean: _pipelineFraudResult?.clean,
  scanFailed: _pipelineFraudResult?.scanFailed,
  findings: _pipelineFraudResult?.findings?.length
});

// If no report, check for errors
if (!window._voReportPack) {
  console.log('No report created. Debugging:');
  console.log('1. sealMode (expected "forensic"):', sealMode);
  console.log('2. Engine ran:', !!_pipelineFraudResult);
  console.log('3. VerumReport loaded:', !!window.VerumReport);
  console.log('4. Filter console for ERROR or WARN messages');
}
```

---

## Recovery steps

- **VerumReport missing.** See check 3 above. `/forensic-report.js` is fetched only by the
  fallback loader `voEnsureForensicScripts`; `.assetsignore` does not exclude it, so a 404 there
  means the deploy did not carry its assets (`/api/v1/site/health` names the tier).
- **Findings malformed.** Not reachable today: `runForensicEngine` always returns `findings` as
  an array, and the page's catch builds `findings: []` with `scanFailed: true`. If a result
  arrives malformed, the change that broke the engine's return is the bug.
- **Images missing from the report.** `fetchPng` returns null on any failure and the report
  builds without the logo or watermark; check `/images/logo-full.png` and
  `/images/watermark_portrait.png` through `/api/v1/site/health`.
- **VO-SEAL2 patch fails.** `seal()` falls back to the legacy `VO-SEAL|` Subject and logs
  `VerumReport.seal: VO-SEAL2 placeholder patch infeasible; falling back to legacy VO-SEAL
  subject.`

---

## Next steps

1. Reproduce with DevTools open, on the Worker address and on the address the user used.
2. Run the checks above in order and note the last `[VO-REPORT-DEBUG]` line printed.
3. Check the Network tab for failed POSTs to `/api/v1/ai/*` and for `/api/v1/site/health`.
4. Match the symptom to a row in the table; if it is new, add a row naming its guard and its
   ENGINE.md section, and pin it with a test.

---

## History: the Greensky "no forensic report" investigation (superseded)

Written no later than 2026-08-21 (it is already in `fde9fb2`, the oldest commit this clone
holds), against seal page v1.4.1-20260720, when `forensic-report.js` was loaded by a
`<script src>` tag. Its line numbers and its instrumentation steps no longer apply. Its
conclusions, kept for the record:

- **Empty findings never stopped a report.** Still true: `VerumReport.build` defaults
  `opts.findings` to an empty clean result and still builds and seals.
- **VerumReport not loaded.** Superseded: `forensic-report.js` is inlined into
  `seal-document.html` (ENGINE.md §9) and `voEnsureForensicScripts` re-fetches the engine, report
  or OTS script when its global is missing. The `<script src="/forensic-report.js?v=1.4.1-20260720">`
  tag this theory checked survives only in the unserved snapshot
  `seal-module/web/seal-document.html`. A missing `VerumReport` today means the inlined block
  threw while parsing, or pdf-lib was absent (`window.VerumReport._error`).
- **A malformed findings object.** Superseded: the engine always returns `findings` as an array,
  and the page's catch builds `findings: []` with `scanFailed: true`.
- **A narrate timeout blocking the build.** Superseded: narration runs before the build in its
  own `try`, with a 38-second timeout and `buildLocalNarrative` behind it; the report's own catch
  logs `[VO-REPORT-DEBUG] Report generation failed:`.

The Greensky bundle is now a regression suite (`tests/greensky-regression.test.js`; its §9 is
the 3 October 2026 re-run, ENGINE.md §12.15).
