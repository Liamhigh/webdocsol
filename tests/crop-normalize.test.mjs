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
}

console.log(`\n[crop-normalize] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[crop-normalize] FAILURES'); process.exit(1); }
console.log('[crop-normalize] ALL GREEN');
