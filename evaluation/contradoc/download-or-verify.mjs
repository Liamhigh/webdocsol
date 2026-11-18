#!/usr/bin/env node
// Development/CI only. Downloads the pinned official ContraDoc dataset into
// evaluation/.cache/contradoc/ (gitignored, never a production asset), or
// verifies an existing cache. Fails closed on any hash or size mismatch and
// never overwrites a mismatched file. The only network operation is a GET of
// the public dataset files at the pinned commit.

import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONTRADOC_RELEASE = Object.freeze({
  revision: 'd1c42d1e433595dd6e98fab7b669722cdc050b1d',
  members: Object.freeze({
    'ContraDoc.json': Object.freeze({
      url: 'https://raw.githubusercontent.com/ddhruvkr/CONTRADOC/d1c42d1e433595dd6e98fab7b669722cdc050b1d/ContraDoc.json',
      sha256: 'def2213b8c6314353614ddadd0c8bbefeb883a2ccd4ebfcacacf10e8754e158c',
      bytes: 4420050
    }),
    'LICENSE': Object.freeze({
      url: 'https://raw.githubusercontent.com/ddhruvkr/CONTRADOC/d1c42d1e433595dd6e98fab7b669722cdc050b1d/LICENSE',
      sha256: 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
      bytes: 11357
    })
  })
});

export const CACHE_DIRECTORY = path.join('evaluation', '.cache', 'contradoc');

function fail(message) {
  throw new Error('[contradoc-download] ' + message);
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function verifyMemberBytes(name, data) {
  const expected = CONTRADOC_RELEASE.members[name];
  if (!expected) fail('unexpected member ' + name);
  if (data.length !== expected.bytes) fail(name + ' has ' + data.length + ' bytes, expected ' + expected.bytes);
  if (sha256Hex(data) !== expected.sha256) fail(name + ' failed its pinned SHA-256 check');
  return true;
}

// Pure cache decision, exported for tests.
export function planCacheAction(memberStates) {
  let missing = 0;
  for (const name of Object.keys(CONTRADOC_RELEASE.members)) {
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
  try {
    const data = await readFile(path.join(directory, name));
    verifyMemberBytes(name, data);
    return 'valid';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    return 'invalid';
  }
}

async function main() {
  const directory = path.resolve(CACHE_DIRECTORY);
  await mkdir(directory, { recursive: true });
  const states = {};
  for (const name of Object.keys(CONTRADOC_RELEASE.members)) {
    states[name] = await cacheMemberState(directory, name);
  }
  const plan = planCacheAction(states);
  if (plan.action === 'error') fail(plan.reason);
  if (plan.action === 'verify-only') {
    console.log('[contradoc-download] cache verified at ' + terminalSafe(directory) + ' (revision ' + CONTRADOC_RELEASE.revision + '); no network used');
    return;
  }
  for (const [name, member] of Object.entries(CONTRADOC_RELEASE.members)) {
    if (states[name] === 'valid') continue;
    const response = await fetch(member.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) fail('HTTP ' + response.status + ' for ' + name);
    const data = Buffer.from(await response.arrayBuffer());
    verifyMemberBytes(name, data);
    await writeAtomically(path.join(directory, name), data);
    console.log('[contradoc-download] wrote ' + terminalSafe(name) + ' (' + data.length + ' bytes)');
  }
  console.log('[contradoc-download] cache populated at ' + terminalSafe(directory) + ' (revision ' + CONTRADOC_RELEASE.revision + ')');
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(terminalSafe(error.stack || error.message));
    process.exitCode = 1;
  });
}
