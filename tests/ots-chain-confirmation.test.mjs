import nodeAssert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let assertions = 0;
const assert = new Proxy(nodeAssert, {
  get(target, key) {
    const value = target[key];
    return typeof value === 'function' ? (...args) => { assertions++; return value(...args); } : value;
  }
});
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
    calendarResult = { status: 'confirmed', otsBytes: receipt, calendar: 'https://first.example',
      summary: { bitcoin: [{ height: 1000 }] } };
    let releaseCandidates;
    sandbox.window.VoOts.fetchChainConfirmation = async () => ({ status: 'unavailable' });
    sandbox.window.VoOts.fetchUpgradedCandidates = () => new Promise(resolve => { releaseCandidates = resolve; });
    pending = sandbox.runOtsAnchorCheck({}, {}, 1);
    while (!releaseCandidates) await new Promise(resolve => setImmediate(resolve));
    calendarResult = { status: 'pending' };
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    releaseCandidates([{ status: 'confirmed', otsBytes: receipt, summary: { bitcoin: [{ height: 1000 }] } }]);
    await pending;
    assert.match(box.innerHTML, /PENDING/);
    assert.doesNotMatch(box.innerHTML, /BITCOIN CONFIRMED|CHAIN CHECK UNAVAILABLE/);
    calendarResult = { status: 'confirmed', otsBytes: receipt, calendar: 'https://first.example',
      summary: { bitcoin: [{ height: 1001 }, { height: 1000 }, { height: 1000 }] } };
    const checkedHeights = [];
    sandbox.window.VoOts.fetchChainConfirmation = async (bytes, hash, height) => {
      checkedHeights.push(height);
      return { status: height === 1000 ? 'confirmed' : 'unavailable' };
    };
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    assert.deepEqual(checkedHeights, [1001, 1000]);
    assert.match(box.innerHTML, /BITCOIN CONFIRMED/);
    assert.match(box.innerHTML, /Bitcoin Block.*1000/);
  }

  const originalTimer = globalThis.setTimeout;
  let stalledSignal;
  try {
    globalThis.setTimeout = (fn, delay) => originalTimer(fn, delay === 15000 ? 20 : delay);
    globalThis.fetch = async (url, opts) => {
      if (url.startsWith('https://stalled.example/')) {
        stalledSignal = opts.signal;
        return { ok: true, arrayBuffer: () => new Promise(() => {}) };
      }
      return { ok: true, arrayBuffer: async () => Uint8Array.from(fragment).buffer };
    };
    const bounded = await ots.fetchUpgradedCandidates(digest.toString('hex'),
      ['https://stalled.example', 'https://healthy.example'], null);
    assert.equal(bounded.length, 1);
    assert.equal(bounded[0].calendar, 'https://healthy.example');
    assert.equal(stalledSignal.aborted, true);
  } finally {
    globalThis.setTimeout = originalTimer;
  }

  const badFragment = Buffer.from(fragment);
  badFragment[2] ^= 1;
  const calendars = ['https://first.example', 'https://second.example', 'https://third.example'];
  let allBad = false;
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(url);
    if (url.startsWith('https://first.example/') || url.startsWith('https://second.example/')) {
      const body = url.startsWith('https://first.example/') || allBad ? badFragment : fragment;
      return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(body).buffer };
    }
    if (url.startsWith('https://third.example/')) return { ok: false, status: 404 };
    assert.ok(url.startsWith('https://blockstream.info/api/') || url.startsWith('https://mempool.space/api/'));
    assert.ok(!url.includes(digest.toString('hex')));
    assert.equal(opts.credentials, 'omit');
    if (url.includes('/block-height/')) return { ok: true, text: async () => blockHash };
    return { ok: true, json: async () => ({ id: blockHash, height: 1000, merkle_root: root }) };
  };
  const candidates = await ots.fetchUpgradedCandidates(digest.toString('hex'),
    [calendars[0] + '/', calendars[1], calendars[1] + '/digest', calendars[2]], calendars[0]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].calendar, calendars[1]);
  assert.equal(calls.filter(url => url.startsWith(calendars[0])).length, 0);
  assert.equal(calls.filter(url => url.startsWith(calendars[1])).length, 1);
  assert.equal(calls.filter(url => url.startsWith(calendars[2])).length, 1);

  for (const path of ['verify.html', 'seal-module/web/verify.html']) {
    const html = readFileSync(path, 'utf8');
    const start = html.indexOf('async function runOtsAnchorCheck(');
    const end = html.indexOf('// OTS anchor outcome telemetry', start);
    const box = { innerHTML: '', style: {} };
    const sandbox = {
      window: { VoOts: ots }, otsAnchorBox: box, currentOtsProof: null, otsCheckGeneration: 0,
      resolveOtsDigest: async () => ({ digestHex: digest.toString('hex'), source: 'test' }),
      OTS_ANCHOR_CALENDARS: calendars, reportOtsAnchorOutcome: () => {}, lastSeal: null,
      console, isFinite
    };
    vm.runInNewContext(html.slice(start, end), sandbox);
    allBad = false;
    calls = [];
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    assert.match(box.innerHTML, /BITCOIN CONFIRMED/);
    assert.match(box.innerHTML, /second\.example/);
    assert.equal(ots.bytesToHex(sandbox.currentOtsProof.bytes), ots.bytesToHex(receipt));
    assert.equal(calls.filter(url => url.startsWith(calendars[0])).length, 1);
    assert.equal(calls.filter(url => url.startsWith(calendars[1])).length, 1);
    allBad = true;
    calls = [];
    await sandbox.runOtsAnchorCheck({}, {}, 1);
    assert.match(box.innerHTML, /CHAIN CHECK UNAVAILABLE/);
    assert.doesNotMatch(box.innerHTML, /BITCOIN CONFIRMED|tamper/i);
    assert.match(box.innerHTML, /first\.example/);
    assert.equal(calls.filter(url => url.startsWith(calendars[1])).length, 1);
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log(`[ots-chain-confirmation] PASS=${assertions} FAIL=0`);
