/**
 * Proves pdf-encrypt.js produces a STANDARD password-protected PDF that a real,
 * independent PDF engine (pdf.js) accepts. This is the guard behind the legal
 * proof-of-service use case: if the encryption were subtly wrong, an
 * institution's reader would reject the file, or worse, open it without the
 * password. pdf.js is bundled in this repo (verify.html uses it), so the test
 * needs no network.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const g = globalThis; g.window = g;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  pdf-encrypt.test.mjs');
console.log('======================================================\n');

// MD5 / RC4 known-answer vectors -- the parts that must be exactly right.
const { _md5, _rc4, encryptPdfStandard } = require(ROOT + '/pdf-encrypt.js');
const hex = (b) => Buffer.from(b).toString('hex');
const s2b = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
ok(hex(_md5(s2b(''))) === 'd41d8cd98f00b204e9800998ecf8427e', 'MD5("") vector');
ok(hex(_md5(s2b('abc'))) === '900150983cd24fb0d6963f7d28e17f72', 'MD5("abc") vector');
ok(hex(_rc4(s2b('Key'), s2b('Plaintext'))).toUpperCase() === 'BBF316E8D940AF0AD3', 'RC4 vector');

new Function('window', 'self', 'globalThis', readFileSync(ROOT + '/vendor/pdf-lib.min.js', 'utf8'))(g, g, g);
const { PDFDocument, StandardFonts } = g.PDFLib;

const doc = await PDFDocument.create();
doc.setTitle('Sealed Test');
doc.setSubject('VO-SEAL2|abc123|VO-TESTID|ORIG:deadbeef');
const font = await doc.embedFont(StandardFonts.Helvetica);
const p1 = doc.addPage([595, 842]);
p1.drawText('CONFIDENTIAL - Business Services Agreement', { x: 50, y: 780, size: 14, font });
p1.drawText('The total is R450,000 and also R470,000 contradiction.', { x: 50, y: 740, size: 11, font });
doc.addPage([595, 842]).drawText('Page two witness statement.', { x: 50, y: 780, size: 11, font });
const flat = await doc.save({ useObjectStreams: false });

const PW = 'Institution2026!';
const enc = encryptPdfStandard(flat, PW, null, 'deadbeef00112233445566778899aabb');
ok(enc.length > flat.length, 'encryption produced output');

new Function('window', 'self', 'globalThis', readFileSync(ROOT + '/vendor/pdf.min.js', 'utf8'))(g, g, g);
new Function('window', 'self', 'globalThis', readFileSync(ROOT + '/vendor/pdf.worker.min.js', 'utf8'))(g, g, g);
const pdfjs = g.pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = 'fake';
const open = (pw) => pdfjs.getDocument({ data: enc.slice(), password: pw }).promise;

let needed = false, wrong = false, opened = false, textOk = false;
try { await open(undefined); } catch (e) { needed = e && e.name === 'PasswordException'; }
try { await open('nope'); } catch (e) { wrong = e && e.name === 'PasswordException'; }
try {
  const d = await open(PW);
  opened = d.numPages === 2;
  const tc = await (await d.getPage(1)).getTextContent();
  const txt = tc.items.map((i) => i.str).join(' ');
  textOk = txt.includes('CONFIDENTIAL') && txt.includes('450,000');
} catch (e) { console.error('  open error:', e && e.name); }

ok(needed, 'a real reader (pdf.js) demands a password');
ok(wrong, 'wrong password is rejected');
ok(opened, 'correct password opens the document');
ok(textOk, 'decrypted text is intact');

console.log(`\n[pdf-encrypt] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[pdf-encrypt] FAILURES'); process.exit(1); }
console.log('[pdf-encrypt] ALL GREEN');
