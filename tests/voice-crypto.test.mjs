/**
 * Cross-page test for the .voice password-protection format.
 *
 * The sender encrypts in seal-document.html (encryptSealedPDF) and the
 * recipient decrypts in verify.html (voDecryptVoice). The two implementations
 * live in different files with no shared module -- this repo ships plain HTML
 * with no build step -- so this test extracts BOTH from the shipped pages and
 * round-trips them against each other. If either side changes its KDF
 * parameters or byte layout, this fails before a recipient ever gets a file
 * they cannot open.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  voice-crypto.test.mjs');
console.log('======================================================\n');

function extract(file, names) {
  const html = readFileSync(file, 'utf8');
  const out = {};
  for (const name of names) {
    const re = new RegExp('async function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n(  )?\\}', 'm');
    const m = html.match(re);
    if (!m) throw new Error(name + ' not found in ' + file);
    out[name] = m[0];
  }
  return out;
}

const sealFns = extract('seal-document.html', ['deriveKey', 'encryptSealedPDF']);
const verifyFns = extract('verify.html', ['voDeriveKey', 'voDecryptVoice']);

const sandbox = { crypto: globalThis.crypto, TextEncoder, Uint8Array, Error, Promise, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const src of [...Object.values(sealFns), ...Object.values(verifyFns)]) {
  vm.runInContext(src + ';', sandbox);
}
const run = (expr) => vm.runInContext(expr, sandbox);

const plaintext = new TextEncoder().encode('%PDF-1.7 sealed document payload ' + 'x'.repeat(500));
sandbox.__pt = plaintext;

// Round-trip: seal page encrypts, verify page decrypts.
const blob = await run('encryptSealedPDF(__pt, "correct horse battery")');
ok(blob.length === 16 + 12 + plaintext.length + 16,
  `blob layout is salt|iv|ct+tag (got ${blob.length})`);
sandbox.__blob = blob;
const back = await run('voDecryptVoice(__blob, "correct horse battery")');
ok(back.length === plaintext.length && back.every((b, i) => b === plaintext[i]),
  'verify page decrypts the seal page\'s output byte-for-byte');

// Wrong password must fail, not return garbage.
let threw = false;
try { await run('voDecryptVoice(__blob, "wrong password")'); } catch { threw = true; }
ok(threw, 'wrong password is rejected');

// Tampering must be detected (GCM authentication).
const tampered = Uint8Array.from(blob);
tampered[40] ^= 0xff;
sandbox.__tampered = tampered;
threw = false;
try { await run('voDecryptVoice(__tampered, "correct horse battery")'); } catch { threw = true; }
ok(threw, 'a modified ciphertext is rejected');

// Truncated file must be rejected cleanly.
sandbox.__short = blob.slice(0, 20);
threw = false;
try { await run('voDecryptVoice(__short, "correct horse battery")'); } catch { threw = true; }
ok(threw, 'a truncated file is rejected');

// The verify page must actually route .voice files to the decrypt path.
{
  const html = readFileSync('verify.html', 'utf8');
  ok(/\.voice['"]?\)/.test(html) && html.includes('handleVoiceFile'),
    'verify.html routes .voice uploads to the decrypt flow');
  ok(html.includes('accept=".pdf,.voice'), 'file picker accepts .voice');
}

console.log(`\n[voice-crypto] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[voice-crypto] FAILURES'); process.exit(1); }
console.log('[voice-crypto] ALL GREEN');
