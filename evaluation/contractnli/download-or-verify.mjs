#!/usr/bin/env node
// Development/CI only. Downloads the pinned official ContractNLI release into
// evaluation/.cache/contractnli/ (gitignored, never a production asset), or
// verifies an existing cache. Fails closed on any hash, size or structure
// mismatch and never overwrites a mismatched file. No document content is ever
// uploaded; the only network operation is a GET of the public dataset zip.

import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const CONTRACTNLI_RELEASE = Object.freeze({
  revision: 'eced6528dd3c1d14d73f9a87df8f7bdbc03126f9',
  zip: Object.freeze({
    url: 'https://stanfordnlp.github.io/contract-nli/resources/contract-nli.zip',
    mirror: 'https://raw.githubusercontent.com/stanfordnlp/contract-nli/gh-pages/resources/contract-nli.zip',
    sha256: 'e03fc77bbf8b53e2976a250e81d8a294bc3d5e5fb014521e477dee9340d6287b',
    bytes: 65362913
  }),
  members: Object.freeze({
    'contract-nli/train.json': Object.freeze({ sha256: 'dbceb356cd6203b35b27be94a5fa85e499a81c34c42c89ad53060b39f0257ba5', bytes: 7608211 }),
    'contract-nli/dev.json': Object.freeze({ sha256: '310af7d661d2ab50ee3700169cef524c75f39fb296bbf5a515c229eb0f42e68e', bytes: 1183107 }),
    'contract-nli/test.json': Object.freeze({ sha256: '460267b56052a2dc5aead98eb35eadef9e6734d5723d37b4a9790e410f812387', bytes: 2260203 }),
    'contract-nli/LICENSE': Object.freeze({ sha256: '9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94', bytes: 18656 }),
    'contract-nli/TERMS': Object.freeze({ sha256: 'b86e5b9bd7d2c49fd0d60e1d0842b7f64746abc8b206451acbe9080027cc49c8', bytes: 3664 }),
    'contract-nli/README.md': Object.freeze({ sha256: 'cd2b3e8afafbfa95b1d3613e438b173ab3c3c089162d15b9e329cf9c6bf86206', bytes: 5561 })
  })
});

export const CACHE_DIRECTORY = path.join('evaluation', '.cache', 'contractnli');

const MAX_ZIP_BYTES = 128 * 1024 * 1024;

function fail(message) {
  throw new Error('[contractnli-download] ' + message);
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value;
  }
  return table;
})();

export function crc32(data) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Minimal reader for the pinned release zip: central-directory driven, store
// and deflate members only, CRC and size verified. Anything else fails closed.
export function readZipEntries(buffer, wantedNames) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('zip buffer is required');
  if (buffer.length > MAX_ZIP_BYTES) fail('zip exceeds the 128 MiB limit');
  let eocdOffset = -1;
  const scanStart = Math.max(0, buffer.length - 65557);
  for (let index = buffer.length - 22; index >= scanStart; index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocdOffset = index; break; }
  }
  if (eocdOffset < 0) fail('zip end of central directory not found');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (centralOffset + centralSize > eocdOffset) fail('zip central directory is out of bounds');
  const wanted = new Map();
  const remaining = new Set(wantedNames);
  let offset = centralOffset;
  for (let entry = 0; entry < entryCount; entry++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) fail('zip central directory entry is malformed');
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (remaining.has(name)) {
      if (method !== 0 && method !== 8) fail('zip member ' + name + ' uses an unsupported compression method ' + method);
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) fail('zip member ' + name + ' has a malformed local header');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      if (dataStart + compressedSize > buffer.length) fail('zip member ' + name + ' data is out of bounds');
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
      if (data.length !== uncompressedSize) fail('zip member ' + name + ' decompressed to an unexpected size');
      if (crc32(data) !== crc) fail('zip member ' + name + ' failed its CRC check');
      wanted.set(name, data);
      remaining.delete(name);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (remaining.size) fail('zip is missing members: ' + [...remaining].join(', '));
  return wanted;
}

export function verifyMemberBytes(name, data) {
  const expected = CONTRACTNLI_RELEASE.members[name];
  if (!expected) fail('unexpected member ' + name);
  if (data.length !== expected.bytes) fail(name + ' has ' + data.length + ' bytes, expected ' + expected.bytes);
  if (sha256Hex(data) !== expected.sha256) fail(name + ' failed its pinned SHA-256 check');
  return true;
}

// Pure cache decision, exported for tests: given the state of each member file
// on disk, decide whether the cache is usable, downloadable, or unsafe.
export function planCacheAction(memberStates) {
  const names = Object.keys(CONTRACTNLI_RELEASE.members);
  let missing = 0;
  for (const name of names) {
    const state = memberStates[name] || 'missing';
    if (state === 'invalid') {
      return Object.freeze({ action: 'error', reason: name + ' exists but fails the pinned hash; remove it manually before retrying' });
    }
    if (state === 'missing') missing++;
  }
  if (missing === 0) return Object.freeze({ action: 'verify-only' });
  return Object.freeze({ action: 'download' });
}

function terminalSafe(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => '\\x' + character.charCodeAt(0).toString(16).padStart(2, '0'));
}

async function writeAtomically(outputPath, data) {
  const temporaryPath = path.join(path.dirname(outputPath), '.' + path.basename(outputPath) + '.' + process.pid + '.tmp');
  let handle;
  try {
    handle = await open(temporaryPath, 'wx');
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (handle) await handle.close();
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function cacheMemberState(directory, name) {
  const filePath = path.join(directory, path.basename(name));
  try {
    const data = await readFile(filePath);
    verifyMemberBytes(name, data);
    return 'valid';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    return 'invalid';
  }
}

async function downloadZip() {
  const sources = [CONTRACTNLI_RELEASE.zip.url, CONTRACTNLI_RELEASE.zip.mirror];
  let lastError = null;
  for (const source of sources) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== CONTRACTNLI_RELEASE.zip.bytes) throw new Error('zip has ' + buffer.length + ' bytes, expected ' + CONTRACTNLI_RELEASE.zip.bytes);
      if (sha256Hex(buffer) !== CONTRACTNLI_RELEASE.zip.sha256) throw new Error('zip failed its pinned SHA-256 check');
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  fail('could not download the pinned release: ' + (lastError ? lastError.message : 'no source answered'));
}

async function main() {
  const directory = path.resolve(CACHE_DIRECTORY);
  await mkdir(directory, { recursive: true });
  const states = {};
  for (const name of Object.keys(CONTRACTNLI_RELEASE.members)) {
    states[name] = await cacheMemberState(directory, name);
  }
  const plan = planCacheAction(states);
  if (plan.action === 'error') fail(plan.reason);
  if (plan.action === 'verify-only') {
    console.log('[contractnli-download] cache verified at ' + terminalSafe(directory) + ' (revision ' + CONTRACTNLI_RELEASE.revision + '); no network used');
    return;
  }
  const zip = await downloadZip();
  const entries = readZipEntries(zip, Object.keys(CONTRACTNLI_RELEASE.members));
  for (const [name, data] of entries) {
    verifyMemberBytes(name, data);
    const target = path.join(directory, path.basename(name));
    if (states[name] === 'valid') continue;
    await writeAtomically(target, data);
    console.log('[contractnli-download] wrote ' + terminalSafe(path.basename(name)) + ' (' + data.length + ' bytes)');
  }
  console.log('[contractnli-download] cache populated at ' + terminalSafe(directory) + ' (revision ' + CONTRACTNLI_RELEASE.revision + ')');
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
