/**
 * Pre-seal CropBox normalisation.
 *
 * A source PDF (the Wallers Garage franchise agreement) arrived with 58 pages
 * whose CropBox cropped a 612x792 MediaBox down to a 612x432 landscape slice —
 * hiding ~45% of every one of those pages. The seal was faithfully preserving
 * the crop, so the sealed copy showed half a document, and manually un-cropping
 * the source before sealing did not survive (pdf-lib carried the CropBox
 * through). voCropHidesContent is the per-page decision; buildSealedPDF must
 * reset the CropBox to the MediaBox BEFORE it stamps and saves.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  crop-normalize.test.mjs');
console.log('======================================================\n');

// The exact Wallers geometry: 612x792 media, 612x432 crop (top ~45% hidden).
ok(E.voCropHidesContent([0, 0, 612, 792], [0, 0, 612, 432]) === true,
  'REGRESSION: a CropBox that hides the top of the page is detected (Wallers)');
ok(E.voCropHidesContent([0, 0, 612, 792], [0, 0, 612, 792]) === false,
  'CropBox equal to MediaBox is not a crop');
ok(E.voCropHidesContent([0, 0, 561, 792], [0, 0, 561, 792]) === false,
  'a normal full portrait page is left alone');
ok(E.voCropHidesContent([0, 0, 612, 792], [10, 10, 600, 780]) === true,
  'an inset on all four sides is a crop');
ok(E.voCropHidesContent([0, 0, 612, 792], [-5, -5, 620, 800]) === false,
  'a CropBox LARGER than the MediaBox is not a hide (left alone)');
ok(E.voCropHidesContent([0, 0, 612, 792], [0.4, 0, 612, 792.3]) === false,
  'sub-1pt differences are rounding, not a crop');
ok(E.voCropHidesContent(null, [0, 0, 1, 1]) === false, 'missing MediaBox is safe (returns false)');
ok(E.voCropHidesContent([0, 0, 612, 792], ['x', 0, 612, 432]) === false, 'non-numeric box is safe (returns false)');

// The seal pipeline must actually wire the normaliser in, before the overlay.
const html = readFileSync('seal-document.html', 'utf8');
ok(/function voNormalizeSealPageBoxes\(pdf\)/.test(html), 'seal page defines voNormalizeSealPageBoxes');
ok(/voNormalizeSealPageBoxes\(pdf\)/.test(html.replace('function voNormalizeSealPageBoxes(pdf)', '')),
  'buildSealedPDF calls voNormalizeSealPageBoxes');
{
  // The call must precede the overlay loop, so furniture sits on the full page.
  const call = html.indexOf('window._voCropNormalizedPages = voNormalizeSealPageBoxes(pdf)');
  const loop = html.indexOf('for (let i = 0; i < pages.length; i++) {', html.indexOf('async function buildSealedPDF'));
  ok(call !== -1 && loop !== -1 && call < loop, 'normalisation runs BEFORE the stamping loop');
}
ok(/voNormalizeSealPageBoxes/.test(html) && /voCropHidesContent/.test(html),
  'the normaliser uses the engine decision function voCropHidesContent');

// ---- seal bands live on ADDED space, never over content ----
// The footer strip and QR panel used to be drawn over the page's own bottom
// edge and top-right corner; on a scanned original with no margins that
// covered the signature at the foot of a lease page. The stamping loop must
// extend the media/crop boxes and draw all seal furniture in the added bands.
{
  const stamp = html.slice(html.indexOf('async function buildSealedPDF'), html.indexOf('function addBlockchainPage') !== -1 ? html.indexOf('function addBlockchainPage') : html.indexOf('async function buildSealedPDF') + 20000);
  ok(/pg\.setMediaBox\(mbox\.x, mbox\.y - footH, mbox\.width, mbox\.height \+ footH \+ headH\)/.test(stamp),
    'each page is EXTENDED (media box grows down for the footer, up for the seal band)');
  ok(/pg\.setCropBox\(mbox\.x, mbox\.y - footH/.test(stamp),
    'the crop box is extended with the media box so viewers show the bands');
  ok(!/pg\.drawRectangle\(\{ x: 0, y: 0, width: pageW/.test(stamp),
    'the footer strip is no longer painted over the page content at y=0');
  ok(/y: footY/.test(stamp) && /y: headY/.test(stamp),
    'footer and header furniture draw inside the new bands');
  ok(/const panelY = headY \+/.test(stamp),
    'the QR panel sits in the added header band, not over the page corner');
}

// ---- sharing always leaves the user a saved copy of the whole bundle ----
// Samsung Internet attaches only part of the bundle even after canShare()
// approves it, with no way to detect what the target app received. Every
// share must ALSO save the full bundle to the device for the user's record.
{
  const shareSrc = html.slice(html.indexOf('function addShareButton'), html.indexOf('grid.insertBefore(btn, grid.firstChild)'));
  ok(/try \{ shared = navigator\.share\(data\); \}/.test(shareSrc),
    'share is still called synchronously in the click handler');
  // ORDER LOCK: saves queued BEFORE the share call. Saving after it raced the
  // native sheet — on Samsung Internet the download UI dismissed the sheet
  // entirely (field report: "downloads but no share sheet").
  ok(/saveFiles\(files\);/.test(shareSrc) && shareSrc.indexOf('saveFiles(files);') < shareSrc.indexOf('shared = navigator.share(data)'),
    'every share ALSO saves the full bundle, queued BEFORE the share sheet opens');
  ok(/saves a copy of each to your device for your records/.test(shareSrc),
    'the hint tells the user the bundle is saved for their records');

  // ONE download, not one per file. Several simultaneous downloads trip the
  // browser's "allow multiple downloads?" prompt, and that grant never
  // persists in incognito — so the record-save looked broken every session.
  ok(/a\.href = URL\.createObjectURL\(voZipBundle\(entries\)\)/.test(shareSrc)
    && /verum-omnis-bundle\.zip/.test(shareSrc),
    'a multi-file bundle saves as ONE archive');
  ok(!/for \(var i = 0; i < list\.length; i\+\+\) \{[^}]*a\.click\(\)/.test(shareSrc),
    'no per-file download loop remains');
  ok(/if \(list\.length === 1\)/.test(shareSrc), 'a single file still downloads as itself, unzipped');
}

// ---- the bundle archive is a valid, deterministic ZIP ----
{
  const zStart = html.indexOf('var VO_CRC_TABLE');
  const zEnd = html.indexOf('// Build the FULL share list');
  ok(zStart !== -1 && zEnd > zStart, 'ZIP writer block located');
  const zSrc = html.slice(zStart, zEnd);
  ok(!/Date\.now|new Date\(\)/.test(zSrc),
    'the archive uses a FIXED timestamp — same bundle, same bytes, every time');

  const parts = [];
  class FakeBlob { constructor(p) { this.parts = p; } }
  const fn = new Function('Blob', 'TextEncoder', '"use strict";' + zSrc + '\nreturn { voCrc32, voZipBundle };');
  const api = fn(FakeBlob, TextEncoder);
  ok(api.voCrc32(new TextEncoder().encode('123456789')) === 0xcbf43926,
    'CRC32 matches the standard check vector');
  const zip = api.voZipBundle([
    { name: 'doc-sealed.pdf', bytes: new TextEncoder().encode('hello') },
    { name: 'report-sealed.pdf', bytes: new TextEncoder().encode('world') }
  ]);
  const buf = Buffer.concat(zip.parts.map((p) => Buffer.from(p)));
  ok(buf.readUInt32LE(0) === 0x04034b50, 'archive starts with a local file header');
  ok(buf.readUInt32LE(buf.length - 22) === 0x06054b50, 'archive ends with the end-of-central-directory record');
  ok(buf.readUInt16LE(buf.length - 22 + 8) === 2, 'the central directory records both entries');
  ok(buf.includes(Buffer.from('doc-sealed.pdf')) && buf.includes(Buffer.from('report-sealed.pdf')),
    'both sealed filenames survive into the archive');
  const again = api.voZipBundle([
    { name: 'doc-sealed.pdf', bytes: new TextEncoder().encode('hello') },
    { name: 'report-sealed.pdf', bytes: new TextEncoder().encode('world') }
  ]);
  ok(Buffer.concat(again.parts.map((p) => Buffer.from(p))).equals(buf),
    'the same bundle produces byte-identical archives (deterministic)');
}

// ---- Seal Certificate privacy boundary ----
// The certificate travels: users file it in shared evidence folders alongside
// the sealed document. In Aug 2026 the only certificate variant carried the
// sealer's ID number, residential address and a GPS fix to metres — read by
// every recipient of a folder distributed to opposing parties, while the
// sealer was in hiding. The shareable certificate must never carry the
// private identity block; a separate PRIVATE variant, clearly named, may.
{
  const certStart = html.indexOf('async function buildSealCertificate');
  const certEnd = html.indexOf('async function buildAnchorCertificate');
  ok(certStart !== -1 && certEnd > certStart, 'buildSealCertificate exists ahead of buildAnchorCertificate');
  const certSrc = html.slice(certStart, certEnd);
  ok(/opts\.includePrivate\s*\?\s*\(opts\.identity/.test(certSrc),
    'identity renders only when includePrivate is set (gate inside the builder)');
  ok(/if\s*\(opts\.includePrivate\s*&&\s*\(hasIdy\s*\|\|\s*opts\.gps\s*\|\|\s*opts\.dev\)\)/.test(certSrc),
    'GPS and device lines are behind the includePrivate gate too');
  ok(/Recorded privately by the sealer/.test(certSrc),
    'the shareable certificate says identity was recorded, without showing it');

  // The pipeline builds the shareable certificate WITHOUT includePrivate and
  // a separate private variant WITH it — two latches, not one.
  ok(/_voSealCertPrivate/.test(html), 'a private certificate variant exists');
  ok(/includePrivate:\s*true/.test(html), 'the private variant is built with includePrivate: true');
  ok(/-seal-certificate-PRIVATE-do-not-share\.pdf/.test(html),
    'the private certificate filename warns against sharing');
  ok(/never place it in a shared folder/.test(html),
    'the download note tells the user which certificate is which');

  // The share bundle (_voShareFiles) must never include either certificate —
  // shares go to third parties by definition.
  const shareBlock = html.slice(html.indexOf('window._voShareFiles = [];'), html.indexOf('addShareButton();'));
  ok(shareBlock.length > 0 && !/SealCert/.test(shareBlock),
    'neither certificate variant is pushed into the share bundle');

  // A failed private build is retried once and then made VISIBLE (Sourcery,
  // PR #173): the private certificate is the sealer's only custody record of
  // the identity block, so silence here loses it without warning.
  ok(/privTry < 2 && !window\._voSealCertPrivate/.test(html),
    'the private certificate build retries once before giving up');
  ok(/_voSealCertPrivateFailed = true/.test(html),
    'a failed private build sets a failure flag');
  ok(/private record failed, see downloads/.test(html),
    'the pipeline step reports the private-record failure');
  ok(/could not be generated this run/.test(html) && /sealCertPrivateWarn/.test(html),
    'the download area shows a visible warning when the private certificate is missing');
}

// ---- Voice-note / audio as-is sealing ----
// WhatsApp voice notes (.opus and friends) are sealed AS-IS, individually:
// the audio bytes are never modified — the certificate and .ots receipt
// carry the seal record. The privacy latch carries over: shareable artifacts
// never hold identity; PRIVATE certificates land in their own ZIP.
{
  ok(/accept="\.pdf,application\/pdf,\.opus/.test(html),
    'the uploader accepts audio files alongside PDFs');
  const reM = html.match(/var VO_AUDIO_RE = (\/[^\n]+\/i);/);
  ok(!!reM, 'VO_AUDIO_RE is defined');
  const audioRe = eval(reM[1]);
  for (const n of ['PTT-20250406-WA0012.opus', 'note.m4a', 'clip.mp3', 'voice.amr', 'x.ogg'])
    ok(audioRe.test(n), 'audio extension recognised: ' + n);
  for (const n of ['doc.pdf', 'evidence.txt', 'photo.jpg', 'opus.pdf'])
    ok(!audioRe.test(n), 'non-audio not misrouted: ' + n);

  ok(/Seal documents and voice notes separately/.test(html),
    'mixing audio and PDFs in one seal is refused with an explanation');
  ok(/VO_AUDIO_MAX_FILES = 10/.test(html), 'audio batch is capped at 10 files');
  ok(/voSealAudioBatch/.test(html) && /if \(selectedAudioFiles\.length\) \{ return voSealAudioBatch\(\); \}/.test(html),
    'the seal button routes audio selections to the batch sealer');

  const batch = html.slice(html.indexOf('async function voSealAudioBatch'), html.indexOf('async function startSealing'));
  ok(batch.length > 0 && !/PDFDocument\.load\(bytes\)/.test(batch),
    'audio bytes are never passed through the PDF pipeline (sealed as-is)');
  ok(/shareEntries\.push\(\{ name: f\.name, bytes: bytes \}\)/.test(batch),
    'the ORIGINAL audio bytes go into the shareable ZIP unmodified');
  ok(/includePrivate: true/.test(batch) && /voice-notes-PRIVATE-certificates-do-not-share\.zip/.test(html),
    'identity lands only in the PRIVATE certificate ZIP, never the shareable one');
  ok(!/privEntries\.push\(\{ name: f\.name/.test(batch),
    'audio itself is never duplicated into the private ZIP');
  ok(/A transcript is not evidence — the sealed audio is/.test(html),
    'the UI states the evidentiary rule: the audio, not any transcript, is the evidence');
}

// ---- Voice-Note Evidence Report: manifest parsing + hard rules ----
// The report quotes the WhatsApp export line VERBATIM; parsed sender/time are
// a labelled convenience. The report never transcribes, never says who is
// speaking, and states that an audio file carries no sender identity.
{
  const fnSrc = html.match(/function voParseWaLine[\s\S]*?\n\}\nfunction voManifestLineFor[\s\S]*?\n\}/);
  ok(!!fnSrc, 'manifest parser functions located');
  const api2 = new Function(fnSrc[0] + '\nreturn { voParseWaLine, voManifestLineFor };')();

  const android = api2.voParseWaLine('06/04/2025, 08:15 - Marius Nortje: PTT-20250406-WA0012.opus (file attached)');
  ok(android && android.sender === 'Marius Nortje' && android.ts === '06/04/2025, 08:15',
    'Android export line parses (sender + timestamp)');
  const ios = api2.voParseWaLine('[2025/04/07, 09:02:11] Gary Highcock: <attached: PTT-20250407-WA0003.opus>');
  ok(ios && ios.sender === 'Gary Highcock' && ios.ts === '2025/04/07, 09:02:11',
    'iOS export line parses (sender + timestamp)');
  ok(api2.voParseWaLine('random text with no structure') === null, 'unstructured lines return null');
  ok(api2.voParseWaLine('06/04/2025, 08:15 - <attached: x.opus>') === null,
    'a line whose "sender" slot holds the attachment token is rejected');

  const man = '06/04/2025, 08:15 - Marius Nortje: PTT-20250406-WA0012.opus (file attached)\nnoise line\n';
  const hit = api2.voManifestLineFor(man, 'PTT-20250406-WA0012.opus');
  ok(hit && /Marius Nortje/.test(hit.line) && hit.sender === 'Marius Nortje',
    'the manifest line for a filename is found and returned verbatim');
  ok(api2.voManifestLineFor(man, 'PTT-20250409-WA0099.opus') === null,
    'a file the export never mentions gets no attribution');

  ok(/This report contains no transcription of any recording, and nothing in it identifies who is speaking/.test(html),
    'the report states the no-transcription / no-speaker-attribution rule');
  ok(/an audio file[\s\\n]*carries no sender identity/.test(html.replace(/\s+/g, ' ')),
    'the report states that sender labels come from the export, not the audio');
  ok(/pairing any image with any particular recording is for the reader/.test(html),
    'screenshots are exhibits — pairing is left to the reader');
  ok(/window\.VerumReport\.seal\(vrBytes/.test(html),
    'the voice-note report is sealed through the standard report path');
  ok(/not referenced by name in the supplied chat export/.test(html),
    'an unreferenced recording is disclosed as such, never attributed');
}

console.log(`\n[crop-normalize] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[crop-normalize] FAILURES'); process.exit(1); }
console.log('[crop-normalize] ALL GREEN');
