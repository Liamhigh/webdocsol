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

console.log(`\n[crop-normalize] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[crop-normalize] FAILURES'); process.exit(1); }
console.log('[crop-normalize] ALL GREEN');
