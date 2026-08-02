/**
 * voPdfIsEncrypted precision. The seal page skips applying a NEW password when
 * it thinks the uploaded file is already encrypted. The old check flagged any
 * file whose bytes contained "/Encrypt" anywhere — so a report that merely
 * mentioned encryption (or embedded JSON/text carrying the token) was misread as
 * already-protected, and the password the user asked for was silently dropped
 * (symptom: the sealed PDF opens with no password prompt). The real trailer key
 * is an indirect reference "/Encrypt <n> <g> R"; only that shape may count.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  encrypt-detect.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const start = html.indexOf('function voPdfIsEncrypted(bytes) {');
const end = html.indexOf('// Selection-time warning');
ok(start !== -1 && end > start, 'voPdfIsEncrypted located in seal-document.html');
const src = html.slice(start, end);
const voPdfIsEncrypted = new Function('"use strict";' + src + '\nreturn voPdfIsEncrypted;')();

const bytesOf = (s) => new TextEncoder().encode(s);

// Genuine encrypted PDFs: the trailer carries "/Encrypt <n> <g> R".
ok(voPdfIsEncrypted(bytesOf('trailer\n<< /Size 12 /Root 1 0 R /Encrypt 9 0 R /ID[<a><b>] >>')) === true,
  'real trailer /Encrypt 9 0 R detected');
ok(voPdfIsEncrypted(bytesOf('/Encrypt\t11\n0 R')) === true,
  'whitespace variants (tab/newline) between token and reference still detected');

// False positives the OLD scan would have hit — all must be false now.
ok(voPdfIsEncrypted(bytesOf('This report explains how /Encrypt protects a PDF.')) === false,
  'the word "/Encrypt" in prose is NOT treated as an encrypted file');
ok(voPdfIsEncrypted(bytesOf('key: "/Encryption" enabled')) === false,
  '"/Encryption" (longer token) does not false-positive');
ok(voPdfIsEncrypted(bytesOf('/Encrypt 9 0 X')) === false,
  '"/Encrypt 9 0 X" (not an R reference) is not an encrypted file');
ok(voPdfIsEncrypted(bytesOf('/Encrypt /Standard')) === false,
  '"/Encrypt /Standard" (no object reference) does not false-positive');
ok(voPdfIsEncrypted(bytesOf('AES-256 password protection. Encrypt the report before sending.')) === false,
  'a report discussing encryption is NOT flagged as already-protected');
ok(voPdfIsEncrypted(bytesOf('%PDF-1.7\nplain content, no encrypt dictionary at all')) === false,
  'an ordinary PDF is not flagged');

console.log(`\n[encrypt-detect] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[encrypt-detect] FAILURES'); process.exit(1); }
console.log('[encrypt-detect] ALL GREEN');
