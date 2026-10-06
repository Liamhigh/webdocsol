/**
 * Photos sealed as documents (6 October 2026). A PNG or JPEG chosen without a
 * voice note used to be refused ("screenshots accompany a voice-note batch").
 * Now each photo is placed on its own PDF page on the device and joins the PDF
 * bundle. This runs the page's own converter (voPhotoToPdf / voPhotosToPdfs /
 * voJpegOrientation) headless with the vendored pdf-lib against real images
 * from images/, and locks the intake wiring around it.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'seal-document.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };
console.log('======================================================');
console.log('RUN  photo-intake.test.mjs');
console.log('======================================================\n');

// ---- lift the converter out of the page -----------------------------------
const start = html.indexOf('// EXIF orientation (tag 0x0112) of a JPEG');
const end = html.indexOf('// Add PDFs to the bundle (deduped by name+size)');
ok(start > 0 && end > start, 'the photo converter block exists in seal-document.html');
const src = html.slice(start, end);
const sandbox = { File, Blob, console, TextEncoder, TextDecoder, setTimeout, clearTimeout };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'vendor', 'pdf-lib.min.js'), 'utf8'), sandbox);
ok(sandbox.PDFLib && sandbox.PDFLib.PDFDocument, 'vendored pdf-lib loads');
sandbox.__subtle = webcrypto.subtle;
vm.runInContext(`var VO_SCREENSHOT_RE = /\\.(png|jpe?g)$/i;
async function voReadFileBytes(f) { return await f.arrayBuffer(); }
async function computeSHA512(bytes) { const h = await __subtle.digest('SHA-512', bytes); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''); }
async function __load(f) { return PDFLib.PDFDocument.load(new Uint8Array(await f.arrayBuffer())); }
async function __imgSize(f) { const d = await PDFLib.PDFDocument.create(); const i = await d.embedJpg(new Uint8Array(await f.arrayBuffer())); return [i.width, i.height]; }
` + src + '\nthis.__load = __load; this.__imgSize = __imgSize; this.voJpegOrientation = voJpegOrientation; this.voPhotoToPdf = voPhotoToPdf; this.voPhotosToPdfs = voPhotosToPdfs;', sandbox);

const jpg = new Uint8Array(fs.readFileSync(path.join(root, 'images', 'court-exterior.jpg')));
const png = new Uint8Array(fs.readFileSync(path.join(root, 'images', 'favicon.png')));
const sha512 = async (u8) => Buffer.from(await webcrypto.subtle.digest('SHA-512', u8)).toString('hex');

// A JPEG with an EXIF APP1 (big- or little-endian) carrying orientation v.
function withOrientation(u8, v, le) {
  const tiff = le
    ? [0x49,0x49,0x2A,0x00, 8,0,0,0, 1,0, 0x12,0x01, 3,0, 1,0,0,0, v,0,0,0, 0,0,0,0]
    : [0x4D,0x4D,0x00,0x2A, 0,0,0,8, 0,1, 0x01,0x12, 0,3, 0,0,0,1, 0,v,0,0, 0,0,0,0];
  const body = [0x45,0x78,0x69,0x66,0,0, ...tiff];
  const len = body.length + 2;
  return new Uint8Array([0xFF,0xD8, 0xFF,0xE1, len >> 8, len & 255, ...body, ...u8.slice(2)]);
}

(async () => {
  // ---- orientation reader --------------------------------------------------
  ok(sandbox.voJpegOrientation(jpg) === 1, 'a JPEG without EXIF orientation reads as upright (1)');
  for (const v of [3, 6, 8]) {
    ok(sandbox.voJpegOrientation(withOrientation(jpg, v, false)) === v, 'big-endian EXIF orientation ' + v + ' is read');
    ok(sandbox.voJpegOrientation(withOrientation(jpg, v, true)) === v, 'little-endian EXIF orientation ' + v + ' is read');
  }
  ok(sandbox.voJpegOrientation(png) === 1, 'a PNG reads as 1 (no JPEG markers)');
  ok(sandbox.voJpegOrientation(new Uint8Array([0xFF,0xD8,0xFF,0xE1,0,40])) === 1, 'a truncated EXIF segment does not throw');

  // ---- one photo, one page -------------------------------------------------
  const f1 = new File([jpg], 'IMG_20260406.jpg', { type: 'image/jpeg', lastModified: 1700000000000 });
  const out1 = await sandbox.voPhotoToPdf(f1);
  ok(out1.name === 'IMG_20260406.photo.pdf' && out1.type === 'application/pdf', 'the photo becomes <name>.photo.pdf');
  ok(out1.lastModified === 1700000000000, 'the photo\'s own date is carried to the PDF file');
  const b1 = new Uint8Array(await out1.arrayBuffer());
  const d1 = await sandbox.__load(out1);
  ok(d1.getPageCount() === 1, 'one photo gives one page');
  const h = await sha512(jpg);
  ok(d1.getSubject() === 'Original file SHA-512 ' + h, 'the PDF records the SHA-512 of the original photo file');
  // the JPEG is embedded unchanged: its bytes appear verbatim inside the PDF
  const idx = Buffer.from(b1).indexOf(Buffer.from(jpg.slice(0, 64)));
  ok(idx > 0 && Buffer.from(b1).subarray(idx, idx + jpg.length).equals(Buffer.from(jpg)), 'the JPEG bytes are embedded in the sealed page unchanged');
  const [pw, ph] = [d1.getPage(0).getWidth(), d1.getPage(0).getHeight()];
  ok(Math.abs(pw - 595.28) < 0.01 && ph <= 841.9, 'the page is A4 wide and no taller than A4');

  // orientation 6 (phone held upright): the page is laid out portrait
  const [iw, ih] = await sandbox.__imgSize(new File([jpg], 'x.jpg'));
  const landscape = iw > ih;
  const d6 = await sandbox.__load(await sandbox.voPhotoToPdf(new File([withOrientation(jpg, 6, true)], 'p.jpg', { type: 'image/jpeg' })));
  const r6 = d6.getPage(0).getHeight() / d6.getPage(0).getWidth();
  ok(landscape ? r6 > ph / pw : r6 < ph / pw, 'an EXIF-rotated photo is laid out upright (page shape follows the turned picture)');

  // a PNG works too
  const dp = await sandbox.__load(await sandbox.voPhotoToPdf(new File([png], 'shot.png', { type: 'image/png' })));
  ok(dp.getPageCount() === 1 && dp.getSubject() === 'Original file SHA-512 ' + await sha512(png), 'a PNG becomes one page with its SHA-512');

  // ---- a mixed selection ---------------------------------------------------
  const pdfIn = new File([b1], 'letter.pdf', { type: 'application/pdf' });
  const bad = new File([new Uint8Array([1, 2, 3, 4])], 'broken.jpg', { type: 'image/jpeg' });
  const r = await sandbox.voPhotosToPdfs([pdfIn, f1, bad, new File([png], 'b.png', { type: '' })]);
  ok(r.files.length === 3 && r.files[0] === pdfIn, 'PDFs pass through untouched and in order');
  ok(r.files[1].name === 'IMG_20260406.photo.pdf' && r.files[2].name === 'b.photo.pdf', 'photos (by name or MIME) are converted in place');
  ok(r.notes.some(n => /2 photos were placed on PDF pages \(one page each\) on this device, to be sealed as documents/.test(n) && /SHA-512/.test(n)), 'the panel note says how many photos were placed and that the SHA-512 is recorded');
  ok(r.notes.some(n => /Could not use: broken\.jpg \(not a PNG or JPEG picture\)/.test(n)), 'an unreadable picture is named, not silently dropped');

  // ---- intake wiring -------------------------------------------------------
  ok(/function voAddFiles\(fileList\) \{\n  voExpandZips\(fileList\)\.then\(/.test(html), 'every selection is still expanded first');
  ok(/if \(audioBatch\) return \{ files: files, notes: notes \};\n    return voPhotosToPdfs\(files\)/.test(html), 'photos are converted only when no voice note is in the batch (a voice-note batch keeps its screenshots as-is)');
  ok(!/Chat exports \(\.txt\) and screenshots accompany a voice-note batch/.test(html), 'the old photo refusal is gone');
  ok(/A chat export \(\.txt\) goes with a voice-note batch/.test(html), 'a chat .txt alone is still refused, with a way forward');
  ok(/up to 10 PDFs or photos \(JPG\/PNG\)/.test(html), 'the upload panel says photos are accepted');
  ok(/accept="[^"]*\.jpg[^"]*image\/jpeg/.test(html), 'the picker still offers JPG/PNG');

  console.log(`\nphoto-intake: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
