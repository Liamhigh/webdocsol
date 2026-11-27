import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
createRequire(import.meta.url)('../ots-proof.js');
const ots = globalThis.VoOts;
const digest = Buffer.alloc(32, 0x11);
const sibling = Buffer.alloc(32, 0x22);
const sha = bytes => createHash('sha256').update(bytes).digest();
let root = Buffer.from(sha(sha(Buffer.concat([digest, sibling])))).reverse().toString('hex');
const blockHash = 'ab'.repeat(32);
const fragment = Buffer.from([0xf0, 32, ...sibling, 0x08, 0x08, 0x00,
  ...ots.constants.TAG_BITCOIN, 2, 0xe8, 0x07]);
const receipt = ots.buildFileFromFragment(digest.toString('hex'), fragment);
const originalFetch = globalThis.fetch;
let calls = [];
let mode = 'agree';
globalThis.fetch = async (url, opts) => {
  calls.push(url);
  assert.equal(opts.credentials, 'omit');
  assert.equal(opts.redirect, 'error');
  if (mode === 'offline' || (mode === 'single' && url.startsWith('https://mempool.space/'))) throw Error('offline');
  if (url.includes('/block-height/')) return { ok: true, text: async () => blockHash };
  return { ok: true, json: async () => ({
    id: blockHash, height: 1000,
    merkle_root: mode === 'disagree' && url.startsWith('https://mempool.space/') ? 'ff'.repeat(32) : root
  }) };
};
try {
  assert.equal((await ots.fetchChainConfirmation(receipt, digest.toString('hex'), 1000)).status, 'confirmed');
  assert.equal(calls.length, 4);
  assert.ok(calls.every(url => !url.includes(digest.toString('hex'))));
  const prependReceipt = ots.buildFileFromFragment(digest.toString('hex'),
    Uint8Array.from([0xf1, 32, ...sibling, 0x08, 0x08, 0x00, ...ots.constants.TAG_BITCOIN, 2, 0xe8, 0x07]));
  root = Buffer.from(sha(sha(Buffer.concat([sibling, digest])))).reverse().toString('hex');
  assert.equal((await ots.fetchChainConfirmation(prependReceipt, digest.toString('hex'), 1000)).status, 'confirmed');
  root = Buffer.from(sha(sha(Buffer.concat([digest, sibling])))).reverse().toString('hex');
  for (mode of ['offline', 'single', 'disagree']) {
    assert.equal((await ots.fetchChainConfirmation(receipt, digest.toString('hex'), 1000)).status, 'unavailable', mode);
  }
  mode = 'agree';
  assert.equal((await ots.fetchChainConfirmation(receipt, '33'.repeat(32), 1000)).status, 'unavailable');
  assert.equal((await ots.fetchChainConfirmation(receipt, digest.toString('hex'), 1001)).status, 'unavailable');
  assert.equal((await ots.fetchChainConfirmation(receipt.slice(0, -1), digest.toString('hex'), 1000)).status, 'unavailable');
  const altered = Uint8Array.from(receipt);
  altered[67] ^= 1;
  assert.equal((await ots.fetchChainConfirmation(altered, digest.toString('hex'), 1000)).status, 'unavailable');
  assert.equal((await ots.fetchChainConfirmation(Uint8Array.from([...receipt, 0]), digest.toString('hex'), 1000)).status, 'unavailable');
  const excessive = ots.buildFileFromFragment(digest.toString('hex'),
    Uint8Array.from([...Array(20).fill(0xf3), 0x00, ...ots.constants.TAG_BITCOIN, 2, 0xe8, 0x07]));
  calls = [];
  assert.equal((await ots.fetchChainConfirmation(excessive, digest.toString('hex'), 1000)).status, 'unavailable');
  assert.equal(calls.length, 0);

  for (const path of ['verify.html', 'seal-module/web/verify.html']) {
    const html = readFileSync(path, 'utf8');
    const start = html.indexOf('async function runOtsAnchorCheck(');
    const end = html.indexOf('// OTS anchor outcome telemetry', start);
    assert.ok(start >= 0 && end > start);
    let calendarResult = { status: 'pending' };
    let releaseChain;
    const box = { innerHTML: '', style: {} };
    const sandbox = {
      window: { VoOts: {
        fetchUpgraded: async () => calendarResult,
        buildPendingReceipt: () => receipt,
        fetchChainConfirmation: () => new Promise(resolve => { releaseChain = resolve; })
      } },
      otsAnchorBox: box, currentOtsProof: null, otsCheckGeneration: 0,
      resolveOtsDigest: async () => ({ digestHex: digest.toString('hex'), source: 'test' }),
      OTS_ANCHOR_CALENDARS: [], reportOtsAnchorOutcome: () => {}, lastSeal: null,
      console, isFinite
    };
    vm.runInNewContext(html.slice(start, end), sandbox);
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    assert.match(box.innerHTML, /PENDING/);
    calendarResult = { status: 'confirmed', otsBytes: receipt, summary: { bitcoin: [{ height: 1000 }] } };
    let pending = sandbox.runOtsAnchorCheck({}, {}, 1);
    while (!releaseChain) await new Promise(resolve => setImmediate(resolve));
    assert.match(box.innerHTML, /CALENDAR ATTESTATION/);
    assert.doesNotMatch(box.innerHTML, /BITCOIN CONFIRMED/);
    releaseChain({ status: 'unavailable' });
    await pending;
    assert.match(box.innerHTML, /CHAIN CHECK UNAVAILABLE/);
    assert.match(box.innerHTML, /Bitcoin Block.*1000/);
    releaseChain = null;
    pending = sandbox.runOtsAnchorCheck({}, {}, 1);
    while (!releaseChain) await new Promise(resolve => setImmediate(resolve));
    releaseChain({ status: 'confirmed' });
    await pending;
    assert.match(box.innerHTML, /BITCOIN CONFIRMED/);
    releaseChain = null;
    pending = sandbox.runOtsAnchorCheck({}, {}, 1);
    while (!releaseChain) await new Promise(resolve => setImmediate(resolve));
    calendarResult = { status: 'pending' };
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    releaseChain({ status: 'confirmed' });
    await pending;
    assert.match(box.innerHTML, /PENDING/);
    assert.doesNotMatch(box.innerHTML, /BITCOIN CONFIRMED/);
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log('OTS chain confirmation tests passed');
