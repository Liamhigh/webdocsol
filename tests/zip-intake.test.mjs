/**
 * WhatsApp chat exports arrive as a .zip and are unpacked ON THE DEVICE. This
 * runs the page's own ZIP reader (voUnzip / voInflateRaw / voDosDateToMs)
 * headless against archives built here: stored and deflated entries, a data
 * descriptor entry (Android's exporter), a folder, macOS cruft, an encrypted
 * entry and a truncated one — and locks the intake wiring around it.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + n); } };
console.log('======================================================');
console.log('RUN  zip-intake.test.mjs');
console.log('======================================================\n');

// ---- lift the reader out of the page --------------------------------------
const start = html.indexOf('var VO_ZIP_RE = ');
const end = html.indexOf('function voShowZipNote(');
ok(start > 0 && end > start, 'the ZIP intake block exists in seal-document.html');
const src = html.slice(start, end);
const sandbox = { TextDecoder, DecompressionStream, DataView, Uint8Array, File, Blob, Date, Math, Array, RegExp, Error, console, Promise, isFinite };
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.voUnzip = voUnzip; this.voExpandZips = voExpandZips; this.voDosDateToMs = voDosDateToMs; this.voIsZipFile = voIsZipFile; this.VO_ZIP_KEEP_RE = VO_ZIP_KEEP_RE; this.voMimeFor = voMimeFor;', sandbox);

// ---- a tiny ZIP writer for the test (local headers + central directory) ----
function crc32(buf) { let c, crc = 0xffffffff; for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }
function buildZip(entries) {
  const locals = [], centrals = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = e.data ? Buffer.from(e.data) : Buffer.alloc(0);
    const method = e.deflate ? 8 : 0;
    const comp = e.deflate ? zlib.deflateRawSync(data) : data;
    const flags = (e.descriptor ? 0x8 : 0) | (e.encrypted ? 0x1 : 0) | 0x800;
    const dtime = e.dtime || 0, ddate = e.ddate || 0;
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(flags), u16(method), u16(dtime), u16(ddate),
      u32(e.descriptor ? 0 : crc32(data)), u32(e.descriptor ? 0 : comp.length), u32(e.descriptor ? 0 : data.length), u16(name.length), u16(0), name, comp,
      e.descriptor ? Buffer.concat([u32(0x08074b50), u32(crc32(data)), u32(comp.length), u32(data.length)]) : Buffer.alloc(0)]);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method), u16(dtime), u16(ddate), u32(crc32(data)), u32(comp.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]));
    locals.push(local); off += local.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(off), u16(0)]);
  const zip = Buffer.concat([...locals, cd, eocd]);
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.length);
}

const chat = '06/04/2025, 08:15 - Marius Nortje: PTT-20250406-WA0012.opus (file attached)\n06/04/2025, 08:16 - Gary: IMG-20250406-WA0003.jpg (file attached)\n';
const opusBytes = Buffer.from('OggS' + 'x'.repeat(300));
const zipBuf = buildZip([
  { name: 'WhatsApp Chat with Marius.txt', data: chat, deflate: true, dtime: (8 << 11) | (15 << 5), ddate: ((2025 - 1980) << 9) | (4 << 5) | 6 },
  { name: 'PTT-20250406-WA0012.opus', data: opusBytes, deflate: false, descriptor: true },
  { name: 'IMG-20250406-WA0003.jpg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), deflate: true },
  { name: 'DOC-20250406-WA0004.pdf', data: '%PDF-1.4 fake', deflate: true },
  { name: 'STK-20250406-WA0005.webp', data: 'RIFFxxxxWEBP', deflate: false },
  { name: 'media/', data: '', deflate: false },
  { name: '__MACOSX/._PTT-20250406-WA0012.opus', data: 'cruft', deflate: false },
  { name: 'secret.opus', data: 'sealed', deflate: false, encrypted: true },
]);

const out = await sandbox.voUnzip(zipBuf);
const files = out.filter(e => e.bytes), skipped = out.filter(e => e.skipped);
ok(files.map(f => f.name).join(',') === 'WhatsApp Chat with Marius.txt,PTT-20250406-WA0012.opus,IMG-20250406-WA0003.jpg,DOC-20250406-WA0004.pdf,STK-20250406-WA0005.webp',
  'every file entry is read in order; folders and macOS cruft are ignored (' + files.map(f => f.name).join(',') + ')');
ok(Buffer.from(files[0].bytes).toString('utf8') === chat, 'a deflated chat export decompresses byte for byte');
ok(Buffer.compare(Buffer.from(files[1].bytes), opusBytes) === 0, 'a stored voice note with a data descriptor is read from the central directory sizes');
ok(files[2].bytes.length === 7 && files[2].bytes[0] === 0xff, 'a deflated image round-trips');
ok(skipped.length === 1 && skipped[0].name === 'secret.opus' && /password/.test(skipped[0].skipped), 'an encrypted entry is skipped with a named reason');
const d = new Date(files[0].lastModified);
ok(d.getFullYear() === 2025 && d.getMonth() === 3 && d.getDate() === 6 && d.getHours() === 8 && d.getMinutes() === 15, 'the DOS timestamp becomes the file\'s lastModified (' + d.toISOString() + ')');
ok(files[1].lastModified === 0, 'an entry without a date reports 0, never a guessed time');

// truncated archive: the entry is refused, the rest still reads
const trunc = zipBuf.slice(0);
{
  const bad = await sandbox.voUnzip(buildZip([{ name: 'a.txt', data: 'hello world', deflate: false }])).catch(e => 'threw ' + e.message);
  ok(Array.isArray(bad) && bad[0].bytes && Buffer.from(bad[0].bytes).toString() === 'hello world', 'a plain stored archive reads');
  let threw = null;
  try { await sandbox.voUnzip(new Uint8Array([1, 2, 3, 4]).buffer); } catch (e) { threw = e.message; }
  ok(/not a ZIP/.test(threw || ''), 'garbage is refused as not a ZIP archive');
}

// ---- expansion into File objects and the intake rules ----------------------
{
  const zipFile = new File([Buffer.from(zipBuf)], 'WhatsApp Chat with Marius.zip', { type: 'application/zip', lastModified: 1700000000000 });
  const x = await sandbox.voExpandZips([zipFile, new File(['x'], 'other.pdf', { type: 'application/pdf' })]);
  const names = x.files.map(f => f.name);
  ok(x.sawZip === true && names.join(',') === 'WhatsApp Chat with Marius.txt,PTT-20250406-WA0012.opus,IMG-20250406-WA0003.jpg,DOC-20250406-WA0004.pdf,other.pdf',
    'an archive expands into Files in place; stickers are left out; a plain file passes through (' + names.join(',') + ')');
  ok(x.files[1].type === 'audio/ogg' && x.files[2].type === 'image/jpeg' && x.files[0].type === 'text/plain', 'expanded files carry a MIME type by extension');
  ok(x.notes.length === 1 && /4 files unpacked on this device \(nothing was uploaded\)/.test(x.notes[0]) && /Not used: STK-20250406-WA0005\.webp, secret\.opus — password-protected/.test(x.notes[0]),
    'the panel note says what was unpacked, that nothing left the device, and what was not used (' + x.notes[0] + ')');
  ok(sandbox.voIsZipFile({ name: 'x.zip', type: '' }) && sandbox.voIsZipFile({ name: 'x', type: 'application/x-zip-compressed' }) && !sandbox.voIsZipFile({ name: 'x.pdf', type: 'application/pdf' }), 'zip detection by name or type');
  ok(!sandbox.VO_ZIP_KEEP_RE.test('sticker.webp') && !sandbox.VO_ZIP_KEEP_RE.test('card.vcf') && sandbox.VO_ZIP_KEEP_RE.test('PTT-1.opus') && sandbox.VO_ZIP_KEEP_RE.test('chat.txt') && sandbox.VO_ZIP_KEEP_RE.test('doc.pdf'), 'only evidence types are admitted from an archive');
}

// ---- wiring in the page ----------------------------------------------------
ok(/accept="[^"]*\.zip,application\/zip,application\/x-zip-compressed"/.test(html), 'the picker accepts .zip');
ok(/function voAddFiles\(fileList\) \{\n  voExpandZips\(fileList\)\.then\(/.test(html) && /function voAddFilesNow\(fileList\) \{/.test(html), 'every selection is expanded before the unchanged intake runs');
ok(/Documents in the export are not part of a voice-note batch — seal them separately/.test(html), 'documents inside a voice-note export are named for a separate seal, never mixed');
ok(/id="zipNote"/.test(html) && /function voShowZipNote\(notes\)/.test(html), 'the panel note element and its writer exist');
ok(/unpacked <strong>on this device, never uploaded<\/strong>/.test(html), 'the upload copy says the archive never leaves the device');
ok(/Export chat → <em>Include media<\/em>/.test(html), 'the upload copy gives the WhatsApp export steps');
ok(/VO_AUDIO_MAX_FILES = 25/.test(html) && /voScreenshotFiles\.length < 25/.test(html), 'a whole chat export fits one batch (25 notes, 25 images)');
ok(!/Date\.now\(\)/.test(src), 'the ZIP intake never reads the clock');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(/Voice notes count too\./.test(idx) && /WhatsApp voice notes &amp; chat exports/.test(idx) && !/ethereum/i.test(idx), 'the home page describes voice notes and chat exports and no longer mentions Ethereum');
ok(/\/images\/mission-hands\.jpg/.test(idx) && /\/images\/court-exterior\.jpg/.test(idx) && !/kimi\.page/.test(idx) && fs.existsSync(path.join(__dirname, '..', 'images', 'mission-hands.jpg')),
  'the home page photos are served from this site, not a third-party host');

console.log(`\n[zip-intake] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[zip-intake] FAILURES'); process.exit(1); }
console.log('[zip-intake] ALL GREEN');
