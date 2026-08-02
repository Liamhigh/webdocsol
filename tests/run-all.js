// Runs every test file in its own Node process so per-file assertion counters
// stay isolated. Exits non-zero if any suite fails.
//
// Run:  node tests/run-all.js   (or:  npm test)

const { spawnSync } = require('node:child_process');
const path = require('path');

const suites = [
  'forensic-engine.test.js',
  'ots-proof.test.js',
  'worker.test.mjs',
  'page-boot.test.mjs',
  'engine-perf.test.mjs',
  'voice-crypto.test.mjs',
  'pdf-encrypt.test.mjs',
  'find-seal.test.mjs',
  'seal-guard.test.mjs',
  'franchise-lease.test.mjs',
  'detector-recall.test.mjs',
  'digital-forensics.test.mjs',
  'ocr-rescue.test.mjs',
  'rule-classify.test.mjs',
  'findings-json.test.mjs',
  'finding-anchors.test.mjs',
  'encrypt-detect.test.mjs',
  'constitution-lock.test.mjs',
  'home-verify.test.mjs',
  'inline-scripts.test.mjs',
  'legal-analysis.test.js',
];

let failed = 0;
for (const s of suites) {
  console.log('\n======================================================');
  console.log('RUN  ' + s);
  console.log('======================================================');
  const res = spawnSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}

console.log('\n======================================================');
if (failed) {
  console.log('RESULT: ' + failed + ' suite(s) FAILED');
  process.exit(1);
}
console.log('RESULT: all suites GREEN');
