/**
 * The home page (index.html) has its own quick-verify widget. It used to look
 * only for an OLD plaintext seal format and reported "No seal found" on valid
 * VO-SEAL2 documents -- a real, sealed file shown as unsealed on the landing
 * page. This extracts the widget's real voVerifySeal() and proves it now
 * detects and integrity-checks current seals, matching verify.html.
 *
 * The integrity test is self-contained: it builds a buffer, hashes the
 * placeholder version, embeds that hash, and confirms voVerifySeal recovers a
 * MATCH -- exactly the seal/verify round trip.
 */
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  home-verify.test.mjs');
console.log('======================================================\n');

const toHex = (u8) => Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
const html = readFileSync('index.html', 'utf8');
function grab(name) {
  const re = new RegExp('(?:async\\s+)?function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}', 'm');
  const m = html.match(re);
  if (!m) throw new Error('could not extract ' + name + ' from index.html');
  return m[0];
}
const sandbox = { window: { crypto }, toHex, Uint8Array, String, parseInt, RegExp, Array };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext([grab('voU16'), grab('voU16Decode'), grab('voVerifySeal')].join(';') + '; this.voU16 = voU16; this.voVerifySeal = voVerifySeal;', sandbox);

const voU16 = sandbox.voU16;
const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

// Build a buffer carrying a VO-SEAL2 marker (UTF-16 hex) with the given hash.
function build(hash) {
  const marker = voU16('VO-SEAL2|' + hash + '|VO-TEST12345');
  return enc('%PDF-1.7 head bytes <' + marker + '> tail bytes here');
}
const PLACEHOLDER = '0'.repeat(128);
const digest = await crypto.subtle.digest('SHA-512', build(PLACEHOLDER));
const realHash = toHex(new Uint8Array(digest));
const sealed = build(realHash);

let r = await sandbox.voVerifySeal(sealed, Buffer.from(sealed).toString('latin1'));
ok(r && r.scheme === 'v2', 'detects a VO-SEAL2 seal (was reported as no-seal before)');
ok(r && r.sealId === 'VO-TEST12345', 'reads the seal ID');
ok(r && r.integrity === 'match', 'recomputes SHA-512 and confirms integrity (green tick)');

// Flip one content byte -> must become TAMPER, not match.
const tampered = Uint8Array.from(sealed);
tampered[10] ^= 0xff;
r = await sandbox.voVerifySeal(tampered, Buffer.from(tampered).toString('latin1'));
ok(r && r.integrity === 'tamper', 'a single altered byte is caught as TAMPER');

// A literal (non-hex) SEAL-CERT marker is recognised as a certificate.
const cert = enc('/Subject (SEAL-CERT|' + 'b'.repeat(128) + '|VO-AF07AD93E861)');
r = await sandbox.voVerifySeal(cert, Buffer.from(cert).toString('latin1'));
ok(r && r.scheme === 'sealcert' && r.sealId === 'VO-AF07AD93E861', 'recognises a literal SEAL-CERT certificate');

// Unsealed content -> null.
const plain = enc('just an ordinary pdf with no seal at all');
r = await sandbox.voVerifySeal(plain, Buffer.from(plain).toString('latin1'));
ok(r === null, 'unsealed content yields no seal');

console.log(`\n[home-verify] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[home-verify] FAILURES'); process.exit(1); }
console.log('[home-verify] ALL GREEN');
