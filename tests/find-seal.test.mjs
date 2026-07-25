/**
 * The "find a sealed document" scanner on verify.html must correctly identify
 * a file's seal marker in both plain-ASCII and pdf-lib's UTF-16BE-hex Info
 * encoding, and match a searched seal ID / hash the same way. This extracts the
 * real functions from the shipped page and exercises them, so the finder can't
 * regress into failing to locate someone's original sealed document.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  find-seal.test.mjs');
console.log('======================================================\n');

const html = readFileSync('verify.html', 'utf8');
function grab(name) {
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}', 'm');
  const m = html.match(re);
  if (!m) throw new Error('could not extract ' + name);
  return m[0];
}
const sandbox = {};
vm.createContext(sandbox);
for (const fn of ['voUtf16Hex', 'voUtf16HexDecode', 'voScanSealMarkers', 'voFileMatchesTerm']) {
  vm.runInContext(grab(fn) + '; this.' + fn + ' = ' + fn + ';', sandbox);
}

// Build a marker exactly as pdf-lib would store it (UTF-16BE hex in the Info).
const HASH = 'a'.repeat(128);
const plain = `xx /Subject (VO-SEAL2|${HASH}|VO-ABC12345) yy`;
const utf16 = 'zz ' + sandbox.voUtf16Hex('VO-SEAL2|' + HASH + '|VO-ABC12345') + ' ww';

let s = sandbox.voScanSealMarkers(plain);
ok(s && s.scheme === 'VO-SEAL2' && s.sealId === 'VO-ABC12345', 'detects a plain-ASCII VO-SEAL2 marker');
s = sandbox.voScanSealMarkers(utf16);
ok(s && s.scheme === 'VO-SEAL2' && s.hash === HASH, 'detects a UTF-16BE-hex VO-SEAL2 marker (pdf-lib form)');

const cert = `/Subject (SEAL-CERT|${'b'.repeat(128)}|VO-AF07AD93E861)`;
s = sandbox.voScanSealMarkers(cert);
ok(s && s.scheme === 'SEAL-CERT' && s.sealId === 'VO-AF07AD93E861', 'distinguishes a SEAL-CERT certificate');

ok(sandbox.voScanSealMarkers('a plain unsealed pdf body') === null, 'unsealed content yields no marker');

// Search-term matching, both encodings and case-insensitive.
ok(sandbox.voFileMatchesTerm(plain, 'vo-abc12345'), 'matches a seal ID case-insensitively (plain)');
ok(sandbox.voFileMatchesTerm(utf16, 'VO-ABC12345'), 'matches a seal ID inside UTF-16 hex');
ok(!sandbox.voFileMatchesTerm(plain, 'VO-NOPE99999'), 'does not match an absent term');
ok(!sandbox.voFileMatchesTerm(plain, ''), 'blank term never matches');

console.log(`\n[find-seal] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[find-seal] FAILURES'); process.exit(1); }
console.log('[find-seal] ALL GREEN');
