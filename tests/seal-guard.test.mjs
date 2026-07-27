/**
 * Seal Guard enforces the founder invariant:
 *   "The only genuine Verum output is a sealed output.
 *    No seal = Verum Omnis never issued it."
 *
 * These tests prove the exit gate cannot be tricked into releasing an unsealed
 * PDF, while still letting genuinely-sealed documents and non-PDF artefacts
 * (e.g. .ots receipts) through. Detection must match the shipped verify.html
 * scanner: both plain-ASCII and pdf-lib's UTF-16BE-hex Info encodings, across
 * all three seal schemes.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../seal-guard.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const throws = (fn, code, n) => {
  try { fn(); fail++; console.error('  FAIL: ' + n + ' (did not throw)'); }
  catch (e) { if (!code || e.code === code) pass++; else { fail++; console.error('  FAIL: ' + n + ' (wrong code: ' + e.code + ')'); } }
};

console.log('======================================================');
console.log('RUN  seal-guard.test.mjs');
console.log('======================================================\n');

const HASH = 'a'.repeat(128);
const SEAL_ID = 'VO-ABC12345';

// Helper: bytes from a string (latin1), so we exercise the Uint8Array path.
const bytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const pdf = (body) => '%PDF-1.7\n' + body + '\n%%EOF';

// ---- isSealed: positive cases (every scheme, both encodings) ----
ok(G.isSealed(pdf(`/Subject (VO-SEAL2|${HASH}|${SEAL_ID})`)), 'VO-SEAL2 plain-ASCII detected');
ok(G.isSealed(pdf(`/Subject (VO-SEAL|${HASH}|${SEAL_ID})`)), 'VO-SEAL legacy plain-ASCII detected');
ok(G.isSealed(pdf(`/Subject (SEAL-CERT|${'b'.repeat(128)}|${SEAL_ID})`)), 'SEAL-CERT plain-ASCII detected');
ok(G.isSealed(pdf('xx ' + G._utf16Hex('VO-SEAL2|' + HASH + '|' + SEAL_ID) + ' yy')),
  'VO-SEAL2 UTF-16BE-hex (pdf-lib form) detected');
ok(G.isSealed(pdf('xx ' + G._utf16Hex('VO-SEAL2|').toLowerCase() + ' yy')),
  'UTF-16BE-hex detected case-insensitively (lower-case hex)');
ok(G.isSealed(bytes(pdf(`/Subject (VO-SEAL2|${HASH}|${SEAL_ID})`))), 'detects seal in a Uint8Array (not just string)');

// ---- isSealed: negative cases ----
ok(!G.isSealed(pdf('a perfectly ordinary unsealed document body')), 'unsealed PDF body -> not sealed');
ok(!G.isSealed(''), 'empty input -> not sealed');
ok(!G.isSealed(null), 'null input -> not sealed');
ok(!G.isSealed(pdf('VO-SEALED-BRANDING but no real marker')), 'lookalike text without a real marker -> not sealed');

// ---- isPdf ----
ok(G.isPdf(pdf('x')), 'recognises %PDF- magic (string)');
ok(G.isPdf(bytes(pdf('x'))), 'recognises %PDF- magic (bytes)');
ok(!G.isPdf('just some text'), 'non-PDF text -> not a PDF');

// ---- assertSealed ----
ok(G.assertSealed(pdf(`/Subject (VO-SEAL2|${HASH}|${SEAL_ID})`)) === true, 'assertSealed passes a sealed doc');
throws(() => G.assertSealed(pdf('unsealed body'), 'sealed.pdf'), 'VO_UNSEALED',
  'assertSealed throws VO_UNSEALED on an unsealed PDF');

// ---- the core threat: an unsealed file must never be released as a PDF ----
throws(() => G.sealedObjectURL(bytes(pdf('unsealed body')), { filename: 'x-sealed.pdf' }), 'VO_UNSEALED',
  'sealedObjectURL refuses an unsealed PDF (the forgery-protection gate)');

console.log(`\n[seal-guard] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[seal-guard] FAILURES'); process.exit(1); }
console.log('[seal-guard] ALL GREEN');
